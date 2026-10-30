import { DIFFICULTY, type Difficulty } from './ai';
import { BALL_REST_Y, type Ball } from './ball';
import { gusLineup } from './gus';
import { keeperLineup } from './keeper';
import { NO_INTENT, NORMAL_HANDLING, type PlayerIntent } from './player';
import { SCHOOL_STAGE } from './stage';
import { BASE_STATS } from './stats';
import { trickSetup } from './opponents';
import { createWorld, stepWorld, type World } from './world';

const DT = 1 / 60;

/**
 * A School world in play with both keepers set: Harrison at (900, 20) and Max at (380, 108), standing; the ball at rest on the centre spot.
 * With `gus`, their keeper is Goalie Gus at the difficulty and Harrison's is Eddie at tryout 8's Normal keeper (`level` is ignored).
 */
export function keeperWorld(o: { level?: number; difficulty?: Difficulty; seed?: number; power?: boolean; tricks?: boolean; gus?: boolean } = {}): World {
  const d = o.difficulty ?? 'normal';
  const w = createWorld(
    BASE_STATS,
    BASE_STATS,
    o.seed ?? 1,
    { home: 0, away: 0 },
    o.power ? { golden: false } : null,
    null,
    DIFFICULTY.normal,
    NORMAL_HANDLING,
    o.tricks ? trickSetup(d, 'max') : null,
    SCHOOL_STAGE,
    o.gus ? gusLineup(d) : keeperLineup(o.level ?? 1, d),
  );
  Object.assign(w.home, { x: 900, z: 20 });
  Object.assign(w.away, { x: 380, z: 108 });
  w.match.phase = 'playing';
  return w;
}

const intentOf = (w: World, i: PlayerIntent | ((w: World) => PlayerIntent) | undefined): PlayerIntent => (typeof i === 'function' ? i(w) : (i ?? NO_INTENT));

export function runFor(w: World, s: number, home?: PlayerIntent | ((w: World) => PlayerIntent), away?: PlayerIntent): void {
  for (let i = 0; i < Math.round(s / DT); i++) stepWorld(w, intentOf(w, home), away ?? NO_INTENT, DT);
}

/** Steps until `until` or `s` seconds; whether it happened. */
export function runUntil(w: World, s: number, until: (w: World) => boolean, home?: PlayerIntent | ((w: World) => PlayerIntent), away?: PlayerIntent): boolean {
  for (let i = 0; i < Math.round(s / DT); i++) {
    stepWorld(w, intentOf(w, home), away ?? NO_INTENT, DT);
    if (until(w)) return true;
  }
  return false;
}

/** The ball at `b` (on the grass unless y is given), no spin, touchedBy cleared. */
export function setBall(w: World, b: Partial<Ball>): void {
  Object.assign(w.ball, { y: BALL_REST_Y, vx: 0, vy: 0, vz: 0, spin: 0, ...b });
  delete w.ball.touchedBy;
}

/** The ball at `from` (y default BALL_REST_Y), moving at `speed` along the ground toward (goal's lineX, toZ), plus vy. */
export function shotAt(w: World, from: { x: number; z: number; y?: number }, toZ: number, speed: number, vy = 0, goal: 'left' | 'right' = 'right'): void {
  const g = w.field.goals[goal === 'left' ? 0 : 1];
  const [dx, dz] = [g.lineX - from.x, toZ - from.z];
  const d = Math.hypot(dx, dz);
  setBall(w, { x: from.x, z: from.z, y: from.y ?? BALL_REST_Y, vx: (dx / d) * speed, vz: (dz / d) * speed, vy });
}
