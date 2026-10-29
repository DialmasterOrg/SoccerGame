import { MASTER } from '../art/colors';
import { STAT_NAMES, type StatName, type Stats } from '../game/stats';
import { careerCardLines } from '../meta/career';
import { xpToNext } from '../meta/economy';
import type { Profile } from '../meta/profile';
import { drawBackdrop } from './backdrop';
import type { GameContext } from './context';
import { createHelpScene } from './helpScene';
import { drawMenu, menuAudio, menuCue, menuItemY, stepMenu, type MenuState } from './menu';
import { createOptionsScene } from './optionsScene';
import { drawBar, drawCoins, drawPanel } from './panel';
import { createRoadMapScene } from './roadMapScene';
import { createSavesScene } from './savesScene';
import type { Scene } from './scene';
import { createShopScene } from './shopScene';
import { createLockerRoomScene } from './lockerRoomScene';
import { unseenGifts } from '../meta/locker';

/** No QUIT: a web page can't close its own tab. */
export const HUB_ITEMS = ['CAREER', 'SHOP', 'LOCKER ROOM', 'OPTIONS', 'HELP', 'SAVES'] as const;

const SHORT: Record<StatName, string> = { speed: 'SPD', power: 'PWR', jump: 'JMP', control: 'CTL', stamina: 'STA' };
export const CARD = { x: 16, y: 8, w: 288, h: 80 };
const PORTRAIT_AT = { x: CARD.x + 6, y: CARD.y + 8 };
export const TEXT_X = CARD.x + 80;
/** Short enough that LEVEL 999, the bar and a 12-letter name on NORMAL share the LEVEL row. */
export const XP_BAR = { gap: 6, w: 40, h: 4 };
export const CARD_RIGHT = CARD.x + CARD.w - 8;
const MENU_TOP = 98;
/** Right of centre, so the backdrop's juggling Harrison (who drifts across the left and middle) is never hidden behind it. */
const MENU_CX = 248;
/** NEW sits this far right of LOCKER ROOM's text. */
const NEW_GAP = 3;

/** His five stats in short, e.g. SPD 3  PWR 2  JMP 1  CTL 4  STA 2. */
export function statsLine(s: Stats): string {
  return STAT_NAMES.map(k => `${SHORT[k]} ${s[k]}`).join('  ');
}

/** The save's name and difficulty for the Hub card, e.g. HARRISON - EASY. */
export function saveLabel(p: Profile): string {
  return `${p.name} - ${p.difficulty.toUpperCase()}`;
}

/**
 * Harrison's card (portrait, level and XP, the save's name and
 * difficulty, coins, stats, and what's next in the career) over the
 * drifting Backyard, with CAREER, SHOP, LOCKER ROOM (NEW beside it while
 * a gift waits unseen), OPTIONS, HELP and SAVES. Up/down choose, A or
 * Start confirms, and SAVES, B or Esc goes back to SAVES on this save.
 */
export function createHubScene(ctx: GameContext, index = 0): Scene {
  const { art } = ctx;
  let menu: MenuState = { items: HUB_ITEMS, index };
  menuAudio(ctx);
  const backHere = () => createHubScene(ctx, menu.index);
  return {
    kind: 'hub',
    update(input) {
      // Start confirms here, as on Press Start; Esc (pause plus back) backs out.
      const r = stepMenu(menu, input);
      const chosen = r.back ? null : (r.chosen ?? (input.pressed.has('pause') ? r.m.items[r.m.index]! : null));
      const cue = menuCue(menu, { ...r, chosen });
      if (cue) ctx.audio.play(cue);
      menu = r.m;
      if (r.back || chosen === 'SAVES') return createSavesScene(ctx, ctx.slot);
      if (chosen === 'CAREER') return createRoadMapScene(ctx);
      if (chosen === 'SHOP') return createShopScene(ctx, backHere);
      if (chosen === 'LOCKER ROOM') return createLockerRoomScene(ctx, backHere);
      if (chosen === 'HELP') return createHelpScene(ctx, backHere);
      if (chosen === 'OPTIONS') return createOptionsScene(ctx, backHere, true);
      return null;
    },
    draw(g, nowS) {
      const p = ctx.profile;
      drawBackdrop(g, art, nowS);
      drawPanel(g, CARD.x, CARD.y, CARD.w, CARD.h);
      g.drawImage(art.portraits.neutral, PORTRAIT_AT.x, PORTRAIT_AT.y);
      g.drawImage(art.text('HARRISON', 2, 'energyGold', 'outline'), TEXT_X, CARD.y + 6);
      drawCoins(g, art, `${p.coins}`, CARD_RIGHT, CARD.y + 9);
      const level = art.text(`LEVEL ${p.level}`, 1, 'white', 'outline');
      g.drawImage(level, TEXT_X, CARD.y + 26);
      drawBar(g, TEXT_X + level.width + XP_BAR.gap, CARD.y + 28, XP_BAR.w, XP_BAR.h, p.xp / xpToNext(p.level), MASTER.electric);
      const label = art.text(saveLabel(p), 1, 'silver', 'outline');
      g.drawImage(label, CARD_RIGHT - label.width, CARD.y + 26);
      g.drawImage(art.text(statsLine(p.stats), 1, 'white', 'outline'), TEXT_X, CARD.y + 38);
      const career = careerCardLines(p);
      g.drawImage(art.text(career.first, 1, 'energyGold', 'outline'), TEXT_X, CARD.y + 54);
      if (career.second) g.drawImage(art.text(career.second, 1, 'silver', 'outline'), TEXT_X, CARD.y + 65);
      drawMenu(g, art, menu, MENU_CX, MENU_TOP);
      if (unseenGifts(p).length > 0) {
        const room = art.text('LOCKER ROOM', 1, 'white', 'outline');
        const y = menuItemY(MENU_TOP, HUB_ITEMS.indexOf('LOCKER ROOM'));
        g.drawImage(art.text('NEW', 1, 'flameLight', 'outline'), Math.round(MENU_CX - room.width / 2) + room.width + NEW_GAP, y);
      }
    },
  };
}
