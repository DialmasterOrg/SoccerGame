import { CLIPS, type AnimName } from '../art/body/animations';
import { ANCHOR } from '../art/body/pose';
import { MASTER, type MasterColor } from '../art/colors';
import { PARALLAX } from '../art/venues/backyard';
import { JOGGERS, PATH_Y } from '../art/venues/park';
import { hudSize, offscreenArrow, project, viewOf, type Camera, type View } from '../game/camera';
import { stageFor } from '../game/stage';
import { drawCrowd, drawFlag, drawLeaves, type LayerAt } from './schoolView';
import { SWEET_SPOT } from '../game/kick';
import { clockText, type Team } from '../game/match';
import { DECEL, type Player } from '../game/player';
import { powerHint } from '../game/power';
import type { World } from '../game/world';
import type { VenueId } from '../meta/career';
import type { GameArt, HomeSet, KeeperSprites, SpriteSet } from './art';
import { drawKeeperShadows, keeperDrawables } from './keeperView';
import type { OutfitFx } from './outfitView';
import { depthSorted, type Drawable } from './depthSort';
import { drawDog } from './dogView';
import { drawSpeed, skidFacing } from './samView';
import { drawTrickMarks } from './trickView';
import {
  auraStrength,
  drawAura,
  drawBeam,
  drawPowerBar,
  drawPowerMeter,
  drawSkid,
  homeSprites,
  powerMeterX0,
  powerPrompt,
  shakeFor,
  silhouette,
} from './powerView';
import type { TrailPoint } from './shotTrail';
import { BANNER_FROM_S, CELEBRATE_FROM_S, bannerShown, celebrating, shakeOffset, type GoalMoment } from './goalMoment';

/** Overlay state the match scene keeps between frames. */
export interface MatchHud {
  /** Who just hit a PERFECT shot, and until when (seconds) to show it. */
  perfect: null | { team: Team; untilS: number };
  /** Harrison's goal moment, while it runs. */
  moment: GoalMoment | null;
  /** The line under GOAL!!! naming his goal, if it was special. */
  callout: string | null;
  /** Where a hard-hit ball has just been, newest first. */
  trail: TrailPoint[];
  /** A white flash is owed to the next drawn frame (set when his goal moment starts, or a wave fires). */
  flash: boolean;
  /** A power shake running until untilS (a fired wave, a brace). */
  shake: { px: number; untilS: number } | null;
  /** Drawn frames left of the high-contrast impact silhouettes, as a wave fires. */
  impactFrames: number;
  /** He celebrates an Energy Wave goal in Golden Form's gold. */
  goldenCelebration: boolean;
  /** BONUS DONE!, while it shows after a goal moment. */
  bonusCallout: string | null;
  /** STEPOVER! or RAINBOW FLICK!, over Harrison for a second after a trick fools someone; never during a goal moment. */
  trickCallout: string | null;
  /** The away side's name on the HUD and its goal banner. */
  awayName: string;
  /** Both keepers' sprites: Harrison's in the home goal, theirs in the away one; null or absent without keepers. */
  readonly keeperSprites?: { home: KeeperSprites; away: KeeperSprites } | null;
  /** Where the match is played: its scenery. */
  venue: VenueId;
  /** The away player's sprites: Max, or the Park kid playing. Unused against Biscuit. */
  readonly awaySprites: SpriteSet;
  /** Harrison's flashy kit and boots effects for this match, or null when nothing he wears animates. */
  fx: OutfitFx | null;
}

/**
 * Whether to draw the white flash this frame. It shows on exactly one drawn
 * frame, however many ticks that frame covers, and waits out a fired wave's
 * impact frames so it never greys their silhouettes.
 */
export function takeFlash(hud: MatchHud): boolean {
  if (hud.impactFrames > 0) return false;
  const owed = hud.flash;
  hud.flash = false;
  return owed;
}

export const HOME_NAME = 'HARRISON';

const BALL_SPRITE_R = 3;
const CHARGE_BAR = { w: 12, h: 2, above: 46 };
const STAMINA_BAR = { x: 4, y: 2, w: 30, h: 3 };
const BANNER_Y = 58;
const GOLDEN_GOAL_BANNER_S = 1.5;
/** GOAL!!! lands big, then bounces to rest. */
const GOAL_SLAM = { scale: 4, forS: 0.1, settleS: 0.2, bouncePx: 6 };
const FLASH_ALPHA = 0.6;
/** The streak tapers from the ball back, fading as it goes. */
const TRAIL_STYLE = { width: 3, alpha: 0.7 };
/** The callout comes in under GOAL!!! once the slam has settled. */
const CALLOUT = { fromS: 0.6, gapPx: 26 };
/** The celebration's up-tall frame is drawn this far higher: a little hop. */
const CELEBRATE_HOP_PX = 2;
/** Blinks per second for the overcharge flash. */
const BLINK_HZ = 8;
const ARROW_Y = 16;
/** SHOOT! sits over his power-up bar, flashing between gold and white. */
const PROMPT_Y = -56;
const PROMPT_BLINK_HZ = 8;
/** The arrow is drawn 3 px either side of its x; this keeps a pixel's gap beside the meter. */
const ARROW_CLEARANCE = 5;
/** Harrison's off-screen marker: how far off the edge (px) earns a second and a third chevron. */
export const MARKER_FAR = [60, 180] as const;
/** The marker sits this far above his feet (about his chest), and keeps clear of the score and the bottom edge, in HUD-layer px. */
const MARKER = { rise: 28, top: 24, bottom: 8, inset: 2, step: 4 } as const;
const SHADOW_W = 5;
/** Biscuit is long: his shadow is a wider patch. */
const DOG_SHADOW_W = 9;

const ink = (g: CanvasRenderingContext2D, c: MasterColor) => (g.fillStyle = MASTER[c]);

/** Screen position of a world point. */
function screen(cam: Camera, x: number, y: number, z: number): { x: number; y: number } {
  const p = project(x, y, z, cam);
  return { x: Math.round(p.sx), y: Math.round(p.sy) };
}

/** The joggers' two-frame run, frames per second. */
const JOGGER_FPS = 8;

/**
 * A venue's scenery, far to near, with its joggers on the mid layer at time
 * `nowS`, and at the School its flag, crowd (cheering while `cheer`) and
 * leaves between the layers. A venue with no art of its own shows the Backyard.
 */
export function drawLayers(g: CanvasRenderingContext2D, cam: Camera, art: GameArt, venue: VenueId = 'backyard', nowS = 0, cheer = false): void {
  const drawn: VenueId = art.venues[venue] ? venue : 'backyard';
  const v = art.venues[drawn]!;
  // A venue drawn on a camera of another size shifts so its near touchline meets the camera's: the 300-row School sits 120 rows up on a 320×180 screen.
  const dy = viewOf(cam).nearSY - stageFor(drawn).view.nearSY;
  // The far sky is narrower than its scroll range, so it tiles.
  const far = v.layers.far;
  const farX = -(Math.round(cam.x * PARALLAX.far) % far.width);
  g.drawImage(far, farX, dy);
  g.drawImage(far, farX + far.width, dy);
  const at: LayerAt = { midX: -Math.round(cam.x * PARALLAX.mid), nearX: -Math.round(cam.x * PARALLAX.near), dy, viewW: viewOf(cam).w };
  const life = drawn === 'school' ? art.schoolLife : null;
  g.drawImage(v.layers.mid, at.midX, dy);
  if (life) drawFlag(g, life, at, nowS);
  const midW = v.layers.mid.width;
  const step = Math.floor(nowS * JOGGER_FPS) % 2;
  v.joggers.forEach((frames, i) => {
    const j = JOGGERS[i]!;
    const x = (((j.startX + j.dir * j.speed * nowS) % midW) + midW) % midW;
    const frame = frames[step]!;
    g.drawImage(frame, Math.round(at.midX + x), PATH_Y - frame.height + 1 + dy);
  });
  g.drawImage(v.layers.near, at.nearX, dy);
  if (life) drawCrowd(g, life, at, nowS, cheer);
  g.drawImage(v.layers.ground, -Math.round(cam.x * PARALLAX.ground), dy);
  if (life) drawLeaves(g, life, at, nowS);
}

/** Where a goal's sprites go: they all share one origin from its goal line. */
function goalAt(cam: Camera, lineX: number, origin: { x: number; y: number }): { x: number; y: number } {
  const at = project(lineX, 0, 0, cam);
  return { x: Math.round(at.sx + origin.x), y: Math.round(at.sy + origin.y) };
}

/** A 5×1 patch (or `width`) of dark grass on the ground under (x, z): shows how far back something is. */
function drawShadow(g: CanvasRenderingContext2D, cam: Camera, x: number, z: number, width = SHADOW_W): void {
  const s = screen(cam, x, 0, z);
  ink(g, 'grassDark');
  g.fillRect(s.x - Math.floor(width / 2), s.y + 1, width, 1);
}

type Clip = { name: AnimName; frame: number };

/** The way a player's sprite faces this frame. A skid faces the way he's still sliding. */
const spriteFacing = (p: Player, clip: Clip): 1 | -1 => (clip.name === 'skid' ? skidFacing(p) : p.facing);

/** The sprite canvas a player is drawn with this frame. */
function spriteFrame(p: Player, set: SpriteSet, clip: Clip): HTMLCanvasElement {
  const frames = (spriteFacing(p, clip) === 1 ? set.right : set.left)[clip.name];
  return frames[Math.min(clip.frame, frames.length - 1)]!;
}

/** A player's frame at his feet, hopping on the celebration's up frame. */
function drawSprite(g: CanvasRenderingContext2D, cam: Camera, p: Player, clip: Clip, frame: HTMLCanvasElement): void {
  const s = screen(cam, p.x, p.y, p.z);
  const hop = clip.name === 'celebrate' && clip.frame === 1 ? CELEBRATE_HOP_PX : 0;
  g.drawImage(frame, s.x - ANCHOR.x, s.y - ANCHOR.y - hop);
}

function drawPlayer(g: CanvasRenderingContext2D, cam: Camera, p: Player, art: GameArt, clip: Clip = p.anim, set?: SpriteSet, flat = false): void {
  const frame = spriteFrame(p, set ?? art.opponents.max.sprites, clip);
  drawSprite(g, cam, p, clip, flat ? silhouette(frame) : frame);
}

/** Harrison in what he wears, an animated kit painted live; a silhouette comes from the baked set. */
function drawHome(g: CanvasRenderingContext2D, cam: Camera, p: Player, art: GameArt, clip: Clip, look: HomeLook, flat = false): void {
  const frame = flat ? silhouette(spriteFrame(p, art[look.set], clip)) : art.harrison(look.set, spriteFacing(p, clip), clip.name, clip.frame, look.nowS);
  drawSprite(g, cam, p, clip, frame);
}

/** The away side: a human opponent in `set` (Max's when not given), or Biscuit when he's the opponent. */
function drawAway(g: CanvasRenderingContext2D, cam: Camera, w: World, art: GameArt, nowS: number, set?: SpriteSet, flat = false): void {
  if (w.dog) drawDog(g, cam, w, art, nowS, flat);
  else drawPlayer(g, cam, w.away, art, w.away.anim, set, flat);
}

/**
 * Harrison's clip this frame: arms up while he celebrates (the match is
 * frozen then, so it runs on the moment's clock).
 */
export function homeClip(w: World, moment: GoalMoment | null): Clip {
  if (!moment || !celebrating(moment)) return w.home.anim;
  const { fps, frameCount } = CLIPS.celebrate;
  return { name: 'celebrate', frame: Math.floor((moment.t - CELEBRATE_FROM_S) * fps) % frameCount };
}

/** A tapering, fading white streak along the trail, from the ball back. */
function drawTrail(g: CanvasRenderingContext2D, cam: Camera, trail: readonly TrailPoint[]): void {
  ink(g, 'white');
  for (let i = 0; i + 1 < trail.length; i++) {
    const [a, b] = [screen(cam, trail[i]!.x, trail[i]!.y, trail[i]!.z), screen(cam, trail[i + 1]!.x, trail[i + 1]!.y, trail[i + 1]!.z)];
    const fade = 1 - i / (trail.length - 1);
    const size = Math.max(1, Math.round(TRAIL_STYLE.width * fade));
    g.globalAlpha = TRAIL_STYLE.alpha * fade;
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let s = 0; s < steps; s++) {
      const x = Math.round(a.x + ((b.x - a.x) * s) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * s) / steps);
      g.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size);
    }
  }
  g.globalAlpha = 1;
}

function drawBall(g: CanvasRenderingContext2D, w: World, cam: Camera, art: GameArt, flat = false): void {
  const b = w.ball;
  const s = screen(cam, b.x, b.y, b.z);
  const quarter = Math.PI / 2;
  const n = art.ball.length;
  const frame = art.ball[((Math.floor(b.spinAngle / quarter) % n) + n) % n]!;
  g.drawImage(flat ? silhouette(frame) : frame, s.x - BALL_SPRITE_R, s.y - BALL_SPRITE_R);
}

/** Harrison's look this frame: which sprite set, and how strongly his aura burns (0 for none). */
export interface HomeLook {
  set: HomeSet;
  aura: number;
  nowS: number;
  /** His kit and boots effects, or null for none. */
  fx: OutfitFx | null;
}

/** Just behind him in the depth sort, so his aura and debris are drawn before him. */
const BEHIND = 1e-3;

/**
 * Everything standing on the pitch, ready for the depth sort: both players,
 * the ball, and each goal's nets and posts. The nets come first, so at the
 * same depth a post is drawn over its net. While he's powered up, his aura
 * goes just behind him. A ball Biscuit carries is part of his frame.
 */
export function pitchDrawables(
  w: World,
  cam: Camera,
  art: GameArt,
  home: Clip = w.home.anim,
  look: HomeLook = { set: 'home', aura: 0, nowS: 0, fx: null },
  away?: SpriteSet,
  keepers: { home: KeeperSprites; away: KeeperSprites } | null = null,
): Drawable[] {
  const goals = w.field.goals.flatMap(goal => {
    const part = (z: number, which: 'farNet' | 'nearNet' | 'nearPost' | 'farPost'): Drawable => ({
      z,
      draw: g => {
        const sprites = art.goalsFor(w.field)[goal.side];
        const at = goalAt(cam, goal.lineX, sprites.origin);
        g.drawImage(sprites[which], at.x, at.y);
      },
    });
    return [part(goal.z1, 'farNet'), part(goal.z0, 'nearNet'), part(goal.z0, 'nearPost'), part(goal.z1, 'farPost')];
  });
  const aura: Drawable[] =
    look.aura > 0
      ? [
          {
            z: w.home.z + BEHIND,
            draw: g => {
              const golden = look.set === 'homeGolden';
              drawAura(g, cam, w.home, spriteFrame(w.home, art[look.set], home), golden, look.aura, look.nowS);
            },
          },
        ]
      : [];
  // His flashy kit's and boots' particles, also just behind him.
  const fx = look.fx;
  const effects: Drawable[] = fx
    ? [
        {
          z: w.home.z + BEHIND,
          draw: g => {
            const at = { x: w.home.x, y: w.home.y, z: w.home.z };
            fx.draw(g, look.nowS, art.harrisonImage(look.set, home.name, home.frame), at, spriteFacing(w.home, home), w.home.anim.name === 'sprint', p => screen(cam, p.x, p.y, p.z));
          },
        },
      ]
    : [];
  // A player on soft brakes (Speedy Sam) kicks up dust and trails speed lines, just behind him.
  const speed: Drawable[] = !w.dog && w.away.handling.decel < DECEL ? [{ z: w.away.z + BEHIND, draw: g => drawSpeed(g, cam, w.away, look.nowS) }] : [];
  return [
    ...goals,
    ...aura,
    ...effects,
    ...speed,
    { z: w.home.z, draw: g => drawHome(g, cam, w.home, art, home, look) },
    { z: w.away.z, draw: g => drawAway(g, cam, w, art, look.nowS, away) },
    ...(keepers ? keeperDrawables(w, cam, keepers, look.nowS) : []),
    // Last among equals: at his feet, the ball is drawn over his boots.
    ...(w.dog?.carrying ? [] : [{ z: w.ball.z, draw: (g: CanvasRenderingContext2D) => drawBall(g, w, cam, art) }]),
  ];
}

/** A 12×2 bar over a charging player, with the sweet spot marked in gold and a red flash when overcharged. */
function drawChargeBar(g: CanvasRenderingContext2D, cam: Camera, p: Player, nowS: number): void {
  const charging = p.state === 'charging' || (p.state === 'chipping' && !p.kick);
  if (!charging) return;
  const s = screen(cam, p.x, p.y, p.z);
  const x = s.x - CHARGE_BAR.w / 2;
  const y = s.y - CHARGE_BAR.above;
  ink(g, 'outline');
  g.fillRect(x - 1, y - 1, CHARGE_BAR.w + 2, CHARGE_BAR.h + 2);
  ink(g, 'gold');
  g.fillRect(x + Math.round(SWEET_SPOT[0] * CHARGE_BAR.w), y, Math.max(1, Math.round((SWEET_SPOT[1] - SWEET_SPOT[0]) * CHARGE_BAR.w)), CHARGE_BAR.h);
  const flash = p.overchargeS > 0 && Math.floor(nowS * BLINK_HZ) % 2 === 0;
  ink(g, flash ? 'red' : 'white');
  g.fillRect(x, y, Math.round(p.charge * CHARGE_BAR.w), 1);
}

function drawText(g: CanvasRenderingContext2D, art: GameArt, s: string, cx: number, y: number, scale = 1, colour: MasterColor = 'white'): void {
  const t = art.text(s, scale, colour, 'outline');
  g.drawImage(t, Math.round(cx - t.width / 2), y);
}

/** The score, clock, stamina bar and POWER meter, laid out in a hudW-wide HUD. */
function drawHud(g: CanvasRenderingContext2D, w: World, hudW: number, art: GameArt, nowS: number, awayName: string): void {
  const { match, home } = w;
  const cx = hudW / 2;
  drawText(g, art, `${HOME_NAME} ${match.score.home}-${match.score.away} ${awayName}`, cx, 0);
  const clock = clockText(match);
  drawText(g, art, clock.text, cx, 7, 1, clock.golden ? 'energyGold' : 'white');

  ink(g, 'outline');
  g.fillRect(STAMINA_BAR.x - 1, STAMINA_BAR.y - 1, STAMINA_BAR.w + 2, STAMINA_BAR.h + 2);
  ink(g, home.exhausted ? 'red' : 'volt');
  g.fillRect(STAMINA_BAR.x, STAMINA_BAR.y, Math.round(home.stamina * STAMINA_BAR.w), STAMINA_BAR.h);
  if (w.power) drawPowerMeter(g, art, w.power.meter, powerHint(w), nowS, hudW);
}

/** The banner over the pitch, if any: GOAL!!! for Harrison's goal moment, a smaller MAX SCORES (or BISCUIT SCORES) for the other side's. */
export function banner(w: World, moment: GoalMoment | null, awayName: string): { text: string; scale: number } | null {
  const m = w.match;
  const text = (t: string) => ({ text: t, scale: 2 });
  if (moment) return bannerShown(moment) ? { text: 'GOAL!!!', scale: 3 } : null;
  if (m.phase === 'goal') return m.lastScorer === 'away' ? text(`${awayName} SCORES`) : null;
  if (m.phase === 'fullTime') return text('FULL TIME');
  if (m.phase === 'kickoff') return text(m.goldenGoal ? 'GOLDEN GOAL' : 'KICK OFF');
  if (m.goldenGoal && m.goldenS < GOLDEN_GOAL_BANNER_S) return text('GOLDEN GOAL');
  return null;
}

/** The callout naming Harrison's goal, once it's time to show it. */
export function calloutLine(hud: MatchHud): string | null {
  return hud.moment && hud.callout && hud.moment.t >= CALLOUT.fromS ? hud.callout : null;
}

/** GOAL!!! slams in at a bigger scale, then drops in and bounces to rest. */
function drawGoalBanner(g: CanvasRenderingContext2D, hudW: number, art: GameArt, moment: GoalMoment, scale: number): void {
  const s = moment.t - BANNER_FROM_S;
  const cx = hudW / 2;
  if (s < GOAL_SLAM.forS) return drawText(g, art, 'GOAL!!!', cx, BANNER_Y - 4, GOAL_SLAM.scale, 'energyGold');
  const settle = Math.min(1, (s - GOAL_SLAM.forS) / GOAL_SLAM.settleS);
  const bounce = Math.round(GOAL_SLAM.bouncePx * Math.sin(settle * Math.PI) * (1 - settle));
  drawText(g, art, 'GOAL!!!', cx, BANNER_Y + bounce, scale, 'energyGold');
}

/** Where the off-screen ball arrow goes in the HUD, if the ball is over the top: under the ball, kept clear of the POWER meter when it's shown. */
export function arrowX(w: World, cam: Camera): number | null {
  const arrow = offscreenArrow(w.ball, cam);
  if (!arrow) return null;
  const view = viewOf(cam);
  const hudW = hudSize(view).w;
  const right = w.power ? powerMeterX0(hudW) - ARROW_CLEARANCE : hudW - 4;
  return Math.round(Math.min(Math.max(arrow.x / view.hudScale, 3), right));
}

/** Harrison off the side of the screen: which edge, his row in HUD-layer px, and how far off in chevrons (1 to 3). Null while he's in view. */
export function homeMarker(w: World, cam: Camera): { side: 'left' | 'right'; y: number; chevrons: number } | null {
  const view = viewOf(cam);
  const p = project(w.home.x, w.home.y, w.home.z, cam);
  const off = p.sx < 0 ? -p.sx : p.sx > view.w ? p.sx - view.w : 0;
  if (off === 0) return null;
  const h = hudSize(view).h;
  const y = Math.round(Math.min(Math.max((p.sy - MARKER.rise) / view.hudScale, MARKER.top), h - MARKER.bottom));
  return { side: p.sx < 0 ? 'left' : 'right', y, chevrons: off > MARKER_FAR[1] ? 3 : off > MARKER_FAR[0] ? 2 : 1 };
}

/** A chevron's pixels from its tip, pointing out: the tip, then an arm each way. */
const CHEVRON: readonly (readonly [back: number, dy: number])[] = [[0, 0], [1, -1], [1, 1], [2, -2], [2, 2]];

/** Gold chevrons at the screen's edge pointing the way to Harrison, one more the further off he is. */
function drawHomeMarker(g: CanvasRenderingContext2D, w: World, cam: Camera, hudW: number): void {
  const m = homeMarker(w, cam);
  if (!m) return;
  // Each arm pixel sits `back` px inward from the tip; the tip points at the edge.
  const inward = m.side === 'left' ? 1 : -1;
  for (let i = 0; i < m.chevrons; i++) {
    const tip = m.side === 'left' ? MARKER.inset + i * MARKER.step : hudW - 1 - MARKER.inset - i * MARKER.step;
    ink(g, 'outline');
    for (const [back, dy] of CHEVRON) g.fillRect(tip + inward * back - 1, m.y + dy - 1, 3, 3);
    ink(g, 'energyGold');
    for (const [back, dy] of CHEVRON) g.fillRect(tip + inward * back, m.y + dy, 1, 1);
  }
}

function drawArrow(g: CanvasRenderingContext2D, w: World, cam: Camera): void {
  const x = arrowX(w, cam);
  if (x === null) return;
  ink(g, 'outline');
  g.fillRect(x - 3, ARROW_Y - 1, 7, 4);
  ink(g, 'white');
  g.fillRect(x - 2, ARROW_Y, 5, 1);
  g.fillRect(x - 1, ARROW_Y + 1, 3, 1);
  g.fillRect(x, ARROW_Y + 2, 1, 1);
}

/** The bigger of the goal moment's shake and the power shake: they never add up past the goal moment's own. */
function pitchShake(w: World, hud: MatchHud, nowS: number): { dx: number; dy: number } {
  const goal = hud.moment ? shakeOffset(hud.moment) : { dx: 0, dy: 0 };
  const power = shakeFor(w.power, hud, nowS);
  const size = (s: { dx: number; dy: number }) => Math.max(Math.abs(s.dx), Math.abs(s.dy));
  return size(power) > size(goal) ? power : goal;
}

/** An impact frame: the pitch in white, with the players and ball as dark silhouettes. */
function drawImpact(g: CanvasRenderingContext2D, w: World, cam: Camera, art: GameArt, home: Clip, look: HomeLook, away: SpriteSet, keepers: MatchHud['keeperSprites'] = null): void {
  const view = viewOf(cam);
  ink(g, 'white');
  g.fillRect(-8, -8, view.w + 16, view.h + 16);
  if (keepers) for (const d of keeperDrawables(w, cam, keepers, look.nowS, true)) d.draw(g);
  drawAway(g, cam, w, art, look.nowS, away, true);
  drawHome(g, cam, w.home, art, home, look, true);
  if (!w.dog?.carrying) drawBall(g, w, cam, art, true);
}

/** The layer a doubled HUD is drawn into before it's scaled onto the match canvas; null when the HUD draws at 1×. */
export function createHudLayer(view: View): CanvasRenderingContext2D | null {
  if (view.hudScale === 1) return null;
  const { w, h } = hudSize(view);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.imageSmoothingEnabled = false;
  return g;
}

/**
 * Draws one frame of the match: scenery, shadows, then everything on the
 * pitch far to near, the wave, bars, HUD and banners. During Harrison's
 * goal moment the pitch shakes (the HUD doesn't), and the first frame
 * flashes white; a power-up and a wave shake it too, and a fired wave
 * shows a couple of impact frames. The pitch, its effects and the callouts
 * over a player go on `g` at native size; the HUD goes on `overlay`, laid
 * out in hudSize(view) (the same canvas, at 1×, unless the HUD is doubled).
 */
export function drawMatch(g: CanvasRenderingContext2D, w: World, cam: Camera, art: GameArt, nowS: number, hud: MatchHud, overlay: CanvasRenderingContext2D = g): void {
  const { moment } = hud;
  const view = viewOf(cam);
  const hudW = hudSize(view).w;
  const shake = pitchShake(w, hud, nowS);
  // Decided before this frame uses up an impact frame, so the flash comes on the frame after the last one.
  const flash = takeFlash(hud);
  const home = homeClip(w, moment);
  const look: HomeLook = { set: homeSprites(w, hud), aura: auraStrength(w, hud, nowS), nowS, fx: hud.fx };
  g.save();
  g.translate(shake.dx, shake.dy);
  // The bleachers cheer through Harrison's goal moment, as the roar does.
  drawLayers(g, cam, art, hud.venue, nowS, moment !== null);
  if (!w.dog?.carrying) drawShadow(g, cam, w.ball.x, w.ball.z);
  drawShadow(g, cam, w.away.x, w.away.z, w.dog ? DOG_SHADOW_W : SHADOW_W);
  drawShadow(g, cam, w.home.x, w.home.z);
  drawKeeperShadows(g, cam, w);
  drawSkid(g, cam, w.away);
  drawTrail(g, cam, hud.trail);
  for (const d of depthSorted(pitchDrawables(w, cam, art, home, look, hud.awaySprites, hud.keeperSprites ?? null))) d.draw(g);
  drawTrickMarks(g, cam, w, art, nowS);
  if (w.wave) {
    drawBeam(g, cam, w.wave, nowS);
    // Braced, he stands in front of the beam's broken end.
    if (w.wave.outcome === 'braced' && w.away.state === 'bracing') drawAway(g, cam, w, art, nowS, hud.awaySprites);
  }
  if (hud.impactFrames > 0) {
    drawImpact(g, w, cam, art, home, look, hud.awaySprites, hud.keeperSprites);
    hud.impactFrames--;
  }
  drawChargeBar(g, cam, w.away, nowS);
  drawChargeBar(g, cam, w.home, nowS);
  drawPowerBar(g, cam, w.home, w.power?.activeS ?? 0);
  g.restore();
  if (flash) {
    g.save();
    g.globalAlpha = FLASH_ALPHA;
    ink(g, 'white');
    g.fillRect(0, 0, view.w, view.h);
    g.restore();
  }
  drawHud(overlay, w, hudW, art, nowS, hud.awayName);
  drawHomeMarker(overlay, w, cam, hudW);
  if (hud.perfect && nowS < hud.perfect.untilS) {
    const kicker = hud.perfect.team === 'home' ? w.home : w.away;
    const at = screen(cam, kicker.x, kicker.y, kicker.z);
    drawText(g, art, 'PERFECT', at.x, at.y - 56, 1, 'energyGold');
  }
  if (hud.trickCallout && !moment) {
    const at = screen(cam, w.home.x, w.home.y, w.home.z);
    drawText(g, art, hud.trickCallout, at.x, at.y + PROMPT_Y, 1);
  }
  const prompt = powerPrompt(w);
  if (prompt) {
    const at = screen(cam, w.home.x, w.home.y, w.home.z);
    drawText(g, art, prompt, at.x, at.y + PROMPT_Y, 1, Math.floor(nowS * PROMPT_BLINK_HZ) % 2 === 0 ? 'energyGold' : 'white');
  }
  const b = banner(w, moment, hud.awayName);
  if (b && moment) drawGoalBanner(overlay, hudW, art, moment, b.scale);
  else if (b) drawText(overlay, art, b.text, hudW / 2, BANNER_Y, b.scale);
  const callout = calloutLine(hud);
  if (callout) drawText(overlay, art, callout, hudW / 2, BANNER_Y + CALLOUT.gapPx, 2);
  // Under the banner line, so it sits clear of FULL TIME or KICK OFF.
  else if (hud.bonusCallout) drawText(overlay, art, hud.bonusCallout, hudW / 2, BANNER_Y + CALLOUT.gapPx, 2, 'energyGold');
  drawArrow(overlay, w, cam);
}
