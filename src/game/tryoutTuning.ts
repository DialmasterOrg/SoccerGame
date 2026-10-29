import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from './ai';
import { playTryout, tryoutLevel, tryoutMatch, type TryoutMatch, type TryoutTraits } from './tryoutScripts';
import { TRYOUT_PROFILES, TRYOUT_STATS, type TryoutOpponent } from './tryouts';

/**
 * Each tryout measured like the Park crew (crewTuning.test.ts): whole School
 * matches with keepers at the tryout's level, against the School's scripted
 * Harrison a level up on the kid's stats, on fixed seeds. Easy about 80%,
 * Normal about 60%, Hard about as tough as Max's Hard. Each kid's
 * personality must also show against Max's brain at the same stats.
 */
export const TRYOUT_SEEDS: readonly number[] = [...Array(64)].map((_, i) => 100 + i);
/** Max's Hard at the School measures about this; every tryout stays about as tough, as in the Park. */
export const HARD_CEILING = 0.1;
const BANDS: Record<'easy' | 'normal', readonly [number, number]> = { easy: [0.7, 0.9], normal: [0.5, 0.7] };
/** The ball may sit still in play this long at most, s. */
const STILL_S = 4;

/** kid: the kid's Normal matches; max: Max's Normal brain at the kid's stats, same seeds and level. */
export interface Personality {
  name: string;
  check(kid: readonly TryoutTraits[], max: readonly TryoutTraits[]): void;
}

export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Each match is played once and shared between the tests that read it. */
const played = new Map<string, TryoutMatch>();
const play = (id: TryoutOpponent, d: Difficulty, seed: number): TryoutMatch => {
  const key = `${id}/${d}/${seed}`;
  if (!played.has(key)) played.set(key, tryoutMatch(id, d, seed));
  return played.get(key)!;
};
/** School Max's Normal brain at the kid's stats, against the same Harrison and keepers. */
const maxAs = (id: TryoutOpponent, seed: number): TryoutMatch => {
  const key = `max-as-${id}/${seed}`;
  if (!played.has(key)) played.set(key, playTryout({ stats: TRYOUT_STATS[id], profile: TRYOUT_PROFILES.max.normal }, tryoutLevel(id), 'normal', seed));
  return played.get(key)!;
};
const rate = (id: TryoutOpponent, d: Difficulty) => TRYOUT_SEEDS.filter(s => play(id, d, s).result === 'win').length / TRYOUT_SEEDS.length;

/** One tryout's tuning test: the bands, every match sound, and its personality against Max's brain. */
export function describeTryout(id: TryoutOpponent, personality: Personality | null): void {
  describe(`${id} at the School, measured against keepers`, () => {
    for (const d of ['easy', 'normal'] as const) {
      const [lo, hi] = BANDS[d];
      it(`${d}: the School Harrison wins ${lo}-${hi}`, () => {
        const r = rate(id, d);
        expect(r).toBeGreaterThanOrEqual(lo);
        expect(r).toBeLessThanOrEqual(hi);
      });
    }

    it(`hard: about as tough as Max's Hard, at most ${HARD_CEILING}`, () => {
      expect(rate(id, 'hard')).toBeLessThanOrEqual(HARD_CEILING);
    });

    it('Easy is kinder than Normal, and Normal than Hard', () => {
      const [e, n, h] = DIFFICULTIES.map(d => rate(id, d));
      expect(e).toBeGreaterThanOrEqual(n!);
      expect(n).toBeGreaterThanOrEqual(h!);
    });

    it('every match ends with a result, the ball never sits still for long, and no body stands in a goal or behind a net', () => {
      for (const d of DIFFICULTIES) {
        for (const seed of TRYOUT_SEEDS) {
          const m = play(id, d, seed);
          expect(m.result, `${d} seed ${seed}`).not.toBeNull();
          expect(m.longestStillS, `${d} seed ${seed}`).toBeLessThanOrEqual(STILL_S);
          expect(m.traits.strayTicks, `${d} seed ${seed}`).toBe(0);
        }
      }
    });

    if (personality) {
      it(personality.name, () => {
        personality.check(
          TRYOUT_SEEDS.map(s => play(id, 'normal', s).traits),
          TRYOUT_SEEDS.map(s => maxAs(id, s).traits),
        );
      });
    }
  });
}
