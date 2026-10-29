/** The menus' resolution: every screen but a match from the School Field on. */
export const BASE_W = 320;
export const BASE_H = 180;

/** The size a scene draws at. */
export interface CanvasSize {
  readonly w: number;
  readonly h: number;
}

export const MENU_SIZE: CanvasSize = { w: BASE_W, h: BASE_H };
/** Smallest scale ever returned, so a zero-size window never divides by 0. */
const MIN_SCALE = 0.01;

/** Where the game canvas lands in the window, all in device pixels. */
export interface Viewport {
  scale: number;
  x: number;
  y: number;
  deviceW: number;
  deviceH: number;
}

/**
 * Largest whole-number scale that fits a w×h canvas, worked out in device pixels so every
 * game pixel is the same size even at fractional devicePixelRatio. Windows
 * smaller than the game fall back to a fractional fit, and even a zero-size
 * window gets MIN_SCALE rather than 0.
 */
export function computeViewport(cssW: number, cssH: number, dpr: number, w = BASE_W, h = BASE_H): Viewport {
  const deviceW = Math.round(cssW * dpr);
  const deviceH = Math.round(cssH * dpr);
  const fit = Math.min(deviceW / w, deviceH / h);
  const scale = fit >= 1 ? Math.floor(fit) : Math.max(fit, MIN_SCALE);
  return {
    scale,
    x: Math.floor((deviceW - w * scale) / 2),
    y: Math.floor((deviceH - h * scale) / 2),
    deviceW,
    deviceH,
  };
}
