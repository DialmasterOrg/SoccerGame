import { BALL_R } from '../art/ball';
import { BALL_REST_Y } from './ball';
import { ballOutOfPlay } from './keeper';
import { PLAYER_R, type PlayerIntent } from './player';
import { maxHasBall } from './steal';
import type { World } from './world';

/**
 * The nutmeg, a world rule: the computer pokes its ball through the legs of
 * a Harrison standing still and square in its path, and the ball passes
 * through his body. Only his outfield body lets it through, never his
 * keeper's, and bodies stay solid: only the ball goes through. Harrison
 * counts as still and square within `ahead` px of the nutmegger along its
 * facing and `lane` px of its line, the ball on that line too, on his feet
 * and slower than `stillSpeed` px/s, facing it. The ball goes through at
 * `push` px/s and is through for at most `passS`.
 */
export const NUTMEG = { ahead: 26, lane: 4, stillSpeed: 8, push: 150, passS: 0.4 };

/**
 * Harrison still and square in the away player's path, close in: on his
 * feet, slower than stillSpeed, facing it, within `ahead` and `lane` of its
 * line with the ball on his line too; not winding up, sliding, turning,
 * tricking or fallen.
 */
export function squareAndStill(w: World): boolean {
  const { home: him, away: me, ball } = w;
  if (him.state !== 'ground' || him.y !== 0 || him.turnS > 0 || him.trick !== null) return false;
  if (Math.hypot(him.vx, him.vz) >= NUTMEG.stillSpeed) return false;
  const dir = me.facing;
  if (him.facing !== -dir) return false;
  const ahead = (him.x - me.x) * dir;
  if (ahead <= 0 || ahead > NUTMEG.ahead) return false;
  return Math.abs(him.z - me.z) <= NUTMEG.lane && Math.abs(ball.z - me.z) <= NUTMEG.lane;
}

/** A nutmeg press with its ball at its feet and squareAndStill: the ball goes through. Whether it did; nothing changes otherwise. */
export function startNutmeg(w: World, intent: PlayerIntent): boolean {
  if (!intent.nutmeg || w.match.phase !== 'playing' || w.wave?.live || ballOutOfPlay(w)) return false;
  if (!maxHasBall(w.away, w.ball) || !squareAndStill(w)) return false;
  const dir = w.away.facing;
  Object.assign(w.ball, { y: BALL_REST_Y, vx: dir * NUTMEG.push, vy: 0, vz: 0, spin: 0, touchedBy: 'away', through: { team: 'home', dir, leftS: NUTMEG.passS } });
  return true;
}

/** Counts it down; ends it once the ball is past his body (PLAYER_R + BALL_R beyond him along the push) or time is up. */
export function stepNutmeg(w: World, dt: number): void {
  const through = w.ball.through;
  if (!through) return;
  through.leftS -= dt;
  const him = through.team === 'home' ? w.home : w.away;
  const past = (w.ball.x - him.x) * through.dir >= PLAYER_R + BALL_R;
  if (past || through.leftS <= 1e-9) delete w.ball.through;
}
