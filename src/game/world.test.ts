import { BALL_R } from '../art/ball';
import { seeded } from '../engine/random';
import { describe, expect, it } from 'vitest';
import { DIFFICULTY, KICKOFF_HOLD_S, createBrain, think } from './ai';
import { DOG_DIFFICULTY } from './dog';
import type { Aim } from './kick';
import { SCHOOL_FIELD, goalScored, inGoalBox } from './field';
import { SCHOOL_STAGE } from './stage';
import { maxStats } from '../meta/ladder';
import { maxHasBall } from './steal';
import { NO_INTENT, NORMAL_HANDLING, PLAYER_R, type Handling, type PlayerIntent } from './player';
import { BASE_STATS, chargeTime, type Stats } from './stats';
import { BALL_REST_Y } from './ball';
import { POWERED_S, WAVE_READY_S } from './power';
import { createWorld, placeForKickoff, stepWorld, type World } from './world';
import { harrisonIntent, harrisonStats, scriptMemo } from './maxScripts';
import { HUMAN_AIM_ERROR_DEG } from './kick';
import { TRICK_DIFFICULTY, type TrickSetup } from './tricks';
import { ballIn, ballInBody, footZone } from './zones';

const STEP = 1 / 60;
const ERR = { home: 4, away: 6 };
const move = (moveX: number): PlayerIntent => ({ ...NO_INTENT, moveX });

describe('world', () => {
  it('places players for kickoff: home kicks off from beside the ball', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    expect([w.ball.x, w.ball.y]).toEqual([320, BALL_REST_Y]);
    expect([w.home.x, w.home.facing]).toEqual([308, 1]);
    expect([w.away.x, w.away.facing]).toEqual([390, -1]);
  });

  it("at Harrison's kickoff on Easy and Normal Max waits off the line, on Hard on it", () => {
    for (const [d, x, z] of [['easy', 430, 52], ['normal', 430, 56], ['hard', 390, 32]] as const) {
      const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR, null, null, DIFFICULTY[d]);
      expect([w.away.x, w.away.z], d).toEqual([x, z]);
    }
  });

  it("Max's own kickoff and Biscuit's spots are unchanged by the difficulty", () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR, null, null, DIFFICULTY.easy);
    w.match.kickoffTeam = 'away';
    placeForKickoff(w);
    expect([w.home.x, w.home.z, w.away.x, w.away.z]).toEqual([250, 32, 332, 32]);
    const dog = createWorld(BASE_STATS, BASE_STATS, 1, ERR, null, DOG_DIFFICULTY.easy, DIFFICULTY.easy);
    expect([dog.away.x, dog.away.z]).toEqual([390, 32]);
  });

  it('the next kickoff after a difficulty change uses the new spot', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR, null, null, DIFFICULTY.easy);
    w.maxProfile = DIFFICULTY.hard;
    placeForKickoff(w);
    expect([w.away.x, w.away.z]).toEqual([390, 32]);
  });

  it('a straight full shot from the spot, and one at each post, passes Max on Easy and Normal', () => {
    for (const d of ['easy', 'normal'] as const)
      for (let power = 1; power <= 10; power++)
        for (const aim of ['straight', 'far', 'near'] as Aim[]) {
          const stats: Stats = { ...BASE_STATS, power };
          const w = createWorld(stats, BASE_STATS, 1, { home: 0, away: 0 }, null, null, DIFFICULTY[d]);
          w.match.phase = 'playing';
          const hold = Math.round(chargeTime(stats) / STEP);
          for (let i = 0; i < hold; i++) stepWorld(w, { ...NO_INTENT, shootHeld: true, aim }, NO_INTENT, STEP);
          for (let i = 0; i < 60 && w.ball.x < w.away.x + 20 && w.match.phase === 'playing'; i++) {
            stepWorld(w, { ...NO_INTENT, aim }, NO_INTENT, STEP);
            const why = `${d} power ${power} ${aim} at (${w.ball.x.toFixed(1)}, ${w.ball.y.toFixed(1)}, ${w.ball.z.toFixed(1)})`;
            expect(ballInBody(w.away, w.ball, BALL_R), why).toBe(false);
            expect(ballIn(footZone(w.away), w.ball, BALL_R), why).toBe(false);
          }
          expect(w.ball.x, `${d} power ${power} ${aim} went past him`).toBeGreaterThan(w.away.x);
        }
  });

  it("if Harrison never plays the ball at his kickoff, Max comes for it after the hold, on every difficulty", () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR, null, null, DIFFICULTY[d]);
      const brain = createBrain(DIFFICULTY[d]);
      let t = 0;
      while (t < 6 && Math.hypot(w.ball.x - 320, w.ball.z - 32) < 1) {
        stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
        if (w.match.phase === 'playing') t += STEP;
      }
      expect(t, d).toBeGreaterThanOrEqual(KICKOFF_HOLD_S);
      expect(t, d).toBeLessThan(4);
    }
  });

  it('winding up with the ball at his feet, it comes with him in depth, so aiming as he moves still strikes it', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.away, { x: 600 });
    const start = { home: w.home.z, ball: w.ball.z };
    for (let i = 0; i < 24; i++) stepWorld(w, { ...NO_INTENT, shootHeld: true, moveZ: 1, aim: 'far' }, NO_INTENT, STEP);
    expect(w.home.z).toBeGreaterThan(start.home + 8);
    expect(w.ball.z - start.ball).toBeCloseTo(w.home.z - start.home);
    let kicked = false;
    for (let i = 0; i < 10 && !kicked; i++) {
      stepWorld(w, { ...NO_INTENT, aim: 'far' }, NO_INTENT, STEP);
      kicked = w.events.kicks[0]!.kicked === 'shot';
    }
    expect(kicked).toBe(true);
  });

  it('when away kicks off, away stands by the ball and home drops back', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.kickoffTeam = 'away';
    placeForKickoff(w);
    expect([w.away.x, w.away.facing]).toEqual([332, -1]);
    expect([w.home.x, w.home.facing]).toEqual([250, 1]);
  });

  it('stepWorld ignores intents outside play and places players for kickoff', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    stepWorld(w, move(1), move(-1), STEP);
    expect(w.match.phase).toBe('kickoff');
    expect(w.home.x).toBe(308);
    expect([w.ball.x, w.ball.y]).toEqual([320, BALL_REST_Y]);
  });

  it('follows intents once play starts', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    // Rightward: leftward, with the kickoff ball at his feet, is a drag-back, which plants him.
    stepWorld(w, move(1), NO_INTENT, STEP);
    expect(w.home.x).toBeGreaterThan(308);
  });

  it('a ball into the right goal is a home goal, then everyone resets for kickoff', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.ball, { x: 600, y: 5, vx: 300, vy: 0 });
    let goal = null;
    for (let i = 0; i < 30 && !goal; i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      goal = w.events.goal;
    }
    expect(goal).toBe('home');
    expect(w.match.score).toEqual({ home: 1, away: 0 });
    for (let i = 0; i < 2.1 * 60; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.match.phase).toBe('kickoff');
    expect([w.ball.x, w.ball.y, w.ball.vx]).toEqual([320, BALL_REST_Y, 0]);
    expect(w.away.x).toBe(332);
  });

  it('reports kicks in the world events', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    stepWorld(w, { ...NO_INTENT, shootHeld: true }, NO_INTENT, STEP);
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.events.kicks.some(k => k.kicked === 'shot')).toBe(true);
    expect(w.ball.vx).toBeGreaterThan(100);
  });

  it('a ball contested from both sides squirts out to either side of them, not always to whoever resolves last', () => {
    const sides = new Set<number>();
    for (let seed = 1; seed <= 8; seed++) {
      const w = createWorld(BASE_STATS, BASE_STATS, seed, ERR);
      w.match.phase = 'playing';
      Object.assign(w.home, { x: 300, vx: 95 });
      Object.assign(w.away, { x: 316, vx: -95, facing: -1 });
      Object.assign(w.ball, { x: 308, y: BALL_REST_Y });
      for (let i = 0; i < 30; i++) stepWorld(w, move(1), move(-1), STEP);
      // Head-on along x, the sides are in depth.
      sides.add(Math.sign(w.ball.z - (w.home.z + w.away.z) / 2));
    }
    expect(sides).toEqual(new Set([-1, 1]));
  });

  it('players are solid: running head-on, neither passes through the other', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.ball, { x: 100 });
    Object.assign(w.home, { x: 300 });
    Object.assign(w.away, { x: 330 });
    for (let i = 0; i < 60; i++) stepWorld(w, move(1), move(-1), STEP);
    expect(w.away.x - w.home.x).toBeGreaterThanOrEqual(2 * PLAYER_R - 0.01);
  });

  it('players a little apart in depth go round each other', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.ball, { x: 100 });
    Object.assign(w.home, { x: 300, z: 30 });
    Object.assign(w.away, { x: 330, z: 34 });
    for (let i = 0; i < 60; i++) stepWorld(w, move(1), move(-1), STEP);
    expect(w.home.x).toBeGreaterThan(w.away.x + 40);
  });

  it('kickoff puts everyone on the centre line in depth', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    Object.assign(w.home, { z: 10 });
    Object.assign(w.away, { z: 50 });
    Object.assign(w.ball, { z: 5, vz: 40 });
    placeForKickoff(w);
    expect([w.ball.z, w.ball.vz, w.home.z, w.away.z, w.home.vz]).toEqual([32, 0, 32, 32, 0]);
  });

  it('a shot held through the kickoff needs a fresh press', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    const held = { ...NO_INTENT, shootHeld: true, chipHeld: true };
    while (w.match.phase === 'kickoff') stepWorld(w, held, held, STEP);
    stepWorld(w, held, held, STEP);
    expect([w.home.state, w.home.charge]).toEqual(['ground', 0]);
    expect(w.away.state).toBe('ground');
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    stepWorld(w, held, NO_INTENT, STEP);
    expect(w.home.state).toBe('charging');
  });

  it.each([604, 606, 608, 610, 612, 618, 624])('a ball resting on the net roof comes down past a player standing at x %i', x => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.home, { x });
    Object.assign(w.away, { x: 100 });
    Object.assign(w.ball, { x: 620, y: 33 });
    for (let i = 0; i < 5 * 60; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.ball.y).toBeLessThan(28);
  });

  it('two players under a roof ball do not pin it there', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 616 });
    Object.assign(w.away, { x: 622 });
    Object.assign(w.ball, { x: 619, y: 33 });
    for (let i = 0; i < 5 * 60; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.ball.y).toBe(BALL_REST_Y);
  });

  it('nobody can run into a goal', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    Object.assign(w.away, { z: 40 });
    for (let i = 0; i < 10 * 60; i++) stepWorld(w, move(1), move(-1), STEP);
    for (const p of [w.home, w.away]) for (const g of w.field.goals) expect(inGoalBox(g, p.x, p.z, PLAYER_R - 0.01)).toBe(false);
  });

  it('knows when the ball is at a player’s feet so B chips', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR);
    w.match.phase = 'playing';
    stepWorld(w, { ...NO_INTENT, chipHeld: true }, NO_INTENT, STEP);
    expect(w.home.state).toBe('chipping');
  });

  it('clearing a ball out of the corner beside your own goal is never an own goal', () => {
    for (const sprint of [false, true]) {
      const w = createWorld(BASE_STATS, BASE_STATS, 3, ERR);
      w.match.phase = 'playing';
      Object.assign(w.ball, { x: 9, y: BALL_REST_Y, z: 9, vx: 0, vy: 0, vz: 0 });
      Object.assign(w.home, { x: 19, z: 5 });
      Object.assign(w.away, { x: 320, z: 32 });
      for (let i = 0; i < 3 * 60; i++) {
        const [dx, dz] = [w.ball.x - w.home.x, w.ball.z - w.home.z];
        const d = Math.hypot(dx, dz) || 1;
        stepWorld(w, { ...NO_INTENT, moveX: dx / d, moveZ: dz / d, sprint }, NO_INTENT, STEP);
      }
      expect(w.match.score, `sprint ${sprint}`).toEqual({ home: 0, away: 0 });
    }
  });

  it('a body push beside the far side netting is never a goal', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 3, ERR);
    w.match.phase = 'playing';
    Object.assign(w.ball, { x: 629.73, y: 7.68, z: 49, vx: -59, vy: 129, vz: -3 });
    Object.assign(w.home, { x: 626.2, z: 51, vz: -19 });
    Object.assign(w.away, { x: 320, z: 32 });
    for (let i = 0; i < 60; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.match.score).toEqual({ home: 0, away: 0 });
  });

  it('every goal goes in through the mouth: bodies pushing balls about beside both goals', () => {
    const rng = seeded(77);
    for (let trial = 0; trial < 400; trial++) {
      const w = createWorld(BASE_STATS, BASE_STATS, trial, ERR);
      w.match.phase = 'playing';
      const g = w.field.goals[trial % 2]!;
      const toField = g.side === 'right' ? -1 : 1;
      const far = rng() < 0.5;
      const bx = g.lineX - toField * (2 + rng() * 20);
      const bz = far ? g.z1 + 2 + rng() * 14 : g.z0 - 2 - rng() * 14;
      Object.assign(w.ball, { x: bx, y: BALL_REST_Y + rng() * 12, z: bz, vx: (rng() - 0.5) * 200, vy: rng() * 150, vz: (rng() - 0.5) * 200 });
      Object.assign(w.home, { x: bx + toField * (6 + rng() * 20), z: far ? 60 - rng() * 6 : 4 + rng() * 6 });
      Object.assign(w.away, { x: 320, z: 32 });
      let mouth = false;
      for (let i = 0; i < 90 && w.match.phase === 'playing'; i++) {
        const before = { x: w.ball.x, z: w.ball.z };
        const [dx, dz] = [w.ball.x - w.home.x, w.ball.z - w.home.z];
        const d = Math.hypot(dx, dz) || 1;
        stepWorld(w, { ...NO_INTENT, moveX: dx / d, moveZ: dz / d, sprint: trial % 3 === 0 }, NO_INTENT, STEP);
        const b = w.ball;
        if ((before.x - g.lineX) * toField > 0 && (b.x - g.lineX) * toField <= 0) {
          const z = before.z + ((g.lineX - before.x) / (b.x - before.x)) * (b.z - before.z);
          if (z >= g.z0 && z <= g.z1) mouth = true;
        }
      }
      if (w.match.score.home + w.match.score.away > 0) expect(mouth, `trial ${trial}: a goal that never crossed the goal mouth`).toBe(true);
    }
  });
});

describe('world: the power-up', () => {
  const press: PlayerIntent = { ...NO_INTENT, powerHeld: true };
  const shoot: PlayerIntent = { ...NO_INTENT, shootHeld: true };
  const ticks = (s: number) => Math.round(s / STEP);

  /** Play on, a full meter, Harrison on his feet with the ball at his feet, facing Max's goal; Max far away. */
  function ready(): World {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR, { golden: false });
    w.match.phase = 'playing';
    w.power!.meter = 1;
    Object.assign(w.home, { x: 300, z: 32, facing: 1 });
    Object.assign(w.away, { x: 100, z: 10 });
    Object.assign(w.ball, { x: 308, y: BALL_REST_Y, z: 32, vx: 0, vy: 0, vz: 0 });
    return w;
  }

  /** Powered up, and the wave ready: Y pressed, then let go, then WAVE_READY_S. */
  function powered(): World {
    const w = ready();
    stepWorld(w, press, NO_INTENT, STEP);
    for (let i = 0; i < ticks(WAVE_READY_S) + 1; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    return w;
  }

  it('X while the wave readies does nothing; it is ready WAVE_READY_S after powering up, reported once', () => {
    const w = ready();
    stepWorld(w, press, NO_INTENT, STEP);
    for (let i = 0; i < ticks(0.3); i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    stepWorld(w, shoot, NO_INTENT, STEP);
    expect(w.events.power.fired).toBe(false);
    expect(w.home.state).toBe('ground');
    expect(w.power?.activeS).toBeGreaterThan(0);
    let readies = 0;
    for (let i = 0; i < ticks(1); i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      if (w.events.power.ready) readies++;
    }
    expect(readies).toBe(1);
    stepWorld(w, shoot, NO_INTENT, STEP);
    expect(w.events.power.fired).toBe(true);
  });

  it('without a kit, power is null and holding Y changes nothing', () => {
    const plain = createWorld(BASE_STATS, BASE_STATS, 7, ERR);
    const holding = createWorld(BASE_STATS, BASE_STATS, 7, ERR);
    expect(plain.power).toBeNull();
    const rng = seeded(3);
    for (let i = 0; i < 600; i++) {
      const i1: PlayerIntent = { ...NO_INTENT, moveX: rng() * 2 - 1, moveZ: rng() * 2 - 1, shootHeld: rng() < 0.3 };
      const i2: PlayerIntent = { ...NO_INTENT, moveX: rng() * 2 - 1 };
      stepWorld(plain, i1, i2, STEP);
      stepWorld(holding, { ...i1, powerHeld: true }, i2, STEP);
      expect(holding.events.power).toEqual({ started: false, ready: false, cancelled: false, fired: false, braced: false, blown: false });
    }
    expect([holding.home.x, holding.home.z, holding.ball.x, holding.ball.z]).toEqual([plain.home.x, plain.home.z, plain.ball.x, plain.ball.z]);
    expect(holding.match.score).toEqual(plain.match.score);
  });

  it('pressing Y with the ball powers him up at once, and he keeps running', () => {
    const w = ready();
    stepWorld(w, { ...press, moveX: 1 }, NO_INTENT, STEP);
    expect(w.events.power.started).toBe(true);
    expect(w.power?.activeS).toBeCloseTo(POWERED_S);
    const x = w.home.x;
    for (let i = 0; i < 30; i++) stepWorld(w, { ...NO_INTENT, moveX: 1 }, NO_INTENT, STEP);
    expect(w.home.x).toBeGreaterThan(x + 30);
    expect(w.power?.activeS).toBeGreaterThan(0);
    expect(w.power?.meter).toBe(1);
  });

  it('X while powered up fires the Energy Wave at once, turned to Max’s goal, and spends the meter', () => {
    const w = powered();
    Object.assign(w.home, { facing: -1 });
    w.ball.x = w.home.x - 8;
    stepWorld(w, shoot, NO_INTENT, STEP);
    expect(w.events.power).toMatchObject({ fired: true, cancelled: false });
    expect(w.home.facing).toBe(1);
    expect(w.power).toMatchObject({ meter: 0, activeS: 0 });
    expect(w.wave?.live).toBe(true);
    expect(w.ball.vx).toBeGreaterThan(500);
  });

  it('the power-up runs out after POWERED_S, keeping the meter', () => {
    const w = powered();
    let cancelled = 0;
    for (let i = 0; i < ticks(POWERED_S) + 2; i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      if (w.events.power.cancelled) cancelled++;
    }
    expect(cancelled).toBe(1);
    expect(w.power).toMatchObject({ meter: 1, activeS: 0 });
  });

  it('Max winning the ball ends it, keeping the meter', () => {
    const w = powered();
    Object.assign(w.away, { x: w.ball.x + 10, z: 32, facing: -1, state: 'sliding', stateT: 0, kick: { kind: 'slide', charge: 0, overchargeS: 0, aim: 'straight', active: true } });
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.events.kicks[1]!.tackledBall).toBe(true);
    expect(w.events.power.cancelled).toBe(true);
    expect(w.power).toMatchObject({ meter: 1, activeS: 0 });
  });

  it('any other move ends it: a chip', () => {
    const w = powered();
    stepWorld(w, { ...NO_INTENT, chipHeld: true }, NO_INTENT, STEP);
    expect(w.events.power.cancelled).toBe(true);
    expect(w.power?.activeS).toBe(0);
  });

  it('play stopping ends it, keeping the meter', () => {
    const w = powered();
    w.match.phase = 'fullTime';
    stepWorld(w, shoot, NO_INTENT, STEP);
    expect(w.events.power).toMatchObject({ cancelled: true, fired: false });
    expect(w.wave).toBeNull();
    expect(w.power).toMatchObject({ meter: 1, activeS: 0 });
  });

  it('a press held until the ball reaches him powers him up then', () => {
    const w = ready();
    w.ball.x = w.home.x + 60;
    for (let i = 0; i < 10; i++) stepWorld(w, press, NO_INTENT, STEP);
    expect(w.power?.activeS).toBe(0);
    w.ball.x = w.home.x + 8;
    stepWorld(w, press, NO_INTENT, STEP);
    expect(w.events.power.started).toBe(true);
  });

  it('Y still held after it runs out needs a fresh press', () => {
    const w = ready();
    for (let i = 0; i < ticks(POWERED_S) + 30; i++) stepWorld(w, press, NO_INTENT, STEP);
    expect(w.power?.activeS).toBe(0);
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    stepWorld(w, press, NO_INTENT, STEP);
    expect(w.events.power.started).toBe(true);
  });

  it.each([false, true])('while dribbling (sprint %s), a held power press starts within 0.1 s, whenever it comes', sprint => {
    const run: PlayerIntent = { ...NO_INTENT, moveX: 1, sprint };
    for (let k = 0; k < 60; k++) {
      const w = ready();
      Object.assign(w.home, { x: 120 });
      Object.assign(w.ball, { x: 128 });
      for (let i = 0; i < k; i++) stepWorld(w, run, NO_INTENT, STEP);
      let waited = 0;
      while ((w.power?.activeS ?? 0) === 0 && waited < 60) {
        stepWorld(w, { ...run, powerHeld: true }, NO_INTENT, STEP);
        waited++;
      }
      expect(waited, `pressed after ${k} ticks`).toBeLessThanOrEqual(6);
    }
  });

  it('a wave goal is a style goal: it credits the meter and clears the kick', () => {
    const w = powered();
    stepWorld(w, shoot, NO_INTENT, STEP);
    for (let i = 0; i < 30 && w.match.score.home === 0; i++) stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.match.score.home).toBe(1);
    expect(w.power?.meter).toBeGreaterThan(0);
    expect(w.power?.lastKind).toBeNull();
  });

  it('his dribble touches fill the meter', () => {
    const w = ready();
    w.power!.meter = 0;
    for (let i = 0; i < ticks(3); i++) stepWorld(w, move(1), NO_INTENT, STEP);
    expect(w.power?.meter).toBeGreaterThan(0);
  });
});

describe('world: handling', () => {
  /** Sam-like: soft brakes, a long touch, a weak shot, a long reach for his own ball. */
  const SOFT: Handling = { decel: 500, touchScale: 1.9, shotScale: 0.55, ballAhead: 48 };
  const FAST: Stats = { speed: 10, power: 1, jump: 3, control: 3, stamina: 1 };
  const TUNING: Stats = { speed: 5, power: 5, jump: 3, control: 5, stamina: 1 };
  /** Flat out: a sprint at the pace that makes 212 px/s at Speed 10. */
  const FLAT_OUT = 212 / (135 * 1.45);
  const run = (moveX: number, moveZ = 0): PlayerIntent => ({ ...NO_INTENT, moveX, moveZ, sprint: true, pace: FLAT_OUT });

  /** Snapshots taken from the code before handling existed: a normal player plays exactly as he did. */
  describe('normal handling plays exactly as before', () => {
    const world = () => {
      const w = createWorld(TUNING, maxStats(10), 7, { home: 0, away: 4 }, null, null, DIFFICULTY.normal);
      w.match.phase = 'playing';
      return w;
    };
    const snap = (w: World) => [w.home.x, w.home.z, w.home.vx, w.home.vz, w.away.x, w.away.z, w.away.vx, w.away.vz, w.ball.x, w.ball.y, w.ball.z, w.ball.vx, w.ball.vy, w.ball.vz];

    it('a sprint and a hard turn', () => {
      const w = world();
      Object.assign(w.home, { x: 100, z: 10 });
      Object.assign(w.away, { x: 450, z: 60 });
      for (let t = 0; t < 40; t++) stepWorld(w, NO_INTENT, { ...NO_INTENT, moveX: -1, sprint: true, pace: 1.05 }, STEP);
      for (let t = 0; t < 40; t++) stepWorld(w, NO_INTENT, { ...NO_INTENT, moveX: 1, moveZ: -1 }, STEP);
      expect(snap(w)).toEqual([100, 10, 0, 0, 379.6287988691378, 15.929956869217825, 76.60323462854264, -76.60323462854264, 320, 3, 32, 0, 0, 0]);
    });

    it('a dribble', () => {
      const w = world();
      Object.assign(w.home, { x: 100, z: 20 });
      Object.assign(w.away, { x: 300, z: 50, facing: 1 });
      Object.assign(w.ball, { x: 310, y: BALL_REST_Y, z: 50, vx: 0, vy: 0, vz: 0 });
      let touches = 0;
      for (let t = 0; t < 60; t++) {
        stepWorld(w, NO_INTENT, { ...NO_INTENT, moveX: 1, sprint: true }, STEP);
        touches += w.events.kicks[1]!.touched ? 1 : 0;
      }
      expect(touches).toBe(4);
      expect(snap(w)).toEqual([100, 20, 0, 0, 444.65277777777715, 50, 157.08333333333331, 0, 460.9531481481481, 3, 50, 198.6388888888888, 0, 0]);
    });

    it('a shot', () => {
      const w = world();
      let kicks = 0;
      for (let t = 0; t < 40; t++) {
        stepWorld(w, { ...NO_INTENT, shootHeld: t < 14 }, NO_INTENT, STEP);
        kicks += w.events.kicks[0]!.kicked ? 1 : 0;
      }
      expect(kicks).toBe(2);
      expect(snap(w)).toEqual([308, 32, 0, 0, 430, 56, 0, 0, 427.02427532795656, 3, 32, 224.9703836337584, 0, 0]);
    });
  });

  it("createWorld gives the away player the handling it's asked for, and Harrison his own", () => {
    const w = createWorld(TUNING, FAST, 1, ERR, null, null, DIFFICULTY.normal, SOFT);
    expect(w.away.handling).toEqual(SOFT);
    expect(w.home.handling).toEqual(NORMAL_HANDLING);
    expect(createWorld(TUNING, FAST, 1, ERR).away.handling).toEqual(NORMAL_HANDLING);
  });

  /** Sam in play, flat out at (x, z) with the ball at his feet, Harrison parked out of the way. */
  function samOnTheBall(x: number, z: number, facing: 1 | -1): World {
    const w = createWorld(TUNING, FAST, 1, ERR, null, null, DIFFICULTY.normal, SOFT);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: facing === 1 ? 60 : 580, z: 60 });
    Object.assign(w.away, { x, z, facing, vx: facing * 212, vz: 0 });
    Object.assign(w.ball, { x: x + facing * 10, y: BALL_REST_Y, z, vx: facing * 212, vy: 0, vz: 0 });
    return w;
  }

  it('the ball remembers who played it last, and a kickoff forgets', () => {
    const w = samOnTheBall(200, 32, 1);
    for (let t = 0; t < 5; t++) stepWorld(w, NO_INTENT, run(1), STEP);
    expect(w.ball.touchedBy).toBe('away');
    placeForKickoff(w);
    expect(w.ball.touchedBy).toBeUndefined();
  });

  it("his long touch runs 30 to 45 px ahead of him at its furthest, and it's his ball all the way", () => {
    const w = samOnTheBall(100, 32, 1);
    let furthest = 0;
    let touches = 0;
    for (let t = 0; t < 90; t++) {
      stepWorld(w, NO_INTENT, run(1), STEP);
      touches += w.events.kicks[1]!.touched ? 1 : 0;
      if (touches === 0) continue;
      furthest = Math.max(furthest, w.ball.x - w.away.x);
      expect(maxHasBall(w.away, w.ball), `tick ${t}, ball ${(w.ball.x - w.away.x).toFixed(1)} px ahead`).toBe(true);
    }
    expect(touches).toBeGreaterThanOrEqual(2);
    expect(furthest).toBeGreaterThanOrEqual(30);
    expect(furthest).toBeLessThanOrEqual(45);
  });

  const ballLegal = (w: World): boolean =>
    w.ball.x >= w.field.fenceL + BALL_R - 1e-9 &&
    w.ball.x <= w.field.fenceR - BALL_R + 1e-9 &&
    (goalScored(w.field, w.ball) !== null || !w.field.goals.some(g => inGoalBox(g, w.ball.x, w.ball.z, 0) && Math.abs(w.ball.x - g.lineX) > BALL_R));

  it.each([
    ['the near post', 540, 18],
    ['the far post', 540, 46],
    ['the end hedge', 560, 6],
  ] as const)('skidding flat out at %s, he and the ball stay out of the goal and inside the hedges', (_, x, z) => {
    const w = samOnTheBall(x, z, 1);
    const post = w.field.goals[1].lineX;
    let reversed = false;
    for (let t = 0; t < 120; t++) {
      reversed ||= w.away.x >= (z === 6 ? w.field.fenceR - PLAYER_R : post) - 20;
      stepWorld(w, NO_INTENT, run(reversed ? -1 : 1), STEP);
      for (const g of w.field.goals) expect(inGoalBox(g, w.away.x, w.away.z, PLAYER_R - 0.01), `tick ${t}`).toBe(false);
      expect(w.away.x, `tick ${t}`).toBeLessThanOrEqual(w.field.fenceR - PLAYER_R);
      expect(ballLegal(w), `tick ${t}: ball at (${w.ball.x.toFixed(1)}, ${w.ball.z.toFixed(1)})`).toBe(true);
    }
    expect(reversed).toBe(true);
  });

  it('running back at his own goal with the ball near it, his touches shield it: no own goal off his long touch', () => {
    // Sam attacks left, so his own goal is the right one; he chases a ball rolling toward it from behind.
    const w = createWorld(TUNING, FAST, 1, ERR, null, null, DIFFICULTY.normal, SOFT);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 100, z: 60 });
    Object.assign(w.away, { x: 480, z: 32, facing: 1, vx: 200 });
    Object.assign(w.ball, { x: 492, y: BALL_REST_Y, z: 32, vx: 120, vy: 0, vz: 0, touchedBy: 'home' });
    let touched = false;
    for (let t = 0; t < 120; t++) {
      stepWorld(w, NO_INTENT, run(1), STEP);
      touched ||= w.events.kicks[1]!.touched;
      expect(w.events.goal, `tick ${t}`).toBeNull();
    }
    expect(touched).toBe(true);
  });

  it('a kickoff while he skids puts him on his spot standing still, still on his own brakes', () => {
    const w = samOnTheBall(300, 32, 1);
    for (let t = 0; t < 6; t++) stepWorld(w, NO_INTENT, run(-1), STEP);
    expect(w.away.anim.name).toBe('skid');
    placeForKickoff(w);
    expect([w.away.vx, w.away.vz, w.away.state]).toEqual([0, 0, 'ground']);
    expect(w.away.handling).toEqual(SOFT);
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect([w.away.vx, w.away.vz]).toEqual([0, 0]);
  });
});

/** A scripted match against Max at rung 10 on Normal, with or without the tricks; where everything ended up. */
function scriptedEnd(seed: number, tricks: TrickSetup | null) {
  const profile = DIFFICULTY.normal;
  const w = createWorld(harrisonStats(10), maxStats(10), seed, { home: HUMAN_AIM_ERROR_DEG, away: profile.aimErrorDeg }, null, null, profile, NORMAL_HANDLING, tricks);
  const [brain, memo] = [createBrain(profile), scriptMemo(seed)];
  let t = 0;
  for (let i = 0; i < 60 * 400 && w.match.result === null; i++) {
    stepWorld(w, harrisonIntent(w, t, STEP, memo), think(brain, w, w.away, w.home, STEP), STEP);
    t += STEP;
  }
  return { score: { ...w.match.score }, ball: [w.ball.x, w.ball.y, w.ball.z], home: [w.home.x, w.home.z], away: [w.away.x, w.away.z] };
}

describe('the tricks in a match', () => {
  it('owning them changes nothing until he does a trick', () => {
    const tricks: TrickSetup = { profile: TRICK_DIFFICULTY.normal, scale: { stepover: 1, flick: 1 } };
    for (let seed = 100; seed < 108; seed++) expect(scriptedEnd(seed, tricks), `seed ${seed}`).toEqual(scriptedEnd(seed, null));
  });
});

describe('a fooled defender in the world', () => {
  const SETUP: TrickSetup = { profile: TRICK_DIFFICULTY.normal, scale: { stepover: 1, flick: 1 } };
  const staged = () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, ERR, null, null, DIFFICULTY.normal, NORMAL_HANDLING, SETUP);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 300, z: 32, facing: 1 });
    Object.assign(w.away, { x: 330, z: 32, facing: -1, fooled: { kind: 'confused', leftS: 0.7, totalS: 0.7, swayZ: 32 } });
    Object.assign(w.ball, { x: 200, y: BALL_REST_Y, z: 32, vx: 0, vy: 0, vz: 0 });
    return w;
  };

  it("still stops Harrison running through him", () => {
    const w = staged();
    for (let i = 0; i < 30; i++) stepWorld(w, move(1), NO_INTENT, STEP);
    expect(w.away.x - w.home.x).toBeGreaterThanOrEqual(2 * PLAYER_R - 1e-6);
  });

  it('the kickoff after a goal clears the trick, the cooldown, the fooled and the wise on both players (Review Focus 2)', () => {
    const w = staged();
    w.away.wiseS = 2;
    w.home.trick = { kind: 'stepover', t: 0.1, side: 1, sold: false, pace: 0.5, onBall: true };
    w.home.trickCooldownS = 0.5;
    placeForKickoff(w);
    for (const p of [w.home, w.away]) {
      expect([p.trick, p.trickCooldownS, p.fooled, p.wiseS]).toEqual([null, 0, null, 0]);
    }
  });
});

describe('a 50/50 with a fooled defender', () => {
  it("never squirts: a fooled defender can't contest the ball, so Harrison just plays it", () => {
    let squirts = 0;
    for (let k = 0; k < 20; k++) {
      const w = createWorld(BASE_STATS, BASE_STATS, k, ERR, null, null, DIFFICULTY.normal, NORMAL_HANDLING, { profile: TRICK_DIFFICULTY.normal, scale: { stepover: 1, flick: 1 } });
      w.match.phase = 'playing';
      Object.assign(w.home, { x: 300, z: 32, facing: 1 });
      Object.assign(w.away, { x: 310, z: 32, facing: -1, fooled: { kind: 'confused', leftS: 0.5, totalS: 0.7, swayZ: 32 } });
      Object.assign(w.ball, { x: 305, y: BALL_REST_Y, z: 32, vx: 0, vy: 0, vz: 0 });
      w.tick = k;
      stepWorld(w, move(1), NO_INTENT, STEP);
      if (w.ball.y > BALL_REST_Y + 1 || w.ball.vy > 0) squirts++;
    }
    expect(squirts).toBe(0);
  });
});

describe('stages', () => {
  it('a world on the School stage kicks off from its centre spot with a 120-second clock', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, null, null, DIFFICULTY.normal, NORMAL_HANDLING, null, SCHOOL_STAGE);
    expect(w.field).toBe(SCHOOL_FIELD);
    expect([w.ball.x, w.ball.z]).toEqual([640, 64]);
    expect([w.match.lengthS, w.match.goldenMaxS]).toEqual([120, 60]);
    expect(w.home.z).toBe(64);
  });
});
