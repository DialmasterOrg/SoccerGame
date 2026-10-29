import { expect } from 'vitest';
import { describeTryout, mean } from './tryoutTuning';

describeTryout('finn', {
  name: "shapes to shoot, then doesn't",
  check(kid, max) {
    expect(mean(kid.map(t => t.moves.shape ?? 0))).toBeGreaterThanOrEqual(2);
    expect(mean(max.map(t => t.moves.shape ?? 0))).toBe(0);
  },
});
