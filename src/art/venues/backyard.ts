import { DEPTH_SHEAR, SMALL_VIEW, project } from '../../game/camera';
import { BACKYARD, type Goal } from '../../game/field';
import { M } from '../colors';
import { IndexedImage } from '../indexedImage';
import { ditherRect, fillCircle, fillRect, fillRoof } from '../scenery';

export interface VenueLayers {
  far: IndexedImage;
  mid: IndexedImage;
  near: IndexedImage;
  ground: IndexedImage;
}

/** How fast each layer scrolls relative to the camera. */
export const PARALLAX = { far: 0.2, mid: 0.5, near: 0.8, ground: 1 } as const;

const H = 180;
/** Screen row of the far touchline (z = depth): the back fence stands on it. */
const FAR_SY = SMALL_VIEW.nearSY - BACKYARD.depth;
const FENCE_H = 20;
const FENCE_TOP = FAR_SY - FENCE_H;
const STRIPE_W = 32;
/** Wide enough for the camera's whole range plus the slant of the far touchline. */
const GROUND_W = BACKYARD.width + Math.ceil(BACKYARD.depth * DEPTH_SHEAR);
export const MID_W = 496;
export const NEAR_W = 600;
/** The end fences fill x 0–4 and 636–640; the ball bounces off their inner faces. */
const END_FENCES = [
  [0, BACKYARD.fenceL],
  [BACKYARD.fenceR, BACKYARD.width],
] as const;
/** World step when rasterising slanted shapes: small enough that no pixel is skipped. */
const RASTER_STEP = 0.25;
/** About one grass pixel in this many is a darker tuft. */
const TUFT_EVERY = 53;

/** Evening sky: pale blue overhead fading to gold, then flame at the horizon, with a low sun. Tiles seamlessly. */
function far(): IndexedImage {
  const img = new IndexedImage(320, H);
  const w = img.width;
  fillRect(img, 0, 0, w, 24, M.skyLight);
  ditherRect(img, 0, 24, w, 8, M.skyLight, M.energyGoldLight);
  fillRect(img, 0, 32, w, 30, M.energyGoldLight);
  ditherRect(img, 0, 62, w, 8, M.energyGoldLight, M.flame);
  fillRect(img, 0, 70, w, H - 70, M.flame);
  // Low sun, sinking behind the houses, well clear of the tiling seam.
  fillCircle(img, 214, 66, 11, M.energyGold);
  fillCircle(img, 214, 66, 7, M.auraWhite);
  // Thin cloud streaks lit from below.
  for (const [x, y, len] of [
    [40, 18, 34],
    [52, 21, 20],
    [150, 40, 40],
    [250, 52, 28],
    [262, 55, 16],
  ] as const) {
    fillRect(img, x, y, len, 1, M.auraWhite);
  }
  return img;
}

/** Rooftops and trees in silhouette, with a few warm lit windows, standing behind the back fence. */
function mid(): IndexedImage {
  const img = new IndexedImage(MID_W, H);
  const house = (x: number, w: number, wallTop: number, roofTop: number, windows: readonly number[]) => {
    fillRoof(img, x - 4, x + w + 3, x + Math.floor(w / 2), roofTop, wallTop - 1, M.ink);
    fillRect(img, x, wallTop, w, FAR_SY - wallTop, M.charcoal);
    fillRect(img, x + w - 16, roofTop + 4, 6, wallTop - roofTop - 6, M.ink); // chimney
    for (const wx of windows) {
      fillRect(img, x + wx, wallTop + 4, 6, 7, M.gold);
      fillRect(img, x + wx, wallTop + 7, 6, 1, M.goldDark);
    }
  };
  const tree = (cx: number, top: number, r: number) => {
    fillRect(img, cx - 2, top + r, 4, FAR_SY - top - r, M.black);
    fillCircle(img, cx, top + r, r, M.black);
    fillCircle(img, cx - r + 4, top + r + 6, r - 4, M.black);
    fillCircle(img, cx + r - 4, top + r + 5, r - 4, M.black);
  };
  tree(6, 64, 14);
  house(28, 78, 78, 56, [12, 52]);
  tree(132, 58, 18);
  house(162, 96, 82, 60, [14, 40, 72]);
  tree(286, 68, 12);
  house(306, 70, 76, 54, [10, 46]);
  tree(410, 60, 16);
  house(432, 46, 84, 66, [18]);
  tree(488, 66, 13);
  return img;
}

/** The back fence, its foot on the far touchline, with a washing line of pegged clothes above it. */
function near(): IndexedImage {
  const img = new IndexedImage(NEAR_W, H);
  const w = img.width;
  fillRect(img, 0, FENCE_TOP, w, FENCE_H, M.wood);
  for (let x = 0; x < w; x += 8) {
    fillRect(img, x, FENCE_TOP, 1, FENCE_H, M.hairShadow);
    fillRect(img, x + 1, FENCE_TOP, 1, FENCE_H, M.hair);
    fillRect(img, x + 3, FENCE_TOP - 1, 3, 1, M.wood); // rounded plank tops
  }
  for (const y of [FENCE_TOP + 4, FAR_SY - 6]) fillRect(img, 0, y, w, 2, M.hairShadow);

  // Washing line between two posts, sagging slightly in the middle.
  const [p0, p1, lineY] = [150, 382, 64];
  for (const px of [p0, p1]) {
    fillRect(img, px - 1, lineY - 4, 3, FAR_SY - lineY + 4, M.hairShadow);
    fillRect(img, px - 4, lineY - 4, 9, 2, M.hairShadow);
  }
  const sag = (x: number) => lineY + Math.round(6 * Math.sin((Math.PI * (x - p0)) / (p1 - p0)));
  for (let x = p0 + 2; x < p1 - 1; x++) img.set(x, sag(x), M.silver);

  const garment = (x: number, w: number, h: number, body: number, shade: number, shirt = false) => {
    const y = sag(x + Math.floor(w / 2)) + 1;
    fillRect(img, x, y, w, h, body);
    fillRect(img, x, y + h - 1, w, 1, shade);
    if (shirt) {
      fillRect(img, x - 3, y, 3, 5, body);
      fillRect(img, x + w, y, 3, 5, body);
      fillRect(img, x + Math.floor(w / 2) - 1, y, 3, 2, shade); // collar
    }
    img.set(x + 1, y - 1, M.white);
    img.set(x + w - 2, y - 1, M.white); // pegs
  };
  garment(170, 14, 16, M.red, M.redDark, true);
  garment(200, 18, 24, M.white, M.silver);
  garment(232, 12, 14, M.blue, M.navy, true);
  garment(262, 6, 9, M.volt, M.voltShadow);
  garment(272, 6, 9, M.volt, M.voltShadow);
  garment(296, 22, 18, M.skyLight, M.sky);
  garment(334, 14, 16, M.slate, M.charcoal, true);
  return img;
}

/** Sets the pixel a world point projects to (camera at 0). */
export function plot(img: IndexedImage, x: number, y: number, z: number, id: number, dx = 0, dy = 0): void {
  const p = project(x, y, z, { x: 0 });
  img.set(Math.round(p.sx) - dx, Math.round(p.sy) - dy, id);
}

/** Visits world points along a segment, finely enough to touch every pixel it crosses. */
export function along(a: number, b: number, visit: (t: number) => void): void {
  for (let t = Math.min(a, b); t <= Math.max(a, b) + 1e-9; t += RASTER_STEP) visit(t);
}

/**
 * An end fence: a solid block x0–x1 running the whole depth, FENCE_H high.
 * The camera looks from the right, above and in front, so the +x side, the
 * top and the near end are the faces it sees.
 */
function endFence(img: IndexedImage, x0: number, x1: number): void {
  const depth = BACKYARD.depth;
  along(0, depth, z => along(0, FENCE_H - 1, y => plot(img, x1, y, z, M.wood)));
  along(0, depth, z => along(x0, x1, x => plot(img, x, FENCE_H - 1, z, M.hair)));
  along(x0, x1, x => along(0, FENCE_H - 1, y => plot(img, x, y, 0, M.hairShadow)));
  for (let z = 8; z < depth; z += 8) along(0, FENCE_H - 2, y => plot(img, x1, y, z, M.hairShadow)); // planks
  along(0, depth, z => plot(img, x1, 4, z, M.hairShadow)); // rail
}

/** The pitch: slanted mowing stripes across the depth, the near board's line, and the venue's end fences in the end-fence footprint. */
export function pitchGround(endFence: (img: IndexedImage, x0: number, x1: number) => void): IndexedImage {
  const img = new IndexedImage(GROUND_W, H);
  for (let y = FAR_SY; y < H; y++) {
    const z = SMALL_VIEW.nearSY - y;
    for (let x = 0; x < GROUND_W; x++) {
      const stripe = Math.floor((x - z * DEPTH_SHEAR) / STRIPE_W);
      const tuft = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0 < 2 ** 32 / TUFT_EVERY;
      img.set(x, y, tuft ? M.grassDark : stripe % 2 === 0 ? M.grass : M.grassLight);
    }
  }
  fillRect(img, 0, FAR_SY, GROUND_W, 1, M.grassDark); // the back fence's shadow
  fillRect(img, 0, SMALL_VIEW.nearSY + 1, GROUND_W, 1, M.grassDark); // the invisible near board
  for (const [x0, x1] of END_FENCES) endFence(img, x0, x1);
  return img;
}

export function backyardLayers(): VenueLayers {
  return { far: far(), mid: mid(), near: near(), ground: pitchGround(endFence) };
}

/**
 * A goal's art, drawn from its geometry. Every sprite shares one origin: it is
 * placed with its top-left at project(lineX, 0, 0, cam) + origin. The posts
 * and the nets are separate so the match can depth-sort them against the
 * players: `farNet` (back net, far side net, roof and crossbar) sorts at the
 * far post's depth, `nearNet` (the near side net) at the near post's.
 */
export interface GoalArt {
  farNet: IndexedImage;
  nearNet: IndexedImage;
  nearPost: IndexedImage;
  farPost: IndexedImage;
  origin: { x: number; y: number };
}

/** The bar's underside, the highest pixel row of the frame, and the net's grid. */
const NET_CELL = 4;

export function goalSprites(side: 'left' | 'right'): GoalArt {
  const g: Goal = BACKYARD.goals.find(goal => goal.side === side)!;
  const top = g.barY + g.barThick - 1;
  const [xa, xb] = [Math.min(g.lineX, g.backX), Math.max(g.lineX, g.backX)];
  const col0 = Math.round(xa + g.z0 * DEPTH_SHEAR) - 1;
  const col1 = Math.round(xb + g.z1 * DEPTH_SHEAR) + 2;
  const row0 = Math.round(SMALL_VIEW.nearSY - g.z1 - top) - 1;
  const row1 = Math.round(SMALL_VIEW.nearSY - g.z0) + 1;
  const sprite = () => new IndexedImage(col1 - col0 + 1, row1 - row0 + 1);
  const put = (img: IndexedImage, x: number, y: number, z: number, id: number) => plot(img, x, y, z, id, col0, row0);
  const grid = (from: number, to: number, visit: (v: number) => void) => {
    for (let v = from; v <= to + 1e-9; v += NET_CELL) visit(v);
  };

  const [farNet, nearNet] = [sprite(), sprite()];
  // The net is a dotted mesh, so the white frame stands out in front of it.
  const mesh = (img: IndexedImage, x: number, y: number, z: number) => {
    const p = project(x, y, z, { x: 0 });
    if ((Math.round(p.sx) + Math.round(p.sy)) % 2 === 0) put(img, x, y, z, M.silver);
  };
  // Net back.
  grid(g.z0, g.z1, z => along(0, top, y => mesh(farNet, g.backX, y, z)));
  grid(0, top, y => along(g.z0, g.z1, z => mesh(farNet, g.backX, y, z)));
  along(g.z0, g.z1, z => mesh(farNet, g.backX, top, z));
  // Side nets.
  for (const [z, img] of [
    [g.z1, farNet],
    [g.z0, nearNet],
  ] as const) {
    grid(xa, xb, x => along(0, top, y => mesh(img, x, y, z)));
    grid(0, top, y => along(xa, xb, x => mesh(img, x, y, z)));
    along(xa, xb, x => mesh(img, x, top, z));
  }
  // Roof.
  grid(xa, xb, x => along(g.z0, g.z1, z => mesh(farNet, x, top, z)));
  grid(g.z0, g.z1, z => along(xa, xb, x => mesh(farNet, x, top, z)));
  // Crossbar, near-post top to far-post top.
  along(g.z0, g.z1, z => {
    for (const y of [g.barY, top]) {
      put(farNet, g.lineX, y, z, M.white);
      put(farNet, g.lineX + 1, y, z, M.white);
    }
  });

  const post = (z: number) => {
    const img = sprite();
    along(0, top, y => {
      put(img, g.lineX, y, z, M.white);
      put(img, g.lineX + 1, y, z, M.silver);
    });
    return img;
  };
  return { farNet, nearNet, nearPost: post(g.z0), farPost: post(g.z1), origin: { x: col0 - g.lineX, y: row0 - SMALL_VIEW.nearSY } };
}
