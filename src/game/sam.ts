import { ALL_ROUND, type AiProfile, type Difficulty } from './ai';
import type { Handling } from './player';
import type { Stats } from './stats';

/**
 * Speedy Sam, the Park's boss: all gas, no brakes. He's the fastest player
 * in the game, but brakes softly (he skids on every turn and overshoots a
 * drag-back), knocks the ball well ahead (a gap Harrison can step into),
 * and has a weak shot a sprinting Harrison can run down.
 */
export const SAM_STATS: Readonly<Stats> = { speed: 10, power: 1, jump: 3, control: 3, stamina: 1 };

/**
 * From flat out on Normal (211 px/s) his brakes take 0.33 s to stop him, his
 * touch runs about 31 px ahead, and a full shot leaves at 237 px/s.
 */
export const SAM_HANDLING: Readonly<Handling> = { decel: 650, touchScale: 1.5, shotScale: 0.55, ballAhead: 48 };

type Dials = Partial<Omit<AiProfile, 'style'>>;
const samProfile = (d: Difficulty, dials: Dials): AiProfile => ({ ...ALL_ROUND[d], shootRange: 90, ...dials, style: 'speedster' });

/**
 * His three difficulty profiles: the all-round dials, with his own pace,
 * range, range-shot odds and kickoff spot. He waits for Harrison's kickoff shot rather than
 * rushing the wind-up (at his pace that sent it back into Harrison's net).
 * A faster Sam is an easier one, since his pace is what makes him overshoot,
 * so Hard keeps Normal's pace. Mutable like DIFFICULTY, for headless sweeps.
 *
 * Measured by samTuning.test.ts on seeds 100–163 at the tuning stats, as
 * racer / matador wins: Easy 0.188 / 0.922, Normal 0.094 / 0.609, Hard
 * 0.109 / 0.422.
 */
export const SAM_PROFILES: Record<Difficulty, AiProfile> = {
  easy: samProfile('easy', { paceFactor: 1, rangeShot: 0.5, kickoffRush: false, kickoffSpot: { back: 110, off: 8 } }),
  normal: samProfile('normal', { paceFactor: 1.08, rangeShot: 0.35, kickoffRush: false, kickoffSpot: { back: 110, off: 8 }, cleanSteal: 0.55, wrongFootedS: 0.2 }),
  hard: samProfile('hard', { paceFactor: 1.08, rangeShot: 0.1, kickoffRush: false, kickoffSpot: { back: 110, off: 10 }, aggression: 0.6 }),
};
