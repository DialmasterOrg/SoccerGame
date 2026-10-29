import { BALL_R } from '../art/ball';
import type { Style } from './ai';
import { BALL_REST_Y } from './ball';
import { GRAVITY } from './constants';
import type { Goal } from './field';
import type { Aim } from './kick';
import { PLAYER_R, type Player } from './player';
import { POACH } from './priya';
import type { World } from './world';
import { REACH_Z } from './zones';

/**
 * What each opponent's style changes at the brain's decision points. Max
 * is allRound and plays exactly as before; each of the Park crew changes
 * one or two of these, and so does Speedy Sam, the speedster.
 */

export const attackDir = (me: Player): 1 | -1 => (me.team === 'home' ? 1 : -1);
export const goalCentreZ = (g: Goal): number => (g.z0 + g.z1) / 2;

/** The side (+1 deeper, −1 nearer) with more room to pass something standing at depth z. */
export const roomySide = (w: World, z: number, from: number): number =>
  z === w.field.depth / 2 ? Math.sign(from - z) || 1 : Math.sign(w.field.depth / 2 - z);

/** Whether `them` played the ball last tick: touched, kicked or tackled it, or poked or trapped it with the steal. */
export function playedIt(w: World, them: Player): boolean {
  const ev = w.events.kicks[them.team === 'home' ? 0 : 1];
  const stealt = them.team === 'home' && (w.events.steal === 'poked' || w.events.steal === 'trapped');
  return stealt || (ev !== undefined && (ev.touched || ev.kicked !== null || ev.tackledBall));
}

/** Where it aims its shots: mostly the far post, then the near post, sometimes straight. */
const AIM_ODDS: readonly (readonly [Aim, number])[] = [
  ['far', 1 / 2],
  ['near', 1 / 3],
  ['straight', 1 / 6],
];

export function pickAim(w: World): Aim {
  let r = w.rng();
  for (const [aim, odds] of AIM_ODDS) {
    if (r < odds) return aim;
    r -= odds;
  }
  return 'straight';
}

/** It runs to this far behind a loose ball, so it pushes the ball toward goal. */
export const CHASE_OFFSET = 8;
/** How far ahead it leads a rolling ball. */
const LEAD_S = 0.25;

/** Where a loose ball will be: its landing spot if airborne, a little ahead if rolling. */
export function predictBall(w: World): { x: number; z: number } {
  const b = w.ball;
  const drop = b.y - BALL_REST_Y;
  const airborne = drop > 1 || b.vy > 0;
  const t = airborne ? (b.vy + Math.sqrt(b.vy * b.vy + 2 * GRAVITY * Math.max(drop, 0))) / GRAVITY : LEAD_S;
  return {
    x: Math.min(Math.max(b.x + b.vx * t, w.field.fenceL), w.field.fenceR),
    z: Math.min(Math.max(b.z + b.vz * t, BALL_R), w.field.depth - BALL_R),
  };
}

/** allRound stands this far goal-side of the ball when defending... */
export const DEFEND_OFFSET = 20;
/** ...and this fraction of the way across from the ball toward its own goal's centre. */
export const DEFEND_COVER = 1 / 3;

/** The presser's spot: on the ball, this far to his side of it. */
const PRESS_OFFSET = 4;

/**
 * The blocker drops `cover` of the way from the ball back to his goal line,
 * at least `minAhead` goal-side of the ball and never within `offLine` of
 * the line, so a chip can drop in behind him. A ball up to `touchAhead`
 * in front of the opponent, within `touchSide` of their line, is still
 * theirs to him: a dribble touch.
 */
export const BLOCKER = { cover: 0.6, minAhead: 24, offLine: 48, touchAhead: 36, touchSide: 10 };

/** Where it stands while the opponent has the ball. allRound: Max's spot, as today. */
export function defendSpot(style: Style, w: World, me: Player, defending: Goal): { x: number; z: number } {
  const ball = w.ball;
  const dir = attackDir(me);
  const centre = goalCentreZ(defending);
  // The presser and the speedster come straight at the ball, from their side of it.
  if (style === 'presser' || style === 'speedster') return { x: ball.x - dir * PRESS_OFFSET, z: ball.z };
  // The poacher stands as Max does, but lingers upfield for the counter: never more than lingerX into her own half.
  if (style === 'poacher') {
    const spot = defendSpot('allRound', w, me, defending);
    const limit = w.field.width / 2 - dir * POACH.lingerX;
    return { x: dir > 0 ? Math.max(spot.x, limit) : Math.min(spot.x, limit), z: spot.z };
  }
  if (style !== 'blocker') return { x: ball.x - dir * DEFEND_OFFSET, z: ball.z + (centre - ball.z) * DEFEND_COVER };
  // Distances measured from the ball back toward his own goal line.
  const toLine = (defending.lineX - ball.x) * -dir;
  const back = Math.min(Math.max(toLine * BLOCKER.cover, BLOCKER.minAhead), toLine - BLOCKER.offLine);
  const x = ball.x - dir * back;
  // In the shot's lane: on the line from the ball to his goal's centre, at his x.
  const t = toLine === 0 ? 0 : back / toLine;
  const z = Math.min(Math.max(ball.z + (centre - ball.z) * t, PLAYER_R), w.field.depth - PLAYER_R);
  return { x, z };
}

/** The ball counts as at someone's feet within this distance, on the ground. */
export const POSSESSION_RANGE = 16;

/**
 * Whether the ball counts as the opponent's, so it defends rather than
 * going for it. allRound: any ball within POSSESSION_RANGE of them, as
 * today. The blocker: a ball ahead of them on their line, up to a dribble
 * touch away, so he holds his spot while they dribble at him, but goes for
 * a ball lying beside or behind them that they can't play. The poacher:
 * allRound's, or that dribble touch while it runs on ahead of them, so she
 * holds her spot upfield while they dribble, but goes for a ball sitting
 * still beside them.
 */
export function theirBall(style: Style, w: World, them: Player): boolean {
  const ball = w.ball;
  const near = Math.hypot(ball.x - them.x, ball.z - them.z) <= POSSESSION_RANGE;
  if (style !== 'blocker' && style !== 'poacher') return near;
  const ahead = (ball.x - them.x) * them.facing;
  const touch = ahead >= 0 && ahead <= BLOCKER.touchAhead && Math.abs(ball.z - them.z) <= BLOCKER.touchSide;
  return style === 'blocker' ? touch : near || (touch && ball.vx * them.facing > 0);
}

/** allRound holds a shot this long and up to this much longer, s, as Max always has. */
export const CHARGE_MIN_S = 0.25;
const CHARGE_SPREAD_S = 0.55;
/** The shooter winds up fully: a hard shot from long range. */
export const SHOOTER_CHARGE = { from: 0.55, spread: 0.3 };

/** How long it holds a shot before letting go, s, from one draw of `rng`. */
export function chargeHold(style: Style, rng: () => number): number {
  if (style === 'shooter') return SHOOTER_CHARGE.from + rng() * SHOOTER_CHARGE.spread;
  return CHARGE_MIN_S + rng() * CHARGE_SPREAD_S;
}

/**
 * The dribbler's fake: with the opponent standing within `trigger` px ahead
 * and `lane` px of her line, she leans one way in depth for `leanS` at
 * `leanPace`, the tell, then cuts the other way past him for `cutS`, then
 * straightens up at goal for `goS`, the ball at her feet throughout. No
 * second fake for `cooldownS` after one.
 */
export const FAKE = { trigger: 60, lane: 14, leanS: 0.25, leanPace: 0.45, cutS: 0.3, goS: 0.2, cooldownS: 1.2 };
/**
 * The lean is a small shift in depth, easing back off him a touch; the cut
 * is mostly sideways, so she and the ball clear his body before they reach
 * him.
 */
const LEAN = { x: -0.5, z: 0.87 };
const CUT = { x: 0.3, z: 0.95 };

/** Her move this tick while faking: lean one way in depth, cut the other way past him, then straighten up; null once it's over. */
export function fakeMove(fake: { side: 1 | -1; t: number }, dir: 1 | -1): { moveX: number; moveZ: number; pace: number } | null {
  if (fake.t < FAKE.leanS) return { moveX: dir * LEAN.x, moveZ: fake.side * LEAN.z, pace: FAKE.leanPace };
  if (fake.t < FAKE.leanS + FAKE.cutS) return { moveX: dir * CUT.x, moveZ: -fake.side * CUT.z, pace: 1 };
  // Straightening up, so the ball she lets go of runs on at goal with her, not off sideways.
  if (fake.t < FAKE.leanS + FAKE.cutS + FAKE.goS) return { moveX: dir, moveZ: 0, pace: 1 };
  return null;
}

/** allRound sprints when the ball is further than this, with enough stamina; the presser and the speedster sprint at any distance. */
export const SPRINT_DISTANCE = 120;
export const SPRINT_MIN_STAMINA = 0.4;

/** Whether it sprints this decision, `dist` px from the ball. */
export function pressSprint(style: Style, dist: number, stamina: number): boolean {
  return (style === 'presser' || style === 'speedster' || dist > SPRINT_DISTANCE) && stamina > SPRINT_MIN_STAMINA;
}

/**
 * The speedster's range shot: on the ball within `from` px of goal, with
 * the opponent standing up to `blockedAhead` px ahead and within `lane` px
 * of his line, he's blocked, and may try his weak shot from there
 * (AiProfile.rangeShot, rolled once per decision).
 */
export const RANGE_SHOT = { blockedAhead: 60, lane: 12, from: 320 };
