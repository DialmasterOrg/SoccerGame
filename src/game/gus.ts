import { GUS_HANDS } from '../art/keepers/gus';
import type { Difficulty } from './ai';
import { KEEPER_TOP_LEVEL, SET_OFF, keeperGoal, keeperProfile, pitchward, type Keeper, type KeeperLineup, type KeeperProfile } from './keeper';
import { radiusOf } from './player';
import type { Point } from '../art/raster';
import type { Wave } from './wave';
import type { World } from './world';

/** What only Goalie Gus has: his size, where he holds the ball, his boot. */
export interface GusRules {
  radius: number;
  height: number;
  /** Where a held ball sits, from his feet: x ahead, y up. */
  hands: Point;
  /** Where his boot meets the ball on his drop kick. */
  boot: Point;
  /** A ball caught in his dive lies this far along it. */
  diveBallPx: number;
  /** His drop kick's first bounce: halfway + his attacking direction × (from + rng × spread). */
  punt: { from: number; spread: number };
}

/** His drop kick lands 160-360 px into Harrison's half, where everyone else's lands short of halfway. */
export const GUS: GusRules = { radius: 7, height: 53, hands: GUS_HANDS, boot: { x: 11, y: 8 }, diveBallPx: 13, punt: { from: 160, spread: 200 } };

/** He stands within this of his set spot as he eases into it. */
const SET_SLACK_PX = 0.5;

/**
 * He stops the wave: set, on his feet and not fooled, facing it, and no
 * further out than his set spot takes him (radius + SET_OFF + comeOutPx).
 * Unlike Max, he needs no sight of it coming.
 */
export function bracesWave(w: World, k: Keeper, wave: Wave): boolean {
  const { body } = k;
  const out = (body.x - keeperGoal(w.field, k.side).lineX) * pitchward(w.field, k.side);
  return (
    k.act === 'set' &&
    body.state === 'ground' &&
    body.fooled === null &&
    !body.inNet &&
    body.facing === -(wave.dirX >= 0 ? 1 : -1) &&
    out <= radiusOf(body) + SET_OFF + k.profile.comeOutPx + SET_SLACK_PX
  );
}

const profile = (p: KeeperProfile): KeeperProfile => p;

/**
 * He fills the goal: a big standing reach above LOW_Y and over the bar, a
 * catch of anything straight at him or high. He's slow to get down: no
 * reach in depth for a low ball standing, his dive's gloves reach one only
 * over getDownS, and he's slow up after a dive. He comes out big.
 * Mutable, so headless sweeps can try other numbers.
 */
export const GUS_PROFILES: Record<Difficulty, KeeperProfile> = {
  easy: profile({ reactionS: 0.23, speed: 104, posErrPx: 5, comeOutPx: 24, reachZ: 5, lowReachZ: 0, reachY: 52, diveTravel: 9, diveReach: 14, diveS: 0.44, getDownS: 0.36, catchSpeed: 440, holdOdds: 0.9, downS: 0.95, getUpS: 0.95, smotherAt: 28 }),
  normal: profile({ reactionS: 0.19, speed: 112, posErrPx: 3, comeOutPx: 26, reachZ: 6, lowReachZ: 0, reachY: 54, diveTravel: 10, diveReach: 20, diveS: 0.4, getDownS: 0.3, catchSpeed: 600, holdOdds: 1, downS: 0.8, getUpS: 0.8, smotherAt: 30 }),
  hard: profile({ reactionS: 0.16, speed: 120, posErrPx: 2, comeOutPx: 28, reachZ: 7, lowReachZ: 1, reachY: 56, diveTravel: 11, diveReach: 22, diveS: 0.36, getDownS: 0.25, catchSpeed: 640, holdOdds: 1, downS: 0.7, getUpS: 0.7, smotherAt: 32 }),
};

/** Eddie at tryout 8's Normal keeper, Gus at `d`. */
export function gusLineup(d: Difficulty): KeeperLineup {
  return { home: keeperProfile(KEEPER_TOP_LEVEL, 'normal'), away: GUS_PROFILES[d], gus: GUS };
}
