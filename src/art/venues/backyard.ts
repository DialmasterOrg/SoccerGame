import { SMALL_VIEW } from '../../game/camera';
import { BACKYARD } from '../../game/field';
import { M } from '../colors';
import { IndexedImage } from '../indexedImage';
import { ditherRect, fillCircle, fillRect, fillRoof } from '../scenery';
import { along, pitchGround, plot } from './pitch';

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
export const MID_W = 496;
export const NEAR_W = 600;

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

export function backyardLayers(): VenueLayers {
  return { far: far(), mid: mid(), near: near(), ground: pitchGround(endFence) };
}
