import { BISCUIT_ANCHOR, BISCUIT_FPS, BISCUIT_FRAMES, type DogAnim } from '../art/opponents/biscuit';
import { project, type Camera } from '../game/camera';
import { JINK_S } from '../game/dog';
import type { World } from '../game/world';
import type { GameArt } from './art';
import { silhouette } from './powerView';

export interface DogClip {
  name: DogAnim;
  frame: number;
}

/** The snatch shows for this long after he takes the ball. */
export const GRAB_SHOW_S = 0.2;
/** Below this speed he stands. */
const IDLE_SPEED = 5;

const looping = (name: DogAnim, nowS: number): DogClip => ({ name, frame: Math.floor(Math.max(0, nowS) * BISCUIT_FPS[name]) % BISCUIT_FRAMES[name].length });

/**
 * Which clip and frame the dog shows: blown or braced from his body's state
 * (flat out going up, tumbling on the way down, then on his feet shaking it
 * off); then a trick's head tilt or tumble; then the pant, which is also how he shakes off a lost ball; the
 * jink (crouch, then cut); the grab for GRAB_SHOW_S after he takes the
 * ball; the carry, standing or galloping; the run when moving; idle
 * otherwise. Looping clips run on `nowS`.
 */
export function dogClip(w: World, nowS: number): DogClip {
  const d = w.dog!;
  const p = w.away;
  if (p.state === 'blown' && (p.y > 0 || p.vy > 0)) return { name: 'blown', frame: p.vy > 0 ? 0 : 1 };
  if (p.state === 'bracing') return { name: 'brace', frame: 0 };
  // Fooled by a trick, on the reaction's clock: the head tilt loops, the tumble holds its last frame.
  if (p.fooled) {
    const into = Math.max(0, p.fooled.totalS - p.fooled.leftS);
    if (p.fooled.kind === 'confused') return looping('tilt', into);
    return { name: 'tumble', frame: Math.min(BISCUIT_FRAMES.tumble.length - 1, Math.floor(into * BISCUIT_FPS.tumble)) };
  }
  // Landed from a wave, knocked off the ball, or out of breath: standing, heaving.
  if (p.state === 'blown' || d.pantS > 0 || (d.regrabS > 0 && !d.carrying)) return looping('pant', nowS);
  if (d.jinkS > 0) return { name: 'jink', frame: d.jinkS > JINK_S / 2 ? 0 : 1 };
  if (d.carrying && d.carryS < GRAB_SHOW_S) return { name: 'grab', frame: Math.min(BISCUIT_FRAMES.grab.length - 1, Math.floor(d.carryS * BISCUIT_FPS.grab)) };
  const moving = Math.hypot(p.vx, p.vz) >= IDLE_SPEED;
  // The carry frames hold the ball, so standing with it he shows the first.
  if (d.carrying) return moving ? looping('carry', nowS) : { name: 'carry', frame: 0 };
  return looping(moving ? 'run' : 'idle', nowS);
}

/** Draws the dog at his feet's spot, as a dark silhouette for an impact frame when `flat`. */
export function drawDog(g: CanvasRenderingContext2D, cam: Camera, w: World, art: GameArt, nowS: number, flat = false): void {
  const p = w.away;
  const clip = dogClip(w, nowS);
  const frames = art.biscuit[clip.name][p.facing === 1 ? 'right' : 'left'];
  const frame = frames[Math.min(clip.frame, frames.length - 1)]!;
  // Frames face right; flipped, the anchor column mirrors.
  const ax = p.facing === 1 ? BISCUIT_ANCHOR.x : frame.width - 1 - BISCUIT_ANCHOR.x;
  const s = project(p.x, p.y, p.z, cam);
  g.drawImage(flat ? silhouette(frame) : frame, Math.round(s.sx) - ax, Math.round(s.sy) - BISCUIT_ANCHOR.y);
}
