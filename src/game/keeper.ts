import { KEEPER_HANDS } from '../art/keepers/poses';
import type { CareerMatch } from '../meta/career';
import { BALL_REST_Y } from './ball';
import type { Difficulty } from './ai';
import type { ContactEvents } from './contact';
import { penaltyArea, type Field, type Goal } from './field';
import type { Team } from './match';
import { NO_INTENT, PLAYER_R, createPlayer, stepPlayer, type Player, type PlayerIntent } from './player';
import { BASE_STATS, runSpeed } from './stats';
import type { World } from './world';

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
  /** The highest he catches or punches, ball centre, px. */
  reachY: number;
  /** How far his body goes in a dive. */
  diveTravel: number;
  /** How far past his centre his gloves reach in a dive. */
  diveReach: number;
  /** How long the dive lasts. */
  diveS: number;
  /** Shots up to this pace he holds easily. */
  catchSpeed: number;
  /** His odds of holding one at that pace. */
  holdOdds: number;
  /** Lying after a dive. */
  downS: number;
  /** Getting up. */
  getUpS: number;
  /** A dribbler's ball this close, he commits to the smother. */
  smotherAt: number;
}

const profile = (p: KeeperProfile): KeeperProfile => p;

/**
 * Each difficulty's keeper at the venue's first match (level 1) and its last
 * (KEEPER_TOP_LEVEL); the levels between are straight lines. Mutable, so
 * headless sweeps can try other numbers.
 */
export const KEEPER_LEVELS: Record<Difficulty, { first: KeeperProfile; last: KeeperProfile }> = {
  easy: {
    first: profile({ reactionS: 0.3, speed: 95, posErrPx: 9, comeOutPx: 14, reachZ: 1, reachY: 40, diveTravel: 6, diveReach: 8, diveS: 0.45, catchSpeed: 320, holdOdds: 0.8, downS: 0.6, getUpS: 0.6, smotherAt: 14 }),
    last: profile({ reactionS: 0.22, speed: 110, posErrPx: 6, comeOutPx: 18, reachZ: 2, reachY: 42, diveTravel: 8, diveReach: 9, diveS: 0.4, catchSpeed: 380, holdOdds: 0.85, downS: 0.5, getUpS: 0.5, smotherAt: 16 }),
  },
  normal: {
    first: profile({ reactionS: 0.24, speed: 105, posErrPx: 6, comeOutPx: 18, reachZ: 2, reachY: 42, diveTravel: 8, diveReach: 9, diveS: 0.4, catchSpeed: 360, holdOdds: 0.85, downS: 0.5, getUpS: 0.5, smotherAt: 16 }),
    last: profile({ reactionS: 0.16, speed: 120, posErrPx: 3, comeOutPx: 24, reachZ: 3, reachY: 44, diveTravel: 10, diveReach: 11, diveS: 0.35, catchSpeed: 440, holdOdds: 0.92, downS: 0.4, getUpS: 0.4, smotherAt: 20 }),
  },
  hard: {
    first: profile({ reactionS: 0.2, speed: 112, posErrPx: 4, comeOutPx: 22, reachZ: 3, reachY: 44, diveTravel: 9, diveReach: 10, diveS: 0.38, catchSpeed: 400, holdOdds: 0.9, downS: 0.45, getUpS: 0.45, smotherAt: 18 }),
    last: profile({ reactionS: 0.12, speed: 128, posErrPx: 2, comeOutPx: 28, reachZ: 4, reachY: 46, diveTravel: 11, diveReach: 12, diveS: 0.32, catchSpeed: 480, holdOdds: 0.95, downS: 0.35, getUpS: 0.35, smotherAt: 22 }),
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
}

/** Harrison's keeper at Normal, theirs at the difficulty, both at `level`. */
export function keeperLineup(level: number, d: Difficulty): KeeperLineup {
  return { home: keeperProfile(level, 'normal'), away: keeperProfile(level, d) };
}

/** A tryout's level is its number; a boss's is the top level. */
export function keeperLevel(m: Pick<CareerMatch, 'kind' | 'rung'>): number {
  return m.kind === 'boss' ? KEEPER_TOP_LEVEL : Math.min(Math.max(m.rung, 1), KEEPER_TOP_LEVEL);
}

/** A kick struck by either side: who, what, PERFECT or not, and where along the pitch. */
export interface Strike {
  team: Team;
  kind: NonNullable<ContactEvents['kicked']>;
  perfect: boolean;
  x: number;
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
/** A ball caught in a dive lies this far along it from his centre, by his gloves. */
const DIVE_BALL_PX = 10;
/** A standing catch or push shows this long. */
const POSE_S = 0.25;

export function keeperGoal(field: Field, side: KeeperSide): Goal {
  return field.goals[side === 'home' ? 0 : 1];
}

/** Toward the pitch from his goal. */
export const pitchward = (field: Field, side: KeeperSide): 1 | -1 => (keeperGoal(field, side).side === 'left' ? 1 : -1);

function createKeeper(field: Field, side: KeeperSide, profile: KeeperProfile): Keeper {
  const g = keeperGoal(field, side);
  const dir = pitchward(field, side);
  const body = createPlayer(side, BASE_STATS, g.lineX + dir * (PLAYER_R + SET_OFF), dir, (g.z0 + g.z1) / 2);
  body.area = penaltyArea(field, g);
  return { side, body, profile, act: 'set', actT: 0, dive: null, holding: false, readS: 0, errZ: 0, seenV: { vx: 0, vz: 0 }, pose: null };
}

export function createKeepers(field: Field, lineup: KeeperLineup): Keepers {
  return { home: createKeeper(field, 'home', lineup.home), away: createKeeper(field, 'away', lineup.away), punt: null, strike: null };
}

/** Kickoff: each set on his goal's centre line SET_OFF in front, facing the pitch; every act, hold, dive and punt cleared. */
export function placeKeepers(w: World): void {
  const ks = w.keepers;
  if (!ks) return;
  for (const k of [ks.home, ks.away]) {
    const fresh = createKeeper(w.field, k.side, k.profile);
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
      return;
    default: {
      const move: PlayerIntent = live ? { ...intent.move, pace: profile.speed / runSpeed(BASE_STATS), faceX: pitchward(w.field, k.side) } : NO_INTENT;
      stepPlayer(body, move, dt, w.field, false);
    }
  }
}

/** Where the ball he holds sits: at his gloves on his feet, on the grass by them after a dive. */
function heldSpot(k: Keeper): { x: number; y: number; z: number } {
  const { body } = k;
  if (k.act === 'dive' || k.act === 'down' || k.act === 'getUp') {
    const { dirX, dirZ } = k.dive ?? { dirX: 0, dirZ: 0 };
    const len = Math.hypot(dirX, dirZ) || 1;
    return { x: body.x + (dirX / len) * DIVE_BALL_PX, y: BALL_REST_Y, z: body.z + (dirZ / len) * DIVE_BALL_PX };
  }
  return { x: body.x + body.facing * KEEPER_HANDS.x, y: KEEPER_HANDS.y, z: body.z };
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
  if (standing) {
    enterAct(k, 'hold');
    k.pose = { name: 'catch', leftS: POSE_S };
  }
  ev.caught = k.side;
  parkHeldBall(w);
}
