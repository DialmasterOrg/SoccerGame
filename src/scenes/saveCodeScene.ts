import { MASTER } from '../art/colors';
import { BASE_W } from '../engine/viewport';
import { careerStars } from '../meta/career';
import type { Profile } from '../meta/profile';
import { LADDER_MATCHES } from '../meta/profile';
import { decodeSaveCode, encodeSaveCode, groupCode, normaliseCode } from '../meta/saveCode';
import { drawBackdrop } from './backdrop';
import type { GameContext } from './context';
import { backsOut, drawMenu, menuCue, stepMenu, type MenuState } from './menu';
import { drawButtonHint, drawPanel } from './panel';
import type { Scene } from './scene';

export interface SaveCodeScene extends Scene {
  readonly stage: 'show' | 'enter' | 'confirm';
  /** The current save's code, as shown. */
  readonly code: string;
  /** The line under the code: copied, write it down, loaded, or the code didn't work. */
  readonly status: string | null;
  /** What he's typed so far, cleaned up to the code's alphabet. */
  readonly entry: string;
  /** The stage's menu: ENTER A CODE and BACK, or NO and YES. */
  readonly menu: MenuState | null;
  /** The decoded save, as the confirm stage sums it up. */
  readonly summary: string | null;
}

const COPIED = 'COPIED TO THE CLIPBOARD';
const WRITE_IT_DOWN = 'WRITE IT DOWN OR TAKE A PHOTO';
const LOADED = 'SAVE LOADED!';
export const BAD_CODE = "THAT CODE DOESN'T WORK";
const SHOW_ITEMS = ['ENTER A CODE', 'BACK'] as const;
const CONFIRM_ITEMS = ['NO', 'YES'] as const;
/** Longer than any code (167 characters at the loader's ceilings), so a paste of junk can't grow the entry without end. */
export const MAX_ENTRY = 169;

const PANEL = { x: 8, y: 6, w: 304, h: 168 };
const TITLE_Y = PANEL.y + 6;
const CODE = { y: PANEL.y + 28 };
/** A code is shown big, four groups to a line; one too long for three lines that way goes small, eight to a line, up to five lines (which end above STATUS_Y even with ENTRY_DROP). */
const CODE_SIZES = [
  { scale: 2, groupsPerLine: 4, lineH: 16, maxLines: 3 },
  { scale: 1, groupsPerLine: 8, lineH: 9, maxLines: 5 },
] as const;
const STATUS_Y = PANEL.y + 96;
const MENU_TOP = PANEL.y + 110;
const FOOTER_Y = PANEL.y + PANEL.h - 14;
const CURSOR_BLINK_HZ = 2;
const ENTRY_DROP = 12;

/** A code's groups of 5 laid out in lines: big if it fits in three lines, otherwise small. */
export function codeLines(code: string): { lines: string[]; scale: number; lineH: number } {
  const groups = code.split('-').filter(g => g.length > 0);
  const size = CODE_SIZES.find(s => Math.ceil(groups.length / s.groupsPerLine) <= s.maxLines) ?? CODE_SIZES[CODE_SIZES.length - 1];
  const lines: string[] = [];
  for (let i = 0; i < groups.length; i += size.groupsPerLine) lines.push(groups.slice(i, i + size.groupsPerLine).join('-'));
  return { lines, scale: size.scale, lineH: size.lineH };
}

/** A decoded save in one line: LEVEL 6 - 840 COINS - LADDER 4/10 - STARS 7. */
export function summarise(p: Profile): string {
  return `LEVEL ${p.level} - ${p.coins} COINS - LADDER ${p.ladderWins}/${LADDER_MATCHES} - STARS ${careerStars(p)}`;
}

/**
 * The save code, from Options on the Hub. It shows the current code big,
 * and copies it to the clipboard. ENTER A CODE takes one typed or pasted
 * on the keyboard (the game's keys type while it does); a good one is
 * summed up and, after a confirm with NO picked, replaces the save.
 */
export function createSaveCodeScene(ctx: GameContext, back: () => Scene): SaveCodeScene {
  const { art } = ctx;
  let stage: SaveCodeScene['stage'] = 'show';
  let code = encodeSaveCode(ctx.profile);
  let status: string | null = WRITE_IT_DOWN;
  let entry = '';
  let decoded: Profile | null = null;
  let menu: MenuState | null = { items: SHOW_ITEMS, index: 0 };

  /** Shows the current save's code, and tries the clipboard: if that fails, the code is still on screen. */
  const show = (line: string) => {
    stage = 'show';
    code = encodeSaveCode(ctx.profile);
    status = line;
    menu = { items: SHOW_ITEMS, index: 0 };
    const copying = code;
    void ctx.copyText(copying).then(ok => {
      if (ok && stage === 'show' && code === copying && status === WRITE_IT_DOWN) status = COPIED;
    });
  };
  const enter = () => {
    stage = 'enter';
    status = null;
    menu = null;
  };
  show(WRITE_IT_DOWN);

  /** Typed text this frame: Backspace deletes, anything outside the alphabet is dropped. */
  const type = (typed: string) => {
    for (const ch of typed) {
      if (ch === '\b') entry = entry.slice(0, -1);
      else entry = (entry + normaliseCode(ch)).slice(0, MAX_ENTRY);
    }
    if (typed.length > 0) status = null;
  };

  return {
    kind: 'saveCode',
    get stage() {
      return stage;
    },
    get code() {
      return code;
    },
    get status() {
      return status;
    },
    get entry() {
      return entry;
    },
    get menu() {
      return menu;
    },
    get summary() {
      return decoded && stage === 'confirm' ? summarise(decoded) : null;
    },
    get wantsText() {
      return stage === 'enter';
    },
    update(input) {
      if (stage === 'enter') {
        type(input.typed);
        if (input.pressed.has('back')) {
          ctx.audio.play('menuBack');
          show(WRITE_IT_DOWN);
          return null;
        }
        if (input.pressed.has('confirm')) {
          decoded = decodeSaveCode(entry, ctx.profile);
          if (!decoded) {
            status = BAD_CODE;
            ctx.audio.play('nope');
            return null;
          }
          ctx.audio.play('menuConfirm');
          stage = 'confirm';
          menu = { items: CONFIRM_ITEMS, index: 0 };
        }
        return null;
      }
      const m = menu!;
      const r = stepMenu(m, input);
      const out = backsOut(input);
      const cue = menuCue(m, { ...r, back: out });
      if (cue) ctx.audio.play(cue);
      menu = r.m;
      if (stage === 'show') {
        if (out || r.chosen === 'BACK') return back();
        if (r.chosen === 'ENTER A CODE') enter();
        return null;
      }
      if (out || r.chosen === 'NO') {
        enter();
        return null;
      }
      if (r.chosen === 'YES' && decoded) {
        ctx.saveProfile(decoded);
        entry = '';
        show(LOADED);
      }
      return null;
    },
    draw(g, nowS) {
      drawBackdrop(g, art, nowS);
      drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      const centre = (img: HTMLCanvasElement, y: number) => g.drawImage(img, Math.round(BASE_W / 2 - img.width / 2), y);
      centre(art.text('SAVE CODE', 2, 'energyGold', 'outline'), TITLE_Y);
      if (stage === 'confirm' && decoded) {
        centre(art.text('THIS CODE HOLDS', 1, 'silver', 'outline'), CODE.y);
        centre(art.text(summarise(decoded), 1, 'white', 'outline'), CODE.y + 12);
        centre(art.text('REPLACE THIS SAVE?', 2, 'energyGold', 'outline'), CODE.y + 30);
      } else {
        const shown = codeLines(stage === 'enter' ? groupCode(entry) : code);
        // Entering, the code sits a line lower, under how to enter it.
        const top = stage === 'enter' ? CODE.y + ENTRY_DROP : CODE.y + 4;
        if (stage === 'enter') {
          centre(art.text('TYPE OR PASTE A CODE - KEYBOARD ONLY', 1, 'silver', 'outline'), CODE.y);
          if (shown.lines.length === 0) shown.lines.push('');
        }
        shown.lines.forEach((line, i) => {
          const t = art.text(line, shown.scale, 'white', 'outline');
          const y = top + i * shown.lineH;
          if (line) centre(t, y);
          const last = i === shown.lines.length - 1;
          if (stage === 'enter' && last && Math.floor(nowS * CURSOR_BLINK_HZ * 2) % 2 === 0) {
            g.fillStyle = MASTER.energyGold;
            g.fillRect(Math.round(BASE_W / 2 + (line ? t.width : 0) / 2) + 2, y + 2, 2 * shown.scale, 6 * shown.scale);
          }
        });
      }
      if (status) centre(art.text(status, 1, status === BAD_CODE ? 'redLight' : 'volt', 'outline'), STATUS_Y);
      if (menu) drawMenu(g, art, menu, BASE_W / 2, MENU_TOP);
      if (stage === 'enter') {
        // Keyboard only, so no pad buttons here.
        centre(art.text('ENTER: CHECK IT    ESC: BACK', 1, 'silver', 'outline'), FOOTER_Y);
      } else {
        drawButtonHint(g, art, art.buttons.B, 'BACK', BASE_W / 2, FOOTER_Y);
      }
    },
  };
}
