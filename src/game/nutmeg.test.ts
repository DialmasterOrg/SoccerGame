import { describe, expect, it } from 'vitest';
import { BALL_R } from '../art/ball';
import { NUTMEG, squareAndStill, startNutmeg } from './nutmeg';
import { NO_INTENT, PLAYER_R, type Player, type PlayerIntent } from './player';
import { keeperWorld, setBall } from './testKeepers';
import { placeForKickoff, stepWorld, type World } from './world';

const STEP = 1 / 60;
const PRESS = { ...NO_INTENT, nutmeg: true };

/** Niko (away) on the ball at (400, 64) facing his goal, Harrison standing still 20 px ahead in his lane, facing him, square. */
function stage(home: Partial<Player> = {}): World {
  const w = keeperWorld();
  Object.assign(w.away, { x: 400, z: 64, facing: -1, vx: 0, vz: 0 });
  setBall(w, { x: 392, z: 64 });
  Object.assign(w.home, { x: 380, z: 64, facing: 1, vx: 0, vz: 0 }, home);
  return w;
}

/** Everything that would make Harrison not still, not square, or not in the way. */
const NOT_SQUARE: Record<string, Partial<Player>> = {
  'moving at 20 px/s': { vx: 20 },
  'facing away': { facing: -1 },
  sliding: { state: 'sliding' },
  charging: { state: 'charging' },
  turning: { turnS: 0.1 },
  'in a trick': { trick: { kind: 'stepover', t: 0, side: 1, sold: false, pace: 0.5, onBall: true } },
  fallen: { state: 'fallen' },
  "6 px off the ball's line": { z: 70 },
  '40 px away': { x: 360 },
};

/** Steps the press, then plain ticks, until the ball is clear past Harrison or `s` runs out: whether it got past, and whether Harrison ever played it. */
function throughHim(w: World, s = 1): { past: boolean; homePlayed: boolean } {
  let [past, homePlayed] = [false, false];
  for (let i = 0; i < s / STEP && !past; i++) {
    stepWorld(w, NO_INTENT, i === 0 ? PRESS : NO_INTENT, STEP);
    const h = w.events.kicks[0]!;
    if (h.touched || h.blocked || h.kicked || h.tackledBall) homePlayed = true;
    past = w.ball.x < w.home.x - (PLAYER_R + BALL_R);
  }
  return { past, homePlayed };
}

describe('the nutmeg: a world rule', () => {
  it('Harrison still and square in the away player\'s path, close in, with the ball on its line, is square and still', () => {
    expect(squareAndStill(stage())).toBe(true);
  });

  for (const [why, home] of Object.entries(NOT_SQUARE)) {
    it(`Harrison ${why} is not`, () => {
      expect(squareAndStill(stage(home))).toBe(false);
    });
  }

  it('startNutmeg does nothing without a square, still Harrison, press or no press, nor on one without a press', () => {
    const tries: [Partial<Player>, PlayerIntent][] = [...Object.values(NOT_SQUARE).flatMap((home): [Partial<Player>, PlayerIntent][] => [[home, PRESS], [home, NO_INTENT]]), [{}, NO_INTENT]];
    for (const [home, intent] of tries) {
      const w = stage(home);
      expect(startNutmeg(w, intent)).toBe(false);
      expect(w.ball.through).toBeUndefined();
      expect([w.ball.vx, w.ball.vz]).toEqual([0, 0]);
    }
  });

  it('a press on a square, still Harrison sends the ball through him at NUTMEG.push along the nutmegger\'s facing', () => {
    const w = stage();
    expect(startNutmeg(w, PRESS)).toBe(true);
    expect(w.ball.through).toEqual({ team: 'home', dir: -1, leftS: NUTMEG.passS });
    expect(w.ball.vx).toBe(-NUTMEG.push);
    expect(w.ball.vz).toBe(0);
  });

  it('through the legs: the ball passes Harrison with no contact of his on any tick', () => {
    const w = stage();
    const { past, homePlayed } = throughHim(w);
    expect(past).toBe(true);
    expect(homePlayed).toBe(false);
  });

  it('once it is clear the flag is gone, and a ball rolled at him is blocked again', () => {
    const w = stage();
    expect(throughHim(w).past).toBe(true);
    expect(w.ball.through).toBeUndefined();
    setBall(w, { x: w.home.x - 30, z: w.home.z, vx: 100 });
    let blocked = false;
    for (let i = 0; i < 0.6 / STEP && !blocked; i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, STEP);
      blocked = w.events.kicks[0]!.blocked;
    }
    expect(blocked).toBe(true);
  });

  it('the flag never outlives a kickoff', () => {
    const w = stage();
    w.ball.through = { team: 'home', dir: -1, leftS: NUTMEG.passS };
    placeForKickoff(w);
    expect(w.ball.through).toBeUndefined();
  });

  it("a through ball headed at Harrison's keeper is still saved or blocked by him", () => {
    const w = stage();
    const k = w.keepers!.home;
    Object.assign(w.home, { x: k.body.x + 28, z: k.body.z });
    Object.assign(w.away, { x: w.home.x + 20, z: k.body.z });
    setBall(w, { x: w.away.x - 8, z: k.body.z });
    expect(squareAndStill(w)).toBe(true);
    let saved = false;
    for (let i = 0; i < 1 / STEP && !saved; i++) {
      stepWorld(w, NO_INTENT, i === 0 ? PRESS : NO_INTENT, STEP);
      saved = k.holding || w.events.keeper.pushed === 'home' || w.events.keeper.caught === 'home' || w.ball.vx > 0;
    }
    expect(saved).toBe(true);
    expect(w.match.score.away).toBe(0);
  });
});
