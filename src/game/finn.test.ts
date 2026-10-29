import { describe, expect, it } from 'vitest';
import type { AiBrain } from './ai';
import { NO_INTENT, type PlayerIntent } from './player';
import { maxHasBall } from './steal';
import { kidWorld, stepKid } from './testTryouts';
import { setBall } from './testKeepers';
import { stepWorld, type World } from './world';

const STEP = 1 / 60;
const VARIANTS = [...Array(16)].map((_, i) => i);
/** The ball counts as still when it moves less than this in a tick. */
const STILL_PX = 0.05;

/** Finn on the ball 150 px out from Harrison's goal line, facing it; Harrison standing still `ahead` px ahead of him in his lane, facing him. */
function shapeUp(i: number, ahead: number, asMax = false): { w: World; brain: AiBrain } {
  const { w, brain } = kidWorld('finn', { asMax, seed: 1 + i });
  const g = w.field.goals[0]!;
  const z = 44 + 2.5 * i;
  Object.assign(w.away, { x: g.lineX + 158, z, facing: -1 });
  setBall(w, { x: g.lineX + 150, z });
  Object.assign(w.home, { x: w.away.x - ahead, z, facing: 1 });
  return { w, brain };
}

/** Steps until the kid winds up (true), or `s` runs out. */
function windsUpWithin(w: World, brain: AiBrain, s: number): boolean {
  for (let k = 0; k < s / STEP; k++) {
    stepKid(w, brain, STEP);
    if (w.away.state === 'charging') return true;
  }
  return false;
}

/**
 * Harrison commits with `press` for one tick, `leadS` into the kid's wind-up;
 * whether, `afterS` later, the kid has the ball and is past him toward goal.
 */
function cutPast(w: World, brain: AiBrain, press: Partial<PlayerIntent>, leadS = 0.15, afterS = 0.8): boolean {
  if (!windsUpWithin(w, brain, 1)) return false;
  stepKid(w, brain, leadS);
  stepKid(w, brain, STEP, { ...NO_INTENT, faceX: 1, ...press });
  stepKid(w, brain, afterS);
  return maxHasBall(w.away, w.ball) && w.away.x < w.home.x;
}

describe('Fake-Out Finn', () => {
  it('a feint drops the wind-up with the ball still at his feet', () => {
    const { w } = shapeUp(0, 400);
    const shape = { ...NO_INTENT, faceX: -1 as const, shootHeld: true };
    for (let k = 0; k < 20; k++) stepWorld(w, NO_INTENT, shape, STEP);
    expect(w.away.state).toBe('charging');
    stepWorld(w, NO_INTENT, { ...NO_INTENT, faceX: -1, feint: true }, STEP);
    let kicked = w.events.kicks[1]?.kicked ?? null;
    for (let k = 0; k < 0.5 / STEP; k++) {
      stepWorld(w, NO_INTENT, { ...NO_INTENT, faceX: -1 }, STEP);
      kicked ??= w.events.kicks[1]?.kicked ?? null;
    }
    expect(kicked).toBeNull();
    expect(w.away.state).toBe('ground');
    expect(maxHasBall(w.away, w.ball)).toBe(true);
  });

  it('a waiting Harrison gets a real shot or another shape, and the ball never sits still long', () => {
    for (const i of VARIANTS) {
      const { w, brain } = shapeUp(i, 50);
      expect(windsUpWithin(w, brain, brain.profile.reactionS), `variant ${i}`).toBe(true);
      let [shot, still, longest] = [false, 0, 0];
      for (let k = 0; k < 2 / STEP; k++) {
        const [x, z] = [w.ball.x, w.ball.z];
        stepKid(w, brain, STEP);
        if (w.events.kicks[1]?.kicked === 'shot') shot = true;
        still = Math.hypot(w.ball.x - x, w.ball.z - z) < STILL_PX ? still + STEP : 0;
        longest = Math.max(longest, still);
      }
      expect(shot || (brain.started.shape ?? 0) >= 2, `variant ${i}`).toBe(true);
      expect(longest, `variant ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('a slide is cut past: he keeps the ball and gets by, far more often than Max', () => {
    const slide = { chipHeld: true };
    const finn = VARIANTS.filter(i => {
      const { w, brain } = shapeUp(i, 50);
      return cutPast(w, brain, slide);
    }).length;
    const max = VARIANTS.filter(i => {
      const { w, brain } = shapeUp(i, 50, true);
      return cutPast(w, brain, slide);
    }).length;
    expect(finn).toBeGreaterThanOrEqual(12);
    expect(max).toBeLessThanOrEqual(finn / 2);
  });

  it('a whiffed steal is cut past', () => {
    let past = 0;
    for (const i of VARIANTS) {
      const { w, brain } = shapeUp(i, 35);
      let tap: World['events']['steal'] = null;
      if (!windsUpWithin(w, brain, 1)) continue;
      stepKid(w, brain, 0.15);
      stepKid(w, brain, STEP, { ...NO_INTENT, faceX: 1, steal: true });
      tap = w.events.steal;
      expect(tap === 'whiff' || tap === 'missed', `variant ${i}: ${tap}`).toBe(true);
      stepKid(w, brain, 0.8);
      if (maxHasBall(w.away, w.ball) && w.away.x < w.home.x) past++;
    }
    expect(past).toBeGreaterThanOrEqual(12);
  });

  it('he never fakes the keeper: with Harrison behind him, every wind-up ends in a shot', () => {
    for (const i of VARIANTS) {
      const { w, brain } = shapeUp(i, -700);
      let [ended, shots] = [0, 0];
      for (let k = 0; k < 1.5 / STEP; k++) {
        const was = w.away.state;
        stepKid(w, brain, STEP);
        if (was === 'charging' && w.away.state !== 'charging') ended++;
        if (was === 'charging' && w.away.state === 'kicking') shots++;
      }
      expect(ended, `variant ${i}`).toBeGreaterThan(0);
      expect(shots, `variant ${i}`).toBe(ended);
      expect(brain.started.shape ?? 0, `variant ${i}`).toBe(0);
    }
  });
});
