import { describe, expect, it } from 'vitest';
import { BLASTER, STALL_NEAR, WORKER, blasterIntent, blasterMemo, gusMatch, gusMatchWorld, harrisonsStall, workerIntent, workerMemo, type WorkerMemo } from './gusScripts';
import { NO_INTENT } from './player';
import { setBall } from './testKeepers';
import { chargeTime } from './stats';
import { stepWorld, type World } from './world';

const STEP = 1 / 60;
/** The centre spot's slack: a wind-up started this close to it is a kickoff shot. */
const ON_SPOT = 24;

/** Gus's match in play: Harrison on the ball `out` px from Gus's line at z 64, facing it; the partner far upfield. */
function onBall(out: number, seed = 1): World {
  const w = gusMatchWorld('normal', seed);
  w.match.phase = 'playing';
  const lineX = w.field.goals[1]!.lineX;
  Object.assign(w.home, { x: lineX - out - 8, z: 64, facing: 1 });
  Object.assign(w.away, { x: 500, z: 120 });
  setBall(w, { x: lineX - out, z: 64 });
  return w;
}

/** Every shot (kicks of kind 'shot') a script struck over a whole Normal match: where its wind-up began, and the kick. */
function shotsOver(seed: number, script: (w: World, t: number) => ReturnType<typeof blasterIntent>): { fromX: number; fromLine: number; charge: number; overchargeS: number }[] {
  const w = gusMatchWorld('normal', seed);
  const shots: { fromX: number; fromLine: number; charge: number; overchargeS: number }[] = [];
  let [t, fromX] = [0, 0];
  for (let i = 0; i < 60 * 500 && w.match.result === null; i++, t += STEP) {
    const was = w.home.state;
    stepWorld(w, script(w, t), NO_INTENT, STEP);
    if (was !== 'charging' && w.home.state === 'charging') fromX = w.ball.x;
    if (w.events.kicks[0]?.kicked === 'shot') shots.push({ fromX, fromLine: w.field.goals[1]!.lineX - fromX, charge: w.home.kick!.charge, overchargeS: w.home.kick!.overchargeS });
  }
  return shots;
}

describe("Gus's blaster: hard and high from range", () => {
  it('lets every shot go only once it has been full for overS, wound up from within 320 px of the line, his kickoff shot aside', () => {
    for (const seed of [100, 101]) {
      const memo = blasterMemo(seed);
      const shots = shotsOver(seed, (w, t) => blasterIntent(w, t, STEP, memo)).filter(s => Math.abs(s.fromX - 640) > ON_SPOT);
      expect(shots.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const s of shots) {
        expect(s.charge, `seed ${seed}`).toBe(1);
        expect(s.overchargeS, `seed ${seed}`).toBeGreaterThanOrEqual(BLASTER.overS);
        expect(s.fromLine, `seed ${seed}`).toBeLessThanOrEqual(BLASTER.shootRange);
      }
    }
  });
});

describe("Gus's worker: low for the corners, and he works Gus out", () => {
  it('lets every shot go at a low charge', () => {
    for (const seed of [100, 101]) {
      const memo = workerMemo(seed);
      const shots = shotsOver(seed, (w, t) => workerIntent(w, t, STEP, memo));
      expect(shots.length, `seed ${seed}`).toBeGreaterThan(0);
      const tick = STEP / chargeTime(gusMatchWorld('normal', seed).home.stats);
      for (const s of shots) expect(s.charge, `seed ${seed}`).toBeLessThanOrEqual(WORKER.charge + tick + 1e-9);
    }
  });

  /** Steps the worker until his first kick or trick; what it was, and how far off his line Gus was as he began it. */
  function firstAnswer(memo: WorkerMemo): { kick: string | null; trick: string | null; gusOff: number } {
    const w = onBall(82);
    const lineX = w.field.goals[1]!.lineX;
    // A tick for Gus to see him through on goal and come out, as he does the tick a dribbled ball enters his box.
    stepWorld(w, NO_INTENT, NO_INTENT, STEP);
    expect(w.keepers!.away.act).toBe('rush');
    let gusOff = 0;
    for (let i = 0, t = 0; i < 180; i++, t += STEP) {
      const was = w.home.state;
      stepWorld(w, workerIntent(w, t, STEP, memo), NO_INTENT, STEP);
      if (was !== 'chipping' && w.home.state === 'chipping') gusOff = lineX - w.keepers!.away.body.x;
      if (w.events.trick.started) return { kick: null, trick: w.events.trick.started, gusOff: lineX - w.keepers!.away.body.x };
      if (w.events.kicks[0]?.kicked) return { kick: w.events.kicks[0].kicked, trick: null, gusOff };
    }
    return { kick: null, trick: null, gusOff };
  }

  it('with the draw on the chip, he chips Gus once Gus is out', () => {
    const memo = workerMemo(1);
    memo.draw = () => 0;
    const a = firstAnswer(memo);
    expect(a.kick).toBe('chip');
    expect(a.gusOff).toBeGreaterThanOrEqual(WORKER.chipOff);
  });

  it('with the draw on the stepover, he steps over Gus as he comes', () => {
    const memo = workerMemo(1);
    memo.draw = () => 0.99;
    expect(firstAnswer(memo).trick).toBe('stepover');
  });

  it("follows up Gus's push at once, as the School script does, but not 2 s after it", () => {
    for (const [sincePushS, follows] of [[0.5, true], [2.5, false]] as const) {
      const w = onBall(150);
      const memo = workerMemo(7);
      memo.school.brain.nextDecisionS = 0.3;
      memo.school.sincePushS = sincePushS;
      expect(workerIntent(w, 0, STEP, memo).shootHeld, `${sincePushS}`).toBe(follows);
    }
  });

  it('recording a match draws no random number: one seed plays the same twice', () => {
    expect(gusMatch('normal', 101, 'worker')).toEqual(gusMatch('normal', 101, 'worker'));
  });
});

describe('the still check', () => {
  /** A still ball at (x, 64), Harrison standing `gap` px behind it. */
  function stillBall(x: number, gap: number): World {
    const w = gusMatchWorld('normal', 1);
    w.match.phase = 'playing';
    Object.assign(w.home, { x: x - gap, z: 64, facing: 1 });
    setBall(w, { x, z: 64 });
    return w;
  }

  it("skips the scripted Harrison standing by his own still ball in his own half: a player ends that by playing it", () => {
    expect(harrisonsStall(stillBall(200, 20))).toBe(true);
  });

  it('counts every other still ball: one in their half, or one he is nowhere near', () => {
    expect(harrisonsStall(stillBall(900, 20))).toBe(false);
    expect(harrisonsStall(stillBall(200, STALL_NEAR + 10))).toBe(false);
  });
});
