import { KEEPER_HANDS } from '../art/keepers/poses';
import type { CareerMatch } from '../meta/career';
import { BALL_R } from '../art/ball';
import { BALL_REST_Y } from './ball';
import { AIR_DRAG, GRAVITY } from './constants';
import type { Difficulty } from './ai';
import type { ContactEvents } from './contact';
import { penaltyArea, type Field, type Goal } from './field';
import type { Team } from './match';
import { NO_INTENT, PLAYER_R, blowAway, createPlayer, stepPlayer, type Player, type PlayerIntent } from './player';
import { BASE_STATS, runSpeed } from './stats';
import type { World } from './world';
import type { GusRules } from './gus';

export type KeeperSide = 'home' | 'away'; // whose keeper: 'home' is Harrison's, in the left goal
export type KeeperAct = 'set' | 'rush' | 'dive' | 'down' | 'getUp' | 'hold' | 'kick';

export interface KeeperProfile {
  /** Seconds from a new ball flight to his first answer. */
  reactionS: number;
  /** px/s on his feet. */
  speed: number;
  /** His set position's error in depth, drawn per flight. */
  posErrPx: number;
  /** The furthest off his line he stands as the ball comes close. */
  comeOutPx: number;
  /** His gloves beyond his body, either side in depth, standing. */
  reachZ: number;
  /** His reach in depth beyond his body for a low ball (centre under LOW_Y): reachZ for every level keeper. */
  lowReachZ: number;
  /** The highest he catches or punches, ball centre, px. */
  reachY: number;
  /** How far his body goes in a dive. */
  diveTravel: number;
  /** How far past his centre his gloves reach in a dive. */
  diveReach: number;
  /** How long the dive lasts. */
  diveS: number;
  /** A dive's gloves reach a low ball only over this long: 0 for every level keeper. */
  getDownS: number;
  /** Shots up to this pace he holds easily. */
  catchSpeed: number;
  /** His odds of holding one at that pace. */
  holdOdds: number;
  /** Lying after a dive. */
  downS: number;
  /** Getting up. */
  getUpS: number;
  /** A dribbler's ball this close, he commits to the smother: beyond his dive's first reach, so a smother takes a moment to arrive. */
  smotherAt: number;
}

const profile = (p: KeeperProfile): KeeperProfile => p;

/**
 * Each difficulty's keeper at the venue's first match (level 1) and its last
 * (KEEPER_TOP_LEVEL); the levels between are straight lines. The dials that
 * decide scoring are reactionS (long shots and the one-on-one), comeOutPx
 * and the standing reach (corner shots); dive length, catch pace and
 * positioning error barely move the drills. reactionS stays under a hard
 * shot's flight from the box's edge (650 px/s over 180 px is 0.28 s), or
 * he never moves for one and never pushes a ball away. Softened after the
 * parent's first playtest (2026-10-29: a 0-0 with every shot saved felt too
 * hard to score on), then the goal mouth widened from 56 to 68. Measured
 * with keeperScripts' drills (seeds 100-163): goals let in from long shots
 * E/N/H .56/.41/.34 at level 1 (Normal saves .59), .37/.19/.10 at level 8;
 * from placed corner shots .86/.84/.72 at level 1, .86/.75/.64 at level 8;
 * a patient one-on-one on Normal scores .94 at level 1 and .59 at level 8;
 * the sharpest keeper still lets in .64 of corners; no slow roller ever
 * goes in. Scripted matches on Normal (seeds 100-131) average .63 goals a
 * side, at most 2. Mutable, so headless sweeps can try other numbers.
 */
export const KEEPER_LEVELS: Record<Difficulty, { first: KeeperProfile; last: KeeperProfile }> = {
  easy: {
    first: profile({ reactionS: 0.34, speed: 92, posErrPx: 10, comeOutPx: 15, reachZ: 1, lowReachZ: 1, reachY: 40, diveTravel: 6, diveReach: 7, diveS: 0.47, getDownS: 0, catchSpeed: 310, holdOdds: 0.78, downS: 0.62, getUpS: 0.62, smotherAt: 18 }),
    last: profile({ reactionS: 0.24, speed: 106, posErrPx: 7, comeOutPx: 15, reachZ: 1, lowReachZ: 1, reachY: 41, diveTravel: 7, diveReach: 8, diveS: 0.42, getDownS: 0, catchSpeed: 360, holdOdds: 0.83, downS: 0.52, getUpS: 0.52, smotherAt: 20 }),
  },
  normal: {
    first: profile({ reactionS: 0.27, speed: 100, posErrPx: 7, comeOutPx: 17, reachZ: 1, lowReachZ: 1, reachY: 41, diveTravel: 7, diveReach: 8, diveS: 0.42, getDownS: 0, catchSpeed: 340, holdOdds: 0.82, downS: 0.55, getUpS: 0.55, smotherAt: 20 }),
    last: profile({ reactionS: 0.19, speed: 115, posErrPx: 4, comeOutPx: 18, reachZ: 2, lowReachZ: 2, reachY: 43, diveTravel: 9, diveReach: 10, diveS: 0.37, getDownS: 0, catchSpeed: 420, holdOdds: 0.9, downS: 0.42, getUpS: 0.42, smotherAt: 24 }),
  },
  hard: {
    first: profile({ reactionS: 0.22, speed: 108, posErrPx: 5, comeOutPx: 20, reachZ: 2, lowReachZ: 2, reachY: 43, diveTravel: 8, diveReach: 9, diveS: 0.4, getDownS: 0, catchSpeed: 380, holdOdds: 0.88, downS: 0.48, getUpS: 0.48, smotherAt: 22 }),
    last: profile({ reactionS: 0.14, speed: 124, posErrPx: 3, comeOutPx: 18, reachZ: 3, lowReachZ: 3, reachY: 45, diveTravel: 10, diveReach: 11, diveS: 0.34, getDownS: 0, catchSpeed: 460, holdOdds: 0.94, downS: 0.38, getUpS: 0.38, smotherAt: 26 }),
  },
};

/** The School Field's eight tryouts; the boss's keeper plays at the last one's level. */
export const KEEPER_TOP_LEVEL = 8;

/** Level clamped to 1..KEEPER_TOP_LEVEL; every dial straight from `first` (1) to `last` (8). */
export function keeperProfile(level: number, d: Difficulty): KeeperProfile {
  const t = (Math.min(Math.max(Math.round(level), 1), KEEPER_TOP_LEVEL) - 1) / (KEEPER_TOP_LEVEL - 1);
  const { first, last } = KEEPER_LEVELS[d];
  const out = {} as KeeperProfile;
  for (const dial of Object.keys(first) as (keyof KeeperProfile)[]) out[dial] = first[dial] + (last[dial] - first[dial]) * t;
  return out;
}

export interface KeeperLineup {
  home: KeeperProfile;
  away: KeeperProfile;
  /** Their keeper is Goalie Gus: his body and his rules. */
  gus?: GusRules;
}

/** Harrison's keeper at Normal, theirs at the difficulty, both at `level`. */
export function keeperLineup(level: number, d: Difficulty): KeeperLineup {
  return { home: keeperProfile(level, 'normal'), away: keeperProfile(level, d) };
}

/** A tryout's level is its number; a boss's is the top level. */
export function keeperLevel(m: Pick<CareerMatch, 'kind' | 'rung'>): number {
  return m.kind === 'boss' ? KEEPER_TOP_LEVEL : Math.min(Math.max(m.rung, 1), KEEPER_TOP_LEVEL);
}

/** A kick struck by either side: who, what, PERFECT or not, and where on the pitch. Cleared by a catch and a drop kick, so it can't follow the ball. */
export interface Strike {
  team: Team;
  kind: NonNullable<ContactEvents['kicked']>;
  perfect: boolean;
  x: number;
  z: number;
}

export interface Keeper {
  side: KeeperSide;
  body: Player;
  profile: KeeperProfile;
  act: KeeperAct;
  actT: number;
  dive: { dirX: number; dirZ: number } | null;
  holding: boolean;
  /** Seconds left before he answers the current flight. */
  readS: number;
  /** This flight's positioning error in depth, px. */
  errZ: number;
  /** The ball's ground velocity last tick, to see a new flight. */
  seenV: { vx: number; vz: number };
  /** A standing catch or push, shown for a moment. */
  pose: { name: 'catch' | 'push'; leftS: number } | null;
  /** Goalie Gus's size and rules; null for every other keeper. */
  gus: GusRules | null;
}

export interface Keepers {
  home: Keeper;
  away: Keeper;
  /** A drop kick still climbing: nobody plays it until it starts to fall. */
  punt: KeeperSide | null;
  /** The last kick struck, by either side. */
  strike: Strike | null;
}

export interface KeeperEvents {
  caught: KeeperSide | null;
  pushed: KeeperSide | null;
  dived: KeeperSide | null;
  punted: KeeperSide | null;
}

export const quietKeepers = (): KeeperEvents => ({ caught: null, pushed: null, dived: null, punted: null });

export interface KeeperIntent {
  move: PlayerIntent;
  dive: { dirX: number; dirZ: number } | null;
}

/** px in front of the goal line, beyond his radius, when set. */
export const SET_OFF = 3;
/** A ball caught in a dive lies this far along it from his centre, by his gloves (Gus's rules have his own). */
const DIVE_BALL_PX = 10;
/** A standing catch or push shows this long. */
const POSE_S = 0.25;

/** How long he holds a catch, standing still, before the drop kick. */
export const HOLD_S = 1.5;
/** The kick act. */
export const PUNT_S = 0.45;
/** The ball leaves his boot this far into it. */
export const PUNT_STRIKE_S = 0.2;
/**
 * Lands at halfway + dir × (from + rng × spread), z in z, launched at
 * elevationDeg, with backspin so it checks up after landing: without it the
 * bounces carry it on to the far box. Aimed a little short of halfway, on
 * his own side of it (10 to 190 px), at the parent's ask: it used to carry
 * 40 short to 240 past.
 */
export const PUNT = { from: -190, spread: 180, z: [24, 104] as const, elevationDeg: 40, spin: -7 };
/** Nobody waits closer than this to a keeper holding the ball. */
export const CROWD_GAP = 40;
/** Where his boot meets the ball: this far ahead of him, this high (Gus's rules have his own). */
const BOOT = { x: 8, y: 6 };

export function keeperGoal(field: Field, side: KeeperSide): Goal {
  return field.goals[side === 'home' ? 0 : 1];
}

/** Toward the pitch from his goal. */
export const pitchward = (field: Field, side: KeeperSide): 1 | -1 => (keeperGoal(field, side).side === 'left' ? 1 : -1);

function createKeeper(field: Field, side: KeeperSide, profile: KeeperProfile, gus: GusRules | null): Keeper {
  const g = keeperGoal(field, side);
  const dir = pitchward(field, side);
  const body = createPlayer(side, BASE_STATS, g.lineX + dir * ((gus?.radius ?? PLAYER_R) + SET_OFF), dir, (g.z0 + g.z1) / 2);
  body.area = penaltyArea(field, g);
  if (gus) Object.assign(body, { radius: gus.radius, height: gus.height });
  return { side, body, profile, act: 'set', actT: 0, dive: null, holding: false, readS: 0, errZ: 0, seenV: { vx: 0, vz: 0 }, pose: null, gus };
}

/** Harrison's keeper is never Gus; theirs is when the lineup says so. */
export function createKeepers(field: Field, lineup: KeeperLineup): Keepers {
  return { home: createKeeper(field, 'home', lineup.home, null), away: createKeeper(field, 'away', lineup.away, lineup.gus ?? null), punt: null, strike: null };
}

/** Kickoff: each set on his goal's centre line SET_OFF in front, facing the pitch; every act, hold, dive and punt cleared. */
export function placeKeepers(w: World): void {
  const ks = w.keepers;
  if (!ks) return;
  for (const k of [ks.home, ks.away]) {
    const fresh = createKeeper(w.field, k.side, k.profile, k.gus);
    Object.assign(k.body, fresh.body, { stamina: k.body.stamina });
    delete k.body.inNet;
    Object.assign(k, { act: 'set', actT: 0, dive: null, holding: false, readS: 0, errZ: 0, seenV: { vx: 0, vz: 0 }, pose: null });
  }
  ks.punt = null;
  ks.strike = null;
}

function enterAct(k: Keeper, act: KeeperAct): void {
  k.act = act;
  k.actT = 0;
}

/** On his feet and free to answer the ball: set, or coming out. */
const onFeet = (k: Keeper): boolean => k.act === 'set' || k.act === 'rush';

function startDive(k: Keeper, dir: { dirX: number; dirZ: number }, ev: KeeperEvents): void {
  enterAct(k, 'dive');
  k.dive = { ...dir };
  ev.dived = k.side;
}

/** Slides his body along the dive, diveTravel over diveS: the keeper module moves him, not his legs. */
function slideDive(k: Keeper, dt: number): void {
  const { dirX, dirZ } = k.dive!;
  const len = Math.hypot(dirX, dirZ) || 1;
  const speed = k.profile.diveTravel / k.profile.diveS;
  [k.body.vx, k.body.vz] = [(dirX / len) * speed, (dirZ / len) * speed];
  k.body.x += k.body.vx * dt;
  k.body.z += k.body.vz * dt;
}

/**
 * Steps one keeper on his brain's intent. On his feet he moves at his own
 * speed, always facing the pitch, and an intent to dive starts one: he
 * slides along it, lies down, gets up, and is set again. Outside play he
 * stands.
 */
export function stepKeeper(w: World, k: Keeper, intent: KeeperIntent, live: boolean, dt: number, ev: KeeperEvents): void {
  k.actT += dt;
  if (k.pose && (k.pose.leftS -= dt) <= 0) k.pose = null;
  if (live && intent.dive && onFeet(k) && k.body.state === 'ground') startDive(k, intent.dive, ev);
  const walkingOut = k.body.inNet === true;
  const { profile, body } = k;
  switch (k.act) {
    case 'dive':
      slideDive(k, dt);
      if (k.actT >= profile.diveS) {
        enterAct(k, 'down');
        [body.vx, body.vz] = [0, 0];
      }
      return;
    case 'down':
      if (k.actT >= profile.downS) enterAct(k, 'getUp');
      return;
    case 'getUp':
      if (k.actT >= profile.getUpS) {
        enterAct(k, k.holding ? 'hold' : 'set');
        k.dive = null;
      }
      return;
    case 'hold':
      [body.vx, body.vz] = [0, 0];
      body.facing = pitchward(w.field, k.side);
      if (live && k.actT >= HOLD_S) enterAct(k, 'kick');
      return;
    case 'kick':
      [body.vx, body.vz] = [0, 0];
      if (k.holding && k.actT >= PUNT_STRIKE_S) dropKick(w, k, ev);
      if (k.actT >= PUNT_S) enterAct(k, 'set');
      return;
    default: {
      const move: PlayerIntent = live || walkingOut ? { ...intent.move, pace: profile.speed / runSpeed(BASE_STATS), faceX: pitchward(w.field, k.side) } : NO_INTENT;
      stepPlayer(body, move, dt, w.field, false);
    }
  }
}

/** Where the ball he holds sits: at his gloves on his feet, on the grass by them after a dive. */
function heldSpot(k: Keeper): { x: number; y: number; z: number } {
  const { body } = k;
  const [hands, boot, diveBallPx] = k.gus ? [k.gus.hands, k.gus.boot, k.gus.diveBallPx] : [KEEPER_HANDS, BOOT, DIVE_BALL_PX];
  if (k.act === 'dive' || k.act === 'down' || k.act === 'getUp') {
    const { dirX, dirZ } = k.dive ?? { dirX: 0, dirZ: 0 };
    const len = Math.hypot(dirX, dirZ) || 1;
    return { x: body.x + (dirX / len) * diveBallPx, y: BALL_REST_Y, z: body.z + (dirZ / len) * diveBallPx };
  }
  // The drop: from his gloves down to his boot.
  const u = k.act === 'kick' ? Math.min(1, k.actT / PUNT_STRIKE_S) : 0;
  return { x: body.x + body.facing * (hands.x + (boot.x - hands.x) * u), y: hands.y + (boot.y - hands.y) * u, z: body.z };
}

/** A caught ball, still, where he holds it. */
export function parkHeldBall(w: World): void {
  const ks = w.keepers;
  const k = ks?.home.holding ? ks.home : ks?.away.holding ? ks.away : null;
  if (!k) return;
  Object.assign(w.ball, heldSpot(k), { vx: 0, vy: 0, vz: 0, spin: 0 });
  w.ball.touchedBy = k.side;
}

/**
 * He has it: holding, the ball parked where he holds it. Standing, he holds
 * it at once and shows the catch; caught in a dive, it lies on the grass by
 * his gloves while he's down and getting up, and he holds it once he's up.
 */
export function startHold(w: World, k: Keeper, ev: KeeperEvents, standing: boolean): void {
  k.holding = true;
  // The kick he caught is over: whatever happens next isn't that strike.
  w.keepers!.strike = null;
  if (standing) {
    enterAct(k, 'hold');
    k.pose = { name: 'catch', leftS: POSE_S };
  }
  ev.caught = k.side;
  parkHeldBall(w);
}

/** The keeper holding the ball, until it leaves his boot; null when nobody is. */
export function holdingKeeper(w: World): Keeper | null {
  const ks = w.keepers;
  return ks?.home.holding ? ks.home : ks?.away.holding ? ks.away : null;
}

/**
 * Where a player waits while `k` holds: out where his drop kick will come
 * down, around halfway, so nobody crowds him (far more than CROWD_GAP off,
 * on the pitch side) and nobody is left chasing it from his box.
 */
export function standOffSpot(w: World, me: Player, k: Keeper): { x: number; z: number } {
  const out = pitchward(w.field, k.side);
  const x = w.field.width / 2 + out * (PUNT.from + PUNT.spread / 2);
  return { x, z: Math.min(Math.max(me.z, PUNT.z[0]), PUNT.z[1]) };
}

/** How far a ball launched at `speed` and the punt's elevation from height y0 carries before it first lands, under gravity and drag. */
function puntRange(speed: number, y0: number): number {
  const h = 1 / 240;
  const rad = (PUNT.elevationDeg * Math.PI) / 180;
  let [x, y, vx, vy] = [0, y0, speed * Math.cos(rad), speed * Math.sin(rad)];
  while (!(y <= BALL_R && vy < 0)) {
    vy -= GRAVITY * h;
    const drag = 1 - AIR_DRAG * h;
    vx *= drag;
    vy *= drag;
    x += vx * h;
    y += vy * h;
  }
  return x;
}

/** The launch speed whose first bounce is `dist` away. */
function puntSpeed(dist: number, y0: number): number {
  let [lo, hi] = [50, 3000];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (puntRange(mid, y0) < dist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The ball leaves his boot, long upfield toward his side's attacking half: nobody plays it while it climbs. */
function dropKick(w: World, k: Keeper, ev: KeeperEvents): void {
  const dir = pitchward(w.field, k.side);
  const land = { x: w.field.width / 2 + dir * (PUNT.from + w.rng() * PUNT.spread), z: PUNT.z[0] + w.rng() * (PUNT.z[1] - PUNT.z[0]) };
  const b = w.ball;
  const [dx, dz] = [land.x - b.x, land.z - b.z];
  const dist = Math.hypot(dx, dz);
  const speed = puntSpeed(dist, b.y);
  const rad = (PUNT.elevationDeg * Math.PI) / 180;
  const ground = speed * Math.cos(rad);
  Object.assign(b, { vx: (dx / dist) * ground, vy: speed * Math.sin(rad), vz: (dz / dist) * ground, spin: PUNT.spin });
  k.holding = false;
  w.keepers!.punt = k.side;
  w.keepers!.strike = null;
  ev.punted = k.side;
}

/** The Energy Wave reached him: blown back along the beam, his hold, dive and drop kick gone. */
export function blowKeeper(w: World, k: Keeper, dirX: number, dirZ: number): void {
  blowAway(k.body, dirX, dirZ);
  Object.assign(k, { act: 'set', actT: 0, dive: null, holding: false, pose: null });
  if (w.keepers!.punt === k.side) w.keepers!.punt = null;
}

/** A keeper has the ball, or his drop kick is still climbing: nobody else may play it in any way. */
export function ballOutOfPlay(w: World): boolean {
  return holdingKeeper(w) !== null || (w.keepers?.punt ?? null) !== null;
}
