import { DIFFICULTIES, type Difficulty } from '../game/ai';
import { BASE_STATS, MAX_STAT_LEVEL, MIN_STAT_LEVEL, STAT_NAMES, type Stats } from '../game/stats';
import { MATCH_IDS, grantRungStars } from './career';
import { FORM_IDS, MOVE_IDS, grantForms } from './catalog';
import { LADDER_MATCHES } from './ladder';
import { BOOTS_IDS, EXTRA_IDS, GIFTS, KIT_IDS, LOCKER_ITEMS, itemPrice, owns, type BootsItemId, type ExtraId, type KitItemId, type LockerItemId } from './locker';
import { isRecord } from './storage';

export { LADDER_MATCHES } from './ladder';

export type PowerMoveId = 'energyWave';
export type PowerFormId = 'golden';

/** What he owns of one kind of power, and which one is in use. */
export interface Owned<T extends string> {
  owned: T[];
  equipped: T | null;
}

/** Running totals, kept for the Trophy Room. */
export interface Totals {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  styleGoals: number;
  xpEarned: number;
}

/** His career, keyed by the catalog's match ids. */
export interface Career {
  /** Best stars per career match. Missing means 0; an entry of 0 is never stored. */
  stars: Record<string, number>;
  /** How many star milestones have been paid, 0..4. */
  milestonesPaid: number;
  /** Consecutive losses per career match; a win removes the entry. */
  lossStreaks: Record<string, number>;
}

/** His Locker Room: what he's bought and what he wears. */
export interface Locker {
  /** Items bought with coins. Starters and gifts are never stored here. */
  bought: LockerItemId[];
  kit: KitItemId;
  boots: BootsItemId;
  extras: ExtraId[];
  /** Gifts whose NEW he's seen. */
  seen: LockerItemId[];
}

/** Harrison's progress, versioned so every later build can read it. */
export interface Profile {
  /** v5 adds the name, the difficulty and Stamina; v6 the locker; v7 nothing (see PROFILE_VERSION). */
  version: 7;
  /** 1 to NAME_MAX of A-Z, 0-9 and space. */
  name: string;
  /** Each save has its own: picked when it's made, changed in Options. */
  difficulty: Difficulty;
  coins: number;
  /** Stored, never worked out from XP, so a change to the curve can't take a level away. */
  level: number;
  /** XP toward the next level. */
  xp: number;
  stats: Stats;
  /** Backyard Ladder matches beaten, 0–LADDER_MATCHES. */
  ladderWins: number;
  /** The local date ('YYYY-MM-DD') of his last first-win-of-the-day bonus. */
  dailyWinDate: string | null;
  totals: Totals;
  powerMoves: Owned<PowerMoveId>;
  /** Granted by level. Stored, so a later change to an unlock level can't take one away. */
  powerForms: Owned<PowerFormId>;
  career: Career;
  locker: Locker;
}

/** Game-specific, so it never clashes with other pages on the same site. */
export const PROFILE_KEY = 'harrisons-road-to-the-cup/profile';
/** v7 adds no fields: the School Field's ids load because they're catalog ids. The bump stops a v6 tab left open writing over School stars. */
export const PROFILE_VERSION = 7;
/** What a save without a name is called: his live save, from before there were names. */
export const DEFAULT_NAME = 'HARRISON';
export const NAME_MAX = 12;

/** Ceilings on loaded counts, so a tampered save can't make levelling run forever. */
export const MAX_LOADED = { level: 999, xp: 1_000_000, count: 999_999_999, stars: 3, milestones: 4, streak: 99 };

export const TOTAL_NAMES: readonly (keyof Totals)[] = ['matches', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'styleGoals', 'xpEarned'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Uppercased, keeping only A-Z, 0-9 and spaces. */
export function nameChars(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
}

/** nameChars, trimmed, at most NAME_MAX; '' when nothing's left. */
export function cleanName(text: string): string {
  return nameChars(text).trim().slice(0, NAME_MAX).trim();
}

/** A record with a numeric version ≥ 1: anything else in a slot means it's empty. */
export function isSave(v: unknown): v is Record<string, unknown> & { version: number } {
  return isRecord(v) && typeof v.version === 'number' && v.version >= 1;
}

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    name: DEFAULT_NAME,
    difficulty: 'normal',
    coins: 0,
    level: 1,
    xp: 0,
    stats: { ...BASE_STATS },
    ladderWins: 0,
    dailyWinDate: null,
    totals: { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, styleGoals: 0, xpEarned: 0 },
    powerMoves: { owned: [], equipped: null },
    powerForms: { owned: [], equipped: null },
    career: { stars: {}, milestonesPaid: 0, lossStreaks: {} },
    locker: { bought: [], kit: 'home', boots: 'volt', extras: [], seen: [] },
  };
}

/** A whole number from `min` (clamped to `max`, if given); anything that isn't a number is the default. */
const wholeOr = (v: unknown, d: number, min: number, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), min), max) : d;

function statsFrom(v: unknown): Stats {
  const r = isRecord(v) ? v : {};
  const s = { ...BASE_STATS };
  for (const k of STAT_NAMES) s[k] = wholeOr(r[k], BASE_STATS[k], MIN_STAT_LEVEL, MAX_STAT_LEVEL);
  return s;
}

function totalsFrom(v: unknown): Totals {
  const r = isRecord(v) ? v : {};
  const t = newProfile().totals;
  for (const k of TOTAL_NAMES) t[k] = wholeOr(r[k], 0, 0, MAX_LOADED.count);
  return t;
}

/** Catalog ids only, each a whole number up to `max`; zeros are left out. */
function countsFrom(v: unknown, max: number): Record<string, number> {
  const r = isRecord(v) ? v : {};
  const out: Record<string, number> = {};
  for (const id of MATCH_IDS) {
    const n = wholeOr(r[id], 0, 0, max);
    if (n > 0) out[id] = n;
  }
  return out;
}

function careerFrom(v: unknown): Career {
  const r = isRecord(v) ? v : {};
  return {
    stars: countsFrom(r.stars, MAX_LOADED.stars),
    milestonesPaid: wholeOr(r.milestonesPaid, 0, 0, MAX_LOADED.milestones),
    lossStreaks: countsFrom(r.lossStreaks, MAX_LOADED.streak),
  };
}

/** Known ids only, each once, in catalogue order. */
const knownIn = <T extends string>(v: unknown, known: readonly T[]): T[] => {
  const list: unknown[] = Array.isArray(v) ? v : [];
  return known.filter(id => list.includes(id));
};

/** Known names only, each once; an equipped one he doesn't own is dropped. */
function ownedFrom<T extends string>(v: unknown, known: readonly T[]): Owned<T> {
  const r = isRecord(v) ? v : {};
  const owned = knownIn(r.owned, known);
  const equipped = owned.find(id => id === r.equipped) ?? null;
  return { owned, equipped };
}

/** The locker after the career, since a gift is owned by the milestones paid: what he doesn't own falls back to the default. */
function lockerFrom(v: unknown, career: Career): Locker {
  const r = isRecord(v) ? v : {};
  const bought = knownIn(r.bought, LOCKER_ITEMS.map(i => i.id)).filter(id => itemPrice(id) !== null);
  const has = (id: LockerItemId) => owns({ career, locker: { bought } }, id);
  return {
    bought,
    kit: KIT_IDS.find(k => k === r.kit && has(`kit:${k}`)) ?? 'home',
    boots: BOOTS_IDS.find(b => b === r.boots && has(`boots:${b}`)) ?? 'volt',
    extras: knownIn(r.extras, EXTRA_IDS).filter(e => has(`extra:${e}`)),
    seen: knownIn(r.seen, GIFTS),
  };
}

/**
 * Reads a profile field by field, so one bad value falls back to its own
 * default and the rest load. A v1 save loads with no power moves, a v1 or v2
 * save with no career but the stars its ladder wins earn, and a save before
 * v5 as HARRISON on `fallbackDifficulty`, a save before v6 with an empty
 * locker; a newer build's save is read as
 * best it can be. Anything that isn't a save at all is a new profile.
 */
export function profileFrom(v: unknown, fallbackDifficulty: Difficulty): Profile {
  const d = newProfile();
  if (!isSave(v)) return d;
  const career = careerFrom(v.career);
  return grantRungStars(grantForms({
    version: PROFILE_VERSION,
    name: (typeof v.name === 'string' && cleanName(v.name)) || DEFAULT_NAME,
    difficulty: DIFFICULTIES.find(x => x === v.difficulty) ?? fallbackDifficulty,
    coins: wholeOr(v.coins, d.coins, 0, MAX_LOADED.count),
    level: wholeOr(v.level, d.level, 1, MAX_LOADED.level),
    xp: wholeOr(v.xp, d.xp, 0, MAX_LOADED.xp),
    stats: statsFrom(v.stats),
    ladderWins: wholeOr(v.ladderWins, d.ladderWins, 0, LADDER_MATCHES),
    dailyWinDate: typeof v.dailyWinDate === 'string' && DATE.test(v.dailyWinDate) ? v.dailyWinDate : null,
    totals: totalsFrom(v.totals),
    powerMoves: ownedFrom(v.powerMoves, MOVE_IDS),
    powerForms: ownedFrom(v.powerForms, FORM_IDS),
    career,
    locker: lockerFrom(v.locker, career),
  }));
}
