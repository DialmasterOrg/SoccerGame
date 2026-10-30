import { describe, expect, it } from 'vitest';
import { ART_LEGEND, C, M, MASTER, masterPalette, resolvePalette, toRGBA, type LookColors, type Slot } from './colors';
import { IndexedImage } from './indexedImage';
import { KITS, KIT_SLOT_NAMES, VOLT_BOOTS } from './kits';

/** RGB distance below which a kit colour blurs into the outline at game scale. */
const MIN_OUTLINE_CONTRAST = 40;

const fullLook = (): LookColors => {
  const slots = Object.keys(C).filter(k => k !== 'None') as Slot[];
  const look = Object.fromEntries(slots.map(s => [s, 'white'])) as LookColors;
  look.Jersey = 'red';
  return look;
};

describe('resolvePalette', () => {
  it('resolves logical ids to RGBA with index 0 transparent', () => {
    const pal = resolvePalette(fullLook());
    expect(pal[C.None]).toEqual([0, 0, 0, 0]);
    expect(pal[C.Jersey]).toEqual([0xc0, 0x24, 0x2c, 255]);
  });
});

describe('toRGBA', () => {
  it('converts an IndexedImage to RGBA bytes', () => {
    const img = new IndexedImage(2, 1);
    img.set(1, 0, C.Jersey);
    expect(Array.from(toRGBA(img, resolvePalette(fullLook())))).toEqual([0, 0, 0, 0, 0xc0, 0x24, 0x2c, 255]);
  });
});

describe('MASTER', () => {
  it('every colour is a valid #rrggbb', () => {
    for (const hex of Object.values(MASTER)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  // Around 40 was the main spec's guide, not a limit: the Park crew's skin tones and kits need more,
  // the keepers' three tops (Steady Eddie's emerald, the backups' berry and lemon) nine more,
  // the tryouts' three new kits (Priya's olive, Niko's cocoa, Paige's plum) nine more again,
  // and Goalie Gus's cyan keeper top three more.
  it('has at most 82 colours, and the Park crew\'s, the keepers\', the tryouts\' and Gus\'s are there', () => {
    expect(Object.keys(MASTER).length).toBeGreaterThanOrEqual(56);
    expect(Object.keys(MASTER).length).toBeLessThanOrEqual(82);
    expect(Object.keys(MASTER)).toEqual(expect.arrayContaining(['emerald', 'berry', 'lemon', 'olive', 'cocoa', 'plum', 'cyan']));
  });
});

describe('KITS', () => {
  it('the blue kit is navy and blue', () => {
    expect([KITS.blue.Jersey, KITS.blue.JerseyShadow, KITS.blue.Shorts]).toEqual(['blue', 'navy', 'blue']);
  });

  it('every kit defines every kit slot', () => {
    for (const kit of Object.values(KITS)) expect(Object.keys(kit).sort()).toEqual([...KIT_SLOT_NAMES].sort());
  });

  it('keeps every kit and boot colour clearly apart from the outline', () => {
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const outline = rgb(MASTER.outline);
    for (const colour of [...Object.values(KITS).flatMap(k => Object.values(k)), ...Object.values(VOLT_BOOTS)]) {
      const distance = Math.hypot(...rgb(MASTER[colour]).map((v, i) => v - outline[i]!));
      expect(distance, colour).toBeGreaterThanOrEqual(MIN_OUTLINE_CONTRAST);
    }
  });
});

describe('ART_LEGEND', () => {
  it('does not use the reserved transparent char', () => {
    expect('.' in ART_LEGEND).toBe(false);
  });
});

describe('M and masterPalette', () => {
  it('numbers master colours from 1 in key order', () => {
    const keys = Object.keys(MASTER) as (keyof typeof MASTER)[];
    expect(M[keys[0]!]).toBe(1);
    expect(M[keys[keys.length - 1]!]).toBe(keys.length);
  });

  it('resolves M ids to their master colour, 0 transparent', () => {
    const pal = masterPalette();
    expect(pal[0]).toEqual([0, 0, 0, 0]);
    expect(pal[M.red]).toEqual([0xc0, 0x24, 0x2c, 255]);
  });
});
