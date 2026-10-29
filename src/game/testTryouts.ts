import { createBrain, think, type AiBrain, type AiProfile, type Difficulty } from './ai';
import { keeperLineup } from './keeper';
import { harrisonStatsFor } from './maxScripts';
import { NORMAL_HANDLING, NO_INTENT, type PlayerIntent } from './player';
import { SCHOOL_STAGE } from './stage';
import { tryoutLevel } from './tryoutScripts';
import { TRYOUT_PROFILES, TRYOUT_STATS, type TryoutOpponent } from './tryouts';
import { createWorld, stepWorld, type World } from './world';

const DT = 1 / 60;

/**
 * A School world in play at `level` (default the kid's tryout) with `id`'s
 * brain on the away side, Harrison a level up on its stats; `asMax`: School
 * Max's Normal brain at the kid's stats; `profile`: this brain instead;
 * `power`: Harrison owns the wave.
 */
export function kidWorld(id: TryoutOpponent, o: { level?: number; d?: Difficulty; seed?: number; asMax?: boolean; profile?: AiProfile; power?: boolean } = {}): { w: World; brain: AiBrain } {
  const d = o.d ?? 'normal';
  const profile = o.profile ?? (o.asMax ? TRYOUT_PROFILES.max.normal : TRYOUT_PROFILES[id][d]);
  const stats = TRYOUT_STATS[id];
  const w = createWorld(harrisonStatsFor(stats), { ...stats }, o.seed ?? 1, { home: 0, away: profile.aimErrorDeg }, o.power ? { golden: false } : null, null, profile, NORMAL_HANDLING, null, SCHOOL_STAGE, keeperLineup(o.level ?? tryoutLevel(id), d));
  w.match.phase = 'playing';
  return { w, brain: createBrain(profile) };
}

/** Steps `s` seconds: the kid's brain on the away side, Harrison by `home` (still by default). */
export function stepKid(w: World, brain: AiBrain, s: number, home?: PlayerIntent | ((w: World) => PlayerIntent)): void {
  for (let i = 0; i < Math.round(s / DT); i++) {
    const h = typeof home === 'function' ? home(w) : (home ?? NO_INTENT);
    stepWorld(w, h, think(brain, w, w.away, w.home, DT), DT);
  }
}
