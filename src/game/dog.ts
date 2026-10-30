import { BALL_R } from '../art/ball';
import { MUZZLE } from '../art/opponents/biscuit';
import { LADDER_MATCHES, maxStats } from '../meta/ladder';
import { ALL_ROUND, type Difficulty } from './ai';
import { BALL_REST_Y } from './ball';
import { POST_R } from './constants';
import { goalScored, inGoalBox, playerSpan } from './field';
import { PLAYER_R, type Player, type PlayerIntent } from './player';
import { SPRINT_MULTIPLIER, runSpeed, type Stats } from './stats';
import type { World } from './world';
import { REACH_Z, ballAtFeet, ballIn, type Rect } from './zones';

export type { Difficulty } from './ai';

/**
 * Biscuit the Dog, the Backyard's boss. His body is the away Player: bodies,
 * goals, the camera, the wave and the HUD all work on it. He never kicks:
 * he takes the ball in his mouth and runs it into the net. This module is
 * his body system: his run, his stamina and pant, the jink's timing, the
 * grab, and the ball he carries.
 */
export interface DogProfile {
  reactionS: number;
  /** Seconds a ball at Harrison's feet must sit in his muzzle before it's his, at Control 1. */
  dwellS: number;
  /** He jinks when a blocker is within this far ahead: the later he cuts, the less time Harrison has to read it... */
  jinkAhead: number;
  /** ...and goes this wide. */
  jinkWidth: number;
  /** Seconds of full-speed running before he pants. */
  staminaS: number;
  /** Chance (0..1) that he backs off and squares up properly when Harrison powers up: Max's odds. */
  braceSense: number;
}

export const DOG_DIFFICULTY: Readonly<Record<Difficulty, DogProfile>> = {
  easy: { reactionS: 0.32, dwellS: 0.55, jinkAhead: 26, jinkWidth: 14, staminaS: 2.4, braceSense: ALL_ROUND.easy.braceSense },
  // Close control (2026-10-30): Normal dwellS 0.35 → 0.3; measured after, the blocker wins E 0.844, N 0.625, H 0.188.
  normal: { reactionS: 0.18, dwellS: 0.3, jinkAhead: 22, jinkWidth: 18, staminaS: 2.9, braceSense: ALL_ROUND.normal.braceSense },
  hard: { reactionS: 0.1, dwellS: 0.2, jinkAhead: 18, jinkWidth: 22, staminaS: 4, braceSense: ALL_ROUND.hard.braceSense },
};

/** The Harrison he's tuned against: one stat level above Max's last rung. */
export const TUNING_STATS: Stats = { speed: 5, power: 5, jump: 3, control: 4, stamina: 1 };
export const DOG_SPEED_OVER_SPRINT = 1.12;
/** His flat-out speed, px/s: the tuning Harrison's sprint and a bit. */
export const DOG_SPEED = Math.round(runSpeed(TUNING_STATS) * SPRINT_MULTIPLIER * DOG_SPEED_OVER_SPRINT);
/** Backing off from a powered-up Harrison he goes at Max's pace, so Harrison can chase him down. */
export const DOG_BACKPEDAL_SPEED = Math.round(runSpeed(maxStats(LADDER_MATCHES)) * 0.9);
export const DOG_ACCEL = 1400;
/** A ball faster than this passes him. */
export const DOG_CATCH_SPEED = 260;
/** He takes a ball whose centre is no higher than this, which also keeps him off the net roofs. */
export const DOG_CATCH_HEIGHT = 16;
/** His muzzle zone along his facing, REACH_Z either side in depth; for a ball at Harrison's feet he noses in further, and wider, round his legs. */
export const MUZZLE_REACH = { ahead0: 4, ahead1: 14, nosingIn: 20, nosingInZ: REACH_Z + 4 };
/** The dwell grows this much per Control level above 1. */
export const DWELL_PER_CONTROL = 0.08;
export const JINK_S = 0.5;
/** His speed during a jink, as a fraction of DOG_SPEED. */
export const JINK_SLOW = 0.35;
export const JINK_COOLDOWN_S = 0.6;
export const PANT_S = 1.2;
/** After a drop or a pant he can't grab for this long: knocked off the ball, he stands shaking it off. */
export const REGRAB_S = 1;
/** A knocked-out ball pops this fast, ahead of the tackle. */
export const DROP_POP = { vx: 90, vy: 60 };
/** Pressed this close against a Harrison slower than STILL_SPEED px/s, he noses round his legs for the ball at his feet. */
const PRESSED_GAP = 2;
const STILL_SPEED = 20;
/** Carrying, trying to run but held to under TRAPPED_SPEED px/s for TRAPPED_S, he's pinned: he sets the ball down. */
export const TRAPPED_S = 1;
const TRAPPED_SPEED = 10;
/** Running at least this fraction of DOG_SPEED spends his stamina; anything slower gives it back. */
const FULL_SPEED_SHARE = 0.8;
/** The goal he attacks, as the away side. */
const DOG_GOAL = 'left';

export interface DogState {
  profile: DogProfile;
  carrying: boolean;
  /** Seconds he has carried the ball so far (0 when he hasn't it): the view shows the grab at first. */
  carryS: number;
  /** Whether he took the ball he carries off Harrison's feet: he darts away from him with it first. */
  snatched: boolean;
  /** Muzzle time on a controlled ball so far. */
  dwellS: number;
  /** Time left in the jink. */
  jinkS: number;
  jinkSide: 1 | -1;
  jinkCooldownS: number;
  /** Full-speed running so far since he last rested. */
  runS: number;
  /** Time left panting. */
  pantS: number;
  regrabS: number;
  /** How long he has been pinned with the ball, trying to run and getting nowhere. */
  stuckS: number;
}

export interface DogEvents {
  grabbed: boolean;
  dropped: boolean;
  jinked: boolean;
  panted: boolean;
}

export const quietDog = (): DogEvents => ({ grabbed: false, dropped: false, jinked: false, panted: false });

export function createDog(profile: DogProfile): DogState {
  return { profile, carrying: false, carryS: 0, snatched: false, dwellS: 0, jinkS: 0, jinkSide: 1, jinkCooldownS: 0, runS: 0, pantS: 0, regrabS: 0, stuckS: 0 };
}

/** Clears everything a kickoff starts afresh; he has rested through the pause, so his stamina is full. */
export function resetDog(d: DogState): void {
  Object.assign(d, { carrying: false, carryS: 0, snatched: false, dwellS: 0, jinkS: 0, jinkCooldownS: 0, runS: 0, pantS: 0, regrabS: 0, stuckS: 0 });
}

export const dwellFor = (profile: DogProfile, control: number): number => profile.dwellS + DWELL_PER_CONTROL * (control - 1);

/** His muzzle zone, facing-relative like footZone; `nosingIn` reaches further. */
export function muzzleZone(p: Player, nosingIn = false): Rect {
  const [a, b] = [p.x + p.facing * MUZZLE_REACH.ahead0, p.x + p.facing * (nosingIn ? MUZZLE_REACH.nosingIn : MUZZLE_REACH.ahead1)];
  const side = nosingIn ? MUZZLE_REACH.nosingInZ : REACH_Z;
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0: p.y, y1: p.y + DOG_CATCH_HEIGHT, z0: p.z - side, z1: p.z + side };
}

/** He's slow and the ball can be won: jinking or panting. */
export const vulnerable = (d: DogState): boolean => d.jinkS > 0 || d.pantS > 0;

/** Pressed against a Harrison standing still, with the ball on the side he faces. */
function pressedOnStill(dog: Player, w: World): boolean {
  const them = w.home;
  const still = Math.hypot(them.vx, them.vz) < STILL_SPEED;
  return still && Math.hypot(them.x - dog.x, them.z - dog.z) <= 2 * PLAYER_R + PRESSED_GAP && (w.ball.x - dog.x) * dog.facing > 0;
}

/**
 * Whether the ball is where his muzzle can take it: in the muzzle zone, or
 * against his body. A ball at Harrison's feet he noses in for, and round
 * the legs of a Harrison who stands still on it, so a boy standing on it in
 * a corner, or walling off the strip beside a goal, can't shut him out.
 */
function inReach(dog: Player, w: World): boolean {
  const b = w.ball;
  const atFeet = ballAtFeet(w.home, b);
  if (atFeet && pressedOnStill(dog, w)) return true;
  return ballIn(muzzleZone(dog, atFeet), b, BALL_R) || (Math.hypot(b.x - dog.x, b.z - dog.z) < PLAYER_R + BALL_R && b.y <= DOG_CATCH_HEIGHT);
}

/**
 * Whether a loose or controlled ball can be taken this tick (reach, speed,
 * height, not fallen/blown/bracing, not fooled by a trick, no regrab wait,
 * not panting). Never on
 * the tick Harrison strikes the Energy Wave: the wave has the ball.
 */
export function canGrab(w: World): boolean {
  const d = w.dog;
  const b = w.ball;
  const striking = w.home.kick?.kind === 'wave' && w.home.kick.active;
  if (!d || d.carrying || w.match.phase !== 'playing' || w.wave?.live || striking) return false;
  if (w.away.state !== 'ground' || w.away.fooled || d.regrabS > 0 || d.pantS > 0) return false;
  return Math.hypot(b.vx, b.vy, b.vz) <= DOG_CATCH_SPEED && b.y <= DOG_CATCH_HEIGHT && inReach(w.away, w);
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Where the ball he carries sits: at his muzzle, pulled back toward him
 * where the muzzle would be through a fence, a post or a net. Only in his
 * attacking goal's mouth, scoring, may it be inside a goal.
 */
function carrySpot(w: World): { x: number; z: number } {
  const { away, field } = w;
  const y = -MUZZLE.y;
  for (let k = MUZZLE.x; k > 0; k--) {
    const x = clamp(away.x + away.facing * k, field.fenceL + BALL_R, field.fenceR - BALL_R);
    const clear = !field.goals.some(g => inGoalBox(g, x, away.z, BALL_R + POST_R)) || goalScored(field, { x, y, z: away.z }) === DOG_GOAL;
    if (clear) return { x, z: away.z };
  }
  return { x: away.x, z: away.z };
}

/** Puts the carried ball in his mouth: not simulated, so it rides there still. */
export function parkBall(w: World): void {
  const { x, z } = carrySpot(w);
  Object.assign(w.ball, { x, y: -MUZZLE.y, z, vx: 0, vy: 0, vz: 0, spin: 0 });
}

/** Lets go: the ball at the muzzle, live, popped forward ahead of Harrison's tackle (`pop`) or set down (a pant). Any jink ends with it. */
export function dropBall(w: World, pop: boolean): void {
  const d = w.dog!;
  d.carrying = false;
  d.carryS = 0;
  d.snatched = false;
  d.jinkS = 0;
  d.dwellS = 0;
  d.regrabS = Math.max(d.regrabS, REGRAB_S);
  parkBall(w);
  if (pop) Object.assign(w.ball, { vx: w.home.facing * DROP_POP.vx, vy: DROP_POP.vy });
  else w.ball.y = BALL_REST_Y;
}

/** Moves (vx, vz) toward (tx, tz) by at most `step`. */
function approach(p: Player, tx: number, tz: number, step: number): void {
  const [dx, dz] = [tx - p.vx, tz - p.vz];
  const gap = Math.hypot(dx, dz);
  if (gap <= step) [p.vx, p.vz] = [tx, tz];
  else [p.vx, p.vz] = [p.vx + (dx / gap) * step, p.vz + (dz / gap) * step];
}

/** His run on the ground: flat out, at Max's backpedal, slowed in a jink, stopped in a pant. */
function move(w: World, d: DogState, intent: PlayerIntent, dt: number): void {
  const p = w.away;
  const len = Math.hypot(intent.moveX, intent.moveZ);
  const pace = d.pantS > 0 ? 0 : d.jinkS > 0 ? DOG_SPEED * JINK_SLOW : intent.sprint ? DOG_SPEED : DOG_BACKPEDAL_SPEED;
  const speed = len > 0 ? pace / Math.max(1, len) : 0;
  approach(p, intent.moveX * speed, intent.moveZ * speed, DOG_ACCEL * dt);
  if (intent.faceX) p.facing = intent.faceX;
  else if (intent.moveX !== 0 && d.pantS === 0) p.facing = intent.moveX > 0 ? 1 : -1;
  const [minX, maxX] = playerSpan(w.field);
  p.x = clamp(p.x + p.vx * dt, minX + PLAYER_R, maxX - PLAYER_R);
  p.z = clamp(p.z + p.vz * dt, PLAYER_R, w.field.depth - PLAYER_R);
  p.stateT += dt;
}

/** Full-speed running spends his stamina and slower running gives it back; spent, he stops and pants. */
function tire(w: World, d: DogState, dt: number, ev: DogEvents): void {
  const p = w.away;
  const full = Math.hypot(p.vx, p.vz) >= FULL_SPEED_SHARE * DOG_SPEED;
  d.runS = full ? d.runS + dt : Math.max(0, d.runS - dt);
  if (d.runS < d.profile.staminaS) return;
  if (d.carrying) dropBall(w, false);
  [p.vx, p.vz] = [0, 0];
  d.pantS = PANT_S;
  d.runS = 0;
  d.regrabS = PANT_S;
  ev.panted = true;
}

/** The snatch: a loose ball is his at once; a ball at Harrison's feet after the dwell. */
function grab(w: World, d: DogState, dt: number, ev: DogEvents): void {
  if (!canGrab(w)) {
    if (!d.carrying && !inReach(w.away, w)) d.dwellS = 0;
    return;
  }
  const fromFeet = ballAtFeet(w.home, w.ball);
  if (fromFeet) {
    d.dwellS += dt;
    if (d.dwellS < dwellFor(d.profile, w.home.stats.control)) return;
  }
  d.snatched = fromFeet;
  d.carrying = true;
  d.carryS = 0;
  d.dwellS = 0;
  parkBall(w);
  ev.grabbed = true;
}

/**
 * Pinned with the ball (in a corner, say, with Harrison in front): trying to
 * run but held to under TRAPPED_SPEED by the bodies, boards and goals for
 * TRAPPED_S, he gives up and sets it down. `movedPx` is how far he got this
 * tick, once bodies are resolved. Returns whether he set it down.
 */
export function checkPinned(w: World, intent: PlayerIntent, movedPx: number, dt: number): boolean {
  const d = w.dog!;
  const trying = intent.moveX !== 0 || intent.moveZ !== 0;
  d.stuckS = d.carrying && trying && movedPx < TRAPPED_SPEED * dt ? d.stuckS + dt : 0;
  if (d.stuckS < TRAPPED_S) return false;
  dropBall(w, false);
  d.stuckS = 0;
  return true;
}

/**
 * One tick of the dog, after Harrison has stepped and before contacts: moves
 * his body on `intent` (ground only; bracing/blown are stepPlayer's), the
 * stamina budget and the pant, the jink, the grab and the dwell, and parks a
 * carried ball at the muzzle. Outside play nothing moves or counts. The jink
 * itself is started by his brain, which sets jinkS to JINK_S; it's reported
 * here, on its first tick.
 */
export function stepDog(w: World, intent: PlayerIntent, live: boolean, dt: number): DogEvents {
  const ev = quietDog();
  const d = w.dog!;
  if (!live) {
    [w.away.vx, w.away.vz] = [0, 0];
    return ev;
  }
  ev.jinked = d.jinkS === JINK_S;
  d.jinkS = Math.max(0, d.jinkS - dt);
  d.jinkCooldownS = Math.max(0, d.jinkCooldownS - dt);
  d.pantS = Math.max(0, d.pantS - dt);
  d.regrabS = Math.max(0, d.regrabS - dt);
  if (d.carrying) d.carryS += dt;
  move(w, d, intent, dt);
  tire(w, d, dt, ev);
  grab(w, d, dt, ev);
  if (d.carrying) parkBall(w);
  return ev;
}
