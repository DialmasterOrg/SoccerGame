import { LADDER_MATCHES, trainingLine } from './ladder';
import type { BonusId } from './objectives';
import type { Profile } from './profile';

export type VenueId = 'backyard' | 'park' | 'school' | 'state' | 'stadium' | 'worldCup';

/** Who Harrison plays: Max, Biscuit, the Park crew, Speedy Sam. */
export type OpponentId = 'max' | 'biscuit' | 'brick' | 'leo' | 'tia' | 'pete' | 'sam';

export interface CareerMatch {
  id: string;
  venue: VenueId;
  /** 'rung' is beaten by ladderWins; 'match' and 'boss' by their stars. */
  kind: 'rung' | 'match' | 'boss';
  /** Its number in the venue: 1–10 for a rung, 1–4 for a match, 0 for a boss. */
  rung: number;
  /** On the venue screen and VS card. */
  name: string;
  /** On the HUD and Results. */
  hudName: string;
  opponent: OpponentId;
  /** The facts-only line under the name; null for rungs (theirs is the training line). */
  blurb: string | null;
  /** A boss's one-line nudge once he has beaten Harrison; null otherwise. */
  tip: string | null;
  bonus: BonusId;
}

/** How a venue's screens name things. */
export interface VenueWords {
  /** A numbered match: MATCH, or TRYOUT at the School Field. */
  match: string;
  /** Results' news after `${match} ${n}` on a first win: BEATEN! or PASSED! */
  beaten: string;
  /** The boss's title on the VS card, and on the Hub with a !: THE PARK BOSS, THE SCHOOL BOSS. */
  boss: string;
  /** Results' news once the boss is beaten, and the Hub's line after: THE PARK DONE!, YOU MADE THE TEAM! */
  done: string;
}

export interface Venue {
  id: VenueId;
  name: string;
  words: VenueWords;
  matches: readonly CareerMatch[];
}

export type MatchState = 'beaten' | 'next' | 'locked';

export const rungId = (n: number): string => `backyard-${n}`;
export const BOSS_ID = 'backyard-boss';
export const PARK_BOSS_ID = 'park-boss';
export const SCHOOL_BOSS_ID = 'school-boss';

/** A match's stars at most. */
const STARS_PER_MATCH = 3;
/** The Park: four matches and a boss. */
const PARK_MATCHES = 5;
/** Every venue after the Park: eight matches and a boss. */
const LATER_VENUE_MATCHES = 9;
/** The School, the State Championship, the City Stadium and the World Cup. */
const LATER_VENUES = 4;
/** The roadmap's 156. */
export const TOTAL_STARS = (LADDER_MATCHES + 1 + PARK_MATCHES + LATER_VENUES * LATER_VENUE_MATCHES) * STARS_PER_MATCH;

/** The words every venue uses unless it says otherwise: a venue with no matches yet, and the Backyard and the Park as today. */
const plainWords = (name: string): VenueWords => ({ match: 'MATCH', beaten: 'BEATEN!', boss: `${name} BOSS`, done: `${name} DONE!` });

const RUNG_BONUSES: readonly BonusId[] = ['score3', 'cleanSheet', 'header', 'chip', 'volley', 'perfect', 'early', 'winBy3', 'twoStyle', 'win3Nil'];

const rungMatch = (n: number): CareerMatch => ({
  id: rungId(n), venue: 'backyard', kind: 'rung', rung: n, name: 'MAX', hudName: 'MAX', opponent: 'max', blurb: null, tip: null, bonus: RUNG_BONUSES[n - 1]!,
});
const BISCUIT: CareerMatch = {
  id: BOSS_ID, venue: 'backyard', kind: 'boss', rung: 0, name: 'BISCUIT THE DOG', hudName: 'BISCUIT', opponent: 'biscuit',
  blurb: "HE CAN'T SHOOT. HE JUST RUNS IT IN.", tip: 'TIP: GET BETWEEN HIM AND YOUR GOAL', bonus: 'noBossGoals',
};

export const BACKYARD: Venue = {
  id: 'backyard',
  name: 'BACKYARD',
  words: plainWords('BACKYARD'),
  matches: [...Array(LADDER_MATCHES)].map((_, i) => rungMatch(i + 1)).concat(BISCUIT),
};

const parkMatch = (rung: number, name: string, hudName: string, opponent: OpponentId, blurb: string, bonus: BonusId): CareerMatch => ({
  id: `park-${rung}`, venue: 'park', kind: 'match', rung, name, hudName, opponent, blurb, tip: null, bonus,
});

export const PARK: Venue = {
  id: 'park',
  name: 'THE PARK',
  words: plainWords('THE PARK'),
  matches: [
    parkMatch(1, 'BIG BRICK', 'BRICK', 'brick', 'HE NEVER DIVES IN.', 'chip'),
    parkMatch(2, 'BOOMER LEO', 'LEO', 'leo', 'HE SHOOTS FROM ANYWHERE.', 'cleanSheet'),
    parkMatch(3, 'TRICKY TIA', 'TIA', 'tia', 'SHE FAKES ONE WAY, THEN GOES THE OTHER.', 'steals3'),
    parkMatch(4, 'PESKY PETE', 'PETE', 'pete', "HE'S ON YOU THE MOMENT YOU HAVE IT.", 'perfect'),
    {
      id: PARK_BOSS_ID, venue: 'park', kind: 'boss', rung: 0, name: 'SPEEDY SAM', hudName: 'SAM', opponent: 'sam',
      blurb: 'THE FASTEST KID IN THE PARK. HIS SHOT IS WEAK.', tip: "TIP: DON'T RACE HIM. MAKE HIM OVERSHOOT", bonus: 'noSamGoals',
    },
  ],
};

// Max stands in for the new kids until their own builds, and for Gus until plan 5.
const tryout = (rung: number, name: string, hudName: string, opponent: OpponentId, blurb: string, bonus: BonusId): CareerMatch => ({
  id: `school-${rung}`, venue: 'school', kind: 'match', rung, name, hudName, opponent, blurb, tip: null, bonus,
});

/** The School Field: eight tryouts, then Goalie Gus. Tia's and Paige's blurbs are shortened from the spec's to fit the Hub card. */
export const SCHOOL: Venue = {
  id: 'school',
  name: 'SCHOOL FIELD',
  words: { match: 'TRYOUT', beaten: 'PASSED!', boss: 'THE SCHOOL BOSS', done: 'YOU MADE THE TEAM!' },
  matches: [
    tryout(1, 'MAX', 'MAX', 'max', "HE'S TRYING OUT TOO. HE'S GOT BETTER.", 'outsideBox'),
    tryout(2, 'HEADER HANK', 'HANK', 'max', 'HE WINS EVERY BALL IN THE AIR.', 'header'),
    tryout(3, 'LOFTY LOLA', 'LOLA', 'max', 'SHE CHIPS ANY KEEPER OFF HIS LINE.', 'chip'),
    tryout(4, 'FAKE-OUT FINN', 'FINN', 'max', "HE SHAPES TO SHOOT. THEN HE DOESN'T.", 'steals3'),
    tryout(5, 'TRICKY TIA', 'TIA', 'tia', 'SHE MOVED HERE. HER FAKE IS SHARPER.', 'cleanSheet'),
    tryout(6, 'POACHER PRIYA', 'PRIYA', 'max', 'SHE FOLLOWS EVERY SHOT IN.', 'rebound'),
    tryout(7, 'NUTMEG NIKO', 'NIKO', 'max', 'HE PUTS IT THROUGH YOUR LEGS.', 'perfect'),
    tryout(8, 'PINPOINT PAIGE', 'PAIGE', 'max', 'THE TOP SCORER. SHE PICKS A CORNER.', 'noPaigeGoals'),
    {
      id: SCHOOL_BOSS_ID, venue: 'school', kind: 'boss', rung: 0, name: 'GOALIE GUS', hudName: 'GUS', opponent: 'max',
      blurb: 'THE CAPTAIN. HE FILLS THE WHOLE GOAL.', tip: null, bonus: 'threePastGus',
    },
  ],
};

/** A venue with no matches yet: its stop reads LOCKED, then COMING SOON once the venue before it is done. */
const comingSoon = (id: VenueId, name: string): Venue => ({ id, name, words: plainWords(name), matches: [] });

/** The venues in career order; the State Championship and beyond have no matches yet. */
export const VENUES: readonly Venue[] = [
  BACKYARD,
  PARK,
  SCHOOL,
  comingSoon('state', 'STATE'),
  comingSoon('stadium', 'STADIUM'),
  comingSoon('worldCup', 'WORLD CUP'),
];

const ALL_MATCHES: readonly CareerMatch[] = VENUES.flatMap(v => v.matches);
const BY_ID = new Map(ALL_MATCHES.map(m => [m.id, m]));

/** Every match id, in venue order. */
export const MATCH_IDS: readonly string[] = ALL_MATCHES.map(m => m.id);

export function matchById(id: string): CareerMatch | undefined {
  return BY_ID.get(id);
}

export const venueById = (id: VenueId): Venue => VENUES.find(v => v.id === id)!;
const venueIndex = (id: VenueId): number => VENUES.findIndex(v => v.id === id);
const bossOf = (venue: VenueId): CareerMatch | undefined => venueById(venue).matches.find(m => m.kind === 'boss');

/** The most stars a venue's matches can earn. */
export function venueMaxStars(venue: VenueId): number {
  return venueById(venue).matches.length * STARS_PER_MATCH;
}

/** His best stars at a match; 0 when he has none there. */
export function starsAt(p: Profile, id: string): number {
  return p.career.stars[id] ?? 0;
}

/** Every rung he has won carries at least one star: the retro grant for saves from before stars existed. Never changes `p`. */
export function grantRungStars(p: Profile): Profile {
  const stars = { ...p.career.stars };
  for (let n = 1; n <= p.ladderWins; n++) stars[rungId(n)] = Math.max(stars[rungId(n)] ?? 0, 1);
  return { ...p, career: { ...p.career, stars } };
}

/** A rung is beaten by the ladder wins; any other match by its star. */
export function isBeaten(p: Profile, m: CareerMatch): boolean {
  return m.kind === 'rung' ? p.ladderWins >= m.rung : starsAt(p, m.id) >= 1;
}

/** A venue is done when its boss is beaten. */
export function venueDone(p: Profile, venue: VenueId): boolean {
  const boss = bossOf(venue);
  return boss !== undefined && isBeaten(p, boss);
}

/** The Backyard is always open; a later venue once it has matches and the one before it is done. */
export function venueOpen(p: Profile, venue: VenueId): boolean {
  const i = venueIndex(venue);
  if (i === 0) return true;
  return venueById(venue).matches.length > 0 && venueDone(p, VENUES[i - 1]!.id);
}

const openVenues = (p: Profile): readonly Venue[] => VENUES.filter(v => venueOpen(p, v.id));

/** The first unbeaten match in the open venues, in order; the last open venue's boss once every one is beaten, as a replay. */
export function nextCareerMatch(p: Profile): CareerMatch {
  const open = openVenues(p);
  for (const v of open) {
    const m = v.matches.find(m => !isBeaten(p, m));
    if (m) return m;
  }
  return bossOf(open[open.length - 1]!.id)!;
}

export function matchState(p: Profile, m: CareerMatch): MatchState {
  if (!venueOpen(p, m.venue)) return 'locked';
  if (isBeaten(p, m)) return 'beaten';
  if (m.kind === 'boss' && venueById(m.venue).matches.some(o => o.kind !== 'boss' && !isBeaten(p, o))) return 'locked';
  return nextCareerMatch(p).id === m.id ? 'next' : 'locked';
}

export function venueStars(p: Profile, venue: VenueId): number {
  return venueById(venue).matches.reduce((sum, m) => sum + starsAt(p, m.id), 0);
}

export function careerStars(p: Profile): number {
  return VENUES.reduce((sum, v) => sum + venueStars(p, v.id), 0);
}

/** Every match in every open venue is beaten. */
export function allBeaten(p: Profile): boolean {
  return openVenues(p).every(v => v.matches.every(m => isBeaten(p, m)));
}

/** The line under a stop on the road map. */
export function stopLabel(p: Profile, venue: VenueId): string {
  if (venueOpen(p, venue)) return `${venueStars(p, venue)}/${venueMaxStars(venue)}`;
  const i = venueIndex(venue);
  if (venueById(venue).matches.length === 0 && i > 0 && venueDone(p, VENUES[i - 1]!.id)) return 'COMING SOON';
  return 'LOCKED';
}

/** The Hub card's two career lines; the second is null when there is nothing to add. */
export function careerCardLines(p: Profile): { first: string; second: string | null } {
  const next = nextCareerMatch(p);
  const venue = venueById(next.venue);
  if (isBeaten(p, next)) {
    const after = VENUES[venueIndex(venue.id) + 1];
    return { first: `${venue.words.done} STARS ${venueStars(p, venue.id)}/${venueMaxStars(venue.id)}`, second: after ? `${after.name}: COMING SOON` : null };
  }
  if (next.kind === 'boss') return { first: `NEXT: ${next.name}`, second: `${venue.words.boss}!` };
  if (next.kind === 'rung') return { first: `NEXT: ${next.name} - MATCH ${next.rung}/${LADDER_MATCHES}`, second: trainingLine(next.rung) };
  const numbered = venue.matches.filter(m => m.kind === 'match').length;
  return { first: `NEXT: ${next.name} - ${venue.name} ${next.rung}/${numbered}`, second: next.blurb };
}
