import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from './ai';
import { BALL_REST_Y } from './ball';
import { ROLL_FRICTION } from './constants';
import { HEAVY, TURN_TOUCH_S, heavyTouchChance, turnWithBall } from './closeControl';
import { DOG_DIFFICULTY } from './dog';
import { NO_INTENT, type PlayerIntent } from './player';
import { SCHOOL_STAGE } from './stage';
import { BASE_STATS, runSpeed, touchPush, type Stats } from './stats';
import { FOOT_SPOT } from './steal';
import type { Wave } from './wave';
import { createWorld, stepWorld, type World } from './world';

const STEP = 1 / 60;
const CLEAN = (): number => 0.999;
const HEAVY_ROLL = (): number => 0;
const stick = (deg: number, sprint = false): PlayerIntent => ({ ...NO_INTENT, moveX: Math.cos((deg * Math.PI) / 180), moveZ: Math.sin((deg * Math.PI) / 180), sprint });
const at = (stats: Stats, control: number): Stats => ({ ...stats, control });

/**
 * A School world in play: Harrison at (x, z) running at his run speed along
 * `line` (a unit vector) with the ball his, `ahead` px along that line and
 * rolling a little faster than him; his touch cooldown over; Max parked far
 * away. Clean rolls unless told otherwise.
 */
function dribbling(o: { x?: number; z?: number; line?: { x: number; z: number }; ahead?: number; dog?: boolean } = {}): World {
  const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }, null, o.dog ? DOG_DIFFICULTY.normal : null, DIFFICULTY.normal, undefined, null, o.dog ? undefined : SCHOOL_STAGE);
  w.match.phase = 'playing';
  const line = o.line ?? { x: 1, z: 0 };
  const [x, z, ahead] = [o.x ?? 300, o.z ?? 60, o.ahead ?? 12];
  const run = runSpeed(BASE_STATS);
  Object.assign(w.home, { x, z, vx: line.x * run, vz: line.z * run, facing: line.x < 0 ? -1 : 1, dribbleLine: line, touchCooldown: 0 });
  Object.assign(w.away, { x: w.field.width - 30, z: 10 });
  Object.assign(w.ball, { x: x + line.x * ahead, y: BALL_REST_Y, z: z + line.z * ahead, vx: line.x * (run + 10), vy: 0, vz: line.z * (run + 10), touchedBy: 'home' });
  w.touchRng = CLEAN;
  return w;
}

/** Steps with `intent` until his clean turn's roll is over (at most 20 ticks); returns how many ticks it ran. */
function rollOut(w: World, intent: PlayerIntent): number {
  let n = 0;
  while (w.home.turnTouch !== null && n < 20) {
    stepWorld(w, intent, NO_INTENT, STEP);
    n++;
  }
  return n;
}

describe("heavyTouchChance: the risk of turning with the ball", () => {
  it('pins the spec table for one snap cut', () => {
    const sprint = 1.45;
    const rows: [number, number, number, number][] = [
      [90, 1, 0.25, 0.06],
      [90, sprint, 0.45, 0.109],
      [45, 1, 0.054, 0.013],
    ];
    for (const [deg, pace, c1, c10] of rows) {
      expect(heavyTouchChance(at(BASE_STATS, 1), deg, pace), `${deg}° pace ${pace} C1`).toBeCloseTo(c1, 2);
      expect(heavyTouchChance(at(BASE_STATS, 10), deg, pace), `${deg}° pace ${pace} C10`).toBeCloseTo(c10, 2);
    }
    expect(heavyTouchChance(at(BASE_STATS, 5), 90, 1)).toBeCloseTo(0.167, 2);
    expect(heavyTouchChance(at(BASE_STATS, 5), 90, sprint)).toBeCloseTo(0.3, 2);
    expect(heavyTouchChance(at(BASE_STATS, 5), 45, 1)).toBeCloseTo(0.036, 2);
  });

  it('a 20° nudge at a run is 1% or less, yet any turn of 10° or more is never safe', () => {
    expect(heavyTouchChance(at(BASE_STATS, 1), 20, 1)).toBeLessThanOrEqual(0.01);
    expect(heavyTouchChance(at(BASE_STATS, 10), 10, 1)).toBeGreaterThan(0);
  });

  it('the Speed stat adds no risk: the same pace carries the same chance', () => {
    expect(heavyTouchChance({ ...BASE_STATS, speed: 10 }, 90, 1)).toBe(heavyTouchChance({ ...BASE_STATS, speed: 1 }, 90, 1));
  });
});

describe('turning with the ball', () => {
  it('a cut up the screen rolls the ball round to his new front, then knocks it on his new way', () => {
    const w = dribbling();
    stepWorld(w, stick(90), NO_INTENT, STEP);
    expect(w.events.turn).toBe('turned');
    expect(w.events.kicks[0]!.touched).toBe(true);
    const ticks = rollOut(w, stick(90));
    expect(ticks * STEP).toBeLessThanOrEqual(TURN_TOUCH_S + STEP);
    const speed = Math.hypot(w.home.vx, w.home.vz);
    const knock = speed + touchPush(BASE_STATS);
    expect(Math.abs(w.ball.x - w.home.x)).toBeLessThan(1);
    // Knocked on, its own roll takes it the last step to his front, less one tick's friction.
    expect(w.ball.z - w.home.z).toBeGreaterThanOrEqual(FOOT_SPOT - ROLL_FRICTION * STEP * STEP - 1e-6);
    expect(w.ball.z - w.home.z).toBeLessThanOrEqual(FOOT_SPOT + knock * STEP + 1);
    expect(w.ball.vx).toBeCloseTo(0, 6);
    expect(w.ball.vz).toBeCloseTo(knock - ROLL_FRICTION * STEP, 1);
  });

  // The browser check (2026-10-30): the roll eased the ball toward a front that ran on with him, so it lagged, and its last tick
  // closed the whole lag at once, a pop of 6.9 px in one frame between steps of about 2.3.
  it('the roll carries the ball with him: no tick moves it more than twice its pace once knocked on', () => {
    const w = dribbling();
    const steps: number[] = [];
    let [x, z] = [w.ball.x, w.ball.z];
    for (let i = 0; i < 20; i++) {
      stepWorld(w, stick(90), NO_INTENT, STEP);
      steps.push(Math.hypot(w.ball.x - x, w.ball.z - z));
      [x, z] = [w.ball.x, w.ball.z];
    }
    const settled = steps[steps.length - 1]!;
    expect(settled).toBeGreaterThan(1);
    expect(Math.max(...steps)).toBeLessThanOrEqual(2 * settled);
  });

  it("a heavy touch squirts off nearer his old line, faster than a touch, and he can't touch it for a beat", () => {
  // The final review (2026-10-30): dribbling at his own goal near it, a cut out was a turn touch, and a heavy one squirted the ball on
  // along his old line into his own net (48 of 744 staged heavies at the Backyard). The shield has that ball, as it did before.
  it("dribbling at his own goal near it, a cut out is left to the shield: no turn touch, so no heavy one at his net", () => {
    const own = dribbling().field.goals.find(g => g.side === 'left')!.lineX;
    const w = dribbling({ x: own + 60, line: { x: -1, z: 0 } });
    w.touchRng = HEAVY_ROLL;
    stepWorld(w, stick(90), NO_INTENT, STEP);
    expect(w.events.turn).toBeNull();
  });

  // The final review (2026-10-30): a keeper's smother mid-roll left the held ball still and low, so the roll went on moving it out of
  // his gloves for a few frames, and the drag-back had the same gap.
  it.each([
    ['turn', (w: World) => (w.home.turnTouch = { x: 0, z: 1, leftS: TURN_TOUCH_S })],
    ['drag-back', (w: World) => Object.assign(w.home, { turnS: 0.2, turnDir: { x: -1, z: 0 } })],
  ] as const)("a ball the keeper holds is his: the %s ends and never moves it", (_, start) => {
    const held = (roll: boolean): World => {
      const w = keeperWorld();
      const k = w.keepers!.away;
      Object.assign(w.home, { x: k.body.x - 20, z: k.body.z, vx: 0, vz: 0, facing: 1 });
      if (roll) start(w);
      // Down on it after a smother: he holds it on the grass.
      Object.assign(k, { act: 'down', actT: 0, holding: true, dive: { dirX: 0, dirZ: 1 } });
      Object.assign(w.ball, { x: k.body.x - 6, y: BALL_REST_Y, z: k.body.z, vx: 0, vy: 0, vz: 0 });
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      return w;
    };
    const [rolling, still] = [held(true), held(false)];
    expect([rolling.ball.x, rolling.ball.z]).toEqual([still.ball.x, still.ball.z]);
    expect([rolling.home.turnTouch, rolling.home.turnS]).toEqual([null, 0]);
  });

    const w = dribbling();
    w.touchRng = HEAVY_ROLL;
    const speed = Math.hypot(w.home.vx, w.home.vz);
    stepWorld(w, stick(90), NO_INTENT, STEP);
    expect(w.events.turn).toBe('heavy');
    const angle = (Math.atan2(w.ball.vz, w.ball.vx) * 180) / Math.PI;
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(45);
    expect(Math.hypot(w.ball.vx, w.ball.vz)).toBeGreaterThanOrEqual(speed + 1.9 * touchPush(BASE_STATS));
    expect(w.home.dribbleLine).toBeNull();
    for (let t = STEP; t < HEAVY.lockS - 1e-9; t += STEP) {
      stepWorld(w, stick(90), NO_INTENT, STEP);
      expect(w.events.kicks[0]!.touched, `${t.toFixed(2)} s`).toBe(false);
    }
  });

  it("no turn touch for a drift under 10°, nor when the ball isn't his to turn", () => {
    const cases: [string, (w: World) => void, PlayerIntent?][] = [
      ['an 8° drift', () => {}, stick(8)],
      ["Max's last touch", w => (w.ball.touchedBy = 'away')],
      ['the ball in the air', w => (w.ball.y = 10)],
      ['the ball 30 px ahead', w => (w.ball.x = w.home.x + 30)],
      ['the ball 12 px off his line', w => (w.ball.z = w.home.z + 12)],
      ['winding up a shot', w => (w.home.state = 'charging')],
      ['in a drag-back', w => (w.home.turnS = 0.1)],
      ['stumbling', w => (w.home.stumbleS = 0.1)],
      ['his touch cooldown running', w => (w.home.touchCooldown = 0.05)],
      ['the wave live', w => (w.wave = { live: true } as Wave)],
    ];
    for (const [label, set, intent] of cases) {
      const w = dribbling();
      set(w);
      expect(turnWithBall(w, intent ?? stick(90)), label).toBeNull();
    }
  });

  it("Biscuit's carried ball is never turned", () => {
    const w = dribbling({ dog: true, z: 32 });
    w.dog!.carrying = true;
    expect(turnWithBall(w, stick(90))).toBeNull();
  });

  it('a stick pulled back 120° or more is left to the turn-round', () => {
    expect(turnWithBall(dribbling(), stick(130))).toBeNull();
  });

  it('a cut heading back at his own goal is no turn touch', () => {
    const up = { x: 0, z: 1 };
    expect(turnWithBall(dribbling({ x: 640, z: 40, line: up }), { ...NO_INTENT, moveX: -0.9, moveZ: -0.44 })).toBeNull();
    expect(turnWithBall(dribbling({ x: 640, z: 40, line: up }), { ...NO_INTENT, moveX: -0.4, moveZ: 0.92 })).toBe('turned');
  });

  it('near his own goal, a turn toward it is left to the shield', () => {
    const up = { x: 0, z: 1 };
    const line = (w: World): number => w.field.goals.find(g => g.side === 'left')!.lineX;
    const near = dribbling({ z: 40, line: up });
    near.home.x = line(near) + 60;
    near.ball.x = near.home.x;
    expect(turnWithBall(near, { ...NO_INTENT, moveX: -0.45, moveZ: 0.89 })).toBeNull();
    const away = dribbling({ z: 40, line: up });
    away.home.x = line(away) + 60;
    away.ball.x = away.home.x;
    expect(turnWithBall(away, { ...NO_INTENT, moveX: 0.45, moveZ: 0.89 })).toBe('turned');
  });

  it('a cut toward a wall with no room for the ball is no turn touch', () => {
    const w = dribbling({ z: 7 });
    expect(turnWithBall(w, stick(-90))).toBeNull();
  });

  it("Max challenging mid-roll plays the ball (his touch or a 50/50), and the roll lets it go", () => {
    const w = dribbling();
    stepWorld(w, stick(90), NO_INTENT, STEP);
    stepWorld(w, stick(90), NO_INTENT, STEP);
    expect(w.home.turnTouch).not.toBeNull();
    // His own feet are quiet while the ball rolls round.
    expect(w.events.kicks[0]!.touched).toBe(false);
    Object.assign(w.away, { x: w.ball.x + 8, z: w.ball.z, vx: -100, vz: 0, facing: -1 });
    stepWorld(w, stick(90), { ...NO_INTENT, moveX: -1 }, STEP);
    expect(Math.hypot(w.ball.vx, w.ball.vy, w.ball.vz)).toBeGreaterThan(0);
    stepWorld(w, stick(90), { ...NO_INTENT, moveX: -1 }, STEP);
    expect(w.home.turnTouch).toBeNull();
  });

  it('a shot pressed mid-roll ends the roll, and the roll moves the ball no more', () => {
    const w = dribbling();
    stepWorld(w, stick(90), NO_INTENT, STEP);
    stepWorld(w, { ...stick(90), shootHeld: true }, NO_INTENT, STEP);
    expect(w.home.state).toBe('charging');
    expect(w.home.turnTouch).toBeNull();
  });

  it('a trick under way ends the roll', () => {
    const w = dribbling();
    stepWorld(w, stick(90), NO_INTENT, STEP);
    w.home.trick = { kind: 'stepover', t: 0, side: 1, sold: false, pace: 0, onBall: false };
    stepWorld(w, stick(90), NO_INTENT, STEP);
    expect(w.home.turnTouch).toBeNull();
  });

  it('a goal or a whistle mid-roll ends the roll, and the roll moves the ball no more', () => {
    const w = dribbling();
    stepWorld(w, stick(90), NO_INTENT, STEP);
    w.match.phase = 'goal';
    const [bx, bz] = [w.ball.x, w.ball.z];
    stepWorld(w, stick(90), NO_INTENT, STEP);
    expect(w.home.turnTouch).toBeNull();
    expect([w.ball.x, w.ball.z]).toEqual([bx, bz]);
  });

  it('the heavy roll draws from the touch stream only', () => {
    const w = dribbling();
    let [main, touch] = [0, 0];
    w.rng = () => (main++, 0.5);
    w.touchRng = () => (touch++, 0.999);
    expect(turnWithBall(w, stick(90))).toBe('turned');
    expect([main, touch]).toEqual([0, 1]);
  });
});
