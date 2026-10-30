import { ALL_ROUND, type AiProfile, type Difficulty, type Style } from './ai';
import type { Stats } from './stats';

/** The Park crew, the local kids who play pickup there. */
export type CrewId = 'brick' | 'leo' | 'tia' | 'pete';

/** Each kid a little stronger overall than the one before, with one standout stat apiece. */
export const CREW_STATS: Readonly<Record<CrewId, Readonly<Stats>>> = {
  brick: { speed: 3, power: 4, jump: 2, control: 4, stamina: 1 },
  leo: { speed: 4, power: 6, jump: 2, control: 3, stamina: 1 },
  tia: { speed: 5, power: 3, jump: 2, control: 6, stamina: 1 },
  pete: { speed: 6, power: 4, jump: 3, control: 4, stamina: 1 },
};

const STYLES: Record<CrewId, Style> = { brick: 'blocker', leo: 'shooter', tia: 'dribbler', pete: 'presser' };

type Dials = Partial<Omit<AiProfile, 'style'>>;

/** A kid's profiles: the all-round dials for each difficulty, their style, and the dials they tune. */
const crewProfiles = (id: CrewId, dials: Record<Difficulty, Dials>): Record<Difficulty, AiProfile> => ({
  easy: { ...ALL_ROUND.easy, ...dials.easy, style: STYLES[id] },
  normal: { ...ALL_ROUND.normal, ...dials.normal, style: STYLES[id] },
  hard: { ...ALL_ROUND.hard, ...dials.hard, style: STYLES[id] },
});

/**
 * Each kid's three difficulty profiles, measured by crewTuning.test.ts on
 * seeds 100–163 against the scripted Harrison a level up. Mutable like
 * DIFFICULTY, so headless sweeps can tune them at runtime.
 */
export const CREW_PROFILES: Record<CrewId, Record<Difficulty, AiProfile>> = {
  // Big Brick: hardly slides. Measured E 0.828, N 0.594, H 0.031; defends 85 px deeper than Max, a third of his slides.
  brick: crewProfiles('brick', {
    // Close control (2026-10-30): Easy reactionS 0.22 → 0.2 and cleanSteal 0.9 → 0.85, Normal paceFactor 1.05 → 1.06 and cleanSteal 0.75 → 0.6.
    easy: { aggression: 0.1, shootRange: 190, reactionS: 0.2, cleanSteal: 0.85 },
    normal: { aggression: 0.2, shootRange: 200, paceFactor: 1.06, cleanSteal: 0.6 },
    hard: { aggression: 0.4, shootRange: 210, paceFactor: 1.2, cleanSteal: 0.4, reactionS: 0.08 },
  }),
  // Boomer Leo: shoots from around halfway, with a full wind-up. Measured E 0.859, N 0.625, H 0.063; his shots start 81 px further out than Max's.
  leo: crewProfiles('leo', {
    // Close control (2026-10-30): Easy cleanSteal 0.9 → 0.7 and reactionS 0.22 → 0.2, Normal cleanSteal 0.65 → 0.5 and paceFactor 1.06 → 1.05
    // (his long shots), Hard paceFactor 1.15 → 1.18.
    easy: { shootRange: 300, cleanSteal: 0.7, reactionS: 0.2 },
    normal: { shootRange: 360, cleanSteal: 0.5, reactionS: 0.14, paceFactor: 1.05 },
    hard: { shootRange: 380, cleanSteal: 0.45, paceFactor: 1.18, reactionS: 0.08 },
  }),
  // Tricky Tia: fakes anyone standing in her path, shoots only from close in. Measured E 0.766, N 0.594, H 0.000; 10.3 fakes a match.
  tia: crewProfiles('tia', {
    easy: { shootRange: 100, aggression: 0.25 },
    normal: { shootRange: 110, aggression: 0.5 },
    hard: { shootRange: 120, aggression: 0.75 },
  }),
  // Pesky Pete: on you fast, flat out, sliding; he commits, so a clean steal leaves him standing longer than Max, and his shooting is wild.
  // Measured E 0.797, N 0.641, H 0.031; sprints 30% of Harrison's time on the ball (Max 0%), 4.0 slides a match to Max's 3.5.
  pete: crewProfiles('pete', {
    easy: { reactionS: 0.18, aggression: 0.4, cleanSteal: 0.98, wrongFootedS: 0.9, aimErrorDeg: 14, paceFactor: 0.95 },
    normal: { reactionS: 0.13, aggression: 0.6, cleanSteal: 0.9, wrongFootedS: 0.7, aimErrorDeg: 10, paceFactor: 1 },
    hard: { reactionS: 0.09, aggression: 0.85, cleanSteal: 0.7, wrongFootedS: 0.35, aimErrorDeg: 4, paceFactor: 1.1 },
  }),
};
