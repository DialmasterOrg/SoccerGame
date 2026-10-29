import type { AiBrain, Steer } from './ai';
import { openCorner } from './aiming';
import { NO_INTENT, PLAYER_R, type Player, type PlayerIntent } from './player';
import { chargeTime } from './stats';
import { maxHasBall } from './steal';
import { CHASE_OFFSET, attackDir, predictBall } from './styles';
import { startMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';

/**
 * Poacher Priya follows every shot in. After her own kick at goal, or
 * Harrison's keeper pushing the ball away, she follows in for `followS`,
 * sprinting to where the loose ball will be; with it at her feet within
 * `pounceRange` of the line she shoots at once, a short charge at the open
 * corner. While Harrison has the ball she lingers upfield, no more than
 * `lingerX` into her own half (styles.ts' defendSpot).
 */
export const POACH = { lingerX: 160, followS: 2, pounceRange: 160 };

/** Her pounce is held for this share of her charge time: a first-time strike, as the School Harrison follows up. */
const POUNCE_CHARGE = 0.5;

type FollowMove = Extract<TryoutMove, { kind: 'follow' }>;

/** How far she is from the goal line she attacks, px. */
function toGoal(w: World, me: Player): number {
  const dir = attackDir(me);
  const goal = w.field.goals.find(g => g.side === (dir > 0 ? 'right' : 'left'))!;
  return (goal.lineX - me.x) * dir;
}

/** Her kick at goal, or Harrison's keeper pushing the ball away, starts her following in: afresh if she already is. */
export function followCue(brain: AiBrain, w: World, me: Player, them: Player): void {
  const kick = w.events.kicks[me.team === 'home' ? 0 : 1];
  const atGoal = kick?.kicked != null && w.ball.vx * attackDir(me) > 0;
  if (!atGoal && w.events.keeper.pushed !== them.team) return;
  startMove(brain, { kind: 'follow', t: 0, pounceAtS: null, aim: 'far' });
  brain.plan = 'chase';
}

/** Her pounce: winding up with the ball held at her feet, then let go at the open corner, and the swing seen through. */
function pounceTick(move: FollowMove, w: World, me: Player): PlayerIntent | null {
  const dir = attackDir(me);
  const into = move.t - move.pounceAtS!;
  if (into < POUNCE_CHARGE * chargeTime(me.stats)) {
    const windingUp = into === 0 || me.state === 'charging';
    return windingUp ? { ...NO_INTENT, faceX: dir, shootHeld: true, aim: move.aim, carry: true } : null;
  }
  return me.state === 'charging' || me.state === 'kicking' ? { ...NO_INTENT, faceX: dir, aim: move.aim } : null;
}

/** One tick of following in: sprint to where the loose ball will be, and pounce on it near goal; null once it's over. */
export function followTick(move: FollowMove, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (move.pounceAtS !== null) return pounceTick(move, w, me);
  if (move.t > POACH.followS || maxHasBall(them, w.ball)) return null;
  const dir = attackDir(me);
  // The ball at her feet, were she facing the goal she attacks: she turns onto it as she winds up.
  if (me.state === 'ground' && maxHasBall({ ...me, facing: dir }, w.ball)) {
    const out = toGoal(w, me);
    if (out <= 0 || out > POACH.pounceRange) return null;
    [move.pounceAtS, move.aim] = [move.t, openCorner(w, me)];
    return pounceTick(move, w, me);
  }
  const at = predictBall(w);
  const behindX = Math.min(Math.max(at.x - dir * CHASE_OFFSET, w.field.fenceL + PLAYER_R), w.field.fenceR - PLAYER_R);
  return { ...steer.to(behindX, at.z), sprint: true };
}
