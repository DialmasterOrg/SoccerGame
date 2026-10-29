import { MAX_STAT_LEVEL, STAT_NAMES, type StatName } from '../game/stats';
import { POWER_MOVES, moveStatus } from './catalog';
import type { Profile } from './profile';

/** The goals that pay a style bonus: a trick goal is scored straight after a trick that fooled someone. The bicycle kick and other power moves join when they're built. */
export type StyleKind = 'header' | 'volley' | 'chip' | 'wave' | 'trick';

/** The kick a goal came from, or 'trick' for a trick goal. */
export type GoalKind = 'shot' | 'chip' | 'volley' | 'header' | 'wave' | 'trick';

/** One of Harrison's goals: the clock minute, the kick, and whether it was a perfect strike. */
export interface GoalRecord {
  minute: number;
  /** Null when no kick of his was still live when the ball crossed the line. */
  kind: GoalKind | null;
  perfect: boolean;
  /** The kick that scored was struck with the ball outside their penalty box. Always false without keepers. */
  outsideBox: boolean;
  /** That kick came within REBOUND_S of their keeper pushing the ball away. Always false without keepers. */
  rebound: boolean;
}

/** A finished match, from Harrison's side. */
export interface MatchSummary {
  result: 'win' | 'draw' | 'lose';
  goalsFor: number;
  goalsAgainst: number;
  /** One entry per style goal he scored, in any order. */
  styleGoals: readonly StyleKind[];
  /** Every goal he scored, in order. */
  goals: readonly GoalRecord[];
  /** His clean steals with the steal button, for the steals bonus. */
  steals: number;
}

/** One line of the Results tally, e.g. WIN +60. */
export interface RewardLine {
  label: string;
  coins: number;
}

export const RESULT_COINS = { win: 60, draw: 30, lose: 15 } as const;
export const GOAL_COINS = 10;
export const STYLE_COINS = 15;
export const CLEAN_SHEET_COINS = 20;
export const DAILY_WIN_COINS = 50;
export const LEVEL_UP_COINS = 50;

const RESULT_LABEL = { win: 'WIN', draw: 'DRAW', lose: 'LOSS' } as const;
const DAILY_WIN_LABEL = 'FIRST WIN TODAY';
const STYLE_ORDER: readonly StyleKind[] = ['header', 'volley', 'chip', 'wave', 'trick'];
const STYLE_LABEL: Record<StyleKind, [one: string, many: string]> = {
  header: ['HEADER', 'HEADERS'],
  volley: ['VOLLEY', 'VOLLEYS'],
  chip: ['CHIP', 'CHIPS'],
  wave: ['ENERGY WAVE', 'ENERGY WAVES'],
  trick: ['TRICK GOAL', 'TRICK GOALS'],
};

/** XP needed to go from `level` to the next: 100, then 50 more each level. */
const XP_BASE = 100;
const XP_STEP = 50;

/** Raising a stat from level L costs PRICE_BASE × PRICE_GROWTH^(L − 1), to the nearest PRICE_ROUND. */
const PRICE_BASE = 150;
const PRICE_GROWTH = 1.35;
const PRICE_ROUND = 5;

const counted = (n: number, [one, many]: readonly [string, string]) => (n === 1 ? one : `${n} ${many}`);

/** The reward lines for a match, in the order the Results screen shows them. */
export function matchLines(s: MatchSummary, dailyWin: boolean): RewardLine[] {
  const lines: RewardLine[] = [{ label: RESULT_LABEL[s.result], coins: RESULT_COINS[s.result] }];
  if (s.goalsFor > 0) lines.push({ label: counted(s.goalsFor, ['1 GOAL', 'GOALS']), coins: s.goalsFor * GOAL_COINS });
  for (const kind of STYLE_ORDER) {
    const n = s.styleGoals.filter(k => k === kind).length;
    if (n > 0) lines.push({ label: counted(n, STYLE_LABEL[kind]), coins: n * STYLE_COINS });
  }
  if (s.goalsAgainst === 0) lines.push({ label: 'CLEAN SHEET', coins: CLEAN_SHEET_COINS });
  if (dailyWin) lines.push({ label: DAILY_WIN_LABEL, coins: DAILY_WIN_COINS });
  return lines;
}

/** A match's XP: its coins without the daily bonus. */
export function matchXp(lines: readonly RewardLine[]): number {
  return lines.reduce((sum, l) => (l.label === DAILY_WIN_LABEL ? sum : sum + l.coins), 0);
}

export function xpToNext(level: number): number {
  return XP_BASE + XP_STEP * (level - 1);
}

/** Adds XP, carrying any extra over, as many levels as it reaches. */
export function addXp(level: number, xp: number, gain: number): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let x = xp + gain;
  while (x >= xpToNext(l)) {
    x -= xpToNext(l);
    l++;
  }
  return { level: l, xp: x, levelsGained: l - level };
}

/** Coins to raise a stat from `level` to the next, or null when it's maxed. */
export function statPrice(level: number): number | null {
  if (level >= MAX_STAT_LEVEL) return null;
  return Math.round((PRICE_BASE * PRICE_GROWTH ** (level - 1)) / PRICE_ROUND) * PRICE_ROUND;
}

/** The price of the cheapest upgrade left, or null when every stat is maxed. */
export function cheapestUpgrade(p: Profile): number | null {
  const prices = STAT_NAMES.map(k => statPrice(p.stats[k])).filter((c): c is number => c !== null);
  return prices.length ? Math.min(...prices) : null;
}

/** He can afford at least one upgrade now: a stat, or the Energy Wave once it's unlocked. */
export function canUpgrade(p: Profile): boolean {
  const cheapest = cheapestUpgrade(p);
  if (cheapest !== null && p.coins >= cheapest) return true;
  return moveStatus(p, 'energyWave') === 'buy' && p.coins >= POWER_MOVES.energyWave.price;
}

/** The profile after buying one level of `stat`, or null when it's maxed or he can't afford it. Never changes `p`. */
export function buyStat(p: Profile, stat: StatName): Profile | null {
  const price = statPrice(p.stats[stat]);
  if (price === null || p.coins < price) return null;
  return { ...p, coins: p.coins - price, stats: { ...p.stats, [stat]: p.stats[stat] + 1 }, totals: { ...p.totals } };
}

export const STAT_INFO: Record<StatName, { label: string; blurb: string }> = {
  speed: { label: 'SPEED', blurb: 'RUN AND SPRINT FASTER' },
  power: { label: 'POWER', blurb: 'HARDER SHOTS, QUICKER CHARGE' },
  jump: { label: 'JUMP', blurb: 'JUMP HIGHER FOR HEADERS' },
  control: { label: 'CONTROL', blurb: 'KEEP THE BALL CLOSE' },
  stamina: { label: 'STAMINA', blurb: 'SPRINT LONGER, GET YOUR BREATH BACK FASTER' },
};
