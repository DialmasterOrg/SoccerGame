import { describe, expect, it } from 'vitest';
import { GRAVITY } from './constants';
import { NO_INTENT } from './player';
import { chargeTime } from './stats';
import { kidWorld, stepKid } from './testTryouts';
import { setBall } from './testKeepers';
import type { World } from './world';

const STEP = 1 / 60;
const VARIANTS = [...Array(16)].map((_, i) => i);
/** Harrison out of the way, nowhere near where the ball comes down. */
const PARK = { x: 250, z: 124 };

/** Steps until the kid heads it (true) or the ball first bounces or `s` runs out (false). */
function headsBeforeBounce(w: World, brain: Parameters<typeof stepKid>[1], s: number, home: Parameters<typeof stepKid>[3] = NO_INTENT): boolean {
  for (let i = 0; i < s / STEP; i++) {
    stepKid(w, brain, STEP, home);
    if (w.events.kicks[1]?.kicked === 'header') return true;
    if (w.events.ball.bounced) return false;
  }
  return false;
}

/**
 * A drop kick from Harrison's end: from his box at x 100, launched at 40°
 * like a keeper's punt, coming down a little short of halfway, where the
 * players wait for it (Hank at x 560).
 */
function dropKick(i: number, asMax = false): boolean {
  const { w, brain } = kidWorld('hank', { asMax, seed: 1 + i });
  Object.assign(w.home, PARK);
  Object.assign(w.away, { x: 560, z: 64, facing: -1 });
  const range = 470 + 6 * i;
  const speed = Math.sqrt((GRAVITY * range) / Math.sin((80 * Math.PI) / 180));
  const a = (40 * Math.PI) / 180;
  setBall(w, { x: 100, z: 40 + 3 * i, y: 20, vx: speed * Math.cos(a), vy: speed * Math.sin(a) });
  return headsBeforeBounce(w, brain, 3);
}

describe('Header Hank', () => {
  it('a drop kick from Harrison\'s end comes down to him: he heads it before it bounces, far more often than Max', () => {
    const hank = VARIANTS.filter(i => dropKick(i)).length;
    const max = VARIANTS.filter(i => dropKick(i, true)).length;
    expect(hank).toBeGreaterThanOrEqual(12);
    expect(max).toBeLessThanOrEqual(hank / 2);
  });

  it('in range he heads at goal: at the line, inside the mouth', () => {
    let onTarget = 0;
    for (const i of VARIANTS) {
      const { w, brain } = kidWorld('hank', { seed: 1 + i });
      Object.assign(w.home, PARK, { x: 600 });
      const z = 40 + 3 * i;
      Object.assign(w.away, { x: 143, z, facing: -1 });
      setBall(w, { x: 140, z, y: 120, vx: 10, vy: 0 });
      if (!headsBeforeBounce(w, brain, 1.5)) continue;
      const g = w.field.goals[0]!;
      const atLine = w.ball.z + (w.ball.vz * (g.lineX - w.ball.x)) / w.ball.vx;
      if (w.ball.vx < 0 && atLine > g.z0 && atLine < g.z1) onTarget++;
    }
    expect(onTarget).toBeGreaterThanOrEqual(12);
  });

  it("he heads Harrison's chip back upfield", () => {
    let cleared = 0;
    for (const i of VARIANTS) {
      const { w, brain } = kidWorld('hank', { seed: 1 + i });
      const z = 44 + 2.5 * i;
      Object.assign(w.home, { x: 892, z, facing: 1 });
      setBall(w, { x: 900, z });
      Object.assign(w.away, { x: 1000, z, facing: -1 });
      // Harrison chips toward the goal Hank defends, held for a little under half his charge, a touch longer each variant.
      const holdS = (0.45 + 0.02 * i) * chargeTime(w.home.stats);
      let t = 0;
      const chip = () => ({ ...NO_INTENT, faceX: 1 as const, chipHeld: (t += STEP) <= holdS });
      if (headsBeforeBounce(w, brain, 2.5, chip) && w.ball.vx < 0) cleared++;
    }
    expect(cleared).toBeGreaterThanOrEqual(12);
  });
});
