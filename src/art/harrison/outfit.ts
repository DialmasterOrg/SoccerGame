import type { BootsItemId, KitItemId, Outfit } from '../../meta/locker';
import type { BodyExtras } from '../body/drawFigure';
import type { HeadFacing } from '../body/pose';
import type { LookColors, MasterColor } from '../colors';
import type { IndexedImage } from '../indexedImage';
import { KITS, VOLT_BOOTS, type KitSlots } from '../kits';
import { headsWith } from './extras';
import { HARRISON_HEADS, HARRISON_POWER_HEADS, type HeadSprite } from './head';
import { lookIn, type BootSlots, type PowerForm } from './look';
import { harrisonPortrait, type Expression } from './portrait';

/** One kit's colours, in KitSlots order: jersey shadow / jersey / light, trim shadow / trim, shorts shadow / shorts, socks shadow / socks. */
const kit = (...c: [MasterColor, MasterColor, MasterColor, MasterColor, MasterColor, MasterColor, MasterColor, MasterColor, MasterColor]): Record<KitSlots, MasterColor> => ({
  JerseyShadow: c[0], Jersey: c[1], JerseyLight: c[2],
  TrimShadow: c[3], Trim: c[4],
  ShortsShadow: c[5], Shorts: c[6],
  SocksShadow: c[7], Socks: c[8],
});

const boots = (BootShadow: MasterColor, Boot: MasterColor, BootLight: MasterColor): Record<BootSlots, MasterColor> => ({ BootShadow, Boot, BootLight });

/** Harrison's kits, apart from the opponents' table (his PURPLE isn't Leo's). The spec's table, in the catalogue's order. */
export const HARRISON_KITS: Readonly<Record<KitItemId, Record<KitSlots, MasterColor>>> = {
  home: KITS.home,
  away: KITS.away,
  white: kit('silver', 'white', 'white', 'navy', 'navy', 'navy', 'navy', 'silver', 'white'),
  sky: kit('blueLight', 'sky', 'skyLight', 'silver', 'white', 'silver', 'white', 'blueLight', 'sky'),
  purple: kit('violetDark', 'violet', 'violetLight', 'silver', 'white', 'violetDark', 'violet', 'violetDark', 'violet'),
  navy: kit('ink', 'navy', 'blue', 'goldDark', 'gold', 'ink', 'navy', 'ink', 'navy'),
  blackGold: kit('charcoal', 'slate', 'gray', 'goldDark', 'energyGold', 'charcoal', 'slate', 'goldDark', 'gold'),
  ice: kit('electric', 'electricLight', 'white', 'blue', 'electric', 'silver', 'white', 'electric', 'electricLight'),
  inferno: kit('flameDark', 'flame', 'flameLight', 'gold', 'energyGold', 'redDark', 'red', 'flameDark', 'flame'),
  gold: kit('goldDark', 'gold', 'energyGold', 'silver', 'white', 'goldDark', 'gold', 'silver', 'white'),
};

export const HARRISON_BOOTS: Readonly<Record<BootsItemId, Record<BootSlots, MasterColor>>> = {
  volt: VOLT_BOOTS,
  white: boots('silver', 'white', 'white'),
  black: boots('black', 'charcoal', 'slate'),
  red: boots('redDark', 'red', 'redLight'),
  blue: boots('navy', 'blue', 'blueLight'),
  pink: boots('pinkDark', 'pink', 'pinkLight'),
  fire: boots('flameDark', 'flame', 'flameLight'),
  lightning: boots('blue', 'electric', 'electricLight'),
  gold: boots('goldDark', 'gold', 'energyGold'),
};

export const outfitLook = (o: Outfit, form: PowerForm = 'base'): LookColors => lookIn(HARRISON_KITS[o.kit], HARRISON_BOOTS[o.boots], form);

export const outfitHeads = (o: Outfit, power: boolean): Record<HeadFacing, HeadSprite> =>
  headsWith(power ? HARRISON_POWER_HEADS : HARRISON_HEADS, power, o.extras.includes('glasses'), o.extras.includes('headband'));

export const outfitBody = (o: Outfit): BodyExtras => ({ wristbands: o.extras.includes('wristbands'), armband: o.extras.includes('armband'), gloves: false });

/** His portrait in `o`: kit colours come from outfitLook; it shows the glasses and headband, still. */
export const outfitPortrait = (o: Outfit, expression: Expression): IndexedImage =>
  harrisonPortrait(expression, { glasses: o.extras.includes('glasses'), headband: o.extras.includes('headband') });
