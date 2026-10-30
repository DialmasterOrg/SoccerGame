import { describe, expect, it } from 'vitest';
import { LADDER_MATCHES, maxStats } from '../meta/ladder';
import { DIFFICULTIES, DIFFICULTY } from './ai';
import { CREW_PROFILES, CREW_STATS } from './crew';
import { STAT_NAMES, type Stats } from './stats';
import { TRYOUT_ORDER, TRYOUT_PROFILES, TRYOUT_STATS } from './tryouts';
import { GUS_PARTNER_PROFILES } from './gus';

const total = (s: Stats) => s.speed + s.power + s.jump + s.control;
const PLAYED = ['speed', 'power', 'jump', 'control'] as const;

describe('the tryouts cast', () => {
  it('each kid is a little stronger overall than the one before, and Max starts above rung 10', () => {
    const totals = TRYOUT_ORDER.map(id => total(TRYOUT_STATS[id]));
    totals.slice(1).forEach((t, i) => expect(t, TRYOUT_ORDER[i + 1]).toBe(totals[i]! + 1));
    expect(totals[0]).toBeGreaterThan(total(maxStats(LADDER_MATCHES)));
  });

  it('every kid but Max has one standout stat', () => {
    for (const id of TRYOUT_ORDER.slice(1)) {
      const s = TRYOUT_STATS[id];
      const top = Math.max(...PLAYED.map(k => s[k]));
      expect(PLAYED.filter(k => s[k] === top), id).toHaveLength(1);
    }
  });

  it('Max and Tia are tougher than before: no stat lower, the total higher', () => {
    const before = { max: maxStats(LADDER_MATCHES), tia: CREW_STATS.tia };
    for (const id of ['max', 'tia'] as const) {
      for (const k of PLAYED) expect(TRYOUT_STATS[id][k], `${id} ${k}`).toBeGreaterThanOrEqual(before[id][k]);
      expect(total(TRYOUT_STATS[id]), id).toBeGreaterThan(total(before[id]));
    }
  });

  it('everyone plays at Stamina 1', () => {
    for (const id of TRYOUT_ORDER) {
      expect(TRYOUT_STATS[id].stamina, id).toBe(1);
      expect(Object.keys(TRYOUT_STATS[id]).sort(), id).toEqual([...STAT_NAMES].sort());
    }
  });

  it("every Easy dial is gentler than Normal's, and Normal's than Hard's, Gus's partner's too", () => {
    const gentlerHigh = ['reactionS', 'aimErrorDeg', 'backOffS', 'cleanSteal', 'wrongFootedS'] as const;
    const harderHigh = ['aggression', 'braceSense', 'paceFactor'] as const;
    const all = [...TRYOUT_ORDER.map(id => [id, TRYOUT_PROFILES[id]] as const), ['gus partner', GUS_PARTNER_PROFILES] as const];
    for (const [id, { easy: e, normal: n, hard: h }] of all) {
      for (const k of gentlerHigh) expect([e[k] >= n[k], n[k] >= h[k]], `${id} ${k}`).toEqual([true, true]);
      for (const k of harderHigh) expect([e[k] <= n[k], n[k] <= h[k]], `${id} ${k}`).toEqual([true, true]);
    }
  });

  it('the School profiles are their own objects, so tuning them never moves the Backyard or the Park', () => {
    for (const d of DIFFICULTIES) {
      expect(TRYOUT_PROFILES.max[d]).not.toBe(DIFFICULTY[d]);
      expect(TRYOUT_PROFILES.tia[d]).not.toBe(CREW_PROFILES.tia[d]);
      expect(TRYOUT_PROFILES.tia[d].style).toBe('dribbler');
    }
    const all = TRYOUT_ORDER.flatMap(id => DIFFICULTIES.map(d => TRYOUT_PROFILES[id][d]));
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all.map(p => p.kickoffSpot)).size).toBe(all.length);
  });
});
