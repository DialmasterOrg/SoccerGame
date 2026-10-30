import { seeded } from '../engine/random';
import { REBOUND_S } from '../scenes/goalFacts';
import { createBrain, think, type Difficulty } from './ai';
import { judgedChip } from './aiming';
import { GUS_PARTNER_PROFILES, GUS_PARTNER_STATS, gusLineup } from './gus';
import { LOW_Y } from './keeperSaves';
import { HUMAN_AIM_ERROR_DEG } from './kick';
import { harrisonIntent, harrisonStatsFor, scriptMemo, type MaxMatch, type ScriptMemo } from './maxScripts';
import { trickSetup } from './opponents';
import { NORMAL_HANDLING, NO_INTENT, type PlayerIntent } from './player';
import { SCHOOL_STAGE } from './stage';
import { chargeTime, type Stats } from './stats';
import { maxHasBall } from './steal';
import { TRYOUT_STATS } from './tryouts';
import { schoolHarrisonIntent, schoolScriptMemo, strayed, type SchoolScriptMemo } from './tryoutScripts';
import { createWorld, stepWorld, type World } from './world';
import { ballAtFeet } from './zones';

/** A Harrison who has passed the tryouts: a level up on Pinpoint Paige. */
export const GUS_TUNING_STATS: Readonly<Stats> = harrisonStatsFor(TRYOUT_STATS.paige);
export const GUS_SEEDS: readonly number[] = [...Array(64)].map((_, i) => 100 + i);
/** Hard and high from range: every shot held until it has been full for overS; never follows up. */
export const BLASTER = { shootRange: 320, overS: 0.25 };
/** Low for the corners, follows up, and draws Gus out to chip or step over him. */
export const WORKER = { shootRange: 110, charge: 0.45, chipOff: 24, chipLineY: 40, stepoverGap: 68 };
export type GusScript = 'blaster' | 'worker';

export interface GusMatchTraits {
  goals: number;
  /** His goals that crossed the line under LOW_Y. */
  lowGoals: number;
  /** His goals struck within REBOUND_S of Gus pushing the ball away. */
  reboundGoals: number;
  /** Away goals while Gus's drop kick was untouched: always 0. */
  puntGoals: number;
  partnerGoals: number;
  /** Of the play ticks either outfielder has the ball, Harrison's share. */
  possession: number;
  strayTicks: number;
}

export interface GusMatch extends MaxMatch {
  traits: GusMatchTraits;
}

const STEP = 1 / 60;
/** 120 s of play, goal pauses and golden goal, with room to spare. */
const MATCH_TICKS = 60 * 500;
/** The ball counts as still when it moves less than this in a tick. */
const STILL_PX = 0.05;
/** Seeds the worker's chip-or-stepover draws, apart from his brain's. */
const WORKER_SEED = 0x6a5;
/** Walking the ball in at Gus for the stepover, under close control (keeperScripts' one-on-one pace). */
const CREEP_PACE = 0.35;
/** Harrison standing this close to a still ball in his own half is the scripted Harrison's stall. */
export const STALL_NEAR = 40;

/**
 * The scripted Harrison standing by a still ball in his own half, near his
 * own goal, with nobody playing it (seen since plan 4). A player ends it by
 * playing the ball, so the still check doesn't count it.
 */
export function harrisonsStall(w: World): boolean {
  const { home, ball } = w;
  return ball.x < w.field.width / 2 && home.state === 'ground' && Math.hypot(ball.x - home.x, ball.z - home.z) <= STALL_NEAR;
}

/** Gus's match, headless: Harrison at `stats` with his tricks, the partner on his brain, Gus at `d` and Eddie. */
export function gusMatchWorld(d: Difficulty, seed: number, stats: Readonly<Stats> = GUS_TUNING_STATS): World {
  const profile = GUS_PARTNER_PROFILES[d];
  return createWorld({ ...stats }, { ...GUS_PARTNER_STATS }, seed, { home: HUMAN_AIM_ERROR_DEG, away: profile.aimErrorDeg }, null, null, profile, NORMAL_HANDLING, trickSetup(d, 'gus'), SCHOOL_STAGE, gusLineup(d));
}

/** The Park script (maxScripts'), shooting from further out. */
export function blasterMemo(seed: number): ScriptMemo {
  const memo = scriptMemo(seed);
  memo.brain.profile = { ...memo.brain.profile, shootRange: BLASTER.shootRange };
  return memo;
}

/** The Park script, every shot but the kickoff's held until it has been full for overS. */
export function blasterIntent(w: World, t: number, dt: number, memo: ScriptMemo): PlayerIntent {
  const kickingOff = memo.chargingSinceS !== null;
  const intent = harrisonIntent(w, t, dt, memo);
  if (kickingOff || w.home.state !== 'charging') return intent;
  const full = w.home.charge >= 1 && w.home.overchargeS >= BLASTER.overS;
  // His brain lets go on its own timer; held on until full, then let go, it presses nothing more.
  if (full) memo.brain.intent = { ...memo.brain.intent, shootHeld: false };
  return { ...intent, shootHeld: !full };
}

export interface WorkerMemo {
  school: SchoolScriptMemo;
  /** Each time Gus comes out, half the draws are a chip and half a stepover. */
  draw: () => number;
  /** How he answers the rush under way; null while Gus isn't rushing. */
  answer: 'chip' | 'stepover' | null;
  /** The charge his chip under way is let go at; null when he isn't chipping. */
  chipHold: number | null;
}

/** The frozen School script, shooting only from inside WORKER.shootRange. */
export function workerMemo(seed: number): WorkerMemo {
  const school = schoolScriptMemo(seed);
  school.brain.profile = { ...school.brain.profile, shootRange: WORKER.shootRange };
  return { school, draw: seeded(seed ^ WORKER_SEED), answer: null, chipHold: null };
}

/**
 * The School script with four changes: he shoots from inside 110 px; he
 * lets every shot go at WORKER.charge, so it stays low; and when Gus comes
 * out at him, he chips him once Gus is chipOff off his line, or walks the
 * ball at him and steps over him from stepoverGap, by a seeded draw.
 */
export function workerIntent(w: World, t: number, dt: number, memo: WorkerMemo): PlayerIntent {
  const { home } = w;
  const gus = w.keepers!.away;
  const step = dt / chargeTime(home.stats);
  if (memo.chipHold !== null) {
    const hold = home.state === 'chipping' && home.charge + step <= memo.chipHold;
    if (!hold) memo.chipHold = null;
    return { ...NO_INTENT, faceX: 1, chipHeld: hold };
  }
  const rushing = gus.act === 'rush';
  if (!rushing) memo.answer = null;
  else if (memo.answer === null) memo.answer = memo.draw() < 0.5 ? 'chip' : 'stepover';
  const onBall = w.match.phase === 'playing' && home.state === 'ground' && home.trick === null && ballAtFeet(home, w.ball);
  if (rushing && onBall) {
    // His brain sits this out; the School script's push clock still runs.
    memo.school.sincePushS = w.events.keeper.pushed === 'away' ? 0 : memo.school.sincePushS + dt;
    const lineX = w.field.goals[1]!.lineX;
    if (memo.answer === 'chip') {
      if (lineX - gus.body.x < WORKER.chipOff) return { ...NO_INTENT, faceX: 1 };
      memo.chipHold = judgedChip(w, home, WORKER.chipLineY);
      return { ...NO_INTENT, faceX: 1, chipHeld: true };
    }
    if (gus.body.x - home.x > WORKER.stepoverGap) return { ...NO_INTENT, moveX: 1, pace: CREEP_PACE };
    return { ...NO_INTENT, faceX: 1, trick: 'stepover' };
  }
  const intent = schoolHarrisonIntent(w, t, dt, memo.school);
  if (home.state !== 'charging' || home.charge + step <= WORKER.charge) return intent;
  memo.school.brain.intent = { ...memo.school.brain.intent, shootHeld: false };
  return { ...intent, shootHeld: false };
}

/** A whole match against Gus at `d`, reported from Harrison's side. Recording draws no random number. */
export function gusMatch(d: Difficulty, seed: number, who: GusScript, stats: Readonly<Stats> = GUS_TUNING_STATS): GusMatch {
  const w = gusMatchWorld(d, seed, stats);
  const brain = createBrain(GUS_PARTNER_PROFILES[d]);
  const [blaster, worker] = [blasterMemo(seed), workerMemo(seed)];
  const script = (t: number): PlayerIntent => (who === 'blaster' ? blasterIntent(w, t, STEP, blaster) : workerIntent(w, t, STEP, worker));
  let [t, stillS, longestStillS] = [0, 0, 0];
  let [lowGoals, reboundGoals, puntGoals, partnerGoals, strayTicks, mine, theirs] = [0, 0, 0, 0, 0, 0, 0];
  let [sincePushS, reboundKick] = [Infinity, false];
  for (let i = 0; i < MATCH_TICKS && w.match.result === null; i++) {
    const home = script(t);
    const away = think(brain, w, w.away, w.home, STEP);
    const [x, y, z] = [w.ball.x, w.ball.y, w.ball.z];
    // A goal clears his drop kick's flag on its own tick: read it first.
    const puntLive = w.keepers!.gusPunt;
    stepWorld(w, home, away, STEP);
    t += STEP;
    sincePushS = w.events.keeper.pushed === 'away' ? 0 : sincePushS + STEP;
    if (w.events.kicks[0]?.kicked) reboundKick = sincePushS <= REBOUND_S;
    if (w.events.goal === 'home') {
      if (w.ball.y < LOW_Y) lowGoals++;
      if (reboundKick) reboundGoals++;
    }
    if (w.events.goal === 'away') {
      if (puntLive) puntGoals++;
      else partnerGoals++;
    }
    if (w.events.goal) reboundKick = false;
    if (w.match.phase === 'playing') {
      if (maxHasBall(w.home, w.ball)) mine++;
      else if (maxHasBall(w.away, w.ball)) theirs++;
    }
    if (strayed(w)) strayTicks++;
    const still = Math.hypot(w.ball.x - x, w.ball.y - y, w.ball.z - z) < STILL_PX;
    stillS = w.match.phase === 'playing' && still && !harrisonsStall(w) ? stillS + STEP : 0;
    longestStillS = Math.max(longestStillS, stillS);
  }
  const traits: GusMatchTraits = { goals: w.match.score.home, lowGoals, reboundGoals, puntGoals, partnerGoals, possession: mine + theirs ? mine / (mine + theirs) : 0, strayTicks };
  return { result: w.match.result, score: { ...w.match.score }, longestStillS, traits };
}
