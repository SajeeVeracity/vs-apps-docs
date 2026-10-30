import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactElement, ReactNode } from 'react';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import {
  clampView,
  disabledFlags,
  dragView,
  initialView,
  panDown,
  panLeft,
  panRight,
  panUp,
  isZoomed,
  pinchView,
  viewForKey,
  viewportLabel,
  wheelZoom,
  zoomIn,
  zoomOut,
} from './diagramView.ts';
import type { DisabledFlags, Point, Size, Touches, View } from './diagramView.ts';

const MERMAID_CONTAINER = '.docusaurus-mermaid-container';
const WHEEL_LINE_HEIGHT_PX = 16;

interface Control {
  area: string;
  flag: keyof DisabledFlags;
  label: string;
  icon: ReactElement;
  disabled: boolean;
  apply: (view: View, size: Size) => View;
}

function Icon({ path }: { path: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  zoomIn: <Icon path="M8 3v10M3 8h10" />,
  zoomOut: <Icon path="M3 8h10" />,
  reset: <Icon path="M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5" />,
  up: <Icon path="M3.5 10 8 5.5l4.5 4.5" />,
  down: <Icon path="M3.5 6 8 10.5 12.5 6" />,
  left: <Icon path="M10 3.5 5.5 8l4.5 4.5" />,
  right: <Icon path="M6 3.5 10.5 8 6 12.5" />,
};

function DiagramFrame({ children }: { children: ReactNode }): ReactElement {
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState(viewportLabel(null));
  const [view, setView] = useState<View>(initialView);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: View; from: Touches } | null>(null);

  const commit = (next: View) => {
    if (next.zoom === viewRef.current.zoom && next.x === viewRef.current.x && next.y === viewRef.current.y) return;
    viewRef.current = next;
    setView(next);
  };

  // React registers wheel listeners as passive, so preventDefault needs a native non-passive one.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const deltaY = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE_HEIGHT_PX : event.deltaY;
      commit(wheelZoom(viewRef.current, deltaY, { x: event.clientX - rect.left, y: event.clientY - rect.top }, readSize(viewport)));
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  // The Mermaid container is added after hydration, and a theme change replaces its SVG; ready never turns back off. The label is the SVG's `<title>`, which Mermaid renders from `accTitle`.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const detect = () => {
      const container = frame.querySelector(MERMAID_CONTAINER);
      if (!container) return;
      setReady(true);
      setLabel(viewportLabel(container.querySelector('svg > title')?.textContent));
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const observer = new ResizeObserver(() => {
      setView((current) => {
        const next = clampView(current, readSize(viewport));
        return next.x === current.x && next.y === current.y ? current : next;
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const flags = disabledFlags(view, readSize(viewportRef.current));
  const controls: Control[] = [
    { area: 'zin', flag: 'zoomIn', label: 'Zoom in', icon: ICONS.zoomIn, disabled: flags.zoomIn, apply: zoomIn },
    { area: 'zout', flag: 'zoomOut', label: 'Zoom out', icon: ICONS.zoomOut, disabled: flags.zoomOut, apply: zoomOut },
    { area: 'reset', flag: 'reset', label: 'Reset view', icon: ICONS.reset, disabled: flags.reset, apply: () => initialView },
    { area: 'up', flag: 'panUp', label: 'Pan up', icon: ICONS.up, disabled: flags.panUp, apply: panUp },
    { area: 'down', flag: 'panDown', label: 'Pan down', icon: ICONS.down, disabled: flags.panDown, apply: panDown },
    { area: 'left', flag: 'panLeft', label: 'Pan left', icon: ICONS.left, disabled: flags.panLeft, apply: panLeft },
    { area: 'right', flag: 'panRight', label: 'Pan right', icon: ICONS.right, disabled: flags.panRight, apply: panRight },
  ];

  const restartGesture = () => {
    // Array.from, not spread: Docusaurus compiles with Babel preset-env `loose`, which turns `[...iterator]` into `[iterator]`.
    const points = Array.from(pointers.current.values());
    gesture.current = points.length === 0 ? null : { start: viewRef.current, from: touchesOf(points) };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const isMouse = event.pointerType === 'mouse';
    if (isMouse && (event.button !== 0 || !isZoomed(viewRef.current))) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, localPoint(event));
    restartGesture();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, localPoint(event));
    const { start, from } = gesture.current;
    const points = Array.from(pointers.current.values());
    const size = readSize(viewportRef.current);
    if (points.length === 1) {
      commit(dragView(start, points[0].x - from.centre.x, points[0].y - from.centre.y, size));
    } else {
      commit(pinchView(start, from, touchesOf(points), size));
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    restartGesture();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const next = viewForKey(viewRef.current, event.key, readSize(viewportRef.current));
    if (!next) return;
    event.preventDefault();
    commit(next);
  };

  return (
    <div ref={frameRef} className="diagram-frame">
      <div
        ref={viewportRef}
        className="diagram-viewport"
        tabIndex={ready ? 0 : undefined}
        style={isZoomed(view) ? { touchAction: 'none', userSelect: 'none' } : { touchAction: 'pan-x pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        role={ready ? 'group' : undefined}
        aria-label={ready ? label : undefined}
        aria-describedby={ready ? hintId : undefined}
      >
        <div
          className="diagram-inner"
          style={!isZoomed(view) ? undefined : { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {children}
        </div>
      </div>
      {ready && (
        <>
          <span id={hintId} className="diagram-hint">
            Arrow keys pan. Plus and minus zoom. Zero resets.
          </span>
          <div className="diagram-controls" role="group" aria-label="Diagram controls">
            {controls.map((control) => (
              <button
                key={control.area}
                type="button"
                className="diagram-button"
                style={{ gridArea: control.area }}
                aria-label={control.label}
                title={control.label}
                disabled={control.disabled}
                onClick={() => {
                  const size = readSize(viewportRef.current);
                  const next = control.apply(viewRef.current, size);
                  commit(next);
                  if (disabledFlags(next, size)[control.flag]) viewportRef.current?.focus();
                }}
              >
                {control.icon}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function localPoint(event: PointerEvent<HTMLElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Two points give a pinch; a single point gives a drag, whose spread of 0 is never used. */
function touchesOf(points: Point[]): Touches {
  const [a, b] = points;
  if (!b) return { centre: a, spread: 0 };
  return { centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, spread: Math.hypot(a.x - b.x, a.y - b.y) };
}

function readSize(viewport: HTMLElement | null): Size {
  return { width: viewport?.clientWidth ?? 0, height: viewport?.clientHeight ?? 0 };
}

/** Wraps one Mermaid fence. If the wrapper throws, the plain fence renders. */
export default function DiagramControls({ children }: { children: ReactNode }): ReactElement {
  return (
    <ErrorBoundary fallback={() => <>{children}</>}>
      <DiagramFrame>{children}</DiagramFrame>
    </ErrorBoundary>
  );
}
