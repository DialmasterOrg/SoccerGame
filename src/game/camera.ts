import type { Field } from './field';

/** A match canvas: its size, the screen row of the near touchline (z 0, y 0), and how much the HUD is doubled. */
export interface View {
  readonly w: number;
  readonly h: number;
  readonly nearSY: number;
  readonly hudScale: 1 | 2;
}

/** The menus' size: the Backyard and the Park. */
export const SMALL_VIEW: View = { w: 320, h: 180, nearSY: 176, hudScale: 1 };
/** The School Field and every later venue: more of the world at the same pixel size. */
export const BIG_VIEW: View = { w: 534, h: 300, nearSY: 296, hudScale: 2 };

export interface Camera {
  /** World x of the screen's left edge. */
  x: number;
  /** SMALL_VIEW when absent. */
  view?: View;
}

export const CAMERA_LOOKAHEAD_S = 0.25,
  CAMERA_SMOOTHING = 6;
/** Screen x gained per unit of depth: the oblique slant that makes goals and stripes lean. */
export const DEPTH_SHEAR = 0.3;
/** Closer than this, the camera snaps onto its target instead of creeping forever. */
const SNAP_PX = 0.05;

export const viewOf = (cam: Camera): View => cam.view ?? SMALL_VIEW;

/** The layer the HUD is laid out in: the view itself, or half of it (rounded up) when the HUD is doubled. */
export function hudSize(view: View): { w: number; h: number } {
  return { w: Math.ceil(view.w / view.hudScale), h: Math.ceil(view.h / view.hudScale) };
}

/** Screen position of a world point: depth runs up the screen and leans right, height straight up. */
export function project(x: number, y: number, z: number, cam: Camera): { sx: number; sy: number } {
  return { sx: x + z * DEPTH_SHEAR - cam.x, sy: viewOf(cam).nearSY - z - y };
}

/** Follows the ball's slanted screen position with smoothing, looking ahead along its travel, clamped to the field. */
export function updateCamera(cam: Camera, ball: { x: number; z: number; vx: number }, dt: number, field: Field): void {
  const viewW = viewOf(cam).w;
  const maxX = field.width + field.depth * DEPTH_SHEAR - viewW;
  const clamp = (x: number) => Math.min(Math.max(x, 0), maxX);
  const target = clamp(ball.x + ball.z * DEPTH_SHEAR + ball.vx * CAMERA_LOOKAHEAD_S - viewW / 2);
  const gap = target - cam.x;
  cam.x = Math.abs(gap) < SNAP_PX ? target : clamp(cam.x + gap * (1 - Math.exp(-CAMERA_SMOOTHING * dt)));
}

/** Where to point the off-screen arrow when the ball is above the top of the screen. */
export function offscreenArrow(ball: { x: number; y: number; z: number }, cam: Camera): null | { x: number } {
  const p = project(ball.x, ball.y, ball.z, cam);
  return p.sy < 0 ? { x: p.sx } : null;
}
