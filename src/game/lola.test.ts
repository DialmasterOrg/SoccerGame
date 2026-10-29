import { describe, expect, it } from 'vitest';
import { PLAYER_H } from './player';
import { NO_INTENT } from './player';
import { kidWorld, stepKid } from './testTryouts';
import { setBall } from './testKeepers';
import type { World } from './world';

const STEP = 1 / 60;
const VARIANTS = [...Array(16)].map((_, i) => i);

/** Lola on the ball `out` px from Harrison's goal line, facing it, at depth z. */
function onBall(w: World, out: number, z: number): void {
  const g = w.field.goals[0]!;
  Object.assign(w.away, { x: g.lineX + out + 8, z, facing: -1 });
  setBall(w, { x: g.lineX + out, z });
}

/** Steps until her chip is struck (true) or `s` runs out; `each` runs before every step. */
function chipsWithin(w: World, brain: Parameters<typeof stepKid>[1], s: number, home: Parameters<typeof stepKid>[3] = NO_INTENT, each?: () => void): boolean {
  for (let i = 0; i < s / STEP; i++) {
    each?.();
    stepKid(w, brain, STEP, home);
    if (w.events.kicks[1]?.kicked === 'chip') return true;
  }
  return false;
}

describe('Lofty Lola', () => {
  it('she chips a keeper off his line, and scores some; Max never chips him', () => {
    let [chips, goals, maxChips] = [0, 0, 0];
    for (const i of VARIANTS) {
      for (const asMax of [false, true]) {
        const { w, brain } = kidWorld('lola', { asMax, seed: 1 + i });
        // Harrison parked behind her, out of play.
        Object.assign(w.home, { x: 900, z: 120 });
        onBall(w, 150 + (40 * i) / 15, 44 + 2.5 * i);
        const chipped = chipsWithin(w, brain, 1.5);
        if (asMax) {
          if (chipped) maxChips++;
          continue;
        }
        if (!chipped) continue;
        chips++;
        for (let k = 0; k < 3 / STEP && !w.events.goal; k++) stepKid(w, brain, STEP);
        if (w.events.goal === 'away') goals++;
      }
    }
    expect(chips).toBeGreaterThanOrEqual(14);
    expect(goals).toBeGreaterThanOrEqual(6);
    expect(maxChips).toBe(0);
  });

  it('never chips a keeper on his line', () => {
    for (const i of VARIANTS) {
      const { w, brain } = kidWorld('lola', { seed: 1 + i });
      Object.assign(w.home, { x: 900, z: 120 });
      onBall(w, 150 + (40 * i) / 15, 44 + 2.5 * i);
      const k = w.keepers!.home.body;
      const onLine = () => Object.assign(k, { x: w.field.goals[0]!.lineX + 1, vx: 0 });
      expect(chipsWithin(w, brain, 1.5, NO_INTENT, onLine), `variant ${i}`).toBe(false);
    }
  });

  it('chips over a Harrison charging at her, clear of him', () => {
    let over = 0;
    for (const i of VARIANTS) {
      const { w, brain } = kidWorld('lola', { seed: 1 + i });
      const z = 44 + 2.5 * i;
      onBall(w, 400, z);
      // He's charging from far enough out that a chip can clear him: from 50 px he's on her before one is wound up.
      Object.assign(w.home, { x: w.away.x - 240, z, facing: 1, vx: 150 });
      const charge = { ...NO_INTENT, moveX: 1, sprint: true };
      let [passed, touched, clear] = [false, false, true];
      for (let k = 0; k < 1.5 / STEP; k++) {
        const [wasX, wasHX] = [w.ball.x, w.home.x];
        stepKid(w, brain, STEP, charge);
        if (w.events.kicks[0]?.touched || w.events.kicks[0]?.blocked || w.events.kicks[0]?.kicked) touched = true;
        if (!passed && (wasX - wasHX) * (w.ball.x - w.home.x) <= 0 && brain.started.chip) {
          passed = true;
          clear = w.ball.y > PLAYER_H;
        }
      }
      if ((brain.started.chip ?? 0) > 0 && passed && clear && !touched) over++;
    }
    expect(over).toBeGreaterThanOrEqual(12);
  });

  it('never chips over a still Harrison', () => {
    for (const i of VARIANTS) {
      const { w, brain } = kidWorld('lola', { seed: 1 + i });
      const z = 44 + 2.5 * i;
      onBall(w, 400, z);
      Object.assign(w.home, { x: w.away.x - 30, z, facing: 1 });
      chipsWithin(w, brain, 1.5);
      expect(brain.started.chip ?? 0, `variant ${i}`).toBe(0);
    }
  });
});
