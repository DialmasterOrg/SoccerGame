import { describe, expect, it } from 'vitest';
import { DIVE_FRAMES } from '../art/keepers/poses';
import { keeperProfile, type Keeper } from '../game/keeper';
import { keeperWorld } from '../game/testKeepers';
import { keeperFrame, keeperLooks } from './keeperView';

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
    expect(keeperLooks({ kind: 'match', rung: 1 })).toEqual({ home: 'eddie', away: 'backupA' });
    expect(keeperLooks({ kind: 'match', rung: 2 })).toEqual({ home: 'eddie', away: 'backupB' });
  });
});
