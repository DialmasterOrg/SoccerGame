import { describe, expect, it } from 'vitest';
import { BALL_REST_Y } from './ball';
import { BACKYARD, inGoalBox } from './field';
import { BALL_R } from '../art/ball';
import { DIFFICULTY } from './ai';
import { TURN_S, startDragBack } from './dragBack';
import { SCHOOL_STAGE } from './stage';
import { FOOT_SPOT } from './steal';
import { NO_INTENT, NORMAL_HANDLING, type PlayerIntent } from './player';
import { BASE_STATS } from './stats';
import { createWorld, stepWorld, type World } from './world';
import { ballAtFeet } from './zones';

const STEP = 1 / 60;
/** As in contact.test: touched about 14 px ahead, a Control 1 touch rolls the ball on by up to about 11 px. */
const DRIBBLE_RANGE = 26;
const run = (moveX: number): PlayerIntent => ({ ...NO_INTENT, moveX });

/** A world in play: Harrison at (x, z) facing `facing`, the ball at (bx, bz) at rest, Max out of the way. */
function stage(o: { x: number; z?: number; facing: 1 | -1; bx: number; bz?: number; max?: number }): World {
  const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }, null, null, DIFFICULTY.normal);
  w.match.phase = 'playing';
  const z = w.field.depth / 2;
  Object.assign(w.home, { x: o.x, z: o.z ?? z, facing: o.facing });
  Object.assign(w.away, { x: o.max ?? 60, z });
  Object.assign(w.ball, { x: o.bx, y: BALL_REST_Y, z: o.bz ?? z, vx: 0, vy: 0, vz: 0 });
  return w;
}

const ballLegal = (w: World): boolean =>
  !w.field.goals.some(g => inGoalBox(g, w.ball.x, w.ball.z, 0) && Math.abs(w.ball.x - g.lineX) > BALL_R) &&
  w.ball.x >= w.field.fenceL + BALL_R - 1e-9 &&
  w.ball.x <= w.field.fenceR - BALL_R + 1e-9;

describe('the drag-back', () => {
  it('dribbling at a run and reversing comes away the other way with the ball', () => {
    const w = stage({ x: 300, facing: 1, bx: 310 });
    for (let i = 0; i < 60; i++) stepWorld(w, run(1), NO_INTENT, STEP);
    expect(w.ball.x).toBeGreaterThan(w.home.x);
    for (let i = 0; i < 18; i++) stepWorld(w, run(-1), NO_INTENT, STEP);
    // Then he dribbles it away: between touches a Control 1 touch rolls it up to DRIBBLE_RANGE ahead.
    for (let i = 0; i < 18; i++) {
      stepWorld(w, run(-1), NO_INTENT, STEP);
      const ahead = w.home.x - w.ball.x;
      expect(ballAtFeet(w.home, w.ball) || (ahead >= 0 && ahead <= DRIBBLE_RANGE), `ball ${ahead.toFixed(1)} px ahead`).toBe(true);
    }
    expect(w.home.vx).toBeLessThan(0);
    expect(w.home.facing).toBe(-1);
    expect(w.ball.vx).toBeLessThan(0);
  });

  it('turns him at once and takes about TURN_S', () => {
    const w = stage({ x: 300, facing: 1, bx: 310 });
    expect(startDragBack(w, run(-1))).toBe(true);
    expect([w.home.facing, w.home.turnS]).toEqual([-1, TURN_S]);
    expect([w.ball.vx, w.ball.vz]).toEqual([0, 0]);
  });

  it('at a run or a sprint, reversing at any moment between touches turns him with the ball', () => {
    for (const sprint of [false, true])
      for (let k = 40; k < 100; k++) {
        const w = stage({ x: 300, facing: 1, bx: 310 });
        for (let i = 0; i < k; i++) stepWorld(w, { ...run(1), sprint }, NO_INTENT, STEP);
        const ahead = (w.ball.x - w.home.x).toFixed(1);
        expect(startDragBack(w, run(-1)), `${sprint ? 'sprint' : 'run'} after ${k} ticks, ball ${ahead} px ahead`).toBe(true);
      }
  });

  it('a ball knocked well ahead is not his to turn', () => {
    expect(startDragBack(stage({ x: 300, facing: 1, bx: 340 }), run(-1))).toBe(false);
  });

  it("a ball at Max's feet is not his to drag back", () => {
    const w = stage({ x: 300, facing: 1, bx: 312, max: 320 });
    w.away.facing = -1;
    expect(startDragBack(w, run(-1))).toBe(false);
  });

  it("a fast opponent's long reach for his own ball doesn't take Harrison's ball off him: he can still drag it back", () => {
    const w = stage({ x: 300, facing: 1, bx: 310, max: 335 });
    Object.assign(w.away, { facing: -1, handling: { ...NORMAL_HANDLING, ballAhead: 48 } });
    w.ball.touchedBy = 'home';
    expect(startDragBack(w, run(-1))).toBe(true);
  });

  it("a ball Sam knocked on that comes to rest at Harrison's feet is Harrison's: he can drag it back as Sam closes", () => {
    const w = stage({ x: 300, facing: 1, bx: 310, max: 345 });
    Object.assign(w.away, { facing: -1, handling: { ...NORMAL_HANDLING, decel: 500, ballAhead: 48 } });
    w.ball.touchedBy = 'away';
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.ball.touchedBy).toBe('home');
    expect(startDragBack(w, run(-1))).toBe(true);
  });

  it("Sam's long touch bouncing off Harrison's body is Harrison's ball now", () => {
    const w = stage({ x: 300, facing: 1, bx: 330, max: 380 });
    Object.assign(w.away, { facing: -1, handling: { ...NORMAL_HANDLING, decel: 500, ballAhead: 48 } });
    Object.assign(w.ball, { vx: -280, touchedBy: 'away' });
    let bounced = false;
    for (let i = 0; i < 30 && !bounced; i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      bounced = w.ball.vx > 0;
    }
    expect(bounced).toBe(true);
    expect(w.ball.touchedBy).toBe('home');
  });

  it('only a firm push back the other way starts it, on the ground, in play', () => {
    expect(startDragBack(stage({ x: 300, facing: 1, bx: 310 }), run(-0.3))).toBe(false);
    expect(startDragBack(stage({ x: 300, facing: 1, bx: 310 }), run(1))).toBe(false);
    const charging = stage({ x: 300, facing: 1, bx: 310 });
    charging.home.state = 'charging';
    expect(startDragBack(charging, run(-1))).toBe(false);
    const kickoff = stage({ x: 300, facing: 1, bx: 310 });
    kickoff.match.phase = 'kickoff';
    expect(startDragBack(kickoff, run(-1))).toBe(false);
  });

  it('beside a post or the fence the ball is never put inside a goal or through the fence', () => {
    const right = BACKYARD.goals[1];
    const cases = [
      // Against the end fence behind the goal's side: his new front is past the fence.
      stage({ x: 630, z: 56, facing: -1, bx: 620, bz: 56 }),
      // Beside the goal, the ball in front of the line: pulling it round would go through the post and side net.
      stage({ x: right.lineX + 4, z: right.z1 + 7, facing: -1, bx: right.lineX - 8, bz: right.z1 - 2 }),
    ];
    for (const w of cases) {
      expect(startDragBack(w, run(1))).toBe(true);
      for (let i = 0; i < Math.ceil(TURN_S / STEP) + 2; i++) {
        stepWorld(w, run(1), NO_INTENT, STEP);
        expect(ballLegal(w), `ball at (${w.ball.x.toFixed(1)}, ${w.ball.z.toFixed(1)})`).toBe(true);
      }
    }
  });

  it('Max is still a real opponent during the turn', () => {
    // Harrison dribbling at Max drags it back; Max lunges in after it.
    const w = stage({ x: 300, facing: 1, bx: 310, max: 330 });
    w.away.facing = -1;
    stepWorld(w, run(-1), NO_INTENT, STEP);
    expect(w.home.turnS).toBeGreaterThan(0);
    let won = false;
    for (let i = 0; i < 12 && !won; i++) {
      stepWorld(w, run(-1), i === 0 ? { ...NO_INTENT, chipHeld: true } : NO_INTENT, STEP);
      won = w.events.kicks[1]!.tackledBall;
    }
    expect(won).toBe(true);
  });

  it('knocked down mid-turn, the drag-back ends and the ball stays where it is', () => {
    // Max slides in from behind Harrison and takes his feet before the ball comes round.
    const w = stage({ x: 300, facing: 1, bx: 310, max: 280 });
    w.away.facing = 1;
    stepWorld(w, run(-1), NO_INTENT, STEP);
    for (let i = 0; i < 12 && w.home.state !== 'fallen'; i++) stepWorld(w, run(-1), i === 0 ? { ...NO_INTENT, chipHeld: true } : NO_INTENT, STEP);
    expect(w.home.state).toBe('fallen');
    const at = w.ball.x;
    stepWorld(w, run(-1), NO_INTENT, STEP);
    expect(w.home.turnS).toBe(0);
    expect(w.ball.x).toBe(at);
  });
});

/** A School world in play: Harrison dribbling up the screen from (300, 40) for `ticks`, so his dribble's line is up it. */
function upTheScreen(ticks = 20): World {
  const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }, null, null, DIFFICULTY.normal, undefined, null, SCHOOL_STAGE);
  w.match.phase = 'playing';
  Object.assign(w.home, { x: 300, z: 40, facing: 1 });
  Object.assign(w.away, { x: w.field.width - 30, z: 10 });
  Object.assign(w.ball, { x: 300, y: BALL_REST_Y, z: 48, vx: 0, vy: 0, vz: 0, touchedBy: 'home' });
  w.touchRng = () => 0.999;
  for (let i = 0; i < ticks; i++) stepWorld(w, { ...NO_INTENT, moveZ: 1 }, NO_INTENT, STEP);
  expect(w.home.dribbleLine).toEqual({ x: 0, z: 1 });
  return w;
}

/** Steps with `intent` until his turn-round is over; returns whether one ran. */
function turnRound(w: World, intent: PlayerIntent): boolean {
  stepWorld(w, intent, NO_INTENT, STEP);
  const started = w.home.turnS > 0;
  for (let i = 0; i < 30 && w.home.turnS > 0; i++) stepWorld(w, intent, NO_INTENT, STEP);
  return started;
}

describe('turning round in any direction', () => {
  it('running up the screen, pulling the stick down turns him round with the ball', () => {
    const w = upTheScreen();
    expect(turnRound(w, { ...NO_INTENT, moveZ: -1 })).toBe(true);
    expect(Math.abs(w.ball.x - w.home.x)).toBeLessThan(1);
    expect(w.ball.z - w.home.z).toBeCloseTo(-FOOT_SPOT, 0);
    expect(w.home.facing).toBe(1);
    expect(w.home.dribbleLine).toEqual({ x: 0, z: -1 });
  });

  it('a back-diagonal pull turns him round too', () => {
    const w = upTheScreen();
    const [x, z] = [0.6, -0.8];
    expect(turnRound(w, { ...NO_INTENT, moveX: x, moveZ: z })).toBe(true);
    expect(w.ball.x - w.home.x).toBeCloseTo(x * FOOT_SPOT, 0);
    expect(w.ball.z - w.home.z).toBeCloseTo(z * FOOT_SPOT, 0);
  });

  it("pulling back along the pitch is today's drag-back, now with its direction", () => {
    const w = stage({ x: 300, facing: 1, bx: 310 });
    expect(startDragBack(w, run(-1))).toBe(true);
    expect(w.home.turnDir).toEqual({ x: -1, z: 0 });
    expect(w.home.dribbleLine).toEqual({ x: -1, z: 0 });
  });

  it('a 110° cut is a turn touch, not a turn-round', () => {
    const w = upTheScreen();
    const cut = { ...NO_INTENT, moveX: 0.94, moveZ: -0.34 };
    let turn = null;
    for (let i = 0; i < 12 && !turn; i++) {
      stepWorld(w, cut, NO_INTENT, STEP);
      expect(w.home.turnS).toBe(0);
      turn = w.events.turn;
    }
    expect(turn).toBe('turned');
  });
});
