import { describe, expect, it } from 'vitest';
import { BALL_REST_Y } from './ball';
import { GRAVITY } from './constants';
import { GUS, GUS_PROFILES } from './gus';
import { KEEPER_TOP_LEVEL, SET_OFF, keeperProfile, placeKeepers, quietKeepers, type Keeper } from './keeper';
import { LOW_Y, keeperSaves } from './keeperSaves';
import { NO_INTENT, PLAYER_R, heightOf, radiusOf } from './player';
import { keeperWorld, runFor, runUntil, setBall, shotAt } from './testKeepers';
import { stepWorld, type World } from './world';

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const gusWorld = (o: { seed?: number; tricks?: boolean } = {}): World => keeperWorld({ gus: true, ...o });
const gus = (w: World): Keeper => w.keepers!.away;

/** A shot from `from` at `speed` along the ground for (1240, toZ), with the vy that crosses his body's x-plane at about height y (drag aside). */
function shootAtHeight(w: World, from: { x: number; z: number }, toZ: number, speed: number, y: number): void {
  const [dx, dz] = [1240 - from.x, toZ - from.z];
  const vx = (speed * dx) / Math.hypot(dx, dz);
  const t = (gus(w).body.x - from.x) / vx;
  shotAt(w, from, toZ, speed, (y - BALL_REST_Y + 0.5 * GRAVITY * t * t) / t);
}

/** How many of the seeds `play` returns true on. */
const count = (play: (seed: number) => boolean): number => SEEDS.filter(play).length;

describe('Goalie Gus in goal', () => {
  it('Gus kicks off set in their goal, his own size', () => {
    const w = gusWorld();
    placeKeepers(w);
    const { home, away } = w.keepers!;
    expect([radiusOf(away.body), heightOf(away.body), away.gus]).toEqual([7, 53, GUS]);
    expect([away.body.x, away.body.z, away.body.facing]).toEqual([1240 - 7 - SET_OFF, 64, -1]);
    expect(away.profile).toEqual(GUS_PROFILES.normal);
    expect([home.body.x, home.body.z, radiusOf(home.body), home.gus]).toEqual([40 + PLAYER_R + SET_OFF, 64, PLAYER_R, null]);
    expect(home.profile).toEqual(keeperProfile(KEEPER_TOP_LEVEL, 'normal'));
  });

  it('a hard shot struck straight at him is caught', () => {
    expect(count(seed => {
      const w = gusWorld({ seed });
      shootAtHeight(w, { x: 1100, z: 64 }, 64, 600, 25);
      return runUntil(w, 1, w => w.events.keeper.caught === 'away');
    })).toBe(SEEDS.length);
  });

  it('a high shot for the top corner is saved', () => {
    expect(count(seed => {
      const w = gusWorld({ seed });
      shootAtHeight(w, { x: 1060, z: 64 }, 92, 600, 40);
      return runUntil(w, 1, w => w.events.keeper.caught === 'away' || w.events.keeper.pushed === 'away');
    })).toBe(SEEDS.length);
  });

  it('a low shot for the bottom corner beats him', () => {
    expect(count(seed => {
      const w = gusWorld({ seed });
      shotAt(w, { x: 1140, z: 64 }, 92, 420);
      return runUntil(w, 1.5, w => w.events.goal === 'home');
    })).toBeGreaterThanOrEqual(12);
  });

  it('his gloves get down to a low ball slowly', () => {
    const at = (y: number) => {
      const w = gusWorld();
      const k = gus(w);
      Object.assign(k, { act: 'dive', actT: 0.05, dive: { dirX: 0, dirZ: 1 } });
      const ball = { x: k.body.x, y, z: k.body.z + 16 };
      setBall(w, { ...ball, vx: 1 });
      const ev = quietKeepers();
      keeperSaves(w, ball, ev);
      return k.holding || ev.pushed === 'away';
    };
    expect(at(BALL_REST_Y)).toBe(false);
    expect(BALL_REST_Y).toBeLessThan(LOW_Y);
    expect(at(30)).toBe(true);
  });

  it("after a dive he's slow up: down and getting up last downS + getUpS, and a shot at the near post meanwhile scores", () => {
    const w = gusWorld();
    const k = gus(w);
    Object.assign(k, { act: 'dive', actT: 0, dive: { dirX: 0, dirZ: 1 } });
    runUntil(w, 1, () => k.act === 'down');
    let t = 0;
    runUntil(w, 3, () => {
      t += 1 / 60;
      return k.act === 'set';
    });
    expect(t).toBeCloseTo(GUS_PROFILES.normal.downS + GUS_PROFILES.normal.getUpS, 1);

    const v = gusWorld();
    Object.assign(gus(v), { act: 'dive', actT: 0, dive: { dirX: 0, dirZ: 1 } });
    runUntil(v, 2, () => gus(v).act === 'getUp');
    shotAt(v, { x: 1150, z: 64 }, 36, 400);
    expect(runUntil(v, 1, w => w.events.goal === 'home')).toBe(true);
  });

  it('he comes out big: further off his line than the top level keeper, before his smother', () => {
    const [big, plain] = [gusWorld(), keeperWorld({ level: KEEPER_TOP_LEVEL })];
    for (const w of [big, plain]) {
      Object.assign(w.home, { x: 1090, z: 64, facing: 1 });
      setBall(w, { x: 1098, z: 64 });
    }
    const dribble = { ...NO_INTENT, moveX: 1, pace: 0.35 };
    const off = (w: World) => 1240 - gus(w).body.x;
    let [rushed, compared] = [false, 0];
    for (let i = 0; i < 180 && gus(big).act !== 'dive'; i++) {
      for (const w of [big, plain]) stepWorld(w, dribble, NO_INTENT, 1 / 60);
      rushed ||= gus(big).act === 'rush';
      if (gus(big).act === 'rush') {
        expect(off(big), `tick ${i}`).toBeGreaterThan(off(plain));
        compared++;
      }
    }
    expect(rushed).toBe(true);
    expect(compared).toBeGreaterThan(0);
  });
});

describe('tricks beat his rush', () => {
  /**
   * Harrison through on goal at (1150, 64) with the ball at his feet, Gus coming out at him, 68 px between them:
   * he closes about 32 px before a trick sells (0.2 s on), and commits to his smother from smotherAt (30) of the
   * ball, so the sell has to land inside Normal's window while the ball is still more than 30 px off him.
   */
  function comingOut(): World {
    const w = gusWorld({ tricks: true });
    Object.assign(w.home, { x: 1150, z: 64, facing: 1 });
    setBall(w, { x: 1158, z: 64 });
    if (!runUntil(w, 2, w => gus(w).act === 'rush' && gus(w).body.x - w.home.x <= 68)) throw new Error('Gus never came out');
    return w;
  }

  it('a stepover sends him diving the wrong way', () => {
    const w = comingOut();
    const side = w.home.z >= w.field.depth / 2 ? 1 : -1;
    runFor(w, 1 / 60, { ...NO_INTENT, trick: 'stepover' });
    runUntil(w, 0.4, w => gus(w).body.fooled !== null);
    runUntil(w, 0.2, w => w.events.keeper.dived === 'away');
    expect(gus(w).dive?.dirZ).toBe(side);
    expect(gus(w).holding).toBe(false);
  });

  it('a rainbow flick lifts the ball over him, and he can\'t play it', () => {
    const w = comingOut();
    runFor(w, 1 / 60, { ...NO_INTENT, trick: 'flick' });
    expect(runUntil(w, 1, w => gus(w).body.fooled?.kind === 'stumble')).toBe(true);
    expect(runUntil(w, 1, w => gus(w).holding || w.events.keeper.pushed !== null)).toBe(false);
    expect(w.ball.x).toBeGreaterThan(gus(w).body.x);
  });
});
