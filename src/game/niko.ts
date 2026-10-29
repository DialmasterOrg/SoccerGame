import type { AiBrain, Steer } from './ai';
import { squareAndStill } from './nutmeg';
import { PLAYER_R, type Player, type PlayerIntent } from './player';
import { maxHasBall } from './steal';
import { attackDir, roomySide } from './styles';
import { startMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';

/**
 * Nutmeg Niko puts it through your legs. With the ball at his feet and
 * Harrison square and still in his path (nutmeg.ts' world rule), he presses
 * the nutmeg and runs round him on the roomier side, `off` px off his line
 * until he's `past` px beyond him, then goes back onto the ball. The run
 * round gives up after `maxS`, should Harrison keep getting in his way.
 */
export const ROUND = { off: 2 * PLAYER_R + 2, past: 2 * PLAYER_R, maxS: 1 };

type NutmegMove = Extract<TryoutMove, { kind: 'nutmeg' }>;

/** His nutmeg, on the ball with Harrison square and still ahead of him; null to play as Max does. */
export function nutmegPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (me.state !== 'ground' || !maxHasBall(me, w.ball) || !squareAndStill(w)) return null;
  const move: NutmegMove = { kind: 'nutmeg', t: 0, side: roomySide(w, them.z, me.z) as 1 | -1 };
  startMove(brain, move);
  brain.plan = 'dribble';
  return nutmegTick(move, w, me, them, steer);
}

/**
 * One tick of his nutmeg: the press, then the run round Harrison in the
 * lane beside him; null once he's past, or should the press have come to
 * nothing.
 */
export function nutmegTick(move: NutmegMove, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  const dir = attackDir(me);
  const ballPast = (w.ball.x - them.x) * dir > 0;
  if (move.t > 0 && !w.ball.through && !ballPast) return null;
  const beyond = (me.x - them.x) * dir;
  if (move.t > ROUND.maxS || beyond >= ROUND.past) return null;
  const laneZ = Math.min(Math.max(them.z + move.side * ROUND.off, PLAYER_R), w.field.depth - PLAYER_R);
  // Out to the lane beside him first, then on past him along it.
  const x = beyond < 0 ? them.x : them.x + dir * ROUND.past;
  return { ...steer.to(x, laneZ), sprint: true, faceX: dir, nutmeg: move.t === 0 };
}
