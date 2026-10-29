import { describe, expect, it } from 'vitest';
import { M, type MasterColor } from '../colors';
import type { IndexedImage } from '../indexedImage';
import { BLEACHERS, FLAGPOLE, SCHOOL_FAR_SY } from './school';
import { CROWD_AT, FLAG_AT, FLAG_FRAMES, LEAVES, crowdFrames, flagFrames, leafFrames } from './schoolLife';

const same = (a: IndexedImage, b: IndexedImage) => a.width === b.width && a.height === b.height && a.data.every((v, i) => v === b.data[i]);
const topOpaque = (img: IndexedImage) => {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.get(x, y) !== 0) return y;
  return img.height;
};
const colours = (img: IndexedImage) => new Set(Array.from(img.data).filter(v => v !== 0));

describe('the crowd', () => {
  const { bob, cheer } = crowdFrames();
  const all = [...bob, ...cheer];

  it('all four frames are one size, and the box sits on the bleachers, wholly above the far touchline', () => {
    for (const f of all) expect([f.width, f.height]).toEqual([bob[0].width, bob[0].height]);
    expect(CROWD_AT.x).toBeGreaterThanOrEqual(BLEACHERS.x0);
    expect(CROWD_AT.x + bob[0].width).toBeLessThanOrEqual(BLEACHERS.x1);
    expect(CROWD_AT.y + bob[0].height).toBeLessThanOrEqual(SCHOOL_FAR_SY);
    expect(CROWD_AT.y).toBeLessThan(BLEACHERS.top);
  });

  it('the two bob frames differ, and the cheering frames raise arms above the bobbing heads', () => {
    expect(same(bob[0], bob[1])).toBe(false);
    expect(same(cheer[0], cheer[1])).toBe(false);
    const bobTop = Math.min(topOpaque(bob[0]), topOpaque(bob[1]));
    for (const f of cheer) expect(topOpaque(f)).toBeLessThan(bobTop);
  });

  it('is varied in skin, hair and tops, in master colours', () => {
    const c = colours(bob[0]);
    expect([M.skin, M.tan, M.brownLight].filter(id => c.has(id)).length).toBeGreaterThanOrEqual(2);
    expect([M.red, M.blue, M.volt, M.teal, M.flame, M.violet, M.pink].filter(id => c.has(id)).length).toBeGreaterThanOrEqual(4);
    expect(c.size).toBeGreaterThanOrEqual(8);
  });
});

describe('the flag', () => {
  const frames = flagFrames();

  it('has FLAG_FRAMES frames of one size, no two alike, in at least two colours', () => {
    expect(FLAG_FRAMES).toBeGreaterThanOrEqual(3);
    expect(frames).toHaveLength(FLAG_FRAMES);
    for (const f of frames) {
      expect([f.width, f.height]).toEqual([frames[0]!.width, frames[0]!.height]);
      expect(colours(f).size).toBeGreaterThanOrEqual(2);
    }
    for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) expect(same(frames[i]!, frames[j]!), `${i} vs ${j}`).toBe(false);
  });

  it('flies from the flagpole top', () => {
    expect(Math.abs(FLAG_AT.x - FLAGPOLE.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(FLAG_AT.y - FLAGPOLE.top)).toBeLessThanOrEqual(1);
  });
});

describe('the leaves', () => {
  it('four or five leaves in at least three colours, each with two different tumble frames of at most 4x4', () => {
    expect(LEAVES.length).toBeGreaterThanOrEqual(4);
    expect(LEAVES.length).toBeLessThanOrEqual(5);
    expect(new Set(LEAVES.map(l => l.color)).size).toBeGreaterThanOrEqual(3);
    for (const leaf of LEAVES) {
      const [a, b] = leafFrames(leaf.color as MasterColor);
      expect(same(a, b)).toBe(false);
      for (const f of [a, b]) {
        expect(f.width).toBeLessThanOrEqual(4);
        expect(f.height).toBeLessThanOrEqual(4);
        expect(colours(f).has(M[leaf.color as MasterColor])).toBe(true);
      }
      expect(leaf.swayPx).toBeGreaterThan(0);
      expect(leaf.swayS).toBeGreaterThan(0);
      expect(leaf.speed).not.toBe(0);
    }
  });
});
