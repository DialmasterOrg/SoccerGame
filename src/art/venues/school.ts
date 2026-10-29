import { BIG_VIEW, project } from '../../game/camera';
import { SCHOOL_FIELD } from '../../game/field';
import { M } from '../colors';
import { IndexedImage } from '../indexedImage';
import { ditherRect, fillRect } from '../scenery';
import type { VenueLayers } from './backyard';
import { along, pitchGround, plot } from './pitch';

const FENCE_H = 16;
const POST_EVERY = 32;
/** One pixel in this many of the fence's face is wire. */
const MESH_EVERY = 3;
/** Sky bands, top down: pale blue, then electric light, then a white haze down to the horizon. */
const SKY = { light: 120, haze: 160, dither: 8 } as const;

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

/** A clear autumn morning: pale blue overhead, lightening to a white haze. */
function far(): IndexedImage {
  const img = new IndexedImage(BIG_VIEW.w, BIG_VIEW.h);
  const w = img.width;
  fillRect(img, 0, 0, w, SKY.light, M.skyLight);
  ditherRect(img, 0, SKY.light, w, SKY.dither, M.skyLight, M.electricLight);
  fillRect(img, 0, SKY.light + SKY.dither, w, SKY.haze - SKY.light - SKY.dither, M.electricLight);
  ditherRect(img, 0, SKY.haze, w, SKY.dither, M.electricLight, M.auraWhite);
  fillRect(img, 0, SKY.haze + SKY.dither, w, img.height - SKY.haze - SKY.dither, M.auraWhite);
  return img;
}

/** The School Field's layers. Stand-ins until plan 3 draws the school: far is a plain sky, mid and near are empty. */
export function schoolLayers(): VenueLayers {
  return { far: far(), mid: new IndexedImage(1, 1), near: new IndexedImage(1, 1), ground: pitchGround(chainLinkEnd, SCHOOL_FIELD, BIG_VIEW) };
}
