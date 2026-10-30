import { BALL_REST_Y } from './ball';
import { TOUCH_COOLDOWN_S, canPlace, keepingOut, upfieldOf } from './contact';
import { STICK_BACK, ballIsHisAlong } from './dragBack';
import { ballOutOfPlay } from './keeper';
import type { PlayerIntent } from './player';
import { runSpeed, touchPush, turnRisk, type Stats } from './stats';
import { FOOT_SPOT } from './steal';
import type { World } from './world';

/**
 * Harrison's close control: turning with the ball his, his touch takes it
 * onto his new line. A clean turn rolls the ball round to his new front
 * over TURN_TOUCH_S, as the drag-back does, then knocks it on his new way;
 * a heavy one squirts it off loose, nearer his old line. Sharper and faster
 * turns are riskier, better Control safer, and no turn is ever safe. A cut
 * back at his own goal, and a turn-round (the drag-back's), are left to
 * the rules that already handle them. Max doesn't get it.
 */

export type TurnOutcome = 'turned' | 'heavy';

/** A turn smaller than this, degrees, is left to his ordinary touches. */
export const TURN_MIN_DEG = 10;
/** A cut whose new run heads back at his own goal more than this (within 60° of straight at it) gets no turn touch. */
export const BACK_LIMIT = 0.5;
/** The risk grows faster than the angle, so one snap is riskier than a curve through the same angle. */
export const ANGLE_POWER = 2.2;
/** His pace going into the turn, against his own run speed, raises the risk: a sprint about doubles it. */
export const PACE_POWER = 1.6;
export const PACE_CAP = 1.6;
/** How long a clean turn takes to roll the ball round to his new front, s. */
export const TURN_TOUCH_S = 0.15;
/** A heavy touch: the share of his new way in its line, its push in touch pushes, and how long before he can touch it again. */
export const HEAVY = { mix: 0.3, push: 2, lockS: 0.3 };
/** He must be running faster than this to turn with the ball, px/s. */
const RUNNING = 20;
const BALL_LOW = BALL_REST_Y + 3;

/** The chance a turn through `turnDeg` at `pace` (his speed over his run speed) is a heavy touch. */
export function heavyTouchChance(stats: Stats, turnDeg: number, pace: number): number {
  return turnRisk(stats) * (turnDeg / 90) ** ANGLE_POWER * Math.min(pace, PACE_CAP) ** PACE_POWER;
}

/** Whether Harrison is free to turn with the ball this tick: on his feet in play, running, and in no other move. */
function free(w: World): boolean {
  const { home, ball } = w;
  const moving = home.state === 'ground' && home.y === 0 && Math.hypot(home.vx, home.vz) > RUNNING;
  const busy = home.turnS > 0 || home.trick !== null || home.turnTouch !== null || home.stumbleS > 0 || home.touchCooldown > 0;
  const loose = w.match.phase === 'playing' && !w.wave?.live && !ballOutOfPlay(w) && !ball.through;
  return moving && !busy && loose && ball.touchedBy === 'home' && ball.y <= BALL_LOW;
}

/**
 * Starts his turn with the ball when the stick points more than
 * TURN_MIN_DEG off his dribble's line, short of a turn-round and not back
 * at his own goal, with the ball his along that line and room for it at
 * his new front. Rolls once on the world's touch stream: heavy or clean.
 */
export function turnWithBall(w: World, intent: PlayerIntent): TurnOutcome | null {
  const { home, ball } = w;
  const len = Math.hypot(intent.moveX, intent.moveZ);
  if (len === 0 || !free(w)) return null;
  const line = home.dribbleLine ?? { x: home.facing, z: 0 };
  const n = { x: intent.moveX / len, z: intent.moveZ / len };
  const cos = n.x * line.x + n.z * line.z;
  const deg = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
  if (deg < TURN_MIN_DEG || cos <= -STICK_BACK || n.x * upfieldOf(home) < -BACK_LIMIT) return null;
  // Near his own goal, the shield has a ball he's running at it with, or turning onto it: a heavy touch would squirt it at his net.
  if (!ballIsHisAlong(w, line) || keepingOut(home, ball, w.field, n.x) || keepingOut(home, ball, w.field, line.x)) return null;
  if (!canPlace(ball, home.x + n.x * FOOT_SPOT, home.z + n.z * FOOT_SPOT, w.field)) return null;
  const speed = Math.hypot(home.vx, home.vz);
  const push = touchPush(home.stats) * home.handling.touchScale;
  if (w.touchRng() < heavyTouchChance(home.stats, deg, speed / runSpeed(home.stats))) {
    const [hx, hz] = [(1 - HEAVY.mix) * line.x + HEAVY.mix * n.x, (1 - HEAVY.mix) * line.z + HEAVY.mix * n.z];
    const h = Math.hypot(hx, hz);
    ball.vx = (hx / h) * (speed + HEAVY.push * push);
    ball.vz = (hz / h) * (speed + HEAVY.push * push);
    home.touchCooldown = HEAVY.lockS;
    home.dribbleLine = null;
    return 'heavy';
  }
  [ball.vx, ball.vz] = [0, 0];
  home.turnTouch = { x: n.x, z: n.z, leftS: TURN_TOUCH_S };
  home.dribbleLine = n;
  home.touchCooldown = TURN_TOUCH_S;
  return 'turned';
}

/**
 * One tick of a clean turn: the ball rolls on toward FOOT_SPOT in front of
 * him along his new way, riding his run as it goes, and when the turn is over it's knocked on that
 * way as a touch would. If play stops, he leaves his feet or starts
 * another move, anyone plays the ball (it moves or leaves the ground), or
 * its spot can't be reached, the turn ends there and the ball stays put.
 */
export function stepTurnTouch(w: World, dt: number): void {
  const { home, ball, field } = w;
  const turn = home.turnTouch;
  if (!turn) return;
  const target = { x: home.x + turn.x * FOOT_SPOT, z: home.z + turn.z * FOOT_SPOT };
  const played = ball.vx !== 0 || ball.vz !== 0 || ball.vy !== 0 || ball.y > BALL_LOW;
  const busy = home.state !== 'ground' || home.trick !== null || home.turnS > 0;
  if (w.match.phase !== 'playing' || busy || played || ballOutOfPlay(w) || !canPlace(ball, target.x, target.z, field)) {
    home.turnTouch = null;
    return;
  }
  // His front runs on with him, so the ball rides his run as it rolls round, and never has a lag to close on the last tick.
  const k = Math.min(1, dt / turn.leftS);
  ball.x += (target.x - ball.x) * k + home.vx * dt * (1 - k);
  ball.z += (target.z - ball.z) * k + home.vz * dt * (1 - k);
  turn.leftS = Math.max(0, turn.leftS - dt);
  if (turn.leftS > 1e-9) return;
  const knock = Math.hypot(home.vx, home.vz) + touchPush(home.stats) * home.handling.touchScale;
  [ball.vx, ball.vz] = [turn.x * knock, turn.z * knock];
  // Its own roll this tick takes it the last step to his front, so the tick it's knocked on it moves once, not twice.
  ball.x -= ball.vx * dt;
  ball.z -= ball.vz * dt;
  home.touchCooldown = TOUCH_COOLDOWN_S;
  home.turnTouch = null;
}
