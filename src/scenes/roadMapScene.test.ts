import { describe, expect, it } from 'vitest';
import { GLYPH_H, measureText } from '../art/font';
import { BASE_W } from '../engine/viewport';
import { BOSS_ID, PARK_BOSS_ID, SCHOOL_BOSS_ID, TOTAL_STARS, VENUES, venueMaxStars } from '../meta/career';
import { newProfile } from '../meta/profile';
import { STAR_W } from './panel';
import { CARD, LABEL_BELOW, NAME_BELOW, STOPS, createRoadMapScene, postcardFrom } from './roadMapScene';
import { fakeArt, recordingContext } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';
import { createVenueScene, type VenueScene } from './venueScene';

const STEP = 1 / 60;

describe('the road map', () => {
  it('opens on the Backyard and A enters it', () => {
    const ctx = testContext();
    const s = createRoadMapScene(ctx);
    expect(s.kind).toBe('roadMap');
    expect(s.index).toBe(0);
    expect(s.update(frame(['confirm']), STEP)?.kind).toBe('venue');
    expect(ctx.audio.played).toContain('menuConfirm');
  });

  it('Start enters too', () => {
    expect(createRoadMapScene(testContext()).update(frame(['pause']), STEP)?.kind).toBe('venue');
  });

  it('left/right move among six stops without wrapping; a locked stop only blips', () => {
    const ctx = testContext();
    const s = createRoadMapScene(ctx);
    s.update(frame(['left']), STEP);
    expect(s.index).toBe(0);
    expect(ctx.audio.played).not.toContain('menuMove');
    for (let i = 0; i < 7; i++) s.update(frame(['right']), STEP);
    expect(s.index).toBe(5);
    expect(ctx.audio.played.filter(c => c === 'menuMove')).toHaveLength(5);
    expect(s.update(frame(['confirm']), STEP)).toBeNull();
    expect(ctx.audio.played).toContain('nope');
    expect(STOPS).toHaveLength(6);
  });

  it('six stops fit the screen, and no name or label runs into another card', () => {
    expect(STOPS).toHaveLength(VENUES.length);
    type Box = { x0: number; x1: number; y0: number; y1: number };
    const centred = (cx: number, y: number, w: number, h: number): Box => ({ x0: cx - w / 2, x1: cx + w / 2, y0: y, y1: y + h });
    const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const RING = 2; // the cursor's thick frame
    const cards = STOPS.map(s => centred(s.cx, s.y - RING, CARD.w + 2 * RING, CARD.h + 2 * RING));
    // The widest label each stop can show in 7c: full stars after the star, COMING SOON on the first stop without matches, LOCKED after it.
    const firstEmpty = VENUES.findIndex(v => v.matches.length === 0);
    const labelW = (i: number) => {
      const max = venueMaxStars(VENUES[i]!.id);
      return 2 + (i < firstEmpty ? STAR_W + 4 + measureText(`${max}/${max}`) : measureText(i === firstEmpty ? 'COMING SOON' : 'LOCKED'));
    };
    VENUES.forEach((v, i) => {
      const s = STOPS[i]!;
      const texts = [centred(s.cx, s.y + NAME_BELOW, measureText(v.name) + 2, GLYPH_H + 2), centred(s.cx, s.y + LABEL_BELOW, labelW(i), GLYPH_H + 2)];
      for (const b of [cards[i]!, ...texts]) expect(b.x0 >= 0 && b.x1 <= BASE_W, v.name).toBe(true);
      for (const t of texts) cards.forEach((c, j) => j !== i && expect(hits(t, c), `${v.name} vs ${VENUES[j]!.name}`).toBe(false));
    });
  });

  it('the total line reads out of 156, and a postcard is cut 48 rows above its far touchline', () => {
    const { g, drawn } = recordingContext();
    createRoadMapScene(testContext({ art: fakeArt() })).draw(g, 0);
    expect(TOTAL_STARS).toBe(156);
    expect(drawn.some(n => n.startsWith('art.text(STARS 0/156,'))).toBe(true);
    expect(postcardFrom('backyard')).toEqual({ x: 118, y: 64 });
    expect(postcardFrom('park')).toEqual({ x: 118, y: 64 });
    expect(postcardFrom('school')).toEqual({ x: 118, y: 120 });
  });

  it('the Park blips until Biscuit is beaten, then A enters it', () => {
    const before = testContext({ profile: { ...newProfile(), ladderWins: 10 } });
    expect(createRoadMapScene(before, 1).update(frame(['confirm']), STEP)).toBeNull();
    expect(before.audio.played).toContain('nope');
    const ctx = testContext({ profile: { ...newProfile(), ladderWins: 10, career: { stars: { [BOSS_ID]: 1 }, milestonesPaid: 0, lossStreaks: {} } } });
    const s = createRoadMapScene(ctx, 1);
    expect(s.index).toBe(1);
    const park = s.update(frame(['confirm']), STEP) as VenueScene;
    expect(park.kind).toBe('venue');
    expect(park.venue).toBe('park');
  });

  it('B goes to the Hub on CAREER', () => {
    const ctx = testContext();
    const hub = createRoadMapScene(ctx).update(frame(['back']), STEP)!;
    expect(hub.kind).toBe('hub');
    expect(ctx.audio.played).toContain('menuBack');
    expect(hub.update(frame(['confirm']), STEP)?.kind).toBe('roadMap');
  });

  it('turns the match crowd off and plays the title theme, as the Hub does', () => {
    const ctx = testContext();
    ctx.audio.crowd = 'match';
    ctx.audio.music = null;
    createRoadMapScene(ctx);
    expect(ctx.audio.crowd).toBe('off');
    expect(ctx.audio.music).toBe('title');
  });

  it('B on the venue screen comes back to the map', () => {
    expect(createVenueScene(testContext(), 'backyard').update(frame(['back']), STEP)?.kind).toBe('roadMap');
  });
});

describe('the road map into the Park', () => {
  const inPark = (stars: Record<string, number> = {}) => testContext({ art: fakeArt(), profile: { ...newProfile(), ladderWins: 10, career: { stars: { [BOSS_ID]: 1, ...stars }, milestonesPaid: 0, lossStreaks: {} } } });

  it('opens on the stop holding the next match', () => {
    expect(createRoadMapScene(testContext()).index).toBe(0);
    expect(createRoadMapScene(inPark()).index).toBe(1);
    expect(createRoadMapScene(inPark(), 0).index).toBe(0);
  });

  it("once Biscuit is beaten the Park's card is a postcard of its own art", () => {
    const { g, drawn } = recordingContext();
    createRoadMapScene(inPark()).draw(g, 0);
    expect(drawn).toContain('art.venues.park.layers.far');
    const before = recordingContext();
    createRoadMapScene(testContext({ art: fakeArt(), profile: { ...newProfile(), ladderWins: 10 } })).draw(before.g, 0);
    expect(before.drawn).not.toContain('art.venues.park.layers.far');
  });

  it("after Sam the School's card is a postcard of its own art, and A enters it", () => {
    const ctx = inPark({ 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1, [PARK_BOSS_ID]: 1 });
    const { g, drawn } = recordingContext();
    const s = createRoadMapScene(ctx);
    expect(s.index).toBe(2);
    s.draw(g, 0);
    expect(drawn).toContain('art.venues.school.layers.far');
    expect(drawn.some(n => n.startsWith('art.text(COMING SOON,'))).toBe(false);
    const school = s.update(frame(['confirm']), STEP) as VenueScene;
    expect(school.kind).toBe('venue');
    expect(school.venue).toBe('school');
  });

  it('after Gus, STATE says COMING SOON, and A on it still blips', () => {
    const tryouts = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(n => [`school-${n}`, 1]));
    const ctx = inPark({ 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1, [PARK_BOSS_ID]: 1, ...tryouts, [SCHOOL_BOSS_ID]: 1 });
    const { g, drawn } = recordingContext();
    const s = createRoadMapScene(ctx, 3);
    s.draw(g, 0);
    expect(drawn.some(n => n.startsWith('art.text(COMING SOON,'))).toBe(true);
    expect(s.update(frame(['confirm']), STEP)).toBeNull();
    expect(ctx.audio.played).toContain('nope');
  });
});
