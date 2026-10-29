import type { AiBrain, Steer } from './ai';
import { openCorner } from './aiming';
import { GRAVITY, AIR_DRAG, SPIN_DIP } from './constants';
import type { Aim } from './kick';
import { NO_INTENT, type Player, type PlayerIntent } from './player';
import { SPRINT_MULTIPLIER, jumpVelocity, runSpeed } from './stats';
import { attackDir } from './styles';
import { startMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';
import { REACH_Z } from './zones';

/**
 * Header Hank wins high balls. `headY` is the middle of a player's head
 * zone above his feet; he meets the ball with his head `rise` of the way up
 * his jump; he goes for a ball whose spot he can sprint to within `reachS`;
 * within `range` of the goal he attacks he heads at the open corner.
 */
export const HEADING = { headY: 37, rise: 0.6, range: 160, reachS: 1.2 };

const STEP = 1 / 60;
/** He meets the ball this far below the top of its flight, so it's still coming down. */
const PEAK_SLACK = 2;
/** The longest flight he reads ahead, s. */
const FLIGHT_S = 3;
/** He stands this far behind the spot along his facing, so the ball meets the middle of his head. */
const UNDER = 3;
/** He jumps if his run carries him to within this far of where he means to be when it meets his head, px. */
const SET_PX = 6;

type HeadMove = Extract<TryoutMove, { kind: 'head' }>;

/**
 * Where a high ball will pass head height on its way down, and in how long;
 * null if it won't. Head height is his head `rise` of the way up his jump,
 * or just under the ball's peak if it won't get that high; riseS is how long
 * his jump takes to get his head there.
 */
export function headSpot(w: World, me: Player): { x: number; z: number; inS: number; riseS: number } | null {
  const vy0 = jumpVelocity(me.stats);
  const apex = (vy0 * vy0) / (2 * GRAVITY);
  // Its flight on from here, as the ball steps it in the air (gravity, topspin's dip, drag), with no collisions.
  let { x, y, z, vx, vy, vz } = w.ball;
  const g = GRAVITY + Math.max(w.ball.spin, 0) * SPIN_DIP;
  const path: { x: number; y: number; z: number; vy: number }[] = [];
  for (let t = 0; t < FLIGHT_S && y > 0; t += STEP) {
    path.push({ x, y, z, vy });
    vy -= g * STEP;
    const drag = 1 - AIR_DRAG * STEP;
    [vx, vy, vz] = [vx * drag, vy * drag, vz * drag];
    [x, y, z] = [x + vx * STEP, y + vy * STEP, z + vz * STEP];
  }
  const peak = Math.max(...path.map(p => p.y), -Infinity);
  const meetY = Math.min(HEADING.headY + apex * HEADING.rise, peak - PEAK_SLACK);
  if (meetY < HEADING.headY) return null;
  const i = path.findIndex((p, k) => k > 0 && p.vy < 0 && p.y <= meetY && path[k - 1]!.y > meetY);
  if (i < 0) return null;
  const rise = meetY - HEADING.headY;
  const riseS = (vy0 - Math.sqrt(Math.max(vy0 * vy0 - 2 * GRAVITY * rise, 0))) / GRAVITY;
  return { x: path[i]!.x, z: path[i]!.z, inS: i * STEP, riseS };
}

/** At the goal he attacks when in range of it; straight on, upfield, elsewhere. */
function headAim(w: World, me: Player, at: { x: number }): Aim {
  const goal = w.field.goals.find(g => g.side === (attackDir(me) > 0 ? 'right' : 'left'))!;
  return Math.abs(goal.lineX - at.x) <= HEADING.range ? openCorner(w, me) : 'straight';
}

/** One tick under the ball: run to where it comes down, facing upfield, and jump so his head meets it; null once it's over. */
export function headTick(move: HeadMove, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  const dir = attackDir(me);
  // In the air he keeps facing upfield with his aim, so the ball meets his head; landed, or down, the move is over.
  if (move.jumped) return me.state === 'air' ? { ...NO_INTENT, faceX: dir, aim: move.aim } : null;
  if (me.state !== 'ground') return null;
  const spot = headSpot(w, me);
  if (!spot) return null;
  const stand = { x: spot.x - dir * UNDER, z: spot.z };
  [move.at, move.jumpInS] = [{ x: spot.x, z: spot.z }, spot.inS - spot.riseS];
  const aim = headAim(w, me, spot);
  // His run carries on through the air, so he's set if it takes him under the ball by the time it meets his head.
  const [atX, atZ] = [me.x + me.vx * spot.riseS, me.z + me.vz * spot.riseS];
  const set = Math.abs(atX - stand.x) <= SET_PX && Math.abs(atZ - stand.z) <= REACH_Z;
  if (move.jumpInS <= STEP / 2) {
    if (!set) return null;
    [move.jumped, move.aim] = [true, aim];
    return { ...NO_INTENT, jump: true, faceX: dir, aim };
  }
  // He runs at the pace that has him under the ball as it meets his head, flat out if that's what it takes.
  const need = Math.hypot(stand.x - me.x, stand.z - me.z) / (move.jumpInS + spot.riseS);
  const pace = Math.min(1, need / (runSpeed(me.stats) * SPRINT_MULTIPLIER));
  return { ...steer.to(stand.x, stand.z), sprint: true, pace, faceX: dir, aim };
}

/** Goes for a high ball whose spot he can get to within reachS, and before Harrison. */
export function headPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (me.state !== 'ground') return null;
  const spot = headSpot(w, me);
  if (!spot) return null;
  const dir = attackDir(me);
  const mine = Math.hypot(spot.x - dir * UNDER - me.x, spot.z - me.z);
  const reachS = mine / (runSpeed(me.stats) * SPRINT_MULTIPLIER);
  if (reachS > HEADING.reachS || Math.hypot(spot.x - them.x, spot.z - them.z) < mine) return null;
  const move: HeadMove = { kind: 'head', t: 0, at: { x: spot.x, z: spot.z }, jumpInS: spot.inS - spot.riseS, jumped: false, aim: 'straight' };
  const intent = headTick(move, w, me, them, steer);
  if (intent) startMove(brain, move);
  return intent;
}
