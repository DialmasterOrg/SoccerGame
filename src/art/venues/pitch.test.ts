import { describe, expect, it } from 'vitest';
import { project } from '../../game/camera';
import { BACKYARD, SCHOOL_FIELD } from '../../game/field';
import { M } from '../colors';
import type { IndexedImage } from '../indexedImage';
import { backyardLayers } from './backyard';
import { parkLayers } from './park';
import { goalSprites, type GoalArt } from './pitch';

/** FNV-1a over an image's size and pixels. */
function hash(img: IndexedImage): string {
  let h = 0x811c9dc5;
  const mix = (b: number) => {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  for (const v of [img.width, img.height]) {
    mix(v & 255);
    mix(v >> 8);
  }
  for (const b of img.data) mix(b);
  return h.toString(16).padStart(8, '0');
}

const goalHashes = (a: GoalArt) => [hash(a.farNet), hash(a.nearNet), hash(a.nearPost), hash(a.farPost), a.origin.x, a.origin.y];

describe('pitch art for any field', () => {
  // Hashes taken from main 14de5b1's backyardLayers().ground, parkLayers().ground and goalSprites('left' | 'right').
  it("the Backyard's ground and goals are pixel-identical to before the move", () => {
    expect(hash(backyardLayers().ground)).toBe('752c11e6');
    expect(goalHashes(goalSprites(BACKYARD.goals[0]))).toEqual(['25b52ced', 'a2ccacc0', 'c4cce0ee', 'af3f4f92', -12, -76]);
    expect(goalHashes(goalSprites(BACKYARD.goals[1]))).toEqual(['39c51e69', 'a2ccacc0', 'dc19af6e', '23a30f12', 4, -76]);
  });

  it("the Park's ground is pixel-identical to before the move", () => {
    expect(hash(parkLayers().ground)).toBe('38c75d66');
  });

  it("the School's goal posts and bar stand where its goal says", () => {
    const g = SCHOOL_FIELD.goals[1];
    const art = goalSprites(g);
    const base = project(g.lineX, 0, 0, { x: 0 });
    const px = (img: IndexedImage, y: number, z: number) => {
      const p = project(g.lineX, y, z, { x: 0 });
      return img.get(Math.round(p.sx) - Math.round(base.sx + art.origin.x), Math.round(p.sy) - Math.round(base.sy + art.origin.y));
    };
    expect(px(art.nearPost, 0, g.z0)).toBe(M.white);
    expect(px(art.farPost, 47, g.z1)).toBe(M.white);
    expect(px(art.farNet, g.barY, (g.z0 + g.z1) / 2)).toBe(M.white);
  });
});
