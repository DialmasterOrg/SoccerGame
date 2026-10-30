import type { Point } from '../raster';
import { standingHipHeight, type BodyProportions, type FrameSpec } from './proportions';

export const FRAME_W = 49;
export const FRAME_H = 56;
/** Centre of the feet on the sole row. Odd FRAME_W keeps it fixed under flipX. */
export const ANCHOR: Point = { x: 24, y: 53 };

/** The frame a body is drawn in: its own, or the shared FRAME_W×FRAME_H on ANCHOR. */
export function frameOf(b: BodyProportions): FrameSpec {
  return b.frame ?? { w: FRAME_W, h: FRAME_H, anchor: ANCHOR };
}

export type HeadFacing = 'side' | 'threeQuarter' | 'front';

/** Degrees. Shoulder is relative to the torso; positive swings the arm forward. Elbow positive bends forward/up. */
export interface ArmPose {
  shoulder: number;
  elbow: number;
}

/** Degrees. Hip is absolute from vertical, positive forward; knee positive bends the shin back; ankle positive points toes down. */
export interface LegPose {
  hip: number;
  knee: number;
  ankle: number;
}

/** A side-view pose facing right. `x` shifts the hip; `torso` leans forward when positive. */
export interface Pose {
  x: number;
  hipHeight: number;
  torso: number;
  head: { facing: HeadFacing; dx: number; dy: number };
  nearArm: ArmPose;
  farArm: ArmPose;
  nearLeg: LegPose;
  farLeg: LegPose;
}

export interface LimbJoints {
  elbow: Point;
  hand: Point;
}

export interface LegJoints {
  knee: Point;
  ankle: Point;
  toe: Point;
}

export interface Joints {
  hip: Point;
  neck: Point;
  shoulder: Point;
  nearArm: LimbJoints;
  farArm: LimbJoints;
  nearLeg: LegJoints;
  farLeg: LegJoints;
}

const RAD = Math.PI / 180;

/** Point `len` away from `from`, in the direction "down, rotated forward by deg". */
function along(from: Point, deg: number, len: number): Point {
  return { x: from.x + Math.sin(deg * RAD) * len, y: from.y + Math.cos(deg * RAD) * len };
}

function solveArm(shoulder: Point, torso: number, arm: ArmPose, body: BodyProportions): LimbJoints {
  const upper = torso + arm.shoulder;
  const elbow = along(shoulder, upper, body.upperArm);
  return { elbow, hand: along(elbow, upper + arm.elbow, body.forearm) };
}

function solveLeg(hip: Point, leg: LegPose, body: BodyProportions): LegJoints {
  const knee = along(hip, leg.hip, body.thigh);
  const ankle = along(knee, leg.hip - leg.knee, body.shin);
  const toe = {
    x: ankle.x + Math.cos(leg.ankle * RAD) * body.foot,
    y: ankle.y + Math.sin(leg.ankle * RAD) * body.foot,
  };
  return { knee, ankle, toe };
}

export function solvePose(pose: Pose, body: BodyProportions): Joints {
  const { anchor } = frameOf(body);
  const hip = { x: anchor.x + pose.x, y: anchor.y - pose.hipHeight };
  const up = { x: Math.sin(pose.torso * RAD), y: -Math.cos(pose.torso * RAD) };
  const neck = { x: hip.x + up.x * body.torso, y: hip.y + up.y * body.torso };
  const shoulder = { x: hip.x + up.x * (body.torso - 1), y: hip.y + up.y * (body.torso - 1) };
  return {
    hip,
    neck,
    shoulder,
    nearArm: solveArm(shoulder, pose.torso, pose.nearArm, body),
    farArm: solveArm(shoulder, pose.torso, pose.farArm, body),
    nearLeg: solveLeg(hip, pose.nearLeg, body),
    farLeg: solveLeg(hip, pose.farLeg, body),
  };
}

/**
 * Two-bone IK: the leg angles that put the ankle on the ground at `footX`
 * (relative to ANCHOR.x) for a hip at (`hipX`, `hipHeight`). The knee bends
 * forward; an out-of-reach foot gets a straight leg pointed at it.
 */
export function plantLeg(body: BodyProportions, hipX: number, hipHeight: number, footX: number, ankle = 0): LegPose {
  const dx = footX - hipX;
  const dy = hipHeight - body.ankleHeight;
  const reach = body.thigh + body.shin;
  const d = Math.min(Math.hypot(dx, dy), reach);
  const toTarget = Math.atan2(dx, dy);
  const clampCos = (v: number) => Math.max(-1, Math.min(1, v));
  const atHip = Math.acos(clampCos((body.thigh ** 2 + d ** 2 - body.shin ** 2) / (2 * body.thigh * d)));
  const atKnee = Math.acos(clampCos((body.thigh ** 2 + body.shin ** 2 - d ** 2) / (2 * body.thigh * body.shin)));
  return { hip: (toTarget + atHip) / RAD, knee: (Math.PI - atKnee) / RAD, ankle };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const arm = (p: ArmPose, q: ArmPose): ArmPose => ({
    shoulder: lerp(p.shoulder, q.shoulder, t),
    elbow: lerp(p.elbow, q.elbow, t),
  });
  const leg = (p: LegPose, q: LegPose): LegPose => ({
    hip: lerp(p.hip, q.hip, t),
    knee: lerp(p.knee, q.knee, t),
    ankle: lerp(p.ankle, q.ankle, t),
  });
  return {
    x: lerp(a.x, b.x, t),
    hipHeight: lerp(a.hipHeight, b.hipHeight, t),
    torso: lerp(a.torso, b.torso, t),
    head: {
      facing: t < 0.5 ? a.head.facing : b.head.facing,
      dx: lerp(a.head.dx, b.head.dx, t),
      dy: lerp(a.head.dy, b.head.dy, t),
    },
    nearArm: arm(a.nearArm, b.nearArm),
    farArm: arm(a.farArm, b.farArm),
    nearLeg: leg(a.nearLeg, b.nearLeg),
    farLeg: leg(a.farLeg, b.farLeg),
  };
}

export function mirrorPose(p: Pose): Pose {
  return {
    ...p,
    head: { ...p.head },
    nearArm: { ...p.farArm },
    farArm: { ...p.nearArm },
    nearLeg: { ...p.farLeg },
    farLeg: { ...p.nearLeg },
  };
}

export function standingPose(body: BodyProportions): Pose {
  return {
    x: 0,
    hipHeight: standingHipHeight(body),
    torso: 0,
    head: { facing: 'side', dx: 0, dy: 0 },
    nearArm: { shoulder: 0, elbow: 0 },
    farArm: { shoulder: 0, elbow: 0 },
    nearLeg: { hip: 0, knee: 0, ankle: 0 },
    farLeg: { hip: 0, knee: 0, ankle: 0 },
  };
}
