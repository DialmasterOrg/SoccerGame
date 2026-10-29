import { describe, expect, it } from 'vitest';
import { measureText } from '../art/font';
import { BOSS_ID, PARK_BOSS_ID, grantRungStars, matchById, nextCareerMatch, type CareerMatch } from '../meta/career';
import type { GoalRecord, MatchSummary } from '../meta/economy';
import { nextMatch } from '../meta/ladder';
import { newProfile, type Profile } from '../meta/profile';
import { applyMatch } from '../meta/progress';
import { MILESTONES } from '../meta/milestones';
import { LINE_S, SKIP_GRACE_S, STAR_S, XP_FILL_S, bonusLine, careerLine, createResultsScene, footLines, milestoneLines, resultsItems, tallyAt, unlockLines, type ResultsScene } from './resultsScene';
import type { ShopScene } from './shopScene';
import { TEST_TODAY, testContext } from './testContext';
import { frame } from './testInput';
import type { VsScene } from './vsScene';

const STEP = 1 / 60;
const WIN_3_0: MatchSummary = { result: 'win', goalsFor: 3, goalsAgainst: 0, styleGoals: [], goals: [], steals: 0 };
const LOSS_0_2: MatchSummary = { result: 'lose', goalsFor: 0, goalsAgainst: 2, styleGoals: [], goals: [], steals: 0 };
const boss = matchById(BOSS_ID)!;
const g = (minute: number): GoalRecord => ({ minute, kind: 'shot', perfect: false, outsideBox: false, rebound: false });

/** A context whose profile has had `s` applied, as the match scene leaves it, and the reward for it. */
function after(s: MatchSummary, from: Profile = newProfile(), match: CareerMatch = nextCareerMatch(from)) {
  const { profile, reward } = applyMatch(from, s, match, TEST_TODAY);
  return { ctx: testContext({ profile }), reward };
}

function run(s: ResultsScene, seconds: number, held: Parameters<typeof frame>[1] = []) {
  let last = null;
  for (let i = 0; i < Math.round(seconds / STEP); i++) last = s.update(frame([], held), STEP) ?? last;
  return last;
}

describe('the tally', () => {
  it('shows a line every LINE_S, then the total, the XP and the level-up', () => {
    const { reward } = after(WIN_3_0);
    const n = reward.lines.length;
    expect(tallyAt(reward, LINE_S - 0.01).lines).toBe(0);
    expect(tallyAt(reward, LINE_S + 0.01).lines).toBe(1);
    expect(tallyAt(reward, n * LINE_S + 0.01)).toMatchObject({ lines: n, total: false });
    expect(tallyAt(reward, (n + 1) * LINE_S + 0.01)).toMatchObject({ total: true, xpDone: false, levelUp: false });
    const xpEnd = (n + 1) * LINE_S + XP_FILL_S;
    expect(tallyAt(reward, xpEnd + 0.01)).toMatchObject({ xpDone: true, levelUp: true, done: false });
    // A 3-0 win at rung 1 without its bonus is two stars: they light after the level-up beat.
    expect(reward.career.stars).toBe(2);
    expect(tallyAt(reward, xpEnd + LINE_S + 0.01)).toMatchObject({ stars: 0, starsDone: false, done: false });
    expect(tallyAt(reward, xpEnd + LINE_S + STAR_S + 0.01)).toMatchObject({ stars: 1, starsDone: false });
    expect(tallyAt(reward, xpEnd + LINE_S + STAR_S * 2 + 0.01)).toMatchObject({ stars: 2, starsDone: true, done: false });
    expect(tallyAt(reward, xpEnd + LINE_S + STAR_S * 2 + LINE_S + 0.01).done).toBe(true);
  });

  it('takes about 4 s with two stars', () => {
    const { reward } = after(WIN_3_0);
    expect(tallyAt(reward, 3.6).done).toBe(false);
    expect(tallyAt(reward, 3.8).done).toBe(true);
  });

  it('a loss has no star beat', () => {
    const { reward } = after(LOSS_0_2);
    expect(tallyAt(reward, 99)).toMatchObject({ stars: 0, starsDone: true, done: true });
    const n = reward.lines.length;
    expect(tallyAt(reward, (n + 1) * LINE_S + XP_FILL_S + LINE_S * 2 + 0.01).done).toBe(true);
  });

  it('without a level-up there is no level-up beat', () => {
    const { reward } = after(LOSS_0_2);
    expect(tallyAt(reward, 99)).toMatchObject({ done: true, levelUp: false });
  });
});

describe('results screen', () => {
  it('opening Results plays the result jingle', () => {
    for (const s of [WIN_3_0, LOSS_0_2]) {
      const { ctx, reward } = after(s);
      createResultsScene(ctx, reward);
      expect(ctx.audio.music).toBe(s.result);
    }
  });

  it('the tally shows a line every LINE_S with a coin tick', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, LINE_S * 2 + 0.05);
    expect(tallyAt(reward, LINE_S * 2 + 0.05).lines).toBe(2);
    expect(ctx.audio.played.filter(c => c === 'coin')).toHaveLength(2);
  });

  it('a level-up plays the fanfare once', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, 5);
    expect(s.tallyDone).toBe(true);
    expect(ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(1);
    expect(ctx.audio.played.filter(c => c === 'coin')).toHaveLength(reward.lines.length + 1);
  });

  it('stars light one per STAR_S after the XP beat, each with the chime, the third with the fanfare', () => {
    const { ctx, reward } = after({ ...WIN_3_0, goals: [g(10), g(20), g(30)] });
    expect(reward.career.stars).toBe(3);
    const s = createResultsScene(ctx, reward);
    const xpEnd = (reward.lines.length + 1) * LINE_S + XP_FILL_S;
    run(s, xpEnd + LINE_S + STAR_S * 2 + 0.05);
    expect(ctx.audio.played.filter(c => c === 'star')).toHaveLength(2);
    expect(ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(1);
    run(s, STAR_S);
    expect(ctx.audio.played.filter(c => c === 'star')).toHaveLength(3);
    expect(ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(2);
    expect(s.tallyDone).toBe(false);
    run(s, LINE_S + 0.05);
    expect(s.tallyDone).toBe(true);
  });

  it('a skip sounds the third star fanfare once, and a two-star win never does', () => {
    const three = after({ ...WIN_3_0, goals: [g(10), g(20), g(30)] });
    const s = createResultsScene(three.ctx, three.reward);
    s.update(frame(['confirm']), STEP);
    expect(three.ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(2);
    const two = after(WIN_3_0);
    createResultsScene(two.ctx, two.reward).update(frame(['confirm']), STEP);
    expect(two.ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(1);
  });

  it('a fresh A skips to the end without choosing', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, 0.1);
    expect(s.update(frame(['confirm']), STEP)).toBeNull();
    expect(s.tallyDone).toBe(true);
    expect(s.menu).not.toBeNull();
    expect(s.menu!.index).toBe(0);
    expect(ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(1);
  });

  it('X and Enter skip too', () => {
    for (const pressed of [['shoot'], ['pause', 'confirm']] as const) {
      const { ctx, reward } = after(WIN_3_0);
      const s = createResultsScene(ctx, reward);
      expect(s.update(frame(pressed), STEP)).toBeNull();
      expect(s.tallyDone).toBe(true);
    }
  });

  it('held buttons do not skip', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, 1, ['shoot']);
    run(s, 0.5, ['confirm']);
    expect(s.tallyDone).toBe(tallyAt(reward, 1.5).done);
    expect(s.tallyDone).toBe(false);
  });

  it('NEXT MATCH plays the next ladder match', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, 5);
    expect(s.menu!.items).toEqual(['NEXT MATCH', 'SHOP', 'HUB']);
    const next = s.update(frame(['confirm']), STEP) as VsScene;
    expect(next.kind).toBe('vs');
    expect(next.match.rung).toBe(nextMatch(ctx.profile.ladderWins));
    expect(next.match.id).toBe('backyard-2');
    expect(ctx.savedProfiles).toHaveLength(0);
  });

  it('a loss offers TRY AGAIN, which replays the same match', () => {
    const { ctx, reward } = after(LOSS_0_2, { ...newProfile(), ladderWins: 4 });
    expect(resultsItems(reward)).toEqual(['TRY AGAIN', 'SHOP', 'HUB']);
    const s = createResultsScene(ctx, reward, true);
    expect((s.update(frame(['confirm']), STEP) as VsScene).match.id).toBe('backyard-5');
  });

  it('SHOP and back returns to Results, done, with no second save', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, 5);
    s.update(frame(['down']), STEP);
    const shop = s.update(frame(['confirm']), STEP) as ShopScene;
    expect(shop.kind).toBe('shop');
    const back = shop.update(frame(['back']), STEP) as ResultsScene;
    expect(back.kind).toBe('results');
    expect(back.tallyDone).toBe(true);
    expect(back.menu!.index).toBe(1);
    run(back, 5);
    expect(ctx.savedProfiles).toHaveLength(0);
  });

  it('coming back from the Shop does not replay the level-up fanfare', () => {
    const { ctx, reward } = after(WIN_3_0);
    let s = createResultsScene(ctx, reward);
    run(s, 5);
    for (let trip = 0; trip < 2; trip++) {
      s.update(frame(['down']), STEP);
      const shop = s.update(frame(['confirm']), STEP)!;
      s = shop.update(frame(['back']), STEP) as ResultsScene;
      s.update(frame(['up']), STEP);
    }
    expect(ctx.audio.played.filter(c => c === 'levelUp')).toHaveLength(1);
  });

  it('UPGRADE READY follows what he can afford now, after the Shop too', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    run(s, 5);
    expect(s.upgradeReady).toBe(true);
    s.update(frame(['down']), STEP);
    const shop = s.update(frame(['confirm']), STEP)!;
    shop.update(frame(['confirm']), STEP);
    expect(ctx.profile.coins).toBe(60);
    const back = shop.update(frame(['back']), STEP) as ResultsScene;
    expect(back.upgradeReady).toBe(false);
  });

  it('no UPGRADE READY when he cannot afford one', () => {
    const { ctx, reward } = after(LOSS_0_2);
    expect(createResultsScene(ctx, reward, true).upgradeReady).toBe(false);
  });

  it('B goes to the Hub with the back blip, even mid-tally', () => {
    for (const pressed of [['back'], ['pause', 'back']] as const) {
      const { ctx, reward } = after(WIN_3_0);
      const s = createResultsScene(ctx, reward);
      expect(s.update(frame(pressed), STEP)?.kind).toBe('hub');
      expect(ctx.audio.played).toContain('menuBack');
    }
  });

  it('Start confirms once the tally is done', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward, true);
    expect(s.update(frame(['pause']), STEP)?.kind).toBe('vs');
  });
});

/** A profile with Biscuit beaten and these Park stars. */
const inPark = (stars: Record<string, number> = {}) => ({ ...newProfile(), ladderWins: 10, career: { stars: { [BOSS_ID]: 1, ...stars }, milestonesPaid: 0, lossStreaks: {} } });
const PARK_FOUR = { 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1 };

describe('careerLine in the Park', () => {
  it('a first win at a crew match names it; the last one sends him to Sam; beating Sam finishes the Park', () => {
    expect(careerLine(after(WIN_3_0, inPark(), matchById('park-1')!).reward)).toBe('MATCH 1 BEATEN!');
    expect(careerLine(after(WIN_3_0, inPark({ 'park-1': 1, 'park-2': 1, 'park-3': 1 }), matchById('park-4')!).reward)).toBe('SPEEDY SAM AWAITS!');
    expect(careerLine(after(WIN_3_0, inPark(PARK_FOUR), matchById(PARK_BOSS_ID)!).reward)).toBe('SAM BEATEN! THE PARK DONE!');
  });

  it('a loss to a kid names them', () => {
    expect(careerLine(after(LOSS_0_2, inPark(), matchById('park-1')!).reward)).toBe('BRICK TAKES THIS ONE. GO AGAIN!');
  });

  it('after beating Sam, NEXT MATCH becomes CAREER', () => {
    const done = after(WIN_3_0, inPark(PARK_FOUR), matchById(PARK_BOSS_ID)!);
    expect(resultsItems(done.reward)).toEqual(['CAREER', 'SHOP', 'HUB']);
    expect(createResultsScene(done.ctx, done.reward, true).update(frame(['confirm']), STEP)?.kind).toBe('roadMap');
  });
});

describe('careerLine', () => {
  it('names a beaten match, the championship and the boss beaten', () => {
    expect(careerLine(after(WIN_3_0, { ...newProfile(), ladderWins: 2 }).reward)).toBe('MATCH 3 BEATEN!');
    expect(careerLine(after(WIN_3_0, { ...newProfile(), ladderWins: 9 }).reward)).toBe('BACKYARD CHAMPION! BISCUIT AWAITS');
    expect(careerLine(after(WIN_3_0, { ...newProfile(), ladderWins: 10 }, boss).reward)).toBe('BISCUIT BEATEN! BACKYARD DONE!');
  });

  it('a replay win is a new best when its stars rose, else a rematch won', () => {
    const replay = (star: number) => after(WIN_3_0, { ...newProfile(), ladderWins: 3, career: { stars: { 'backyard-1': star }, milestonesPaid: 0, lossStreaks: {} } }, matchById('backyard-1')!).reward;
    expect(careerLine(replay(3))).toBe('REMATCH WON!');
    expect(careerLine(replay(1))).toBe('NEW BEST: 2 STARS!');
  });

  it('a draw or a loss says go again, naming who took it', () => {
    expect(careerLine(after(LOSS_0_2).reward)).toBe('MAX TAKES THIS ONE. GO AGAIN!');
    expect(careerLine(after(LOSS_0_2, { ...newProfile(), ladderWins: 10 }, boss).reward)).toBe('BISCUIT TAKES THIS ONE. GO AGAIN!');
    expect(careerLine(after({ result: 'draw', goalsFor: 1, goalsAgainst: 1, styleGoals: [], goals: [], steals: 0 }).reward)).toBe('ALL SQUARE. GO AGAIN!');
  });

  it('bonus and milestone lines', () => {
    const { reward } = after({ ...WIN_3_0, goals: [g(10), g(20), g(30)] });
    expect(bonusLine(reward)).toBe('BONUS DONE: SCORE 3 GOALS');
    expect(bonusLine(after(LOSS_0_2).reward)).toBe('BONUS MISSED: SCORE 3 GOALS');
    const paid = after(LOSS_0_2, grantRungStars({ ...newProfile(), ladderWins: 10 }), boss).reward;
    expect(milestoneLines(paid)).toEqual(['10 STARS! +300 COINS', "NEW IN THE LOCKER ROOM: CAPTAIN'S ARMBAND"]);
    expect(milestoneLines(reward)).toEqual([]);
    // Three lines at most: the gift's line takes UPGRADE READY's place.
    expect(footLines(paid, tallyAt(paid, Infinity), true)).toEqual(['BISCUIT TAKES THIS ONE. GO AGAIN!', '10 STARS! +300 COINS', "NEW IN THE LOCKER ROOM: CAPTAIN'S ARMBAND"]);
  });

  it("a milestone with a gift adds its line after the milestone's", () => {
    const { reward } = after(WIN_3_0);
    const at25 = { ...reward, career: { ...reward.career, milestones: [MILESTONES[1]!] } };
    expect(milestoneLines(at25)).toEqual(['25 STARS! +600 COINS', 'NEW IN THE LOCKER ROOM: LIGHTNING BOOTS']);
  });

  it('NEXT MATCH plays the next unbeaten match; TRY AGAIN replays this one; Biscuit leads on to the Park', () => {
    const next = after(WIN_3_0, { ...newProfile(), ladderWins: 3 }, matchById('backyard-1')!);
    expect(resultsItems(next.reward)[0]).toBe('NEXT MATCH');
    const s = createResultsScene(next.ctx, next.reward, true);
    expect((s.update(frame(['confirm']), STEP) as VsScene).match.id).toBe('backyard-4');
    const lost = after(LOSS_0_2, { ...newProfile(), ladderWins: 10 }, boss);
    expect(resultsItems(lost.reward)[0]).toBe('TRY AGAIN');
    expect((createResultsScene(lost.ctx, lost.reward, true).update(frame(['confirm']), STEP) as VsScene).match.id).toBe('backyard-boss');
    const biscuit = after(WIN_3_0, { ...newProfile(), ladderWins: 10 }, boss);
    expect(resultsItems(biscuit.reward)[0]).toBe('NEXT MATCH');
    expect((createResultsScene(biscuit.ctx, biscuit.reward, true).update(frame(['confirm']), STEP) as VsScene).match.id).toBe('park-1');
  });
});

describe('results: unlocks and the skip grace', () => {
  it('unlock lines show with the level-up', () => {
    const { reward } = after(WIN_3_0, { ...newProfile(), level: 2, xp: 140 });
    expect(unlockLines(reward)).toEqual(['ENERGY WAVE UNLOCKED IN THE SHOP!']);
    const before = tallyAt(reward, (reward.lines.length + 1) * LINE_S);
    expect(footLines(reward, before, false)).toEqual([]);
    const levelUp = tallyAt(reward, (reward.lines.length + 1) * LINE_S + XP_FILL_S);
    expect(footLines(reward, levelUp, false)).toEqual(['ENERGY WAVE UNLOCKED IN THE SHOP!']);
    expect(footLines(reward, tallyAt(reward, Infinity), true)).toEqual([careerLine(reward), 'ENERGY WAVE UNLOCKED IN THE SHOP!', 'UPGRADE READY IN THE SHOP!']);
  });

  it('a gift line gives way to an unlock when both come in one match', () => {
    const { reward } = after(WIN_3_0, grantRungStars({ ...newProfile(), ladderWins: 10, level: 2, xp: 140 }), boss);
    expect(footLines(reward, tallyAt(reward, Infinity), false)).toEqual(['BISCUIT BEATEN! BACKYARD DONE!', '10 STARS! +300 COINS', 'ENERGY WAVE UNLOCKED IN THE SHOP!']);
  });

  it('the skill moves and Golden Form are announced too, and all together still fit three lines', () => {
    const { reward } = after(WIN_3_0, { ...newProfile(), level: 2, xp: 790 });
    expect(unlockLines(reward)).toEqual(['ENERGY WAVE UNLOCKED IN THE SHOP!', 'NEW MOVES: STEPOVER + RAINBOW FLICK', 'GOLDEN FORM UNLOCKED!']);
    expect(footLines(reward, tallyAt(reward, Infinity), true)).toHaveLength(3);
  });

  it('a confirm 0.1 s after skipping the tally does not pick NEXT MATCH', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    s.update(frame(['confirm']), STEP);
    run(s, 0.1);
    expect(s.update(frame(['confirm']), STEP)).toBeNull();
    expect(s.update(frame(['shoot']), STEP)).toBeNull();
  });

  it('a confirm after the grace picks it', () => {
    const { ctx, reward } = after(WIN_3_0);
    const s = createResultsScene(ctx, reward);
    s.update(frame(['confirm']), STEP);
    run(s, SKIP_GRACE_S + 0.05);
    expect(s.update(frame(['confirm']), STEP)?.kind).toBe('vs');
  });
});

describe('results: the skill moves unlock', () => {
  it('reads NEW MOVES: STEPOVER + RAINBOW FLICK on the level-up into 4, and fits the screen', () => {
    const { reward } = after(WIN_3_0, { ...newProfile(), level: 3, xp: 150 });
    expect(unlockLines(reward)).toEqual(['NEW MOVES: STEPOVER + RAINBOW FLICK']);
    expect(measureText('NEW MOVES: STEPOVER + RAINBOW FLICK')).toBeLessThanOrEqual(300);
  });
});
