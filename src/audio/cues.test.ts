import { describe, expect, it } from 'vitest';
import { CUES, type Cue } from './cues';

const loudest = (cue: Cue) => Math.max(...CUES[cue].voices.map(v => v.gain));

describe('cue recipes', () => {
  it('every cue has at least one voice', () => {
    for (const [cue, r] of Object.entries(CUES)) expect(r.voices.length, cue).toBeGreaterThan(0);
  });

  it('every voice ends within 2.5 s, and holds no longer than it lasts', () => {
    for (const [cue, r] of Object.entries(CUES)) {
      for (const v of r.voices) {
        expect((v.at ?? 0) + v.dur, cue).toBeLessThanOrEqual(2.5);
        expect((v.attack ?? 0) + (v.hold ?? 0), cue).toBeLessThan(v.dur);
      }
    }
  });

  it('whistle blasts hold at full volume for most of each blast', () => {
    for (const cue of ['whistleShort', 'whistleFull'] as const) {
      for (const v of CUES[cue].voices) expect((v.attack ?? 0) + (v.hold ?? 0), cue).toBeGreaterThanOrEqual(0.7 * v.dur);
    }
  });

  it('every voice has a gain in (0, 1]', () => {
    for (const [cue, r] of Object.entries(CUES)) {
      for (const v of r.voices) {
        expect(v.gain, cue).toBeGreaterThan(0);
        expect(v.gain, cue).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the bleachers' cheer is shorter and quieter than the roar, with a few claps", () => {
    expect(loudest('cheer')).toBeLessThan(loudest('roar'));
    const cheerEnd = Math.max(...CUES.cheer.voices.map(v => (v.at ?? 0) + v.dur));
    const roarEnd = Math.max(...CUES.roar.voices.map(v => (v.at ?? 0) + v.dur));
    expect(cheerEnd).toBeLessThan(roarEnd);
    expect(CUES.cheer.voices.length).toBeGreaterThanOrEqual(3);
  });

  it('dribble taps and bounces are rate-limited', () => {
    expect(CUES.tap.minGapS).toBeGreaterThanOrEqual(0.06);
    expect(CUES.bounce.minGapS).toBeGreaterThanOrEqual(0.06);
  });

  it('a dribble tap is at most a quarter as loud as a hard kick', () => {
    expect(loudest('tap')).toBeLessThanOrEqual(loudest('kickHard') / 4);
  });

  it('coin ticks are quiet and rate-limited', () => {
    for (const v of CUES.coin.voices) expect(v.gain).toBeLessThanOrEqual(0.1);
    expect(CUES.coin.minGapS).toBeGreaterThanOrEqual(0.04);
  });

  it('the level-up fanfare ends within 1.5 s', () => {
    for (const v of CUES.levelUp.voices) expect((v.at ?? 0) + v.dur).toBeLessThanOrEqual(1.5);
  });

  it('the shop has a ka-ching and a nope', () => {
    expect(CUES.buy.voices.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...CUES.nope.voices.map(v => v.freq))).toBeLessThan(CUES.menuBack.voices[0]!.freq);
  });

  it('the power cues are short and no louder than a hard kick', () => {
    for (const cue of ['powerUp', 'powerReady', 'fizzle', 'waveBlast', 'beam', 'brace', 'whoosh'] as const) {
      expect(loudest(cue), cue).toBeLessThanOrEqual(loudest('kickHard'));
      for (const v of CUES[cue].voices) expect((v.at ?? 0) + v.dur, cue).toBeLessThanOrEqual(1.1);
    }
  });

  it('the star chime is two short rising notes, quieter than the level-up fanfare', () => {
    const [low, high] = CUES.star.voices;
    expect(CUES.star.voices).toHaveLength(2);
    expect(high!.freq).toBeGreaterThan(low!.freq);
    expect((high!.at ?? 0) + high!.dur).toBeLessThanOrEqual(0.5);
    expect(loudest('star')).toBeLessThanOrEqual(loudest('levelUp'));
    expect(CUES.star.minGapS).toBeLessThan(0.4);
  });

  it('the power-up hum rises over about a second', () => {
    const hum = CUES.powerUp.voices[0]!;
    expect(hum.dur).toBeGreaterThanOrEqual(0.9);
    expect(hum.toFreq! / hum.freq).toBeGreaterThanOrEqual(3);
  });
});
