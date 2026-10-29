import { inGoalBox, playerSpan, type Field } from './field';
import { DECEL, PLAYER_R, type Player } from './player';

/** Two players closer than this on the ground plane overlap. */
const MIN_GAP = 2 * PLAYER_R;
/** A jumper whose feet are this far above the other player clears him. */
const JUMP_CLEARANCE = 20;
/** Rounds of separating and confining per tick, so a push off a wall or goal settles. */
const SOLVE_PASSES = 4;
/** Overlap smaller than this is treated as touching. */
const TOUCH_EPS = 1e-9;

const overlapping = (a: Player, b: Player): boolean =>
  Math.abs(a.y - b.y) <= JUMP_CLEARANCE && Math.hypot(b.x - a.x, b.z - a.z) < MIN_GAP - TOUCH_EPS;

/** The unit vector from a to b on the ground plane, and their distance. On the same spot, b is ahead of a. */
function centreLine(a: Player, b: Player): { nx: number; nz: number; d: number } {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const d = Math.hypot(dx, dz);
  return d > 0 ? { nx: dx / d, nz: dz / d, d } : { nx: a.facing, nz: 0, d: 0 };
}

/** Moves a back by `shareA` of the overlap and b on by the rest, along the line between them. */
function pushApart(a: Player, b: Player, shareA: (nx: number, nz: number) => number): void {
  if (Math.abs(a.y - b.y) > JUMP_CLEARANCE) return;
  const { nx, nz, d } = centreLine(a, b);
  const overlap = MIN_GAP - d;
  if (overlap <= 0) return;
  const share = shareA(nx, nz);
  a.x -= nx * overlap * share;
  a.z -= nz * overlap * share;
  b.x += nx * overlap * (1 - share);
  b.z += nz * overlap * (1 - share);
  // Bodies stop each other: neither keeps any speed into the other, only along him.
  const intoB = a.vx * nx + a.vz * nz;
  if (intoB > 0) [a.vx, a.vz] = [a.vx - intoB * nx, a.vz - intoB * nz];
  const intoA = b.vx * nx + b.vz * nz;
  if (intoA < 0) [b.vx, b.vz] = [b.vx - intoA * nx, b.vz - intoA * nz];
}

/**
 * Solid bodies: removes any overlap along the centre line. Whoever is moving
 * toward the other takes the correction, in proportion to how fast, so a
 * runner can't bulldoze a standing player; if neither is, they share it.
 */
export function separatePlayers(a: Player, b: Player): void {
  pushApart(a, b, (nx, nz) => {
    const towardB = Math.max(0, a.vx * nx + a.vz * nz);
    const towardA = Math.max(0, -(b.vx * nx + b.vz * nz));
    return towardB + towardA > 0 ? towardB / (towardB + towardA) : 0.5;
  });
}

/** Whether (x, z) is somewhere a player's centre may stand: inside the fences, the near board and the back fence. */
function onPitch(field: Field, x: number, z: number): boolean {
  const [x0, x1] = playerSpan(field);
  return x >= x0 + PLAYER_R && x <= x1 - PLAYER_R && z >= PLAYER_R && z <= field.depth - PLAYER_R;
}

/**
 * Goals are solid: a player inside one (grown by his radius) is pushed out
 * the shortest way that fits: toward the field, or past either post. The
 * gap behind the net is too narrow for him, so that way never counts.
 */
export function keepOutOfGoals(p: Player, field: Field): void {
  for (const g of field.goals) {
    if (!inGoalBox(g, p.x, p.z, PLAYER_R)) continue;
    const toField = g.side === 'right' ? -1 : 1;
    const exits = [
      { x: g.lineX + toField * PLAYER_R, z: p.z },
      { x: p.x, z: g.z0 - PLAYER_R },
      { x: p.x, z: g.z1 + PLAYER_R },
      { x: g.backX - toField * PLAYER_R, z: p.z },
    ].filter(e => onPitch(field, e.x, e.z));
    const best = exits.reduce((m, e) => (Math.hypot(e.x - p.x, e.z - p.z) < Math.hypot(m.x - p.x, m.z - p.z) ? e : m));
    p.x = best.x;
    p.z = best.z;
  }
}

/**
 * A keeper blown into his net: the net back and sides hold him, its mouth
 * open so he can walk out. Clear of the goal, he's out of the net.
 */
function keepInNet(p: Player, field: Field): void {
  const g = field.goals.find(g => inGoalBox(g, p.x, p.z, PLAYER_R));
  if (!g) {
    p.inNet = false;
    return;
  }
  const out = g.side === 'right' ? -1 : 1;
  p.x = out === -1 ? Math.min(p.x, g.backX - PLAYER_R) : Math.max(p.x, g.backX + PLAYER_R);
  if ((p.x - g.lineX) * out < 0) p.z = Math.min(Math.max(p.z, g.z0 + PLAYER_R), g.z1 - PLAYER_R);
}

/**
 * Keeps a player on the pitch and out of the goals, and a keeper in his box
 * (unless he's blown away, or in his net, which holds him). Returns whether
 * that moved him.
 */
function confine(p: Player, field: Field): boolean {
  const [x, z] = [p.x, p.z];
  const [x0, x1] = playerSpan(field);
  p.x = Math.min(Math.max(p.x, x0 + PLAYER_R), x1 - PLAYER_R);
  p.z = Math.min(Math.max(p.z, PLAYER_R), field.depth - PLAYER_R);
  const free = p.state === 'blown' || p.inNet === true;
  if (p.area && !free) {
    p.x = Math.min(Math.max(p.x, p.area.x0), p.area.x1);
    p.z = Math.min(Math.max(p.z, p.area.z0), p.area.z1);
  }
  // A keeper flying along the beam goes into his net, and the net then holds him.
  if (p.area && p.state === 'blown' && !p.inNet && field.goals.some(g => inGoalBox(g, p.x, p.z))) p.inNet = true;
  if (p.inNet) keepInNet(p, field);
  else if (!(p.area && p.state === 'blown')) keepOutOfGoals(p, field);
  return p.x !== x || p.z !== z;
}

/**
 * Both players are pinned along their centre line (say, between the near
 * board and a goal): slide one along the pitch, toward the middle, until
 * they no longer overlap.
 */
function sidestep(a: Player, b: Player, field: Field): void {
  const middle = field.width / 2;
  const order = Math.abs(a.x - middle) <= Math.abs(b.x - middle) ? [a, b] : [b, a];
  for (const [mover, other] of [order, [order[1]!, order[0]!]] as const) {
    const dz = Math.abs(mover.z - other.z);
    const needX = Math.sqrt(Math.max(0, MIN_GAP * MIN_GAP - dz * dz));
    const dir = mover.x === other.x ? Math.sign(middle - mover.x) || 1 : Math.sign(mover.x - other.x);
    const [x, z] = [mover.x, mover.z];
    mover.x = other.x + dir * needX;
    confine(mover, field);
    if (!overlapping(a, b)) return;
    [mover.x, mover.z] = [x, z];
  }
}

/** Above this speed a player on soft brakes can't stop for a body ahead. */
const BRUSH_SPEED = 60;

/**
 * A player on soft brakes, running fast into a body ahead of him, can't stop
 * for it: he brushes past its shoulder, stepping out square to his run on
 * the side he's already on (the roomier side if dead on), keeping his speed.
 * Returns whether he did.
 */
function brushPast(runner: Player, other: Player, field: Field): boolean {
  const speed = Math.hypot(runner.vx, runner.vz);
  if (runner.handling.decel >= DECEL || speed <= BRUSH_SPEED || !overlapping(runner, other)) return false;
  const [ux, uz] = [runner.vx / speed, runner.vz / speed];
  const [rx, rz] = [other.x - runner.x, other.z - runner.z];
  const along = rx * ux + rz * uz;
  if (along <= 0) return false;
  const across = rx * -uz + rz * ux;
  const away = across !== 0 ? -Math.sign(across) : Math.sign((field.depth / 2 - other.z) * ux) || 1;
  const step = Math.sqrt(MIN_GAP * MIN_GAP - along * along) - Math.abs(across) + TOUCH_EPS;
  const [x, z] = [runner.x, runner.z];
  runner.x += -uz * away * step;
  runner.z += ux * away * step;
  if (!confine(runner, field) && !overlapping(runner, other)) return true;
  [runner.x, runner.z] = [x, z];
  return false;
}

/**
 * One tick's body resolution: players apart, on the pitch and out of the
 * goals. When a wall or goal stops one giving way, the other takes the rest
 * of the push, so nobody is left overlapping or wedged.
 */
export function resolveBodies(a: Player, b: Player, field: Field): void {
  // A brush past still keeps both on the pitch and out of the goals; if that brings them back together, they settle as usual.
  if (brushPast(a, b, field) || brushPast(b, a, field)) {
    confine(a, field);
    confine(b, field);
    if (!overlapping(a, b)) return;
  }
  for (let pass = 0; pass < SOLVE_PASSES; pass++) {
    separatePlayers(a, b);
    const pinnedA = confine(a, field);
    const pinnedB = confine(b, field);
    if (!overlapping(a, b)) return;
    if (pinnedA !== pinnedB) {
      pushApart(a, b, () => (pinnedA ? 0 : 1));
      confine(pinnedA ? b : a, field);
      if (!overlapping(a, b)) return;
    }
  }
  sidestep(a, b, field);
}

/** Every pair of bodies resolved in order, twice over, so a push passed along settles. */
export function resolveAll(bodies: readonly Player[], field: Field): void {
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) resolveBodies(bodies[i]!, bodies[j]!, field);
  }
}
