import { describe, expect, it } from 'vitest';
import { BALL_R } from '../art/ball';
import type { AiBrain, AiProfile } from './ai';
import { openCorner } from './aiming';
import { aimLine, type Aim } from './kick';
import { SNIPE } from './paige';
import { TRYOUT_PROFILES } from './tryouts';
import { NO_INTENT, PLAYER_R } from './player';
import { maxHasBall } from './steal';
import { kidWorld, stepKid } from './testTryouts';
import { runFor, setBall } from './testKeepers';
import type { World } from './world';

const STEP = 1 / 60;
const VARIANTS = [...Array(16)].map((_, i) => i);
/** Paige on the ball this far from Harrison's goal line: inside her range. */
const OUT = 120;
/** Harrison stands in her line this far ahead of the ball. */
const BLOCK = 40;
/** The ball moves less than this in a tick when it's still, px. */
const STILL_PX = 0.05;

/** Paige (or Max's brain at her stats, or `profile`) standing on the ball OUT px from Harrison's goal line at the variant's depth, facing it, with his keeper set for it; Harrison parked far upfield. */
function stage(i: number, asMax = false, profile?: AiProfile): { w: World; brain: AiBrain } {
  const { w, brain } = kidWorld('paige', { asMax, profile, seed: 1 + i });
  const g = w.field.goals[0]!;
  const z = 36 + 3.5 * i;
  Object.assign(w.away, { x: g.lineX + OUT + 8, z, facing: -1 });
  Object.assign(w.home, { x: g.lineX + OUT + 300, z: 10, facing: -1 });
  setBall(w, { x: g.lineX + OUT, z });
  runFor(w, 0.5);
  return { w, brain };
}

/** Harrison's body across the line from the ball to where `aim` crosses his goal: his centre within reach of it, between them. */
function blocks(w: World, aim: Aim): boolean {
  const g = w.field.goals[0]!;
  const line = aimLine(w.ball, -1, aim, w.field);
  const [dx, dz] = [g.lineX - w.ball.x, line.slope * Math.abs(g.lineX - w.ball.x)];
  const u = ((w.home.x - w.ball.x) * dx + (w.home.z - w.ball.z) * dz) / (dx * dx + dz * dz);
  if (u <= 0 || u >= 1) return false;
  return Math.hypot(w.ball.x + u * dx - w.home.x, w.ball.z + u * dz - w.home.z) <= PLAYER_R + BALL_R;
}

/** Where the ball, just kicked, crosses Harrison's goal line, in depth. */
function crossing(w: World): number {
  const g = w.field.goals[0]!;
  return w.ball.z + (w.ball.vz * (g.lineX - w.ball.x)) / w.ball.vx;
}

/** The depth of the post `aim` names. */
const postZ = (w: World, aim: Aim): number => (aim === 'far' ? w.field.goals[0]!.z1 : w.field.goals[0]!.z0);

interface Shot {
  /** The most she moved, and whether the ball stayed at her feet, over her set. */
  setMoved: number;
  setOnBall: boolean;
  /** The open corner as she began winding up; null if she never did. */
  open: Aim | null;
  /** Where her first shot crosses the line; null if she never shot. */
  z: number | null;
}

/** Up to 2 s of play from the stage: her set, her wind-up and her shot. */
function shoot(w: World, brain: AiBrain): Shot {
  const r: Shot = { setMoved: 0, setOnBall: true, open: null, z: null };
  const from = { x: w.away.x, z: w.away.z };
  for (let k = 0; k < 2 / STEP && r.z === null; k++) {
    const [was, open] = [w.away.state, openCorner(w, w.away)];
    stepKid(w, brain, STEP);
    if ((k + 1) * STEP <= SNIPE.setS) {
      r.setMoved = Math.max(r.setMoved, Math.hypot(w.away.x - from.x, w.away.z - from.z));
      if (!maxHasBall(w.away, w.ball)) r.setOnBall = false;
    }
    if (was !== 'charging' && w.away.state === 'charging') r.open = open;
    if (w.events.kicks[1]?.kicked === 'shot') r.z = crossing(w);
  }
  return r;
}

/** Its first shot's distance from the nearer post, px. */
function fromPost(w: World, z: number): number {
  const g = w.field.goals[0]!;
  return Math.min(Math.abs(z - g.z0), Math.abs(z - g.z1));
}

describe('Pinpoint Paige', () => {
  it('sets herself with the ball at her feet, then shoots for the corner away from the keeper', () => {
    let atPost = 0;
    for (const i of VARIANTS) {
      const { w, brain } = stage(i);
      const r = shoot(w, brain);
      expect(r.setMoved, `variant ${i}`).toBeLessThan(2);
      expect(r.setOnBall, `variant ${i}`).toBe(true);
      expect(r.z, `variant ${i}`).not.toBeNull();
      if (r.open && r.z !== null && Math.abs(r.z - postZ(w, r.open)) <= 10) atPost++;
    }
    expect(atPost).toBeGreaterThanOrEqual(12);
  });

  it("won't shoot through a Harrison standing in her line: she finds a clear look within lookS, or plays on", () => {
    for (const i of VARIANTS) {
      const { w, brain } = stage(i);
      // Harrison standing in her line to the open corner, facing her.
      const line = aimLine(w.ball, -1, openCorner(w, w.away), w.field);
      Object.assign(w.home, { x: w.ball.x - BLOCK, z: w.ball.z + line.slope * BLOCK, facing: 1 });
      let [decidedS, stillS, longestStillS] = [null as number | null, 0, 0];
      for (let k = 0; k < 3 / STEP; k++) {
        const ball = { x: w.ball.x, z: w.ball.z };
        const was = w.away.state;
        stepKid(w, brain, STEP);
        // A goal ends the play: the ball rests in the net through the pause.
        if (w.match.phase !== 'playing') break;
        const t = (k + 1) * STEP;
        if (was !== 'charging' && w.away.state === 'charging') {
          expect(blocks(w, brain.intent.aim), `variant ${i} at ${t.toFixed(2)} s`).toBe(false);
          decidedS ??= t;
        }
        if (brain.move === null || (brain.move.kind !== 'set' && brain.move.kind !== 'look')) decidedS ??= t;
        stillS = Math.hypot(w.ball.x - ball.x, w.ball.z - ball.z) < STILL_PX ? stillS + STEP : 0;
        longestStillS = Math.max(longestStillS, stillS);
      }
      expect(decidedS, `variant ${i}`).not.toBeNull();
      expect(decidedS!, `variant ${i}`).toBeLessThanOrEqual(SNIPE.setS + SNIPE.lookS + 3 * STEP);
      expect(longestStillS, `variant ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it("never undoes Harrison's touch: his play on her ball ends her set", () => {
    let touched = 0;
    for (const i of VARIANTS) {
      const { w, brain } = stage(i);
      // Harrison running onto the ball at her feet from in front.
      Object.assign(w.home, { x: w.ball.x - 30, z: w.ball.z, facing: 1 });
      let playedAt: number | null = null;
      for (let k = 0; k < SNIPE.setS / STEP && playedAt === null; k++) {
        stepKid(w, brain, STEP, { ...NO_INTENT, moveX: 1 });
        const h = w.events.kicks[0]!;
        if (h.touched || h.blocked || h.kicked || h.tackledBall) playedAt = k;
      }
      if (playedAt === null) continue;
      touched++;
      stepKid(w, brain, STEP, { ...NO_INTENT, moveX: 1 });
      expect(brain.move?.kind, `variant ${i}`).not.toBe('set');
      expect(brain.move?.kind, `variant ${i}`).not.toBe('look');
      // And he's in her line now: she plays on, but never winds up through him.
      for (let k = 0; k < 1 / STEP && w.match.phase === 'playing'; k++) {
        const was = w.away.state;
        stepKid(w, brain, STEP);
        if (was !== 'charging' && w.away.state === 'charging') expect(blocks(w, brain.intent.aim), `variant ${i}`).toBe(false);
      }
    }
    expect(touched).toBeGreaterThanOrEqual(12);
  });

  it('after his steal tap pokes her ball, she plays on, but never winds up through him', () => {
    let poked = 0;
    for (const i of VARIANTS) {
      // Never a clean steal, so his tap pokes it.
      const { w, brain } = stage(i, false, { ...TRYOUT_PROFILES.paige.normal, cleanSteal: 0 });
      // Harrison right in front of the ball at her feet, facing her; he taps steal as she sets.
      Object.assign(w.home, { x: w.ball.x - 10, z: w.ball.z, facing: 1 });
      for (let k = 0; k < 1.5 / STEP && w.match.phase === 'playing'; k++) {
        const was = w.away.state;
        stepKid(w, brain, STEP, { ...NO_INTENT, steal: k === 5 });
        if (w.events.steal === 'poked') poked++;
        if (was !== 'charging' && w.away.state === 'charging') expect(blocks(w, brain.intent.aim), `variant ${i}`).toBe(false);
      }
    }
    expect(poked).toBeGreaterThanOrEqual(12);
  });

  it('a poke in her wind-up unsettles her: she drops it without a kick', () => {
    let poked = 0;
    for (const i of VARIANTS) {
      const { w, brain } = stage(i, false, { ...TRYOUT_PROFILES.paige.normal, cleanSteal: 0 });
      for (let k = 0; k < 1 / STEP && w.away.state !== 'charging'; k++) stepKid(w, brain, STEP);
      stepKid(w, brain, 5 * STEP);
      // Harrison arrives right in front of the ball at her feet, and taps steal.
      Object.assign(w.home, { x: w.ball.x - 10, z: w.ball.z, facing: 1 });
      stepKid(w, brain, STEP, { ...NO_INTENT, steal: true });
      if (w.events.steal !== 'poked') continue;
      poked++;
      for (let k = 0; k < 0.25 / STEP; k++) {
        stepKid(w, brain, STEP);
        expect(w.events.kicks[1]?.kicked, `variant ${i}`).not.toBe('shot');
      }
    }
    expect(poked).toBeGreaterThanOrEqual(12);
  });

  it("Max's brain at her stats lands his shots further from the posts", () => {
    const meanFromPost = (asMax: boolean): number => {
      const ds = VARIANTS.map(i => {
        const { w, brain } = stage(i, asMax);
        const { z } = shoot(w, brain);
        expect(z, `variant ${i}`).not.toBeNull();
        return fromPost(w, z!);
      });
      return ds.reduce((a, b) => a + b, 0) / ds.length;
    };
    expect(meanFromPost(true)).toBeGreaterThan(meanFromPost(false));
  });
});
