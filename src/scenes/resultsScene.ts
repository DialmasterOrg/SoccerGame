import { MASTER } from '../art/colors';
import type { Expression } from '../art/harrison/portrait';
import { BASE_W } from '../engine/viewport';
import { nextCareerMatch, venueById } from '../meta/career';
import { addXp, canUpgrade, xpToNext } from '../meta/economy';
import { giftLine } from '../meta/locker';
import { BONUSES, MAX_STARS } from '../meta/objectives';
import type { MatchReward, Unlock } from '../meta/progress';
import { drawBackdrop } from './backdrop';
import type { GameContext } from './context';
import { createHubScene } from './hubScene';
import { drawMenu, menuCue, stepMenu, type MenuState } from './menu';
import { STAR_GAP, STAR_W, drawBar, drawButtonHint, drawPanel, drawStars } from './panel';
import { createRoadMapScene } from './roadMapScene';
import type { Scene } from './scene';
import { createShopScene } from './shopScene';
import { startMatch } from './startMatch';

export interface ResultsScene extends Scene {
  readonly tallyDone: boolean;
  /** NEXT MATCH (or TRY AGAIN), SHOP, HUB: null until the tally is done. */
  readonly menu: MenuState | null;
  /** He can afford an upgrade now: after a trip to the Shop, too. */
  readonly upgradeReady: boolean;
}

/** The tally's beats, in seconds: one reward line every LINE_S, then the XP bar fills over XP_FILL_S, then a star lights every STAR_S. */
export const LINE_S = 0.3,
  XP_FILL_S = 0.8,
  STAR_S = 0.4;

/** What the tally shows `t` seconds in. */
export interface Tally {
  /** How many reward lines are showing. */
  lines: number;
  /** The coin total has landed. */
  total: boolean;
  /** 0..1: how far the XP bar has filled toward the match's XP. */
  xpFill: number;
  xpDone: boolean;
  levelUp: boolean;
  /** How many of the match's stars are lit. */
  stars: number;
  starsDone: boolean;
  done: boolean;
}

/**
 * Lines appear one every LINE_S, the total lands one LINE_S after the last,
 * then the XP bar fills over XP_FILL_S. Then the level-up shows, if any;
 * one LINE_S later the stars light one every STAR_S, and the tally is done
 * one LINE_S after the last star.
 */
export function tallyAt(reward: MatchReward, t: number): Tally {
  const n = reward.lines.length;
  const totalAt = (n + 1) * LINE_S;
  const xpAt = totalAt + XP_FILL_S;
  const xpDone = t >= xpAt;
  const starsAt = xpAt + LINE_S;
  const earned = reward.career.stars;
  const stars = Math.min(earned, Math.max(0, Math.floor((t - starsAt) / STAR_S + 1e-9)));
  return {
    lines: Math.min(n, Math.floor(t / LINE_S + 1e-9)),
    total: t >= totalAt,
    xpFill: Math.min(Math.max((t - totalAt) / XP_FILL_S, 0), 1),
    xpDone,
    levelUp: xpDone && reward.levelBonus > 0,
    stars,
    starsDone: t >= starsAt + earned * STAR_S,
    done: t >= starsAt + earned * STAR_S + LINE_S,
  };
}

/** The career's news: a beaten match, the championship, the boss beaten, a new best, a rematch won, or a try-again. */
export function careerLine(reward: MatchReward): string {
  const { firstWin, champion, improved, stars, match } = reward.career;
  const { result } = reward.summary;
  if (firstWin && champion) return 'BACKYARD CHAMPION! BISCUIT AWAITS';
  const venue = venueById(match.venue);
  const { words } = venue;
  if (firstWin && match.kind === 'boss') return `${match.hudName} BEATEN! ${words.done}`;
  const numbered = venue.matches.filter(m => m.kind === 'match');
  const boss = venue.matches.find(m => m.kind === 'boss');
  if (firstWin && match.kind === 'match' && boss && match === numbered[numbered.length - 1]) return `${boss.name} AWAITS!`;
  if (firstWin) return `${words.match} ${match.rung} ${words.beaten}`;
  if (result === 'win') return improved ? `NEW BEST: ${stars} STARS!` : 'REMATCH WON!';
  return result === 'draw' ? 'ALL SQUARE. GO AGAIN!' : `${match.hudName} TAKES THIS ONE. GO AGAIN!`;
}

/** The match's bonus objective, done or missed. */
export function bonusLine(reward: MatchReward): string {
  const { label } = BONUSES[reward.career.match.bonus];
  return `${reward.career.bonusDone ? 'BONUS DONE' : 'BONUS MISSED'}: ${label}`;
}

/** One line per milestone paid at this Results, each followed by its gift line. */
export function milestoneLines(reward: MatchReward): string[] {
  return reward.career.milestones.flatMap(m => {
    const gift = giftLine(m.index);
    return [`${m.stars} STARS! +${m.coins} COINS`, ...(gift ? [gift] : [])];
  });
}

const UNLOCK_TEXT: Record<Unlock, string> = {
  energyWave: 'ENERGY WAVE UNLOCKED IN THE SHOP!',
  skillMoves: 'NEW MOVES: STEPOVER + RAINBOW FLICK',
  goldenForm: 'GOLDEN FORM UNLOCKED!',
};
const UPGRADE_READY = 'UPGRADE READY IN THE SHOP!';
/** The centred lines under the tally: room for this many. */
const FOOT_LINES = 3;

/** What this match's level-ups unlocked, as Results announces it. */
export function unlockLines(reward: MatchReward): string[] {
  return reward.unlocked.map(u => UNLOCK_TEXT[u]);
}

/**
 * The centred lines under the tally, in order: the career's news and any
 * milestones once it's done, the unlocks from the level-up on, then
 * UPGRADE READY if there's still room. A gift line gives way to an
 * unlock: the Hub's NEW still points to the gift.
 */
export function footLines(reward: MatchReward, tally: Tally, upgradeReady: boolean): string[] {
  const lines = [...(tally.done ? [careerLine(reward), ...milestoneLines(reward)] : []), ...(tally.levelUp ? unlockLines(reward) : [])];
  const gifts = reward.career.milestones.map(m => giftLine(m.index));
  for (let i = lines.length - 1; i >= 0 && lines.length > FOOT_LINES; i--) if (gifts.includes(lines[i]!)) lines.splice(i, 1);
  if (tally.done && upgradeReady) lines.push(UPGRADE_READY);
  return lines.slice(0, FOOT_LINES);
}

/** NEXT MATCH after a win, TRY AGAIN otherwise, or CAREER once every career match is beaten; then SHOP and HUB. */
export function resultsItems(reward: MatchReward): string[] {
  const win = reward.summary.result === 'win';
  return [win && reward.career.allBeaten ? 'CAREER' : win ? 'NEXT MATCH' : 'TRY AGAIN', 'SHOP', 'HUB'];
}

const RESULT_TEXT = { win: 'YOU WIN!', lose: 'YOU LOSE', draw: 'DRAW' } as const;
const FACE: Record<MatchReward['summary']['result'], Expression> = { win: 'celebrate', draw: 'determined', lose: 'disappointed' };
/** Tall enough for three centred lines under the tally, with the menu still on screen below it. */
const PANEL = { x: 8, y: 30, w: 304, h: 104 };
const HEADER_Y = 4;
/** The stars and the bonus line sit together under the header. */
const STARS_Y = 20;
const STARS_W = STAR_GAP * 2 + STAR_W;
const STARS_GAP = 6;
const PORTRAIT_AT = { x: PANEL.x + 8, y: PANEL.y + 6 };
const LINES = { x: PANEL.x + 80, right: PANEL.x + 192, y: PANEL.y + 6, h: 9 };
const SUMMARY_X = PANEL.x + 204;
const XP_BAR = { w: 90, h: 4 };
const LADDER_Y = PANEL.y + 77;
const FOOT_LINE_H = 9;
const MENU_TOP = PANEL.y + PANEL.h + 5;
const SKIP_Y = MENU_TOP + 14;
/** After a press skips the tally, the menu ignores presses this long, so mashing A can't pick NEXT MATCH at once. */
export const SKIP_GRACE_S = 0.25;
const GRACE_IGNORES = ['confirm', 'shoot', 'pause'] as const;

/**
 * The match's reward, tallied a line at a time with coin ticks, then the XP
 * bar and any level-up, then a menu. A fresh A, X, Enter or Start skips the
 * tally (and does nothing else). B or Esc goes to the Hub at any time: the
 * reward is already saved. With `skipTally` it opens finished, as when
 * coming back from the Shop.
 */
export function createResultsScene(ctx: GameContext, reward: MatchReward, skipTally = false, index = 0): ResultsScene {
  const { art } = ctx;
  const end = tallyAt(reward, Infinity);
  let t = 0;
  let tally = tallyAt(reward, 0);
  let menu: MenuState | null = null;
  let graceS = 0;
  /** The third star's fanfare: the level-up tune again. */
  const starFanfare = (next: Tally) => {
    if (next.stars === MAX_STARS && tally.stars < MAX_STARS) ctx.audio.play('levelUp');
  };
  /** Jumps to the end of the tally. A skip still sounds a level-up, or a third star, the tally hadn't reached. */
  const finish = (fanfare: boolean) => {
    if (fanfare && end.levelUp && !tally.levelUp) ctx.audio.play('levelUp');
    if (fanfare) starFanfare(end);
    tally = end;
    menu = { items: resultsItems(reward), index };
  };
  // Reopened from the Shop: it was all heard the first time.
  if (skipTally) finish(false);
  else ctx.audio.playMusic(reward.summary.result);

  const choose = (item: string): Scene | null => {
    if (item === 'SHOP') return createShopScene(ctx, () => createResultsScene(ctx, reward, true, 1));
    if (item === 'HUB') return createHubScene(ctx);
    if (item === 'CAREER') return createRoadMapScene(ctx);
    if (item === 'TRY AGAIN') return startMatch(ctx, reward.career.match);
    return startMatch(ctx, nextCareerMatch(ctx.profile));
  };

  const scene: ResultsScene = {
    kind: 'results',
    get tallyDone() {
      return tally.done;
    },
    get menu() {
      return menu;
    },
    get upgradeReady() {
      return canUpgrade(ctx.profile);
    },
    update(input, dt) {
      if (!menu) {
        if (input.pressed.has('back')) {
          ctx.audio.play('menuBack');
          return createHubScene(ctx);
        }
        if (input.pressed.has('confirm') || input.pressed.has('shoot') || input.pressed.has('pause')) {
          finish(true);
          graceS = SKIP_GRACE_S;
          return null;
        }
        t += dt;
        const next = tallyAt(reward, t);
        if (next.lines > tally.lines || (next.total && !tally.total)) ctx.audio.play('coin');
        if (next.levelUp && !tally.levelUp) ctx.audio.play('levelUp');
        if (next.stars > tally.stars) ctx.audio.play('star');
        starFanfare(next);
        tally = next;
        if (tally.done) finish(true);
        return null;
      }
      graceS = Math.max(0, graceS - dt);
      if (graceS > 0) input = { ...input, pressed: new Set([...input.pressed].filter(a => !(GRACE_IGNORES as readonly string[]).includes(a))) };
      // Start confirms here, as on the Hub; Esc (pause plus back) backs out.
      const r = stepMenu(menu, input);
      const chosen = r.back ? null : (r.chosen ?? (input.pressed.has('pause') ? r.m.items[r.m.index]! : null));
      const cue = menuCue(menu, { ...r, chosen });
      if (cue) ctx.audio.play(cue);
      menu = r.m;
      if (r.back) return createHubScene(ctx);
      return chosen ? choose(chosen) : null;
    },
    draw(g, nowS) {
      const { summary, career } = reward;
      drawBackdrop(g, art, nowS);
      const centre = (img: HTMLCanvasElement, y: number) => g.drawImage(img, Math.round(BASE_W / 2 - img.width / 2), y);
      centre(art.text(`${RESULT_TEXT[summary.result]} ${summary.goalsFor}-${summary.goalsAgainst}`, 2, 'energyGold', 'outline'), HEADER_Y);
      // The stars and the bonus line, as one centred group.
      const bonus = art.text(bonusLine(reward), 1, career.bonusDone ? 'energyGold' : 'white', 'outline');
      const groupX = Math.round(BASE_W / 2 - (STARS_W + STARS_GAP + bonus.width) / 2);
      drawStars(g, groupX, STARS_Y + 1, tally.stars);
      g.drawImage(bonus, groupX + STARS_W + STARS_GAP, STARS_Y);
      drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      g.drawImage(art.portraits[FACE[summary.result]], PORTRAIT_AT.x, PORTRAIT_AT.y);

      reward.lines.slice(0, tally.lines).forEach((line, i) => {
        const y = LINES.y + i * LINES.h;
        g.drawImage(art.text(line.label, 1, 'white', 'outline'), LINES.x, y);
        const amount = art.text(`+${line.coins}`, 1, 'energyGold', 'outline');
        g.drawImage(amount, LINES.right - amount.width, y);
      });

      // The total rolls up as the lines land, takes the level bonus with the level-up, and the milestones with their lines.
      const coins = tally.done
        ? reward.coins
        : reward.lines.slice(0, tally.lines).reduce((sum, l) => sum + l.coins, 0) + (tally.levelUp ? reward.levelBonus : 0);
      let y = LINES.y;
      g.drawImage(art.text('COINS', 1, 'silver', 'outline'), SUMMARY_X, y);
      g.drawImage(art.text(`+${coins}`, 2, tally.total ? 'energyGold' : 'white', 'outline'), SUMMARY_X, y + 9);
      y += 27;
      if (tally.total) {
        const shown = addXp(reward.before.level, reward.before.xp, Math.round(reward.xp * tally.xpFill));
        g.drawImage(art.text(`XP +${reward.xp}`, 1, 'silver', 'outline'), SUMMARY_X, y);
        drawBar(g, SUMMARY_X, y + 10, XP_BAR.w, XP_BAR.h, shown.xp / xpToNext(shown.level), MASTER.electric);
      }
      y += 19;
      if (tally.levelUp) {
        g.drawImage(art.text(`LEVEL UP! LEVEL ${reward.after.level}`, 1, 'energyGold', 'outline'), SUMMARY_X, y);
        g.drawImage(art.text(`LEVEL BONUS +${reward.levelBonus}`, 1, 'white', 'outline'), SUMMARY_X, y + 9);
      }

      // The career's line comes first once the tally is done; unlocks shown before then keep their place below it.
      const firstSlot = tally.done ? 0 : 1;
      const newsIsWhite = summary.result !== 'win';
      footLines(reward, tally, scene.upgradeReady).forEach((line, i) => {
        const colour = line === UPGRADE_READY ? 'volt' : line === careerLine(reward) && newsIsWhite ? 'white' : 'energyGold';
        centre(art.text(line, 1, colour, 'outline'), LADDER_Y + (firstSlot + i) * FOOT_LINE_H);
      });
      if (menu) drawMenu(g, art, menu, BASE_W / 2, MENU_TOP);
      else drawButtonHint(g, art, art.buttons.A, 'SKIP', BASE_W / 2, SKIP_Y);
    },
  };
  return scene;
}
