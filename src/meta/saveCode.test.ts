import { describe, expect, it } from 'vitest';
import { EXTRA_IDS, GIFTS, LOCKER_ITEMS } from './locker';
import { newProfile, type Profile } from './profile';
import { decodeFields, decodeSaveCode, encodeFields, encodeSaveCode, groupCode, normaliseCode } from './saveCode';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A save with something in every field, both unlocks owned. */
const RICH: Profile = {
  version: 7,
  name: 'NORMAL RUN',
  difficulty: 'hard',
  coins: 840,
  level: 6,
  xp: 125,
  stats: { speed: 4, power: 3, jump: 2, control: 5, stamina: 7 },
  ladderWins: 4,
  dailyWinDate: '2026-10-25',
  totals: { matches: 23, wins: 14, draws: 3, losses: 6, goalsFor: 51, goalsAgainst: 27, styleGoals: 9, xpEarned: 2140 },
  powerMoves: { owned: ['energyWave'], equipped: 'energyWave' },
  powerForms: { owned: ['golden'], equipped: 'golden' },
  career: { stars: { 'backyard-1': 1, 'backyard-2': 1, 'backyard-3': 3, 'backyard-4': 2 }, milestonesPaid: 1, lossStreaks: { 'backyard-boss': 2 } },
  locker: { bought: [], kit: 'home', boots: 'volt', extras: [], seen: [] },
};

const EMPTY_LOCKER: Profile['locker'] = { bought: [], kit: 'home', boots: 'volt', extras: [], seen: [] };

/** Everything bought, every gift earned and seen, the GOLD kit and boots and all four extras on. */
const DRESSED: Profile = {
  ...RICH,
  career: { ...RICH.career, milestonesPaid: 4 },
  locker: {
    bought: LOCKER_ITEMS.filter(i => typeof i.source === 'object' && 'price' in i.source).map(i => i.id),
    kit: 'gold',
    boots: 'gold',
    extras: [...EXTRA_IDS],
    seen: [...GIFTS],
  },
};

/** The Park playtest's code, from a v4 build: Park 1-4 beaten, stats 7/5/4/5. */
const PARK_PLAYTEST = '0K80Y-1G00W-2G818-A0000-00000-00000-00000-G20G2-08104-0G208-10408-10010-40820-001GA-0';

/** What a code with no career fields loads: the retro star per ladder win and nothing else. */
const RETRO_ONLY = { stars: { 'backyard-1': 1, 'backyard-2': 1, 'backyard-3': 1, 'backyard-4': 1 }, milestonesPaid: 0, lossStreaks: {} };

describe('save code', () => {
  it('a profile survives a round trip', () => {
    expect(decodeSaveCode(encodeSaveCode(RICH), RICH)).toEqual(RICH);
  });

  it('a new profile survives a round trip', () => {
    expect(decodeSaveCode(encodeSaveCode(newProfile()), newProfile())).toEqual(newProfile());
  });

  it('the code appends Stamina, then difficulty, and keeps four stats in their old place', () => {
    const f = decodeFields(encodeSaveCode(RICH))!;
    expect(f).toHaveLength(58);
    expect([f[41], f[42]]).toEqual([7, 3]);
    expect(f.slice(4, 8)).toEqual([4, 3, 2, 5]);
  });

  it('the name stays with the save', () => {
    expect(decodeSaveCode(encodeSaveCode(RICH), { ...newProfile(), name: 'ZED' })).toEqual({ ...RICH, name: 'ZED' });
  });

  it("a v4 code gets Stamina 1 and keeps the save's difficulty", () => {
    const f = decodeFields(encodeSaveCode(RICH))!;
    const p = decodeSaveCode(encodeFields([4, ...f.slice(1, 41)]), { ...newProfile(), difficulty: 'easy' });
    expect(p).toEqual({ ...RICH, name: 'HARRISON', difficulty: 'easy', stats: { ...RICH.stats, stamina: 1 } });
  });

  it('a difficulty of 0 or out of range is none', () => {
    const f = decodeFields(encodeSaveCode(RICH))!;
    for (const d of [0, 9]) expect(decodeSaveCode(encodeFields([...f.slice(0, 42), d]), { ...newProfile(), difficulty: 'easy' })?.difficulty, `${d}`).toBe('easy');
  });

  it('the Park playtest code still loads', () => {
    const p = decodeSaveCode(PARK_PLAYTEST, newProfile())!;
    expect(p.career.stars).toMatchObject({ 'park-1': 2, 'park-2': 2, 'park-3': 1, 'park-4': 2 });
    expect(p.stats).toEqual({ speed: 7, power: 5, jump: 4, control: 5, stamina: 1 });
    expect([p.coins, p.level, p.name, p.difficulty]).toEqual([2000, 6, 'HARRISON', 'normal']);
  });

  it('the Park playtest code (v4) loads with an empty locker', () => {
    expect(decodeSaveCode(PARK_PLAYTEST, newProfile())?.locker).toEqual(EMPTY_LOCKER);
  });

  it('the first field is 7', () => {
    expect(decodeFields(encodeSaveCode(newProfile()))?.[0]).toBe(7);
  });

  it('a full locker round-trips', () => {
    expect(decodeSaveCode(encodeSaveCode(DRESSED), DRESSED)).toEqual(DRESSED);
  });

  it('the locker follows the difficulty: bought, kit, boots, extras, seen', () => {
    const f = decodeFields(encodeSaveCode(DRESSED))!;
    expect(f.slice(43, 48)).toEqual([0b11_0001_1111_1001_1111_1100, 10, 9, 0b1111, 0b1111]);
  });

  it('a v5 code loads with an empty locker', () => {
    const f = decodeFields(encodeSaveCode(DRESSED))!;
    expect(decodeSaveCode(encodeFields([5, ...f.slice(1, 43)]), DRESSED)).toEqual({ ...DRESSED, locker: EMPTY_LOCKER });
  });

  it('only the alphabet and dashes appear, in groups of 5', () => {
    for (const p of [RICH, newProfile()]) {
      const code = encodeSaveCode(p);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{1,5}(-[0-9A-HJKMNP-TV-Z]{1,5})*$/);
      expect(code.split('-').slice(0, -1).every(g => g.length === 5)).toBe(true);
    }
  });

  it('lowercase, spaces, missing dashes and O for 0 still decode', () => {
    const code = encodeSaveCode(RICH);
    const typed = code.toLowerCase().replaceAll('-', ' ').replaceAll('0', 'o').replaceAll('1', 'l');
    expect(decodeSaveCode(typed, RICH)).toEqual(RICH);
    expect(decodeSaveCode(code.replaceAll('-', ''), RICH)).toEqual(RICH);
  });

  it('one wrong character fails the checksum', () => {
    const chars = normaliseCode(encodeSaveCode(RICH));
    for (let i = 0; i < chars.length; i++) {
      const swapped = ALPHABET[(ALPHABET.indexOf(chars[i]) + 1) % ALPHABET.length];
      expect(decodeSaveCode(chars.slice(0, i) + swapped + chars.slice(i + 1), RICH), `position ${i}`).toBeNull();
    }
  });

  it('empty and junk input decode to null', () => {
    for (const junk of ['', '----', 'HELLO']) expect(decodeSaveCode(junk, RICH), junk).toBeNull();
  });

  it('a code from a newer build with an extra field still loads', () => {
    const fields = decodeFields(encodeSaveCode(RICH));
    expect(fields).not.toBeNull();
    const newer = [7, ...(fields ?? []).slice(1), 77];
    expect(decodeSaveCode(encodeFields(newer), RICH)).toEqual(RICH);
  });

  it('a code from an older build missing the last fields loads them as defaults', () => {
    const fields = decodeFields(encodeSaveCode(RICH)) ?? [];
    const older = decodeSaveCode(encodeFields(fields.slice(0, 18)), RICH);
    expect(older).toEqual({ ...RICH, stats: { ...RICH.stats, stamina: 1 }, powerMoves: { owned: [], equipped: null }, powerForms: { owned: ['golden'], equipped: 'golden' }, career: RETRO_ONLY });
  });

  it('a v2 code loads with the retro stars and nothing else', () => {
    const fields = decodeFields(encodeSaveCode(RICH)) ?? [];
    const v2 = decodeSaveCode(encodeFields([2, ...fields.slice(1, 22)]), RICH);
    expect(v2?.career).toEqual(RETRO_ONLY);
  });

  it('the Park stars and Sam\'s loss streak survive a round trip', () => {
    const p: Profile = { ...RICH, ladderWins: 10, career: { stars: { ...RICH.career.stars, 'backyard-boss': 2, 'park-1': 3, 'park-2': 2, 'park-3': 1, 'park-4': 3, 'park-boss': 1 }, milestonesPaid: 2, lossStreaks: { 'backyard-boss': 1, 'park-boss': 2 } } };
    const back = decodeSaveCode(encodeSaveCode(p), p);
    expect(back?.career.stars).toMatchObject({ 'park-1': 3, 'park-2': 2, 'park-3': 1, 'park-4': 3, 'park-boss': 1 });
    expect(back?.career.lossStreaks).toEqual({ 'backyard-boss': 1, 'park-boss': 2 });
  });

  it('a v3 code, without the Park fields, applies with no Park stars', () => {
    const p: Profile = { ...RICH, career: { ...RICH.career, stars: { ...RICH.career.stars, 'park-1': 3 }, lossStreaks: { 'park-boss': 4 } } };
    const fields = decodeFields(encodeSaveCode(p)) ?? [];
    const v3 = decodeSaveCode(encodeFields([3, ...fields.slice(1, 35)]), RICH);
    expect(v3?.version).toBe(7);
    expect(v3?.career.stars).toEqual(RICH.career.stars);
    expect(v3?.career.lossStreaks).toEqual({});
  });

  it("the School stars and Gus's loss streak survive a round trip", () => {
    const school = { 'school-1': 3, 'school-2': 2, 'school-3': 1, 'school-4': 3, 'school-5': 1, 'school-6': 2, 'school-7': 3, 'school-8': 1, 'school-boss': 2 };
    const p: Profile = { ...RICH, ladderWins: 10, career: { stars: { ...RICH.career.stars, ...school }, milestonesPaid: 2, lossStreaks: { 'backyard-boss': 1, 'school-boss': 4 } } };
    const back = decodeSaveCode(encodeSaveCode(p), p);
    expect(back?.career.stars).toMatchObject(school);
    expect(back?.career.lossStreaks).toEqual({ 'backyard-boss': 1, 'school-boss': 4 });
  });

  it('a v6 code, without the School fields, applies with no School stars and no Gus streak', () => {
    const p: Profile = { ...RICH, career: { ...RICH.career, stars: { ...RICH.career.stars, 'school-1': 3, 'school-boss': 1 }, lossStreaks: { 'school-boss': 4 } } };
    const fields = decodeFields(encodeSaveCode(p)) ?? [];
    const v6 = decodeSaveCode(encodeFields([6, ...fields.slice(1, -10)]), RICH);
    expect(v6?.version).toBe(7);
    expect(v6?.career.stars).toEqual(RICH.career.stars);
    expect(v6?.career.lossStreaks).toEqual({});
  });

  it('rung loss streaks do not travel, the boss streak does', () => {
    const p = { ...RICH, career: { ...RICH.career, lossStreaks: { 'backyard-3': 4, 'backyard-boss': 2 } } };
    expect(decodeSaveCode(encodeSaveCode(p), p)?.career.lossStreaks).toEqual({ 'backyard-boss': 2 });
  });

  it('a tampered code that passes the checksum loads clamped', () => {
    const fields = decodeFields(encodeSaveCode(RICH)) ?? [];
    const tampered = [...fields];
    tampered[3] = 2 ** 40;
    for (const i of [4, 5, 6, 7, 41]) tampered[i] = 99;
    const p = decodeSaveCode(encodeFields(tampered), RICH);
    expect(p?.xp).toBe(1_000_000);
    expect(p?.stats).toEqual({ speed: 10, power: 10, jump: 10, control: 10, stamina: 10 });
  });

  it('normalises and groups typed text', () => {
    expect(normaliseCode('ab-cd oi l u!')).toBe('ABCD011');
    expect(groupCode('ABCDEFGHJKM')).toBe('ABCDE-FGHJK-M');
    expect(groupCode('')).toBe('');
  });
});
