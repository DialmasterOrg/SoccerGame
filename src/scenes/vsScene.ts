import { ANCHOR } from '../art/body/pose';
import { BISCUIT_ANCHOR } from '../art/opponents/biscuit';
import { MASTER } from '../art/colors';
import { BASE_W } from '../engine/viewport';
import type { Camera } from '../game/camera';
import { animates } from '../art/harrison/outfitFx';
import { VENUES, type CareerMatch } from '../meta/career';
import { changeKitFor, outfitOf } from '../meta/locker';
import { BONUSES } from '../meta/objectives';
import type { Profile } from '../meta/profile';
import type { GameContext } from './context';
import { createMatchScene, newSeed } from './matchScene';
import { drawLayers } from './matchView';
import { OutfitFx, type WorldPoint } from './outfitView';
import { drawButtonHint } from './panel';
import type { Scene } from './scene';

export interface VsScene extends Scene {
  readonly match: CareerMatch;
  /** The card's text, top to bottom. */
  readonly lines: readonly string[];
}

/** The card kicks off by itself after this long. */
export const VS_AUTO_S = 2;

/** The venue behind the card, still, as the road map shows it. */
const CAM: Camera = { x: 40 };
/** The band behind the lines is dimmed, as the venue screen's header is: the sky's cloud streak and the washing line are behind them. */
const HEADER = { h: 86, tipH: 98, dim: 0.45 };
/** The match, who plays, the bonus, and the boss's tip once he has beaten Harrison. */
const LINE_YS = [30, 52, 74, 86] as const;
const LINE_SCALES = [2, 2, 1, 1] as const;
const LINE_COLOURS = ['energyGold', 'white', 'white', 'volt'] as const;
/** The two of them stand facing each other on the pitch line. */
const PITCH_Y = 150;
const HOME_X = 110;
/** Harrison's effects on the card run on these random numbers. */
const FX_SEED = 31;
const AWAY_X = 210;
const HINT_Y = 160;

/**
 * The card's lines: the match, who plays, and the bonus. Once Harrison has
 * lost to the boss, and until he beats him, the boss's card adds one tip.
 */
export function vsLines(match: CareerMatch, p: Profile): string[] {
  const { words } = VENUES.find(v => v.id === match.venue)!;
  const title = match.kind === 'boss' ? words.boss : `${words.match} ${match.rung}`;
  const lines = [title, `HARRISON VS ${match.name}`, `BONUS: ${BONUSES[match.bonus].label}`];
  if (match.tip !== null && (p.career.lossStreaks[match.id] ?? 0) >= 1) lines.push(match.tip);
  return lines;
}

/**
 * A short card before kickoff naming the opponent and the bonus. A, X or
 * Start kicks off at once; otherwise it kicks off itself after VS_AUTO_S.
 * B or Esc goes back where it came from.
 */
export function createVsScene(ctx: GameContext, match: CareerMatch, back: () => Scene): VsScene {
  const { art } = ctx;
  const outfit = outfitOf(ctx.profile);
  const fx = animates(outfit) ? new OutfitFx(outfit, FX_SEED) : null;
  // When his kit clashes with theirs, they change: the same call the match makes.
  const change = match.opponent === 'biscuit' ? null : changeKitFor(outfit.kit, match.opponent);
  const lines = vsLines(match, ctx.profile);
  const boss = match.kind === 'boss';
  if (boss) ctx.audio.play('bossSting');
  let t = 0;
  const kickOff = () => createMatchScene(ctx, newSeed(), match);
  return {
    kind: 'vs',
    match,
    lines,
    update(input, dt) {
      // B or Esc (pause plus back) goes back; a lone Start kicks off, unlike the menus.
      if (input.pressed.has('back')) {
        ctx.audio.play('menuBack');
        return back();
      }
      if (input.pressed.has('confirm') || input.pressed.has('shoot') || input.pressed.has('pause')) {
        ctx.audio.play('menuConfirm');
        return kickOff();
      }
      t += dt;
      return t >= VS_AUTO_S - 1e-9 ? kickOff() : null;
    },
    draw(g, nowS) {
      drawLayers(g, CAM, art, match.venue, nowS);
      g.save();
      g.globalAlpha = HEADER.dim;
      g.fillStyle = MASTER.ink;
      g.fillRect(0, 0, BASE_W, lines.length > 3 ? HEADER.tipH : HEADER.h);
      g.restore();
      lines.forEach((line, i) => {
        const text = art.text(line, LINE_SCALES[i] ?? 1, LINE_COLOURS[i] ?? 'white', 'outline');
        g.drawImage(text, Math.round(BASE_W / 2 - text.width / 2), LINE_YS[i] ?? HINT_Y);
      });
      fx?.draw(g, nowS, art.harrisonImage('home', 'idle', 0), { x: HOME_X, y: 0, z: 0 }, 1, false, (p: WorldPoint) => ({ x: p.x, y: PITCH_Y - p.y - p.z }));
      g.drawImage(art.harrison('home', 1, 'idle', 0, nowS), HOME_X - ANCHOR.x, PITCH_Y - ANCHOR.y);
      if (match.opponent === 'biscuit') {
        // He faces Harrison: left, so the anchor column mirrors.
        const dog = art.biscuit.idle.left[0]!;
        g.drawImage(dog, AWAY_X - (dog.width - 1 - BISCUIT_ANCHOR.x), PITCH_Y - BISCUIT_ANCHOR.y);
      } else {
        const sprites = change ? art.opponentIn(match.opponent, change) : art.opponents[match.opponent].sprites;
        g.drawImage(sprites.left.idle[0]!, AWAY_X - ANCHOR.x, PITCH_Y - ANCHOR.y);
      }
      drawButtonHint(g, art, art.buttons.A, 'KICK OFF', BASE_W / 2, HINT_Y);
    },
  };
}
