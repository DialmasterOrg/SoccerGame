import { describe, expect, it } from 'vitest';
import { SMALL_VIEW, project } from '../../game/camera';
import { BACKYARD } from '../../game/field';
import { M } from '../colors';
import { backyardLayers } from './backyard';
import { JOGGERS, PATH_Y, joggerFrames, parkLayers } from './park';

const HEDGE = [M.grassDark, M.grass, M.grassLight];
const FAR_SY = SMALL_VIEW.nearSY - BACKYARD.depth;

describe('parkLayers', () => {
  it('every layer is the same size as the Backyard’s', () => {
    const [P, B] = [parkLayers(), backyardLayers()];
    for (const k of ['far', 'mid', 'near', 'ground'] as const) {
      expect([P[k].width, P[k].height], k).toEqual([B[k].width, B[k].height]);
    }
  });

  it('the far layer is an opaque sky that tiles without a seam, sky blue at the top', () => {
    const far = parkLayers().far;
    expect(far.data.every(v => v !== 0)).toBe(true);
    expect(far.width % 2).toBe(0);
    for (let y = 0; y < far.height; y++) {
      expect(far.get(0, y), `row ${y}`).toBe(far.get(2, y));
      expect(far.get(far.width - 1, y), `row ${y}`).toBe(far.get(far.width - 3, y));
    }
    for (let x = 0; x < far.width; x++) expect(far.get(x, 0)).toBe(M.sky);
  });

  it('the far layer has white clouds', () => {
    expect(parkLayers().far.data.filter(v => v === M.white).length).toBeGreaterThan(100);
  });

  it('the near layer is a hedge on the far touchline, in grass greens, with no wood', () => {
    const near = parkLayers().near;
    for (let x = 0; x < near.width; x++) {
      expect(HEDGE, `x ${x}`).toContain(near.get(x, FAR_SY - 1));
      expect(near.get(x, FAR_SY + 1), `x ${x}`).toBe(0);
    }
    expect(near.data.includes(M.wood)).toBe(false);
  });

  it('the ground has end hedges, not wood, where the Backyard has end fences', () => {
    const g = parkLayers().ground;
    expect(g.data.includes(M.wood)).toBe(false);
    const at = (x: number, z: number) => g.get(Math.round(project(x, 1, z, { x: 0 }).sx), Math.round(project(x, 1, z, { x: 0 }).sy));
    for (const z of [0, 32, 63]) {
      expect(HEDGE, `left, z ${z}`).toContain(at(2, z));
      expect(HEDGE, `right, z ${z}`).toContain(at(638, z));
    }
  });

  it('the pitch stripes are the Backyard’s', () => {
    const [p, b] = [parkLayers().ground, backyardLayers().ground];
    for (const y of [FAR_SY + 4, 140, 179]) for (const x of [60, 200, 320, 500]) expect(p.get(x, y), `(${x}, ${y})`).toBe(b.get(x, y));
  });

  it('only the ground layer covers the pitch', () => {
    const { mid, near } = parkLayers();
    for (const y of [FAR_SY + 1, 150, 179]) {
      expect(mid.get(100, y)).toBe(0);
      expect(near.get(100, y)).toBe(0);
    }
  });

  it('the path runs across the mid layer at PATH_Y', () => {
    const mid = parkLayers().mid;
    expect(PATH_Y).toBeLessThan(FAR_SY);
    const pathy = [...Array(mid.width).keys()].filter(x => mid.get(x, PATH_Y) === M.fade).length;
    expect(pathy).toBeGreaterThan(mid.width / 2);
  });
});

describe('joggers', () => {
  it('two different frames, at most 12 px tall, in the given shirt', () => {
    const [a, b] = joggerFrames('violet', 'black');
    expect(a.data).not.toEqual(b.data);
    for (const f of [a, b]) {
      expect(f.height).toBeLessThanOrEqual(12);
      expect(f.data.includes(M.violet)).toBe(true);
      expect(f.data.includes(M.black)).toBe(true);
    }
  });

  it('three joggers, every shirt different, going both ways', () => {
    expect(JOGGERS).toHaveLength(3);
    expect(new Set(JOGGERS.map(j => j.shirt)).size).toBe(3);
    expect(new Set(JOGGERS.map(j => j.dir)).size).toBe(2);
    for (const j of JOGGERS) expect(j.speed).toBeGreaterThan(0);
  });
});
