import type { ChangeKit } from '../meta/locker';
import type { LookColors, MasterColor } from './colors';

export const KIT_SLOT_NAMES = [
  'JerseyShadow',
  'Jersey',
  'JerseyLight',
  'TrimShadow',
  'Trim',
  'ShortsShadow',
  'Shorts',
  'SocksShadow',
  'Socks',
] as const;

export type KitSlots = (typeof KIT_SLOT_NAMES)[number];
export type KitId = 'home' | 'away' | 'blue' | 'orange' | 'purple' | 'teal' | 'lime' | 'pink' | 'snow' | 'sun' | 'night' | 'olive' | 'cocoa' | 'plum';

/** Harrison's club kits and opponents' kits, as colours only (no logos or sponsor). */
export const KITS: Record<KitId, Record<KitSlots, MasterColor>> = {
  home: {
    JerseyShadow: 'redDark',
    Jersey: 'red',
    JerseyLight: 'redLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'redDark',
    Shorts: 'red',
    SocksShadow: 'redDark',
    Socks: 'red',
  },
  // Black kit drawn one step lighter than true black so it never merges into the outline.
  away: {
    JerseyShadow: 'charcoal',
    Jersey: 'slate',
    JerseyLight: 'gray',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'charcoal',
    Shorts: 'slate',
    SocksShadow: 'charcoal',
    Socks: 'slate',
  },
  blue: {
    JerseyShadow: 'navy',
    Jersey: 'blue',
    JerseyLight: 'blueLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'navy',
    Shorts: 'blue',
    SocksShadow: 'navy',
    Socks: 'blue',
  },
  // The Park crew's: no two alike, none red or blue.
  orange: {
    JerseyShadow: 'flameDark',
    Jersey: 'flame',
    JerseyLight: 'flameLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'charcoal',
    Shorts: 'slate',
    SocksShadow: 'flameDark',
    Socks: 'flame',
  },
  purple: {
    JerseyShadow: 'violetDark',
    Jersey: 'violet',
    JerseyLight: 'violetLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'silver',
    Shorts: 'white',
    SocksShadow: 'violetDark',
    Socks: 'violet',
  },
  teal: {
    JerseyShadow: 'tealDark',
    Jersey: 'teal',
    JerseyLight: 'tealLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'tealDark',
    Shorts: 'teal',
    SocksShadow: 'silver',
    Socks: 'white',
  },
  lime: {
    JerseyShadow: 'voltShadow',
    Jersey: 'volt',
    JerseyLight: 'voltLight',
    TrimShadow: 'charcoal',
    Trim: 'slate',
    ShortsShadow: 'charcoal',
    Shorts: 'slate',
    SocksShadow: 'voltShadow',
    Socks: 'volt',
  },
  // Speedy Sam's: hot pink with black shorts, and white trim for his headband.
  pink: {
    JerseyShadow: 'pinkDark',
    Jersey: 'pink',
    JerseyLight: 'pinkLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'charcoal',
    Shorts: 'slate',
    SocksShadow: 'pinkDark',
    Socks: 'pink',
  },
  // The tryouts' kits: Hank's white with charcoal, Lola's gold, Finn's black with gold trim, and the three new ramps.
  snow: {
    JerseyShadow: 'silver',
    Jersey: 'white',
    JerseyLight: 'white',
    TrimShadow: 'ink',
    Trim: 'charcoal',
    ShortsShadow: 'ink',
    Shorts: 'charcoal',
    SocksShadow: 'silver',
    Socks: 'white',
  },
  sun: {
    JerseyShadow: 'goldDark',
    Jersey: 'gold',
    JerseyLight: 'energyGoldLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'silver',
    Shorts: 'white',
    SocksShadow: 'goldDark',
    Socks: 'gold',
  },
  night: {
    JerseyShadow: 'ink',
    Jersey: 'charcoal',
    JerseyLight: 'slate',
    TrimShadow: 'goldDark',
    Trim: 'gold',
    ShortsShadow: 'ink',
    Shorts: 'charcoal',
    SocksShadow: 'ink',
    Socks: 'charcoal',
  },
  olive: {
    JerseyShadow: 'oliveDark',
    Jersey: 'olive',
    JerseyLight: 'oliveLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'silver',
    Shorts: 'white',
    SocksShadow: 'oliveDark',
    Socks: 'olive',
  },
  cocoa: {
    JerseyShadow: 'cocoaDark',
    Jersey: 'cocoa',
    JerseyLight: 'cocoaLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'cocoaDark',
    Shorts: 'cocoa',
    SocksShadow: 'silver',
    Socks: 'white',
  },
  plum: {
    JerseyShadow: 'plumDark',
    Jersey: 'plum',
    JerseyLight: 'plumLight',
    TrimShadow: 'silver',
    Trim: 'white',
    ShortsShadow: 'charcoal',
    Shorts: 'slate',
    SocksShadow: 'plumDark',
    Socks: 'plum',
  },
};

export const VOLT_BOOTS: Record<'BootShadow' | 'Boot' | 'BootLight', MasterColor> = {
  BootShadow: 'voltShadow',
  Boot: 'volt',
  BootLight: 'voltLight',
};

/** A change kit's jersey (shadow, base, light) and socks (shadow, base). */
const CHANGE_KITS: Record<ChangeKit, { jersey: [MasterColor, MasterColor, MasterColor]; socks: [MasterColor, MasterColor] }> = {
  white: { jersey: ['silver', 'white', 'white'], socks: ['silver', 'white'] },
  black: { jersey: ['charcoal', 'slate', 'gray'], socks: ['charcoal', 'slate'] },
};

/** An opponent's look in a change kit: white (or black) jersey, trim in their own jersey colours, socks to match, their own shorts. */
export function changeLook(look: LookColors, change: ChangeKit): LookColors {
  const { jersey, socks } = CHANGE_KITS[change];
  return {
    ...look,
    JerseyShadow: jersey[0],
    Jersey: jersey[1],
    JerseyLight: jersey[2],
    TrimShadow: look.JerseyShadow,
    Trim: look.Jersey,
    SocksShadow: socks[0],
    Socks: socks[1],
  };
}
