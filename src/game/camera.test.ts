import { describe, expect, it } from 'vitest';
import { BALL_REST_Y } from './ball';
import {
  BIG_VIEW,
  CAMERA_LOOKAHEAD_S,
  type Camera,
  DEPTH_SHEAR,
  SMALL_VIEW,
  hudSize,
  offscreenArrow,
  project,
  updateCamera,
  viewOf,
} from './camera';
import { BACKYARD, type Field } from './field';

const STEP = 1 / 60;
type CamBall = { x: number; y: number; z: number; vx: number };
const ball = (p: Partial<CamBall>): CamBall => ({ x: 320, y: BALL_REST_Y, z: 0, vx: 0, ...p });
const SCHOOL_LIKE: Field = { width: 1280, depth: 128, fenceL: 4, fenceR: 1276, goals: BACKYARD.goals };

function settle(camX: number, b: CamBall): number {
  const cam = { x: camX };
  for (let i = 0; i < 600; i++) updateCamera(cam, b, STEP, BACKYARD);
  return cam.x;
}

describe('project', () => {
  it('projects depth up the screen with the oblique slant', () => {
    expect(project(100, 0, 0, { x: 0 })).toEqual({ sx: 100, sy: 176 });
    expect(project(100, 0, 64, { x: 0 })).toEqual({ sx: 100 + 64 * 0.3, sy: 112 });
  });

  it('lifts height straight up and scrolls with the camera', () => {
    expect(project(100, 10, 0, { x: 40 })).toEqual({ sx: 60, sy: 166 });
  });
});

describe('updateCamera', () => {
  it('centres on the ball with lookahead in its direction of travel', () => {
    expect(settle(0, ball({ x: 300, vx: 100 }))).toBeCloseTo(300 + 100 * CAMERA_LOOKAHEAD_S - SMALL_VIEW.w / 2);
    expect(settle(300, ball({ x: 300, vx: -100 }))).toBeCloseTo(300 - 100 * CAMERA_LOOKAHEAD_S - SMALL_VIEW.w / 2);
  });

  it('follows the slant: a deeper ball sits further right on screen', () => {
    expect(settle(0, ball({ x: 300, z: 40 }))).toBeCloseTo(300 + 40 * DEPTH_SHEAR - SMALL_VIEW.w / 2);
  });

  it('clamps at both ends of the field', () => {
    expect(settle(100, ball({ x: 10 }))).toBe(0);
    expect(settle(100, ball({ x: 630 }))).toBeCloseTo(640 + 64 * DEPTH_SHEAR - SMALL_VIEW.w);
  });

  it('clamps the camera so the far end of the slanted pitch stays reachable', () => {
    expect(settle(100, ball({ x: 640, z: 64 }))).toBeCloseTo(640 + 64 * 0.3 - 320);
  });

  it('moves smoothly, not instantly', () => {
    const cam = { x: 0 };
    updateCamera(cam, ball({ x: 600 }), STEP, BACKYARD);
    expect(cam.x).toBeGreaterThan(0);
    expect(cam.x).toBeLessThan(0.25 * 320);
  });
});

describe('offscreenArrow', () => {
  it('shows an arrow only when the ball is above the screen', () => {
    expect(offscreenArrow(ball({ x: 400, y: 177 }), { x: 250 })).toEqual({ x: 150 });
    expect(offscreenArrow(ball({ x: 400, y: 100 }), { x: 250 })).toBeNull();
  });

  it('accounts for depth: a deep ball leaves the top sooner', () => {
    expect(offscreenArrow(ball({ x: 400, y: 120, z: 64 }), { x: 250 })).toEqual({ x: 150 + 64 * DEPTH_SHEAR });
  });
});

describe('views', () => {
  it('the big view puts the near touchline on row 296', () => {
    expect(project(100, 0, 0, { x: 0, view: BIG_VIEW })).toEqual({ sx: 100, sy: 296 });
    expect(project(100, 10, 128, { x: 40, view: BIG_VIEW })).toEqual({ sx: 60 + 128 * DEPTH_SHEAR, sy: 158 });
  });

  it('a camera with no view is the small view', () => {
    expect(viewOf({ x: 0 })).toBe(SMALL_VIEW);
  });

  it('the HUD layer is half the big view and the whole small one', () => {
    expect(hudSize(BIG_VIEW)).toEqual({ w: 267, h: 150 });
    expect(hudSize(SMALL_VIEW)).toEqual({ w: 320, h: 180 });
  });

  it('in the big view the camera clamps to both ends of a 1280 pitch', () => {
    const cam: Camera = { x: 300, view: BIG_VIEW };
    for (let i = 0; i < 600; i++) updateCamera(cam, ball({ x: 5 }), STEP, SCHOOL_LIKE);
    expect(cam.x).toBe(0);
    for (let i = 0; i < 600; i++) updateCamera(cam, ball({ x: 1275, z: 128 }), STEP, SCHOOL_LIKE);
    expect(cam.x).toBeCloseTo(1280 + 128 * DEPTH_SHEAR - 534);
  });

  it('the off-screen arrow uses the big view', () => {
    expect(offscreenArrow(ball({ x: 400, y: 320, z: 0 }), { x: 0, view: BIG_VIEW })).toEqual({ x: 400 });
    expect(offscreenArrow(ball({ x: 400, y: 280, z: 0 }), { x: 0, view: BIG_VIEW })).toBeNull();
  });
});
