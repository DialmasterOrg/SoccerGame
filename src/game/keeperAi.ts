import { BALL_R } from '../art/ball';
import { BALL_REST_Y } from './ball';
import { GRAVITY } from './constants';
import { keeperGoal, pitchward, SET_OFF, type Keeper, type KeeperIntent } from './keeper';
import { NO_INTENT, PLAYER_R, type PlayerIntent } from './player';
import { onTarget } from './power';
import type { World } from './world';

/** When and where the ball crosses his x-plane. */
export interface ShotRead {
  t: number;
  z: number;
  y: number;
}

/** The ball's ground velocity changing by more than this between ticks is a new flight: px/s, or a share of its speed. */
export const NEW_FLIGHT = { px: 40, share: 0.15 };
/** He starts coming off his line as the ball comes within `far` of his goal, and is furthest out by `near`. */
export const NARROW = { far: 320, near: 110 };
/** A ball going over his head he backs toward his line at this share of his speed. */
export const BACKPEDAL_SHARE = 0.4;
/** He eases into a spot over about this long, so he doesn't overshoot it. */
const ARRIVE_S = 0.08;
/** Closer than this to his spot, he stands. */
const STAND_PX = 0.5;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const clamp01 = (v: number): number => clamp(v, 0, 1);

/** Where he stands for the ball where it is: on the line from his goal's centre to it, further out the closer it is. */
export function setSpot(w: World, k: Keeper): { x: number; z: number } {
  const g = keeperGoal(w.field, k.side);
  const dir = pitchward(w.field, k.side);
  const cz = (g.z0 + g.z1) / 2;
  const d = Math.hypot(w.ball.x - g.lineX, w.ball.z - cz);
  const closeness = clamp01((NARROW.far - d) / (NARROW.far - NARROW.near));
  const out = PLAYER_R + SET_OFF + k.profile.comeOutPx * closeness;
  const z = cz + ((w.ball.z - cz) * out) / Math.max(Math.abs(w.ball.x - g.lineX), out) + k.errZ;
  const area = k.body.area!;
  return { x: clamp(g.lineX + dir * out, area.x0, area.x1), z: clamp(clamp(z, g.z0 + PLAYER_R, g.z1 - PLAYER_R), area.z0, area.z1) };
}

/** Where a ball on target, coming at his goal, will cross his x-plane, under gravity (no drag, no bounces); null otherwise. */
export function readShot(w: World, k: Keeper): ShotRead | null {
  const b = w.ball;
  const g = keeperGoal(w.field, k.side);
  if (Math.sign(b.vx) !== -pitchward(w.field, k.side) || !onTarget(b, g)) return null;
  const t = (k.body.x - b.x) / b.vx;
  if (!(t > 0)) return null;
  return { t, z: b.z + b.vz * t, y: Math.max(BALL_REST_Y, b.y + b.vy * t - 0.5 * GRAVITY * t * t) };
}

/** A move toward (x, z), easing in as he arrives. */
function toward(k: Keeper, x: number, z: number): PlayerIntent {
  const [dx, dz] = [x - k.body.x, z - k.body.z];
  const d = Math.hypot(dx, dz);
  if (d < STAND_PX) return NO_INTENT;
  const scale = Math.min(1, d / (k.profile.speed * ARRIVE_S)) / d;
  return { ...NO_INTENT, moveX: dx * scale, moveZ: dz * scale };
}

/** Sees a new flight, and starts his reaction to it. */
function noteFlight(w: World, k: Keeper): void {
  const { vx, vz } = w.ball;
  const speed = Math.hypot(vx, vz);
  const change = Math.hypot(vx - k.seenV.vx, vz - k.seenV.vz);
  k.seenV = { vx, vz };
  if (change <= Math.max(NEW_FLIGHT.px, NEW_FLIGHT.share * speed)) return;
  k.readS = k.profile.reactionS;
  k.errZ = k.profile.posErrPx * (2 * w.rng() - 1);
}

/** His answer to a read: back off under a high ball, shuffle across to one he can reach on his feet, or dive. */
function answer(w: World, k: Keeper, read: ShotRead): KeeperIntent {
  const { body, profile } = k;
  if (read.y - BALL_R > profile.reachY) {
    const lineX = keeperGoal(w.field, k.side).lineX + pitchward(w.field, k.side) * (PLAYER_R + SET_OFF);
    return { move: toward(k, lineX, body.z), dive: null };
  }
  const gap = Math.max(0, Math.abs(read.z - body.z) - (PLAYER_R + profile.reachZ));
  if (gap <= profile.speed * read.t) return { move: toward(k, body.x, read.z), dive: null };
  return { move: NO_INTENT, dive: { dirX: 0, dirZ: Math.sign(read.z - body.z) } };
}

/** The intent he keeps while he reacts to a new flight. */
const lastMove = new WeakMap<Keeper, PlayerIntent>();

/** A keeper's brain for one tick: where he stands, and how he answers a shot once his reaction allows. */
export function thinkKeeper(w: World, k: Keeper, dt: number): KeeperIntent {
  noteFlight(w, k);
  k.readS = Math.max(0, k.readS - dt);
  if (w.match.phase !== 'playing') return { move: NO_INTENT, dive: null };
  if (k.readS > 0) return { move: lastMove.get(k) ?? NO_INTENT, dive: null };
  const read = readShot(w, k);
  let intent: KeeperIntent;
  if (read) intent = answer(w, k, read);
  else {
    const spot = setSpot(w, k);
    intent = { move: toward(k, spot.x, spot.z), dive: null };
  }
  lastMove.set(k, intent.move);
  return intent;
}
