import { afterEach, describe, expect, it, vi } from 'vitest';
import { measureText } from '../art/font';
import { BACKYARD, BOSS_ID, PARK, PARK_BOSS_ID, SCHOOL, SCHOOL_BOSS_ID, matchById } from '../meta/career';
import { newProfile } from '../meta/profile';
import { fakeArt, recordingContext, stubCanvases } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';
import { PANEL_TEXT_W, createVenueScene, nodeX, panelLines, type VenueScene } from './venueScene';
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

describe('the School Field on the venue screen', () => {
  const PARK_DONE = { [BOSS_ID]: 1, 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1, [PARK_BOSS_ID]: 1 };
  const schoolOpen = (stars: Record<string, number> = {}) => testContext({ art: fakeArt(), profile: { ...newProfile(), ladderWins: 10, career: { stars: { ...PARK_DONE, ...stars }, milestonesPaid: 0, lossStreaks: {} } } });
  const TRYOUTS_DONE = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(n => [`school-${n}`, 1]));
  afterEach(() => vi.unstubAllGlobals());

  it("a tryout's panel: TRYOUT n and the kid, the blurb, the bonus; Gus by his name", () => {
    expect(panelLines(matchById('school-3')!)).toEqual(['TRYOUT 3 - LOFTY LOLA', 'SHE CHIPS ANY KEEPER OFF HIS LINE.', 'BONUS: SCORE FROM A CHIP']);
    expect(panelLines(matchById(SCHOOL_BOSS_ID)!)).toEqual(['GOALIE GUS', 'THE CAPTAIN. HE FILLS THE WHOLE GOAL.', 'BONUS: PUT 3 PAST GUS']);
    expect(panelLines(matchById('park-2')!)).toEqual(['MATCH 2 - BOOMER LEO', 'HE SHOOTS FROM ANYWHERE.', 'BONUS: KEEP A CLEAN SHEET']);
    expect(panelLines(matchById('backyard-1')!)).toEqual(['MATCH 1 - MAX', 'BONUS: SCORE 3 GOALS']);
  });

  it('every School line fits the panel, the title at 2x', () => {
    expect(PANEL_TEXT_W).toBe(274);
    for (const m of SCHOOL.matches) {
      const [title, ...rest] = panelLines(m);
      expect(measureText(title!, 2) + 2, title).toBeLessThanOrEqual(PANEL_TEXT_W);
      for (const line of rest) {
        expect(measureText(line) + 2, line).toBeLessThanOrEqual(PANEL_TEXT_W);
        expect(line).toMatch(CHARSET);
      }
      expect(title).toMatch(CHARSET);
    }
  });

  it("eight nodes in one row over the Backyard's span, clear of each other's ring and of the boss node", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(n => nodeX(matchById(`school-${n}`)!))).toEqual([16, 47, 78, 109, 139, 170, 201, 232]);
  });

  it('after Sam the venue draws the School behind SCHOOL FIELD and STARS 0/27, with the boss a silhouette', () => {
    stubCanvases();
    const { g, drawn } = recordingContext();
    createVenueScene(schoolOpen(), 'school').draw(g, 0);
    expect(drawn).toContain('art.venues.school.layers.far');
    expect(drawn).toContain('art.text(SCHOOL FIELD,2,energyGold,outline)');
    expect(drawn).toContain('art.text(STARS 0/27,1,white,outline)');
    // Max's face shows once, in the panel for tryout 1; the boss node holds its silhouette (a canvas with no name).
    expect(drawn.filter(n => n === 'art.opponents.max.face')).toHaveLength(1);
    expect(drawn).toContain(undefined);
    expect(drawn.some(n => n?.startsWith('art.biscuit'))).toBe(false);
  });

  it("each tryout's panel shows that kid's face", () => {
    stubCanvases();
    for (const [n, id] of ['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige'].entries()) {
      const { g, drawn } = recordingContext();
      createVenueScene(schoolOpen(TRYOUTS_DONE), 'school', `school-${n + 1}`).draw(g, 0);
      expect(drawn, id).toContain(`art.opponents.${id}.face`);
    }
  });

  it("once tryout 8 is passed the boss node and the panel show Gus's own face", () => {
    stubCanvases();
    const { g, drawn } = recordingContext();
    createVenueScene(schoolOpen(TRYOUTS_DONE), 'school').draw(g, 0);
    expect(drawn.filter(n => n === 'art.opponents.gus.face')).toHaveLength(2);
    expect(drawn).toContain('art.text(GOALIE GUS,2,energyGold,outline)');
  });

  it('A on tryout 1 opens its VS card; A on tryout 2 only blips', () => {
    const ctx = schoolOpen();
    const s = createVenueScene(ctx, 'school');
    expect(s.cursor.id).toBe('school-1');
    expect((s.update(frame(['confirm']), STEP) as VsScene).match.id).toBe('school-1');
    const locked = schoolOpen();
    const second = createVenueScene(locked, 'school', 'school-2');
    expect(second.update(frame(['confirm']), STEP)).toBeNull();
    expect(locked.audio.played).toContain('nope');
  });
});
