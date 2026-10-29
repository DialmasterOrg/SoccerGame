import { DEPTH_SHEAR } from '../../game/camera';
import { poseKey, type KeySpec } from '../body/animations';
import { samplePoses } from '../body/bake';
import { drawFigure, type BodyExtras } from '../body/drawFigure';
import type { HeadSprite } from '../body/head';
import { FRAME_H, FRAME_W, solvePose, type HeadFacing, type Pose } from '../body/pose';
import type { BodyProportions } from '../body/proportions';
import { flipX, shearUp, turnLeft, type IndexedImage } from '../indexedImage';
import type { Point } from '../raster';

export type KeeperPose = 'ready' | 'shuffle' | 'catch' | 'push' | 'hold' | 'dropKick' | 'getUp' | 'smother';

export const KEEPER_POSE_FRAMES: Readonly<Record<KeeperPose, number>> = { ready: 2, shuffle: 4, catch: 2, push: 2, hold: 2, dropKick: 4, getUp: 3, smother: 3 };
export const KEEPER_POSE_FPS: Readonly<Record<KeeperPose, number>> = { ready: 3, shuffle: 10, catch: 8, push: 8, hold: 3, dropKick: 9, getUp: 6, smother: 8 };
const LOOPS: ReadonlySet<KeeperPose> = new Set(['ready', 'shuffle', 'hold']);

/** Where a held ball's centre sits in the hold frames, from ANCHOR: x ahead of him, y up. The sim parks the ball there. */
export const KEEPER_HANDS: Point = { x: 6, y: 20 };

/** Launch, full stretch, landed. */
export const DIVE_FRAMES = 3;

/** Gloves out in front, as in the ready crouch. */
const READY_ARMS = { nearArm: [55, 35], farArm: [45, 40] } as const satisfies Pick<KeySpec, 'nearArm' | 'farArm'>;

const KEEPER_KEYS: Readonly<Record<KeeperPose, readonly KeySpec[]>> = (() => {
  const crouch = (hip: number, near: number, far: number): KeySpec => ({ hip, torso: 22, near: { plant: near }, far: { plant: far }, nearArm: [...READY_ARMS.nearArm], farArm: [...READY_ARMS.farArm] });
  return {
    ready: [crouch(-5, 6, -5), crouch(-6, 6, -5)],
    // Side steps across his goal: in this view his feet come together and apart.
    shuffle: [crouch(-5, 7, -6), crouch(-6, 3, -2), crouch(-4, 7, -6), crouch(-6, 3, -2)],
    catch: [
      { hip: -3, torso: 8, near: { plant: 5 }, far: { plant: -4 }, nearArm: [70, 30], farArm: [62, 35] },
      { hip: -2, torso: 4, near: { plant: 4 }, far: { plant: -3 }, nearArm: [25, 95], farArm: [20, 100] },
    ],
    push: [
      { hip: -3, torso: 0, near: { plant: 5 }, far: { plant: -4 }, nearArm: [95, 70], farArm: [85, 75] },
      { hip: -1, torso: -10, head: { dy: -1 }, near: { plant: 6 }, far: { plant: -5 }, nearArm: [140, 0], farArm: [130, 5] },
    ],
    // The ball clutched at KEEPER_HANDS, against his belly.
    hold: [
      { hip: 0, torso: 5, near: { plant: 3 }, far: { plant: -2 }, nearArm: [-6, 62], farArm: [-2, 58] },
      { hip: -1, torso: 5, near: { plant: 3 }, far: { plant: -2 }, nearArm: [-6, 62], farArm: [-2, 58] },
    ],
    // Drop, swing, strike, follow through.
    dropKick: [
      { hip: -1, torso: 0, near: { hip: -30, knee: 75, ankle: 30 }, far: { plant: -1 }, nearArm: [60, 10], farArm: [-35, 20] },
      { hip: -1, torso: -5, near: { hip: 15, knee: 55, ankle: 30 }, far: { plant: -1 }, nearArm: [-20, 30], farArm: [50, 30] },
      { hip: -1, torso: -15, near: { hip: 70, knee: 10, ankle: 20 }, far: { plant: -2 }, nearArm: [-35, 20], farArm: [85, 20] },
      { hip: 0, torso: -25, near: { hip: 100, knee: 5, ankle: 10 }, far: { plant: -3 }, nearArm: [-45, 20], farArm: [115, 20] },
    ],
    // Up off the grass onto his hands and knees, onto one knee, then up in his crouch.
    getUp: [
      { x: -1, hip: -10, torso: 70, near: { hip: 5, knee: 95, ankle: 170 }, far: { hip: -5, knee: 90, ankle: 170 }, nearArm: [-48, 10], farArm: [-53, 10] },
      { hip: -8, torso: 10, near: { plant: 6 }, far: { hip: 0, knee: 90, ankle: 0 }, nearArm: [20, 30], farArm: [0, 30] },
      { hip: -3, torso: 14, near: { plant: 5 }, far: { plant: -4 }, nearArm: [40, 30], farArm: [32, 35] },
    ],
    // A low dive forward at a dribbler's feet, gloves first along the grass.
    smother: [
      { x: -2, hip: -6, torso: 50, near: { plant: 8 }, far: { hip: -40, knee: 40, ankle: 30 }, nearArm: [30, 0], farArm: [25, 0] },
      { x: -3, hip: -13, torso: 85, near: { hip: -88, knee: 15, ankle: 170 }, far: { hip: -80, knee: 35, ankle: 170 }, nearArm: [-5, 0], farArm: [-10, 0] },
      { x: -3, hip: -14, torso: 90, near: { hip: -90, knee: 10, ankle: 175 }, far: { hip: -85, knee: 25, ankle: 175 }, nearArm: [-8, 5], farArm: [-12, 5] },
    ],
  };
})();

/** FRAME_W×FRAME_H frames on ANCHOR, like every body frame, facing right. */
export function bakeKeeperPoses(body: BodyProportions, heads: Record<HeadFacing, HeadSprite>, extras: BodyExtras): Record<KeeperPose, IndexedImage[]> {
  const out = {} as Record<KeeperPose, IndexedImage[]>;
  for (const name of Object.keys(KEEPER_POSE_FRAMES) as KeeperPose[]) {
    const clip = { name, keys: KEEPER_KEYS[name].map(s => poseKey(body, s)), frameCount: KEEPER_POSE_FRAMES[name], loop: LOOPS.has(name) };
    out[name] = samplePoses(clip).map(p => drawFigure(p, body, heads, extras));
  }
  return out;
}

/**
 * The flat dive, before it's turned: lying along x with his head to the right,
 * arms stretched past his head, gloves leading, legs trailing. The hips sit at
 * the same spot in every frame, so one anchor serves all three.
 */
const DIVE_HIP = { x: -2, hip: -11 } as const;
const DIVE_KEYS: readonly KeySpec[] = [
  { ...DIVE_HIP, torso: 88, near: { hip: -50, knee: 80, ankle: 120 }, far: { hip: -70, knee: 60, ankle: 120 }, nearArm: [25, -60], farArm: [35, -60] },
  { ...DIVE_HIP, torso: 90, near: { hip: -95, knee: 25, ankle: 170 }, far: { hip: -85, knee: 45, ankle: 170 }, nearArm: [-5, 0], farArm: [-2, 0] },
  { ...DIVE_HIP, torso: 94, near: { hip: -92, knee: 15, ankle: 175 }, far: { hip: -88, knee: 30, ankle: 175 }, nearArm: [-12, 8], farArm: [-8, 8] },
];

/** A dive's frames for one facing; the anchor is his hips, over his ground point. */
export function diveFrames(body: BodyProportions, heads: Record<HeadFacing, HeadSprite>, extras: BodyExtras, facing: 1 | -1, toward: 'far' | 'near'): { frames: IndexedImage[]; anchor: Point } {
  const poses: Pose[] = DIVE_KEYS.map(s => poseKey(body, s));
  const hip = solvePose(poses[0]!, body).hip;
  // Far: head and gloves up the screen. Near: mirrored first, so they point down it. His chest faces the pitch either way.
  const turn = (img: IndexedImage) => {
    const turned = turnLeft(toward === 'far' ? img : flipX(img));
    return facing === 1 ? turned : flipX(turned);
  };
  const frames = poses.map(p => shearUp(turn(drawFigure(p, body, heads, extras)), DEPTH_SHEAR));
  // Follow the hip pixel through the same steps: turned, the image is FRAME_H wide and FRAME_W tall.
  const [hx, hy] = [Math.round(hip.x), Math.round(hip.y)];
  const turned = toward === 'far' ? { x: hy, y: FRAME_W - 1 - hx } : { x: hy, y: hx };
  const p = facing === 1 ? turned : { x: FRAME_H - 1 - turned.x, y: turned.y };
  return { frames, anchor: { x: p.x + Math.round(DEPTH_SHEAR * (FRAME_W - 1 - p.y)), y: p.y } };
}
