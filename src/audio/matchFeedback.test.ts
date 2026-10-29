import { describe, expect, it } from 'vitest';
import type { ContactEvents } from '../game/contact';
import { BASE_STATS } from '../game/stats';
import { createWorld, type World } from '../game/world';
import { NO_INTENT, NORMAL_HANDLING, stepPlayer } from '../game/player';
import { SAM_HANDLING } from '../game/sam';
import { HARD_KICK_SPEED, WHOOSH, matchFeedback, speedMemo } from './matchFeedback';
import { quietTricks } from '../game/tricks';
import { keeperWorld } from '../game/testKeepers';

const quiet = (): ContactEvents => ({ touched: false, blocked: false, kicked: null, perfect: false, tackledBall: false, trippedOpponent: false });

/** A world in play with no events; `home` and `away` set that tick's contact events. */
function world(home: Partial<ContactEvents> = {}, away: Partial<ContactEvents> = {}): World {
  const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
  w.match.phase = 'playing';
  w.events.kicks = [
    { ...quiet(), ...home },
    { ...quiet(), ...away },
  ];
  return w;
}

const ballSpeed = (w: World, speed: number) => Object.assign(w.ball, { vx: speed * 0.6, vy: 0, vz: speed * 0.8 });

describe('matchFeedback', () => {
  it('a hard kick by Harrison plays kickHard and rumbles', () => {
    const w = world({ touched: true, kicked: 'shot' });
    ballSpeed(w, HARD_KICK_SPEED);
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['kickHard'], rumble: ['hardShot'] });
  });

  it("Max's hard kick plays kickHard without rumble", () => {
    const w = world({}, { touched: true, kicked: 'shot' });
    ballSpeed(w, HARD_KICK_SPEED + 50);
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['kickHard'], rumble: [] });
  });

  it('a soft kick plays kickSoft without rumble', () => {
    const w = world({ touched: true, kicked: 'chip' });
    ballSpeed(w, HARD_KICK_SPEED - 1);
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['kickSoft'], rumble: [] });
  });

  it('a dribble touch plays tap', () => {
    expect(matchFeedback(world({ touched: true }), 'playing')).toEqual({ cues: ['tap'], rumble: [] });
  });

  it('a PERFECT strike plays its chime', () => {
    const w = world({ touched: true, kicked: 'shot', perfect: true });
    ballSpeed(w, HARD_KICK_SPEED);
    expect(matchFeedback(w, 'playing').cues).toEqual(['kickHard', 'perfect']);
  });

  it('a tackle by either side thuds and rumbles, once', () => {
    expect(matchFeedback(world({ tackledBall: true }), 'playing')).toEqual({ cues: ['tackle'], rumble: ['tackle'] });
    expect(matchFeedback(world({}, { trippedOpponent: true, tackledBall: true }), 'playing')).toEqual({ cues: ['tackle'], rumble: ['tackle'] });
  });

  it('a bounce plays bounce', () => {
    const w = world();
    w.events.ball.bounced = true;
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['bounce'], rumble: [] });
  });

  it('the post or bar clangs, the crowd oohs, and it rumbles', () => {
    for (const hit of ['hitPost', 'hitBar'] as const) {
      const w = world();
      w.events.ball[hit] = true;
      expect(matchFeedback(w, 'playing'), hit).toEqual({ cues: ['post', 'ooh'], rumble: ['post'] });
    }
  });

  it('the fence thuds', () => {
    const w = world();
    w.events.ball.hitWall = true;
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['fence'], rumble: [] });
  });

  it('a resting ball against the net makes no sound', () => {
    const w = world();
    w.events.ball.hitNet = true;
    expect(matchFeedback(w, 'playing')).toEqual({ cues: [], rumble: [] });
  });

  it("Harrison's goal swishes the net, the crowd roars, and it rumbles long", () => {
    const w = world();
    w.events.goal = 'home';
    w.match.phase = 'goal';
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['net', 'roar'], rumble: ['goal'] });
  });

  it("Max's goal swishes the net, the crowd groans, and it rumbles weakly", () => {
    const w = world();
    w.events.goal = 'away';
    w.match.phase = 'goal';
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['net', 'groan'], rumble: ['maxGoal'] });
  });

  it('play starting from a kickoff blows a short whistle', () => {
    expect(matchFeedback(world(), 'kickoff').cues).toEqual(['whistleShort']);
    expect(matchFeedback(world(), 'playing').cues).toEqual([]);
  });

  it('full time blows the long whistle once', () => {
    const w = world();
    w.match.phase = 'fullTime';
    expect(matchFeedback(w, 'playing').cues).toEqual(['whistleFull']);
    expect(matchFeedback(w, 'fullTime').cues).toEqual([]);
  });
});

describe('matchFeedback: the power-up', () => {
  const powered = (flags: Partial<World['events']['power']>): World => {
    const w = world();
    w.events.power = { started: false, ready: false, cancelled: false, fired: false, braced: false, blown: false, ...flags };
    return w;
  };

  it('starting a power-up hums, gasps and rumbles', () => {
    expect(matchFeedback(powered({ started: true }), 'playing')).toEqual({ cues: ['powerUp', 'ooh'], rumble: ['powerOn'] });
  });

  it('firing blasts, roars and rumbles hard', () => {
    expect(matchFeedback(powered({ fired: true }), 'playing')).toEqual({ cues: ['waveBlast', 'beam'], rumble: ['wave'] });
  });

  it('a brace thuds and rumbles', () => {
    expect(matchFeedback(powered({ braced: true }), 'playing')).toEqual({ cues: ['brace'], rumble: ['brace'] });
  });

  it('Max blown away whooshes', () => {
    expect(matchFeedback(powered({ blown: true }), 'playing')).toEqual({ cues: ['whoosh'], rumble: [] });
  });

  it('a cancelled power-up fizzles', () => {
    expect(matchFeedback(powered({ cancelled: true }), 'playing').cues).toEqual(['fizzle']);
  });

  it('the wave becoming ready chimes and pulses: shoot now', () => {
    expect(matchFeedback(powered({ ready: true }), 'playing')).toEqual({ cues: ['powerReady'], rumble: ['ready'] });
  });
});

describe('matchFeedback with Biscuit', () => {
  it('a grab barks instead of tapping, a pant pants', () => {
    const w = world({}, { touched: true });
    w.events.dog.grabbed = true;
    expect(matchFeedback(w, 'playing').cues).toEqual(['bark']);
    const p = world();
    p.events.dog.panted = true;
    expect(matchFeedback(p, 'playing').cues).toEqual(['pant']);
  });

  it('knocking the ball out of his mouth is a tackle', () => {
    const w = world({ tackledBall: true });
    w.events.dog.dropped = true;
    expect(matchFeedback(w, 'playing')).toEqual({ cues: ['tackle'], rumble: ['tackle'] });
  });
});

describe("Sam's whoosh and skid", () => {
  /** Harrison standing at x 300; the away player at `x`, `dz` off his line, running left at `speed`, with `handling`. */
  function passing(x: number, speed: number, handling = SAM_HANDLING, dz = 6): World {
    const w = world();
    Object.assign(w.home, { x: 300, z: 32 });
    Object.assign(w.away, { x, z: 32 + dz, vx: -speed, handling });
    return w;
  }

  it('flying past Harrison close by cues whoosh once, and not again inside the cooldown', () => {
    const memo = speedMemo();
    expect(matchFeedback(passing(304, 200), 'playing', memo).cues).toContain('whoosh');
    const again = passing(296, 200);
    again.tick += 10;
    expect(matchFeedback(again, 'playing', memo).cues).not.toContain('whoosh');
    const later = passing(304, 200);
    later.tick += Math.ceil(WHOOSH.cooldownS * 60) + 1;
    expect(matchFeedback(later, 'playing', memo).cues).toContain('whoosh');
  });

  it('no whoosh going by slowly, or wide of him', () => {
    expect(matchFeedback(passing(304, WHOOSH.speed - 20), 'playing', speedMemo()).cues).not.toContain('whoosh');
    expect(matchFeedback(passing(304, 200, SAM_HANDLING, WHOOSH.within + 6), 'playing', speedMemo()).cues).not.toContain('whoosh');
  });

  it("the skid's first tick cues skid, and only that tick", () => {
    const w = passing(400, 210);
    stepPlayer(w.away, { ...NO_INTENT, moveX: 1 }, 1 / 60, w.field, false);
    expect(w.away.anim.name).toBe('skid');
    expect(matchFeedback(w, 'playing', speedMemo()).cues).toContain('skid');
    stepPlayer(w.away, { ...NO_INTENT, moveX: 1 }, 1 / 60, w.field, false);
    expect(matchFeedback(w, 'playing', speedMemo()).cues).not.toContain('skid');
  });

  it('Max doing the same cues neither', () => {
    expect(matchFeedback(passing(304, 200, NORMAL_HANDLING), 'playing', speedMemo()).cues).not.toContain('whoosh');
    const w = passing(400, 210, NORMAL_HANDLING);
    stepPlayer(w.away, { ...NO_INTENT, moveX: 1 }, 1 / 60, w.field, false);
    expect(matchFeedback(w, 'playing', speedMemo()).cues).not.toContain('skid');
  });
});

describe('trick feedback', () => {
  const tricked = (trick: Partial<ReturnType<typeof quietTricks>>) => {
    const w = world();
    w.events.trick = { ...quietTricks(), ...trick };
    return matchFeedback(w, 'playing').cues;
  };

  it("a stepover's start swishes", () => {
    expect(tricked({ started: 'stepover' })).toContain('stepover');
  });

  it("a flick's release pops", () => {
    expect(tricked({ released: true })).toContain('flick');
  });

  it('a trick that fools someone gets the crowd\'s ooh', () => {
    expect(tricked({ fooled: 'stepover' })).toContain('ooh');
  });

  it('a trick that fools nobody gets no ooh', () => {
    expect(tricked({ started: 'stepover' })).not.toContain('ooh');
    expect(tricked({ released: true })).not.toContain('ooh');
  });
});

describe('keepers', () => {
  it("a keeper's catch thumps, a dive rushes, a push slaps and a drop kick thuds", () => {
    const w = keeperWorld();
    w.events.keeper = { caught: 'away', dived: 'home', pushed: 'home', punted: 'away' };
    expect(matchFeedback(w, 'playing').cues).toEqual(expect.arrayContaining(['glove', 'dive', 'parry', 'punt']));
  });
});
