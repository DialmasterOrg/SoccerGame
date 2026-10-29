import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../meta/profile';
import { encodeSaveCode } from '../meta/saveCode';
import { createSaveSlots, slotKey } from '../meta/saveSlots';
import { memoryStore } from '../meta/testStore';
import { createDeleteSaveScene } from './deleteSaveScene';
import type { Scene } from './scene';
import { fakeArt, recordingContext } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';

const STEP = 1 / 60;
const BEHIND: Scene = { kind: 'pressStart', update: () => null, draw: () => {} };
const DELETED: Scene = { kind: 'hub', update: () => null, draw: () => {} };
const SLOT = 2;
/** Level 6 has Golden Form, as loading grants it, so the save reads back as it was written. */
const SAVE: Profile = { ...newProfile(), name: 'BOB', difficulty: 'hard', coins: 300, level: 6, powerForms: { owned: ['golden'], equipped: 'golden' } };

function opening(ctx = testContext()) {
  ctx.saves.write(SLOT, SAVE);
  const s = createDeleteSaveScene(ctx, SLOT, SAVE, () => BEHIND, () => DELETED);
  return { ctx, s };
}

describe('delete save', () => {
  it("shows the save's code, and opens on NO", () => {
    const { s } = opening();
    expect(s.code).toBe(encodeSaveCode(SAVE));
    expect(s.menu).toEqual({ items: ['NO', 'YES'], index: 0 });
  });

  it('A on NO, B, Esc and Start go back and keep the save', () => {
    for (const out of [frame(['jump', 'confirm']), frame(['chip', 'back']), frame(['pause', 'back']), frame(['pause'])]) {
      const { ctx, s } = opening();
      expect(s.update(out, STEP)).toBe(BEHIND);
      expect(ctx.saves.read(SLOT)).toEqual(SAVE);
    }
  });

  it('down then A on YES empties the slot', () => {
    const { ctx, s } = opening();
    s.update(frame(['down']), STEP);
    expect(s.update(frame(['jump', 'confirm']), STEP)).toBe(DELETED);
    expect(ctx.saves.read(SLOT)).toBeNull();
    expect(ctx.audio.played).toEqual(['menuMove', 'menuConfirm']);
  });

  it("YES on a newer build's save plays nope, stays, and keeps it", () => {
    const newer = JSON.stringify({ ...SAVE, version: 8, gems: 5 });
    const store = memoryStore({ [slotKey(SLOT)]: newer });
    const ctx = testContext({ saves: createSaveSlots(store, 'normal') });
    const s = createDeleteSaveScene(ctx, SLOT, SAVE, () => BEHIND, () => DELETED);
    s.update(frame(['down']), STEP);
    expect(s.update(frame(['jump', 'confirm']), STEP)).toBeNull();
    expect(ctx.audio.played.at(-1)).toBe('nope');
    expect(store.data[slotKey(SLOT)]).toBe(newer);
  });

  it("the A that opened it doesn't confirm", () => {
    const { ctx, s } = opening();
    s.update(frame(['down']), STEP);
    expect(s.update(frame([], ['confirm']), STEP)).toBeNull();
    expect(ctx.saves.read(SLOT)).toEqual(SAVE);
  });

  it('draws the title with its slot and the save it would delete', () => {
    const ctx = testContext({ art: fakeArt() });
    const s = createDeleteSaveScene(ctx, SLOT, SAVE, () => BEHIND, () => DELETED);
    const { g, drawn } = recordingContext();
    s.draw(g, 0);
    expect(drawn).toEqual(expect.arrayContaining(['art.text(DELETE SAVE 2,2,energyGold,outline)', 'art.text(BOB  -  HARD  -  LEVEL 6,1,white,outline)']));
  });
});
