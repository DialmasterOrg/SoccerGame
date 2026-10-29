import { describe, expect, it } from 'vitest';
import type { GoalRecord, MatchSummary } from './economy';
import { BONUSES, EARLY_GOAL_MINUTE, MAX_STARS, STEALS_FOR_BONUS, starsFor, type BonusId } from './objectives';

const goal = (over: Partial<GoalRecord> = {}): GoalRecord => ({ minute: 40, kind: 'shot', perfect: false, ...over });
const match = (over: Partial<MatchSummary>): MatchSummary => ({ result: 'win', goalsFor: 1, goalsAgainst: 0, styleGoals: [], goals: [goal()], steals: 0, ...over });

describe('bonuses', () => {
  it('has the thirteen spec labels, in the character set', () => {
    const labels = Object.values(BONUSES).map(b => b.label);
    expect(labels).toEqual([
      'SCORE 3 GOALS', 'KEEP A CLEAN SHEET', 'SCORE A HEADER', 'SCORE FROM A CHIP', 'SCORE A VOLLEY', 'SCORE A PERFECT STRIKE',
      'SCORE IN THE FIRST 30 SECONDS', 'WIN BY 3', 'SCORE 2 STYLE GOALS', 'WIN 3-0 OR BETTER', "DON'T LET BISCUIT SCORE",
      'WIN THE BALL WITH 3 STEALS', "DON'T LET SAM SCORE",
    ]);
    for (const l of labels) expect(l).toMatch(/^[A-Z0-9 '\-:!?.,/+<>]+$/);
  });

  it('a kind of goal finishes its bonus mid-match', () => {
    const inPlay = (id: BonusId, goals: GoalRecord[]) => BONUSES[id].done({ goalsFor: goals.length, goalsAgainst: 0, goals, result: null, steals: 0 });
    expect(inPlay('header', [goal({ kind: 'header' })])).toBe(true);
    expect(inPlay('header', [goal({ kind: 'volley' })])).toBe(false);
    expect(inPlay('chip', [goal({ kind: 'chip' })])).toBe(true);
    expect(inPlay('volley', [goal({ kind: 'volley' })])).toBe(true);
    expect(inPlay('perfect', [goal({ perfect: true })])).toBe(true);
    expect(inPlay('perfect', [goal({ kind: null })])).toBe(false);
    expect(inPlay('score3', [goal(), goal(), goal()])).toBe(true);
    expect(inPlay('score3', [goal(), goal()])).toBe(false);
    expect(inPlay('twoStyle', [goal({ kind: 'header' }), goal({ kind: 'wave' })])).toBe(true);
    expect(inPlay('twoStyle', [goal({ kind: 'header' }), goal()])).toBe(false);
  });

  it('the early bonus reads in seconds and keeps its rule', () => {
    expect(BONUSES.early.label).toBe('SCORE IN THE FIRST 30 SECONDS');
    expect(EARLY_GOAL_MINUTE).toBe(30);
  });

  it('an early goal is before the 30th minute; a golden-goal winner at 90 is not', () => {
    expect(EARLY_GOAL_MINUTE).toBe(30);
    const early = (minute: number) => BONUSES.early.done({ goalsFor: 1, goalsAgainst: 0, goals: [goal({ minute })], result: null, steals: 0 });
    expect(early(29)).toBe(true);
    expect(early(30)).toBe(false);
    expect(early(90)).toBe(false);
  });

  it('full-time bonuses wait for the result', () => {
    const live = { goalsFor: 3, goalsAgainst: 0, goals: [goal(), goal(), goal()], result: null, steals: 0 };
    for (const id of ['cleanSheet', 'winBy3', 'win3Nil', 'noBossGoals', 'noSamGoals'] as const) {
      expect(BONUSES[id].inPlay).toBe(false);
      expect(BONUSES[id].done(live)).toBe(false);
      expect(BONUSES[id].done({ ...live, result: 'win' })).toBe(true);
    }
    expect(BONUSES.winBy3.done({ goalsFor: 4, goalsAgainst: 2, goals: [], result: 'win', steals: 0 })).toBe(false);
    expect(BONUSES.win3Nil.done({ goalsFor: 3, goalsAgainst: 1, goals: [], result: 'win', steals: 0 })).toBe(false);
    expect(BONUSES.cleanSheet.done({ goalsFor: 0, goalsAgainst: 0, goals: [], result: 'draw', steals: 0 })).toBe(true);
  });

  it('in-play bonuses are the ones a goal or a steal can settle', () => {
    const inPlay = Object.values(BONUSES).filter(b => b.inPlay).map(b => b.id);
    expect(inPlay).toEqual(['score3', 'header', 'chip', 'volley', 'perfect', 'early', 'twoStyle', 'steals3']);
  });

  it('three clean steals settle the steals bonus in play', () => {
    const s = { goalsFor: 0, goalsAgainst: 0, goals: [], result: null, steals: 2 };
    expect(STEALS_FOR_BONUS).toBe(3);
    expect(BONUSES.steals3.done(s)).toBe(false);
    expect(BONUSES.steals3.done({ ...s, steals: 3 })).toBe(true);
    expect(BONUSES.steals3).toMatchObject({ label: 'WIN THE BALL WITH 3 STEALS', inPlay: true });
  });

  it("Sam's bonus is a clean sheet at full time, with his name", () => {
    expect(BONUSES.noSamGoals.label).toBe("DON'T LET SAM SCORE");
    expect(BONUSES.noSamGoals.done({ goalsFor: 2, goalsAgainst: 0, goals: [], result: 'win', steals: 0 })).toBe(true);
    expect(BONUSES.noSamGoals.done({ goalsFor: 2, goalsAgainst: 0, goals: [], result: null, steals: 0 })).toBe(false);
  });
});

describe('starsFor', () => {
  it('a win is one star, by two is two, with the bonus is three', () => {
    expect(MAX_STARS).toBe(3);
    expect(starsFor(match({ goalsFor: 1, goalsAgainst: 0 }), 'header')).toBe(1);
    expect(starsFor(match({ goalsFor: 2, goalsAgainst: 0, goals: [goal(), goal()] }), 'header')).toBe(2);
    expect(starsFor(match({ goalsFor: 2, goalsAgainst: 0, goals: [goal({ kind: 'header' }), goal()] }), 'header')).toBe(3);
  });

  it('a one-goal win with the bonus is still one star', () => {
    expect(starsFor(match({ goalsFor: 1, goalsAgainst: 0, goals: [goal({ kind: 'header' })] }), 'header')).toBe(1);
  });

  it('starsFor reads the steals: a 2-0 win over Tia with 3 steals is 3 stars', () => {
    expect(starsFor({ result: 'win', goalsFor: 2, goalsAgainst: 0, styleGoals: [], goals: [], steals: 3 }, 'steals3')).toBe(3);
    expect(starsFor({ result: 'win', goalsFor: 2, goalsAgainst: 0, styleGoals: [], goals: [], steals: 2 }, 'steals3')).toBe(2);
  });

  it('a draw or a loss is no stars, bonus or not', () => {
    expect(starsFor(match({ result: 'draw', goalsFor: 1, goalsAgainst: 1, goals: [goal({ kind: 'header' })] }), 'header')).toBe(0);
    expect(starsFor(match({ result: 'lose', goalsFor: 3, goalsAgainst: 4, goals: [goal(), goal(), goal()] }), 'score3')).toBe(0);
  });
});

describe('trick goals and the bonuses', () => {
  it('two trick goals meet SCORE 2 STYLE GOALS', () => {
    const s = match({ goalsFor: 2, styleGoals: ['trick', 'trick'], goals: [goal({ kind: 'trick' }), goal({ kind: 'trick' })] });
    expect(BONUSES.twoStyle.done(s)).toBe(true);
  });
});
