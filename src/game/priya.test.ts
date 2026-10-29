import { describe, expect, it } from 'vitest';
import type { AiBrain } from './ai';
import { POACH } from './priya';
import { kidWorld, stepKid } from './testTryouts';
import { runFor, setBall, shotAt } from './testKeepers';
import type { World } from './world';

const STEP = 1 / 60;
const VARIANTS = [...Array(16)].map((_, i) => i);
/** Harrison parked out in front of his goal, facing it. */
const PARK = { out: 120, z: 64 };
/** The shot at his keeper: from this far out, this fast, this far off his middle, so he can't hold it. */
const HARD_SHOT = { out: 40, speed: 650, off: 14 };

type First = 'priya' | 'harrison' | 'keeper' | null;

/** Priya, or Max's brain at her stats, at the School in play; the ball out of everyone's way while Harrison's keeper sets. */
function setUp(i: number, asMax: boolean): { w: World; brain: AiBrain } {
  const { w, brain } = kidWorld('priya', { asMax, seed: 1 + i });
  setBall(w, { x: w.field.goals[0]!.lineX + 400, z: 10 });
  runFor(w, 0.5);
  return { w, brain };
}

/**
 * A hard shot from close in at the edge of Harrison's keeper's reach, which
 * he pushes away; Priya 70 px out, near the goal's middle at the variant's
 * depth, in the line of a shot she'd follow in; Harrison parked. Who plays
 * the ball first in the followS after the push, and whether Priya shoots in it.
 */
function afterPush(i: number, asMax = false): { pushed: boolean; first: First; shot: boolean } {
  const { w, brain } = setUp(i, asMax);
  const g = w.field.goals[0]!;
  Object.assign(w.away, { x: g.lineX + 70, z: 52 + 1.6 * i, facing: -1 });
  Object.assign(w.home, { x: g.lineX + PARK.out, z: PARK.z, facing: -1 });
  const k = w.keepers!.home;
  shotAt(w, { x: g.lineX + HARD_SHOT.out, z: k.body.z }, k.body.z + HARD_SHOT.off, HARD_SHOT.speed, 40, 'left');
  let pushed = false;
  for (let s = 0; s < 0.5 / STEP && !pushed; s++) {
    stepKid(w, brain, STEP);
    pushed = w.events.keeper.pushed === 'home';
  }
  let [first, shot] = [null as First, false];
  for (let s = 0; pushed && s < POACH.followS / STEP; s++) {
    stepKid(w, brain, STEP);
    const [h, a] = w.events.kicks;
    if (a?.kicked === 'shot') shot = true;
    if (first) continue;
    if (a && (a.touched || a.kicked)) first = 'priya';
    else if (h && (h.touched || h.kicked)) first = 'harrison';
    else if (k.holding) first = 'keeper';
  }
  return { pushed, first, shot };
}

/**
 * Priya standing on the ball 130 px out from Harrison's goal line, inside
 * her range, facing it, with Harrison parked far upfield; she shoots.
 * Whether, the tick after her kick, she's following it in.
 */
function followsHerShot(i: number, asMax = false): boolean {
  const { w, brain } = setUp(i, asMax);
  const g = w.field.goals[0]!;
  const z = 40 + 3 * i;
  Object.assign(w.away, { x: g.lineX + 138, z, facing: -1 });
  setBall(w, { x: g.lineX + 130, z });
  Object.assign(w.home, { x: 600, z: 124, facing: 1 });
  let kicked = false;
  for (let s = 0; s < 2 / STEP && !kicked; s++) {
    stepKid(w, brain, STEP);
    kicked = w.events.kicks[1]?.kicked === 'shot';
  }
  expect(kicked, `variant ${i}`).toBe(true);
  stepKid(w, brain, STEP);
  return brain.move?.kind === 'follow';
}

describe('Poacher Priya', () => {
  it("is first to a ball Harrison's keeper pushes away, and shoots", () => {
    const kid = VARIANTS.map(i => afterPush(i));
    const max = VARIANTS.map(i => afterPush(i, true));
    expect(kid.every(r => r.pushed)).toBe(true);
    expect(kid.filter(r => r.first === 'priya').length).toBeGreaterThanOrEqual(12);
    expect(kid.filter(r => r.shot).length).toBeGreaterThanOrEqual(10);
    expect(max.filter(r => r.first === 'priya').length).toBeLessThanOrEqual(kid.filter(r => r.first === 'priya').length / 2);
  });

  it('follows every shot of hers in, the moment she strikes it; Max never does', () => {
    for (const i of VARIANTS) {
      expect(followsHerShot(i), `variant ${i}`).toBe(true);
      expect(followsHerShot(i, true), `variant ${i}`).toBe(false);
    }
  });
});
