import { describe, expect, it } from 'vitest';
import type { Stats } from '../game/stats';
import { addXp } from './economy';
import { unseenGifts } from './locker';
import { LADDER_MATCHES, MAX_LOADED, PROFILE_KEY, PROFILE_VERSION, cleanName, isSave, nameChars, newProfile, profileFrom, type Profile } from './profile';
import { writeUnlessNewer } from './storage';
import { memoryStore } from './testStore';

const ZERO_TOTALS = { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, styleGoals: 0, xpEarned: 0 };

/** A save as v4 wrote it: no name, difficulty or Stamina. */
type V4Save = Omit<Profile, 'version' | 'name' | 'difficulty' | 'stats' | 'locker'> & { version: number; stats: Omit<Stats, 'stamina'> };

/** A v4 save with something in every field. */
const SOME: V4Save = {
  version: 4,
  coins: 420,
  level: 3,
  xp: 35,
  stats: { speed: 3, power: 2, jump: 1, control: 4 },
  ladderWins: 4,
  dailyWinDate: '2026-10-22',
  totals: { matches: 9, wins: 5, draws: 1, losses: 3, goalsFor: 17, goalsAgainst: 9, styleGoals: 4, xpEarned: 610 },
  powerMoves: { owned: ['energyWave'], equipped: 'energyWave' },
  powerForms: { owned: [], equipped: null },
  career: { stars: { 'backyard-1': 1, 'backyard-2': 1, 'backyard-3': 2, 'backyard-4': 3 }, milestonesPaid: 0, lossStreaks: { 'backyard-boss': 2 } },
};

/** Only the starters, HOME and VOLT on. */
const EMPTY_LOCKER: Profile['locker'] = { bought: [], kit: 'home', boots: 'volt', extras: [], seen: [] };

/** SOME as it loads on Normal. */
const LOADED: Profile = { ...SOME, version: 7, name: 'HARRISON', difficulty: 'normal', stats: { ...SOME.stats, stamina: 1 }, locker: EMPTY_LOCKER };
/** A v5 save with its own name, difficulty and Stamina. */
const OWN: Profile = { ...LOADED, name: 'NORMAL RUN', difficulty: 'hard', stats: { ...LOADED.stats, stamina: 7 } };

const NO_POWER = { owned: [], equipped: null };
const NO_CAREER = { stars: {}, milestonesPaid: 0, lossStreaks: {} };
/** The retro stars for four ladder wins. */
const FOUR_RETRO = { 'backyard-1': 1, 'backyard-2': 1, 'backyard-3': 1, 'backyard-4': 1 };

describe('profile', () => {
  it('a new profile, and a game-specific key', () => {
    expect(newProfile()).toEqual({
      version: 7,
      name: 'HARRISON',
      difficulty: 'normal',
      coins: 0,
      level: 1,
      xp: 0,
      stats: { speed: 1, power: 1, jump: 1, control: 1, stamina: 1 },
      ladderWins: 0,
      dailyWinDate: null,
      totals: ZERO_TOTALS,
      powerMoves: NO_POWER,
      powerForms: NO_POWER,
      career: NO_CAREER,
      locker: EMPTY_LOCKER,
    });
    expect(PROFILE_KEY.startsWith('harrisons-road-to-the-cup/')).toBe(true);
    expect(LADDER_MATCHES).toBe(10);
  });

  it('his live v4 save loads into v7 without loss', () => {
    expect(profileFrom(SOME, 'easy')).toEqual({ ...SOME, version: 7, name: 'HARRISON', difficulty: 'easy', stats: { ...SOME.stats, stamina: 1 }, locker: EMPTY_LOCKER });
  });

  it('a name loads cleaned, cut to 12, or as HARRISON when nothing is left', () => {
    expect(profileFrom({ ...OWN, name: 'bob the 2nd!' }, 'normal').name).toBe('BOB THE 2ND');
    expect(profileFrom({ ...OWN, name: 'ABCDEFGHIJKLMNOPQRST' }, 'normal').name).toBe('ABCDEFGHIJKL');
    for (const name of ['!!!', '   ', 7, undefined]) expect(profileFrom({ ...OWN, name }, 'normal').name, String(name)).toBe('HARRISON');
  });

  it("a difficulty loads, or falls back to the loader's", () => {
    expect(profileFrom({ ...OWN, difficulty: 'hard' }, 'easy').difficulty).toBe('hard');
    for (const difficulty of ['insane', 3, undefined]) expect(profileFrom({ ...OWN, difficulty }, 'easy').difficulty, String(difficulty)).toBe('easy');
  });

  it('Stamina loads from 1 to 10', () => {
    const at = (stamina: unknown) => profileFrom({ ...OWN, stats: { ...OWN.stats, stamina } }, 'normal').stats.stamina;
    expect([at(10), at(11), at(0), at('x')]).toEqual([10, 10, 1, 1]);
  });

  it('name helpers keep capitals, digits and spaces', () => {
    expect(nameChars('ab c-1!')).toBe('AB C1');
    expect(cleanName('  harrison  ')).toBe('HARRISON');
    expect(cleanName('abcdefghijklmnop')).toBe('ABCDEFGHIJKL');
  });

  it('isSave: a record with a numeric version of 1 or more', () => {
    expect(isSave({ version: 1 })).toBe(true);
    for (const v of [{ version: 0 }, { version: '4' }, [], null, 'x']) expect(isSave(v), JSON.stringify(v)).toBe(false);
  });

  it('each bad field falls back alone', () => {
    const bad = {
      ...SOME,
      coins: 'lots',
      level: 0,
      xp: 'x',
      stats: { speed: '3', power: 4, control: 12 },
      ladderWins: 99,
      dailyWinDate: 7,
      totals: null,
      powerMoves: 'all',
      powerForms: { owned: 'golden', equipped: 3 },
    };
    const tenRetro = Object.fromEntries([...Array(10)].map((_, i) => [`backyard-${i + 1}`, 1]));
    expect(profileFrom(bad, 'normal')).toEqual({
      version: 7,
      name: 'HARRISON',
      difficulty: 'normal',
      coins: 0,
      level: 1,
      xp: 0,
      stats: { speed: 1, power: 4, jump: 1, control: 10, stamina: 1 },
      ladderWins: 10,
      dailyWinDate: null,
      totals: ZERO_TOTALS,
      powerMoves: NO_POWER,
      powerForms: NO_POWER,
      career: { ...SOME.career, stars: { ...tenRetro, ...SOME.career.stars } },
      locker: EMPTY_LOCKER,
    });
  });

  it('negative coins fall back to 0', () => {
    expect(profileFrom({ ...SOME, coins: -5 }, 'normal').coins).toBe(0);
  });

  it('a full v1 save loads into v7 with every field kept', () => {
    const v1 = {
      version: 1,
      coins: 640,
      level: 4,
      xp: 30,
      stats: { speed: 3, power: 2, jump: 2, control: 1 },
      ladderWins: 4,
      dailyWinDate: '2026-10-24',
      totals: { matches: 12, wins: 7, draws: 2, losses: 3, goalsFor: 21, goalsAgainst: 11, styleGoals: 5, xpEarned: 480 },
    };
    expect(profileFrom(v1, 'normal')).toEqual({ ...v1, version: 7, name: 'HARRISON', difficulty: 'normal', stats: { ...v1.stats, stamina: 1 }, powerMoves: NO_POWER, powerForms: NO_POWER, career: { ...NO_CAREER, stars: FOUR_RETRO }, locker: EMPTY_LOCKER });
  });

  it('a v2 save loads into v7 with retro stars for its ladder wins', () => {
    const v2 = { ...SOME, version: 2, career: undefined };
    delete (v2 as { career?: unknown }).career;
    expect(profileFrom(v2, 'normal')).toEqual({ ...LOADED, career: { stars: FOUR_RETRO, milestonesPaid: 0, lossStreaks: {} } });
  });

  it("Harrison's champion save unlocks Biscuit with ten stars", () => {
    const champ = profileFrom({ ...SOME, version: 2, ladderWins: 10, career: undefined }, 'normal');
    expect(Object.keys(champ.career.stars)).toHaveLength(10);
    expect(Object.values(champ.career.stars).every(s => s === 1)).toBe(true);
    expect(champ.career.stars['backyard-boss']).toBeUndefined();
  });

  it('retro stars never lower a better star', () => {
    expect(profileFrom(SOME, 'normal').career.stars['backyard-4']).toBe(3);
  });

  it('career junk falls back field by field: unknown ids drop, stars clamp to 3, streaks to 99, paid to 4', () => {
    const p = profileFrom({ ...SOME, career: { stars: { 'backyard-2': 9, 'state-1': 2, 'backyard-boss': -1, nonsense: 3 }, milestonesPaid: 40, lossStreaks: { 'backyard-boss': 500, x: 1 } } }, 'normal');
    expect(p.career).toEqual({ stars: { 'backyard-1': 1, 'backyard-2': 3, 'backyard-3': 1, 'backyard-4': 1 }, milestonesPaid: 4, lossStreaks: { 'backyard-boss': 99 } });
    expect(profileFrom({ ...SOME, career: 'none' }, 'normal').career).toEqual({ stars: FOUR_RETRO, milestonesPaid: 0, lossStreaks: {} });
    expect(MAX_LOADED).toMatchObject({ stars: 3, milestones: 4, streak: 99 });
  });

  it('a v1 save at level 5 or more loads with Golden Form owned and equipped', () => {
    const { powerMoves: _m, powerForms: _f, ...v1 } = { ...SOME, version: 1, level: 6 };
    const p = profileFrom(v1, 'normal');
    expect(p.powerForms).toEqual({ owned: ['golden'], equipped: 'golden' });
    expect(p.powerMoves).toEqual(NO_POWER);
  });

  it('unknown, duplicate and unowned power entries are dropped', () => {
    const p = profileFrom(
      {
        ...SOME,
        powerMoves: { owned: ['energyWave', 'energyWave', 'blazeShot'], equipped: 'blazeShot' },
        powerForms: { owned: ['storm'], equipped: 'golden' },
      },
      'normal',
    );
    expect(p.powerMoves).toEqual({ owned: ['energyWave'], equipped: null });
    expect(p.powerForms).toEqual(NO_POWER);
  });

  it('absurd counts are capped so loading and levelling finish', () => {
    const p = profileFrom({ ...SOME, xp: 1e300, coins: 1e300, level: 1e9, totals: { ...SOME.totals, goalsFor: 1e300 } }, 'normal');
    expect(p.xp).toBe(MAX_LOADED.xp);
    expect(p.coins).toBe(MAX_LOADED.count);
    expect(p.level).toBe(MAX_LOADED.level);
    expect(p.totals.goalsFor).toBe(MAX_LOADED.count);
    expect(addXp(p.level, p.xp, 100).level).toBeGreaterThanOrEqual(p.level);
  });

  it('a bad total falls back alone too', () => {
    const p = profileFrom({ ...SOME, totals: { ...SOME.totals, wins: 'many', goalsFor: -1 } }, 'normal');
    expect(p.totals).toEqual({ ...SOME.totals, wins: 0, goalsFor: 0 });
  });

  it('counts are whole numbers', () => {
    const p = profileFrom({ ...SOME, coins: 12.7, level: 2.5, stats: { ...SOME.stats, speed: 3.9 } }, 'normal');
    expect(p.coins).toBe(12);
    expect(p.level).toBe(2);
    expect(p.stats.speed).toBe(3);
  });

  it('a v3 save keeps Park stars, because Park ids are catalog ids', () => {
    const v3 = { ...SOME, version: 3, career: { ...SOME.career, stars: { ...SOME.career.stars, 'park-2': 3 }, lossStreaks: { 'park-boss': 1 } } };
    const p = profileFrom(v3, 'normal');
    expect(p.version).toBe(7);
    expect(p.career.stars['park-2']).toBe(3);
    expect(p.career.lossStreaks).toEqual({ 'park-boss': 1 });
  });

  it('a v3 save without Park ids loads with no Park stars', () => {
    const p = profileFrom({ ...SOME, version: 3 }, 'normal');
    expect(p.version).toBe(7);
    expect(Object.keys(p.career.stars).filter(id => id.startsWith('park-'))).toEqual([]);
  });

  it('a v4 tab left open cannot write over a v5 save', () => {
    const store = memoryStore({ [PROFILE_KEY]: JSON.stringify(OWN) });
    const before = store.data[PROFILE_KEY];
    writeUnlessNewer(store, PROFILE_KEY, SOME);
    expect(store.data[PROFILE_KEY]).toBe(before);
  });

  it('a v6 save keeps School stars, because School ids are catalog ids', () => {
    const v6 = { ...OWN, version: 6, career: { ...OWN.career, stars: { ...OWN.career.stars, 'school-3': 2 }, lossStreaks: { 'school-boss': 1 } } };
    const p = profileFrom(v6, 'normal');
    expect(p.version).toBe(7);
    expect(p.career.stars['school-3']).toBe(2);
    expect(p.career.lossStreaks).toEqual({ 'school-boss': 1 });
  });

  it('a v6 save without School ids loads with no School stars', () => {
    const p = profileFrom({ ...OWN, version: 6 }, 'normal');
    expect(p.version).toBe(7);
    expect(Object.keys(p.career.stars).filter(id => id.startsWith('school-'))).toEqual([]);
  });

  it('a v6 tab left open cannot write over a v7 save with School stars', () => {
    const v7 = { ...OWN, version: 7, career: { ...OWN.career, stars: { ...OWN.career.stars, 'school-1': 3 } } };
    const store = memoryStore({ [PROFILE_KEY]: JSON.stringify(v7) });
    const before = store.data[PROFILE_KEY];
    writeUnlessNewer(store, PROFILE_KEY, { ...OWN, version: 6 });
    expect(store.data[PROFILE_KEY]).toBe(before);
  });

  it('a v5 save loads into v7 with an empty locker and keeps everything else', () => {
    const { locker: _locker, ...v5 } = {
      ...OWN,
      version: 5,
      coins: 1240,
      career: { stars: { ...SOME.career.stars, 'backyard-5': 3, 'park-1': 2 }, milestonesPaid: 2, lossStreaks: { 'park-boss': 1 } },
    };
    const p = profileFrom(v5, 'easy');
    expect(p).toEqual({ ...v5, version: 7, locker: EMPTY_LOCKER });
    expect(unseenGifts(p)).toEqual(['extra:armband', 'boots:lightning']);
  });

  it('the locker loads field by field', () => {
    const career = { ...OWN.career, milestonesPaid: 1 };
    const load = (locker: unknown) => profileFrom({ ...OWN, career, locker }, 'normal').locker;
    expect(load({
      bought: ['extra:headband', 'kit:sky', 'kit:sky', 'kit:nope', 'kit:home', 'extra:armband', 7],
      kit: 'sky',
      boots: 'banana',
      extras: ['wristbands', 'armband', 'glasses', 'glasses', 'cape'],
      seen: ['extra:armband', 'kit:sky', 'boots:gold', 'x'],
    })).toEqual({ bought: ['kit:sky', 'extra:headband'], kit: 'sky', boots: 'volt', extras: ['glasses', 'armband'], seen: ['extra:armband', 'boots:gold'] });
    expect(load({ kit: 'gold', boots: 'lightning', extras: 'all' })).toEqual(EMPTY_LOCKER);
    expect(load({ kit: 'inferno', boots: 'fire', bought: 'everything' })).toEqual(EMPTY_LOCKER);
    expect(load('junk')).toEqual(EMPTY_LOCKER);
  });

  it("newProfile's locker is empty and stores as version 7", () => {
    expect(newProfile().locker).toEqual(EMPTY_LOCKER);
    expect(newProfile().version).toBe(7);
    expect(PROFILE_VERSION).toBe(7);
  });

  it('not a save at all loads a new profile', () => {
    for (const v of [[], null, { version: '1' }, { version: 0, coins: 50 }, 'hello']) {
      expect(profileFrom(v, 'easy'), JSON.stringify(v)).toEqual(newProfile());
    }
  });

  it('returns a fresh copy', () => {
    const a = profileFrom(SOME, 'normal');
    a.stats.speed = 9;
    a.totals.wins = 99;
    expect(profileFrom(SOME, 'normal')).toEqual(LOADED);
    const n = newProfile();
    n.stats.power = 7;
    n.totals.matches = 3;
    expect(newProfile().stats.power).toBe(1);
    expect(newProfile().totals.matches).toBe(0);
  });
});
