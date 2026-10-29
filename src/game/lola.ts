import type { AiBrain, Steer } from './ai';
import { judgedChip, openCorner } from './aiming';
import { GRAVITY } from './constants';
import { aimLine, chip } from './kick';
import { NO_INTENT, PLAYER_H, PLAYER_R, type Player, type PlayerIntent } from './player';
import { chargeTime } from './stats';
import { attackDir } from './styles';
import { startMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';
import { ballAtFeet } from './zones';

/**
 * Lofty Lola chips. On the ball `from` px out from Harrison's goal line with
 * his keeper `keeperOff` or more off it, she chips him to drop under the bar
 * `lineY` px up, her aim error turned into `chargePerDeg` of charge a degree.
 * With Harrison charging at her head-on (within `overAhead` ahead and
 * `overLane` of her line, closing faster than `closing` px/s) she chips over
 * him, the ball's underside `clearPx` above his head where it meets him.
 */
export const LOFT = { keeperOff: 8, from: [90, 230] as const, lineY: 40, chargePerDeg: 0.004, overAhead: 260, overLane: 12, closing: 80, clearPx: 4 };

const STEP = 1 / 60;
/**
 * Gathering the ball for her keeper chip, for at most maxS: walking it in at
 * walkPace, creeping up at creepPace once it's slower than restSpeed px/s,
 * until it's at her feet and slower than settleSpeed. A chip struck at a
 * rolling ball misses it: her wind-up moves slower than a dribble.
 */
const GATHER = { maxS: 1, walkPace: 0.5, creepPace: 0.15, restSpeed: 5, settleSpeed: 30 };
const settled = (w: World, me: Player): boolean => ballAtFeet(me, w.ball) && Math.hypot(w.ball.vx - me.vx, w.ball.vz - me.vz) < GATHER.settleSpeed;
/** Gathering, she closes to this far behind the ball: the middle of her foot's reach, px. */
const FEET_PX = 7;
/** She follows a ball this far ahead of her while winding up, px. */
const FOLLOW_PX = 9;
/** Over this much charge before she lets go, she judges the chip again each tick. */
const REJUDGE = 0.1;
/** The over-chip's charges she weighs, weakest first. */
const OVER_CHARGES = [...Array(15)].map((_, i) => 0.3 + 0.05 * i);

type ChipMove = Extract<TryoutMove, { kind: 'chip' }>;

/**
 * The weakest chip that clears a Harrison coming at her: winding it up, he
 * closes; let go, it meets him while rising or falling, and must be over his
 * head there. Null if none does.
 */
export function overChip(w: World, me: Player, them: Player): number | null {
  const dir = attackDir(me);
  const [gap, closing] = [(them.x - me.x) * dir, -them.vx * dir];
  for (const charge of OVER_CHARGES) {
    const left = gap - closing * charge * chargeTime(me.stats);
    if (left <= 2 * PLAYER_R) return null;
    const k = chip(me.stats, charge, aimLine(w.ball, dir, 'straight', w.field));
    const t = left / (Math.abs(k.vx) + closing);
    const underside = k.vy * t - 0.5 * GRAVITY * t * t;
    if (underside >= PLAYER_H + LOFT.clearPx) return charge;
  }
  return null;
}

/** Her keeper chip or her chip over a charging Harrison, on the ball; null to play as Max does. */
export function loftPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  if (me.state !== 'ground') return null;
  const dir = attackDir(me);
  const goal = w.field.goals.find(g => g.side === (dir > 0 ? 'right' : 'left'))!;
  const [ahead, side] = [(them.x - me.x) * dir, them.z - me.z];
  const inLane = ahead > 0 && ahead <= LOFT.overAhead && Math.abs(side) <= LOFT.overLane;
  if (inLane) {
    // Harrison coming at her: over him at once, or not at all.
    const charge = settled(w, me) && them.state === 'ground' && -them.vx * dir > LOFT.closing ? overChip(w, me, them) : null;
    if (charge === null) return null;
    startMove(brain, { kind: 'chip', t: 0, charge, error: 0, judged: false, pressed: true, aim: 'straight' });
    return { ...NO_INTENT, faceX: dir, chipHeld: true };
  }
  const toLine = (goal.lineX - w.ball.x) * dir;
  const keeper = w.keepers?.[them.team];
  const off = keeper ? (keeper.body.x - goal.lineX) * -dir : 0;
  if (toLine < LOFT.from[0] || toLine > LOFT.from[1] || off < LOFT.keeperOff) return null;
  // Her aim error, as a touch more or less charge, drawn once for the chip.
  const error = (w.rng() * 2 - 1) * brain.profile.aimErrorDeg * LOFT.chargePerDeg;
  const move: ChipMove = { kind: 'chip', t: 0, charge: 0, error, judged: true, pressed: false, aim: 'straight' };
  startMove(brain, move);
  return chipTick(move, w, me, steer);
}

/** A ball running on ahead of her: she winds up on the move after it, as Max does a shot. */
const following = (w: World, me: Player): boolean => (w.ball.x - me.x) * attackDir(me) > FOLLOW_PX;

/**
 * One tick of her chip. For the keeper she first gathers the ball at her
 * feet (GATHER), then judges the chip and presses. Held until her charge reaches it (full at most), then let go; null
 * once it's struck. A judged chip is judged again from where the ball is over
 * its last REJUDGE of charge, so it goes from where she strikes it.
 */
export function chipTick(move: ChipMove, w: World, me: Player, steer: Steer): PlayerIntent | null {
  const dir = attackDir(me);
  if (!move.pressed) {
    if (move.t > GATHER.maxS || me.state !== 'ground') return null;
    if (!settled(w, me)) {
      // Walking it in under close control, then creeping up to it once it's resting, so a touch doesn't knock it on.
      const resting = Math.hypot(w.ball.vx, w.ball.vz) < GATHER.restSpeed;
      const ahead = (w.ball.x - me.x) * dir;
      const pace = ahead <= FOLLOW_PX ? 0 : resting ? GATHER.creepPace : GATHER.walkPace;
      return pace === 0 ? { ...NO_INTENT, faceX: dir } : { ...steer.to(w.ball.x - dir * FEET_PX, w.ball.z), sprint: false, pace, faceX: dir };
    }
    move.aim = openCorner(w, me);
    [move.pressed, move.t, move.charge] = [true, 0, judgedChip(w, me, LOFT.lineY, move.aim) + move.error];
    return { ...NO_INTENT, faceX: dir, chipHeld: true, aim: move.aim };
  }
  if (move.t > 2 * STEP && me.state !== 'chipping') return null;
  const step = STEP / chargeTime(me.stats);
  if (move.judged && me.charge + step >= move.charge - REJUDGE) move.charge = judgedChip(w, me, LOFT.lineY, move.aim) + move.error;
  // A chip judged past full charge goes at full, and no wind-up runs on past a full one.
  const held = me.charge + step <= Math.min(move.charge, 1) && move.t < chargeTime(me.stats) + 2 * STEP;
  return { ...NO_INTENT, moveX: held && following(w, me) ? dir : 0, faceX: dir, chipHeld: held, aim: move.aim };
}
