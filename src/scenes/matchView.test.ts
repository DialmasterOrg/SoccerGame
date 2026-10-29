import { describe, expect, it } from 'vitest';
import { DOG_DIFFICULTY } from '../game/dog';
import { BASE_STATS } from '../game/stats';
import { createWorld } from '../game/world';
import { NORMAL_HANDLING, NO_INTENT, stepPlayer } from '../game/player';
import { DIFFICULTY } from '../game/ai';
import type { MatchState } from '../game/match';
import { SAM_HANDLING } from '../game/sam';
import type { GameArt, SpriteSet } from './art';
import { depthSorted } from './depthSort';
import { arrowX, banner, calloutLine, drawLayers, drawMatch, homeClip, pitchDrawables, takeFlash, type MatchHud } from './matchView';
import { fakeArt, recordingContext } from './testDraw';
import { powerMeterX0 } from './powerView';
import { BIG_VIEW } from '../game/camera';
import { SCHOOL_STAGE } from '../game/stage';

/** Building the list never touches the art; only drawing does. */
const NO_ART = {} as GameArt;

/** Stand-in canvases that name themselves, and a context that records what it drew where. */
const named = (name: string, width = 320) => ({ name, width, height: 180 }) as unknown as HTMLCanvasElement;
const venueArt = (v: string) => ({
  layers: { far: named(`${v}/far`), mid: named(`${v}/mid`, 496), near: named(`${v}/near`, 600), ground: named(`${v}/ground`, 680) },
  joggers: [[named(`${v}/jogger0a`, 7), named(`${v}/jogger0b`, 7)]],
});
function recorder() {
  const drawn: { name: string; x: number; y: number }[] = [];
  const g = { drawImage: (img: { name: string }, x: number, y: number) => void drawn.push({ name: img.name, x, y }) } as unknown as CanvasRenderingContext2D;
  return { g, drawn };
}
const VENUE_ART = { venues: { backyard: venueArt('backyard'), park: venueArt('park') } } as unknown as GameArt;

describe('drawLayers', () => {
  it("draws the venue's own layers, far to ground", () => {
    const { g, drawn } = recorder();
    drawLayers(g, { x: 0 }, VENUE_ART, 'park');
    const names = drawn.map(d => d.name);
    expect(names).toContain('park/far');
    expect(names.filter(n => n.startsWith('backyard'))).toEqual([]);
    expect(names.indexOf('park/mid')).toBeLessThan(names.indexOf('park/near'));
    expect(names.indexOf('park/near')).toBeLessThan(names.indexOf('park/ground'));
  });

  it('a venue with no art falls back to the Backyard', () => {
    const { g, drawn } = recorder();
    drawLayers(g, { x: 0 }, VENUE_ART, 'school');
    expect(drawn.map(d => d.name)).toContain('backyard/far');
  });

  it('joggers run on the mid layer, between it and the near layer, and move with time', () => {
    const at = (nowS: number) => {
      const { g, drawn } = recorder();
      drawLayers(g, { x: 0 }, VENUE_ART, 'park', nowS);
      const names = drawn.map(d => d.name);
      const i = names.findIndex(n => n.startsWith('park/jogger0'));
      expect(i).toBeGreaterThan(names.indexOf('park/mid'));
      expect(i).toBeLessThan(names.indexOf('park/near'));
      return drawn[i]!;
    };
    expect(at(2).x).not.toBe(at(0).x);
    expect(at(0).name).not.toBe(at(1 / 8).name);
  });
});

describe('pitchDrawables', () => {
  it('puts both players and the ball at their depths, and every post at its own', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    Object.assign(w.home, { z: 10 });
    Object.assign(w.away, { z: 50 });
    Object.assign(w.ball, { z: 27 });
    const zs = pitchDrawables(w, { x: 0 }, NO_ART).map(d => d.z);
    expect(zs).toEqual(expect.arrayContaining([10, 50, 27]));
    expect(zs.filter(z => z === 18)).toHaveLength(4);
    expect(zs.filter(z => z === 46)).toHaveLength(4);
    expect(zs).toHaveLength(11);
  });

  it("Sam's dust and speed lines are drawn just behind him; Max has none", () => {
    const max = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    expect(pitchDrawables(max, { x: 0 }, NO_ART)).toHaveLength(11);
    const sam = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 }, null, null, DIFFICULTY.normal, SAM_HANDLING);
    const zs = pitchDrawables(sam, { x: 0 }, NO_ART).map(d => d.z);
    expect(zs).toHaveLength(12);
    expect(zs.filter(z => z > sam.away.z && z < sam.away.z + 0.01)).toHaveLength(1);
  });

  it('skidding, he is drawn facing the way he slides, leaning back against it, not the way he has turned to go', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 }, null, null, DIFFICULTY.normal, SAM_HANDLING);
    Object.assign(w.away, { vx: 210, facing: 1 });
    stepPlayer(w.away, { ...NO_INTENT, moveX: -1 }, 1 / 60, w.field, false);
    expect([w.away.anim.name, w.away.facing]).toEqual(['skid', -1]);
    const side = (s: string) => new Proxy({}, { get: (_, anim) => [named(`${s}.${String(anim)}.0`), named(`${s}.${String(anim)}.1`)] });
    const away = { right: side('right'), left: side('left') } as unknown as SpriteSet;
    const { g, drawn } = recorder();
    for (const d of pitchDrawables(w, { x: 0 }, NO_ART, w.home.anim, undefined, away).filter(d => d.z === w.away.z)) d.draw(g);
    expect(drawn.map(d => d.name)).toContain('right.skid.0');
  });

  it('with Biscuit carrying, the ball is in his frame, not drawn on its own', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 }, null, DOG_DIFFICULTY.normal);
    expect(pitchDrawables(w, { x: 0 }, NO_ART)).toHaveLength(11);
    w.dog!.carrying = true;
    expect(pitchDrawables(w, { x: 0 }, NO_ART)).toHaveLength(10);
  });

  it('a player behind a goal is drawn before its net and crossbar', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    const goal = w.field.goals.find(g => g.side === 'right')!;
    Object.assign(w.home, { x: goal.lineX, z: 52 });
    const sorted = depthSorted(pitchDrawables(w, { x: 0 }, NO_ART));
    const him = sorted.findIndex(d => d.z === 52);
    sorted.forEach((d, i) => {
      if (d.z === goal.z1) expect(him).toBeLessThan(i);
    });
  });
});

describe('banner', () => {
  const world = () => createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
  const moment = (t: number) => ({ t, done: false });

  it('GOAL!!! slams in big once the moment shows its banner', () => {
    const w = world();
    Object.assign(w.match, { phase: 'goal', lastScorer: 'home' });
    expect(banner(w, moment(0.1), 'MAX')).toBeNull();
    expect(banner(w, moment(0.5), 'MAX')).toEqual({ text: 'GOAL!!!', scale: 3 });
  });

  it("the away side's goal gets a smaller banner with its name", () => {
    const w = world();
    Object.assign(w.match, { phase: 'goal', lastScorer: 'away' });
    expect(banner(w, null, 'MAX')).toEqual({ text: 'MAX SCORES', scale: 2 });
    expect(banner(w, null, 'BISCUIT')).toEqual({ text: 'BISCUIT SCORES', scale: 2 });
  });

  it('no banner in the goal pause otherwise', () => {
    const w = world();
    Object.assign(w.match, { phase: 'goal', lastScorer: 'home' });
    expect(banner(w, null, 'MAX')).toBeNull();
  });

  it('FULL TIME, KICK OFF and GOLDEN GOAL as before', () => {
    const w = world();
    expect(banner(w, null, 'MAX')).toEqual({ text: 'KICK OFF', scale: 2 });
    w.match.goldenGoal = true;
    expect(banner(w, null, 'MAX')).toEqual({ text: 'GOLDEN GOAL', scale: 2 });
    w.match.phase = 'playing';
    expect(banner(w, null, 'MAX')).toEqual({ text: 'GOLDEN GOAL', scale: 2 });
    w.match.goldenS = 5;
    expect(banner(w, null, 'MAX')).toBeNull();
    w.match.phase = 'fullTime';
    expect(banner(w, null, 'MAX')).toEqual({ text: 'FULL TIME', scale: 2 });
  });
});

describe('homeClip', () => {
  const world = () => createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });

  it('while celebrating without the card, Harrison is drawn with the celebrate clip', () => {
    const w = world();
    const frames = [1.6, 1.8, 2.0, 2.2].map(t => homeClip(w, { t, done: false }));
    for (const f of frames) expect(f.name).toBe('celebrate');
    expect(new Set(frames.map(f => f.frame))).toEqual(new Set([0, 1]));
  });

  it('otherwise his own clip', () => {
    const w = world();
    expect(homeClip(w, null)).toEqual(w.home.anim);
    expect(homeClip(w, { t: 0.5, done: false })).toEqual(w.home.anim);
  });
});

describe('calloutLine', () => {
  it('shows the callout under GOAL!!! once the slam has settled, only during the moment', () => {
    const hud = (t: number | null) => ({
      perfect: null,
      moment: t === null ? null : { t, done: false },
      callout: 'HEADER!',
      trail: [],
      flash: false,
      shake: null,
      impactFrames: 0,
      goldenCelebration: false,
      bonusCallout: null, trickCallout: null,
      awayName: 'MAX',
      venue: 'backyard' as const,
      awaySprites: {} as SpriteSet,
      fx: null,
    });
    expect(calloutLine(hud(0.3))).toBeNull();
    expect(calloutLine(hud(0.7))).toBe('HEADER!');
    expect(calloutLine(hud(null))).toBeNull();
    expect(calloutLine({ ...hud(1), callout: null })).toBeNull();
  });
});

describe('takeFlash', () => {
  it('a flash owed while impact frames run waits for them to finish', () => {
    const hud: MatchHud = { perfect: null, moment: null, callout: null, trail: [], flash: true, shake: null, impactFrames: 1, goldenCelebration: false, bonusCallout: null, trickCallout: null, awayName: 'MAX', venue: 'backyard', awaySprites: {} as SpriteSet, fx: null };
    expect(takeFlash(hud)).toBe(false);
    expect(hud.flash).toBe(true);
    hud.impactFrames = 0;
    expect(takeFlash(hud)).toBe(true);
  });

  it('takeFlash is true once, then false', () => {
    const hud: MatchHud = { perfect: null, moment: null, callout: null, trail: [], flash: true, shake: null, impactFrames: 0, goldenCelebration: false, bonusCallout: null, trickCallout: null, awayName: 'MAX', venue: 'backyard', awaySprites: {} as SpriteSet, fx: null };
    expect(takeFlash(hud)).toBe(true);
    expect(takeFlash(hud)).toBe(false);
  });
});

describe('the off-screen ball arrow', () => {
  it('the off-screen arrow never overlaps the POWER meter', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 }, { golden: false });
    Object.assign(w.ball, { y: 400 });
    for (let x = 0; x <= 640; x += 4) {
      w.ball.x = x;
      const at = arrowX(w, { x: 300 });
      expect(at, `ball x ${x}`).not.toBeNull();
      expect(at! + 3, `ball x ${x}`).toBeLessThan(powerMeterX0(320));
    }
  });

  it('without the power move it reaches the right edge as before', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    Object.assign(w.ball, { x: 640, y: 400 });
    expect(arrowX(w, { x: 300 })).toBe(316);
  });

  it('there is no arrow while the ball is on screen', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    expect(arrowX(w, { x: 160 })).toBeNull();
  });
});

describe('the HUD clock', () => {
  const drawnAt = (m: Partial<MatchState>) => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    Object.assign(w.match, { phase: 'playing' }, m);
    const hud: MatchHud = { perfect: null, moment: null, callout: null, trail: [], flash: false, shake: null, impactFrames: 0, goldenCelebration: false, bonusCallout: null, trickCallout: null, awayName: 'MAX', venue: 'backyard', awaySprites: fakeArt('away') as unknown as SpriteSet, fx: null };
    const { g, drawn } = recordingContext();
    drawMatch(g, w, { x: 0 }, fakeArt(), 0, hud);
    return drawn;
  };

  it('the HUD clock counts down, in gold during golden goal', () => {
    expect(drawnAt({ clockS: 30 })).toContain('art.text(1:00,1,white,outline)');
    expect(drawnAt({ clockS: 90, goldenGoal: true, goldenS: 15 })).toContain('art.text(0:30,1,energyGold,outline)');
  });
});

describe('the big view', () => {
  const schoolWorld = (kit: { golden: boolean } | null = null) =>
    createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 }, kit, null, null, NORMAL_HANDLING, null, SCHOOL_STAGE);
  const quietHud = (): MatchHud => ({ perfect: null, moment: null, callout: null, trail: [], flash: false, shake: null, impactFrames: 0, goldenCelebration: false, bonusCallout: null, trickCallout: null, awayName: 'MAX', venue: 'school', awaySprites: fakeArt('away') as unknown as SpriteSet, fx: null });

  it('at the big view the score and clock go on the overlay, the goals and callouts on the canvas', () => {
    const [main, overlay] = [recordingContext(), recordingContext()];
    const w = schoolWorld();
    const hud = { ...quietHud(), perfect: { team: 'home' as const, untilS: 1 } };
    drawMatch(main.g, w, { x: 900, view: BIG_VIEW }, fakeArt(), 0, hud, overlay.g);
    expect(overlay.drawn).toContain('art.text(HARRISON 0-0 MAX,1,white,outline)');
    expect(overlay.drawn).toContain('art.text(2:00,1,white,outline)');
    expect(main.drawn.some(n => n.startsWith('art.goalsFor('))).toBe(true);
    expect(main.drawn).toContain('art.text(PERFECT,1,energyGold,outline)');
    expect(main.drawn).not.toContain('art.text(HARRISON 0-0 MAX,1,white,outline)');
    expect(overlay.drawn.some(n => n.startsWith('art.goalsFor('))).toBe(false);
  });

  it('the off-screen arrow is placed in HUD-layer pixels at the big view', () => {
    const w = schoolWorld();
    Object.assign(w.ball, { x: 400, y: 400, z: 0 });
    expect(arrowX(w, { x: 0, view: BIG_VIEW })).toBe(200);
    const powered = schoolWorld({ golden: false });
    Object.assign(powered.ball, { x: 530, y: 400, z: 0 });
    expect(arrowX(powered, { x: 0, view: BIG_VIEW })).toBe(powerMeterX0(267) - 5);
  });
});
