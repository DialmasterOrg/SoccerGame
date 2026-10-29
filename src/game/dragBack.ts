import { ballOutOfPlay } from './keeper';
import { BALL_REST_Y } from './ball';
import { canPlace } from './contact';
import type { PlayerIntent } from './player';
import { POWER_REACH } from './power';
import { FOOT_SPOT, maxHasBall } from './steal';
import type { World } from './world';
import { REACH_Z } from './zones';

/**
 * Harrison's drag-back: with the ball his, pushing the stick back the other
 * way along the pitch stops it under his sole and rolls it round to his new
 * front while he plants, then he goes on the new way with it. Max doesn't
 * get it.
 */

/** How long the turn takes, s. */
export const TURN_S = 0.2;
/** The ball is his to turn up to this far ahead of him along his facing: where a dribbled ball runs between touches, as for a power-up... */
export const DRAG_REACH = POWER_REACH;
/** ...and this far either side of his line. */
const DRAG_SIDE = REACH_Z + 3;
const BALL_LOW = BALL_REST_Y + 3;
/** The stick must push at least this hard back the other way. */
const STICK_BACK = 0.5;

/** The ball is Harrison's to turn or trick with: low, just ahead of him, in his lane, and not at the opponent's feet nor in the dog's mouth. */
export function ballIsHis(w: World): boolean {
  const { home, ball } = w;
  const ahead = (ball.x - home.x) * home.facing;
  const his = ball.y <= BALL_LOW && ahead >= 0 && ahead <= DRAG_REACH && Math.abs(ball.z - home.z) <= DRAG_SIDE;
  return his && !w.dog?.carrying && !(w.dog === null && maxHasBall(w.away, ball));
}

/**
 * Starts a drag-back when he's on his feet in play, not already turning or
 * stumbling, the stick pushes back against the way he faces, and the ball
 * is his: low, just ahead of him, and not at Max's feet nor in the dog's
 * mouth. He faces the new way at once and the ball stops.
 */
export function startDragBack(w: World, intent: PlayerIntent): boolean {
  const { home, ball } = w;
  const ready = w.match.phase === 'playing' && home.state === 'ground' && home.y === 0 && home.turnS === 0 && home.stumbleS === 0 && home.trick === null;
  const back = Math.sign(intent.moveX) === -home.facing && Math.abs(intent.moveX) >= STICK_BACK;
  if (!ready || !back || w.wave?.live || ballOutOfPlay(w) || !ballIsHis(w)) return false;
  home.turnS = TURN_S;
  home.facing = home.facing === 1 ? -1 : 1;
  Object.assign(ball, { y: BALL_REST_Y, vx: 0, vy: 0, vz: 0, spin: 0 });
  return true;
}

/**
 * One tick of the turn: the ball rolls on toward FOOT_SPOT in front of him,
 * arriving as the turn ends. If he's knocked off his feet, anyone has played
 * it (it's moving), or its spot can't be reached without going through a
 * fence, a post or a net, the turn ends there and the ball stays where it is.
 */
export function stepDragBack(w: World, dt: number): void {
  const { home, ball, field } = w;
  if (home.turnS === 0) return;
  const target = { x: home.x + home.facing * FOOT_SPOT, z: home.z };
  const played = ball.vx !== 0 || ball.vz !== 0 || ball.vy !== 0 || ball.y > BALL_LOW;
  if (home.state !== 'ground' || played || !canPlace(ball, target.x, target.z, field)) {
    home.turnS = 0;
    return;
  }
  const k = Math.min(1, dt / home.turnS);
  ball.x += (target.x - ball.x) * k;
  ball.z += (target.z - ball.z) * k;
  home.turnS = Math.max(0, home.turnS - dt);
}
