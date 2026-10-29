import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreen } from './screen';
import { MENU_SIZE } from './viewport';

type DrawCall = unknown[];

/** A canvas whose 2D context keeps its smoothing flag and every drawImage; resizing resets the flag, as a browser does. */
function fakeCanvas() {
  const context = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    draws: [] as DrawCall[],
    fillRect() {},
    drawImage(...args: unknown[]) {
      context.draws.push(args);
    },
  };
  let w = 300,
    h = 150;
  const canvas = {
    style: { width: '', height: '' },
    get width() {
      return w;
    },
    set width(v: number) {
      w = v;
      context.imageSmoothingEnabled = true;
    },
    get height() {
      return h;
    },
    set height(v: number) {
      h = v;
      context.imageSmoothingEnabled = true;
    },
    getContext: () => context,
  };
  return { canvas, context };
}

const lastDrawImage = (c: { draws: DrawCall[] }) => c.draws.at(-1);

let page: ReturnType<typeof fakeCanvas>, game: ReturnType<typeof fakeCanvas>;

beforeEach(() => {
  page = fakeCanvas();
  game = fakeCanvas();
  const media = { addEventListener() {}, removeEventListener() {} };
  vi.stubGlobal('window', { innerWidth: 1920, innerHeight: 930, devicePixelRatio: 1, addEventListener() {}, matchMedia: () => media });
  vi.stubGlobal('document', { createElement: () => game.canvas });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const open = () => createScreen(page.canvas as unknown as HTMLCanvasElement);

describe('screen', () => {
  it('starts at the menu size', () => {
    const screen = open();
    screen.present();
    expect([game.canvas.width, game.canvas.height]).toEqual([320, 180]);
    expect(lastDrawImage(page.context)).toEqual([game.canvas, 160, 15, 1600, 900]);
  });

  it('resizing to the match size keeps smoothing off and presents at 3×', () => {
    const screen = open();
    screen.resize({ w: 534, h: 300 });
    expect(game.canvas.width).toBe(534);
    expect(game.canvas.height).toBe(300);
    expect(game.context.imageSmoothingEnabled).toBe(false);
    screen.present();
    expect(lastDrawImage(page.context)).toEqual([game.canvas, 159, 15, 1602, 900]);
  });

  it('going back to the menu size presents at 5×', () => {
    const screen = open();
    screen.resize({ w: 534, h: 300 });
    screen.resize(MENU_SIZE);
    expect(game.context.imageSmoothingEnabled).toBe(false);
    screen.present();
    expect(lastDrawImage(page.context)).toEqual([game.canvas, 160, 15, 1600, 900]);
  });

  it('resizing to the size it already has leaves the canvas alone', () => {
    const screen = open();
    game.context.imageSmoothingEnabled = true;
    screen.resize(MENU_SIZE);
    // A real resize would clear the canvas; an unchanged size must not touch it.
    expect(game.context.imageSmoothingEnabled).toBe(true);
  });
});
