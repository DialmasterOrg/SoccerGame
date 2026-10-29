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

/** The School Field and every later venue's pitch: twice the Backyard's length and depth, with bigger goals a keeper has room to move in. */
export const SCHOOL_FIELD: Field = {
  width: 1280,
  depth: 128,
  fenceL: 4,
  fenceR: 1276,
  goals: [
    { side: 'left', lineX: 40, backX: 20, barY: 48, barThick: 2, z0: 36, z1: 92 },
    { side: 'right', lineX: 1240, backX: 1260, barY: 48, barThick: 2, z0: 36, z1: 92 },
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

/** Whether (x, z) is inside a goal: between its line and net back, between its posts, grown by margin. */
export function inGoalBox(g: Goal, x: number, z: number, margin = 0): boolean {
  const x0 = Math.min(g.lineX, g.backX) - margin;
  const x1 = Math.max(g.lineX, g.backX) + margin;
  return x >= x0 && x <= x1 && z >= g.z0 - margin && z <= g.z1 + margin;
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
