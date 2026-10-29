import { expect } from 'vitest';
import type { TryoutTraits } from './tryoutScripts';
import { describeTryout, mean } from './tryoutTuning';

/** Her shots on target land at least this much nearer the posts than Max's brain's, on average, px. */
const NEARER = 6;
/** At most this share of her wind-ups start with Harrison in her line. */
const IN_LINE = 0.05;

const inLine = (ts: readonly TryoutTraits[]): number => ts.reduce((a, t) => a + t.shotsInLine, 0) / Math.max(1, ts.reduce((a, t) => a + t.windUps, 0));

describeTryout('paige', {
  name: 'picks corners, and only shoots with a clear look',
  check(kid, max) {
    expect(mean(kid.flatMap(t => t.shotLines))).toBeLessThanOrEqual(mean(max.flatMap(t => t.shotLines)) - NEARER);
    expect(inLine(kid)).toBeLessThanOrEqual(IN_LINE);
    expect(inLine(kid)).toBeLessThan(inLine(max));
  },
});
