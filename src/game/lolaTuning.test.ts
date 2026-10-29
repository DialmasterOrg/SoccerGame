import { expect } from 'vitest';
import { describeTryout, mean } from './tryoutTuning';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// Max's brain chips now and then too: a slide pressed with the ball at his feet is a chip. So Lola is measured by how many more she chips, and scores.
describeTryout('lola', {
  name: 'chips more, and scores from chips',
  check(kid, max) {
    expect(mean(kid.map(t => t.chips))).toBeGreaterThanOrEqual(mean(max.map(t => t.chips)) + 1);
    expect(sum(kid.map(t => t.chipGoals))).toBeGreaterThanOrEqual(sum(max.map(t => t.chipGoals)) + 3);
  },
});
