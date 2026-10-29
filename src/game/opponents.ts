import { maxStats } from '../meta/ladder';
import { DIFFICULTY, type AiProfile, type Difficulty } from './ai';
import { CREW_PROFILES, CREW_STATS, type CrewId } from './crew';
import { NORMAL_HANDLING, type Handling } from './player';
import { SAM_HANDLING, SAM_PROFILES, SAM_STATS } from './sam';
import { DOG_TRICKS, TRICK_DIFFICULTY, TRICK_SCALE, type TrickSetup } from './tricks';
import type { Stats } from './stats';
import { TRYOUT_PROFILES, TRYOUT_STATS, type TryoutKidId } from './tryouts';
import type { VenueId } from '../meta/career';

/** Every opponent who plays on a human body. Biscuit has his own. */
export type HumanOpponentId = 'max' | CrewId | 'sam' | TryoutKidId;

const isTryoutKid = (id: HumanOpponentId): id is TryoutKidId => id in TRYOUT_STATS && id !== 'max' && id !== 'tia';

/** Their stats for the match: Max's come from the ladder rung, everyone else plays at their own. Max and Tia come back tougher at the School Field, at their tryout stats and profiles. */
export function opponentStats(id: HumanOpponentId, rung: number, venue?: VenueId): Stats {
  if (venue === 'school' && (id === 'max' || id === 'tia')) return { ...TRYOUT_STATS[id] };
  if (id === 'max') return maxStats(rung);
  if (isTryoutKid(id)) return { ...TRYOUT_STATS[id] };
  return { ...(id === 'sam' ? SAM_STATS : CREW_STATS[id]) };
}

export function opponentProfile(id: HumanOpponentId, d: Difficulty, venue?: VenueId): AiProfile {
  if (venue === 'school' && (id === 'max' || id === 'tia')) return TRYOUT_PROFILES[id][d];
  if (id === 'max') return DIFFICULTY[d];
  if (isTryoutKid(id)) return TRYOUT_PROFILES[id][d];
  return id === 'sam' ? SAM_PROFILES[d] : CREW_PROFILES[id][d];
}

/** How they brake, touch and shoot: Sam his own way, everyone else normally. */
export function opponentHandling(id: HumanOpponentId): Handling {
  return id === 'sam' ? SAM_HANDLING : NORMAL_HANDLING;
}

/** Harrison's tricks against this opponent on difficulty `d`: the difficulty's window and times scaled by their style, or the dog's own. */
export function trickSetup(d: Difficulty, opponent: HumanOpponentId | 'biscuit'): TrickSetup {
  if (opponent === 'biscuit') return { profile: DOG_TRICKS[d], scale: { stepover: 1, flick: 1 } };
  return { profile: TRICK_DIFFICULTY[d], scale: TRICK_SCALE[opponentProfile(opponent, d).style] };
}
