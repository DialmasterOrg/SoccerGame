import { describe, expect, it } from 'vitest';
import { PROFILE_KEY, newProfile, type Profile } from './profile';
import { LAST_SAVE_KEY, SLOT_COUNT, createSaveSlots, slotKey, type StorageEvents } from './saveSlots';
import type { KeyValueStore } from './storage';
import { memoryStore, throwingStore } from './testStore';

/** A v4 save as his live one is stored: no name, difficulty or Stamina. */
const V4 = { ...newProfile(), version: 4, coins: 420, level: 3, stats: { speed: 3, power: 2, jump: 1, control: 4 } } as Record<string, unknown>;
delete V4.name;
delete V4.difficulty;
/** A v5 save with its own name, difficulty and Stamina. */
const OWN: Profile = { ...newProfile(), name: 'NORMAL RUN', difficulty: 'hard', coins: 300, stats: { ...newProfile().stats, stamina: 4 } };

const json = (v: unknown) => JSON.stringify(v);

/** A store that reads, but refuses every write. */
const readOnlyStore = (): KeyValueStore => {
  const s = memoryStore();
  return {
    ...s,
    setItem: () => {
      throw new Error('full');
    },
  };
};

describe('save slots: keys', () => {
  it("slot 1 is today's key, so his live save never moves", () => {
    expect(slotKey(1)).toBe('harrisons-road-to-the-cup/profile');
    expect(slotKey(1)).toBe(PROFILE_KEY);
    expect(slotKey(5)).toBe('harrisons-road-to-the-cup/profile-5');
    expect(LAST_SAVE_KEY).toBe('harrisons-road-to-the-cup/last-save');
    expect(SLOT_COUNT).toBe(5);
  });
});

describe('save slots: read and list', () => {
  it('a missing key or anything that is not a save is an empty slot', () => {
    expect(createSaveSlots(memoryStore(), 'normal').read(2)).toBeNull();
    for (const raw of ['{', '"x"', '{"version":0}', '[]']) {
      expect(createSaveSlots(memoryStore({ [slotKey(2)]: raw }), 'normal').read(2), raw).toBeNull();
    }
  });

  it("a v4 save loads on the loader's difficulty, and a v5 save keeps its own", () => {
    const saves = createSaveSlots(memoryStore({ [slotKey(1)]: json(V4), [slotKey(2)]: json(OWN) }), 'easy');
    expect(saves.read(1)).toMatchObject({ version: 7, name: 'HARRISON', difficulty: 'easy', coins: 420 });
    expect(saves.read(2)).toEqual(OWN);
  });

  it('list has every slot, read fresh each time', () => {
    const store = memoryStore();
    const saves = createSaveSlots(store, 'normal');
    expect(saves.list()).toEqual([null, null, null, null, null]);
    store.setItem(slotKey(3), json(OWN));
    expect(saves.list()).toEqual([null, null, OWN, null, null]);
  });
});

describe('save slots: write and remove', () => {
  it('a save round-trips', () => {
    const saves = createSaveSlots(memoryStore(), 'normal');
    saves.write(4, OWN);
    expect(saves.read(4)).toEqual(OWN);
  });

  it('a read is a fresh copy', () => {
    const saves = createSaveSlots(memoryStore({ [slotKey(2)]: json(OWN) }), 'normal');
    const a = saves.read(2)!;
    a.stats.speed = 9;
    expect(saves.read(2)).toEqual(OWN);
  });

  it('a v5 save writes over a stored v4 one', () => {
    const store = memoryStore({ [slotKey(1)]: json(V4) });
    createSaveSlots(store, 'easy').write(1, OWN);
    expect(JSON.parse(store.data[slotKey(1)]!)).toEqual(OWN);
  });

  it("a newer build's save is never written over or removed", () => {
    const newer = json({ ...OWN, version: 8, gems: 5 });
    const store = memoryStore({ [slotKey(2)]: newer });
    const saves = createSaveSlots(store, 'normal');
    expect(saves.read(2)?.coins).toBe(300);
    saves.write(2, newProfile());
    expect(store.data[slotKey(2)]).toBe(newer);
    expect(saves.remove(2)).toBe(false);
    expect(store.data[slotKey(2)]).toBe(newer);
  });

  it('remove empties the slot, and an empty slot removes fine', () => {
    const store = memoryStore({ [slotKey(3)]: json(OWN) });
    const saves = createSaveSlots(store, 'normal');
    expect(saves.remove(3)).toBe(true);
    expect(store.data[slotKey(3)]).toBeUndefined();
    expect(saves.read(3)).toBeNull();
    expect(saves.remove(5)).toBe(true);
  });
});

describe('save slots: the last save played', () => {
  it('is null with none, and stores the slot it is given', () => {
    const store = memoryStore();
    const saves = createSaveSlots(store, 'normal');
    expect(saves.lastPlayed()).toBeNull();
    saves.setLastPlayed(3);
    expect(store.data[LAST_SAVE_KEY]).toBe('{"version":1,"slot":3}');
    expect(saves.lastPlayed()).toBe(3);
  });

  it('anything but a whole slot number reads as none', () => {
    for (const raw of ['junk', json({ version: 1, slot: 0 }), json({ version: 1, slot: 6 }), json({ version: 1, slot: '2' }), json({ version: 1, slot: 2.5 })]) {
      expect(createSaveSlots(memoryStore({ [LAST_SAVE_KEY]: raw }), 'normal').lastPlayed(), raw).toBeNull();
    }
  });
});

describe('save slots: no storage', () => {
  const stores: [string, () => KeyValueStore | null][] = [
    ['none', () => null],
    ['throwing', () => throwingStore],
    ['refusing writes', readOnlyStore],
  ];

  for (const [name, make] of stores) {
    it(`a save made without storage lasts the session: ${name}`, () => {
      const saves = createSaveSlots(make(), 'normal');
      expect(() => saves.write(2, OWN)).not.toThrow();
      expect(saves.read(2)).toEqual(OWN);
      expect(saves.list()[1]).toEqual(OWN);
      expect(saves.remove(2)).toBe(true);
      expect(saves.read(2)).toBeNull();
      expect(() => saves.setLastPlayed(4)).not.toThrow();
      expect(saves.lastPlayed()).toBe(4);
    });
  }

  it('progress made after storage starts refusing is kept over the stale stored copy', () => {
    const store = memoryStore({ [slotKey(1)]: json(OWN) });
    const saves = createSaveSlots({ ...store, setItem: () => void 0 }, 'normal');
    const richer = { ...OWN, coins: 900 };
    saves.write(1, richer);
    expect(saves.read(1)).toEqual(richer);
  });
});

describe('save slots: following another tab', () => {
  /** A stand-in for window: keeps the storage listener so a test can fire it. */
  function fakeWindow(): StorageEvents & { fire(key: string | null): void } {
    let listener: ((e: { key: string | null }) => void) | null = null;
    return {
      addEventListener: (_type, cb) => void (listener = cb),
      fire: key => listener?.({ key }),
    };
  }

  it("another tab saving the slot being played reloads it here, and only that slot's key", () => {
    const store = memoryStore();
    const win = fakeWindow();
    const seen: Profile[] = [];
    createSaveSlots(store, 'normal').follow(win, () => 2, p => seen.push(p));
    store.setItem(slotKey(2), json(OWN));
    store.setItem(slotKey(1), json(newProfile()));
    win.fire(slotKey(1));
    win.fire(slotKey(2));
    expect(seen).toEqual([OWN]);
  });

  it('a removed key, junk or a cleared store is ignored', () => {
    const store = memoryStore();
    const win = fakeWindow();
    const seen: Profile[] = [];
    createSaveSlots(store, 'normal').follow(win, () => 2, p => seen.push(p));
    win.fire(slotKey(2));
    store.setItem(slotKey(2), '{"version":0}');
    win.fire(slotKey(2));
    win.fire(null);
    expect(seen).toEqual([]);
  });

  it('it follows whichever slot is being played now', () => {
    const store = memoryStore({ [slotKey(3)]: json(OWN) });
    const win = fakeWindow();
    const seen: Profile[] = [];
    let slot = 1;
    createSaveSlots(store, 'normal').follow(win, () => slot, p => seen.push(p));
    win.fire(slotKey(3));
    slot = 3;
    win.fire(slotKey(3));
    expect(seen).toEqual([OWN]);
  });
});
