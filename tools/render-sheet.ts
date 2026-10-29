/**
 * Renders the character sheet to preview/character-sheet.png for review.
 * Run with `npm run sheet`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { bakeAll } from '../src/art/body/bake';
import { drawFigure } from '../src/art/body/drawFigure';
import { standingPose } from '../src/art/body/pose';
import { HARRISON_BODY } from '../src/art/body/proportions';
import { C, M, MASTER, masterPalette, resolvePalette, toRGBA, type LookColors, type ResolvedPalette } from '../src/art/colors';
import { HARRISON_HEADS, HARRISON_POWER_HEADS } from '../src/art/harrison/head';
import { harrisonLook, type PowerForm } from '../src/art/harrison/look';
import { BALL_R, ballFrames } from '../src/art/ball';
import { ANCHOR } from '../src/art/body/pose';
import { renderText, textPalette } from '../src/art/font';
import { PARALLAX, backyardLayers, goalSprites, type VenueLayers } from '../src/art/venues/backyard';
import { JOGGERS, PATH_Y, joggerFrames, parkLayers } from '../src/art/venues/park';
import { harrisonPortrait } from '../src/art/harrison/portrait';
import { IndexedImage, blit, flipX } from '../src/art/indexedImage';
import { MAX_HEADS, maxLook } from '../src/art/opponents/max';
import { CREW_BODY, CREW_HEADS, crewLook } from '../src/art/opponents/crew';
import { SAM_HEADS, samLook } from '../src/art/opponents/sam';
import type { CrewId } from '../src/game/crew';
import { BISCUIT_ANCHOR, BISCUIT_FACE, BISCUIT_FRAMES, type DogAnim } from '../src/art/opponents/biscuit';
import type { AnimName } from '../src/art/body/animations';
import { DEPTH_SHEAR, project } from '../src/game/camera';
import { BACKYARD } from '../src/game/field';
import type { KitId } from '../src/art/kits';
import { addOutline, opaqueBounds } from '../src/art/raster';
import { FOOT_SPOT } from '../src/game/steal';
import { encodePNG } from './png';
import { composeSheet, type SheetItem } from './sheet';

const SCALE = 4;
const GAP = 4;
const BACKGROUND = [200, 204, 212] as const;
const SWATCH = 6;
const OUT_DIR = 'preview';
const OUT_FILE = `${OUT_DIR}/character-sheet.png`;
/** The Backyard composites on their own, for reviewing the venue layout. */
const VENUE_FILE = `${OUT_DIR}/backyard.png`;
const PARK_FILE = `${OUT_DIR}/park.png`;
const CREW_FILE = `${OUT_DIR}/crew-sheet.png`;
const SAM_FILE = `${OUT_DIR}/sam-sheet.png`;
const CREW: readonly CrewId[] = ['brick', 'leo', 'tia', 'pete'];
const VENUE_SCALE = 3;
/** Biscuit galloping the ball at the left goal, one Backyard view per frame in a strip, for slicing into a GIF. */
const CARRY_FILE = `${OUT_DIR}/biscuit-carry.png`;
const CARRY_FRAMES = 8;
/** How far he gallops between strip frames, px. */
const CARRY_STEP = 14;
const FACINGS = ['side', 'threeQuarter', 'front'] as const;

function swatch(hex: string): SheetItem {
  const n = parseInt(hex.slice(1), 16);
  const rgba = new Uint8Array(SWATCH * SWATCH * 4);
  for (let i = 0; i < SWATCH * SWATCH; i++) rgba.set([(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255], i * 4);
  return { width: SWATCH, height: SWATCH, rgba };
}

/** Resolves an image with a look, outlining a padded copy first when asked. */
function resolved(img: IndexedImage, look: LookColors, outline = false): SheetItem {
  let src = img;
  if (outline) {
    src = new IndexedImage(img.width + 2, img.height + 2);
    blit(src, img, 1, 1);
    addOutline(src, C.Outline);
  }
  return { width: src.width, height: src.height, rgba: toRGBA(src, resolvePalette(look)) };
}

/** Resolves an image with Harrison's look. */
function item(img: IndexedImage, kit: KitId = 'home', form: PowerForm = 'base', outline = false): SheetItem {
  return resolved(img, harrisonLook(kit, form), outline);
}

/** HUD-style text: white ink, dark outline. */
function text(s: string, scale: number): SheetItem {
  const img = renderText(s, scale);
  return { width: img.width, height: img.height, rgba: toRGBA(img, textPalette('white', 'outline')) };
}

/** Paints a resolved image into a 320×180 RGBA view, skipping transparent pixels. */
function paint(view: Uint8ClampedArray, img: IndexedImage, palette: ResolvedPalette, dx: number, dy: number): void {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const id = img.get(x, y);
      const vx = x + dx;
      const vy = y + dy;
      if (id === 0 || vx < 0 || vy < 0 || vx >= VIEW_W || vy >= VIEW_H) continue;
      view.set(palette[id]!, (vy * VIEW_W + vx) * 4);
    }
  }
}

const VIEW_W = 320;
const VIEW_H = 180;

/** Something standing on the pitch in a composite view, at world (x, y, z). */
interface Actor {
  x: number;
  y: number;
  z: number;
  img: IndexedImage;
  palette: ResolvedPalette;
  /** The sprite pixel that sits on (x, y, z). */
  anchor: { x: number; y: number };
  shadow?: boolean;
}

/** The joggers on the Park's mid layer at time `nowS`, as the match draws them. */
function paintJoggers(view: Uint8ClampedArray, cam: number, midW: number, nowS: number): void {
  const midX = -Math.round(cam * PARALLAX.mid);
  for (const j of JOGGERS) {
    const frames = joggerFrames(j.shirt, j.hair);
    const img = frames[Math.floor(nowS * 8) % 2]!;
    const x = (((j.startX + j.dir * j.speed * nowS) % midW) + midW) % midW;
    paint(view, j.dir === 1 ? img : flipX(img), masterPalette(), Math.round(midX + x), PATH_Y - img.height + 1);
  }
}

/** A venue as the camera at `cam` sees it: layers, goals, then everything on the pitch, far to near. */
function venueView(L: VenueLayers, cam: number, actors: readonly Actor[], nowS: number | null = null): SheetItem {
  const view = new Uint8ClampedArray(VIEW_W * VIEW_H * 4);
  const pal = masterPalette();
  const farX = -Math.round(cam * PARALLAX.far);
  paint(view, L.far, pal, farX, 0);
  paint(view, L.far, pal, farX + L.far.width, 0);
  paint(view, L.mid, pal, -Math.round(cam * PARALLAX.mid), 0);
  if (nowS !== null) paintJoggers(view, cam, L.mid.width, nowS);
  for (const name of ['near', 'ground'] as const) paint(view, L[name], pal, -Math.round(cam * PARALLAX[name]), 0);
  const posts: Actor[] = [];
  for (const goal of BACKYARD.goals) {
    const art = goalSprites(goal.side);
    const at = project(goal.lineX, 0, 0, { x: cam });
    const anchor = { x: -art.origin.x, y: -art.origin.y };
    // Nets before posts, as in the match, so a post is drawn over its net.
    for (const [z, img] of [
      [goal.z1, art.farNet],
      [goal.z0, art.nearNet],
    ] as const) {
      posts.push({ x: goal.lineX, y: 0, z, img, palette: pal, anchor: { x: anchor.x + z * DEPTH_SHEAR, y: anchor.y - z } });
    }
    posts.push({ x: goal.lineX, y: 0, z: goal.z0, img: art.nearPost, palette: pal, anchor: { x: anchor.x + goal.z0 * DEPTH_SHEAR, y: anchor.y - goal.z0 } });
    posts.push({ x: goal.lineX, y: 0, z: goal.z1, img: art.farPost, palette: pal, anchor: { x: anchor.x + goal.z1 * DEPTH_SHEAR, y: anchor.y - goal.z1 } });
  }
  const shadow = new IndexedImage(5, 1);
  for (let x = 0; x < 5; x++) shadow.set(x, 0, M.grassDark);
  for (const a of actors) {
    if (!a.shadow) continue;
    const p = project(a.x, 0, a.z, { x: cam });
    paint(view, shadow, pal, Math.round(p.sx) - 2, Math.round(p.sy) + 1);
  }
  for (const a of [...actors, ...posts].sort((m, n) => n.z - m.z)) {
    const p = project(a.x, a.y, a.z, { x: cam });
    paint(view, a.img, a.palette, Math.round(p.sx - a.anchor.x), Math.round(p.sy - a.anchor.y));
  }
  return { width: VIEW_W, height: VIEW_H, rgba: view };
}

const backyardView = (cam: number, actors: readonly Actor[]) => venueView(backyardLayers(), cam, actors);
const parkView = (cam: number, actors: readonly Actor[], nowS = 3) => venueView(parkLayers(), cam, actors, nowS);

const harrisonAt = (x: number, z: number, clip: AnimName, frame: number, facing: 1 | -1 = 1): Actor => {
  const img = baked[clip].frames[frame]!;
  return { x, y: 0, z, img: facing === 1 ? img : flipX(img), palette: resolvePalette(harrisonLook()), anchor: facing === 1 ? ANCHOR : { x: img.width - 1 - ANCHOR.x, y: ANCHOR.y } };
};
const maxAt = (x: number, z: number, clip: AnimName, frame: number, facing: 1 | -1 = -1): Actor => {
  const img = max[clip].frames[frame]!;
  return { x, y: 0, z, img: facing === 1 ? img : flipX(img), palette: resolvePalette(maxLook()), anchor: facing === 1 ? ANCHOR : { x: img.width - 1 - ANCHOR.x, y: ANCHOR.y } };
};
const biscuitAt = (x: number, z: number, clip: DogAnim, frame: number, facing: 1 | -1 = -1): Actor => {
  const img = BISCUIT_FRAMES[clip][frame]!;
  return { x, y: 0, z, img: facing === 1 ? img : flipX(img), palette: masterPalette(), anchor: facing === 1 ? BISCUIT_ANCHOR : { x: img.width - 1 - BISCUIT_ANCHOR.x, y: BISCUIT_ANCHOR.y }, shadow: true };
};
const ballAt = (x: number, y: number, z: number, frame = 0): Actor => ({
  x,
  y,
  z,
  img: ballFrames()[frame]!,
  palette: masterPalette(),
  anchor: { x: BALL_R, y: BALL_R },
  shadow: true,
});
const withShadow = (a: Actor): Actor => ({ ...a, shadow: true });

/** Camera at the left end: Harrison near the camera dribbling, Max on the far side, a shot heading for the far post. */
const leftEndView = () =>
  backyardView(0, [
    withShadow(harrisonAt(150, 12, 'run', 2, -1)),
    ballAt(141, BALL_R, 12),
    withShadow(maxAt(96, 50, 'idle', 0, 1)),
    ballAt(60, 16, 40, 1),
  ]);

/** Camera at the right end: Max dribbling at the near post, Harrison going round him deep, the ball in the net behind. */
const rightEndView = () => {
  const cam = BACKYARD.width + BACKYARD.depth * DEPTH_SHEAR - VIEW_W;
  return backyardView(cam, [withShadow(maxAt(560, 24, 'run', 1)), withShadow(harrisonAt(540, 46, 'run', 3)), ballAt(620, BALL_R, 32, 2)]);
};

const crewBaked = Object.fromEntries(CREW.map(id => [id, bakeAll(CREW_BODY[id], CREW_HEADS[id])])) as Record<CrewId, ReturnType<typeof bakeAll>>;
const crewAt = (id: CrewId, x: number, z: number, clip: AnimName, frame: number, facing: 1 | -1 = -1): Actor => {
  const img = crewBaked[id][clip].frames[frame]!;
  return { x, y: 0, z, img: facing === 1 ? img : flipX(img), palette: resolvePalette(crewLook(id)), anchor: facing === 1 ? ANCHOR : { x: img.width - 1 - ANCHOR.x, y: ANCHOR.y }, shadow: true };
};

/** The Park at the left end: Harrison dribbling at the left goal, Brick deep in his way, Tia coming across behind. */
const parkMatchView = (nowS = 3) =>
  parkView(24, [withShadow(harrisonAt(200, 28, 'run', 2, -1)), ballAt(190, BALL_R, 28), crewAt('brick', 120, 30, 'idle', 0, 1), crewAt('tia', 250, 48, 'run', 3, -1)], nowS);

/** Camera at the left end: Biscuit galloping the ball at the left goal, Harrison squared up in his way. */
const bossView = (x = 150, frame = 0) => backyardView(0, [biscuitAt(x, 30, 'carry', frame % 4), withShadow(harrisonAt(96, 32, 'idle', 0, 1))]);

const standing = standingPose(HARRISON_BODY);
const baked = bakeAll(HARRISON_BODY, HARRISON_HEADS);
const powered = bakeAll(HARRISON_BODY, HARRISON_POWER_HEADS);
const max = bakeAll(HARRISON_BODY, MAX_HEADS);
const ballRow = ballFrames().map(f => resolved(f, harrisonLook())).map((it, i) => ({ ...it, rgba: toRGBA(ballFrames()[i]!, masterPalette()) }));
const clipRows = (kit: KitId) => Object.values(baked).map(clip => clip.frames.map(f => item(f, kit)));

/** Each kid's row: face, the three head facings, then idle, run and shoot frames, in their kit. */
const crewRow = (id: CrewId): SheetItem[] => {
  const look = crewLook(id);
  const b = crewBaked[id];
  return [
    ...FACINGS.map(f => resolved(CREW_HEADS[id][f].image, look, true)),
    ...[...b.idle.frames.slice(0, 1), ...b.run.frames, ...b.shoot.frames].map(f => resolved(f, look)),
  ];
};

const sam = bakeAll(HARRISON_BODY, SAM_HEADS);
/** Speedy Sam's row: face, the three head facings, then idle, run, sprint, shoot and both skid frames, in his kit. */
const samRow = (): SheetItem[] => {
  const look = samLook();
  return [
    resolved(SAM_HEADS.front.image, look, true),
    ...FACINGS.map(f => resolved(SAM_HEADS[f].image, look, true)),
    ...[...sam.idle.frames.slice(0, 1), ...sam.run.frames.slice(0, 4), ...sam.sprint.frames.slice(0, 4), ...sam.shoot.frames.slice(0, 3), ...sam.skid.frames].map(f => resolved(f, look)),
  ];
};
const samAt = (x: number, z: number, clip: AnimName, frame: number, facing: 1 | -1 = -1): Actor => {
  const img = sam[clip].frames[frame]!;
  return { x, y: 0, z, img: facing === 1 ? img : flipX(img), palette: resolvePalette(samLook()), anchor: facing === 1 ? ANCHOR : { x: img.width - 1 - ANCHOR.x, y: ANCHOR.y }, shadow: true };
};
/** The Park: Harrison has dragged the ball back, and Sam skids past him. */
const samParkView = () => parkView(24, [withShadow(harrisonAt(200, 30, 'shoot', 1, 1)), ballAt(208, BALL_R, 30), samAt(150, 32, 'skid', 1, -1)]);
const EXPRESSIONS = ['neutral', 'celebrate', 'determined', 'disappointed'] as const;

const rows: SheetItem[][] = [
  [...EXPRESSIONS.map(e => item(harrisonPortrait(e))), item(harrisonPortrait('celebrate'), 'home', 'golden')],
  ...clipRows('home'),
  powered.powerUp.frames.map(f => item(f, 'home', 'golden')),
  powered.powerUp.frames.map(f => item(f, 'home', 'ultra')),
  ...clipRows('away'),
  [
    item(drawFigure(standing, HARRISON_BODY, HARRISON_HEADS), 'home'),
    item(drawFigure(standing, HARRISON_BODY, HARRISON_HEADS), 'away'),
    item(drawFigure(standing, HARRISON_BODY, HARRISON_POWER_HEADS), 'home', 'golden'),
  ],
  [
    ...FACINGS.map(f => item(HARRISON_HEADS[f].image, 'home', 'base', true)),
    ...FACINGS.map(f => item(HARRISON_POWER_HEADS[f].image, 'home', 'golden', true)),
    ...FACINGS.map(f => item(HARRISON_POWER_HEADS[f].image, 'home', 'ultra', true)),
  ],
  Object.values(MASTER).map(swatch),
  [...max.idle.frames, ...max.run.frames].map(f => resolved(f, maxLook())),
  [...FACINGS.map(f => resolved(MAX_HEADS[f].image, maxLook(), true)), item(baked.idle.frames[0]!), resolved(max.idle.frames[0]!, maxLook())],
  [leftEndView(), rightEndView()],
  Object.values(BISCUIT_FRAMES).flat().slice(0, 10).map(f => ({ width: f.width, height: f.height, rgba: toRGBA(f, masterPalette()) })),
  [...Object.values(BISCUIT_FRAMES).flat().slice(10), BISCUIT_FACE].map(f => ({ width: f.width, height: f.height, rgba: toRGBA(f, masterPalette()) })),
  [bossView()],
  ...CREW.map(crewRow),
  [parkMatchView()],
  samRow(),
  ballRow,
  [text("HARRISON 0-0 MAX 45'", 1), text('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1), text("0123456789 -':!?.,/+", 1)],
  [text("HARRISON 0-0 MAX 45'", 2), text('GOAL! PERFECT', 2)],
];

const sheet = composeSheet(rows, { scale: SCALE, gap: GAP, background: BACKGROUND });
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, encodePNG(sheet.width, sheet.height, sheet.rgba));
console.log(`wrote ${OUT_FILE} (${sheet.width}×${sheet.height})`);

const venue = composeSheet([[leftEndView()], [rightEndView()]], { scale: VENUE_SCALE, gap: GAP, background: BACKGROUND });
writeFileSync(VENUE_FILE, encodePNG(venue.width, venue.height, venue.rgba));
console.log(`wrote ${VENUE_FILE} (${venue.width}×${venue.height})`);

const parkEndView = () => parkView(0, [withShadow(harrisonAt(80, 20, 'idle', 0, 1)), ballAt(90, BALL_R, 20)], 7);
const crewFaces = composeSheet([CREW.map(id => resolved(CREW_HEADS[id].front.image, crewLook(id), true)), CREW.flatMap(id => FACINGS.slice(0, 2).map(f => resolved(CREW_HEADS[id][f].image, crewLook(id), true)))], { scale: 10, gap: GAP, background: BACKGROUND });
writeFileSync(`${OUT_DIR}/crew-faces.png`, encodePNG(crewFaces.width, crewFaces.height, crewFaces.rgba));
const crewSheet = composeSheet([...CREW.map(crewRow), [parkMatchView()]], { scale: VENUE_SCALE, gap: GAP * 2, background: BACKGROUND });
writeFileSync(CREW_FILE, encodePNG(crewSheet.width, crewSheet.height, crewSheet.rgba));
console.log(`wrote ${CREW_FILE} (${crewSheet.width}×${crewSheet.height})`);

const samSheet = composeSheet(
  [samRow(), [resolved(SAM_HEADS.front.image, samLook(), true), resolved(CREW_HEADS.pete.front.image, crewLook('pete'), true), resolved(MAX_HEADS.front.image, maxLook(), true)], [samParkView()]],
  { scale: VENUE_SCALE, gap: GAP * 2, background: BACKGROUND },
);
writeFileSync(SAM_FILE, encodePNG(samSheet.width, samSheet.height, samSheet.rgba));
console.log(`wrote ${SAM_FILE} (${samSheet.width}×${samSheet.height})`);

const park = composeSheet([[parkMatchView()], [parkEndView()]], { scale: VENUE_SCALE, gap: GAP, background: BACKGROUND });
writeFileSync(PARK_FILE, encodePNG(park.width, park.height, park.rgba));
console.log(`wrote ${PARK_FILE} (${park.width}×${park.height})`);

const carry = composeSheet([Array.from({ length: CARRY_FRAMES }, (_, i) => bossView(236 - i * CARRY_STEP, i))], { scale: 1, gap: 0, background: BACKGROUND });
writeFileSync(CARRY_FILE, encodePNG(carry.width, carry.height, carry.rgba));
console.log(`wrote ${CARRY_FILE} (${carry.width}×${carry.height})`);

/** The tricks: Harrison's stepover and flick in both kits, every opponent fooled and stumbling, Biscuit's tilt and tumble, two match views. */
const TRICKS_FILE = `${OUT_DIR}/tricks-sheet.png`;
const QUESTION = renderText('?', 1);
const QUESTION_PAL = textPalette('white', 'outline');
/** How far over the top of his head the "?" floats, px. */
const MARK_GAP = 2;

/** A frame with the white "?" over its head, as the match draws it over a confused player; padded on top so the mark fits. */
function marked(img: IndexedImage, palette: ResolvedPalette): SheetItem {
  const pad = QUESTION.height + MARK_GAP;
  const width = img.width;
  const rgba = new Uint8ClampedArray(width * (img.height + pad) * 4);
  rgba.set(toRGBA(img, palette), width * pad * 4);
  const mark = toRGBA(QUESTION, QUESTION_PAL);
  const b = opaqueBounds(img)!;
  const left = Math.round(b.x + b.w / 2 - QUESTION.width / 2);
  const top = pad + b.y - MARK_GAP - QUESTION.height;
  for (let y = 0; y < QUESTION.height; y++) {
    for (let x = 0; x < QUESTION.width; x++) {
      const src = (y * QUESTION.width + x) * 4;
      if (mark[src + 3] === 0) continue;
      rgba.set(mark.subarray(src, src + 4), ((top + y) * width + left + x) * 4);
    }
  }
  return { width, height: img.height + pad, rgba };
}

/** The "?" over an actor's head in a match view. */
const markOver = (a: Actor): Actor => {
  const b = opaqueBounds(a.img)!;
  return { ...a, img: QUESTION, palette: QUESTION_PAL, shadow: false, anchor: { x: a.anchor.x - Math.round(b.x + b.w / 2 - QUESTION.width / 2), y: a.anchor.y - b.y + MARK_GAP + QUESTION.height } };
};

const OPPONENTS: readonly { label: string; clips: ReturnType<typeof bakeAll>; look: LookColors }[] = [
  { label: 'MAX', clips: max, look: maxLook() },
  ...CREW.map(id => ({ label: id.toUpperCase(), clips: crewBaked[id], look: crewLook(id) })),
  { label: 'SAM', clips: sam, look: samLook() },
];
const opponentTrickRow = ({ label, clips, look }: (typeof OPPONENTS)[number]): SheetItem[] => {
  const pal = resolvePalette(look);
  return [text(label, 1), marked(clips.fooled.frames[0]!, pal), ...[...clips.fooled.frames.slice(1), ...clips.stumble.frames].map(f => resolved(f, look))];
};
const harrisonTrickRow = (kit: KitId): SheetItem[] => [text(kit.toUpperCase(), 1), ...[...baked.stepover.frames, ...baked.flick.frames].map(f => item(f, kit))];
const dogItem = (f: IndexedImage): SheetItem => ({ width: f.width, height: f.height, rgba: toRGBA(f, masterPalette()) });
const biscuitTrickRow = (): SheetItem[] => [
  text('BISCUIT', 1),
  marked(BISCUIT_FRAMES.tilt[0]!, masterPalette()),
  ...[...BISCUIT_FRAMES.tilt.slice(1), ...BISCUIT_FRAMES.tumble].map(dogItem),
];

/** Mid-stepover past Max: the ball at his feet, Max swayed the wrong way with the "?" over him. */
const stepoverView = () => {
  const maxFooled = withShadow(maxAt(186, 38, 'fooled', 0));
  return backyardView(40, [withShadow(harrisonAt(160, 30, 'stepover', 2)), ballAt(160 + FOOT_SPOT, BALL_R, 30), maxFooled, markOver(maxFooled)]);
};
/** Just after the flick: the ball up over Max's head, Max lurching on. */
const flickView = () =>
  backyardView(40, [withShadow(harrisonAt(165, 30, 'flick', 4)), ballAt(186, 50, 30, 1), withShadow(maxAt(194, 30, 'stumble', 1))]);

const tricks = composeSheet(
  [harrisonTrickRow('home'), harrisonTrickRow('away'), ...OPPONENTS.map(opponentTrickRow), biscuitTrickRow(), [stepoverView(), flickView()]],
  { scale: VENUE_SCALE, gap: GAP * 2, background: BACKGROUND },
);
writeFileSync(TRICKS_FILE, encodePNG(tricks.width, tricks.height, tricks.rgba));
console.log(`wrote ${TRICKS_FILE} (${tricks.width}×${tricks.height})`);
