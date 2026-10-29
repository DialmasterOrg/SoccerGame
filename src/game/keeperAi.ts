import { BALL_R } from '../art/ball';
import { BALL_REST_Y } from './ball';
import { GRAVITY } from './constants';
import { keeperGoal, pitchward, SET_OFF, type Keeper, type KeeperIntent } from './keeper';
import { NO_INTENT, PLAYER_R, type Player, type PlayerIntent } from './player';
import { onTarget } from './power';
import { SPRINT_MULTIPLIER, runSpeed, touchPush } from './stats';
import { maxHasBall } from './steal';
import { REACH_Z } from './zones';
import { ZONE_AHEAD, atFeet } from './keeperSaves';
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
/** He comes out for a loose ball only if he'd get there first by this much. */
export const FIRST_MARGIN_S = 0.1;
/** Where a rolling loose ball will be, this far on. */
const LOOSE_AHEAD_S = 0.25;
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

const inArea = (k: Keeper, p: { x: number; z: number }): boolean => {
  const a = k.body.area!;
  return p.x >= a.x0 && p.x <= a.x1 && p.z >= a.z0 && p.z <= a.z1;
};
/** Within his gloves' reach from somewhere in his box: his body stays in it, his standing zone reaches a little beyond. */
const inReach = (k: Keeper, p: { x: number; z: number }): boolean => {
  const a = k.body.area!;
  const [rx, rz] = [PLAYER_R + BALL_R + ZONE_AHEAD, PLAYER_R + k.profile.reachZ + BALL_R];
  return p.x >= a.x0 - rx && p.x <= a.x1 + rx && p.z >= a.z0 - rz && p.z <= a.z1 + rz;
};
const intoArea = (k: Keeper, p: { x: number; z: number }): { x: number; z: number } => {
  const a = k.body.area!;
  return { x: clamp(p.x, a.x0, a.x1), z: clamp(p.z, a.z0, a.z1) };
};

/** Where a loose ball will be: where it lands, if it's in the air, or a moment on along the grass. */
function looseSpot(w: World): { x: number; z: number } {
  const b = w.ball;
  if (b.y > BALL_REST_Y + 0.5 || b.vy > 0) {
    const t = (b.vy + Math.sqrt(b.vy * b.vy + 2 * GRAVITY * Math.max(0, b.y - BALL_REST_Y))) / GRAVITY;
    return { x: b.x + b.vx * t, z: b.z + b.vz * t };
  }
  return { x: b.x + b.vx * LOOSE_AHEAD_S, z: b.z + b.vz * LOOSE_AHEAD_S };
}

/** Seconds for an outfield player to get to (x, z) flat out. */
const sprintS = (p: Player, at: { x: number; z: number }): number => Math.hypot(at.x - p.x, at.z - p.z) / (runSpeed(p.stats) * SPRINT_MULTIPLIER);

/** His side's opponent, and his own teammate. */
const sides = (w: World, k: Keeper): [attacker: Player, mate: Player] => (k.side === 'away' ? [w.home, w.away] : [w.away, w.home]);

/** His own dribble touch runs the ball up to this far ahead of him... */
const DRIBBLE_AHEAD = 32;
/** ...at no more than this over his touch's push, px/s: any faster, it's a shot. */
const DRIBBLE_SLACK = 20;
/** A ball slower than this isn't running with anyone. */
const ROLLING = 40;

/** The attacker has it: at his feet, or his own touch still running with him. */
function dribbling(w: World, p: Player): boolean {
  const b = w.ball;
  // In a trick with the ball, it's his wherever the trick carries it (up behind his heel in a flick).
  if (atFeet(p, b) || p.trick?.onBall) return true;
  if (p.y !== 0 || p.state === 'fallen' || p.state === 'blown' || b.y > BALL_REST_Y + 0.5 || Math.abs(b.z - p.z) > REACH_Z) return false;
  const ahead = (b.x - p.x) * p.facing;
  if (ahead < 0) return false;
  const speed = Math.hypot(b.vx, b.vz);
  const gaining = b.vx * p.facing - p.vx * p.facing;
  return b.touchedBy === p.team && ahead <= DRIBBLE_AHEAD && speed >= ROLLING && gaining <= touchPush(p.stats) + DRIBBLE_SLACK;
}

/** His side's opponent dribbling in his box, his teammate no closer to the goal line. */
function throughOnGoal(w: World, k: Keeper): boolean {
  const [attacker, mate] = sides(w, k);
  const lineX = keeperGoal(w.field, k.side).lineX;
  return dribbling(w, attacker) && inArea(k, w.ball) && Math.abs(mate.x - lineX) > Math.abs(attacker.x - lineX);
}

/** Coming out at a dribbler, he commits to the smother once the ball is this close: along the line to it. */
function smother(w: World, k: Keeper): KeeperIntent | null {
  const [dx, dz] = [w.ball.x - k.body.x, w.ball.z - k.body.z];
  const d = Math.hypot(dx, dz);
  return d > 0 && d <= k.profile.smotherAt ? { move: NO_INTENT, dive: { dirX: dx / d, dirZ: dz / d } } : null;
}

/** Why he comes out, and where to: a dribbler through on goal (smother when close), or a loose ball in his box he'll reach first. */
function rush(w: World, k: Keeper): KeeperIntent | null {
  const b = w.ball;
  if (throughOnGoal(w, k)) {
    const at = intoArea(k, b);
    // As the attacker shapes to shoot or chip, he stops and sets himself where he is.
    const shaping = sides(w, k)[0].state === 'charging' || sides(w, k)[0].state === 'chipping';
    return smother(w, k) ?? { move: shaping ? NO_INTENT : toward(k, at.x, at.z), dive: null };
  }
  if (maxHasBall(w.home, b) || maxHasBall(w.away, b)) return null;
  const spot = looseSpot(w);
  if (!inReach(k, spot)) return null;
  const mine = Math.hypot(spot.x - k.body.x, spot.z - k.body.z) / k.profile.speed;
  if (mine + FIRST_MARGIN_S >= Math.min(sprintS(w.home, spot), sprintS(w.away, spot))) return null;
  const at = intoArea(k, spot);
  return { move: toward(k, at.x, at.z), dive: null };
}

/** The intent he keeps while he reacts to a new flight. */
const lastMove = new WeakMap<Keeper, PlayerIntent>();

/** A keeper's brain for one tick: where he stands, and how he answers a shot once his reaction allows. */
export function thinkKeeper(w: World, k: Keeper, dt: number): KeeperIntent {
  noteFlight(w, k);
  k.readS = Math.max(0, k.readS - dt);
  const { body } = k;
  // Blown into his net, once he's up he walks straight out toward the pitch, whatever the phase.
  if (body.inNet) return { move: body.state === 'ground' ? { ...NO_INTENT, moveX: pitchward(w.field, k.side) } : NO_INTENT, dive: null };
  if (w.match.phase !== 'playing') return { move: NO_INTENT, dive: null };
  // Fooled by a stepover he dives the wrong way at once, toward his sway; stumbling from a flick, he stands.
  if (body.fooled) {
    const wrongWay = body.fooled.kind === 'confused' && (k.act === 'set' || k.act === 'rush');
    return { move: NO_INTENT, dive: wrongWay ? { dirX: 0, dirZ: Math.sign(body.fooled.swayZ - body.z) || 1 } : null };
  }
  // Coming out at a dribbler, he commits on how close the ball is, not on a fresh read: every touch is a new flight.
  if (k.readS > 0) {
    const committed = k.act === 'rush' && throughOnGoal(w, k) ? smother(w, k) : null;
    return committed ?? { move: lastMove.get(k) ?? NO_INTENT, dive: null };
  }
  // A dribbler through on goal comes first: a ball at his feet isn't a shot. Then a shot, then a loose ball he'll get to first.
  const dribbled = dribbling(w, sides(w, k)[0]) ? rush(w, k) : null;
  const read = dribbled ? null : readShot(w, k);
  const out = dribbled ?? (read ? null : rush(w, k));
  let intent: KeeperIntent;
  if (out) intent = out;
  else if (read) intent = answer(w, k, read);
  else {
    const spot = setSpot(w, k);
    intent = { move: toward(k, spot.x, spot.z), dive: null };
  }
  if (k.act === 'set' || k.act === 'rush') k.act = out ? 'rush' : 'set';
  lastMove.set(k, intent.move);
  return intent;
}
