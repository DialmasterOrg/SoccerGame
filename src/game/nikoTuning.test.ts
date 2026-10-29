import { expect } from 'vitest';
import { DIFFICULTIES } from './ai';
import { describeTryout } from './tryoutTuning';

/**
 * The scripted Harrison is Max's brain plus steal taps, and never stands
 * still in Niko's lane facing him, so in scripted play the nutmeg is rare
 * (measured 1, 1 and 8 over the 64 Easy, Normal and Hard matches). The
 * personality is pinned on a staged Harrison in niko.test.ts; here, that he
 * does nutmeg in whole matches, that Max's brain never does, and that every
 * one of his was fair: Harrison square and still, as the world rule says.
 */
const NUTMEGS_ALL = 3;

describeTryout('niko', {
  name: 'nutmegs where Max never does, and only ever a still, square Harrison',
  check(kid, max, all) {
    const every = DIFFICULTIES.flatMap(d => all[d]);
    expect(every.reduce((a, t) => a + t.nutmegs, 0)).toBeGreaterThanOrEqual(NUTMEGS_ALL);
    expect(max.reduce((a, t) => a + t.nutmegs, 0)).toBe(0);
    for (const t of every) expect(t.unfairNutmegs).toBe(0);
  },
});
