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
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.5;

export const initialView: View = { zoom: MIN_ZOOM, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const minOffset = (length: number, zoom: number): number => length - length * zoom;

function clampOffsets(view: View, size: Size): View {
  return {
    zoom: view.zoom,
    x: clamp(view.x, minOffset(size.width, view.zoom), 0),
    y: clamp(view.y, minOffset(size.height, view.zoom), 0),
  };
}

/** Zooms about the viewport centre; the result is clamped so the diagram covers the viewport. */
function zoomTo(view: View, zoom: number, size: Size): View {
  const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const ratio = next / view.zoom;
  return clampOffsets(
    {
      zoom: next,
      x: size.width / 2 - (size.width / 2 - view.x) * ratio,
      y: size.height / 2 - (size.height / 2 - view.y) * ratio,
    },
    size,
  );
}

export const zoomIn = (view: View, size: Size): View => zoomTo(view, view.zoom * ZOOM_STEP, size);

export const zoomOut = (view: View, size: Size): View => zoomTo(view, view.zoom / ZOOM_STEP, size);

export const reset = (): View => initialView;

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
