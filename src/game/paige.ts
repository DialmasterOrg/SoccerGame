import { BALL_R } from '../art/ball';
import type { AiBrain, Steer } from './ai';
import { openCorner } from './aiming';
import { MAX_AIM_SLOPE, aimLine, type Aim } from './kick';
import { NO_INTENT, PLAYER_R, type Player, type PlayerIntent } from './player';
import { chargeTime } from './stats';
import { maxHasBall } from './steal';
import { attackDir, goalCentreZ, playedIt, roomySide } from './styles';
import { startMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';

/**
 * Pinpoint Paige sets herself, then picks a corner: on the ball within her
 * shootRange she stands with it at her feet for `setS`, then, with a clear
 * look at the corner away from Harrison's keeper, winds up a hard shot held
 * to `charge` of her charge time. With Harrison in her line, or the corner
 * too tight an angle, she carries the ball across in depth, looking, for up
 * to `lookS`. Her charge lets go under SWEET_SPOT (0.79 of a full one): a
 * PERFECT shot would be exact, and her accuracy is her profile's aimErrorDeg.
 */
export const SNIPE = { setS: 0.3, charge: 0.78, lookS: 1.2 };

/** A look this much clear of Harrison's body, px, beyond his body and the ball touching. */
const LOOK_MARGIN = 2;
/** A look that found nothing: she dribbles on as Max does this long before she sets again, s. */
const RESET_S = 1;

type SetMove = Extract<TryoutMove, { kind: 'set' }>;
type LookMove = Extract<TryoutMove, { kind: 'look' }>;
type SnipeMove = Extract<TryoutMove, { kind: 'snipe' }>;

/** The goal `me` attacks. */
const attacking = (w: World, me: Player) => w.field.goals.find(g => g.side === (attackDir(me) > 0 ? 'right' : 'left'))!;

/** How far she is from the goal line she attacks, px. */
const toGoal = (w: World, me: Player): number => (attacking(w, me).lineX - me.x) * attackDir(me);

/** Harrison's body clear of the line from the ball to where `aim` crosses the goal `me` attacks (centre beyond PLAYER_R + BALL_R + 2 of it). */
export function clearLook(w: World, me: Player, them: Player, aim: Aim): boolean {
  const line = aimLine(w.ball, attackDir(me), aim, w.field);
  const dx = attacking(w, me).lineX - w.ball.x;
  const dz = line.slope * Math.abs(dx);
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return true;
  const u = ((them.x - w.ball.x) * dx + (them.z - w.ball.z) * dz) / len2;
  if (u <= 0 || u >= 1) return true;
  return Math.hypot(w.ball.x + u * dx - them.x, w.ball.z + u * dz - them.z) > PLAYER_R + BALL_R + LOOK_MARGIN;
}

/** Her line to `aim` within the steepest aim there is: from wider, the shot would land short of the post. */
const inReach = (w: World, me: Player, aim: Aim): boolean => Math.abs(aimLine(w.ball, attackDir(me), aim, w.field).slope) < MAX_AIM_SLOPE;

/** A clear look at a corner she can reach. */
const goodLook = (w: World, me: Player, them: Player, aim: Aim): boolean => inReach(w, me, aim) && clearLook(w, me, them, aim);

/** On the ball and upright, were she facing the goal she attacks: she turns onto it as she sets. */
const onBall = (w: World, me: Player): boolean => me.state === 'ground' && maxHasBall({ ...me, facing: attackDir(me) }, w.ball);

/** Still hers to hold at her feet: her close control never undoes Harrison's play on it, as Tia's fake doesn't. */
const stillHers = (w: World, me: Player, them: Player): boolean => onBall(w, me) && !playedIt(w, them);

/**
 * On the ball within her range: her set. She never winds up as Max does:
 * should she not set now (Harrison has just played it, or a look has just
 * found nothing), she dribbles on at goal as he does. Null out of range, to
 * play as Max does.
 */
export function sniperPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null {
  const out = toGoal(w, me);
  if (out <= 0 || out > brain.profile.shootRange) return null;
  brain.plan = 'dribble';
  if (brain.fakeReadyS > 0 || !stillHers(w, me, them)) {
    const g = attacking(w, me);
    return steer.to(g.lineX, goalCentreZ(g));
  }
  const move: SetMove = { kind: 'set', t: 0, aim: openCorner(w, me) };
  startMove(brain, move);
  return setTick(brain, move, w, me, them);
}

/** Her wind-up at `aim`, from where she stands. */
function snipe(brain: AiBrain, w: World, me: Player, them: Player, aim: Aim): PlayerIntent | null {
  const move: SnipeMove = { kind: 'snipe', t: 0, aim };
  startMove(brain, move);
  return snipeTick(move, w, me, them);
}

/**
 * The side, in depth, that opens her look: toward the middle should the
 * corner be out of reach, or else away from Harrison's body, or the roomier
 * side should he stand right on her line.
 */
function lookSide(w: World, me: Player, them: Player, aim: Aim): 1 | -1 {
  if (!inReach(w, me, aim)) return (Math.sign(w.field.depth / 2 - me.z) || 1) as 1 | -1;
  const line = aimLine(w.ball, attackDir(me), aim, w.field);
  const lineZ = w.ball.z + line.slope * Math.abs(them.x - w.ball.x);
  const away = Math.sign(lineZ - them.z) || roomySide(w, them.z, me.z);
  // With no room that way before the touchline, the other.
  const room = away > 0 ? w.field.depth - PLAYER_R - me.z : me.z - PLAYER_R;
  return (room < 2 * PLAYER_R ? -away : away) as 1 | -1;
}

/** One tick of her set: standing with the ball at her feet, then a wind-up with a clear look at a corner in reach, or a look across. Null should she lose it. */
export function setTick(brain: AiBrain, move: SetMove, w: World, me: Player, them: Player): PlayerIntent | null {
  if (!stillHers(w, me, them)) return null;
  const dir = attackDir(me);
  if (move.t < SNIPE.setS) return { ...NO_INTENT, faceX: dir, carry: true };
  // The keeper may have moved as she set: the open corner, read again.
  move.aim = openCorner(w, me);
  if (goodLook(w, me, them, move.aim)) return snipe(brain, w, me, them, move.aim);
  const look: LookMove = { kind: 'look', t: 0, side: lookSide(w, me, them, move.aim) };
  startMove(brain, look);
  return lookTick(brain, look, w, me, them);
}

/**
 * One tick of her look: carrying the ball across in depth, looking at the
 * open corner each tick, and winding up the moment it's clear and in reach.
 * Null once `lookS` is up, and she dribbles on for a while, or should she
 * lose it.
 */
export function lookTick(brain: AiBrain, move: LookMove, w: World, me: Player, them: Player): PlayerIntent | null {
  if (!stillHers(w, me, them)) return null;
  if (move.t > SNIPE.lookS) {
    brain.fakeReadyS = RESET_S;
    return null;
  }
  const aim = openCorner(w, me);
  if (goodLook(w, me, them, aim)) return snipe(brain, w, me, them, aim);
  return { ...NO_INTENT, moveZ: move.side, faceX: attackDir(me), pace: brain.profile.paceFactor, carry: true };
}

/**
 * One tick of her wind-up: planted, the ball held at her feet, let go at
 * SNIPE.charge of her charge time, and the swing seen through. Should
 * Harrison play her ball as she winds up, she drops it without a kick.
 */
export function snipeTick(move: SnipeMove, w: World, me: Player, them: Player): PlayerIntent | null {
  const dir = attackDir(me);
  if (playedIt(w, them)) return me.state === 'charging' ? { ...NO_INTENT, faceX: dir, feint: true } : null;
  if (move.t < SNIPE.charge * chargeTime(me.stats)) {
    const windingUp = move.t === 0 || me.state === 'charging';
    return windingUp ? { ...NO_INTENT, faceX: dir, shootHeld: true, aim: move.aim, carry: true } : null;
  }
  return me.state === 'charging' || me.state === 'kicking' ? { ...NO_INTENT, faceX: dir, aim: move.aim } : null;
}
