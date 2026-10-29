import { MENU_SIZE, computeViewport, type CanvasSize, type Viewport } from './viewport';

export interface Screen {
  /** The game canvas everything draws into: 320×180, or whatever size the scene showing asked for. */
  game: CanvasRenderingContext2D;
  /** Sizes the game canvas for the scene about to draw, and refits it to the window. */
  resize(size: CanvasSize): void;
  /** Scales the game canvas onto the window. */
  present(): void;
}

/**
 * Owns the window canvas and the internal game canvas. Re-fits on window
 * resize and whenever devicePixelRatio changes (browser zoom, moving the
 * window to another monitor), which fires no resize event on its own.
 */
export function createScreen(canvas: HTMLCanvasElement): Screen {
  const ctx = canvas.getContext('2d');
  const gameCanvas = document.createElement('canvas');
  let size = MENU_SIZE;
  gameCanvas.width = size.w;
  gameCanvas.height = size.h;
  const game = gameCanvas.getContext('2d');
  if (!ctx || !game) throw new Error('2D canvas unavailable');
  game.imageSmoothingEnabled = false;

  let viewport: Viewport;
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    viewport = computeViewport(window.innerWidth, window.innerHeight, dpr, size.w, size.h);
    canvas.width = viewport.deviceW;
    canvas.height = viewport.deviceH;
    // Exactly backing ÷ dpr so the browser maps canvas pixels 1:1 onto device pixels.
    canvas.style.width = `${viewport.deviceW / dpr}px`;
    canvas.style.height = `${viewport.deviceH / dpr}px`;
  };

  // A resolution query only matches one dpr, so re-arm it after every change.
  let dprQuery: MediaQueryList | null = null;
  const onDprChange = () => {
    fit();
    watchDpr();
  };
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDprChange);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onDprChange);
  };

  window.addEventListener('resize', fit);
  watchDpr();
  fit();

  return {
    game,
    resize(next) {
      if (next.w === size.w && next.h === size.h) return;
      size = next;
      gameCanvas.width = size.w;
      gameCanvas.height = size.h;
      // Resizing a canvas resets its context, smoothing included.
      game.imageSmoothingEnabled = false;
      fit();
    },
    present() {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(gameCanvas, viewport.x, viewport.y, size.w * viewport.scale, size.h * viewport.scale);
    },
  };
}
