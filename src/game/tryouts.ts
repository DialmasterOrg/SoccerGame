import { DIFFICULTIES, DIFFICULTY, type AiProfile, type Difficulty } from './ai';
import { CREW_PROFILES } from './crew';
import type { Stats } from './stats';

/** The six new kids trying out at the School Field. */
export type TryoutKidId = 'hank' | 'lola' | 'finn' | 'priya' | 'niko' | 'paige';
/** Who plays a tryout: Max and Tia at their School best, and the six new kids. */
export type TryoutOpponent = 'max' | 'tia' | TryoutKidId;
/** In tryout order, 1 to 8. */
export const TRYOUT_ORDER: readonly TryoutOpponent[] = ['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige'];

/** Each kid one level stronger overall than the one before, starting four above rung-10 Max, with one standout stat apiece. */
export const TRYOUT_STATS: Readonly<Record<TryoutOpponent, Readonly<Stats>>> = {
  max: { speed: 5, power: 5, jump: 3, control: 4, stamina: 1 },
  hank: { speed: 4, power: 4, jump: 7, control: 3, stamina: 1 },
  lola: { speed: 5, power: 5, jump: 3, control: 6, stamina: 1 },
  finn: { speed: 7, power: 5, jump: 3, control: 5, stamina: 1 },
  tia: { speed: 6, power: 4, jump: 3, control: 8, stamina: 1 },
  priya: { speed: 8, power: 5, jump: 3, control: 6, stamina: 1 },
  niko: { speed: 6, power: 5, jump: 3, control: 9, stamina: 1 },
  paige: { speed: 6, power: 9, jump: 3, control: 6, stamina: 1 },
};

type Dials = Partial<AiProfile>;

/** Three profiles on `from`'s, each its own object down to the kickoff spot, so a sweep that mutates one never moves another venue's. */
const profiles = (from: Record<Difficulty, AiProfile>, dials: Partial<Record<Difficulty, Dials>> = {}): Record<Difficulty, AiProfile> =>
  Object.fromEntries(DIFFICULTIES.map(d => {
    const p = { ...from[d], ...dials[d] };
    return [d, { ...p, kickoffSpot: { ...p.kickoffSpot } }];
  })) as Record<Difficulty, AiProfile>;

/**
 * Each tryout's three difficulty profiles, measured by its tuning test on
 * seeds 100–163 against the School's scripted Harrison a level up, with
 * keepers. Mutable like DIFFICULTY, so headless sweeps can tune them at runtime.
 */
export const TRYOUT_PROFILES: Record<TryoutOpponent, Record<Difficulty, AiProfile>> = {
  // School Max: Max's own dials, a touch less pace on Normal. Measured E 0.813, N 0.594, H 0.063 (keepers at level 1).
  max: profiles(DIFFICULTY, { normal: { paceFactor: 1.02 } }),
  // Header Hank: wins the ball in the air, so Normal is a touch gentler on the ground. Measured E 0.828, N 0.578, H 0.047 (keepers at level 2).
  hank: profiles(DIFFICULTY, {
    easy: { style: 'header' },
    normal: { style: 'header', paceFactor: 1, aimErrorDeg: 7, aggression: 0.45, cleanSteal: 0.8 },
    hard: { style: 'header' },
  }),
  // Lofty Lola: chips any keeper off his line at the corner away from him, and over a Harrison charging at her. Normal a touch slower.
  // Measured E 0.766, N 0.594, H 0.063 (keepers at level 3).
  lola: profiles(DIFFICULTY, { easy: { style: 'chipper' }, normal: { style: 'chipper', paceFactor: 1 }, hard: { style: 'chipper' } }),
  // Fake-Out Finn: shapes to shoot at a Harrison standing in his lane, from further out, and cuts past one who commits.
  // Normal a touch slower, Hard sharper. Measured E 0.797, N 0.578, H 0.063 (keepers at level 4); Normal shapes 2.56 a match.
  finn: profiles(DIFFICULTY, {
    easy: { style: 'faker' },
    normal: { style: 'faker', paceFactor: 1, shootRange: 200 },
    hard: { style: 'faker', paceFactor: 1.15, shootRange: 230 },
  }),
  tia: profiles(CREW_PROFILES.tia),
  priya: profiles(DIFFICULTY),
  niko: profiles(DIFFICULTY),
  paige: profiles(DIFFICULTY),
};
