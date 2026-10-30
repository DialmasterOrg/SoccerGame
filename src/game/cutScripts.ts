import { DIFFICULTY } from './ai';
import { BALL_REST_Y } from './ball';
import type { TurnOutcome } from './closeControl';
import { NO_INTENT, type PlayerIntent } from './player';
import { SCHOOL_STAGE } from './stage';
import { BASE_STATS } from './stats';
import { createWorld, stepWorld, type World } from './world';

/**
 * Staged drills for Harrison's turn with the ball, on the School pitch
 * with Max parked out of the way: a cut from a dribble, and a turn-round
 * from a run up the screen. Each trial's world is seeded by its timing, so
 * every run measures the same rolls.
 */

const STEP = 1 / 60;
/**
 * He dribbles this long before the cut, plus the trial's phaseTicks modulo
 * CUT_SPREAD, so the cut lands at every point between touches while a
 * sprint (a 2 s bar at Stamina 1) still has stamina left; each trial still
 * rolls its own seed.
 */
const RUN_IN_TICKS = 40;
const CUT_SPREAD = 40;
/** He holds the cut this long. */
const CUT_TICKS = 60;
/** A touch within this of his new run counts as taking the ball on his new way, degrees. */
const ON_LINE_DEG = 20;
/** The turn-round's run up the screen: this long, plus phaseTicks modulo TURN_ROUND_SPREAD, then this long after the pull. */
const RUN_UP_TICKS = 18;
const TURN_ROUND_SPREAD = 15;
const TURN_ROUND_TICKS = 30;
/** The ball counts as kept this close, px. */
const KEPT_PX = 30;

export interface CutSetup {
  control: number;
  speed: number;
  sprint: boolean;
  /** The cut's angle from his run along the pitch, degrees; positive is up the screen. */
  deg: number;
  phaseTicks: number;
}

export interface CutTrial {
  /** The first turn with the ball after the cut. */
  turn: TurnOutcome | 'none';
  /** His dribble touches that sent the ball within ON_LINE_DEG of his new run, after any roll was over. */
  keptTouches: number;
}

/** A School world in play: Harrison at (x, z) with the ball `ahead` px in front of him, his own; Max parked. */
function stage(o: { control: number; speed: number; seed: number; x: number; z: number; ball: { x: number; z: number } }): World {
  const w = createWorld({ ...BASE_STATS, control: o.control, speed: o.speed }, BASE_STATS, o.seed, { home: 0, away: 0 }, null, null, DIFFICULTY.normal, undefined, null, SCHOOL_STAGE);
  w.match.phase = 'playing';
  Object.assign(w.away, { x: w.field.width - 30, z: 10 });
  Object.assign(w.home, { x: o.x, z: o.z, facing: 1 });
  Object.assign(w.ball, { x: o.ball.x, y: BALL_REST_Y, z: o.ball.z, vx: 0, vy: 0, vz: 0, touchedBy: 'home' });
  return w;
}

/** He dribbles right from (300, 25), then cuts at `deg` and holds it. */
export function cutTrial(o: CutSetup): CutTrial {
  const w = stage({ ...o, seed: 1000 + o.phaseTicks, x: 300, z: 25, ball: { x: 308, z: 25 } });
  const run: PlayerIntent = { ...NO_INTENT, moveX: 1, sprint: o.sprint };
  for (let i = 0; i < RUN_IN_TICKS + (o.phaseTicks % CUT_SPREAD); i++) stepWorld(w, run, NO_INTENT, STEP);
  const r = (o.deg * Math.PI) / 180;
  const [nx, nz] = [Math.cos(r), Math.sin(r)];
  const cut: PlayerIntent = { ...NO_INTENT, moveX: nx, moveZ: nz, sprint: o.sprint };
  let turn: CutTrial['turn'] = 'none';
  let keptTouches = 0;
  for (let i = 0; i < CUT_TICKS; i++) {
    const cooldown = w.home.touchCooldown;
    stepWorld(w, cut, NO_INTENT, STEP);
    if (turn === 'none' && w.events.turn) turn = w.events.turn;
    const speed = Math.hypot(w.ball.vx, w.ball.vz);
    const touched = w.home.turnTouch === null && w.home.touchCooldown > cooldown && speed > 0;
    if (touched && (w.ball.vx * nx + w.ball.vz * nz) / speed > Math.cos((ON_LINE_DEG * Math.PI) / 180)) keptTouches++;
  }
  return { turn, keptTouches };
}

/** The share of `trials` cut timings (phaseTicks 0 up) that turned cleanly, were heavy, or made no turn touch. */
export function cutRates(o: Omit<CutSetup, 'phaseTicks'>, trials = 120): { heavy: number; turned: number; none: number } {
  const count = { heavy: 0, turned: 0, none: 0 };
  for (let phaseTicks = 0; phaseTicks < trials; phaseTicks++) count[cutTrial({ ...o, phaseTicks }).turn]++;
  return { heavy: count.heavy / trials, turned: count.turned / trials, none: count.none / trials };
}

/** He runs up the screen from (300, 40) with the ball, pulls the stick to `stick`, and keeps the ball if it's ahead of him that way, close, half a second later. */
export function turnRoundTrial(stick: { x: number; z: number }, sprint: boolean, phaseTicks: number): boolean {
  const w = stage({ control: 5, speed: 5, seed: 2000 + phaseTicks, x: 300, z: 40, ball: { x: 300, z: 48 } });
  for (let i = 0; i < RUN_UP_TICKS + (phaseTicks % TURN_ROUND_SPREAD); i++) stepWorld(w, { ...NO_INTENT, moveZ: 1, sprint }, NO_INTENT, STEP);
  const pull: PlayerIntent = { ...NO_INTENT, moveX: stick.x, moveZ: stick.z, sprint };
  for (let i = 0; i < TURN_ROUND_TICKS; i++) stepWorld(w, pull, NO_INTENT, STEP);
  const [dx, dz] = [w.ball.x - w.home.x, w.ball.z - w.home.z];
  const len = Math.hypot(stick.x, stick.z);
  return (dx * stick.x + dz * stick.z) / len > 0 && Math.hypot(dx, dz) < KEPT_PX;
}
