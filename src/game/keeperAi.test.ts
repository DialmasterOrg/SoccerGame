import { describe, expect, it } from 'vitest';
import { BALL_R } from '../art/ball';
import { DIFFICULTY, createBrain, think } from './ai';
import { inGoalBox } from './field';
import { SET_OFF, quietKeepers, stepKeeper } from './keeper';
import { NO_INTENT, PLAYER_R } from './player';
import { chargeTime } from './stats';
import { keeperWorld, runFor, runUntil, setBall, shotAt } from './testKeepers';
import { stepWorld, type World } from './world';

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

/**
 * Harrison 100 px out on the ball, through on goal. Once the keeper is
 * coming out and 30-60 px off his line, Harrison chips straight at `charge`.
 * Whether the ball passed the keeper's plane above his reach, was under the
 * bar at the line, and scored.
 */
function chipOverRushingKeeper(charge: number): { overHim: boolean; underBar: boolean; goal: boolean } {
  const w = keeperWorld();
  const k = away(w);
  Object.assign(w.home, { x: 1132, z: 64, facing: 1 });
  setBall(w, { x: 1140, z: 64 });
  const holdS = charge * chargeTime(w.home.stats);
  let chipS: number | null = null;
  let [overHim, underBar, goal, prevX] = [false, false, false, w.ball.x];
  const bar = w.field.goals[1].barY;
  runUntil(w, 4, w => {
    const x = w.ball.x;
    if (prevX < k.body.x && x >= k.body.x && w.ball.y - BALL_R > k.profile.reachY) overHim = true;
    if (prevX < 1240 && x >= 1240 && w.ball.y + BALL_R <= bar) underBar = true;
    prevX = x;
    goal ||= w.events.goal === 'home';
    return goal || k.holding;
  }, () => {
    const off = 1240 - k.body.x;
    if (chipS === null && k.act === 'rush' && off >= 30 && off <= 60) chipS = 0;
    if (chipS === null) return NO_INTENT;
    chipS += 1 / 60;
    return { ...NO_INTENT, chipHeld: chipS <= holdS };
  });
  return { overHim, underBar, goal };
}

describe('coming out', () => {
  it('he comes out for a loose ball in his box he reaches first, and gathers it', () => {
    const w = keeperWorld();
    runFor(w, 1);
    setBall(w, { x: 1170, z: 90, vx: 20 });
    expect(runUntil(w, 2, w => w.keepers!.away.holding)).toBe(true);
  });

  it('he leaves a loose ball Harrison will reach first', () => {
    const w = keeperWorld();
    runFor(w, 1);
    Object.assign(w.home, { x: 1118, z: 64, facing: 1 });
    setBall(w, { x: 1134, z: 64 });
    let rushed = false;
    // Only until Harrison reaches it: then he's a dribbler, which is the next rule's business.
    const reached = runUntil(w, 0.5, w => {
      if (w.events.kicks[0]?.touched) return true;
      rushed ||= w.keepers!.away.act === 'rush';
      return false;
    }, { ...NO_INTENT, moveX: 1 });
    expect([reached, rushed]).toEqual([true, false]);
  });

  // Review focus 4
  it('he never leaves his box, even for a ball just outside it, and Max still gets it', () => {
    const w = keeperWorld();
    const brain = createBrain(DIFFICULTY.normal);
    setBall(w, { x: 1124, z: 64 });
    Object.assign(w.away, { x: 1000, z: 64 });
    let maxTouched = false;
    for (let i = 0; i < 180; i++) {
      stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, 1 / 60), 1 / 60);
      expect(w.keepers!.away.body.x).toBeGreaterThanOrEqual(1130);
      maxTouched ||= w.events.kicks[1]?.touched ?? false;
    }
    expect(maxTouched).toBe(true);
  });

  it('he comes out to a dribbler through on goal and smothers the ball at his feet', () => {
    const w = keeperWorld();
    Object.assign(w.home, { x: 1100, z: 64, facing: 1 });
    setBall(w, { x: 1108, z: 64 });
    const seen = { rush: false, smother: false };
    const held = runUntil(w, 3, w => {
      const k = w.keepers!.away;
      seen.rush ||= k.act === 'rush';
      seen.smother ||= w.events.keeper.dived === 'away' && Math.abs(k.dive!.dirX) > Math.abs(k.dive!.dirZ);
      return k.holding;
    }, { ...NO_INTENT, moveX: 1 });
    expect([seen.rush, seen.smother, held]).toEqual([true, true, true]);
  });

  it('a smother the ball has left misses, and leaves him down', () => {
    const w = keeperWorld();
    Object.assign(w.home, { x: 1150, z: 64, facing: 1 });
    setBall(w, { x: 1158, z: 64 });
    runUntil(w, 3, w => w.events.keeper.dived === 'away');
    setBall(w, { x: w.ball.x, z: w.ball.z + 24 });
    runFor(w, w.keepers!.away.profile.diveS + 0.05);
    expect([w.keepers!.away.holding, w.keepers!.away.act]).toEqual([false, 'down']);
  });

  it('a chip that goes over a keeper off his line, and drops under the bar, scores', () => {
    let over = 0;
    for (const charge of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      const r = chipOverRushingKeeper(charge);
      if (r.overHim && r.underBar) {
        over++;
        expect(r.goal, `charge ${charge}`).toBe(true);
      }
    }
    expect(over).toBeGreaterThan(0);
  });
});
