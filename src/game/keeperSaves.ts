import { BALL_R } from '../art/ball';
import { blockBall } from './contact';
import { GRAVITY } from './constants';
import { keeperGoal, pitchward, startHold, type Keeper, type KeeperEvents, type KeeperProfile, type Strike } from './keeper';
import { BALL_REST_Y } from './ball';
import { PLAYER_R, type Player } from './player';
import { REACH_Z } from './zones';
import type { World } from './world';

/** px/s: a ball this slow, at him, is always held. */
export const SOFT_SPEED = 220;
/** The odds' dials: a shot's pace over his catching speed, his reach, a PERFECT strike, and a volley or header from close in. Starting values. */
export const HOLD = { pace: 0.8, reach: 0.4, perfect: 0.25, close: 0.2, closeX: 120 };
/** A standing keeper's zone runs this far beyond his body and the ball along the pitch. */
export const ZONE_AHEAD = 3;
/** A smother only reaches a ball this low. */
const SMOTHER_Y = 12;
/** Path samples per px the ball moved this tick, so no shot tunnels through his zone. */
const SAMPLE_PX = 1.5;
/** A pushed ball goes off at this share of its pace, drawn between the two. */
const PUSH_SHARE = [0.35, 0.5] as const;
/** A standing push's spread in depth, as a share of its pace along the pitch. */
const PUSH_SPREAD = 0.6;
const PUSH_VY = 80;
/** A ball this close under the bar he tips over it. */
const TIP_BELOW_BAR = 8;
const TIP = { vx: 30, vy: 320 };

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** A ball this close ahead of a player, on his line, is at his feet whoever touched it last. */
export const FEET_AHEAD = 10;

/** The ball at an outfielder's feet: low, just ahead of him on his line, him upright. */
export function atFeet(p: Player, ball: { x: number; y: number; z: number }): boolean {
  if (p.y !== 0 || p.state === 'fallen' || p.state === 'blown' || ball.y > BALL_REST_Y + 0.5 || Math.abs(ball.z - p.z) > REACH_Z) return false;
  const ahead = (ball.x - p.x) * p.facing;
  return ahead >= 0 && ahead <= FEET_AHEAD;
}

/** On his feet and not fooled, set or coming out (his standing zone) or diving (his dive zone). */
export function canPlay(k: Keeper): boolean {
  if (k.body.inNet) return false;
  return k.body.state === 'ground' && k.body.fooled === null && (k.act === 'set' || k.act === 'rush' || k.act === 'dive');
}

/** A dive mostly along the pitch: a low dive at a dribbler's feet. */
const smothering = (k: Keeper): boolean => k.dive !== null && Math.abs(k.dive.dirX) > Math.abs(k.dive.dirZ);

/** reach 0..1: how much of his reach the save takes; lineX: his goal line. */
export function holdChance(p: KeeperProfile, s: { speed: number; reach: number; strike: Strike | null }, lineX: number): number {
  if (s.speed <= SOFT_SPEED && s.reach <= 0.5) return 1;
  let odds = p.holdOdds - (HOLD.pace * Math.max(0, s.speed - p.catchSpeed)) / p.catchSpeed - HOLD.reach * s.reach;
  if (s.strike?.perfect) odds -= HOLD.perfect;
  if (s.strike && (s.strike.kind === 'volley' || s.strike.kind === 'header') && Math.abs(s.strike.x - lineX) <= HOLD.closeX) odds -= HOLD.close;
  return clamp01(odds);
}

type Pt = { x: number; y: number; z: number };

/** Where along the ball's path this tick it first met his zone, and how much of his reach that took; null if it didn't. */
function meets(k: Keeper, from: Pt, to: Pt): { at: Pt; reach: number } | null {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / SAMPLE_PX));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const at = { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u, z: from.z + (to.z - from.z) * u };
    const reach = k.act === 'dive' ? inDiveZone(k, at) : inStandingZone(k, at);
    if (reach !== null) return { at, reach };
  }
  return null;
}

function inStandingZone(k: Keeper, b: Pt): number | null {
  const { body, profile } = k;
  const dz = Math.abs(b.z - body.z);
  if (dz > PLAYER_R + profile.reachZ + BALL_R || Math.abs(b.x - body.x) > PLAYER_R + BALL_R + ZONE_AHEAD || b.y > profile.reachY + BALL_R) return null;
  return clamp01(dz / (PLAYER_R + profile.reachZ));
}

function inDiveZone(k: Keeper, b: Pt): number | null {
  const { body, profile } = k;
  const { dirX, dirZ } = k.dive!;
  const len = Math.hypot(dirX, dirZ) || 1;
  const [ux, uz] = [dirX / len, dirZ / len];
  if (b.y > (smothering(k) ? SMOTHER_Y : profile.reachY + BALL_R)) return null;
  const [rx, rz] = [b.x - body.x, b.z - body.z];
  const along = Math.min(Math.max(rx * ux + rz * uz, 0), profile.diveReach);
  if (Math.hypot(rx - ux * along, rz - uz * along) > BALL_R + 3) return null;
  const travelled = profile.diveTravel * Math.min(1, k.actT / profile.diveS);
  return clamp01((travelled + along) / (profile.diveTravel + profile.diveReach));
}

/** Away from his goal, never toward it: tipped over the bar, wide along his dive, or back out along the pitch. */
function pushAway(w: World, k: Keeper, ev: KeeperEvents): void {
  const b = w.ball;
  const g = keeperGoal(w.field, k.side);
  const out = pitchward(w.field, k.side);
  const pace = Math.hypot(b.vx, b.vy, b.vz);
  const share = PUSH_SHARE[0] + (PUSH_SHARE[1] - PUSH_SHARE[0]) * w.rng();
  if (b.y >= g.barY - TIP_BELOW_BAR) {
    // Up over the bar before it reaches the line, a little on toward the goal: onto the roof or the end fence.
    const t = Math.max(Math.abs(g.lineX - b.x) / TIP.vx, 1 / 60);
    const need = g.barY + g.barThick + BALL_R + 2 - b.y;
    Object.assign(b, { vx: -out * TIP.vx, vy: Math.max(TIP.vy, need / t + 0.5 * GRAVITY * t), vz: b.vz * 0.3 });
  } else if (k.act === 'dive') {
    const v = pace * share;
    Object.assign(b, { vx: out * v * 0.6, vy: PUSH_VY, vz: Math.sign(k.dive!.dirZ || 1) * v * 0.8 });
  } else {
    const vx = out * pace * share;
    Object.assign(b, { vx, vy: PUSH_VY, vz: (w.rng() - 0.5) * 2 * PUSH_SPREAD * Math.abs(vx) });
  }
  b.spin = 0;
  b.touchedBy = k.side;
  ev.pushed = k.side;
  if (k.act !== 'dive') k.pose = { name: 'push', leftS: 0.25 };
}

/** Every keeper who can play and whose zone the ball's path met this tick (from → now) saves it: holds it or pushes it away. */
export function keeperSaves(w: World, from: Pt, ev: KeeperEvents): void {
  const ks = w.keepers;
  if (!ks) return;
  for (const k of [ks.home, ks.away]) {
    if (ks.home.holding || ks.away.holding) return;
    if (!canPlay(k)) {
      blockBall(k.body, w.ball, w.field);
      continue;
    }
    // A ball at a dribbler's feet is won only by the smother, never plucked off them standing.
    const atSomeonesFeet = k.act !== 'dive' && (atFeet(w.home, w.ball) || atFeet(w.away, w.ball));
    const hit = atSomeonesFeet ? null : meets(k, from, w.ball);
    if (!hit) {
      blockBall(k.body, w.ball, w.field);
      continue;
    }
    Object.assign(w.ball, hit.at);
    const speed = Math.hypot(w.ball.vx, w.ball.vy, w.ball.vz);
    const always = k.act === 'dive' && smothering(k);
    const chance = always ? 1 : holdChance(k.profile, { speed, reach: hit.reach, strike: ks.strike }, keeperGoal(w.field, k.side).lineX);
    if (chance >= 1 || w.rng() < chance) startHold(w, k, ev, k.act !== 'dive');
    else pushAway(w, k, ev);
  }
}
