import { SMALL_VIEW } from '../../game/camera';
import { BACKYARD } from '../../game/field';
import { M, type MasterColor } from '../colors';
import { IndexedImage } from '../indexedImage';
import { ditherRect, fillCircle, fillRect } from '../scenery';
import { MID_W, NEAR_W, along, pitchGround, plot, type VenueLayers } from './backyard';

const H = 180;
/** Screen row of the far touchline (z = depth): the hedge stands on it. */
const FAR_SY = SMALL_VIEW.nearSY - BACKYARD.depth;
/** The hedge along the far touchline, and its bumps along the top. */
const HEDGE_H = 8;
const BUMP = { r: 3, every: 6 };
/** The gravel path runs along the mid layer just above the hedge; the joggers' feet stand on this row. */
export const PATH_Y = 100;
const PATH = { top: 97, h: 4 };
/** The end hedges stand in the end fences' footprint, a little lower than the fences. */
const END_HEDGE_H = 14;
/** Every so many world px along an end hedge's seen face, a leafy fleck. */
const FLECK_EVERY = 5;

/** Fills an ellipse centred on (cx, cy), stopping above row `clipBelow`. */
function fillEllipse(img: IndexedImage, cx: number, cy: number, rx: number, ry: number, id: number, clipBelow = H): void {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1 && cy + y < clipBelow) img.set(Math.round(cx + x), Math.round(cy + y), id);
    }
  }
}

/** Summer afternoon: a bright blue sky fading paler toward the horizon, with puffy clouds. Tiles seamlessly. */
function far(): IndexedImage {
  const img = new IndexedImage(320, H);
  const w = img.width;
  fillRect(img, 0, 0, w, 40, M.sky);
  ditherRect(img, 0, 40, w, 10, M.sky, M.skyLight);
  fillRect(img, 0, 50, w, H - 50, M.skyLight);
  // Three clouds, well clear of the tiling seam.
  for (const [x, y, s] of [
    [40, 14, 1],
    [150, 24, 1.3],
    [262, 10, 0.9],
  ] as const) {
    fillEllipse(img, x, y, Math.round(14 * s), Math.round(5 * s), M.white);
    fillEllipse(img, x - 8 * s, y + 2, Math.round(9 * s), Math.round(4 * s), M.white);
    fillEllipse(img, x + 10 * s, y + 2, Math.round(10 * s), Math.round(4 * s), M.white);
    fillRect(img, Math.round(x - 16 * s), y + 5, Math.round(32 * s), 1, M.silver);
  }
  return img;
}

/** A big leafy park tree standing on the path: a trunk, then a crown of overlapping blobs lit from the upper left. */
function leafyTree(img: IndexedImage, cx: number, footY: number, r: number): void {
  fillRect(img, cx - 2, footY - r - 6, 4, r + 6, M.wood);
  fillRect(img, cx - 2, footY - r - 6, 1, r + 6, M.hairShadow);
  const top = footY - r - 6 - r;
  for (const [dx, dy, rr] of [
    [0, 0, r],
    [-r + 3, 5, r - 3],
    [r - 3, 4, r - 3],
    [-3, -r + 5, r - 4],
  ] as const) {
    fillCircle(img, cx + dx, top + dy, rr, M.grassDark);
  }
  for (const [dx, dy, rr] of [
    [-2, -2, r - 3],
    [-r + 4, 3, r - 6],
    [2, -r + 6, r - 6],
  ] as const) {
    fillCircle(img, cx + dx, top + dy, Math.max(2, rr), M.grass);
  }
  for (const [dx, dy] of [
    [-4, -5],
    [-r + 4, 1],
    [0, -r + 4],
    [-6, 0],
  ] as const) {
    fillCircle(img, cx + dx, top + dy, 2, M.grassLight);
  }
}

/** A far tree on the hills: a one-colour lollipop. */
function farTree(img: IndexedImage, cx: number, footY: number, r: number): void {
  fillRect(img, cx - 1, footY - r, 2, r, M.grassDark);
  fillCircle(img, cx, footY - r - r + 2, r, M.grassDark);
}

function bench(img: IndexedImage, x: number, footY: number): void {
  fillRect(img, x, footY - 6, 14, 1, M.wood);
  fillRect(img, x, footY - 4, 14, 1, M.wood);
  fillRect(img, x, footY - 9, 14, 1, M.hairShadow);
  for (const lx of [x + 1, x + 12]) fillRect(img, lx, footY - 4, 1, 4, M.black);
}

function lamp(img: IndexedImage, x: number, footY: number): void {
  fillRect(img, x, footY - 22, 1, 22, M.black);
  fillRect(img, x - 1, footY - 25, 3, 3, M.black);
  img.set(x, footY - 24, M.energyGoldLight);
}

/** Rolling hills with a row of small far trees, then the gravel path with big trees, a bench and a lamp along it, and lawn down to the hedge. */
function mid(): IndexedImage {
  const img = new IndexedImage(MID_W, H);
  fillEllipse(img, 70, 96, 120, 30, M.grassLight, PATH.top);
  fillEllipse(img, 290, 98, 140, 26, M.grass, PATH.top);
  fillEllipse(img, 470, 96, 90, 28, M.grassLight, PATH.top);
  for (const [x, r] of [
    [20, 5],
    [44, 4],
    [96, 6],
    [118, 4],
    [210, 5],
    [232, 6],
    [300, 4],
    [360, 5],
    [384, 4],
    [452, 6],
  ] as const) {
    farTree(img, x, 86, r);
  }
  fillRect(img, 0, PATH.top + PATH.h, MID_W, FAR_SY - PATH.top - PATH.h, M.grassLight);
  fillRect(img, 0, PATH.top, MID_W, PATH.h, M.fade);
  fillRect(img, 0, PATH.top, MID_W, 1, M.hairLight);
  leafyTree(img, 30, PATH_Y - 1, 13);
  leafyTree(img, 210, PATH_Y - 1, 15);
  leafyTree(img, 410, PATH_Y - 1, 12);
  bench(img, 120, PATH_Y);
  lamp(img, 300, PATH_Y);
  return img;
}

/** A low, bumpy hedge along the far touchline, in place of the Backyard's fence. */
function near(): IndexedImage {
  const img = new IndexedImage(NEAR_W, H);
  const w = img.width;
  const top = FAR_SY - HEDGE_H;
  fillRect(img, 0, top, w, HEDGE_H, M.grassDark);
  for (let x = 2; x < w; x += BUMP.every) fillCircle(img, x, top, BUMP.r, M.grassDark);
  // Each bump's crown is lit from the upper left; a few leaves deeper in catch the light too.
  for (let x = 2; x < w; x += BUMP.every) {
    for (const [dx, dy] of [
      [-2, -1],
      [0, -2],
      [1, -2],
    ] as const) {
      img.set(x + dx, top + dy, M.grass);
    }
    img.set(x - 1, top - 2, M.grassLight);
  }
  for (let x = 4; x < w; x += 12) {
    img.set(x, top + 2, M.grass);
    img.set(x + 3, top + 5, M.grass);
  }
  return img;
}

/**
 * An end hedge: a solid block x0–x1 running the whole depth, drawn like
 * the end fence's seen faces (the +x side, the top, the near end) in hedge
 * greens.
 */
function endHedge(img: IndexedImage, x0: number, x1: number): void {
  const depth = BACKYARD.depth;
  along(0, depth, z => along(0, END_HEDGE_H - 1, y => plot(img, x1, y, z, M.grassDark)));
  along(0, depth, z => along(x0, x1, x => plot(img, x, END_HEDGE_H - 1, z, M.grass)));
  along(x0, x1, x => along(0, END_HEDGE_H - 1, y => plot(img, x, y, 0, M.grassDark)));
  for (let z = 2; z < depth; z += FLECK_EVERY) {
    plot(img, x1, END_HEDGE_H - 4 - (z % 3), z, M.grass);
    plot(img, x1, 3 + (z % 4), z, M.grass);
  }
  for (let z = 1; z < depth; z += FLECK_EVERY) plot(img, x0 + 2, END_HEDGE_H - 1, z, M.grassLight);
}

export function parkLayers(): VenueLayers {
  return { far: far(), mid: mid(), near: near(), ground: pitchGround(endHedge) };
}

/** A jogger's two run frames: rows of hair, skin, shirt, legs and white shoes, facing right. */
const JOGGER_ROWS = [
  ['..hh...', '.hkk...', '..kk...', '.sss...', 'ssss...', 'ksssk..', '.ddd...', '.d..d..', 'd....d.', 'w.....w'],
  ['..hh...', '.hkk...', '..kk...', '.sss...', '.ssss..', '.sssk..', '.ddd...', '..dd...', '..d.d..', '..w.w..'],
] as const;

/** A jogger's two run frames, in master ids, with this shirt and hair. 7×10 px, facing right. */
export function joggerFrames(shirt: MasterColor, hair: MasterColor): readonly [IndexedImage, IndexedImage] {
  const key: Record<string, number> = { h: M[hair], k: M.skin, s: M[shirt], d: M.ink, w: M.white };
  const frame = (rows: readonly string[]) => {
    const img = new IndexedImage(rows[0]!.length, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => key[ch] && img.set(x, y, key[ch]!)));
    return img;
  };
  return [frame(JOGGER_ROWS[0]), frame(JOGGER_ROWS[1])];
}

export interface Jogger {
  shirt: MasterColor;
  hair: MasterColor;
  /** px/s along the path. */
  speed: number;
  dir: 1 | -1;
  /** Where on the mid layer it starts, px. */
  startX: number;
}

/** Scenery on the path, never in play: each at its own pace, wrapping round the mid layer. */
export const JOGGERS: readonly Jogger[] = [
  { shirt: 'violet', hair: 'black', speed: 22, dir: 1, startX: 60 },
  { shirt: 'flame', hair: 'hairTip', speed: 30, dir: -1, startX: 250 },
  { shirt: 'electric', hair: 'hairShadow', speed: 17, dir: 1, startX: 400 },
];
