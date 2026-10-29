import { describe, expect, it } from 'vitest';
import { BIG_VIEW, DEPTH_SHEAR, project } from '../../game/camera';
import { SCHOOL_FIELD } from '../../game/field';
import { M } from '../colors';
import { PARALLAX } from './backyard';
import { BLEACHERS, FLAGPOLE, SCHOOL_FAR_SY, SCHOOL_MID_W, SCHOOL_NEAR_W, schoolLayers } from './school';

const L = schoolLayers();
const ground = L.ground;
const at = (x: number, z: number) => ground.get(Math.round(x + z * DEPTH_SHEAR), BIG_VIEW.nearSY - z);
const MAX_CAM = SCHOOL_FIELD.width + SCHOOL_FIELD.depth * DEPTH_SHEAR - BIG_VIEW.w;
const AUTUMN = [M.flame, M.flameDark, M.flameLight, M.gold, M.goldDark];
const GRASS = [M.grass, M.grassLight, M.grassDark];
const CHAIN = [M.silver, M.slate];
const ids = (img: { data: ArrayLike<number> }) => new Set(Array.from(img.data));

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
    const fenceAt = (x: number, y: number, z: number) => ground.get(Math.round(x + z * DEPTH_SHEAR), BIG_VIEW.nearSY - z - y);
    for (const x of [4, 1276]) expect(CHAIN).toContain(fenceAt(x, 15, 64));
  });

  it('the far touchline is row 168, and mid and near each cover the big view\'s whole scroll at their parallax', () => {
    expect(SCHOOL_FAR_SY).toBe(BIG_VIEW.nearSY - SCHOOL_FIELD.depth);
    expect(SCHOOL_FAR_SY).toBe(168);
    expect(SCHOOL_MID_W).toBe(Math.ceil(PARALLAX.mid * MAX_CAM) + BIG_VIEW.w);
    expect(SCHOOL_NEAR_W).toBe(Math.ceil(PARALLAX.near * MAX_CAM) + BIG_VIEW.w);
    expect([L.far.width, L.far.height]).toEqual([534, 300]);
    expect([L.mid.width, L.mid.height]).toEqual([SCHOOL_MID_W, 300]);
    expect([L.near.width, L.near.height]).toEqual([SCHOOL_NEAR_W, 300]);
  });

  it('the far layer is an opaque morning sky over a hazy tree line', () => {
    expect(L.far.data.every(v => v !== 0)).toBe(true);
    const sky = ids({ data: Array.from({ length: 534 }, (_, x) => L.far.get(x, 10)) });
    expect([...sky].every(id => [M.skyLight, M.electricLight, M.auraWhite, M.white, M.energyGoldLight].includes(id))).toBe(true);
    const trees = ids({ data: Array.from({ length: 534 }, (_, x) => L.far.get(x, SCHOOL_FAR_SY - 30)) });
    expect([...trees].some(id => [M.tan, M.tanLight, M.tanShadow].includes(id))).toBe(true);
  });

  it('the far layer tiles without a seam: an even width, both edge columns continuing their neighbours outside the crowns', () => {
    const far = L.far;
    expect(far.width % 2).toBe(0);
    // The hazy crowns (rows 90-111) are speckled and painted wrapped over the haze; the sky above and the solid band below repeat every 2 px.
    const CROWNS = { top: 90, bottom: 112 };
    const CROWN_OR_HAZE = [M.tan, M.tanLight, M.tanShadow, M.auraWhite, M.electricLight];
    for (let y = 0; y < far.height; y++) {
      if (y >= CROWNS.top && y < CROWNS.bottom) {
        expect(CROWN_OR_HAZE, `row ${y}`).toContain(far.get(0, y));
        expect(CROWN_OR_HAZE, `row ${y}`).toContain(far.get(far.width - 1, y));
        continue;
      }
      expect(far.get(0, y), `row ${y}`).toBe(far.get(2, y));
      expect(far.get(far.width - 1, y), `row ${y}`).toBe(far.get(far.width - 3, y));
    }
  });

  it('the sun shows once at every camera: it sits clear of the far layer\'s wrap by the farthest scroll', () => {
    const wrap = Math.ceil(PARALLAX.far * MAX_CAM);
    let sun = 0;
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < L.far.width; x++) {
        if (L.far.get(x, y) !== M.energyGoldLight) continue;
        sun++;
        expect(x, `sun at (${x}, ${y})`).toBeGreaterThanOrEqual(wrap);
      }
    }
    expect(sun).toBeGreaterThan(100);
  });

  it('the mid layer holds the pale-brick school, the yellow bus and autumn crowns, with clear sky above', () => {
    const mid = ids(L.mid);
    expect(mid.has(M.tan)).toBe(true);
    expect(mid.has(M.navy)).toBe(true);
    expect(mid.has(M.gold)).toBe(true);
    expect(mid.has(M.flame)).toBe(true);
    expect(mid.has(M.goldDark)).toBe(true);
    for (let y = 0; y < 60; y++) for (let x = 0; x < L.mid.width; x += 7) expect(L.mid.get(x, y), `(${x}, ${y})`).toBe(0);
    // The school stands at mid x 15-300, so the postcard (x 118-163, rows 120-149) frames its brick.
    const brick = ids({ data: Array.from({ length: 46 * 30 }, (_, i) => L.mid.get(118 + (i % 46), 120 + Math.floor(i / 46))) });
    expect(brick.has(M.tan)).toBe(true);
    expect(brick.has(0)).toBe(false);
  });

  it('the flagpole stands on the mid layer with its top above the school', () => {
    expect(L.mid.get(FLAGPOLE.x, FLAGPOLE.top)).toBe(M.silver);
    expect(L.mid.get(FLAGPOLE.x, SCHOOL_FAR_SY - 17)).toBe(M.silver); // its foot, on the row above the fence
    expect(L.mid.get(FLAGPOLE.x, FLAGPOLE.top - 2)).toBe(0);
    expect(FLAGPOLE.top).toBeLessThan(100);
  });

  it('the near layer has a chain-link fence of 16 rows on the far touchline, with posts and a rail', () => {
    const near = L.near;
    for (const x of [50, 600, 1140]) {
      expect(x < BLEACHERS.x0 || x > BLEACHERS.x1).toBe(true);
      expect(near.get(x, SCHOOL_FAR_SY - 16)).toBe(M.slate); // the top rail
      const mesh = Array.from({ length: 15 }, (_, i) => near.get(x, SCHOOL_FAR_SY - 15 + i));
      expect(mesh.filter(id => id === M.silver).length).toBeGreaterThanOrEqual(3);
      expect(near.get(x, SCHOOL_FAR_SY - 17)).toBe(0);
    }
  });

  it('aluminium bleachers stand on the far touchline inside BLEACHERS, their seats empty', () => {
    const near = L.near;
    expect(BLEACHERS.x1 - BLEACHERS.x0).toBeGreaterThan(60);
    expect(BLEACHERS.top).toBeLessThan(SCHOOL_FAR_SY - 16);
    const x = Math.round((BLEACHERS.x0 + BLEACHERS.x1) / 2);
    const column = Array.from({ length: SCHOOL_FAR_SY - BLEACHERS.top }, (_, i) => near.get(x, BLEACHERS.top + i));
    expect(column).toContain(M.silver);
    expect(column).toContain(M.slate);
    expect(near.get(x, SCHOOL_FAR_SY - 1)).not.toBe(0);
    expect(near.get(x, SCHOOL_FAR_SY)).toBe(0);
    expect(near.get(x, BLEACHERS.top - 3)).toBe(0);
  });

  it('leaves lie piled along the fence foot', () => {
    const foot = new Set<number>();
    for (let x = 0; x < BLEACHERS.x0; x++) foot.add(L.near.get(x, SCHOOL_FAR_SY - 1));
    expect([...foot].some(id => AUTUMN.includes(id))).toBe(true);
  });

  it('only the ground layer covers the pitch', () => {
    for (const y of [SCHOOL_FAR_SY, 200, 299]) {
      for (const x of [100, 500, 900]) {
        expect(L.mid.get(x, y), `mid (${x}, ${y})`).toBe(0);
        expect(L.near.get(x, y), `near (${x}, ${y})`).toBe(0);
      }
    }
  });

  it('fallen leaves lie on the far part of the pitch, on grass only, never near the touchline', () => {
    const idAt = (x: number, z: number) => {
      const p = project(x, 0, z, { x: 0, view: BIG_VIEW });
      return ground.get(Math.round(p.sx), Math.round(p.sy));
    };
    let far = 0;
    for (let x = 60; x < 1220; x += 2) for (let z = 96; z <= 127; z++) if (AUTUMN.includes(idAt(x, z))) far++;
    expect(far).toBeGreaterThan(50);
    for (let x = 0; x < 1280; x += 1) for (let z = 0; z < 64; z++) expect(AUTUMN.includes(idAt(x, z)), `leaf at (${x}, ${z})`).toBe(false);
    // Lines stay painted: the far touchline and the box's far edge.
    expect(at(400, 125)).toBe(M.white);
    expect(at(1240 - 110, 118)).toBe(M.white);
    for (let x = 60; x < 1220; x += 1) expect([...GRASS, ...AUTUMN, M.white], `(${x}, 100)`).toContain(idAt(x, 100));
  });
});
