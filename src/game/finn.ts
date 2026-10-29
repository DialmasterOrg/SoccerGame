import type { AiBrain } from './ai';
import { NO_INTENT, type Player, type PlayerIntent } from './player';
import { maxHasBall } from './steal';
import { attackDir, pickAim, roomySide } from './styles';
import { startMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';

/**
 * Fake-Out Finn shapes to shoot. With Harrison standing within `trigger` px
 * ahead and `lane` px of his line, and Finn within his shootRange +
 * `trigger` of goal, he winds up a shot and holds it for up to `holdS`. If
 * Harrison commits (slides, taps steal, or closes faster than `lunge` px/s),
 * Finn sees it within `readS`, lets the wind-up go without a kick and cuts
 * the ball past him on the roomier side for `cutS`, then straightens at goal
 * for `goS`. If Harrison waits it out, Finn shoots for real in range, or lets
 * it go and dribbles on. No second shape for `cooldownS`.
 */
export const SHAPE = { trigger: 70, lane: 14, holdS: 0.45, readS: 0.08, lunge: 60, cutS: 0.3, goS: 0.2, cooldownS: 1.5 };

/** The cut: mostly sideways, a little on toward goal. */
const CUT = { x: 0.3, z: 0.95 };
/**
 * He straightens at goal at a wind-up's pace, so the ball is still at his
 * feet when he shoots: a wind-up moves slower than a dribble, and a ball
 * running on at a sprint would leave his foot.
 */
const GO_PACE = 0.5;

type ShapeMove = Extract<TryoutMove, { kind: 'shape' }>;

/** How far he is from the goal line he attacks, px. */
function toGoal(w: World, me: Player): number {
  const dir = attackDir(me);
  const goal = w.field.goals.find(g => g.side === (dir > 0 ? 'right' : 'left'))!;
  return (goal.lineX - me.x) * dir;
}

/** Harrison going in for it: sliding, tapping steal, or closing on him fast. */
const commits = (w: World, me: Player, them: Player): boolean =>
  them.state === 'sliding' || w.events.steal !== null || -them.vx * attackDir(me) > SHAPE.lunge;

/** The shape is over, and no other for a while. */
function over(brain: AiBrain): null {
  brain.fakeReadyS = SHAPE.cooldownS;
  return null;
}

/** His shape to shoot, on the ball with Harrison standing ahead in his lane; null to play as Max does. */
export function shapePlay(brain: AiBrain, w: World, me: Player, them: Player): PlayerIntent | null {
  if (me.state !== 'ground' || them.state !== 'ground' || brain.fakeReadyS > 0) return null;
  const dir = attackDir(me);
  const [ahead, side, out] = [(them.x - me.x) * dir, them.z - me.z, toGoal(w, me)];
  if (ahead <= 0 || ahead > SHAPE.trigger || Math.abs(side) > SHAPE.lane || out <= 0 || out > brain.profile.shootRange + SHAPE.trigger) return null;
  const move: ShapeMove = { kind: 'shape', t: 0, side: roomySide(w, them.z, me.z) as 1 | -1, cutAtS: null, aim: pickAim(w) };
  startMove(brain, move);
  brain.plan = 'dribble';
  return shapeTick(brain, move, w, me, them);
}

/**
 * One tick of his shape. Winding up, planted with the ball held at his feet,
 * he watches Harrison; then lets it go, for real or as a feint and the cut.
 * Null once it's over.
 */
export function shapeTick(brain: AiBrain, move: ShapeMove, w: World, me: Player, them: Player): PlayerIntent | null {
  const dir = attackDir(me);
  const windingUp = me.state === 'charging' || move.t === 0;
  if (move.cutAtS === null && move.t < SHAPE.holdS && commits(w, me, them)) {
    move.cutAtS = move.t + SHAPE.readS;
    move.side = roomySide(w, them.z, me.z) as 1 | -1;
  }
  if (move.t < (move.cutAtS ?? SHAPE.holdS)) return windingUp ? { ...NO_INTENT, faceX: dir, shootHeld: true, aim: move.aim, carry: true } : over(brain);
  if (move.cutAtS === null) {
    // He waited it out: a real shot in range; out of range the shot's let go and he dribbles on.
    if (me.state !== 'charging') return over(brain);
    return { ...NO_INTENT, faceX: dir, aim: move.aim, feint: toGoal(w, me) > brain.profile.shootRange };
  }
  // The feint, then the cut past him under close control, then on at goal.
  const into = move.t - move.cutAtS;
  const feint = me.state === 'charging';
  if (!feint && (me.state !== 'ground' || !maxHasBall(me, w.ball))) return over(brain);
  if (into < SHAPE.cutS) return { ...NO_INTENT, moveX: dir * CUT.x, moveZ: move.side * CUT.z, sprint: true, faceX: dir, carry: true, feint };
  if (into < SHAPE.cutS + SHAPE.goS) return { ...NO_INTENT, moveX: dir, pace: GO_PACE, faceX: dir, carry: true };
  return over(brain);
}
