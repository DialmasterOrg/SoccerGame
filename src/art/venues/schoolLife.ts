import { M, type MasterColor } from '../colors';
import { IndexedImage, parseGrid } from '../indexedImage';
import { BLEACHERS, BLEACHER_TIER_H, FLAGPOLE, SCHOOL_FAR_SY } from './school';

/** The School Field's life, in master ids like every venue's art: the bleacher crowd, the flag and a few drifting leaves. */

/** The crowd's box on the near layer, its top-left: on the bleachers, with headroom for arms up. */
const CROWD_MARGIN = 4;
const CROWD_HEADROOM = 16;
export const CROWD_AT = { x: BLEACHERS.x0 + CROWD_MARGIN, y: BLEACHERS.top - CROWD_HEADROOM } as const;
const CROWD_W = BLEACHERS.x1 - BLEACHERS.x0 - 2 * CROWD_MARGIN;
const CROWD_H = SCHOOL_FAR_SY - 1 - CROWD_AT.y;
const PEOPLE = 18;
const TIERS = Math.floor((SCHOOL_FAR_SY - BLEACHERS.top) / BLEACHER_TIER_H);
/** Each tier is set in this much more at each end than the one below. */
const TIER_INSET = 3;
/** A person: 3 px wide, a kid or an adult's body, a 3-row head with a row of hair. */
const PERSON = { w: 3, kid: 4, adult: 6, head: 3, standUp: 2, armsUp: 3 } as const;
const SHIRTS: readonly MasterColor[] = ['red', 'blue', 'volt', 'white', 'teal', 'flame', 'violet', 'pink', 'navy', 'gold'];
const SKINS: readonly MasterColor[] = ['skin', 'tan', 'skinLight', 'brownLight', 'brown'];
const HAIRS: readonly MasterColor[] = ['hairShadow', 'black', 'hairLight', 'hair', 'flameDark'];

/** The flag's top-left on the mid layer, at the flagpole's top. */
export const FLAG_AT = { x: FLAGPOLE.x + 1, y: FLAGPOLE.top + 1 } as const;
export const FLAG_FRAMES = 3;
/** Four stripes of two rows, with a row above and below for the ripple. */
const FLAG = { w: 15, stripes: 4, stripeH: 2, ripple: 1 } as const;
const STRIPE_COLORS: readonly MasterColor[] = ['navy', 'white'];

export interface Leaf {
  color: MasterColor;
  /** Where it starts, in screen px. */
  startX: number;
  /** Its row in the School's art rows. */
  y: number;
  /** px/s across the screen; negative drifts left. */
  speed: number;
  /** How far it sways about its row, and how long one sway takes. */
  swayPx: number;
  swayS: number;
}

/** Four or five leaves drifting across, in the School's art rows; x in screen px, wrapping over the view's width. */
export const LEAVES: readonly Leaf[] = [
  { color: 'flame', startX: 40, y: 70, speed: 22, swayPx: 3, swayS: 1.7 },
  { color: 'gold', startX: 300, y: 95, speed: -18, swayPx: 2, swayS: 2.3 },
  { color: 'flameDark', startX: 180, y: 120, speed: 26, swayPx: 3, swayS: 1.9 },
  { color: 'flameLight', startX: 420, y: 140, speed: -14, swayPx: 2, swayS: 2.9 },
  { color: 'goldDark', startX: 90, y: 110, speed: 19, swayPx: 3, swayS: 2.1 },
];
const LEAF_ROWS = [
  ['###', '#..', '...'],
  ['..#', '.##', '#..'],
] as const;

/** Deterministic 0..1 noise, so the crowd sits the same every build. */
function noise(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

function fill(img: IndexedImage, x: number, y: number, w: number, h: number, id: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) img.set(xx, yy, id);
}

interface Person {
  x: number;
  /** The row their feet stand on, in the box. */
  feetY: number;
  bodyH: number;
  shirt: number;
  skin: number;
  hair: number;
}

/** Kids and parents spread over the tiers, each on a seat row, never two the same way. */
function people(): Person[] {
  const out: Person[] = [];
  for (let i = 0; i < PEOPLE; i++) {
    const tier = i % TIERS;
    const seatY = SCHOOL_FAR_SY - BLEACHER_TIER_H - tier * BLEACHER_TIER_H;
    const inset = tier * TIER_INSET;
    const span = CROWD_W - 2 * inset - PERSON.w;
    out.push({
      x: inset + Math.floor(noise(i, 11) * span),
      feetY: seatY - 1 - CROWD_AT.y,
      bodyH: noise(i, 5) < 0.35 ? PERSON.adult : PERSON.kid,
      shirt: M[SHIRTS[i % SHIRTS.length]!],
      skin: M[SKINS[i % SKINS.length]!],
      hair: M[HAIRS[i % HAIRS.length]!],
    });
  }
  return out;
}

/** One frame of the crowd: sitting (bobbing: every third person lifted a pixel on `lift`), or on their feet with arms up. */
function crowdFrame(cheer: boolean, lift: number): IndexedImage {
  const img = new IndexedImage(CROWD_W, CROWD_H);
  people().forEach((p, i) => {
    const up = cheer ? PERSON.standUp + lift : i % 3 === 0 ? lift : 0;
    const feet = p.feetY - up;
    const bodyTop = feet - p.bodyH + 1;
    const headTop = bodyTop - PERSON.head;
    fill(img, p.x, bodyTop, PERSON.w, p.bodyH, p.shirt);
    fill(img, p.x, headTop, PERSON.w, PERSON.head, p.skin);
    fill(img, p.x, headTop, PERSON.w, 1, p.hair);
    if (cheer) {
      const armTop = headTop - PERSON.armsUp - lift;
      fill(img, p.x - 1, armTop, 1, PERSON.armsUp, p.skin);
      fill(img, p.x + PERSON.w, armTop, 1, PERSON.armsUp, p.skin);
    }
  });
  return img;
}

/** Kids and parents on the bleachers, each frame the box's size: two bob frames, and two cheering ones (on their feet, arms up). */
export function crowdFrames(): { bob: readonly [IndexedImage, IndexedImage]; cheer: readonly [IndexedImage, IndexedImage] } {
  return { bob: [crowdFrame(false, 0), crowdFrame(false, 1)], cheer: [crowdFrame(true, 0), crowdFrame(true, 1)] };
}

/** A plain striped flag rippling: each column rides a wave that grows from the hoist to the fly. */
export function flagFrames(): IndexedImage[] {
  const h = FLAG.stripes * FLAG.stripeH + 2 * FLAG.ripple;
  return Array.from({ length: FLAG_FRAMES }, (_, k) => {
    const img = new IndexedImage(FLAG.w, h);
    for (let x = 0; x < FLAG.w; x++) {
      const u = x / (FLAG.w - 1);
      const dy = Math.round(Math.sin(u * 2 * Math.PI + (k * 2 * Math.PI) / FLAG_FRAMES) * u * FLAG.ripple);
      for (let s = 0; s < FLAG.stripes; s++) fill(img, x, FLAG.ripple + s * FLAG.stripeH + dy, 1, FLAG.stripeH, M[STRIPE_COLORS[s % STRIPE_COLORS.length]!]);
    }
    return img;
  });
}

/** One leaf's two tumble frames, 3x3 px. */
export function leafFrames(color: MasterColor): readonly [IndexedImage, IndexedImage] {
  const legend = { '#': M[color] };
  return [parseGrid(LEAF_ROWS[0], legend), parseGrid(LEAF_ROWS[1], legend)];
}
