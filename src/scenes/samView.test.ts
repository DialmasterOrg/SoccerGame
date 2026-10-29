import { describe, expect, it } from 'vitest';
import { MASTER } from '../art/colors';
import { BASE_STATS } from '../game/stats';
import { NO_INTENT, createPlayer, stepPlayer, type Player } from '../game/player';
import { BACKYARD } from '../game/field';
import { project } from '../game/camera';
import { SAM_HANDLING } from '../game/sam';
import { SPEED_FX, drawSpeed } from './samView';

/** A 2D context that records every rectangle filled, with its colour. */
function rects(): { g: CanvasRenderingContext2D; filled: { x: number; y: number; w: number; h: number; colour: string }[] } {
  const filled: { x: number; y: number; w: number; h: number; colour: string }[] = [];
  let colour = '';
  const g = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'fillRect') return (x: number, y: number, w: number, h: number) => void filled.push({ x, y, w, h, colour });
        return () => undefined;
      },
      set(_, prop, value) {
        if (prop === 'fillStyle') colour = String(value);
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  return { g, filled };
}

const CAM = { x: 0 };
/** Sam running right at `speed` px/s. */
const running = (speed: number): Player => Object.assign(createPlayer('away', BASE_STATS, 200, 1), { handling: SAM_HANDLING, vx: speed });
const dust: string[] = [MASTER.fade, MASTER.silver];
/** Where his feet are on screen. */
const feetX = (p: Player) => Math.round(project(p.x, 0, p.z, CAM).sx);

describe('drawSpeed', () => {
  it('draws nothing for a player standing still', () => {
    const { g, filled } = rects();
    drawSpeed(g, CAM, createPlayer('away', BASE_STATS, 200, 1), 1);
    expect(filled).toEqual([]);
  });

  it('kicks up dust puffs behind his boots above the puff speed, but no speed lines yet', () => {
    const { g, filled } = rects();
    const p = running((SPEED_FX.puffFrom + SPEED_FX.linesFrom) / 2);
    drawSpeed(g, CAM, p, 1);
    expect(filled.length).toBeGreaterThan(0);
    for (const r of filled) {
      expect(dust).toContain(r.colour);
      expect(r.x).toBeLessThan(feetX(p));
    }
  });

  it('adds white speed lines behind him when flat out', () => {
    const { g, filled } = rects();
    const p = running(SPEED_FX.linesFrom + 10);
    drawSpeed(g, CAM, p, 1);
    const lines = filled.filter(r => r.colour === MASTER.white);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const r of lines) {
      expect(r.x + r.w).toBeLessThanOrEqual(feetX(p));
      expect(r.w).toBeGreaterThan(r.h);
    }
  });

  it('while skidding, sprays dust ahead of his front foot', () => {
    const p = running(210);
    stepPlayer(p, { ...NO_INTENT, moveX: -1 }, 1 / 60, BACKYARD, false);
    expect(p.anim.name).toBe('skid');
    const { g, filled } = rects();
    drawSpeed(g, CAM, p, 1);
    const spray = filled.filter(r => dust.includes(r.colour) && r.x > feetX(p));
    expect(spray.length).toBeGreaterThanOrEqual(3);
  });
});
