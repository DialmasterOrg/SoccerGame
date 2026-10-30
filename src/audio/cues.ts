/** Every sound effect the game makes. */
export type Cue =
  | 'kickSoft'
  | 'kickHard'
  | 'tap'
  | 'bounce'
  | 'post'
  | 'fence'
  | 'tackle'
  | 'net'
  | 'perfect'
  | 'whistleShort'
  | 'whistleFull'
  | 'roar'
  | 'cheer'
  | 'groan'
  | 'ooh'
  | 'menuMove'
  | 'menuConfirm'
  | 'menuBack'
  | 'coin'
  | 'buy'
  | 'levelUp'
  | 'nope'
  | 'powerUp'
  | 'powerReady'
  | 'fizzle'
  | 'waveBlast'
  | 'beam'
  | 'brace'
  | 'whoosh'
  | 'skid'
  | 'stepover'
  | 'flick'
  | 'glove'
  | 'dive'
  | 'parry'
  | 'punt'
  | 'boom'
  | 'star'
  | 'bark'
  | 'pant'
  | 'bossSting'
  | 'gusSting';

export type Wave = 'square' | 'triangle' | 'noise';

/** One voice of a cue: a tone or filtered noise with a quick attack and a decay to silence. */
export interface Voice {
  wave: Wave;
  /** Start, seconds after the cue. */
  at?: number;
  dur: number;
  /** Peak gain, before the SFX bus. */
  gain: number;
  /** Seconds to reach the peak. */
  attack?: number;
  /** Seconds held at the peak after the attack; the rest of `dur` decays. */
  hold?: number;
  /** Pitch, or the noise filter's centre for 'noise'. */
  freq: number;
  /** Glides to this by the end. */
  toFreq?: number;
  filter?: { type: 'lowpass' | 'bandpass' | 'highpass'; q?: number };
  vibrato?: { hz: number; depth: number };
}

export interface CueRecipe {
  voices: readonly Voice[];
  /** The same cue again sooner than this is dropped. */
  minGapS: number;
}

/** A referee's blast: it holds its pitch and volume, then cuts off quickly. */
const WHISTLE_RELEASE_S = 0.06;
const whistle = (at: number, dur: number): Voice => ({
  wave: 'triangle',
  at,
  dur,
  gain: 0.3,
  attack: 0.01,
  hold: dur - 0.01 - WHISTLE_RELEASE_S,
  freq: 1900,
  vibrato: { hz: 28, depth: 60 },
});

/** Written by ear: short, 8-bit, and nothing shrill. */
/** The boss's VS card: a low three-note sting, falling, with a thump. */
const BOSS_STING: readonly Voice[] = [
  { wave: 'triangle', dur: 0.25, gain: 0.5, freq: 110, toFreq: 55 },
  { wave: 'square', dur: 0.15, gain: 0.1, freq: 392 },
  { wave: 'square', at: 0.15, dur: 0.15, gain: 0.1, freq: 370 },
  { wave: 'square', at: 0.3, dur: 0.5, gain: 0.1, hold: 0.2, freq: 262 },
];
/** A fourth lower. */
const FOURTH_DOWN = 0.75;
/** A glove thump on the ball, at `at`. */
const thump = (at: number): Voice => ({ wave: 'triangle', at, dur: 0.09, gain: 0.3, freq: 150, toFreq: 80 });

export const CUES: Readonly<Record<Cue, CueRecipe>> = {
  kickSoft: {
    voices: [
      { wave: 'noise', dur: 0.06, gain: 0.3, freq: 900, filter: { type: 'lowpass' } },
      { wave: 'triangle', dur: 0.08, gain: 0.45, freq: 140, toFreq: 60 },
    ],
    minGapS: 0.05,
  },
  kickHard: {
    voices: [
      { wave: 'noise', dur: 0.12, gain: 0.55, freq: 1800, toFreq: 400, filter: { type: 'lowpass' } },
      { wave: 'triangle', dur: 0.14, gain: 0.8, freq: 180, toFreq: 50 },
    ],
    minGapS: 0.05,
  },
  tap: { voices: [{ wave: 'triangle', dur: 0.04, gain: 0.12, freq: 220, toFreq: 120 }], minGapS: 0.08 },
  bounce: { voices: [{ wave: 'triangle', dur: 0.06, gain: 0.25, freq: 120, toFreq: 70 }], minGapS: 0.06 },
  post: {
    voices: [
      { wave: 'square', dur: 0.3, gain: 0.18, freq: 1200, filter: { type: 'lowpass', q: 2 } },
      { wave: 'square', dur: 0.15, gain: 0.07, freq: 1800, filter: { type: 'lowpass' } },
    ],
    minGapS: 0.1,
  },
  fence: {
    voices: [
      { wave: 'noise', dur: 0.1, gain: 0.35, freq: 400, filter: { type: 'lowpass' } },
      { wave: 'triangle', dur: 0.12, gain: 0.4, freq: 90, toFreq: 50 },
    ],
    minGapS: 0.08,
  },
  tackle: {
    voices: [
      { wave: 'noise', dur: 0.15, gain: 0.45, freq: 600, toFreq: 200, filter: { type: 'lowpass' } },
      { wave: 'triangle', dur: 0.15, gain: 0.55, freq: 110, toFreq: 55 },
    ],
    minGapS: 0.1,
  },
  net: { voices: [{ wave: 'noise', dur: 0.35, gain: 0.3, attack: 0.02, freq: 3000, toFreq: 1500, filter: { type: 'highpass' } }], minGapS: 0.2 },
  perfect: {
    voices: [
      { wave: 'square', dur: 0.08, gain: 0.12, freq: 1047 },
      { wave: 'square', at: 0.07, dur: 0.15, gain: 0.12, freq: 1568 },
    ],
    minGapS: 0.2,
  },
  whistleShort: { voices: [whistle(0, 0.35)], minGapS: 0.3 },
  whistleFull: { voices: [whistle(0, 0.25), whistle(0.35, 0.25), whistle(0.7, 0.9)], minGapS: 1 },
  roar: { voices: [{ wave: 'noise', dur: 2.5, gain: 0.45, attack: 0.8, freq: 500, toFreq: 900, filter: { type: 'bandpass', q: 0.7 } }], minGapS: 1 },
  groan: { voices: [{ wave: 'noise', dur: 1.4, gain: 0.35, attack: 0.15, freq: 700, toFreq: 250, filter: { type: 'bandpass', q: 1 } }], minGapS: 1 },
  /** The School Field's bleachers greeting Harrison's goal: a shorter, brighter swell than the roar, with a few claps, under the roar's gain. By design, not by ear. */
  cheer: {
    voices: [
      { wave: 'noise', dur: 1.6, gain: 0.3, attack: 0.4, freq: 800, toFreq: 1400, filter: { type: 'bandpass', q: 0.8 } },
      { wave: 'noise', at: 0.35, dur: 0.05, gain: 0.12, freq: 2400, filter: { type: 'bandpass', q: 2 } },
      { wave: 'noise', at: 0.55, dur: 0.05, gain: 0.12, freq: 2400, filter: { type: 'bandpass', q: 2 } },
      { wave: 'noise', at: 0.8, dur: 0.05, gain: 0.1, freq: 2400, filter: { type: 'bandpass', q: 2 } },
    ],
    minGapS: 1,
  },
  ooh: {
    voices: [
      { wave: 'noise', dur: 0.45, gain: 0.3, attack: 0.15, freq: 400, toFreq: 900, filter: { type: 'bandpass', q: 1.5 } },
      { wave: 'noise', at: 0.35, dur: 0.45, gain: 0.25, attack: 0.05, freq: 900, toFreq: 400, filter: { type: 'bandpass', q: 1.5 } },
    ],
    minGapS: 0.5,
  },
  menuMove: { voices: [{ wave: 'square', dur: 0.04, gain: 0.08, freq: 660 }], minGapS: 0.03 },
  menuConfirm: {
    voices: [
      { wave: 'square', dur: 0.05, gain: 0.1, freq: 880 },
      { wave: 'square', at: 0.05, dur: 0.08, gain: 0.1, freq: 1320 },
    ],
    minGapS: 0.05,
  },
  menuBack: { voices: [{ wave: 'square', dur: 0.08, gain: 0.08, freq: 660, toFreq: 440 }], minGapS: 0.05 },
  /** One tick per Results line: quiet, so a run of them never grates. */
  coin: { voices: [{ wave: 'square', dur: 0.05, gain: 0.06, freq: 1760 }], minGapS: 0.04 },
  buy: {
    voices: [
      { wave: 'noise', dur: 0.04, gain: 0.08, freq: 4000, filter: { type: 'highpass' } },
      { wave: 'square', dur: 0.06, gain: 0.1, freq: 1319 },
      { wave: 'square', at: 0.06, dur: 0.22, gain: 0.1, freq: 1976 },
    ],
    minGapS: 0.1,
  },
  /** C, E, G, C: short enough to sit over the result jingle. */
  levelUp: {
    voices: [
      { wave: 'square', dur: 0.1, gain: 0.1, freq: 523 },
      { wave: 'square', at: 0.1, dur: 0.1, gain: 0.1, freq: 659 },
      { wave: 'square', at: 0.2, dur: 0.1, gain: 0.1, freq: 784 },
      { wave: 'square', at: 0.3, dur: 0.4, gain: 0.1, hold: 0.15, freq: 1047 },
    ],
    minGapS: 1,
  },
  nope: { voices: [{ wave: 'square', dur: 0.16, gain: 0.1, freq: 140, toFreq: 110, filter: { type: 'lowpass' } }], minGapS: 0.15 },
  /** Powering up: a hum rising over a second, with a shimmer on top. */
  powerUp: {
    voices: [
      { wave: 'square', dur: 1, gain: 0.08, attack: 0.15, hold: 0.7, freq: 110, toFreq: 440, filter: { type: 'lowpass', q: 3 }, vibrato: { hz: 9, depth: 6 } },
      { wave: 'noise', dur: 1, gain: 0.06, attack: 0.5, hold: 0.4, freq: 2000, toFreq: 5000, filter: { type: 'bandpass', q: 4 } },
    ],
    minGapS: 0.5,
  },
  /** The wave is ready: a bright two-note chime that says shoot now. */
  powerReady: {
    voices: [
      { wave: 'square', dur: 0.07, gain: 0.12, freq: 1319 },
      { wave: 'square', at: 0.07, dur: 0.14, gain: 0.12, freq: 1976 },
    ],
    minGapS: 0.3,
  },
  /** A power-up that runs out, or is knocked out of him, before he fires: it fizzles out. */
  fizzle: {
    voices: [
      { wave: 'noise', dur: 0.25, gain: 0.18, freq: 3000, toFreq: 600, filter: { type: 'bandpass', q: 2 } },
      { wave: 'square', dur: 0.2, gain: 0.06, freq: 440, toFreq: 110, filter: { type: 'lowpass' } },
    ],
    minGapS: 0.3,
  },
  /** The release: a deep boom with a crack of noise. */
  waveBlast: {
    voices: [
      { wave: 'noise', dur: 0.3, gain: 0.6, freq: 2500, toFreq: 300, filter: { type: 'lowpass' } },
      { wave: 'triangle', dur: 0.35, gain: 0.8, freq: 120, toFreq: 40 },
    ],
    minGapS: 0.3,
  },
  /** The beam's roar as it crosses the screen. */
  beam: {
    voices: [
      { wave: 'noise', at: 0.05, dur: 0.4, gain: 0.35, attack: 0.05, hold: 0.15, freq: 1200, toFreq: 2400, filter: { type: 'bandpass', q: 1.2 } },
      { wave: 'square', at: 0.05, dur: 0.4, gain: 0.06, attack: 0.05, freq: 220, toFreq: 330, filter: { type: 'lowpass' } },
    ],
    minGapS: 0.3,
  },
  /** Max braced: a heavy thud, and the scrape of his skid. */
  brace: {
    voices: [
      { wave: 'triangle', dur: 0.2, gain: 0.75, freq: 90, toFreq: 40 },
      { wave: 'noise', at: 0.04, dur: 0.45, gain: 0.25, freq: 900, toFreq: 300, filter: { type: 'bandpass', q: 0.8 } },
    ],
    minGapS: 0.3,
  },
  /** Speedy Sam's skid: a gritty scrape of boots on grass, falling as he slows. By design, not by ear. */
  skid: { voices: [{ wave: 'noise', dur: 0.32, gain: 0.18, attack: 0.02, freq: 1600, toFreq: 500, filter: { type: 'bandpass', q: 1.2 } }], minGapS: 0.4 },
  /** Max blown off his feet, or Speedy Sam flying past. */
  whoosh: { voices: [{ wave: 'noise', dur: 0.35, gain: 0.3, attack: 0.08, freq: 600, toFreq: 2200, filter: { type: 'bandpass', q: 1.5 } }], minGapS: 0.3 },
  /** Harrison's stepover: a quick swish of his boot over the ball. By design, not by ear. */
  stepover: { voices: [{ wave: 'noise', dur: 0.14, gain: 0.16, attack: 0.03, freq: 1800, toFreq: 900, filter: { type: 'bandpass', q: 2 } }], minGapS: 0.2 },
  /** The rainbow flick leaving his heel: a soft rising pop. By design, not by ear. */
  flick: { voices: [{ wave: 'square', dur: 0.07, gain: 0.08, freq: 330, toFreq: 660 }], minGapS: 0.2 },
  /** A keeper's catch: a dull thump of the ball into his gloves. By design, not by ear. */
  glove: { voices: [{ wave: 'triangle', dur: 0.09, gain: 0.22, freq: 150, toFreq: 80 }, { wave: 'noise', dur: 0.05, gain: 0.08, freq: 900, filter: { type: 'lowpass' } }], minGapS: 0.15 },
  /** A keeper diving: a short rush of air. By design, not by ear. */
  dive: { voices: [{ wave: 'noise', dur: 0.22, gain: 0.16, attack: 0.04, freq: 900, toFreq: 1800, filter: { type: 'bandpass', q: 1.2 } }], minGapS: 0.2 },
  /** A keeper pushing the ball away: a sharp slap of glove on ball. By design, not by ear. */
  parry: { voices: [{ wave: 'noise', dur: 0.06, gain: 0.24, freq: 2400, toFreq: 1200, filter: { type: 'bandpass', q: 1 } }, { wave: 'triangle', dur: 0.05, gain: 0.12, freq: 200, toFreq: 110 }], minGapS: 0.15 },
  /** A keeper's drop kick: a deep thud off his boot. By design, not by ear. */
  punt: { voices: [{ wave: 'triangle', dur: 0.12, gain: 0.3, freq: 110, toFreq: 55 }, { wave: 'noise', dur: 0.06, gain: 0.1, freq: 600, filter: { type: 'lowpass' } }], minGapS: 0.2 },
  /** Goalie Gus's drop kick: deeper and louder than a punt, a boom off his boot under a thud. By design, not by ear. */
  boom: { voices: [{ wave: 'triangle', dur: 0.2, gain: 0.4, freq: 80, toFreq: 40 }, { wave: 'noise', dur: 0.1, gain: 0.15, freq: 400, filter: { type: 'lowpass' } }], minGapS: 0.3 },
  /** A star earned, or a bonus done: a short rising two-note chime, G then D above. By design, not by ear. */
  star: {
    voices: [
      { wave: 'square', dur: 0.08, gain: 0.1, freq: 1568 },
      { wave: 'square', at: 0.08, dur: 0.2, gain: 0.1, freq: 2349 },
    ],
    minGapS: 0.2,
  },
  /** Biscuit grabs the ball: a short gruff woof, a noisy bark over a falling tone. By design, not by ear. */
  bark: {
    voices: [
      { wave: 'square', dur: 0.12, gain: 0.12, freq: 330, toFreq: 180, filter: { type: 'lowpass', q: 2 } },
      { wave: 'noise', dur: 0.1, gain: 0.2, freq: 900, toFreq: 500, filter: { type: 'bandpass', q: 1.5 } },
    ],
    minGapS: 0.4,
  },
  /** Biscuit panting: three breathy huffs across his pant. */
  pant: {
    voices: [0, 0.35, 0.7].map(at => ({ wave: 'noise' as const, at, dur: 0.18, gain: 0.12, attack: 0.04, freq: 1800, toFreq: 1200, filter: { type: 'bandpass' as const, q: 2 } })),
    minGapS: 1,
  },
  bossSting: { voices: BOSS_STING, minGapS: 1 },
  /** Goalie Gus's VS card: the boss sting a fourth lower, ending in two glove thumps. By design, not by ear. */
  gusSting: {
    voices: [...BOSS_STING.map(v => ({ ...v, freq: v.freq * FOURTH_DOWN, ...(v.toFreq === undefined ? {} : { toFreq: v.toFreq * FOURTH_DOWN }) })), thump(0.55), thump(0.7)],
    minGapS: 1,
  },
};
