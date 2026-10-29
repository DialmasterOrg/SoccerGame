import type { HeadSprite } from './head';
import type { IndexedImage } from '../indexedImage';
import { clipsFor, type AnimationClip, type AnimName } from './animations';
import { NO_BODY_EXTRAS, drawFigure, type BodyExtras } from './drawFigure';
import { lerpPose, mirrorPose, type HeadFacing, type Pose } from './pose';
import type { BodyProportions } from './proportions';

export interface BakedClip {
  name: AnimName;
  frames: IndexedImage[];
  fps: number;
  loop: boolean;
}

/** Evenly samples a clip's keys into one pose per frame (see the plan's sampling rules). */
export function samplePoses(clip: Pick<AnimationClip, 'keys' | 'frameCount' | 'loop' | 'mirrorHalf'> & { name: string }): Pose[] {
  const { keys, loop, mirrorHalf } = clip;
  if (mirrorHalf && clip.frameCount % 2 !== 0) throw new Error(`${clip.name}: mirrorHalf needs an even frameCount, got ${clip.frameCount}`);
  const n = mirrorHalf ? clip.frameCount / 2 : clip.frameCount;
  const k = keys.length;
  // A half cycle flows into the mirrored first key, a plain loop back into the first key.
  const wrapKey = mirrorHalf ? mirrorPose(keys[0]!) : keys[0]!;
  const keyAt = (i: number) => (i >= k ? wrapKey : keys[i]!);
  const half = Array.from({ length: n }, (_, i) => {
    const u = mirrorHalf || loop ? (i * k) / n : n === 1 ? 0 : (i * (k - 1)) / (n - 1);
    const lo = Math.floor(u);
    return lerpPose(keyAt(lo), keyAt(Math.ceil(u)), u - lo);
  });
  return mirrorHalf ? [...half, ...half.map(mirrorPose)] : half;
}

export function bakeClip(clip: AnimationClip, body: BodyProportions, heads: Record<HeadFacing, HeadSprite>, extras: BodyExtras = NO_BODY_EXTRAS): BakedClip {
  return {
    name: clip.name,
    frames: samplePoses(clip).map(p => drawFigure(p, body, heads, extras)),
    fps: clip.fps,
    loop: clip.loop,
  };
}

export function bakeAll(body: BodyProportions, heads: Record<HeadFacing, HeadSprite>, extras: BodyExtras = NO_BODY_EXTRAS): Record<AnimName, BakedClip> {
  const clips = clipsFor(body);
  const entries = (Object.keys(clips) as AnimName[]).map(name => [name, bakeClip(clips[name], body, heads, extras)] as const);
  return Object.fromEntries(entries) as Record<AnimName, BakedClip>;
}

/** Always a valid index: negative time (rAF timestamps can trail performance.now()) shows the first frame. */
export function frameIndexAt(clip: Pick<BakedClip, 'frames' | 'fps' | 'loop'>, timeMs: number): number {
  const i = Math.max(0, Math.floor((timeMs * clip.fps) / 1000));
  return clip.loop ? i % clip.frames.length : Math.min(i, clip.frames.length - 1);
}
