import { DIFFICULTIES } from '../game/ai';
import type { StatName } from '../game/stats';
import { BACKYARD, BOSS_ID, PARK, PARK_BOSS_ID, SCHOOL, SCHOOL_BOSS_ID } from './career';
import { FORM_IDS, MOVE_IDS } from './catalog';
import { BOOTS_IDS, EXTRA_IDS, GIFTS, KIT_IDS, LOCKER_ITEMS } from './locker';
import { TOTAL_NAMES, profileFrom, type Owned, type Profile } from './profile';

/**
 * A save code: the profile as whole-number fields, written as unsigned
 * LEB128 varints, then a 16-bit Fletcher checksum, in Crockford base 32.
 * Later builds only ever append fields, so every older code still reads,
 * and a newer code reads as best it can. The checksum catches typos; it
 * doesn't stop tampering, which the loader's clamps take care of.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP = 5;
const DAY_MS = 86_400_000;
const EPOCH_MS = Date.UTC(2000, 0, 1);
/** A varint longer than this is junk, not a number. */
const MAX_VARINT_BYTES = 8;
/** The four stats every code carries mid-list, in their v1 order. Stamina is appended at the end (v5). */
const CODE_STATS: readonly StatName[] = ['speed', 'power', 'jump', 'control'];

/** Uppercase, with the look-alikes Crockford allows (O for 0, I and L for 1), and nothing outside the alphabet. */
export function normaliseCode(text: string): string {
  let out = '';
  for (const ch of text.toUpperCase()) {
    const c = ch === 'O' ? '0' : ch === 'I' || ch === 'L' ? '1' : ch;
    if (ALPHABET.includes(c)) out += c;
  }
  return out;
}

export function groupCode(chars: string): string {
  return chars.match(new RegExp(`.{1,${GROUP}}`, 'g'))?.join('-') ?? '';
}

function fletcher16(bytes: readonly number[]): number {
  let a = 0;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 255;
    b = (b + a) % 255;
  }
  return (b << 8) | a;
}

function pushVarint(out: number[], n: number): void {
  let v = Math.max(0, Math.floor(n));
  do {
    const low = v % 128;
    v = Math.floor(v / 128);
    out.push(v > 0 ? low | 128 : low);
  } while (v > 0);
}

function readVarints(bytes: readonly number[]): number[] | null {
  const fields: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    let v = 0;
    let scale = 1;
    for (let len = 0; ; len++) {
      if (i >= bytes.length || len >= MAX_VARINT_BYTES) return null;
      const b = bytes[i++];
      v += (b & 127) * scale;
      scale *= 128;
      if (b < 128) break;
    }
    fields.push(v);
  }
  return fields;
}

/** Whole-number fields to a grouped code. */
export function encodeFields(fields: readonly number[]): string {
  const bytes: number[] = [];
  for (const f of fields) pushVarint(bytes, f);
  const sum = fletcher16(bytes);
  bytes.push(sum >> 8, sum & 255);
  let chars = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      chars += ALPHABET[(acc >> bits) & 31];
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) chars += ALPHABET[(acc << (5 - bits)) & 31];
  return groupCode(chars);
}

/** A typed code back to its fields; null if it's empty, malformed or fails the checksum. */
export function decodeFields(text: string): number[] | null {
  const chars = normaliseCode(text);
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of chars) {
    acc = (acc << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
    acc &= (1 << bits) - 1;
  }
  // The padding bits are always zero, so a typo there is still a typo.
  if (acc !== 0 || bytes.length < 3) return null;
  const payload = bytes.slice(0, -2);
  const sum = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
  if (fletcher16(payload) !== sum) return null;
  return readVarints(payload);
}

function dayNumber(date: string | null): number {
  const ms = date === null ? NaN : Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) && ms >= EPOCH_MS ? Math.round((ms - EPOCH_MS) / DAY_MS) + 1 : 0;
}

const dateOf = (day: number | undefined): string | null =>
  day ? new Date(EPOCH_MS + (day - 1) * DAY_MS).toISOString().slice(0, 10) : null;

const ITEM_IDS = LOCKER_ITEMS.map(i => i.id);

/** Bit i set when ids[i] is in `has`. */
const maskOf = <T extends string>(has: readonly T[], ids: readonly T[]): number => ids.reduce((m, id, i) => (has.includes(id) ? m + 2 ** i : m), 0);
const idsIn = <T extends string>(mask: number, ids: readonly T[]): T[] => ids.filter((_, i) => Math.floor(mask / 2 ** i) % 2 === 1);

function ownedFields<T extends string>(o: Owned<T>, ids: readonly T[]): [mask: number, equipped: number] {
  return [maskOf(o.owned, ids), o.equipped === null ? 0 : ids.indexOf(o.equipped) + 1];
}

function ownedOf<T extends string>(mask: number | undefined, equipped: number | undefined, ids: readonly T[]): Owned<T> | undefined {
  if (mask === undefined) return undefined;
  return { owned: idsIn(mask, ids), equipped: ids[(equipped ?? 0) - 1] ?? null };
}

export function encodeSaveCode(p: Profile): string {
  return encodeFields([
    p.version,
    p.coins,
    p.level,
    p.xp,
    ...CODE_STATS.map(k => p.stats[k]),
    p.ladderWins,
    dayNumber(p.dailyWinDate),
    ...TOTAL_NAMES.map(k => p.totals[k]),
    ...ownedFields(p.powerMoves, MOVE_IDS),
    ...ownedFields(p.powerForms, FORM_IDS),
    // v3: the Backyard's stars in match order, the milestones paid, and the boss's loss streak. Rung streaks stay home.
    ...BACKYARD.matches.map(m => p.career.stars[m.id] ?? 0),
    p.career.milestonesPaid,
    p.career.lossStreaks[BOSS_ID] ?? 0,
    // v4: the Park's stars in match order, and Sam's loss streak.
    ...PARK.matches.map(m => p.career.stars[m.id] ?? 0),
    p.career.lossStreaks[PARK_BOSS_ID] ?? 0,
    // v5: Stamina, then the difficulty (1 easy, 2 normal, 3 hard; 0 is none). The name stays with the save.
    p.stats.stamina,
    DIFFICULTIES.indexOf(p.difficulty) + 1,
    // v6: the locker: what's bought (a mask over LOCKER_ITEMS), the kit and boots (index + 1), the extras worn and the gifts seen (masks).
    maskOf(p.locker.bought, ITEM_IDS),
    KIT_IDS.indexOf(p.locker.kit) + 1,
    BOOTS_IDS.indexOf(p.locker.boots) + 1,
    maskOf(p.locker.extras, EXTRA_IDS),
    maskOf(p.locker.seen, GIFTS),
    // v7: the School Field's stars in match order, and Gus's loss streak.
    ...SCHOOL.matches.map(m => p.career.stars[m.id] ?? 0),
    p.career.lossStreaks[SCHOOL_BOSS_ID] ?? 0,
  ]);
}

/**
 * The progress in a typed or pasted code, through the same field-by-field
 * loader as a save, onto the save `onto`: it keeps onto's name, and onto's
 * difficulty unless the code carries one. Null if it doesn't decode.
 */
export function decodeSaveCode(text: string, onto: Profile): Profile | null {
  const f = decodeFields(text);
  if (!f || !(f[0] >= 1)) return null;
  let i = 0;
  const next = (): number | undefined => f[i++];
  const record = {
    version: next(),
    name: onto.name,
    coins: next(),
    level: next(),
    xp: next(),
    stats: Object.fromEntries(CODE_STATS.map(k => [k, next()])),
    ladderWins: next(),
    dailyWinDate: dateOf(next()),
    totals: Object.fromEntries(TOTAL_NAMES.map(k => [k, next()])),
    powerMoves: ownedOf(next(), next(), MOVE_IDS),
    powerForms: ownedOf(next(), next(), FORM_IDS),
    // Missing fields are undefined here and fall back to nothing in the loader.
    career: {
      stars: Object.fromEntries(BACKYARD.matches.map(m => [m.id, next()])),
      milestonesPaid: next(),
      lossStreaks: { [BOSS_ID]: next() },
    },
  };
  // v4, read after every v3 field, in the order they were written.
  Object.assign(record.career.stars, Object.fromEntries(PARK.matches.map(m => [m.id, next()])));
  Object.assign(record.career.lossStreaks, { [PARK_BOSS_ID]: next() });
  // v5, after every v4 field: Stamina, then the difficulty, where 0, missing or out of range is none.
  Object.assign(record.stats, { stamina: next() });
  Object.assign(record, { difficulty: DIFFICULTIES[(next() ?? 0) - 1] });
  // v6, after every v5 field: the locker, where 0 or missing is none.
  Object.assign(record, {
    locker: {
      bought: idsIn(next() ?? 0, ITEM_IDS),
      kit: KIT_IDS[(next() ?? 0) - 1],
      boots: BOOTS_IDS[(next() ?? 0) - 1],
      extras: idsIn(next() ?? 0, EXTRA_IDS),
      seen: idsIn(next() ?? 0, GIFTS),
    },
  });
  // v7, after every v6 field: the School Field's stars, then Gus's loss streak.
  Object.assign(record.career.stars, Object.fromEntries(SCHOOL.matches.map(m => [m.id, next()])));
  Object.assign(record.career.lossStreaks, { [SCHOOL_BOSS_ID]: next() });
  return profileFrom(record, onto.difficulty);
}
