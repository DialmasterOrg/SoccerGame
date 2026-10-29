import { describe, expect, it } from 'vitest';
import { ANCHOR } from '../body/pose';
import { HARRISON_BODY } from '../body/proportions';
import { C } from '../colors';
import type { IndexedImage } from '../indexedImage';
import { KEEPER_EXTRAS, KEEPER_HEADS } from './keepers';
import { DIVE_FRAMES, KEEPER_HANDS, KEEPER_POSE_FPS, KEEPER_POSE_FRAMES, bakeKeeperPoses, diveFrames, type KeeperPose } from './poses';

const baked = bakeKeeperPoses(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS);
const isGlove = (c: number) => c === C.Glove || c === C.GloveShadow;

/** The mean position of a frame's glove pixels. */
function gloveAt(f: IndexedImage): { x: number; y: number } {
  let [sx, sy, n] = [0, 0, 0];
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (isGlove(f.get(x, y))) [sx, sy, n] = [sx + x, sy + y, n + 1];
  return { x: sx / n, y: sy / n };
}

describe('keeper poses', () => {
  it('every keeper pose has its frames, outlined', () => {
    for (const [pose, n] of Object.entries(KEEPER_POSE_FRAMES) as [KeeperPose, number][]) {
      expect(baked[pose], pose).toHaveLength(n);
      for (const f of baked[pose]) expect(f.data.filter(c => c === C.Outline).length, pose).toBeGreaterThan(20);
      expect(KEEPER_POSE_FPS[pose]).toBeGreaterThan(0);
    }
  });

  it('in the hold frames his gloves are round the ball spot', () => {
    for (const f of baked.hold) {
      const [cx, cy] = [ANCHOR.x + KEEPER_HANDS.x, ANCHOR.y - KEEPER_HANDS.y];
      let near = false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) near ||= isGlove(f.get(cx + dx, cy + dy));
      expect(near).toBe(true);
    }
  });
});

describe('dives', () => {
  it('a far-post dive lies up the screen and leans right; a near-post dive lies down it', () => {
    const far = diveFrames(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS, 1, 'far');
    const near = diveFrames(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS, 1, 'near');
    expect(far.frames).toHaveLength(DIVE_FRAMES);
    expect(gloveAt(far.frames[1]!).y).toBeLessThan(far.anchor.y - 12);
    expect(gloveAt(far.frames[1]!).x).toBeGreaterThan(far.anchor.x);
    expect(gloveAt(near.frames[1]!).y).toBeGreaterThan(near.anchor.y + 8);
  });

  it('facing left, a dive still leans right with depth', () => {
    const left = diveFrames(HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS, -1, 'far');
    expect(gloveAt(left.frames[1]!).x).toBeGreaterThan(left.anchor.x);
  });
});
