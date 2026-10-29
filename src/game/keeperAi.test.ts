import { describe, expect, it } from 'vitest';
import { inGoalBox } from './field';
import { SET_OFF, quietKeepers, stepKeeper } from './keeper';
import { NO_INTENT, PLAYER_R } from './player';
import { keeperWorld, runFor, runUntil, setBall, shotAt } from './testKeepers';
import type { World } from './world';

// The away keeper guards the right goal, line 1240.
const away = (w: World) => w.keepers!.away;

describe('where he stands', () => {
  it('with the ball far away he stands on his line in the middle of his goal', () => {
    const w = keeperWorld();
    runFor(w, 1);
    expect(away(w).body.x).toBeCloseTo(1240 - PLAYER_R - SET_OFF, 0);
    expect(away(w).body.z).toBeCloseTo(64, 0);
  });

  it('he comes off his line and across as the ball comes closer', () => {
    const w = keeperWorld();
    setBall(w, { x: 1090, z: 30 });
    runFor(w, 1.5);
    expect(away(w).body.x).toBeLessThan(1225);
    expect(away(w).body.z).toBeGreaterThan(30);
    expect(away(w).body.z).toBeLessThan(63);
  });
});

describe('reading shots', () => {
  it('he waits his reaction before answering a new shot', () => {
    const w = keeperWorld();
    runFor(w, 1);
    const z0 = away(w).body.z;
    shotAt(w, { x: 1000, z: 64 }, 80, 300);
    runFor(w, away(w).profile.reactionS - 2 / 60);
    expect(away(w).body.z).toBeCloseTo(z0, 1);
  });

  it('a shot he can reach on his feet he shuffles to, without diving', () => {
    const w = keeperWorld();
    runFor(w, 1);
    shotAt(w, { x: 1000, z: 64 }, 76, 260);
    expect(runUntil(w, 1.2, w => w.events.keeper.dived !== null)).toBe(false);
  });

  it("a shot he can't reach on his feet he dives for, toward the near post", () => {
    const w = keeperWorld();
    runFor(w, 1);
    shotAt(w, { x: 1040, z: 64 }, 40, 600);
    expect(runUntil(w, 0.6, w => w.events.keeper.dived === 'away')).toBe(true);
    expect(away(w).dive).toEqual({ dirX: 0, dirZ: -1 });
  });

  it('a shot going wide he lets go by', () => {
    const w = keeperWorld();
    runFor(w, 1);
    // Hard and wide of the near post: a keeper who read it as on target would have to dive.
    shotAt(w, { x: 1040, z: 64 }, 26, 600);
    expect(runUntil(w, 1, w => w.events.keeper.dived !== null)).toBe(false);
  });

  // Review focus 1
  it('a shot deflected on its way is read afresh after his reaction, never at the old line', () => {
    const w = keeperWorld();
    runFor(w, 1);
    shotAt(w, { x: 1000, z: 64 }, 84, 300);
    runFor(w, 0.12);
    const z0 = away(w).body.z;
    shotAt(w, { x: w.ball.x, z: w.ball.z }, 48, 300); // as if off a body
    runFor(w, away(w).profile.reactionS - 2 / 60);
    expect(away(w).body.z).toBeCloseTo(z0, 1);
    runFor(w, 1);
    expect(away(w).dive?.dirZ ?? -1).toBe(-1);
  });
});

describe('the dive', () => {
  it('he lies down after a dive, then gets up, and only then plays on', () => {
    const w = keeperWorld();
    const k = away(w);
    stepKeeper(w, k, { move: NO_INTENT, dive: { dirX: 0, dirZ: 1 } }, true, 1 / 60, quietKeepers());
    const acts: string[] = [];
    for (let i = 0; i < 120; i++) {
      runFor(w, 1 / 60);
      if (acts.at(-1) !== k.act) acts.push(k.act);
    }
    expect(acts).toEqual(['dive', 'down', 'getUp', 'set']);
  });

  it('a dive beside his near post never takes him into the goal', () => {
    const w = keeperWorld();
    const k = away(w);
    Object.assign(k.body, { x: 1236, z: 42 });
    stepKeeper(w, k, { move: NO_INTENT, dive: { dirX: 0, dirZ: -1 } }, true, 1 / 60, quietKeepers());
    for (let i = 0; i < 60; i++) {
      runFor(w, 1 / 60);
      for (const g of w.field.goals) expect(inGoalBox(g, k.body.x, k.body.z, 0)).toBe(false);
    }
  });
});
