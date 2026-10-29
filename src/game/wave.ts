import { BALL_R } from '../art/ball';
import { BALL_REST_Y } from './ball';
import { blowKeeper } from './keeper';
import { PLAYER_R, blowAway, brace, type Player } from './player';
import { maxGoal, waveTarget } from './power';
import type { World } from './world';

/** The beam's head (and the ball in it), px/s: far faster than any shot. */
export const WAVE_SPEED = 960;
/** Half the beam's width in depth: Max is in its path when his body overlaps it. */
export const WAVE_HALF_WIDTH = 8;
/** Max braces only if the head has come at least this far before reaching him. */
export const BRACE_DISTANCE = 65;
/** The beam lingers this long after it ends, fading. */
export const WAVE_LINGER_S = 0.35;
/** A braced ball drops this far in front of his body. */
const BRACE_BALL_GAP = 1;

export interface Wave {
  /** Where the ball was when it fired. */
  originX: number;
  originZ: number;
  /** Unit direction along the pitch. */
  dirX: number;
  dirZ: number;
  ageS: number;
  /** Still carrying the ball. */
  live: boolean;
  /** Seconds since it stopped being live, for the fade. */
  fadeS: number;
  outcome: null | 'braced' | 'blown';
  /** It reached their keeper and blew him into his net. */
  keeperBlown: boolean;
  /** Where the beam stops drawing: the brace point, or the ball. */
  endX: number;
  endZ: number;
}

/** Fires from the ball at Max's goal along the stick's aim, with no aim error, and spends the meter. */
export function fireWave(w: World): Wave {
  const goal = maxGoal(w);
  const [dx, dz] = [goal.lineX - w.ball.x, waveTarget(goal, w.home.kick?.aim ?? 'straight', w.ball) - w.ball.z];
  const d = Math.hypot(dx, dz);
  const [dirX, dirZ] = [dx / d, dz / d];
  Object.assign(w.ball, { y: BALL_REST_Y, vy: 0, spin: 0, vx: dirX * WAVE_SPEED, vz: dirZ * WAVE_SPEED });
  if (w.power) {
    w.power.meter = 0;
    w.power.lastKind = 'wave';
  }
  return { originX: w.ball.x, originZ: w.ball.z, dirX, dirZ, ageS: 0, live: true, fadeS: 0, outcome: null, keeperBlown: false, endX: w.ball.x, endZ: w.ball.z };
}

/**
 * One tick of the beam, before the ball moves. While it's live it holds the
 * ball at wave speed along its line, and the tick its head reaches Max
 * decides his fate: braced if he's on his feet, facing it and it came far
 * enough for him to see it; otherwise blown away while the ball carries on.
 */
export function stepWave(w: World, dt: number): { braced: boolean; blown: boolean } {
  const wave = w.wave;
  const out = { braced: false, blown: false };
  if (!wave) return out;
  wave.ageS += dt;
  if (!wave.live) {
    wave.fadeS += dt;
    if (wave.fadeS >= WAVE_LINGER_S) w.wave = null;
    return out;
  }
  const goal = maxGoal(w);
  const pastLine = goal.side === 'right' ? w.ball.x >= goal.lineX : w.ball.x <= goal.lineX;
  if (pastLine || w.match.phase !== 'playing') {
    wave.live = false;
    [wave.endX, wave.endZ] = [w.ball.x, w.ball.z];
    return out;
  }
  [w.ball.vx, w.ball.vz] = [wave.dirX * WAVE_SPEED, wave.dirZ * WAVE_SPEED];
  [wave.endX, wave.endZ] = [w.ball.x, w.ball.z];

  const along = (x: number, z: number) => (x - wave.originX) * wave.dirX + (z - wave.originZ) * wave.dirZ;
  const head = along(w.ball.x, w.ball.z);
  /** The beam's head reaches `p` this tick: he's in its path, ahead of it, and within this tick's travel. */
  const reaches = (p: Player): boolean => {
    const lateral = Math.abs(-(p.x - wave.originX) * wave.dirZ + (p.z - wave.originZ) * wave.dirX);
    const pAlong = along(p.x, p.z);
    return lateral <= WAVE_HALF_WIDTH + PLAYER_R && pAlong + PLAYER_R >= head && pAlong - PLAYER_R <= head + WAVE_SPEED * dt + BALL_R;
  };
  // Their keeper in its path is blown into his net, whatever Max did; nobody braces against it.
  const keeper = w.keepers?.away;
  if (keeper && !wave.keeperBlown && reaches(keeper.body)) {
    blowKeeper(w, keeper, wave.dirX, wave.dirZ);
    wave.keeperBlown = true;
    out.blown = true;
  }

  const max = w.away;
  if (wave.outcome !== null || !reaches(max)) return out;
  const maxAlong = along(max.x, max.z);

  const sx = wave.dirX >= 0 ? 1 : -1;
  const travel = maxAlong - PLAYER_R;
  if (max.state === 'ground' && max.facing === -sx && travel >= BRACE_DISTANCE) {
    brace(max, sx);
    Object.assign(w.ball, { x: max.x - sx * (PLAYER_R + BALL_R + BRACE_BALL_GAP), z: max.z, vx: 0, vy: 0, vz: 0, spin: 0 });
    wave.outcome = 'braced';
    wave.live = false;
    [wave.endX, wave.endZ] = [max.x - sx * PLAYER_R, max.z];
    out.braced = true;
  } else {
    blowAway(max, wave.dirX, wave.dirZ);
    wave.outcome = 'blown';
    out.blown = true;
  }
  return out;
}
