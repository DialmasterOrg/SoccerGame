import { describe, expect, it } from 'vitest';
import type { Difficulty } from './ai';
import type { HumanOpponentId } from './opponents';
import { trickMatch, type TrickMatch, type TrickScript } from './trickScripts';

/** The tuning seeds: 64 for the measures against Max and Biscuit, the first 32 for the personalities. */
const SEEDS = Array.from({ length: 64 }, (_, i) => 100 + i);
const PERSONALITY_SEEDS = SEEDS.slice(0, 32);

const played = new Map<string, TrickMatch>();
function match(opponent: HumanOpponentId | 'biscuit', d: Difficulty, seed: number, script: TrickScript): TrickMatch {
  const key = `${opponent} ${d} ${seed} ${script}`;
  if (!played.has(key)) played.set(key, trickMatch(opponent, d, seed, script));
  return played.get(key)!;
}
const matches = (opponent: HumanOpponentId | 'biscuit', d: Difficulty, script: TrickScript, seeds = SEEDS) => seeds.map(s => match(opponent, d, s, script));
const winRate = (ms: TrickMatch[]) => ms.filter(m => m.result === 'win').length / ms.length;
const sum = (ms: TrickMatch[], f: (m: TrickMatch) => number) => ms.reduce((n, m) => n + f(m), 0);
/** Of the tricks that fooled him, the share that got Harrison past him with the ball. */
const beatShare = (ms: TrickMatch[], kinds: readonly ('stepover' | 'flick')[] = ['stepover', 'flick']) =>
  sum(ms, m => kinds.reduce((n, k) => n + m.trickStats.beats[k], 0)) / Math.max(1, sum(ms, m => kinds.reduce((n, k) => n + m.trickStats.fooled[k], 0)));
const meanPast = (ms: TrickMatch[]) => {
  const all = ms.flatMap(m => m.trickStats.pastPx);
  return all.reduce((a, b) => a + b, 0) / Math.max(1, all.length);
};

describe('timed right, a trick works (not too hard)', () => {
  it.each([
    ['easy', 0.8],
    ['normal', 0.7],
    ['hard', 0.55],
  ] as const)('against Max on %s, at least %f of fooling tricks get Harrison past him', (d, floor) => {
    const ms = matches('max', d, 'trickster');
    expect(sum(ms, m => m.trickStats.fooled.stepover + m.trickStats.fooled.flick)).toBeGreaterThan(20);
    expect(beatShare(ms)).toBeGreaterThanOrEqual(floor);
  });
});

describe('mashing RB does not work (not too easy)', () => {
  it("the spammer wins no more than 0.06 above the plain script against Max on Normal", () => {
    expect(winRate(matches('max', 'normal', 'spammer'))).toBeLessThanOrEqual(winRate(matches('max', 'normal', 'plain')) + 0.06);
  });
});

describe('the tricks are not a win button (not too easy)', () => {
  // The parent's call (2026-10-30, close control): only about one trick a match fools Max, and the trickster's other presses cost the
  // ball, so he doesn't beat the plain script on Normal (192 seeds, before close control too: .656 vs .682). The bar is the cap alone.
  it("the trickster beats Max on Normal by no more than 0.20 over the plain script", () => {
    expect(winRate(matches('max', 'normal', 'trickster'))).toBeLessThanOrEqual(winRate(matches('max', 'normal', 'plain')) + 0.2);
  });

  it('the trickster wins no more than a quarter against Max on Hard', () => {
    expect(winRate(matches('max', 'hard', 'trickster'))).toBeLessThanOrEqual(0.25);
  });
});

describe('the personalities show (Normal, 32 seeds)', () => {
  const stepoverBeats = (id: HumanOpponentId) => beatShare(matches(id, 'normal', 'trickster', PERSONALITY_SEEDS), ['stepover']);

  it('of fooling stepovers, the share that beat him runs Max, Tia, Brick', () => {
    const [max, tia, brick] = (['max', 'tia', 'brick'] as const).map(stepoverBeats);
    expect(max).toBeGreaterThanOrEqual(tia);
    expect(tia).toBeGreaterThanOrEqual(brick);
  });

  // Fooled for 0.7 s or more nearly every stepover beats him, so the share can't rank Pete above Max (the parent's call,
  // 2026-10-28): Pete's own floor instead, over all 64 seeds, since only a handful of his stepovers fool him in 32.
  it("Pete's fooling stepovers beat him at least 0.7 of the time (64 seeds)", () => {
    expect(beatShare(matches('pete', 'normal', 'trickster'), ['stepover'])).toBeGreaterThanOrEqual(0.7);
  });

  // The parent's call (2026-10-28): Sam stays x1, so mashing RB can't beat him, and his skid is checked where it happens,
  // on the Sams fooled at speed, over all 64 seeds since few are: at least 1.5x as far past as a fooled Max.
  it('a Sam fooled at speed ends up at least 1.5 times as far past Harrison as a fooled Max (64 seeds)', () => {
    const fast = matches('sam', 'normal', 'trickster').flatMap(m => m.trickStats.pastAtSpeedPx);
    expect(fast.length).toBeGreaterThan(8);
    expect(fast.reduce((a, b) => a + b, 0) / fast.length).toBeGreaterThanOrEqual(1.5 * meanPast(matches('max', 'normal', 'trickster')));
  });
});

describe('mashing RB does not beat Speedy Sam (not too easy)', () => {
  // The parent's call (2026-10-30, close control): Normal only. On Easy, mashing's stop-start makes Sam overshoot, his own lesson
  // working; only about 2 of 40 mashed tricks fool him (192 seeds, before close control too: spammer .781, plain .583).
  it('on normal the spammer wins no more than 0.06 above the plain script', () => {
    expect(winRate(matches('sam', 'normal', 'spammer'))).toBeLessThanOrEqual(winRate(matches('sam', 'normal', 'plain')) + 0.06);
  });
});

describe("Biscuit isn't made easy (Normal)", () => {
  it('the trickster wins no more than 0.20 above the plain blocker, and the spammer no more than 0.06', () => {
    const plain = winRate(matches('biscuit', 'normal', 'plain'));
    expect(winRate(matches('biscuit', 'normal', 'trickster'))).toBeLessThanOrEqual(plain + 0.2);
    expect(winRate(matches('biscuit', 'normal', 'spammer'))).toBeLessThanOrEqual(plain + 0.06);
  });
});

describe('nothing gets stuck', () => {
  it('every match ends with a result, and the ball is never still for over 4 s', () => {
    for (const m of [...played.values()]) {
      expect(m.result).not.toBeNull();
      expect(m.longestStillS).toBeLessThanOrEqual(4);
    }
    expect(played.size).toBeGreaterThan(0);
  });
});
