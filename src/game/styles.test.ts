import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from './ai';
import { BALL_REST_Y } from './ball';
import { CREW_PROFILES, CREW_STATS } from './crew';
import { POACH } from './priya';
import { BLOCKER, CHARGE_MIN_S, POSSESSION_RANGE, SHOOTER_CHARGE, chargeHold, defendSpot, pressSprint, theirBall } from './styles';
import { BASE_STATS } from './stats';
import { setBall } from './testKeepers';
import { kidWorld } from './testTryouts';
import { createWorld, type World } from './world';

/** Harrison on the ball at (x, 20), running right at the away goal; Brick (away) defends it. */
function attacking(x: number): World {
  const w = createWorld(BASE_STATS, CREW_STATS.brick, 1, { home: 0, away: 0 }, null, null, CREW_PROFILES.brick.normal);
  w.match.phase = 'playing';
  Object.assign(w.home, { x: x - 8, z: 20, vx: 120, facing: 1 });
  Object.assign(w.ball, { x, y: BALL_REST_Y, z: 20, vx: 120, vy: 0, vz: 0 });
  Object.assign(w.away, { x: x + 120, z: 32, facing: -1 });
  return w;
}
const ownGoal = (w: World) => w.field.goals.find(g => g.side === 'right')!;
const centreZ = (w: World) => (ownGoal(w).z0 + ownGoal(w).z1) / 2;

describe('defendSpot', () => {
  it("allRound is Max's spot: just goal-side of the ball and a third of the way across to his goal's centre", () => {
    const w = attacking(400);
    expect(defendSpot('allRound', w, w.away, ownGoal(w))).toEqual({ x: 420, z: 20 + (centreZ(w) - 20) / 3 });
  });

  it('the blocker sits at least 30 px deeper than Max, and off his goal line', () => {
    const w = attacking(400);
    const [max, brick] = [defendSpot('allRound', w, w.away, ownGoal(w)), defendSpot('blocker', w, w.away, ownGoal(w))];
    expect(brick.x - max.x).toBeGreaterThanOrEqual(30);
    expect(ownGoal(w).lineX - brick.x).toBeGreaterThanOrEqual(BLOCKER.offLine);
    expect(brick.x - w.ball.x).toBeGreaterThanOrEqual(BLOCKER.minAhead);
  });

  it("the blocker stands in the shot's lane: on the line from the ball to his goal's centre", () => {
    for (const z of [6, 20, 50]) {
      const w = attacking(400);
      w.ball.z = z;
      const spot = defendSpot('blocker', w, w.away, ownGoal(w));
      const t = (spot.x - w.ball.x) / (ownGoal(w).lineX - w.ball.x);
      expect(Math.abs(spot.z - (z + (centreZ(w) - z) * t)), `z ${z}`).toBeLessThanOrEqual(1);
    }
  });

  it('with the ball close to his goal he still keeps off the line, room for a chip behind him', () => {
    const w = attacking(0);
    w.ball.x = ownGoal(w).lineX - 40;
    expect(ownGoal(w).lineX - defendSpot('blocker', w, w.away, ownGoal(w)).x).toBeCloseTo(BLOCKER.offLine, 6);
  });

  it("Max's defend spot is unchanged by the crew's styles", () => {
    expect(DIFFICULTY.normal.style).toBe('allRound');
  });
});

describe('chargeHold', () => {
  it("allRound winds up as Max always has; the shooter winds up fully", () => {
    expect(chargeHold('allRound', () => 0)).toBe(CHARGE_MIN_S);
    expect(chargeHold('shooter', () => 0)).toBe(0.55);
    expect(chargeHold('shooter', () => 1)).toBeCloseTo(SHOOTER_CHARGE.from + SHOOTER_CHARGE.spread, 9);
  });

  it('each draws exactly one random number', () => {
    for (const style of ['allRound', 'shooter'] as const) {
      let draws = 0;
      chargeHold(style, () => (draws++, 0.5));
      expect(draws, style).toBe(1);
    }
  });
});

describe('the presser', () => {
  it("goes straight at the ball: his spot is the ball itself", () => {
    const w = attacking(ownGoal(attacking(0)).lineX - 200);
    const spot = defendSpot('presser', w, w.away, ownGoal(w));
    expect(Math.hypot(spot.x - w.ball.x, spot.z - w.ball.z)).toBeLessThanOrEqual(8);
  });

  it('sprints at any distance while he has the legs; allRound only from far off', () => {
    expect(pressSprint('presser', 30, 0.9)).toBe(true);
    expect(pressSprint('presser', 30, 0.2)).toBe(false);
    expect(pressSprint('allRound', 30, 0.9)).toBe(false);
    expect(pressSprint('allRound', 130, 0.9)).toBe(true);
  });
});

describe('the poacher', () => {
  /** Harrison on the ball at the School `out` px from Priya's goal line, running at it; Priya 120 px goal-side of him. */
  function attackingPriya(out: number): World {
    const { w } = kidWorld('priya');
    const x = ownGoal(w).lineX - out;
    Object.assign(w.home, { x: x - 8, z: 40, vx: 120, facing: 1 });
    setBall(w, { x, z: 40, vx: 120 });
    Object.assign(w.away, { x: x + 120, z: 52, facing: -1 });
    return w;
  }

  it('lingers upfield: with Harrison on the ball near her goal, she stands no more than lingerX into her own half', () => {
    const w = attackingPriya(100);
    expect(defendSpot('poacher', w, w.away, ownGoal(w)).x).toBeLessThanOrEqual(w.field.width / 2 + POACH.lingerX);
  });

  it("a dribble touch running on ahead of Harrison is still his to her, so she holds her spot; a ball sitting still there isn't", () => {
    const w = attackingPriya(400);
    w.ball.x = w.home.x + BLOCKER.touchAhead - 4;
    expect(Math.hypot(w.ball.x - w.home.x, w.ball.z - w.home.z)).toBeGreaterThan(POSSESSION_RANGE);
    expect(theirBall('poacher', w, w.home)).toBe(true);
    Object.assign(w.ball, { vx: 0, vz: 0 });
    expect(theirBall('poacher', w, w.home)).toBe(false);
  });

  it("with the ball in Harrison's half her spot is allRound's", () => {
    const w = attackingPriya(900);
    expect(w.ball.x).toBeLessThan(w.field.width / 2);
    expect(defendSpot('poacher', w, w.away, ownGoal(w))).toEqual(defendSpot('allRound', w, w.away, ownGoal(w)));
  });
});
