import { describe, expect, it } from 'vitest';
import { BIG_VIEW, DEPTH_SHEAR } from '../../game/camera';
import { M } from '../colors';
import { schoolLayers } from './school';

const ground = schoolLayers().ground;
const at = (x: number, z: number) => ground.get(Math.round(x + z * DEPTH_SHEAR), BIG_VIEW.nearSY - z);

describe('schoolLayers', () => {
  it('the School ground spans the pitch and the big view', () => {
    expect([ground.width, ground.height]).toEqual([1280 + Math.ceil(128 * DEPTH_SHEAR), 300]);
  });

  it('the halfway line, a box corner and a touchline are painted white', () => {
    expect(at(640, 64)).toBe(M.white);
    expect(at(1240 - 110, 10)).toBe(M.white);
    expect(at(400, 125)).toBe(M.white);
    expect(at(400, 64)).not.toBe(M.white);
  });

  it('the centre circle, both goal lines and both penalty spots are painted too', () => {
    expect(at(640 + 36, 64)).toBe(M.white);
    expect(at(640, 64 + 36)).toBe(M.white);
    for (const x of [40, 1240]) expect(at(x, 20)).toBe(M.white);
    for (const x of [40 + 76, 1240 - 76]) expect(at(x, 64)).toBe(M.white);
  });

  it('chain-link end fences stand in both ends', () => {
    const chain = [M.silver, M.slate];
    const fenceAt = (x: number, y: number, z: number) => ground.get(Math.round(x + z * DEPTH_SHEAR), BIG_VIEW.nearSY - z - y);
    for (const x of [4, 1276]) expect(chain).toContain(fenceAt(x, 15, 64));
  });

  it('the far, mid and near layers fill the view or are empty stand-ins', () => {
    const L = schoolLayers();
    expect([L.far.width, L.far.height]).toEqual([534, 300]);
    expect([L.mid.width, L.near.width]).toEqual([1, 1]);
  });
});
