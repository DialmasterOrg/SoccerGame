import type { GoalRecord, MatchSummary } from './economy';

export type BonusId = 'score3' | 'cleanSheet' | 'header' | 'chip' | 'volley' | 'perfect' | 'early' | 'winBy3' | 'twoStyle' | 'win3Nil' | 'noBossGoals' | 'steals3' | 'noSamGoals';

/** What a bonus can be judged on mid-match: the goals and clean steals so far, and the result once there is one. */
export interface BonusInput {
  goalsFor: number;
  goalsAgainst: number;
  goals: readonly GoalRecord[];
  result: MatchSummary['result'] | null;
  /** Harrison's clean steals with the steal button; traps and pokes don't count. */
  steals: number;
}

export interface Bonus {
  id: BonusId;
  label: string;
  /** True when play (a goal, or a steal) can finish it mid-match; false when only full time can. */
  inPlay: boolean;
  done(s: BonusInput): boolean;
}

/** A goal in the first 30 game minutes: the first 30 real seconds of a 90-second match. */
export const EARLY_GOAL_MINUTE = 30;
export const MAX_STARS = 3;

const SCORE3_GOALS = 3;
const TWO_STYLE_GOALS = 2;
const WIN_BY_3_MARGIN = 3;
export const STEALS_FOR_BONUS = 3;
/** A win by this many or more is worth the second star. */
const TWO_STAR_MARGIN = 2;

const isStyle = (g: GoalRecord) => g.kind === 'header' || g.kind === 'volley' || g.kind === 'chip' || g.kind === 'wave' || g.kind === 'trick';
const scoredA = (kind: GoalRecord['kind']) => (s: BonusInput) => s.goals.some(g => g.kind === kind);
const atFullTime = (rule: (s: BonusInput) => boolean) => (s: BonusInput) => s.result !== null && rule(s);

const bonus = (id: BonusId, label: string, inPlay: boolean, done: (s: BonusInput) => boolean): Bonus => ({ id, label, inPlay, done });

/** The bonus objectives, in the spec's order. */
export const BONUSES: Readonly<Record<BonusId, Bonus>> = {
  score3: bonus('score3', 'SCORE 3 GOALS', true, s => s.goals.length >= SCORE3_GOALS),
  cleanSheet: bonus('cleanSheet', 'KEEP A CLEAN SHEET', false, atFullTime(s => s.goalsAgainst === 0)),
  header: bonus('header', 'SCORE A HEADER', true, scoredA('header')),
  chip: bonus('chip', 'SCORE FROM A CHIP', true, scoredA('chip')),
  volley: bonus('volley', 'SCORE A VOLLEY', true, scoredA('volley')),
  perfect: bonus('perfect', 'SCORE A PERFECT STRIKE', true, s => s.goals.some(g => g.perfect)),
  early: bonus('early', 'SCORE IN THE FIRST 30 SECONDS', true, s => s.goals.some(g => g.minute < EARLY_GOAL_MINUTE)),
  winBy3: bonus('winBy3', 'WIN BY 3', false, atFullTime(s => s.result === 'win' && s.goalsFor - s.goalsAgainst >= WIN_BY_3_MARGIN)),
  twoStyle: bonus('twoStyle', 'SCORE 2 STYLE GOALS', true, s => s.goals.filter(isStyle).length >= TWO_STYLE_GOALS),
  win3Nil: bonus('win3Nil', 'WIN 3-0 OR BETTER', false, atFullTime(s => s.goalsFor >= SCORE3_GOALS && s.goalsAgainst === 0)),
  noBossGoals: bonus('noBossGoals', "DON'T LET BISCUIT SCORE", false, atFullTime(s => s.goalsAgainst === 0)),
  steals3: bonus('steals3', 'WIN THE BALL WITH 3 STEALS', true, s => s.steals >= STEALS_FOR_BONUS),
  noSamGoals: bonus('noSamGoals', "DON'T LET SAM SCORE", false, atFullTime(s => s.goalsAgainst === 0)),
};

/** 0 for a draw or loss; 1 for a win; 2 for a win by 2+; 3 for that and the bonus in the same match. */
export function starsFor(s: MatchSummary, bonus: BonusId): number {
  if (s.result !== 'win') return 0;
  if (s.goalsFor - s.goalsAgainst < TWO_STAR_MARGIN) return 1;
  return BONUSES[bonus].done({ goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, goals: s.goals, result: s.result, steals: s.steals }) ? MAX_STARS : 2;
}
