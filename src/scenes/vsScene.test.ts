import { describe, expect, it } from 'vitest';
import { C } from '../art/colors';
import { GLYPH_H, measureText } from '../art/font';
import { GUS_BODY, GUS_EXTRAS, GUS_HEADS } from '../art/keepers/gus';
import { bakeKeeperPoses } from '../art/keepers/poses';
import { frameOf } from '../art/body/pose';
import { BASE_W } from '../engine/viewport';
import { BOSS_ID, PARK_BOSS_ID, SCHOOL_BOSS_ID, matchById } from '../meta/career';
import { newProfile } from '../meta/profile';
import { createHubScene } from './hubScene';
import type { MatchScene } from './matchScene';
import { fakeArt, recordingContext } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';
import { LINE_YS, PITCH_Y, VS_AUTO_S, createVsScene, vsLines } from './vsScene';

const STEP = 1 / 60;
const CHARSET = /^[A-Z0-9 '\-:!?.,/+<>]+$/;

describe('the VS card', () => {
  it('names the match and its bonus', () => {
    expect(vsLines(matchById('backyard-7')!, newProfile())).toEqual(['MATCH 7', 'HARRISON VS MAX', 'BONUS: SCORE IN THE FIRST 30 SECONDS']);
    expect(vsLines(matchById(BOSS_ID)!, newProfile())).toEqual(['BACKYARD BOSS', 'HARRISON VS BISCUIT THE DOG', "BONUS: DON'T LET BISCUIT SCORE"]);
    for (const l of vsLines(matchById(BOSS_ID)!, newProfile())) expect(l).toMatch(CHARSET);
  });

  it('kicks off on A, X or Start, with the confirm blip', () => {
    for (const press of [['confirm'], ['shoot'], ['pause']] as const) {
      const ctx = testContext();
      const s = createVsScene(ctx, matchById('backyard-2')!, () => createHubScene(ctx));
      expect(s.lines).toEqual(vsLines(matchById('backyard-2')!, ctx.profile));
      const next = s.update(frame(press), STEP) as MatchScene;
      expect(next.kind).toBe('match');
      expect(next.match.id).toBe('backyard-2');
      expect(ctx.audio.played).toContain('menuConfirm');
    }
  });

  it('kicks off by itself after VS_AUTO_S', () => {
    const s = createVsScene(testContext(), matchById('backyard-2')!, () => createHubScene(testContext()));
    let next = null;
    for (let i = 0; i < Math.round(VS_AUTO_S / STEP) - 1; i++) next = s.update(frame(), STEP) ?? next;
    expect(next).toBeNull();
    expect(s.update(frame(), STEP)?.kind).toBe('match');
  });

  it('B or Esc goes back', () => {
    for (const press of [['back'], ['pause', 'back']] as const) {
      const ctx = testContext();
      const s = createVsScene(ctx, matchById('backyard-2')!, () => createHubScene(ctx));
      expect(s.update(frame(press), STEP)?.kind).toBe('hub');
      expect(ctx.audio.played).toContain('menuBack');
    }
  });
});

describe("Biscuit's card", () => {
  it('the tip appears only after a loss to Biscuit, and not for Max', () => {
    const fresh = newProfile();
    expect(vsLines(matchById(BOSS_ID)!, fresh)).toHaveLength(3);
    const lost = { ...fresh, career: { ...fresh.career, lossStreaks: { 'backyard-boss': 1 } } };
    expect(vsLines(matchById(BOSS_ID)!, lost).at(-1)).toBe('TIP: GET BETWEEN HIM AND YOUR GOAL');
    for (const l of vsLines(matchById(BOSS_ID)!, lost)) expect(l).toMatch(CHARSET);
    const lostToMax = { ...fresh, career: { ...fresh.career, lossStreaks: { 'backyard-3': 2 } } };
    expect(vsLines(matchById('backyard-3')!, lostToMax)).toHaveLength(3);
    expect(vsLines(matchById(BOSS_ID)!, lostToMax)).toHaveLength(3);
  });

  it('the boss card plays the sting, a rung card does not', () => {
    const boss = testContext();
    createVsScene(boss, matchById(BOSS_ID)!, () => createHubScene(boss));
    expect(boss.audio.played).toContain('bossSting');
    const rung = testContext();
    createVsScene(rung, matchById('backyard-2')!, () => createHubScene(rung));
    expect(rung.audio.played).not.toContain('bossSting');
  });
});

describe('the Park on the VS card', () => {
  const back = () => createHubScene(testContext());

  it("a crew match is MATCH n, against the kid, drawn in their own sprites over the Park", () => {
    expect(vsLines(matchById('park-1')!, newProfile())).toEqual(['MATCH 1', 'HARRISON VS BIG BRICK', 'BONUS: SCORE FROM A CHIP']);
    const ctx = testContext({ art: fakeArt() });
    const { g, drawn } = recordingContext();
    createVsScene(ctx, matchById('park-1')!, back).draw(g, 0);
    expect(drawn).toContain('art.opponents.brick.sprites.left.idle.0');
    expect(drawn.some(n => n.startsWith('art.harrison(home,1,idle,0,'))).toBe(true);
    expect(drawn).toContain('art.venues.park.layers.far');
    expect(drawn.some(n => n.startsWith('art.biscuit'))).toBe(false);
  });

  it("Sam's card is THE PARK BOSS with the boss sting, and his tip after a loss", () => {
    const ctx = testContext({ art: fakeArt() });
    createVsScene(ctx, matchById(PARK_BOSS_ID)!, back);
    expect(ctx.audio.played).toContain('bossSting');
    expect(vsLines(matchById(PARK_BOSS_ID)!, newProfile())).toEqual(['THE PARK BOSS', 'HARRISON VS SPEEDY SAM', "BONUS: DON'T LET SAM SCORE"]);
    const lost = { ...newProfile(), career: { ...newProfile().career, lossStreaks: { [PARK_BOSS_ID]: 1 } } };
    expect(vsLines(matchById(PARK_BOSS_ID)!, lost).at(-1)).toBe("TIP: DON'T RACE HIM. MAKE HIM OVERSHOOT");
    const { g, drawn } = recordingContext();
    createVsScene(ctx, matchById(PARK_BOSS_ID)!, back).draw(g, 0);
    expect(drawn).toContain('art.opponents.sam.sprites.left.idle.0');
  });
});

describe('the School Field on the VS card', () => {
  const back = () => createHubScene(testContext());

  it('a tryout is TRYOUT n against the kid, over the School', () => {
    expect(vsLines(matchById('school-3')!, newProfile())).toEqual(['TRYOUT 3', 'HARRISON VS LOFTY LOLA', 'BONUS: SCORE FROM A CHIP']);
    const ctx = testContext({ art: fakeArt() });
    const { g, drawn } = recordingContext();
    createVsScene(ctx, matchById('school-3')!, back).draw(g, 0);
    expect(drawn).toContain('art.venues.school.layers.far');
    expect(drawn).toContain('art.opponents.lola.sprites.left.idle.0');
    expect(ctx.audio.played).not.toContain('bossSting');
  });

  it("every tryout's card draws that kid's own sprites", () => {
    for (const [n, id] of ['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige'].entries()) {
      const { g, drawn } = recordingContext();
      createVsScene(testContext({ art: fakeArt() }), matchById(`school-${n + 1}`)!, back).draw(g, 0);
      expect(drawn, id).toContain(`art.opponents.${id}.sprites.left.idle.0`);
      expect(drawn.filter(d => d?.startsWith('art.opponents.') && !d.startsWith(`art.opponents.${id}.`)), id).toEqual([]);
    }
  });

  /** A profile that has lost to Gus once. */
  const lostToGus = () => ({ ...newProfile(), career: { ...newProfile().career, lossStreaks: { [SCHOOL_BOSS_ID]: 1 } } });

  it("Gus's card is THE SCHOOL BOSS, with his tip once he has beaten Harrison", () => {
    expect(vsLines(matchById(SCHOOL_BOSS_ID)!, newProfile())).toEqual(['THE SCHOOL BOSS', 'HARRISON VS GOALIE GUS', 'BONUS: PUT 3 PAST GUS']);
    const lines = vsLines(matchById(SCHOOL_BOSS_ID)!, lostToGus());
    expect(lines.at(-1)).toBe('TIP: KEEP IT LOW. MAKE HIM DIVE.');
    expect(measureText(lines.at(-1)!) + 2).toBeLessThanOrEqual(BASE_W);
  });

  it("Gus's card plays his own sting; Sam's and Biscuit's play the boss sting", () => {
    const gus = testContext({ art: fakeArt() });
    createVsScene(gus, matchById(SCHOOL_BOSS_ID)!, back);
    expect(gus.audio.played).toContain('gusSting');
    expect(gus.audio.played).not.toContain('bossSting');
    for (const id of [PARK_BOSS_ID, BOSS_ID]) {
      const ctx = testContext({ art: fakeArt() });
      createVsScene(ctx, matchById(id)!, back);
      expect(ctx.audio.played, id).toContain('bossSting');
      expect(ctx.audio.played, id).not.toContain('gusSting');
    }
  });

  it("Gus's card draws Gus himself, from his keeper sprites, not his partner", () => {
    const { g, drawn } = recordingContext();
    createVsScene(testContext({ art: fakeArt() }), matchById(SCHOOL_BOSS_ID)!, back).draw(g, 0);
    expect(drawn).toContain('art.keepers.gus.poses.ready.left.0');
    expect(drawn.some(d => d?.startsWith('art.opponents.'))).toBe(false);
  });

  it('with his tip up, the top of Gus is below the tip line (Review Focus 4)', () => {
    const ready = bakeKeeperPoses(GUS_BODY, GUS_HEADS, GUS_EXTRAS).ready[0]!;
    const firstRow = Array.from({ length: ready.height }, (_, y) => y).find(y => Array.from({ length: ready.width }, (_, x) => ready.get(x, y)).some(c => c !== C.None))!;
    const top = PITCH_Y - frameOf(GUS_BODY).anchor.y + firstRow;
    expect(vsLines(matchById(SCHOOL_BOSS_ID)!, lostToGus())).toHaveLength(4);
    // The tip's text is GLYPH_H + 2 rows tall with its outline: Gus's first row is the one after its last.
    expect(top).toBeGreaterThanOrEqual(LINE_YS[3] + GLYPH_H + 2);
  });

  it("the Park's and the Backyard's cards read as before", () => {
    expect(vsLines(matchById('park-2')!, newProfile())[0]).toBe('MATCH 2');
    expect(vsLines(matchById(PARK_BOSS_ID)!, newProfile())[0]).toBe('THE PARK BOSS');
    expect(vsLines(matchById('backyard-4')!, newProfile())[0]).toBe('MATCH 4');
    expect(vsLines(matchById(BOSS_ID)!, newProfile())[0]).toBe('BACKYARD BOSS');
  });
});

describe('VS card: kit clashes', () => {
  const drawnBy = (kit: 'ice' | 'home') => {
    const profile = { ...newProfile(), locker: { ...newProfile().locker, bought: kit === 'ice' ? ['kit:ice' as const] : [], kit } };
    const ctx = testContext({ profile, art: fakeArt() });
    const s = createVsScene(ctx, matchById('backyard-2')!, () => createHubScene(ctx));
    const { g, drawn } = recordingContext();
    s.draw(g, 0);
    return drawn;
  };

  it('Max changes into black when Harrison wears ICE', () => {
    expect(drawnBy('ice')).toContain('art.opponentIn(max,black).left.idle.0');
  });

  it('and not in HOME', () => {
    const drawn = drawnBy('home');
    expect(drawn).toContain('art.opponents.max.sprites.left.idle.0');
    expect(drawn.some(n => n.startsWith('art.opponentIn('))).toBe(false);
  });
});
