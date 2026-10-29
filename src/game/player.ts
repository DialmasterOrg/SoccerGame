import { CLIPS, SHOOT_CHARGE_FRAME, SHOOT_STRIKE_FRAME, SKID_FRAME_HOLD, SLIDE_HOLD_FRAME, type AnimName } from '../art/body/animations';
import { GRAVITY } from './constants';
import { BACKYARD, playerSpan, type Area, type Field } from './field';
import { TAP_CHARGE, type Aim } from './kick';
import type { TrickKind } from './tricks';
import { SPRINT_MULTIPLIER, chargeTime, jumpVelocity, runSpeed, staminaDrain, staminaRegen, type Stats } from './stats';

/**
 * jump and steal are one-tick pulses (pressed this tick); shootHeld/chipHeld/powerHeld
 * are held states whose release fires the kick. moveZ +1 is away from the
 * camera.
 */
export interface PlayerIntent {
  moveX: number;
  moveZ: number;
  aim: Aim;
  jump: boolean;
  shootHeld: boolean;
  chipHeld: boolean;
  powerHeld: boolean;
  sprint: boolean;
  /** Harrison's steal button, pressed this tick; the world resolves it. */
  steal: boolean;
  /** Harrison's trick, pressed this tick: the right stick down (a stepover) or up (a rainbow flick). Absent for the computer. */
  trick?: TrickKind;
  /** Face this way whatever way he moves, as when backing off from someone. */
  faceX?: 1 | -1;
  /** Scales his run and sprint on the ground (the computer's pace factor); 1 when absent. */
  pace?: number;
  /** The computer's close control: a ball at its feet stays there this tick (the dribbler's fake). Absent for Harrison. */
  carry?: boolean;
}

export const NO_INTENT: Readonly<PlayerIntent> = Object.freeze({
  moveX: 0,
  moveZ: 0,
  aim: 'straight',
  jump: false,
  shootHeld: false,
  chipHeld: false,
  powerHeld: false,
  sprint: false,
  steal: false,
});

export type PlayerState =
  | 'ground'
  | 'air'
  | 'charging'
  | 'kicking'
  | 'chipping'
  | 'sliding'
  | 'fallen'
  | 'unleashing'
  | 'bracing'
  | 'blown';

export interface Kick {
  kind: 'shot' | 'chip' | 'volley' | 'header' | 'slide' | 'wave';
  charge: number;
  overchargeS: number;
  aim: Aim;
  /** Whether it can still connect with the ball this swing. */
  active: boolean;
}

/** How a player handles: his brakes, his touch, his shot, and how far ahead his ball can run and still be his. */
export interface Handling {
  /** px/s² when slowing or turning on the ground. */
  decel: number;
  /** Scales his dribble touch's push (touchPush). */
  touchScale: number;
  /** Scales his kicks' speed. */
  shotScale: number;
  /** A ball he played last, this far ahead of him, on his line, low, is still his (between touches), px. */
  ballAhead: number;
}

export interface Player {
  team: 'home' | 'away';
  stats: Stats;
  handling: Handling;
  /** Feet position: x along the pitch, z in depth, y the height of the soles. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  state: PlayerState;
  /** Seconds in the current state (in the air: since the volley started). */
  stateT: number;
  charge: number;
  overchargeS: number;
  /** 0..1. */
  stamina: number;
  exhausted: boolean;
  kick: Kick | null;
  anim: { name: AnimName; frame: number };
  /** The stick's current aim, used for headers. */
  aim: Aim;
  /** Last tick's held buttons, so a press is only seen on its first tick. */
  held: { shoot: boolean; chip: boolean; power: boolean };
  /**
   * A power press waiting, while Y stays held, for the world to power him
   * up (the ball reaching him, say). Powering up, or letting go, uses it
   * up, so Y still held afterwards needs a fresh press.
   */
  powerArmed: boolean;
  slideCooldown: number;
  /** Time until he can take another dribble touch. */
  touchCooldown: number;
  /** Seconds on the current looping animation. */
  animT: number;
  /** Horizontal speed (px/s) at the last take-off: steering in the air never goes faster than this or a run. */
  takeoffSpeed: number;
  /** Time left stumbling after a missed steal, when the stick and buttons do nothing. */
  stumbleS: number;
  /** Time until he may try another steal. */
  stealCooldownS: number;
  /** Time left on a drag-back turn, when he plants facing his new way; the world counts it down. */
  turnS: number;
  /**
   * Harrison's trick under way: its clock, the side a stepover dips to,
   * whether it has sold yet, the pace he moves at along his facing, and
   * whether the ball is still his to carry. The world runs it.
   */
  trick: null | { kind: TrickKind; t: number; side: 1 | -1; sold: boolean; pace: number; onBall: boolean };
  /** Time until he can start another trick. */
  trickCooldownS: number;
  /**
   * Fooled by Harrison's trick: confused (a stepover) or stumbling (a
   * flick), for totalS from the sell with leftS to go. A confused player
   * sways to swayZ in depth. Fooled, he can't play the ball; his body stays
   * solid. The world counts it down.
   */
  fooled: null | { kind: 'confused' | 'stumble'; leftS: number; totalS: number; swayZ: number };
  /** Time left wise to Harrison's tricks, when none can fool him. */
  wiseS: number;
  /** A keeper's penalty box: his centre never leaves it. Absent on every other player. */
  area?: Area;
  /** A keeper blown into his net by the Energy Wave: the net holds him until he walks out. */
  inNet?: boolean;
}

export const PLAYER_H = 40;
/** Body radius on the ground plane. */
export const PLAYER_R = 5;
export const FALL_TIME = 0.9;
/** Where a new player stands in depth: the centre line of the pitch. */
const START_Z = BACKYARD.depth / 2;

export const ACCEL = 900;
export const DECEL = 1200;
/** Everyone's handling but Speedy Sam's: today's brakes, touch and shot. */
export const NORMAL_HANDLING: Readonly<Handling> = Object.freeze({ decel: DECEL, touchScale: 1, shotScale: 1, ballAhead: 16 });
/** Above this speed, soft brakes skid: from flat out that's nearly the whole stop, 0.3 s on Sam's brakes. */
const SKID_SPEED = 15;
const AIR_ACCEL = 400;
const CHARGE_MOVE_FACTOR = 0.5;
/** A release below this charge is a tap and uses TAP_CHARGE. */
const TAP_THRESHOLD = 0.1;
/** The strike can connect this long either side of the middle of the strike frame. */
const STRIKE_WINDOW_S = 0.05;
const CHIP_STRIKE_FRAME = 1;
const VOLLEY_ACTIVE_S = 0.15;
const SLIDE_SPEED = 190;
const SLIDE_TIME = 0.45;
const SLIDE_COOLDOWN = 0.8;
const EXHAUSTION_RECOVERY = 0.25;
/** Below this speed he stands still. */
const IDLE_SPEED = 5;
/** Jump clip frames: rising, then tucked once past the top. */
const JUMP_RISE_FRAME = 1;
const JUMP_FALL_FRAME = 2;

/** A braced player is shoved back at this speed, easing to a stop over BRACE_S. */
export const BRACE_SKID_SPEED = 100;
export const BRACE_S = 0.5;
/** Blown away: launched back along the beam and up, then down for longer than a fall. */
export const BLOWN_SPEED = 260;
export const BLOWN_VY = 220;
export const BLOWN_DOWN_S = 1.5;
/** Fall frames for being blown away: flat out in the air, then pushing up, kneeling and standing once landed. */
const BLOWN_AIR_FRAME = 1;
const BLOWN_GET_UP_FRAME = 2;
/** How long a launch from the ground stays in the air. */
const BLOWN_FLIGHT_S = (2 * BLOWN_VY) / GRAVITY;

export function createPlayer(team: 'home' | 'away', stats: Stats, x: number, facing: 1 | -1, z = START_Z): Player {
  return {
    team,
    stats,
    handling: NORMAL_HANDLING,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    facing,
    state: 'ground',
    stateT: 0,
    charge: 0,
    overchargeS: 0,
    stamina: 1,
    exhausted: false,
    kick: null,
    anim: { name: 'idle', frame: 0 },
    aim: 'straight',
    held: { shoot: false, chip: false, power: false },
    powerArmed: false,
    slideCooldown: 0,
    touchCooldown: 0,
    animT: 0,
    takeoffSpeed: 0,
    stumbleS: 0,
    stealCooldownS: 0,
    turnS: 0,
    trick: null,
    trickCooldownS: 0,
    fooled: null,
    wiseS: 0,
  };
}

/** Moves v toward target at `accel` when speeding up, `decel` when slowing or turning. */
function approach(v: number, target: number, dt: number, accel: number, decel: number): number {
  const speedingUp = Math.abs(target) > Math.abs(v) && Math.sign(target) !== -Math.sign(v);
  const step = (speedingUp ? accel : decel) * dt;
  return Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step;
}

/** Moves the velocity vector (vx, vz) toward (tx, tz): `accel` when speeding up along it, `decel` when slowing or turning. */
function approach2(p: Player, tx: number, tz: number, dt: number, accel: number, decel: number): void {
  const [dx, dz] = [tx - p.vx, tz - p.vz];
  const gap = Math.hypot(dx, dz);
  const speedingUp = Math.hypot(tx, tz) > Math.hypot(p.vx, p.vz) && tx * p.vx + tz * p.vz >= 0;
  const step = (speedingUp ? accel : decel) * dt;
  if (gap <= step) [p.vx, p.vz] = [tx, tz];
  else [p.vx, p.vz] = [p.vx + (dx / gap) * step, p.vz + (dz / gap) * step];
}

/** Striking the ball: charging a shot or chip, or in the air. Up/down aims; winding up on the ground it also moves him, at the wind-up pace. */
export function isStriking(p: Player): boolean {
  return p.state === 'charging' || (p.state === 'chipping' && !p.kick) || p.state === 'air';
}

/** How long a kick's strike clip runs after release, and how long it can connect. */
function strikeTiming(clip: 'shoot' | 'chip', strikeFrame: number) {
  const { fps, frameCount } = CLIPS[clip];
  return { activeS: 0.5 / fps + STRIKE_WINDOW_S, doneS: (frameCount - strikeFrame) / fps };
}
const SHOT_TIMING = strikeTiming('shoot', SHOOT_STRIKE_FRAME);
const CHIP_TIMING = strikeTiming('chip', CHIP_STRIKE_FRAME);

function enter(p: Player, state: PlayerState): void {
  p.state = state;
  p.stateT = 0;
}

function release(p: Player, kind: 'shot' | 'chip', aim: Aim): void {
  p.kick = { kind, charge: p.charge < TAP_THRESHOLD ? TAP_CHARGE : p.charge, overchargeS: p.overchargeS, aim, active: true };
  p.charge = 0;
  p.overchargeS = 0;
  enter(p, kind === 'shot' ? 'kicking' : 'chipping');
}

function addCharge(p: Player, dt: number, allowOvercharge: boolean): void {
  p.charge += dt / chargeTime(p.stats);
  if (p.charge < 1) return;
  if (allowOvercharge) p.overchargeS += (p.charge - 1) * chargeTime(p.stats);
  p.charge = 1;
}

/** Strike follow-through: the kick connects early in the swing, then he recovers. */
function strike(p: Player, timing: { activeS: number; doneS: number }): void {
  if (p.kick) p.kick.active = p.stateT <= timing.activeS;
  if (p.stateT >= timing.doneS) {
    p.kick = null;
    enter(p, 'ground');
  }
}

function startSlide(p: Player): void {
  enter(p, 'sliding');
  p.slideCooldown = SLIDE_COOLDOWN;
  p.kick = { kind: 'slide', charge: 0, overchargeS: 0, aim: 'straight', active: true };
}

/** Knocked over: no control for FALL_TIME, and any charge or kick is cancelled. */
export function knockDown(p: Player): void {
  enter(p, 'fallen');
  p.charge = 0;
  p.overchargeS = 0;
  p.kick = null;
  p.vx = 0;
  p.vz = 0;
}

/** Braced against a beam travelling along `beamDirX`: he faces it and is shoved back, skidding. */
export function brace(p: Player, beamDirX: 1 | -1): void {
  enter(p, 'bracing');
  p.facing = beamDirX === 1 ? -1 : 1;
  p.charge = 0;
  p.overchargeS = 0;
  p.kick = null;
  p.vx = beamDirX * BRACE_SKID_SPEED;
  p.vz = 0;
}

/** Knocked flying along (dirX, dirZ), a unit direction: no control until he's back up at BLOWN_DOWN_S. */
export function blowAway(p: Player, dirX: number, dirZ: number): void {
  enter(p, 'blown');
  p.charge = 0;
  p.overchargeS = 0;
  p.kick = null;
  p.vx = dirX * BLOWN_SPEED;
  p.vz = dirZ * BLOWN_SPEED;
  p.vy = BLOWN_VY;
}

/** Drops a shot or chip that is still charging, and a waiting power press, without kicking (used when the game pauses). */
export function cancelCharge(p: Player): void {
  p.powerArmed = false;
  const charging = p.state === 'charging' || (p.state === 'chipping' && !p.kick);
  if (!charging) return;
  enter(p, 'ground');
  p.charge = 0;
  p.overchargeS = 0;
}

/** Braking hard on the ground with soft brakes: still fast and slowing or turning against his run. */
export function skidding(p: Player, intent: PlayerIntent): boolean {
  if (p.state !== 'ground' || p.handling.decel >= DECEL || Math.hypot(p.vx, p.vz) <= SKID_SPEED) return false;
  const released = intent.moveX === 0 && intent.moveZ === 0;
  return released || intent.moveX * p.vx + intent.moveZ * p.vz < 0;
}

function updateStamina(p: Player, sprinting: boolean, dt: number): void {
  p.stamina = Math.min(1, Math.max(0, p.stamina + (sprinting ? -staminaDrain(p.stats) : staminaRegen(p.stats)) * dt));
  if (p.stamina === 0) p.exhausted = true;
  else if (p.exhausted && p.stamina >= EXHAUSTION_RECOVERY) p.exhausted = false;
}

function chooseAnim(p: Player, sprinting: boolean, skid: boolean): { name: AnimName; frame: number } {
  const t = p.stateT;
  const clipFrame = (name: AnimName, from: number, time: number) =>
    Math.min(CLIPS[name].frameCount - 1, from + Math.floor(time * CLIPS[name].fps));
  const skidFrame = () => ({ name: 'skid' as const, frame: Math.min(SKID_FRAME_HOLD, Math.floor((p.anim.name === 'skid' ? p.animT : 0) * CLIPS.skid.fps)) });
  switch (p.state) {
    case 'air':
      if (p.kick?.kind === 'volley') return { name: 'volley', frame: clipFrame('volley', 0, t) };
      if (p.kick?.kind === 'header') return { name: 'header', frame: clipFrame('header', 0, t) };
      return { name: 'jump', frame: p.vy > 0 ? JUMP_RISE_FRAME : JUMP_FALL_FRAME };
    case 'charging':
      return { name: 'shoot', frame: SHOOT_CHARGE_FRAME };
    case 'kicking':
      return { name: 'shoot', frame: clipFrame('shoot', SHOOT_STRIKE_FRAME, t) };
    case 'chipping':
      return { name: 'chip', frame: p.kick ? clipFrame('chip', CHIP_STRIKE_FRAME, t) : 0 };
    case 'sliding': {
      const fps = CLIPS.slide.fps;
      if (t < SLIDE_HOLD_FRAME / fps) return { name: 'slide', frame: Math.floor(t * fps) };
      return { name: 'slide', frame: t < SLIDE_TIME - 1 / fps ? SLIDE_HOLD_FRAME : SLIDE_HOLD_FRAME + 1 };
    }
    case 'fallen':
      return { name: 'fall', frame: Math.min(CLIPS.fall.frameCount - 1, Math.floor((t / FALL_TIME) * CLIPS.fall.frameCount)) };
    case 'unleashing':
      return { name: 'shoot', frame: clipFrame('shoot', SHOOT_STRIKE_FRAME, t) };
    case 'bracing':
      return { name: 'brace', frame: 0 };
    case 'blown': {
      if (p.y > 0 || p.vy > 0) return { name: 'fall', frame: BLOWN_AIR_FRAME };
      const getUpFrames = CLIPS.fall.frameCount - BLOWN_GET_UP_FRAME;
      const down = Math.max(0, (t - BLOWN_FLIGHT_S) / (BLOWN_DOWN_S - BLOWN_FLIGHT_S));
      return { name: 'fall', frame: Math.min(CLIPS.fall.frameCount - 1, BLOWN_GET_UP_FRAME + Math.floor(down * getUpFrames)) };
    }
    default: {
      // A trick: its own clip, on its own clock.
      if (p.trick) return { name: p.trick.kind, frame: clipFrame(p.trick.kind, 0, p.trick.t) };
      // Fooled: confused or stumbling, on the reaction's clock; on soft brakes he skids on first.
      if (p.fooled) {
        if (p.handling.decel < DECEL && Math.hypot(p.vx, p.vz) > SKID_SPEED) return skidFrame();
        const into = p.fooled.totalS - p.fooled.leftS;
        if (p.fooled.kind === 'stumble') return { name: 'stumble', frame: clipFrame('stumble', 0, into) };
        return { name: 'fooled', frame: Math.floor(into * CLIPS.fooled.fps) % CLIPS.fooled.frameCount };
      }
      // A missed steal: his foot is still out, jabbing at nothing.
      if (p.stumbleS > 0) return { name: 'shoot', frame: SHOOT_STRIKE_FRAME };
      // A drag-back: planted, his sole on the ball.
      if (p.turnS > 0) return { name: 'shoot', frame: SHOOT_CHARGE_FRAME };
      // Soft brakes: the brakes go on, then he sits back on his planted foot until he's slowed.
      if (skid) return skidFrame();
      const name: AnimName = Math.hypot(p.vx, p.vz) < IDLE_SPEED ? 'idle' : sprinting ? 'sprint' : 'run';
      const time = name === p.anim.name ? p.animT : 0;
      return { name, frame: Math.floor(time * CLIPS[name].fps) % CLIPS[name].frameCount };
    }
  }
}

/** Exact under constant gravity, so the jump apex matches the stat curve. */
function fall(p: Player, dt: number): void {
  p.y += p.vy * dt - 0.5 * GRAVITY * dt * dt;
  p.vy -= GRAVITY * dt;
}

/**
 * Against a fence he keeps his speed into it only while he pushes that way:
 * once the stick lets go of the fence, that stale speed is gone, so he turns
 * away at once.
 */
function dropWallSpeed(p: Player, intent: PlayerIntent, field: Field): void {
  const [minX, maxX] = playerSpan(field);
  if (p.x <= minX + PLAYER_R && p.vx < 0 && intent.moveX >= 0) p.vx = 0;
  if (p.x >= maxX - PLAYER_R && p.vx > 0 && intent.moveX <= 0) p.vx = 0;
  if (p.z <= PLAYER_R && p.vz < 0 && intent.moveZ >= 0) p.vz = 0;
  if (p.z >= field.depth - PLAYER_R && p.vz > 0 && intent.moveZ <= 0) p.vz = 0;
}

/**
 * `waveDir`: while he's powered up with the ball and a clear line, the way
 * to Max's goal; an X press then strikes the Energy Wave, turning him to
 * face it. 'wait' while the wave readies, when X does nothing. Null
 * otherwise, when X is a normal shot.
 *
 * Stumbling, he plays on no intent, but buttons held still count as held,
 * so one pressed during the stumble needs a fresh press afterwards. In a
 * drag-back he plants, facing his new way, and a press waits for the turn
 * to end; in a trick he moves on along his facing at the trick's pace, and
 * a press waits for the trick to end.
 */
export function stepPlayer(
  p: Player,
  given: PlayerIntent,
  dt: number,
  field: Field,
  ballAtFeet: boolean,
  waveDir: 1 | -1 | 'wait' | null = null,
): void {
  const turning = p.turnS > 0;
  const trick = p.trick;
  const committed = turning || trick !== null;
  const intent =
    p.stumbleS > 0
      ? NO_INTENT
      : trick
        ? { ...NO_INTENT, moveX: p.facing, pace: trick.pace, faceX: p.facing }
        : turning
          ? { ...NO_INTENT, faceX: p.facing }
          : given;
  const shootPressed = intent.shootHeld && !p.held.shoot;
  const chipPressed = intent.chipHeld && !p.held.chip;
  if (intent.powerHeld && !p.held.power) p.powerArmed = true;
  if (!intent.powerHeld) p.powerArmed = false;
  if (!committed) p.held = { shoot: given.shootHeld, chip: given.chipHeld, power: given.powerHeld };
  p.aim = intent.aim;
  p.stateT += dt;
  p.slideCooldown = Math.max(0, p.slideCooldown - dt);
  p.touchCooldown = Math.max(0, p.touchCooldown - dt);
  p.stumbleS = Math.max(0, p.stumbleS - dt);
  p.stealCooldownS = Math.max(0, p.stealCooldownS - dt);

  if (p.state === 'ground') {
    if (shootPressed && waveDir !== null) {
      // While the wave readies the press is spent, so he doesn't shoot instead.
      if (waveDir !== 'wait') {
        p.facing = waveDir;
        p.kick = { kind: 'wave', aim: intent.aim, active: true, charge: 1, overchargeS: 0 };
        enter(p, 'unleashing');
      }
    } else if (intent.jump) {
      enter(p, 'air');
      p.vy = jumpVelocity(p.stats);
      p.takeoffSpeed = Math.hypot(p.vx, p.vz);
    } else if (shootPressed) {
      enter(p, 'charging');
    } else if (chipPressed && ballAtFeet) {
      enter(p, 'chipping');
    } else if (chipPressed && p.slideCooldown === 0) {
      startSlide(p);
    }
  }

  dropWallSpeed(p, intent, field);
  const moving = intent.moveX !== 0 || intent.moveZ !== 0;
  const sprinting = p.state === 'ground' && intent.sprint && !p.exhausted && moving;
  const target = intent.moveX * runSpeed(p.stats);
  // Winding up a kick he moves at CHARGE_MOVE_FACTOR of a run, in depth as along the pitch.
  const windUp = (runSpeed(p.stats) * CHARGE_MOVE_FACTOR) / Math.max(1, Math.hypot(intent.moveX, intent.moveZ));
  // On the ground he runs the same speed in every direction, diagonals included.
  const moveLen = Math.max(1, Math.hypot(intent.moveX, intent.moveZ));
  const runTarget = (runSpeed(p.stats) * (sprinting ? SPRINT_MULTIPLIER : 1) * (intent.pace ?? 1)) / moveLen;
  // He can turn while running, jumping, or still holding a shot or chip charge; not as he lets go, nor once a kick is swinging.
  const stillCharging = (p.state === 'charging' && intent.shootHeld) || (p.state === 'chipping' && !p.kick && intent.chipHeld);
  const canTurn = p.state === 'ground' || stillCharging || (p.state === 'air' && !p.kick);
  if (canTurn && intent.moveX !== 0) p.facing = intent.moveX > 0 ? 1 : -1;
  if (canTurn && intent.faceX) p.facing = intent.faceX;

  switch (p.state) {
    case 'ground':
      approach2(p, intent.moveX * runTarget, intent.moveZ * runTarget, dt, ACCEL, p.handling.decel);
      break;
    case 'air': {
      if (shootPressed && !p.kick) {
        p.kick = { kind: 'volley', charge: 0, overchargeS: 0, aim: intent.aim, active: true };
        p.stateT = 0;
      }
      if (p.kick?.kind === 'volley') p.kick.active = p.stateT <= VOLLEY_ACTIVE_S;
      // Normalised like the ground target, and capped against the depth speed he took off with,
      // so steering never makes him faster than a run, or than he left the ground.
      const limit = Math.max(runSpeed(p.stats), p.takeoffSpeed);
      const cap = Math.sqrt(Math.max(limit ** 2 - p.vz ** 2, 0));
      p.vx = approach(p.vx, Math.min(Math.max(target / moveLen, -cap), cap), dt, AIR_ACCEL, AIR_ACCEL);
      fall(p, dt);
      if (p.y <= 0 && p.vy <= 0) {
        p.y = 0;
        p.vy = 0;
        p.kick = null;
        enter(p, 'ground');
      }
      break;
    }
    case 'charging':
      if (!intent.shootHeld) {
        release(p, 'shot', intent.aim);
      } else {
        addCharge(p, dt, true);
        approach2(p, intent.moveX * windUp, intent.moveZ * windUp, dt, ACCEL, p.handling.decel);
      }
      break;
    case 'kicking':
      approach2(p, 0, 0, dt, ACCEL, p.handling.decel);
      strike(p, SHOT_TIMING);
      break;
    case 'chipping':
      if (!p.kick && !intent.chipHeld) {
        release(p, 'chip', intent.aim);
      } else if (!p.kick) {
        addCharge(p, dt, false);
        approach2(p, intent.moveX * windUp, intent.moveZ * windUp, dt, ACCEL, p.handling.decel);
      } else {
        approach2(p, 0, 0, dt, ACCEL, p.handling.decel);
        strike(p, CHIP_TIMING);
      }
      break;
    case 'sliding':
      p.vx = p.facing * SLIDE_SPEED * Math.max(0, 1 - p.stateT / SLIDE_TIME);
      p.vz = approach(p.vz, 0, dt, DECEL, DECEL);
      if (p.stateT >= SLIDE_TIME) {
        p.kick = null;
        enter(p, 'ground');
      }
      break;
    case 'fallen':
      p.vx = 0;
      p.vz = 0;
      if (p.y > 0 || p.vy > 0) fall(p, dt);
      if (p.y <= 0) [p.y, p.vy] = [0, 0];
      if (p.stateT >= FALL_TIME) enter(p, 'ground');
      break;
    case 'unleashing':
      // The world fires the wave as he enters this state (and clears kick.active); he just follows through.
      approach2(p, 0, 0, dt, ACCEL, p.handling.decel);
      if (p.stateT >= SHOT_TIMING.doneS) {
        p.kick = null;
        enter(p, 'ground');
      }
      break;
    case 'bracing':
      p.vx = -p.facing * BRACE_SKID_SPEED * Math.max(0, 1 - p.stateT / BRACE_S);
      p.vz = 0;
      if (p.stateT >= BRACE_S) enter(p, 'ground');
      break;
    case 'blown':
      if (p.y > 0 || p.vy > 0) fall(p, dt);
      if (p.y <= 0 && p.vy <= 0) [p.y, p.vy, p.vx, p.vz] = [0, 0, 0, 0];
      if (p.stateT >= BLOWN_DOWN_S) enter(p, 'ground');
      break;
  }

  const [minX, maxX] = playerSpan(field);
  p.x = Math.min(Math.max(p.x + p.vx * dt, minX + PLAYER_R), maxX - PLAYER_R);
  p.z = Math.min(Math.max(p.z + p.vz * dt, PLAYER_R), field.depth - PLAYER_R);
  updateStamina(p, sprinting, dt);

  const anim = chooseAnim(p, sprinting, skidding(p, intent));
  p.animT = anim.name === p.anim.name ? p.animT + dt : 0;
  p.anim = anim;
}
