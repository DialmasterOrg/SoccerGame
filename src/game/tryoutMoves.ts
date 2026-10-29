import type { AiBrain, Steer } from './ai';
import { shapePlay, shapeTick } from './finn';
import { headPlay, headTick } from './hank';
import { chipTick, loftPlay } from './lola';
import { followCue, followTick } from './priya';
import type { Aim } from './kick';
import type { Player, PlayerIntent } from './player';
import type { World } from './world';

/** A tryout kid's own move under way; each kid's task adds its kind. */
export type TryoutMove =
  | { kind: 'head'; t: number; at: { x: number; z: number }; jumpInS: number; jumped: boolean; aim: Aim }
  | { kind: 'chip'; t: number; charge: number; error: number; judged: boolean; pressed: boolean; aim: Aim }
  | { kind: 'shape'; t: number; side: 1 | -1; cutAtS: number | null; aim: Aim }
  | { kind: 'follow'; t: number; pounceAtS: number | null; aim: Aim };

/** The tick of whichever move is under way. */
function tickOf(brain: AiBrain, move: TryoutMove, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  switch (move.kind) {
    case 'head':
      return headTick(move, w, me, them, steer);
    case 'chip':
      return chipTick(move, w, me, steer);
    case 'shape':
      return shapeTick(brain, move, w, me, them);
    case 'follow':
      return followTick(move, w, me, them, steer);
  }
}

/** Starts `move`, counting it for the personality checks. */
export function startMove(brain: AiBrain, move: TryoutMove): void {
  brain.move = move;
  brain.started[move.kind] = (brain.started[move.kind] ?? 0) + 1;
}

/** A kid's own play with the ball at its feet; null to play as Max does. Today's styles have none, and draw no random number. */
export function onBallPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (w.match.phase !== 'playing') return null;
  switch (brain.profile.style) {
    case 'chipper':
      return loftPlay(brain, w, me, them, steer);
    case 'faker':
      return shapePlay(brain, w, me, them);
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

/** A move started the tick something happens, whatever the decision clock says; only Priya has one, and it draws no random number. */
export function cueMove(brain: AiBrain, w: World, me: Player, them: Player): void {
  if (brain.profile.style === 'poacher') followCue(brain, w, me, them);
}

/** One tick of the move under way; false once it's over, and decide runs afresh this tick. */
export function tickMove(brain: AiBrain, w: World, me: Player, them: Player, dt: number, steer: Steer): boolean {
  const move = brain.move;
  if (!move) return false;
  move.t += dt;
  const intent = tickOf(brain, move, w, me, them, steer);
  if (!intent) {
    brain.move = null;
    brain.nextDecisionS = 0;
    return false;
  }
  brain.intent = intent;
  return true;
}
