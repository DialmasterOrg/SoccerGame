import { describe, expect, it } from 'vitest';
import { createPlayer } from './player';
import { BASE_STATS } from './stats';
import { REACH_Z, ballIn, ballInBody, footZone, headZone, slideZone, touchPoint } from './zones';

describe('zones', () => {
  it('zones mirror with facing', () => {
    const left = createPlayer('home', BASE_STATS, 100, -1);
    expect(footZone(left)).toMatchObject({ x0: 86, x1: 98 });
    const right = createPlayer('home', BASE_STATS, 100, 1);
    expect(footZone(right)).toMatchObject({ x0: 102, x1: 114 });
  });

  it('places the zones from the zone table, REACH_Z either side of his line in depth', () => {
    const p = createPlayer('home', BASE_STATS, 100, 1, 20);
    p.y = 10;
    const depth = { z0: 20 - REACH_Z, z1: 20 + REACH_Z };
    expect(footZone(p)).toEqual({ x0: 102, x1: 114, y0: 10, y1: 22, ...depth });
    expect(headZone(p)).toEqual({ x0: 96, x1: 110, y0: 40, y1: 54, ...depth });
    expect(slideZone(p)).toEqual({ x0: 100, x1: 116, y0: 10, y1: 18, ...depth });
  });

  it('ballIn is a sphere–box overlap', () => {
    const r = { x0: 0, x1: 10, y0: 0, y1: 10, z0: 0, z1: 10 };
    expect(ballIn(r, { x: 12, y: 5, z: 5 }, 3)).toBe(true);
    expect(ballIn(r, { x: 14, y: 5, z: 5 }, 3)).toBe(false);
    expect(ballIn(r, { x: 12, y: 12, z: 5 }, 3)).toBe(true);
    expect(ballIn(r, { x: 13, y: 13, z: 5 }, 3)).toBe(false);
    expect(ballIn(r, { x: 5, y: 5, z: 12 }, 3)).toBe(true);
    expect(ballIn(r, { x: 5, y: 5, z: 14 }, 3)).toBe(false);
  });

  it('touchPoint is just ahead of him along his run, only while he runs', () => {
    const p = createPlayer('home', BASE_STATS, 100, 1, 20);
    expect(touchPoint(p)).toBeNull();
    [p.vx, p.vz] = [60, 80];
    const t = touchPoint(p)!;
    expect(t.x).toBeCloseTo(100 + 7 * 0.6);
    expect(t.z).toBeCloseTo(20 + 7 * 0.8);
  });

  it('his body is an upright cylinder', () => {
    const p = createPlayer('home', BASE_STATS, 100, 1, 20);
    expect(ballInBody(p, { x: 107, y: 3, z: 20 }, 3)).toBe(true);
    expect(ballInBody(p, { x: 105, y: 3, z: 25 }, 3)).toBe(true);
    expect(ballInBody(p, { x: 106, y: 3, z: 26 }, 3)).toBe(false);
    expect(ballInBody(p, { x: 100, y: 44, z: 20 }, 3)).toBe(false);
  });

  it('a bigger body is a bigger cylinder', () => {
    const plain = createPlayer('home', BASE_STATS, 100, 1, 20);
    const big = Object.assign(createPlayer('home', BASE_STATS, 100, 1, 20), { radius: 7, height: 53 });
    expect(ballInBody(big, { x: 109, y: 3, z: 20 }, 3)).toBe(true);
    expect(ballInBody(plain, { x: 109, y: 3, z: 20 }, 3)).toBe(false);
    expect(ballInBody(big, { x: 100, y: 50, z: 20 }, 3)).toBe(true);
    expect(ballInBody(plain, { x: 100, y: 50, z: 20 }, 3)).toBe(false);
  });
});
