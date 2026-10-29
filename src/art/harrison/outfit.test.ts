import { describe, expect, it } from 'vitest';
import { DEFAULT_OUTFIT, KIT_IDS, type Outfit } from '../../meta/locker';
import { C } from '../colors';
import { KITS, VOLT_BOOTS } from '../kits';
import { HARRISON_HEADS, HARRISON_POWER_HEADS } from './head';
import { harrisonLook } from './look';
import { HARRISON_BOOTS, HARRISON_KITS, outfitBody, outfitHeads, outfitLook, outfitPortrait } from './outfit';
import { harrisonPortrait } from './portrait';

const dressed = (o: Partial<Outfit>): Outfit => ({ ...DEFAULT_OUTFIT, ...o });

describe('his kits and boots', () => {
  it('HOME and AWAY are the club kits', () => {
    expect(HARRISON_KITS.home).toEqual(KITS.home);
    expect(HARRISON_KITS.away).toEqual(KITS.away);
    expect(HARRISON_BOOTS.volt).toEqual(VOLT_BOOTS);
    expect(Object.keys(HARRISON_KITS)).toEqual([...KIT_IDS]);
  });

  it("every kit and boots matches the spec's table", () => {
    expect(HARRISON_KITS.inferno).toMatchObject({ JerseyShadow: 'flameDark', Jersey: 'flame', JerseyLight: 'flameLight', TrimShadow: 'gold', Trim: 'energyGold', Shorts: 'red', Socks: 'flame' });
    expect(HARRISON_KITS.ice).toMatchObject({ JerseyShadow: 'electric', Jersey: 'electricLight', JerseyLight: 'white', TrimShadow: 'blue', Trim: 'electric', Shorts: 'white', Socks: 'electricLight' });
    expect(HARRISON_KITS.white).toMatchObject({ Trim: 'navy', TrimShadow: 'navy', Shorts: 'navy', Socks: 'white' });
    expect(HARRISON_KITS.navy).toMatchObject({ JerseyShadow: 'ink', Jersey: 'navy', JerseyLight: 'blue', Trim: 'gold' });
    expect(HARRISON_KITS.blackGold).toMatchObject({ Trim: 'energyGold', SocksShadow: 'goldDark', Socks: 'gold' });
    expect(HARRISON_KITS.gold).toMatchObject({ Jersey: 'gold', JerseyLight: 'energyGold', Trim: 'white', Socks: 'white' });
    expect(HARRISON_BOOTS.lightning).toEqual({ BootShadow: 'blue', Boot: 'electric', BootLight: 'electricLight' });
    expect(HARRISON_BOOTS.black).toEqual({ BootShadow: 'black', Boot: 'charcoal', BootLight: 'slate' });
    expect(HARRISON_BOOTS.gold).toEqual({ BootShadow: 'goldDark', Boot: 'gold', BootLight: 'energyGold' });
  });
});

describe('outfitLook', () => {
  it('the default outfit looks as he always has', () => {
    expect(outfitLook(DEFAULT_OUTFIT)).toEqual(harrisonLook('home'));
  });

  it('wears the kit, the boots and the extras colours', () => {
    const l = outfitLook(dressed({ kit: 'inferno', boots: 'fire' }));
    expect([l.Jersey, l.Trim, l.Boot]).toEqual(['flame', 'energyGold', 'flame']);
    expect([l.GlassesRim, l.GlassesGlint, l.Armband]).toEqual(['silver', 'white', 'energyGold']);
  });

  it("outfitLook keeps Golden Form's hair", () => {
    const l = outfitLook(dressed({ kit: 'sky' }), 'golden');
    expect([l.Hair, l.Jersey]).toEqual(['energyGold', 'sky']);
  });
});

describe('outfitHeads, outfitBody and outfitPortrait', () => {
  it("outfitHeads adds only what's worn", () => {
    expect(outfitHeads(DEFAULT_OUTFIT, false).side.image.data).toEqual(HARRISON_HEADS.side.image.data);
    expect(outfitHeads(DEFAULT_OUTFIT, true).side.image.data).toEqual(HARRISON_POWER_HEADS.side.image.data);
    const glasses = outfitHeads(dressed({ extras: ['glasses', 'wristbands'] }), false).side.image;
    expect(glasses.get(8, 4)).toBe(C.GlassesRim);
    expect(glasses.get(2, 2)).toBe(HARRISON_HEADS.side.image.get(2, 2));
  });

  it('outfitBody: wristbands and the armband', () => {
    expect(outfitBody(DEFAULT_OUTFIT)).toEqual({ wristbands: false, armband: false, gloves: false });
    expect(outfitBody(dressed({ extras: ['armband', 'glasses'] }))).toEqual({ wristbands: false, armband: true, gloves: false });
  });

  it('outfitPortrait wears the glasses and headband, not the rest', () => {
    expect(outfitPortrait(dressed({ extras: ['wristbands', 'armband'] }), 'neutral').data).toEqual(harrisonPortrait('neutral').data);
    expect(outfitPortrait(dressed({ extras: ['glasses'] }), 'neutral').get(27, 25)).toBe(C.GlassesGlint);
  });
});
