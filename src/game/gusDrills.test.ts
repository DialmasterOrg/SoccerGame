import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from './ai';
import { gusLineup } from './gus';
import { GUS_SEEDS } from './gusScripts';
import { KEEPER_TOP_LEVEL } from './keeper';
import { LOW_Y } from './keeperSaves';
import { drill, goalRate, oneOnOneMove, type Drill } from './keeperScripts';

/** Each drill's goal rate against Gus, measured once and shared. */
const rates = new Map<string, number>();
const rate = (kind: Drill, d: Difficulty, seeds: readonly number[] = GUS_SEEDS): number => {
  const key = `${kind}/${d}/${seeds.length}`;
  if (!rates.has(key)) rates.set(key, goalRate(kind, KEEPER_TOP_LEVEL, d, seeds, 'away', gusLineup(d)));
  return rates.get(key)!;
};
/** The one-on-one's seeds whose move is the stepover: what the spec says beats his rush (he catches a chip, and smothers a dribble round him). */
const STEPOVER_SEEDS = GUS_SEEDS.filter(s => oneOnOneMove(s) === 'stepover');

describe("Goalie Gus's drills: high saved, low beaten", () => {
  it("the high drill's shots are high: most reach him above LOW_Y", () => {
    const high = GUS_SEEDS.filter(seed => {
      let y = -1;
      drill('high', KEEPER_TOP_LEVEL, 'normal', seed, 'away', w => {
        if (y < 0 && w.ball.x >= w.keepers!.away.body.x - 8) y = w.ball.y;
      }, gusLineup('normal'));
      return y >= LOW_Y;
    }).length;
    expect(high).toBeGreaterThanOrEqual((2 * GUS_SEEDS.length) / 3);
  });

  it('a hard, high shot from range rarely beats him on Normal', () => {
    expect(rate('high', 'normal')).toBeLessThanOrEqual(0.2);
  });

  it('a low shot for the corner beats him far more often than a high one', () => {
    expect(rate('lowCorner', 'normal')).toBeGreaterThanOrEqual(0.4);
    expect(rate('lowCorner', 'normal') - rate('high', 'normal')).toBeGreaterThanOrEqual(0.3);
  });

  it('Easy lets in at least as many as Normal, and Normal as Hard', () => {
    for (const kind of ['high', 'lowCorner'] as const) {
      const [e, n, h] = DIFFICULTIES.map(d => rate(kind, d));
      expect([e! >= n!, n! >= h!], kind).toEqual([true, true]);
    }
  });

  it("he's no wall: low corners still beat him on Hard, and a patient one-on-one that steps over him beats him on Normal", () => {
    expect(STEPOVER_SEEDS.length).toBeGreaterThanOrEqual(GUS_SEEDS.length / 4);
    expect(rate('lowCorner', 'hard')).toBeGreaterThanOrEqual(0.15);
    expect(rate('oneOnOne', 'normal', STEPOVER_SEEDS)).toBeGreaterThanOrEqual(0.5);
  });

  it('no soft goals: no slow roller ever goes in', () => {
    for (const d of DIFFICULTIES) expect(rate('roller', d), d).toBe(0);
  });
});
