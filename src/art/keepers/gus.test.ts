import { describe, expect, it } from 'vitest';
import { bakeAll } from '../body/bake';
import { drawFigure } from '../body/drawFigure';
import { ANCHOR, frameOf, standingPose } from '../body/pose';
import { HARRISON_BODY } from '../body/proportions';
import { HARRISON_HEADS } from '../harrison/head';
import { C, resolvePalette } from '../colors';
import type { IndexedImage } from '../indexedImage';
import { GUS_BODY, GUS_EXTRAS, GUS_FRAME, GUS_HANDS, GUS_HEADS } from './gus';
import { KEEPER_EXTRAS, KEEPER_HEADS, keeperLook } from './keepers';
import { bakeKeeperPoses, diveFrames } from './poses';

const isGlove = (c: number) => c === C.Glove || c === C.GloveShadow;
const count = (img: IndexedImage, test: (c: number) => boolean) => img.data.filter(test).length;
const standing = drawFigure(standingPose(GUS_BODY), GUS_BODY, GUS_HEADS, GUS_EXTRAS);

describe("Goalie Gus's art", () => {
  it("a plain body's frame is the shared one", () => {
    expect(frameOf(HARRISON_BODY)).toEqual({ w: 49, h: 56, anchor: ANCHOR });
    expect(frameOf(GUS_BODY)).toEqual(GUS_FRAME);
  });

  /** The rows his figure fills inside its outline. */
  function drawnRows(img: IndexedImage): { top: number; bottom: number } {
    const rows = Array.from({ length: img.height }, (_, y) => y).filter(y => Array.from({ length: img.width }, (_, x) => img.get(x, y)).some(c => c !== C.None && c !== C.Outline));
    return { top: rows[0]!, bottom: rows[rows.length - 1]! };
  }

  it('he stands about a third taller than Harrison, feet on his anchor', () => {
    expect([standing.width, standing.height]).toEqual([GUS_FRAME.w, GUS_FRAME.h]);
    const gus = drawnRows(standing);
    expect(gus.bottom - gus.top + 1).toBeGreaterThanOrEqual(52);
    expect(gus.bottom - gus.top + 1).toBeLessThanOrEqual(56);
    expect(gus.bottom).toBe(GUS_FRAME.anchor.y);
    const harrison = drawnRows(drawFigure(standingPose(HARRISON_BODY), HARRISON_BODY, HARRISON_HEADS));
    expect(harrison.bottom - harrison.top + 1).toBeGreaterThanOrEqual(40);
    expect(harrison.bottom - harrison.top + 1).toBeLessThanOrEqual(42);
    expect(harrison.bottom).toBe(ANCHOR.y);
  });

  it('his heads are 11-13 px tall, and his front face at most 12 wide', () => {
    for (const f of ['side', 'threeQuarter', 'front'] as const) {
      expect(GUS_HEADS[f].image.height, f).toBeGreaterThanOrEqual(11);
      expect(GUS_HEADS[f].image.height, f).toBeLessThanOrEqual(13);
    }
    expect(GUS_HEADS.front.image.width).toBeLessThanOrEqual(12);
  });

  it("his gloves are bigger than Eddie's, and he wears the captain's armband", () => {
    const eddie = drawFigure(standingPose(HARRISON_BODY), HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS);
    expect(count(standing, isGlove)).toBeGreaterThan(count(eddie, isGlove));
    expect(count(standing, c => c === C.Armband)).toBeGreaterThan(0);
  });

  it('every one of his frames uses at most 14 colours', () => {
    const pal = resolvePalette(keeperLook('gus'));
    const frames = [
      ...Object.values(bakeAll(GUS_BODY, GUS_HEADS, GUS_EXTRAS)).flatMap(c => c.frames),
      ...Object.values(bakeKeeperPoses(GUS_BODY, GUS_HEADS, GUS_EXTRAS)).flat(),
      ...(['far', 'near'] as const).flatMap(t => diveFrames(GUS_BODY, GUS_HEADS, GUS_EXTRAS, 1, t).frames),
    ];
    for (const f of frames) expect(new Set([...f.data].filter(c => c !== C.None).map(c => pal[c]!.join(','))).size).toBeLessThanOrEqual(14);
  });

  it('in his hold frames his gloves are round the ball spot', () => {
    const { anchor } = GUS_FRAME;
    for (const f of bakeKeeperPoses(GUS_BODY, GUS_HEADS, GUS_EXTRAS).hold) {
      const [cx, cy] = [anchor.x + GUS_HANDS.x, anchor.y - GUS_HANDS.y];
      let near = false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) near ||= isGlove(f.get(cx + dx, cy + dy));
      expect(near).toBe(true);
    }
  });
});
