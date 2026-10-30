import { BALL_R } from '../art/ball';
import { describe, expect, it } from 'vitest';
import { seeded } from '../engine/random';
import { BALL_REST_Y, stepBall, type Ball } from './ball';
import { KEEP_OUT_X, SIDE_CLEAR, TRAP_KEEP, resolveContacts } from './contact';
import { BACKYARD, goalScored } from './field';
import { POST_INSET, aimLine, header, shot } from './kick';
import { NO_INTENT, NORMAL_HANDLING, PLAYER_R, createPlayer, stepPlayer, type Kick, type Player } from './player';
import { BASE_STATS, touchPush } from './stats';
import { REACH_Z, touchPoint } from './zones';

const STEP = 1 / 60;
/** Touched about 14 px ahead, a base-control touch then rolls the ball on by up to 60²/(2·160) ≈ 11 px. */
const DRIBBLE_RANGE = 26;
const ball = (p: Partial<Ball>): Ball => ({ x: 320, y: BALL_REST_Y, z: BACKYARD.depth / 2, vx: 0, vy: 0, vz: 0, spin: 0, spinAngle: 0, ...p });
const kick = (k: Partial<Kick>): Kick => ({ kind: 'shot', charge: 0.6, overchargeS: 0, aim: 'straight', active: true, ...k });

function setup(x = 300): { p: Player; opp: Player } {
  return { p: createPlayer('home', BASE_STATS, x, 1), opp: createPlayer('away', BASE_STATS, 500, -1) };
}

const contact = (p: Player, opp: Player, b: Ball) => resolveContacts(p, opp, b, 4, seeded(5), BACKYARD);

describe('resolveContacts: kicks', () => {
  it('an active shot in reach kicks the ball with shot maths', () => {
    const { p, opp } = setup();
    p.state = 'kicking';
    p.kick = kick({});
    const b = ball({ x: 308 });
    const ev = contact(p, opp, b);
    const expected = shot(BASE_STATS, 0.6, 0, { facing: 1, slope: 0 }, 4, seeded(5));
    expect(b.vx).toBe(expected.vx);
    expect(b.vy).toBe(expected.vy);
    expect(ev.kicked).toBe('shot');
    expect(ev.perfect).toBe(false);
  });

  it('reports a perfect shot', () => {
    const { p, opp } = setup();
    p.state = 'kicking';
    p.kick = kick({ charge: 0.88 });
    expect(contact(p, opp, ball({ x: 308 })).perfect).toBe(true);
  });

  it('a whiffed kick (ball out of reach) does nothing', () => {
    const { p, opp } = setup();
    p.state = 'kicking';
    p.kick = kick({});
    const b = ball({ x: 330 });
    const ev = contact(p, opp, b);
    expect([b.vx, b.vy]).toEqual([0, 0]);
    expect(ev.kicked).toBeNull();
  });

  it('a chip lofts the ball', () => {
    const { p, opp } = setup();
    p.state = 'chipping';
    p.kick = kick({ kind: 'chip', charge: 1 });
    const b = ball({ x: 308 });
    expect(contact(p, opp, b).kicked).toBe('chip');
    expect(b.vy).toBeGreaterThan(b.vx);
  });

  it('a volley strikes a ball at foot height in the air', () => {
    const { p, opp } = setup();
    p.state = 'air';
    p.y = 15;
    p.kick = kick({ kind: 'volley' });
    const b = ball({ x: 308, y: 20, vy: -100 });
    expect(contact(p, opp, b).kicked).toBe('volley');
    expect(b.vx).toBeGreaterThan(200);
  });

  it('each kick connects once per swing', () => {
    const { p, opp } = setup();
    p.state = 'kicking';
    p.kick = kick({});
    const b = ball({ x: 308 });
    const first = contact(p, opp, b);
    b.x = 308;
    const second = contact(p, opp, b);
    expect([first.kicked, second.kicked]).toEqual(['shot', null]);
  });
});

describe('resolveContacts: dribbling and blocking', () => {
  it('running into the ball dribbles it ahead with the control stat push', () => {
    const { p, opp } = setup();
    p.vx = 95;
    const b = ball({ x: 307 });
    const ev = contact(p, opp, b);
    expect(b.vx).toBe(95 + touchPush(BASE_STATS));
    expect(ev.touched).toBe(true);
  });

  it('a dribble touch records the line it sent the ball along', () => {
    const { p, opp } = setup();
    [p.vx, p.vz] = [60, 80];
    contact(p, opp, ball({ x: p.x + 4.2, z: p.z + 5.6 }));
    expect(p.dribbleLine!.x).toBeCloseTo(0.6, 9);
    expect(p.dribbleLine!.z).toBeCloseTo(0.8, 9);
  });

  it('waits out the touch cooldown between dribble touches', () => {
    const { p, opp } = setup();
    p.vx = 95;
    contact(p, opp, ball({ x: 307 }));
    const b = ball({ x: 307 });
    expect(contact(p, opp, b).touched).toBe(false);
    for (let i = 0; i < 8; i++) stepPlayer(p, { ...NO_INTENT, moveX: 1 }, STEP, BACKYARD, false);
    p.x = 300;
    expect(contact(p, opp, ball({ x: 307 })).touched).toBe(true);
  });

  it('a still player blocks a rolling ball instead of letting it pass through', () => {
    const { p, opp } = setup();
    const b = ball({ x: 250, vx: 200 });
    for (let t = 0; t < 60; t++) {
      stepBall(b, STEP, BACKYARD);
      contact(p, opp, b);
    }
    expect(b.x).toBeLessThan(300);
  });

  it('a ball blocked from behind stays behind him', () => {
    const { p, opp } = setup();
    const b = ball({ x: 360, vx: -250 });
    for (let t = 0; t < 60; t++) {
      stepBall(b, STEP, BACKYARD);
      contact(p, opp, b);
    }
    expect(b.x).toBeGreaterThan(300);
  });
});

describe('resolveContacts: headers and tackles', () => {
  it('an airborne player heads a dropping ball, aimed by the stick', () => {
    const { p, opp } = setup();
    p.state = 'air';
    p.y = 10;
    p.aim = 'far';
    const b = ball({ x: 303, y: 47, vx: -50, vy: -100 });
    const ev = contact(p, opp, b);
    expect(ev.kicked).toBe('header');
    expect(b.vy).toBeGreaterThan(0);
    expect(b.vx).toBeCloseTo(header(BASE_STATS, aimLine(b, 1, 'far', BACKYARD), Math.hypot(50, 100)).vx);
    expect(p.kick?.kind).toBe('header');
  });

  it("header speed counts the ball's depth speed", () => {
    const { p, opp } = setup();
    p.state = 'air';
    p.y = 10;
    const b = ball({ x: 303, y: 47, vx: -400, vy: 0, vz: 300 });
    const want = header(BASE_STATS, aimLine(b, 1, 'straight', BACKYARD), Math.hypot(400, 0, 300));
    expect(contact(p, opp, b).kicked).toBe('header');
    expect(Math.hypot(b.vx, b.vy, b.vz)).toBeCloseTo(Math.hypot(want.vx, want.vy, want.vz));
  });

  it('does not head a fast ball flying away from him', () => {
    const { p, opp } = setup();
    p.state = 'air';
    p.y = 10;
    const b = ball({ x: 303, y: 47, vx: 400 });
    expect(contact(p, opp, b).kicked).toBeNull();
  });

  it('a slide tackle knocks the ball away', () => {
    const { p, opp } = setup();
    p.state = 'sliding';
    p.kick = kick({ kind: 'slide' });
    const b = ball({ x: 310 });
    const ev = contact(p, opp, b);
    expect([b.vx, b.vy]).toEqual([220, 80]);
    expect(ev.tackledBall).toBe(true);
  });

  it('a Harrison slide facing his own goal that wins the ball clears it sideways and upfield', () => {
    for (const [z, side] of [[20, -1], [44, 1]] as const) {
      const { p, opp } = setup();
      Object.assign(p, { state: 'sliding', facing: -1, kick: kick({ kind: 'slide' }) });
      const b = ball({ x: 290, z });
      p.z = z;
      const ev = resolveContacts(p, opp, b, 4, seeded(5), BACKYARD, { trips: true, squeeze: true, clearUpfield: true });
      expect(ev.tackledBall).toBe(true);
      expect([b.vx, b.vy, b.vz]).toEqual([SIDE_CLEAR.vx, 80, side * SIDE_CLEAR.vz]);
    }
  });

  it('facing the goal he attacks, or without the side-clear, a slide plays as before', () => {
    const { p, opp } = setup();
    Object.assign(p, { state: 'sliding', kick: kick({ kind: 'slide' }) });
    const ahead = ball({ x: 310 });
    resolveContacts(p, opp, ahead, 4, seeded(5), BACKYARD, { trips: true, squeeze: true, clearUpfield: true });
    expect([ahead.vx, ahead.vz]).toEqual([220, 0]);
    Object.assign(p, { facing: -1, kick: kick({ kind: 'slide' }) });
    const back = ball({ x: 290 });
    contact(p, opp, back);
    expect([back.vx, back.vz]).toEqual([-220, 0]);
  });

  it('near his own goal, Harrison running at it shields the ball instead of knocking it on', () => {
    const { p, opp } = setup(28 + KEEP_OUT_X - 20);
    Object.assign(p, { vx: -120, facing: -1 });
    const b = ball({ x: p.x - 7 });
    const ev = resolveContacts(p, opp, b, 4, seeded(5), BACKYARD, { trips: true, squeeze: true, clearUpfield: true, keepOut: true });
    expect(ev.touched).toBe(true);
    expect(p.vx).toBeCloseTo(-120 * TRAP_KEEP);
    expect(b.vx).toBeCloseTo(p.vx);
  });

  it('away from his goal, running away from it, or without keep-out, a running touch knocks it on as before', () => {
    const cases = [
      { x: 300, vx: -120, keepOut: true },
      { x: 28 + KEEP_OUT_X - 20, vx: 120, keepOut: true },
      { x: 28 + KEEP_OUT_X - 20, vx: -120, keepOut: false },
    ];
    for (const c of cases) {
      const { p, opp } = setup(c.x);
      Object.assign(p, { vx: c.vx, facing: Math.sign(c.vx) });
      const b = ball({ x: p.x + Math.sign(c.vx) * 7 });
      resolveContacts(p, opp, b, 4, seeded(5), BACKYARD, { trips: true, squeeze: true, keepOut: c.keepOut });
      expect(p.vx, JSON.stringify(c)).toBe(c.vx);
      expect(Math.abs(b.vx), JSON.stringify(c)).toBeGreaterThan(Math.abs(c.vx));
    }
  });

  it('a slide tackle that misses the ball trips the opponent', () => {
    const { p, opp } = setup();
    p.state = 'sliding';
    p.kick = kick({ kind: 'slide' });
    opp.x = 312;
    const ev = contact(p, opp, ball({ x: 400 }));
    expect(opp.state).toBe('fallen');
    expect(ev.trippedOpponent).toBe(true);
  });

  it('cannot trip an opponent who is in the air', () => {
    const { p, opp } = setup();
    p.state = 'sliding';
    p.kick = kick({ kind: 'slide' });
    opp.x = 312;
    opp.y = 20;
    opp.state = 'air';
    contact(p, opp, ball({ x: 400 }));
    expect(opp.state).toBe('air');
  });
});

describe('resolveContacts: pinned ball', () => {
  it('a ball pinned between a player and the fence pops free', () => {
    const { p, opp } = setup(BACKYARD.fenceR - PLAYER_R);
    p.z = 8;
    p.vx = 40;
    const b = ball({ x: BACKYARD.fenceR - BALL_R, z: 8 });
    contact(p, opp, b);
    expect(b.vy).toBe(160);
  });

  it('a pinned ball pops out toward the open pitch, not straight back into the pocket', () => {
    const { p, opp } = setup(BACKYARD.fenceL + PLAYER_R);
    p.z = 13;
    const b = ball({ x: 7.2, z: 15 });
    contact(p, opp, b);
    expect(b.vy).toBeGreaterThan(0);
    expect(b.vx).toBeGreaterThan(0);
    for (let t = 0; t < 120; t++) {
      stepBall(b, STEP, BACKYARD);
      contact(p, opp, b);
    }
    expect(Math.hypot(b.x - 7.2, b.z - 15)).toBeGreaterThan(15);
  });

  it('a body push never puts the ball outside the field', () => {
    for (const [px, pz, bx, bz] of [
      [BACKYARD.fenceR - PLAYER_R, PLAYER_R, BACKYARD.fenceR - BALL_R, BALL_R],
      [BACKYARD.fenceL + PLAYER_R, BACKYARD.depth - PLAYER_R, BACKYARD.fenceL + BALL_R + 1, BACKYARD.depth - BALL_R],
      [300, PLAYER_R, 302, BALL_R],
    ] as const) {
      const { p, opp } = setup(px);
      p.z = pz;
      [p.vx, p.vz] = [Math.sign(bx - px) * 90, Math.sign(bz - pz) * 90];
      const b = ball({ x: bx, z: bz, vx: -p.vx, vz: -p.vz });
      contact(p, opp, b);
      expect(b.x).toBeGreaterThanOrEqual(BACKYARD.fenceL + BALL_R);
      expect(b.x).toBeLessThanOrEqual(BACKYARD.fenceR - BALL_R);
      expect(b.z).toBeGreaterThanOrEqual(BALL_R);
      expect(b.z).toBeLessThanOrEqual(BACKYARD.depth - BALL_R);
    }
  });

  it('a body never pushes the ball through the side netting into the goal', () => {
    const { p, opp } = setup(620);
    p.z = 18 - PLAYER_R - PLAYER_R;
    p.vz = 90;
    const b = ball({ x: 620, z: 18 - BALL_R });
    for (let t = 0; t < 120; t++) {
      contact(p, opp, b);
      stepBall(b, STEP, BACKYARD);
      expect(goalScored(BACKYARD, b)).toBeNull();
      expect(b.z).toBeLessThanOrEqual(18 - BALL_R + 1e-6);
    }
  });

  it('a ball resting on the net roof is out of reach of a body beside the goal', () => {
    const { p, opp } = setup(618);
    p.z = 13;
    const b = ball({ x: 620, y: 33, z: 20, vx: -20 });
    contact(p, opp, b);
    expect([b.x, b.z, b.vx, b.vy]).toEqual([620, 20, -20, 0]);
  });

  it('a ball squeezed between two players pops up over their heads and squirts out to one side of them', () => {
    const { p, opp } = setup(300);
    opp.x = 313;
    const b = ball({ x: 306.5, vx: 50 });
    contact(p, opp, b);
    expect((b.vy * b.vy) / (2 * 900)).toBeGreaterThan(40);
    expect(Math.abs(b.vz)).toBeGreaterThan(0);
  });

  it('a squirted ball leaves between the two bodies without bouncing off either', () => {
    const { p, opp } = setup(300);
    opp.x = 310;
    const b = ball({ x: 305 });
    contact(p, opp, b);
    const vz = b.vz;
    for (let t = 0; t < 20; t++) {
      stepBall(b, STEP, BACKYARD);
      contact(p, opp, b);
      contact(opp, p, b);
    }
    expect(Math.sign(b.vz)).toBe(Math.sign(vz));
    expect(Math.abs(b.z - p.z)).toBeGreaterThan(PLAYER_R + BALL_R);
  });
});

describe('resolveContacts: depth', () => {
  it('touches a ball up to REACH_Z off his line', () => {
    const { p, opp } = setup();
    p.vx = 95;
    const b = ball({ x: 307, z: p.z + 6 });
    expect(contact(p, opp, b).touched).toBe(true);
    expect(b.vx).toBeGreaterThan(95);
  });

  it('misses a ball beyond REACH_Z', () => {
    const { p, opp } = setup();
    p.vx = 95;
    const b = ball({ x: 307, z: p.z + REACH_Z + BALL_R + 1 });
    expect(contact(p, opp, b).touched).toBe(false);
    expect(b.vx).toBe(0);
  });

  it('kicks reach REACH_Z either side of his line', () => {
    const { p, opp } = setup();
    p.state = 'kicking';
    p.kick = kick({});
    expect(contact(p, opp, ball({ x: 308, z: p.z - REACH_Z })).kicked).toBe('shot');
    p.kick = kick({});
    expect(contact(p, opp, ball({ x: 308, z: p.z - REACH_Z - BALL_R - 1 })).kicked).toBeNull();
  });

  it('dribbles on a diagonal and keeps the ball', () => {
    for (const [x, z, dx, dz] of [
      [100, 5, 1, 0.7],
      [500, 59, -1, -0.7],
    ] as const) {
      const p = createPlayer('home', BASE_STATS, x, dx > 0 ? 1 : -1, z);
      const opp = createPlayer('away', BASE_STATS, 320, -1, 60);
      const run = { ...NO_INTENT, moveX: dx, moveZ: dz };
      for (let i = 0; i < 8; i++) stepPlayer(p, run, STEP, BACKYARD, false);
      const tp = touchPoint(p)!;
      const b = ball({ x: tp.x, z: tp.z });
      const len = Math.hypot(dx, dz);
      let touches = 0;
      // The pitch is only 64 deep: this diagonal reaches the far side in under a second.
      for (let t = 0; t < 0.6 / STEP; t++) {
        stepPlayer(p, run, STEP, BACKYARD, false);
        stepBall(b, STEP, BACKYARD);
        if (resolveContacts(p, opp, b, 4, seeded(5), BACKYARD).touched) touches++;
        const [ox, oz] = [b.x - p.x, b.z - p.z];
        // As close as Plan 2's dribble: touched within about 14 px ahead, then rolled on by the touch.
        expect(Math.hypot(ox, oz), `run (${dx}, ${dz}) tick ${t}`).toBeLessThanOrEqual(DRIBBLE_RANGE);
        expect(Math.abs(ox * dz - oz * dx) / len, `off his line, tick ${t}`).toBeLessThanOrEqual(REACH_Z);
      }
      expect(touches).toBeGreaterThanOrEqual(1);
    }
  });

  it('a shot aimed far heads for the far post', () => {
    const { p, opp } = setup();
    p.state = 'kicking';
    p.kick = kick({ charge: 0.88, aim: 'far' });
    const b = ball({ x: 308 });
    contact(p, opp, b);
    expect(b.vz).toBeGreaterThan(0);
    const arrival = b.z + (b.vz / b.vx) * (612 - b.x);
    expect(arrival).toBeCloseTo(46 - POST_INSET);
  });

  it('a header aimed near heads for the near post', () => {
    const { p, opp } = setup();
    p.state = 'air';
    p.y = 10;
    p.aim = 'near';
    const b = ball({ x: 303, y: 47, vx: -50, vy: -100 });
    contact(p, opp, b);
    expect(b.vz).toBeLessThan(0);
  });

  it('the body blocks a ball rolling in on a diagonal and never lets it through', () => {
    for (const [x, z, vx, vz] of [
      [260, 12, 200, 100],
      [340, 52, -200, -100],
      [300, 0 + BALL_R, 0, 180],
      [230, 32, 700, 0],
    ] as const) {
      const { p, opp } = setup();
      const b = ball({ x, z, vx, vz });
      const incoming = [vx, vz];
      for (let t = 0; t < 60; t++) {
        stepBall(b, STEP, BACKYARD);
        contact(p, opp, b);
        expect(Math.hypot(b.x - p.x, b.z - p.z), `from (${x}, ${z}) tick ${t}`).toBeGreaterThanOrEqual(PLAYER_R + BALL_R - 1e-6);
      }
      expect((b.x - p.x) * incoming[0]! + (b.z - p.z) * incoming[1]!).toBeLessThan(0);
    }
  });
});

describe('resolveContacts: handling', () => {
  it("a long touch pushes the ball on by touchScale times his control's push", () => {
    const { p, opp } = setup();
    p.handling = { ...NORMAL_HANDLING, touchScale: 1.9 };
    p.vx = 212;
    const b = ball({ x: 307 });
    contact(p, opp, b);
    expect(b.vx).toBeCloseTo(212 + 1.9 * touchPush(BASE_STATS), 9);
  });

  it('a weak shot leaves at shotScale of the normal speed, on the same line', () => {
    const strike = (shotScale: number) => {
      const { p, opp } = setup();
      p.handling = { ...NORMAL_HANDLING, shotScale };
      p.state = 'kicking';
      p.kick = kick({ charge: 1 });
      const b = ball({ x: 308 });
      contact(p, opp, b);
      return b;
    };
    const [normal, weak] = [strike(1), strike(0.55)];
    expect(Math.hypot(weak.vx, weak.vy, weak.vz)).toBeCloseTo(0.55 * Math.hypot(normal.vx, normal.vy, normal.vz), 9);
    expect(weak.vy / weak.vx).toBeCloseTo(normal.vy / normal.vx, 9);
  });
});

describe('resolveContacts: blocks', () => {
  it('reports a ball bouncing off his body as a block, and a still player touching nothing as none', () => {
    const { p, opp } = setup();
    const b = ball({ x: 250, vx: 200 });
    let blocked = false;
    for (let t = 0; t < 60 && !blocked; t++) {
      stepBall(b, STEP, BACKYARD);
      blocked = contact(p, opp, b).blocked;
    }
    expect(blocked).toBe(true);
    expect(contact(p, opp, ball({ x: 400 })).blocked).toBe(false);
  });
});
