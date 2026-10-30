import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HARRISON_BODY } from '../art/body/proportions';
import { CREW_BODY, CREW_HEADS, crewLook } from '../art/opponents/crew';
import { MAX_HEADS, maxLook } from '../art/opponents/max';
import { SAM_HEADS, samLook } from '../art/opponents/sam';
import { DEFAULT_OUTFIT, type Outfit } from '../meta/locker';
import { BACKYARD, SCHOOL_FIELD } from '../game/field';
import { ANCHOR } from '../art/body/pose';
import { GUS_FRAME } from '../art/keepers/gus';
import { DIVE_FRAMES } from '../art/keepers/poses';
import { OPPONENT_LOOKS, loadGameArt } from './art';
import { stubCanvases } from './testDraw';

describe("each human opponent's art", () => {
  it('Sam wears his own heads and colours, not a stand-in', () => {
    expect(OPPONENT_LOOKS.sam.heads).toBe(SAM_HEADS);
    expect(OPPONENT_LOOKS.sam.look).toEqual(samLook());
    expect(OPPONENT_LOOKS.sam.heads).not.toBe(CREW_HEADS.pete);
    expect(OPPONENT_LOOKS.sam.body).toBe(HARRISON_BODY);
  });

  it('Max and the crew wear their own', () => {
    expect(OPPONENT_LOOKS.max).toEqual({ heads: MAX_HEADS, look: maxLook(), body: HARRISON_BODY });
    for (const id of ['brick', 'leo', 'tia', 'pete'] as const) expect(OPPONENT_LOOKS[id]).toEqual({ heads: CREW_HEADS[id], look: crewLook(id), body: CREW_BODY[id] });
  });
});

describe('dress', () => {
  beforeEach(stubCanvases);
  afterEach(() => vi.unstubAllGlobals());
  const HEADBAND: Outfit = { ...DEFAULT_OUTFIT, extras: ['headband'] };

  it('an outfit equal to what he wears changes nothing: the backdrop keeps its effects', () => {
    const art = loadGameArt();
    art.dress(HEADBAND);
    const fx = art.backdropFx;
    art.dress({ kit: 'home', boots: 'volt', extras: ['headband'] });
    expect(art.backdropFx).toBe(fx);
    expect(art.outfit).toBe(HEADBAND);
  });

  it('a new outfit is worn, with the backdrop effects remade for it', () => {
    const art = loadGameArt();
    const fx = art.backdropFx;
    const plain = art.home;
    art.dress(HEADBAND);
    expect(art.outfit).toEqual(HEADBAND);
    expect(art.home).not.toBe(plain);
    expect(art.backdropFx).not.toBe(fx);
  });
});

describe('goalsFor', () => {
  beforeEach(stubCanvases);
  afterEach(() => vi.unstubAllGlobals());

  it('goal sprites are made once per field', () => {
    const art = loadGameArt();
    expect(art.goalsFor(SCHOOL_FIELD)).toBe(art.goalsFor(SCHOOL_FIELD));
    expect(art.goalsFor(SCHOOL_FIELD)).not.toBe(art.goalsFor(BACKYARD));
  });

  it('the School has its own venue art', () => {
    expect(loadGameArt().venues.school).toBeDefined();
  });
});

describe('keepers', () => {
  beforeEach(stubCanvases);
  afterEach(() => vi.unstubAllGlobals());

  it('keeper sprites are baked once, with dives for both facings', () => {
    const art = loadGameArt();
    expect(art.keepers.eddie).toBe(art.keepers.eddie);
    expect(art.keepers.eddie.dives.far.left).toHaveLength(DIVE_FRAMES);
  });

  it("Gus's frames stand on his own anchor, everyone else's on the shared one", () => {
    const art = loadGameArt();
    expect(art.keepers.gus.anchor).toEqual(GUS_FRAME.anchor);
    expect(art.keepers.eddie.anchor).toEqual(ANCHOR);
  });
});
