import { describe, expect, it } from 'vitest';
import { drawFigure } from '../body/drawFigure';
import { standingPose } from '../body/pose';
import { HARRISON_BODY } from '../body/proportions';
import { C } from '../colors';
import { HARRISON_KITS } from '../harrison/outfit';
import type { IndexedImage } from '../indexedImage';
import { KITS } from '../kits';
import { KEEPER_EXTRAS, KEEPER_HEADS, KEEPER_NAMES, keeperLook, type KeeperId } from './keepers';

const IDS: KeeperId[] = ['eddie', 'backupA', 'backupB', 'gus'];

describe('the keepers', () => {
  it('Steady Eddie, two backups and Goalie Gus, each with a head in every facing', () => {
    expect(KEEPER_NAMES.eddie).toBe('STEADY EDDIE');
    expect(KEEPER_NAMES.gus).toBe('GOALIE GUS');
    for (const id of IDS) for (const f of ['side', 'threeQuarter', 'front'] as const) expect(KEEPER_HEADS[id][f].image.width).toBeGreaterThan(0);
  });

  it("no keeper's top is any kit's colour, and no two of the four match", () => {
    const kits = new Set([...Object.values(KITS), ...Object.values(HARRISON_KITS)].map(k => k.Jersey));
    const tops = IDS.map(id => keeperLook(id).Jersey);
    for (const top of tops) expect(kits.has(top), top).toBe(false);
    expect(new Set(tops).size).toBe(4);
  });

  it('gloves draw in the glove colours, and only when worn', () => {
    const gloves = (img: IndexedImage) => img.data.filter(c => c === C.Glove || c === C.GloveShadow).length;
    const pose = standingPose(HARRISON_BODY);
    expect(gloves(drawFigure(pose, HARRISON_BODY, KEEPER_HEADS.eddie, KEEPER_EXTRAS))).toBeGreaterThan(4);
    expect(gloves(drawFigure(pose, HARRISON_BODY, KEEPER_HEADS.eddie))).toBe(0);
  });
});
