import type { VenueId } from '../meta/career';
import { BIG_VIEW, SMALL_VIEW, type View } from './camera';
import { BACKYARD, SCHOOL_FIELD, type Field } from './field';
import { GOLDEN_GOAL_MAX_S, MATCH_S } from './match';

/** Where a venue's matches are played: the pitch, the canvas that shows it, and how long they last. */
export interface Stage {
  readonly field: Field;
  readonly view: View;
  readonly matchS: number;
  readonly goldenGoalS: number;
  /** A keeper in each goal: from the School Field on. */
  readonly keepers: boolean;
}

export const SMALL_STAGE: Stage = { field: BACKYARD, view: SMALL_VIEW, matchS: MATCH_S, goldenGoalS: GOLDEN_GOAL_MAX_S, keepers: false };
export const SCHOOL_STAGE: Stage = { field: SCHOOL_FIELD, view: BIG_VIEW, matchS: 120, goldenGoalS: 60, keepers: true };

/** The Backyard and the Park play small; the School Field and every venue after it play on the big pitch. */
export function stageFor(venue: VenueId): Stage {
  return venue === 'backyard' || venue === 'park' ? SMALL_STAGE : SCHOOL_STAGE;
}
