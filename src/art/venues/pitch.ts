import { DEPTH_SHEAR, SMALL_VIEW, project, type View } from '../../game/camera';
import { BACKYARD, type Field, type Goal } from '../../game/field';
import { M } from '../colors';
import { IndexedImage } from '../indexedImage';
import { fillRect } from '../scenery';

const STRIPE_W = 32;
/** World step when rasterising slanted shapes: small enough that no pixel is skipped. */
const RASTER_STEP = 0.25;
/** About one grass pixel in this many is a darker tuft. */
const TUFT_EVERY = 53;
/** A penalty spot is this many pixels along x. */
const SPOT_W = 2;

/** Sets the pixel a world point projects to (camera at 0) in `view`. */
export function plot(img: IndexedImage, x: number, y: number, z: number, id: number, view: View = SMALL_VIEW, dx = 0, dy = 0): void {
  const p = project(x, y, z, { x: 0, view });
  img.set(Math.round(p.sx) - dx, Math.round(p.sy) - dy, id);
}

/** Visits world points along a segment, finely enough to touch every pixel it crosses. */
export function along(a: number, b: number, visit: (t: number) => void): void {
  for (let t = Math.min(a, b); t <= Math.max(a, b) + 1e-9; t += RASTER_STEP) visit(t);
}

/** The field's painted white lines on the ground, one world pixel wide. */
function paintLines(img: IndexedImage, field: Field, view: View): void {
  const m = field.markings;
  if (!m) return;
  const dot = (x: number, z: number) => plot(img, x, 0, z, M.white, view);
  const [zNear, zFar] = m.touchZ;
  const [gl, gr] = [field.goals[0].lineX, field.goals[1].lineX];
  const [cx, cz] = [field.width / 2, field.depth / 2];
  along(gl, gr, x => (dot(x, zNear), dot(x, zFar)));
  for (const x of [gl, gr, cx]) along(zNear, zFar, z => dot(x, z));
  // Stepped by arc length so the circle has no gaps.
  along(0, 2 * Math.PI * m.circleR, s => dot(cx + m.circleR * Math.cos(s / m.circleR), cz + m.circleR * Math.sin(s / m.circleR)));
  for (const goal of field.goals) {
    const dir = goal.side === 'left' ? 1 : -1;
    for (const area of [m.box, m.goalArea]) {
      const front = goal.lineX + dir * area.out;
      along(area.z0, area.z1, z => dot(front, z));
      along(goal.lineX, front, x => (dot(x, area.z0), dot(x, area.z1)));
    }
    for (let i = 0; i < SPOT_W; i++) dot(goal.lineX + dir * (m.spotOut + i), cz);
  }
}

/**
 * The pitch in `view`: slanted mowing stripes from the far touchline down, the
 * back fence's shadow and the near board's line, the venue's end fences in
 * both end footprints, and the field's painted lines if it has any. Wide
 * enough for the camera's whole range plus the slant of the far touchline.
 */
export function pitchGround(endFence: (img: IndexedImage, x0: number, x1: number) => void, field: Field = BACKYARD, view: View = SMALL_VIEW): IndexedImage {
  const groundW = field.width + Math.ceil(field.depth * DEPTH_SHEAR);
  const farSY = view.nearSY - field.depth;
  const img = new IndexedImage(groundW, view.h);
  for (let y = farSY; y < view.h; y++) {
    const z = view.nearSY - y;
    for (let x = 0; x < groundW; x++) {
      const stripe = Math.floor((x - z * DEPTH_SHEAR) / STRIPE_W);
      const tuft = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0 < 2 ** 32 / TUFT_EVERY;
      img.set(x, y, tuft ? M.grassDark : stripe % 2 === 0 ? M.grass : M.grassLight);
    }
  }
  fillRect(img, 0, farSY, groundW, 1, M.grassDark); // the back fence's shadow
  fillRect(img, 0, view.nearSY + 1, groundW, 1, M.grassDark); // the invisible near board
  endFence(img, 0, field.fenceL);
  endFence(img, field.fenceR, field.width);
  paintLines(img, field, view);
  return img;
}

/**
 * A goal's art, drawn from its geometry. Every sprite shares one origin: it is
 * placed with its top-left at project(lineX, 0, 0, cam) + origin. The posts
 * and the nets are separate so the match can depth-sort them against the
 * players: `farNet` (back net, far side net, roof and crossbar) sorts at the
 * far post's depth, `nearNet` (the near side net) at the near post's.
 */
export interface GoalArt {
  farNet: IndexedImage;
  nearNet: IndexedImage;
  nearPost: IndexedImage;
  farPost: IndexedImage;
  origin: { x: number; y: number };
}

/** The bar's underside, the highest pixel row of the frame, and the net's grid. */
const NET_CELL = 4;

/** A goal's sprites; the same in any view, since they're placed relative to its goal line. */
export function goalSprites(g: Goal): GoalArt {
  const nearSY = SMALL_VIEW.nearSY;
  const top = g.barY + g.barThick - 1;
  const [xa, xb] = [Math.min(g.lineX, g.backX), Math.max(g.lineX, g.backX)];
  const col0 = Math.round(xa + g.z0 * DEPTH_SHEAR) - 1;
  const col1 = Math.round(xb + g.z1 * DEPTH_SHEAR) + 2;
  const row0 = Math.round(nearSY - g.z1 - top) - 1;
  const row1 = Math.round(nearSY - g.z0) + 1;
  const sprite = () => new IndexedImage(col1 - col0 + 1, row1 - row0 + 1);
  const put = (img: IndexedImage, x: number, y: number, z: number, id: number) => plot(img, x, y, z, id, SMALL_VIEW, col0, row0);
  const grid = (from: number, to: number, visit: (v: number) => void) => {
    for (let v = from; v <= to + 1e-9; v += NET_CELL) visit(v);
  };

  const [farNet, nearNet] = [sprite(), sprite()];
  // The net is a dotted mesh, so the white frame stands out in front of it.
  const mesh = (img: IndexedImage, x: number, y: number, z: number) => {
    const p = project(x, y, z, { x: 0 });
    if ((Math.round(p.sx) + Math.round(p.sy)) % 2 === 0) put(img, x, y, z, M.silver);
  };
  // Net back.
  grid(g.z0, g.z1, z => along(0, top, y => mesh(farNet, g.backX, y, z)));
  grid(0, top, y => along(g.z0, g.z1, z => mesh(farNet, g.backX, y, z)));
  along(g.z0, g.z1, z => mesh(farNet, g.backX, top, z));
  // Side nets.
  for (const [z, img] of [
    [g.z1, farNet],
    [g.z0, nearNet],
  ] as const) {
    grid(xa, xb, x => along(0, top, y => mesh(img, x, y, z)));
    grid(0, top, y => along(xa, xb, x => mesh(img, x, y, z)));
    along(xa, xb, x => mesh(img, x, top, z));
  }
  // Roof.
  grid(xa, xb, x => along(g.z0, g.z1, z => mesh(farNet, x, top, z)));
  grid(g.z0, g.z1, z => along(xa, xb, x => mesh(farNet, x, top, z)));
  // Crossbar, near-post top to far-post top.
  along(g.z0, g.z1, z => {
    for (const y of [g.barY, top]) {
      put(farNet, g.lineX, y, z, M.white);
      put(farNet, g.lineX + 1, y, z, M.white);
    }
  });

  const post = (z: number) => {
    const img = sprite();
    along(0, top, y => {
      put(img, g.lineX, y, z, M.white);
      put(img, g.lineX + 1, y, z, M.silver);
    });
    return img;
  };
  return { farNet, nearNet, nearPost: post(g.z0), farPost: post(g.z1), origin: { x: col0 - g.lineX, y: row0 - nearSY } };
}
