import type { AnimName } from '../art/body/animations';
import { MASTER } from '../art/colors';
import type { KeeperId } from '../art/keepers/keepers';
import { DIVE_FRAMES, KEEPER_POSE_FPS, KEEPER_POSE_FRAMES, type KeeperPose } from '../art/keepers/poses';
import { project, type Camera } from '../game/camera';
import { CLAP_S, type Keeper } from '../game/keeper';
import { PLAYER_R, radiusOf } from '../game/player';
import type { World } from '../game/world';
import type { CareerMatch } from '../meta/career';
import type { KeeperSprites } from './art';
import type { Drawable } from './depthSort';
import { silhouette } from './powerView';

export type KeeperFrame =
  | { kind: 'body'; name: AnimName; frame: number }
  | { kind: 'pose'; name: KeeperPose; frame: number }
  | { kind: 'dive'; toward: 'far' | 'near'; frame: number };

/** Faster than this, px/s, a set keeper is shuffling across. */
const SHUFFLE_SPEED = 5;
/** A standing catch's or push's pose shows this long (keeper.ts's POSE_S). */
const POSE_S = 0.25;
/** How high his dive lifts him off the grass at its peak, px. */
const DIVE_LIFT = 4;
/** A standing keeper's shadow is this wide, and grows 2 px for each px of radius past PLAYER_R. */
const SHADOW_W = 5;
/** Lying along a dive or a smother, his shadow is a strip this long, in proportion to his radius over PLAYER_R. */
const LYING_SHADOW = 14;

export { CLAP_S };

const looping = (name: KeeperPose, nowS: number): KeeperFrame => ({ kind: 'pose', name, frame: Math.floor(Math.max(0, nowS) * KEEPER_POSE_FPS[name]) % KEEPER_POSE_FRAMES[name] });
/** A frame through `name` as `u` runs 0..1. */
const through = (name: KeeperPose, u: number): KeeperFrame => ({ kind: 'pose', name, frame: Math.min(KEEPER_POSE_FRAMES[name] - 1, Math.floor(Math.max(0, u) * KEEPER_POSE_FRAMES[name])) });
const smothering = (k: Keeper): boolean => k.dive !== null && Math.abs(k.dive.dirX) > Math.abs(k.dive.dirZ);
const towardOf = (k: Keeper): 'far' | 'near' => ((k.dive?.dirZ ?? 0) > 0 ? 'far' : 'near');

/** What a keeper shows this frame, by his act. */
export function keeperFrame(k: Keeper, nowS: number): KeeperFrame {
  const { body, profile } = k;
  // Blown, or fooled on his feet, his body's clip shows; a fooled keeper's wrong-way dive shows as a dive.
  const onFeet = k.act === 'set' || k.act === 'rush';
  if (body.state === 'blown' || (body.fooled && onFeet)) return { kind: 'body', name: body.anim.name, frame: body.anim.frame };
  switch (k.act) {
    case 'dive': {
      // Launch, then full stretch, over the dive.
      const frame = k.actT / profile.diveS < 0.5 ? 0 : 1;
      return smothering(k) ? { kind: 'pose', name: 'smother', frame } : { kind: 'dive', toward: towardOf(k), frame };
    }
    case 'down':
      return smothering(k) ? { kind: 'pose', name: 'smother', frame: KEEPER_POSE_FRAMES.smother - 1 } : { kind: 'dive', toward: towardOf(k), frame: DIVE_FRAMES - 1 };
    case 'getUp':
      return through('getUp', k.actT / profile.getUpS);
    case 'hold':
      if (k.pose?.name === 'catch') return through('catch', 1 - k.pose.leftS / POSE_S);
      // Goalie Gus's clap, after any catch pose.
      if (k.pose?.name === 'clap') return through('clap', 1 - k.pose.leftS / CLAP_S);
      return looping('hold', nowS);
    case 'kick':
      return through('dropKick', (k.actT * KEEPER_POSE_FPS.dropKick) / KEEPER_POSE_FRAMES.dropKick);
    case 'set':
      if (k.pose?.name === 'push') return through('push', 1 - k.pose.leftS / POSE_S);
      return looping(Math.hypot(body.vx, body.vz) > SHUFFLE_SPEED ? 'shuffle' : 'ready', nowS);
    case 'rush':
      return { kind: 'body', name: body.anim.name, frame: body.anim.frame };
  }
}

/** Eddie in Harrison's goal; Gus in his own match; else backup A on odd tryouts, backup B on even ones. */
export function keeperLooks(m: Pick<CareerMatch, 'kind' | 'rung' | 'opponent'>): { home: KeeperId; away: KeeperId } {
  if (m.opponent === 'gus') return { home: 'eddie', away: 'gus' };
  return { home: 'eddie', away: m.kind !== 'boss' && m.rung % 2 === 1 ? 'backupA' : 'backupB' };
}

/** Draws one keeper; a dark silhouette for an impact frame when `flat`. */
function drawKeeper(g: CanvasRenderingContext2D, cam: Camera, k: Keeper, sprites: KeeperSprites, nowS: number, flat: boolean): void {
  const { body } = k;
  const f = keeperFrame(k, nowS);
  const right = body.facing === 1;
  const pick = (frames: readonly HTMLCanvasElement[], i: number) => frames[Math.min(i, frames.length - 1)]!;
  const draw = (img: HTMLCanvasElement, x: number, y: number, z: number, anchor: { x: number; y: number }) => {
    const s = project(x, y, z, cam);
    g.drawImage(flat ? silhouette(img) : img, Math.round(s.sx) - anchor.x, Math.round(s.sy) - anchor.y);
  };
  if (f.kind === 'dive') {
    const d = sprites.dives[f.toward];
    const lift = k.act === 'dive' ? DIVE_LIFT * Math.sin((Math.PI * k.actT) / k.profile.diveS) : 0;
    draw(pick(right ? d.right : d.left, f.frame), body.x, lift, body.z, right ? d.anchor.right : d.anchor.left);
    return;
  }
  const frames = f.kind === 'pose' ? sprites.poses[f.name] : { right: sprites.body.right[f.name], left: sprites.body.left[f.name] };
  draw(pick(right ? frames.right : frames.left, f.frame), body.x, body.y, body.z, sprites.anchor);
}

/** Both keepers, to be depth-sorted with everyone else on the pitch. */
export function keeperDrawables(w: World, cam: Camera, sprites: { home: KeeperSprites; away: KeeperSprites }, nowS: number, flat = false): Drawable[] {
  const ks = w.keepers;
  if (!ks) return [];
  return [ks.home, ks.away].map(k => ({ z: k.body.z, draw: (g: CanvasRenderingContext2D) => drawKeeper(g, cam, k, sprites[k.side], nowS, flat) }));
}

/** A 5×1 patch under a standing keeper (wider under Gus); a strip along his length in a dive or lying down. */
export function drawKeeperShadows(g: CanvasRenderingContext2D, cam: Camera, w: World): void {
  const ks = w.keepers;
  if (!ks) return;
  g.fillStyle = MASTER.grassDark;
  for (const k of [ks.home, ks.away]) {
    const { body } = k;
    const r = radiusOf(body);
    const lying = (k.act === 'dive' || k.act === 'down') && k.dive !== null;
    if (!lying) {
      const s = project(body.x, 0, body.z, cam);
      const width = SHADOW_W + 2 * (r - PLAYER_R);
      g.fillRect(Math.round(s.sx) - Math.floor(width / 2), Math.round(s.sy) + 1, width, 1);
      continue;
    }
    const { dirX, dirZ } = k.dive!;
    const len = Math.hypot(dirX, dirZ) || 1;
    const strip = Math.round((LYING_SHADOW * r) / PLAYER_R);
    // His hips are on his ground point: the strip runs a little back over his legs and on along his arms.
    for (let i = -strip / 2; i <= strip; i++) {
      const s = project(body.x + (dirX / len) * i, 0, body.z + (dirZ / len) * i, cam);
      g.fillRect(Math.round(s.sx) - 1, Math.round(s.sy) + 1, 3, 1);
    }
  }
}
