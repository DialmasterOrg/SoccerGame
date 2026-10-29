import { BALL_R } from '../art/ball';
import { seeded, type Rng } from '../engine/random';
import type { AiProfile } from './ai';
import { BALL_REST_Y, stepBall, type Ball, type BallEvents } from './ball';
import { resolveBodies } from './bodies';
import { canPlace, resolveContacts, type ContactEvents } from './contact';
import { checkPinned, createDog, dropBall, parkBall, quietDog, resetDog, stepDog, vulnerable, type DogEvents, type DogProfile, type DogState } from './dog';
import { goalScored, type Field } from './field';
import { startDragBack, stepDragBack } from './dragBack';
import { createMatch, stepMatch, type MatchState, type Team } from './match';
import { DECEL, NO_INTENT, NORMAL_HANDLING, createPlayer, stepPlayer, type Handling, type Player, type PlayerIntent } from './player';
import {
  POWERED_S,
  addMeter,
  canFireWave,
  canStartPower,
  createPower,
  maxGoal,
  maxGoalDir,
  onTarget,
  tickPower,
  waveReady,
  waveReadying,
  type PowerKit,
  type PowerState,
} from './power';
import { SMALL_STAGE, type Stage } from './stage';
import type { Stats } from './stats';
import { maxHasBall, resolveSteal, stealZone, type StealOutcome } from './steal';
import { quietTricks, startTrick, stepTrick, type TrickEvents, type TrickSetup } from './tricks';
import { fireWave, stepWave, type Wave } from './wave';
import { ballAtFeet, ballIn } from './zones';

/** What Harrison's power-up did this tick. All false without a power move. */
export interface PowerEvents {
  started: boolean;
  /** The wave became ready to fire. */
  ready: boolean;
  cancelled: boolean;
  fired: boolean;
  braced: boolean;
  blown: boolean;
}

export interface WorldEvents {
  kicks: ContactEvents[];
  ball: BallEvents;
  goal: Team | null;
  power: PowerEvents;
  /** What Biscuit did this tick. All false without him. */
  dog: DogEvents;
  /** What Harrison's steal press did this tick; null without one. */
  steal: StealOutcome | null;
  /** What his tricks did this tick. All quiet without them. */
  trick: TrickEvents;
}

export interface World {
  field: Field;
  ball: Ball;
  home: Player;
  away: Player;
  match: MatchState;
  rng: Rng;
  aimErrorDeg: { home: number; away: number };
  events: WorldEvents;
  /** Harrison's super meter; null unless he owns a power move, and then the match plays exactly as before. */
  power: PowerState | null;
  /** The Energy Wave on screen, live or fading. */
  wave: Wave | null;
  /** Biscuit, when the away body is the dog; null in every match against Max, which then plays exactly as before. */
  dog: DogState | null;
  /** Max's difficulty, for the steal's odds; null falls back to Normal's. */
  maxProfile: AiProfile | null;
  /** Fixed ticks so far; its parity decides who acts on the ball first. */
  tick: number;
  /** Harrison's tricks against this opponent; null below level 4, when a trick press does nothing and the match plays exactly as before. */
  tricks: TrickSetup | null;
}

/** A ball slower than this, px/s, is at rest. */
const BALL_RESTING = 40;
/** Where the kicking-off player stands, behind the ball. */
const KICKOFF_GAP = 12;
/** How far inside his own half the other player waits. */
const KICKOFF_DEFENDER_DEPTH = 70;

const attackDir = (team: Team): 1 | -1 => (team === 'home' ? 1 : -1);

const quietPower = (): PowerEvents => ({ started: false, ready: false, cancelled: false, fired: false, braced: false, blown: false });
const quietContact = (): ContactEvents => ({ touched: false, blocked: false, kicked: null, perfect: false, tackledBall: false, trippedOpponent: false });
const quietBall = (): BallEvents => ({ bounced: false, hitBar: false, hitPost: false, hitWall: false, hitNet: false });
const quietEvents = (): WorldEvents => ({
  kicks: [],
  ball: quietBall(),
  goal: null,
  power: quietPower(),
  dog: quietDog(),
  steal: null,
  trick: quietTricks(),
});

/** The kicks that make a goal a style goal. */
const STYLE_KINDS: ReadonlySet<PowerState['lastKind']> = new Set(['header', 'volley', 'chip', 'wave']);

/**
 * `kit` gives Harrison his super meter; without one the match plays exactly
 * as it always has. `dog` makes the away body Biscuit, with that profile.
 * `awayHandling` is the away player's brakes, touch and shot (Speedy Sam's
 * are his own; everyone else's are normal). `tricks` gives Harrison his
 * stepover and flick against this opponent. `stage` is the pitch and the
 * match's length.
 */
export function createWorld(
  homeStats: Stats,
  awayStats: Stats,
  seed: number,
  aimErrorDeg: { home: number; away: number },
  kit: PowerKit | null = null,
  dog: DogProfile | null = null,
  maxProfile: AiProfile | null = null,
  awayHandling: Handling = NORMAL_HANDLING,
  tricks: TrickSetup | null = null,
  stage: Stage = SMALL_STAGE,
): World {
  const { field } = stage;
  const centre = field.width / 2;
  const w: World = {
    field,
    ball: { x: centre, y: BALL_REST_Y, z: field.depth / 2, vx: 0, vy: 0, vz: 0, spin: 0, spinAngle: 0 },
    home: createPlayer('home', homeStats, centre, 1),
    away: createPlayer('away', awayStats, centre, -1),
    match: createMatch(stage.matchS, stage.goldenGoalS),
    rng: seeded(seed),
    aimErrorDeg,
    events: quietEvents(),
    power: kit ? createPower(kit) : null,
    wave: null,
    dog: dog ? createDog(dog) : null,
    maxProfile,
    tick: 0,
    tricks,
  };
  w.away.handling = awayHandling;
  placeForKickoff(w);
  return w;
}

/** Puts a player back on his feet at (x, z), standing still, keeping his stamina, held buttons and handling. */
function reset(p: Player, x: number, z: number): void {
  const { stamina, held, exhausted, handling } = p;
  Object.assign(p, createPlayer(p.team, p.stats, x, attackDir(p.team), z), { stamina, held, exhausted, handling });
}

/**
 * Ball on the centre spot, the kicking-off player just behind it, the other
 * back in his own half; at Harrison's kickoff Max waits where his
 * difficulty says (Biscuit, and a world without Max's profile, as before).
 */
export function placeForKickoff(w: World): void {
  const centre = w.field.width / 2;
  const mid = w.field.depth / 2;
  Object.assign(w.ball, { x: centre, y: BALL_REST_Y, z: mid, vx: 0, vy: 0, vz: 0, spin: 0 });
  delete w.ball.touchedBy;
  const spot = w.match.kickoffTeam === 'home' && w.dog === null && w.maxProfile ? w.maxProfile.kickoffSpot : { back: KICKOFF_DEFENDER_DEPTH, off: 0 };
  for (const p of [w.home, w.away]) {
    const dir = attackDir(p.team);
    if (p.team === w.match.kickoffTeam) reset(p, centre - KICKOFF_GAP * dir, mid);
    else reset(p, centre - spot.back * dir, mid + spot.off);
  }
  if (w.dog) resetDog(w.dog);
}

/**
 * Steps a player on his intent while the ball is in play, standing still
 * otherwise. Buttons held outside play still count as held, so one held
 * through a goal pause or kickoff needs a fresh press.
 */
function stepOne(p: Player, intent: PlayerIntent, live: boolean, w: World, dt: number, waveDir: 1 | -1 | 'wait' | null = null): void {
  stepPlayer(p, live ? intent : NO_INTENT, dt, w.field, ballAtFeet(p, w.ball), waveDir);
  if (!live) p.held = { shoot: intent.shootHeld, chip: intent.chipHeld, power: intent.powerHeld };
}

/** Charging a shot, or a chip not yet released. */
const windingUp = (p: Player): boolean => p.state === 'charging' || (p.state === 'chipping' && !p.kick);

/** Moves the ball dz in depth with him, unless that would put it through a wall, a post or a net. */
function carryInDepth(w: World, dz: number): void {
  if (dz !== 0 && canPlace(w.ball, w.ball.x, w.ball.z + dz, w.field)) w.ball.z += dz;
}

/** The away player's close control while it fakes: the ball at its feet moves with it, unless that would put it in a goal or a fence. */
const CARRY_AHEAD = 8;
function carryAtFeet(w: World, p: Player): void {
  const [x, z] = [p.x + p.facing * CARRY_AHEAD, p.z];
  if (!maxHasBall(p, w.ball) || !canPlace(w.ball, x, z, w.field)) return;
  Object.assign(w.ball, { x, z, vx: p.vx, vz: p.vz });
}

/** The meter's gains from Harrison's part in this tick's contacts. */
function creditMeter(power: PowerState, home: ContactEvents, w: World): void {
  if (home.touched) addMeter(power, 'touch');
  if (home.tackledBall) addMeter(power, 'tackle');
  if (home.kicked && onTarget(w.ball, maxGoal(w))) addMeter(power, 'onTarget');
}

/** Which of Harrison's kicks is still in play: Max playing the ball, or a dribble touch of his own, ends it. */
function noteLastKind(power: PowerState, [home, away]: ContactEvents[]): void {
  if (away && (away.touched || away.kicked || away.tackledBall)) power.lastKind = null;
  else if (home?.kicked) power.lastKind = home.kicked;
  else if (home?.touched) power.lastKind = null;
}

/**
 * Whether a power-up that didn't fire this tick is over: play stopped, he
 * was knocked down, Max played the ball, or he made any other move.
 */
function powerEnds(w: World, live: boolean, [, away]: ContactEvents[]): boolean {
  const home = w.home;
  const otherMove = (home.kick !== null && home.kick.kind !== 'wave') || home.state === 'charging' || home.state === 'chipping' || home.trick !== null;
  const maxPlayed = away !== undefined && (away.touched || away.kicked !== null || away.tackledBall);
  return !live || home.state === 'fallen' || maxPlayed || otherMove;
}

/**
 * Contacts with Biscuit on the pitch. Only Harrison plays the ball with his
 * feet, never trips the dog, and never squeezes a 50/50 out of him. A
 * carried ball is out of play, except while the dog is slow (jinking) when
 * it is contested where it would land, at the muzzle on the ground: any
 * slide, touch or kick that reaches it knocks it out of his mouth. The dog's own grab reports as a touch.
 * In his jink a steal tap with the ball in reach counts as a touch; otherwise it does nothing.
 */
function dogContacts(w: World, dog: DogState, ev: DogEvents, steal: boolean): ContactEvents[] {
  let home = quietContact();
  const carried = dog.carrying;
  if (!w.wave?.live && w.home.turnS === 0 && w.home.trick === null && (!carried || vulnerable(dog))) {
    if (carried) w.ball.y = BALL_REST_Y;
    home = resolveContacts(w.home, w.away, w.ball, w.aimErrorDeg.home, w.rng, w.field, { trips: false, squeeze: false });
    const jab = steal && dog.jinkS > 0 && w.home.state === 'ground' && ballIn(stealZone(w.home), w.ball, BALL_R);
    if (carried && jab) home.touched = true;
    if (carried && (home.tackledBall || home.touched || home.kicked)) {
      dropBall(w, true);
      ev.dropped = true;
    }
  }
  return [home, { ...quietContact(), touched: ev.grabbed }];
}

/**
 * One fixed tick: players, then their bodies kept apart and out of the
 * goals, then the wave, the ball, contacts and the match rules. Intents
 * only count while the ball is in play.
 *
 * Harrison's power-up: a Y press with the ball powers him up at once, for
 * POWERED_S, while he keeps playing. While it lasts, X with the ball
 * strikes the Energy Wave. It ends unfired when the time runs out, play
 * stops, Max plays the ball or knocks him down, or he makes another move;
 * that keeps the meter, and only a fired wave spends it. While the wave is
 * live nobody else touches the ball: only Max standing in its path can
 * stop it.
 */
export function stepWorld(w: World, homeIntent: PlayerIntent, awayIntent: PlayerIntent, dt: number): void {
  const live = w.match.phase === 'playing';
  const power = quietPower();
  const home = w.home;
  const wasActive = (w.power?.activeS ?? 0) > 0;
  const wasReadying = waveReadying(w.power);
  if (w.power) tickPower(w.power, dt);
  if (wasReadying && w.power && waveReady(w.power)) power.ready = true;
  // Powered up, X only ever fires the wave: until it can (ready, with the ball, a clean line), the press does nothing.
  const waveDir = live && canFireWave(w) ? maxGoalDir(w) : live && (w.power?.activeS ?? 0) > 0 ? 'wait' : null;
  // A trick press with the stick back is the trick, not a drag-back.
  const started = startTrick(w, homeIntent);
  if (startDragBack(w, homeIntent)) w.ball.touchedBy = 'home';
  // Winding up with the ball at his feet, he rolls it along with him in depth.
  const carryFromZ = ballAtFeet(home, w.ball) ? home.z : null;
  stepOne(home, homeIntent, live, w, dt, waveDir);
  // The dog runs on his own legs; braced or blown away, his body is a player's like Max's.
  const dogBody = w.dog !== null && w.away.state !== 'bracing' && w.away.state !== 'blown';
  const dogFrom = { x: w.away.x, z: w.away.z };
  const dog = dogBody ? stepDog(w, awayIntent, live, dt) : quietDog();
  if (!dogBody) stepOne(w.away, w.dog ? NO_INTENT : awayIntent, live, w, dt);
  if (!w.dog && live && awayIntent.carry) carryAtFeet(w, w.away);
  if (w.power && home.powerArmed && canStartPower(w)) {
    home.powerArmed = false;
    w.power.activeS = POWERED_S;
    power.started = true;
  }
  if (w.power && home.state === 'unleashing' && home.kick?.kind === 'wave' && home.kick.active) {
    home.kick.active = false;
    w.wave = fireWave(w);
    w.power.activeS = 0;
    power.fired = true;
  }
  resolveBodies(home, w.away, w.field);
  if (dogBody && live && checkPinned(w, awayIntent, Math.hypot(w.away.x - dogFrom.x, w.away.z - dogFrom.z), dt)) dog.dropped = true;
  if (carryFromZ !== null && windingUp(home)) carryInDepth(w, home.z - carryFromZ);
  const steal = resolveSteal(w, homeIntent);
  if (steal === 'stole' || steal === 'poked' || steal === 'trapped') w.ball.touchedBy = 'home';
  stepDragBack(w, dt);
  const trick = { ...stepTrick(w, dt), started };
  // Wrong-footed by a clean steal, he can't be fooled either: the world can't see his brain, so it's wise for that beat.
  if (steal === 'stole') w.away.wiseS = Math.max(w.away.wiseS, w.maxProfile?.wrongFootedS ?? 0);

  const { braced, blown } = stepWave(w, dt);
  [power.braced, power.blown] = [braced, blown];
  // A carried ball isn't simulated: it rides in the dog's mouth.
  const ball = w.dog?.carrying ? quietBall() : stepBall(w.ball, dt, w.field);
  // The second player to act on the ball has the last word, so take turns going first.
  // A ball just trapped at his feet isn't a 50/50 this tick, so the squirt can't undo the trap at once.
  const squeeze = steal !== 'stole' && steal !== 'trapped';
  // In a drag-back his sole has the ball, and in a trick the trick has it: only the other player's contacts can take it.
  const contact = (p: Player, other: Player) => {
    // A player fooled by a trick can't play the ball at all.
    if (w.wave?.live || (p === home && (home.turnS > 0 || home.trick !== null)) || p.fooled) return quietContact();
    // Harrison, and a player on soft brakes who can't stop short of his own goal, never knock the ball at it near it.
    const guarded = p === home || p.handling.decel < DECEL;
    // A fooled opponent can't contest the ball, so it's never a 50/50 with him.
    const ev = resolveContacts(p, other, w.ball, w.aimErrorDeg[p.team], w.rng, w.field, { trips: true, squeeze: squeeze && !other.fooled, clearUpfield: guarded, keepOut: guarded });
    if (ev.touched || ev.kicked || ev.tackledBall) w.ball.touchedBy = p.team;
    return ev;
  };
  const homeFirst = w.tick % 2 === 0;
  let kicks: ContactEvents[];
  if (w.dog) kicks = dogContacts(w, w.dog, dog, live && homeIntent.steal);
  else {
    const first = homeFirst ? contact(home, w.away) : contact(w.away, home);
    const second = homeFirst ? contact(w.away, home) : contact(home, w.away);
    kicks = homeFirst ? [first, second] : [second, first];
  }
  // A ball Harrison blocks, or that comes to rest at his feet, is his: the other side's long touch no longer claims it.
  const resting = Math.hypot(w.ball.vx, w.ball.vz) < BALL_RESTING;
  if (kicks[0]?.blocked || (resting && ballAtFeet(home, w.ball))) w.ball.touchedBy = 'home';
  w.tick++;
  if (w.power && !power.fired && (wasActive || power.started)) {
    if (w.power.activeS > 0 && powerEnds(w, live, kicks)) w.power.activeS = 0;
    if (w.power.activeS === 0) power.cancelled = true;
  }
  if (w.power) {
    creditMeter(w.power, kicks[0]!, w);
    noteLastKind(w.power, kicks);
  }

  // Written after everything has moved, so the goal sees the carried ball where he is.
  if (w.dog?.carrying) parkBall(w);
  const before = { ...w.match.score };
  const { resetForKickoff } = stepMatch(w.match, dt, goalScored(w.field, w.ball));
  const goal: Team | null = w.match.score.home > before.home ? 'home' : w.match.score.away > before.away ? 'away' : null;
  if (w.power && goal) {
    if (goal === 'home' && STYLE_KINDS.has(w.power.lastKind)) addMeter(w.power, 'styleGoal');
    w.power.lastKind = null;
  }
  w.events = { kicks, ball, goal, power, dog, steal, trick };
  if (resetForKickoff) {
    placeForKickoff(w);
    w.wave = null;
  }
}
