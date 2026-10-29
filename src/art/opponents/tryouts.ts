import type { TryoutKidId } from '../../game/tryouts';
import type { HeadSprite } from '../body/head';
import type { HeadFacing } from '../body/pose';
import { HANK_BODY, HARRISON_BODY, type BodyProportions } from '../body/proportions';
import { ART_LEGEND, EXTRA_COLORS, type LookColors, type MasterColor } from '../colors';
import { parseGrid } from '../indexedImage';
import { KITS, type KitId } from '../kits';
import type { Point } from '../raster';

function head(rows: readonly string[], neck: Point): HeadSprite {
  return { image: parseGrid(rows, ART_LEGEND), neck };
}

/**
 * The tryouts' heads, made-up kids at Harrison's school, each readable at a
 * glance. Legend as the crew's: H/h/L/t hair shadow/base/light/tip, f the
 * short sides' fade, k/s skin/shadow, o eye.
 */
export const TRYOUT_HEADS: Readonly<Record<TryoutKidId, Record<HeadFacing, HeadSprite>>> = {
  // Header Hank: a squared-off flat top, high above the brow, and short sides.
  hank: {
    side: head(
      [
        '..HhhhhH..',
        '..HhLLhhH.',
        '.HHhhhhhh.',
        '.HhHkkkkk.',
        '.Hskkkkok.',
        '.Hskkkkkkk',
        '..skkkkks.',
        '..skkkkk..',
        '...skk....',
        '...skk....',
      ],
      { x: 4, y: 9 },
    ),
    threeQuarter: head(
      [
        '.HhhhhhH..',
        '.HhLLhhH..',
        'HHhhhhhhH.',
        'HHhkkkkkk.',
        'Hskokkok..',
        'Hskkkkkkk.',
        '.skkkkks..',
        '..skkkk...',
        '...kkk....',
        '...kkk....',
      ],
      { x: 4, y: 9 },
    ),
    front: head(
      [
        '.HhhhhhH.',
        '.HhLLLhH.',
        'HHhhhhhHH',
        'skkkkkkks',
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
  // Lofty Lola: a brown bob to the jaw, with a straight fringe.
  lola: {
    side: head(
      [
        '...HhhhH...',
        '..HhLhhhhH.',
        '.HhhhhhhhhH',
        '.HhhhhhhhhH',
        '.HhHhskkok.',
        '.HhHhskkkkk',
        '.HhHHskkks.',
        '..HH.skkk..',
        '.....skk...',
        '.....skk...',
      ],
      { x: 6, y: 9 },
    ),
    threeQuarter: head(
      [
        '..HhhhhH...',
        '.HhLhhhhH..',
        'HhhhhhhhhH.',
        'HhhhhhhhhH.',
        'HhHkokkok..',
        'HhHkkkkkkk.',
        'HHHskkkks..',
        '.HH.skkk...',
        '....kkk....',
        '....kkk....',
      ],
      { x: 5, y: 9 },
    ),
    front: head(
      [
        '..HhhhH..',
        '.HhLhhhH.',
        'HhhhhhhhH',
        'HhhhhhhhH',
        'HkokkkokH',
        'Hkkkskkkh',
        'Hkkkkkkkh',
        'HHkssskHH',
        '..skkks..',
        '...kkk...',
      ],
      { x: 4, y: 9 },
    ),
  },
  // Fake-Out Finn: a sandy fringe swept forward and over one eye.
  finn: {
    side: head(
      [
        '..HhhhH...',
        '.HhhhLLh..',
        'HHhhhhLLh.',
        'HHhhhhhhLh',
        'HHHskkhok.',
        'HHHskkkkkk',
        '.HHskkkks.',
        '..Hskkkk..',
        '...skk....',
        '...skk....',
      ],
      { x: 4, y: 9 },
    ),
    threeQuarter: head(
      [
        '..HhhhH...',
        '.HhhLLhh..',
        'HHhhhhLLh.',
        'HHhhhhhhL.',
        'HskokhhhL.',
        'Hskkkkkkk.',
        '.skkkkks..',
        '..skkkk...',
        '...kkk....',
        '...kkk....',
      ],
      { x: 4, y: 9 },
    ),
    front: head(
      [
        '..HhhhH..',
        '.HhhLLhH.',
        'HhhhhLLhH',
        'HhhhhhhLH',
        'skokhhhLs',
        'skkkskkks',
        'skkkkkkks',
        '.kkssskk.',
        '..skkks..',
        '...kkk...',
      ],
      { x: 4, y: 9 },
    ),
  },
  // Poacher Priya: black hair pulled back from a centre parting into one long plaited braid.
  priya: {
    side: head(
      [
        '...HhhhH..',
        '.HhLhhhhH.',
        'HHhhhhhhhh',
        'HHhHhhhhh.',
        'HHHskkkok.',
        'HHHskkkkkk',
        '.LHskkkks.',
        '.HLskkkk..',
        '.LH.skk...',
        '.HL.skk...',
      ],
      { x: 5, y: 9 },
    ),
    threeQuarter: head(
      [
        '..HhhhH...',
        '.HhLhhhhH.',
        'HHhhhhhhhH',
        'HHhHkkkkh.',
        'Hhskokkok.',
        'Hhskkkkkkk',
        '.HLskkkks.',
        '.LH.skkk..',
        '.HL..kkk..',
        '.LH..kkk..',
      ],
      { x: 6, y: 9 },
    ),
    front: head(
      [
        '..HhHhH..',
        '.HhhLhhH.',
        'HhhhLhhhH',
        'Hhkkkkkhh',
        'skokkkoks',
        'skkkskkks',
        'skkkkkkks',
        '.kkssskk.',
        '..skkks..',
        '...kkk...',
      ],
      { x: 4, y: 9 },
    ),
  },
  // Nutmeg Niko: a dark curly top, lit in little loops, over short faded sides.
  niko: {
    side: head(
      [
        '.hLhHhLh..',
        'HhLhhLhhh.',
        'HhhhhhhhhL',
        '.HhHhhkkk.',
        '.fskkkkok.',
        '.fskkkkkkk',
        '.sskkkkks.',
        '..skkkkk..',
        '...skk....',
        '...skk....',
      ],
      { x: 4, y: 9 },
    ),
    threeQuarter: head(
      [
        '.hLhHhLh..',
        'hLhhLhhLh.',
        'HhhhhhhhhL',
        'fhhkkkkkk.',
        'fskokkok..',
        'fskkkkkkk.',
        '.skkkkks..',
        '..skkkk...',
        '...kkk....',
        '...kkk....',
      ],
      { x: 4, y: 9 },
    ),
    front: head(
      [
        '.hLhHhLh.',
        'hLhhLhhLh',
        'HhhhhhhhH',
        'fkkkkkkkf',
        'skokkkoks',
        'skkkskkks',
        'skkkkkkks',
        '.kkssskk.',
        '..skkks..',
        '...kkk...',
      ],
      { x: 4, y: 9 },
    ),
  },
  // Pinpoint Paige: two round black puffs up top.
  paige: {
    side: head(
      [
        '.HhL......',
        'HhhhLhhH..',
        'HhhhhhhhH.',
        '.HhHhhhhh.',
        '.HHskkkok.',
        '..Hskkkkkk',
        '..sskkkks.',
        '...skkkk..',
        '....skk...',
        '....skk...',
      ],
      { x: 5, y: 9 },
    ),
    threeQuarter: head(
      [
        'HhL...HhL.',
        'HhhL.HhhhL',
        'HhhhhhhhH.',
        'HHhhkkkkh.',
        'Hskokkok..',
        'Hskkkkkkk.',
        '.skkkkks..',
        '..skkkk...',
        '...kkk....',
        '...kkk....',
      ],
      { x: 4, y: 9 },
    ),
    front: head(
      [
        '.HhL...HhL.',
        'HhhhL.HhhhL',
        '.HhhhhhhhH.',
        '.Hhkkkkkhh.',
        '.skokkkoks.',
        '.skkkskkks.',
        '.skkkkkkks.',
        '..kkssskk..',
        '...skkks...',
        '....kkk....',
      ],
      { x: 5, y: 9 },
    ),
  },
};

/** Hank is drawn taller; the rest share Harrison's build. Every one plays on Max's physics body. */
export const TRYOUT_BODY: Readonly<Record<TryoutKidId, BodyProportions>> = {
  hank: HANK_BODY,
  lola: HARRISON_BODY,
  finn: HARRISON_BODY,
  priya: HARRISON_BODY,
  niko: HARRISON_BODY,
  paige: HARRISON_BODY,
};

type Skin = Record<'SkinShadow' | 'Skin' | 'SkinLight' | 'Blush' | 'Lip', MasterColor>;
type Hair = Record<'HairShadow' | 'Hair' | 'HairLight' | 'HairTip', MasterColor>;
type Boots = Record<'BootShadow' | 'Boot' | 'BootLight', MasterColor>;

const LIGHT: Skin = { SkinShadow: 'skinShadow', Skin: 'skin', SkinLight: 'skinLight', Blush: 'blush', Lip: 'lip' };
const TAN: Skin = { SkinShadow: 'tanShadow', Skin: 'tan', SkinLight: 'tanLight', Blush: 'tanLip', Lip: 'tanLip' };
const BROWN: Skin = { SkinShadow: 'brownShadow', Skin: 'brown', SkinLight: 'brownLight', Blush: 'brownLip', Lip: 'brownLip' };
const BLACK_HAIR: Hair = { HairShadow: 'black', Hair: 'black', HairLight: 'charcoal', HairTip: 'charcoal' };
const DARK_BOOTS: Boots = { BootShadow: 'charcoal', Boot: 'slate', BootLight: 'gray' };
const WHITE_BOOTS: Boots = { BootShadow: 'silver', Boot: 'white', BootLight: 'white' };

const LOOKS: Record<TryoutKidId, { skin: Skin; hair: Hair; kit: KitId; boots: Boots }> = {
  hank: { skin: BROWN, hair: BLACK_HAIR, kit: 'snow', boots: DARK_BOOTS },
  lola: { skin: LIGHT, hair: { HairShadow: 'hairShadow', Hair: 'hair', HairLight: 'hairLight', HairTip: 'hairTip' }, kit: 'sun', boots: WHITE_BOOTS },
  // Sandy, lighter than his tan skin so the fringe reads against it; its shadow is his trim's gold.
  finn: { skin: TAN, hair: { HairShadow: 'goldDark', Hair: 'hairTip', HairLight: 'energyGoldLight', HairTip: 'energyGoldLight' }, kit: 'night', boots: DARK_BOOTS },
  priya: { skin: TAN, hair: BLACK_HAIR, kit: 'olive', boots: WHITE_BOOTS },
  niko: { skin: LIGHT, hair: { HairShadow: 'black', Hair: 'hairShadow', HairLight: 'hair', HairTip: 'hair' }, kit: 'cocoa', boots: WHITE_BOOTS },
  paige: { skin: BROWN, hair: BLACK_HAIR, kit: 'plum', boots: WHITE_BOOTS },
};

export function tryoutLook(id: TryoutKidId): LookColors {
  const { skin, hair, kit, boots } = LOOKS[id];
  return { Outline: 'outline', ...skin, EyeWhite: 'white', Iris: 'iris', Pupil: 'ink', ...hair, Fade: 'fade', Earring: 'white', ...KITS[kit], ...boots, ...EXTRA_COLORS };
}
