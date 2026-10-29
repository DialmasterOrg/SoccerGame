/**
 * Renders the tryouts cast's sheet to preview/tryouts-sheet.png: one row per
 * kid, with its name, the front face, the three head facings, then idle,
 * every run frame and the shoot frames, in its kit. A first row puts
 * Harrison and Max side by side for size. Run with `npm run tryouts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { bakeAll } from '../src/art/body/bake';
import { HARRISON_BODY } from '../src/art/body/proportions';
import { C, resolvePalette, toRGBA, type LookColors, type ResolvedPalette } from '../src/art/colors';
import { renderText, textPalette } from '../src/art/font';
import { HARRISON_HEADS } from '../src/art/harrison/head';
import { harrisonLook } from '../src/art/harrison/look';
import { IndexedImage, blit } from '../src/art/indexedImage';
import { MAX_HEADS, maxLook } from '../src/art/opponents/max';
import { TRYOUT_BODY, TRYOUT_HEADS, tryoutLook } from '../src/art/opponents/tryouts';
import { addOutline } from '../src/art/raster';
import type { HeadSprite } from '../src/art/body/head';
import type { HeadFacing } from '../src/art/body/pose';
import type { BodyProportions } from '../src/art/body/proportions';
import { SCHOOL, matchById } from '../src/meta/career';
import type { TryoutKidId } from '../src/game/tryouts';
import { encodePNG } from './png';
import { composeSheet, type SheetItem } from './sheet';

const OUT_DIR = 'preview';
const SHEET_FILE = `${OUT_DIR}/tryouts-sheet.png`;
const SCALE = 4;
const GAP = 4;
const BACKGROUND = [200, 204, 212] as const;
const KIDS: readonly TryoutKidId[] = ['hank', 'lola', 'finn', 'priya', 'niko', 'paige'];
const FACINGS = ['side', 'threeQuarter', 'front'] as const;

function resolved(img: IndexedImage, palette: ResolvedPalette, outline = false): SheetItem {
  let src = img;
  if (outline) {
    src = new IndexedImage(img.width + 2, img.height + 2);
    blit(src, img, 1, 1);
    addOutline(src, C.Outline);
  }
  return { width: src.width, height: src.height, rgba: toRGBA(src, palette) };
}

/** The heads are only ten pixels tall: they're shown three times bigger again, so the faces can be judged. */
const FACE_ZOOM = 3;
function zoomed(item: SheetItem, k: number): SheetItem {
  const rgba = new Uint8ClampedArray(item.width * k * item.height * k * 4);
  for (let y = 0; y < item.height * k; y++)
    for (let x = 0; x < item.width * k; x++) rgba.set(item.rgba.subarray(((Math.floor(y / k) * item.width) + Math.floor(x / k)) * 4, ((Math.floor(y / k) * item.width) + Math.floor(x / k)) * 4 + 4), (y * item.width * k + x) * 4);
  return { width: item.width * k, height: item.height * k, rgba };
}

function text(s: string): SheetItem {
  const img = renderText(s, 1);
  return { width: img.width, height: img.height, rgba: toRGBA(img, textPalette('white', 'outline')) };
}

/** Idle, every run frame and the shoot frames. */
function frames(body: BodyProportions, heads: Record<HeadFacing, HeadSprite>, pal: ResolvedPalette): SheetItem[] {
  const clips = bakeAll(body, heads);
  return (['idle', 'run', 'shoot'] as const).flatMap(name => clips[name].frames.map(f => resolved(f, pal)));
}

const rows: SheetItem[][] = [];
rows.push([text('FOR SIZE: HARRISON AND MAX')]);
const [hPal, mPal] = [resolvePalette(harrisonLook('home')), resolvePalette(maxLook())];
rows.push([resolved(bakeAll(HARRISON_BODY, HARRISON_HEADS).idle.frames[0]!, hPal), resolved(bakeAll(HARRISON_BODY, MAX_HEADS).idle.frames[0]!, mPal)]);
for (const id of KIDS) {
  const m = SCHOOL.matches.find(x => x.opponent === id)!;
  const look: LookColors = tryoutLook(id);
  const pal = resolvePalette(look);
  const heads = TRYOUT_HEADS[id];
  rows.push([text(`TRYOUT ${m.rung} - ${matchById(m.id)!.name}`)]);
  rows.push([...FACINGS.map(f => zoomed(resolved(heads[f].image, pal, true), FACE_ZOOM)), ...frames(TRYOUT_BODY[id], heads, pal)]);
}
mkdirSync(OUT_DIR, { recursive: true });
const sheet = composeSheet(rows, { scale: SCALE, gap: GAP, background: BACKGROUND });
writeFileSync(SHEET_FILE, encodePNG(sheet.width, sheet.height, sheet.rgba));
console.log(`wrote ${SHEET_FILE} (${sheet.width}x${sheet.height})`);
