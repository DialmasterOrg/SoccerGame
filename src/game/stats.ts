import { GRAVITY } from './constants';

/** Levels 1..10. */
export interface Stats {
  speed: number;
  power: number;
  jump: number;
  control: number;
  stamina: number;
}

export type StatName = keyof Stats;

export const STAT_NAMES: readonly StatName[] = ['speed', 'power', 'jump', 'control', 'stamina'];

export const BASE_STATS: Stats = { speed: 1, power: 1, jump: 1, control: 1, stamina: 1 };

export const MIN_STAT_LEVEL = 1,
  MAX_STAT_LEVEL = 10;

/** Linear from `atMin` at level 1 to `atMax` at level 10, with the level clamped. */
function curve(level: number, atMin: number, atMax: number): number {
  const t = (Math.min(Math.max(level, MIN_STAT_LEVEL), MAX_STAT_LEVEL) - MIN_STAT_LEVEL) / (MAX_STAT_LEVEL - MIN_STAT_LEVEL);
  return atMin + (atMax - atMin) * t;
}

/** px/s. */
export const runSpeed = (s: Stats): number => curve(s.speed, 95, 135);
export const SPRINT_MULTIPLIER = 1.45;
/** Take-off speed for a jump apex of 32 px (level 1) to 48 px (level 10, about 1.2× his height). */
export const jumpVelocity = (s: Stats): number => Math.sqrt(2 * GRAVITY * curve(s.jump, 32, 48));
/** px/s at full charge. */
export const maxShotSpeed = (s: Stats): number => curve(s.power, 430, 640);
/** Seconds to full charge. */
export const chargeTime = (s: Stats): number => curve(s.power, 0.9, 0.6);
/** How hard a dribble touch pushes the ball ahead of him, px/s: better control keeps it closer. */
export const touchPush = (s: Stats): number => curve(s.control, 60, 25);
/** The chance a hard (90°) cut with the ball at a run gives it away: better control keeps it more often. */
export const turnRisk = (s: Stats): number => curve(s.control, 0.25, 0.06);
/** Sprint spent per second: a full bar lasts 2 s at level 1, 4 s at level 10. */
export const staminaDrain = (s: Stats): number => curve(s.stamina, 0.5, 0.25);
/** Sprint won back per second, not sprinting. */
export const staminaRegen = (s: Stats): number => curve(s.stamina, 0.3, 0.45);
