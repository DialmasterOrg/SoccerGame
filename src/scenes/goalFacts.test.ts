import { describe, expect, it } from 'vitest';
import { quietKeepers, type KeeperSide } from '../game/keeper';
import type { Team } from '../game/match';
import { BASE_STATS } from '../game/stats';
import { keeperWorld } from '../game/testKeepers';
import { createWorld, quietContact, type World } from '../game/world';
import type { LastKick } from './goalCallout';
import { REBOUND_S, createKeeperWatch, goalFacts, stepKeeperWatch } from './goalFacts';

const STEP = 1 / 60;
const shot: LastKick = { kind: 'shot', perfect: false, distance: 240 };
const strikeAt = (w: World, x: number, z: number, team: Team = 'home') => (w.keepers!.strike = { team, kind: 'shot', perfect: false, x, z });
/** This tick's events: a kick of his or none, and who pushed the ball away. */
const tick = (w: World, kicked: 'shot' | null, pushed: KeeperSide | null = null) => {
  w.events = { ...w.events, kicks: [{ ...quietContact(), kicked }, quietContact()], keeper: { ...quietKeepers(), pushed } };
};
/** Their keeper pushes, then `afterS` passes, then he kicks. */
const kickAfterPush = (afterS: number, by: KeeperSide = 'away') => {
  const w = keeperWorld();
  const watch = createKeeperWatch();
  tick(w, null, by);
  stepKeeperWatch(watch, w, STEP);
  for (let t = 0; t < afterS; t += STEP) {
    tick(w, null);
    stepKeeperWatch(watch, w, STEP);
  }
  tick(w, 'shot');
  stepKeeperWatch(watch, w, STEP);
  strikeAt(w, 1180, 64);
  return goalFacts(w, watch, shot);
};

describe('goalFacts', () => {
  it('a goal from his kick outside their box is from outside the box; inside it, not', () => {
    const w = keeperWorld();
    const watch = createKeeperWatch();
    strikeAt(w, 1000, 64);
    expect(goalFacts(w, watch, shot).outsideBox).toBe(true);
    strikeAt(w, 1180, 64);
    expect(goalFacts(w, watch, shot).outsideBox).toBe(false);
    strikeAt(w, 1180, 4); // level with the box, but wide of it in depth
    expect(goalFacts(w, watch, shot).outsideBox).toBe(true);
  });

  it('no live kick of his, the wave, a cleared strike or theirs never counts', () => {
    const w = keeperWorld();
    const watch = createKeeperWatch();
    strikeAt(w, 1000, 64);
    expect(goalFacts(w, watch, null)).toEqual({ outsideBox: false, rebound: false });
    expect(goalFacts(w, watch, { ...shot, kind: 'wave' }).outsideBox).toBe(false);
    strikeAt(w, 1000, 64, 'away');
    expect(goalFacts(w, watch, shot).outsideBox).toBe(false);
    w.keepers!.strike = null;
    expect(goalFacts(w, watch, shot).outsideBox).toBe(false);
  });

  it('a long shot their keeper pushes into his own net is from outside the box, not a rebound', () => {
    const w = keeperWorld();
    const watch = createKeeperWatch();
    tick(w, 'shot');
    stepKeeperWatch(watch, w, STEP);
    strikeAt(w, 1000, 64);
    tick(w, null, 'away'); // the push doesn't clear the strike
    stepKeeperWatch(watch, w, STEP);
    expect(goalFacts(w, watch, shot)).toEqual({ outsideBox: true, rebound: false });
  });

  it('a kick within 2 s of their keeper pushing the ball away is a rebound', () => {
    expect(REBOUND_S).toBe(2);
    expect(kickAfterPush(REBOUND_S - 0.1).rebound).toBe(true);
  });

  it("a kick after 2 s, or after his own keeper's push, is not", () => {
    expect(kickAfterPush(REBOUND_S + 0.1).rebound).toBe(false);
    expect(kickAfterPush(0.5, 'home').rebound).toBe(false);
  });

  it('with no keepers nothing is from outside the box or a rebound', () => {
    const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
    expect(goalFacts(w, createKeeperWatch(), shot)).toEqual({ outsideBox: false, rebound: false });
  });
});
