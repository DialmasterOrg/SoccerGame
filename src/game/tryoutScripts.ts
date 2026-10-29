import { matchById } from '../meta/career';
import { REBOUND_S } from '../scenes/goalFacts';
import { createBrain, think, type AiBrain, type Difficulty } from './ai';
import { openCorner } from './aiming';
import { inGoalBox, roofSpan } from './field';
import { keeperLevel, keeperLineup } from './keeper';
import { HUMAN_AIM_ERROR_DEG, aimLine, type Aim } from './kick';
import { harrisonIntent, harrisonStatsFor, scriptMemo, traitRecorder, type Matchup, type MaxMatch, type ScriptMemo, type Traits } from './maxScripts';
import { squareAndStill } from './nutmeg';
import { NORMAL_HANDLING, NO_INTENT, PLAYER_R, type PlayerIntent } from './player';
import { BALL_R } from '../art/ball';
import { SCHOOL_STAGE } from './stage';
import { chargeTime, type Stats } from './stats';
import { maxHasBall } from './steal';
import { FAKE } from './styles';
import { TRYOUT_ORDER, TRYOUT_PROFILES, TRYOUT_STATS, type TryoutOpponent } from './tryouts';
import { createWorld, stepWorld, type World } from './world';
import type { TryoutMove } from './tryoutMoves';
import { ballAtFeet } from './zones';

/**
 * The School's scripted Harrison: the Park's (maxScripts'), and he places
 * his shots and follows up their keeper's pushes. His aim is the corner
 * away from their keeper, set on every tick of his brain's charge, the
 * release tick included; within `followS` of their keeper pushing the
 * ball away, a ball at his feet within `followRange` px of the line is
 * struck at once, held for `followCharge` of his charge time. Frozen once
 * School Max was measured against him: every tryout is measured the same way.
 */
export const SCHOOL_SCRIPT = { shootRange: 200, followS: 2, followRange: 180, followCharge: 0.5 };

export interface SchoolScriptMemo extends ScriptMemo {
  /** Seconds since their keeper last pushed the ball away; Infinity before he has, and once he's followed it up. */
  sincePushS: number;
}

export function schoolScriptMemo(seed: number): SchoolScriptMemo {
  const memo = scriptMemo(seed);
  memo.brain.profile = { ...memo.brain.profile, shootRange: SCHOOL_SCRIPT.shootRange };
  return { ...memo, sincePushS: Infinity };
}

export function schoolHarrisonIntent(w: World, t: number, dt: number, memo: SchoolScriptMemo): PlayerIntent {
  memo.sincePushS = w.events.keeper.pushed === 'away' ? 0 : memo.sincePushS + dt;
  const brain = memo.brain;
  const charging = brain.plan === 'charge' && brain.intent.shootHeld;
  const toLine = w.field.goals[1]!.lineX - w.ball.x;
  const follow = memo.sincePushS <= SCHOOL_SCRIPT.followS && toLine > 0 && toLine <= SCHOOL_SCRIPT.followRange;
  if (follow && !charging && memo.chargingSinceS === null && w.match.phase === 'playing' && w.home.state === 'ground' && ballAtFeet(w.home, w.ball)) {
    // A first-time follow-up: his brain's own charge, started now and let go on its timer.
    brain.plan = 'charge';
    brain.chargeLeftS = SCHOOL_SCRIPT.followCharge * chargeTime(w.home.stats);
    brain.intent = { ...NO_INTENT, moveX: 1, shootHeld: true };
    memo.sincePushS = Infinity;
  }
  const kickingOff = memo.chargingSinceS !== null;
  const intent = harrisonIntent(w, t, dt, memo);
  const placing = !kickingOff && memo.chargingSinceS === null && brain.plan === 'charge' && (intent.shootHeld || w.home.state === 'charging');
  return placing ? { ...intent, aim: openCorner(w, w.home) } : intent;
}

export interface TryoutTraits extends Traits {
  /** The kid's headers. */
  headers: number;
  /** The kid's chips struck. */
  chips: number;
  /** Its goals whose last kick of its own was a chip. */
  chipGoals: number;
  /** Its touches and kicks within REBOUND_S of Harrison's keeper pushing the ball away. */
  reboundTouches: number;
  /** Each of its shots headed inside the mouth: px from the nearer post where its line crosses. */
  shotLines: number[];
  /** Its shot wind-ups begun with Harrison's body across the line to its aim. */
  shotsInLine: number;
  /** All its shot wind-ups. */
  windUps: number;
  /** Ticks an outfield body stood in a goal or behind a net. */
  strayTicks: number;
  /** Its own moves started, by kind: a copy of its brain's count. */
  moves: Partial<Record<TryoutMove['kind'], number>>;
  /** Its fakes followed by a shot wind-up within FAKE_TO_SHOT_S of the fake's end. */
  fakesToShot: number;
  /** Its fakes run their whole course with the ball at its feet within its fakeShot of the line: the ones that end in a shot. */
  fakesFinished: number;
  /** Mean distance from its own goal line while Harrison has the ball in open play in its half, px: where the poacher lingers. */
  halfDepth: number;
  /** Ticks a nutmeg started: the ball's `through` appeared. */
  nutmegs: number;
  /** Of those, started without Harrison square and still on the world before the step: none, if the world rule holds. */
  unfairNutmegs: number;
}

export interface TryoutMatch extends MaxMatch {
  traits: TryoutTraits;
}

const STEP = 1 / 60;
/** 120 s of play, goal pauses and golden goal, with room to spare. */
const MATCH_TICKS = 60 * 500;
/** The ball counts as still when it moves less than this in a tick. */
const STILL_PX = 0.05;
/** A wind-up this soon after a fake ends counts as the fake ending in a shot, s. */
export const FAKE_TO_SHOT_S = 1;

/** Whether Harrison's body is across the line from the ball to where `aim` crosses the goal the away side attacks: his centre within reach of it, between them. */
function acrossLine(w: World, aim: Aim): boolean {
  const g = w.field.goals[0]!;
  const line = aimLine(w.ball, -1, aim, w.field);
  const [bx, bz] = [w.ball.x, w.ball.z];
  const [dx, dz] = [g.lineX - bx, line.slope * Math.abs(g.lineX - bx)];
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return false;
  const u = ((w.home.x - bx) * dx + (w.home.z - bz) * dz) / len2;
  if (u <= 0 || u >= 1) return false;
  return Math.hypot(bx + u * dx - w.home.x, bz + u * dz - w.home.z) <= PLAYER_R + BALL_R;
}

const strayed = (w: World): boolean =>
  w.field.goals.some(g => {
    const [x0, x1] = roofSpan(w.field, g);
    return [w.home, w.away].some(p => inGoalBox(g, p.x, p.z, 0) || (p.x >= x0 && p.x <= x1 && p.z >= g.z0 && p.z <= g.z1));
  });

/** traitRecorder's traits, plus the School's: headers, chips, rebounds, where its shots go and what's in their way, and bodies where none may stand. */
function schoolRecorder(w: World) {
  const base = traitRecorder(w);
  const [attacks, own] = [w.field.goals[0]!, w.field.goals[1]!];
  const shotLines: number[] = [];
  let [headers, chips, chipGoals, reboundTouches, shotsInLine, windUps, strayTicks, fakesToShot, fakesFinished] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let lastKick: string | null = null;
  let [sinceHomePushS, sinceFakeS, fakeT] = [Infinity, Infinity, null as number | null];
  let [halfSum, halfTicks] = [0, 0];
  let [nutmegs, unfairNutmegs, fairNow, throughNow] = [0, 0, false, false];
  return {
    /** Read before the step: what the nutmeg's world rule saw. */
    before(w: World): void {
      [fairNow, throughNow] = [squareAndStill(w), w.ball.through !== undefined];
    },
    tick(w: World, away: PlayerIntent, was: World['away']['state'], brain: AiBrain): void {
      base.tick(w, away, was);
      if (w.ball.through && !throughNow) {
        nutmegs++;
        if (!fairNow) unfairNutmegs++;
      }
      const ended = fakeT !== null && !brain.fake;
      sinceFakeS = ended ? 0 : sinceFakeS + STEP;
      // A fake that ran its course ends on the tick its clock passes the lean, the cut and the straightening.
      const finished = ended && fakeT! >= FAKE.leanS + FAKE.cutS + FAKE.goS - STEP - 1e-9;
      if (finished && ballAtFeet(w.away, w.ball) && w.away.x - attacks.lineX <= (brain.profile.fakeShot ?? 0)) fakesFinished++;
      fakeT = brain.fake?.t ?? null;
      const ev = w.events.kicks[1];
      sinceHomePushS = w.events.keeper.pushed === 'home' ? 0 : sinceHomePushS + STEP;
      if (ev?.kicked) lastKick = ev.kicked;
      if (ev?.kicked === 'header') headers++;
      if (ev?.kicked === 'chip') chips++;
      if (ev && (ev.touched || ev.kicked) && sinceHomePushS <= REBOUND_S) reboundTouches++;
      if (ev?.kicked === 'shot' && w.ball.vx < 0) {
        const z = w.ball.z + (w.ball.vz * (attacks.lineX - w.ball.x)) / w.ball.vx;
        if (z >= attacks.z0 && z <= attacks.z1) shotLines.push(Math.min(z - attacks.z0, attacks.z1 - z));
      }
      if (w.events.goal === 'away' && lastKick === 'chip') chipGoals++;
      if (w.events.goal) lastKick = null;
      if (was !== 'charging' && w.away.state === 'charging') {
        windUps++;
        if (acrossLine(w, away.aim)) shotsInLine++;
        if (sinceFakeS <= FAKE_TO_SHOT_S) [fakesToShot, sinceFakeS] = [fakesToShot + 1, Infinity];
      }
      if (strayed(w)) strayTicks++;
      if (w.match.phase === 'playing' && maxHasBall(w.home, w.ball) && w.ball.x > w.field.width / 2) {
        halfSum += Math.abs(own.lineX - w.away.x);
        halfTicks++;
      }
    },
    traits: (brain: AiBrain): TryoutTraits => ({
      ...base.traits(brain),
      headers,
      chips,
      chipGoals,
      reboundTouches,
      shotLines,
      shotsInLine,
      windUps,
      strayTicks,
      moves: { ...brain.started },
      fakesToShot,
      fakesFinished,
      halfDepth: halfTicks ? halfSum / halfTicks : 0,
      nutmegs,
      unfairNutmegs,
    }),
  };
}

/** A whole School match: keepers at `level` (Harrison's Normal, theirs `d`), the School Harrison a level up on m.stats. */
export function playTryout(m: Matchup, level: number, d: Difficulty, seed: number, harrison: Stats = harrisonStatsFor(m.stats)): TryoutMatch {
  const { profile } = m;
  const w = createWorld({ ...harrison }, { ...m.stats }, seed, { home: HUMAN_AIM_ERROR_DEG, away: profile.aimErrorDeg }, null, null, profile, m.handling ?? NORMAL_HANDLING, null, SCHOOL_STAGE, keeperLineup(level, d));
  const brain = createBrain(profile);
  const memo = schoolScriptMemo(seed);
  const recorder = schoolRecorder(w);
  let [t, stillS, longestStillS] = [0, 0, 0];
  for (let i = 0; i < MATCH_TICKS && w.match.result === null; i++) {
    const home = schoolHarrisonIntent(w, t, STEP, memo);
    const away = think(brain, w, w.away, w.home, STEP);
    const [x, y, z] = [w.ball.x, w.ball.y, w.ball.z];
    const was = w.away.state;
    recorder.before(w);
    stepWorld(w, home, away, STEP);
    t += STEP;
    const still = Math.hypot(w.ball.x - x, w.ball.y - y, w.ball.z - z) < STILL_PX;
    stillS = w.match.phase === 'playing' && still ? stillS + STEP : 0;
    longestStillS = Math.max(longestStillS, stillS);
    recorder.tick(w, away, was, brain);
  }
  return { result: w.match.result, score: { ...w.match.score }, longestStillS, traits: recorder.traits(brain) };
}

/** The keepers' level at `id`'s tryout: its catalog match's. */
export const tryoutLevel = (id: TryoutOpponent): number => keeperLevel(matchById(`school-${TRYOUT_ORDER.indexOf(id) + 1}`)!);

/** `id` at its School stats and profile, keepers at its tryout's level (keeperLevel of its catalog match). */
export function tryoutMatch(id: TryoutOpponent, d: Difficulty, seed: number): TryoutMatch {
  return playTryout({ stats: TRYOUT_STATS[id], profile: TRYOUT_PROFILES[id][d] }, tryoutLevel(id), d, seed);
}
