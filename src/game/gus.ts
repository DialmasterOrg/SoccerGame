import { GUS_HANDS } from '../art/keepers/gus';
import type { CareerMatch } from '../meta/career';
import { ALL_ROUND, type AiProfile, type Difficulty } from './ai';
import { KEEPER_TOP_LEVEL, SET_OFF, keeperGoal, keeperLevel, keeperLineup, keeperProfile, pitchward, type Keeper, type KeeperLineup, type KeeperProfile } from './keeper';
import { radiusOf } from './player';
import type { Point } from '../art/raster';
import type { Stats } from './stats';
import { profiles } from './tryouts';
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
 * over getDownS, and he's slow up after a dive. He comes out big, and
 * commits to his smother late (smotherAt 22), so a stepover beats him.
 * He reads a shot quicker than any keeper (so a long one never beats him),
 * but getting down to a low one still takes him getDownS.
 * Tuned by gusTuning and gusDrills on GUS_SEEDS against the blaster and the
 * worker at GUS_TUNING_STATS (2026-10-29). Measured: the worker wins
 * E .781 N .641 H .422, the blaster E .375 N .141 H .016; on Normal the
 * worker's goals are all low; the high drill is saved
 * 64/64 on every difficulty, low corners go in E .667 N .490 H .260, a
 * one-on-one stepping over him E .938 N .882 (on Hard his dive smothers
 * even that); no slow roller ever goes in.
 * Mutable, so headless sweeps can try other numbers.
 */
export const GUS_PROFILES: Record<Difficulty, KeeperProfile> = {
  easy: profile({ reactionS: 0.1, speed: 104, posErrPx: 5, comeOutPx: 24, reachZ: 5, lowReachZ: 0, reachY: 52, diveTravel: 9, diveReach: 18, diveS: 0.44, getDownS: 0.3, catchSpeed: 440, holdOdds: 0.9, downS: 1.2, getUpS: 1.2, smotherAt: 22 }),
  normal: profile({ reactionS: 0.08, speed: 112, posErrPx: 3, comeOutPx: 26, reachZ: 10, lowReachZ: 0, reachY: 54, diveTravel: 10, diveReach: 20, diveS: 0.4, getDownS: 0.26, catchSpeed: 600, holdOdds: 1, downS: 1, getUpS: 1, smotherAt: 22 }),
  hard: profile({ reactionS: 0.08, speed: 120, posErrPx: 2, comeOutPx: 28, reachZ: 10, lowReachZ: 1, reachY: 56, diveTravel: 11, diveReach: 22, diveS: 0.36, getDownS: 0.22, catchSpeed: 640, holdOdds: 1, downS: 0.9, getUpS: 0.9, smotherAt: 22 }),
};

/** Eddie at tryout 8's Normal keeper, Gus at `d`. */
export function gusLineup(d: Difficulty): KeeperLineup {
  return { home: keeperProfile(KEEPER_TOP_LEVEL, 'normal'), away: GUS_PROFILES[d], gus: GUS };
}

/** BACKUP MO, playing out of position. */
export const GUS_PARTNER_STATS: Readonly<Stats> = { speed: 3, power: 3, jump: 2, control: 3, stamina: 1 };

/**
 * The all-round dials, a touch slower (paceFactor 0.85 / 0.97 / 1.05), and on Normal
 * and Hard harder to rob (cleanSteal 0.5 / 0.4), so Harrison has to work
 * for the ball he has most of the match. Tuned with GUS_PROFILES (see there),
 * and retuned for close control (2026-10-30): the worker / blaster now win
 * E 0.813 / 0.391, N 0.625 / 0.125, H 0.406 / 0.063.
 * Mutable, so headless sweeps can try other numbers.
 */
export const GUS_PARTNER_PROFILES: Record<Difficulty, AiProfile> = profiles(ALL_ROUND, {
  // Close control (2026-10-30): Easy reactionS 0.22 → 0.2 (the worker beats the blaster by 0.3 again).
  easy: { paceFactor: 0.85, cleanSteal: 0.9, reactionS: 0.2 },
  // Close control (2026-10-30): Normal paceFactor 0.95 → 0.97, reactionS 0.16 → 0.17.
  normal: { paceFactor: 0.97, cleanSteal: 0.5, reactionS: 0.17 },
  // Close control (2026-10-30): Hard paceFactor 0.95 → 1.05.
  hard: { paceFactor: 1.05, cleanSteal: 0.4 },
});

type LineupMatch = Pick<CareerMatch, 'kind' | 'rung' | 'opponent'>;

/** A match's keepers: Gus's lineup for his match, every other at its level. */
export function lineupFor(m: LineupMatch, d: Difficulty): KeeperLineup {
  return m.opponent === 'gus' ? gusLineup(d) : keeperLineup(keeperLevel(m), d);
}

/** Their keeper's profile at `d`: what a difficulty change gives him mid-match. */
export const awayKeeperProfile = (m: LineupMatch, d: Difficulty): KeeperProfile => lineupFor(m, d).away;
