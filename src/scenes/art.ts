import { ballFrames } from '../art/ball';
import type { AnimName } from '../art/body/animations';
import { bakeAll, type BakedClip } from '../art/body/bake';
import { NO_BODY_EXTRAS, type BodyExtras } from '../art/body/drawFigure';
import type { HeadSprite } from '../art/body/head';
import type { HeadFacing } from '../art/body/pose';
import { HARRISON_BODY, type BodyProportions } from '../art/body/proportions';
import { C, masterPalette, resolvePalette, type LookColors, type MasterColor, type ResolvedPalette } from '../art/colors';
import { renderText, textPalette } from '../art/font';
import { buttonGlyph, type ButtonName } from '../art/glyphs';
import type { Expression } from '../art/harrison/portrait';
import { IndexedImage, blit, flipX } from '../art/indexedImage';
import { BISCUIT_FACE, BISCUIT_FRAMES, type DogAnim } from '../art/opponents/biscuit';
import { CREW_BODY, CREW_HEADS, crewLook } from '../art/opponents/crew';
import { MAX_HEADS, maxLook } from '../art/opponents/max';
import { SAM_HEADS, samLook } from '../art/opponents/sam';
import { TRYOUT_BODY, TRYOUT_HEADS, tryoutLook } from '../art/opponents/tryouts';
import type { TryoutKidId } from '../game/tryouts';
import { addOutline, type Point } from '../art/raster';
import { KEEPER_EXTRAS, KEEPER_HEADS, keeperLook, type KeeperId } from '../art/keepers/keepers';
import { KEEPER_POSE_FRAMES, bakeKeeperPoses, diveFrames, type KeeperPose } from '../art/keepers/poses';
import { backyardLayers, type VenueLayers } from '../art/venues/backyard';
import { JOGGERS, joggerFrames, parkLayers } from '../art/venues/park';
import { goalSprites, type GoalArt } from '../art/venues/pitch';
import { schoolLayers } from '../art/venues/school';
import { LEAVES, crowdFrames, flagFrames, leafFrames } from '../art/venues/schoolLife';
import type { OpponentId, VenueId } from '../meta/career';
import { DEFAULT_OUTFIT, outfitKey, type ChangeKit, type Outfit } from '../meta/locker';
import { changeLook } from '../art/kits';
import { toCanvas } from '../engine/bitmaps';
import type { CrewId } from '../game/crew';
import type { Field } from '../game/field';
import { SpriteCache, type FacingFrames } from '../engine/sprites';
import { HarrisonArt } from './harrisonArt';
import { OutfitFx } from './outfitView';

/** Harrison's three sprite sets: his own hair, powered up, and in Golden Form's gold. */
export type HomeSet = 'home' | 'homePower' | 'homeGolden';

export interface SpriteSet {
  right: Record<AnimName, HTMLCanvasElement[]>;
  left: Record<AnimName, HTMLCanvasElement[]>;
}

/** A keeper: the shared clips in his top and gloves, his own poses, and his dives baked for each facing. */
export interface KeeperSprites {
  /** The shared clips (run, sprint, fall, fooled, stumble...) in his top and gloves. */
  body: SpriteSet;
  poses: Record<KeeperPose, FacingFrames>;
  dives: Record<'far' | 'near', { right: HTMLCanvasElement[]; left: HTMLCanvasElement[]; anchor: { right: Point; left: Point } }>;
}

/** Biscuit's clips, facing right and left. */
export type DogSprites = Record<DogAnim, FacingFrames>;

/** A goal's sprites, placed at project(lineX, 0, 0, cam) + origin. */
export interface GoalCanvases {
  farNet: HTMLCanvasElement;
  nearNet: HTMLCanvasElement;
  nearPost: HTMLCanvasElement;
  farPost: HTMLCanvasElement;
  origin: { x: number; y: number };
}

/** A venue's four layers, and its joggers' two run frames each, already facing the way each runs (none in the Backyard). */
export interface VenueCanvases {
  layers: Record<keyof VenueLayers, HTMLCanvasElement>;
  joggers: readonly (readonly [HTMLCanvasElement, HTMLCanvasElement])[];
}

/** The School Field's life: the crowd's bob and cheer frames, the flag's frames, and each leaf's two tumble frames. */
export interface SchoolLifeCanvases {
  crowd: { bob: readonly [HTMLCanvasElement, HTMLCanvasElement]; cheer: readonly [HTMLCanvasElement, HTMLCanvasElement] };
  flag: readonly HTMLCanvasElement[];
  /** One pair per LEAVES entry. */
  leaves: readonly (readonly [HTMLCanvasElement, HTMLCanvasElement])[];
}

export interface OpponentArt {
  sprites: SpriteSet;
  face: HTMLCanvasElement;
}

export interface GameArt {
  /** Every venue with its own art; drawLayers falls back to the Backyard for the rest. */
  venues: Partial<Record<VenueId, VenueCanvases>>;
  /** The School Field's crowd, flag and leaves. */
  schoolLife: SchoolLifeCanvases;
  /** A field's two goals, made the first time it's asked for. */
  goalsFor(field: Field): Readonly<Record<'left' | 'right', GoalCanvases>>;
  ball: HTMLCanvasElement[];
  /** Controller button pictures, for Help. */
  buttons: Record<ButtonName, HTMLCanvasElement>;
  /** Harrison in what he wears (see dress)... */
  readonly home: SpriteSet;
  /** ...with his hair lifted by the power-up, in his own colours... */
  readonly homePower: SpriteSet;
  /** ...and in Golden Form's gold. */
  readonly homeGolden: SpriteSet;
  /** What he wears now: the default until a save is played. */
  readonly outfit: Outfit;
  /** Puts him in `o`: home, homePower, homeGolden and portraits follow from now on, baked once per outfit. */
  dress(o: Outfit): void;
  /** Bakes all three of his sets in what he wears now, if they aren't yet, so a match never bakes one mid-play. */
  warm(): void;
  /** His frame now: the baked canvas, or for an animated kit, a scratch canvas painted with its shader at nowS. */
  harrison(set: HomeSet, facing: 1 | -1, clip: AnimName, frame: number, nowS: number): HTMLCanvasElement;
  /** The same frame's logical pixels, facing right, for the effects. */
  harrisonImage(set: HomeSet, clip: AnimName, frame: number): IndexedImage;
  /** Him in any outfit, facing right (the Locker Room's try-on); animated kits painted at nowS. */
  preview(o: Outfit, clip: AnimName, frame: number, nowS: number): HTMLCanvasElement;
  previewImage(o: Outfit, clip: AnimName, frame: number): IndexedImage;
  /** Portraits in any outfit (each save's info box). */
  portraitsOf(o: Outfit): Record<Expression, HTMLCanvasElement>;
  /** The juggler's effects on the backdrop, remade by dress(). */
  readonly backdropFx: OutfitFx;
  /** Every human opponent: their sprites, and their face, front on and outlined, for the venue panel and the boss node. */
  opponents: Record<HumanOpponent, OpponentArt>;
  /** An opponent in a change kit, for a match whose kits clash: baked the first time it's asked for. */
  opponentIn(id: HumanOpponent, change: ChangeKit): SpriteSet;
  /** Harrison's portrait in each expression, in what he wears. */
  readonly portraits: Record<Expression, HTMLCanvasElement>;
  /** The three keepers, baked the first time they're read. */
  readonly keepers: Readonly<Record<KeeperId, KeeperSprites>>;
  /** Biscuit the Dog, the Backyard's boss. */
  biscuit: DogSprites;
  /** His face, front on and outlined, for the boss node and the VS card. */
  biscuitFace: HTMLCanvasElement;
  /** Outlined text, cached per string, scale and colours. */
  text(s: string, scale: number, ink: MasterColor, outline: MasterColor): HTMLCanvasElement;
}

type HumanOpponent = Exclude<OpponentId, 'biscuit'>;
interface OpponentLook {
  heads: Readonly<Record<HeadFacing, HeadSprite>>;
  look: LookColors;
  body: BodyProportions;
}

const crewKid = (id: CrewId): OpponentLook => ({ heads: CREW_HEADS[id], look: crewLook(id), body: CREW_BODY[id] });
const tryoutKid = (id: TryoutKidId): OpponentLook => ({ heads: TRYOUT_HEADS[id], look: tryoutLook(id), body: TRYOUT_BODY[id] });

/** What each human opponent's sprites and face are drawn from. */
export const OPPONENT_LOOKS: Readonly<Record<HumanOpponent, OpponentLook>> = {
  max: { heads: MAX_HEADS, look: maxLook(), body: HARRISON_BODY },
  brick: crewKid('brick'),
  leo: crewKid('leo'),
  tia: crewKid('tia'),
  pete: crewKid('pete'),
  sam: { heads: SAM_HEADS, look: samLook(), body: HARRISON_BODY },
  hank: tryoutKid('hank'),
  lola: tryoutKid('lola'),
  finn: tryoutKid('finn'),
  priya: tryoutKid('priya'),
  niko: tryoutKid('niko'),
  paige: tryoutKid('paige'),
};

function spriteSet(cache: SpriteCache, who: string, heads: Readonly<Record<HeadFacing, HeadSprite>>, look: LookColors, body: BodyProportions = HARRISON_BODY, extras: BodyExtras = NO_BODY_EXTRAS): SpriteSet {
  const baked = bakeAll(body, heads, extras);
  const palette = resolvePalette(look);
  const set: SpriteSet = { right: {} as SpriteSet['right'], left: {} as SpriteSet['left'] };
  for (const [name, clip] of Object.entries(baked) as [AnimName, BakedClip][]) {
    const f = cache.frames(`${who}/${name}`, () => ({ frames: clip.frames, palette }));
    set.right[name] = f.right;
    set.left[name] = f.left;
  }
  return set;
}

/** A keeper's sprites: every dive facing baked from its own turn, never a flip, since depth always leans right. */
function keeperSprites(cache: SpriteCache, id: KeeperId): KeeperSprites {
  const heads = KEEPER_HEADS[id];
  const palette = resolvePalette(keeperLook(id));
  const baked = bakeKeeperPoses(HARRISON_BODY, heads, KEEPER_EXTRAS);
  const poses = Object.fromEntries(
    (Object.keys(KEEPER_POSE_FRAMES) as KeeperPose[]).map(name => [name, cache.frames(`keeper-${id}/pose-${name}`, () => ({ frames: baked[name], palette }))]),
  ) as Record<KeeperPose, FacingFrames>;
  const dive = (toward: 'far' | 'near') => {
    const [r, l] = [diveFrames(HARRISON_BODY, heads, KEEPER_EXTRAS, 1, toward), diveFrames(HARRISON_BODY, heads, KEEPER_EXTRAS, -1, toward)];
    return { right: r.frames.map(f => toCanvas(f, palette)), left: l.frames.map(f => toCanvas(f, palette)), anchor: { right: r.anchor, left: l.anchor } };
  };
  return { body: spriteSet(cache, `keeper-${id}`, heads, keeperLook(id), HARRISON_BODY, KEEPER_EXTRAS), poses, dives: { far: dive('far'), near: dive('near') } };
}

/** A head on its own, with a one-pixel outline ring, in `look`'s colours. */
function faceCanvas(head: HeadSprite, look: LookColors): HTMLCanvasElement {
  const img = new IndexedImage(head.image.width + 2, head.image.height + 2);
  blit(img, head.image, 1, 1);
  addOutline(img, C.Outline);
  return toCanvas(img, resolvePalette(look));
}

function goalCanvases(g: GoalArt, palette: ResolvedPalette): GoalCanvases {
  return { farNet: toCanvas(g.farNet, palette), nearNet: toCanvas(g.nearNet, palette), nearPost: toCanvas(g.nearPost, palette), farPost: toCanvas(g.farPost, palette), origin: g.origin };
}

function venueCanvases(L: VenueLayers, joggers: readonly (readonly [IndexedImage, IndexedImage])[], palette: ResolvedPalette): VenueCanvases {
  return {
    layers: { far: toCanvas(L.far, palette), mid: toCanvas(L.mid, palette), near: toCanvas(L.near, palette), ground: toCanvas(L.ground, palette) },
    joggers: joggers.map(([a, b]) => [toCanvas(a, palette), toCanvas(b, palette)] as const),
  };
}

function schoolLifeCanvases(palette: ResolvedPalette): SchoolLifeCanvases {
  const { bob, cheer } = crowdFrames();
  const pair = ([a, b]: readonly [IndexedImage, IndexedImage]) => [toCanvas(a, palette), toCanvas(b, palette)] as const;
  return { crowd: { bob: pair(bob), cheer: pair(cheer) }, flag: flagFrames().map(f => toCanvas(f, palette)), leaves: LEAVES.map(l => pair(leafFrames(l.color))) };
}

const BUTTONS: readonly ButtonName[] = ['A', 'B', 'X', 'Y', 'LB', 'RS', 'RT', 'START'];
/** The backdrop's juggler gives off his effects on these random numbers. */
const BACKDROP_FX_SEED = 12;

/** Bakes and resolves every image the match needs at boot; Harrison's, per outfit, when first asked for. */
export function loadGameArt(): GameArt {
  const master = masterPalette();
  const cache = new SpriteCache();
  const parkJoggers = JOGGERS.map(j => {
    const [a, b] = joggerFrames(j.shirt, j.hair);
    return j.dir === 1 ? ([a, b] as const) : ([flipX(a), flipX(b)] as const);
  });
  const opponentArt = (id: HumanOpponent): OpponentArt => {
    const { heads, look, body } = OPPONENT_LOOKS[id];
    return { sprites: spriteSet(cache, id, heads, look, body), face: faceCanvas(heads.front, look) };
  };
  const texts = new Map<string, HTMLCanvasElement>();
  const harrison = new HarrisonArt(cache);
  const changed = new Map<string, SpriteSet>();
  let outfit = DEFAULT_OUTFIT;
  let backdropFx = new OutfitFx(outfit, BACKDROP_FX_SEED);
  const goals = new Map<Field, Readonly<Record<'left' | 'right', GoalCanvases>>>();
  const keepers = new Map<KeeperId, KeeperSprites>();
  const keeper = (id: KeeperId): KeeperSprites => {
    let made = keepers.get(id);
    if (!made) {
      made = keeperSprites(cache, id);
      keepers.set(id, made);
    }
    return made;
  };
  return {
    venues: {
      backyard: venueCanvases(backyardLayers(), [], master),
      park: venueCanvases(parkLayers(), parkJoggers, master),
      school: venueCanvases(schoolLayers(), [], master),
    },
    schoolLife: schoolLifeCanvases(master),
    goalsFor(field) {
      let made = goals.get(field);
      if (!made) {
        const side = (s: 'left' | 'right') => goalCanvases(goalSprites(field.goals.find(g => g.side === s)!), master);
        made = { left: side('left'), right: side('right') };
        goals.set(field, made);
      }
      return made;
    },
    ball: ballFrames().map(f => toCanvas(f, master)),
    buttons: Object.fromEntries(BUTTONS.map(b => [b, toCanvas(buttonGlyph(b), master)])) as Record<ButtonName, HTMLCanvasElement>,
    get home() {
      return harrison.set(outfit, 'home');
    },
    get homePower() {
      return harrison.set(outfit, 'homePower');
    },
    get homeGolden() {
      return harrison.set(outfit, 'homeGolden');
    },
    get outfit() {
      return outfit;
    },
    dress(o) {
      if (outfitKey(o) === outfitKey(outfit)) return;
      outfit = o;
      backdropFx = new OutfitFx(o, BACKDROP_FX_SEED);
    },
    warm() {
      for (const set of ['home', 'homePower', 'homeGolden'] as const) harrison.set(outfit, set);
    },
    harrison: (set, facing, clip, frame, nowS) => harrison.canvas(outfit, set, facing, clip, frame, nowS),
    harrisonImage: (set, clip, frame) => harrison.image(outfit, set, clip, frame),
    preview: (o, clip, frame, nowS) => harrison.preview(o, clip, frame, nowS),
    previewImage: (o, clip, frame) => harrison.previewImage(o, clip, frame),
    portraitsOf: o => harrison.portraitsOf(o),
    get backdropFx() {
      return backdropFx;
    },
    opponents: Object.fromEntries((Object.keys(OPPONENT_LOOKS) as HumanOpponent[]).map(id => [id, opponentArt(id)])) as Record<HumanOpponent, OpponentArt>,
    opponentIn(id, change) {
      const { heads, look, body } = OPPONENT_LOOKS[id];
      const key = `${id}-${change}`;
      let set = changed.get(key);
      if (!set) {
        set = spriteSet(cache, key, heads, changeLook(look, change), body);
        changed.set(key, set);
      }
      return set;
    },
    get portraits() {
      return harrison.portraitsOf(outfit);
    },
    keepers: {
      get eddie() {
        return keeper('eddie');
      },
      get backupA() {
        return keeper('backupA');
      },
      get backupB() {
        return keeper('backupB');
      },
    },
    biscuit: Object.fromEntries(
      Object.entries(BISCUIT_FRAMES).map(([name, frames]) => [name, cache.frames(`biscuit/${name}`, () => ({ frames: [...frames], palette: master }))]),
    ) as DogSprites,
    biscuitFace: toCanvas(BISCUIT_FACE, master),
    text(s, scale, ink, outline) {
      const key = `${s}|${scale}|${ink}|${outline}`;
      let c = texts.get(key);
      if (!c) {
        c = toCanvas(renderText(s, scale), textPalette(ink, outline));
        texts.set(key, c);
      }
      return c;
    },
  };
}
