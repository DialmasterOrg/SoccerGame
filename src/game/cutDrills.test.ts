import { describe, expect, it } from 'vitest';
import { cutRates, cutTrial, turnRoundTrial, type CutSetup } from './cutScripts';

/** 240 cut timings (each its own roll) make each heavy rate steady to about ±0.03. */
const TRIALS = 240;
const at = (o: Partial<CutSetup>): Omit<CutSetup, 'phaseTicks'> => ({ control: 5, speed: 5, sprint: false, deg: 90, ...o });

/** Each drill's rates, measured once and shared. */
const measured = new Map<string, ReturnType<typeof cutRates>>();
const rates = (o: Omit<CutSetup, 'phaseTicks'>): ReturnType<typeof cutRates> => {
  const key = JSON.stringify(o);
  if (!measured.has(key)) measured.set(key, cutRates(o, TRIALS));
  return measured.get(key)!;
};

describe('the cut drill: turning with the ball feels as the spec says', () => {
  it('a hard 90° cut at a run gives the ball away about a quarter, a sixth and a sixteenth of the time at Control 1, 5 and 10', () => {
    const bands: [number, number, number][] = [
      [1, 0.15, 0.35],
      [5, 0.08, 0.25],
      [10, 0.01, 0.12],
    ];
    for (const [control, lo, hi] of bands) {
      const { heavy } = rates(at({ control }));
      expect(heavy, `Control ${control}`).toBeGreaterThanOrEqual(lo);
      expect(heavy, `Control ${control}`).toBeLessThanOrEqual(hi);
    }
  });

  it('the same cut at a sprint is about twice as risky', () => {
    const bands: [number, number, number][] = [
      [1, 0.32, 0.58],
      [5, 0.18, 0.42],
      [10, 0.03, 0.2],
    ];
    for (const [control, lo, hi] of bands) {
      const { heavy } = rates(at({ control, sprint: true }));
      expect(heavy, `Control ${control}`).toBeGreaterThanOrEqual(lo);
      expect(heavy, `Control ${control}`).toBeLessThanOrEqual(hi);
    }
  });

  it('a 20° nudge is a turn touch every time, and almost never a heavy one', () => {
    for (const control of [1, 5, 10]) {
      const r = rates(at({ control, deg: 20 }));
      expect(r.heavy, `Control ${control}`).toBeLessThanOrEqual(0.03);
      expect(r.turned + r.heavy, `Control ${control}`).toBe(1);
    }
  });

  it('every clean 90° turn ends with his touches taking the ball on his new way', () => {
    for (const sprint of [false, true])
      for (let phaseTicks = 0; phaseTicks < TRIALS; phaseTicks++) {
        const t = cutTrial({ ...at({ sprint }), phaseTicks });
        if (t.turn === 'turned') expect(t.keptTouches, `${sprint ? 'sprint' : 'run'} ${phaseTicks}`).toBeGreaterThanOrEqual(1);
      }
  });

  it('the Speed stat adds no risk: Speed 1 and Speed 10 cut alike', () => {
    expect(Math.abs(rates(at({ speed: 1 })).heavy - rates(at({ speed: 10 })).heavy)).toBeLessThanOrEqual(0.08);
  });

  it('turning round up or down the screen, or on a back diagonal, keeps the ball', () => {
    for (const stick of [{ x: 0, z: -1 }, { x: 0.6, z: -0.8 }])
      for (const sprint of [false, true]) {
        let kept = 0;
        for (let phaseTicks = 0; phaseTicks < 30; phaseTicks++) if (turnRoundTrial(stick, sprint, phaseTicks)) kept++;
        expect(kept, `${JSON.stringify(stick)} ${sprint ? 'sprint' : 'run'}`).toBeGreaterThanOrEqual(28);
      }
  });

  it('a straight dribble never makes a turn touch', () => {
    for (const control of [1, 5, 10]) expect(rates(at({ control, deg: 0 })).none, `Control ${control}`).toBe(1);
  });
});
