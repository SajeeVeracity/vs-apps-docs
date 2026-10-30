import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import { disabledFlags, initialView, reset, zoomIn, zoomOut } from './diagramView.ts';
import type { Size, View } from './diagramView.ts';

const MERMAID_CONTAINER = '.docusaurus-mermaid-container';

interface Control {
  area: string;
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
};

function DiagramFrame({ children }: { children: ReactNode }): ReactElement {
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>(initialView);

  // The Mermaid container is added after hydration, and a theme change replaces its SVG; ready never turns back off.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const detect = () => {
      if (frame.querySelector(MERMAID_CONTAINER)) setReady(true);
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const flags = disabledFlags(view, readSize(viewportRef.current));
  const controls: Control[] = [
    { area: 'zin', label: 'Zoom in', icon: ICONS.zoomIn, disabled: flags.zoomIn, apply: zoomIn },
    { area: 'zout', label: 'Zoom out', icon: ICONS.zoomOut, disabled: flags.zoomOut, apply: zoomOut },
    { area: 'reset', label: 'Reset view', icon: ICONS.reset, disabled: flags.reset, apply: reset },
  ];

  return (
    <div ref={frameRef} className={ready ? 'diagram-frame' : undefined}>
      <div ref={viewportRef} className="diagram-viewport">
        <div
          className="diagram-inner"
          style={view.zoom === 1 ? undefined : { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {children}
        </div>
      </div>
      {ready && (
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
              onClick={() => setView((current) => control.apply(current, readSize(viewportRef.current)))}
            >
              {control.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
