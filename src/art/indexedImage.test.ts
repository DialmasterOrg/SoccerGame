import { describe, expect, it } from 'vitest';
import { IndexedImage, blit, flipX, parseGrid, shearUp, turnLeft } from './indexedImage';

describe('parseGrid', () => {
  const legend = { a: 3, b: 7 };

  it('maps legend chars and treats . as transparent', () => {
    const img = parseGrid(['a.', '.b'], legend);
    expect([img.width, img.height]).toEqual([2, 2]);
    expect([img.get(0, 0), img.get(1, 0), img.get(1, 1)]).toEqual([3, 0, 7]);
  });

  it('throws on ragged rows, naming the row', () => {
    expect(() => parseGrid(['aa', 'a'], legend)).toThrow(/row 1/);
  });

  it('throws on unknown characters, naming char and row', () => {
    expect(() => parseGrid(['ax'], legend)).toThrow(/'x'.*row 0/);
  });
});

describe('IndexedImage', () => {
  it('returns 0 and ignores writes out of bounds', () => {
    const img = new IndexedImage(2, 2);
    img.set(5, 5, 9);
    expect(img.get(-1, 0)).toBe(0);
    expect(img.get(5, 5)).toBe(0);
  });

  it('clone copies pixels without sharing storage', () => {
    const img = new IndexedImage(1, 1);
    img.set(0, 0, 4);
    const copy = img.clone();
    img.set(0, 0, 9);
    expect(copy.get(0, 0)).toBe(4);
  });
});

describe('blit', () => {
  it('copies non-zero pixels at an offset and keeps dst where src is 0', () => {
    const dst = parseGrid(['bbb', 'bbb'], { b: 7 });
    blit(dst, parseGrid(['a.'], { a: 3 }), 1, 1);
    expect([dst.get(1, 1), dst.get(2, 1), dst.get(0, 0)]).toEqual([3, 7, 7]);
  });
});

describe('flipX', () => {
  it('mirrors an odd-width image around its centre column', () => {
    const f = flipX(parseGrid(['a.b.c'], { a: 1, b: 2, c: 3 }));
    expect([f.get(0, 0), f.get(2, 0), f.get(4, 0)]).toEqual([3, 2, 1]);
  });
});

describe('turning and shearing', () => {
  it('turnLeft gives a quarter turn anticlockwise', () => {
    const t = turnLeft(parseGrid(['ab', 'cd', 'ef'], { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }));
    expect([t.width, t.height]).toEqual([3, 2]);
    expect([t.get(0, 0), t.get(1, 0), t.get(2, 0), t.get(0, 1), t.get(2, 1)]).toEqual([2, 4, 6, 1, 5]);
  });

  it('shearUp shifts each row right by the slope per row above the bottom', () => {
    const s = shearUp(parseGrid(['a', 'a', 'a', 'a'], { a: 1 }), 0.5);
    expect(s.width).toBe(3);
    expect([s.get(2, 0), s.get(1, 1), s.get(1, 2), s.get(0, 3)]).toEqual([1, 1, 1, 1]);
  });
});
