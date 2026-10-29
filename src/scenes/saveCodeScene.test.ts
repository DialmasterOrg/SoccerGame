import { describe, expect, it } from 'vitest';
import type { InputFrame } from '../engine/input';
import { newProfile, type Profile } from '../meta/profile';
import { decodeFields, encodeFields, encodeSaveCode } from '../meta/saveCode';
import { BACKYARD, PARK, SCHOOL } from '../meta/career';
import { EXTRA_IDS, GIFTS, LOCKER_ITEMS } from '../meta/locker';
import { MAX_ENTRY, codeLines, createSaveCodeScene } from './saveCodeScene';
import type { Scene } from './scene';
import { testContext } from './testContext';
import { frame } from './testInput';

const STEP = 1 / 60;
const BEHIND: Scene = { kind: 'options', update: () => null, draw: () => {} };
const BAD = "THAT CODE DOESN'T WORK";

/** Four ladder wins, each with at least its star, so loading the code adds nothing: 7 stars in all. */
const OTHER: Profile = {
  ...newProfile(),
  coins: 840,
  level: 6,
  ladderWins: 4,
  powerForms: { owned: ['golden'], equipped: 'golden' },
  career: { stars: { 'backyard-1': 1, 'backyard-2': 3, 'backyard-3': 2, 'backyard-4': 1 }, milestonesPaid: 0, lossStreaks: {} },
};

/** A frame with this text typed. */
const typing = (text: string): InputFrame => ({ ...frame(), typed: text });

/** Opens the screen and goes to the entry stage. */
function entering(profile = newProfile()) {
  const ctx = testContext({ profile });
  const s = createSaveCodeScene(ctx, () => BEHIND);
  s.update(frame(['confirm']), STEP);
  return { ctx, s };
}

describe('save code screen', () => {
  it('opening copies the code', async () => {
    const ctx = testContext({ profile: OTHER });
    const s = createSaveCodeScene(ctx, () => BEHIND);
    expect(s.code).toBe(encodeSaveCode(OTHER));
    expect(ctx.copied).toEqual([encodeSaveCode(OTHER)]);
    expect(s.status).toBe('WRITE IT DOWN OR TAKE A PHOTO');
    await Promise.resolve();
    expect(s.status).toBe('COPIED TO THE CLIPBOARD');
  });

  it('a failed copy still shows the code and says to write it down', async () => {
    const ctx = testContext();
    ctx.copyText = async () => false;
    const s = createSaveCodeScene(ctx, () => BEHIND);
    await Promise.resolve();
    expect(s.status).toBe('WRITE IT DOWN OR TAKE A PHOTO');
    expect(s.code).toBe(encodeSaveCode(newProfile()));
  });

  it('the entry stage wants text, and the others do not', () => {
    const { s } = entering();
    expect([s.stage, s.wantsText]).toEqual(['enter', true]);
    s.update(frame(['back']), STEP);
    expect([s.stage, s.wantsText]).toEqual(['show', false]);
    s.update(frame(['confirm']), STEP);
    s.update(typing(encodeSaveCode(OTHER)), STEP);
    s.update(frame(['confirm']), STEP);
    expect([s.stage, s.wantsText]).toEqual(['confirm', false]);
  });

  it('typing a good code, Enter, then YES replaces the save', () => {
    const { ctx, s } = entering();
    s.update(typing(encodeSaveCode(OTHER).toLowerCase()), STEP);
    s.update(frame(['confirm']), STEP);
    expect(s.summary).toBe('LEVEL 6 - 840 COINS - LADDER 4/10 - STARS 7');
    s.update(frame(['down']), STEP);
    s.update(frame(['confirm']), STEP);
    expect(ctx.savedProfiles).toEqual([OTHER]);
    expect(s.stage).toBe('show');
    expect(s.code).toBe(encodeSaveCode(OTHER));
    expect(s.status).toBe('SAVE LOADED!');
  });

  /** Types `code`, then Enter and YES. */
  const apply = (s: Scene, code: string) => {
    s.update(typing(code), STEP);
    s.update(frame(['confirm']), STEP);
    s.update(frame(['down']), STEP);
    s.update(frame(['confirm']), STEP);
  };

  it("a code takes its difficulty and keeps the save's name", () => {
    const { ctx, s } = entering({ ...newProfile(), name: 'ZED', difficulty: 'easy' });
    apply(s, encodeSaveCode({ ...OTHER, difficulty: 'hard' }));
    expect(ctx.profile).toEqual({ ...OTHER, name: 'ZED', difficulty: 'hard' });
  });

  it("a v4 code keeps the save's difficulty", () => {
    const { ctx, s } = entering({ ...newProfile(), name: 'ZED', difficulty: 'easy' });
    const f = decodeFields(encodeSaveCode(OTHER))!;
    apply(s, encodeFields([4, ...f.slice(1, 41)]));
    expect([ctx.profile.name, ctx.profile.difficulty, ctx.profile.coins]).toEqual(['ZED', 'easy', OTHER.coins]);
  });

  it('NO is pre-selected, and confirming it changes nothing', () => {
    const { ctx, s } = entering();
    s.update(typing(encodeSaveCode(OTHER)), STEP);
    s.update(frame(['confirm']), STEP);
    expect(s.menu?.items).toEqual(['NO', 'YES']);
    expect(s.menu?.index).toBe(0);
    s.update(frame(['confirm']), STEP);
    expect(ctx.savedProfiles).toEqual([]);
    expect(s.stage).toBe('enter');
  });

  it("a bad code says THAT CODE DOESN'T WORK and changes nothing", () => {
    const { ctx, s } = entering();
    const code = encodeSaveCode(OTHER);
    s.update(typing(code.slice(0, -1) + (code.endsWith('Z') ? 'Y' : 'Z')), STEP);
    s.update(frame(['confirm']), STEP);
    expect(s.stage).toBe('enter');
    expect(s.status).toBe(BAD);
    expect(ctx.savedProfiles).toEqual([]);
  });

  it("Enter on an empty entry says THAT CODE DOESN'T WORK", () => {
    const { s } = entering();
    s.update(frame(['confirm']), STEP);
    expect(s.status).toBe(BAD);
  });

  it('backspace deletes, and typing on clears the error', () => {
    const { s } = entering();
    s.update(typing('ab-c'), STEP);
    expect(s.entry).toBe('ABC');
    s.update(typing('\b'), STEP);
    expect(s.entry).toBe('AB');
    s.update(frame(['confirm']), STEP);
    expect(s.status).toBe(BAD);
    s.update(typing('o'), STEP);
    expect([s.entry, s.status]).toEqual(['AB0', null]);
  });

  it('B on the show stage goes back', () => {
    const ctx = testContext();
    const s = createSaveCodeScene(ctx, () => BEHIND);
    expect(s.update(frame(['back']), STEP)).toBe(BEHIND);
  });
});

describe('codeLines', () => {
  it('shows a code big, four groups a line, and a very long one small in at most three lines', () => {
    const groups = (n: number) => Array.from({ length: n }, () => 'ABCDE').join('-');
    expect(codeLines(groups(11))).toMatchObject({ scale: 2, lines: [groups(4), groups(4), groups(3)] });
    const long = codeLines(groups(22));
    expect(long.scale).toBe(1);
    expect(long.lines.length).toBeLessThanOrEqual(3);
  });

  it('the longest code the loader can hold still fits on the screen and in the entry', () => {
    const max: Profile = {
      ...OTHER,
      difficulty: 'hard',
      stats: { speed: 10, power: 10, jump: 10, control: 10, stamina: 10 },
      coins: 999_999_999,
      xp: 1_000_000,
      level: 999,
      ladderWins: 10,
      dailyWinDate: '2099-12-31',
      totals: { matches: 999_999_999, wins: 999_999_999, draws: 999_999_999, losses: 999_999_999, goalsFor: 999_999_999, goalsAgainst: 999_999_999, styleGoals: 999_999_999, xpEarned: 999_999_999 },
      career: { stars: Object.fromEntries([...BACKYARD.matches, ...PARK.matches, ...SCHOOL.matches].map(m => [m.id, 3])), milestonesPaid: 4, lossStreaks: { 'backyard-boss': 99, 'park-boss': 99, 'school-boss': 99 } },
      locker: {
        bought: LOCKER_ITEMS.filter(i => typeof i.source === 'object' && 'price' in i.source).map(i => i.id),
        kit: 'gold',
        boots: 'gold',
        extras: [...EXTRA_IDS],
        seen: [...GIFTS],
      },
    };
    const shown = codeLines(encodeSaveCode(max));
    expect(shown.scale).toBe(1);
    expect(shown.lines.length).toBeLessThanOrEqual(5);
    expect(MAX_ENTRY).toBe(169);
    expect(normaliseLength(encodeSaveCode(max))).toBe(167);
    expect(normaliseLength(encodeSaveCode(max))).toBeLessThanOrEqual(MAX_ENTRY);
  });
});

const normaliseLength = (code: string) => code.replaceAll('-', '').length;
