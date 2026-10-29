import { describe, expect, it } from 'vitest';
import { DEPTH_SHEAR, SMALL_VIEW, project } from '../../game/camera';
import { BACKYARD } from '../../game/field';
import { M } from '../colors';
import type { IndexedImage } from '../indexedImage';
import { backyardLayers, goalSprites, type GoalArt } from './backyard';

const FENCE = [M.wood, M.hair, M.hairShadow];
const GRASS = [M.grass, M.grassLight, M.grassDark];
const MAX_CAM = BACKYARD.width + BACKYARD.depth * DEPTH_SHEAR - SMALL_VIEW.w;

describe('backyardLayers', () => {
  it('builds layers wide enough for the whole camera range, all full height', () => {
    const L = backyardLayers();
    expect(L.far.width).toBe(320);
    expect(L.mid.width).toBeGreaterThanOrEqual(Math.max(480, Math.ceil(MAX_CAM * 0.5 + SMALL_VIEW.w)));
    expect(L.near.width).toBeGreaterThanOrEqual(Math.max(576, Math.ceil(MAX_CAM * 0.8 + SMALL_VIEW.w)));
    expect(L.ground.width).toBeGreaterThanOrEqual(640 + Math.ceil(64 * DEPTH_SHEAR));
    for (const layer of Object.values(L)) expect(layer.height).toBe(180);
  });

  it('puts the back fence foot on the far touchline', () => {
    const near = backyardLayers().near;
    for (let x = 0; x < near.width; x++) {
      expect(FENCE, `x ${x}`).toContain(near.get(x, 111));
      expect(near.get(x, 113), `x ${x}`).toBe(0);
    }
  });

  it('ground layer is grass across the whole pitch', () => {
    const g = backyardLayers().ground;
    for (let y = 112; y < 180; y++) {
      for (let x = 0; x <= 658; x++) {
        const id = g.get(x, y);
        if (FENCE.includes(id)) continue; // the end fences, drawn across the depth
        expect(GRASS, `(${x}, ${y})`).toContain(id);
      }
    }
  });

  it('draws the end fences slanted across the depth', () => {
    const g = backyardLayers().ground;
    const at = (x: number, z: number) => g.get(Math.round(project(x, 1, z, { x: 0 }).sx), Math.round(project(x, 1, z, { x: 0 }).sy));
    for (const z of [0, 32, 63]) {
      expect(FENCE, `left, z ${z}`).toContain(at(2, z));
      expect(FENCE, `right, z ${z}`).toContain(at(638, z));
    }
  });

  it('leaves the sky open above the pitch in the ground layer, away from the end fences', () => {
    const g = backyardLayers().ground;
    expect(g.get(320, 111)).toBe(0);
    expect(g.get(320, 40)).toBe(0);
  });

  it('marks the invisible near board with a darker grass line', () => {
    const g = backyardLayers().ground;
    for (const x of [40, 320, 600]) expect(g.get(x, SMALL_VIEW.nearSY + 1)).toBe(M.grassDark);
  });

  it('the far layer is an opaque sky', () => {
    const far = backyardLayers().far;
    expect(far.data.every(v => v !== 0)).toBe(true);
  });

  it('the far layer tiles without a seam: even width, only the repeating sky bands at its edges', () => {
    const far = backyardLayers().far;
    expect(far.width % 2).toBe(0);
    for (let y = 0; y < far.height; y++) {
      expect(far.get(0, y), `row ${y}`).toBe(far.get(2, y));
      expect(far.get(far.width - 1, y), `row ${y}`).toBe(far.get(far.width - 3, y));
    }
  });

  it('only the ground layer covers the pitch', () => {
    const { mid, near } = backyardLayers();
    for (const y of [113, 150, 179]) {
      expect(mid.get(100, y)).toBe(0);
      expect(near.get(100, y)).toBe(0);
    }
  });
});

/** Opaque columns of a sprite, in screen x at camera 0. */
function opaqueColumns(art: GoalArt, img: IndexedImage, lineX: number): number[] {
  const cols = new Set<number>();
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.get(x, y) !== 0) cols.add(lineX + art.origin.x + x);
  return [...cols];
}

/** The id at a world point, read from a sprite placed for camera 0. */
function pixelAt(art: GoalArt, img: IndexedImage, lineX: number, x: number, y: number, z: number): number {
  const p = project(x, y, z, { x: 0 });
  return img.get(Math.round(p.sx) - (lineX + art.origin.x), Math.round(p.sy) - (SMALL_VIEW.nearSY + art.origin.y));
}

describe('goalSprites', () => {
  for (const goal of BACKYARD.goals) {
    describe(`${goal.side} goal`, () => {
      const art = goalSprites(goal.side);

      it('posts land on the projected post positions', () => {
        for (const [img, z] of [
          [art.nearPost, goal.z0],
          [art.farPost, goal.z1],
        ] as const) {
          const sx = Math.round(project(goal.lineX, 0, z, { x: 0 }).sx);
          const cols = opaqueColumns(art, img, goal.lineX);
          expect(cols).toContain(sx);
          for (const c of cols) expect(Math.abs(c - sx)).toBeLessThanOrEqual(1);
          expect(pixelAt(art, img, goal.lineX, goal.lineX, 0, z)).toBe(M.white); // the foot
          expect(pixelAt(art, img, goal.lineX, goal.lineX, goal.barY + 1, z)).toBe(M.white); // the top
          expect(pixelAt(art, img, goal.lineX, goal.lineX, goal.barY + goal.barThick + 1, z)).toBe(0);
        }
      });

      it('the crossbar runs between the post tops at height 28–30', () => {
        for (const z of [24, 32, 40]) {
          expect(pixelAt(art, art.farNet, goal.lineX, goal.lineX, 28, z)).toBe(M.white);
          expect(pixelAt(art, art.farNet, goal.lineX, goal.lineX, 29, z)).toBe(M.white);
        }
        expect(pixelAt(art, art.farNet, goal.lineX, goal.lineX, 20, 32)).not.toBe(M.white);
      });

      it('has a net mesh between the frame', () => {
        for (const net of [art.farNet, art.nearNet]) {
          const ids = new Set(net.data);
          expect(ids.has(M.silver)).toBe(true);
          expect(ids.has(0)).toBe(true);
        }
      });

      it('splits the nets by depth without losing or adding a pixel', () => {
        // The single back sprite these replace had this many opaque pixels.
        const before = { left: 457, right: 493 }[goal.side];
        const union = art.farNet.data.filter((v, i) => v !== 0 || art.nearNet.data[i] !== 0).length;
        expect(union).toBe(before);
      });
    });
  }

  it('the two goals are drawn from the geometry, not mirrored', () => {
    const left = goalSprites('left');
    const right = goalSprites('right');
    // The slant is global: both goals lean the same way, so the far post is right of the near post on both.
    const nearL = Math.min(...opaqueColumns(left, left.nearPost, 28));
    const farL = Math.min(...opaqueColumns(left, left.farPost, 28));
    const nearR = Math.min(...opaqueColumns(right, right.nearPost, 612));
    const farR = Math.min(...opaqueColumns(right, right.farPost, 612));
    expect(farL).toBeGreaterThan(nearL);
    expect(farR).toBeGreaterThan(nearR);
  });
});
