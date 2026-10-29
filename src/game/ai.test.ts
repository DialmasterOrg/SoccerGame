import { describe, expect, it } from 'vitest';
import { seeded } from '../engine/random';
import { DIFFICULTIES, DIFFICULTY, KICKOFF_HOLD_S, createBrain, think, type AiBrain, type AiProfile } from './ai';
import { BALL_REST_Y } from './ball';
import { inGoalBox, roofSpan } from './field';
import { SCHOOL_STAGE, type Stage } from './stage';
import { NO_INTENT, NORMAL_HANDLING, PLAYER_R, type Player, type PlayerIntent } from './player';
import { LADDER_MATCHES, maxStats } from '../meta/ladder';
import { SAM_HANDLING, SAM_PROFILES, SAM_STATS } from './sam';
import type { Aim } from './kick';
import { METER_MIN_REFILL_S, WAVE_READY_S, canStartPower } from './power';
import { BASE_STATS, STAT_NAMES, runSpeed, touchPush, type StatName, type Stats } from './stats';
import { ROLL_FRICTION } from './constants';
import { FAKE, defendSpot } from './styles';
import { CREW_PROFILES, CREW_STATS } from './crew';
import { maxHasBall } from './steal';
import { BRACE_DISTANCE } from './wave';
import { createWorld, placeForKickoff, stepWorld, type World } from './world';
import { STEPOVER, TRICK_DIFFICULTY } from './tricks';
import { ballAtFeet } from './zones';
import { CROWD_GAP, keeperLineup, type KeeperLineup } from './keeper';
import { harrisonStats } from './maxScripts';
import { keeperWorld, runFor, runUntil, shotAt } from './testKeepers';

const STEP = 1 / 60;

/** A world in play with the ball and both players placed by hand. */
function scene(ball: { x: number; y?: number; z?: number; vx?: number; vy?: number }, home: number, away: number): World {
  const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: DIFFICULTY.normal.aimErrorDeg });
  w.match.phase = 'playing';
  Object.assign(w.ball, { y: BALL_REST_Y, vx: 0, vy: 0, vz: 0, ...ball });
  w.home.x = home;
  w.away.x = away;
  return w;
}

const brainFor = (p: Partial<AiProfile> = {}) => createBrain({ ...DIFFICULTY.normal, ...p });

describe('think', () => {
  it('chases a loose ball', () => {
    const w = scene({ x: 400 }, 100, 500);
    expect(think(brainFor(), w, w.away, w.home, STEP).moveX).toBeLessThan(0);
  });

  it('dribbles toward the goal it attacks when it has the ball', () => {
    const w = scene({ x: 390 }, 100, 400);
    w.away.facing = -1;
    const brain = brainFor();
    expect(think(brain, w, w.away, w.home, STEP).moveX).toBeLessThan(0);
    expect(brain.plan).toBe('dribble');
  });

  it('charges and shoots inside shooting range', () => {
    const w = scene({ x: 170 }, 500, 178);
    w.away.facing = -1;
    const brain = brainFor();
    expect(think(brain, w, w.away, w.home, STEP).shootHeld).toBe(true);
    let released = false;
    for (let t = 0; t < 60; t++) released ||= !think(brain, w, w.away, w.home, STEP).shootHeld;
    expect(released).toBe(true);
  });

  it('defends goal-side when Harrison has the ball', () => {
    const w = scene({ x: 310 }, 300, 450);
    const brain = brainFor({ aggression: 0 });
    expect(think(brain, w, w.away, w.home, STEP).moveX).toBeLessThan(0);
    expect(brain.plan).toBe('defend');
    w.away.x = 330;
    brain.nextDecisionS = 0;
    expect(think(brain, w, w.away, w.home, STEP).moveX).toBe(0);
  });

  it('slide-tackles when close and aggressive, then waits out its cooldown', () => {
    const w = scene({ x: 310 }, 300, 330);
    w.away.facing = -1;
    const brain = brainFor({ aggression: 1 });
    const first = think(brain, w, w.away, w.home, STEP);
    expect(first.chipHeld).toBe(true);
    expect(think(brain, w, w.away, w.home, STEP).chipHeld).toBe(false);
    let again = 0;
    for (let t = 0; t < 1.1 * 60; t++) if (think(brain, w, w.away, w.home, STEP).chipHeld) again++;
    expect(again).toBe(0);
  });

  it('turns to face a ball carrier it is close to but facing away from', () => {
    const w = scene({ x: 310 }, 300, 330);
    w.away.facing = 1;
    expect(think(brainFor({ aggression: 1 }), w, w.away, w.home, STEP).moveX).toBeLessThan(0);
  });

  it.each(['easy', 'normal', 'hard'] as const)('on %s it never freezes on its defend spot facing away from an idle Harrison', difficulty => {
    const w = scene({ x: 310 }, 300, 330);
    w.away.facing = 1;
    const brain = createBrain(DIFFICULTY[difficulty]);
    for (let t = 0; t < 5 * 60; t++) stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
    expect(Math.abs(w.ball.x - 310) > 20 || w.match.score.away > 0).toBe(true);
  });

  it('only changes its mind every reactionS', () => {
    const w = scene({ x: 400 }, 100, 500);
    const brain = brainFor({ reactionS: 0.2 });
    expect(think(brain, w, w.away, w.home, STEP).moveX).toBeLessThan(0);
    w.ball.x = 600;
    expect(think(brain, w, w.away, w.home, STEP).moveX).toBeLessThan(0);
    for (let t = 0; t < 12; t++) think(brain, w, w.away, w.home, STEP);
    expect(think(brain, w, w.away, w.home, STEP).moveX).toBeGreaterThan(0);
  });

  it('jumps for a high ball overhead', () => {
    const w = scene({ x: 490, y: 40 }, 100, 500);
    const brain = brainFor();
    expect(think(brain, w, w.away, w.home, STEP).jump).toBe(true);
    expect(think(brain, w, w.away, w.home, STEP).jump).toBe(false);
  });

  it('sprints to a distant ball when it has the legs', () => {
    const w = scene({ x: 200 }, 100, 500);
    expect(think(brainFor(), w, w.away, w.home, STEP).sprint).toBe(true);
    w.away.stamina = 0.3;
    expect(think(brainFor(), w, w.away, w.home, STEP).sprint).toBe(false);
  });

  it('robbed by a steal, Max stands wrong-footed for his beat, never sliding, then challenges again', () => {
    // Harrison has the ball close in front of Max: a Max that always slides would slide at once.
    const w = scene({ x: 288 }, 280, 300);
    w.away.facing = -1;
    const brain = brainFor({ aggression: 1 });
    w.events.steal = 'stole';
    for (let t = 0; t < DIFFICULTY.normal.wrongFootedS - 1e-9; t += STEP) {
      const i = think(brain, w, w.away, w.home, STEP);
      expect([i.moveX, i.moveZ, i.chipHeld], `at ${t.toFixed(3)} s`).toEqual([0, 0, false]);
      w.events.steal = null;
    }
    let challenged = false;
    for (let k = 0; k < 30 && !challenged; k++) {
      const i = think(brain, w, w.away, w.home, STEP);
      challenged = i.chipHeld || i.moveX !== 0;
    }
    expect(challenged).toBe(true);
  });

  it("the brain playing Harrison isn't wrong-footed by his own steal", () => {
    const w = scene({ x: 400 }, 100, 500);
    w.events.steal = 'stole';
    expect(think(brainFor(), w, w.home, w.away, STEP).moveX).toBeGreaterThan(0);
  });

  it("Max holds his spot at Harrison's kickoff until the ball is played, or for 2 s", () => {
    const kickoff = () => {
      const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, null, null, DIFFICULTY.normal);
      const brain = brainFor({ aggression: 1 });
      think(brain, w, w.away, w.home, STEP);
      w.match.phase = 'playing';
      return { w, brain };
    };
    const { w, brain } = kickoff();
    const start = { x: w.away.x, z: w.away.z };
    for (let t = 0; t < KICKOFF_HOLD_S - 1e-9; t += STEP) {
      const i = think(brain, w, w.away, w.home, STEP);
      expect([i.moveX, i.moveZ, i.chipHeld], `at ${t.toFixed(3)} s`).toEqual([0, 0, false]);
    }
    expect([w.away.x, w.away.z]).toEqual([start.x, start.z]);
    let moved = false;
    for (let k = 0; k < 30 && !moved; k++) moved = think(brain, w, w.away, w.home, STEP).moveX !== 0;
    expect(moved, 'he comes after the timeout').toBe(true);

    const nudged = kickoff();
    nudged.w.ball.x += 2;
    expect(think(nudged.brain, nudged.w, nudged.w.away, nudged.w.home, STEP).moveX).not.toBe(0);
  });

  it('standing at his spot, Max sees Harrison play the kickoff ball and reacts after his reaction time', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, null, null, DIFFICULTY.normal);
    const brain = brainFor({ reactionS: 0.2 });
    think(brain, w, w.away, w.home, STEP);
    w.match.phase = 'playing';
    for (let i = 0; i < 30; i++) think(brain, w, w.away, w.home, STEP);
    w.ball.x += 10;
    for (let t = 0; t < 0.2 - 1e-9; t += STEP) {
      const i = think(brain, w, w.away, w.home, STEP);
      expect([i.moveX, i.moveZ], `at ${t.toFixed(3)} s`).toEqual([0, 0]);
    }
    expect(think(brain, w, w.away, w.home, STEP).moveX).not.toBe(0);
  });

  it('on Easy and Normal Max comes as soon as Harrison winds up at his kickoff; on Hard he waits for the kick', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, null, null, DIFFICULTY[d]);
      const brain = createBrain(DIFFICULTY[d]);
      think(brain, w, w.away, w.home, STEP);
      w.match.phase = 'playing';
      for (let i = 0; i < 6; i++) think(brain, w, w.away, w.home, STEP);
      w.home.state = 'charging';
      let moved = false;
      for (let t = 0; t < 0.5 && !moved; t += STEP) moved = think(brain, w, w.away, w.home, STEP).moveX !== 0;
      expect(moved, d).toBe(d !== 'hard');
    }
  });

  it("Max doesn't hold at his own kickoff, and Harrison's brain never holds", () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, null, null, DIFFICULTY.normal);
    w.match.kickoffTeam = 'away';
    placeForKickoff(w);
    const [max, harrison] = [brainFor(), brainFor()];
    think(max, w, w.away, w.home, STEP);
    think(harrison, w, w.home, w.away, STEP);
    w.match.phase = 'playing';
    expect(think(harrison, w, w.home, w.away, STEP).moveX).not.toBe(0);
    for (let k = 0; k < 30; k++) think(max, w, w.away, w.home, STEP);
    expect(max.plan).not.toBe('chase');
  });

  it("Max plays at his profile's pace, except backing off from a powered-up Harrison", () => {
    const w = scene({ x: 400 }, 100, 500);
    expect(think(brainFor({ paceFactor: 1.1 }), w, w.away, w.home, STEP).pace).toBe(1.1);
    const powered = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, { golden: false });
    powered.match.phase = 'playing';
    powered.power!.activeS = 1;
    const brain = brainFor({ paceFactor: 1.1, braceSense: 1, backOffS: 0 });
    let backing = { ...NO_INTENT };
    for (let i = 0; i < 3; i++) backing = think(brain, powered, powered.away, powered.home, STEP);
    expect(brain.plan).toBe('backOff');
    expect(backing.pace ?? 1).toBe(1);
  });

  it("Max's back-off from a powered-up Harrison keeps its own reaction, whatever his reactions in play", () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, { golden: false });
    w.match.phase = 'playing';
    w.power!.activeS = 1;
    const brain = brainFor({ reactionS: 0.05, backOffS: 0.3, braceSense: 1 });
    let t = 0;
    for (; t < 1 && brain.plan !== 'backOff'; t += STEP) think(brain, w, w.away, w.home, STEP);
    expect(t).toBeCloseTo(0.3, 1);
  });

  it('difficulty profiles match the plan', () => {
    expect(DIFFICULTY.easy).toEqual({
      reactionS: 0.22, aimErrorDeg: 8, aggression: 0.3, shootRange: 150, braceSense: 0.5, backOffS: 0.32,
      cleanSteal: 0.9, wrongFootedS: 0.35, kickoffSpot: { back: 110, off: 20 }, kickoffRush: true, paceFactor: 1, style: 'allRound',
    });
    expect(DIFFICULTY.normal).toEqual({
      reactionS: 0.16, aimErrorDeg: 6, aggression: 0.55, shootRange: 180, braceSense: 0.75, backOffS: 0.18,
      cleanSteal: 0.75, wrongFootedS: 0.35, kickoffSpot: { back: 110, off: 24 }, kickoffRush: true, paceFactor: 1.03, style: 'allRound',
    });
    expect(DIFFICULTY.hard).toEqual({
      reactionS: 0.1, aimErrorDeg: 2, aggression: 0.8, shootRange: 210, braceSense: 0.9, backOffS: 0.1,
      cleanSteal: 0.55, wrongFootedS: 0.2, kickoffSpot: { back: 70, off: 0 }, kickoffRush: false, paceFactor: 1.1, style: 'allRound',
    });
  });

  it('a whole simulated match between two AIs finishes with a result and no exceptions', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 11, { home: 6, away: 6 });
    const home = brainFor();
    const away = brainFor();
    let ticks = 0;
    while (w.match.phase !== 'fullTime' && ticks < 60 * 60 * 5) {
      stepWorld(w, think(home, w, w.home, w.away, STEP), think(away, w, w.away, w.home, STEP), STEP);
      for (const v of [w.ball.x, w.ball.y, w.home.x, w.away.x]) expect(Number.isFinite(v)).toBe(true);
      ticks++;
    }
    expect(w.match.result).not.toBeNull();
    expect(w.match.score.home + w.match.score.away).toBeLessThan(40);
  });

  it('chases a ball off to the side in depth', () => {
    const w = scene({ x: 420, z: 50 }, 100, 500);
    w.away.z = 20;
    const i = think(brainFor(), w, w.away, w.home, STEP);
    expect(i.moveX).toBeLessThan(0);
    expect(i.moveZ).toBeGreaterThan(0);
  });

  it('defends goal-side across the pitch', () => {
    const w = scene({ x: 310, z: 50 }, 300, 450);
    w.home.z = 50;
    w.away.z = 10;
    const brain = brainFor({ aggression: 0 });
    const i = think(brain, w, w.away, w.home, STEP);
    expect(brain.plan).toBe('defend');
    expect(i.moveX).toBeLessThan(0);
    expect(i.moveZ).toBeGreaterThan(0);
    // Its spot: 20 px goal-side, a third of the way from the ball toward its goal's centre.
    Object.assign(w.away, { x: 330, z: 50 + (32 - 50) / 3 });
    brain.nextDecisionS = 0;
    const there = think(brain, w, w.away, w.home, STEP);
    expect([there.moveX, there.moveZ]).toEqual([0, 0]);
  });

  it('goes round a still Harrison between him and the ball', () => {
    for (const z of [32, 10, 54]) {
      const w = scene({ x: 300, z }, 330, 380);
      w.home.z = z;
      w.away.z = z;
      const brain = brainFor();
      let touched = false;
      for (let t = 0; t < 3 * 60 && !touched; t++) {
        stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
        const max = w.events.kicks[1]!;
        touched = max.touched || max.kicked !== null || max.tackledBall;
      }
      expect(touched, `in line at z ${z}`).toBe(true);
    }
  });

  it('reaches a ball beside a post from the far side of the goal', () => {
    for (const [bx, bz, mx, mz, team] of [
      [21, 14.6, 29, 51, 'away'],
      [21, 14.6, 13, 51, 'home'],
      [619, 50, 625, 8, 'away'],
      [619, 50, 600, 6, 'home'],
    ] as const) {
      const w = scene({ x: bx, z: bz }, 320, 320);
      const [me, them] = team === 'home' ? [w.home, w.away] : [w.away, w.home];
      Object.assign(me, { x: mx, z: mz });
      Object.assign(them, { x: 320, z: 32 });
      const brain = brainFor();
      let reached = false;
      for (let t = 0; t < 4 * 60 && !reached; t++) {
        const i = think(brain, w, me, them, STEP);
        stepWorld(w, team === 'home' ? i : NO_INTENT, team === 'away' ? i : NO_INTENT, STEP);
        reached = Math.hypot(w.ball.x - bx, w.ball.z - bz) > 4;
      }
      expect(reached, `${team} from (${mx}, ${mz}) to the ball at (${bx}, ${bz})`).toBe(true);
    }
  });

  it('plays a ball it cannot get behind, against the fence it defends', () => {
    const w = scene({ x: 7.2, z: 14.3 }, 9, 320);
    w.home.z = 5;
    const brain = brainFor();
    for (let t = 0; t < 3 * 60; t++) stepWorld(w, think(brain, w, w.home, w.away, STEP), NO_INTENT, STEP);
    expect(Math.hypot(w.ball.x - 7.2, w.ball.z - 14.3)).toBeGreaterThan(15);
  });

  it('aims at both posts over many shots', () => {
    const aims: Record<Aim, number> = { far: 0, near: 0, straight: 0 };
    for (let seed = 0; seed < 120; seed++) {
      const w = scene({ x: 170 }, 500, 178);
      w.rng = (() => {
        let a = seed * 7919 + 1;
        return () => ((a = (a * 16807) % 2147483647) / 2147483647);
      })();
      w.away.facing = -1;
      aims[think(brainFor(), w, w.away, w.home, STEP).aim]++;
    }
    expect(aims.far).toBeGreaterThan(aims.near);
    expect(aims.near).toBeGreaterThan(aims.straight);
    expect(aims.straight).toBeGreaterThan(0);
  });

  it('a charge release is never swallowed by a same-tick decision', () => {
    const w = scene({ x: 170 }, 500, 178);
    w.away.facing = -1;
    const brain = brainFor();
    think(brain, w, w.away, w.home, STEP);
    expect(brain.intent.shootHeld).toBe(true);
    brain.chargeLeftS = STEP / 2;
    brain.nextDecisionS = 0;
    expect(think(brain, w, w.away, w.home, STEP).shootHeld).toBe(false);
  });

  it('Max scores against an idle Harrison on every difficulty', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const w = createWorld(BASE_STATS, BASE_STATS, 7, { home: 4, away: DIFFICULTY[difficulty].aimErrorDeg });
      w.match.kickoffTeam = 'away';
      const brain = createBrain(DIFFICULTY[difficulty]);
      for (let t = 0; t < 30 * 60 && w.match.score.away === 0; t++) stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      expect(w.match.score.away, difficulty).toBeGreaterThan(0);
    }
  });

  /**
   * Plays whole AI-vs-AI matches and checks every guarantee: a result, no NaN, the ball never
   * resting unreached for over 5 s, and nobody standing still for over 10 s in play. With
   * `bothScore`, each side must also score at least once across the seeds.
   */
  function wholeMatches(
    difficulty: 'easy' | 'normal' | 'hard',
    homeStats: Stats,
    awayStats: Stats,
    seeds: readonly number[],
    bothScore: boolean,
    opts: { power?: boolean; stage?: Stage; keepers?: KeeperLineup } = {},
  ): { braced: number; blown: number; waveGoals: number } {
    const goals = { home: 0, away: 0 };
    const waves = { braced: 0, blown: 0, waveGoals: 0 };
    for (const seed of seeds) {
      const kit = opts.power ? { golden: false } : null;
      const aim = { home: DIFFICULTY[difficulty].aimErrorDeg, away: DIFFICULTY[difficulty].aimErrorDeg };
      const w = createWorld({ ...homeStats }, { ...awayStats }, seed, aim, kit, null, null, NORMAL_HANDLING, null, opts.stage, opts.keepers ?? null);
      const keepers = w.keepers ? [w.keepers.home, w.keepers.away] : [];
      const home = createBrain(DIFFICULTY[difficulty]);
      const away = createBrain(DIFFICULTY[difficulty]);
      const bot = powerBot(home, seed);
      const still = new Map<Player, { x: number; z: number; s: number }>();
      let unreachedS = 0;
      const capS = opts.stage ? 300 : 200;
      for (let t = 0; w.match.phase !== 'fullTime' && t < 60 * capS; t++) {
        const homeIntent = opts.power ? bot(w) : think(home, w, w.home, w.away, STEP);
        stepWorld(w, homeIntent, think(away, w, w.away, w.home, STEP), STEP);
        for (const v of [w.ball.x, w.ball.y, w.ball.z, w.home.x, w.home.z, w.away.x, w.away.z, ...keepers.flatMap(k => [k.body.x, k.body.z])]) expect(Number.isFinite(v)).toBe(true);
        for (const k of keepers) {
          const a = k.body.area!;
          const free = k.body.state === 'blown' || k.body.inNet === true;
          if (!free) expect(k.body.x >= a.x0 && k.body.x <= a.x1 && k.body.z >= a.z0 && k.body.z <= a.z1, `seed ${seed}: ${k.side} keeper out of his box`).toBe(true);
        }
        if (opts.power || opts.stage) {
          for (const g of w.field.goals)
            for (const p of [w.home, w.away]) expect(inGoalBox(g, p.x, p.z, 0), `seed ${seed}: ${p.team} in a goal`).toBe(false);
        }
        if (opts.stage) {
          // Nor behind a net: under the roof, which runs on from the goal line to the end fence.
          for (const g of w.field.goals) {
            const [x0, x1] = roofSpan(w.field, g);
            for (const p of [w.home, w.away]) expect(p.x >= x0 && p.x <= x1 && p.z >= g.z0 && p.z <= g.z1, `seed ${seed}: ${p.team} behind a net`).toBe(false);
          }
        }
        if (opts.power) {
          if (w.events.power.braced) waves.braced++;
          if (w.events.power.blown) waves.blown++;
          if (w.events.goal === 'home' && w.wave && w.wave.outcome !== 'braced') waves.waveGoals++;
        }
        if (w.match.phase !== 'playing') {
          unreachedS = 0;
          still.clear();
          continue;
        }
        const resting = Math.hypot(w.ball.vx, w.ball.vz) < 1 && w.ball.y <= BALL_REST_Y + 0.5;
        const near = [w.home, w.away, ...keepers.map(k => k.body)].some(p => Math.hypot(p.x - w.ball.x, p.z - w.ball.z) < 16);
        unreachedS = resting && !near ? unreachedS + STEP : 0;
        expect(unreachedS, `seed ${seed}: ball resting unreached at (${w.ball.x.toFixed(1)}, ${w.ball.z.toFixed(1)})`).toBeLessThanOrEqual(5);
        for (const p of [w.home, w.away]) {
          const a = still.get(p);
          if (!a || Math.hypot(p.x - a.x, p.z - a.z) > 2) still.set(p, { x: p.x, z: p.z, s: 0 });
          else a.s += STEP;
          expect(still.get(p)!.s, `seed ${seed}: ${p.team} stuck at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).toBeLessThanOrEqual(10);
        }
      }
      expect(w.match.result, `seed ${seed}`).not.toBeNull();
      goals.home += w.match.score.home;
      goals.away += w.match.score.away;
    }
    if (bothScore) {
      expect(goals.home).toBeGreaterThan(0);
      expect(goals.away).toBeGreaterThan(0);
    }
    return waves;
  }

  /**
   * Test-only Harrison who uses his power move a lot. He plays as the AI;
   * whenever a power-up can start he presses Y, then shoots with X once
   * the wave is ready, up to 2 s later (his own seeded generator picks),
   * so some run out, some are ended by Max, and the rest fire at whatever
   * range they find. Half are staged at random ranges: just before X, Max
   * is put 20 to 260 px down the lane facing him. The meter is refilled
   * whenever no wave is live, to force many waves.
   */
  function powerBot(brain: AiBrain, seed: number): (w: World) => PlayerIntent {
    const rng = seeded(seed * 7 + 1);
    let shootInS = -1;
    let staged = false;
    let lastShoot = false;
    return w => {
      const intent = think(brain, w, w.home, w.away, STEP);
      if (w.power && !w.wave?.live) w.power.meter = 1;
      if (w.power && w.power.activeS > 0 && shootInS >= 0) {
        shootInS -= STEP;
        const shoot = shootInS <= 0 && !lastShoot;
        if (shoot && staged) {
          const x = Math.min(w.ball.x + 20 + rng() * 240, w.field.fenceR - PLAYER_R);
          Object.assign(w.away, { x, z: w.ball.z + (rng() - 0.5) * 20, facing: -1, vx: 0, vz: 0 });
        }
        lastShoot = shoot;
        return { ...intent, shootHeld: shoot };
      }
      lastShoot = false;
      if (!canStartPower(w) || w.home.held.power) return intent;
      staged = rng() < 0.5;
      shootInS = WAVE_READY_S + (staged ? 2 * STEP : rng() * 2);
      return { ...intent, shootHeld: false, powerHeld: true };
    };
  }

  /** Every stat at `n` but Stamina, which stays 1 so these matches play as before Stamina existed. */
  const allAt = (n: number): Stats => ({ ...(Object.fromEntries(STAT_NAMES.map(k => [k, n])) as Record<StatName, number>), stamina: 1 });

  it.each(['easy', 'normal', 'hard'] as const)(
    'a whole AI-vs-AI match on %s: result, no NaN, both sides score, the ball never rests unreached for over 5 s, and nobody stands still for over 10 s in play',
    difficulty => void wholeMatches(difficulty, BASE_STATS, BASE_STATS, [21, 22, 23], true),
  );

  it.each([
    [10, 10],
    [10, 1],
    [1, 10],
  ] as const)('a whole AI-vs-AI match at stats %s vs %s on normal keeps every guarantee', (home, away) => {
    wholeMatches('normal', allAt(home), allAt(away), [31, 32, 33], home === 10 && away === 10);
  });

  it('whole AI-vs-AI matches on the School stage: result, nothing stuck, nobody in a goal', () => {
    wholeMatches('normal', BASE_STATS, BASE_STATS, [1, 2, 3, 4, 5, 6, 7, 8], false, { stage: SCHOOL_STAGE });
  });

  // At School Field stats (the scripted Harrison's, both sides): at Base stats neither side's shots beat a keeper often enough to score in eight matches.
  it('whole AI-vs-AI matches with keepers keep every guarantee, and both sides score', () => {
    const school = harrisonStats(10);
    for (const d of DIFFICULTIES) wholeMatches(d, school, school, [1, 2, 3, 4, 5, 6, 7, 8], true, { stage: SCHOOL_STAGE, keepers: keeperLineup(1, d) });
  });

  it.each(['easy', 'normal', 'hard'] as const)('with Energy Waves in play on %s, every guarantee holds, and Max both braces and is blown away', difficulty => {
    const waves = wholeMatches(difficulty, BASE_STATS, BASE_STATS, [41, 42, 43], false, { power: true });
    expect(waves.braced).toBeGreaterThan(0);
    expect(waves.blown).toBeGreaterThan(0);
    expect(waves.waveGoals).toBeGreaterThan(0);
  });

  it('with no refills, the meter fills about once or twice in an AI-vs-AI match on Normal', () => {
    const fills: number[][] = [];
    for (const seed of [51, 52, 53, 54, 55]) {
      const w = createWorld(BASE_STATS, BASE_STATS, seed, { home: 6, away: 6 }, { golden: false });
      const home = createBrain(DIFFICULTY.normal);
      const away = createBrain(DIFFICULTY.normal);
      const at: number[] = [];
      for (let t = 0; w.match.phase !== 'fullTime' && t < 60 * 200; t++) {
        stepWorld(w, think(home, w, w.home, w.away, STEP), think(away, w, w.away, w.home, STEP), STEP);
        // He'd use it at once: spend it as a fired wave would, so the next fill counts.
        if (w.power!.meter === 1) {
          at.push(t * STEP);
          w.power!.meter = 0;
        }
      }
      fills.push(at);
    }
    for (const at of fills) {
      expect(at.length, JSON.stringify(fills)).toBeLessThanOrEqual(3);
      for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(METER_MIN_REFILL_S);
    }
    expect(fills.filter(at => at.length >= 1).length, JSON.stringify(fills)).toBeGreaterThanOrEqual(3);
  });

  it('reaches a ball beside its own side netting past a still Harrison at the goal\u2019s front corner', () => {
    for (const [difficulty, mx, mz] of [
      ['normal', 616.7, 13],
      ['hard', 590, 8],
      ['easy', 600, 6],
    ] as const) {
      const w = scene({ x: 630.7, z: 14.7 }, 607, 590);
      Object.assign(w.home, { z: 16.7 });
      Object.assign(w.away, { x: mx, z: mz });
      const brain = createBrain(DIFFICULTY[difficulty]);
      let moved = false;
      for (let t = 0; t < 4 * 60 && !moved; t++) {
        stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
        moved = Math.hypot(w.ball.x - 630.7, w.ball.z - 14.7) > 4;
      }
      expect(moved, difficulty).toBe(true);
    }
  });

  /** Plays a match with Harrison parked (or idle where he kicked off); returns the longest the ball sat still in play, and Max's goals. */
  function parkedMatch(difficulty: 'easy' | 'normal' | 'hard', seed: number, park?: { x: number; z: number }): { stuckS: number; maxGoals: number } {
    const w = createWorld(BASE_STATS, BASE_STATS, seed, { home: 4, away: DIFFICULTY[difficulty].aimErrorDeg });
    const brain = createBrain(DIFFICULTY[difficulty]);
    let anchor = { x: w.ball.x, z: w.ball.z, s: 0 };
    let stuckS = 0;
    for (let t = 0; t < 60 * 90 && w.match.phase !== 'fullTime'; t++) {
      if (park && w.match.phase === 'playing') Object.assign(w.home, { ...park, vx: 0, vz: 0 });
      stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      if (w.match.phase !== 'playing' || Math.hypot(w.ball.x - anchor.x, w.ball.z - anchor.z) > 4) anchor = { x: w.ball.x, z: w.ball.z, s: 0 };
      else stuckS = Math.max(stuckS, (anchor.s += STEP));
    }
    return { stuckS, maxGoals: w.match.score.away };
  }

  it.each(['easy', 'normal', 'hard'] as const)('on %s, against an idle Harrison, Max always plays the ball and scores', difficulty => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = parkedMatch(difficulty, seed);
      expect(r.stuckS, `seed ${seed}: ball sat still`).toBeLessThanOrEqual(10);
      expect(r.maxGoals, `seed ${seed}: Max never scored`).toBeGreaterThan(0);
    }
  });

  it('reaches a ball in the far pocket beside the goal it attacks, from in front of that goal', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const w = scene({ x: 11.8, z: 49.4 }, 36, 33);
      Object.assign(w.home, { z: 18 });
      Object.assign(w.away, { z: 27.4 });
      const brain = createBrain(DIFFICULTY[difficulty]);
      let moved = false;
      for (let t = 0; t < 5 * 60 && !moved; t++) {
        Object.assign(w.home, { x: 36, z: 18, vx: 0, vz: 0 });
        stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
        moved = Math.hypot(w.ball.x - 11.8, w.ball.z - 49.4) > 4;
      }
      expect(moved, difficulty).toBe(true);
    }
  });

  it('against Harrison parked in his goal mouth, the ball never sits still for long', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(parkedMatch('normal', seed, { x: 36, z: 32 }).stuckS, `seed ${seed}`).toBeLessThanOrEqual(10);
    }
  });
});

describe('Max and the Energy Wave', () => {
  /** Harrison on the ball at x 200 with a full meter, Max at maxX facing him; Harrison presses Y. */
  function poweredUp(profile: AiProfile, seed: number, maxX = 240) {
    const w = createWorld(BASE_STATS, BASE_STATS, seed, { home: 0, away: profile.aimErrorDeg }, { golden: false });
    w.match.phase = 'playing';
    w.power!.meter = 1;
    Object.assign(w.home, { x: 200, z: 32, facing: 1 });
    Object.assign(w.ball, { x: 208, y: BALL_REST_Y, z: 32, vx: 0, vy: 0, vz: 0 });
    Object.assign(w.away, { x: maxX, z: 32, facing: -1 });
    const brain = createBrain(profile);
    const step = (home: PlayerIntent = NO_INTENT) => stepWorld(w, home, think(brain, w, w.away, w.home, STEP), STEP);
    step({ ...NO_INTENT, powerHeld: true });
    return { w, brain, step };
  }

  /** Steps until the wave is ready. */
  const untilReady = (w: World, step: (h?: PlayerIntent) => void) => {
    for (let i = 0; i < 120 && !w.events.power.ready; i++) step();
  };

  /** What the wave does to Max once fired; null if it never reached him. */
  const result = (w: World, step: (h?: PlayerIntent) => void): 'braced' | 'blown' | 'none' => {
    for (let i = 0; i < 40; i++) {
      step();
      if (w.events.power.braced) return 'braced';
      if (w.events.power.blown) return 'blown';
    }
    return 'none';
  };

  const sure = (p: AiProfile) => ({ ...p, braceSense: 1 });
  const unsure = { ...DIFFICULTY.normal, braceSense: 0 };

  it('when Harrison powers up, Max backs off to bracing range, facing him, and stands square', () => {
    const { w, step } = poweredUp(sure(DIFFICULTY.normal), 4);
    for (let i = 0; i < 100; i++) step();
    expect(w.away.x - w.ball.x).toBeGreaterThan(BRACE_DISTANCE + PLAYER_R + 20);
    expect(w.away.facing).toBe(-1);
    expect(Math.abs(w.away.vx)).toBeLessThan(5);
  });

  it.each(['easy', 'normal', 'hard'] as const)('on %s, a Max who got it right braces a wave fired from far, square', difficulty => {
    for (const maxX of [360, 460, 560]) {
      const { w, step } = poweredUp(sure(DIFFICULTY[difficulty]), 4, maxX);
      untilReady(w, step);
      step({ ...NO_INTENT, shootHeld: true });
      expect(result(w, step), `from ${maxX}`).toBe('braced');
    }
  });

  it('on Normal, firing as soon as it is ready, a Max who got it right braces it, every time', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { w, step } = poweredUp(sure(DIFFICULTY.normal), seed);
      untilReady(w, step);
      step({ ...NO_INTENT, shootHeld: true });
      expect(result(w, step), `seed ${seed}`).toBe('braced');
    }
  });

  it('he backs off slower than Harrison sprints: chased down once it is ready and fired from close, he is blown away', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { w, step } = poweredUp(sure(DIFFICULTY.normal), seed);
      untilReady(w, step);
      let fired = false;
      for (let i = 0; i < 90 && !fired; i++) {
        step({ ...NO_INTENT, moveX: 1, sprint: true, shootHeld: w.away.x - w.ball.x < BRACE_DISTANCE - 10 });
        fired = w.events.power.fired;
      }
      expect(fired, `seed ${seed}`).toBe(true);
      expect(result(w, step), `seed ${seed}`).toBe('blown');
    }
  });

  it('getting it wrong (late, too close, or not backing off), he is mostly blown away by a wave fired as soon as it is ready', () => {
    let blown = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { w, step } = poweredUp(unsure, seed);
      untilReady(w, step);
      step({ ...NO_INTENT, shootHeld: true });
      if (result(w, step) === 'blown') blown++;
    }
    expect(blown).toBeGreaterThanOrEqual(8);
  });

  it('Easy gets it right about half the time, Normal three in four, Hard nine in ten', () => {
    expect([DIFFICULTY.easy.braceSense, DIFFICULTY.normal.braceSense, DIFFICULTY.hard.braceSense]).toEqual([0.5, 0.75, 0.9]);
  });
});

describe('styles at the decision points', () => {
  /** Harrison on the ball at x 400 running right; the away player stands at (520, 32). */
  function onTheBall(profile: AiProfile): { w: World; brain: AiBrain } {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }, null, null, profile);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 392, z: 20, vx: 120, facing: 1 });
    Object.assign(w.ball, { x: 400, y: BALL_REST_Y, z: 20, vx: 120, vy: 0, vz: 0 });
    Object.assign(w.away, { x: 470, z: 40, facing: -1 });
    return { w, brain: createBrain(profile) };
  }
  const toward = (me: Player, intent: PlayerIntent, spot: { x: number; z: number }) => {
    const [dx, dz] = [spot.x - me.x, spot.z - me.z];
    return (intent.moveX * dx + intent.moveZ * dz) / Math.hypot(dx, dz);
  };

  it("a blocker whose opponent has the ball heads for the blocker's spot, deeper than Max's", () => {
    const { w, brain } = onTheBall({ ...DIFFICULTY.normal, style: 'blocker' });
    const own = w.field.goals.find(g => g.side === 'right')!;
    const intent = think(brain, w, w.away, w.home, STEP);
    expect(brain.plan).toBe('defend');
    expect(toward(w.away, intent, defendSpot('blocker', w, w.away, own))).toBeGreaterThan(0.99);
    expect(intent.moveX).toBeGreaterThan(0);
  });

  it("the blocker doesn't drop off a ball beside Harrison that he can't play: he goes for it", () => {
    const { w, brain } = onTheBall({ ...DIFFICULTY.normal, style: 'blocker' });
    // The ball sits by his own near post with Harrison beside it, facing away from it.
    Object.assign(w.ball, { x: 38, z: 21, vx: 0 });
    Object.assign(w.home, { x: 50, z: 14, vx: 0, facing: 1 });
    Object.assign(w.away, { x: 160, z: 23 });
    const intent = think(brain, w, w.away, w.home, STEP);
    expect(brain.plan).toBe('chase');
    expect(intent.moveX).toBeLessThan(0);
    // Max treats it as Harrison's ball, as today.
    const max = onTheBall(DIFFICULTY.normal);
    Object.assign(max.w.ball, { x: 38, z: 21, vx: 0 });
    Object.assign(max.w.home, { x: 50, z: 14, vx: 0, facing: 1 });
    think(max.brain, max.w, max.w.away, max.w.home, STEP);
    expect(max.brain.plan).toBe('defend');
  });

  it("Max still heads for his own spot, goal-side of the ball", () => {
    const { w, brain } = onTheBall(DIFFICULTY.normal);
    const own = w.field.goals.find(g => g.side === 'right')!;
    const intent = think(brain, w, w.away, w.home, STEP);
    expect(toward(w.away, intent, defendSpot('allRound', w, w.away, own))).toBeGreaterThan(0.99);
    expect(intent.moveX).toBeLessThan(0);
  });
});

describe('Boomer Leo', () => {
  /** The away player on the ball 300 px from the goal it attacks (the left one), running at it. */
  function onTheBall(profile: AiProfile): { w: World; brain: AiBrain } {
    const w = createWorld(BASE_STATS, CREW_STATS.leo, 1, { home: 0, away: 0 }, null, null, profile);
    w.match.phase = 'playing';
    const lineX = w.field.goals.find(g => g.side === 'left')!.lineX;
    Object.assign(w.away, { x: lineX + 300, z: 32, vx: -100, facing: -1 });
    Object.assign(w.ball, { x: lineX + 292, y: BALL_REST_Y, z: 32, vx: -100, vy: 0, vz: 0 });
    Object.assign(w.home, { x: 500, z: 10 });
    return { w, brain: createBrain(profile) };
  }

  it('shoots from 300 px out on every difficulty, where Max dribbles on', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const leo = onTheBall(CREW_PROFILES.leo[d]);
      think(leo.brain, leo.w, leo.w.away, leo.w.home, STEP);
      expect(leo.brain.plan, d).toBe('charge');
      const max = onTheBall(DIFFICULTY[d]);
      think(max.brain, max.w, max.w.away, max.w.home, STEP);
      expect(max.brain.plan, d).toBe('dribble');
    }
  });

  it('a steal tap during his wind-up takes the ball and cancels his shot', () => {
    const { w, brain } = onTheBall(CREW_PROFILES.leo.normal);
    const away = think(brain, w, w.away, w.home, STEP);
    stepWorld(w, NO_INTENT, away, STEP);
    expect(w.away.state).toBe('charging');
    expect(maxHasBall(w.away, w.ball)).toBe(true);
    Object.assign(w.home, { x: w.away.x + 10, z: w.away.z, vx: -60, facing: -1, state: 'ground' });
    w.rng = () => 0;
    stepWorld(w, { ...NO_INTENT, steal: true }, think(brain, w, w.away, w.home, STEP), STEP);
    expect(w.events.steal).toBe('stole');
    for (let i = 0; i < 60; i++) {
      stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      expect(w.events.kicks[1]?.kicked ?? null, `tick ${i}`).toBeNull();
    }
  });
});

describe('Tricky Tia', () => {
  /** Tia dribbling left at goal at x 300 on the middle line, Harrison standing `gap` px ahead in her lane. */
  function dribbling(gap: number | null, profile: AiProfile = CREW_PROFILES.tia.normal): { w: World; brain: AiBrain } {
    const w = createWorld(BASE_STATS, CREW_STATS.tia, 1, { home: 0, away: 0 }, null, null, profile);
    w.match.phase = 'playing';
    const z = w.field.depth / 2;
    Object.assign(w.away, { x: 300, z, vx: -60, facing: -1 });
    Object.assign(w.ball, { x: 292, y: BALL_REST_Y, z, vx: -60, vy: 0, vz: 0 });
    Object.assign(w.home, gap === null ? { x: 500, z: 5, facing: -1 } : { x: 300 - gap, z, vx: 0, facing: 1 });
    return { w, brain: createBrain(profile) };
  }
  /** Steps the world with Tia's brain for `s` seconds and Harrison doing `home` each tick. */
  function play(w: World, brain: AiBrain, s: number, home: (i: number) => PlayerIntent = () => NO_INTENT): void {
    for (let i = 0; i < Math.round(s / STEP); i++) stepWorld(w, home(i), think(brain, w, w.away, w.home, STEP), STEP);
  }

  /** Steps until her fake starts; it must within her reaction time. */
  function untilFake(w: World, brain: AiBrain): void {
    let t = 0;
    while (!brain.fake && t <= brain.profile.reactionS) {
      play(w, brain, STEP);
      t += STEP;
    }
    expect(brain.fake).not.toBeNull();
  }

  it('with Harrison standing in her path she fakes one way, then cuts the other way past him with the ball', () => {
    const { w, brain } = dribbling(24);
    const startZ = w.away.z;
    untilFake(w, brain);
    expect(brain.fakes).toBe(1);
    const side = brain.fake!.side;
    play(w, brain, FAKE.leanS - 2 * STEP);
    expect((w.away.z - startZ) * side).toBeGreaterThan(2);
    play(w, brain, FAKE.cutS);
    expect((w.away.z - startZ) * side).toBeLessThan(-8);
    play(w, brain, 0.4);
    expect(w.away.x).toBeLessThan(w.home.x);
    expect(maxHasBall(w.away, w.ball)).toBe(true);
  });

  it("a slide down her line the moment she starts to lean misses: she isn't there any more", () => {
    const { w, brain } = dribbling(24);
    const lineZ = w.away.z;
    untilFake(w, brain);
    Object.assign(w.home, { z: lineZ, facing: 1 });
    for (let i = 0; i < 40; i++) {
      stepWorld(w, i === 0 ? { ...NO_INTENT, chipHeld: true } : NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      expect(w.events.kicks[0]?.tackledBall, `tick ${i}`).toBe(false);
      expect(w.events.kicks[0]?.trippedOpponent, `tick ${i}`).toBe(false);
    }
  });

  it('a slide that reaches her ball wins it: the fake ends and she never gets it back', () => {
    const { w, brain } = dribbling(24);
    let t = 0;
    while (!(brain.fake && brain.fake.t >= FAKE.leanS) && t++ < 120) play(w, brain, STEP);
    Object.assign(w.home, { z: w.away.z, facing: 1 });
    let tackled = -1;
    for (let i = 0; i < 40 && tackled < 0; i++) {
      stepWorld(w, i === 0 ? { ...NO_INTENT, chipHeld: true } : NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      if (w.events.kicks[0]?.tackledBall) tackled = i;
    }
    expect(tackled).toBeGreaterThanOrEqual(0);
    const intent = think(brain, w, w.away, w.home, STEP);
    expect(brain.fake).toBeNull();
    expect(intent.carry).toBeFalsy();
    // Knocked away, the ball runs on: her close control never brings it back.
    for (let i = 0; i < 20; i++) {
      const away = think(brain, w, w.away, w.home, STEP);
      expect(away.carry, `tick ${i}`).toBeFalsy();
      stepWorld(w, NO_INTENT, away, STEP);
    }
    expect(maxHasBall(w.away, w.ball)).toBe(false);
  });

  it('when her fake is over she stops carrying at once and decides afresh that tick', () => {
    const { w, brain } = dribbling(24);
    untilFake(w, brain);
    let intent = think(brain, w, w.away, w.home, STEP);
    for (let i = 0; i < 120 && brain.fake; i++) {
      stepWorld(w, NO_INTENT, intent, STEP);
      intent = think(brain, w, w.away, w.home, STEP);
    }
    expect(brain.fake).toBeNull();
    expect(intent.carry).toBeFalsy();
    expect(brain.nextDecisionS).toBeCloseTo(brain.profile.reactionS, 9);
  });

  it('with nobody ahead she never fakes, and one fake waits out its cooldown before the next', () => {
    const alone = dribbling(null);
    play(alone.w, alone.brain, 1);
    expect(alone.brain.fakes).toBe(0);
    const { w, brain } = dribbling(24);
    untilFake(w, brain);
    expect(brain.fakes).toBe(1);
    play(w, brain, FAKE.leanS + FAKE.cutS + FAKE.goS);
    expect(brain.fake).toBeNull();
    expect(brain.fakeReadyS).toBeGreaterThan(FAKE.cooldownS - 0.05);
    Object.assign(w.home, { x: w.away.x - 24, z: w.away.z, vx: 0, facing: 1 });
    play(w, brain, 0.3);
    expect(brain.fakes).toBe(1);
  });

  it('Max never fakes', () => {
    const { w, brain } = dribbling(24, DIFFICULTY.normal);
    play(w, brain, 1);
    expect(brain.fakes).toBe(0);
  });
});

describe('Pesky Pete', () => {
  /** Ticks until the away player, starting 120 px off with `profile`, gets within 12 px of Harrison's ball as he dribbles away. */
  function ticksToBall(profile: AiProfile): number {
    const w = createWorld(BASE_STATS, CREW_STATS.pete, 1, { home: 0, away: 0 }, null, null, profile);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 300, z: 32, facing: 1 });
    Object.assign(w.ball, { x: 308, y: BALL_REST_Y, z: 32, vx: 0, vy: 0, vz: 0 });
    Object.assign(w.away, { x: 420, z: 50, facing: -1 });
    const brain = createBrain(profile);
    for (let i = 0; i < 300; i++) {
      stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      if (Math.hypot(w.ball.x - w.away.x, w.ball.z - w.away.z) <= 12) return i;
    }
    return Infinity;
  }

  it('gets to the ball carrier sooner than Max would from the same start', () => {
    expect(ticksToBall(CREW_PROFILES.pete.normal)).toBeLessThan(ticksToBall(DIFFICULTY.normal));
  });
});

describe('Speedy Sam: all gas, no brakes', () => {
  const TUNING: Stats = { speed: 7, power: 5, jump: 4, control: 5, stamina: 1 };
  /** Sam in play, placed by hand, with his own handling, and his brain. */
  function samWorld(o: { sam: readonly [number, number]; harrison: readonly [number, number]; ball: readonly [number, number]; touchedBy?: 'home' | 'away' }, d: 'easy' | 'normal' | 'hard' = 'normal') {
    const profile = SAM_PROFILES[d];
    const w = createWorld(TUNING, SAM_STATS, 5, { home: 4, away: profile.aimErrorDeg }, null, null, profile, SAM_HANDLING);
    w.match.phase = 'playing';
    Object.assign(w.away, { x: o.sam[0], z: o.sam[1], facing: -1 });
    Object.assign(w.home, { x: o.harrison[0], z: o.harrison[1], facing: 1 });
    Object.assign(w.ball, { x: o.ball[0], y: BALL_REST_Y, z: o.ball[1], vx: 0, vy: 0, vz: 0, touchedBy: o.touchedBy });
    return { w, brain: createBrain(profile) };
  }

  /**
   * Harrison standing on the ball at x 300; the opponent starting 120 px off and running at it.
   * Harrison drags it back when the opponent is `at` px from the ball. Where is everyone half a second later?
   */
  function dragBackAt(stats: Stats, profile: AiProfile, handling: typeof NORMAL_HANDLING, z: number, at = 50) {
    const w = createWorld(TUNING, stats, 1, { home: 4, away: profile.aimErrorDeg }, null, null, profile, handling);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 300, z: 32, facing: 1 });
    Object.assign(w.ball, { x: 308, y: BALL_REST_Y, z: 32, vx: 0, vy: 0, vz: 0, touchedBy: 'home' });
    Object.assign(w.away, { x: 420, z, facing: -1 });
    const brain = createBrain(profile);
    let [from, touched] = [-1, false];
    for (let t = 0; t < 300 && (from < 0 || t < from + 30); t++) {
      if (from < 0 && w.away.x - w.ball.x <= at) from = t;
      stepWorld(w, from >= 0 && t < from + 3 ? { ...NO_INTENT, moveX: -1 } : NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      const ev = w.events.kicks[1]!;
      if (from >= 0) touched ||= ev.touched || ev.kicked !== null || ev.tackledBall;
    }
    return { past: w.home.x - w.away.x, touched, hisBall: ballAtFeet(w.home, w.ball) };
  }

  it.each([32, 50])('the overshoot: a drag-back as he arrives (from depth %d) leaves him flying past, and the ball with Harrison', z => {
    const { past, touched, hisBall } = dragBackAt(SAM_STATS, SAM_PROFILES.normal, SAM_HANDLING, z);
    expect(past).toBeGreaterThanOrEqual(15);
    expect(touched).toBe(false);
    expect(hisBall).toBe(true);
  });

  it("the overshoot is Sam's: Max at rung 10 meets the same drag-back without flying past", () => {
    for (const z of [32, 50]) expect(dragBackAt(maxStats(LADDER_MATCHES), DIFFICULTY.normal, NORMAL_HANDLING, z).past).toBeLessThan(15);
  });

  it.each([
    ['charging a shot', 12],
    ['charging a shot, Sam level with him in depth', 24],
  ] as const)("coming back from behind Harrison %s, he goes round the ball, never knocking it toward his own goal (from depth %d)", (_, samZ) => {
    // Harrison at x 482 winding up a shot at Sam's goal, the ball at his feet; Sam behind him, toward Harrison's own goal.
    for (const seed of [1, 2, 3]) {
      const { w, brain } = samWorld({ sam: [440, samZ], harrison: [482, 12], ball: [491, 8], touchedBy: 'home' });
      w.rng = seeded(seed);
      for (let t = 0; t < 90; t++) {
        stepWorld(w, { ...NO_INTENT, shootHeld: true, faceX: 1 }, think(brain, w, w.away, w.home, STEP), STEP);
        const touched = w.events.kicks[1]!.touched || w.events.kicks[1]!.tackledBall;
        expect(touched && w.ball.vx > 0, `seed ${seed} tick ${t}: Sam knocked it ${w.ball.vx.toFixed(0)} px/s toward his own goal`).toBe(false);
      }
    }
  });

  it('blocked, he sometimes tries his weak shot from range: the roll decides, once per decision', () => {
    // Sam on the ball 250 px from Harrison's goal, Harrison 40 px ahead in his lane.
    const at = { sam: [278, 32], harrison: [238, 34], ball: [270, 32], touchedBy: 'away' } as const;
    const under = samWorld(at);
    under.w.rng = () => SAM_PROFILES.normal.rangeShot! / 2;
    think(under.brain, under.w, under.w.away, under.w.home, STEP);
    expect(under.brain.plan).toBe('charge');
    const over = samWorld(at);
    over.w.rng = () => 0.999;
    think(over.brain, over.w, over.w.away, over.w.home, STEP);
    expect(over.brain.plan).toBe('dribble');
  });

  it('with Harrison rushing at him in his lane, he knocks it past him rather than trying his range shot', () => {
    const { w, brain } = samWorld({ sam: [278, 32], harrison: [218, 32], ball: [270, 32], touchedBy: 'away' });
    w.home.vx = 170;
    w.rng = () => 0;
    const i = think(brain, w, w.away, w.home, STEP);
    expect(brain.plan).toBe('dribble');
    expect(i.moveX).toBeLessThan(0);
    expect(Math.abs(i.moveZ)).toBeGreaterThan(0.2);
  });

  it('he heads a high ball only facing the goal he attacks, never one that would go at his own', () => {
    // A high ball dropping just on his own-goal side of him: heading it would send it at his own goal.
    const back = samWorld({ sam: [400, 32], harrison: [200, 32], ball: [410, 32] });
    Object.assign(back.w.ball, { y: 36, vx: 0, vy: -20 });
    think(back.brain, back.w, back.w.away, back.w.home, STEP);
    expect(back.brain.plan).not.toBe('jump');
    // The same ball on his upfield side: he heads it on.
    const front = samWorld({ sam: [400, 32], harrison: [200, 32], ball: [390, 32] });
    Object.assign(front.w.ball, { y: 36, vx: 0, vy: -20 });
    think(front.brain, front.w, front.w.away, front.w.home, STEP);
    expect(front.brain.plan).toBe('jump');
  });

  it('with Harrison out of his lane he never shoots from 250 px', () => {
    const { w, brain } = samWorld({ sam: [278, 32], harrison: [238, 56], ball: [270, 32], touchedBy: 'away' });
    w.rng = () => 0;
    think(brain, w, w.away, w.home, STEP);
    expect(brain.plan).toBe('dribble');
  });

  it("dribbling at an open goal he never winds up from beyond his range; a long touch may roll in, but never from further than it can roll", () => {
    // Flat out, his touch sends the ball at his speed plus his push: it rolls (v²/2·friction) about 260 px before it stops.
    const touchRoll = (211 + SAM_HANDLING.touchScale * touchPush(SAM_STATS)) ** 2 / (2 * ROLL_FRICTION);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { w, brain } = samWorld({ sam: [520, 32], harrison: [620, 60], ball: [512, 32], touchedBy: 'away' });
      w.rng = seeded(seed);
      const chargesFrom: number[] = [];
      let lastTouchFrom = Infinity;
      for (let t = 0; t < 600 && w.events.goal === null; t++) {
        const wasCharging = w.away.state === 'charging';
        stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
        const line = w.field.goals[0].lineX;
        if (!wasCharging && w.away.state === 'charging') chargesFrom.push(w.away.x - line);
        if (w.events.kicks[1]!.touched || w.events.kicks[1]!.kicked) lastTouchFrom = w.ball.x - line;
      }
      expect(w.events.goal, `seed ${seed}`).toBe('away');
      for (const d of chargesFrom) expect(d, `seed ${seed}`).toBeLessThanOrEqual(SAM_PROFILES.normal.shootRange + 16);
      expect(lastTouchFrom, `seed ${seed}`).toBeLessThanOrEqual(touchRoll);
    }
  });

  it("backing off from a powered-up Harrison he backpedals at rung-10 Max's pace, not his own", () => {
    const backpedal = (stats: Stats, profile: AiProfile, handling = NORMAL_HANDLING): number => {
      const w = createWorld(TUNING, stats, 3, { home: 4, away: 6 }, { golden: false }, null, profile, handling);
      w.match.phase = 'playing';
      Object.assign(w.home, { x: 300, z: 32 });
      Object.assign(w.ball, { x: 308, y: BALL_REST_Y, z: 32 });
      Object.assign(w.away, { x: 360, z: 32 });
      w.power!.activeS = 2;
      const brain = createBrain({ ...profile, braceSense: 1, backOffS: 0 });
      for (let i = 0; i < 20; i++) stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, STEP), STEP);
      expect(brain.plan).toBe('backOff');
      return Math.hypot(w.away.vx, w.away.vz);
    };
    const maxPace = runSpeed(maxStats(LADDER_MATCHES)) * 0.9;
    expect(backpedal(SAM_STATS, SAM_PROFILES.normal, SAM_HANDLING)).toBeCloseTo(maxPace, 0);
    expect(backpedal(CREW_STATS.pete, CREW_PROFILES.pete.normal)).toBeCloseTo(maxPace, 0);
    expect(backpedal(maxStats(LADDER_MATCHES), DIFFICULTY.normal)).toBeCloseTo(maxPace, 0);
    expect(backpedal(maxStats(3), DIFFICULTY.normal)).toBeCloseTo(runSpeed(maxStats(3)) * 0.9, 0);
  });
});

describe('fooled by a trick', () => {
  const RB: PlayerIntent = { ...NO_INTENT, trick: 'stepover' };
  const SETUP = { profile: TRICK_DIFFICULTY.normal, scale: { stepover: 1, flick: 1 } };

  /** Harrison on the ball at x 300 in the deep half; Max coming at him from 55 px, his brain running, so he's squared up at the sell. */
  function squared(handling = NORMAL_HANDLING) {
    const w = createWorld(BASE_STATS, maxStats(LADDER_MATCHES), 3, { home: 0, away: 0 }, null, null, DIFFICULTY.normal, handling, SETUP);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: 300, z: 40, facing: 1 });
    Object.assign(w.away, { x: 355, z: 40, facing: -1 });
    Object.assign(w.ball, { x: 308, y: BALL_REST_Y, z: 40, vx: 0, vy: 0, vz: 0 });
    return { w, brain: brainFor() };
  }
  const tick = (w: World, brain: AiBrain, home: PlayerIntent = NO_INTENT) => stepWorld(w, home, think(brain, w, w.away, w.home, STEP), STEP);

  /** Fools Max with a stepover; steps to the sell. */
  function confuse() {
    const s = squared();
    tick(s.w, s.brain, RB);
    for (let i = 0; i < 60 && !s.w.away.fooled; i++) tick(s.w, s.brain);
    expect(s.w.away.fooled).toBeTruthy();
    return s;
  }

  it('confused, Max sways a step toward the dip side, then stands facing the ball', () => {
    const { w, brain } = confuse();
    const z0 = w.away.z;
    expect(w.away.fooled!.swayZ).toBeGreaterThan(z0);
    for (let i = 0; i < 24; i++) tick(w, brain);
    expect(brain.plan).toBe('fooled');
    expect(w.away.z - z0).toBeGreaterThanOrEqual(6);
    expect(w.away.z - z0).toBeLessThanOrEqual(10);
    expect(Math.hypot(w.away.vx, w.away.vz)).toBeLessThan(5);
    expect(w.away.facing).toBe(Math.sign(w.ball.x - w.away.x) || w.away.facing);
  });

  it('confused, he never slides, jumps or plays the ball, even rolled to his feet', () => {
    const { w, brain } = confuse();
    Object.assign(w.ball, { x: w.away.x - 8, z: w.away.z, vx: 0, vz: 0 });
    w.ball.touchedBy = 'home';
    for (let i = 0; i < 120 && w.away.fooled; i++) {
      tick(w, brain);
      expect(w.away.state).toBe('ground');
      expect(w.ball.touchedBy).toBe('home');
      const away = w.events.kicks[1]!;
      expect(away.touched || away.kicked !== null || away.tackledBall).toBe(false);
    }
  });

  it('the tick after his confusion ends he decides afresh', () => {
    const { w, brain } = confuse();
    for (let i = 0; i < 120 && w.away.fooled; i++) tick(w, brain);
    tick(w, brain);
    expect(brain.plan).not.toBe('fooled');
  });

  it('a ball rolled at 60 px/s into a confused Max passes him, still Harrison\'s (Review Focus 4)', () => {
    const { w, brain } = confuse();
    Object.assign(w.ball, { x: w.away.x - 20, z: w.away.z, vx: 60, vz: 0 });
    w.ball.touchedBy = 'home';
    for (let i = 0; i < 30 && w.away.fooled; i++) tick(w, brain);
    expect(w.ball.x).toBeGreaterThan(w.away.x);
    expect(w.ball.touchedBy).not.toBe('away');
  });

  it('stumbling, Max with the stick let go stops within a few px', () => {
    const { w, brain } = squared();
    Object.assign(w.away, { x: 400, vx: -100, fooled: { kind: 'stumble', leftS: 0.7, totalS: 0.7, swayZ: 40 } });
    const x0 = w.away.x;
    for (let i = 0; i < 20; i++) tick(w, brain);
    expect(x0 - w.away.x).toBeLessThan(8);
    expect(w.away.anim.name).toBe('stumble');
  });

  it('stumbling at 200 px/s, Sam skids on 30 px or more on his own brakes, in his skid clip until slow, then the stumble', () => {
    const { w, brain } = squared(SAM_HANDLING);
    Object.assign(w.away, { x: 450, vx: -200, fooled: { kind: 'stumble', leftS: 0.7, totalS: 0.7, swayZ: 40 } });
    const x0 = w.away.x;
    const clips: string[] = [];
    for (let i = 0; i < 40; i++) {
      tick(w, brain);
      clips.push(w.away.anim.name);
    }
    // From 200 px/s his 650 px/s² brakes stop him in v²/2a, about 30 px (29 in 1/60 s steps).
    expect(x0 - w.away.x).toBeGreaterThanOrEqual(28);
    expect(clips[0]).toBe('skid');
    expect(clips.at(-1)).toBe('stumble');
    expect(clips.lastIndexOf('skid')).toBeLessThan(clips.indexOf('stumble'));
  });

  it('confused, a fooled player shows the fooled clip', () => {
    const { w, brain } = confuse();
    for (let i = 0; i < 20; i++) tick(w, brain);
    expect(w.away.anim.name).toBe('fooled');
    expect(STEPOVER.swayPx).toBe(8);
  });
});

describe('a keeper holding the ball', () => {
  it('Max keeps his distance while a keeper holds', () => {
    const w = keeperWorld();
    const brain = createBrain(DIFFICULTY.normal);
    runFor(w, 1);
    shotAt(w, { x: 100, z: 64 }, 64, 200, 0, 'left');
    runUntil(w, 1.5, w => w.keepers!.home.holding);
    const k = w.keepers!.home;
    Object.assign(w.away, { x: k.body.x + 20, z: k.body.z });
    for (let i = 0; i < 60; i++) stepWorld(w, NO_INTENT, think(brain, w, w.away, w.home, 1 / 60), 1 / 60);
    expect(Math.hypot(w.away.x - k.body.x, w.away.z - k.body.z)).toBeGreaterThanOrEqual(CROWD_GAP - 1);
    expect(brain.plan).toBe('wait');
  });
});
