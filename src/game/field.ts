import { BALL_R } from '../art/ball';

export interface Goal {
  side: 'left' | 'right';
  /** The goal line. */
  lineX: number;
  /** The back of the net. */
  backX: number;
  /** Height of the crossbar's underside. */
  barY: number;
  barThick: number;
  /** Depth of the near post (closer to the camera). */
  z0: number;
  /** Depth of the far post. */
  z1: number;
}

/** A pitch's painted white lines; distances are out from each goal line toward the middle. No rule reads them yet. */
export interface Markings {
  /** The near and far touchlines' depths. */
  touchZ: readonly [near: number, far: number];
  box: { out: number; z0: number; z1: number };
  goalArea: { out: number; z0: number; z1: number };
  spotOut: number;
  circleR: number;
}

/** World: x along the pitch, z away from the camera, y up. */
export interface Field {
  width: number;
  /** From the near board (z 0) to the back fence. */
  depth: number;
  /** Inner faces of the end fences. */
  fenceL: number;
  fenceR: number;
  goals: readonly [Goal, Goal];
  /** Painted lines; the Backyard's grass has none. */
  markings?: Markings;
}

export const BACKYARD: Field = {
  width: 640,
  depth: 64,
  fenceL: 4,
  fenceR: 636,
  goals: [
    { side: 'left', lineX: 28, backX: 12, barY: 28, barThick: 2, z0: 18, z1: 46 },
    { side: 'right', lineX: 612, backX: 628, barY: 28, barThick: 2, z0: 18, z1: 46 },
  ],
};

/**
 * The School Field and every later venue's pitch: twice the Backyard's length
 * and depth, with bigger goals a keeper has room to move in. As at the
 * Backyard, the gap behind each net is 8, too narrow for a player.
 */
export const SCHOOL_FIELD: Field = {
  width: 1280,
  depth: 128,
  fenceL: 4,
  fenceR: 1276,
  goals: [
    // 68 deep (was 56): widened at the parent's ask, so a keeper's dive covers less of the mouth.
    { side: 'left', lineX: 40, backX: 12, barY: 48, barThick: 2, z0: 30, z1: 98 },
    { side: 'right', lineX: 1240, backX: 1268, barY: 48, barThick: 2, z0: 30, z1: 98 },
  ],
  markings: { touchZ: [3, 125], box: { out: 110, z0: 10, z1: 118 }, goalArea: { out: 36, z0: 26, z1: 102 }, spotOut: 76, circleR: 36 },
};

/**
 * The x span of a goal's crossbar box. Its top (the net roof) runs on from
 * the bar to the end fence, so nothing can drop into the gap behind the net.
 */
export function roofSpan(field: Field, g: Goal): [x0: number, x1: number] {
  return g.side === 'right' ? [g.lineX, field.fenceR] : [field.fenceL, g.lineX];
}

/** Where a body moving from `from` to `to` crosses g's line into the goal, if its centre does so within `r` of the mouth; else null. */
export function crossesIntoGoal(g: Goal, from: { x: number; z: number }, to: { x: number; z: number }, r: number): { z: number } | null {
  const out = g.side === 'right' ? -1 : 1;
  const [before, after] = [(from.x - g.lineX) * out, (to.x - g.lineX) * out];
  if (!(before >= 0 && after < 0)) return null;
  const z = from.z + ((to.z - from.z) * before) / (before - after);
  return z >= g.z0 - r && z <= g.z1 + r ? { z } : null;
}

/** Whether (x, z) is inside a goal: between its line and net back, between its posts, grown by margin. */
export function inGoalBox(g: Goal, x: number, z: number, margin = 0): boolean {
  const x0 = Math.min(g.lineX, g.backX) - margin;
  const x1 = Math.max(g.lineX, g.backX) + margin;
  return x >= x0 && x <= x1 && z >= g.z0 - margin && z <= g.z1 + margin;
}

/** A rectangle on the ground plane. */
export interface Area {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A goal's penalty box: from its line out toward the middle, across the box's depths. The field must have markings. */
export function penaltyArea(field: Field, g: Goal): Area {
  if (!field.markings) throw new Error('penaltyArea: this field has no painted box');
  const { out, z0, z1 } = field.markings.box;
  const [x0, x1] = g.side === 'left' ? [g.lineX, g.lineX + out] : [g.lineX - out, g.lineX];
  return { x0, x1, z0, z1 };
}

/** Where players may stand along the pitch: fence to fence, so they can walk round the goals. */
export function playerSpan(field: Field): [x0: number, x1: number] {
  return [field.fenceL, field.fenceR];
}

/**
 * Which goal the ball is in: the whole ball past the line, under the bar and
 * between the posts, and in front of the net back (never in the sealed gap behind it).
 */
export function goalScored(field: Field, b: { x: number; y: number; z: number }): 'left' | 'right' | null {
  for (const g of field.goals) {
    const past = g.side === 'right' ? b.x - BALL_R >= g.lineX : b.x + BALL_R <= g.lineX;
    const between = b.z - BALL_R >= g.z0 && b.z + BALL_R <= g.z1;
    if (past && between && inGoalBox(g, b.x, b.z) && b.y + BALL_R <= g.barY) return g.side;
  }
  return null;
}
