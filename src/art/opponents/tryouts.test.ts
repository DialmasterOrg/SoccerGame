import { describe, expect, it } from 'vitest';
import { bakeAll } from '../body/bake';
import { HARRISON_BODY, HANK_BODY, standingHipHeight } from '../body/proportions';
import { C, resolvePalette, type MasterColor } from '../colors';
import { harrisonLook } from '../harrison/look';
import { opaqueBounds } from '../raster';
import { maxLook } from './max';
import { crewLook } from './crew';
import { TRYOUT_BODY, TRYOUT_HEADS, tryoutLook } from './tryouts';
import { KIT_SLOT_NAMES } from '../kits';
import { TRYOUT_ORDER, type TryoutKidId } from '../../game/tryouts';

const FACINGS = ['side', 'threeQuarter', 'front'] as const;
const KIDS: readonly TryoutKidId[] = ['hank', 'lola', 'finn', 'priya', 'niko', 'paige'];
const GOLD: readonly MasterColor[] = ['gold', 'goldDark', 'energyGold', 'energyGoldLight'];

describe('the tryouts cast', () => {
  it.each(KIDS)('%s: every head fits the size budget, with its neck inside the image and no earring', id => {
    for (const facing of FACINGS) {
      const { image, neck } = TRYOUT_HEADS[id][facing];
      const b = opaqueBounds(image)!;
      expect(b.h, facing).toBeGreaterThanOrEqual(8);
      expect(b.h, facing).toBeLessThanOrEqual(10);
      expect(neck.x, facing).toBeGreaterThanOrEqual(0);
      expect(neck.x, facing).toBeLessThan(image.width);
      expect(neck.y, facing).toBeLessThanOrEqual(image.height);
      expect(new Set(image.data).has(C.Earring), facing).toBe(false);
    }
  });

  it.each(KIDS)('%s: frames stay within 13 colours', id => {
    const pal = resolvePalette(tryoutLook(id));
    for (const clip of Object.values(bakeAll(TRYOUT_BODY[id], TRYOUT_HEADS[id]))) {
      for (const f of clip.frames) {
        const colours = new Set([...f.data].filter(c => c !== C.None).map(c => pal[c]!.join(',')));
        expect(colours.size, clip.name).toBeLessThanOrEqual(13);
      }
    }
  });

  it("no two jerseys alike, none Harrison's red, Max's blue or Tia's teal, and no keeper top's colours anywhere in a kit", () => {
    const jerseys = KIDS.map(id => tryoutLook(id).Jersey);
    expect(new Set(jerseys).size).toBe(KIDS.length);
    for (const j of jerseys) expect([harrisonLook('home').Jersey, maxLook().Jersey, crewLook('tia').Jersey]).not.toContain(j);
    for (const id of KIDS) {
      for (const slot of KIT_SLOT_NAMES) expect(tryoutLook(id)[slot], `${id} ${slot}`).not.toMatch(/^(emerald|berry|lemon)/);
    }
  });

  it('skin tones vary: at least three across the six', () => {
    expect(new Set(KIDS.map(id => tryoutLook(id).Skin)).size).toBeGreaterThanOrEqual(3);
  });

  it("no even tryout's kid wears gold: backup June's lemon top is in that goal", () => {
    for (const id of KIDS) {
      const tryout = TRYOUT_ORDER.indexOf(id) + 1;
      if (tryout % 2 === 0) expect(GOLD, id).not.toContain(tryoutLook(id).Jersey);
    }
  });

  it('Hank stands taller than Harrison through the torso, on the same hip, and the rest share his build', () => {
    expect(HANK_BODY.torso).toBeGreaterThan(HARRISON_BODY.torso);
    expect(standingHipHeight(HANK_BODY)).toBe(standingHipHeight(HARRISON_BODY));
    expect(TRYOUT_BODY.hank).toBe(HANK_BODY);
    for (const id of KIDS.filter(k => k !== 'hank')) expect(TRYOUT_BODY[id]).toBe(HARRISON_BODY);
  });
});
