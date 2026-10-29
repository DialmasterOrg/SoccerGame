import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from './ai';
import { KEEPER_TOP_LEVEL } from './keeper';
import { goalRate, keeperMatch } from './keeperScripts';

const SEEDS = [...Array(64)].map((_, i) => 100 + i);
const FEW = SEEDS.slice(0, 32);

describe("keepers on Normal, against the venue's first keeper", () => {
  // Softened after the parent's first playtest (2026-10-29): a 0-0 with every shot saved felt too hard to score on.
  it('save about half of long shots from outside the box', () => {
    const saved = 1 - goalRate('long', 1, 'normal', SEEDS);
    expect(saved).toBeGreaterThanOrEqual(0.45);
    expect(saved).toBeLessThanOrEqual(0.7);
  });

  it('let in about two in three well-placed shots into a corner from inside the box', () => {
    expect(goalRate('corner', 1, 'normal', SEEDS)).toBeGreaterThanOrEqual(0.55);
    expect(goalRate('corner', 1, 'normal', SEEDS)).toBeLessThanOrEqual(0.8);
  });

  it('are beaten nearly every time by a patient one-on-one', () => {
    expect(goalRate('oneOnOne', 1, 'normal', SEEDS)).toBeGreaterThanOrEqual(0.8);
  });
});

describe("keepers on Easy, against the venue's first keeper", () => {
  it('let in nearly half of long shots and three in four corner shots', () => {
    expect(goalRate('long', 1, 'easy', SEEDS)).toBeGreaterThanOrEqual(0.4);
    expect(goalRate('corner', 1, 'easy', SEEDS)).toBeGreaterThanOrEqual(0.7);
  });
});

describe('difficulty and the venue', () => {
  it('Easy lets in more than Normal, and Normal more than Hard', () => {
    for (const kind of ['long', 'corner'] as const) for (const level of [1, KEEPER_TOP_LEVEL]) {
      const [e, n, h] = DIFFICULTIES.map(d => goalRate(kind, level, d, SEEDS));
      expect(e, `${kind} ${level}`).toBeGreaterThanOrEqual(n!);
      expect(n, `${kind} ${level}`).toBeGreaterThanOrEqual(h!);
    }
  });

  it('each keeper through the School Field is sharper than the first', () => {
    for (const d of DIFFICULTIES) expect(goalRate('long', KEEPER_TOP_LEVEL, d, SEEDS), d).toBeLessThanOrEqual(goalRate('long', 1, d, SEEDS));
  });
});

describe('no wall, no soft goals', () => {
  it('every keeper can be beaten by a normal shot: no trick, no power move', () => {
    for (const d of DIFFICULTIES) for (let l = 1; l <= KEEPER_TOP_LEVEL; l++) expect(goalRate('corner', l, d, FEW), `${d} ${l}`).toBeGreaterThanOrEqual(0.15);
  });

  it("every keeper, Harrison's above all, stops a slow ball rolled straight at him", () => {
    for (const side of ['home', 'away'] as const) for (const d of DIFFICULTIES) for (let l = 1; l <= KEEPER_TOP_LEVEL; l++)
      expect(goalRate('roller', l, d, FEW, side), `${side} ${d} ${l}`).toBe(0);
  });
});

describe('School Field matches with keepers', () => {
  it('end with a few goals a side, not ten, and nothing stuck', () => {
    const ms = FEW.map(s => keeperMatch(s, 'normal'));
    const goals = ms.flatMap(m => [m.score.home, m.score.away]);
    expect(goals.reduce((a, b) => a + b) / goals.length).toBeLessThanOrEqual(4);
    expect(Math.max(...goals)).toBeLessThanOrEqual(7);
    expect(ms.some(m => m.score.home > 0) && ms.some(m => m.score.away > 0)).toBe(true);
    for (const m of ms) {
      expect(m.result).not.toBeNull();
      expect(m.longestStillS).toBeLessThanOrEqual(4);
    }
  });
});
