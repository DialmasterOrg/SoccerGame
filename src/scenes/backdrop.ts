import { BALL_R } from '../art/ball';
import { ANCHOR } from '../art/body/pose';
import { MASTER } from '../art/colors';
import { BASE_W } from '../engine/viewport';
import { project, type Camera } from '../game/camera';
import type { VenueId } from '../meta/career';
import type { GameArt } from './art';
import { drawLayers } from './matchView';
import type { WorldPoint } from './outfitView';

/** Where Harrison does his keepy-uppies, in world units. */
const JUGGLER = { x: 170, z: 26 };
/** The camera drifts this far along the pitch and back, once per period. */
const DRIFT_PX = 110;
const DRIFT_PERIOD_S = 24;
/** The juggle clip: four frames at 8 fps; the foot meets the ball on frame 1. */
const JUGGLE_FPS = 8;
const JUGGLE_FRAMES = 4;
const KICK_FRAME = 1;
/** The ball rises this high above his foot between touches, and sits this far ahead of him. */
const KICK_HEIGHT = 16;
const FOOT = { ahead: 8, up: 9 };
const TITLE_TOP = 10;
const SUBTITLE = 'FROM THE BACKYARD TO THE WORLD CUP';

function shadow(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = MASTER.grassDark;
  g.fillRect(Math.round(x) - 2, Math.round(y) + 1, 5, 1);
}

/** A venue, the Backyard unless told, with the camera drifting slowly along it, and Harrison juggling a ball. */
export function drawBackdrop(g: CanvasRenderingContext2D, art: GameArt, nowS: number, venue: VenueId = 'backyard'): void {
  const cam: Camera = { x: (DRIFT_PX / 2) * (1 - Math.cos((2 * Math.PI * nowS) / DRIFT_PERIOD_S)) };
  drawLayers(g, cam, art, venue, nowS);

  const frame = Math.floor(nowS * JUGGLE_FPS) % JUGGLE_FRAMES;
  const feet = project(JUGGLER.x, 0, JUGGLER.z, cam);
  shadow(g, feet.sx, feet.sy);
  const toScreen = (p: WorldPoint) => {
    const s = project(p.x, p.y, p.z, cam);
    return { x: s.sx, y: s.sy };
  };
  art.backdropFx.draw(g, nowS, art.harrisonImage('home', 'juggle', frame), { x: JUGGLER.x, y: 0, z: JUGGLER.z }, 1, false, toScreen);
  g.drawImage(art.harrison('home', 1, 'juggle', frame, nowS), Math.round(feet.sx) - ANCHOR.x, Math.round(feet.sy) - ANCHOR.y);

  // The ball leaves his foot on the kick frame and drops back onto it one loop later.
  const loopS = JUGGLE_FRAMES / JUGGLE_FPS;
  const u = (((nowS * JUGGLE_FPS - KICK_FRAME) / JUGGLE_FRAMES) % 1 + 1) % 1;
  const height = FOOT.up + BALL_R + 4 * KICK_HEIGHT * u * (1 - u);
  const ball = project(JUGGLER.x + FOOT.ahead, height, JUGGLER.z, cam);
  const ground = project(JUGGLER.x + FOOT.ahead, 0, JUGGLER.z, cam);
  shadow(g, ground.sx, ground.sy);
  const spin = Math.floor((nowS / loopS) * art.ball.length) % art.ball.length;
  g.drawImage(art.ball[spin]!, Math.round(ball.sx) - BALL_R, Math.round(ball.sy) - BALL_R);
}

/** The game's title and subtitle, centred at the top of the screen. */
export function drawTitle(g: CanvasRenderingContext2D, art: GameArt): void {
  const lines = [
    art.text("HARRISON'S", 3, 'energyGold', 'outline'),
    art.text('ROAD TO THE CUP', 2, 'energyGold', 'outline'),
    art.text(SUBTITLE, 1, 'white', 'outline'),
  ];
  let y = TITLE_TOP;
  for (const t of lines) {
    g.drawImage(t, Math.round(BASE_W / 2 - t.width / 2), y);
    y += t.height + 2;
  }
}
