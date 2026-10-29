import type { AiBrain, Steer } from './ai';
import { headPlay, headTick } from './hank';
import type { Aim } from './kick';
import type { Player, PlayerIntent } from './player';
import type { World } from './world';

/** A tryout kid's own move under way; each kid's task adds its kind. */
export type TryoutMove = { kind: 'head'; t: number; at: { x: number; z: number }; jumpInS: number; jumped: boolean; aim: Aim };

/** Starts `move`, counting it for the personality checks. */
export function startMove(brain: AiBrain, move: TryoutMove): void {
  brain.move = move;
  brain.started[move.kind] = (brain.started[move.kind] ?? 0) + 1;
}

/** A kid's own play with the ball at its feet; null to play as Max does. Today's styles have none, and draw no random number. */
export function onBallPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (w.match.phase !== 'playing') return null;
  switch (brain.profile.style) {
    default:
      return null;
  }
}

/** Its own play for a ball nobody has; null for the usual chase. */
export function looseBallPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (w.match.phase !== 'playing') return null;
  switch (brain.profile.style) {
    case 'header':
      return headPlay(brain, w, me, them, steer);
    default:
      return null;
  }
}

/** One tick of the move under way; false once it's over, and decide runs afresh this tick. */
export function tickMove(brain: AiBrain, w: World, me: Player, them: Player, dt: number, steer: Steer): boolean {
  const move = brain.move;
  if (!move) return false;
  move.t += dt;
  const intent = move.kind === 'head' ? headTick(move, w, me, them, steer) : null;
  if (!intent) {
    brain.move = null;
    brain.nextDecisionS = 0;
    return false;
  }
  brain.intent = intent;
  return true;
}
