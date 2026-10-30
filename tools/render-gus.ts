/**
 * Renders Goalie Gus's sheet to preview/gus-sheet.png: his size against
 * Harrison and Eddie, his heads and face, his clips, every keeper pose (the
 * clap too), his dives, and his partner BACKUP MO in the outfield clips.
 * Run with `npm run gus`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { bakeAll } from '../src/art/body/bake';
import { frameOf } from '../src/art/body/pose';
import { HARRISON_BODY } from '../src/art/body/proportions';
import { C, resolvePalette, toRGBA, type ResolvedPalette } from '../src/art/colors';
import { renderText, textPalette } from '../src/art/font';
import { HARRISON_HEADS } from '../src/art/harrison/head';
import { harrisonLook } from '../src/art/harrison/look';
import { IndexedImage, blit } from '../src/art/indexedImage';
import { GUS_BODY, GUS_EXTRAS, GUS_HEADS } from '../src/art/keepers/gus';
import { KEEPER_EXTRAS, KEEPER_HEADS, KEEPER_NAMES, keeperLook } from '../src/art/keepers/keepers';
import { KEEPER_POSE_FRAMES, bakeKeeperPoses, diveFrames, type KeeperPose } from '../src/art/keepers/poses';
import { addOutline } from '../src/art/raster';
import { encodePNG } from './png';
import { composeSheet, type SheetItem } from './sheet';

const OUT_DIR = 'preview';
const SHEET_FILE = `${OUT_DIR}/gus-sheet.png`;
const SCALE = 4;
const GAP = 4;
const BACKGROUND = [200, 204, 212] as const;
const FACINGS = ['side', 'threeQuarter', 'front'] as const;
/** The boss node draws his face at 2× (venueScene's BOSS_FACE_SCALE). */
const BOSS_FACE_SCALE = 2;

function resolved(img: IndexedImage, palette: ResolvedPalette, outline = false, scale = 1): SheetItem {
  let src = img;
  if (outline) {
    src = new IndexedImage(img.width + 2, img.height + 2);
    blit(src, img, 1, 1);
    addOutline(src, C.Outline);
  }
  const rgba = toRGBA(src, palette);
  if (scale === 1) return { width: src.width, height: src.height, rgba };
  const [w, h] = [src.width * scale, src.height * scale];
  const big = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) big.set(rgba.subarray(((Math.floor(y / scale) * src.width + Math.floor(x / scale)) * 4), ((Math.floor(y / scale) * src.width + Math.floor(x / scale)) * 4) + 4), (y * w + x) * 4);
  return { width: w, height: h, rgba: big };
}

function text(s: string): SheetItem {
  const img = renderText(s, 1);
  return { width: img.width, height: img.height, rgba: toRGBA(img, textPalette('white', 'outline')) };
}

/** Standing figures side by side with their feet on one row, for size. */
function lineUp(figures: readonly { img: IndexedImage; anchorY: number; palette: ResolvedPalette }[]): SheetItem {
  const floor = Math.max(...figures.map(f => f.anchorY));
  const height = Math.max(...figures.map(f => floor - f.anchorY + f.img.height));
  const width = figures.reduce((w, f) => w + f.img.width, 0);
  const rgba = new Uint8ClampedArray(width * height * 4);
  let left = 0;
  for (const f of figures) {
    const top = floor - f.anchorY;
    const px = toRGBA(f.img, f.palette);
    for (let y = 0; y < f.img.height; y++) for (let x = 0; x < f.img.width; x++) {
      const src = (y * f.img.width + x) * 4;
      if (px[src + 3] !== 0) rgba.set(px.subarray(src, src + 4), ((top + y) * width + left + x) * 4);
    }
    left += f.img.width;
  }
  return { width, height, rgba };
}

const gusPal = resolvePalette(keeperLook('gus'));
const eddiePal = resolvePalette(keeperLook('eddie'));
const moPal = resolvePalette(keeperLook('backupA'));
const gusClips = bakeAll(GUS_BODY, GUS_HEADS, GUS_EXTRAS);
const gusPoses = bakeKeeperPoses(GUS_BODY, GUS_HEADS, GUS_EXTRAS);
const harrisonIdle = bakeAll(HARRISON_BODY, HARRISON_HEADS).idle.frames[0]!;
const eddieIdle = bakeAll(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS).idle.frames[0]!;
const mo = bakeAll(HARRISON_BODY, KEEPER_HEADS.backupA, KEEPER_EXTRAS);

const rows: SheetItem[][] = [
  [text('HARRISON - STEADY EDDIE - GOALIE GUS, FOR SIZE')],
  [
    lineUp([
      { img: harrisonIdle, anchorY: frameOf(HARRISON_BODY).anchor.y, palette: resolvePalette(harrisonLook('home')) },
      { img: eddieIdle, anchorY: frameOf(HARRISON_BODY).anchor.y, palette: eddiePal },
      { img: gusClips.idle.frames[0]!, anchorY: frameOf(GUS_BODY).anchor.y, palette: gusPal },
    ]),
  ],
  [text(`${KEEPER_NAMES.gus}: HEADS, AND HIS FACE AT ${BOSS_FACE_SCALE}X`)],
  [...FACINGS.map(f => resolved(GUS_HEADS[f].image, gusPal, true)), resolved(GUS_HEADS.front.image, gusPal, true, BOSS_FACE_SCALE)],
  [text('IDLE AND RUN')],
  (['idle', 'run'] as const).flatMap(name => gusClips[name].frames.map(f => resolved(f, gusPal))),
  [text('KEEPER POSES, THE CLAP LAST')],
  (Object.keys(KEEPER_POSE_FRAMES) as KeeperPose[]).flatMap(name => gusPoses[name].map(f => resolved(f, gusPal))),
  [text('DIVES: FAR POST, NEAR POST')],
  (['far', 'near'] as const).flatMap(toward => diveFrames(GUS_BODY, GUS_HEADS, GUS_EXTRAS, 1, toward).frames.map(f => resolved(f, gusPal))),
  [text(`HIS PARTNER ${KEEPER_NAMES.backupA}: IDLE, RUN, SHOOT`)],
  (['idle', 'run', 'shoot'] as const).flatMap(name => mo[name].frames.map(f => resolved(f, moPal))),
];
mkdirSync(OUT_DIR, { recursive: true });
const sheet = composeSheet(rows, { scale: SCALE, gap: GAP, background: BACKGROUND });
writeFileSync(SHEET_FILE, encodePNG(sheet.width, sheet.height, sheet.rgba));
console.log(`wrote ${SHEET_FILE} (${sheet.width}x${sheet.height})`);
