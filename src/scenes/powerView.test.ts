import { describe, expect, it } from 'vitest';
import { BASE_STATS } from '../game/stats';
import { createWorld, type World } from '../game/world';
import { POWERED_S } from '../game/power';
import type { SpriteSet } from './art';
import type { MatchHud } from './matchView';
import { auraStrength, drawPowerMeter, homeSprites, powerMeterX0, powerPrompt, shakeFor } from './powerView';
import { fakeArt, type Named } from './testDraw';

const hudWith = (h: Partial<MatchHud> = {}): MatchHud => ({
  perfect: null,
  moment: null,
  callout: null,
  trail: [],
  flash: false,
  shake: null,
  impactFrames: 0,
  goldenCelebration: false,
  bonusCallout: null, trickCallout: null,
  awayName: 'MAX',
  venue: 'backyard',
  awaySprites: {} as SpriteSet,
  fx: null,
  ...h,
});

const world = (golden: boolean | null): World => createWorld(BASE_STATS, BASE_STATS, 1, { home: 0, away: 0 }, golden === null ? null : { golden });
const size = (s: { dx: number; dy: number }) => Math.max(Math.abs(s.dx), Math.abs(s.dy));

describe('shakeFor', () => {
  it('is 4 px right after firing and 0 after 0.3 s', () => {
    const w = world(false);
    const hud = hudWith({ shake: { px: 4, untilS: 10.3 } });
    expect(size(shakeFor(w.power, hud, 10))).toBe(4);
    expect(size(shakeFor(w.power, hud, 10.31))).toBe(0);
  });

  it('being powered up alone does not shake the pitch', () => {
    const w = world(false);
    w.power!.activeS = 2;
    expect(size(shakeFor(w.power, hudWith(), 1))).toBe(0);
  });

  it('is nothing without a power move', () => {
    const w = world(null);
    expect(size(shakeFor(w.power, hudWith({ shake: { px: 4, untilS: 9 } }), 1))).toBe(0);
  });
});

describe('homeSprites', () => {
  it('his normal look in play, the power heads while powered up and striking', () => {
    const w = world(false);
    expect(homeSprites(w, hudWith())).toBe('home');
    w.power!.activeS = 1;
    expect(homeSprites(w, hudWith())).toBe('homePower');
    w.power!.activeS = 0;
    w.home.state = 'unleashing';
    expect(homeSprites(w, hudWith())).toBe('homePower');
  });

  it('gold with Golden Form, and while celebrating an Energy Wave goal in it', () => {
    const w = world(true);
    w.power!.activeS = 1;
    expect(homeSprites(w, hudWith())).toBe('homeGolden');
    w.power!.activeS = 0;
    expect(homeSprites(w, hudWith())).toBe('home');
    expect(homeSprites(w, hudWith({ goldenCelebration: true }))).toBe('homeGolden');
  });
});

describe('powerPrompt', () => {
  it('SHOOT! shows over him once the wave is ready, not while it readies', () => {
    const w = world(false);
    expect(powerPrompt(w)).toBeNull();
    w.power!.activeS = POWERED_S - 0.2;
    expect(powerPrompt(w)).toBeNull();
    w.power!.activeS = 1;
    expect(powerPrompt(w)).toBe('SHOOT!');
  });
});

describe('auraStrength', () => {
  it('building while the wave readies, full once ready, flickering as the time runs out', () => {
    const w = world(false);
    expect(auraStrength(w, hudWith(), 0)).toBe(0);
    w.power!.activeS = POWERED_S - 0.1;
    const building = auraStrength(w, hudWith(), 0);
    expect(building).toBeGreaterThan(0);
    expect(building).toBeLessThan(1);
    w.power!.activeS = 1.2;
    expect(auraStrength(w, hudWith(), 0)).toBe(1);
    w.power!.activeS = 0.3;
    const flicker = [0, 0.05, 0.1, 0.15].map(t => auraStrength(w, hudWith(), t));
    expect(Math.min(...flicker)).toBeLessThan(1);
    expect(Math.max(...flicker)).toBe(1);
  });
});

describe('the POWER meter', () => {
  it('the POWER meter keeps to the right edge of a 267-wide HUD layer', () => {
    expect(powerMeterX0(267)).toBe(powerMeterX0(320) - 53);
    const drawn: { name: string; x: number; width: number }[] = [];
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_, prop) {
        if (prop === 'drawImage') return (img: Named & { width: number }, x: number) => void drawn.push({ name: img.name, x, width: img.width });
        return () => undefined;
      },
      set: () => true,
    });
    drawPowerMeter(g, fakeArt(), 1, 'none', 0, 267);
    const label = drawn.find(d => d.name === 'art.text(POWER,1,energyGold,outline)')!;
    expect(label.x + label.width).toBe(263);
  });
});
