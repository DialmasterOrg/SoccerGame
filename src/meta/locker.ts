import type { OpponentId } from './career';
import { MILESTONES } from './milestones';
import type { Profile } from './profile';

export type KitItemId = 'home' | 'away' | 'white' | 'sky' | 'purple' | 'navy' | 'blackGold' | 'ice' | 'inferno' | 'gold';
export type BootsItemId = 'volt' | 'white' | 'black' | 'red' | 'blue' | 'pink' | 'fire' | 'lightning' | 'gold';
export type ExtraId = 'glasses' | 'headband' | 'wristbands' | 'armband';
export type LockerTab = 'kits' | 'boots' | 'extras';
export type LockerItemId = `kit:${KitItemId}` | `boots:${BootsItemId}` | `extra:${ExtraId}`;
export type ClashFamily = 'red' | 'black' | 'white' | 'blue' | 'purple' | 'orange' | 'yellow' | 'teal' | 'pink' | 'olive' | 'brown';
/** The plain kit an opponent changes into on a clash. */
export type ChangeKit = 'white' | 'black';
/** Owned from the start, sold for coins, or a gift at a milestone index. */
export type ItemSource = 'starter' | { price: number } | { milestone: number };

export interface LockerItem {
  id: LockerItemId;
  tab: LockerTab;
  label: string;
  blurb: string;
  source: ItemSource;
}

/** What he wears. */
export interface Outfit {
  kit: KitItemId;
  boots: BootsItemId;
  extras: readonly ExtraId[];
}

export type ItemStatus = 'wearing' | 'owned' | 'buy' | 'locked';

const kit = (id: KitItemId, label: string, blurb: string, source: ItemSource): LockerItem => ({ id: `kit:${id}`, tab: 'kits', label, blurb, source });
const boots = (id: BootsItemId, label: string, blurb: string, source: ItemSource): LockerItem => ({ id: `boots:${id}`, tab: 'boots', label, blurb, source });
const extra = (id: ExtraId, label: string, blurb: string, source: ItemSource): LockerItem => ({ id: `extra:${id}`, tab: 'extras', label, blurb, source });
const TRIM_BLURB = "IN YOUR KIT'S TRIM COLOUR";

/** All 23, in tab order: the save code's order, append-only. */
export const LOCKER_ITEMS: readonly LockerItem[] = [
  kit('home', 'HOME', 'YOUR CLUB KIT', 'starter'),
  kit('away', 'AWAY', 'YOUR CLUB AWAY KIT', 'starter'),
  kit('white', 'WHITE', 'CLEAN WHITE WITH NAVY TRIM', { price: 200 }),
  kit('sky', 'SKY', 'SKY BLUE WITH WHITE SHORTS', { price: 200 }),
  kit('purple', 'PURPLE', 'PURPLE WITH WHITE TRIM', { price: 200 }),
  kit('navy', 'NAVY', 'NAVY WITH GOLD TRIM', { price: 250 }),
  kit('blackGold', 'BLACK GOLD', 'ALL BLACK WITH GOLD TRIM', { price: 1000 }),
  kit('ice', 'ICE', 'ICY WHITE AND ELECTRIC BLUE', { price: 1200 }),
  kit('inferno', 'INFERNO', 'FIRE ORANGE WITH GOLD TRIM', { price: 1500 }),
  kit('gold', 'GOLD', 'EARNED AT 50 STARS', { milestone: 2 }),
  boots('volt', 'VOLT', 'YOUR NEON YELLOW BOOTS', 'starter'),
  boots('white', 'WHITE', 'CLASSIC WHITE', { price: 100 }),
  boots('black', 'BLACK', 'CLASSIC BLACK', { price: 100 }),
  boots('red', 'RED', 'BRIGHT RED', { price: 150 }),
  boots('blue', 'BLUE', 'BRIGHT BLUE', { price: 150 }),
  boots('pink', 'PINK', 'HOT PINK', { price: 150 }),
  boots('fire', 'FIRE', 'FLAMES WHEN YOU SPRINT', { price: 1500 }),
  boots('lightning', 'LIGHTNING', 'BLUE SPARKS WHEN YOU SPRINT', { milestone: 1 }),
  boots('gold', 'GOLD', 'GOLD SPARKLES WHEN YOU SPRINT', { milestone: 3 }),
  extra('glasses', 'GLASSES', 'YOUR CLEAR FRAMES', 'starter'),
  extra('headband', 'HEADBAND', TRIM_BLURB, { price: 150 }),
  extra('wristbands', 'WRISTBANDS', TRIM_BLURB, { price: 100 }),
  extra('armband', "CAPTAIN'S ARMBAND", 'EARNED AT 10 STARS', { milestone: 0 }),
];

const after = (id: LockerItemId): string => id.slice(id.indexOf(':') + 1);
export const KIT_IDS = LOCKER_ITEMS.filter(i => i.tab === 'kits').map(i => after(i.id)) as readonly KitItemId[];
export const BOOTS_IDS = LOCKER_ITEMS.filter(i => i.tab === 'boots').map(i => after(i.id)) as readonly BootsItemId[];
export const EXTRA_IDS = LOCKER_ITEMS.filter(i => i.tab === 'extras').map(i => after(i.id)) as readonly ExtraId[];

/** Index = milestone index. */
export const GIFTS: readonly LockerItemId[] = ['extra:armband', 'boots:lightning', 'kit:gold', 'boots:gold'];
export const GIFT_NAMES: Readonly<Record<string, string>> = {
  'extra:armband': "CAPTAIN'S ARMBAND",
  'boots:lightning': 'LIGHTNING BOOTS',
  'kit:gold': 'GOLD KIT',
  'boots:gold': 'GOLD BOOTS',
};

/** Each kit's clash family; a light kit makes a clashing opponent change into black. */
export const KIT_CLASH: Readonly<Record<KitItemId, { family: ClashFamily; light: boolean }>> = {
  home: { family: 'red', light: false },
  away: { family: 'black', light: false },
  white: { family: 'white', light: true },
  sky: { family: 'blue', light: false },
  purple: { family: 'purple', light: false },
  navy: { family: 'blue', light: false },
  blackGold: { family: 'black', light: false },
  ice: { family: 'blue', light: true },
  inferno: { family: 'orange', light: false },
  gold: { family: 'yellow', light: false },
};

export const OPPONENT_FAMILY: Readonly<Record<Exclude<OpponentId, 'biscuit'>, ClashFamily>> = {
  max: 'blue', brick: 'orange', leo: 'purple', tia: 'teal', pete: 'yellow', sam: 'pink',
  hank: 'white', lola: 'yellow', finn: 'black', priya: 'olive', niko: 'brown', paige: 'purple',
};

export const DEFAULT_OUTFIT: Outfit = { kit: 'home', boots: 'volt', extras: [] };

const BY_ID = new Map(LOCKER_ITEMS.map(i => [i.id, i]));

export function item(id: LockerItemId): LockerItem {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`no locker item ${id}`);
  return found;
}

export const itemsIn = (tab: LockerTab): LockerItem[] => LOCKER_ITEMS.filter(i => i.tab === tab);

const priceOf = (s: ItemSource): number | null => (typeof s === 'object' && 'price' in s ? s.price : null);
const milestoneOf = (s: ItemSource): number | null => (typeof s === 'object' && 'milestone' in s ? s.milestone : null);

/** What ownership reads from a save: the loader asks it before the profile is whole. */
type OwnedFrom = { career: Pick<Profile['career'], 'milestonesPaid'>; locker: Pick<Profile['locker'], 'bought'> };

export function owns(p: OwnedFrom, id: LockerItemId): boolean {
  const s = item(id).source;
  if (s === 'starter') return true;
  const m = milestoneOf(s);
  if (m !== null) return p.career.milestonesPaid > m;
  return p.locker.bought.includes(id);
}

function wears(p: Profile, id: LockerItemId): boolean {
  const [tab, name] = id.split(':') as [string, string];
  if (tab === 'kit') return p.locker.kit === name;
  if (tab === 'boots') return p.locker.boots === name;
  return (p.locker.extras as readonly string[]).includes(name);
}

export function itemStatus(p: Profile, id: LockerItemId): ItemStatus {
  if (wears(p, id)) return 'wearing';
  if (owns(p, id)) return 'owned';
  return milestoneOf(item(id).source) === null ? 'buy' : 'locked';
}

export const unseenGifts = (p: Profile): LockerItemId[] => GIFTS.filter(g => owns(p, g) && !p.locker.seen.includes(g));

export const outfitOf = (p: Profile): Outfit => ({ kit: p.locker.kit, boots: p.locker.boots, extras: p.locker.extras });

/** Stable and order-free in the extras, e.g. 'inferno/fire/glasses+headband'. */
export const outfitKey = (o: Outfit): string => `${o.kit}/${o.boots}/${EXTRA_IDS.filter(e => o.extras.includes(e)).join('+')}`;

/** `o` with `id` on (a kit or boots replaces, an extra joins). Doesn't check ownership: the try-on uses it. */
export function dressedIn(o: Outfit, id: LockerItemId): Outfit {
  const [tab, name] = id.split(':') as [string, string];
  if (tab === 'kit') return { ...o, kit: name as KitItemId };
  if (tab === 'boots') return { ...o, boots: name as BootsItemId };
  return o.extras.includes(name as ExtraId) ? o : { ...o, extras: [...o.extras, name as ExtraId] };
}

const wearing = (p: Profile, id: LockerItemId): Profile => {
  const o = dressedIn(outfitOf(p), id);
  return { ...p, locker: { ...p.locker, kit: o.kit, boots: o.boots, extras: [...o.extras] } };
};

/** Buys and wears `id`; null when it's owned, locked, a starter or too dear. */
export function buyItem(p: Profile, id: LockerItemId): Profile | null {
  const price = itemPrice(id);
  if (price === null || owns(p, id) || p.coins < price) return null;
  return wearing({ ...p, coins: p.coins - price, locker: { ...p.locker, bought: [...p.locker.bought, id] } }, id);
}

/** Wears an owned item; null when he doesn't own it or already wears it. */
export function wearItem(p: Profile, id: LockerItemId): Profile | null {
  if (!owns(p, id) || wears(p, id)) return null;
  return wearing(p, id);
}

/** Takes an extra off; null when it isn't on. */
export function takeOff(p: Profile, id: `extra:${ExtraId}`): Profile | null {
  if (!wears(p, id)) return null;
  const name = after(id);
  return { ...p, locker: { ...p.locker, extras: p.locker.extras.filter(e => e !== name) } };
}

/** Marks an unlocked gift seen; the same profile when it's locked, already seen or not a gift. */
export function markSeen(p: Profile, id: LockerItemId): Profile {
  if (!GIFTS.includes(id) || !owns(p, id) || p.locker.seen.includes(id)) return p;
  return { ...p, locker: { ...p.locker, seen: [...p.locker.seen, id] } };
}

/** The change kit `opponent` wears against Harrison in `kit`, or null when they don't clash. */
export function changeKitFor(kit: KitItemId, opponent: Exclude<OpponentId, 'biscuit'>): ChangeKit | null {
  const { family, light } = KIT_CLASH[kit];
  if (family !== OPPONENT_FAMILY[opponent]) return null;
  return light ? 'black' : 'white';
}

/** The Results line for a paid milestone, or null when it brings no gift. */
export function giftLine(milestoneIndex: number): string | null {
  const gift = GIFTS[milestoneIndex];
  return gift === undefined ? null : `NEW IN THE LOCKER ROOM: ${GIFT_NAMES[gift]}`;
}

/** What an item sells for, or null for a starter or a gift. */
export const itemPrice = (id: LockerItemId): number | null => priceOf(item(id).source);

/** The milestone a gift waits on, for its locked row. */
export const starsFor = (id: LockerItemId): number | null => {
  const m = milestoneOf(item(id).source);
  return m === null ? null : (MILESTONES[m]?.stars ?? null);
};
