import { expect } from 'vitest';
import { describeTryout, mean } from './tryoutTuning';

/**
 * His keeper pushes the ball away about once a match, so her rebound touches
 * can't double Max's: she plays them a quarter more. Her lingering shows
 * while Harrison has the ball in her half, where it applies.
 */
const MORE_REBOUNDS = 1.25;
const UPFIELD_PX = 80;

describeTryout('priya', {
  name: 'follows shots in, and lingers upfield',
  check(kid, max) {
    const [priya, maxs] = [mean(kid.map(t => t.reboundTouches)), mean(max.map(t => t.reboundTouches))];
    expect(priya).toBeGreaterThanOrEqual(0.5);
    expect(priya).toBeGreaterThanOrEqual(MORE_REBOUNDS * maxs);
    expect(mean(kid.map(t => t.halfDepth))).toBeGreaterThanOrEqual(mean(max.map(t => t.halfDepth)) + UPFIELD_PX);
  },
});
