import { ANCHOR } from '../art/body/pose';
import { M, MASTER, masterPalette, type MasterColor, type ResolvedPalette } from '../art/colors';
import { BALL_REST_Y } from '../game/ball';
import { project, viewOf, type Camera } from '../game/camera';
import { BRACE_S, BRACE_SKID_SPEED, type Player } from '../game/player';
import { POWERED_S, WAVE_READY_S, waveReady, type PowerState } from '../game/power';
import { WAVE_LINGER_S, type Wave } from '../game/wave';
import type { World } from '../game/world';
import type { GameArt, HomeSet } from './art';
import type { MatchHud } from './matchView';

/**
 * The Energy Wave's effects: the POWER meter, the aura while he's powered
 * up, the beam, the brace's splash and skid, the shake and the impact-frame
 * silhouettes. Pure drawing, off the sim's state and the HUD's.
 */

/** Top right, mirroring the stamina bar: the label, the bar under it, the Y button beside it. */
const METER = { right: 316, labelY: 1, barX: 272, barY: 10, barW: 44, barH: 5, glyphX: 259, glyphY: 6 };
/** The meter's left edge: anything else in the top right keeps left of it. */
export const POWER_METER_X0 = METER.glyphX - 1;
const DIM_ALPHA = 0.35;
/** The bright pulse running along a full bar: px/s, and how long it is. */
const PULSE = { speed: 40, len: 3 };
/** The gold power-up bar, counting down his time, sits where the shot-charge bar does. */
const POWER_BAR = { w: 12, h: 2, above: 46 };
/** The aura's rings, innermost first, by form. */
const AURA_RINGS: Record<'base' | 'golden', readonly MasterColor[]> = {
  base: ['auraWhite', 'white', 'silver'],
  golden: ['auraWhite', 'energyGoldLight', 'energyGold', 'goldDark'],
};
/** Each ring also licks this far further upward, flickering between the two. */
const AURA_LIFT = [1, 2] as const;
const AURA_FLICKER_HZ = 12;
/** Flame tongues above his head: how many, how tall at most, and how fast they lick. */
const TONGUES = { count: 5, maxPx: 8, hz: 14 };
/** The glow pool at his feet, at full strength. */
const POOL_W = 22;
/** In its last moments the power-up's aura flickers, so he can see it's about to run out. */
const ENDING_S = 0.6;
const ENDING_FLICKER_HZ = 10;
const ENDING_DIM = 0.4;
/** While the wave readies, the aura grows from this to full. */
const READYING_FROM = 0.3;
/** The beam's band, in px either side of its centre line, which runs this high over the grass. */
const BEAM = { centreY: 14, edge: 8, light: 4, core: 1, wobbleHz: 5 };
const ORB_R = { origin: 5, head: 7 };
const SHOCKWAVE = { s: 0.2, fromR: 4, toR: 26, squash: 0.5 };
const SPEED_LINES = { count: 9, speedPx: 900, len: 28, alpha: 0.5 };
const SPLASH = { rays: 7, spreadRad: 1.3, minLen: 6, maxLen: 13, hz: 20 };
const DUST = { count: 6, risePx: 6 };

/** The shakes the scene sets on a fired wave and a brace. */
export const WAVE_SHAKE = { px: 4, s: 0.3 };
export const BRACE_SHAKE = { px: 2, s: 0.2 };
/** Every shake comes from this pattern, a step per 1/30 s; the x step is always a full one. */
const SHAKE_PATTERN: readonly [number, number][] = [
  [1, 0],
  [-1, 1],
  [1, -1],
  [-1, 0],
];
const SHAKE_HZ = 30;

const ink = (g: CanvasRenderingContext2D, c: MasterColor) => (g.fillStyle = MASTER[c]);
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
/** A fixed pseudo-random 0..1 per index, so effects look scattered but never change between frames. */
const scatter = (i: number, salt: number) => {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function screen(cam: Camera, x: number, y: number, z: number): { x: number; y: number } {
  const p = project(x, y, z, cam);
  return { x: Math.round(p.sx), y: Math.round(p.sy) };
}

const poweredUp = (w: World): boolean => (w.power?.activeS ?? 0) > 0;

/** Which of Harrison's sprite sets to draw: the power heads while powered up and striking, gold in Golden Form and its celebration. */
export function homeSprites(w: World, hud: MatchHud): HomeSet {
  if (hud.goldenCelebration) return 'homeGolden';
  if (!poweredUp(w) && w.home.state !== 'unleashing') return 'home';
  return w.power?.golden ? 'homeGolden' : 'homePower';
}

/** How strongly his aura burns, 0..1, or 0 for none: building while the wave readies, full once it's ready, flickering in its last moments. */
export function auraStrength(w: World, hud: MatchHud, nowS: number): number {
  if (hud.goldenCelebration || w.home.state === 'unleashing') return 1;
  const left = w.power?.activeS ?? 0;
  if (left <= 0) return 0;
  if (!waveReady(w.power!)) return READYING_FROM + (1 - READYING_FROM) * ((POWERED_S - left) / WAVE_READY_S);
  if (left > ENDING_S) return 1;
  return Math.floor(nowS * ENDING_FLICKER_HZ * 2) % 2 === 0 ? 1 : ENDING_DIM;
}

/** What to tell him over his head: once the wave is ready, his next kick fires it. */
export function powerPrompt(w: World): string | null {
  return w.power && waveReady(w.power) ? 'SHOOT!' : null;
}

/** The pitch's power shake in whole pixels: the scene's fired-wave and brace shakes. */
export function shakeFor(power: PowerState | null, hud: MatchHud, nowS: number): { dx: number; dy: number } {
  if (!power || !hud.shake || nowS >= hud.shake.untilS) return { dx: 0, dy: 0 };
  const px = hud.shake.px;
  const [x, y] = SHAKE_PATTERN[Math.floor(nowS * SHAKE_HZ) % SHAKE_PATTERN.length]!;
  return { dx: x * px, dy: y * Math.round(px / 2) };
}

export function drawPowerMeter(g: CanvasRenderingContext2D, art: GameArt, meter: number, hint: 'none' | 'lit' | 'dim', nowS: number): void {
  const label = art.text('POWER', 1, 'energyGold', 'outline');
  g.drawImage(label, METER.right - label.width, METER.labelY);
  const { barX: x, barY: y, barW: w, barH: h } = METER;
  ink(g, 'outline');
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const fill = Math.round(clamp01(meter) * w);
  ink(g, 'energyGold');
  g.fillRect(x, y, fill, h);
  ink(g, 'energyGoldLight');
  g.fillRect(x, y, fill, 1);
  if (meter >= 1) {
    ink(g, 'auraWhite');
    const at = Math.floor((nowS * PULSE.speed) % (w + PULSE.len)) - PULSE.len;
    const [from, to] = [Math.max(at, 0), Math.min(at + PULSE.len, w)];
    if (to > from) g.fillRect(x + from, y, to - from, h);
  }
  if (hint === 'none') return;
  g.globalAlpha = hint === 'dim' ? DIM_ALPHA : 1;
  g.drawImage(art.buttons.Y, METER.glyphX, METER.glyphY);
  g.globalAlpha = 1;
}

let palette: ResolvedPalette | null = null;
const auras = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/**
 * The aura for one sprite frame: rings dilated out from his silhouette,
 * each reaching `lift` px further upward than sideways so it licks up
 * like a flame. Baked once per frame, form and lift.
 */
function auraFor(frame: HTMLCanvasElement, form: 'base' | 'golden', lift: number): HTMLCanvasElement {
  const key = `${form}/${lift}`;
  const cached = auras.get(frame)?.get(key);
  if (cached) return cached;
  const rings = AURA_RINGS[form];
  const n = rings.length;
  const [pad, top] = [n, n * (1 + lift)];
  const [w, h] = [frame.width + 2 * pad, frame.height + pad + top];
  const src = frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height).data;
  let mask = new Uint8Array(w * h);
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) mask[(y + top) * w + x + pad] = src[(y * frame.width + x) * 4 + 3]! > 0 ? 1 : 0;
  const ring = new Uint8Array(w * h);
  for (let r = 1; r <= n; r++) {
    const next = mask.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) continue;
        const on = (dx: number, dy: number) => x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && mask[(y + dy) * w + x + dx] === 1;
        let hit = on(1, 0) || on(-1, 0) || on(0, 1) || on(0, -1);
        for (let d = 2; d <= 1 + lift && !hit; d++) hit = on(0, d);
        if (hit) {
          next[y * w + x] = 1;
          ring[y * w + x] = r;
        }
      }
    }
    mask = next;
  }
  palette ??= masterPalette();
  const rgba = new Uint8ClampedArray(w * h * 4) as Uint8ClampedArray<ArrayBuffer>;
  ring.forEach((r, i) => {
    if (!r) return;
    const [cr, cg, cb] = palette![M[rings[r - 1]!]]!;
    rgba.set([cr, cg, cb, 255], i * 4);
  });
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [w, h];
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, w, h), 0, 0);
  if (!auras.has(frame)) auras.set(frame, new Map());
  auras.get(frame)!.set(key, canvas);
  return canvas;
}

/** His aura behind `frame` (the sprite drawn for him this frame): rings, flame tongues over his head and a glow pool at his feet. */
export function drawAura(g: CanvasRenderingContext2D, cam: Camera, p: Player, frame: HTMLCanvasElement, golden: boolean, strength: number, nowS: number): void {
  if (strength <= 0) return;
  const form = golden ? 'golden' : 'base';
  const lift = AURA_LIFT[Math.floor(nowS * AURA_FLICKER_HZ) % AURA_LIFT.length]!;
  const aura = auraFor(frame, form, lift);
  const n = AURA_RINGS[form].length;
  const s = screen(cam, p.x, p.y, p.z);
  const [left, topY] = [s.x - ANCHOR.x - n, s.y - ANCHOR.y - n * (1 + lift)];
  g.globalAlpha = 0.35 + 0.65 * strength;
  g.drawImage(aura, left, topY);
  // Flame tongues licking up from the top of the aura.
  ink(g, golden ? 'energyGoldLight' : 'white');
  const headTop = s.y - ANCHOR.y + 2;
  for (let i = 0; i < TONGUES.count; i++) {
    const x = s.x - 6 + Math.round((i * 12) / (TONGUES.count - 1));
    const lick = 0.5 + 0.5 * Math.sin(nowS * TONGUES.hz + i * 1.7);
    const len = Math.round(TONGUES.maxPx * strength * lick);
    if (len > 0) g.fillRect(x, headTop - len, 1, len);
  }
  // The glow pool at his feet.
  const pool = Math.round(POOL_W * strength);
  ink(g, golden ? 'energyGold' : 'silver');
  g.globalAlpha = 0.5 * strength;
  g.fillRect(s.x - Math.floor(pool / 2), s.y - 1, pool, 3);
  ink(g, 'auraWhite');
  g.fillRect(s.x - Math.floor(pool / 4), s.y, Math.floor(pool / 2), 1);
  g.globalAlpha = 1;
}

/** The gold bar over him while he's powered up, counting down the time he has left to fire. */
export function drawPowerBar(g: CanvasRenderingContext2D, cam: Camera, p: Player, activeS: number): void {
  if (activeS <= 0) return;
  const s = screen(cam, p.x, p.y, p.z);
  const [x, y] = [s.x - POWER_BAR.w / 2, s.y - POWER_BAR.above];
  const left = Math.ceil((activeS / POWERED_S) * POWER_BAR.w);
  ink(g, 'outline');
  g.fillRect(x - 1, y - 1, POWER_BAR.w + 2, POWER_BAR.h + 2);
  ink(g, 'energyGold');
  g.fillRect(x, y, left, POWER_BAR.h);
  ink(g, 'energyGoldLight');
  g.fillRect(x, y, left, 1);
}

/** A filled disc of whole pixels. */
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy + r));
    g.fillRect(cx - half, cy + dy, 2 * half + 1, 1);
  }
}

/** A glowing orb: electric rim, light body, white heart. */
function orb(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ink(g, 'electric');
  disc(g, cx, cy, r);
  ink(g, 'electricLight');
  disc(g, cx, cy, r - 2);
  ink(g, 'white');
  disc(g, cx, cy, Math.max(1, r - 4));
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= steps; k++) g.fillRect(Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps), 1, 1);
}

/**
 * The Energy Wave: a huge blue-white band from his boot to its head, with a
 * wavy electric edge, a light band and a white core, the same in every
 * form. An orb glows at each end while it's live, a shockwave ring spreads
 * from his boot as it fires, and speed lines streak past. A braced wave
 * breaks in a splash of rays at Max's hands. It fades once it ends.
 */
export function drawBeam(g: CanvasRenderingContext2D, cam: Camera, wave: Wave, nowS: number): void {
  const alpha = wave.live ? 1 : clamp01(1 - wave.fadeS / WAVE_LINGER_S);
  if (alpha <= 0) return;
  const y = BALL_REST_Y + BEAM.centreY;
  const a = screen(cam, wave.originX, y, wave.originZ);
  const b = screen(cam, wave.endX, y, wave.endZ);
  g.globalAlpha = alpha;
  const steps = Math.abs(b.x - a.x);
  const step = Math.sign(b.x - a.x) || 1;
  for (let k = 0; k <= steps; k++) {
    const x = a.x + k * step;
    const cy = Math.round(a.y + ((b.y - a.y) * k) / Math.max(steps, 1));
    const up = BEAM.edge + Math.round(Math.sin(x * 0.7 + nowS * BEAM.wobbleHz * 6));
    const down = BEAM.edge + Math.round(Math.sin(x * 0.9 - nowS * BEAM.wobbleHz * 5));
    ink(g, 'electric');
    g.fillRect(x, cy - up, 1, up + down + 1);
    ink(g, 'electricLight');
    g.fillRect(x, cy - BEAM.light, 1, 2 * BEAM.light + 1);
    ink(g, 'white');
    g.fillRect(x, cy - BEAM.core, 1, 2 * BEAM.core + 1);
  }
  if (wave.live) {
    orb(g, a.x, a.y, ORB_R.origin);
    g.globalAlpha = 0.75;
    orb(g, b.x, b.y, ORB_R.head);
    g.globalAlpha = 1;
    drawSpeedLines(g, cam, nowS);
  }
  if (wave.ageS < SHOCKWAVE.s) {
    const t = wave.ageS / SHOCKWAVE.s;
    const r = SHOCKWAVE.fromR + (SHOCKWAVE.toR - SHOCKWAVE.fromR) * t;
    const feet = screen(cam, wave.originX, 0, wave.originZ);
    g.globalAlpha = alpha * (1 - t);
    ink(g, 'white');
    for (let k = 0; k < 48; k++) {
      const th = (k / 48) * Math.PI * 2;
      g.fillRect(Math.round(feet.x + r * Math.cos(th)), Math.round(feet.y - 6 + r * SHOCKWAVE.squash * Math.sin(th)), 1, 1);
    }
  }
  if (wave.outcome === 'braced') {
    // Rays thrown back the way the beam came, flickering in length.
    const back = wave.dirX >= 0 ? Math.PI : 0;
    g.globalAlpha = alpha;
    for (let k = 0; k < SPLASH.rays; k++) {
      const th = back + (k / (SPLASH.rays - 1) - 0.5) * 2 * SPLASH.spreadRad;
      const flick = 0.5 + 0.5 * Math.sin(nowS * SPLASH.hz + k * 2.1);
      const len = SPLASH.minLen + (SPLASH.maxLen - SPLASH.minLen) * flick;
      ink(g, k % 2 ? 'electricLight' : 'white');
      line(g, b.x, b.y, b.x + Math.cos(th) * len, b.y + Math.sin(th) * len);
    }
  }
  g.globalAlpha = 1;
}

/** White streaks racing across the screen while the wave is live. */
function drawSpeedLines(g: CanvasRenderingContext2D, cam: Camera, nowS: number): void {
  g.globalAlpha = SPEED_LINES.alpha;
  ink(g, 'white');
  for (let i = 0; i < SPEED_LINES.count; i++) {
    const y = 24 + Math.floor(scatter(i, 5) * 130);
    const span = viewOf(cam).w + SPEED_LINES.len;
    const x = Math.floor((nowS * SPEED_LINES.speedPx * (0.7 + scatter(i, 6) * 0.6) + scatter(i, 7) * span) % span) - SPEED_LINES.len;
    g.fillRect(x, y, SPEED_LINES.len, 1);
  }
  g.globalAlpha = 1;
}

/** A braced player's skid marks in the grass behind his feet, with dust kicked off his heels. */
export function drawSkid(g: CanvasRenderingContext2D, cam: Camera, p: Player): void {
  if (p.state !== 'bracing') return;
  const t = Math.min(p.stateT, BRACE_S);
  const skid = BRACE_SKID_SPEED * (t - (t * t) / (2 * BRACE_S));
  // He faces the beam and skids the other way, so the marks run from in front of him back to his heels.
  const from = screen(cam, p.x + p.facing * skid, 0, p.z);
  const to = screen(cam, p.x, 0, p.z);
  ink(g, 'grassDark');
  for (const dz of [-1, 1]) line(g, from.x, from.y + dz, to.x, to.y + dz);
  if (p.stateT >= BRACE_S) return;
  ink(g, 'silver');
  for (let i = 0; i < DUST.count; i++) {
    const rise = Math.round(scatter(i, 8) * DUST.risePx * (p.stateT / BRACE_S + 0.3));
    g.globalAlpha = 0.8 * (1 - p.stateT / BRACE_S);
    g.fillRect(to.x - p.facing * (2 + Math.round(scatter(i, 9) * 6)), to.y - rise, 1, 1);
  }
  g.globalAlpha = 1;
}

const silhouettes = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** A sprite as a flat outline-coloured silhouette, for the impact frames. Baked once per sprite. */
export function silhouette(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const cached = silhouettes.get(sprite);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [sprite.width, sprite.height];
  const g = canvas.getContext('2d')!;
  g.drawImage(sprite, 0, 0);
  g.globalCompositeOperation = 'source-in';
  ink(g, 'outline');
  g.fillRect(0, 0, canvas.width, canvas.height);
  silhouettes.set(sprite, canvas);
  return canvas;
}
