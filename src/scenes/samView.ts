import { MASTER, type MasterColor } from '../art/colors';
import { project, type Camera } from '../game/camera';
import type { Player } from '../game/player';

/**
 * Speedy Sam's pace made visible: dust puffs kicked up behind his boots
 * above `puffFrom` px/s, white speed lines streaming off him above
 * `linesFrom`, and a spray of dust ahead of his planted front foot while
 * he skids.
 */
export const SPEED_FX = { puffFrom: 150, linesFrom: 190 };

/** The puffs cycle this fast, s per frame, and trail this far back off his heel, px. */
const PUFF_STEP_S = 0.08;
const PUFF_BACK = [3, 7, 11] as const;
/** Speed lines: at these heights up his body, px, this long, and starting this far behind him. */
const LINE_HEIGHTS = [14, 22, 30] as const;
const LINE_LEN = 8;
const LINE_GAP = 6;
/** The skid spray: dust thrown up ahead of his front foot, px from his feet. */
const SPRAY = [
  { dx: 9, dy: -1 },
  { dx: 11, dy: -3 },
  { dx: 13, dy: -1 },
  { dx: 12, dy: -5 },
  { dx: 15, dy: -2 },
] as const;
const DUST: readonly MasterColor[] = ['fade', 'silver'];

/** The way he's running, or sliding: his facing once he's stopped. A skid is drawn facing it, leaning back against it. */
export function skidFacing(p: Player): 1 | -1 {
  return p.vx > 0 ? 1 : p.vx < 0 ? -1 : p.facing;
}

function rect(g: CanvasRenderingContext2D, colour: MasterColor, x: number, y: number, w: number, h: number): void {
  g.fillStyle = MASTER[colour];
  g.fillRect(x, y, w, h);
}

/** His dust, speed lines and skid spray, drawn from the player alone: no state. */
export function drawSpeed(g: CanvasRenderingContext2D, cam: Camera, p: Player, nowS: number): void {
  const speed = Math.hypot(p.vx, p.vz);
  const skidding = p.anim.name === 'skid';
  if (speed <= SPEED_FX.puffFrom && !skidding) return;
  const at = project(p.x, 0, p.z, cam);
  const [x, y] = [Math.round(at.sx), Math.round(at.sy)];
  // Behind him is against his run; skidding, his front foot is planted ahead the way he's still sliding.
  const travel = skidFacing(p);
  const back = -travel;
  const tick = Math.floor(nowS / PUFF_STEP_S);
  if (skidding) {
    SPRAY.forEach((s, i) => {
      const flicker = (tick + i) % 2;
      rect(g, DUST[(i + tick) % DUST.length]!, x + travel * (s.dx + flicker), y + s.dy - flicker, 1 + (i % 2), 1);
    });
    return;
  }
  PUFF_BACK.forEach((d, i) => {
    const size = 1 + ((tick + i) % 2);
    rect(g, DUST[(tick + i) % DUST.length]!, x + back * (d + ((tick + i) % 3)) - (back < 0 ? size - 1 : 0), y - (i % 2), size, 1);
  });
  if (speed <= SPEED_FX.linesFrom) return;
  for (const [i, h] of LINE_HEIGHTS.entries()) {
    const off = LINE_GAP + ((tick + i) % 3) * 2;
    const x0 = back < 0 ? x - off - LINE_LEN : x + off;
    rect(g, 'white', x0, y - h - p.y, LINE_LEN, 1);
  }
}
