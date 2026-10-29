import { describe, expect, it } from 'vitest';
import { careerStars } from '../meta/career';
import { PROFILE_KEY, newProfile, type Profile } from '../meta/profile';
import { createSaveSlots } from '../meta/saveSlots';
import { memoryStore } from '../meta/testStore';
import type { DeleteSaveScene } from './deleteSaveScene';
import type { NewSaveScene } from './newSaveScene';
import type { Scene } from './scene';
import { createSavesScene, type SavesScene } from './savesScene';
import { fakeArt, recordingContext } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';
import { createPressStartScene } from './titleScene';

const STEP = 1 / 60;
const A = frame(['jump', 'confirm']);
const B = frame(['chip', 'back']);
const ESC = frame(['pause', 'back']);
const ENTER = frame(['pause', 'confirm']);

/** Level 3: no Golden Form yet, so it reads back exactly as written. */
const TWO: Profile = { ...newProfile(), name: 'TWO', difficulty: 'hard', coins: 120, level: 3 };

/** A context with TWO in slot 2 and the rest empty, and SAVES open on `cursor`. */
function opening(cursor = 2) {
  const ctx = testContext();
  ctx.saves.write(2, TWO);
  const s = createSavesScene(ctx, cursor);
  return { ctx, s };
}

const step = (s: Scene, ...frames: ReturnType<typeof frame>[]): Scene => {
  let at = s;
  for (const f of frames) at = at.update(f, STEP) ?? at;
  return at;
};

/** Every match through the Park's fourth beaten, as his live save has it. */
const PARK_FOUR_STARS = {
  ...Object.fromEntries([...Array(10)].map((_, i) => [`backyard-${i + 1}`, 2])),
  'backyard-boss': 1,
  'park-1': 3,
  'park-2': 2,
  'park-3': 1,
  'park-4': 2,
};

/** His live save as v4 stored it: no name, difficulty or Stamina. */
const V4 = {
  version: 4,
  coins: 1240,
  level: 8,
  xp: 40,
  stats: { speed: 7, power: 5, jump: 4, control: 5 },
  ladderWins: 10,
  dailyWinDate: '2026-10-22',
  totals: { matches: 30, wins: 20, draws: 3, losses: 7, goalsFor: 60, goalsAgainst: 31, styleGoals: 12, xpEarned: 2400 },
  powerMoves: { owned: ['energyWave'], equipped: 'energyWave' },
  powerForms: { owned: ['golden'], equipped: 'golden' },
  career: { stars: PARK_FOUR_STARS, milestonesPaid: 2, lossStreaks: {} },
};

describe('saves', () => {
  it('opens on the slot given, reading every slot', () => {
    const { s } = opening(4);
    expect(s.kind).toBe('saves');
    expect(s.cursor).toBe(4);
    expect(s.box).toBeNull();
    expect(s.slots).toEqual([null, TWO, null, null, null]);
  });

  it('PRESS START opens SAVES on the last save played, or slot 1 with none', () => {
    const fresh = testContext();
    expect((createPressStartScene(fresh).update(A, STEP) as SavesScene).cursor).toBe(1);
    const played = testContext();
    played.saves.setLastPlayed(3);
    const s = createPressStartScene(played).update(frame(['pause']), STEP) as SavesScene;
    expect(s.kind).toBe('saves');
    expect(s.cursor).toBe(3);
  });

  it('turns the crowd off and plays the title theme', () => {
    const ctx = testContext();
    ctx.audio.crowd = 'match';
    createSavesScene(ctx, 1);
    expect(ctx.audio.crowd).toBe('off');
    expect(ctx.audio.music).toBe('title');
  });

  it('up and down move the cursor, wrapping', () => {
    const { s } = opening(1);
    s.update(frame(['up']), STEP);
    expect(s.cursor).toBe(5);
    s.update(frame(['down']), STEP);
    s.update(frame(['down']), STEP);
    expect(s.cursor).toBe(2);
  });

  it('A on a full slot opens its box on PLAY and loads nothing', () => {
    const { ctx, s } = opening(2);
    expect(s.update(A, STEP)).toBeNull();
    expect(s.box).toEqual({ items: ['PLAY', 'DELETE', 'BACK'], index: 0 });
    expect(ctx.slot).toBe(1);
    expect(ctx.savedProfiles).toEqual([]);
    expect(s.update(frame([], ['confirm']), STEP)).toBeNull();
    expect(ctx.savedProfiles).toEqual([]);
  });

  it('Start on a full slot opens its box too, and Start there plays', () => {
    const { s } = opening(2);
    s.update(frame(['pause']), STEP);
    expect(s.box?.index).toBe(0);
    expect(s.update(frame(['pause']), STEP)?.kind).toBe('hub');
  });

  it('PLAY loads it, stores it at once and goes to the Hub', () => {
    const { ctx, s } = opening(2);
    s.update(A, STEP);
    expect(s.update(A, STEP)?.kind).toBe('hub');
    expect(ctx.slot).toBe(2);
    expect(ctx.profile).toEqual(TWO);
    expect(ctx.savedProfiles).toEqual([TWO]);
    expect(ctx.saves.lastPlayed()).toBe(2);
  });

  it("PLAY plays another tab's newer copy, never the list's older one", () => {
    const { ctx, s } = opening(2);
    const newer = { ...TWO, coins: TWO.coins + 500 };
    ctx.saves.write(2, newer);
    step(s, A, A);
    expect(ctx.profile).toEqual(newer);
    expect(ctx.saves.read(2)).toEqual(newer);
  });

  it('BACK, B and Esc close the box, keeping the cursor', () => {
    for (const close of [[frame(['down']), frame(['down']), A], [B], [ESC]]) {
      const { ctx, s } = opening(2);
      s.update(A, STEP);
      expect(step(s, ...close)).toBe(s);
      expect(s.box).toBeNull();
      expect(s.cursor).toBe(2);
      expect(ctx.savedProfiles).toEqual([]);
    }
  });

  it('A on an empty slot opens NEW SAVE for it, and B there comes back to SAVES on it', () => {
    const made = opening(4).s.update(A, STEP) as NewSaveScene;
    expect(made.kind).toBe('newSave');
    const back = made.update(B, STEP) as SavesScene;
    expect(back.kind).toBe('saves');
    expect(back.cursor).toBe(4);
  });

  it('NEW SAVE from an empty slot makes the save in that slot', () => {
    const { ctx, s } = opening(4);
    step(s, A, ENTER);
    expect(ctx.slot).toBe(4);
    expect(ctx.saves.read(4)?.name).toBe('SAVE 4');
  });

  it('DELETE opens DELETE SAVE on NO, and backing out comes back with the box open', () => {
    const { s } = opening(2);
    const del = step(s, A, frame(['down']), A) as DeleteSaveScene;
    expect(del.kind).toBe('deleteSave');
    expect(del.menu.index).toBe(0);
    const back = del.update(B, STEP) as SavesScene;
    expect(back.kind).toBe('saves');
    expect(back.cursor).toBe(2);
    expect(back.box?.items).toEqual(['PLAY', 'DELETE', 'BACK']);
  });

  it('YES on DELETE SAVE comes back to SAVES on that slot, now empty', () => {
    const { ctx, s } = opening(2);
    const del = step(s, A, frame(['down']), A);
    const back = step(del, frame(['down']), A) as SavesScene;
    expect(back.kind).toBe('saves');
    expect(back.cursor).toBe(2);
    expect(back.box).toBeNull();
    expect(back.slots[1]).toBeNull();
    expect(ctx.saves.read(2)).toBeNull();
  });

  it('B and Esc go back to PRESS START', () => {
    for (const out of [B, ESC]) expect(opening().s.update(out, STEP)?.kind).toBe('pressStart');
  });

  it('his live save comes up as save 1, HARRISON on Easy, with everything', () => {
    const store = memoryStore({ [PROFILE_KEY]: JSON.stringify(V4) });
    const ctx = testContext({ saves: createSaveSlots(store, 'easy') });
    const s = createSavesScene(ctx, 1);
    const live = s.slots[0]!;
    expect(live).toMatchObject({ name: 'HARRISON', difficulty: 'easy', coins: 1240, level: 8, stats: { ...V4.stats, stamina: 1 } });
    expect(careerStars(live)).toBe(Object.values(PARK_FOUR_STARS).reduce((a, b) => a + b, 0));
    step(s, A, A);
    const stored = JSON.parse(store.data[PROFILE_KEY]!);
    expect(stored).toMatchObject({ version: 7, name: 'HARRISON', difficulty: 'easy', coins: 1240, stats: { stamina: 1 } });
  });

  it("switching saves keeps each save's own", () => {
    const ctx = testContext();
    const one = { ...newProfile(), name: 'ONE', difficulty: 'easy' as const, coins: 500 };
    ctx.saves.write(1, one);
    ctx.saves.write(2, TWO);
    const hub = step(createSavesScene(ctx, 1), A, A);
    const shop = step(hub, frame(['down']), A);
    expect(shop.kind).toBe('shop');
    const saves = step(shop, A, B, B) as SavesScene;
    expect(saves.kind).toBe('saves');
    expect(saves.cursor).toBe(1);
    const options = step(saves, frame(['down']), A, A, frame(['down']), frame(['down']), frame(['down']), A);
    expect(options.kind).toBe('options');
    options.update(frame(['right']), STEP);
    expect(ctx.saves.read(1)).toMatchObject({ name: 'ONE', difficulty: 'easy', stats: { speed: 2 } });
    expect(ctx.saves.read(2)).toMatchObject({ name: 'TWO', difficulty: 'easy', coins: TWO.coins });
    expect(ctx.savedSettings).toEqual([]);
  });

  it('draws the list, and the info box over it', () => {
    const ctx = testContext({ art: fakeArt() });
    ctx.saves.write(2, TWO);
    const s = createSavesScene(ctx, 2);
    const list = recordingContext();
    s.draw(list.g, 0);
    expect(list.drawn).toEqual(expect.arrayContaining(['art.text(SAVES,2,energyGold,outline)', 'art.text(TWO,1,energyGold,outline)', 'art.text(HARD  -  LEVEL 3,1,silver,outline)', 'art.text(- EMPTY -,1,gray,outline)']));
    s.update(A, STEP);
    const box = recordingContext();
    s.draw(box.g, 0);
    expect(box.drawn).toEqual(expect.arrayContaining(['art.text(TWO,2,energyGold,outline)', 'art.text(SAVE 2  -  HARD,1,silver,outline)']));
  });

  it("the info box shows the save's own portrait", () => {
    const ctx = testContext({ art: fakeArt() });
    ctx.saves.write(2, TWO);
    const s = createSavesScene(ctx, 2);
    s.update(A, STEP);
    const box = recordingContext();
    s.draw(box.g, 0);
    expect(box.drawn.some(n => n.startsWith('art.portraitsOf(') && n.endsWith('.neutral'))).toBe(true);
    expect(box.drawn).not.toContain('art.portraits.neutral');
  });

  it("the list's PICK and BACK hints hide behind the info box", () => {
    const ctx = testContext({ art: fakeArt() });
    ctx.saves.write(2, TWO);
    const s = createSavesScene(ctx, 2);
    s.update(A, STEP);
    const { g, drawn } = recordingContext();
    s.draw(g, 0);
    expect(drawn).not.toContain('art.text(PICK,1,silver,outline)');
  });
});
