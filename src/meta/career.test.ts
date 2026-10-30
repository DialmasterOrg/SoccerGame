import { describe, expect, it } from 'vitest';
import { BACKYARD, BOSS_ID, MATCH_IDS, PARK, PARK_BOSS_ID, SCHOOL, SCHOOL_BOSS_ID, TOTAL_STARS, VENUES, allBeaten, careerCardLines, careerStars, grantRungStars, isBeaten, matchById, matchState, nextCareerMatch, rungId, starsAt, stopLabel, venueDone, venueMaxStars, venueOpen, venueStars } from './career';
import { newProfile, type Profile } from './profile';

const p = (ladderWins: number, stars: Record<string, number> = {}): Profile => ({ ...newProfile(), ladderWins, career: { ...newProfile().career, stars } });
const beatBiscuit = (stars: Record<string, number> = {}) => p(10, { [BOSS_ID]: 1, ...stars });
const PARK_DONE = { [BOSS_ID]: 1, 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1, [PARK_BOSS_ID]: 1 };
const TRYOUTS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `school-${n}`);
/** Sam beaten, the first n tryouts at one star, and anything else. */
const atSchool = (n = 0, more: Record<string, number> = {}) => p(10, { ...PARK_DONE, ...Object.fromEntries(TRYOUTS.slice(0, n).map(id => [id, 1])), ...more });

describe('the catalog', () => {
  it('six venues, the Backyard open with ten rungs then the boss', () => {
    expect(VENUES.map(v => v.id)).toEqual(['backyard', 'park', 'school', 'state', 'stadium', 'worldCup']);
    expect(VENUES.map(v => v.name)).toEqual(['BACKYARD', 'THE PARK', 'SCHOOL FIELD', 'STATE', 'STADIUM', 'WORLD CUP']);
    expect(BACKYARD.matches.map(m => m.id)).toEqual([...Array(10)].map((_, i) => rungId(i + 1)).concat(BOSS_ID));
    expect(BACKYARD.matches[6]).toMatchObject({ kind: 'rung', rung: 7, name: 'MAX', hudName: 'MAX', bonus: 'early' });
    expect(BACKYARD.matches[10]).toMatchObject({ kind: 'boss', rung: 0, name: 'BISCUIT THE DOG', hudName: 'BISCUIT', bonus: 'noBossGoals' });
    expect(VENUES.slice(3).every(v => v.matches.length === 0)).toBe(true);
    expect(matchById('backyard-3')?.bonus).toBe('header');
    expect(BACKYARD.matches.slice(0, 10).every(m => m.opponent === 'max' && m.blurb === null && m.tip === null)).toBe(true);
    expect(matchById(BOSS_ID)).toMatchObject({ opponent: 'biscuit', blurb: "HE CAN'T SHOOT. HE JUST RUNS IT IN." });
    expect(TOTAL_STARS).toBe(156);
  });

  it('the Park: four crew matches, then Speedy Sam', () => {
    expect(PARK.matches.map(m => m.id)).toEqual(['park-1', 'park-2', 'park-3', 'park-4', PARK_BOSS_ID]);
    expect(PARK.matches.map(m => [m.kind, m.rung, m.name, m.hudName, m.opponent, m.bonus])).toEqual([
      ['match', 1, 'BIG BRICK', 'BRICK', 'brick', 'chip'],
      ['match', 2, 'BOOMER LEO', 'LEO', 'leo', 'cleanSheet'],
      ['match', 3, 'TRICKY TIA', 'TIA', 'tia', 'steals3'],
      ['match', 4, 'PESKY PETE', 'PETE', 'pete', 'perfect'],
      ['boss', 0, 'SPEEDY SAM', 'SAM', 'sam', 'noSamGoals'],
    ]);
    expect(PARK.matches.every(m => m.blurb !== null)).toBe(true);
    expect(matchById(PARK_BOSS_ID)?.tip).toBe("TIP: DON'T RACE HIM. MAKE HIM OVERSHOOT");
    expect(matchById(BOSS_ID)?.tip).toBe('TIP: GET BETWEEN HIM AND YOUR GOAL');
    expect(MATCH_IDS).toHaveLength(25);
    expect([venueMaxStars('backyard'), venueMaxStars('park'), venueMaxStars('school')]).toEqual([33, 15, 27]);
  });

  it('the School Field: eight tryouts, then Goalie Gus', () => {
    expect(SCHOOL.name).toBe('SCHOOL FIELD');
    expect(SCHOOL.matches.map(m => m.id)).toEqual([...TRYOUTS, SCHOOL_BOSS_ID]);
    expect(SCHOOL.matches.map(m => [m.kind, m.rung, m.name, m.hudName, m.bonus])).toEqual([
      ['match', 1, 'MAX', 'MAX', 'outsideBox'],
      ['match', 2, 'HEADER HANK', 'HANK', 'header'],
      ['match', 3, 'LOFTY LOLA', 'LOLA', 'chip'],
      ['match', 4, 'FAKE-OUT FINN', 'FINN', 'steals3'],
      ['match', 5, 'TRICKY TIA', 'TIA', 'cleanSheet'],
      ['match', 6, 'POACHER PRIYA', 'PRIYA', 'rebound'],
      ['match', 7, 'NUTMEG NIKO', 'NIKO', 'perfect'],
      ['match', 8, 'PINPOINT PAIGE', 'PAIGE', 'noPaigeGoals'],
      ['boss', 0, 'GOALIE GUS', 'GUS', 'threePastGus'],
    ]);
    // Max and Tia come back at tryouts 1 and 5; Goalie Gus is the boss.
    expect(SCHOOL.matches.map(m => m.opponent)).toEqual(['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige', 'gus']);
    expect(SCHOOL.matches.every(m => m.blurb !== null && m.tip === null)).toBe(true);
    expect(VENUES.map(v => v.id)).toEqual(['backyard', 'park', 'school', 'state', 'stadium', 'worldCup']);
    expect([venueMaxStars('school'), venueMaxStars('state'), TOTAL_STARS]).toEqual([27, 0, 156]);
    expect(MATCH_IDS).toHaveLength(25);
  });

  it("every venue's words: the Backyard and the Park as today, the School's tryouts", () => {
    expect(VENUES.map(v => v.words)).toEqual([
      { match: 'MATCH', beaten: 'BEATEN!', boss: 'BACKYARD BOSS', done: 'BACKYARD DONE!' },
      { match: 'MATCH', beaten: 'BEATEN!', boss: 'THE PARK BOSS', done: 'THE PARK DONE!' },
      { match: 'TRYOUT', beaten: 'PASSED!', boss: 'THE SCHOOL BOSS', done: 'YOU MADE THE TEAM!' },
      { match: 'MATCH', beaten: 'BEATEN!', boss: 'STATE BOSS', done: 'STATE DONE!' },
      { match: 'MATCH', beaten: 'BEATEN!', boss: 'STADIUM BOSS', done: 'STADIUM DONE!' },
      { match: 'MATCH', beaten: 'BEATEN!', boss: 'WORLD CUP BOSS', done: 'WORLD CUP DONE!' },
    ]);
  });

  it('bonuses run in the spec order', () => {
    expect(BACKYARD.matches.slice(0, 10).map(m => m.bonus)).toEqual(['score3', 'cleanSheet', 'header', 'chip', 'volley', 'perfect', 'early', 'winBy3', 'twoStyle', 'win3Nil']);
  });
});

describe('progress', () => {
  it('rungs are beaten by ladder wins, the boss by its star', () => {
    expect(isBeaten(p(4), matchById('backyard-4')!)).toBe(true);
    expect(isBeaten(p(4), matchById('backyard-5')!)).toBe(false);
    expect(isBeaten(p(10), matchById(BOSS_ID)!)).toBe(false);
    expect(isBeaten(p(10, { [BOSS_ID]: 1 }), matchById(BOSS_ID)!)).toBe(true);
  });

  it('the next match follows the wins, then the boss, then on into the Park', () => {
    expect(nextCareerMatch(p(0)).id).toBe('backyard-1');
    expect(nextCareerMatch(p(6)).id).toBe('backyard-7');
    expect(nextCareerMatch(p(10)).id).toBe(BOSS_ID);
    expect(nextCareerMatch(p(10, { [BOSS_ID]: 2 })).id).toBe('park-1');
  });

  it('states: beaten, next, locked; the boss is locked until rung 10', () => {
    const at6 = p(6);
    expect(matchState(at6, matchById('backyard-6')!)).toBe('beaten');
    expect(matchState(at6, matchById('backyard-7')!)).toBe('next');
    expect(matchState(at6, matchById('backyard-8')!)).toBe('locked');
    expect(matchState(at6, matchById(BOSS_ID)!)).toBe('locked');
    expect(matchState(p(10), matchById(BOSS_ID)!)).toBe('next');
    expect(matchState(p(10, { [BOSS_ID]: 1 }), matchById(BOSS_ID)!)).toBe('beaten');
  });

  it('stars add up per venue and overall, missing ones as 0', () => {
    const s = p(6, { 'backyard-1': 1, 'backyard-5': 3, 'backyard-6': 2 });
    expect(starsAt(s, 'backyard-2')).toBe(0);
    expect(venueStars(s, 'backyard')).toBe(6);
    expect(venueStars(s, 'park')).toBe(0);
    expect(careerStars(s)).toBe(6);
  });

  it('the venue is done once the boss falls', () => {
    expect(venueDone(p(10), 'backyard')).toBe(false);
    expect(allBeaten(p(10))).toBe(false);
    expect(venueDone(p(10, { [BOSS_ID]: 1 }), 'backyard')).toBe(true);
  });

  it('allBeaten counts the open venues only: beating Biscuit opens the Park, and beating Sam the School', () => {
    expect(allBeaten(beatBiscuit())).toBe(false);
    expect(allBeaten(beatBiscuit({ 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1 }))).toBe(false);
    expect(allBeaten(atSchool())).toBe(false);
    expect(allBeaten(atSchool(8, { [SCHOOL_BOSS_ID]: 1 }))).toBe(true);
  });

  it('stop labels: stars for the Backyard, LOCKED elsewhere', () => {
    expect(stopLabel(p(6, { 'backyard-1': 1 }), 'backyard')).toBe('1/33');
    expect(stopLabel(p(6), 'park')).toBe('LOCKED');
    expect(stopLabel(p(10, { [BOSS_ID]: 1 }), 'school')).toBe('LOCKED');
  });

  it('the Park opens when Biscuit is beaten, its matches in order', () => {
    expect(venueOpen(p(10), 'backyard')).toBe(true);
    expect(venueOpen(p(10), 'park')).toBe(false);
    expect(venueOpen(beatBiscuit(), 'park')).toBe(true);
    expect(venueOpen(beatBiscuit(), 'school')).toBe(false);
    expect(nextCareerMatch(beatBiscuit()).id).toBe('park-1');
    expect(matchState(beatBiscuit(), matchById('park-1')!)).toBe('next');
    expect(matchState(beatBiscuit(), matchById('park-2')!)).toBe('locked');
    expect(matchState(p(10), matchById('park-1')!)).toBe('locked');
    const three = beatBiscuit({ 'park-1': 1, 'park-2': 2, 'park-3': 1 });
    expect(nextCareerMatch(three).id).toBe('park-4');
    expect(matchState(three, matchById(PARK_BOSS_ID)!)).toBe('locked');
    const four = beatBiscuit({ 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1 });
    expect(matchState(four, matchById(PARK_BOSS_ID)!)).toBe('next');
    const done = { ...four.career.stars, [PARK_BOSS_ID]: 1 };
    expect(nextCareerMatch(p(10, done)).id).toBe('school-1');
    expect(matchState(p(10, done), matchById(PARK_BOSS_ID)!)).toBe('beaten');
  });

  it('a Park match is beaten by its stars, never by ladder wins', () => {
    expect(isBeaten(p(10), matchById('park-1')!)).toBe(false);
    expect(isBeaten(beatBiscuit({ 'park-1': 1 }), matchById('park-1')!)).toBe(true);
  });

  it('stops: the Park shows its stars once open; the School stays LOCKED until Sam', () => {
    expect(stopLabel(p(10), 'park')).toBe('LOCKED');
    expect(stopLabel(beatBiscuit(), 'park')).toBe('0/15');
    expect(stopLabel(beatBiscuit({ 'park-1': 3 }), 'park')).toBe('3/15');
    expect(stopLabel(beatBiscuit(), 'school')).toBe('LOCKED');
    expect(stopLabel(beatBiscuit({ [PARK_BOSS_ID]: 1 }), 'school')).toBe('0/27');
    expect(stopLabel(beatBiscuit({ [PARK_BOSS_ID]: 1 }), 'stadium')).toBe('LOCKED');
  });

  it('the School opens when Sam is beaten; tryouts in order; Gus once tryout 8 is passed', () => {
    expect(venueOpen(p(10, { [BOSS_ID]: 1 }), 'school')).toBe(false);
    expect(venueOpen(atSchool(), 'school')).toBe(true);
    expect(nextCareerMatch(atSchool()).id).toBe('school-1');
    expect(matchState(atSchool(), matchById('school-2')!)).toBe('locked');
    expect(nextCareerMatch(atSchool(5)).id).toBe('school-6');
    expect(matchState(atSchool(7), matchById(SCHOOL_BOSS_ID)!)).toBe('locked');
    expect(matchState(atSchool(8), matchById(SCHOOL_BOSS_ID)!)).toBe('next');
    expect(nextCareerMatch(atSchool(8, { [SCHOOL_BOSS_ID]: 1 })).id).toBe(SCHOOL_BOSS_ID);
    expect(venueOpen(atSchool(8, { [SCHOOL_BOSS_ID]: 1 }), 'state')).toBe(false);
    expect(allBeaten(atSchool())).toBe(false);
    expect(allBeaten(atSchool(8, { [SCHOOL_BOSS_ID]: 1 }))).toBe(true);
  });

  it('stops: the School shows its stars once open; STATE says COMING SOON once Gus is beaten', () => {
    expect(stopLabel(p(10, { [BOSS_ID]: 1 }), 'school')).toBe('LOCKED');
    expect(stopLabel(atSchool(0, { 'school-1': 3 }), 'school')).toBe('3/27');
    expect(stopLabel(atSchool(8), 'state')).toBe('LOCKED');
    expect(stopLabel(atSchool(8, { [SCHOOL_BOSS_ID]: 1 }), 'state')).toBe('COMING SOON');
    expect(stopLabel(atSchool(8, { [SCHOOL_BOSS_ID]: 1 }), 'stadium')).toBe('LOCKED');
  });

  it('grantRungStars adds one star per won rung and keeps better ones', () => {
    const before = { ...newProfile(), ladderWins: 3, career: { stars: { 'backyard-2': 2 }, milestonesPaid: 0, lossStreaks: {} } };
    const after = grantRungStars(before);
    expect(after.career.stars).toEqual({ 'backyard-1': 1, 'backyard-2': 2, 'backyard-3': 1 });
    expect(before.career.stars).toEqual({ 'backyard-2': 2 });
  });

  it('the Hub card lines', () => {
    expect(careerCardLines(p(6))).toEqual({ first: 'NEXT: MAX - MATCH 7/10', second: 'MAX HAS BEEN TRAINING: JUMP UP' });
    expect(careerCardLines(p(0))).toEqual({ first: 'NEXT: MAX - MATCH 1/10', second: null });
    expect(careerCardLines(p(10))).toEqual({ first: 'NEXT: BISCUIT THE DOG', second: 'BACKYARD BOSS!' });
  });

  it('the Hub card follows him into the Park', () => {
    expect(careerCardLines(beatBiscuit())).toEqual({ first: 'NEXT: BIG BRICK - THE PARK 1/4', second: 'HE NEVER DIVES IN.' });
    const four = beatBiscuit({ 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1 });
    expect(careerCardLines(four)).toEqual({ first: 'NEXT: SPEEDY SAM', second: 'THE PARK BOSS!' });
    expect(careerCardLines(p(10, { ...four.career.stars, [PARK_BOSS_ID]: 2 }))).toEqual({ first: 'NEXT: MAX - SCHOOL FIELD 1/8', second: "HE'S TRYING OUT TOO. HE'S GOT BETTER." });
  });

  it('the Hub card follows him through the tryouts', () => {
    expect(careerCardLines(atSchool())).toEqual({ first: 'NEXT: MAX - SCHOOL FIELD 1/8', second: "HE'S TRYING OUT TOO. HE'S GOT BETTER." });
    expect(careerCardLines(atSchool(2))).toEqual({ first: 'NEXT: LOFTY LOLA - SCHOOL FIELD 3/8', second: 'SHE CHIPS ANY KEEPER OFF HIS LINE.' });
    expect(careerCardLines(atSchool(8))).toEqual({ first: 'NEXT: GOALIE GUS', second: 'THE SCHOOL BOSS!' });
    expect(careerCardLines(atSchool(8, { 'school-1': 3, [SCHOOL_BOSS_ID]: 2 }))).toEqual({ first: 'YOU MADE THE TEAM! STARS 12/27', second: 'STATE: COMING SOON' });
  });
});
