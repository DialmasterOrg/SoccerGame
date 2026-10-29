import { ballOutOfPlay } from './keeper';
import { BALL_R } from '../art/ball';
import { BALL_REST_Y, type Ball } from './ball';
import { GRAVITY, POST_R } from './constants';
import type { Goal } from './field';
import { POST_INSET, type Aim } from './kick';
import type { World } from './world';
import type { Player } from './player';
import { REACH_Z, ballAtFeet } from './zones';

/** What Harrison brings to a match from the profile: present only once he owns a power move. */
export interface PowerKit {
  golden: boolean;
}

/** Harrison's super meter for one match, and the kick it credits a goal to. */
export interface PowerState {
  golden: boolean;
  /** 0..1; full pays for one Energy Wave. */
  meter: number;
  /** Seconds since the meter last became full. */
  sinceFullS: number;
  /** Seconds left powered up, when his next kick is the Energy Wave; 0 when he isn't. */
  activeS: number;
  /** His last kick still in play, so a goal knows whether it was a style goal. */
  lastKind: 'shot' | 'chip' | 'volley' | 'header' | 'wave' | null;
}

/** What each thing he does adds to the meter, tuned so an ordinary match fills it about once. */
export const METER_GAIN = { touch: 0.01, tackle: 0.15, onTarget: 0.2, styleGoal: 0.4, trick: 0.1 };
/** Dribbling alone never fills it: touches add nothing from here up. */
export const TOUCH_CEILING = 0.5;
export const GOLDEN_GAIN = 1.1;
/** It can't fill twice within this long: until then, gains stop at REFILL_CAP. */
export const METER_MIN_REFILL_S = 20;
const REFILL_CAP = 0.99;
/** The ball must be this far in front of the goal line for a clean line into the mouth. */
export const WAVE_MIN_DX = 24;
/** How long a power-up lasts if he doesn't fire it: the parent asked for 2 to 3 s. */
export const POWERED_S = 2.5;
/** The wave is ready this long after he powers up: Max's moment to back off and square up. */
export const WAVE_READY_S = 1;
/** Slack for the ticks adding up to the ready moment. */
const READY_EPS = 1e-9;

export function createPower(kit: PowerKit): PowerState {
  return { golden: kit.golden, meter: 0, sinceFullS: Infinity, lastKind: null, activeS: 0 };
}

export function addMeter(s: PowerState, e: keyof typeof METER_GAIN): void {
  if (s.meter >= 1 || (e === 'touch' && s.meter >= TOUCH_CEILING)) return;
  const cap = Math.min(s.sinceFullS < METER_MIN_REFILL_S ? REFILL_CAP : 1, e === 'touch' ? TOUCH_CEILING : 1);
  const gain = METER_GAIN[e] * (s.golden ? GOLDEN_GAIN : 1);
  s.meter = Math.max(s.meter, Math.min(cap, s.meter + gain));
  if (s.meter >= 1) {
    s.meter = 1;
    s.sinceFullS = 0;
  }
}

/** Ends a power-up without firing (the game paused, say). The meter is kept. */
export function endPower(s: PowerState): void {
  s.activeS = 0;
}

/** Time passes: since the meter filled, and off a power-up. */
export function tickPower(s: PowerState, dt: number): void {
  s.sinceFullS += dt;
  s.activeS = Math.max(0, s.activeS - dt);
}

/**
 * Whether the ball's flight crosses the goal line on the frame or inside it:
 * a shot that scores, hits a post or the bar, or would have if Max hadn't
 * blocked it. Bounces are ignored, with the height clamped at the ground.
 */
export function onTarget(ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number }, goal: Goal): boolean {
  const t = (goal.lineX - ball.x) / ball.vx;
  if (!(t >= 0) || !Number.isFinite(t)) return false;
  const z = ball.z + ball.vz * t;
  const y = Math.max(0, ball.y + ball.vy * t - 0.5 * GRAVITY * t * t);
  return z >= goal.z0 - BALL_R && z <= goal.z1 + BALL_R && y - BALL_R <= goal.barY + goal.barThick;
}

/** The ball passes a post with at least this much room between their edges. */
const POST_CLEARANCE = 1;
/** Rounds of refining the inset for the line's angle: it settles within a couple. */
const INSET_ROUNDS = 3;

/**
 * Where in depth a wave from `from` crosses the goal line: inside the far
 * or near post, like a charged shot, or the middle of the mouth. An angled
 * line passes the post at the inset times the cosine of its angle, so the
 * inset grows with the angle to keep the whole line clear of the post. It
 * never goes past the middle.
 */
export function waveTarget(goal: Goal, aim: Aim, from: { x: number; z: number }): number {
  const middle = (goal.z0 + goal.z1) / 2;
  if (aim === 'straight') return middle;
  const clearance = BALL_R + POST_R + POST_CLEARANCE;
  const at = (inset: number) => (aim === 'far' ? goal.z1 - inset : goal.z0 + inset);
  let inset = Math.max(POST_INSET, clearance);
  for (let i = 0; i < INSET_ROUNDS; i++) {
    const [dx, dz] = [Math.abs(goal.lineX - from.x), at(inset) - from.z];
    inset = Math.min(Math.max(POST_INSET, (clearance * Math.hypot(dx, dz)) / Math.max(dx, 1)), (goal.z1 - goal.z0) / 2);
  }
  return at(inset);
}

/** A straight line from the ball can enter the mouth clear of the posts: it's far enough in front of the goal line. */
export function waveClear(ball: { x: number }, goal: Goal): boolean {
  const inFront = goal.side === 'right' ? goal.lineX - ball.x : ball.x - goal.lineX;
  return inFront >= WAVE_MIN_DX;
}

/** A dribbled ball runs ahead of him between touches: this far ahead (ball centre from his), it's still his to power up with. */
export const POWER_REACH = 26;

/** The ball is his: at his feet, or on the ground just ahead of him as he dribbles. */
export function ballInControl(p: Player, ball: Ball): boolean {
  if (ballAtFeet(p, ball)) return true;
  const ahead = (ball.x - p.x) * p.facing;
  return p.y === 0 && ball.y <= BALL_REST_Y && ahead >= 0 && ahead <= POWER_REACH && Math.abs(ball.z - p.z) <= REACH_Z;
}

/** The goal Harrison attacks. */
export const maxGoal = (w: World): Goal => w.field.goals.find(g => g.side === 'right')!;

/** The way to Max's goal along the pitch: the wave always goes there, so he turns to face it as he strikes. */
export const maxGoalDir = (w: World): 1 | -1 => (maxGoal(w).side === 'right' ? 1 : -1);

/** Whether a power press now powers him up: a full meter, in play, on his feet with the ball, not already powered. */
export function canStartPower(w: World): boolean {
  return (
    w.power !== null &&
    w.power.meter === 1 &&
    w.power.activeS === 0 &&
    w.match.phase === 'playing' &&
    w.home.state === 'ground' &&
    ballInControl(w.home, w.ball) &&
    !ballOutOfPlay(w)
  );
}

/** He's powered up and the wave is ready to fire. */
export const waveReady = (s: PowerState): boolean => s.activeS > 0 && POWERED_S - s.activeS >= WAVE_READY_S - READY_EPS;

/** He's powered up, but the wave isn't ready yet. */
export const waveReadying = (s: PowerState | null): boolean => s !== null && s.activeS > 0 && !waveReady(s);

/** Whether an X press now fires the Energy Wave: powered up and ready, on his feet with the ball, and a clean line into Max's goal. */
export function canFireWave(w: World): boolean {
  return (
    w.power !== null &&
    waveReady(w.power) &&
    w.match.phase === 'playing' &&
    w.home.state === 'ground' &&
    ballInControl(w.home, w.ball) &&
    !ballOutOfPlay(w) &&
    waveClear(w.ball, maxGoal(w))
  );
}

/** The HUD's Y button: hidden until the meter is full (and while he's powered up), dimmed while Y can't power him up for want of the ball. */
export function powerHint(w: World): 'none' | 'lit' | 'dim' {
  if (!w.power || w.power.meter < 1 || w.power.activeS > 0) return 'none';
  return w.home.state === 'ground' && ballInControl(w.home, w.ball) ? 'lit' : 'dim';
}
