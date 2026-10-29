import { describe, expect, it } from 'vitest';
import { glyph, measureText } from '../art/font';
import { HELP_PAGES, createHelpScene, type HelpScene } from './helpScene';
import type { Scene } from './scene';
import { testContext } from './testContext';
import { fakeArt, recordingContext } from './testDraw';
import { frame } from './testInput';

const STEP = 1 / 60;
const CTX = testContext();
const BEHIND: Scene = { kind: 'hub', update: () => null, draw: () => {} };
const allText = () => HELP_PAGES.flatMap(p => [p.title, ...p.lines]).join('\n');

describe('help', () => {
  it('help covers the controls, the match and the moves', () => {
    expect(HELP_PAGES.map(p => p.title)).toEqual(['CONTROLS', 'THE MATCH', 'MOVES', 'TRICKS', 'POWER MOVES']);
    for (const phrase of ['PERFECT', 'FAR POST', 'NEAR POST', 'GOLDEN GOAL']) expect(allText()).toContain(phrase);
  });

  it('covers every control on the gamepad and the keyboard', () => {
    const controls = HELP_PAGES[0]!.lines.join('\n');
    for (const word of ['A:', 'B:', 'X:', 'Y:', 'LB:', 'RT:', 'START:', 'STICK', 'ARROWS', 'KEY Z', 'KEY X', 'KEY C', 'KEY V', 'KEY A', 'SHIFT', 'ENTER']) {
      expect(controls).toContain(word);
    }
  });

  it('explains the match format and the moves', () => {
    for (const phrase of ['COUNTS DOWN FROM 1:30', '2:00 AT SCHOOL', 'LEVEL AT 0:00', 'KICKS OFF', 'CHARGE', 'GOLD', 'CHIP', 'SLIDE', 'HEADER', 'VOLLEY', 'SPRINT', 'STAMINA']) {
      expect(allText()).toContain(phrase);
    }
  });

  it('the moves page explains the steal and the whiff', () => {
    const page = HELP_PAGES[2]!.lines.join(' ');
    for (const phrase of ['LB', 'STEALS IT', 'STUMBLE']) expect(page).toContain(phrase);
  });

  it('the power moves page explains buying, filling, holding and Max', () => {
    const page = HELP_PAGES[4]!.lines.join(' ');
    for (const phrase of ['BUY THE ENERGY WAVE IN THE SHOP', 'POWER METER', 'PRESS Y OR V', 'FIRE IT WITH X', 'BACKS OFF TO BRACE', 'TAKES THE BALL']) expect(page).toContain(phrase);
  });

  it('every help line fits the screen and uses only font characters', () => {
    const fallback = glyph('?');
    for (const page of HELP_PAGES) {
      for (const line of [page.title, ...page.lines]) {
        expect(measureText(line), line).toBeLessThanOrEqual(300);
        for (const ch of line) if (ch !== '?') expect(glyph(ch), `'${ch}' in "${line}"`).not.toBe(fallback);
      }
    }
  });

  it('flips pages and returns with B', () => {
    const s = createHelpScene(CTX, () => BEHIND) as HelpScene;
    expect(s.kind).toBe('help');
    expect(s.page).toBe(0);
    s.update(frame(['right']), STEP);
    expect(s.page).toBe(1);
    s.update(frame(['left']), STEP);
    s.update(frame(['left']), STEP);
    expect(s.page).toBe(HELP_PAGES.length - 1);
    s.update(frame(['right']), STEP);
    expect(s.page).toBe(0);
    expect(s.update(frame([]), STEP)).toBeNull();
    expect(s.update(frame(['back']), STEP)).toBe(BEHIND);
  });

  it('Start or Esc goes back too, but Enter does not', () => {
    expect(createHelpScene(CTX, () => BEHIND).update(frame(['pause']), STEP)).toBe(BEHIND);
    expect(createHelpScene(CTX, () => BEHIND).update(frame(['pause', 'back']), STEP)).toBe(BEHIND);
    expect(createHelpScene(CTX, () => BEHIND).update(frame(['pause', 'confirm']), STEP)).toBeNull();
  });
});

describe('Help about Biscuit', () => {
  it('THE MATCH page tells him how to beat the dog', () => {
    expect(HELP_PAGES[1]!.lines).toContain("BISCUIT CAN'T SHOOT: BLOCK HIS WAY TO YOUR GOAL.");
  });
});

describe('Help about Sam', () => {
  it("THE MATCH page tells him how to beat Speedy Sam, after Biscuit's line", () => {
    const lines = HELP_PAGES[1]!.lines;
    expect(lines.at(-2)).toBe("BISCUIT CAN'T SHOOT: BLOCK HIS WAY TO YOUR GOAL.");
    expect(lines.at(-1)).toBe("SPEEDY SAM CAN'T STOP: TURN AND LET HIM FLY PAST.");
  });
});

describe('help for the tricks', () => {
  it('CONTROLS has a right stick line with its keys, drawn with the RS picture', () => {
    const rs = HELP_PAGES[0]!.lines.find(l => l.startsWith('RS:'));
    for (const phrase of ['UP', 'RAINBOW FLICK', 'DOWN', 'STEPOVER', 'F', 'D']) expect(rs).toContain(phrase);
    const { g, drawn } = recordingContext();
    createHelpScene(testContext({ art: fakeArt() }), () => BEHIND).draw(g, 0);
    expect(drawn).toContain('art.buttons.RS');
    expect(drawn).not.toContain('art.buttons.RB');
  });

  it('the TRICKS page says what the right stick does, when it works, and from what level', () => {
    const page = HELP_PAGES[3]!.lines.join(' ');
    expect(page).not.toContain('RB');
    for (const phrase of ['RIGHT STICK DOWN', 'STEPOVER', 'RIGHT STICK UP', 'RAINBOW FLICK', 'KEYS D AND F', 'CLOSE IN FRONT', 'FACING YOU', 'TOO FAR OFF OR TOO LATE FOOLS NOBODY', 'LEVEL 4']) expect(page).toContain(phrase);
  });
});
