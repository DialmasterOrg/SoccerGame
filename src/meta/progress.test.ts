import { describe, expect, it } from 'vitest';
import { BOSS_ID, grantRungStars, matchById, rungId, type CareerMatch } from './career';
import type { MatchSummary } from './economy';
import { newProfile, type Profile } from './profile';
import { applyMatch, localDate } from './progress';

const TODAY = '2026-10-23';
const shot = (minute: number) => ({ minute, kind: 'shot', perfect: false, outsideBox: false, rebound: false }) as const;
const win30: MatchSummary = { result: 'win', goalsFor: 3, goalsAgainst: 0, styleGoals: [], goals: [shot(10), shot(40), shot(70)], steals: 0 };
const loss03: MatchSummary = { result: 'lose', goalsFor: 0, goalsAgainst: 3, styleGoals: [], goals: [], steals: 0 };
const rung = (n: number) => matchById(rungId(n))!;
const boss = matchById(BOSS_ID)!;
const labels = (p: Profile, s: MatchSummary, match: CareerMatch, today = TODAY) => applyMatch(p, s, match, today).reward.lines.map(l => l.label);

describe('applyMatch', () => {
  it("keeps the save's name and difficulty", () => {
    const { profile } = applyMatch({ ...newProfile(), name: 'ZED', difficulty: 'hard' }, win30, rung(1), TODAY);
    expect([profile.name, profile.difficulty]).toEqual(['ZED', 'hard']);
  });

  it('a first win pays, levels and advances the ladder', () => {
    const { profile, reward } = applyMatch(newProfile(), win30, rung(1), TODAY);
    expect(reward.lines.map(l => [l.label, l.coins])).toEqual([
      ['WIN', 60],
      ['3 GOALS', 30],
      ['CLEAN SHEET', 20],
      ['FIRST WIN TODAY', 50],
    ]);
    expect(reward.levelBonus).toBe(50);
    expect(reward.coins).toBe(210);
    expect(reward.xp).toBe(110);
    expect(reward.before).toEqual({ coins: 0, level: 1, xp: 0 });
    expect(reward.after).toEqual({ coins: 210, level: 2, xp: 10 });
    // Rung 1's bonus is SCORE 3 GOALS, and the three recorded goals do it: a 3-0 win is three stars there.
    expect(reward.career).toMatchObject({ stars: 3, bestBefore: 0, improved: true, bonusDone: true, firstWin: true, champion: false, allBeaten: false, milestones: [] });
    expect(reward.career.match.id).toBe('backyard-1');
    expect(profile.career.stars).toEqual({ 'backyard-1': 3 });
    expect(profile).toMatchObject({ coins: 210, level: 2, xp: 10, ladderWins: 1, dailyWinDate: TODAY });
    expect(profile.totals).toEqual({ matches: 1, wins: 1, draws: 0, losses: 0, goalsFor: 3, goalsAgainst: 0, styleGoals: 0, xpEarned: 110 });
  });

  it('counts style goals in the totals', () => {
    const { profile } = applyMatch(newProfile(), { result: 'win', goalsFor: 2, goalsAgainst: 1, styleGoals: ['header', 'chip'], goals: [], steals: 0 }, rung(1), TODAY);
    expect(profile.totals.styleGoals).toBe(2);
  });

  it('the daily bonus pays once a day', () => {
    const first = applyMatch(newProfile(), win30, rung(1), TODAY).profile;
    expect(labels(first, win30, rung(2))).not.toContain('FIRST WIN TODAY');
    expect(labels(first, win30, rung(2), '2026-10-24')).toContain('FIRST WIN TODAY');
  });

  it('a draw or a loss pays but does not advance the ladder or use the daily bonus', () => {
    const start = { ...newProfile(), ladderWins: 2 };
    for (const s of [loss03, { result: 'draw', goalsFor: 1, goalsAgainst: 1, styleGoals: [], goals: [], steals: 0 } as MatchSummary]) {
      const { profile, reward } = applyMatch(start, s, rung(3), TODAY);
      expect(reward.coins).toBeGreaterThan(0);
      expect(profile.ladderWins).toBe(2);
      expect(reward.career).toMatchObject({ stars: 0, improved: false, firstWin: false, champion: false });
      expect(profile.career.stars).toEqual({ 'backyard-1': 1, 'backyard-2': 1 });
      expect(profile.dailyWinDate).toBeNull();
    }
    expect(applyMatch(start, loss03, rung(3), TODAY).profile.totals).toMatchObject({ matches: 1, losses: 1, goalsAgainst: 3 });
  });

  it('winning match 10 makes him champion, and a rematch win stays at 10', () => {
    const champ = applyMatch({ ...newProfile(), ladderWins: 9 }, win30, rung(10), TODAY);
    expect(champ.reward.career).toMatchObject({ firstWin: true, champion: true, allBeaten: false });
    expect(champ.profile.ladderWins).toBe(10);
    const rematch = applyMatch(champ.profile, win30, rung(10), TODAY);
    expect(rematch.reward.career).toMatchObject({ firstWin: false, champion: false });
    expect(rematch.profile.ladderWins).toBe(10);
  });

  it('a win on an already-beaten match does not skip ahead', () => {
    const { profile, reward } = applyMatch({ ...newProfile(), ladderWins: 3 }, win30, rung(2), TODAY);
    expect(profile.ladderWins).toBe(3);
    expect(reward.career.firstWin).toBe(false);
  });

  it('three stars need the bonus and a two-goal margin together', () => {
    const header = { result: 'win', goalsFor: 2, goalsAgainst: 0, styleGoals: ['header'], goals: [{ minute: 10, kind: 'header', perfect: false, outsideBox: false, rebound: false }, { minute: 50, kind: 'shot', perfect: false, outsideBox: false, rebound: false }], steals: 0 } as const;
    const { profile, reward } = applyMatch({ ...newProfile(), ladderWins: 2 }, header, rung(3), TODAY);
    expect(reward.career).toMatchObject({ stars: 3, bonusDone: true, improved: true });
    expect(profile.career.stars['backyard-3']).toBe(3);
  });

  it('a bonus done in a loss is reported but banks nothing', () => {
    const { profile, reward } = applyMatch({ ...newProfile(), ladderWins: 2 }, { result: 'lose', goalsFor: 1, goalsAgainst: 2, styleGoals: ['header'], goals: [{ minute: 10, kind: 'header', perfect: false, outsideBox: false, rebound: false }], steals: 0 }, rung(3), TODAY);
    expect(reward.career).toMatchObject({ stars: 0, bonusDone: true, improved: false });
    expect(profile.career.stars['backyard-3']).toBeUndefined();
    expect(profile.career.lossStreaks).toEqual({ 'backyard-3': 1 });
  });

  it('a replay can only raise a star, and a win clears the loss streak', () => {
    const start = { ...newProfile(), ladderWins: 5, career: { stars: { 'backyard-2': 3 }, milestonesPaid: 0, lossStreaks: { 'backyard-2': 2 } } };
    const worse = applyMatch(start, { result: 'win', goalsFor: 1, goalsAgainst: 0, styleGoals: [], goals: [{ minute: 5, kind: 'shot', perfect: false, outsideBox: false, rebound: false }], steals: 0 }, rung(2), TODAY);
    expect(worse.profile.career.stars['backyard-2']).toBe(3);
    expect(worse.reward.career).toMatchObject({ stars: 1, bestBefore: 3, improved: false, firstWin: false });
    expect(worse.profile.career.lossStreaks).toEqual({});
    expect(worse.profile.ladderWins).toBe(5);
  });

  it('a draw leaves the loss streak as it was', () => {
    const start = { ...newProfile(), ladderWins: 10, career: { stars: {}, milestonesPaid: 0, lossStreaks: { [BOSS_ID]: 2 } } };
    const { profile } = applyMatch(start, { result: 'draw', goalsFor: 1, goalsAgainst: 1, styleGoals: [], goals: [], steals: 0 }, boss, TODAY);
    expect(profile.career.lossStreaks).toEqual({ [BOSS_ID]: 2 });
  });

  it('the boss is beaten by its star, which opens the Park, so not everything is beaten', () => {
    const { profile, reward } = applyMatch({ ...newProfile(), ladderWins: 10 }, win30, boss, TODAY);
    expect(profile.career.stars[BOSS_ID]).toBe(3);
    expect(reward.career).toMatchObject({ firstWin: true, allBeaten: false, champion: false, bonusDone: true });
    expect(profile.ladderWins).toBe(10);
  });

  it('three clean steals at park-3 settle its bonus', () => {
    const tia = matchById('park-3')!;
    const start = { ...newProfile(), ladderWins: 10, career: { stars: { [BOSS_ID]: 1 }, milestonesPaid: 0, lossStreaks: {} } };
    const won = { result: 'win', goalsFor: 2, goalsAgainst: 0, styleGoals: [], goals: [shot(10), shot(40)] } as const;
    expect(applyMatch(start, { ...won, steals: 3 }, tia, TODAY).reward.career.bonusDone).toBe(true);
    expect(applyMatch(start, { ...won, steals: 2 }, tia, TODAY).reward.career.bonusDone).toBe(false);
    expect(applyMatch(start, { ...won, steals: 3 }, tia, TODAY).profile.career.stars['park-3']).toBe(3);
  });

  it("Harrison's champion save pays the 10-star milestone once, at the next Results", () => {
    const champ = { ...newProfile(), ladderWins: 10 };
    const loaded = grantRungStars(champ);
    const first = applyMatch(loaded, loss03, boss, TODAY);
    expect(first.reward.career.milestones.map(m => m.coins)).toEqual([300]);
    expect(first.reward.coins).toBe(15 + 300);
    expect(first.profile.coins).toBe(315);
    expect(first.profile.career.milestonesPaid).toBe(1);
    const second = applyMatch(first.profile, loss03, boss, TODAY);
    expect(second.reward.career.milestones).toEqual([]);
  });

  it('a save with 60 stars and nothing paid is paid three milestones', () => {
    const stars = Object.fromEntries([...Array(10)].map((_, i) => [rungId(i + 1), 3]));
    // 33 stars is the Backyard's most; 60 takes a tampered save, so the boss gets 30.
    const tampered = { ...newProfile(), ladderWins: 10, career: { stars: { ...stars, [BOSS_ID]: 30 }, milestonesPaid: 0, lossStreaks: {} } };
    const { reward, profile } = applyMatch(tampered, loss03, boss, TODAY);
    expect(reward.career.milestones.map(m => m.index)).toEqual([0, 1, 2]);
    expect(profile.career.milestonesPaid).toBe(3);
  });

  it('several levels at once pay a bonus each', () => {
    const { reward } = applyMatch({ ...newProfile(), xp: 99 }, { result: 'win', goalsFor: 9, goalsAgainst: 0, styleGoals: Array(9).fill('header'), goals: [], steals: 0 }, rung(1), TODAY);
    // 60 + 90 + 135 + 20 = 305 XP on top of 99: past 100 and 150 more.
    expect(reward.after.level).toBe(3);
    expect(reward.levelBonus).toBe(100);
  });

  it('reaching level 3 announces the Energy Wave once', () => {
    const first = applyMatch({ ...newProfile(), level: 2, xp: 140 }, win30, rung(1), TODAY);
    expect(first.profile.level).toBe(3);
    expect(first.reward.unlocked).toEqual(['energyWave']);
    expect(applyMatch(first.profile, win30, rung(2), TODAY).reward.unlocked).not.toContain('energyWave');
  });

  it('jumping from level 2 to 6 announces every unlock in level order and grants Golden Form', () => {
    const { profile, reward } = applyMatch({ ...newProfile(), level: 2, xp: 790 }, win30, rung(1), TODAY);
    expect(profile.level).toBe(6);
    expect(reward.unlocked).toEqual(['energyWave', 'skillMoves', 'goldenForm']);
    expect(profile.powerForms).toEqual({ owned: ['golden'], equipped: 'golden' });
  });

  it('owning the move already means no Energy Wave unlock line', () => {
    const owner: Profile = { ...newProfile(), level: 2, xp: 140, powerMoves: { owned: ['energyWave'], equipped: 'energyWave' } };
    expect(applyMatch(owner, win30, rung(1), TODAY).reward.unlocked).toEqual([]);
  });

  it('applyMatch does not change its input', () => {
    const p = { ...newProfile(), coins: 40, ladderWins: 2 };
    const copy = structuredClone(p);
    applyMatch(p, win30, rung(3), TODAY);
    expect(p).toEqual(copy);
  });
});

describe('localDate', () => {
  it('localDate is the local calendar date', () => {
    expect(localDate(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03');
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('the skill moves unlock', () => {
  it('a match taking him from level 3 to 4 announces the stepover and the flick', () => {
    const { profile, reward } = applyMatch({ ...newProfile(), level: 3, xp: 150 }, win30, rung(1), TODAY);
    expect(profile.level).toBe(4);
    expect(reward.unlocked).toContain('skillMoves');
  });

  it('a match from 4 to 5 does not announce them again', () => {
    const { profile, reward } = applyMatch({ ...newProfile(), level: 4, xp: 200 }, win30, rung(1), TODAY);
    expect(profile.level).toBe(5);
    expect(reward.unlocked).not.toContain('skillMoves');
  });
});
