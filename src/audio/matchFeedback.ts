import type { RumbleKind } from '../engine/rumble';
import type { Phase } from '../game/match';
import { DECEL } from '../game/player';
import type { World } from '../game/world';
import type { Cue } from './cues';

/** Ball speed (px/s) after a kick at or above which it sounds hard. */
export const HARD_KICK_SPEED = 350;

/**
 * A player on soft brakes (Speedy Sam) flying past Harrison within `within`
 * px at over `speed` px/s whooshes, at most once per `cooldownS`.
 */
export const WHOOSH = { within: 14, speed: 170, cooldownS: 0.8 };
/** Fixed ticks a second, for the whoosh's cooldown. */
const TICKS_PER_S = 60;

/** What the whoosh remembers between ticks: the tick it last sounded. */
export interface SpeedMemo {
  whooshTick: number;
}

export const speedMemo = (): SpeedMemo => ({ whooshTick: -Infinity });

export interface MatchFeedback {
  cues: Cue[];
  rumble: RumbleKind[];
}

/**
 * The sounds and rumbles one tick's events make. The kicks are [home, away].
 * The rumble only ever reflects what Harrison feels. A ball resting against
 * the net reports a hit every tick, so the net only sounds on a goal.
 * Biscuit's grab (his touch) barks rather than taps, and he pants aloud.
 * A stepover swishes and a flick pops off his heel; the crowd oohs only at
 * a trick that fools someone.
 * With `speed`, a soft-braking away player whooshes past and scrapes into
 * each skid.
 */
export function matchFeedback(w: World, prevPhase: Phase, speed?: SpeedMemo): MatchFeedback {
  const cues = new Set<Cue>();
  const rumble = new Set<RumbleKind>();
  const { ball, kicks, goal, power, dog, trick, keeper } = w.events;
  if (keeper.caught) cues.add('glove');
  if (keeper.dived) cues.add('dive');
  if (keeper.pushed) cues.add('parry');
  // Goalie Gus's drop kick booms.
  if (keeper.punted) cues.add(w.keepers?.[keeper.punted].gus ? 'boom' : 'punt');
  if (dog.grabbed) cues.add('bark');
  if (dog.panted) cues.add('pant');
  if (power.started) {
    cues.add('powerUp').add('ooh');
    rumble.add('powerOn');
  }
  if (power.ready) {
    cues.add('powerReady');
    rumble.add('ready');
  }
  if (power.cancelled) cues.add('fizzle');
  if (power.fired) {
    cues.add('waveBlast').add('beam');
    rumble.add('wave');
  }
  if (power.braced) {
    cues.add('brace');
    rumble.add('brace');
  }
  if (power.blown) cues.add('whoosh');
  if (trick.started === 'stepover') cues.add('stepover');
  if (trick.released) cues.add('flick');
  if (trick.fooled) cues.add('ooh');
  const hard = Math.hypot(w.ball.vx, w.ball.vy, w.ball.vz) >= HARD_KICK_SPEED;
  kicks.forEach((k, i) => {
    if (k.kicked) {
      cues.add(hard ? 'kickHard' : 'kickSoft');
      if (hard && i === 0) rumble.add('hardShot');
    } else if (k.touched && !(i === 1 && dog.grabbed)) {
      cues.add('tap');
    }
    if (k.perfect) cues.add('perfect');
    if (k.tackledBall || k.trippedOpponent) {
      cues.add('tackle');
      rumble.add('tackle');
    }
  });
  if (ball.bounced) cues.add('bounce');
  if (ball.hitPost || ball.hitBar) {
    cues.add('post').add('ooh');
    rumble.add('post');
  }
  if (ball.hitWall) cues.add('fence');
  if (goal) {
    cues.add('net').add(goal === 'home' ? 'roar' : 'groan');
    rumble.add(goal === 'home' ? 'goal' : 'maxGoal');
  }
  const away = w.away;
  if (speed && away.handling.decel < DECEL) {
    // The skid's first tick: its animation clock has just started.
    if (away.anim.name === 'skid' && away.animT === 0) cues.add('skid');
    const close = Math.hypot(away.x - w.home.x, away.z - w.home.z) <= WHOOSH.within;
    const ready = w.tick - speed.whooshTick >= WHOOSH.cooldownS * TICKS_PER_S;
    if (close && ready && Math.hypot(away.vx, away.vz) > WHOOSH.speed) {
      cues.add('whoosh');
      speed.whooshTick = w.tick;
    }
  }
  const phase = w.match.phase;
  if (prevPhase === 'kickoff' && phase === 'playing') cues.add('whistleShort');
  if (prevPhase !== 'fullTime' && phase === 'fullTime') cues.add('whistleFull');
  return { cues: [...cues], rumble: [...rumble] };
}
