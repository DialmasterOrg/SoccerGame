import { BALL_R } from '../art/ball';
import { seeded } from '../engine/random';
import { maxStats } from '../meta/ladder';
import { DIFFICULTY, createBrain, think, type Difficulty } from './ai';
import { keeperLineup, type Keeper, type KeeperSide } from './keeper';
import { stepBall } from './ball';
import { HUMAN_AIM_ERROR_DEG, aimLine, chip, type Aim } from './kick';
import { harrisonIntent, harrisonStats, scriptMemo, type MaxMatch } from './maxScripts';
import { opponentProfile, trickSetup } from './opponents';
import { NO_INTENT, NORMAL_HANDLING, type PlayerIntent } from './player';
import { SCHOOL_STAGE } from './stage';
import { chargeTime } from './stats';
import { createWorld, stepWorld, type World } from './world';
import { ballAtFeet, ballIn, footZone } from './zones';

export type Drill = 'long' | 'corner' | 'oneOnOne' | 'roller';
export type DrillOutcome = 'goal' | 'saved' | 'wide';

const STEP = 1 / 60;
/** Every drill ends by now: 3 s after the shot, and the one-on-one 3 s after its longest wait. */
const DRILL_S = 3;
const ONE_ON_ONE_S = 6;

/** The scripted Harrison's stats in a drill: a level up on rung-10 Max, as in every scripted measure. */
const DRILL_STATS = harrisonStats(10);
/** 120 s of play, goal pauses and golden goal, with room to spare. */
const MATCH_TICKS = 60 * 500;
/** The ball counts as still when it moves less than this in a tick. */
const STILL_PX = 0.05;
/** Where the side not in the drill waits, out of play. */
const PARKED = { x: 640, z: 124 };

type Script = (w: World, t: number) => PlayerIntent;

function drillWorld(level: number, d: Difficulty, seed: number, tricks: boolean): World {
  const profile = DIFFICULTY.normal;
  const w = createWorld({ ...DRILL_STATS }, maxStats(10), seed, { home: HUMAN_AIM_ERROR_DEG, away: profile.aimErrorDeg }, null, null, profile, NORMAL_HANDLING, tricks ? trickSetup(d, 'max') : null, SCHOOL_STAGE, keeperLineup(level, d));
  w.match.phase = 'playing';
  return w;
}

/** Harrison on the ball at (x, z), facing the right goal. */
function onBall(w: World, x: number, z: number): void {
  Object.assign(w.home, { x: x - 8, z, facing: 1 });
  Object.assign(w.ball, { x, z, vx: 0, vy: 0, vz: 0, spin: 0 });
  delete w.ball.touchedBy;
}

/** Holds shoot for `charge` of his charge time, aimed, then lets go. */
function shoot(aim: Aim, charge: number): Script {
  return (w, t) => ({ ...NO_INTENT, aim, faceX: 1, shootHeld: t < charge * chargeTime(w.home.stats) });
}

const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

/** The one-on-one: how far out he settles on the ball, how long he waits for the keeper to commit, and his moves. */
export const ONE_ON_ONE = {
  startOut: 150,
  /** Walking it in under close control: at a run his touch knocks it on, loose, for the keeper. */
  dribblePace: 0.35,
  /** Creeping up to a resting ball below touch speed (20 px/s), until it's this close ahead. */
  creepPace: 0.15,
  feetPx: 9,
  /** He dribbles in until the ball is this far out, inside the box, then settles with it at his feet. */
  settleOut: 112,
  waitS: 1.5,
  /** Seeing the keeper commit, he answers this much later. */
  reactS: 0.1,
  /** Round him: winds up stepping across, away from his dive, until the ball is this far over, then shoots at the open side. */
  roundPx: 16,
  roundS: 0.6,
  /** Finishing: onto the ball within this long, then a shot at the open side at this charge. */
  finishS: 0.6,
  finishCharge: 0.6,
  /** Chip him once he's this far off his line, at a charge in this band. */
  chipOff: [30, 60] as const,
  /** He judges the chip to drop under the bar at this height at the line, give or take his touch, as a share of the charge. */
  chipLineY: 42,
  chipNoise: 0.01,
  /** He starts the stepover with the keeper this far ahead, coming on: about 30 at the sell. */
  stepoverGap: 68,
  shotCharge: 0.75,
};

/** The charge whose chip from where the ball is crosses the goal line at `lineY`, found by flying it: a judged chip. */
function judgedChip(w: World, lineY: number): number {
  const g = w.field.goals[1];
  const yAtLine = (charge: number): number => {
    const k = chip(w.home.stats, charge, aimLine(w.ball, 1, 'straight', w.field));
    const b = { ...w.ball, vx: k.vx, vy: k.vy, vz: k.vz, spin: k.spin };
    // Measured as its front edge meets the line; one that comes back off the bar is too high.
    const at = g.lineX - BALL_R - 1;
    for (let i = 0; i < 240 && b.x < at && b.vx > 0; i++) {
      stepBall(b, STEP, w.field);
      // His swing meets it again while it's still at his foot, as the real chip does.
      if (ballIn(footZone(w.home), b, BALL_R)) Object.assign(b, { vx: k.vx, vy: k.vy, vz: k.vz });
    }
    return b.vx <= 0 ? Infinity : b.x >= at ? b.y : -1;
  };
  let [lo, hi] = [0.2, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (yAtLine(mid) < lineY) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The open side of the goal from the keeper: the corner further from him. */
function openSide(w: World, k: Keeper): Aim {
  const g = w.field.goals[1];
  return Math.abs(k.body.z - g.z0) > Math.abs(k.body.z - g.z1) ? 'near' : 'far';
}

/** Dribbles in, settles on the ball, waits for the keeper, then rounds him, chips him or steps over him by `turn`; or shoots for the far corner. */
function oneOnOne(w: World, k: Keeper, rng: () => number, turn: number): Script {
  const O = ONE_ON_ONE;
  type PhaseName = 'dribble' | 'settle' | 'wait' | 'answer' | 'round' | 'trick' | 'finish' | 'shoot' | 'done';
  let phase: { name: PhaseName; t: number } = { name: 'dribble', t: 0 };
  let [side, fromZ, hold, aim, chipping] = [1, 0, 0, 'far' as Aim, false];
  const touch = (rng() * 2 - 1) * O.chipNoise;
  const go = (name: PhaseName) => (phase = { name, t: 0 });
  const ahead = () => (w.ball.x - w.home.x) * w.home.facing;
  return () => {
    phase.t += STEP;
    switch (phase.name) {
      case 'dribble':
        if (1240 - w.ball.x <= O.settleOut) go('settle');
        return { ...NO_INTENT, moveX: O.dribblePace };
      case 'settle': {
        // He lets the last touch run out, then creeps up to the ball slower than a touch, so it ends at his feet.
        const resting = Math.hypot(w.ball.vx, w.ball.vz) < 5;
        if (resting && ahead() <= O.feetPx) go('wait');
        return { ...NO_INTENT, moveX: resting && ahead() > O.feetPx ? O.creepPace : 0, faceX: 1 };
      }
      case 'wait': {
        const off = 1240 - k.body.x;
        // The stepover starts as he comes on, so that he's squared up at the sell, short of his smother.
        const gap = k.body.x - w.home.x;
        const committed = turn === 0 ? k.act === 'dive' : turn === 1 ? k.act === 'rush' && off >= O.chipOff[0] && off <= O.chipOff[1] : k.act === 'rush' && gap <= O.stepoverGap;
        if (committed) go('answer');
        else if (phase.t >= O.waitS) {
          [aim, hold] = ['far', O.shotCharge];
          go('shoot');
        }
        return { ...NO_INTENT, faceX: 1 };
      }
      case 'answer':
        if (turn === 0) {
          if (phase.t < O.reactS) return { ...NO_INTENT, faceX: 1 };
          // Round him on the side away from his dive, or toward the middle if he came straight: winding up as
          // he steps across, the ball rolls with him in depth, then he shoots past him at the open side.
          const dz = k.dive?.dirZ ?? 0;
          side = Math.abs(dz) > 0.2 ? -Math.sign(dz) : w.home.z >= 64 ? -1 : 1;
          [fromZ, aim] = [w.ball.z, side > 0 ? 'far' : 'near'];
          go('round');
          return { ...NO_INTENT, faceX: 1, moveZ: side, shootHeld: true, aim };
        }
        if (turn === 1) {
          [hold, chipping] = [judgedChip(w, O.chipLineY) + touch, true];
          go('shoot');
          return { ...NO_INTENT, faceX: 1, chipHeld: true };
        }
        go('trick');
        return { ...NO_INTENT, faceX: 1, trick: 'stepover' };
      case 'round':
        if (Math.abs(w.ball.z - fromZ) >= O.roundPx || phase.t > O.roundS) {
          go('done');
          return { ...NO_INTENT, faceX: 1, aim };
        }
        return { ...NO_INTENT, faceX: 1, moveZ: side, shootHeld: true, aim };
      case 'trick':
        if (w.home.trick === null && phase.t > 0.05) go('finish');
        return { ...NO_INTENT, faceX: 1 };
      case 'finish': {
        // Onto the ball, then at the open side.
        if (ballAtFeet(w.home, w.ball) || phase.t > O.finishS) {
          [aim, hold] = [openSide(w, k), O.finishCharge];
          go('shoot');
          return { ...NO_INTENT, faceX: 1, aim, shootHeld: true };
        }
        const [dx, dz] = [w.ball.x - 6 - w.home.x, w.ball.z - w.home.z];
        const d = Math.hypot(dx, dz) || 1;
        return { ...NO_INTENT, moveX: dx / d, moveZ: dz / d };
      }
      case 'shoot': {
        // A chip he lets go at the charge he judged; a shot after its hold.
        const step = STEP / chargeTime(w.home.stats);
        const held = chipping ? phase.t < STEP || w.home.charge + step <= hold : phase.t < hold * chargeTime(w.home.stats);
        if (!held) go('done');
        return chipping ? { ...NO_INTENT, faceX: 1, chipHeld: held } : { ...NO_INTENT, faceX: 1, aim, shootHeld: held };
      }
      case 'done':
        return NO_INTENT;
    }
  };
}

/** Stages one drill: who's where, and the scripted Harrison. */
function stage(kind: Drill, w: World, rng: () => number, side: KeeperSide, seed: number): Script {
  const k = w.keepers![side];
  const away = side === 'away';
  Object.assign(away ? w.away : w.home, PARKED);
  switch (kind) {
    case 'long': {
      onBall(w, 1240 - (170 + rng() * 90), 24 + rng() * 80);
      return shoot(pick(rng, ['far', 'near', 'straight'] as const), 0.5 + rng() * 0.5);
    }
    case 'corner': {
      onBall(w, 1240 - (50 + rng() * 50), 30 + rng() * 68);
      const goal = w.field.goals[1];
      const aim: Aim = Math.abs(k.body.z - goal.z0) > Math.abs(k.body.z - goal.z1) ? 'near' : 'far';
      return shoot(aim, 0.7 + rng() * 0.25);
    }
    case 'roller': {
      const g = w.field.goals[away ? 1 : 0];
      const out = away ? -1 : 1;
      const from = { x: g.lineX + out * (20 + rng() * 80), z: k.body.z + (rng() * 4 - 2) };
      const speed = 60 + rng() * 140;
      Object.assign(w.ball, { x: from.x, z: from.z, y: w.ball.y, vx: -out * speed, vy: 0, vz: 0, spin: 0 });
      Object.assign(away ? w.home : w.away, PARKED);
      return () => NO_INTENT;
    }
    case 'oneOnOne':
      onBall(w, 1240 - ONE_ON_ONE.startOut, 64 + (rng() * 40 - 20));
      // His move goes by the seed's turn: round him, chip him, step over him.
      return oneOnOne(w, k, rng, seed % 3);
  }
}

/** One headless trial against the keeper of `side` (default 'away') at `level` and `d`, the other side's players parked out of play; `watch` sees the world after every tick. */
export function drill(kind: Drill, level: number, d: Difficulty, seed: number, side: KeeperSide = 'away', watch?: (w: World) => void): DrillOutcome {
  const w = drillWorld(level, d, seed, kind === 'oneOnOne');
  const script = stage(kind, w, seeded(seed * 7919 + kind.length), side, seed);
  for (let t = 0; t < (kind === 'oneOnOne' ? ONE_ON_ONE_S : DRILL_S); t += STEP) {
    stepWorld(w, script(w, t), NO_INTENT, STEP);
    watch?.(w);
    if (w.events.goal) return 'goal';
    if (w.events.keeper.caught || w.events.keeper.pushed) return 'saved';
  }
  return 'wide';
}

/** goals / (goals + saves) over the seeds; wide shots don't count. */
export function goalRate(kind: Drill, level: number, d: Difficulty, seeds: readonly number[], side: KeeperSide = 'away'): number {
  let [goals, saves] = [0, 0];
  for (const seed of seeds) {
    const o = drill(kind, level, d, seed, side);
    if (o === 'goal') goals++;
    else if (o === 'saved') saves++;
  }
  return goals + saves === 0 ? 0 : goals / (goals + saves);
}

/** The scripted Harrison (maxScripts') a level up on rung-10 Max, against Max on Normal at the School, with keeperLineup(level, d). */
export function keeperMatch(seed: number, d: Difficulty, level = 1): MaxMatch {
  const profile = opponentProfile('max', 'normal');
  const w = createWorld({ ...DRILL_STATS }, maxStats(10), seed, { home: HUMAN_AIM_ERROR_DEG, away: profile.aimErrorDeg }, null, null, profile, NORMAL_HANDLING, null, SCHOOL_STAGE, keeperLineup(level, d));
  const brain = createBrain(profile);
  const memo = scriptMemo(seed);
  let [t, stillS, longestStillS] = [0, 0, 0];
  for (let i = 0; i < MATCH_TICKS && w.match.result === null; i++) {
    const [x, y, z] = [w.ball.x, w.ball.y, w.ball.z];
    stepWorld(w, harrisonIntent(w, t, STEP, memo), think(brain, w, w.away, w.home, STEP), STEP);
    t += STEP;
    const still = Math.hypot(w.ball.x - x, w.ball.y - y, w.ball.z - z) < STILL_PX;
    stillS = w.match.phase === 'playing' && still ? stillS + STEP : 0;
    longestStillS = Math.max(longestStillS, stillS);
  }
  return { result: w.match.result, score: { ...w.match.score }, longestStillS };
}
