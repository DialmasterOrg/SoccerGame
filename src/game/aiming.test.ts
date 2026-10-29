import { describe, expect, it } from 'vitest';
import { judgedChip, openCorner } from './aiming';
import { keeperWorld, setBall } from './testKeepers';

describe('openCorner', () => {
  it("aims Harrison at the corner further from their keeper: far with him near the camera, near with him deep", () => {
    const w = keeperWorld();
    w.keepers!.away.body.z = 44;
    expect(openCorner(w, w.home)).toBe('far');
    w.keepers!.away.body.z = 84;
    expect(openCorner(w, w.home)).toBe('near');
  });

  it("aims the away side by Harrison's keeper, in the goal it attacks", () => {
    const w = keeperWorld();
    w.keepers!.home.body.z = 44;
    w.keepers!.away.body.z = 84;
    expect(openCorner(w, w.away)).toBe('far');
  });

  it('a tie, and a world without keepers, aim far', () => {
    const w = keeperWorld();
    const g = w.field.goals[1]!;
    w.keepers!.away.body.z = (g.z0 + g.z1) / 2;
    expect(openCorner(w, w.home)).toBe('far');
    w.keepers = null;
    expect(openCorner(w, w.home)).toBe('far');
  });
});

describe('judgedChip', () => {
  /** A player on the ball at (x, z), facing the goal it attacks; the left goal for the away side, mirrored. */
  function onBall(side: 'home' | 'away', x: number, z: number) {
    const w = keeperWorld();
    const p = w[side];
    const dir = side === 'home' ? 1 : -1;
    const bx = side === 'home' ? x : w.field.width - x;
    Object.assign(p, { x: bx - dir * 8, z, facing: dir });
    setBall(w, { x: bx, z });
    return { w, p };
  }

  it("gives the drills' judged chip exactly, as it was before it moved here", () => {
    const a = onBall('home', 1128, 64);
    expect(judgedChip(a.w, a.p, 42)).toBe(0.9170295476913451);
    const b = onBall('home', 1150, 80);
    expect(judgedChip(b.w, b.p, 44)).toBe(0.8016473531723022);
  });

  it('mirrors it for the away side, at the left goal', () => {
    const a = onBall('away', 1128, 64);
    expect(judgedChip(a.w, a.p, 42)).toBeCloseTo(0.9170295476913451, 6);
  });
});
