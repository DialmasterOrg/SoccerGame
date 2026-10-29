import { CROWD_AT, FLAG_AT, LEAVES } from '../art/venues/schoolLife';
import type { SchoolLifeCanvases } from './art';

/** The School Field's life, drawn between its layers: the crowd on the bleachers, the flag on its pole, leaves in the air. */

export const CROWD_FPS = { bob: 2, cheer: 6 } as const;
export const FLAG_FPS = 6;
export const LEAF_FPS = 4;

/** Where drawLayers put the School's layers this frame: the mid and near layers' left edges, the rows they shifted by, the view's width. */
export interface LayerAt {
  midX: number;
  nearX: number;
  dy: number;
  viewW: number;
}

export function drawFlag(g: CanvasRenderingContext2D, life: SchoolLifeCanvases, at: LayerAt, nowS: number): void {
  const frame = Math.floor(nowS * FLAG_FPS) % life.flag.length;
  g.drawImage(life.flag[frame]!, at.midX + FLAG_AT.x, FLAG_AT.y + at.dy);
}

/** The crowd bobs in its seats, or cheers on its feet while `cheer`. */
export function drawCrowd(g: CanvasRenderingContext2D, life: SchoolLifeCanvases, at: LayerAt, nowS: number, cheer: boolean): void {
  const frames = cheer ? life.crowd.cheer : life.crowd.bob;
  const frame = Math.floor(nowS * (cheer ? CROWD_FPS.cheer : CROWD_FPS.bob)) % frames.length;
  g.drawImage(frames[frame]!, at.nearX + CROWD_AT.x, CROWD_AT.y + at.dy);
}

/** Each leaf drifts across the view in screen px, wrapping, and sways about its row. */
export function drawLeaves(g: CanvasRenderingContext2D, life: SchoolLifeCanvases, at: LayerAt, nowS: number): void {
  const frame = Math.floor(nowS * LEAF_FPS) % 2;
  LEAVES.forEach((leaf, i) => {
    const x = (((leaf.startX + leaf.speed * nowS) % at.viewW) + at.viewW) % at.viewW;
    const y = leaf.y + at.dy + Math.round(leaf.swayPx * Math.sin((2 * Math.PI * nowS) / leaf.swayS));
    g.drawImage(life.leaves[i]![frame], Math.floor(x), y);
  });
}
