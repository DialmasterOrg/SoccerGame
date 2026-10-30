import type { Point } from '../raster';

/** A body frame's size, and the centre of his feet on the sole row in it. */
export interface FrameSpec {
  w: number;
  h: number;
  anchor: Point;
}

/** Limb lengths and thicknesses in pixels for a side-view figure. */
export interface BodyProportions {
  thigh: number;
  shin: number;
  foot: number;
  ankleHeight: number;
  torso: number;
  upperArm: number;
  forearm: number;
  thighWidth: number;
  shinWidth: number;
  upperArmWidth: number;
  forearmWidth: number;
  torsoWidth: number;
  /** The frame he's drawn in when it isn't FRAME_W×FRAME_H on ANCHOR: Goalie Gus's. */
  frame?: FrameSpec;
}

/** Tall and lean for 12: about 40 px standing with the head. */
export const HARRISON_BODY: BodyProportions = {
  thigh: 9,
  shin: 9,
  foot: 4,
  ankleHeight: 1,
  torso: 12,
  upperArm: 7,
  forearm: 6,
  thighWidth: 4,
  shinWidth: 3,
  upperArmWidth: 3,
  forearmWidth: 2,
  torsoWidth: 6,
};

export const standingHipHeight = (b: BodyProportions): number => b.thigh + b.shin + b.ankleHeight;

/** Big Brick: a pixel wider in the thighs, torso and upper arms, every length Harrison's, so he stands on the same feet and anchor. */
export const BRICK_BODY: BodyProportions = { ...HARRISON_BODY, thighWidth: 5, torsoWidth: 7, upperArmWidth: 4 };

/** Header Hank: two pixels more torso and a pixel more upper arm, every length below the hip Harrison's, so he stands on the same feet and anchor. */
export const HANK_BODY: BodyProportions = { ...HARRISON_BODY, torso: 14, upperArm: 8 };
