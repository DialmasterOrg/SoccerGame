import { describe, expect, it } from 'vitest';
import { maxStats } from '../meta/ladder';
import { DIFFICULTY, createBrain, think, type Difficulty } from './ai';
import { BALL_REST_Y } from './ball';
import { CREW_PROFILES, CREW_STATS, type CrewId } from './crew';
import { NO_INTENT, NORMAL_HANDLING } from './player';
import { opponentHandling, opponentProfile, opponentStats, trickSetup, type HumanOpponentId } from './opponents';
import { DOG_TRICKS, TRICK_DIFFICULTY, TRICK_SCALE } from './tricks';
import { SAM_HANDLING, SAM_PROFILES, SAM_STATS } from './sam';
import { cleanStealOdds } from './steal';
import { BASE_STATS } from './stats';
import { TUNING_STATS } from './dog';
import { SAM_TUNING_STATS } from './samScripts';
import { TRYOUT_PROFILES, TRYOUT_STATS } from './tryouts';
import { createWorld, placeForKickoff, stepWorld } from './world';

const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];
const CREW: readonly CrewId[] = ['brick', 'leo', 'tia', 'pete'];
const STEP = 1 / 60;

describe('opponents', () => {
  it('Max goes through the ladder, as today', () => {
    expect(opponentStats('max', 7)).toEqual(maxStats(7));
    for (const d of DIFFS) expect(opponentProfile('max', d)).toBe(DIFFICULTY[d]);
  });

  it('Max and Tia come back at their School stats and profiles at the School, and only there', () => {
    expect(opponentStats('max', 1, 'school')).toEqual(TRYOUT_STATS.max);
    expect(opponentStats('max', 0, 'school')).toEqual(TRYOUT_STATS.max); // Gus's slot, standing in until plan 5
    expect(opponentStats('max', 7, 'backyard')).toEqual(maxStats(7));
    expect(opponentStats('max', 7)).toEqual(maxStats(7));
    expect(opponentStats('tia', 5, 'school')).toEqual(TRYOUT_STATS.tia);
    expect(opponentStats('tia', 3, 'park')).toEqual(CREW_STATS.tia);
    expect(opponentStats('max', 1, 'school')).not.toBe(TRYOUT_STATS.max);
    for (const d of DIFFS) {
      expect(opponentProfile('max', d, 'school')).toBe(TRYOUT_PROFILES.max[d]);
      expect(opponentProfile('max', d)).toBe(DIFFICULTY[d]);
      expect(opponentProfile('tia', d, 'school')).toBe(TRYOUT_PROFILES.tia[d]);
      expect(opponentProfile('tia', d, 'park')).toBe(CREW_PROFILES.tia[d]);
      expect(opponentProfile('leo', d, 'school')).toBe(CREW_PROFILES.leo[d]);
    }
  });

  it('each crew kid plays at their own stats, whatever the rung', () => {
    expect(CREW_STATS).toEqual({
      brick: { speed: 3, power: 4, jump: 2, control: 4, stamina: 1 },
      leo: { speed: 4, power: 6, jump: 2, control: 3, stamina: 1 },
      tia: { speed: 5, power: 3, jump: 2, control: 6, stamina: 1 },
      pete: { speed: 6, power: 4, jump: 3, control: 4, stamina: 1 },
    });
    for (const id of CREW) expect(opponentStats(id, 3)).toEqual(CREW_STATS[id]);
  });

  it('every opponent is at Stamina 1', () => {
    const all = [
      ...Array.from({ length: 10 }, (_, i) => maxStats(i + 1)),
      ...CREW.map(id => CREW_STATS[id]),
      SAM_STATS,
      TUNING_STATS,
      SAM_TUNING_STATS,
    ];
    for (const s of all) expect(s.stamina, JSON.stringify(s)).toBe(1);
  });

  it("each crew profile has its kid's style, and keeps Max's Energy Wave answers", () => {
    const styles = { brick: 'blocker', leo: 'shooter', tia: 'dribbler', pete: 'presser' } as const;
    for (const id of CREW)
      for (const d of DIFFS) {
        const p = opponentProfile(id, d);
        expect(p, `${id} ${d}`).toBe(CREW_PROFILES[id][d]);
        expect(p.style, `${id} ${d}`).toBe(styles[id]);
        expect([p.braceSense, p.backOffS], `${id} ${d}`).toEqual([DIFFICULTY[d].braceSense, DIFFICULTY[d].backOffS]);
      }
  });

  it("every Easy number is gentler than Normal's, and Normal's than Hard's", () => {
    for (const id of CREW) {
      const [e, n, h] = DIFFS.map(d => CREW_PROFILES[id][d]);
      for (const k of ['reactionS', 'aimErrorDeg', 'cleanSteal', 'wrongFootedS'] as const) {
        expect(e![k], `${id} ${k}`).toBeGreaterThanOrEqual(n![k]);
        expect(n![k], `${id} ${k}`).toBeGreaterThanOrEqual(h![k]);
      }
      for (const k of ['paceFactor', 'aggression'] as const) {
        expect(e![k], `${id} ${k}`).toBeLessThanOrEqual(n![k]);
        expect(n![k], `${id} ${k}`).toBeLessThanOrEqual(h![k]);
      }
    }
  });

  it('Sam plays as himself, with his own stats, profiles and handling: no stand-in', () => {
    expect(opponentStats('sam', 1)).toEqual(SAM_STATS);
    expect(SAM_STATS).toEqual({ speed: 10, power: 1, jump: 3, control: 3, stamina: 1 });
    expect(opponentStats('sam', 1)).not.toEqual(CREW_STATS.pete);
    for (const d of DIFFS) {
      expect(opponentProfile('sam', d)).toBe(SAM_PROFILES[d]);
      expect(opponentProfile('sam', d)).not.toBe(CREW_PROFILES.pete[d]);
      expect(opponentProfile('sam', d).style).toBe('speedster');
    }
    expect(opponentHandling('sam')).toBe(SAM_HANDLING);
  });

  it('everyone else handles normally', () => {
    for (const id of ['max', ...CREW] as const) expect(opponentHandling(id), id).toBe(NORMAL_HANDLING);
  });

  it("Sam's profiles keep Max's Energy Wave answers, and every Easy number is gentler than Normal's, Normal's than Hard's", () => {
    for (const d of DIFFS) expect([SAM_PROFILES[d].braceSense, SAM_PROFILES[d].backOffS], d).toEqual([DIFFICULTY[d].braceSense, DIFFICULTY[d].backOffS]);
    const [e, n, h] = DIFFS.map(d => SAM_PROFILES[d]);
    for (const k of ['reactionS', 'cleanSteal', 'wrongFootedS', 'rangeShot'] as const) {
      expect(e![k], k).toBeGreaterThanOrEqual(n![k]!);
      expect(n![k], k).toBeGreaterThanOrEqual(h![k]!);
    }
    expect(e!.paceFactor).toBeLessThanOrEqual(n!.paceFactor);
    expect(n!.paceFactor).toBeLessThanOrEqual(h!.paceFactor);
  });
});

describe('the fair rules hold against Leo with no new code', () => {
  const leoWorld = (d: Difficulty) => createWorld(BASE_STATS, CREW_STATS.leo, 1, { home: 0, away: 0 }, null, null, CREW_PROFILES.leo[d]);

  it("a steal tap on his ball uses Leo's own clean-steal odds", () => {
    for (const d of DIFFS) expect(cleanStealOdds(leoWorld(d))).toBeCloseTo(CREW_PROFILES.leo[d].cleanSteal, 9);
  });

  it('Harrison running at his own goal with the ball in the keep-out zone shields it', () => {
    const w = leoWorld('normal');
    w.match.phase = 'playing';
    const z = w.field.depth / 2;
    Object.assign(w.home, { x: 100, z, vx: -100, facing: -1 });
    Object.assign(w.ball, { x: 92, y: BALL_REST_Y, z, vx: -100, vy: 0, vz: 0 });
    Object.assign(w.away, { x: 300, z: 10 });
    for (let i = 0; i < 40; i++) {
      stepWorld(w, { ...NO_INTENT, moveX: -1 }, NO_INTENT, STEP);
      expect(w.home.x - w.ball.x, `tick ${i}`).toBeLessThanOrEqual(16);
      expect(w.events.goal, `tick ${i}`).toBeNull();
    }
  });

  it("at Harrison's kickoff Leo waits on his own kickoff spot, and holds it", () => {
    for (const d of DIFFS) {
      const w = leoWorld(d);
      w.match.kickoffTeam = 'home';
      placeForKickoff(w);
      const spot = CREW_PROFILES.leo[d].kickoffSpot;
      expect([w.away.x, w.away.z], d).toEqual([w.field.width / 2 + spot.back, w.field.depth / 2 + spot.off]);
      const brain = createBrain(CREW_PROFILES.leo[d]);
      think(brain, w, w.away, w.home, STEP);
      w.match.phase = 'playing';
      const held = think(brain, w, w.away, w.home, STEP);
      expect([held.moveX, held.moveZ], d).toEqual([0, 0]);
    }
  });
});

describe('trickSetup', () => {
  const IDS: HumanOpponentId[] = ['max', 'brick', 'leo', 'tia', 'pete', 'sam'];
  const DS: Difficulty[] = ['easy', 'normal', 'hard'];

  it("gives each human opponent the difficulty's window and times, scaled by their style", () => {
    for (const id of IDS)
      for (const d of DS) {
        const setup = trickSetup(d, id);
        expect(setup.profile, `${id} ${d}`).toBe(TRICK_DIFFICULTY[d]);
        expect(setup.scale, `${id} ${d}`).toBe(TRICK_SCALE[opponentProfile(id, d).style]);
      }
  });

  it('scales Brick, Tia and Pete their own way, and Max, Leo and Sam not at all', () => {
    const scale = (id: HumanOpponentId) => trickSetup('normal', id).scale;
    expect(scale('brick')).toEqual({ stepover: 0.3, flick: 1.2 });
    expect(scale('tia')).toEqual({ stepover: 0.6, flick: 0.6 });
    expect(scale('pete')).toEqual({ stepover: 1.5, flick: 1.5 });
    for (const id of ['max', 'leo', 'sam'] as const) expect(scale(id)).toEqual({ stepover: 1, flick: 1 });
  });

  it("gives Biscuit the dog's own window and times, unscaled", () => {
    for (const d of DS) expect(trickSetup(d, 'biscuit')).toEqual({ profile: DOG_TRICKS[d], scale: { stepover: 1, flick: 1 } });
    expect(trickSetup('normal', 'biscuit').profile).toBe(DOG_TRICKS.normal);
  });
});
