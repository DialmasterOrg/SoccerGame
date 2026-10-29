import { penaltyArea } from '../game/field';
import type { World } from '../game/world';
import type { GoalRecord } from '../meta/economy';
import type { LastKick } from './goalCallout';

/** A kick struck within this long of their keeper pushing the ball away is a rebound, s. */
export const REBOUND_S = 2;

/** What the School Field's bonuses need, kept tick by tick. */
export interface KeeperWatch {
  /** Seconds since their keeper last pushed the ball away; Infinity before he has. */
  sincePushS: number;
  /** Harrison's latest kick came within REBOUND_S of a push. */
  reboundKick: boolean;
}

export function createKeeperWatch(): KeeperWatch {
  return { sincePushS: Infinity, reboundKick: false };
}

/** After a world step: a kick of his this tick is judged against the push before it, then this tick's push by their keeper restarts the clock. */
export function stepKeeperWatch(watch: KeeperWatch, w: World, dt: number): void {
  if (w.events.kicks[0]?.kicked) watch.reboundKick = watch.sincePushS <= REBOUND_S;
  watch.sincePushS += dt;
  if (w.events.keeper.pushed === 'away') watch.sincePushS = 0;
}

const NONE: Pick<GoalRecord, 'outsideBox' | 'rebound'> = { outsideBox: false, rebound: false };

/**
 * Read on the tick of his goal: both false unless there are keepers, `kick`
 * is a live kick of his that isn't the wave, and the strike is his. The wave
 * makes no strike, so the one there would be stale. A strike on the box's
 * edge counts as inside.
 */
export function goalFacts(w: World, watch: KeeperWatch, kick: LastKick | null): Pick<GoalRecord, 'outsideBox' | 'rebound'> {
  const strike = w.keepers?.strike ?? null;
  if (!strike || strike.team !== 'home' || !kick || kick.kind === 'wave') return { ...NONE };
  const box = penaltyArea(w.field, w.field.goals[1]);
  const outsideBox = strike.x < box.x0 || strike.x > box.x1 || strike.z < box.z0 || strike.z > box.z1;
  return { outsideBox, rebound: watch.reboundKick };
}
