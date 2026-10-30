import { describe, expect, it } from 'vitest';
import {
  BOOTS_IDS, EXTRA_IDS, GIFTS, GIFT_NAMES, KIT_IDS, LOCKER_ITEMS, OPPONENT_FAMILY,
  buyItem, changeKitFor, giftLine, starsFor, itemStatus, itemsIn, markSeen, outfitKey, outfitOf, owns, takeOff, unseenGifts, wearItem,
  type LockerItemId, KIT_CLASH,
} from './locker';
import { newProfile, type Profile } from './profile';

const withCoins = (coins: number): Profile => ({ ...newProfile(), coins });
const paid = (milestonesPaid: number, seen: LockerItemId[] = []): Profile => {
  const p = newProfile();
  return { ...p, career: { ...p.career, milestonesPaid }, locker: { ...p.locker, seen } };
};

describe('the catalogue', () => {
  it('lists 10 kits, 9 boots and 4 extras, 23 in all, ids unique', () => {
    expect(itemsIn('kits')).toHaveLength(10);
    expect(itemsIn('boots')).toHaveLength(9);
    expect(itemsIn('extras')).toHaveLength(4);
    expect(LOCKER_ITEMS).toHaveLength(23);
    expect(new Set(LOCKER_ITEMS.map(i => i.id)).size).toBe(23);
    expect(KIT_IDS).toHaveLength(10);
    expect(BOOTS_IDS).toHaveLength(9);
    expect(EXTRA_IDS).toEqual(['glasses', 'headband', 'wristbands', 'armband']);
  });

  it('a new save owns only the starters', () => {
    const owned = LOCKER_ITEMS.filter(i => owns(newProfile(), i.id)).map(i => i.id);
    expect(owned).toEqual(['kit:home', 'kit:away', 'boots:volt', 'extra:glasses']);
  });

  it('a paid milestone owns its gift', () => {
    const p = paid(2);
    expect(owns(p, 'extra:armband')).toBe(true);
    expect(owns(p, 'boots:lightning')).toBe(true);
    expect(owns(p, 'kit:gold')).toBe(false);
  });

  it('status: wearing, owned, buy, locked', () => {
    const p = newProfile();
    expect(itemStatus(p, 'kit:home')).toBe('wearing');
    expect(itemStatus(p, 'kit:away')).toBe('owned');
    expect(itemStatus(p, 'kit:sky')).toBe('buy');
    expect(itemStatus(p, 'kit:gold')).toBe('locked');
    expect(itemStatus(p, 'extra:glasses')).toBe('owned');
  });
});

describe('buying and wearing', () => {
  it('buying takes the price, owns it and wears it', () => {
    const p = buyItem(withCoins(200), 'kit:sky');
    expect(p?.coins).toBe(0);
    expect(p?.locker.bought).toEqual(['kit:sky']);
    expect(p?.locker.kit).toBe('sky');
  });

  it('buying refuses owned, starter, locked and too-dear items', () => {
    expect(buyItem(withCoins(9999), 'kit:away')).toBeNull();
    expect(buyItem(withCoins(9999), 'kit:gold')).toBeNull();
    expect(buyItem(withCoins(199), 'kit:sky')).toBeNull();
    const sky = buyItem(withCoins(400), 'kit:sky');
    expect(sky && buyItem(sky, 'kit:sky')).toBeNull();
  });

  it('an extra joins the outfit and comes off again', () => {
    const glasses = wearItem(withCoins(150), 'extra:glasses');
    const both = glasses && buyItem(glasses, 'extra:headband');
    expect(both?.locker.extras).toEqual(['glasses', 'headband']);
    const off = both && takeOff(both, 'extra:glasses');
    expect(off?.locker.extras).toEqual(['headband']);
    expect(off && takeOff(off, 'extra:glasses')).toBeNull();
  });

  it("wearing what he wears, or something he doesn't own, is null", () => {
    expect(wearItem(newProfile(), 'kit:home')).toBeNull();
    expect(wearItem(newProfile(), 'kit:sky')).toBeNull();
    expect(wearItem(newProfile(), 'extra:armband')).toBeNull();
    const glasses = wearItem(newProfile(), 'extra:glasses');
    expect(glasses && wearItem(glasses, 'extra:glasses')).toBeNull();
  });

  it('the outfit is what the locker says he wears', () => {
    const p = buyItem(withCoins(1500), 'kit:inferno');
    expect(p && outfitOf(p)).toEqual({ kit: 'inferno', boots: 'volt', extras: [] });
  });
});

describe('gifts', () => {
  it('unseen gifts: paid and not seen, never locked', () => {
    const p = paid(2, ['extra:armband']);
    expect(unseenGifts(p)).toEqual(['boots:lightning']);
    expect(markSeen(p, 'kit:gold')).toBe(p);
    expect(markSeen(p, 'extra:armband')).toBe(p);
    expect(markSeen(p, 'kit:sky')).toBe(p);
    expect(unseenGifts(markSeen(p, 'boots:lightning'))).toEqual([]);
  });

  it('names each gift', () => {
    expect(GIFTS).toEqual(['extra:armband', 'boots:lightning', 'kit:gold', 'boots:gold']);
    expect(GIFTS.map(g => GIFT_NAMES[g])).toEqual(["CAPTAIN'S ARMBAND", 'LIGHTNING BOOTS', 'GOLD KIT', 'GOLD BOOTS']);
  });

  it("a gift waits on its milestone's stars", () => {
    expect(GIFTS.map(starsFor)).toEqual([10, 25, 50, 75]);
    expect(starsFor('kit:sky')).toBeNull();
  });

  it('giftLine names the gift', () => {
    expect(giftLine(1)).toBe('NEW IN THE LOCKER ROOM: LIGHTNING BOOTS');
    expect(giftLine(4)).toBeNull();
  });
});

describe('outfits and clashes', () => {
  it("outfitKey ignores the extras' order", () => {
    const a = outfitKey({ kit: 'inferno', boots: 'fire', extras: ['headband', 'glasses'] });
    const b = outfitKey({ kit: 'inferno', boots: 'fire', extras: ['glasses', 'headband'] });
    expect(a).toBe(b);
    expect(a).not.toBe(outfitKey({ kit: 'inferno', boots: 'fire', extras: ['glasses'] }));
  });

  it("clashes: the spec's list", () => {
    expect(changeKitFor('sky', 'max')).toBe('white');
    expect(changeKitFor('navy', 'max')).toBe('white');
    expect(changeKitFor('ice', 'max')).toBe('black');
    expect(changeKitFor('inferno', 'brick')).toBe('white');
    expect(changeKitFor('purple', 'leo')).toBe('white');
    expect(changeKitFor('gold', 'pete')).toBe('white');
    const opponents = Object.keys(OPPONENT_FAMILY) as (keyof typeof OPPONENT_FAMILY)[];
    for (const o of opponents) expect(changeKitFor('home', o)).toBeNull();
    for (const k of KIT_IDS) {
      expect(changeKitFor(k, 'tia')).toBeNull();
      expect(changeKitFor(k, 'sam')).toBeNull();
    }
  });

  it("Gus's partner wears purple, so he changes into white against Harrison's purple, and only then", () => {
    expect(changeKitFor('purple', 'gus')).toBe('white');
    expect(changeKitFor('home', 'gus')).toBeNull();
  });

  it("the tryouts change kit whenever Harrison's kit is in their family, into one that isn't (Review Focus 2)", () => {
    expect([changeKitFor('white', 'hank'), changeKitFor('away', 'finn'), changeKitFor('blackGold', 'finn'), changeKitFor('gold', 'lola'), changeKitFor('purple', 'paige')]).toEqual(['black', 'white', 'white', 'white', 'white']);
    for (const kid of ['hank', 'lola', 'finn', 'priya', 'niko', 'paige'] as const) {
      for (const k of KIT_IDS) {
        const change = changeKitFor(k, kid);
        expect(change !== null, `${k} vs ${kid}`).toBe(KIT_CLASH[k].family === OPPONENT_FAMILY[kid]);
        if (change) expect(change, `${k} vs ${kid}`).not.toBe(KIT_CLASH[k].family);
      }
    }
  });
});

describe('text', () => {
  it("every label and line uses only the game's characters", () => {
    const lines = [
      ...LOCKER_ITEMS.flatMap(i => [i.label, i.blurb]),
      ...GIFTS.map((_, i) => giftLine(i) ?? ''),
    ];
    for (const l of lines) expect(l).toMatch(/^[A-Z0-9 '\-:!?.,/+<>]*$/);
  });
});
