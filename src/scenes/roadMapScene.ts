import { MASTER } from '../art/colors';
import { BASE_W } from '../engine/viewport';
import type { Camera } from '../game/camera';
import { stageFor } from '../game/stage';
import { TOTAL_STARS, VENUES, careerStars, nextCareerMatch, stopLabel, venueOpen, type VenueId } from '../meta/career';
import type { GameContext } from './context';
import { createHubScene } from './hubScene';
import { drawLayers } from './matchView';
import { menuAudio } from './menu';
import { STAR_W, drawStar } from './panel';
import type { Scene } from './scene';
import { createVenueScene } from './venueScene';

export interface RoadMapScene extends Scene {
  /** Which stop holds the cursor, 0 for the Backyard. */
  readonly index: number;
}

/** Where each stop's card sits: its centre x and its top. The road climbs left to right; the School and the State get the widest gaps, for SCHOOL FIELD and COMING SOON. */
export const STOPS: readonly { cx: number; y: number }[] = [
  { cx: 28, y: 122 },
  { cx: 78, y: 106 },
  { cx: 136, y: 90 },
  { cx: 190, y: 74 },
  { cx: 240, y: 58 },
  { cx: 290, y: 42 },
];

/** The Backyard behind the map, still and dimmed. */
const CAM: Camera = { x: 40 };
const DIM = 0.35;
const TITLE_Y = 6;
const STARS_LINE_Y = 22;
const STAR_GAP_PX = 4;
export const CARD = { w: 46, h: 30 };
/** The postcard shows the venue's own layers from this far along them. */
const POSTCARD_X = 118;
/** ...and from this many rows above the venue's far touchline, where its scenery stands. */
const POSTCARD_ABOVE_FAR = 48;
const FRAME = { thin: 1, thick: 2 };
/** The dotted road between stop centres: 2×2 dots, this many per leg, through the card middles. */
const ROAD = { dot: 2, perLeg: 14, below: 15 };
export const NAME_BELOW = 33;
export const LABEL_BELOW = 42;
const HINT_Y = 168;

/** Where a venue's postcard is cut from its own layers: POSTCARD_X along, POSTCARD_ABOVE_FAR rows above its far touchline. */
export function postcardFrom(venue: VenueId): { x: number; y: number } {
  const stage = stageFor(venue);
  return { x: POSTCARD_X, y: stage.view.nearSY - stage.field.depth - POSTCARD_ABOVE_FAR };
}


/**
 * The road to the Cup: six stops climbing left to right across the dimmed
 * Backyard. Left/right move the cursor, without wrapping; A or Start enters
 * an open venue and only blips on a locked one. B or Esc goes to the Hub.
 */
export function createRoadMapScene(ctx: GameContext, index?: number): RoadMapScene {
  const { art } = ctx;
  // Unless told where, the cursor starts on the stop holding the next match.
  const start = index ?? VENUES.findIndex(v => v.id === nextCareerMatch(ctx.profile).venue);
  let at = Math.min(Math.max(start, 0), VENUES.length - 1);
  // Reached from Results too, where the match crowd is still murmuring.
  menuAudio(ctx);

  return {
    kind: 'roadMap',
    get index() {
      return at;
    },
    update(input) {
      if (input.pressed.has('back')) {
        ctx.audio.play('menuBack');
        return createHubScene(ctx);
      }
      const before = at;
      if (input.pressed.has('left')) at = Math.max(0, at - 1);
      if (input.pressed.has('right')) at = Math.min(VENUES.length - 1, at + 1);
      if (at !== before) ctx.audio.play('menuMove');
      if (input.pressed.has('confirm') || input.pressed.has('pause')) {
        const venue = VENUES[at]!;
        if (!venueOpen(ctx.profile, venue.id)) {
          ctx.audio.play('nope');
          return null;
        }
        ctx.audio.play('menuConfirm');
        return createVenueScene(ctx, venue.id);
      }
      return null;
    },
    draw(g) {
      const p = ctx.profile;
      drawLayers(g, CAM, art);
      g.save();
      g.globalAlpha = DIM;
      g.fillStyle = MASTER.ink;
      g.fillRect(0, 0, BASE_W, g.canvas.height);
      g.restore();
      const centre = (img: HTMLCanvasElement, y: number) => g.drawImage(img, Math.round(BASE_W / 2 - img.width / 2), y);
      centre(art.text('THE ROAD TO THE CUP', 2, 'energyGold', 'outline'), TITLE_Y);
      const total = art.text(`STARS ${careerStars(p)}/${TOTAL_STARS}`, 1, 'white', 'outline');
      const totalX = Math.round(BASE_W / 2 - (STAR_W + STAR_GAP_PX + total.width) / 2);
      drawStar(g, totalX, STARS_LINE_Y + 1, true);
      g.drawImage(total, totalX + STAR_W + STAR_GAP_PX, STARS_LINE_Y);

      // The road first, so the cards sit on it.
      g.fillStyle = MASTER.silver;
      for (let leg = 0; leg + 1 < STOPS.length; leg++) {
        const a = STOPS[leg]!;
        const b = STOPS[leg + 1]!;
        for (let i = 1; i < ROAD.perLeg; i++) {
          const u = i / ROAD.perLeg;
          g.fillRect(Math.round(a.cx + (b.cx - a.cx) * u), Math.round(a.y + ROAD.below + (b.y - a.y) * u), ROAD.dot, ROAD.dot);
        }
      }

      VENUES.forEach((venue, i) => {
        const stop = STOPS[i]!;
        const x = stop.cx - CARD.w / 2;
        const open = venueOpen(p, venue.id);
        const frame = i === at ? FRAME.thick : FRAME.thin;
        g.fillStyle = open ? MASTER.energyGold : MASTER.outline;
        g.fillRect(x - frame, stop.y - frame, CARD.w + 2 * frame, CARD.h + 2 * frame);
        if (open) {
          g.save();
          g.beginPath();
          g.rect(x, stop.y, CARD.w, CARD.h);
          g.clip();
          const from = postcardFrom(venue.id);
          g.translate(x - from.x, stop.y - from.y);
          // Each venue draws at its own size, so the School shows its school building, not its sky.
          drawLayers(g, { x: 0, view: stageFor(venue.id).view }, art, venue.id);
          g.restore();
        } else {
          g.fillStyle = MASTER.charcoal;
          g.fillRect(x, stop.y, CARD.w, CARD.h);
          const mark = art.text('?', 2, 'gray', 'outline');
          g.drawImage(mark, Math.round(stop.cx - mark.width / 2), Math.round(stop.y + CARD.h / 2 - mark.height / 2));
        }
        const name = art.text(venue.name, 1, open ? 'energyGold' : 'gray', 'outline');
        g.drawImage(name, Math.round(stop.cx - name.width / 2), stop.y + NAME_BELOW);
        const label = art.text(stopLabel(p, venue.id), 1, open ? 'white' : 'gray', 'outline');
        const starW = open ? STAR_W + STAR_GAP_PX : 0;
        const labelX = Math.round(stop.cx - (starW + label.width) / 2);
        if (open) drawStar(g, labelX, stop.y + LABEL_BELOW + 1, true);
        g.drawImage(label, labelX + starW, stop.y + LABEL_BELOW);
      });
      centre(art.text('A ENTER   B BACK', 1, 'silver', 'outline'), HINT_Y);
    },
  };
}
