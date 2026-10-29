import { ballOutOfPlay } from './keeper';
import type { Difficulty, Style } from './ai';
import { BALL_REST_Y } from './ball';
import { KEEP_OUT_X, canPlace } from './contact';
import { ballIsHis } from './dragBack';
import { PLAYER_R, type Player, type PlayerIntent } from './player';
import { addMeter } from './power';
import { FOOT_SPOT } from './steal';
import type { World } from './world';

/**
 * Harrison's skill moves, from level 4. With the ball at his feet, the
 * right stick down is a stepover and up a rainbow flick. Either plays out
 * in full once started, the ball carried by the trick, and sells half way
 * through: a defender squared up to him then is fooled. The trick draws no
 * random numbers, so a match without a trick press plays exactly as before.
 */

export type TrickKind = 'stepover' | 'flick';

/** The window a defender must be in at the sell (gap along Harrison's facing, px), and how long a fooled one's reaction lasts, s. */
export interface TrickProfile {
  near: number;
  far: number;
  confusedS: number;
  stumbleS: number;
}

/** This opponent's reaction times as a share of the difficulty's. */
export interface TrickScale {
  stepover: number;
  flick: number;
}

/** What a match's tricks are worth against this opponent; null in the world when Harrison hasn't the tricks. */
export interface TrickSetup {
  profile: TrickProfile;
  scale: TrickScale;
}

/**
 * The windows are the spec's; Hard's times went from 0.5 to 0.6 s in the
 * tuning. Measured with trickTuning's scripts (seeds 100-163, 2026-10-28):
 * fooling tricks that beat Max E/N/H .84/.76/.74; trickster wins vs Max
 * E/N/H .688/.672/.063 (plain .875/.625/.016); spammer wins E/N/H
 * .438/.203/.047; vs Biscuit on Normal plain .625, trickster .656, spammer
 * 0; vs Sam, plain/spammer E .672/.719, N .516/.500. Personalities
 * (Normal, seeds 100-131): fooling stepovers that beat Max 1.00, Tia .57,
 * Brick 0 (Pete .87 over 64 seeds); a Sam fooled at speed ends 49.4 px
 * past Harrison, a fooled Max 29.4 (64 seeds). Mutable, for headless
 * sweeps.
 */
export const TRICK_DIFFICULTY: Record<Difficulty, TrickProfile> = {
  easy: { near: 12, far: 56, confusedS: 0.9, stumbleS: 0.9 },
  normal: { near: 14, far: 46, confusedS: 0.7, stumbleS: 0.7 },
  hard: { near: 16, far: 38, confusedS: 0.6, stumbleS: 0.6 },
};

/**
 * Each style's reaction times as a share of the difficulty's: Pete bites
 * hardest, Brick barely moves for a stepover, Tia recovers quickly, and
 * Sam's soft brakes skid him on past. Sam stays ×1 (the parent's call,
 * 2026-10-28): at ×2 mashing the tricks beat him on Easy .906 to .672. Mutable,
 * for headless sweeps.
 */
export const TRICK_SCALE: Record<Style, TrickScale> = {
  allRound: { stepover: 1, flick: 1 },
  blocker: { stepover: 0.3, flick: 1.2 },
  shooter: { stepover: 1, flick: 1 },
  dribbler: { stepover: 0.6, flick: 0.6 },
  presser: { stepover: 1.5, flick: 1.5 },
  speedster: { stepover: 1, flick: 1 },
  // The tryouts are fooled like Max.
  header: { stepover: 1, flick: 1 },
  chipper: { stepover: 1, flick: 1 },
};

/** Biscuit's own window and times. Mutable, for headless sweeps. */
export const DOG_TRICKS: Record<Difficulty, TrickProfile> = {
  easy: { ...TRICK_DIFFICULTY.easy },
  normal: { ...TRICK_DIFFICULTY.normal },
  hard: { ...TRICK_DIFFICULTY.hard },
};

/** A defender this far either side of Harrison's line, px, is in his lane. */
export const TRICK_LANE = 14;
/** A defender facing him from in front within this far sees a trick, px... */
export const SEE_RANGE = 120;
/** ...and, seeing one that doesn't fool him, or once a fooling ends, is wise to them for this long, s. */
export const WISE_S = 3;
/** The ball this close to the centre spot hasn't been played yet, px (as the brain's kickoff hold has it). */
const ON_SPOT = 0.5;

/** The stepover: its length and sell, s; his pace along his facing meanwhile; how far a confused defender sways, px. */
export const STEPOVER = { durationS: 0.4, sellS: 0.2, pace: 0.5, swayPx: 8 };

/**
 * The rainbow flick: its length and release, s; the launch, px/s; how high
 * the ball rides up the back of his leg and how far behind his feet it
 * leaves his heel, px; its backspin. From rideY it peaks about 78 px up,
 * clears a standing player 12-56 px ahead and lands about 90 px on, just
 * ahead of him running after it, and the backspin sits it down for him.
 */
export const FLICK = { durationS: 0.5, sellS: 0.25, vx: 130, vy: 360, rideY: 12, behind: 6, spin: -6 };

/** After a trick ends, a trick press does nothing for this long, s. */
export const TRICK_COOLDOWN_S = 1;

/** What the tricks did this tick. */
export interface TrickEvents {
  started: TrickKind | null;
  /** The flick left his heel. */
  released: boolean;
  /** A trick sold and fooled the defender. */
  fooled: TrickKind | null;
}

export const quietTricks = (): TrickEvents => ({ started: null, released: false, fooled: null });

/** The gap from Harrison to the defender along his facing, px. */
const gapAhead = (w: World, d: Player): number => (d.x - w.home.x) * w.home.facing;

/** On his feet, playing as normal, facing Harrison: the defender a trick can work on. */
function facingHim(w: World, d: Player): boolean {
  return d.state === 'ground' && d.y === 0 && d.fooled === null && d.facing === -w.home.facing;
}

/**
 * The defender is squared up to Harrison: in front of him inside the
 * window, in his lane, facing him, on his feet and playing as normal, not
 * wise to it, not backing off from a powered-up Harrison, and not holding
 * his spot at Harrison's kickoff.
 */
export function squaredUp(w: World, d: Player = w.away): boolean {
  if (!w.tricks) return false;
  const { home, ball, field } = w;
  const { near, far } = w.tricks.profile;
  const gap = gapAhead(w, d);
  const kickoff = w.match.kickoffTeam === 'home' && Math.hypot(ball.x - field.width / 2, ball.z - field.depth / 2) <= ON_SPOT;
  const powered = (w.power?.activeS ?? 0) > 0;
  return gap >= near && gap <= far && Math.abs(d.z - home.z) <= TRICK_LANE && facingHim(w, d) && d.wiseS === 0 && !powered && !kickoff;
}

/** The defender saw a trick that didn't fool him: facing Harrison from in front within SEE_RANGE, but not squared up. */
export function seesTrick(w: World, d: Player = w.away): boolean {
  const gap = gapAhead(w, d);
  return gap > 0 && gap <= SEE_RANGE && facingHim(w, d) && !squaredUp(w, d);
}

/** Their keeper, while he's coming out: then he's a defender a trick can work on. */
function keeperOut(w: World): Player | null {
  const k = w.keepers?.away;
  return k && k.act === 'rush' ? k.body : null;
}

/** Fools or wises up one defender at the sell, at `scale`: true if he was fooled. */
function sellTo(w: World, d: Player, scale: TrickScale, ev: TrickEvents): boolean {
  const trick = w.home.trick!;
  if (trick.onBall && squaredUp(w, d)) {
    const { profile } = w.tricks!;
    const s = scale[trick.kind] * (trick.kind === 'stepover' ? profile.confusedS : profile.stumbleS);
    const swayZ = Math.min(Math.max(d.z + trick.side * STEPOVER.swayPx, PLAYER_R), w.field.depth - PLAYER_R);
    d.fooled = { kind: trick.kind === 'stepover' ? 'confused' : 'stumble', leftS: s, totalS: s, swayZ };
    ev.fooled = trick.kind;
    return true;
  }
  if (seesTrick(w, d)) d.wiseS = WISE_S;
  return false;
}

/** The sell: a squared-up defender is fooled; one who only saw it is wise to it. Their keeper coming out counts too, at the allRound scale. */
function sell(w: World, ev: TrickEvents): void {
  let fooled = sellTo(w, w.away, w.tricks!.scale, ev);
  const keeper = keeperOut(w);
  if (keeper) fooled = sellTo(w, keeper, TRICK_SCALE.allRound, ev) || fooled;
  if (fooled && w.power) addMeter(w.power, 'trick');
}

/** One defender's fooled and wise timers. A fooling that ends leaves him wise. */
function tickOne(d: Player, dt: number): void {
  if (!d.fooled) {
    d.wiseS = Math.max(0, d.wiseS - dt);
    return;
  }
  d.fooled.leftS -= dt;
  if (d.fooled.leftS <= 1e-9) {
    d.fooled = null;
    d.wiseS = WISE_S;
  }
}

/** The defenders' fooled and wise timers, Max's and their keeper's, while play is live. */
function tickDefender(w: World, dt: number): void {
  if (w.match.phase !== 'playing') return;
  tickOne(w.away, dt);
  if (w.keepers) tickOne(w.keepers.away.body, dt);
}

/** Facing his own goal inside the keep-out zone, where a flick could drop into his own net. */
function facingOwnGoalNear(w: World): boolean {
  const own = w.field.goals.find(g => g.side === 'left')!;
  return w.home.facing === -1 && w.home.x - own.lineX <= KEEP_OUT_X;
}

/**
 * Starts the trick he pressed when he has the tricks, is on his feet in play, not
 * already in a trick, a drag-back or a stumble, the cooldown is over, no
 * wave is live, and the ball is his. Stick up makes it a flick, except
 * facing his own goal near it. The stepover dips toward the tighter side.
 */
export function startTrick(w: World, intent: PlayerIntent): TrickKind | null {
  const { home } = w;
  if (!w.tricks || !intent.trick || w.match.phase !== 'playing') return null;
  const ready = home.state === 'ground' && home.y === 0 && home.turnS === 0 && home.stumbleS === 0 && home.trickCooldownS === 0 && home.trick === null;
  if (!ready || w.wave?.live || ballOutOfPlay(w) || !ballIsHis(w)) return null;
  const kind: TrickKind = intent.trick === 'flick' && !facingOwnGoalNear(w) ? 'flick' : 'stepover';
  const side = home.z >= w.field.depth / 2 ? 1 : -1;
  home.trick = { kind, t: 0, side, sold: false, pace: kind === 'stepover' ? STEPOVER.pace : 0, onBall: true };
  w.ball.touchedBy = 'home';
  return kind;
}

/** Puts the ball at (x, y) beside him if it can go there; otherwise it's no longer the trick's to carry. */
function carry(w: World, x: number, y: number): void {
  const { ball, home } = w;
  const trick = home.trick!;
  if (!canPlace({ ...ball, y }, x, ball.z, w.field)) {
    trick.onBall = false;
    return;
  }
  Object.assign(ball, { x, y, vx: home.vx, vy: 0, vz: 0, spin: 0 });
}

/**
 * One tick of the trick under way, the cooldown, and the defender's fooled
 * and wise timers. Play stopping or him
 * leaving his feet ends it at once. Someone else playing the ball, the dog
 * taking it, or its spot being behind a fence, a post or a net leaves it
 * where it is, and the trick plays out without it.
 *
 * The stepover holds the ball FOOT_SPOT ahead. The flick rolls it from
 * there up behind his heel to rideY, and launches it at the sell, when he
 * sets off after it at his full run.
 */
export function stepTrick(w: World, dt: number): TrickEvents {
  const ev = quietTricks();
  const { home, ball } = w;
  home.trickCooldownS = Math.max(0, home.trickCooldownS - dt);
  tickDefender(w, dt);
  const trick = home.trick;
  if (!trick) return ev;
  if (w.match.phase !== 'playing' || home.state !== 'ground') {
    home.trick = null;
    return ev;
  }
  if (ball.touchedBy !== 'home' || w.dog?.carrying) trick.onBall = false;
  trick.t += dt;
  const timing = trick.kind === 'stepover' ? STEPOVER : FLICK;
  const selling = !trick.sold && trick.t >= timing.sellS - 1e-9;
  if (trick.kind === 'stepover') {
    if (trick.onBall) carry(w, home.x + home.facing * FOOT_SPOT, BALL_REST_Y);
  } else if (!trick.sold && trick.onBall) {
    const k = Math.min(1, trick.t / FLICK.sellS);
    carry(w, home.x + home.facing * (FOOT_SPOT - (FOOT_SPOT + FLICK.behind) * k), BALL_REST_Y + (FLICK.rideY - BALL_REST_Y) * k);
  }
  if (selling) {
    trick.sold = true;
    sell(w, ev);
    if (trick.kind === 'flick') {
      trick.pace = 1;
      if (trick.onBall) {
        Object.assign(ball, { vx: home.facing * FLICK.vx, vy: FLICK.vy, vz: 0, spin: FLICK.spin });
        ev.released = true;
      }
    }
  }
  if (trick.t >= timing.durationS - 1e-9) {
    home.trick = null;
    home.trickCooldownS = TRICK_COOLDOWN_S;
  }
  return ev;
}
