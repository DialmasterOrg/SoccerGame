import { describe, expect, it } from 'vitest';
import { BALL_R } from '../art/ball';
import { KEEPER_HANDS } from '../art/keepers/poses';
import { DIFFICULTIES } from './ai';
import { KEEPER_TOP_LEVEL, keeperProfile, quietKeepers, type Strike } from './keeper';
import { SOFT_SPEED, holdChance, keeperSaves } from './keeperSaves';
import { NO_INTENT } from './player';
import { keeperWorld, runFor, runUntil, setBall, shotAt } from './testKeepers';

const p = keeperProfile(1, 'normal');
const shotBy = (o: Partial<Strike>): Strike => ({ team: 'home', kind: 'shot', perfect: false, x: 1000, z: 64, ...o });

describe('holdChance', () => {
  it('a slow ball at him is always held, at every level and difficulty', () => {
    for (const d of DIFFICULTIES) for (let l = 1; l <= KEEPER_TOP_LEVEL; l++)
      expect(holdChance(keeperProfile(l, d), { speed: SOFT_SPEED, reach: 0.5, strike: null }, 1240)).toBe(1);
  });

  it('a harder shot, a longer reach, a PERFECT strike and a close volley are each held less', () => {
    const at = (o: Partial<{ speed: number; reach: number; strike: Strike | null }>) => holdChance(p, { speed: 450, reach: 0.3, strike: shotBy({}), ...o }, 1240);
    expect(at({ speed: 600 })).toBeLessThan(at({}));
    expect(at({ reach: 0.9 })).toBeLessThan(at({}));
    expect(at({ strike: shotBy({ perfect: true }) })).toBeLessThan(at({}));
    expect(at({ strike: shotBy({ kind: 'volley', x: 1180 }) })).toBeLessThan(at({ strike: shotBy({ kind: 'volley', x: 1040 }) }));
  });
});

describe('keeperSaves', () => {
  it('a ball straight at him is caught and held at his gloves', () => {
    const w = keeperWorld();
    runFor(w, 1);
    shotAt(w, { x: 1180, z: 64 }, 64, 200);
    expect(runUntil(w, 1, w => w.events.keeper.caught === 'away')).toBe(true);
    const k = w.keepers!.away;
    expect(k.holding).toBe(true);
    expect([w.ball.x, w.ball.y, w.ball.z]).toEqual([k.body.x - KEEPER_HANDS.x, KEEPER_HANDS.y, k.body.z]);
    runFor(w, 1);
    expect([w.ball.x, w.ball.z, w.events.goal]).toEqual([k.body.x - KEEPER_HANDS.x, k.body.z, null]);
  });

  it('a ball he pushes away never ends up in his goal', () => {
    let pushes = 0;
    for (let seed = 1; seed <= 64; seed++) {
      const w = keeperWorld({ seed });
      runFor(w, 1);
      shotAt(w, { x: 1060, z: 64 }, 44 + (seed % 10), 650, 60);
      let pushed = false;
      for (let i = 0; i < 150; i++) {
        runFor(w, 1 / 60);
        pushed ||= w.events.keeper.pushed === 'away';
        if (pushed) expect(w.events.goal, `seed ${seed}`).toBeNull();
      }
      if (pushed) pushes++;
    }
    expect(pushes).toBeGreaterThan(8);
  });

  it('a ball through his plane above his reach is not his; just below it is', () => {
    for (const [dy, saved] of [[1, false], [-1, true]] as const) {
      const w = keeperWorld();
      const k = w.keepers!.away;
      const y = k.profile.reachY + BALL_R + dy;
      setBall(w, { x: k.body.x - 2, y, z: k.body.z, vx: 300 });
      const ev = quietKeepers();
      keeperSaves(w, { x: k.body.x - 9, y, z: k.body.z }, ev);
      expect(ev.caught !== null || ev.pushed !== null).toBe(saved);
    }
  });

  it("when he can't play, the ball bounces off his body", () => {
    const w = keeperWorld();
    const k = w.keepers!.away;
    Object.assign(k, { act: 'down', actT: 0 });
    setBall(w, { x: k.body.x - 20, z: k.body.z, vx: 200 });
    runFor(w, 0.3);
    expect(w.ball.vx).toBeLessThan(0);
    expect(w.events.goal).toBeNull();
  });

  it('remembers the last kick: who, what, PERFECT or not, and where', () => {
    const w = keeperWorld();
    Object.assign(w.home, { x: 1000, z: 64, facing: 1 });
    setBall(w, { x: 1008, z: 64 });
    runUntil(w, 2, w => w.keepers!.strike !== null, w => ({ ...NO_INTENT, shootHeld: w.match.clockS < 0.3 }));
    expect(w.keepers!.strike).toMatchObject({ team: 'home', kind: 'shot' });
  });
});
