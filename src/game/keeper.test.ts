import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from './ai';
import { resolveAll } from './bodies';
import { HOLD_S, KEEPER_TOP_LEVEL, PUNT_STRIKE_S, SET_OFF, keeperLevel, keeperLineup, keeperProfile, parkHeldBall, quietKeepers, startHold, stepKeeper, type Keeper, type KeeperProfile, type KeeperSide, type Strike } from './keeper';
import { startDragBack } from './dragBack';
import { GUS_PROFILES } from './gus';
import { POWERED_S, WAVE_READY_S, canFireWave, canStartPower } from './power';
import { resolveSteal } from './steal';
import { startTrick } from './tricks';
import { fireWave } from './wave';
import { NO_INTENT, NORMAL_HANDLING, PLAYER_R } from './player';
import { SCHOOL_STAGE } from './stage';
import { BASE_STATS } from './stats';
import { keeperWorld, runFor, runUntil, setBall, shotAt } from './testKeepers';
import { createWorld, placeForKickoff, type World } from './world';
import { REACH_Z } from './zones';

const BETTER: Partial<Record<keyof KeeperProfile, 1 | -1>> = {
  reactionS: -1, speed: 1, posErrPx: -1, reachZ: 1, lowReachZ: 1, reachY: 1, diveTravel: 1, diveReach: 1, diveS: -1, getDownS: -1, catchSpeed: 1, holdOdds: 1, downS: -1, getUpS: -1,
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

  it('every level keeper gets down to a low ball as to any: lowReachZ is his reachZ, getDownS 0', () => {
    for (const d of DIFFICULTIES) {
      for (let l = 1; l <= KEEPER_TOP_LEVEL; l++) {
        const p = keeperProfile(l, d);
        expect([p.lowReachZ, p.getDownS], `${d} ${l}`).toEqual([p.reachZ, 0]);
      }
    }
  });

  it("Gus's profiles get sharper from Easy to Normal to Hard", () => {
    for (const [dial, sign] of Object.entries(BETTER) as [keyof KeeperProfile, 1 | -1][]) {
      const [e, n, h] = DIFFICULTIES.map(d => GUS_PROFILES[d][dial] * sign);
      expect(e, dial).toBeLessThanOrEqual(n!);
      expect(n, dial).toBeLessThanOrEqual(h!);
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

/** Rolls a slow ball at the away keeper (always held) and steps until he holds it. */
function caught(w: World): Keeper {
  runFor(w, 1);
  shotAt(w, { x: 1180, z: 64 }, 64, 200);
  runUntil(w, 1, w => w.events.keeper.caught === 'away');
  return w.keepers!.away;
}

/** Where the ball first bounces after the next drop kick. */
function firstBounce(w: World): { x: number; z: number } {
  runUntil(w, HOLD_S + 1, w => w.events.keeper.punted !== null);
  runUntil(w, 4, w => w.events.ball.bounced);
  return { x: w.ball.x, z: w.ball.z };
}

/** Both outfielders parked at the far touchline near halfway; a firm ball rolled at this keeper; goals over 8 s after his punt. */
function goalsAfterPunt(w: World, side: KeeperSide): number {
  Object.assign(w.home, { x: 600, z: 120 });
  Object.assign(w.away, { x: 680, z: 120 });
  runFor(w, 0.5);
  const goal = side === 'home' ? 'left' : 'right';
  shotAt(w, { x: side === 'home' ? 150 : 1130, z: 64 }, 64, 210, 0, goal);
  if (!runUntil(w, HOLD_S + 3, w => w.events.keeper.punted === side)) throw new Error(`${side} never punted`);
  let goals = 0;
  runUntil(w, 8, w => {
    if (w.events.goal) goals++;
    return false;
  });
  return goals;
}

describe('the hold and the drop kick', () => {
  it('he holds a catch still for 1.5 s, then drop-kicks it upfield', () => {
    const w = keeperWorld();
    const k = caught(w);
    const at = [k.body.x, k.body.z];
    expect(runUntil(w, HOLD_S - 0.05, w => w.events.keeper.punted !== null)).toBe(false);
    expect([k.body.x, k.body.z]).toEqual(at);
    expect(runUntil(w, PUNT_STRIKE_S + 0.15, w => w.events.keeper.punted === 'away')).toBe(true);
    expect(w.ball.vx).toBeLessThan(0);
    expect(w.ball.vy).toBeGreaterThan(0);
  });

  it('the drop kick lands a little short of halfway, on his own side of it', () => {
    // The away keeper attacks the left goal: halfway is 640, and his own side is beyond it. Shortened at the parent's ask (2026-10-29): it used to carry past halfway.
    const bounces: number[] = [];
    for (let seed = 1; seed <= 64; seed++) {
      const w = keeperWorld({ seed });
      caught(w);
      const at = firstBounce(w);
      bounces.push(at.x);
      expect(at.x, `seed ${seed}`).toBeGreaterThanOrEqual(640 - 10);
      expect(at.x, `seed ${seed}`).toBeLessThanOrEqual(640 + 220);
    }
    expect(bounces.filter(x => x > 640).length).toBeGreaterThan(48); // usually short of the line
  });

  it('a drop kick never scores, from either keeper', () => {
    for (let seed = 1; seed <= 64; seed++) for (const side of ['home', 'away'] as const) {
      const w = keeperWorld({ seed });
      expect(goalsAfterPunt(w, side), `${side} seed ${seed}`).toBe(0);
    }
  });

  // Review focus 3
  it('a climbing drop kick clears Harrison, pressed against the keeper or standing where it climbs', () => {
    for (const gap of [2 * PLAYER_R, 20, 28, 36]) {
      const w = keeperWorld();
      const k = caught(w);
      Object.assign(w.home, { x: k.body.x - gap, z: k.body.z, facing: 1 });
      let blocked = false;
      // The hold, the drop and about 1.2 s in the air.
      runUntil(w, HOLD_S + 3, w => {
        blocked ||= w.events.kicks[0]?.blocked || w.events.kicks[0]?.touched || w.events.kicks[0]?.kicked !== null;
        return w.events.ball.bounced && w.keepers!.punt === null;
      });
      expect(blocked, `gap ${gap}`).toBe(false);
      expect(w.ball.x, `gap ${gap}`).toBeLessThan(640 + 60);
    }
  });

  // Review focus 2
  it('a kickoff clears every hold, dive and drop kick', () => {
    const w = keeperWorld();
    caught(w);
    stepKeeper(w, w.keepers!.home, { move: NO_INTENT, dive: { dirX: 0, dirZ: 1 } }, true, 1 / 60, quietKeepers());
    w.keepers!.punt = 'away';
    placeForKickoff(w);
    for (const k of [w.keepers!.home, w.keepers!.away]) expect([k.act, k.holding, k.dive]).toEqual(['set', false, null]);
    expect(w.keepers!.punt).toBeNull();
  });
});

describe('a ball a keeper has is out of play for Harrison', () => {
  /** Harrison on a ball his keeper or theirs has, with his meter full, his tricks, and the ball low at his feet. */
  function onTheirBall(w: World): void {
    w.power!.meter = 1;
    Object.assign(w.home, { x: w.ball.x - 8, z: w.ball.z, facing: 1, vx: 0, vz: 0 });
  }

  it('caught in a dive, on the grass by his gloves: no power-up, wave, trick, drag-back or steal', () => {
    const w = keeperWorld({ power: true, tricks: true });
    runFor(w, 1);
    const k = w.keepers!.away;
    Object.assign(k, { act: 'down', actT: 0, holding: true, dive: { dirX: 0, dirZ: 1 } });
    parkHeldBall(w);
    onTheirBall(w);
    expect(canStartPower(w)).toBe(false);
    expect(startTrick(w, { ...NO_INTENT, trick: 'stepover' })).toBeNull();
    expect(startDragBack(w, { ...NO_INTENT, moveX: -1 })).toBe(false);
    w.power!.activeS = POWERED_S - WAVE_READY_S - 0.01;
    expect(canFireWave(w)).toBe(false);
    expect(resolveSteal(w, { ...NO_INTENT, steal: true })).toBeNull();
  });

  it('while a drop kick climbs, nothing Harrison presses plays it', () => {
    const w = keeperWorld({ power: true, tricks: true });
    runFor(w, 1);
    w.keepers!.punt = 'away';
    onTheirBall(w);
    expect(canStartPower(w)).toBe(false);
    expect(startTrick(w, { ...NO_INTENT, trick: 'stepover' })).toBeNull();
    expect(startDragBack(w, { ...NO_INTENT, moveX: -1 })).toBe(false);
    expect(resolveSteal(w, { ...NO_INTENT, steal: true })).toBeNull();
  });

  it("their keeper catching the ball ends Harrison's power-up", () => {
    const w = keeperWorld({ power: true });
    runFor(w, 1);
    w.power!.activeS = POWERED_S;
    let cancelled = false;
    shotAt(w, { x: 1180, z: 64 }, 64, 200);
    runUntil(w, 1, w => {
      cancelled ||= w.events.power.cancelled;
      return w.events.keeper.caught === 'away';
    });
    expect(cancelled || w.events.power.cancelled).toBe(true);
    expect(w.power!.activeS).toBe(0);
  });

  it('a live wave ends the moment a keeper holds the ball', () => {
    const w = keeperWorld({ power: true });
    runFor(w, 1);
    Object.assign(w.home, { x: 300, z: 64, facing: 1 });
    w.ball.x = 308;
    w.wave = fireWave(w);
    startHold(w, w.keepers!.home, quietKeepers(), true);
    runFor(w, 1 / 60);
    expect(w.wave?.live ?? false).toBe(false);
  });
});

describe('the last strike', () => {
  const STALE: Strike = { team: 'home', kind: 'shot', perfect: true, x: 1000, z: 64 };

  it("a catch clears the last strike, so it can't follow the ball", () => {
    const w = keeperWorld();
    w.keepers!.strike = { ...STALE };
    shotAt(w, { x: 1180, z: 64 }, 64, 150); // slow and straight at him: always held
    expect(runUntil(w, 2, w => w.keepers!.away.holding)).toBe(true);
    expect(w.keepers!.strike).toBeNull();
  });

  it('so does the drop kick', () => {
    const w = keeperWorld();
    shotAt(w, { x: 1180, z: 64 }, 64, 150);
    runUntil(w, 2, w => w.keepers!.away.holding);
    w.keepers!.strike = { ...STALE };
    expect(runUntil(w, 3, w => w.keepers!.punt !== null)).toBe(true);
    expect(w.keepers!.strike).toBeNull();
  });

  it("a strike records the ball's depth too", () => {
    const w = keeperWorld();
    Object.assign(w.home, { x: 1000, z: 64, facing: 1 });
    setBall(w, { x: 1008, z: 64 });
    expect(runUntil(w, 2, w => w.keepers!.strike !== null, w => ({ ...NO_INTENT, shootHeld: w.match.clockS < 0.3 }))).toBe(true);
    expect(Math.abs(w.keepers!.strike!.z - w.home.z)).toBeLessThanOrEqual(REACH_Z);
  });
});
