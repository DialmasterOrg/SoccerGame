import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from './ai';
import { GUS_SEEDS, gusMatch, type GusMatch, type GusScript } from './gusScripts';
import { mean } from './tryoutTuning';

const SCRIPTS: readonly GusScript[] = ['blaster', 'worker'];
/** Each match is played once and shared between the tests that read it. */
const played = new Map<string, GusMatch>();
const play = (d: Difficulty, seed: number, who: GusScript): GusMatch => {
  const key = `${d}/${who}/${seed}`;
  if (!played.has(key)) played.set(key, gusMatch(d, seed, who));
  return played.get(key)!;
};
const matches = (d: Difficulty, who: GusScript) => GUS_SEEDS.map(s => play(d, s, who));
const wins = (d: Difficulty, who: GusScript) => matches(d, who).filter(m => m.result === 'win').length / GUS_SEEDS.length;
const sum = (ms: readonly GusMatch[], f: (m: GusMatch) => number) => ms.reduce((n, m) => n + f(m), 0);

describe("Goalie Gus stays tuned to his lesson: keep it low, make him dive", () => {
  it('a blaster loses nearly every match on Normal', () => {
    expect(wins('normal', 'blaster')).toBeLessThanOrEqual(0.15);
  });

  it('a worker wins about half on Normal', () => {
    const r = wins('normal', 'worker');
    expect(r).toBeGreaterThanOrEqual(0.4);
    expect(r).toBeLessThanOrEqual(0.65);
  });

  it('a worker wins about 0.8 on Easy', () => {
    const r = wins('easy', 'worker');
    expect(r).toBeGreaterThanOrEqual(0.65);
    expect(r).toBeLessThanOrEqual(0.95);
  });

  it('a worker wins about 0.3 on Hard', () => {
    const r = wins('hard', 'worker');
    expect(r).toBeGreaterThanOrEqual(0.15);
    expect(r).toBeLessThanOrEqual(0.45);
  });

  it('the worker beats the blaster by at least 0.3 on every difficulty', () => {
    for (const d of DIFFICULTIES) expect(wins(d, 'worker') - wins(d, 'blaster'), d).toBeGreaterThanOrEqual(0.3);
  });

  it('every match ends with a result, the ball never sits still for long, nobody strays into a goal, and no goal comes from his drop kick', () => {
    for (const d of DIFFICULTIES)
      for (const who of SCRIPTS)
        for (const m of matches(d, who)) {
          expect(m.result, `${d} ${who}`).not.toBeNull();
          expect(m.longestStillS, `${d} ${who}: the ball sat still`).toBeLessThanOrEqual(4);
          expect(m.traits.strayTicks, `${d} ${who}`).toBe(0);
          expect(m.traits.puntGoals, `${d} ${who}`).toBe(0);
        }
  });

  it("on Normal the worker's goals are mostly low, and some come from following up his pushes", () => {
    const ms = matches('normal', 'worker');
    const goals = sum(ms, m => m.traits.goals);
    expect(sum(ms, m => m.traits.lowGoals)).toBeGreaterThanOrEqual(0.6 * goals);
    expect(sum(ms, m => m.traits.reboundGoals)).toBeGreaterThanOrEqual(3);
  });

  it('on Normal the worker has the ball most of the time, and the partner scores little', () => {
    const ms = matches('normal', 'worker');
    expect(mean(ms.map(m => m.traits.possession))).toBeGreaterThanOrEqual(0.6);
    expect(mean(ms.map(m => m.traits.partnerGoals))).toBeLessThanOrEqual(1);
  });
});
