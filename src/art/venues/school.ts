import { BIG_VIEW, DEPTH_SHEAR, project } from '../../game/camera';
import { SCHOOL_FIELD } from '../../game/field';
import { M, type MasterColor } from '../colors';
import { IndexedImage } from '../indexedImage';
import { ditherRect, fillCircle, fillRect } from '../scenery';
import { PARALLAX, type VenueLayers } from './backyard';
import { along, pitchGround, plot } from './pitch';

const W = BIG_VIEW.w;
const H = BIG_VIEW.h;
/** The far touchline's row in the big view: the fence and the bleachers stand on it. */
export const SCHOOL_FAR_SY = BIG_VIEW.nearSY - SCHOOL_FIELD.depth;
const MAX_CAM_X = SCHOOL_FIELD.width + SCHOOL_FIELD.depth * DEPTH_SHEAR - W;
/** Mid and near each cover the big view's whole scroll at their parallax. */
export const SCHOOL_MID_W = Math.ceil(PARALLAX.mid * MAX_CAM_X) + W;
export const SCHOOL_NEAR_W = Math.ceil(PARALLAX.near * MAX_CAM_X) + W;
const FENCE_H = 16;
/** The first fence row; everything on the mid layer stands on the row above it. */
const FENCE_TOP = SCHOOL_FAR_SY - FENCE_H;
const POST_EVERY = 32;
/** One pixel in this many of the fence's face is wire. */
const MESH_EVERY = 3;
/** The fence along the far touchline: a wire every fourth pixel each way, a post every so often. */
const FAR_FENCE = { mesh: 4, postEvery: 40, postW: 2 };
/** Sky bands, top down: pale blue, a dither, the electric light, a dither, then the white haze to the tree line. */
const SKY = { light: 53, dither: 8, haze: 94, hazeDither: 8 } as const;
/** The far tree line: hazy crowns every so many px with their centres this far above the fence, over a solid band. */
const FAR_TREES = { every: 15, r: 9, rSpread: 5, above: 44, lift: 6, band: 40 } as const;
/** The low sun sits past the far layer's farthest scroll (0.2 × 784 = 157 px), so its wrapped copy never shows beside it. */
const SUN = { x: 200, y: 44, r: 10, core: 6 } as const;
const CLOUDS = [
  [150, 30, 46],
  [168, 33, 30],
  [380, 22, 54],
  [400, 25, 26],
] as const;
/** The school on the mid layer: two storeys of pale brick from x0 to x1, this tall, flat-roofed. */
const SCHOOL = { x0: 15, x1: 300, h: 54, roof: 4, brickEvery: 3, brickW: 6 } as const;
const WINDOW = { w: 12, h: 13, every: 17, rows: [7, 29], inset: 7 } as const;
const DOOR = { w: 22, top: 26, canopyTop: 22, signTop: 14 } as const;
/** The flagpole on the mid layer: its x and the row of its top. Task 6's flag flies from it. */
export const FLAGPOLE = { x: SCHOOL.x1 + 10, top: SCHOOL_FAR_SY - FENCE_H - SCHOOL.h - 30 } as const;
const BUS = { x: 318, w: 70, h: 24 } as const;
/** The bleachers on the near layer: their x span and top seat row. The life's crowd sits on them, a tier every BLEACHER_TIER_H rows down from the top. */
const TIERS = 5;
export const BLEACHER_TIER_H = 5;
const TIER_H = BLEACHER_TIER_H;
export const BLEACHERS = { x0: 960, x1: 1094, top: SCHOOL_FAR_SY - TIER_H - (TIERS - 1) * TIER_H } as const;
/** Fallen leaves: on the far part of the pitch from this depth, this share of the grass pixels; and piled this many rows deep at the fence foot. */
const LEAVES = { fromZ: 96, share: 0.012, pile: 3, pileShare: 0.3 } as const;
const LEAF_COLORS: readonly MasterColor[] = ['flame', 'gold', 'flameDark', 'goldDark'];

/** Deterministic 0..1 noise for scattering, so the art is the same every build. */
function noise(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** A disc whose every pixel picks its own colour (or none), wrapping round the image's width when asked. */
function disc(img: IndexedImage, cx: number, cy: number, r: number, pick: (dx: number, dy: number) => number | null, wrap = false): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const c = pick(dx, dy);
      if (c === null) continue;
      const x = Math.round(cx + dx);
      img.set(wrap ? ((x % img.width) + img.width) % img.width : x, Math.round(cy + dy), c);
    }
  }
}

/**
 * An end fence: chain-link across the whole depth on the face toward the
 * pitch, a wire every third pixel, with a post every POST_EVERY and a top rail.
 */
function chainLinkEnd(img: IndexedImage, x0: number, x1: number): void {
  const x = x0 === 0 ? x1 : x0;
  along(0, SCHOOL_FIELD.depth, z =>
    along(0, FENCE_H - 1, y => {
      const frame = Math.abs(z % POST_EVERY) < 0.5 || y >= FENCE_H - 1;
      const p = project(x, y, z, { x: 0, view: BIG_VIEW });
      if (frame) plot(img, x, y, z, M.slate, BIG_VIEW);
      else if ((Math.round(p.sx) + Math.round(p.sy)) % MESH_EVERY === 0) plot(img, x, y, z, M.silver, BIG_VIEW);
    }),
  );
}

/** A pale autumn morning: blue overhead lightening to a white haze, a low sun, thin clouds, and a hazy tree line down to the fence. Tiles seamlessly. */
function far(): IndexedImage {
  const img = new IndexedImage(W, H);
  fillRect(img, 0, 0, W, SKY.light, M.skyLight);
  ditherRect(img, 0, SKY.light, W, SKY.dither, M.skyLight, M.electricLight);
  fillRect(img, 0, SKY.light + SKY.dither, W, SKY.haze - SKY.light - SKY.dither, M.electricLight);
  ditherRect(img, 0, SKY.haze, W, SKY.hazeDither, M.electricLight, M.auraWhite);
  fillRect(img, 0, SKY.haze + SKY.hazeDither, W, H - SKY.haze - SKY.hazeDither, M.auraWhite);
  fillCircle(img, SUN.x, SUN.y, SUN.r, M.energyGoldLight);
  fillCircle(img, SUN.x, SUN.y, SUN.core, M.auraWhite);
  for (const [x, y, len] of CLOUDS) fillRect(img, x, y, len, 2, M.white);
  // The crowns are painted wrapped, so the seam falls inside a crown as naturally as anywhere else.
  for (let x = 0; x < W; x += FAR_TREES.every) {
    const r = FAR_TREES.r + Math.floor(noise(x, 3) * FAR_TREES.rSpread);
    const cy = FENCE_TOP - FAR_TREES.above - Math.floor(noise(x, 7) * FAR_TREES.lift);
    disc(img, x, cy, r, (dx, dy) => (noise(x + dx, cy + dy) < 0.5 ? M.tanLight : M.tan), true);
  }
  fillRect(img, 0, FENCE_TOP - FAR_TREES.band, W, FAR_TREES.band, M.tanShadow);
  // A strip of beaten earth behind the fence, then whatever the ground covers.
  fillRect(img, 0, FENCE_TOP, W, FENCE_H, M.fade);
  fillRect(img, 0, SCHOOL_FAR_SY, W, H - SCHOOL_FAR_SY, M.tanShadow);
  return img;
}

/** A round autumn crown lit from the upper left, speckled in two warm colours, on a trunk standing on `base`. */
function autumnTree(img: IndexedImage, cx: number, base: number, r: number, light: number, mid: number, dark: number, trunkH: number): void {
  fillRect(img, cx - 2, base - trunkH, 4, trunkH, M.brownShadow);
  const cy = base - trunkH - r + 4;
  for (const [ox, oy, rr] of [
    [0, 0, r],
    [-r * 0.7, r * 0.3, r * 0.7],
    [r * 0.7, r * 0.35, r * 0.7],
  ] as const) {
    disc(img, cx + ox, cy + oy, Math.round(rr), (dx, dy) => {
      const n = noise(Math.round(cx + ox + dx), Math.round(cy + oy + dy));
      const lit = dx + dy < -rr * 0.35;
      const shade = dx + dy > rr * 0.6;
      if (n < 0.08) return shade ? mid : light;
      return lit ? light : shade ? dark : mid;
    });
  }
}

/** The school: two storeys of pale brick with a flat roof, rows of windows, a canopy over navy doors, and a plain sign with nothing on it. */
function school(img: IndexedImage, base: number): void {
  const { x0, x1 } = SCHOOL;
  const top = base - SCHOOL.h;
  fillRect(img, x0 - 3, top - SCHOOL.roof, x1 - x0 + 6, SCHOOL.roof, M.charcoal);
  fillRect(img, x0, top, x1 - x0, base - top, M.tan);
  for (let y = top + 2; y < base; y += SCHOOL.brickEvery) {
    for (let x = x0 + ((y / SCHOOL.brickEvery) % 2) * 3; x < x1; x += SCHOOL.brickW) fillRect(img, x, y, 2, 1, M.tanShadow);
  }
  fillRect(img, x0, top, x1 - x0, 1, M.tanLight);
  const doorX = Math.round((x0 + x1) / 2) - 11;
  for (const row of WINDOW.rows.map(r => top + r)) {
    for (let x = x0 + WINDOW.inset; x + WINDOW.w < x1; x += WINDOW.every) {
      if (row > top + 20 && x + WINDOW.w > doorX - 3 && x < doorX + DOOR.w + 3) continue;
      fillRect(img, x - 1, row - 1, WINDOW.w + 2, WINDOW.h + 2, M.white);
      fillRect(img, x, row, WINDOW.w, WINDOW.h, M.skyLight);
      fillRect(img, x, row + 6, WINDOW.w, 1, M.white);
      fillRect(img, x + 1, row + 1, 3, 2, M.electricLight);
    }
  }
  fillRect(img, doorX - 6, top + DOOR.canopyTop, DOOR.w + 12, 3, M.slate);
  fillRect(img, doorX - 5, top + DOOR.canopyTop + 3, 1, 6, M.gray);
  fillRect(img, doorX + DOOR.w + 4, top + DOOR.canopyTop + 3, 1, 6, M.gray);
  fillRect(img, doorX, top + DOOR.top, DOOR.w, base - top - DOOR.top, M.navy);
  fillRect(img, doorX + 10, top + DOOR.top, 2, base - top - DOOR.top, M.blueLight);
  // A plain sign panel over the doors: a stripe, no words, no crest.
  fillRect(img, doorX - 2, top + DOOR.signTop, DOOR.w + 4, 6, M.navy);
  fillRect(img, doorX, top + DOOR.signTop + 2, DOOR.w, 2, M.gold);
}

/** The flagpole beside the school, bare: the flag is the life's. */
function flagpole(img: IndexedImage, base: number): void {
  fillRect(img, FLAGPOLE.x, FLAGPOLE.top, 1, base - FLAGPOLE.top, M.silver);
  fillRect(img, FLAGPOLE.x - 1, FLAGPOLE.top - 1, 3, 1, M.gold);
}

/** A yellow school bus parked beside the school, behind the fence. */
function bus(img: IndexedImage, x: number, base: number): void {
  const y = base - BUS.h;
  const w = BUS.w;
  fillRect(img, x, y + 2, w, 16, M.gold);
  fillRect(img, x + 2, y, w - 4, 2, M.gold);
  fillRect(img, x, y + 14, w, 4, M.goldDark);
  fillRect(img, x + 58, y + 6, 12, 12, M.gold);
  fillRect(img, x + 2, y + 4, 54, 6, M.ink);
  for (let wx = x + 3; wx < x + 54; wx += 8) fillRect(img, wx, y + 5, 6, 4, M.skyLight);
  fillRect(img, x + 59, y + 7, 8, 5, M.skyLight);
  fillRect(img, x, y + 12, w, 1, M.black);
  for (const wx of [x + 10, x + 54]) {
    fillCircle(img, wx, y + 19, 4, M.black);
    img.set(wx, y + 19, M.silver);
  }
  fillRect(img, x + w - 1, y + 13, 2, 2, M.flame);
}

/** The school, its flagpole, the bus and big orange and gold trees, all standing on the row above the fence. */
function mid(): IndexedImage {
  const img = new IndexedImage(SCHOOL_MID_W, H);
  const base = FENCE_TOP;
  autumnTree(img, 8, base, 18, M.flameLight, M.flame, M.flameDark, 16);
  school(img, base);
  flagpole(img, base);
  autumnTree(img, 336, base, 20, M.energyGold, M.gold, M.goldDark, 18);
  bus(img, BUS.x, base);
  autumnTree(img, 512, base, 22, M.flame, M.flameDark, M.redDark, 18);
  autumnTree(img, 492, base, 14, M.gold, M.goldDark, M.brown, 12);
  for (const [cx, r, kind, trunk] of [
    [600, 18, 'gold', 16],
    [664, 21, 'flame', 18],
    [746, 16, 'gold', 14],
    [812, 22, 'flame', 18],
    [888, 19, 'gold', 16],
    [922, 15, 'flame', 13],
  ] as const) {
    if (kind === 'gold') autumnTree(img, cx, base, r, M.energyGold, M.gold, M.goldDark, trunk);
    else autumnTree(img, cx, base, r, M.flameLight, M.flame, M.flameDark, trunk);
  }
  return img;
}

/** Small aluminium bleachers on the far touchline: tiers of seats and risers, empty, with a rail round the back. */
function bleachers(img: IndexedImage): void {
  const { x0, x1 } = BLEACHERS;
  for (let i = 0; i < TIERS; i++) {
    const y = SCHOOL_FAR_SY - TIER_H - i * TIER_H;
    const inset = i * 3;
    fillRect(img, x0 + inset, y, x1 - x0 - 2 * inset, 2, M.silver);
    fillRect(img, x0 + inset, y + 2, x1 - x0 - 2 * inset, 3, M.slate);
  }
  const railTop = BLEACHERS.top - 9;
  fillRect(img, x0 + 2, railTop, 1, BLEACHERS.top - railTop, M.gray);
  fillRect(img, x1 - 3, railTop, 1, BLEACHERS.top - railTop, M.gray);
  fillRect(img, x0 + 2, railTop, x1 - x0 - 4, 1, M.gray);
}

/** The chain-link fence along the far touchline: a top rail, posts, and a cross-hatched mesh, open behind the bleachers; leaves piled at its foot. */
function near(): IndexedImage {
  const img = new IndexedImage(SCHOOL_NEAR_W, H);
  const w = img.width;
  fillRect(img, 0, FENCE_TOP, w, 1, M.slate);
  for (let y = FENCE_TOP + 1; y < SCHOOL_FAR_SY; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= BLEACHERS.x0 - 2 && x <= BLEACHERS.x1 + 2 && y > BLEACHERS.top) continue;
      if ((x + y) % FAR_FENCE.mesh === 0 || (((x - y) % FAR_FENCE.mesh) + FAR_FENCE.mesh) % FAR_FENCE.mesh === 0) img.set(x, y, M.silver);
    }
  }
  for (let x = 4; x < w; x += FAR_FENCE.postEvery) fillRect(img, x, FENCE_TOP, FAR_FENCE.postW, FENCE_H, M.slate);
  bleachers(img);
  for (let x = 0; x < w; x++) {
    if (x >= BLEACHERS.x0 && x <= BLEACHERS.x1) continue;
    for (let y = SCHOOL_FAR_SY - LEAVES.pile; y < SCHOOL_FAR_SY; y++) {
      if (noise(x, y) < LEAVES.pileShare) img.set(x, y, M[LEAF_COLORS[Math.floor(noise(y, x) * LEAF_COLORS.length)]!]);
    }
  }
  return img;
}

/** Fallen leaves scattered over the far part of the pitch: 2×1 flecks on grass pixels only, never on a painted line. */
function scatterLeaves(img: IndexedImage): void {
  const grass = [M.grass, M.grassLight, M.grassDark];
  for (let z = LEAVES.fromZ; z < SCHOOL_FIELD.depth; z++) {
    for (let x = 0; x < SCHOOL_FIELD.width; x++) {
      if (noise(x * 3, z * 5) >= LEAVES.share) continue;
      const p = project(x, 0, z, { x: 0, view: BIG_VIEW });
      const [sx, sy] = [Math.round(p.sx), Math.round(p.sy)];
      if (!grass.includes(img.get(sx, sy)) || !grass.includes(img.get(sx + 1, sy))) continue;
      const c = M[LEAF_COLORS[Math.floor(noise(x, z * 2) * LEAF_COLORS.length)]!];
      img.set(sx, sy, c);
      img.set(sx + 1, sy, c);
    }
  }
}

function ground(): IndexedImage {
  const img = pitchGround(chainLinkEnd, SCHOOL_FIELD, BIG_VIEW);
  scatterLeaves(img);
  return img;
}

/** The School Field on an autumn Saturday morning: four parallax layers at the big view's height. */
export function schoolLayers(): VenueLayers {
  return { far: far(), mid: mid(), near: near(), ground: ground() };
}
