import type { IndexedImage } from './indexedImage';

/**
 * Logical colour ids stored in IndexedImage pixels. Sprites are drawn in these
 * roles; a LookColors map turns them into real colours, so kits and power
 * forms are palette swaps.
 */
export const C = {
  None: 0,
  Outline: 1,
  SkinShadow: 2,
  Skin: 3,
  SkinLight: 4,
  Blush: 5,
  Lip: 6,
  EyeWhite: 7,
  Iris: 8,
  Pupil: 9,
  HairShadow: 10,
  Hair: 11,
  HairLight: 12,
  HairTip: 13,
  Fade: 14,
  Earring: 15,
  JerseyShadow: 16,
  Jersey: 17,
  JerseyLight: 18,
  TrimShadow: 19,
  Trim: 20,
  ShortsShadow: 21,
  Shorts: 22,
  SocksShadow: 23,
  Socks: 24,
  BootShadow: 25,
  Boot: 26,
  BootLight: 27,
  // The Locker Room's extras: the glasses' rim and glint, and the captain's armband.
  GlassesRim: 28,
  GlassesGlint: 29,
  Armband: 30,
  // A keeper's gloves: the near hand's and the far hand's.
  Glove: 31,
  GloveShadow: 32,
} as const;

export type Slot = Exclude<keyof typeof C, 'None'>;

export const MASTER = {
  outline: '#1a1423',
  ink: '#2b3040',
  white: '#f4f4f4',
  silver: '#c8ccd4',
  gray: '#7c7c88',
  black: '#24242c',
  charcoal: '#3a3a46',
  slate: '#50505e',
  skinShadow: '#c27c62',
  skin: '#e8a888',
  skinLight: '#f2c4a4',
  blush: '#e0857a',
  lip: '#c96a6a',
  iris: '#7e98a8',
  hairShadow: '#5c3a22',
  hair: '#8a5a32',
  hairLight: '#b9884e',
  hairTip: '#e0bc78',
  fade: '#a88a72',
  redDark: '#7a1820',
  red: '#c0242c',
  redLight: '#e2464a',
  voltShadow: '#8fa818',
  volt: '#c8e030',
  voltLight: '#eef68a',
  grassDark: '#2f6b2a',
  grass: '#3f8a36',
  grassLight: '#5aa84a',
  sky: '#6ab4e8',
  skyLight: '#a8d8f0',
  wood: '#6b4a2e',
  gold: '#f0c040',
  goldDark: '#b07818',
  auraWhite: '#fff8d8',
  energyGold: '#ffd84a',
  energyGoldLight: '#fff2a0',
  electric: '#58c8ff',
  electricLight: '#c8f0ff',
  flame: '#ff8c1a',
  flameDark: '#d0401a',
  violet: '#9058e0',
  navy: '#1c3c8c',
  blue: '#2c64c8',
  blueLight: '#5a8ce6',
  // The Park crew: two more skin tones, each with its shadow, light and lip, and their kits.
  brownShadow: '#4e2c1c',
  brown: '#74462a',
  brownLight: '#966040',
  brownLip: '#5a2c26',
  tanShadow: '#9a5e3a',
  tan: '#c08050',
  tanLight: '#d8a070',
  tanLip: '#94503e',
  flameLight: '#ffb466',
  violetDark: '#5a3496',
  violetLight: '#bc98f4',
  tealDark: '#1a6e6a',
  teal: '#2a9e94',
  tealLight: '#6cd4c4',
  // Speedy Sam's kit.
  pinkDark: '#a8185e',
  pink: '#e8388a',
  pinkLight: '#ff86be',
  // The keepers' tops: Steady Eddie's emerald, brighter and bluer than the grass, and the backups' berry and lemon.
  emeraldDark: '#0f6e50',
  emerald: '#1eb47a',
  emeraldLight: '#6ae0aa',
  berryDark: '#5c1848',
  berry: '#962c78',
  berryLight: '#cc64ac',
  lemonDark: '#b0a218',
  lemon: '#f6ee4a',
  lemonLight: '#fffab4',
} as const;

export type MasterColor = keyof typeof MASTER;

/** The extras' fixed colours, spread into every look. */
export const EXTRA_COLORS = { GlassesRim: 'silver', GlassesGlint: 'white', Armband: 'energyGold', Glove: 'white', GloveShadow: 'silver' } as const satisfies Partial<Record<Slot, MasterColor>>;

/**
 * Master colour ids for art drawn straight in master colours (scenery, ball,
 * goals) rather than in logical roles: 1-based, in MASTER key order.
 */
export const M = Object.fromEntries(Object.keys(MASTER).map((name, i) => [name, i + 1])) as Readonly<Record<MasterColor, number>>;
export type LookColors = Record<Slot, MasterColor>;
export type RGBA = readonly [number, number, number, number];
/** Indexed by logical colour id; entry 0 is transparent. */
export type ResolvedPalette = readonly RGBA[];

export const TRANSPARENT: RGBA = [0, 0, 0, 0];

export function hexToRGBA(hex: string): RGBA {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
}

export function resolvePalette(look: LookColors): ResolvedPalette {
  const palette: RGBA[] = [TRANSPARENT];
  for (const [slot, id] of Object.entries(C)) {
    if (slot === 'None') continue;
    palette[id] = hexToRGBA(MASTER[look[slot as Slot]]);
  }
  return palette;
}

/** Resolves M ids: id → its MASTER colour, 0 transparent. */
export function masterPalette(): ResolvedPalette {
  return [TRANSPARENT, ...Object.values(MASTER).map(hexToRGBA)];
}

export function toRGBA(img: IndexedImage, palette: ResolvedPalette): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  img.data.forEach((id, i) => {
    out.set(palette[id] ?? TRANSPARENT, i * 4);
  });
  return out;
}

/** Characters used by every hand-authored grid ('.' is transparent). */
export const ART_LEGEND: Readonly<Record<string, number>> = {
  o: C.Outline,
  s: C.SkinShadow,
  k: C.Skin,
  l: C.SkinLight,
  b: C.Blush,
  m: C.Lip,
  w: C.EyeWhite,
  i: C.Iris,
  p: C.Pupil,
  H: C.HairShadow,
  h: C.Hair,
  L: C.HairLight,
  t: C.HairTip,
  f: C.Fade,
  e: C.Earring,
  J: C.JerseyShadow,
  j: C.Jersey,
  q: C.JerseyLight,
  R: C.TrimShadow,
  r: C.Trim,
  g: C.GlassesRim,
  G: C.GlassesGlint,
};
