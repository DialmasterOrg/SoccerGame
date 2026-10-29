import { keeperLevel, keeperLineup, keeperProfile } from '../game/keeper';
import { keeperLooks } from './keeperView';
import { matchFeedback, speedMemo } from '../audio/matchFeedback';
import type { InputFrame } from '../engine/input';
import { createBrain, think, type Difficulty } from '../game/ai';
import { hudSize, updateCamera, type Camera } from '../game/camera';
import { DOG_DIFFICULTY, type DogState } from '../game/dog';
import { createDogBrain, dogThink } from '../game/dogAi';
import { HUMAN_AIM_ERROR_DEG, type Aim } from '../game/kick';
import { cancelCharge, type PlayerIntent } from '../game/player';
import { endPower } from '../game/power';
import { opponentHandling, opponentProfile, opponentStats, type HumanOpponentId } from '../game/opponents';
import { stageFor } from '../game/stage';
import { createWorld, stepWorld, type World } from '../game/world';
import { addMeter } from '../game/power';
import { trickSetup } from '../game/opponents';
import { BASE_STATS } from '../game/stats';
import { clockMinute, endGoalPause } from '../game/match';
import { nextCareerMatch, type CareerMatch } from '../meta/career';
import { hasSkillMoves, powerKit } from '../meta/catalog';
import { animates } from '../art/harrison/outfitFx';
import { changeKitFor, outfitOf } from '../meta/locker';
import type { GoalRecord, StyleKind } from '../meta/economy';
import { BONUSES } from '../meta/objectives';
import { applyMatch, type MatchReward } from '../meta/progress';
import type { GameContext } from './context';
import { drawMenu, menuCue, stepMenu, type MenuState } from './menu';
import { HAT_TRICK_GOALS, TRICK_CALLOUT, goalCallout, noteKick, noteTrick, trickGoal, type LastKick, type TrickChance } from './goalCallout';
import { createKeeperWatch, goalFacts, stepKeeperWatch } from './goalFacts';
import { createGoalMoment, simScale, stepGoalMoment, type GoalMoment } from './goalMoment';
import { stepTrail, type TrailPoint } from './shotTrail';
import { createHudLayer, drawMatch, type MatchHud } from './matchView';
import { OutfitFx } from './outfitView';
import { BRACE_SHAKE, WAVE_SHAKE } from './powerView';
import type { Scene } from './scene';
import { createHelpScene } from './helpScene';
import { createOptionsScene } from './optionsScene';
import { createResultsScene } from './resultsScene';
import { createHubScene } from './hubScene';

export interface MatchScene extends Scene {
  readonly world: World;
  readonly paused: boolean;
  /** The opponent's difficulty right now: a change in Options mid-match applies at once. */
  readonly difficulty: Difficulty;
  /** Biscuit, in his boss match; null against every human opponent. */
  readonly dog: DogState | null;
  /** The HUD's state: names, venue and the away side's sprites. */
  readonly hud: Readonly<MatchHud>;
  /** Harrison's clean steals so far, for the steals bonus. */
  readonly steals: number;
  /** Harrison's goal moment, while it runs. */
  readonly moment: GoalMoment | null;
  /** The line under GOAL!!! naming his goal (HEADER!, HAT-TRICK!...), while the moment runs. */
  readonly callout: string | null;
  /** Where a hard-hit ball has just been, newest first. */
  readonly trail: readonly TrailPoint[];
  /** The career match being played, fixed when the match is made. */
  readonly match: CareerMatch;
  /** Harrison's goals so far, in order. */
  readonly goals: readonly GoalRecord[];
  /** BONUS DONE!, while it shows. */
  readonly bonusCallout: string | null;
  /** What the match paid, from the tick it reached full time. */
  readonly reward: MatchReward | null;
  /** The goal flash is owed to the next drawn frame. */
  readonly flash: boolean;
  /** He celebrates this goal in Golden Form's gold: an Energy Wave goal in Golden Form. */
  readonly goldenCelebration: boolean;
}

export const PAUSE_ITEMS = ['RESUME', 'RESTART', 'HELP', 'OPTIONS', 'QUIT TO HUB'] as const;
/** The pause menu's top row, in HUD pixels. */
const PAUSE_MENU_TOP = 70;
export const BONUS_CALLOUT = 'BONUS DONE!';
/** The bonus callout shows this long, once the goal moment that earned it has ended. */
export const BONUS_SHOW_S = 1.5;
/** The FULL TIME banner shows this long before Results. */
const RESULT_DELAY_S = 1.5;
const PERFECT_SHOW_S = 0.6;
/** How far the stick must lean up or down to aim a shot. */
const AIM_THRESHOLD = 0.5;
/** A hat-trick's second roar comes in this long (real seconds) into the moment. */
const HAT_TRICK_ROAR_S = 1.2;
/** A fired wave shows this many high-contrast impact frames. */
const IMPACT_FRAMES = 2;
/** A trick that fools someone is called out over Harrison for this long. */
export const TRICK_CALLOUT_S = 1;

/** His effects run on their own random numbers, seeded off the match's so a replay looks the same. */
const FX_SEED_OFFSET = 7919;

/** A fresh seed per match so every game plays differently. */
export const newSeed = (): number => Math.floor(Math.random() * 2 ** 32);

const isStyle = (kind: LastKick['kind']): kind is Extract<StyleKind, LastKick['kind']> =>
  kind === 'header' || kind === 'volley' || kind === 'chip' || kind === 'wave';

/** Harrison's intent from the controller: the stick moves and aims, buttons act. */
function harrisonIntent(input: InputFrame): PlayerIntent {
  const aim: Aim = input.moveY < -AIM_THRESHOLD ? 'far' : input.moveY > AIM_THRESHOLD ? 'near' : 'straight';
  return {
    moveX: input.moveX,
    // The stick's up is away from the camera.
    moveZ: -input.moveY,
    aim,
    jump: input.pressed.has('jump'),
    shootHeld: input.held.has('shoot'),
    chipHeld: input.held.has('chip'),
    powerHeld: input.held.has('power'),
    sprint: input.held.has('sprint'),
    steal: input.pressed.has('steal'),
    // The right stick (or F and D): up a rainbow flick, down a stepover.
    ...(input.pressed.has('flick') ? { trick: 'flick' as const } : input.pressed.has('stepover') ? { trick: 'stepover' as const } : {}),
  };
}

/**
 * A career match, by default the next one, on its venue's stage (pitch,
 * canvas and length): Harrison with his bought stats against the match's
 * opponent (Max at the rung's stats, a Park kid at their own), or against
 * Biscuit the Dog, who has his own body and brain and no stats of a
 * player's. It pays out on the tick it reaches full time, then hands over
 * to Results after the FULL TIME banner.
 */
export function createMatchScene(ctx: GameContext, seed: number, match: CareerMatch = nextCareerMatch(ctx.profile)): MatchScene {
  const { art } = ctx;
  let difficulty = ctx.profile.difficulty;
  const dog = match.opponent === 'biscuit';
  const human: HumanOpponentId = match.opponent === 'biscuit' ? 'max' : match.opponent;
  const thinking = opponentProfile(human, difficulty);
  const stage = stageFor(match.venue);
  const world = createWorld(
    { ...ctx.profile.stats },
    dog ? { ...BASE_STATS } : opponentStats(human, match.rung),
    seed,
    { home: HUMAN_AIM_ERROR_DEG, away: thinking.aimErrorDeg },
    powerKit(ctx.profile),
    dog ? DOG_DIFFICULTY[difficulty] : null,
    dog ? null : thinking,
    opponentHandling(human),
    hasSkillMoves(ctx.profile) ? trickSetup(difficulty, match.opponent) : null,
    stage,
    // Harrison's keeper plays at Normal; theirs at the difficulty, both as good as this match's keeper.
    stage.keepers ? keeperLineup(keeperLevel(match), difficulty) : null,
  );
  const brain = createBrain(thinking);
  // Speedy Sam's whoosh past Harrison remembers when it last sounded.
  const whoosh = speedMemo();
  const dogBrain = dog ? createDogBrain(DOG_DIFFICULTY[difficulty]) : null;
  const awayIntent = (dt: number): PlayerIntent => (dogBrain ? dogThink(dogBrain, world, dt) : think(brain, world, world.away, world.home, dt));
  const cam: Camera = { x: world.ball.x - stage.view.w / 2, view: stage.view };
  /** The doubled HUD's layer, made on the first frame drawn; null when the HUD draws at 1×. */
  let overlay: CanvasRenderingContext2D | null | undefined;
  // Decided once: when his kit clashes with theirs, they change.
  const change = dog ? null : changeKitFor(outfitOf(ctx.profile).kit, human);
  const hud: MatchHud = {
    perfect: null,
    moment: null,
    callout: null,
    trail: [],
    flash: false,
    shake: null,
    impactFrames: 0,
    goldenCelebration: false,
    bonusCallout: null,
    trickCallout: null,
    awayName: match.hudName,
    venue: match.venue,
    // Read when drawn, so a scene made without art (in tests) never touches it.
    get awaySprites() {
      return change ? art.opponentIn(human, change) : art.opponents[human].sprites;
    },
    get keeperSprites() {
      if (!world.keepers) return null;
      const looks = keeperLooks(match);
      return { home: art.keepers[looks.home], away: art.keepers[looks.away] };
    },
    fx: animates(outfitOf(ctx.profile)) ? new OutfitFx(outfitOf(ctx.profile), seed + FX_SEED_OFFSET) : null,
  };
  let lastKick: LastKick | null = null;
  /** A goal now would be a trick goal. */
  let trickChance: TrickChance | null = null;
  let trickCalloutUntilS = 0;
  /** Harrison's header, volley, chip and Energy Wave goals, for the style bonus. */
  const styleGoals: StyleKind[] = [];
  /** Every goal of his, for the bonus objective and the stars. */
  const goals: GoalRecord[] = [];
  /** Their keeper's pushes and his kicks, for the School Field's bonuses. */
  const watch = createKeeperWatch();
  const bonus = BONUSES[match.bonus];
  /** His clean steals with the steal button. */
  let steals = 0;
  /** The in-play bonus has been done: the callout is owed, shown as soon as no goal moment is running. */
  let bonusOwed = false;
  let bonusShown = false;
  let bonusUntilS = 0;
  let pause: MenuState | null = null;
  let reward: MatchReward | null = null;
  let results: Scene | null = null;
  let t = 0;
  ctx.audio.setCrowd('match');
  // No music in a match: the crowd carries it.
  ctx.audio.playMusic(null);

  /** Steps a menu, blipping as it goes. */
  const step = (m: MenuState, input: InputFrame) => {
    const r = stepMenu(m, input);
    const cue = menuCue(m, r);
    if (cue) ctx.audio.play(cue);
    return r;
  };
  const openPause = () => {
    pause = { items: PAUSE_ITEMS, index: 0 };
    // A held charge is dropped, not fired, so pausing can't shoot; a power-up ends, keeping the meter.
    cancelCharge(world.home);
    if (world.power) endPower(world.power);
    ctx.audio.setCrowd('low');
  };
  const restart = () => createMatchScene(ctx, seed + 1, match);
  let warmed = false;
  /** Saved at once, so closing the tab during the FULL TIME banner loses nothing. Called once, on the full-time tick. */
  const award = (result: NonNullable<World['match']['result']>) => {
    const { home, away } = world.match.score;
    const done = applyMatch(ctx.profile, { result, goalsFor: home, goalsAgainst: away, styleGoals: [...styleGoals], goals: [...goals], steals }, match, ctx.today());
    ctx.saveProfile(done.profile);
    reward = done.reward;
  };
  /** Whether play (a goal or a steal) has just settled an in-play bonus; if so, its callout is owed. */
  const checkBonus = () => {
    if (bonusShown || bonusOwed || !bonus.inPlay) return;
    const { home, away } = world.match.score;
    bonusOwed = bonus.done({ goalsFor: home, goalsAgainst: away, goals, result: null, steals });
  };
  /** Notes one of his goals: a trick goal as 'trick', otherwise the kick it came from. */
  const recordGoal = (trick: boolean) => {
    goals.push({ minute: clockMinute(world.match), kind: trick ? 'trick' : (lastKick?.kind ?? null), perfect: lastKick?.perfect ?? false, ...goalFacts(world, watch, lastKick) });
    checkBonus();
  };
  /** Shows an owed bonus callout, unless a goal moment is running: it waits behind one, so it never covers it. */
  const showOwedBonus = () => {
    if (!bonusOwed || hud.moment) return;
    bonusOwed = false;
    bonusShown = true;
    hud.bonusCallout = BONUS_CALLOUT;
    bonusUntilS = t + BONUS_SHOW_S;
    ctx.audio.play('star');
  };
  /** Help and Options come back to this match, still paused, with any new difficulty applied to the opponent. */
  const backHere = (): Scene => {
    difficulty = ctx.profile.difficulty;
    brain.profile = opponentProfile(human, difficulty);
    world.aimErrorDeg.away = brain.profile.aimErrorDeg;
    if (world.maxProfile) world.maxProfile = brain.profile;
    if (dogBrain && world.dog) dogBrain.profile = world.dog.profile = DOG_DIFFICULTY[difficulty];
    if (world.tricks) world.tricks = trickSetup(difficulty, match.opponent);
    // Only their keeper changes; whatever he's doing plays out.
    if (world.keepers) world.keepers.away.profile = keeperProfile(keeperLevel(match), difficulty);
    return scene;
  };

  const scene: MatchScene = {
    kind: 'match',
    size: stage.view,
    world,
    get paused() {
      return pause !== null;
    },
    get difficulty() {
      return difficulty;
    },
    dog: world.dog,
    hud,
    get steals() {
      return steals;
    },
    get moment() {
      return hud.moment;
    },
    get callout() {
      return hud.callout;
    },
    get trail() {
      return hud.trail;
    },
    match,
    get goals() {
      return goals;
    },
    get bonusCallout() {
      return hud.bonusCallout;
    },
    get reward() {
      return reward;
    },
    get flash() {
      return hud.flash;
    },
    get goldenCelebration() {
      return hud.goldenCelebration;
    },
    onHidden() {
      if (!pause && world.match.phase !== 'fullTime') openPause();
    },
    update(input, dt) {
      if (pause) {
        const r = step(pause, input);
        pause = r.m;
        if (r.chosen === 'RESTART') return restart();
        if (r.chosen === 'HELP') return createHelpScene(ctx, backHere);
        if (r.chosen === 'OPTIONS') return createOptionsScene(ctx, backHere);
        if (r.chosen === 'QUIT TO HUB') return createHubScene(ctx);
        if (r.chosen === 'RESUME' || r.back || (!r.chosen && input.pressed.has('pause'))) {
          pause = null;
          ctx.audio.setCrowd(hud.moment ? 'roar' : 'match');
          // Buttons held while the menu closes (B is also "back") need a fresh press to act in play.
          world.home.held = { shoot: input.held.has('shoot'), chip: input.held.has('chip'), power: input.held.has('power') };
        }
        return null;
      }
      if (results) return results;
      if (input.pressed.has('pause') && world.match.phase !== 'fullTime' && !(hud.moment && input.pressed.has('confirm'))) {
        // During Harrison's moment Enter (pause plus confirm) skips it instead; Esc and Start still pause.
        openPause();
        return null;
      }

      t += dt;
      // Harrison's goal moment slows or freezes the match; the simulation only sees a smaller dt.
      const moment = hud.moment;
      const simDt = dt * (moment ? simScale(moment) : 1);
      if (simDt > 0) {
        const prevPhase = world.match.phase;
        stepWorld(world, harrisonIntent(input), awayIntent(simDt), simDt);
        stepKeeperWatch(watch, world, simDt);
        const feedback = matchFeedback(world, prevPhase, whoosh);
        for (const cue of feedback.cues) ctx.audio.play(cue);
        for (const kind of feedback.rumble) ctx.rumble.pulse(kind);
        world.events.kicks.forEach((k, i) => {
          if (k.perfect) hud.perfect = { team: i === 0 ? 'home' : 'away', untilS: t + PERFECT_SHOW_S };
        });
        if (world.events.power.fired) {
          hud.flash = true;
          hud.impactFrames = IMPACT_FRAMES;
          hud.shake = { px: WAVE_SHAKE.px, untilS: t + WAVE_SHAKE.s };
        }
        if (world.events.power.braced) hud.shake = { px: BRACE_SHAKE.px, untilS: t + BRACE_SHAKE.s };
        if (world.events.steal === 'stole') {
          steals++;
          checkBonus();
        }
        updateCamera(cam, world.ball, simDt, world.field);
        stepTrail(hud.trail, world.ball);
        lastKick = noteKick(lastKick, world);
        trickChance = noteTrick(trickChance, world, simDt);
        if (world.events.trick.fooled) {
          hud.trickCallout = TRICK_CALLOUT[world.events.trick.fooled];
          trickCalloutUntilS = t + TRICK_CALLOUT_S;
        }
        if (world.events.goal === 'home') {
          const trick = trickGoal(trickChance, lastKick);
          hud.moment = createGoalMoment();
          hud.flash = true;
          hud.trickCallout = null;
          hud.callout = goalCallout(lastKick, world.match.score.home, trick);
          if (lastKick && isStyle(lastKick.kind)) styleGoals.push(lastKick.kind);
          else if (trick) {
            styleGoals.push('trick');
            // A trick goal is a style goal: the world can't see the chance, so the meter's gain comes from here.
            if (world.power) addMeter(world.power, 'styleGoal');
          }
          recordGoal(trick !== null);
          // Forms show while powered up and celebrating: an Energy Wave goal in Golden Form keeps the gold.
          hud.goldenCelebration = lastKick?.kind === 'wave' && world.power?.golden === true;
          // The roar cue swells; the crowd holds it through the celebration.
          ctx.audio.setCrowd('roar');
        }
        if (world.events.goal) {
          lastKick = null;
          trickChance = null;
        }
      }
      if (moment) {
        const before = moment.t;
        // A fresh press skips it; the held shot that scored doesn't, since presses are edges.
        stepGoalMoment(moment, dt, input.pressed.has('confirm') || input.pressed.has('shoot'));
        if (world.match.score.home === HAT_TRICK_GOALS && hud.callout && before < HAT_TRICK_ROAR_S && moment.t >= HAT_TRICK_ROAR_S) {
          ctx.audio.play('roar');
        }
        if (moment.done) {
          endGoalPause(world.match);
          hud.moment = null;
          hud.callout = null;
          hud.goldenCelebration = false;
          ctx.audio.setCrowd('match');
        }
      }
      showOwedBonus();
      if (hud.bonusCallout && t >= bonusUntilS) hud.bonusCallout = null;
      if (hud.trickCallout && t >= trickCalloutUntilS) hud.trickCallout = null;
      if (world.match.phase !== 'fullTime' || !world.match.result) return null;
      if (!reward) award(world.match.result);
      // Results brings in the jingle, after the full-time whistle.
      if (world.match.phaseT >= RESULT_DELAY_S) results = createResultsScene(ctx, reward!);
      return results;
    },
    draw(g) {
      // His first frame, a still kickoff, bakes every set he could need in what he wears, so his first power-up never does.
      if (!warmed) {
        art.warm();
        warmed = true;
      }
      if (overlay === undefined) overlay = createHudLayer(stage.view);
      const { w: hudW, h: hudH } = hudSize(stage.view);
      overlay?.clearRect(0, 0, hudW, hudH);
      drawMatch(g, world, cam, art, t, hud, overlay ?? g);
      if (pause) drawMenu(overlay ?? g, art, pause, hudW / 2, PAUSE_MENU_TOP);
      if (overlay) g.drawImage(overlay.canvas, 0, 0, stage.view.w, stage.view.h);
    },
  };
  return scene;
}
