import { BISCUIT_ANCHOR } from '../art/opponents/biscuit';
import { project, type Camera } from '../game/camera';
import { PLAYER_H } from '../game/player';
import type { World } from '../game/world';
import type { GameArt } from './art';

/** How far over the top of his head the "?" floats, px... */
const MARK_GAP = 3;
/** ...bobbing up this far, this many times a second. */
const BOB_PX = 1;
const BOB_HZ = 3;

/** The white outlined pixel-font ? bobbing over a confused player's (or tilting dog's) head. Nobody else gets one. */
export function drawTrickMarks(g: CanvasRenderingContext2D, cam: Camera, w: World, art: GameArt, nowS: number): void {
  const p = w.away;
  if (p.fooled?.kind !== 'confused') return;
  const mark = art.text('?', 1, 'white', 'outline');
  const head = w.dog ? BISCUIT_ANCHOR.y : PLAYER_H;
  const bob = Math.floor(Math.max(0, nowS) * BOB_HZ * 2) % 2 === 0 ? 0 : BOB_PX;
  const s = project(p.x, p.y, p.z, cam);
  g.drawImage(mark, Math.round(s.sx - mark.width / 2), Math.round(s.sy - head - MARK_GAP - mark.height - bob));
}
