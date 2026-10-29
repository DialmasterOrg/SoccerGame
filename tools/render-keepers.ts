/**
 * Renders the keepers' sheet to preview/keeper-sheet.png and the frames of a
 * staged dive, catch and drop kick at the School Field to preview/keeper-gif/.
 * Run with `npm run keepers`; the GIF is assembled from the frames with PIL.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { BALL_R, ballFrames } from '../src/art/ball';
import { bakeAll } from '../src/art/body/bake';
import { ANCHOR } from '../src/art/body/pose';
import { HARRISON_BODY } from '../src/art/body/proportions';
import { C, M, masterPalette, resolvePalette, toRGBA, type ResolvedPalette } from '../src/art/colors';
import { renderText, textPalette } from '../src/art/font';
import { IndexedImage, blit } from '../src/art/indexedImage';
import { KEEPER_EXTRAS, KEEPER_HEADS, KEEPER_NAMES, keeperLook, type KeeperId } from '../src/art/keepers/keepers';
import { DIVE_FRAMES, KEEPER_HANDS, KEEPER_POSE_FRAMES, bakeKeeperPoses, diveFrames, type KeeperPose } from '../src/art/keepers/poses';
import { addOutline } from '../src/art/raster';
import { PARALLAX } from '../src/art/venues/backyard';
import { goalSprites } from '../src/art/venues/pitch';
import { schoolLayers } from '../src/art/venues/school';
import { BIG_VIEW, project } from '../src/game/camera';
import { SCHOOL_FIELD } from '../src/game/field';
import { PLAYER_R } from '../src/game/player';
import { encodePNG } from './png';
import { composeSheet, type SheetItem } from './sheet';

const OUT_DIR = 'preview';
const SHEET_FILE = `${OUT_DIR}/keeper-sheet.png`;
const GIF_DIR = `${OUT_DIR}/keeper-gif`;
const SCALE = 4;
const GAP = 4;
const BACKGROUND = [200, 204, 212] as const;
const IDS: readonly KeeperId[] = ['eddie', 'backupA', 'backupB'];
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

function text(s: string): SheetItem {
  const img = renderText(s, 1);
  return { width: img.width, height: img.height, rgba: toRGBA(img, textPalette('white', 'outline')) };
}

// --- The sheet: per keeper, a name row, heads + body clips, poses, then dives.
const rows: SheetItem[][] = [];
for (const id of IDS) {
  const pal = resolvePalette(keeperLook(id));
  const heads = KEEPER_HEADS[id];
  const clips = bakeAll(HARRISON_BODY, heads, KEEPER_EXTRAS);
  const poses = bakeKeeperPoses(HARRISON_BODY, heads, KEEPER_EXTRAS);
  rows.push([text(KEEPER_NAMES[id])]);
  rows.push([
    ...FACINGS.map(f => resolved(heads[f].image, pal, true)),
    ...(['idle', 'run', 'fall'] as const).flatMap(name => clips[name].frames.map(f => resolved(f, pal))),
  ]);
  rows.push((Object.keys(KEEPER_POSE_FRAMES) as KeeperPose[]).flatMap(name => poses[name].map(f => resolved(f, pal))));
  rows.push(
    ([1, -1] as const).flatMap(facing =>
      (['far', 'near'] as const).flatMap(toward => diveFrames(HARRISON_BODY, heads, KEEPER_EXTRAS, facing, toward).frames.map(f => resolved(f, pal))),
    ),
  );
}
mkdirSync(OUT_DIR, { recursive: true });
const sheet = composeSheet(rows, { scale: SCALE, gap: GAP, background: BACKGROUND });
writeFileSync(SHEET_FILE, encodePNG(sheet.width, sheet.height, sheet.rgba));

// --- The GIF: Eddie in the School's left goal saves a shot at the far post, gets up, holds it and drop-kicks it upfield.
const { w: VW, h: VH } = BIG_VIEW;
const cam = { x: 0, view: BIG_VIEW };
const goal = SCHOOL_FIELD.goals[0];
const goalArt = goalSprites(goal);
const layers = schoolLayers();
const master = masterPalette();
const eddiePal = resolvePalette(keeperLook('eddie'));
const eddie = bakeKeeperPoses(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS);
const farDive = diveFrames(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS, 1, 'far');
const ball = ballFrames();

function paint(view: Uint8ClampedArray, img: IndexedImage, palette: ResolvedPalette, dx: number, dy: number): void {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const id = img.get(x, y);
      const [vx, vy] = [x + dx, y + dy];
      if (id === 0 || vx < 0 || vy < 0 || vx >= VW || vy >= VH) continue;
      view.set(palette[id]!, (vy * VW + vx) * 4);
    }
  }
}
const at = (x: number, y: number, z: number) => {
  const p = project(x, y, z, cam);
  return { x: Math.round(p.sx), y: Math.round(p.sy) };
};
function shadow(view: Uint8ClampedArray, x: number, z: number, width: number, length = 1): void {
  for (let i = 0; i < length; i++) {
    const s = at(x, 0, z + i);
    for (let dx = 0; dx < width; dx++) {
      const [vx, vy] = [s.x - Math.floor(width / 2) + dx, s.y + 1];
      if (vx >= 0 && vy >= 0 && vx < VW && vy < VH) view.set(master[M.grassDark]!, (vy * VW + vx) * 4);
    }
  }
}

const FPS = 20;
const LINE = goal.lineX + PLAYER_R + 3;
const SET_Z = 64;
const DIVE_S = 0.35;
const TRAVEL = 10;
/** The shot: from out on the right to the far post's corner, crossing his plane as he reaches full stretch. */
const SHOT = { from: { x: 250, y: BALL_R, z: 40 }, to: { x: LINE, y: 16, z: 83 }, s: 0.55 };
const REACT_S = 0.2;
const DOWN_S = 0.5;
const GET_UP_S = 0.5;
const HOLD_S = 0.6;
const PUNT_S = 0.45;
const STRIKE_S = 0.2;
const PUNT = { vx: 380, vy: 330 };
const GRAVITY = 900;

interface Shot { keeper: { img: IndexedImage; x: number; y: number; z: number; anchor: { x: number; y: number }; lying: boolean }; ball: { x: number; y: number; z: number } }
function stage(t: number): Shot {
  const diveAt = SHOT.s - DIVE_S * 0.75;
  const pose = (name: KeeperPose, u: number) => eddie[name][Math.min(eddie[name].length - 1, Math.floor(u * eddie[name].length))]!;
  const standing = (img: IndexedImage, z: number) => ({ img, x: LINE, y: 0, z, anchor: ANCHOR, lying: false });
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  const zAfter = SET_Z + TRAVEL;
  if (t < SHOT.s) {
    const u = t / SHOT.s;
    const b = { x: lerp(SHOT.from.x, SHOT.to.x, u), y: lerp(SHOT.from.y, SHOT.to.y, u) + 18 * Math.sin(Math.PI * u) * 0.4, z: lerp(SHOT.from.z, SHOT.to.z, u) };
    if (t < diveAt) {
      const shuffle = t > REACT_S ? Math.min(1, (t - REACT_S) / 0.1) * 2 : 0;
      return { keeper: standing(t > REACT_S ? pose('shuffle', ((t - REACT_S) * 10) % 1) : pose('ready', (t * 3) % 1), SET_Z + shuffle), ball: b };
    }
    const d = (t - diveAt) / DIVE_S;
    return { keeper: { img: farDive.frames[d < 0.5 ? 0 : 1]!, x: LINE, y: 4 * Math.sin(Math.PI * d), z: SET_Z + 2 + (TRAVEL - 2) * d, anchor: farDive.anchor, lying: true }, ball: b };
  }
  // Caught at full stretch: the ball held in his gloves while he lands, then on the grass by them.
  const caughtFor = t - SHOT.s;
  const restDive = diveAt + DIVE_S - SHOT.s;
  if (caughtFor < restDive) {
    const d = (t - diveAt) / DIVE_S;
    return { keeper: { img: farDive.frames[1]!, x: LINE, y: 4 * Math.sin(Math.PI * d), z: SET_Z + 2 + (TRAVEL - 2) * d, anchor: farDive.anchor, lying: true }, ball: { x: LINE + 1, y: 16 * (1 - caughtFor / restDive) + BALL_R, z: SHOT.to.z } };
  }
  let s = caughtFor - restDive;
  const onGrass = { x: LINE + 1, y: BALL_R, z: zAfter + 10 };
  if (s < DOWN_S) return { keeper: { img: farDive.frames[DIVE_FRAMES - 1]!, x: LINE, y: 0, z: zAfter, anchor: farDive.anchor, lying: true }, ball: onGrass };
  s -= DOWN_S;
  if (s < GET_UP_S) return { keeper: standing(pose('getUp', s / GET_UP_S), zAfter), ball: onGrass };
  s -= GET_UP_S;
  const hands = { x: LINE + KEEPER_HANDS.x, y: KEEPER_HANDS.y, z: zAfter };
  if (s < HOLD_S) return { keeper: standing(pose(s < 0.25 ? 'catch' : 'hold', s < 0.25 ? 1 : (s * 3) % 1), zAfter), ball: hands };
  s -= HOLD_S;
  if (s < STRIKE_S) {
    // Dropped from his gloves onto his boot.
    const u = s / STRIKE_S;
    return { keeper: standing(pose('dropKick', (s / PUNT_S) * 0.99), zAfter), ball: { x: hands.x + 4 * u, y: lerp(hands.y, 8, u * u), z: zAfter } };
  }
  const f = s - STRIKE_S;
  const img = s < PUNT_S ? pose('dropKick', s / PUNT_S) : pose('ready', 0);
  return { keeper: standing(img, zAfter), ball: { x: hands.x + 4 + PUNT.vx * f, y: 8 + PUNT.vy * f - (GRAVITY / 2) * f * f, z: zAfter } };
}

const TOTAL_S = 3.2;
rmSync(GIF_DIR, { recursive: true, force: true });
mkdirSync(GIF_DIR, { recursive: true });
const frameCount = Math.round(TOTAL_S * FPS);
for (let i = 0; i < frameCount; i++) {
  const t = i / FPS;
  const view = new Uint8ClampedArray(VW * VH * 4);
  const farX = -(Math.round(cam.x * PARALLAX.far) % layers.far.width);
  paint(view, layers.far, master, farX, 0);
  paint(view, layers.far, master, farX + layers.far.width, 0);
  for (const name of ['mid', 'near', 'ground'] as const) paint(view, layers[name], master, -Math.round(cam.x * PARALLAX[name]), 0);
  const { keeper: k, ball: b } = stage(t);
  shadow(view, k.x, k.z - (k.lying ? 2 : 0), k.lying ? 3 : 5, k.lying ? 14 : 1);
  if (b.x < VW + 10) shadow(view, b.x, b.z, 3);
  const origin = at(goal.lineX, 0, 0);
  const goalPart = (img: IndexedImage) => paint(view, img, master, origin.x + goalArt.origin.x, origin.y + goalArt.origin.y);
  goalPart(goalArt.farNet);
  goalPart(goalArt.farPost);
  const drawKeeper = () => {
    const s = at(k.x, k.y, k.z);
    paint(view, k.img, eddiePal, s.x - k.anchor.x, s.y - k.anchor.y);
  };
  const drawBall = () => {
    const s = at(b.x, b.y, b.z);
    paint(view, ball[Math.floor(t * 12) % ball.length]!, master, s.x - BALL_R, s.y - BALL_R);
  };
  // The ball in or by his gloves is in front of him.
  if (b.z > k.z + 12 && t < SHOT.s - 0.1) {
    drawBall();
    drawKeeper();
  } else {
    drawKeeper();
    drawBall();
  }
  goalPart(goalArt.nearNet);
  goalPart(goalArt.nearPost);
  writeFileSync(`${GIF_DIR}/${String(i).padStart(2, '0')}.png`, encodePNG(VW, VH, view));
}
console.log(`wrote ${SHEET_FILE} (${sheet.width}x${sheet.height}) and ${frameCount} frames to ${GIF_DIR}`);
