import { describe, expect, it } from 'vitest';
import { seeded } from '../engine/random';
import { keepOutOfGoals, resolveBodies, separatePlayers } from './bodies';
import { BACKYARD, SCHOOL_FIELD, inGoalBox } from './field';
import { NO_INTENT, NORMAL_HANDLING, PLAYER_R, createPlayer, stepPlayer, type Player, type PlayerIntent } from './player';
import { BASE_STATS } from './stats';
import { createWorld, placeForKickoff } from './world';

const STEP = 1 / 60;
const ticks = (s: number) => Math.round(s / STEP);
const gap = (a: Player, b: Player) => Math.hypot(a.x - b.x, a.z - b.z);
const home = (x: number, z: number) => createPlayer('home', BASE_STATS, x, 1, z);
const away = (x: number, z: number) => createPlayer('away', BASE_STATS, x, -1, z);
const move = (moveX: number, moveZ: number): PlayerIntent => ({ ...NO_INTENT, moveX, moveZ });

/** Steps both players, then keeps them apart and out of the goals, as the world does each tick. */
function tick(a: Player, b: Player, ia: PlayerIntent, ib: PlayerIntent): void {
  stepPlayer(a, ia, STEP, BACKYARD, false);
  stepPlayer(b, ib, STEP, BACKYARD, false);
  resolveBodies(a, b, BACKYARD);
}

/** An intent that heads for (x, z) at full speed. */
function toward(p: Player, x: number, z: number): PlayerIntent {
  const [dx, dz] = [x - p.x, z - p.z];
  const d = Math.hypot(dx, dz) || 1;
  return move(dx / d, dz / d);
}

describe('separatePlayers', () => {
  it('pushes overlapping players apart along their centre line', () => {
    const a = home(300, 32);
    const b = away(306, 32);
    separatePlayers(a, b);
    expect(gap(a, b)).toBeCloseTo(2 * PLAYER_R);
    expect(a.z).toBe(32);
    expect(a.x).toBeLessThan(300);
    expect(b.x).toBeGreaterThan(306);
  });

  it('leaves players alone when they are apart', () => {
    const a = home(300, 32);
    const b = away(311, 32);
    separatePlayers(a, b);
    expect([a.x, b.x]).toEqual([300, 311]);
  });

  it('lets a jumper clear a grounded player', () => {
    const a = home(300, 32);
    const b = away(304, 32);
    a.y = 21;
    separatePlayers(a, b);
    expect([a.x, b.x]).toEqual([300, 304]);
  });

  it('separates players standing on the same spot', () => {
    const a = home(300, 32);
    const b = away(300, 32);
    separatePlayers(a, b);
    expect(gap(a, b)).toBeCloseTo(2 * PLAYER_R);
  });

  it('stops the runner\u2019s speed into the other player, keeping his speed along him', () => {
    const a = home(300, 32);
    const b = away(306, 32);
    [a.vx, a.vz] = [95, 20];
    separatePlayers(a, b);
    expect([a.vx, a.vz]).toEqual([0, 20]);
    expect([b.vx, b.vz]).toEqual([0, 0]);
  });

  it('a runner cannot push straight through a still player', () => {
    const a = home(300, 32);
    const b = away(320, 32);
    for (let i = 0; i < ticks(1); i++) tick(a, b, move(1, 0), NO_INTENT);
    expect(a.x).toBeLessThan(b.x - 2 * PLAYER_R + 0.5);
    expect(Math.abs(b.x - 320)).toBeLessThan(3);
  });

  it('a runner slightly off-line slides round', () => {
    const a = home(300, 32);
    const b = away(320, 35);
    for (let i = 0; i < ticks(1); i++) tick(a, b, move(1, 0), NO_INTENT);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it('two runners meeting at an angle slide off each other', () => {
    const a = home(300, 30);
    const b = away(340, 34);
    for (let i = 0; i < ticks(1); i++) tick(a, b, move(1, 0), move(-1, 0));
    expect(a.x).toBeGreaterThan(b.x);
  });
});

describe('keepOutOfGoals', () => {
  it('players are pushed out of the goal box', () => {
    for (const g of BACKYARD.goals) {
      for (const [x, z] of [
        [(g.lineX + g.backX) / 2, 32],
        [g.lineX, g.z0],
        [g.backX, g.z1],
        [g.lineX + (g.side === 'right' ? 1 : -1) * 15, 20],
      ] as const) {
        const p = home(x, z);
        keepOutOfGoals(p, BACKYARD);
        expect(inGoalBox(g, p.x, p.z, PLAYER_R - 0.01), `${g.side} from (${x}, ${z})`).toBe(false);
      }
    }
  });

  it('pushes out the shortest way that fits', () => {
    const p = home(608, 32);
    keepOutOfGoals(p, BACKYARD);
    expect([p.x, p.z]).toEqual([612 - PLAYER_R, 32]);
    const q = home(625, 15);
    keepOutOfGoals(q, BACKYARD);
    expect([q.x, q.z]).toEqual([625, 18 - PLAYER_R]);
  });

  it('never squeezes a player into the gap behind the net', () => {
    const p = home(630, 32);
    keepOutOfGoals(p, BACKYARD);
    expect(inGoalBox(BACKYARD.goals[1], p.x, p.z, PLAYER_R - 0.01)).toBe(false);
    expect(p.x).toBeLessThanOrEqual(BACKYARD.fenceR - PLAYER_R);
  });

  it('a player walking into the goal stays outside it', () => {
    const p = home(560, 32);
    for (let i = 0; i < ticks(2); i++) {
      stepPlayer(p, move(1, 0), STEP, BACKYARD, false);
      keepOutOfGoals(p, BACKYARD);
    }
    expect(p.x).toBeCloseTo(612 - PLAYER_R);
  });

  it('a player can walk round the goal behind the line', () => {
    const p = home(600, 8);
    for (let i = 0; i < ticks(1); i++) {
      stepPlayer(p, move(1, 0), STEP, BACKYARD, false);
      keepOutOfGoals(p, BACKYARD);
    }
    expect(p.x).toBeGreaterThan(625);
  });
});

describe('resolveBodies', () => {
  it('players never end a tick overlapping, whatever they do', () => {
    const rng = seeded(11);
    const intent = (): PlayerIntent => ({ ...move(Math.round(rng() * 2 - 1), Math.round(rng() * 2 - 1)), sprint: rng() < 0.3 });
    for (let trial = 0; trial < 20; trial++) {
      const x = 10 + rng() * 620;
      const z = 5 + rng() * 54;
      const a = home(x, z);
      const b = trial % 4 === 0 ? away(x, z) : away(10 + rng() * 620, 5 + rng() * 54);
      let [ia, ib] = [intent(), intent()];
      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) [ia, ib] = [intent(), intent()];
        tick(a, b, ia, ib);
        expect(gap(a, b), `trial ${trial} tick ${i}`).toBeGreaterThanOrEqual(2 * PLAYER_R - 0.01);
        for (const g of BACKYARD.goals) {
          expect(inGoalBox(g, a.x, a.z, PLAYER_R - 0.01)).toBe(false);
          expect(inGoalBox(g, b.x, b.z, PLAYER_R - 0.01)).toBe(false);
        }
      }
    }
  });

  it('nobody wedges against a fence, the boards or a goal', () => {
    const rng = seeded(5);
    const targets = [
      [BACKYARD.fenceL, 0],
      [BACKYARD.fenceR, 0],
      [BACKYARD.fenceL, BACKYARD.depth],
      [BACKYARD.fenceR, BACKYARD.depth],
      ...BACKYARD.goals.flatMap(g => [
        [(g.lineX + g.backX) / 2, (g.z0 + g.z1) / 2],
        [g.lineX, g.z0 - 4],
        [g.lineX, g.z1 + 4],
      ]),
    ] as const;
    for (const [tx, tz] of targets) {
      for (let trial = 0; trial < 4; trial++) {
        const start = () => [Math.min(Math.max(tx + (rng() * 2 - 1) * 60, 20), 620), 8 + rng() * 48] as const;
        const a = home(...start());
        const b = away(...start());
        for (let i = 0; i < ticks(3); i++) tick(a, b, { ...toward(a, tx, tz), sprint: true }, { ...toward(b, tx, tz), sprint: true });
        const [ax, az, bx, bz] = [a.x, a.z, b.x, b.z];
        for (let i = 0; i < ticks(1); i++) tick(a, b, toward(a, 320, 32), toward(b, 320, 32));
        expect(Math.hypot(a.x - ax, a.z - az), `home from (${tx}, ${tz})`).toBeGreaterThanOrEqual(20);
        expect(Math.hypot(b.x - bx, b.z - bz), `away from (${tx}, ${tz})`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('two players pinned in the pocket beside a goal still end up apart', () => {
    const a = home(BACKYARD.fenceR - PLAYER_R, PLAYER_R);
    const b = away(BACKYARD.fenceR - PLAYER_R, 18 - PLAYER_R);
    resolveBodies(a, b, BACKYARD);
    expect(gap(a, b)).toBeGreaterThanOrEqual(2 * PLAYER_R - 0.01);
    expect(inGoalBox(BACKYARD.goals[1], b.x, b.z, PLAYER_R - 0.01)).toBe(false);
    expect(a.z).toBeGreaterThanOrEqual(PLAYER_R);
  });
});

describe('the School Field', () => {
  it('a player walking up either end fence is stopped by the goal, never let through behind its net', () => {
    for (const g of SCHOOL_FIELD.goals) {
      const x = g.side === 'right' ? SCHOOL_FIELD.fenceR - PLAYER_R : SCHOOL_FIELD.fenceL + PLAYER_R;
      const p = home(x, PLAYER_R);
      for (let i = 0; i < ticks(4); i++) {
        stepPlayer(p, move(0, 1), STEP, SCHOOL_FIELD, false);
        keepOutOfGoals(p, SCHOOL_FIELD);
      }
      expect(p.z, g.side).toBeCloseTo(g.z0 - PLAYER_R);
    }
  });
});

describe('kickoff', () => {
  it('kickoff placement never overlaps', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 });
    for (const team of ['home', 'away'] as const) {
      w.match.kickoffTeam = team;
      placeForKickoff(w);
      expect(gap(w.home, w.away)).toBeGreaterThanOrEqual(2 * PLAYER_R);
    }
  });
});

describe('soft brakes: a runner who can\'t stop brushes past a body', () => {
  const SOFT = { ...NORMAL_HANDLING, decel: 500 };
  const FAST = { speed: 10, power: 1, jump: 3, control: 3, stamina: 1 };
  /** A runner flat out to the left at (x, z) with `handling`, and Harrison standing at (300, 32). */
  function charge(z: number, handling = SOFT) {
    const runner = Object.assign(createPlayer('away', FAST, 340, -1, z), { handling, vx: -212 });
    const stander = home(300, 32);
    const flat = { ...NO_INTENT, moveX: -1, sprint: true, pace: 212 / 195.75 };
    let minGap = Infinity;
    for (let i = 0; i < ticks(0.4); i++) {
      tick(runner, stander, flat, NO_INTENT);
      minGap = Math.min(minGap, gap(runner, stander));
    }
    return { runner, stander, minGap };
  }

  it.each([32, 36, 26])('flat out at a body dead ahead (at depth %d), he goes by its shoulder at full speed, never through it', z => {
    const { runner, stander, minGap } = charge(z);
    expect(runner.x).toBeLessThan(stander.x - 40);
    expect(-runner.vx).toBeGreaterThan(190);
    expect(minGap).toBeGreaterThanOrEqual(2 * PLAYER_R - 1e-6);
    expect([stander.x, stander.z]).toEqual([300, 32]);
  });

  it('dead on, he steps out to the roomier side', () => {
    const near = charge(32);
    expect(near.runner.z).not.toBe(32);
    const { runner } = (() => {
      const r = Object.assign(createPlayer('away', FAST, 340, -1, 12), { handling: SOFT, vx: -212 });
      const s = home(300, 12);
      for (let i = 0; i < ticks(0.4); i++) tick(r, s, { ...NO_INTENT, moveX: -1, sprint: true }, NO_INTENT);
      return { runner: r };
    })();
    expect(runner.z).toBeGreaterThan(12);
  });

  it.each([
    ['chasing back behind Harrison, both into the mouth', 609, 30, 601, 31, 200, 0],
    ['coming across the mouth in depth', 609, 30, 608, 22, 0, 200],
  ] as const)("brushing past Harrison as he steps into a goal mouth never leaves him inside the goal (Sam %s)", (_, hx, hz, sx, sz, svx, svz) => {
    const goal = BACKYARD.goals[1];
    const harrison = Object.assign(createPlayer('home', BASE_STATS, hx, 1, hz), { vx: 170 });
    const runner = Object.assign(createPlayer('away', FAST, sx, -1, sz), { handling: SOFT, vx: svx, vz: svz });
    resolveBodies(harrison, runner, BACKYARD);
    for (const p of [harrison, runner]) expect(inGoalBox(goal, p.x, p.z, PLAYER_R - 0.01), `${p.team} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).toBe(false);
    expect(gap(harrison, runner)).toBeGreaterThanOrEqual(2 * PLAYER_R - 1e-6);
  });

  it('with normal brakes the body stops him, as always', () => {
    const { runner, stander } = charge(32, NORMAL_HANDLING);
    expect(runner.x).toBeGreaterThan(stander.x);
  });

  it('slow on soft brakes, a body still stops him', () => {
    const runner = Object.assign(createPlayer('away', BASE_STATS, 312, -1, 32), { handling: SOFT });
    const stander = home(300, 32);
    for (let i = 0; i < ticks(0.5); i++) tick(runner, stander, { ...NO_INTENT, moveX: -0.3 }, NO_INTENT);
    expect(runner.x).toBeGreaterThan(stander.x);
  });

  it('pinned against the near board, he can\'t brush past on the board side and goes by the other, or stops', () => {
    const runner = Object.assign(createPlayer('away', FAST, 340, -1, PLAYER_R), { handling: SOFT, vx: -212 });
    const stander = home(300, PLAYER_R + 4);
    for (let i = 0; i < ticks(0.4); i++) {
      tick(runner, stander, { ...NO_INTENT, moveX: -1, sprint: true }, NO_INTENT);
      expect(gap(runner, stander)).toBeGreaterThanOrEqual(2 * PLAYER_R - 1e-6);
      expect(runner.z).toBeGreaterThanOrEqual(PLAYER_R);
    }
  });
});
