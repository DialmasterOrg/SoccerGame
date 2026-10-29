import { expect } from 'vitest';
import { describeTryout, mean } from './tryoutTuning';

describeTryout('hank', {
  name: 'wins more headers',
  check(kid, max) {
    const [hank, maxs] = [mean(kid.map(t => t.headers)), mean(max.map(t => t.headers))];
    expect(hank).toBeGreaterThanOrEqual(1);
    expect(hank).toBeGreaterThanOrEqual(2 * maxs);
  },
});
