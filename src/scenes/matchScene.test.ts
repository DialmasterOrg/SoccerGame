import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordingAudio } from '../audio/testAudio';
import { recordingRumble } from '../engine/testRumble';
import type { GameContext } from './context';
import { DIFFICULTY } from '../game/ai';
import { BALL_REST_Y } from '../game/ball';
import { CREW_PROFILES, CREW_STATS } from '../game/crew';
import { seeded } from '../engine/random';
import { DOG_DIFFICULTY } from '../game/dog';
import { GOAL_PAUSE_S } from '../game/match';
import { NORMAL_HANDLING, NO_INTENT } from '../game/player';
import { keeperProfile, quietKeepers, stepKeeper } from '../game/keeper';
import { SAM_HANDLING, SAM_PROFILES, SAM_STATS } from '../game/sam';
import { BASE_STATS } from '../game/stats';
import { WAVE_READY_S } from '../game/power';
import { matchById, type CareerMatch } from '../meta/career';
import { SCHOOL_FIELD } from '../game/field';
import { maxStats } from '../meta/ladder';
import { EXTRA_IDS, GIFTS, LOCKER_ITEMS, itemPrice } from '../meta/locker';
import { newProfile } from '../meta/profile';
import { DEFAULT_SETTINGS } from '../meta/settings';
import { BONUS_CALLOUT, BONUS_SHOW_S, PAUSE_ITEMS, TRICK_CALLOUT_S, createMatchScene, type MatchScene } from './matchScene';
import { trickSetup } from '../game/opponents';
import type { Scene } from './scene';
import { fakeArt, recordingContext, stubCanvases, type Named } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';

const STEP = 1 / 60;

function live(): MatchScene {
  const s = createMatchScene(testContext(), 1);
  s.world.match.phase = 'playing';
  return s;
}

function run(s: MatchScene, seconds: number, held: Parameters<typeof frame>[1] = []): void {
  for (let i = 0; i < Math.round(seconds / STEP); i++) s.update(frame([], held), STEP);
}

describe('match scene', () => {
  it('match scene pauses when the tab hides and does not advance the clock while paused', () => {
    const s = live();
    run(s, 1);
    const clock = s.world.match.clockS;
    s.onHidden?.();
    expect(s.paused).toBe(true);
    run(s, 2);
    expect(s.world.match.clockS).toBe(clock);
  });

  it('pause opens the menu and resume continues the match', () => {
    const s = live();
    s.update(frame(['pause']), STEP);
    expect(s.paused).toBe(true);
    s.update(frame(['confirm']), STEP);
    expect(s.paused).toBe(false);
  });

  it('pausing mid-charge cancels the charge instead of shooting', () => {
    const s = live();
    run(s, 0.3, ['shoot']);
    expect(s.world.home.state).toBe('charging');
    s.update(frame(['pause'], ['shoot']), STEP);
    s.update(frame(['confirm']), STEP);
    run(s, 0.5);
    expect(s.world.home.kick).toBeNull();
    expect(s.world.home.charge).toBe(0);
    expect(s.world.home.state).not.toBe('kicking');
  });

  it('backing out of the pause menu with B does not start a slide', () => {
    const s = live();
    s.world.ball.x = 100;
    s.update(frame(['pause']), STEP);
    s.update(frame(['back', 'chip']), STEP);
    expect(s.paused).toBe(false);
    for (let i = 0; i < 5; i++) s.update(frame([], ['back', 'chip']), STEP);
    expect(s.world.home.state).toBe('ground');
  });

  it('backing out of the pause menu with B does not start a chip', () => {
    const s = live();
    s.update(frame(['pause']), STEP);
    s.update(frame(['back', 'chip']), STEP);
    for (let i = 0; i < 5; i++) s.update(frame([], ['back', 'chip']), STEP);
    expect(s.world.home.state).toBe('ground');
  });

  it('restart from the pause menu returns a fresh 0-0 match', () => {
    const s = live();
    s.world.match.score.home = 2;
    run(s, 1);
    s.update(frame(['pause']), STEP);
    s.update(frame(['down']), STEP);
    const next = s.update(frame(['confirm']), STEP) as MatchScene | null;
    expect(next?.world.match.score).toEqual({ home: 0, away: 0 });
    expect(next?.world.match.clockS).toBe(0);
  });

  it('QUIT TO HUB goes to the Hub with the crowd off and saves nothing', () => {
    const ctx = testContext();
    const s = createMatchScene(ctx, 1);
    s.world.match.phase = 'playing';
    run(s, 1);
    s.update(frame(['pause']), STEP);
    s.update(frame(['up']), STEP);
    expect(s.update(frame(['confirm']), STEP)?.kind).toBe('hub');
    expect(ctx.audio.crowd).toBe('off');
    expect(ctx.savedProfiles).toHaveLength(0);
  });

  it('his Stamina reaches the match, and the opponent stays at Stamina 1', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), stats: { ...BASE_STATS, stamina: 10 } } }), 1);
    expect(s.world.home.stats.stamina).toBe(10);
    expect(s.world.away.stats.stamina).toBe(1);
  });

  it('Harrison plays with his bought stats', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), stats: { speed: 4, power: 2, jump: 3, control: 1, stamina: 1 } } }), 1);
    expect(s.world.home.stats).toEqual({ speed: 4, power: 2, jump: 3, control: 1, stamina: 1 });
  });

  it('plays the next career match by default, Max at that rung', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), ladderWins: 2 } }), 1);
    expect(s.match.id).toBe('backyard-3');
    expect(s.world.away.stats).toEqual(maxStats(3));
  });

  it('a new profile plays match 1, Harrison and Max both as they were', () => {
    const s = live();
    expect(s.match.id).toBe('backyard-1');
    expect(s.world.home.stats).toEqual(BASE_STATS);
    expect(s.world.away.stats).toEqual(BASE_STATS);
  });

  it('a chosen rung plays that rung, and Restart keeps it', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), ladderWins: 6 } }), 1, matchById('backyard-2')!);
    expect(s.match.id).toBe('backyard-2');
    expect(s.world.away.stats).toEqual(maxStats(2));
    s.update(frame(['pause']), STEP);
    s.update(frame(['down']), STEP);
    const again = s.update(frame(['confirm']), STEP) as MatchScene;
    expect(again.match.id).toBe('backyard-2');
    expect(again.world.away.stats).toEqual(maxStats(2));
  });

  it('the boss match has a dog, no stand-in', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), ladderWins: 10 } }), 1);
    expect(s.match.id).toBe('backyard-boss');
    expect(s.match.hudName).toBe('BISCUIT');
    expect(s.dog).not.toBeNull();
    expect(s.world.dog?.profile).toEqual(DOG_DIFFICULTY.normal);
  });

  it('a rung has no dog', () => {
    expect(createMatchScene(testContext(), 1).dog).toBeNull();
  });

  it('in the boss match the dog plays: he takes the ball off a Harrison who stands still', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), ladderWins: 10 } }), 1);
    s.world.match.phase = 'playing';
    let took = false;
    for (let i = 0; i < 180 && !took; i++) {
      s.update(frame(), STEP);
      took = s.dog?.carrying ?? false;
    }
    expect(took).toBe(true);
  });

  describe('the goal record', () => {
    /** Stages Harrison heading the ball into Max's goal, and steps until his goal moment starts. */
    function headerGoal(s: MatchScene): void {
      Object.assign(s.world.away, { x: 300 });
      Object.assign(s.world.home, { x: 540, z: 32, y: 10, state: 'air', vy: 0, facing: 1, kick: null });
      Object.assign(s.world.ball, { x: 543, y: 40, z: 32, vx: -50, vy: -100, vz: 0 });
      let n = 0;
      while (!s.moment && n++ < 60) s.update(frame(), STEP);
      expect(s.moment).not.toBeNull();
    }

    it('records each of his goals with the minute, kind and perfect', () => {
      const s = live();
      s.world.match.clockS = 40;
      headerGoal(s);
      expect(s.goals).toEqual([{ minute: 40, kind: 'header', perfect: false, outsideBox: false, rebound: false }]);
      run(s, 4);
      s.world.match.phase = 'playing';
      Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100, vy: 0, vz: 0 });
      s.update(frame(), STEP);
      expect(s.world.events.goal).toBe('home');
      expect(s.goals).toHaveLength(2);
      expect(s.goals[1]).toMatchObject({ kind: null, perfect: false });
    });

    it('a golden-goal winner is minute 90', () => {
      const s = live();
      Object.assign(s.world.match, { goldenGoal: true, clockS: 90, goldenS: 10, score: { home: 1, away: 1 } });
      Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100 });
      s.update(frame(), STEP);
      expect(s.world.events.goal).toBe('home');
      expect(s.goals[0]?.minute).toBe(90);
    });

    it('BONUS DONE! shows after the goal moment, once, with its cue', () => {
      const ctx = testContext({ profile: { ...newProfile(), ladderWins: 2 } });
      const s = createMatchScene(ctx, 1);
      s.world.match.phase = 'playing';
      expect(s.match.bonus).toBe('header');
      headerGoal(s);
      expect(s.bonusCallout).toBeNull();
      run(s, 2);
      expect(s.bonusCallout).toBeNull();
      run(s, 2);
      expect(s.moment).toBeNull();
      expect(s.bonusCallout).toBe(BONUS_CALLOUT);
      expect(ctx.audio.played.filter(c => c === 'star')).toHaveLength(1);
      run(s, BONUS_SHOW_S + 0.05);
      expect(s.bonusCallout).toBeNull();
      headerGoal(s);
      run(s, 4.5);
      expect(s.bonusCallout).toBeNull();
      expect(ctx.audio.played.filter(c => c === 'star')).toHaveLength(1);
    });

    it('a goal that does not settle the bonus shows nothing', () => {
      const s = live();
      expect(s.match.bonus).toBe('score3');
      headerGoal(s);
      run(s, 4.5);
      expect(s.bonusCallout).toBeNull();
    });

    it('the summary it saves carries the goals and the match', () => {
      const ctx = testContext();
      const s = createMatchScene(ctx, 1);
      s.world.match.phase = 'playing';
      s.world.match.clockS = 20;
      headerGoal(s);
      run(s, 4);
      s.world.match.clockS = 89.99;
      run(s, 3);
      expect(s.world.match.phase).toBe('fullTime');
      expect(s.reward!.summary.goals).toEqual([{ minute: 20, kind: 'header', perfect: false, outsideBox: false, rebound: false }]);
      expect(s.reward!.career.match.id).toBe('backyard-1');
      expect(ctx.savedProfiles.at(-1)?.career.stars['backyard-1']).toBeGreaterThan(0);
    });
  });

  it('up on the stick runs away from the camera, down toward it', () => {
    const s = live();
    const z = s.world.home.z;
    for (let i = 0; i < 20; i++) s.update({ ...frame(), moveY: -1 }, STEP);
    expect(s.world.home.z).toBeGreaterThan(z);
    for (let i = 0; i < 40; i++) s.update({ ...frame(), moveY: 1 }, STEP);
    expect(s.world.home.z).toBeLessThan(z);
  });

  it('the stick aims shots: up is the far post', () => {
    const s = live();
    run(s, 0.2, ['shoot']);
    s.update({ ...frame(), moveY: -1 }, STEP);
    expect(s.world.home.kick?.aim).toBe('far');
  });

  it('full time awards once, then Results follows the banner', () => {
    const ctx = testContext();
    const s = createMatchScene(ctx, 1);
    Object.assign(s.world.match, { phase: 'playing', clockS: 89.99, score: { home: 2, away: 1 } });
    run(s, 0.1);
    expect(s.world.match.phase).toBe('fullTime');
    expect(ctx.savedProfiles).toHaveLength(1);
    expect(s.reward).not.toBeNull();
    expect(s.reward!.summary).toEqual({ result: 'win', goalsFor: 2, goalsAgainst: 1, styleGoals: [], goals: [], steals: 0 });
    expect(ctx.profile.ladderWins).toBe(1);
    const kinds: (string | undefined)[] = [];
    for (let i = 0; i < Math.round(2 / STEP); i++) kinds.push(s.update(frame(), STEP)?.kind);
    expect(kinds.indexOf('results')).toBeGreaterThan(Math.round(1.3 / STEP));
    expect(ctx.savedProfiles).toHaveLength(1);
  });

  it('stepping the match again after the hand-off hands over the same Results', () => {
    const s = live();
    Object.assign(s.world.match, { clockS: 89.99, score: { home: 0, away: 1 } });
    run(s, 2);
    const a = s.update(frame(), STEP);
    const b = s.update(frame(), STEP);
    expect(a?.kind).toBe('results');
    expect(b).toBe(a);
  });

  it('RESTART forfeits the match', () => {
    const ctx = testContext();
    const s = createMatchScene(ctx, 1);
    Object.assign(s.world.match, { phase: 'playing', clockS: 80, score: { home: 3, away: 0 } });
    s.update(frame(['pause']), STEP);
    s.update(frame(['down']), STEP);
    const next = s.update(frame(['confirm']), STEP) as MatchScene;
    run(next, 0.1);
    expect(ctx.savedProfiles).toHaveLength(0);
    expect(ctx.profile).toEqual(newProfile());
  });

  it('pause menu lists RESUME, RESTART, HELP, OPTIONS, QUIT TO HUB', () => {
    expect(PAUSE_ITEMS).toEqual(['RESUME', 'RESTART', 'HELP', 'OPTIONS', 'QUIT TO HUB']);
  });
});

describe('match scene: pause menu screens', () => {
  /** Opens the pause menu and picks `item`; returns whatever scene that leads to. */
  function pick(s: MatchScene, item: (typeof PAUSE_ITEMS)[number]): Scene | null {
    s.update(frame(['pause']), STEP);
    for (let i = 0; i < PAUSE_ITEMS.indexOf(item); i++) s.update(frame(['down']), STEP);
    return s.update(frame(['confirm']), STEP);
  }

  function liveWith(ctx: GameContext, match?: CareerMatch): MatchScene {
    const s = createMatchScene(ctx, 1, match);
    s.world.match.phase = 'playing';
    return s;
  }

  it('help from pause returns to the paused match', () => {
    const s = live();
    const clock = s.world.match.clockS;
    const help = pick(s, 'HELP');
    expect(help?.kind).toBe('help');
    for (let i = 0; i < 30; i++) help!.update(frame([]), STEP);
    expect(help!.update(frame(['back']), STEP)).toBe(s);
    expect(s.paused).toBe(true);
    expect(s.world.match.clockS).toBe(clock);
  });

  it('options from pause returns to the paused match', () => {
    const s = live();
    const options = pick(s, 'OPTIONS');
    expect(options?.kind).toBe('options');
    expect(options!.update(frame(['back']), STEP)).toBe(s);
    expect(s.paused).toBe(true);
  });

  // Review focus 5
  it('a difficulty change mid-match changes only their keeper, and his dive plays out', () => {
    const ctx = testContext();
    const s = liveWith(ctx, { ...matchById('backyard-1')!, venue: 'school' });
    const k = s.world.keepers!.away;
    stepKeeper(s.world, k, { move: NO_INTENT, dive: { dirX: 0, dirZ: 1 } }, true, 1 / 60, quietKeepers());
    const options = pick(s, 'OPTIONS')!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(s.world.keepers!.away.profile).toEqual(keeperProfile(1, 'hard'));
    expect(s.world.keepers!.home.profile).toEqual(keeperProfile(1, 'normal'));
    expect([k.act, k.dive]).toEqual(['dive', { dirX: 0, dirZ: 1 }]);
  });

  it('a difficulty change from pause applies to the current match', () => {
    const ctx = testContext();
    const s = liveWith(ctx);
    const options = pick(s, 'OPTIONS')!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(ctx.profile.difficulty).toBe('hard');
    expect(s.world.aimErrorDeg.away).toBe(DIFFICULTY.hard.aimErrorDeg);
    expect(s.difficulty).toBe('hard');
  });

  it("Max's difficulty reaches the world for the steal, and a change from pause replaces it", () => {
    const ctx = testContext();
    const s = liveWith(ctx);
    expect(s.world.maxProfile).toEqual(DIFFICULTY.normal);
    const options = pick(s, 'OPTIONS')!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(s.world.maxProfile).toEqual(DIFFICULTY.hard);
  });

  it('against Biscuit the world has no Max profile', () => {
    const s = createMatchScene(testContext({ profile: { ...newProfile(), ladderWins: 10 } }), 1);
    expect(s.world.maxProfile).toBeNull();
  });

  it('LB in play is a steal press: with nothing in reach he stumbles', () => {
    const s = live();
    s.world.ball.x += 100;
    s.update(frame(['steal']), STEP);
    expect(s.world.events.steal).toBe('whiff');
    expect(s.world.home.stumbleS).toBeGreaterThan(0);
  });

  it('Options mid-match re-applies the dog profile', () => {
    const ctx = testContext({ profile: { ...newProfile(), ladderWins: 10 } });
    const s = liveWith(ctx);
    const options = pick(s, 'OPTIONS')!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(ctx.profile.difficulty).toBe('hard');
    expect(s.world.dog!.profile).toEqual(DOG_DIFFICULTY.hard);
  });

  it('backing out of Help with B and resuming does not slide or chip', () => {
    const s = live();
    const help = pick(s, 'HELP')!;
    expect(help.update(frame(['back'], ['chip']), STEP)).toBe(s);
    s.update(frame([], ['back', 'chip']), STEP);
    s.update(frame(['pause'], ['back', 'chip']), STEP);
    expect(s.paused).toBe(false);
    run(s, 0.5, ['back', 'chip']);
    expect(s.world.home.state).toBe('ground');
  });

  it('backing out of Options with B, then B again to resume, does not slide', () => {
    const s = live();
    const options = pick(s, 'OPTIONS')!;
    options.update(frame(['back'], ['chip']), STEP);
    s.update(frame(['back'], ['chip']), STEP);
    expect(s.paused).toBe(false);
    run(s, 0.5, ['back', 'chip']);
    expect(s.world.home.state).toBe('ground');
  });

  it('quit to hub opens the Hub', () => {
    expect(pick(live(), 'QUIT TO HUB')?.kind).toBe('hub');
  });

  describe('sound', () => {
    function withAudio() {
      const audio = recordingAudio();
      const s = createMatchScene(testContext({ audio }), 1);
      s.world.match.phase = 'playing';
      return { s, audio };
    }

    it('a home goal plays net and roar', () => {
      const { s, audio } = withAudio();
      Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100, vy: 0, vz: 0 });
      s.update(frame(), STEP);
      expect(s.world.events.goal).toBe('home');
      expect(audio.played).toEqual(expect.arrayContaining(['net', 'roar']));
    });

    it('the crowd is at match level in play and low while paused', () => {
      const { s, audio } = withAudio();
      expect(audio.crowd).toBe('match');
      s.update(frame(['pause']), STEP);
      expect(audio.crowd).toBe('low');
      s.update(frame(['confirm']), STEP);
      expect(audio.crowd).toBe('match');
    });

    it('quit to hub turns the crowd off', () => {
      const { s, audio } = withAudio();
      s.update(frame(['pause']), STEP);
      s.update(frame(['up']), STEP);
      expect(s.update(frame(['confirm']), STEP)?.kind).toBe('hub');
      expect(audio.crowd).toBe('off');
    });

    it("a home goal rumbles goal; RUMBLE OFF is respected by the Rumble, not the scene", () => {
      const rumble = recordingRumble();
      const s = createMatchScene(testContext({ settings: { ...DEFAULT_SETTINGS, rumble: false }, rumble }), 1);
      s.world.match.phase = 'playing';
      Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100, vy: 0, vz: 0 });
      s.update(frame(), STEP);
      expect(rumble.pulses).toEqual(['goal']);
    });

    it('the pause menu blips', () => {
      const { s, audio } = withAudio();
      s.update(frame(['pause']), STEP);
      s.update(frame(['down']), STEP);
      expect(audio.played).toContain('menuMove');
    });
  });

  describe('goal moment', () => {
    function scored(team: 'home' | 'away' = 'home') {
      const audio = recordingAudio();
      const rumble = recordingRumble();
      const s = createMatchScene(testContext({ audio, rumble }), 1);
      s.world.match.phase = 'playing';
      Object.assign(s.world.ball, team === 'home' ? { x: 616, y: 3, z: 32, vx: 100 } : { x: 24, y: 3, z: 32, vx: -100 });
      s.update(frame(), STEP);
      expect(s.world.events.goal).toBe(team);
      return { s, audio, rumble };
    }

    it("Harrison's goal runs the moment, then kicks off", () => {
      const { s } = scored();
      expect(s.moment).not.toBeNull();
      run(s, 3.9);
      expect(s.world.match.phase).toBe('kickoff');
      expect(s.moment).toBeNull();
    });

    it('the goal flash waits for a drawn frame, however many ticks pass', () => {
      const { s } = scored();
      s.update(frame(), STEP);
      s.update(frame(), STEP);
      expect(s.flash).toBe(true);
    });

    it('a confirm press after 0.5 s skips to the kickoff', () => {
      const { s } = scored();
      run(s, 0.6);
      expect(s.world.match.phase).toBe('goal');
      s.update(frame(['confirm']), STEP);
      expect(s.moment).toBeNull();
      s.update(frame(), STEP);
      expect(s.world.match.phase).toBe('kickoff');
    });

    it("Max's goal has no moment and kicks off after GOAL_PAUSE_S", () => {
      const { s } = scored('away');
      expect(s.moment).toBeNull();
      run(s, GOAL_PAUSE_S - 0.1);
      expect(s.world.match.phase).toBe('goal');
      run(s, 0.2);
      expect(s.world.match.phase).toBe('kickoff');
    });

    it('a golden goal by Harrison runs the moment, then full time', () => {
      const audio = recordingAudio();
      const s = createMatchScene(testContext({ audio, rumble: recordingRumble() }), 1);
      Object.assign(s.world.match, { phase: 'playing', goldenGoal: true, clockS: 90 });
      Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100 });
      s.update(frame(), STEP);
      expect(s.moment).not.toBeNull();
      run(s, 2);
      expect(s.world.match.phase).toBe('goal');
      run(s, 2);
      expect(s.moment).toBeNull();
      expect(s.world.match.phase).toBe('fullTime');
    });

    it('a golden-goal win is awarded once, after the moment', () => {
      const ctx = testContext();
      const s = createMatchScene(ctx, 1);
      Object.assign(s.world.match, { phase: 'playing', goldenGoal: true, clockS: 90, score: { home: 1, away: 1 } });
      Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100 });
      s.update(frame(), STEP);
      expect(s.world.match.phase).toBe('goal');
      expect(s.world.match.result).toBe('win');
      for (let i = 0; i < Math.round(3.7 / STEP); i++) {
        s.update(frame(), STEP);
        if (s.world.match.phase === 'goal') expect(ctx.savedProfiles).toHaveLength(0);
      }
      run(s, 0.5);
      expect(s.world.match.phase).toBe('fullTime');
      expect(ctx.savedProfiles).toHaveLength(1);
      expect(s.reward!.summary).toMatchObject({ result: 'win', goalsFor: 2, goalsAgainst: 1 });
      run(s, 3);
      expect(ctx.savedProfiles).toHaveLength(1);
    });

    it('pausing mid-moment and resuming continues it, and the goal cues and rumble fire once', () => {
      const { s, audio, rumble } = scored();
      run(s, 0.5);
      const t = s.moment!.t;
      s.update(frame(['pause']), STEP);
      run(s, 1);
      expect(s.moment!.t).toBe(t);
      s.update(frame(['confirm']), STEP);
      expect(s.paused).toBe(false);
      run(s, 3.5);
      expect(s.moment).toBeNull();
      expect(audio.played.filter(c => c === 'roar')).toHaveLength(1);
      expect(rumble.pulses.filter(k => k === 'goal')).toHaveLength(1);
    });

    it("the crowd holds its roar through Harrison's moment, and settles when it ends", () => {
      const { s, audio } = scored();
      expect(audio.crowd).toBe('roar');
      run(s, 2);
      expect(audio.crowd).toBe('roar');
      s.update(frame(['pause']), STEP);
      expect(audio.crowd).toBe('low');
      s.update(frame(['confirm']), STEP);
      expect(audio.crowd).toBe('roar');
      run(s, 2);
      expect(s.moment).toBeNull();
      expect(audio.crowd).toBe('match');
    });

    it("Max's goal doesn't raise the roar", () => {
      const { audio } = scored('away');
      expect(audio.crowd).toBe('match');
    });

    it('Enter skips the moment instead of pausing', () => {
      const { s } = scored();
      run(s, 0.6);
      s.update(frame(['pause', 'confirm']), STEP);
      expect(s.paused).toBe(false);
      expect(s.moment).toBeNull();
    });

    it('Esc or Start still pauses during the moment', () => {
      const { s } = scored();
      run(s, 0.6);
      s.update(frame(['pause', 'back']), STEP);
      expect(s.paused).toBe(true);
      expect(s.moment).not.toBeNull();
    });

    it("Harrison's header shows HEADER! with the moment, and it clears after", () => {
      const audio = recordingAudio();
      const s = createMatchScene(testContext({ audio, rumble: recordingRumble() }), 1);
      s.world.match.phase = 'playing';
      Object.assign(s.world.away, { x: 300 });
      Object.assign(s.world.home, { x: 540, z: 32, y: 10, state: 'air', vy: 0, facing: 1, kick: null });
      Object.assign(s.world.ball, { x: 543, y: 40, z: 32, vx: -50, vy: -100, vz: 0 });
      let n = 0;
      while (!s.moment && n++ < 60) s.update(frame(), STEP);
      expect(s.moment).not.toBeNull();
      expect(s.callout).toBe('HEADER!');
      run(s, 4);
      expect(s.callout).toBeNull();
    });

    it('a header goal counts as a style goal', () => {
      const s = createMatchScene(testContext(), 1);
      s.world.match.phase = 'playing';
      Object.assign(s.world.away, { x: 300 });
      Object.assign(s.world.home, { x: 540, z: 32, y: 10, state: 'air', vy: 0, facing: 1, kick: null });
      Object.assign(s.world.ball, { x: 543, y: 40, z: 32, vx: -50, vy: -100, vz: 0 });
      let n = 0;
      while (!s.moment && n++ < 60) s.update(frame(), STEP);
      expect(s.callout).toBe('HEADER!');
      run(s, 4);
      s.world.match.clockS = 89.99;
      run(s, 3);
      expect(s.world.match.phase).toBe('fullTime');
      expect(s.reward!.summary.styleGoals).toEqual(['header']);
    });

    it('a plain shot is not a style goal', () => {
      const { s } = scored();
      run(s, 4);
      s.world.match.clockS = 89.99;
      run(s, 3);
      expect(s.reward!.summary).toMatchObject({ goalsFor: 1, styleGoals: [] });
    });

    it('a third goal is a HAT-TRICK! with an extra roar', () => {
      const { s, audio } = (() => {
        const audio = recordingAudio();
        const s = createMatchScene(testContext({ audio, rumble: recordingRumble() }), 1);
        Object.assign(s.world.match, { phase: 'playing', score: { home: 2, away: 0 } });
        Object.assign(s.world.ball, { x: 616, y: 3, z: 32, vx: 100 });
        s.update(frame(), STEP);
        return { s, audio };
      })();
      expect(s.callout).toBe('HAT-TRICK!');
      run(s, 1.5);
      expect(audio.played.filter(c => c === 'roar')).toHaveLength(2);
    });

    it('a hard shot leaves a trail, and a still ball none', () => {
      const s = createMatchScene(testContext({ audio: recordingAudio(), rumble: recordingRumble() }), 1);
      s.world.match.phase = 'playing';
      Object.assign(s.world.away, { x: 100 });
      Object.assign(s.world.ball, { x: 200, y: 20, z: 32, vx: 600, vy: 0, vz: 0 });
      run(s, 0.1);
      expect(s.trail.length).toBeGreaterThan(2);
      Object.assign(s.world.ball, { x: 300, y: 3, z: 32, vx: 0, vy: 0, vz: 0 });
      run(s, 0.2);
      expect(s.trail).toHaveLength(0);
    });

    it('holding shoot through the skip and the kickoff does not charge until a fresh press', () => {
      const { s } = scored();
      run(s, 0.6);
      s.update(frame(['shoot']), STEP);
      expect(s.moment).toBeNull();
      run(s, 1.5, ['shoot']);
      expect(s.world.match.phase).toBe('playing');
      expect(s.world.home.state).not.toBe('charging');
      expect(s.world.home.kick).toBeNull();
      s.update(frame(), STEP);
      s.update(frame(['shoot']), STEP);
      expect(s.world.home.state).toBe('charging');
    });
  });

  describe('music', () => {
    it('the match stops the title music, and the result plays its jingle', () => {
      const audio = recordingAudio();
      audio.music = 'title';
      const s = createMatchScene(testContext({ audio }), 1);
      expect(audio.music).toBeNull();
      Object.assign(s.world.match, { phase: 'playing', clockS: 89.99, score: { home: 2, away: 1 } });
      run(s, 0.1);
      expect(s.world.match.phase).toBe('fullTime');
      run(s, 2);
      expect(audio.music).toBe('win');
    });

    it('a loss and a draw get their own jingles', () => {
      for (const [score, track] of [
        [{ home: 0, away: 1 }, 'lose'],
        [{ home: 1, away: 1 }, 'draw'],
      ] as const) {
        const audio = recordingAudio();
        const s = createMatchScene(testContext({ audio }), 1);
        Object.assign(s.world.match, { phase: 'playing', goldenGoal: true, goldenS: 200, score: { ...score } });
        run(s, 2.2);
        expect(audio.music, track).toBe(track);
      }
    });
  });
});

describe('match scene: the Energy Wave', () => {
  /** A profile that owns the move, optionally in Golden Form. */
  const owner = (golden = false) => ({
    ...newProfile(),
    level: golden ? 5 : 3,
    powerMoves: { owned: ['energyWave' as const], equipped: 'energyWave' as const },
    powerForms: golden ? { owned: ['golden' as const], equipped: 'golden' as const } : { owned: [], equipped: null },
  });

  /** In play with a full meter, Harrison on the ball facing Max's goal, Max far behind him. */
  function ready(golden = false) {
    const ctx = testContext({ profile: owner(golden) });
    const s = createMatchScene(ctx, 1);
    s.world.match.phase = 'playing';
    s.world.power!.meter = 1;
    Object.assign(s.world.home, { x: 300, z: 32, facing: 1 });
    Object.assign(s.world.away, { x: 100, z: 6 });
    Object.assign(s.world.ball, { x: 308, y: 3, z: 32, vx: 0, vy: 0, vz: 0 });
    return { s, ctx };
  }

  /** Powers up with Y, waits for the wave to be ready, then fires with X. */
  function fire(s: MatchScene): void {
    s.update(frame(['power']), STEP);
    run(s, WAVE_READY_S + 0.05);
    s.update(frame(['shoot']), STEP);
  }

  it('without the move, the world has no power', () => {
    expect(createMatchScene(testContext(), 1).world.power).toBeNull();
  });

  it('with the move owned, Y with a full meter powers him up at once', () => {
    const { s } = ready();
    s.update(frame(['power']), STEP);
    expect(s.world.power?.activeS).toBeGreaterThan(0);
  });

  it('pausing while powered up ends it and keeps the meter; on resume, a held Y needs a fresh press', () => {
    const { s } = ready();
    s.update(frame(['power']), STEP);
    run(s, 0.3, ['power']);
    s.update(frame(['pause'], ['power']), STEP);
    expect(s.world.power).toMatchObject({ activeS: 0, meter: 1 });
    s.update(frame(['confirm'], ['power']), STEP);
    run(s, 0.3, ['power']);
    expect(s.world.power?.activeS).toBe(0);
    expect(s.world.wave).toBeNull();
  });

  it('firing plays the blast, rumbles and owes a flash and impact frames', () => {
    const { s, ctx } = ready();
    fire(s);
    expect(s.world.wave).not.toBeNull();
    expect(ctx.audio.played).toEqual(expect.arrayContaining(['powerUp', 'waveBlast', 'beam']));
    expect(ctx.rumble.pulses).toEqual(expect.arrayContaining(['powerOn', 'wave']));
    expect(s.flash).toBe(true);
  });

  it('a wave goal pays the style bonus and shows ENERGY WAVE!', () => {
    const { s } = ready();
    fire(s);
    let n = 0;
    while (!s.moment && n++ < 60) s.update(frame(), STEP);
    expect(s.callout).toBe('ENERGY WAVE!');
    run(s, 4);
    s.world.match.clockS = 89.99;
    run(s, 3);
    expect(s.reward!.summary.styleGoals).toEqual(['wave']);
  });

  it('a Golden Form wave goal celebrates golden, and the gold clears with the moment', () => {
    const { s } = ready(true);
    fire(s);
    let n = 0;
    while (!s.moment && n++ < 60) s.update(frame(), STEP);
    expect(s.goldenCelebration).toBe(true);
    run(s, 4);
    expect(s.goldenCelebration).toBe(false);
  });

  it('a wave goal without Golden Form celebrates in his normal look', () => {
    const { s } = ready();
    fire(s);
    let n = 0;
    while (!s.moment && n++ < 60) s.update(frame(), STEP);
    expect(s.goldenCelebration).toBe(false);
  });
});

describe('match scene: the Park crew', () => {
  const PARK_OPEN = { ...newProfile(), ladderWins: 10, career: { stars: { 'backyard-boss': 1, 'park-1': 1, 'park-2': 1 }, milestonesPaid: 0, lossStreaks: {} } };
  const crewMatch = (id: string, ctx = testContext({ profile: PARK_OPEN })) => {
    const s = createMatchScene(ctx, 1, matchById(id)!);
    s.world.match.phase = 'playing';
    return { s, ctx };
  };

  it("a Park match builds the kid's world: their stats, profile, name, venue and sprites", () => {
    const { s } = crewMatch('park-2');
    expect(s.world.away.stats).toEqual(CREW_STATS.leo);
    expect(s.world.maxProfile).toBe(CREW_PROFILES.leo.normal);
    expect(s.world.dog).toBeNull();
    expect(s.hud.awayName).toBe('LEO');
    expect(s.hud.venue).toBe('park');
  });

  it("the HUD carries the kid's own sprites", () => {
    const art = fakeArt();
    const s = createMatchScene(testContext({ art, profile: PARK_OPEN }), 1, matchById('park-2')!);
    expect((s.hud.awaySprites as unknown as Named).name).toBe('art.opponents.leo.sprites');
    const rung = createMatchScene(testContext({ art }), 1, matchById('backyard-3')!);
    expect((rung.hud.awaySprites as unknown as Named).name).toBe('art.opponents.max.sprites');
  });

  it("changing difficulty mid-match sets the kid's own profile for it, not Max's", () => {
    const { s, ctx } = crewMatch('park-2');
    s.update(frame(['pause']), STEP);
    for (let i = 0; i < PAUSE_ITEMS.indexOf('OPTIONS'); i++) s.update(frame(['down']), STEP);
    const options = s.update(frame(['confirm']), STEP)!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(ctx.profile.difficulty).toBe('hard');
    expect(s.world.maxProfile).toBe(CREW_PROFILES.leo.hard);
    expect(s.world.aimErrorDeg.away).toBe(CREW_PROFILES.leo.hard.aimErrorDeg);
  });

  it("Sam's match builds Sam himself: his stats, profile and handling, not a stand-in", () => {
    const { s } = crewMatch('park-boss');
    expect(s.world.away.stats).toEqual(SAM_STATS);
    expect(s.world.maxProfile).toBe(SAM_PROFILES.normal);
    expect(s.world.away.handling).toBe(SAM_HANDLING);
    expect(s.hud.awayName).toBe('SAM');
    expect(crewMatch('park-2').s.world.away.handling).toEqual(NORMAL_HANDLING);
  });

  it('pausing mid-skid and resuming carries the skid on where it was', () => {
    const { s } = crewMatch('park-boss');
    Object.assign(s.world.ball, { x: 100, z: 60 });
    Object.assign(s.world.home, { x: 60, z: 60 });
    Object.assign(s.world.away, { x: 400, z: 32, vx: -210, facing: -1 });
    // Sam's brain decides what he does; stage him braking by sending him the other way for a tick.
    s.world.away.vx = 210;
    Object.assign(s.world.ball, { x: 300, z: 32 });
    let n = 0;
    while (s.world.away.anim.name !== 'skid' && n++ < 30) s.update(frame(), STEP);
    expect(s.world.away.anim.name).toBe('skid');
    const at = { x: s.world.away.x, vx: s.world.away.vx };
    s.update(frame(['pause']), STEP);
    for (let i = 0; i < 30; i++) s.update(frame(), STEP);
    expect([s.world.away.x, s.world.away.vx, s.world.away.anim.name]).toEqual([at.x, at.vx, 'skid']);
    s.update(frame(['pause']), STEP);
    s.update(frame(), STEP);
    expect(s.world.away.anim.name).toBe('skid');
    expect(Math.abs(s.world.away.vx)).toBeLessThan(Math.abs(at.vx));
  });

  it('Sam flying past Harrison close by whooshes', () => {
    const audio = recordingAudio();
    const { s } = crewMatch('park-boss', testContext({ profile: PARK_OPEN, audio }));
    Object.assign(s.world.home, { x: 300, z: 32 });
    Object.assign(s.world.away, { x: 310, z: 38, vx: -210, facing: -1 });
    Object.assign(s.world.ball, { x: 100, z: 60 });
    s.update(frame(), STEP);
    expect(audio.played).toContain('whoosh');
  });

  it("changing difficulty mid-match swaps Sam's profile and keeps his handling", () => {
    const { s, ctx } = crewMatch('park-boss');
    s.update(frame(['pause']), STEP);
    for (let i = 0; i < PAUSE_ITEMS.indexOf('OPTIONS'); i++) s.update(frame(['down']), STEP);
    const options = s.update(frame(['confirm']), STEP)!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(ctx.profile.difficulty).toBe('hard');
    expect(s.world.maxProfile).toBe(SAM_PROFILES.hard);
    expect(s.world.away.handling).toBe(SAM_HANDLING);
  });

  it("plays at the save's difficulty, not the settings'", () => {
    const ctx = testContext({ profile: { ...newProfile(), difficulty: 'easy' }, settings: { ...DEFAULT_SETTINGS, difficulty: 'hard' } });
    const s = createMatchScene(ctx, 1);
    expect(s.difficulty).toBe('easy');
    expect(s.world.maxProfile).toBe(DIFFICULTY.easy);
  });

  it('a rung still builds Max at the rung, with his difficulty', () => {
    const s = createMatchScene(testContext(), 1, matchById('backyard-4')!);
    expect(s.world.away.stats).toEqual(maxStats(4));
    expect(s.world.maxProfile).toBe(DIFFICULTY.normal);
  });

  describe('the steals bonus', () => {
    /** Tia dribbling left at x 300 on her feet, Harrison right behind her, his steal ready. */
    function place(s: MatchScene): void {
      const z = s.world.field.depth / 2;
      Object.assign(s.world.away, { x: 300, y: 0, z, vx: -150, vy: 0, vz: 0, facing: -1, state: 'ground', touchCooldown: 0 });
      Object.assign(s.world.home, { x: 310, y: 0, z, vx: -150, vy: 0, vz: 0, facing: -1, state: 'ground', stealCooldownS: 0, stumbleS: 0 });
      Object.assign(s.world.ball, { x: 292, y: BALL_REST_Y, z, vx: -150, vy: 0, vz: 0 });
    }

    /** Places them there for a moment first, so she has decided to dribble on, not to chase whatever she was chasing. */
    function stageTia(s: MatchScene): void {
      for (let i = 0; i < 20; i++) {
        place(s);
        s.update(frame(), STEP);
      }
      place(s);
    }

    /** Taps steal on Tia's ball with the odds forced clean or not, checks the outcome, then plays on a moment. */
    function stealOnce(s: MatchScene, clean = true): void {
      stageTia(s);
      s.world.rng = () => (clean ? 0 : 0.999);
      s.update(frame(['steal']), STEP);
      expect(s.world.events.steal).toBe(clean ? 'stole' : 'poked');
      s.world.rng = seeded(7);
      run(s, 0.6);
    }

    it('three clean steals off Tia show BONUS DONE! at once, with no goal moment, and the star cue once', () => {
      const { s, ctx } = crewMatch('park-3', testContext({ profile: { ...PARK_OPEN, career: { ...PARK_OPEN.career, stars: { ...PARK_OPEN.career.stars, 'park-3': 0 } } } }));
      expect(s.match.bonus).toBe('steals3');
      stealOnce(s);
      stealOnce(s);
      expect(s.bonusCallout).toBeNull();
      stageTia(s);
      s.world.rng = () => 0;
      s.update(frame(['steal']), STEP);
      expect(s.world.events.steal).toBe('stole');
      expect(s.moment).toBeNull();
      expect(s.bonusCallout).toBe(BONUS_CALLOUT);
      expect(ctx.audio.played.filter(c => c === 'star')).toHaveLength(1);
      expect(s.steals).toBe(3);
    });

    it('pokes and trapped loose balls never count', () => {
      const { s } = crewMatch('park-3');
      for (let i = 0; i < 3; i++) stealOnce(s, false);
      expect(s.steals).toBe(0);
      const z = s.world.field.depth / 2;
      Object.assign(s.world.away, { x: 400, z: 5 });
      Object.assign(s.world.home, { x: 300, y: 0, z, vx: 0, vy: 0, facing: 1, state: 'ground', stealCooldownS: 0, stumbleS: 0 });
      Object.assign(s.world.ball, { x: 308, y: BALL_REST_Y, z, vx: 0, vy: 0, vz: 0 });
      s.update(frame(['steal']), STEP);
      expect(s.world.events.steal).toBe('trapped');
      expect(s.steals).toBe(0);
      expect(s.bonusCallout).toBeNull();
    });

    it('the summary at full time carries his clean steals', () => {
      const { s } = crewMatch('park-3');
      for (let i = 0; i < 3; i++) stealOnce(s);
      // One up, so full time isn't golden goal.
      s.world.match.score = { home: 1, away: 0 };
      s.world.match.clockS = 89.99;
      run(s, 3);
      expect(s.world.match.phase).toBe('fullTime');
      expect(s.reward!.summary.steals).toBe(3);
    });
  });
});

describe('tricks in a match', () => {
  const at = (level: number, match?: Parameters<typeof createMatchScene>[2], ctx = testContext({ profile: { ...newProfile(), level, ladderWins: 10, career: { stars: { 'backyard-boss': 1, 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1 }, milestonesPaid: 0, lossStreaks: {} } } })) => {
    const s = createMatchScene(ctx, 1, match);
    s.world.match.phase = 'playing';
    return { s, ctx };
  };
  /** Harrison on the ball at x 300; the opponent coming from 55 px in his lane, squared up at the sell. */
  const staged = (s: MatchScene) => {
    Object.assign(s.world.home, { x: 300, z: 40, facing: 1, vx: 0, vz: 0 });
    Object.assign(s.world.away, { x: 355, z: 40, facing: -1, vx: 0, vz: 0 });
    Object.assign(s.world.ball, { x: 308, y: BALL_REST_Y, z: 40, vx: 0, vy: 0, vz: 0 });
    return s;
  };
  /** Flicks the right stick down for a stepover and steps until it fools him. */
  const fool = (s: MatchScene) => {
    s.update(frame(['stepover']), STEP);
    for (let i = 0; i < 30 && !s.world.away.fooled; i++) s.update(frame(), STEP);
    expect(s.world.away.fooled).toBeTruthy();
  };
  function pickIn(s: MatchScene, item: (typeof PAUSE_ITEMS)[number]): Scene | null {
    s.update(frame(['pause']), STEP);
    for (let i = 0; i < PAUSE_ITEMS.indexOf(item); i++) s.update(frame(['down']), STEP);
    return s.update(frame(['confirm']), STEP);
  }

  it('below level 4 there are no tricks, and the right stick does nothing', () => {
    const s = staged(at(3).s);
    expect(s.world.tricks).toBeNull();
    s.update(frame(['stepover']), STEP);
    expect(s.world.home.trick).toBeNull();
  });

  it("from level 4 the match has the tricks for this opponent and difficulty", () => {
    const { s } = at(4);
    expect(s.world.tricks).toEqual(trickSetup(s.difficulty, s.match.opponent));
    s.update(frame(['stepover']), STEP);
  });

  it('the right stick up does a rainbow flick, down a stepover', () => {
    const up = staged(at(4).s);
    up.update(frame(['flick']), STEP);
    expect(up.world.home.trick?.kind).toBe('flick');
    const down = staged(at(4).s);
    down.update(frame(['stepover']), STEP);
    expect(down.world.home.trick?.kind).toBe('stepover');
  });

  it('a trick that fools him shows STEPOVER! for a second', () => {
    const s = staged(at(4).s);
    fool(s);
    expect(s.hud.trickCallout).toBe('STEPOVER!');
    run(s, TRICK_CALLOUT_S - 0.1);
    expect(s.hud.trickCallout).toBe('STEPOVER!');
    run(s, 0.2);
    expect(s.hud.trickCallout).toBeNull();
  });

  it("a goal soon after is a trick goal: its callout, its record, and a style goal on Results", () => {
    const s = staged(at(4).s);
    s.world.match.clockS = 20;
    fool(s);
    Object.assign(s.world.away, { x: 20, vx: 0 });
    run(s, 1.5);
    Object.assign(s.world.ball, { x: 600, y: BALL_REST_Y, z: 32, vx: 300, vy: 0, vz: 0 });
    for (let i = 0; i < 30 && !s.world.events.goal; i++) s.update(frame(), STEP);
    expect(s.goals.at(-1)?.kind).toBe('trick');
    expect(s.callout).toBe('STEPOVER!');
    expect(s.hud.trickCallout).toBeNull();
    run(s, 4);
    s.world.match.clockS = 89.99;
    run(s, 3);
    expect(s.reward!.summary.styleGoals).toEqual(['trick']);
  });

  it('pausing mid-stepover and resuming carries on from the same moment (Review Focus 3)', () => {
    const s = staged(at(4).s);
    s.update(frame(['stepover']), STEP);
    run(s, 0.05);
    const t = s.world.home.trick!.t;
    s.update(frame(['pause']), STEP);
    run(s, 0.5);
    expect(s.world.home.trick!.t).toBe(t);
    s.update(frame(['confirm']), STEP);
    expect(s.paused).toBe(false);
    expect(s.world.home.trick!.t).toBe(t);
    s.update(frame(), STEP);
    expect(s.world.home.trick!.t).toBeCloseTo(t + STEP, 9);
  });

  it('pausing mid-confusion and resuming carries on from the same moment (Review Focus 3)', () => {
    const s = staged(at(4).s);
    fool(s);
    const left = s.world.away.fooled!.leftS;
    s.update(frame(['pause']), STEP);
    run(s, 0.5);
    s.update(frame(['confirm']), STEP);
    expect(s.world.away.fooled!.leftS).toBe(left);
  });

  it("Options mid-match re-applies the tricks for the new difficulty, and leaves Sam's handling alone (Review Focus 3)", () => {
    const { s, ctx } = at(6, matchById('park-boss')!);
    const handling = s.world.away.handling;
    const options = pickIn(s, 'OPTIONS')!;
    options.update(frame(['right']), STEP);
    options.update(frame(['back']), STEP);
    expect(ctx.profile.difficulty).toBe('hard');
    expect(s.world.tricks).toEqual(trickSetup('hard', 'sam'));
    expect(s.world.away.handling).toBe(handling);
  });
});

describe('match scene: cosmetics', () => {
  const plain = newProfile();
  const dressed = {
    ...plain,
    career: { ...plain.career, milestonesPaid: 4 },
    locker: {
      bought: LOCKER_ITEMS.flatMap(i => (itemPrice(i.id) === null ? [] : [i.id])),
      kit: 'inferno' as const,
      boots: 'fire' as const,
      extras: [...EXTRA_IDS],
      seen: [...GIFTS],
    },
  };

  it('cosmetics never change play', () => {
    const scenes = [plain, dressed].map(profile => createMatchScene(testContext({ profile, art: fakeArt() }), 5, matchById('backyard-3')!));
    for (const s of scenes) s.world.match.phase = 'playing';
    const { g } = recordingContext();
    for (let i = 0; i < 600; i++) {
      const held: Parameters<typeof frame>[1] = i % 120 < 70 ? ['sprint'] : i % 120 < 100 ? ['shoot'] : [];
      const input = { ...frame([], held), moveX: i % 240 < 120 ? 1 : -1, moveY: i % 90 < 30 ? 1 : 0 };
      for (const s of scenes) {
        s.update(input, STEP);
        s.draw(g, i * STEP);
      }
    }
    const [a, b] = scenes.map(s => s.world);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    // The same random numbers come next: the effects drew none of the match's.
    expect([b!.rng(), b!.rng()]).toEqual([a!.rng(), a!.rng()]);
  });

  it('Harrison is drawn through art.harrison', () => {
    const s = createMatchScene(testContext({ art: fakeArt() }), 1);
    const { g, drawn } = recordingContext();
    s.draw(g, 0);
    expect(drawn.some(n => n.startsWith('art.harrison(home,1,idle,0,'))).toBe(true);
    expect(drawn.some(n => n.startsWith('art.home.'))).toBe(false);
  });
});

describe('match scene: kit clashes', () => {
  const wearing = (kit: 'sky' | 'home') => ({ ...newProfile(), locker: { ...newProfile().locker, bought: kit === 'sky' ? ['kit:sky' as const] : [], kit } });
  const drawnBy = (kit: 'sky' | 'home') => {
    const s = createMatchScene(testContext({ profile: wearing(kit), art: fakeArt() }), 1, matchById('backyard-3')!);
    const { g, drawn } = recordingContext();
    s.draw(g, 0);
    return drawn;
  };

  it('Max changes when Harrison wears SKY', () => {
    expect(drawnBy('sky').some(n => n.startsWith('art.opponentIn(max,white)'))).toBe(true);
  });

  it('and not in HOME', () => {
    const drawn = drawnBy('home');
    expect(drawn.some(n => n.startsWith('art.opponentIn('))).toBe(false);
    expect(drawn.some(n => n.startsWith('art.opponents.max.sprites'))).toBe(true);
  });
});

describe('match scene: his art', () => {
  it("warms every sprite set he could need on the first frame, so a power-up never bakes mid-play", () => {
    let warmed = 0;
    const art = new Proxy(fakeArt(), { get: (t, p) => (p === 'warm' ? () => void warmed++ : Reflect.get(t, p)) });
    const s = createMatchScene(testContext({ art }), 1);
    expect(warmed).toBe(0);
    const { g } = recordingContext();
    s.draw(g, 0);
    s.draw(g, 0.1);
    expect(warmed).toBe(1);
  });
});

describe('stages', () => {
  const SCHOOL_TEST: CareerMatch = { ...matchById('backyard-1')!, venue: 'school' };
  afterEach(() => vi.unstubAllGlobals());

  it('a School match plays on the big stage and asks for a 534×300 canvas', () => {
    const s = createMatchScene(testContext(), 3, SCHOOL_TEST);
    expect(s.size).toEqual(expect.objectContaining({ w: 534, h: 300 }));
    expect(s.world.field).toBe(SCHOOL_FIELD);
    expect(s.world.match.lengthS).toBe(120);
  });

  it("a School match has a keeper in each goal: Harrison's at Normal, theirs at the difficulty", () => {
    const ctx = testContext();
    ctx.profile = { ...ctx.profile, difficulty: 'easy' };
    const s = createMatchScene(ctx, 3, SCHOOL_TEST);
    expect(s.world.keepers!.home.profile).toEqual(keeperProfile(1, 'normal'));
    expect(s.world.keepers!.away.profile).toEqual(keeperProfile(1, 'easy'));
  });

  it('a Backyard match has no keepers', () => {
    expect(createMatchScene(testContext(), 3).world.keepers).toBeNull();
  });

  it("a School match draws both keepers: Eddie in Harrison's goal, a backup in theirs", () => {
    stubCanvases();
    const s = createMatchScene(testContext({ art: fakeArt() }), 3, SCHOOL_TEST);
    const main = recordingContext();
    s.draw(main.g, 0);
    expect(main.drawn.some(n => n?.startsWith('art.keepers.eddie.poses.ready.right'))).toBe(true);
    expect(main.drawn.some(n => n?.startsWith('art.keepers.backupA.poses.ready.left'))).toBe(true);
  });

  it('a Backyard match draws no keepers', () => {
    const s = createMatchScene(testContext({ art: fakeArt() }), 3);
    const main = recordingContext();
    s.draw(main.g, 0);
    expect(main.drawn.some(n => n?.includes('keepers'))).toBe(false);
  });

  it('a Backyard match keeps the 320×180 canvas and its 90 seconds', () => {
    const s = createMatchScene(testContext(), 3);
    expect(s.size).toEqual(expect.objectContaining({ w: 320, h: 180 }));
    expect(s.world.match.lengthS).toBe(90);
  });

  /** The HUD layer document makes: it records what it was asked to do, and its context points back at it. */
  function hudLayer() {
    const ops: string[] = [];
    const canvas = { name: 'hudLayer', width: 0, height: 0, getContext: () => g };
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_, prop) {
        if (prop === 'canvas') return canvas;
        if (prop === 'drawImage') return (img: Named) => void ops.push(img.name);
        return (...args: unknown[]) => void ops.push(`${String(prop)}(${args.join(',')})`);
      },
      set: () => true,
    });
    return { canvas, ops };
  }
  /** A context that records every drawImage with its arguments. */
  function argRecorder() {
    const calls: unknown[][] = [];
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_, prop) {
        if (prop === 'drawImage') return (img: Named, ...rest: number[]) => void calls.push([img.name, ...rest]);
        return () => undefined;
      },
      set: () => true,
    });
    return { g, calls };
  }

  it('a paused School match draws the menu into the HUD layer, then doubles the layer onto the canvas', () => {
    const layer = hudLayer();
    vi.stubGlobal('document', { createElement: () => layer.canvas });
    const s = createMatchScene(testContext({ art: fakeArt() }), 3, SCHOOL_TEST);
    s.update(frame(['pause']), STEP);
    const main = argRecorder();
    s.draw(main.g, 0);
    expect([layer.canvas.width, layer.canvas.height]).toEqual([267, 150]);
    expect(layer.ops[0]).toBe('clearRect(0,0,267,150)');
    expect(layer.ops).toContain('art.text(RESUME,1,energyGold,outline)');
    expect(layer.ops).toContain('art.text(HARRISON 0-0 MAX,1,white,outline)');
    const names = main.calls.map(c => c[0]);
    expect(names).not.toContain('art.text(RESUME,1,energyGold,outline)');
    expect(names).not.toContain('art.text(HARRISON 0-0 MAX,1,white,outline)');
    expect(main.calls.at(-1)).toEqual(['hudLayer', 0, 0, 534, 300]);
  });

  it('a Backyard match draws its HUD straight onto the canvas, with no layer', () => {
    const createElement = vi.fn();
    vi.stubGlobal('document', { createElement });
    const s = createMatchScene(testContext({ art: fakeArt() }), 3);
    const main = argRecorder();
    s.draw(main.g, 0);
    expect(createElement).not.toHaveBeenCalled();
    expect(main.calls.map(c => c[0])).toContain('art.text(HARRISON 0-0 MAX,1,white,outline)');
  });
});

describe('the School Field bonuses', () => {
  /** Sam beaten: the School is open. */
  const SCHOOL_OPEN = { ...newProfile(), ladderWins: 10, career: { stars: { 'backyard-boss': 1, 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1, 'park-boss': 1 }, milestonesPaid: 0, lossStreaks: {} } };
  const tryout = (id: string) => {
    const ctx = testContext({ profile: SCHOOL_OPEN });
    const s = createMatchScene(ctx, 1, matchById(id)!);
    s.world.match.phase = 'playing';
    return { s, ctx };
  };
  /** Their keeper lying down out of the way, at the box's far edge, for the next 10 s. */
  const keeperDown = (s: MatchScene) => {
    const k = s.world.keepers!.away;
    k.profile = { ...k.profile, downS: 10 };
    Object.assign(k, { act: 'down', actT: 0, dive: null });
    Object.assign(k.body, { z: 118, vx: 0, vz: 0 });
  };
  /** Harrison on the ball at (x, 64) facing their goal, Max far away; he holds X for 0.6 s (at Power 1 a shorter hold stops short of the line from outside the box) and lets go, and the shot runs until his goal moment. */
  const shootFrom = (s: MatchScene, x: number) => {
    Object.assign(s.world.away, { x: 300, z: 100, vx: 0, vz: 0 });
    Object.assign(s.world.home, { x, z: 64, y: 0, vx: 0, vy: 0, vz: 0, facing: 1, state: 'ground', kick: null });
    Object.assign(s.world.ball, { x: x + 8, y: BALL_REST_Y, z: 64, vx: 0, vy: 0, vz: 0 });
    run(s, 0.6, ['shoot']);
    for (let i = 0; i < 180 && !s.moment; i++) s.update(frame(), STEP);
    expect(s.moment).not.toBeNull();
  };
  /** Plays on through the goal moment until BONUS DONE! shows, or 6 s pass. */
  const untilBonus = (s: MatchScene) => {
    for (let i = 0; i < 360 && !s.bonusCallout; i++) s.update(frame(), STEP);
    return s.bonusCallout;
  };

  it('tryout 1: a goal struck from outside the box is from outside the box, and BONUS DONE! follows', () => {
    const { s, ctx } = tryout('school-1');
    expect(s.match.bonus).toBe('outsideBox');
    keeperDown(s);
    shootFrom(s, 1000);
    expect(s.goals).toHaveLength(1);
    expect(s.goals[0]).toMatchObject({ kind: 'shot', outsideBox: true, rebound: false });
    expect(untilBonus(s)).toBe(BONUS_CALLOUT);
    expect(ctx.audio.played).toContain('star');
  });

  it('tryout 1: a goal struck from inside the box is not, and no BONUS DONE! follows', () => {
    const { s, ctx } = tryout('school-1');
    keeperDown(s);
    shootFrom(s, 1200);
    expect(s.goals[0]).toMatchObject({ kind: 'shot', outsideBox: false, rebound: false });
    expect(untilBonus(s)).toBeNull();
    expect(ctx.audio.played).not.toContain('star');
  });

  it('tryout 6: a goal within 2 s of their keeper pushing the ball away is a rebound, and BONUS DONE! follows', () => {
    const { s } = tryout('school-6');
    expect(s.match.bonus).toBe('rebound');
    const k = s.world.keepers!.away;
    k.profile = { ...k.profile, holdOdds: 0 };
    Object.assign(s.world.home, { x: 700, z: 20, vx: 0, vz: 0 });
    Object.assign(s.world.away, { x: 300, z: 100, vx: 0, vz: 0 });
    Object.assign(s.world.ball, { x: k.body.x - 60, y: BALL_REST_Y, z: k.body.z, vx: 600, vy: 0, vz: 0 });
    let pushed = false;
    for (let i = 0; i < 60 && !pushed; i++) {
      s.update(frame(), STEP);
      pushed = s.world.events.keeper.pushed === 'away';
    }
    expect(pushed).toBe(true);
    keeperDown(s);
    shootFrom(s, 1150);
    expect(s.goals[0]).toMatchObject({ kind: 'shot', outsideBox: false, rebound: true });
    expect(untilBonus(s)).toBe(BONUS_CALLOUT);
  });
});
