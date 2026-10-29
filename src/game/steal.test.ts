import { describe, expect, it } from 'vitest';
import { BALL_R } from '../art/ball';
import { DIFFICULTY, createBrain, think, type AiProfile } from './ai';
import { BALL_REST_Y } from './ball';
import { DOG_DIFFICULTY, JINK_S, TUNING_STATS } from './dog';
import { SIDE_CLEAR } from './contact';
import { NO_INTENT, NORMAL_HANDLING, createPlayer, stepPlayer, type Player } from './player';
import { BACKYARD } from './field';
import { NEAR_MISS, STEAL_COOLDOWN_S, STEAL_ROUND_MAX, STUMBLE_S, maxHasBall, resolveSteal } from './steal';
import { BASE_STATS } from './stats';
import { createWorld, stepWorld, type World } from './world';
import { keeperWorld, runFor, runUntil, shotAt } from './testKeepers';
import { ballAtFeet, ballInBody } from './zones';

const STEP = 1 / 60;
const TAP = { ...NO_INTENT, steal: true };

/**
 * A world in play on the pitch's middle line in depth: Max at `max` with the ball at `ball`,
 * Harrison at `home`. Both run at `vx` (facing that way, left when still),
 * unless `homeVx` says otherwise.
 */
function stage(o: { max: number; ball: number; home: number; vx: number; profile: AiProfile; seed: number; homeVx?: number }): World {
  const w = createWorld(BASE_STATS, BASE_STATS, o.seed, { home: 0, away: 0 }, null, null, o.profile);
  w.match.phase = 'playing';
  const homeVx = o.homeVx ?? o.vx;
  const z = w.field.depth / 2;
  Object.assign(w.away, { x: o.max, z, vx: o.vx, facing: o.vx > 0 ? 1 : -1 });
  Object.assign(w.home, { x: o.home, z, vx: homeVx, facing: homeVx > 0 ? 1 : -1 });
  Object.assign(w.ball, { x: o.ball, y: BALL_REST_Y, z, vx: o.vx, vy: 0, vz: 0 });
  return w;
}

/** Harrison catching Max from behind, both running at his own goal: Max with the ball 8 px ahead, Harrison's body against Max's. */
const fromBehind = (profile: AiProfile, seed: number) => stage({ max: 300, ball: 292, home: 310, vx: -150, profile, seed });

describe('the steal button', () => {
  it('a steal tap with Max dribbling in reach takes the ball cleanly on Easy', () => {
    const w = fromBehind(DIFFICULTY.easy, 3);
    expect(resolveSteal(w, TAP)).toBe('stole');
    expect(ballAtFeet(w.home, w.ball)).toBe(true);
    expect(ballInBody(w.away, w.ball, BALL_R)).toBe(false);
    expect(Math.abs(w.ball.vx)).toBeLessThanOrEqual(Math.abs(w.home.vx) + 1);
  });

  it('on Easy it takes it cleanly about nine times in ten', () => {
    let clean = 0;
    for (let seed = 1; seed <= 400; seed++) if (resolveSteal(fromBehind(DIFFICULTY.easy, seed), TAP) === 'stole') clean++;
    expect(clean / 400).toBeGreaterThan(0.85);
    expect(clean / 400).toBeLessThan(0.95);
  });

  it("pokes it loose about as often as Hard's odds say", () => {
    let poked = 0;
    for (let seed = 1; seed <= 400; seed++) if (resolveSteal(fromBehind(DIFFICULTY.hard, seed), TAP) === 'poked') poked++;
    expect(poked / 400).toBeGreaterThan(0.33);
    expect(poked / 400).toBeLessThan(0.5);
  });

  it('a poke squirts the ball on along his run, faster than he runs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = fromBehind(DIFFICULTY.hard, seed);
      if (resolveSteal(w, TAP) !== 'poked') continue;
      expect(w.ball.vx).toBeLessThan(w.home.vx);
      return;
    }
    throw new Error('no poke in 40 seeds');
  });

  it("from right behind a dribbling Max, the steal reaches round him to his ball", () => {
    // Body to body, the dribbled ball 15 px ahead of Max: 25 px ahead of Harrison.
    for (let seed = 1; seed <= 20; seed++) {
      const w = stage({ max: 300, ball: 285, home: 310, vx: -150, profile: DIFFICULTY.easy, seed });
      expect(['stole', 'poked'], `seed ${seed}`).toContain(resolveSteal(w, TAP));
    }
  });

  it('a loose ball, or Max coming head on, is only reached as close as before', () => {
    const loose = stage({ max: 500, ball: 284, home: 310, vx: -150, profile: DIFFICULTY.easy, seed: 1 });
    loose.away.facing = 1;
    expect(resolveSteal(loose, TAP)).toBe('whiff');
    const headOn = stage({ max: 300, ball: 286, home: 260, vx: -150, profile: DIFFICULTY.easy, seed: 1, homeVx: 1 });
    expect(resolveSteal(headOn, TAP)).not.toBe('stole');
  });

  it("a tap with Max's ball just out of reach is a near miss: no stumble, but a wait", () => {
    // A step behind Max, his dribbled ball 15 px ahead of him: a little beyond the reach round him.
    const w = stage({ max: 300, ball: 285, home: 285 + STEAL_ROUND_MAX + NEAR_MISS / 2, vx: -150, profile: DIFFICULTY.easy, seed: 1 });
    expect(resolveSteal(w, TAP)).toBe('missed');
    expect([w.home.stumbleS, w.home.stealCooldownS]).toEqual([0, STEAL_COOLDOWN_S]);
  });

  it('a tap with nothing in reach is a whiff: a stumble and a wait', () => {
    const w = stage({ max: 300, ball: 240, home: 310, vx: -150, profile: DIFFICULTY.easy, seed: 1 });
    expect(resolveSteal(w, TAP)).toBe('whiff');
    expect(w.home.stumbleS).toBe(STUMBLE_S);
    expect(w.home.stealCooldownS).toBe(STEAL_COOLDOWN_S);
    w.home.stumbleS = 0;
    expect(resolveSteal(w, TAP)).toBeNull();
  });

  it('a tap on a loose ball in reach traps it, always', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const w = stage({ max: 400, ball: 312, home: 320, vx: 80, profile: DIFFICULTY.hard, seed, homeVx: 80 });
      Object.assign(w.home, { x: 304 });
      w.away.facing = -1;
      expect(resolveSteal(w, TAP), `seed ${seed}`).toBe('trapped');
      expect(ballAtFeet(w.home, w.ball)).toBe(true);
    }
  });

  it('a tap does nothing while charging, in the air, sliding, fallen, powered up or outside play', () => {
    const cases: ((w: World) => void)[] = [
      w => (w.home.state = 'charging'),
      w => Object.assign(w.home, { state: 'air', y: 10 }),
      w => (w.home.state = 'sliding'),
      w => (w.home.state = 'fallen'),
      w => (w.match.phase = 'kickoff'),
    ];
    for (const set of cases) {
      const w = fromBehind(DIFFICULTY.easy, 3);
      set(w);
      expect(resolveSteal(w, TAP)).toBeNull();
      expect([w.home.stumbleS, w.home.stealCooldownS]).toEqual([0, 0]);
    }
    const powered = createWorld(BASE_STATS, BASE_STATS, 3, { home: 0, away: 0 }, { golden: false }, null, DIFFICULTY.easy);
    Object.assign(powered, { match: fromBehind(DIFFICULTY.easy, 3).match });
    Object.assign(powered.away, { x: 300, vx: -150 });
    Object.assign(powered.home, { x: 310, vx: -150, facing: -1 });
    Object.assign(powered.ball, { x: 292, vx: -150 });
    powered.power!.activeS = 1;
    expect(resolveSteal(powered, TAP)).toBeNull();
    expect([powered.home.stumbleS, powered.home.stealCooldownS]).toEqual([0, 0]);
  });

  it('a clean steal of a ball squeezed between both bodies ends at his feet after the whole tick', () => {
    // Head on: Max dribbling at Harrison, the ball between their bodies.
    const w = stage({ max: 300, ball: 295, home: 290, vx: -150, profile: DIFFICULTY.easy, seed: 3, homeVx: 1 });
    w.home.vx = 0;
    expect(() => stepWorld(w, TAP, NO_INTENT, STEP)).not.toThrow();
    expect(w.events.steal).toBe('stole');
    expect(ballAtFeet(w.home, w.ball)).toBe(true);
  });

  it('a clean steal at a run, the ball clear of Max, leaves it at his feet and no faster than him after the tick', () => {
    // Harrison running at his own goal catches the ball 16 px ahead of Max, alongside him rather than behind.
    const w = stage({ max: 300, ball: 284, home: 286, vx: -150, profile: DIFFICULTY.easy, seed: 3 });
    w.home.z = 38;
    stepWorld(w, { ...TAP, moveX: -1 }, NO_INTENT, STEP);
    expect(w.events.steal).toBe('stole');
    expect(w.events.kicks[0]!.touched, 'his own touch knocks it on').toBe(false);
    expect(ballAtFeet(w.home, w.ball)).toBe(true);
    expect(Math.abs(w.ball.vx)).toBeLessThanOrEqual(Math.abs(w.home.vx) + 1);
  });

  it('near his own goal a clean steal stops the ball dead at his feet, and a poke squirts out to the side', () => {
    const clean = stage({ max: 120, ball: 112, home: 130, vx: -150, profile: DIFFICULTY.easy, seed: 3 });
    expect(resolveSteal(clean, TAP)).toBe('stole');
    expect([clean.ball.vx, clean.ball.vz, clean.home.vx]).toEqual([0, 0, 0]);
    expect(ballAtFeet(clean.home, clean.ball)).toBe(true);
    const poked = stage({ max: 120, ball: 112, home: 130, vx: -150, profile: { ...DIFFICULTY.hard, cleanSteal: 0 }, seed: 3 });
    expect(resolveSteal(poked, TAP)).toBe('poked');
    expect(poked.ball.vx).toBe(SIDE_CLEAR.vx);
    expect(Math.abs(poked.ball.vz)).toBe(SIDE_CLEAR.vz);
  });

  it("a head-on clean steal sticks through Max's wrong-footed beat", () => {
    // Max dribbling at a Harrison standing his ground.
    const w = stage({ max: 300, ball: 292, home: 280, vx: -150, profile: DIFFICULTY.easy, seed: 3, homeVx: 1 });
    w.home.vx = 0;
    const brain = createBrain(DIFFICULTY.easy);
    const maxPlayed = () => w.events.kicks[1]!.touched || w.events.kicks[1]!.kicked !== null || w.events.kicks[1]!.tackledBall;
    stepWorld(w, TAP, think(brain, w, w.away, w.home, STEP), STEP);
    expect(w.events.steal).toBe('stole');
    expect(maxPlayed(), 'Max plays it on the steal tick').toBe(false);
    for (let t = 0; t < DIFFICULTY.easy.wrongFootedS; t += STEP) {
      stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      expect(maxPlayed(), `Max plays it at ${t.toFixed(3)} s`).toBe(false);
      expect(ballAtFeet(w.home, w.ball), `at ${t.toFixed(3)} s`).toBe(true);
    }
  });

  it("a robbed Max loses the shot he was winding up", () => {
    const w = fromBehind(DIFFICULTY.easy, 3);
    Object.assign(w.away, { state: 'charging', charge: 0.5 });
    expect(resolveSteal(w, TAP)).toBe('stole');
    expect([w.away.state, w.away.charge]).toEqual(['ground', 0]);
  });

  it('against Biscuit a steal tap in his jink knocks the ball out, and outside it does nothing, with no stumble', () => {
    for (const jinking of [true, false]) {
      const w = createWorld({ ...TUNING_STATS }, BASE_STATS, 7, { home: 4, away: 0 }, null, DOG_DIFFICULTY.normal);
      w.match.phase = 'playing';
      Object.assign(w.away, { x: 300, facing: -1 });
      Object.assign(w.home, { x: 272, facing: 1 });
      Object.assign(w.ball, { x: 298, y: BALL_REST_Y, vx: 0, vy: 0, vz: 0 });
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      expect(w.dog!.carrying).toBe(true);
      if (jinking) w.dog!.jinkS = JINK_S;
      stepWorld(w, TAP, NO_INTENT, STEP);
      expect(w.events.dog.dropped, `jinking ${jinking}`).toBe(jinking);
      expect(w.dog!.carrying).toBe(!jinking);
      expect([w.home.stumbleS, w.home.stealCooldownS]).toEqual([0, 0]);
    }
  });

  it('while stumbling he can neither move nor act', () => {
    const p: Player = createPlayer('home', BASE_STATS, 300, 1);
    p.vx = 100;
    p.stumbleS = STUMBLE_S;
    stepPlayer(p, { ...NO_INTENT, moveX: 1, shootHeld: true, jump: true }, STEP, BACKYARD, true);
    expect(p.state).toBe('ground');
    expect(p.vx).toBeLessThan(100);
  });
});

describe('maxHasBall and how far ahead his ball runs', () => {
  const LONG = { ...NORMAL_HANDLING, ballAhead: 48 };
  const runner = (handling = NORMAL_HANDLING) => Object.assign(createPlayer('away', BASE_STATS, 300, 1), { handling });
  const ballAt = (ahead: number, touchedBy?: 'home' | 'away') => ({ x: 300 + ahead, y: BALL_REST_Y, z: BACKYARD.depth / 2, vx: 0, vy: 0, vz: 0, spin: 0, spinAngle: 0, touchedBy });

  it('a ball he knocked 40 px on is still his with a long reach, and not with a normal one', () => {
    expect(maxHasBall(runner(LONG), ballAt(40, 'away'))).toBe(true);
    expect(maxHasBall(runner(), ballAt(40, 'away'))).toBe(false);
    expect(maxHasBall(runner(LONG), ballAt(50, 'away'))).toBe(false);
  });

  it("past the normal reach, a ball Harrison played last is never his: it's Harrison's at his feet", () => {
    expect(maxHasBall(runner(LONG), ballAt(40, 'home'))).toBe(false);
    expect(maxHasBall(runner(LONG), ballAt(40))).toBe(false);
    expect(maxHasBall(runner(LONG), ballAt(12, 'home'))).toBe(true);
  });
});

describe('against a keeper holding the ball', () => {
  it("Harrison's steal and slide do nothing to a keeper holding the ball", () => {
    const w = keeperWorld();
    runFor(w, 1);
    shotAt(w, { x: 1180, z: 64 }, 64, 200);
    runUntil(w, 1, w => w.events.keeper.caught === 'away');
    const k = w.keepers!.away;
    Object.assign(w.home, { x: k.body.x - 12, z: k.body.z, facing: 1 });
    runFor(w, 1 / 60, { ...NO_INTENT, steal: true });
    expect([w.events.steal, k.holding]).toEqual([null, true]);
    runFor(w, 0.5, { ...NO_INTENT, chipHeld: true });
    expect([k.body.state, k.holding]).toEqual(['ground', true]);
  });
});
