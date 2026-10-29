import { expect } from 'vitest';
import { describeTryout, mean } from './tryoutTuning';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// The script's steal breaks up most of her fakes in the lean, as in the Park, so the shot is measured on the fakes she finishes near goal.
describeTryout('tia', {
  name: 'her fakes end in shots',
  check(kid, max) {
    expect(mean(kid.map(t => t.fakes))).toBeGreaterThanOrEqual(2);
    expect(mean(max.map(t => t.fakes))).toBe(0);
    const finished = sum(kid.map(t => t.fakesFinished));
    expect(finished).toBeGreaterThan(0);
    expect(sum(kid.map(t => t.fakesToShot))).toBeGreaterThanOrEqual(finished / 2);
  },
});
