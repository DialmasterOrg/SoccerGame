import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from './ai';
import { BALL_REST_Y } from './ball';
import { GRAVITY } from './constants';
import { penaltyArea, roofSpan } from './field';
import { GUS, GUS_PROFILES } from './gus';
import { KEEPER_TOP_LEVEL, SET_OFF, keeperProfile, placeKeepers, quietKeepers, standOffSpot, startHold, type Keeper, type KeeperAct } from './keeper';
import { LOW_Y, keeperSaves } from './keeperSaves';
import { NO_INTENT, PLAYER_R, heightOf, radiusOf } from './player';
import { POWERED_S, WAVE_READY_S, canFireWave } from './power';
import { keeperWorld, runFor, runUntil, setBall, shotAt } from './testKeepers';
import { fireWave } from './wave';
import { placeForKickoff, stepWorld, type World } from './world';

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const gusWorld = (o: Omit<NonNullable<Parameters<typeof keeperWorld>[0]>, 'gus'> = {}): World => keeperWorld({ gus: true, ...o });
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

describe('his huge drop kick', () => {
  const PUNT_SEEDS = Array.from({ length: 64 }, (_, i) => i + 1);

  /** Gus holding a caught ball, set in his goal; Harrison and the partner parked out of the way. */
  function holding(o: Parameters<typeof gusWorld>[0] = {}): World {
    const w = gusWorld(o);
    for (const p of [w.home, w.away]) Object.assign(p, { x: 900, z: 124 });
    startHold(w, gus(w), quietKeepers(), true);
    return w;
  }

  it("his drop kicks land deep in Harrison's half", () => {
    for (const seed of PUNT_SEEDS) {
      const w = holding({ seed });
      expect(runUntil(w, 3, w => w.events.keeper.punted === 'away'), `seed ${seed}`).toBe(true);
      expect(w.keepers!.gusPunt, `seed ${seed}`).toBe(true);
      expect(runUntil(w, 4, w => w.events.ball.bounced), `seed ${seed}`).toBe(true);
      expect(w.ball.x, `seed ${seed}`).toBeGreaterThanOrEqual(270);
      expect(w.ball.x, `seed ${seed}`).toBeLessThanOrEqual(490);
    }
  });

  it('no goal ever comes straight from his kick, and Eddie holds one that reaches him', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of PUNT_SEEDS) {
        const w = holding({ seed, difficulty });
        runUntil(w, 3, w => w.events.keeper.punted === 'away');
        const box = penaltyArea(w.field, w.field.goals[0]!);
        // Over 8 s, or until Eddie has it: one that dies on the edge of his box he walks out and collects.
        let [entered, caught, goal] = [false, false, false];
        runUntil(w, 8, w => {
          const b = w.ball;
          entered ||= b.x >= box.x0 && b.x <= box.x1 && b.z >= box.z0 && b.z <= box.z1;
          caught ||= w.events.keeper.caught === 'home';
          goal ||= w.events.goal === 'away';
          return caught;
        });
        expect(goal, `${difficulty} seed ${seed}`).toBe(false);
        if (entered) expect(caught, `${difficulty} seed ${seed}`).toBe(true);
      }
    }
  });

  it('players wait where his kick comes down', () => {
    const w = holding();
    expect(standOffSpot(w, w.away, gus(w)).x).toBe(380);
  });

  it('a touch makes it an ordinary ball', () => {
    const w = gusWorld();
    w.keepers!.gusPunt = true;
    Object.assign(w.home, { x: 600, z: 64, facing: 1, state: 'air', y: 10, vy: 50 });
    setBall(w, { x: 603, y: 47, z: 64, vx: -50, vy: -100 });
    expect(runUntil(w, 0.2, w => w.events.kicks[0]?.kicked === 'header')).toBe(true);
    expect(w.keepers!.gusPunt).toBe(false);

    w.keepers!.gusPunt = true;
    placeForKickoff(w);
    expect(w.keepers!.gusPunt).toBe(false);
  });
});

describe('the brace: set, he stops the Energy Wave', () => {
  /** Harrison powered up and ready on the ball at (1000, 64), facing Gus; the partner out of the lane. */
  function ready(): World {
    const w = gusWorld({ power: true });
    runFor(w, 0.5);
    Object.assign(w.away, { x: 500, z: 120 });
    Object.assign(w.home, { x: 1000, z: 64, facing: 1, vx: 0, vz: 0 });
    setBall(w, { x: 1008, z: 64 });
    w.power!.meter = 1;
    w.power!.activeS = POWERED_S - WAVE_READY_S - 0.01;
    return w;
  }

  it('set, he catches the wave', () => {
    const w = ready();
    expect(gus(w).act).toBe('set');
    let braced = false;
    runFor(w, 1 / 60, { ...NO_INTENT, shootHeld: true });
    expect(w.wave?.live).toBe(true);
    runUntil(w, 0.5, w => (braced ||= w.events.power.braced));
    expect(braced).toBe(true);
    expect(gus(w).holding).toBe(true);
    expect([w.wave?.outcome, w.wave?.live]).toEqual(['braced', false]);
    expect(runUntil(w, 2, w => w.events.goal !== null)).toBe(false);
  });

  /** The wave fired from just in front of him, so it reaches him on the next tick, with him in `act`. */
  function waveAt(act: KeeperAct, o: { actT?: number; outBy?: number } = {}): World {
    const w = gusWorld({ power: true });
    runFor(w, 0.5);
    const k = gus(w);
    Object.assign(w.away, { x: 500, z: 120 });
    Object.assign(w.home, { x: 900, z: 20 });
    if (o.outBy !== undefined) k.body.x = 1240 - o.outBy;
    Object.assign(k, { act, actT: o.actT ?? 0, dive: act === 'set' || act === 'rush' ? null : { dirX: 0, dirZ: 1 } });
    setBall(w, { x: k.body.x - radiusOf(k.body) - 12, z: k.body.z });
    w.wave = fireWave(w);
    return w;
  }

  /** The wave blows him into his net and it's a goal. */
  function blownIn(w: World): boolean {
    let [inNet, goal] = [false, false];
    runUntil(w, 1, w => {
      inNet ||= gus(w).body.inNet === true;
      goal ||= w.events.goal === 'home';
      return inNet && goal;
    });
    return inNet && goal && w.wave?.outcome !== 'braced';
  }

  it("the same wave, staged in front of him set, is caught", () => {
    expect(blownIn(waveAt('set'))).toBe(false);
  });

  it.each(['rush', 'dive', 'down', 'getUp'] as const)("%s, he's blown in", act => {
    expect(blownIn(waveAt(act))).toBe(true);
  });

  it('the beam reaching him on the last tick of getting up blows him in', () => {
    const getUpS = GUS_PROFILES.normal.getUpS;
    expect(blownIn(waveAt('getUp', { actT: getUpS - 1.5 / 60 }))).toBe(true);
  });

  it("set, but walking back from further out than his set spot takes him, he's blown in", () => {
    const band = GUS.radius + SET_OFF + GUS_PROFILES.normal.comeOutPx;
    expect(blownIn(waveAt('set', { outBy: band + 8 }))).toBe(true);
  });

  it("fooled by a stepover, he's blown in", () => {
    const w = gusWorld({ power: true, tricks: true });
    Object.assign(w.home, { x: 1150, z: 64, facing: 1 });
    setBall(w, { x: 1158, z: 64 });
    if (!runUntil(w, 2, w => gus(w).act === 'rush' && gus(w).body.x - w.home.x <= 68)) throw new Error('Gus never came out');
    runFor(w, 1 / 60, { ...NO_INTENT, trick: 'stepover' });
    expect(runUntil(w, 0.4, w => gus(w).body.fooled !== null)).toBe(true);
    w.wave = fireWave(w);
    expect(blownIn(w)).toBe(true);
  });

  it('holding a save, Harrison powered up has no wave to fire', () => {
    const w = ready();
    startHold(w, gus(w), quietKeepers(), true);
    Object.assign(w.home, { x: w.ball.x - 8, z: w.ball.z });
    expect(canFireWave(w)).toBe(false);
  });

  it('blown into his net, his big body fits inside it and walks out', () => {
    const w = waveAt('down');
    const g = w.field.goals[1]!;
    const [roofX0] = roofSpan(w.field, g);
    const r = GUS.radius;
    let [upAt, outAt, t] = [-1, -1, 0];
    let goal = false;
    for (let i = 0; i < 6 * 60 && outAt < 0; i++) {
      stepWorld(w, NO_INTENT, NO_INTENT, 1 / 60);
      t += 1 / 60;
      goal ||= w.events.goal === 'home';
      const b = gus(w).body;
      if (b.inNet) {
        expect(b.x, `tick ${i}`).toBeLessThanOrEqual(g.backX - r);
        if (b.x >= g.lineX) {
          expect(b.z, `tick ${i}`).toBeGreaterThanOrEqual(g.z0 + r);
          expect(b.z, `tick ${i}`).toBeLessThanOrEqual(g.z1 - r);
        }
      }
      expect(b.x >= roofX0 && (b.z < g.z0 || b.z > g.z1), `tick ${i}`).toBe(false);
      if (upAt < 0 && goal && b.state === 'ground') upAt = t;
      if (upAt >= 0 && !b.inNet) {
        outAt = t;
        expect(w.match.phase).toBe('goal');
      }
    }
    expect(goal).toBe(true);
    expect(upAt).toBeGreaterThan(0);
    expect(outAt - upAt).toBeLessThanOrEqual(3);
  });
});
