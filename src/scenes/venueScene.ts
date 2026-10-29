import { MASTER, type MasterColor } from '../art/colors';
import { BASE_W } from '../engine/viewport';
import { VENUES, matchById, matchState, nextCareerMatch, starsAt, venueMaxStars, venueStars, type CareerMatch, type MatchState, type VenueId } from '../meta/career';
import { LADDER_MATCHES, trainingLine } from '../meta/ladder';
import { BONUSES } from '../meta/objectives';
import { drawBackdrop } from './backdrop';
import type { GameContext } from './context';
import { menuAudio } from './menu';
import { silhouette } from './powerView';
import { STAR_W, drawPanel, drawStar, drawStars } from './panel';
import { createRoadMapScene } from './roadMapScene';
import type { Scene } from './scene';
import { startMatch } from './startMatch';

export interface VenueScene extends Scene {
  readonly venue: VenueId;
  /** The match under the cursor. */
  readonly cursor: CareerMatch;
  /** The match panel's lines for the cursor's match. */
  readonly panelLines: readonly string[];
}

const HEADER = { h: 30, dim: 0.45 };
const TITLE_Y = 4;
const STARS_LINE_Y = 19;
const NODES = { x: 8, y: 32, w: 304, h: 56 };
const NODE = { w: 20, h: 16, x0: 16, step: 24, y: 44 };
/** The numbered nodes spread evenly over the span the Backyard's ten rungs fill. */
const NODE_SPAN = NODE.step * (LADDER_MATCHES - 1);
const NEXT_Y = 35;
const NODE_STARS_Y = 63;
const BOSS_NODE = { x: 268, y: 38, size: 28 };
const BOSS_LABEL_Y = 69;
/** His face fills the boss node at twice its size. */
const BOSS_FACE_SCALE = 2;
const PANEL = { x: 8, y: 96, w: 304, h: 74 };
const FACE_AT = { x: 14, y: 100 };
const PANEL_TEXT_X = 32;
const PANEL_LINE_YS = [100, 118, 132] as const;
const PANEL_FOOT_Y = 146;
const HINT_RIGHT = 306;
/** The panel text's width: every line, the title at 2x, must fit it. */
export const PANEL_TEXT_W = HINT_RIGHT - PANEL_TEXT_X;
const STAR_GAP_PX = 4;

/** The node's fill, border and number colours by state. */
const NODE_LOOK: Record<MatchState, { fill: MasterColor; border: MasterColor; number: MasterColor }> = {
  beaten: { fill: 'ink', border: 'silver', number: 'white' },
  next: { fill: 'ink', border: 'energyGold', number: 'energyGold' },
  locked: { fill: 'charcoal', border: 'outline', number: 'gray' },
};

/** A numbered match node's left edge: its venue's numbered matches spread evenly along the row. */
export function nodeX(m: CareerMatch): number {
  const n = VENUES.find(v => v.id === m.venue)!.matches.filter(o => o.kind !== 'boss').length;
  return NODE.x0 + (n > 1 ? Math.round((NODE_SPAN * (m.rung - 1)) / (n - 1)) : 0);
}

/** An opponent's face, front on: Biscuit's own, or a human opponent's. */
const faceOf = (art: GameContext['art'], m: CareerMatch): HTMLCanvasElement => (m.opponent === 'biscuit' ? art.biscuitFace : art.opponents[m.opponent].face);

/** The match panel's lines: the match (MATCH n, or TRYOUT n at the School), its blurb (a rung's is its training line, none for rung 1), and its bonus. */
export function panelLines(match: CareerMatch): string[] {
  const words = VENUES.find(v => v.id === match.venue)!.words;
  const title = match.kind === 'boss' ? match.name : `${words.match} ${match.rung} - ${match.name}`;
  const blurb = match.blurb ?? trainingLine(match.rung);
  return [title, ...(blurb ? [blurb] : []), `BONUS: ${BONUSES[match.bonus].label}`];
}

/**
 * A venue's matches in a row, with their stars, and a panel for the one
 * under the cursor. Left/right move along the matches, wrapping; A or
 * Start plays a beaten or next match through the VS card, and only blips
 * on a locked one. B or Esc goes back to the road map.
 */
export function createVenueScene(ctx: GameContext, venue: VenueId, cursorId?: string): VenueScene {
  const { art } = ctx;
  const matches = VENUES.find(v => v.id === venue)!.matches;
  const start = cursorId === undefined ? undefined : matchById(cursorId);
  let index = Math.max(0, matches.indexOf(start?.venue === venue ? start : nextCareerMatch(ctx.profile)));
  const cursor = () => matches[index]!;
  const back = (): Scene => createRoadMapScene(ctx, VENUES.findIndex(v => v.id === venue));
  // B on the VS card lands here from wherever the card was reached.
  menuAudio(ctx);

  const scene: VenueScene = {
    kind: 'venue',
    venue,
    get cursor() {
      return cursor();
    },
    get panelLines() {
      return panelLines(cursor());
    },
    update(input) {
      if (input.pressed.has('back')) {
        ctx.audio.play('menuBack');
        return back();
      }
      const n = matches.length;
      const before = index;
      if (input.pressed.has('left')) index = (index - 1 + n) % n;
      if (input.pressed.has('right')) index = (index + 1) % n;
      if (index !== before) ctx.audio.play('menuMove');
      if (input.pressed.has('confirm') || input.pressed.has('pause')) {
        const match = cursor();
        if (matchState(ctx.profile, match) === 'locked') {
          ctx.audio.play('nope');
          return null;
        }
        ctx.audio.play('menuConfirm');
        return startMatch(ctx, match);
      }
      return null;
    },
    draw(g, nowS) {
      const p = ctx.profile;
      drawBackdrop(g, art, nowS, venue);
      g.save();
      g.globalAlpha = HEADER.dim;
      g.fillStyle = MASTER.ink;
      g.fillRect(0, 0, BASE_W, HEADER.h);
      g.restore();
      const centre = (img: HTMLCanvasElement, y: number) => g.drawImage(img, Math.round(BASE_W / 2 - img.width / 2), y);
      centre(art.text(VENUES.find(v => v.id === venue)!.name, 2, 'energyGold', 'outline'), TITLE_Y);
      const total = art.text(`STARS ${venueStars(p, venue)}/${venueMaxStars(venue)}`, 1, 'white', 'outline');
      const totalX = Math.round(BASE_W / 2 - (STAR_W + STAR_GAP_PX + total.width) / 2);
      drawStar(g, totalX, STARS_LINE_Y + 1, true);
      g.drawImage(total, totalX + STAR_W + STAR_GAP_PX, STARS_LINE_Y);

      drawPanel(g, NODES.x, NODES.y, NODES.w, NODES.h);
      matches.forEach((m, i) => {
        const state = matchState(p, m);
        const look = NODE_LOOK[state];
        const selected = i === index;
        if (m.kind === 'boss') {
          drawNode(g, BOSS_NODE.x, BOSS_NODE.y, BOSS_NODE.size, BOSS_NODE.size, 'charcoal', look.border, selected);
          // The boss's face, a dark silhouette until he's unlocked.
          const face = state === 'locked' ? silhouette(faceOf(art, m)) : faceOf(art, m);
          const size = face.width * BOSS_FACE_SCALE;
          const at = Math.round(BOSS_NODE.size / 2 - size / 2);
          g.drawImage(face, BOSS_NODE.x + at, BOSS_NODE.y + at, size, size);
          const label = art.text('BOSS', 1, look.number, 'outline');
          g.drawImage(label, Math.round(BOSS_NODE.x + BOSS_NODE.size / 2 - label.width / 2), BOSS_LABEL_Y);
          return;
        }
        const x = nodeX(m);
        drawNode(g, x, NODE.y, NODE.w, NODE.h, look.fill, look.border, selected);
        const num = art.text(`${m.rung}`, 1, look.number, 'outline');
        g.drawImage(num, Math.round(x + NODE.w / 2 - num.width / 2), Math.round(NODE.y + NODE.h / 2 - num.height / 2));
        if (state === 'next') {
          const next = art.text('NEXT', 1, 'energyGold', 'outline');
          g.drawImage(next, Math.round(x + NODE.w / 2 - next.width / 2), NEXT_Y);
        }
        drawStars(g, x + 1, NODE_STARS_Y, starsAt(p, m.id));
      });

      drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      const chosen = cursor();
      // A locked boss stays a silhouette in the panel too.
      const face = chosen.kind === 'boss' && matchState(p, chosen) === 'locked' ? silhouette(faceOf(art, chosen)) : faceOf(art, chosen);
      g.drawImage(face, FACE_AT.x, FACE_AT.y);
      panelLines(cursor()).forEach((line, i) => {
        const last = i === panelLines(cursor()).length - 1;
        const colour: MasterColor = i === 0 ? 'energyGold' : last ? 'white' : 'silver';
        // Rung 1 has no blurb: its bonus line keeps the third slot.
        const y = i === 0 ? PANEL_LINE_YS[0] : last ? PANEL_LINE_YS[2] : PANEL_LINE_YS[1];
        g.drawImage(art.text(line, i === 0 ? 2 : 1, colour, 'outline'), PANEL_TEXT_X, y);
      });
      const starsLabel = art.text('STARS', 1, 'silver', 'outline');
      g.drawImage(starsLabel, PANEL_TEXT_X, PANEL_FOOT_Y);
      drawStars(g, PANEL_TEXT_X + starsLabel.width + STAR_GAP_PX, PANEL_FOOT_Y + 1, starsAt(p, cursor().id));
      const hint = art.text('A PLAY   B BACK', 1, 'silver', 'outline');
      g.drawImage(hint, HINT_RIGHT - hint.width, PANEL_FOOT_Y);
    },
  };
  return scene;
}

/** A node box with a one-pixel border, and a second gold ring outside it when it holds the cursor. */
function drawNode(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: MasterColor, border: MasterColor, selected: boolean): void {
  if (selected) {
    g.fillStyle = MASTER.energyGold;
    g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = MASTER.ink;
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
  }
  g.fillStyle = MASTER[border];
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = MASTER[fill];
  g.fillRect(x, y, w, h);
}
