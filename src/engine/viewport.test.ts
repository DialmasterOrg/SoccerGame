import { describe, expect, it } from 'vitest';
import { computeViewport } from './viewport';

describe('computeViewport', () => {
  it('integer-scales a 1080p window', () => {
    expect(computeViewport(1920, 1080, 1)).toMatchObject({ scale: 6, x: 0, y: 0 });
  });

  it('letterboxes 1366×768', () => {
    expect(computeViewport(1366, 768, 1)).toMatchObject({ scale: 4, x: 43, y: 24 });
  });

  it('scales in device pixels at dpr 1.5', () => {
    expect(computeViewport(1280, 800, 1.5)).toMatchObject({ scale: 6, deviceW: 1920, deviceH: 1200, x: 0, y: 60 });
  });

  it('never returns scale 0 for tiny windows', () => {
    const v = computeViewport(300, 150, 1);
    expect(v.scale).toBeGreaterThan(0);
    expect(v.scale).toBeCloseTo(150 / 180);
  });

  it('never returns scale 0 for a zero-size window', () => {
    expect(computeViewport(0, 0, 1).scale).toBeGreaterThan(0);
  });

  it('handles ultrawide windows', () => {
    expect(computeViewport(3440, 1440, 1)).toMatchObject({ scale: 8, y: 0 });
  });

  it("fits the 534×300 match into Harrison's maximized 1080p window at 3×", () => {
    expect(computeViewport(1920, 930, 1, 534, 300)).toMatchObject({ scale: 3, x: 159, y: 15 });
    expect(computeViewport(1920, 930, 1)).toMatchObject({ scale: 5, x: 160, y: 15 });
  });

  it('fits it into a maximized 4K window at dpr 1.25 at 6×', () => {
    expect(computeViewport(3072, 1590, 1.25, 534, 300).scale).toBe(6);
  });
});
