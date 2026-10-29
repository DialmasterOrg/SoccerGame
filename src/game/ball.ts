import { BALL_R } from '../art/ball';
import {
  AIR_DRAG,
  BALL_RESTITUTION,
  BALL_SUBSTEP_PX,
  BAR_RESTITUTION,
  BAR_ROLL_SPEED,
  GRAVITY,
  NET_DAMPING,
  POST_R,
  ROLL_FRICTION,
  SETTLE_SPEED,
  SPIN_DECAY,
  SPIN_DIP,
  SPIN_SKIP,
  WALL_RESTITUTION,
} from './constants';
import { roofSpan, type Field, type Goal } from './field';
import type { Team } from './match';

/** Height of a resting ball's centre: it sits on the grass. */
export const BALL_REST_Y = BALL_R;

/** World: x along the pitch, y up, z away from the camera; (x, y, z) is the ball's centre. */
export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Positive is topspin, negative backspin. */
  spin: number;
  /** Rolling animation angle, radians. */
  spinAngle: number;
  /** Who played it last: a touch, a kick, a tackle or a steal. Unset after a kickoff. */
  touchedBy?: 'home' | 'away';
  /**
   * A nutmeg under way: the ball passes through this side's outfield
   * player, never its keeper, until it's clear of him along `dir` (the
   * push's way along the pitch) or leftS runs out. Unset after a kickoff.
   */
  through?: { team: Team; dir: 1 | -1; leftS: number };
}

export interface BallEvents {
  bounced: boolean;
  hitBar: boolean;
  hitPost: boolean;
  hitWall: boolean;
  hitNet: boolean;
}

/** Goal collisions run this many passes per substep, so corners where two solids meet settle. */
const GOAL_PASSES = 2;

const towardZero = (v: number, by: number): number => (v > 0 ? Math.max(0, v - by) : Math.min(0, v + by));
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Pushes the ball out of a solid along the normal from `closest`, the solid's
 * nearest point to its centre, and reflects the inward velocity. Returns the
 * outward normal on a hit.
 */
function pushOut(b: Ball, closest: { x: number; y: number; z: number }, radius: number, restitution: number): null | { nx: number; ny: number; nz: number; vn: number } {
  const [dx, dy, dz] = [b.x - closest.x, b.y - closest.y, b.z - closest.z];
  const d = Math.hypot(dx, dy, dz);
  if (d >= radius) return null;
  // A centre exactly on the solid only comes from a bad start position: leave upward.
  const [nx, ny, nz] = d === 0 ? [0, 1, 0] : [dx / d, dy / d, dz / d];
  b.x = closest.x + nx * radius;
  b.y = closest.y + ny * radius;
  b.z = closest.z + nz * radius;
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn < 0) {
    b.vx -= (1 + restitution) * vn * nx;
    b.vy -= (1 + restitution) * vn * ny;
    b.vz -= (1 + restitution) * vn * nz;
  }
  return { nx, ny, nz, vn };
}

/** A ball on top of the frame: the top is slightly rounded, so a resting ball always rolls off toward the field. */
function rollOffTop(b: Ball, g: Goal): void {
  if (Math.abs(b.vy) < SETTLE_SPEED) b.vy = 0;
  const towardField = g.side === 'right' ? -1 : 1;
  if (Math.abs(b.vx) < BAR_ROLL_SPEED) b.vx = towardField * BAR_ROLL_SPEED;
}

/**
 * The crossbar and the net roof: one slab from the goal line back to the end
 * fence, between the posts, so nothing drops into the gap behind the net.
 */
function collideBar(b: Ball, g: Goal, field: Field): boolean {
  const [x0, x1] = roofSpan(field, g);
  const closest = { x: clamp(b.x, x0, x1), y: clamp(b.y, g.barY, g.barY + g.barThick), z: clamp(b.z, g.z0, g.z1) };
  const hit = pushOut(b, closest, BALL_R, BAR_RESTITUTION);
  if (!hit) return false;
  if (hit.ny > 0.7) rollOffTop(b, g);
  return hit.vn < -SETTLE_SPEED;
}

/** The posts: upright cylinders from the ground to the bar's top. */
function collidePosts(b: Ball, g: Goal): boolean {
  let hit = false;
  for (const z of [g.z0, g.z1]) {
    const closest = { x: g.lineX, y: clamp(b.y, 0, g.barY + g.barThick), z };
    const h = pushOut(b, closest, BALL_R + POST_R, BAR_RESTITUTION);
    // Its rounded top is part of the frame's top: nothing balances on it.
    if (h && h.ny > 0.7) rollOffTop(b, g);
    if (h && h.vn < -SETTLE_SPEED) hit = true;
  }
  return hit;
}

/**
 * The netting: the back at backX and the sides at the posts' depths, running
 * from the goal line to the end fence. Every net stops the ball from either
 * side and soaks up most of its pace.
 */
function collideNets(b: Ball, g: Goal, field: Field, from: { x: number; z: number }): boolean {
  if (b.y >= g.barY) return false;
  let hit = false;
  const [x0, x1] = roofSpan(field, g);
  if (b.x >= x0 && b.x <= x1) {
    for (const zn of [g.z0, g.z1]) {
      if (Math.abs(b.z - zn) >= BALL_R) continue;
      // The side it was on before this substep moved it: a ball can't be dragged through the net.
      const side = Math.sign(from.z - zn) || Math.sign(b.z - zn) || (zn === g.z0 ? 1 : -1);
      b.z = zn + side * BALL_R;
      if (b.vz * side < 0) b.vz = -b.vz * NET_DAMPING;
      hit = true;
    }
  }
  if (b.z >= g.z0 && b.z <= g.z1 && Math.abs(b.x - g.backX) < BALL_R) {
    // From inside the goal, or (if it ever got there) from the closed gap behind it.
    const inward = g.side === 'right' ? -1 : 1;
    const side = Math.sign(from.x - g.backX) || inward;
    b.x = g.backX + side * BALL_R;
    if (b.vx * side < 0) b.vx = -b.vx * NET_DAMPING;
    hit = true;
  }
  return hit;
}

/** Keeps the ball inside the end fences, the near board and the back fence. */
function collideWalls(b: Ball, field: Field): boolean {
  let hit = false;
  if (b.x - BALL_R < field.fenceL) {
    b.x = field.fenceL + BALL_R;
    b.vx = Math.abs(b.vx) * WALL_RESTITUTION;
    hit = true;
  } else if (b.x + BALL_R > field.fenceR) {
    b.x = field.fenceR - BALL_R;
    b.vx = -Math.abs(b.vx) * WALL_RESTITUTION;
    hit = true;
  }
  if (b.z - BALL_R < 0) {
    b.z = BALL_R;
    b.vz = Math.abs(b.vz) * WALL_RESTITUTION;
    hit = true;
  } else if (b.z + BALL_R > field.depth) {
    b.z = field.depth - BALL_R;
    b.vz = -Math.abs(b.vz) * WALL_RESTITUTION;
    hit = true;
  }
  return hit;
}

function substep(b: Ball, h: number, field: Field, ev: BallEvents): void {
  const from = { x: b.x, z: b.z };
  const airborne = b.y > BALL_REST_Y || b.vy > 0;
  if (airborne) {
    b.vy -= (GRAVITY + Math.max(b.spin, 0) * SPIN_DIP) * h;
    const drag = 1 - AIR_DRAG * h;
    b.vx *= drag;
    b.vy *= drag;
    b.vz *= drag;
  } else {
    // Rolling friction slows the ball along its path without turning it.
    const speed = Math.hypot(b.vx, b.vz);
    const k = speed > 0 ? Math.max(0, speed - ROLL_FRICTION * h) / speed : 0;
    b.vx *= k;
    b.vz *= k;
  }
  b.spin = towardZero(b.spin, SPIN_DECAY * h);
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  b.spinAngle += ((b.vx < 0 ? -1 : 1) * Math.hypot(b.vx, b.vz) * h) / BALL_R;

  if (b.y < BALL_REST_Y) {
    b.y = BALL_REST_Y;
    if (b.vy < 0) {
      const up = -b.vy * BALL_RESTITUTION;
      if (up < SETTLE_SPEED) {
        b.vy = 0;
      } else {
        b.vy = up;
        const skip = 1 + SPIN_SKIP * b.spin;
        b.vx *= skip;
        b.vz *= skip;
        ev.bounced = true;
      }
    }
  }
  if (collideWalls(b, field)) ev.hitWall = true;
  for (let pass = 0; pass < GOAL_PASSES; pass++) {
    for (const g of field.goals) {
      if (collidePosts(b, g)) ev.hitPost = true;
      if (collideBar(b, g, field)) ev.hitBar = true;
      if (collideNets(b, g, field, from)) ev.hitNet = true;
    }
  }
  if (b.y < BALL_REST_Y) b.y = BALL_REST_Y;
}

/**
 * Advances the ball by dt in substeps of at most BALL_SUBSTEP_PX, so even a
 * full-power shot can't tunnel through a post, the bar, a net or a fence.
 */
export function stepBall(ball: Ball, dt: number, field: Field): BallEvents {
  const ev: BallEvents = { bounced: false, hitBar: false, hitPost: false, hitWall: false, hitNet: false };
  const fastest = Math.max(Math.hypot(ball.vx, ball.vz), Math.abs(ball.vy) + GRAVITY * dt);
  const n = Math.max(1, Math.ceil((fastest * dt) / BALL_SUBSTEP_PX));
  for (let i = 0; i < n; i++) substep(ball, dt / n, field, ev);
  return ev;
}
