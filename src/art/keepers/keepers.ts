import type { HeadSprite } from '../body/head';
import { NO_BODY_EXTRAS, type BodyExtras } from '../body/drawFigure';
import type { HeadFacing } from '../body/pose';
import { HARRISON_BODY, type BodyProportions } from '../body/proportions';
import { ART_LEGEND, EXTRA_COLORS, type LookColors, type MasterColor } from '../colors';
import { parseGrid } from '../indexedImage';
import type { KitSlots } from '../kits';
import type { Point } from '../raster';
import { GUS_BODY, GUS_EXTRAS, GUS_HEADS } from './gus';

export type KeeperId = 'eddie' | 'backupA' | 'backupB' | 'gus';

/** For the sheet: never on the HUD (Gus's match names GUS). */
export const KEEPER_NAMES: Readonly<Record<KeeperId, string>> = { eddie: 'STEADY EDDIE', backupA: 'BACKUP MO', backupB: 'BACKUP JUNE', gus: 'GOALIE GUS' };

function head(rows: readonly string[], neck: Point): HeadSprite {
  return { image: parseGrid(rows, ART_LEGEND), neck };
}

/**
 * The keepers' heads, made-up kids. Legend: H/h/L hair shadow/base/light,
 * f fade, k/s skin/shadow, o eye.
 */
export const KEEPER_HEADS: Readonly<Record<KeeperId, Record<HeadFacing, HeadSprite>>> = {
  // Steady Eddie: a tall flat-top, faded at the sides.
  eddie: {
    side: head(
      [
        '.HhhhhhH..',
        '.hhLhhhhH.',
        '.Hhhhhhhh.',
        '.ffskkkkk.',
        '.fskkkkok.',
        '.fskkkkkkk',
        '.sskkkkks.',
        '..skkkkk..',
        '...skkk...',
        '...skkk...',
      ],
      { x: 4, y: 9 },
    ),
    threeQuarter: head(
      [
        '.HhhhhhhH.',
        '.hhLhhhhh.',
        '.Hhhhhhhh.',
        '.fskkkkkk.',
        '.fskokkok.',
        '.skkkkkkk.',
        '.sskkkkks.',
        '..skkkk...',
        '...kkkk...',
        '...kkkk...',
      ],
      { x: 4, y: 9 },
    ),
    front: head(
      [
        '.HhhhhhH.',
        '.hhLhhhh.',
        '.Hhhhhhh.',
        'fkkkkkkkf',
        'skokkkoks',
        'skkkskkks',
        'skkkkkkks',
        '.kkssskk.',
        '..skkks..',
        '..skkks..',
      ],
      { x: 4, y: 9 },
    ),
  },
  // The first backup: a brown mop cut straight across, down to the eyes.
  backupA: {
    side: head(
      [
        '..hhhhh...',
        '.hLhhhhhh.',
        'HhhhhhhhhH',
        'Hhhhhhhhh.',
        'HHhskkkok.',
        'HHhskkkkkk',
        '.HHskkkks.',
        '..Hskkkk..',
        '...skk....',
        '...skk....',
      ],
      { x: 4, y: 9 },
    ),
    threeQuarter: head(
      [
        '..hhhhhh..',
        '.hLhhhhhh.',
        'HhhhhhhhhH',
        'Hhhhhhhhhh',
        'Hhskokkok.',
        'Hhskkkkkkk',
        '.Hskkkkks.',
        '..skkkk...',
        '...kkk....',
        '...kkk....',
      ],
      { x: 4, y: 9 },
    ),
    front: head(
      [
        '..hhhhh..',
        '.hLhhhhh.',
        'HhhhhhhhH',
        'HhhhhhhhH',
        'Hkokkkokh',
        'hkkkskkkh',
        'Hkkkkkkkh',
        '.kkssskk.',
        '..skkks..',
        '...kkk...',
      ],
      { x: 4, y: 9 },
    ),
  },
  // The second backup: black hair pulled up into a bun on top.
  backupB: {
    side: head(
      [
        '...HhH....',
        '...hhh....',
        '..HhhhhH..',
        '.Hhhhhhhh.',
        '.HHskkkkk.',
        '.Hskkkkok.',
        '.Hskkkkkkk',
        '.sskkkkks.',
        '..skkkkk..',
        '...skk....',
        '...skk....',
      ],
      { x: 4, y: 10 },
    ),
    threeQuarter: head(
      [
        '....HhH...',
        '....hhh...',
        '..HHhhhH..',
        '.Hhhhhhhh.',
        '.Hhhhkhhh.',
        '.skokkokk.',
        '.skkkkkkk.',
        '.sskkkkks.',
        '..skkkk...',
        '...kkkk...',
        '...kkkk...',
      ],
      { x: 4, y: 10 },
    ),
    front: head(
      [
        '...HhH...',
        '...hhh...',
        '..HhhhH..',
        '.Hhhhhhh.',
        'HhhkkkhhH',
        'skokkkoks',
        'skkkskkks',
        'skkkkkkks',
        '.kkssskk.',
        '..skkks..',
        '...kkk...',
      ],
      { x: 4, y: 10 },
    ),
  },
  gus: GUS_HEADS,
};

/** Every keeper wears gloves. */
export const KEEPER_EXTRAS: BodyExtras = { ...NO_BODY_EXTRAS, gloves: true };

/** Every keeper but Gus has Harrison's body. */
export const keeperBody = (id: KeeperId): BodyProportions => (id === 'gus' ? GUS_BODY : HARRISON_BODY);
/** Gus's gloves are bigger, and he wears the captain's armband. */
export const keeperExtras = (id: KeeperId): BodyExtras => (id === 'gus' ? GUS_EXTRAS : KEEPER_EXTRAS);

type Skin = Record<'SkinShadow' | 'Skin' | 'SkinLight' | 'Blush' | 'Lip', MasterColor>;
type Hair = Record<'HairShadow' | 'Hair' | 'HairLight' | 'HairTip' | 'Fade', MasterColor>;
type Boots = Record<'BootShadow' | 'Boot' | 'BootLight', MasterColor>;

/** A keeper's top (shadow, base, light), trim (shadow, base) and socks (shadow, base); every keeper's shorts are black. */
const top = (jersey: [MasterColor, MasterColor, MasterColor], trim: [MasterColor, MasterColor], socks: [MasterColor, MasterColor]): Record<KitSlots, MasterColor> => ({
  JerseyShadow: jersey[0], Jersey: jersey[1], JerseyLight: jersey[2],
  TrimShadow: trim[0], Trim: trim[1],
  ShortsShadow: 'charcoal', Shorts: 'slate',
  SocksShadow: socks[0], Socks: socks[1],
});

const BLACK_HAIR: Omit<Hair, 'Fade'> = { HairShadow: 'black', Hair: 'black', HairLight: 'charcoal', HairTip: 'charcoal' };
const LOOKS: Record<KeeperId, { skin: Skin; hair: Hair; top: Record<KitSlots, MasterColor>; boots: Boots }> = {
  eddie: {
    skin: { SkinShadow: 'brownShadow', Skin: 'brown', SkinLight: 'brownLight', Blush: 'brownLip', Lip: 'brownLip' },
    hair: { ...BLACK_HAIR, Fade: 'brownShadow' },
    top: top(['emeraldDark', 'emerald', 'emeraldLight'], ['silver', 'white'], ['emeraldDark', 'emerald']),
    boots: { BootShadow: 'charcoal', Boot: 'slate', BootLight: 'gray' },
  },
  backupA: {
    skin: { SkinShadow: 'skinShadow', Skin: 'skin', SkinLight: 'skinLight', Blush: 'blush', Lip: 'lip' },
    hair: { HairShadow: 'hairShadow', Hair: 'hair', HairLight: 'hairLight', HairTip: 'hairLight', Fade: 'fade' },
    top: top(['berryDark', 'berry', 'berryLight'], ['silver', 'white'], ['berryDark', 'berry']),
    boots: { BootShadow: 'silver', Boot: 'white', BootLight: 'white' },
  },
  backupB: {
    skin: { SkinShadow: 'tanShadow', Skin: 'tan', SkinLight: 'tanLight', Blush: 'tanLip', Lip: 'tanLip' },
    hair: { ...BLACK_HAIR, Fade: 'tanShadow' },
    top: top(['lemonDark', 'lemon', 'lemonLight'], ['black', 'charcoal'], ['lemonDark', 'lemon']),
    boots: { BootShadow: 'silver', Boot: 'white', BootLight: 'white' },
  },
  // Goalie Gus: ginger, freckled, in cyan; his boots share his shorts' greys so every frame stays within 14 colours.
  gus: {
    skin: { SkinShadow: 'skinShadow', Skin: 'skin', SkinLight: 'skinLight', Blush: 'blush', Lip: 'lip' },
    hair: { HairShadow: 'flameDark', Hair: 'flame', HairLight: 'flameLight', HairTip: 'flameLight', Fade: 'skinShadow' },
    top: top(['cyanDark', 'cyan', 'cyanLight'], ['silver', 'white'], ['cyanDark', 'cyan']),
    boots: { BootShadow: 'charcoal', Boot: 'slate', BootLight: 'slate' },
  },
};

export function keeperLook(id: KeeperId): LookColors {
  const { skin, hair, top, boots } = LOOKS[id];
  return { Outline: 'outline', ...skin, EyeWhite: 'white', Iris: 'iris', Pupil: 'ink', ...hair, Earring: 'white', ...top, ...boots, ...EXTRA_COLORS };
}
