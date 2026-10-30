import { describe, expect, it } from 'vitest';
import { DIVE_FRAMES } from '../art/keepers/poses';
import { keeperProfile, quietKeepers, startHold, type Keeper } from '../game/keeper';
import { keeperWorld, runFor } from '../game/testKeepers';
import type { World } from '../game/world';
import { BIG_VIEW, project } from '../game/camera';
import type { KeeperSprites } from './art';
import { CLAP_S, drawKeeperShadows, keeperDrawables, keeperFrame, keeperLooks } from './keeperView';
import { fakeArt, type Named } from './testDraw';

const k = (o: Partial<Keeper>): Keeper => ({ ...keeperWorld().keepers!.away, ...o });

describe('keeperFrame', () => {
  it('set and still he shows the ready crouch; moving, the shuffle', () => {
    expect(keeperFrame(k({}), 0)).toMatchObject({ kind: 'pose', name: 'ready' });
    const moving = k({});
    moving.body.vz = 60;
    expect(keeperFrame(moving, 0)).toMatchObject({ kind: 'pose', name: 'shuffle' });
  });

  it('a dive toward the far post shows the far dive, launching then stretched', () => {
    const p = keeperProfile(1, 'normal');
    expect(keeperFrame(k({ act: 'dive', actT: 0, dive: { dirX: 0, dirZ: 1 } }), 0)).toEqual({ kind: 'dive', toward: 'far', frame: 0 });
    expect(keeperFrame(k({ act: 'dive', actT: p.diveS * 0.9, dive: { dirX: 0, dirZ: 1 } }), 0)).toEqual({ kind: 'dive', toward: 'far', frame: 1 });
  });

  it('a smother shows the smother; lying down holds the last frame; getting up runs its pose', () => {
    expect(keeperFrame(k({ act: 'dive', actT: 0, dive: { dirX: -1, dirZ: 0 } }), 0)).toMatchObject({ kind: 'pose', name: 'smother' });
    expect(keeperFrame(k({ act: 'down', dive: { dirX: 0, dirZ: -1 } }), 0)).toEqual({ kind: 'dive', toward: 'near', frame: DIVE_FRAMES - 1 });
    expect(keeperFrame(k({ act: 'getUp', actT: 0 }), 0)).toMatchObject({ kind: 'pose', name: 'getUp', frame: 0 });
  });

  it('fooled by a stepover, his wrong-way dive shows as a dive, not a frozen run frame', () => {
    const fooled = k({ act: 'dive', actT: 0, dive: { dirX: 0, dirZ: 1 } });
    fooled.body.fooled = { kind: 'confused', leftS: 0.5, totalS: 0.7, swayZ: 72 };
    expect(keeperFrame(fooled, 0)).toEqual({ kind: 'dive', toward: 'far', frame: 0 });
  });

  it('holding he shows the catch first, then the hold', () => {
    expect(keeperFrame(k({ act: 'hold', holding: true, pose: { name: 'catch', leftS: 0.1 } }), 0)).toMatchObject({ name: 'catch' });
    expect(keeperFrame(k({ act: 'hold', holding: true, pose: null }), 0)).toMatchObject({ name: 'hold' });
  });
});

describe('keeperLooks', () => {
  it("Eddie keeps Harrison's goal; the backups take turns in theirs", () => {
    expect(keeperLooks({ kind: 'match', rung: 1, opponent: 'max' })).toEqual({ home: 'eddie', away: 'backupA' });
    expect(keeperLooks({ kind: 'match', rung: 2, opponent: 'hank' })).toEqual({ home: 'eddie', away: 'backupB' });
  });

  it("Goalie Gus keeps their goal in his own match", () => {
    expect(keeperLooks({ kind: 'boss', rung: 0, opponent: 'gus' })).toEqual({ home: 'eddie', away: 'gus' });
  });
});

describe("Gus's glove clap", () => {
  const STEP = 1 / 60;
  /** A keeper getting up from a dive with the ball, a tick from his hold. */
  function gettingUpWithIt(w: World, k: Keeper): void {
    Object.assign(k, { act: 'getUp', actT: k.profile.getUpS - STEP / 2, holding: true, dive: { dirX: 0, dirZ: 1 } });
    runFor(w, STEP);
    expect(k.act).toBe('hold');
  }

  it('held after a dive, his hold opens with the clap, then the plain hold', () => {
    const w = keeperWorld({ gus: true });
    const gus = w.keepers!.away;
    gettingUpWithIt(w, gus);
    runFor(w, 0.1);
    expect(keeperFrame(gus, 0)).toMatchObject({ kind: 'pose', name: 'clap' });
    runFor(w, 0.5);
    expect(keeperFrame(gus, 0)).toMatchObject({ kind: 'pose', name: 'hold' });
  });

  it('caught standing, he shows the catch, then the clap, then the plain hold', () => {
    const w = keeperWorld({ gus: true });
    const gus = w.keepers!.away;
    startHold(w, gus, quietKeepers(), true);
    runFor(w, 0.1);
    expect(keeperFrame(gus, 0)).toMatchObject({ name: 'catch' });
    runFor(w, 0.25);
    expect(keeperFrame(gus, 0)).toMatchObject({ name: 'clap' });
    runFor(w, CLAP_S);
    expect(keeperFrame(gus, 0)).toMatchObject({ name: 'hold' });
  });

  it("Eddie doesn't clap", () => {
    const w = keeperWorld({ gus: true });
    const eddie = w.keepers!.home;
    gettingUpWithIt(w, eddie);
    runFor(w, 0.1);
    expect(keeperFrame(eddie, 0)).toMatchObject({ kind: 'pose', name: 'hold' });
  });
});

describe('keeper shadows', () => {
  /** The shadow pixels drawn for their keeper alone: [width, rows] of what's under him. */
  function shadowOf(w: World): { x: number; w: number }[] {
    const rects: { x: number; w: number }[] = [];
    const g = { fillRect: (x: number, _y: number, rw: number) => void rects.push({ x, w: rw }), fillStyle: '' } as unknown as CanvasRenderingContext2D;
    w.keepers!.home.body.x = -1000;
    drawKeeperShadows(g, { x: 900, view: BIG_VIEW }, w);
    return rects.filter(r => r.x > 0);
  }

  it("a standing keeper's patch is 2 x radius - 5 wide: 5 for everyone, 9 for Gus", () => {
    expect(shadowOf(keeperWorld()).map(r => r.w)).toEqual([5]);
    expect(shadowOf(keeperWorld({ gus: true })).map(r => r.w)).toEqual([9]);
  });

  it('lying along a dive, the strip is 14 x radius / 5 long: 14 for everyone, 20 for Gus', () => {
    const lying = (w: World) => {
      Object.assign(w.keepers!.away, { act: 'down', dive: { dirX: 0, dirZ: 1 } });
      return shadowOf(w).length - 1;
    };
    expect(lying(keeperWorld())).toBe(14 + 14 / 2);
    expect(lying(keeperWorld({ gus: true }))).toBe(20 + 20 / 2);
  });
});

describe('drawing a keeper', () => {
  it("draws his pose frames on his own sprites' anchor", () => {
    const w = keeperWorld();
    const fake = fakeArt().keepers.eddie;
    const sprites: KeeperSprites = { body: fake.body, poses: fake.poses, dives: fake.dives, anchor: { x: 31, y: 69 } };
    const placed: { name: string; x: number; y: number }[] = [];
    const g = { drawImage: (img: Named, x: number, y: number) => void placed.push({ name: img.name, x, y }) } as unknown as CanvasRenderingContext2D;
    const cam = { x: 900, view: BIG_VIEW };
    const away = w.keepers!.away.body;
    keeperDrawables(w, cam, { home: sprites, away: sprites }, 0)[1]!.draw(g);
    const s = project(away.x, away.y, away.z, cam);
    expect(placed).toEqual([{ name: 'art.keepers.eddie.poses.ready.left.0', x: Math.round(s.sx) - 31, y: Math.round(s.sy) - 69 }]);
  });
});
