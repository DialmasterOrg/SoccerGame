import { BALL_R } from '../art/ball';
import { BALL_REST_Y, type Ball } from './ball';
import { heightOf, radiusOf, type Player } from './player';

/** Every zone reaches this far either side of his line in depth. */
export const REACH_Z = 7;
/** He touches the ball this far ahead of him along his run... */
const TOUCH_AHEAD = 7;
/** ...while he's running faster than this, px/s. */
const TOUCH_MIN_SPEED = 20;

/** A world-space box: x along the pitch, y up, z in depth. */
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** A box given facing-relative: `ahead0..ahead1` in front of him, `up0..up1` above his feet, REACH_Z either side in depth. */
function zone(p: Player, ahead0: number, ahead1: number, up0: number, up1: number): Rect {
  const [a, b] = [p.x + p.facing * ahead0, p.x + p.facing * ahead1];
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0: p.y + up0, y1: p.y + up1, z0: p.z - REACH_Z, z1: p.z + REACH_Z };
}

/** Ground kicks and chips; volleys in the air. */
export const footZone = (p: Player): Rect => zone(p, 2, 14, 0, 12);
/** Headers while airborne. */
export const headZone = (p: Player): Rect => zone(p, -4, 10, 30, 44);
/** A slide tackle's reach, low to the ground. */
export const slideZone = (p: Player): Rect => zone(p, 0, 16, 0, 8);

/** The ball is at his feet when it's on the ground in reach of his foot. */
export const ballAtFeet = (p: Player, ball: Ball): boolean => p.y === 0 && ball.y <= BALL_REST_Y && ballIn(footZone(p), ball, BALL_R);

/** Where his foot meets the ball when he runs into it: just ahead of him along his run. */
export function touchPoint(p: Player): null | { x: number; z: number } {
  const speed = Math.hypot(p.vx, p.vz);
  if (speed <= TOUCH_MIN_SPEED) return null;
  return { x: p.x + (p.vx / speed) * TOUCH_AHEAD, z: p.z + (p.vz / speed) * TOUCH_AHEAD };
}

/** Sphere–box overlap. */
export function ballIn(r: Rect, b: { x: number; y: number; z: number }, radius: number): boolean {
  const dx = b.x - Math.min(Math.max(b.x, r.x0), r.x1);
  const dy = b.y - Math.min(Math.max(b.y, r.y0), r.y1);
  const dz = b.z - Math.min(Math.max(b.z, r.z0), r.z1);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

/** Whether a ball overlaps his body: an upright cylinder of his radius and height. */
export function ballInBody(p: Player, b: { x: number; y: number; z: number }, radius: number): boolean {
  return Math.hypot(b.x - p.x, b.z - p.z) < radiusOf(p) + radius && b.y > p.y - radius && b.y < p.y + heightOf(p) + radius;
}
