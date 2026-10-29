import { describe, expect, it } from 'vitest';
import { GOAL_PAUSE_S, KICKOFF_S, clockMinute, clockText, createMatch, endGoalPause, stepMatch, type MatchState } from './match';

const STEP = 1 / 60;
const ticks = (s: number) => Math.round(s / STEP);

function playing(p: Partial<MatchState> = {}): MatchState {
  return { ...createMatch(), phase: 'playing', ...p };
}

function run(m: MatchState, seconds: number, goal: 'left' | 'right' | null = null): void {
  for (let i = 0; i < ticks(seconds); i++) stepMatch(m, STEP, goal);
}

describe('stepMatch', () => {
  it('starts 0-0 at kickoff with home kicking off', () => {
    expect(createMatch()).toMatchObject({ phase: 'kickoff', clockS: 0, score: { home: 0, away: 0 }, kickoffTeam: 'home', result: null });
  });

  it('runs 90 game minutes in 90 playing seconds and stops for goals', () => {
    const m = playing({ score: { home: 0, away: 1 } });
    run(m, 45);
    expect(clockMinute(m)).toBe(45);
    m.phase = 'goal';
    run(m, 1);
    expect(clockMinute(m)).toBe(45);
    m.phase = 'playing';
    run(m, 46);
    expect(m.phase).toBe('fullTime');
    expect(m.result).toBe('lose');
    expect(clockMinute(m)).toBe(90);
  });

  it('a ball in the right goal scores for home; in the left for away (own goals included)', () => {
    const m = playing();
    stepMatch(m, STEP, 'right');
    expect(m.score).toEqual({ home: 1, away: 0 });
    expect(m.lastScorer).toBe('home');
    const n = playing();
    stepMatch(n, STEP, 'left');
    expect(n.score).toEqual({ home: 0, away: 1 });
  });

  it('the conceding team kicks off after the goal pause', () => {
    const m = playing();
    stepMatch(m, STEP, 'right');
    expect([m.phase, m.kickoffTeam]).toEqual(['goal', 'away']);
    let reset = false;
    for (let i = 0; i < ticks(GOAL_PAUSE_S); i++) reset ||= stepMatch(m, STEP, null).resetForKickoff;
    expect([m.phase, reset]).toEqual(['kickoff', true]);
    run(m, KICKOFF_S);
    expect(m.phase).toBe('playing');
  });

  it('goals during the goal pause are ignored', () => {
    const m = playing();
    stepMatch(m, STEP, 'right');
    run(m, 1, 'right');
    expect(m.score).toEqual({ home: 1, away: 0 });
  });

  it('goals during kickoff are ignored', () => {
    const m = createMatch();
    stepMatch(m, STEP, 'left');
    expect(m.score).toEqual({ home: 0, away: 0 });
  });

  it('a goal on the tick the clock hits 90 counts before full time is decided', () => {
    const m = playing({ clockS: 90 - STEP / 2 });
    stepMatch(m, STEP, 'right');
    expect([m.phase, m.result, m.goldenGoal]).toEqual(['fullTime', 'win', false]);
  });

  it('an equaliser on the tick the clock hits 90 sends it to golden goal', () => {
    const m = playing({ clockS: 90 - STEP / 2, score: { home: 0, away: 1 } });
    stepMatch(m, STEP, 'right');
    expect(m.goldenGoal).toBe(true);
    expect(m.result).toBeNull();
  });

  it('tied at 90 goes to golden goal; the first goal wins', () => {
    const m = playing({ clockS: 89 });
    run(m, 2);
    expect([m.phase, m.goldenGoal]).toEqual(['playing', true]);
    run(m, 10);
    stepMatch(m, STEP, 'left');
    expect([m.phase, m.result]).toEqual(['goal', 'lose']);
    run(m, GOAL_PAUSE_S);
    expect([m.phase, m.result]).toEqual(['fullTime', 'lose']);
  });

  it('a golden goal gets its GOAL! moment, then full time', () => {
    const m = playing({ clockS: 90, goldenGoal: true, goldenS: 5 });
    expect(stepMatch(m, STEP, 'right').resetForKickoff).toBe(false);
    expect([m.phase, m.result, m.score.home]).toEqual(['goal', 'win', 1]);
    const resets: boolean[] = [];
    for (let i = 0; i < ticks(GOAL_PAUSE_S); i++) resets.push(stepMatch(m, STEP, 'right').resetForKickoff);
    expect(m.phase).toBe('fullTime');
    expect(resets).not.toContain(true);
    expect(m.score.home).toBe(1);
  });

  it('golden goal times out to a draw at 45 s', () => {
    const m = playing({ clockS: 90, goldenGoal: true });
    run(m, 44);
    expect(m.phase).toBe('playing');
    expect(clockMinute(m)).toBe(90);
    run(m, 1.1);
    expect([m.phase, m.result]).toEqual(['fullTime', 'draw']);
    expect(clockMinute(m)).toBe(90);
  });

  it('a golden goal on the timeout tick still wins', () => {
    const m = playing({ clockS: 90, goldenGoal: true, goldenS: 45 - STEP / 2 });
    stepMatch(m, STEP, 'right');
    expect([m.phase, m.result]).toEqual(['goal', 'win']);
  });

  it('nothing changes after full time', () => {
    const m = playing({ phase: 'fullTime', result: 'win', score: { home: 1, away: 0 } });
    run(m, 1, 'left');
    expect(m.score).toEqual({ home: 1, away: 0 });
  });
});

describe('endGoalPause', () => {
  it('endGoalPause makes the next step kick off', () => {
    const m = playing();
    stepMatch(m, STEP, 'right');
    expect(m.phase).toBe('goal');
    stepMatch(m, STEP, null);
    expect(m.phase).toBe('goal');
    endGoalPause(m);
    expect(stepMatch(m, STEP, null).resetForKickoff).toBe(true);
    expect(m.phase).toBe('kickoff');
  });

  it('after a golden goal it goes to full time', () => {
    const m = playing({ goldenGoal: true, clockS: 90 });
    stepMatch(m, STEP, 'right');
    endGoalPause(m);
    stepMatch(m, STEP, null);
    expect(m.phase).toBe('fullTime');
    expect(m.result).toBe('win');
  });

  it('does nothing outside the goal pause', () => {
    const m = playing();
    endGoalPause(m);
    expect(m.phaseT).toBe(0);
  });
});

describe('match lengths and the countdown', () => {
  it('counts down from 1:30, showing 0:00 only at full time', () => {
    expect(clockText(playing({ clockS: 0 }))).toEqual({ text: '1:30', golden: false });
    expect(clockText(playing({ clockS: 0.5 })).text).toBe('1:30');
    expect(clockText(playing({ clockS: 89.5 })).text).toBe('0:01');
    expect(clockText(playing({ clockS: 90 })).text).toBe('0:00');
  });

  it('a 120-second match counts down from 2:00 and ends at 120 s', () => {
    const m = { ...createMatch(120, 60), phase: 'playing' as const, score: { home: 1, away: 0 } };
    expect(clockText(m).text).toBe('2:00');
    run(m, 119.9);
    expect(m.phase).toBe('playing');
    run(m, 0.2);
    expect(m.phase).toBe('fullTime');
  });

  it('golden goal at the School counts 1:00 down in gold, then a draw', () => {
    const m = { ...createMatch(120, 60), phase: 'playing' as const };
    run(m, 120);
    expect(m.goldenGoal).toBe(true);
    expect(clockText(m)).toEqual({ text: '1:00', golden: true });
    run(m, 60);
    expect(m.result).toBe('draw');
  });

  it('golden goal in a 90-second match counts 0:45 down', () => {
    expect(clockText(playing({ clockS: 90, goldenGoal: true, goldenS: 0 }))).toEqual({ text: '0:45', golden: true });
    expect(clockText(playing({ clockS: 90, goldenGoal: true, goldenS: 45 }))).toEqual({ text: '0:00', golden: true });
  });

  it('the game minute scales with the match length', () => {
    expect(clockMinute({ ...createMatch(120, 60), clockS: 60 })).toBe(45);
    expect(clockMinute(playing({ clockS: 45 }))).toBe(45);
  });
});
