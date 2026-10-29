import { createAudio } from '../audio/synth';
import { padMayUnlock } from '../audio/unlock';
import { createInput, type InputFrame } from '../engine/input';
import { createStepper, startLoop } from '../engine/loop';
import { createRumble } from '../engine/rumble';
import { createScreen } from '../engine/screen';
import { MENU_SIZE } from '../engine/viewport';
import { outfitOf } from '../meta/locker';
import { newProfile } from '../meta/profile';
import { createSaveSlots } from '../meta/saveSlots';
import { localDate } from '../meta/progress';
import { loadSettings, saveSettings } from '../meta/settings';
import type { KeyValueStore } from '../meta/storage';
import { loadGameArt } from './art';
import type { GameContext } from './context';
import type { Scene } from './scene';
import { createPressStartScene } from './titleScene';

const NONE: ReadonlySet<never> = new Set();

/** Folds a new frame into one not yet consumed, so a quick tap (or typing) between fixed steps isn't lost. */
function carry(pending: InputFrame | null, next: InputFrame): InputFrame {
  if (!pending) return next;
  return {
    ...next,
    pressed: new Set([...pending.pressed, ...next.pressed]),
    released: new Set([...pending.released, ...next.released]),
    typed: pending.typed + next.typed,
  };
}

/** localStorage, or nothing if the browser refuses access to it (some private modes throw). */
function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Boots the game: Press Start first, a fixed 60 Hz simulation, drawn every animation frame. */
export function startGame(canvas: HTMLCanvasElement): void {
  const screen = createScreen(canvas);
  const input = createInput(window);
  const store = browserStore();
  const audio = createAudio(typeof AudioContext === 'undefined' ? null : () => new AudioContext());
  const rumble = createRumble(() => navigator.getGamepads?.() ?? []);
  const settings = loadSettings(store);
  const saves = createSaveSlots(store, settings.difficulty);
  const ctx: GameContext = {
    art: loadGameArt(),
    settings,
    save(s) {
      ctx.settings = s;
      saveSettings(store, s);
      audio.setVolumes(s.musicVolume, s.sfxVolume);
      rumble.enabled = s.rumble;
    },
    profile: saves.read(1) ?? newProfile(),
    slot: 1,
    saves,
    saveProfile(p) {
      ctx.profile = p;
      saves.write(ctx.slot, p);
      ctx.art.dress(outfitOf(p));
    },
    today: () => localDate(new Date()),
    audio,
    rumble,
    async copyText(s) {
      try {
        if (!navigator.clipboard) return false;
        await navigator.clipboard.writeText(s);
        return true;
      } catch {
        return false;
      }
    },
  };
  audio.setVolumes(ctx.settings.musicVolume, ctx.settings.sfxVolume);
  rumble.enabled = ctx.settings.rumble;
  // Another tab changed this save: take it, and wear what it wears.
  saves.follow(window, () => ctx.slot, p => {
    ctx.profile = p;
    ctx.art.dress(outfitOf(p));
  });
  // Browsers only allow sound after a key press, click or tap. Chrome doesn't count a gamepad press.
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('pointerup', unlock);
  let scene: Scene = createPressStartScene(ctx);
  let latest = input.poll();
  let pending: InputFrame | null = null;
  let nowS = 0;

  // Each press reaches exactly one fixed step: the first one after it happened.
  const stepper = createStepper(dt => {
    const frame = pending ?? { ...latest, pressed: NONE, released: NONE, typed: '' };
    pending = null;
    // Only where the browser says it would be allowed, so a refused start doesn't log a warning.
    if (frame.pressed.size > 0 && padMayUnlock(navigator)) audio.unlock();
    scene = scene.update(frame, dt) ?? scene;
  });

  // Dev server only (stripped from builds): lets a playtester inspect and stage the current scene and the profile.
  if (import.meta.env.DEV) Object.assign(window, { __soccer: { scene: () => scene, ctx } });

  // Losing the window or the controller pauses the match (and drops a held charge) before play can go on without him.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      audio.resume();
      return;
    }
    audio.suspend();
    input.releaseAll();
    scene.onHidden?.();
  });
  window.addEventListener('blur', () => scene.onHidden?.());

  startLoop(
    dt => {
      nowS += dt;
      if (input.takePadLost()) scene.onHidden?.();
      input.setTextMode(scene.wantsText === true);
      latest = input.poll();
      pending = carry(pending, latest);
      stepper.advance(dt);
      screen.resize(scene.size ?? MENU_SIZE);
      scene.draw(screen.game, nowS);
      screen.present();
    },
    e => console.error(e),
  );
}
