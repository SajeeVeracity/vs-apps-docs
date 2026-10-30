/** The viewport's client size in px. */
export interface Size {
  width: number;
  height: number;
}

/** `x` and `y` are the translate offsets in px, always within [size * (1 - zoom), 0]. */
export interface View {
  zoom: number;
  x: number;
  y: number;
}

/** True where the matching control has nothing to do: at the zoom limit or at the diagram edge. */
export interface DisabledFlags {
  zoomIn: boolean;
  zoomOut: boolean;
  reset: boolean;
  panUp: boolean;
  panDown: boolean;
  panLeft: boolean;
  panRight: boolean;
}

export const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/** Factor applied per zoom button press or `+`/`-` key. */
const ZOOM_STEP = 1.5;

/** Fraction of the viewport size a pan button or arrow key moves. */
const PAN_STEP = 0.2;

export const initialView: View = { zoom: MIN_ZOOM, x: 0, y: 0 };

/** True above 1x, where pan and drag have room to move. */
export const isZoomed = (view: View): boolean => view.zoom > MIN_ZOOM;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const minOffset = (length: number, zoom: number): number => length - length * zoom;

/** Clamps the offsets so the scaled content still covers the viewport. */
export function clampView(view: View, size: Size): View {
  return {
    zoom: view.zoom,
    x: clamp(view.x, minOffset(size.width, view.zoom), 0),
    y: clamp(view.y, minOffset(size.height, view.zoom), 0),
  };
}

/** A point in viewport coordinates, in px from its top-left corner. */
export interface Point {
  x: number;
  y: number;
}

/** Multiplies the zoom by `factor` (clamped to the range) keeping the content under `anchor` fixed, then re-covers the viewport. */
export function zoomAt(view: View, factor: number, anchor: Point, size: Size): View {
  const next = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = next / view.zoom;
  return clampView(
    { zoom: next, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio },
    size,
  );
}

const centreOf = (size: Size): Point => ({ x: size.width / 2, y: size.height / 2 });

export const zoomIn = (view: View, size: Size): View => zoomAt(view, ZOOM_STEP, centreOf(size), size);

export const zoomOut = (view: View, size: Size): View => zoomAt(view, 1 / ZOOM_STEP, centreOf(size), size);

// Pixels of `deltaY` per e-fold of zoom.
const WHEEL_PIXELS_PER_E_FOLD = 100;
// Caps one coarse mouse-wheel notch so it cannot jump the zoom.
const WHEEL_MAX_DELTA = 50;

/** Wheel up (negative `deltaY`) zooms in about the pointer. */
export const wheelZoom = (view: View, deltaY: number, anchor: Point, size: Size): View =>
  zoomAt(view, Math.exp(-clamp(deltaY, -WHEEL_MAX_DELTA, WHEEL_MAX_DELTA) / WHEEL_PIXELS_PER_E_FOLD), anchor, size);

/** The content follows the pointer by (`dx`, `dy`) px; at 1x the clamp leaves nothing to move. */
export const dragView = (view: View, dx: number, dy: number, size: Size): View =>
  clampView({ zoom: view.zoom, x: view.x + dx, y: view.y + dy }, size);

/** Midpoint and distance of the two touch points of a pinch. */
export interface Touches {
  centre: Point;
  spread: number;
}

/** Scales by the change in spread and keeps the content that was under `from.centre` under `to.centre`. */
export function pinchView(start: View, from: Touches, to: Touches, size: Size): View {
  const zoom = clamp(start.zoom * (from.spread > 0 ? to.spread / from.spread : 1), MIN_ZOOM, MAX_ZOOM);
  const ratio = zoom / start.zoom;
  return clampView(
    {
      zoom,
      x: to.centre.x - (from.centre.x - start.x) * ratio,
      y: to.centre.y - (from.centre.y - start.y) * ratio,
    },
    size,
  );
}

/** The arrow moves the view window, so the content offset moves the opposite way. */
function panBy(view: View, size: Size, dx: number, dy: number): View {
  return clampView({ zoom: view.zoom, x: view.x - dx, y: view.y - dy }, size);
}

export const panUp = (view: View, size: Size): View => panBy(view, size, 0, -size.height * PAN_STEP);

export const panDown = (view: View, size: Size): View => panBy(view, size, 0, size.height * PAN_STEP);

export const panLeft = (view: View, size: Size): View => panBy(view, size, -size.width * PAN_STEP, 0);

export const panRight = (view: View, size: Size): View => panBy(view, size, size.width * PAN_STEP, 0);

/** The view after a key on the focused viewport, or null when the key is not handled and should keep its default. */
export function viewForKey(view: View, key: string, size: Size): View | null {
  switch (key) {
    case '+':
      return zoomIn(view, size);
    case '-':
      return zoomOut(view, size);
    case '0':
      return initialView;
    default:
      break;
  }
  if (!isZoomed(view)) return null;
  switch (key) {
    case 'ArrowUp':
      return panUp(view, size);
    case 'ArrowDown':
      return panDown(view, size);
    case 'ArrowLeft':
      return panLeft(view, size);
    case 'ArrowRight':
      return panRight(view, size);
    default:
      return null;
  }
}

/** Which controls are disabled for `view`. */
export function disabledFlags(view: View, size: Size): DisabledFlags {
  const atMin = view.zoom <= MIN_ZOOM;
  return {
    zoomIn: view.zoom >= MAX_ZOOM,
    zoomOut: atMin,
    reset: atMin,
    panUp: atMin || view.y >= 0,
    panDown: atMin || view.y <= minOffset(size.height, view.zoom),
    panLeft: atMin || view.x >= 0,
    panRight: atMin || view.x <= minOffset(size.width, view.zoom),
  };
}

/** The viewport's accessible name: the diagram's own `accTitle`, so two diagrams on one page stay distinguishable. */
export const viewportLabel = (accTitle: string | null | undefined): string => accTitle?.trim() || 'Diagram view';
