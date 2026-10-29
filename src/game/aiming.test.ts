import { describe, expect, it } from 'vitest';
import { openCorner } from './aiming';
import { keeperWorld } from './testKeepers';

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
