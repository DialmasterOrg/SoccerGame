import { inGoalBox, type Goal } from './field';
import { holdingKeeper, standOffSpot } from './keeper';
import { LADDER_MATCHES, maxStats } from '../meta/ladder';
import { NO_INTENT, PLAYER_R, type Player, type PlayerIntent } from './player';
import { runSpeed } from './stats';
import { CHASE_OFFSET, DEFEND_COVER, FAKE, POSSESSION_RANGE, RANGE_SHOT, attackDir, chargeHold, defendSpot, fakeMove, goalCentreZ, pickAim, predictBall, pressSprint, roomySide, theirBall } from './styles';
import type { Wave } from './wave';
import { cueMove, looseBallPlay, onBallPlay, tickMove, type TryoutMove } from './tryoutMoves';
import type { World } from './world';
import { REACH_Z } from './zones';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** How an opponent plays, beyond its numbers: Max all round, each of the Park crew's personalities, Speedy Sam, and the tryouts'. */
export type Style = 'allRound' | 'blocker' | 'shooter' | 'dribbler' | 'presser' | 'speedster' | 'header' | 'chipper' | 'faker' | 'poacher';

export interface AiProfile {
  /** Seconds between decisions. */
  reactionS: number;
  aimErrorDeg: number;
  /** Chance (0..1) of sliding in when close to the ball carrier. */
  aggression: number;
  /** Distance from the goal line it starts shooting from. */
  shootRange: number;
  /** Chance (0..1) that it backs off and squares up properly when Harrison powers up. */
  braceSense: number;
  /** How long it takes to start backing off from a powered-up Harrison (its reactions before the fair-Max retune, kept so the wave plays as it did). */
  backOffS: number;
  /** Chance (0..1), before Harrison's Control, that his steal tap takes the ball cleanly off it. */
  cleanSteal: number;
  /** Seconds it stands wrong-footed after Harrison steals the ball off it cleanly. */
  wrongFootedS: number;
  /**
   * Where it waits at Harrison's kickoff: `back` px from the centre spot into its own half,
   * `off` px off the ball's line in depth (deeper, away from the camera).
   */
  kickoffSpot: { back: number; off: number };
  /** At Harrison's kickoff it comes as soon as he starts winding up a kick; otherwise only once he plays the ball. */
  kickoffRush: boolean;
  /** Scales its run and sprint while it plays the ball (not backing off from a powered-up Harrison). */
  paceFactor: number;
  style: Style;
  /** The speedster's chance per decision, blocked on the ball within range, of trying his weak shot from there (RANGE_SHOT). */
  rangeShot?: number;
  /** From this close to the goal line her fake ends in a shot (School Tia); absent, she dribbles on (the Park). */
  fakeShot?: number;
}

export const DIFFICULTY: Record<Difficulty, AiProfile> = {
  easy: { reactionS: 0.22, aimErrorDeg: 8, aggression: 0.3, shootRange: 150, braceSense: 0.5, backOffS: 0.32, cleanSteal: 0.9, wrongFootedS: 0.35, kickoffSpot: { back: 110, off: 20 }, kickoffRush: true, paceFactor: 1, style: 'allRound' },
  normal: { reactionS: 0.16, aimErrorDeg: 6, aggression: 0.55, shootRange: 180, braceSense: 0.75, backOffS: 0.18, cleanSteal: 0.75, wrongFootedS: 0.35, kickoffSpot: { back: 110, off: 24 }, kickoffRush: true, paceFactor: 1.03, style: 'allRound' },
  hard: { reactionS: 0.1, aimErrorDeg: 2, aggression: 0.8, shootRange: 210, braceSense: 0.9, backOffS: 0.1, cleanSteal: 0.55, wrongFootedS: 0.2, kickoffSpot: { back: 70, off: 0 }, kickoffRush: false, paceFactor: 1.1, style: 'allRound' },
};

export interface AiBrain {
  profile: AiProfile;
  nextDecisionS: number;
  intent: PlayerIntent;
  plan: 'chase' | 'dribble' | 'charge' | 'defend' | 'jump' | 'faceWave' | 'backOff' | 'hesitate' | 'fooled' | 'wait';
  /** Time left on the current charge before it releases the shot. */
  chargeLeftS: number;
  /** Time until it may slide again. */
  slideReadyS: number;
  /**
   * While Harrison is powered up: how far off it means to stand, and how
   * long until it starts backing off; 'stay' when it just keeps defending.
   * Null when he isn't powered up.
   */
  backOff: null | 'stay' | { gap: number; inS: number };
  /** Time left standing wrong-footed after Harrison stole the ball off it. */
  wrongFootedS: number;
  /** How long it has held its spot at Harrison's kickoff; null once the ball is played or the hold is over. */
  kickoffHoldS: number | null;
  /** The dribbler's fake under way: side +1 deeper, −1 nearer, the way she leans first; t, how far into it. */
  fake: null | { side: 1 | -1; t: number };
  /** Time until it may fake again: the dribbler's fake, or Finn's shape to shoot. */
  fakeReadyS: number;
  /** Fakes started this match, for the personality check. */
  fakes: number;
  /** A tryout kid's own move under way, played out tick by tick; null when there's none. */
  move: TryoutMove | null;
  /** Moves started this match, by kind, for the personality checks. */
  started: Partial<Record<TryoutMove['kind'], number>>;
}

/** decide's way to a spot, round goals and the opponent, at this decision's sprint and pace: handed to a kid's own play. */
export interface Steer {
  base: PlayerIntent;
  to(x: number, z: number, aimZ?: number): PlayerIntent;
}

const BALL_LOW = 6;
const SLIDE_RANGE = 26;
const SLIDE_COOLDOWN_S = 1.2;
const HIGH_BALL = 30;
const HIGH_BALL_RANGE = 30;
/** On the wrong side of a ball this close, it goes round it rather than pushing it toward its own goal... */
const ROUND_BALL_RANGE = 40;
/** ...passing this far to the side of it. */
const ROUND_BALL_Z = 12;
/** The speedster can't turn sharply, so he starts round a ball from further off and passes wider. */
const SPEEDSTER_ROUND = { range: 120, z: 24 };
/** A challenger running at the speedster faster than `closing` px/s, within `ahead` px and `lane` px of his line: he knocks the ball past him, `side` px wide, aiming `beyond` px past him. */
const KNOCK_PAST = { closing: 80, ahead: 90, lane: 16, side: 26, beyond: 40 };
/** An opponent this close ahead on its path, and this close to the path's line, is in the way: it sidesteps. */
const BLOCKER_AHEAD = 16;
const BLOCKER_SIDE = 10;
/** How far ahead it checks that a sidestep doesn't walk it into a goal. */
const SIDESTEP_LOOKAHEAD = 8;
/** A route that only touches a goal's edge (he stands on it after being pushed out) doesn't count as crossing it. */
const EDGE_SLACK = 0.5;
/** A spot it wants inside a goal moves out to this far from the goal's outline: a body radius and a little. */
const GOAL_CLEARANCE = PLAYER_R + 1;
/** Close enough to a target spot to stop. */
const ARRIVE = 3;
/**
 * It rounds a goal's corners this far out, further than it needs to stop at
 * a spot, so from a corner the way on is always clear of the goal.
 */
const CORNER_CLEARANCE = PLAYER_R + ARRIVE + 1;
/** Facing a wave, it runs at a spot on the beam's line this far ahead of it, so it stays in the lane as it closes. */
const LANE_LOOKAHEAD = 12;
/** Backing off from a powered-up Harrison: where it means to stand, how fast it backpedals, and the room it keeps in front of its goal. */
const BACK_OFF_GAP = { from: 110, spread: 20 };
const BACKPEDAL_PACE = 0.9;
export const BACK_OFF_GOAL_ROOM = 10;
/** Its mistakes: reacting late, or misjudging and stopping too close. */
const LATE_REACTION = { from: 0.6, spread: 0.3 };
const TOO_CLOSE_GAP = { from: 35, spread: 25 };
/** At Harrison's kickoff it holds its spot until he plays the ball, or this long, s. */
export const KICKOFF_HOLD_S = 2;
/** The ball is still on the centre spot within this, px. */
const ON_SPOT = 0.5;

export function createBrain(profile: AiProfile): AiBrain {
  return { profile, nextDecisionS: 0, intent: { ...NO_INTENT }, plan: 'chase', chargeLeftS: 0, slideReadyS: 0, backOff: null, wrongFootedS: 0, kickoffHoldS: null, fake: null, fakeReadyS: 0, fakes: 0, move: null, started: {} };
}

/** A unit stick direction from `me` toward (x, z), or still once there. */
function steer(me: Player, x: number, z: number): [number, number] {
  const [dx, dz] = [x - me.x, z - me.z];
  const d = Math.hypot(dx, dz);
  return d <= ARRIVE ? [0, 0] : [dx / d, dz / d];
}

/**
 * Bodies are solid: if the opponent stands just ahead on its path, it adds
 * a sidestep, toward where it's heading if that's off to one side, otherwise
 * toward the side with more room.
 */
function goRound(w: World, me: Player, them: Player, move: [number, number], goalZ: number): [number, number] {
  const [mx, mz] = move;
  if (mx === 0 && mz === 0) return move;
  const [rx, rz] = [them.x - me.x, them.z - me.z];
  const along = rx * mx + rz * mz;
  const across = rx * mz - rz * mx;
  if (along <= 0 || along > BLOCKER_AHEAD || Math.abs(across) >= BLOCKER_SIDE) return move;
  const preferred = Math.abs(goalZ - them.z) > BLOCKER_SIDE / 2 ? Math.sign(goalZ - them.z) : roomySide(w, them.z, me.z);
  // Never sidestep into a goal: the goal would push him straight back, every tick.
  for (const side of [preferred, -preferred]) {
    const [sx, sz] = [mx, mz + side];
    const d = Math.hypot(sx, sz);
    const ahead = { x: me.x + (sx / d) * SIDESTEP_LOOKAHEAD, z: me.z + (sz / d) * SIDESTEP_LOOKAHEAD };
    if (!w.field.goals.some(g => inGoalBox(g, ahead.x, ahead.z, PLAYER_R))) return [sx / d, sz / d];
  }
  return move;
}

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** A goal's footprint on the ground, grown by `margin`. */
function goalBox(g: Goal, margin: number): Box {
  return { x0: Math.min(g.lineX, g.backX) - margin, x1: Math.max(g.lineX, g.backX) + margin, z0: g.z0 - margin, z1: g.z1 + margin };
}

/** Whether the segment from a to b passes through a box (Liang–Barsky). */
function crosses(a: { x: number; z: number }, b: { x: number; z: number }, box: Box): boolean {
  let [t0, t1] = [0, 1];
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  for (const [p, q] of [
    [-dx, a.x - box.x0],
    [dx, box.x1 - a.x],
    [-dz, a.z - box.z0],
    [dz, box.z1 - a.z],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

/** A spot inside a goal moved out to the nearest place he can stand: in front of it, or past either post. */
export function outOfGoals(w: World, x: number, z: number): { x: number; z: number } {
  for (const g of w.field.goals) {
    if (!inGoalBox(g, x, z, PLAYER_R)) continue;
    const box = goalBox(g, GOAL_CLEARANCE);
    const front = g.side === 'right' ? box.x0 : box.x1;
    const exits = [
      { x: front, z },
      { x, z: box.z0 },
      { x, z: box.z1 },
    ];
    return exits.reduce((m, e) => (Math.hypot(e.x - x, e.z - z) < Math.hypot(m.x - x, m.z - z) ? e : m));
  }
  return { x, z };
}

/**
 * The next spot on the way to (x, z): straight there, unless a goal is in
 * the way, in which case round its front, corner by corner.
 */
export function route(w: World, me: Player, x: number, z: number): { x: number; z: number } {
  for (const g of w.field.goals) {
    const box = goalBox(g, PLAYER_R - EDGE_SLACK);
    if (!crosses(me, { x, z }, box)) continue;
    const corners = goalBox(g, CORNER_CLEARANCE);
    const front = g.side === 'right' ? corners.x0 : corners.x1;
    // In front means on the pitch side of the goal line; beside the goal means behind it.
    const inFront = g.side === 'right' ? me.x < g.lineX : me.x > g.lineX;
    const middle = (g.z0 + g.z1) / 2;
    const sideOf = (depth: number) => (depth < middle ? corners.z0 : corners.z1);
    const corner = { x: front, z: sideOf(inFront ? z : me.z) };
    // Already at that corner: the target's side corner is next, then the target.
    if (Math.hypot(corner.x - me.x, corner.z - me.z) <= ARRIVE) return inFront ? { x, z } : { x: front, z: sideOf(z) };
    return corner;
  }
  return { x, z };
}

/**
 * How it means to answer a power-up: usually back off to just outside
 * blow-away range and square up; otherwise one of its mistakes, each as
 * likely: reacting late, stopping too close, or hesitating where it is
 * instead of backing off. Rolled once per power-up. Whatever it rolls,
 * Harrison can see where it ends up before he shoots.
 */
export function rollBackOff(profile: Pick<AiProfile, 'reactionS' | 'braceSense'>, rng: () => number): 'stay' | { gap: number; inS: number } {
  const gap = BACK_OFF_GAP.from + rng() * BACK_OFF_GAP.spread;
  if (rng() < profile.braceSense) return { gap, inS: profile.reactionS };
  const mistake = Math.floor(rng() * 3);
  if (mistake === 0) return { gap, inS: LATE_REACTION.from + rng() * LATE_REACTION.spread };
  if (mistake === 1) return { gap: TOO_CLOSE_GAP.from + rng() * TOO_CLOSE_GAP.spread, inS: profile.reactionS };
  return 'stay';
}

/** Backpedalling, nobody goes faster than rung-10 Max, so the wave's chase-down works against every opponent. */
const BACKPEDAL_TOP = runSpeed(maxStats(LADDER_MATCHES));

/**
 * Harrison is powered up: it backpedals toward its own goal, facing him,
 * to `gap` px from the ball, in line with it, and stands square there. It
 * backpedals slower than he runs, and no faster than rung-10 Max, so he can
 * chase it down, and in front of its goal it runs out of room.
 */
function backOff(brain: AiBrain, w: World, me: Player, them: Player, gap: number): void {
  brain.plan = 'backOff';
  const ball = w.ball;
  const dir = -attackDir(me);
  const own = w.field.goals.find(g => g.side === (dir > 0 ? 'right' : 'left'))!;
  const x = dir > 0 ? Math.min(ball.x + gap, own.lineX - BACK_OFF_GOAL_ROOM) : Math.max(ball.x - gap, own.lineX + BACK_OFF_GOAL_ROOM);
  const z = ball.z + (goalCentreZ(own) - ball.z) * DEFEND_COVER;
  const [mx, mz] = goRound(w, me, them, steer(me, x, z), z);
  const pace = Math.min(1, BACKPEDAL_TOP / runSpeed(me.stats));
  brain.intent = { ...NO_INTENT, moveX: mx * BACKPEDAL_PACE, moveZ: mz * BACKPEDAL_PACE, faceX: Math.sign(ball.x - me.x) >= 0 ? 1 : -1, ...(pace < 1 && { pace }) };
}

/**
 * The Energy Wave Harrison just fired is on its way: Max stays square to
 * it and keeps coming along its line, so whether he braces is the wave's
 * to decide, not a turn to chase the loose ball.
 */
function faceWave(brain: AiBrain, w: World, me: Player, wave: Wave): void {
  brain.plan = 'faceWave';
  const ball = w.ball;
  const toward = Math.sign(ball.x - me.x) || -me.facing;
  const x = Math.abs(ball.x - me.x) > LANE_LOOKAHEAD ? me.x + toward * LANE_LOOKAHEAD : ball.x;
  const laneZ = wave.originZ + (wave.dirZ / Math.max(wave.dirX, 1e-3)) * (x - wave.originX);
  const [moveX, moveZ] = steer(me, x, laneZ);
  brain.intent = { ...NO_INTENT, moveX: moveX || toward, moveZ };
}

/** The way to a spot this decision: sprinting as its style does for the ball's distance, at its pace, round goals and the opponent. */
export function steerFor(brain: AiBrain, w: World, me: Player, them: Player): Steer {
  const dist = Math.hypot(w.ball.x - me.x, w.ball.z - me.z);
  const base: PlayerIntent = { ...NO_INTENT, sprint: pressSprint(brain.profile.style, dist, me.stamina), pace: brain.profile.paceFactor };
  return {
    base,
    to(x, z, aimZ = z) {
      const spot = outOfGoals(w, x, z);
      const next = route(w, me, spot.x, spot.z);
      // Rounding a goal, it passes the opponent on the side of the corner it's heading for.
      const sideZ = next.x === spot.x && next.z === spot.z ? aimZ : next.z;
      const [moveX, moveZ] = goRound(w, me, them, steer(me, next.x, next.z), sideZ);
      return { ...base, moveX, moveZ };
    },
  };
}

function decide(brain: AiBrain, w: World, me: Player, them: Player): void {
  const { profile } = brain;
  const dir = attackDir(me);
  const ball = w.ball;
  const low = ball.y <= BALL_LOW;
  const ahead = (ball.x - me.x) * dir;
  const inLine = Math.abs(ball.z - me.z) <= REACH_Z;
  const dist = Math.hypot(ball.x - me.x, ball.z - me.z);
  const steering = steerFor(brain, w, me, them);
  const intent = steering.base;
  const moveTo = steering.to;
  const attacking = w.field.goals.find(g => g.side === (dir > 0 ? 'right' : 'left'))!;
  const defending = w.field.goals.find(g => g !== attacking)!;
  const toGoal = (attacking.lineX - me.x) * dir;
  const speedster = profile.style === 'speedster';

  // Has the ball: dribble at goal, and shoot once in range.
  if (low && ahead >= 0 && ahead <= POSSESSION_RANGE && inLine) {
    const charging = brain.plan === 'charge' && brain.intent.shootHeld;
    if (charging) return;
    const [blockAhead, blockSide] = [(them.x - me.x) * dir, them.z - me.z];
    // With a challenger rushing at him in his lane, he knocks it past him on the roomier side, out of range of a shot.
    const rushing = them.vx * -dir > KNOCK_PAST.closing;
    if (speedster && rushing && toGoal > profile.shootRange && blockAhead > 0 && blockAhead <= KNOCK_PAST.ahead && Math.abs(blockSide) <= KNOCK_PAST.lane) {
      brain.plan = 'dribble';
      const passZ = them.z + (Math.sign(me.z - them.z) || roomySide(w, them.z, me.z)) * KNOCK_PAST.side;
      brain.intent = moveTo(them.x + dir * KNOCK_PAST.beyond, Math.min(Math.max(passZ, PLAYER_R), w.field.depth - PLAYER_R));
      return;
    }
    // A tryout kid's own play with the ball, if it has one now.
    const own = onBallPlay(brain, w, me, them, steering);
    if (own) {
      brain.intent = own;
      return;
    }
    // Blocked by one waiting in his lane, the speedster may try his weak shot from range instead of running into him.
    const blocked = blockAhead > 0 && blockAhead <= RANGE_SHOT.blockedAhead && Math.abs(blockSide) <= RANGE_SHOT.lane;
    const rangeShot = speedster && blocked && toGoal > 0 && toGoal <= RANGE_SHOT.from && w.rng() < (profile.rangeShot ?? 0);
    if ((toGoal > 0 && toGoal <= profile.shootRange) || rangeShot) {
      startCharge(brain, w, intent, dir);
      return;
    }
    brain.plan = 'dribble';
    // The dribbler fakes an opponent standing just ahead in her lane: she leans first toward the tighter side, so the cut takes the room.
    const [themAhead, themSide] = [(them.x - me.x) * dir, them.z - me.z];
    if (profile.style === 'dribbler' && brain.fakeReadyS === 0 && themAhead > 0 && themAhead <= FAKE.trigger && Math.abs(themSide) <= FAKE.lane) {
      brain.fake = { side: -roomySide(w, them.z, me.z) as 1 | -1, t: 0 };
      brain.fakes++;
      fakeTick(brain, w, me, dir);
      return;
    }
    // Behind the line it attacks, the ball is in a pocket beside the goal with no room to get round it:
    // run into it, so it is touched or popped back out toward the pitch.
    const behindLine = (attacking.lineX - ball.x) * dir < 0;
    brain.intent = behindLine ? moveTo(ball.x, ball.z) : moveTo(attacking.lineX, goalCentreZ(attacking));
    return;
  }

  // On the wrong side of the ball it passes it to one side, so it never runs the ball back at its own goal.
  const round = speedster ? SPEEDSTER_ROUND : { range: ROUND_BALL_RANGE, z: ROUND_BALL_Z };
  const wrongSide = low && ahead < 0 && -ahead <= round.range;
  const side = Math.sign(me.z - ball.z) || roomySide(w, ball.z, me.z);
  const besideZ = Math.min(Math.max(ball.z + side * round.z, PLAYER_R), w.field.depth - PLAYER_R);

  // The opponent has it: get goal-side across the pitch, and slide in when close.
  if (low && theirBall(profile.style, w, them)) {
    brain.plan = 'defend';
    // The speedster coming back from behind it goes round, never through it: his long touch, or a slide, would send it at his own goal.
    if (speedster && wrongSide) {
      brain.intent = moveTo(defendSpot(profile.style, w, me, defending).x, besideZ);
      return;
    }
    const facingBall = Math.sign(ball.x - me.x) === me.facing;
    const close = dist <= SLIDE_RANGE;
    if (close && !facingBall) {
      // Turn to face the ball, or it would stand on its spot facing away and never challenge.
      // Steer at it in depth too: a full-speed run along x alone overshoots a ball off his line.
      const [moveX, moveZ] = steer(me, ball.x, ball.z);
      brain.intent = { ...intent, moveX: moveX || Math.sign(ball.x - me.x), moveZ };
      return;
    }
    if (close && inLine && brain.slideReadyS === 0 && w.rng() < profile.aggression) {
      brain.slideReadyS = SLIDE_COOLDOWN_S;
      brain.intent = { ...intent, chipHeld: true };
      return;
    }
    const spot = defendSpot(profile.style, w, me, defending);
    brain.intent = moveTo(spot.x, spot.z);
    return;
  }

  // A tryout kid's own play for a loose ball, if it has one now.
  const loose = looseBallPlay(brain, w, me, them, steering);
  if (loose) {
    brain.intent = loose;
    return;
  }
  // Loose ball: head it if it's overhead, otherwise get behind it. The speedster only heads one he faces upfield: turned the other way, it would go at his own goal.
  const headsUpfield = !speedster || Math.sign(ball.x - me.x) === dir;
  if (ball.y > HIGH_BALL && Math.abs(ball.x - me.x) <= HIGH_BALL_RANGE && inLine && headsUpfield) {
    brain.plan = 'jump';
    brain.intent = { ...intent, moveX: Math.sign(ball.x - me.x), jump: true, aim: 'straight' };
    return;
  }
  brain.plan = 'chase';
  const at = predictBall(w);
  const behindX = at.x - dir * CHASE_OFFSET;
  // Against a fence there's no room to get behind the ball: play it from where it is.
  if (behindX < w.field.fenceL + PLAYER_R || behindX > w.field.fenceR - PLAYER_R) {
    brain.intent = moveTo(at.x, at.z);
    return;
  }
  brain.intent = moveTo(behindX, wrongSide ? besideZ : at.z, at.z);
}

/** It winds up a shot at goal, held for its style's time, at Max's aim. */
function startCharge(brain: AiBrain, w: World, base: PlayerIntent, dir: 1 | -1): void {
  brain.plan = 'charge';
  brain.chargeLeftS = chargeHold(brain.profile.style, w.rng);
  brain.intent = { ...base, moveX: dir, shootHeld: true, aim: pickAim(w) };
}

/** Her fake is over: she stops carrying the ball and decides afresh this tick. */
function endFake(brain: AiBrain): void {
  brain.fake = null;
  brain.fakeReadyS = FAKE.cooldownS;
  brain.nextDecisionS = 0;
  brain.intent = { ...brain.intent, carry: false };
}

/** Whether `them` played the ball last tick: touched, kicked or tackled it, or poked or trapped it with the steal. */
function playedIt(w: World, them: Player): boolean {
  const ev = w.events.kicks[them.team === 'home' ? 0 : 1];
  const stealt = them.team === 'home' && (w.events.steal === 'poked' || w.events.steal === 'trapped');
  return stealt || (ev !== undefined && (ev.touched || ev.kicked !== null || ev.tackledBall));
}

/** Her fake just ended with the ball at her feet within her fakeShot of the line she attacks: School Tia shoots, whatever her shootRange. */
function fakeEndsInShot(brain: AiBrain, w: World, me: Player, dir: 1 | -1): boolean {
  const from = brain.profile.fakeShot;
  if (from === undefined || !atFeet(w, me)) return false;
  const goal = w.field.goals.find(g => g.side === (dir > 0 ? 'right' : 'left'))!;
  const toGoal = (goal.lineX - me.x) * dir;
  return toGoal > 0 && toGoal <= from;
}

/** One tick of her fake: her move, with the ball kept at her feet; ends it when it's over, in a shot if it ends in one. */
function fakeTick(brain: AiBrain, w: World, me: Player, dir: 1 | -1): boolean {
  const move = brain.fake && fakeMove(brain.fake, dir);
  if (!move) {
    endFake(brain);
    if (!fakeEndsInShot(brain, w, me, dir)) return false;
    startCharge(brain, w, { ...NO_INTENT, pace: brain.profile.paceFactor }, dir);
    return true;
  }
  brain.plan = 'dribble';
  // She keeps facing the goal she attacks, so the ball stays in front of her as she eases back.
  brain.intent = { ...NO_INTENT, ...move, faceX: dir, carry: true };
  return true;
}

/** Whatever a kid's move was, it's gone once play stops, Harrison powers up or his wave is live, a keeper holds the ball, or it's fooled or robbed. */
function moveInterrupted(w: World, me: Player, them: Player): boolean {
  const powered = them.team === 'home' && ((w.power?.activeS ?? 0) > 0 || w.wave?.live === true);
  const robbed = me.team === 'away' && w.events.steal === 'stole';
  return w.match.phase !== 'playing' || powered || holdingKeeper(w) !== null || me.fooled !== null || robbed;
}

/** The ball at its feet: low, just ahead of it, on its line. */
function atFeet(w: World, me: Player): boolean {
  const ahead = (w.ball.x - me.x) * attackDir(me);
  return w.ball.y <= BALL_LOW && ahead >= 0 && ahead <= POSSESSION_RANGE && Math.abs(w.ball.z - me.z) <= REACH_Z;
}

/**
 * At Harrison's kickoff Max holds his spot until Harrison plays the ball
 * (it leaves the centre spot), or, with `kickoffRush`, starts winding up a
 * kick, or for KICKOFF_HOLD_S if he does neither: the game's version of
 * waiting outside the centre circle. Counts the hold; what ends it early
 * starts his reaction time.
 */
function holdingKickoff(brain: AiBrain, w: World, them: Player, dt: number): boolean {
  if (brain.kickoffHoldS === null || w.match.phase === 'kickoff') return false;
  const onSpot = Math.hypot(w.ball.x - w.field.width / 2, w.ball.z - w.field.depth / 2) <= ON_SPOT;
  const windingUp = brain.profile.kickoffRush && (them.state === 'charging' || them.state === 'chipping' || them.state === 'kicking');
  if (w.match.phase === 'playing' && onSpot && !windingUp && brain.kickoffHoldS < KICKOFF_HOLD_S - 1e-9) {
    brain.kickoffHoldS += dt;
    return true;
  }
  // Standing at his spot, he sees Harrison play the ball (or wind up) and reacts at his own pace, not on the instant.
  if ((!onSpot || windingUp) && brain.kickoffHoldS > 0) brain.nextDecisionS = brain.profile.reactionS;
  brain.kickoffHoldS = null;
  return false;
}

/** How far off his sway spot a confused player stops steering to it, px. */
const SWAY_STOP = 1;
/** The pace he sways at. */
const SWAY_PACE = 0.5;

/**
 * Fooled by Harrison's trick: confused, he sways a step in depth to his
 * sway spot, then stands facing the ball; stumbling, he lets go of the
 * stick and his own brakes carry him on. Either way he never slides, jumps
 * or plays the ball, and decides afresh the moment it ends.
 */
function fooledTick(brain: AiBrain, w: World, me: Player): void {
  const fooled = me.fooled!;
  brain.plan = 'fooled';
  brain.fake = null;
  brain.nextDecisionS = 0;
  if (fooled.kind === 'stumble') {
    brain.intent = { ...NO_INTENT };
    return;
  }
  const dz = fooled.swayZ - me.z;
  const faceX = Math.sign(w.ball.x - me.x) >= 0 ? 1 : -1;
  brain.intent = Math.abs(dz) > SWAY_STOP ? { ...NO_INTENT, moveZ: Math.sign(dz), pace: SWAY_PACE, faceX } : { ...NO_INTENT, faceX };
}

/**
 * The computer player's intent for this tick. It re-decides every
 * reactionS and holds its intent in between; a charged shot releases on
 * its own timer. Jumps and slides are one-tick presses.
 */
export function think(brain: AiBrain, w: World, me: Player, them: Player, dt: number): PlayerIntent {
  brain.nextDecisionS -= dt;
  brain.slideReadyS = Math.max(0, brain.slideReadyS - dt);
  brain.fakeReadyS = Math.max(0, brain.fakeReadyS - dt);
  if (brain.fake) brain.fake.t += dt;
  // Robbed by Harrison's clean steal, Max is wrong-footed: whatever he meant to do is gone.
  if (me.team === 'away' && w.events.steal === 'stole') {
    brain.wrongFootedS = brain.profile.wrongFootedS;
    brain.intent = { ...NO_INTENT };
    brain.plan = 'chase';
    brain.fake = null;
  }
  // A fake ends early if the opponent plays her ball, she loses it, or play stops: her close control never undoes his touch.
  if (brain.fake && (playedIt(w, them) || !atFeet(w, me) || w.match.phase !== 'playing')) endFake(brain);
  // A move ends the tick play changes: play stops, Harrison powers up or fires, a keeper has the ball, it's fooled or robbed.
  const interrupted = moveInterrupted(w, me, them);
  if (brain.move && interrupted) {
    brain.move = null;
    brain.intent = { ...NO_INTENT };
    brain.nextDecisionS = 0;
  }
  // And one can start the tick something happens, whatever the decision clock says: Priya follows in a shot.
  if (!interrupted) cueMove(brain, w, me, them);
  // Waiting for Harrison's kickoff, Max means to hold his spot once play starts.
  if (me.team === 'away' && w.match.phase === 'kickoff') brain.kickoffHoldS = w.match.kickoffTeam === them.team ? 0 : null;
  let released = false;
  if (brain.plan === 'charge' && brain.intent.shootHeld) {
    brain.chargeLeftS -= dt;
    if (brain.chargeLeftS <= 0) {
      brain.intent = { ...brain.intent, shootHeld: false };
      released = true;
    }
  }
  // The wave Harrison just fired, still on its way: it stays square to it every tick until it arrives.
  const wave = them.team === 'home' && w.wave?.live && w.wave.outcome === null ? w.wave : null;
  const powered = them.team === 'home' && (w.power?.activeS ?? 0) > 0;
  if (!powered) brain.backOff = null;
  else if (brain.backOff === null) brain.backOff = rollBackOff({ reactionS: brain.profile.backOffS, braceSense: brain.profile.braceSense }, w.rng);
  const backing = brain.backOff !== null && brain.backOff !== 'stay' ? brain.backOff : null;
  if (backing) backing.inS -= dt;
  const holder = holdingKeeper(w);
  if (wave) {
    faceWave(brain, w, me, wave);
    brain.nextDecisionS = brain.profile.reactionS;
  } else if (me.fooled) {
    fooledTick(brain, w, me);
  } else if (holder) {
    // A keeper has it: nobody plays it or crowds him. It waits off him, facing the ball, and decides afresh once he lets go.
    const off = standOffSpot(w, me, holder);
    const spot = outOfGoals(w, off.x, off.z);
    const next = route(w, me, spot.x, spot.z);
    const [moveX, moveZ] = steer(me, next.x, next.z);
    brain.plan = 'wait';
    brain.intent = { ...NO_INTENT, moveX, moveZ, pace: brain.profile.paceFactor, faceX: Math.sign(w.ball.x - me.x) >= 0 ? 1 : -1 };
    brain.nextDecisionS = 0;
  } else if (backing && backing.inS <= 0) {
    // Committed: it re-aims every tick to keep its distance while he's powered up.
    backOff(brain, w, me, them, backing.gap);
    brain.nextDecisionS = brain.profile.reactionS;
  } else if (powered) {
    // Before it reacts, or when it doesn't back off at all, it hesitates where it is: it never challenges a powered-up Harrison.
    brain.plan = 'hesitate';
    brain.intent = { ...NO_INTENT, faceX: Math.sign(w.ball.x - me.x) >= 0 ? 1 : -1 };
    brain.nextDecisionS = brain.profile.reactionS;
  } else if (holdingKickoff(brain, w, them, dt)) {
    brain.intent = { ...NO_INTENT, faceX: Math.sign(w.ball.x - me.x) >= 0 ? 1 : -1 };
  } else if (brain.wrongFootedS > 1e-9) {
    // Wrong-footed, he stands facing the ball, never sliding, then challenges again.
    brain.wrongFootedS = Math.max(0, brain.wrongFootedS - dt);
    brain.intent = { ...NO_INTENT, faceX: Math.sign(w.ball.x - me.x) >= 0 ? 1 : -1 };
  } else if (brain.fake && fakeTick(brain, w, me, attackDir(me))) {
    // Faking: she plays it out tick by tick, as the back-off does.
    brain.nextDecisionS = brain.profile.reactionS;
  } else if (brain.move && tickMove(brain, w, me, them, dt, steerFor(brain, w, me, them))) {
    // A tryout kid's move, played out tick by tick as the fake is; once it's over it decides afresh this tick.
    brain.nextDecisionS = brain.profile.reactionS;
  } else if (!released && brain.nextDecisionS <= 1e-9) {
    // A decision on the release tick could start a new charge and swallow the shot, so it waits a tick.
    decide(brain, w, me, them);
    brain.nextDecisionS = brain.profile.reactionS;
  }
  const out = { ...brain.intent };
  brain.intent = { ...brain.intent, jump: false, chipHeld: false };
  return out;
}
