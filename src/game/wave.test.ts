import { describe, expect, it } from 'vitest';
import { BALL_REST_Y } from './ball';
import { inGoalBox } from './field';
import { PERFECT_BONUS } from './kick';
import { BLOWN_DOWN_S, NO_INTENT, PLAYER_R, blowAway } from './player';
import { maxShotSpeed, BASE_STATS } from './stats';
import { BRACE_DISTANCE, WAVE_HALF_WIDTH, WAVE_SPEED, fireWave } from './wave';
import { createWorld, stepWorld, type World } from './world';
import { keeperWorld, runFor, runUntil, setBall } from './testKeepers';

const STEP = 1 / 60;
const ORIGIN_X = 208;
const LINE_Z = 32;

/** Play on, Harrison with the ball at his feet and a full meter, Max placed: then the wave fires straight at the middle of the mouth. */
function fired(max: Partial<World['away']>): World {
  const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }, { golden: false });
  w.match.phase = 'playing';
  w.power!.meter = 1;
  Object.assign(w.home, { x: ORIGIN_X - 8, z: LINE_Z, facing: 1 });
  Object.assign(w.ball, { x: ORIGIN_X, y: BALL_REST_Y, z: LINE_Z, vx: 0, vy: 0, vz: 0 });
  Object.assign(w.away, { z: LINE_Z, facing: -1, state: 'ground' }, max);
  w.wave = fireWave(w);
  return w;
}

/** Steps until the wave decides about Max, or a goal; returns what happened. */
function run(w: World, maxTicks = 60): { braced: boolean; blown: boolean; goal: boolean } {
  const seen = { braced: false, blown: false, goal: false };
  for (let i = 0; i < maxTicks && !seen.goal; i++) {
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    seen.braced ||= w.events.power.braced;
    seen.blown ||= w.events.power.blown;
    seen.goal ||= w.events.goal === 'home';
  }
  return seen;
}

describe('the Energy Wave', () => {
  it('fires straight along the aim line at wave speed, spending the meter', () => {
    const w = fired({ x: 150 });
    expect(w.power?.meter).toBe(0);
    expect(w.power?.lastKind).toBe('wave');
    expect([w.ball.vx, w.ball.vz, w.ball.vy]).toEqual([WAVE_SPEED, 0, 0]);
  });

  it('a wave with Max out of the lane scores', () => {
    const w = fired({ x: 400, z: 6 });
    expect(run(w)).toEqual({ braced: false, blown: false, goal: true });
  });

  it('Max upright, facing and 150 px away braces: he skids, the ball dies at his feet', () => {
    const w = fired({ x: ORIGIN_X + 150 });
    const seen = run(w, 30);
    expect(seen).toEqual({ braced: true, blown: false, goal: false });
    expect(w.away.state).toBe('bracing');
    expect(Math.hypot(w.ball.vx, w.ball.vz)).toBeLessThan(5);
    expect(w.ball.x).toBeLessThan(ORIGIN_X + 150);
    expect(w.ball.x).toBeGreaterThan(ORIGIN_X + 150 - 2 * PLAYER_R - 4);
    for (let i = 0; i < 40; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.away.state).toBe('ground');
    expect(w.away.x - (ORIGIN_X + 150)).toBeGreaterThanOrEqual(20);
    expect(w.away.x - (ORIGIN_X + 150)).toBeLessThanOrEqual(30);
  });

  it('Max 40 px away is blown away and the ball goes on to score', () => {
    const w = fired({ x: ORIGIN_X + 40 });
    const seen = run(w);
    expect(seen).toEqual({ braced: false, blown: true, goal: true });
  });

  it.each<[string, Partial<World['away']>]>([
    ['sliding', { state: 'sliding', kick: { kind: 'slide', charge: 0, overchargeS: 0, aim: 'straight', active: true } }],
    ['in the air', { state: 'air', y: 5, vy: 250 }],
    ['facing away', { facing: 1 }],
  ])('Max %s is blown away even from far', (_, state) => {
    const w = fired({ x: ORIGIN_X + 150, ...state });
    expect(run(w).blown).toBe(true);
  });

  it('a lane width away, the wave misses Max', () => {
    const w = fired({ x: ORIGIN_X + 60, z: LINE_Z + WAVE_HALF_WIDTH + PLAYER_R + 1 });
    expect(run(w)).toEqual({ braced: false, blown: false, goal: true });
    expect(w.away.state).toBe('ground');
  });

  it('just inside the lane, the wave reaches Max', () => {
    const w = fired({ x: ORIGIN_X + 60, z: LINE_Z + WAVE_HALF_WIDTH + PLAYER_R });
    expect(run(w).blown).toBe(true);
  });

  it('the brace boundary: exactly BRACE_DISTANCE braces, one px less blows', () => {
    expect(run(fired({ x: ORIGIN_X + BRACE_DISTANCE + PLAYER_R })).braced).toBe(true);
    expect(run(fired({ x: ORIGIN_X + BRACE_DISTANCE + PLAYER_R - 1 })).blown).toBe(true);
  });

  it('the beam fades after it ends, and a kickoff clears it', () => {
    const w = fired({ x: 400, z: 6 });
    run(w);
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.wave?.live).toBe(false);
    for (let i = 0; i < 3 * 60 && w.match.phase !== 'kickoff'; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.wave).toBeNull();
  });

  it('the wave beats any shot: WAVE_SPEED exceeds 1.25 × the level-10 max shot speed × PERFECT_BONUS', () => {
    const top = { speed: 10, power: 10, jump: 10, control: 10, stamina: 1 };
    expect(WAVE_SPEED).toBeGreaterThan(1.25 * maxShotSpeed(top) * PERFECT_BONUS);
  });
});

describe('blown away beside his own goal', () => {
  const goal = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }).field.goals[1];
  it.each<[string, number, number]>([
    ['on the goal line', goal.lineX - PLAYER_R, (goal.z0 + goal.z1) / 2],
    ['beside the near post', goal.lineX, goal.z0 - PLAYER_R - 1],
    ['beside the far post', goal.lineX, goal.z1 + PLAYER_R + 1],
    ['30 px in front of the goal', goal.lineX - 30, (goal.z0 + goal.z1) / 2],
    ['wide, flying in toward the far post', goal.lineX - 40, 8],
  ])('a blown-away Max launched %s lands outside every goal box and is up in time', (_, x, z) => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 });
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 100 });
    Object.assign(w.ball, { x: 100, z: 10 });
    Object.assign(w.away, { x, z });
    const [dx, dz] = [goal.lineX - (x - 100), goal.z1 - 4 - z];
    const d = Math.hypot(dx, dz);
    blowAway(w.away, z === 8 ? dx / d : 1, z === 8 ? dz / d : 0);
    for (let i = 0; i < Math.round(BLOWN_DOWN_S / STEP) + 1; i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      for (const g of w.field.goals) expect(inGoalBox(g, w.away.x, w.away.z, 0), `tick ${i}`).toBe(false);
      expect(w.away.x).toBeLessThanOrEqual(w.field.fenceR - PLAYER_R);
      expect(w.away.y).toBeLessThan(goal.barY);
    }
    expect(w.away.state).toBe('ground');
  });
});

describe('the Energy Wave against keepers', () => {
  function waveAtKeeper(): World {
    const w = keeperWorld({ power: true });
    runFor(w, 1);
    Object.assign(w.away, { x: 500, z: 120 });
    Object.assign(w.home, { x: 1092, z: 64, facing: 1 });
    setBall(w, { x: 1100, z: 64 });
    w.wave = fireWave(w);
    return w;
  }

  it('the Energy Wave blows a keeper in its path into his net, and scores', () => {
    const w = waveAtKeeper();
    // The ball can cross the line a tick or two before he lands in the net, so watch for both.
    let [inNet, goal] = [false, false];
    runUntil(w, 1, w => {
      inNet ||= w.keepers!.away.body.inNet === true;
      goal ||= w.events.goal === 'home';
      return inNet && goal;
    });
    expect([inNet, goal, w.wave?.keeperBlown]).toEqual([true, true, true]);
  });

  it('a keeper blown into his net walks back out before the kickoff', () => {
    const w = waveAtKeeper();
    runUntil(w, 1, w => w.events.goal === 'home');
    runUntil(w, BLOWN_DOWN_S + 0.4, () => false);
    const k = w.keepers!.away.body;
    expect(w.match.phase).toBe('goal');
    expect(k.inNet ?? false).toBe(false);
    for (const g of w.field.goals) expect(inGoalBox(g, k.x, k.z, 0)).toBe(false);
  });
});
