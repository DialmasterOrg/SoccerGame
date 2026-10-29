import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from './ai';
import { resolveAll } from './bodies';
import { KEEPER_TOP_LEVEL, SET_OFF, keeperLevel, keeperLineup, keeperProfile, type KeeperProfile } from './keeper';
import { NO_INTENT, NORMAL_HANDLING, PLAYER_R } from './player';
import { SCHOOL_STAGE } from './stage';
import { BASE_STATS } from './stats';
import { keeperWorld, runFor } from './testKeepers';
import { createWorld } from './world';

const BETTER: Partial<Record<keyof KeeperProfile, 1 | -1>> = {
  reactionS: -1, speed: 1, posErrPx: -1, reachZ: 1, reachY: 1, diveTravel: 1, diveReach: 1, diveS: -1, catchSpeed: 1, holdOdds: 1, downS: -1, getUpS: -1,
};

describe('keeper profiles', () => {
  it('get sharper from Easy to Normal to Hard, and through the levels', () => {
    for (const [dial, sign] of Object.entries(BETTER) as [keyof KeeperProfile, 1 | -1][]) {
      for (let l = 1; l <= KEEPER_TOP_LEVEL; l++) {
        const [e, n, h] = DIFFICULTIES.map(d => keeperProfile(l, d)[dial] * sign);
        expect(e, `${dial} at ${l}`).toBeLessThanOrEqual(n!);
        expect(n, `${dial} at ${l}`).toBeLessThanOrEqual(h!);
      }
      for (const d of DIFFICULTIES) expect(keeperProfile(1, d)[dial] * sign, `${dial} ${d}`).toBeLessThanOrEqual(keeperProfile(KEEPER_TOP_LEVEL, d)[dial] * sign);
    }
  });

  it("Harrison's keeper is the match level's Normal keeper on any difficulty", () => {
    for (const d of DIFFICULTIES) expect(keeperLineup(3, d)).toEqual({ home: keeperProfile(3, 'normal'), away: keeperProfile(3, d) });
  });

  it('a tryout plays at its number; the boss at the top level', () => {
    expect(keeperLevel({ kind: 'match', rung: 5 })).toBe(5);
    expect(keeperLevel({ kind: 'boss', rung: 0 })).toBe(KEEPER_TOP_LEVEL);
  });
});

describe('keepers in the world', () => {
  it('kick off set in front of each goal, facing the pitch', () => {
    const { home, away } = keeperWorld().keepers!;
    expect([home.body.x, home.body.z, home.body.facing]).toEqual([40 + PLAYER_R + SET_OFF, 64, 1]);
    expect([away.body.x, away.body.z, away.body.facing]).toEqual([1240 - PLAYER_R - SET_OFF, 64, -1]);
  });

  it('a world without a lineup has none', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 3, { home: 4, away: 6 }, null, null, null, NORMAL_HANDLING, null, SCHOOL_STAGE);
    expect(w.keepers).toBeNull();
  });

  it("each keeper's area is his goal's penalty box", () => {
    expect(keeperWorld().keepers!.away.body.area).toEqual({ x0: 1130, x1: 1240, z0: 10, z1: 118 });
  });

  it('players cannot walk through a keeper', () => {
    const w = keeperWorld();
    Object.assign(w.home, { x: 1180, z: 64 });
    runFor(w, 1, { ...NO_INTENT, moveX: 1 });
    expect(w.keepers!.away.body.x - w.home.x).toBeGreaterThanOrEqual(2 * PLAYER_R - 1e-6);
  });

  it('his body is kept inside his box', () => {
    const w = keeperWorld();
    const k = w.keepers!.away.body;
    Object.assign(k, { x: 1120, z: 5 });
    resolveAll([w.home, w.away, w.keepers!.home.body, k], w.field);
    expect([k.x, k.z]).toEqual([1130, 10]);
  });
});
