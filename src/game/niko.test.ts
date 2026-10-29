import { describe, expect, it } from 'vitest';
import type { AiBrain } from './ai';
import { NO_INTENT, PLAYER_R, type PlayerIntent } from './player';
import { runSpeed } from './stats';
import { maxHasBall } from './steal';
import { kidWorld, stepKid } from './testTryouts';
import { setBall } from './testKeepers';
import type { World } from './world';

const STEP = 1 / 60;
const VARIANTS = [...Array(16)].map((_, i) => i);
/** Niko on the ball this far from Harrison's goal line: too far to shoot, and the ball he pokes through stops well outside the box. */
const OUT = 300;
/** Harrison stands this far ahead of Niko, in his lane. */
const AHEAD = 20;
/** Solid bodies: two centres never come closer than this. */
const APART = 2 * PLAYER_R - 0.5;

/** Niko on the ball facing Harrison's goal; Harrison `AHEAD` px ahead in his lane at the variant's depth, standing, facing him unless told otherwise, with the speed given. */
function squareUp(i: number, home: { facing?: 1 | -1; vx?: number } = {}): { w: World; brain: AiBrain } {
  const { w, brain } = kidWorld('niko', { seed: 1 + i });
  const g = w.field.goals[0]!;
  const z = 44 + 2.5 * i;
  Object.assign(w.away, { x: g.lineX + OUT + 8, z, facing: -1 });
  setBall(w, { x: g.lineX + OUT, z });
  Object.assign(w.home, { x: w.away.x - AHEAD, z, facing: home.facing ?? 1, vx: home.vx ?? 0 });
  return { w, brain };
}

/** 1.2 s of play against a Harrison on `home`: whether Niko gets the ball beyond him, whether Harrison ever played it, and the closest the two bodies came. */
function play(w: World, brain: AiBrain, home: PlayerIntent = NO_INTENT): { beyond: boolean; homePlayed: boolean; closest: number } {
  let [beyond, homePlayed, closest] = [false, false, Infinity];
  for (let k = 0; k < 1.2 / STEP; k++) {
    stepKid(w, brain, STEP, home);
    const h = w.events.kicks[0]!;
    if (h.touched || h.blocked || h.kicked || h.tackledBall) homePlayed = true;
    closest = Math.min(closest, Math.hypot(w.home.x - w.away.x, w.home.z - w.away.z));
    if (maxHasBall(w.away, w.ball) && w.away.x < w.home.x) beyond = true;
  }
  return { beyond, homePlayed, closest };
}

describe('Nutmeg Niko', () => {
  it('nutmegs a still, square Harrison and runs round him: the ball goes through, the bodies never do', () => {
    let beyond = 0;
    for (const i of VARIANTS) {
      const { w, brain } = squareUp(i);
      const r = play(w, brain);
      expect(r.homePlayed, `variant ${i}`).toBe(false);
      expect(r.closest, `variant ${i}`).toBeGreaterThanOrEqual(APART);
      if (r.beyond) beyond++;
    }
    expect(beyond).toBeGreaterThanOrEqual(12);
  });

  it('never nutmegs a moving Harrison', () => {
    for (const i of VARIANTS) {
      const { w, brain } = squareUp(i, { vx: -30 });
      // He backs toward his own goal at 30 px/s, facing Niko, staying square in his lane.
      play(w, brain, { ...NO_INTENT, moveX: -1, faceX: 1, pace: 30 / runSpeed(w.home.stats) });
      expect(brain.started.nutmeg ?? 0, `variant ${i}`).toBe(0);
    }
  });

  it('never nutmegs a side-on Harrison', () => {
    for (const i of VARIANTS) {
      const { w, brain } = squareUp(i, { facing: -1 });
      play(w, brain);
      expect(brain.started.nutmeg ?? 0, `variant ${i}`).toBe(0);
    }
  });
});
