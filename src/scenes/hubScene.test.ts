import { describe, expect, it } from 'vitest';
import { DIFFICULTY, type Difficulty } from '../game/ai';
import { measureText } from '../art/font';
import { SCHOOL_BOSS_ID, VENUES, careerCardLines, type CareerMatch } from '../meta/career';
import { maxStats } from '../meta/ladder';
import type { LockerItemId } from '../meta/locker';
import { newProfile } from '../meta/profile';
import { CARD, CARD_RIGHT, HUB_ITEMS, TEXT_X, XP_BAR, createHubScene, saveLabel, statsLine } from './hubScene';
import type { MatchScene } from './matchScene';
import type { SavesScene } from './savesScene';
import { fakeArt, recordingContext } from './testDraw';
import { testContext } from './testContext';
import { frame } from './testInput';
import { createPressStartScene } from './titleScene';
import type { VsScene } from './vsScene';

const STEP = 1 / 60;
function context(difficulty: Difficulty = 'normal') {
  return testContext({ profile: { ...newProfile(), difficulty } });
}

describe('press start screen', () => {
  it('Press Start, A or Enter opens SAVES', () => {
    for (const pressed of [['pause'], ['confirm'], ['pause', 'confirm']] as const) {
      expect(createPressStartScene(context()).update(frame(pressed), STEP)?.kind, pressed.join('+')).toBe('saves');
    }
  });

  it('waits for a press', () => {
    const s = createPressStartScene(context());
    expect(s.update(frame([], ['confirm']), STEP)).toBeNull();
    expect(s.update(frame(['shoot']), STEP)).toBeNull();
  });
});

describe('hub', () => {
  it('the Hub has CAREER, SHOP, LOCKER ROOM, OPTIONS, HELP, SAVES and no quit', () => {
    expect(HUB_ITEMS).toEqual(['CAREER', 'SHOP', 'LOCKER ROOM', 'OPTIONS', 'HELP', 'SAVES']);
  });

  it('LOCKER ROOM is third, and opens the room', () => {
    expect(HUB_ITEMS.indexOf('LOCKER ROOM')).toBe(2);
    const room = createHubScene(context(), 2).update(frame(['confirm']), STEP);
    expect(room?.kind).toBe('lockerRoom');
  });

  it('B from the room comes back on LOCKER ROOM', () => {
    const ctx = context();
    const room = createHubScene(ctx, 2).update(frame(['confirm']), STEP)!;
    const hub = room.update(frame(['back']), STEP)!;
    expect(hub.kind).toBe('hub');
    const next = hub.update(frame(['confirm']), STEP);
    expect(next?.kind).toBe('lockerRoom');
  });

  it('NEW beside LOCKER ROOM while a gift is unseen', () => {
    const p = newProfile();
    const drawnWith = (seen: LockerItemId[]) => {
      const ctx = testContext({ art: fakeArt(), profile: { ...p, career: { ...p.career, milestonesPaid: 1 }, locker: { ...p.locker, seen } } });
      const { g, drawn } = recordingContext();
      createHubScene(ctx).draw(g, 0);
      return drawn;
    };
    expect(drawnWith([])).toContain('art.text(NEW,1,flameLight,outline)');
  });

  it("not once it's seen", () => {
    const p = newProfile();
    const ctx = testContext({ art: fakeArt(), profile: { ...p, career: { ...p.career, milestonesPaid: 1 }, locker: { ...p.locker, seen: ['extra:armband'] } } });
    const { g, drawn } = recordingContext();
    createHubScene(ctx).draw(g, 0);
    expect(drawn).not.toContain('art.text(NEW,1,flameLight,outline)');
    const fresh = recordingContext();
    createHubScene(testContext({ art: fakeArt() })).draw(fresh.g, 0);
    expect(fresh.drawn).not.toContain('art.text(NEW,1,flameLight,outline)');
  });

  it('CAREER opens the road map, and A there then A plays the next match through the VS card', () => {
    const ctx = testContext({ profile: { ...newProfile(), ladderWins: 4 } });
    const map = createHubScene(ctx).update(frame(['confirm']), STEP)!;
    expect(map.kind).toBe('roadMap');
    const venue = map.update(frame(['confirm']), STEP)!;
    expect(venue.kind).toBe('venue');
    const vs = venue.update(frame(['confirm']), STEP) as VsScene;
    expect(vs.kind).toBe('vs');
    expect(vs.match.id).toBe('backyard-5');
    const match = vs.update(frame(['confirm']), STEP) as MatchScene;
    expect(match.world.away.stats).toEqual(maxStats(5));
  });

  it("a match reached from the Hub plays at the save's difficulty", () => {
    for (const difficulty of ['easy', 'hard'] as const) {
      let scene = createHubScene(context(difficulty));
      for (let i = 0; i < 4; i++) scene = scene.update(frame(['confirm']), STEP)!;
      const match = scene as MatchScene;
      expect(match.kind).toBe('match');
      expect(match.world.aimErrorDeg.away).toBe(DIFFICULTY[difficulty].aimErrorDeg);
    }
  });

  it('with Biscuit beaten, the card points into the Park', () => {
    expect(careerCardLines({ ...newProfile(), ladderWins: 10, career: { stars: { 'backyard-boss': 1 }, milestonesPaid: 0, lossStreaks: {} } }).first).toBe('NEXT: BIG BRICK - THE PARK 1/4');
  });

  it('the card says what is next in the career', () => {
    expect(careerCardLines({ ...newProfile(), ladderWins: 4 })).toEqual({ first: 'NEXT: MAX - MATCH 5/10', second: 'MAX HAS BEEN TRAINING: SPEED UP' });
  });

  it('every career line the catalog can show fits the card', () => {
    const fits = (line: string | null) => expect(measureText(line ?? '') + 2, line ?? '').toBeLessThanOrEqual(CARD_RIGHT - TEXT_X);
    const before: CareerMatch[] = [];
    for (const v of VENUES) {
      for (const m of v.matches) {
        if (m.kind !== 'rung') {
          const stars = Object.fromEntries(before.filter(b => b.kind !== 'rung').map(b => [b.id, 1]));
          const lines = careerCardLines({ ...newProfile(), ladderWins: 10, career: { stars, milestonesPaid: 0, lossStreaks: {} } });
          expect(lines.first, m.id).toContain(m.name);
          fits(lines.first);
          fits(lines.second);
        }
        before.push(m);
      }
    }
    const stars = Object.fromEntries(before.filter(b => b.kind !== 'rung').map(b => [b.id, 3]));
    const done = careerCardLines({ ...newProfile(), ladderWins: 10, career: { stars, milestonesPaid: 0, lossStreaks: {} } });
    expect(done).toEqual({ first: 'YOU MADE THE TEAM! STARS 27/27', second: 'STATE: COMING SOON' });
    expect(stars[SCHOOL_BOSS_ID]).toBe(3);
    fits(done.first);
    fits(done.second);
  });

  it('B on the Hub goes back to SAVES, on the save being played', () => {
    const ctx = context();
    ctx.slot = 3;
    const s = createHubScene(ctx).update(frame(['back']), STEP) as SavesScene;
    expect(s.kind).toBe('saves');
    expect(s.cursor).toBe(3);
  });

  it('SAVES on the Hub opens SAVES, on the save being played', () => {
    const ctx = context();
    ctx.slot = 2;
    const s = createHubScene(ctx, HUB_ITEMS.indexOf('SAVES')).update(frame(['confirm']), STEP) as SavesScene;
    expect(s.kind).toBe('saves');
    expect(s.cursor).toBe(2);
  });

  it('Start on the Hub starts the selected item, like A', () => {
    expect(createHubScene(context()).update(frame(['pause']), STEP)?.kind).toBe('roadMap');
    expect(createHubScene(context(), HUB_ITEMS.indexOf('HELP')).update(frame(['pause']), STEP)?.kind).toBe('help');
  });

  it('Esc on the Hub goes back to SAVES', () => {
    expect(createHubScene(context()).update(frame(['pause', 'back']), STEP)?.kind).toBe('saves');
  });

  it('Enter on the Hub still confirms', () => {
    expect(createHubScene(context()).update(frame(['pause', 'confirm']), STEP)?.kind).toBe('roadMap');
  });

  it('HELP opens Help, and B there comes back to the Hub on HELP', () => {
    const s = createHubScene(context(), HUB_ITEMS.indexOf('HELP'));
    const help = s.update(frame(['confirm']), STEP);
    expect(help?.kind).toBe('help');
    const back = help!.update(frame(['back']), STEP);
    expect(back?.kind).toBe('hub');
    expect(back!.update(frame(['confirm']), STEP)?.kind).toBe('help');
  });

  it('OPTIONS opens Options, and B there comes back to the Hub on OPTIONS', () => {
    const s = createHubScene(context(), HUB_ITEMS.indexOf('OPTIONS'));
    const options = s.update(frame(['confirm']), STEP);
    expect(options?.kind).toBe('options');
    const back = options!.update(frame(['back']), STEP);
    expect(back?.kind).toBe('hub');
    expect(back!.update(frame(['confirm']), STEP)?.kind).toBe('options');
  });

  it('SHOP opens the shop, and B there comes back to the Hub on SHOP', () => {
    const s = createHubScene(context());
    s.update(frame(['down']), STEP);
    const shop = s.update(frame(['confirm']), STEP);
    expect(shop?.kind).toBe('shop');
    const back = shop!.update(frame(['back']), STEP);
    expect(back?.kind).toBe('hub');
    expect(back!.update(frame(['confirm']), STEP)?.kind).toBe('shop');
  });

  it('up and down move the choice, wrapping', () => {
    const s = createHubScene(context());
    s.update(frame(['up']), STEP);
    s.update(frame(['down']), STEP);
    s.update(frame(['down']), STEP);
    s.update(frame(['up']), STEP);
    expect(s.update(frame(['confirm']), STEP)?.kind).toBe('roadMap');
  });

  it('Press Start and the Hub play the title theme', () => {
    for (const make of [createPressStartScene, createHubScene]) {
      const ctx = context();
      make(ctx);
      expect(ctx.audio.music).toBe('title');
    }
  });

  it('the Hub turns the crowd off and plays the title theme', () => {
    const ctx = context();
    ctx.audio.crowd = 'match';
    ctx.audio.music = null;
    createHubScene(ctx);
    expect(ctx.audio.crowd).toBe('off');
    expect(ctx.audio.music).toBe('title');
  });

  it('shows his five stats in short', () => {
    expect(statsLine({ speed: 3, power: 2, jump: 1, control: 10, stamina: 4 })).toBe('SPD 3  PWR 2  JMP 1  CTL 10  STA 4');
  });

  it("labels the card with the save's name and difficulty", () => {
    expect(saveLabel({ ...newProfile(), difficulty: 'easy' })).toBe('HARRISON - EASY');
  });

  it('LEVEL 999, the XP bar and a twelve-letter name on NORMAL fit the LEVEL row', () => {
    const label = saveLabel({ ...newProfile(), name: 'MMMMMMMMMMMM', difficulty: 'normal' });
    expect(TEXT_X + measureText('LEVEL 999') + XP_BAR.gap + XP_BAR.w + 4).toBeLessThanOrEqual(CARD.x + CARD.w - 8 - measureText(label));
  });

  it('the maxed stats line fits the card', () => {
    expect(measureText(statsLine({ speed: 10, power: 10, jump: 10, control: 10, stamina: 10 }))).toBeLessThanOrEqual(200);
  });
});
