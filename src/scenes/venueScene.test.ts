import { describe, expect, it } from 'vitest';
import { BACKYARD, BOSS_ID, PARK, PARK_BOSS_ID, matchById } from '../meta/career';
import { newProfile } from '../meta/profile';
import { fakeArt, recordingContext } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';
import { createVenueScene, nodeX, panelLines, type VenueScene } from './venueScene';
import type { VsScene } from './vsScene';

const STEP = 1 / 60;
const CHARSET = /^[A-Z0-9 '\-:!?.,/+<>]+$/;

describe('the venue screen', () => {
  const ctx6 = () => testContext({ profile: { ...newProfile(), ladderWins: 6 } });

  it('opens on the next match, and left/right move along the rungs and the boss, wrapping', () => {
    const ctx = ctx6();
    const s = createVenueScene(ctx, 'backyard');
    expect(s.kind).toBe('venue');
    expect(s.venue).toBe('backyard');
    expect(s.cursor.id).toBe('backyard-7');
    s.update(frame(['right']), STEP);
    expect(s.cursor.id).toBe('backyard-8');
    expect(ctx.audio.played).toContain('menuMove');
    for (let i = 0; i < 3; i++) s.update(frame(['right']), STEP);
    expect(s.cursor.id).toBe('backyard-boss');
    s.update(frame(['right']), STEP);
    expect(s.cursor.id).toBe('backyard-1');
    s.update(frame(['left']), STEP);
    expect(s.cursor.id).toBe('backyard-boss');
  });

  it('A plays a beaten or next match through the VS card; a locked one only blips', () => {
    const ctx = ctx6();
    const s = createVenueScene(ctx, 'backyard', 'backyard-2');
    expect((s.update(frame(['confirm']), STEP) as VsScene).match.id).toBe('backyard-2');
    expect(ctx.audio.played).toContain('menuConfirm');
    const next = createVenueScene(ctx6(), 'backyard', 'backyard-7');
    expect((next.update(frame(['pause']), STEP) as VsScene).match.id).toBe('backyard-7');
    const locked = createVenueScene(ctx6(), 'backyard', 'backyard-9');
    expect(locked.update(frame(['confirm']), STEP)).toBeNull();
    expect(locked.update(frame(['pause']), STEP)).toBeNull();
  });

  it('the boss before rung 10 takes the cursor but A only blips', () => {
    const ctx = ctx6();
    const s = createVenueScene(ctx, 'backyard', 'backyard-boss');
    expect(s.cursor.id).toBe('backyard-boss');
    expect(s.update(frame(['confirm']), STEP)).toBeNull();
    expect(ctx.audio.played).toContain('nope');
    expect(ctx.audio.played).not.toContain('menuConfirm');
  });

  it('a champion opens on the boss and can play him', () => {
    const s = createVenueScene(testContext({ profile: { ...newProfile(), ladderWins: 10 } }), 'backyard');
    expect(s.cursor.id).toBe('backyard-boss');
    expect(s.update(frame(['confirm']), STEP)?.kind).toBe('vs');
  });

  it('B on the VS card comes back here on the same match', () => {
    const s = createVenueScene(ctx6(), 'backyard', 'backyard-2');
    const vs = s.update(frame(['confirm']), STEP)!;
    const back = vs.update(frame(['back']), STEP) as VenueScene;
    expect(back.kind).toBe('venue');
    expect(back.cursor.id).toBe('backyard-2');
  });

  it('the panel lines', () => {
    expect(panelLines(matchById('backyard-7')!)).toEqual(['MATCH 7 - MAX', 'MAX HAS BEEN TRAINING: JUMP UP', 'BONUS: SCORE IN THE FIRST 30 SECONDS']);
    expect(panelLines(matchById('backyard-1')!)).toEqual(['MATCH 1 - MAX', 'BONUS: SCORE 3 GOALS']);
    expect(panelLines(matchById(BOSS_ID)!)).toEqual(['BISCUIT THE DOG', "HE CAN'T SHOOT. HE JUST RUNS IT IN.", "BONUS: DON'T LET BISCUIT SCORE"]);
    for (const l of panelLines(matchById(BOSS_ID)!)) expect(l).toMatch(CHARSET);
  });

  it('turns the match crowd off and plays the title theme, as the Hub does', () => {
    const ctx = ctx6();
    ctx.audio.crowd = 'match';
    ctx.audio.music = null;
    createVenueScene(ctx, 'backyard');
    expect(ctx.audio.crowd).toBe('off');
    expect(ctx.audio.music).toBe('title');
  });

  it('an unknown cursor id opens on the next match', () => {
    expect(createVenueScene(ctx6(), 'backyard', 'park-1').cursor.id).toBe('backyard-7');
  });

  it('B or Esc leaves the venue for the road map with the back blip', () => {
    for (const press of [['back'], ['pause', 'back']] as const) {
      const ctx = ctx6();
      expect(createVenueScene(ctx, 'backyard').update(frame(press), STEP)?.kind).toBe('roadMap');
      expect(ctx.audio.played).toContain('menuBack');
    }
  });
});

describe('the Park on the venue screen', () => {
  const parkOpen = (stars: Record<string, number> = {}) => testContext({ art: fakeArt(), profile: { ...newProfile(), ladderWins: 10, career: { stars: { [BOSS_ID]: 1, ...stars }, milestonesPaid: 0, lossStreaks: {} } } });

  it("a crew match's panel: the match and kid, the blurb, the bonus", () => {
    expect(panelLines(matchById('park-2')!)).toEqual(['MATCH 2 - BOOMER LEO', 'HE SHOOTS FROM ANYWHERE.', 'BONUS: KEEP A CLEAN SHEET']);
    expect(panelLines(matchById(PARK_BOSS_ID)!)).toEqual(['SPEEDY SAM', 'THE FASTEST KID IN THE PARK. HIS SHOT IS WEAK.', "BONUS: DON'T LET SAM SCORE"]);
    for (const m of PARK.matches) for (const l of panelLines(m)) expect(l).toMatch(CHARSET);
  });

  it("four nodes spread evenly in a row; the Backyard's ten keep their places", () => {
    const xs = PARK.matches.filter(m => m.kind === 'match').map(m => nodeX(m));
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBeGreaterThan(24);
    expect(BACKYARD.matches.filter(m => m.kind === 'rung').map(m => nodeX(m))).toEqual([...Array(10)].map((_, i) => 16 + 24 * i));
  });

  it("the panel shows the kid's face, and the boss node Sam's", () => {
    const { g, drawn } = recordingContext();
    createVenueScene(parkOpen({ 'park-1': 1, 'park-2': 2, 'park-3': 1, 'park-4': 1 }), 'park', 'park-2').draw(g, 0);
    expect(drawn).toContain('art.opponents.leo.face');
    expect(drawn).toContain('art.opponents.sam.face');
    expect(drawn).toContain('art.venues.park.layers.far');
    expect(drawn.filter(n => n.startsWith('art.biscuit'))).toEqual([]);
  });
});
