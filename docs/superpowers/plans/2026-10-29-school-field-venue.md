# The School Field (7c, plan 3 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beating Speedy Sam opens the School Field, an autumn Saturday morning with its own art and life. The catalog gains eight tryouts and Goalie Gus, with Max standing in for every one of them until plans 4 and 5. Four new bonuses arrive, along with profile v7 and the save code, and a sixth stop on the road map. The venue screen, Hub, VS card, Results and Help all read the School, so the venue plays end to end.

**Architecture:**
- **Career data.** `career.ts` gains `SCHOOL` (nine matches, every one `opponent: 'max'`) and an empty `STATE` venue between it and the Stadium. Each venue gets `words`, so the screens can say TRYOUT 3, PASSED!, THE SCHOOL BOSS and YOU MADE THE TEAM! while the Backyard and the Park read exactly as today. `TOTAL_STARS` becomes the roadmap's 156.
- **Bonuses.** Two read new facts on each `GoalRecord` (`outsideBox`, `rebound`). The match scene works them out in a new `goalFacts.ts` from the keepers: `keepers.strike` (now cleared on a catch and a drop kick, and carrying `z`) and `KeeperEvents.pushed`. The other two are rules that already exist, under new labels.
- **Art.** `school.ts` draws the four autumn layers for the big view, and `schoolLife.ts` the crowd, flag and leaf frames. `schoolView.ts` animates them. `drawLayers` shifts any venue's layers so its near touchline meets the camera's; that is how the 300-row School shows on the 320×180 venue screen and VS card. The road map cuts each postcard from a fixed height above the venue's far touchline.
- **Saves.** v7 adds no fields. The save code appends the School's stars and Gus's streak, and the entry screen takes a fifth small line.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 4, Canvas 2D, Web Audio, Node 20, tsx; plain `python3` with PIL for scaling stills.

**Spec:** `docs/superpowers/specs/2026-10-28-school-field-design.md`. Read:
- *The School Field in the career*: every subsection.
- *The School Field's look*, *The save: profile version 7*, *Sound*, *Art and approval*, *Constraints*, *Left to the builder*.
- Plan 3's bullet in *Plans and release*.
- *As built: plan 1*: its notes for plan 3.
- *As built: plan 2*: its notes for plans 3-5 and its deferred list.

## Global Constraints

- **The Backyard and the Park play as before.** Every existing tuning test, AI-vs-AI test and the no-kit parity test passes unchanged. Their screens' text reads exactly as today. They see two changes: the road map (six smaller stops, `STARS n/156`), and Results after Sam, which now offers NEXT MATCH to tryout 1.
- **Keepers are unchanged** except Task 4's strike. Plan 2's keeper, drill and match tests pass unchanged. If one changes outcome, stop and report the numbers to the parent. Don't move a dial.
- **On-screen text** uses only uppercase letters, digits and `' - : ! ? . , / + < >`, with no parentheses. Every new line is measured against its slot in a test.
- **Assets.** No image, audio or font files. No surname anywhere. The school is made up: no name, crest or words on it.
- **Palette.** Use the existing master colours, as the approved sketch did (cap 70). A new colour moves the cap in `colors.test.ts` on purpose, with a comment naming the School.
- **Saves.**
  - v7 adds no fields.
  - The save code is append-only: after v6's fields come the nine School star counts in match order, then Gus's loss streak.
  - Clamps stay as they are: stars 0–3, streaks 0–99.
  - Storage that throws never stops the game, and two-tab sync is unchanged.
  - Nothing earned is ever taken back.
- **Screens.** School matches draw at 534×300. Every other screen draws at 320×180. Everything scales by whole numbers.
- **Out of scope.**
  - Plan 4: the six new kids, and the returning Max and Tia.
  - Plan 5: Gus's body, brain, tip, Help line and sting.
  - Keepers stay off the VS card (the builder's call).
  - Milestones stay 10 / 25 / 50 / 75.
- **Approvals.** Stills of the venue go to **the parent alone** with `SendUserFile`, because Harrison wants to be surprised. Nothing merges with unapproved art. This plan ends on the branch: no merge into `main`, no push.
- **Git.** Work on `plan-7c-school-field` (f715522 plus this plan's commit). Run `git status --short` before every commit. Commits follow Conventional Commits, 50/72, with no AI attribution trailers.
- **Commands.** Run everything from the project root:
  - one file: `npx vitest run <file>`
  - the whole suite: `npx vitest run`
  - the types: `npx tsc --noEmit`
  - the build: `npm run build`
- **Deferred minors.** Plans 1 and 2's deferred minors stay deferred, except `keepers.strike` not being cleared (Task 4).

## Max standing in, and how this plan treats it

- **Who plays.** Every School slot's catalog entry says `opponent: 'max'`, so the match, the VS card and the venue screen need no stand-in code.
  - Tryout n plays Max at `maxStats(n)` with `DIFFICULTY[d]`. Gus's slot, rung 0, clamps to rung 1's stats.
  - Max's art plays under the catalog's names: HANK on the HUD, `GUS SCORES`.
  - Plans 4 and 5 change the `opponent` fields.
- **He will rarely score against Harrison's keeper.** At ladder stats he is near Base. Plan 2 measured Base AIs at 3 goals in 24 matches against keepers that meet the targets. This plan accepts that.
  - The stand-in exists so the venue plays end to end: the catalog, the saves, the screens, and the road from Sam to Gus. He isn't meant to be a fair opponent.
  - Nothing is tuned for him, and no test needs him to score. Tests that need a result stage the score.
  - KEEP A CLEAN SHEET and DON'T LET PAIGE SCORE come easy for now.
- **Measured once, for information.** Task 9 measures him on Normal against the scripted Harrison at tryouts 1 and 8 and Gus's slot. The numbers go in As built and in the report to the parent. Plan 4 measures each kid against the keepers, and plan 5 measures Gus.
- **Nobody plays him for real.** There is one merge, after Gus. Every playtest here uses an in-memory profile or a spare slot on the dev origin, never Harrison's save.

## Review Focus

1. **Harrison's own save.** His v6 save has beaten Sam, so it lands on the School:
   - the Hub reads `NEXT: MAX - SCHOOL FIELD 1/8`;
   - the road map opens on the School's postcard;
   - a Sam replay's Results offers NEXT MATCH, which starts tryout 1's VS card.

   Pinned in Tasks 2 and 8.
2. **Stale strikes.** Each of these is pinned in Task 4:
   - A long shot caught and drop-kicked, followed by a goal from inside the box, isn't from outside the box.
   - A wave fired from outside the box doesn't count.
   - A parried long shot that rolls in counts as outside the box, but not as a rebound.
   - A kick 2.1 s after their keeper's push isn't a rebound.
   - Harrison's own keeper's push never makes a rebound.
3. **Text that overflows.** Each of these must fit its slot:
   - every School blurb on the Hub card's second line;
   - the longest Hub line, `NEXT: PINPOINT PAIGE - SCHOOL FIELD 8/8`;
   - the longest panel title at 2×, `TRYOUT 8 - PINPOINT PAIGE`;
   - every stop's name and label (SCHOOL FIELD, COMING SOON).

   The spec's blurbs for Tia and Paige don't fit the Hub, so Task 2 shortens them. Pinned in Tasks 2 and 7.
4. **The 300-row School on 320×180 screens.**
   - The venue screen's juggler stands on the School's grass, not in the bleachers.
   - The VS pair stand on the pitch.
   - The postcard shows the school building, not sky or plain grass.

   Pinned in Tasks 5 (the shift) and 2 (the postcard rule), and seen in Task 10's stills.
5. **Saves across builds.**
   - A v6 tab left open can't write over a v7 save that has School stars.
   - A v6 save code applies, with no School stars.
   - The longest v7 code fits the entry screen in five small lines.

   Pinned in Task 3.

---

### Task 1: The four new bonuses

**Files:**
- Modify: `src/meta/objectives.ts`, `src/meta/economy.ts` (`GoalRecord`), `src/scenes/matchScene.ts` (`recordGoal`)
- Test: `src/meta/objectives.test.ts`, and the `GoalRecord` literals in `src/meta/progress.test.ts`, `src/scenes/resultsScene.test.ts`, `src/scenes/matchScene.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // economy.ts
  export interface GoalRecord {
    minute: number; kind: GoalKind | null; perfect: boolean;
    /** The kick that scored was struck with the ball outside their penalty box. Always false without keepers. */
    outsideBox: boolean;
    /** That kick came within REBOUND_S of their keeper pushing the ball away. Always false without keepers. */
    rebound: boolean;
  }
  // objectives.ts
  export type BonusId = /* today's */ | 'outsideBox' | 'rebound' | 'noPaigeGoals' | 'threePastGus';
  ```
  | id | label | inPlay | done |
  |---|---|---|---|
  | `outsideBox` | `SCORE FROM OUTSIDE THE BOX` | true | some goal has `outsideBox` |
  | `rebound` | `SCORE A REBOUND` | true | some goal has `rebound` |
  | `noPaigeGoals` | `DON'T LET PAIGE SCORE` | false | `atFullTime(goalsAgainst === 0)`, as Sam's |
  | `threePastGus` | `PUT 3 PAST GUS` | true | `goals.length >= SCORE3_GOALS` |

- [ ] **Step 1: Write the failing tests** in `objectives.test.ts`

```ts
const goal = (o: Partial<GoalRecord> = {}): GoalRecord => ({ minute: 10, kind: 'shot', perfect: false, outsideBox: false, rebound: false, ...o });
const inPlay = (goals: GoalRecord[]): BonusInput => ({ goalsFor: goals.length, goalsAgainst: 0, goals, result: null, steals: 0 });

it('a goal struck outside the box settles SCORE FROM OUTSIDE THE BOX in play', () => {
  expect(BONUSES.outsideBox).toMatchObject({ label: 'SCORE FROM OUTSIDE THE BOX', inPlay: true });
  expect(BONUSES.outsideBox.done(inPlay([goal()]))).toBe(false);
  expect(BONUSES.outsideBox.done(inPlay([goal(), goal({ outsideBox: true })]))).toBe(true);
});
it('a rebound goal settles SCORE A REBOUND in play', () => {
  expect(BONUSES.rebound).toMatchObject({ label: 'SCORE A REBOUND', inPlay: true });
  expect(BONUSES.rebound.done(inPlay([goal({ outsideBox: true })]))).toBe(false);
  expect(BONUSES.rebound.done(inPlay([goal({ rebound: true })]))).toBe(true);
});
it("Paige's bonus is a clean sheet at full time, with her name", () => {
  expect(BONUSES.noPaigeGoals).toMatchObject({ label: "DON'T LET PAIGE SCORE", inPlay: false });
  expect(BONUSES.noPaigeGoals.done(inPlay([goal()]))).toBe(false);
  expect(BONUSES.noPaigeGoals.done({ ...inPlay([goal()]), result: 'win' })).toBe(true);
  expect(BONUSES.noPaigeGoals.done({ ...inPlay([goal()]), goalsAgainst: 1, result: 'win' })).toBe(false);
});
it('three goals put 3 past Gus, in play', () => {
  expect(BONUSES.threePastGus).toMatchObject({ label: 'PUT 3 PAST GUS', inPlay: true });
  expect(BONUSES.threePastGus.done(inPlay([goal(), goal()]))).toBe(false);
  expect(BONUSES.threePastGus.done(inPlay([goal(), goal(), goal()]))).toBe(true);
});
it('starsFor reads the new facts: a 2-0 win with a goal from outside the box is 3 stars there, 2 elsewhere', () => {
  const s: MatchSummary = { result: 'win', goalsFor: 2, goalsAgainst: 0, styleGoals: [], goals: [goal(), goal({ outsideBox: true })], steals: 0 };
  expect(starsFor(s, 'outsideBox')).toBe(3);
  expect(starsFor(s, 'rebound')).toBe(2);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/meta/objectives.test.ts`. Expected: FAIL (`BONUSES.outsideBox` undefined).

- [ ] **Step 3: Implement** the table above.
  - `matchScene.ts`'s `recordGoal` adds `outsideBox: false, rebound: false` for now. Task 4 fills them in.
  - Give every existing `GoalRecord` literal in the tests both fields as `false`.

- [ ] **Step 4: Run the meta and scene tests and the types.** Run `npx vitest run src/meta src/scenes && npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta src/scenes && git status --short
git commit -m "feat: add the School Field's four bonuses"
```

---

### Task 2: The School Field and STATE on the career road

**Files:**
- Modify: `src/meta/career.ts`, `src/scenes/roadMapScene.ts`, `src/scenes/hubScene.ts` (export `CARD_RIGHT`)
- Test: `src/meta/career.test.ts`, `src/scenes/roadMapScene.test.ts`, `src/scenes/hubScene.test.ts`, `src/scenes/resultsScene.test.ts` (the test that pinned CAREER after Sam)

**Interfaces:**
- Consumes: Task 1's bonus ids.
- Produces:
  ```ts
  // career.ts
  export type VenueId = 'backyard' | 'park' | 'school' | 'state' | 'stadium' | 'worldCup';
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
  export interface Venue { id: VenueId; name: string; words: VenueWords; matches: readonly CareerMatch[] }
  export const SCHOOL: Venue;                // school-1..school-8, then school-boss
  export const SCHOOL_BOSS_ID = 'school-boss';
  export const TOTAL_STARS: number;          // 156
  // roadMapScene.ts
  export const STOPS: readonly { cx: number; y: number }[];  // six
  export const CARD: { w: number; h: number };               // 46×30
  export const NAME_BELOW: number;           // 33
  export const LABEL_BELOW: number;          // 42
  /** Where a venue's postcard is cut from its own layers: POSTCARD_X along, POSTCARD_ABOVE_FAR (48) rows above its far touchline. */
  export function postcardFrom(venue: VenueId): { x: number; y: number };
  // hubScene.ts: the existing const, exported
  export const CARD_RIGHT: number;
  ```

**The data:**
- **Words.** These reproduce today's Backyard and Park text exactly.
  - Backyard: `{ match: 'MATCH', beaten: 'BEATEN!', boss: 'BACKYARD BOSS', done: 'BACKYARD DONE!' }`
  - Park: `{ 'MATCH', 'BEATEN!', 'THE PARK BOSS', 'THE PARK DONE!' }`
  - School: `{ 'TRYOUT', 'PASSED!', 'THE SCHOOL BOSS', 'YOU MADE THE TEAM!' }`
  - A venue with no matches: `${name} BOSS` and `${name} DONE!`
- **Venues, in order:** BACKYARD, THE PARK, SCHOOL FIELD (`name: 'SCHOOL FIELD'`), STATE, STADIUM, WORLD CUP.
- **The School's matches**, from the spec's table:

  | # | name / hudName | blurb | bonus |
  |---|---|---|---|
  | 1 | MAX / MAX | `HE'S TRYING OUT TOO. HE'S GOT BETTER.` | `outsideBox` |
  | 2 | HEADER HANK / HANK | `HE WINS EVERY BALL IN THE AIR.` | `header` |
  | 3 | LOFTY LOLA / LOLA | `SHE CHIPS ANY KEEPER OFF HIS LINE.` | `chip` |
  | 4 | FAKE-OUT FINN / FINN | `HE SHAPES TO SHOOT. THEN HE DOESN'T.` | `steals3` |
  | 5 | TRICKY TIA / TIA | `SHE MOVED HERE. HER FAKE IS SHARPER.` | `cleanSheet` |
  | 6 | POACHER PRIYA / PRIYA | `SHE FOLLOWS EVERY SHOT IN.` | `rebound` |
  | 7 | NUTMEG NIKO / NIKO | `HE PUTS IT THROUGH YOUR LEGS.` | `perfect` |
  | 8 | PINPOINT PAIGE / PAIGE | `THE TOP SCORER. SHE PICKS A CORNER.` | `noPaigeGoals` |
  | boss | GOALIE GUS / GUS | `THE CAPTAIN. HE FILLS THE WHOLE GOAL.` | `threePastGus` |

  - The spec's blurbs for Tia and Paige run 229 and 209 px, too wide for the Hub's 200, so the table shortens them. The facts are kept.
  - Every School match is `opponent: 'max'`, marked `// Max stands in for every tryout until plan 4's cast, and for Gus until plan 5.`
  - Gus's `tip` stays `null`: his tip is plan 5's.
- **The star total.** `TOTAL_STARS = (LADDER_MATCHES + 1 + PARK_MATCHES + LATER_VENUES * LATER_VENUE_MATCHES) * STARS_PER_MATCH`, which is 156, the roadmap spec's total.
  - `PARK_MATCHES` is 5.
  - `LATER_VENUE_MATCHES` is 9: eight matches and a boss.
  - `LATER_VENUES` is 4: the School, the State Championship, the City Stadium and the World Cup.
- **`careerCardLines`.**
  - With nothing left to beat: `${words.done} STARS n/max`, then `${next venue name}: COMING SOON`.
  - With a boss next: `NEXT: ${name}`, then `${words.boss}!`.
  - Everything else is unchanged.

**The road map:**
- **The cards.** `CARD` is 46×30.
  - `STOPS` cx: 28, 78, 136, 190, 240, 290. The School and the State get the widest gaps, for SCHOOL FIELD and COMING SOON.
  - `STOPS` y: 122, 106, 90, 74, 58, 42.
  - `NAME_BELOW` is 33 and `LABEL_BELOW` is 42. The road's dots run through the card middles (`ROAD.below` 15).
- **The postcard.** It calls `drawLayers` on `{ x: 0, view: stageFor(venue).view }`, so each venue draws at its own size, translated so the card shows it from `postcardFrom(venue)`.
  - x is `POSTCARD_X`, 118.
  - y is the far touchline's row less 48, where the far row is the stage view's `nearSY` minus the field's depth.
  - The Backyard and the Park keep today's 64. The School's is 120, where its school building stands.
- **The total line** reads `STARS n/156`.

- [ ] **Step 1: Write the failing tests**

```ts
// career.test.ts
const PARK_DONE = { [BOSS_ID]: 1, 'park-1': 1, 'park-2': 1, 'park-3': 1, 'park-4': 1, [PARK_BOSS_ID]: 1 };
const TRYOUTS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `school-${n}`);
/** Sam beaten, the first n tryouts at one star, and anything else. */
const atSchool = (n = 0, more: Record<string, number> = {}) => p(10, { ...PARK_DONE, ...Object.fromEntries(TRYOUTS.slice(0, n).map(id => [id, 1])), ...more });

it('the School Field: eight tryouts, then Goalie Gus, Max standing in for all of them', () => {
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
  expect(SCHOOL.matches.every(m => m.opponent === 'max' && m.blurb !== null && m.tip === null)).toBe(true);
  expect(VENUES.map(v => v.id)).toEqual(['backyard', 'park', 'school', 'state', 'stadium', 'worldCup']);
  expect([venueMaxStars('school'), venueMaxStars('state'), TOTAL_STARS]).toEqual([27, 0, 156]);
  expect(MATCH_IDS).toHaveLength(25);
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

it('the Hub card follows him through the tryouts', () => {
  expect(careerCardLines(atSchool())).toEqual({ first: 'NEXT: MAX - SCHOOL FIELD 1/8', second: "HE'S TRYING OUT TOO. HE'S GOT BETTER." });
  expect(careerCardLines(atSchool(2))).toEqual({ first: 'NEXT: LOFTY LOLA - SCHOOL FIELD 3/8', second: 'SHE CHIPS ANY KEEPER OFF HIS LINE.' });
  expect(careerCardLines(atSchool(8))).toEqual({ first: 'NEXT: GOALIE GUS', second: 'THE SCHOOL BOSS!' });
  expect(careerCardLines(atSchool(8, { 'school-1': 3, [SCHOOL_BOSS_ID]: 2 }))).toEqual({ first: 'YOU MADE THE TEAM! STARS 12/27', second: 'STATE: COMING SOON' });
});
```

  - **Existing `career.test.ts` assertions that pinned an empty School change:** `TOTAL_STARS` 93, `MATCH_IDS` 16, `allBeaten` after Sam, the Hub after Sam (`THE PARK DONE!` / `SCHOOL: COMING SOON`), and the School's COMING SOON after Sam.
  - **The Park's words are pinned where they can still show:** `NEXT: SPEEDY SAM` / `THE PARK BOSS!`.
  - **`roadMapScene.test.ts`:**
    - 'left/right move among six stops without wrapping'.
    - After Sam, the School's card is a postcard of `art.venues.school`, and A enters its venue screen.
    - After Gus, STATE draws `art.text(COMING SOON,…` and A on it blips (this replaces the test that pinned COMING SOON on the School after Sam).
    - The total draws `STARS 0/156`.
    - `postcardFrom('backyard')` is `{ x: 118, y: 64 }`, and `postcardFrom('school')` is `{ x: 118, y: 120 }`.
    - The six stops fit:

```ts
it('six stops fit the screen, and no name or label runs into another card', () => {
  expect(STOPS).toHaveLength(VENUES.length);
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const centred = (cx: number, y: number, w: number, h: number): Box => ({ x0: cx - w / 2, x1: cx + w / 2, y0: y, y1: y + h });
  const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const RING = 2; // the cursor's thick frame
  const cards = STOPS.map(s => centred(s.cx, s.y - RING, CARD.w + 2 * RING, CARD.h + 2 * RING));
  // The widest label each stop can show in 7c: full stars after the star, COMING SOON on the first stop without matches, LOCKED after it.
  const firstEmpty = VENUES.findIndex(v => v.matches.length === 0);
  const labelW = (i: number) => {
    const max = venueMaxStars(VENUES[i]!.id);
    return 2 + (i < firstEmpty ? STAR_W + 4 + measureText(`${max}/${max}`) : measureText(i === firstEmpty ? 'COMING SOON' : 'LOCKED'));
  };
  VENUES.forEach((v, i) => {
    const s = STOPS[i]!;
    const texts = [centred(s.cx, s.y + NAME_BELOW, measureText(v.name) + 2, GLYPH_H + 2), centred(s.cx, s.y + LABEL_BELOW, labelW(i), GLYPH_H + 2)];
    for (const b of [cards[i]!, ...texts]) expect(b.x0 >= 0 && b.x1 <= BASE_W, v.name).toBe(true);
    for (const t of texts) cards.forEach((c, j) => j !== i && expect(hits(t, c), `${v.name} vs ${VENUES[j]!.name}`).toBe(false));
  });
});
```

  - **`hubScene.test.ts`:** every career line the catalog can show fits the card, `measureText(line) + 2 <= CARD_RIGHT - TEXT_X`.
    - For each numbered match at the Park and the School, build a profile with every match before it beaten, so `careerCardLines` names it; both of its lines fit.
    - So do `YOU MADE THE TEAM! STARS 27/27` and `STATE: COMING SOON`.
  - **`resultsScene.test.ts`:** 'after beating Sam, NEXT MATCH becomes CAREER' becomes: after the first win over Sam the items are `['NEXT MATCH', 'SHOP', 'HUB']`.

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/meta/career.test.ts src/scenes/roadMapScene.test.ts src/scenes/hubScene.test.ts`. Expected: FAIL (`SCHOOL` is not exported).

- [ ] **Step 3: Implement** the data, the words, `careerCardLines` and the road map above.

- [ ] **Step 4: Run the meta and scene tests and the types.** Run `npx vitest run src/meta src/scenes && npx tsc --noEmit`. Expected: PASS. Any other scene test that pinned the School as empty moves to the new truth in the same way.

- [ ] **Step 5: Commit**

```bash
git add src/meta src/scenes && git status --short
git commit -m "feat: add the School Field and STATE to the career"
```

---

### Task 3: Profile v7 and the save code

**Files:**
- Modify: `src/meta/profile.ts`, `src/meta/saveCode.ts`, `src/scenes/saveCodeScene.ts` (`MAX_ENTRY`, `CODE_SIZES`)
- Test: `src/meta/profile.test.ts`, `src/meta/saveCode.test.ts`, `src/scenes/saveCodeScene.test.ts`

**Interfaces:**
- Consumes: `SCHOOL`, `SCHOOL_BOSS_ID` (Task 2).
- Produces:
  - `Profile.version: 7` and `PROFILE_VERSION = 7`, with a comment: v7 adds no fields; School ids load because they're catalog ids, and the bump stops a v6 tab writing over School stars.
  - **The save code**, after every v6 field, under a `// v7:` comment: `...SCHOOL.matches.map(m => p.career.stars[m.id] ?? 0)`, then `p.career.lossStreaks[SCHOOL_BOSS_ID] ?? 0`. The decoder reads them back after v6's fields.
  - **The entry screen.**
    - The longest code grows from 151 to 167 characters (ten more one-byte fields).
    - `MAX_ENTRY` becomes 169: the longest code plus 2, as today. If the test measures a different longest code, `MAX_ENTRY` is that plus 2.
    - The small code size takes `maxLines: 5`, still eight groups to a line. Five lines end above `STATUS_Y` even with `ENTRY_DROP`.

- [ ] **Step 1: Write the failing tests**
  - **Loading.**
    - A v6 record holding `'school-3': 2` loads at version 7 and keeps it.
    - A v6 record without School ids loads with none.
  - **`writeUnlessNewer`.** With a stored `{ version: 7 }` and an incoming v6 profile, the stored save is left alone. Use the storage test's existing pattern.
  - **Round trip.** School stars 3/2/1/3/1/2/3/1/2 and Gus's streak 4 encode and decode to the same.
  - **A v6-era code.** Decode a code to its fields, drop the last ten, `encodeFields` them, and decode that. It applies with no School stars and no Gus streak.
  - **The longest-code test** in `saveCodeScene.test.ts` adds School stars at 3 and Gus's streak at 99. It still shows at scale 1, now in at most 5 lines. Its length is 167, and `MAX_ENTRY` is 169.

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/meta/profile.test.ts src/meta/saveCode.test.ts src/scenes/saveCodeScene.test.ts`. Expected: FAIL on the version, the round trip and the length.

- [ ] **Step 3: Implement** the interfaces above.

- [ ] **Step 4: Run the whole suite and the types.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta src/scenes && git status --short
git commit -m "feat: move the profile to v7 for the School Field"
```

---

### Task 4: Where Harrison struck the ball

**Files:**
- Modify: `src/game/keeper.ts` (`Strike.z`; `startHold` and `dropKick` clear the strike), `src/game/world.ts` (the strike's `z`; export `quietContact` for the tests), `src/scenes/matchScene.ts`
- Create: `src/scenes/goalFacts.ts`, `src/scenes/goalFacts.test.ts`
- Test: `src/game/keeper.test.ts`, `src/scenes/matchScene.test.ts`

**Interfaces:**
- Consumes: `GoalRecord.outsideBox` and `GoalRecord.rebound` (Task 1); `school-1` and `school-6` (Task 2); plan 2's `keepers.strike`, `KeeperEvents.pushed`, `penaltyArea`, and `testKeepers.ts` (`keeperWorld`, `runUntil`, `shotAt`, `setBall`).
- Produces:
  ```ts
  // keeper.ts
  export interface Strike { team: Team; kind: …; perfect: boolean; x: number; z: number }
  // goalFacts.ts
  /** A kick struck within this long of their keeper pushing the ball away is a rebound, s. */
  export const REBOUND_S = 2;
  /** What the School Field's bonuses need, kept tick by tick. */
  export interface KeeperWatch {
    /** Seconds since their keeper last pushed the ball away; Infinity before he has. */
    sincePushS: number;
    /** Harrison's latest kick came within REBOUND_S of a push. */
    reboundKick: boolean;
  }
  export function createKeeperWatch(): KeeperWatch;
  /** After a world step: a kick of his this tick is judged against the push before it, then this tick's push by their keeper restarts the clock. */
  export function stepKeeperWatch(watch: KeeperWatch, w: World, dt: number): void;
  /** Read on the tick of his goal: both false unless there are keepers, `kick` is a live kick of his that isn't the wave, and the strike is his. */
  export function goalFacts(w: World, watch: KeeperWatch, kick: LastKick | null): Pick<GoalRecord, 'outsideBox' | 'rebound'>;
  ```
  - **`outsideBox`:** the strike's `(x, z)` lies outside `penaltyArea(w.field, the right goal)`. A point on the box's edge counts as inside.
  - **`rebound`:** `watch.reboundKick`.
  - **A wave goal counts for neither.** The wave makes no strike, so the one there is stale. This is the builder's reading of "a kick he struck"; it goes in As built for the parent.

- [ ] **Step 1: Write the failing tests**

```ts
// keeper.test.ts
const STALE: Strike = { team: 'home', kind: 'shot', perfect: true, x: 1000, z: 64 };
it("a catch clears the last strike, so it can't follow the ball", () => {
  const w = keeperWorld();
  w.keepers!.strike = { ...STALE };
  shotAt(w, { x: 1180, z: 64 }, 64, 150); // slow and straight at him: always held
  expect(runUntil(w, 2, w => w.keepers!.away.holding)).toBe(true);
  expect(w.keepers!.strike).toBeNull();
});
it('so does the drop kick', () => {
  const w = keeperWorld();
  shotAt(w, { x: 1180, z: 64 }, 64, 150);
  runUntil(w, 2, w => w.keepers!.away.holding);
  w.keepers!.strike = { ...STALE };
  expect(runUntil(w, 3, w => w.keepers!.punt !== null)).toBe(true);
  expect(w.keepers!.strike).toBeNull();
});
```
  Also: a strike records the ball's depth too. Strike as `keeperSaves.test.ts` does (`runUntil(… strike !== null …)`), then expect `strike.z` within `REACH_Z` of Harrison's `z`.

```ts
// goalFacts.test.ts
const shot: LastKick = { kind: 'shot', perfect: false, distance: 240 };
const strikeAt = (w: World, x: number, z: number, team: Team = 'home') => (w.keepers!.strike = { team, kind: 'shot', perfect: false, x, z });
/** This tick's events: a kick of his or none, and who pushed the ball away. */
const tick = (w: World, kicked: 'shot' | null, pushed: KeeperSide | null = null) => {
  w.events = { ...w.events, kicks: [{ ...quietContact(), kicked }, quietContact()], keeper: { ...quietKeepers(), pushed } };
};
/** Their keeper pushes, then `afterS` passes, then he kicks. */
const kickAfterPush = (afterS: number, by: KeeperSide = 'away') => {
  const w = keeperWorld();
  const watch = createKeeperWatch();
  tick(w, null, by);
  stepKeeperWatch(watch, w, STEP);
  for (let t = 0; t < afterS; t += STEP) { tick(w, null); stepKeeperWatch(watch, w, STEP); }
  tick(w, 'shot');
  stepKeeperWatch(watch, w, STEP);
  strikeAt(w, 1180, 64);
  return goalFacts(w, watch, shot);
};

it('a goal from his kick outside their box is from outside the box; inside it, not', () => {
  const w = keeperWorld();
  const watch = createKeeperWatch();
  strikeAt(w, 1000, 64);
  expect(goalFacts(w, watch, shot).outsideBox).toBe(true);
  strikeAt(w, 1180, 64);
  expect(goalFacts(w, watch, shot).outsideBox).toBe(false);
  strikeAt(w, 1180, 4); // level with the box, but wide of it in depth
  expect(goalFacts(w, watch, shot).outsideBox).toBe(true);
});
it("no live kick of his, the wave, a cleared strike or theirs never counts", () => {
  const w = keeperWorld();
  const watch = createKeeperWatch();
  strikeAt(w, 1000, 64);
  expect(goalFacts(w, watch, null)).toEqual({ outsideBox: false, rebound: false });
  expect(goalFacts(w, watch, { ...shot, kind: 'wave' }).outsideBox).toBe(false);
  strikeAt(w, 1000, 64, 'away');
  expect(goalFacts(w, watch, shot).outsideBox).toBe(false);
  w.keepers!.strike = null;
  expect(goalFacts(w, watch, shot).outsideBox).toBe(false);
});
it('a long shot their keeper pushes into his own net is from outside the box, not a rebound', () => {
  const w = keeperWorld();
  const watch = createKeeperWatch();
  tick(w, 'shot');
  stepKeeperWatch(watch, w, STEP);
  strikeAt(w, 1000, 64);
  tick(w, null, 'away'); // the push doesn't clear the strike
  stepKeeperWatch(watch, w, STEP);
  expect(goalFacts(w, watch, shot)).toEqual({ outsideBox: true, rebound: false });
});
it('a kick within 2 s of their keeper pushing the ball away is a rebound', () => {
  expect(kickAfterPush(REBOUND_S - 0.1).rebound).toBe(true);
});
it("a kick after 2 s, or after his own keeper's push, is not", () => {
  expect(kickAfterPush(REBOUND_S + 0.1).rebound).toBe(false);
  expect(kickAfterPush(0.5, 'home').rebound).toBe(false);
});
it('with no keepers nothing is from outside the box or a rebound', () => {
  const w = createWorld(BASE_STATS, BASE_STATS, 1, { home: 4, away: 6 });
  expect(goalFacts(w, createKeeperWatch(), shot)).toEqual({ outsideBox: false, rebound: false });
});
```

  `matchScene.test.ts`, on the catalog's School matches. These are real kicks, staged the way the existing goal tests stage Harrison:
  - **Tryout 1, from outside the box.** Harrison has the ball at his feet at x 1000, z 64, facing right. Their keeper is down and out of the way: `act: 'down'`, his body at z 118. He holds X for 0.2 s and lets go. The goal is recorded with `outsideBox: true`, and BONUS DONE! shows after the moment.
  - **Tryout 1, from inside the box.** The same at x 1200 records `outsideBox: false`, and no BONUS DONE! follows.
  - **Tryout 6, a rebound.** Their keeper's profile gets `holdOdds: 0`, and a hard ball (600 px/s) goes straight at him, so he pushes it away. Within 2 s Harrison, with the ball at his feet inside the box, shoots past the keeper lying down. The goal records `rebound: true`, and BONUS DONE! shows.

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/game/keeper.test.ts src/scenes/goalFacts.test.ts src/scenes/matchScene.test.ts`. Expected: FAIL (`goalFacts.ts` is missing, and the strike isn't cleared).

- [ ] **Step 3: Implement.**
  - The strike: `startHold` and `dropKick` set `w.keepers!.strike = null`, and `world.ts` adds `z: w.ball.z` to it.
  - In `matchScene`, `const watch = createKeeperWatch()`.
  - After each `stepWorld`, call `stepKeeperWatch(watch, world, simDt)`.
  - `recordGoal` spreads `goalFacts(world, watch, lastKick)` over Task 1's `false`s.

- [ ] **Step 4: Run the whole suite and the types.** Run `npx vitest run && npx tsc --noEmit`. Expected: PASS, with plan 2's keeper tuning and match tests unchanged. If one moves, the cleared strike has changed a hold's odds. Find which save with `superpowers:systematic-debugging`, and report to the parent before changing anything.

- [ ] **Step 5: Commit**

```bash
git add src/game src/scenes && git status --short
git commit -m "feat: tell a long shot and a rebound from a goal"
```

---

### Task 5: The School Field's layers

**Files:**
- Modify: `src/art/venues/school.ts`, `src/art/venues/school.test.ts`, `src/scenes/matchView.ts` (`drawLayers`), `src/scenes/matchView.test.ts`; `src/art/colors.ts` and `colors.test.ts` only if a colour is added

**Interfaces:**
- Consumes: `pitchGround`, `plot` and `along` (plan 1); `PARALLAX`; `stageFor`.
- Produces:
  ```ts
  // school.ts
  /** The far touchline's row in the big view: the fence and the bleachers stand on it. */
  export const SCHOOL_FAR_SY: number;  // BIG_VIEW.nearSY - SCHOOL_FIELD.depth = 168
  /** Mid and near each cover the big view's whole scroll at their parallax: Math.ceil(PARALLAX[layer] × maxCamX) + 534, maxCamX = 1280 + 128 × DEPTH_SHEAR − 534. */
  export const SCHOOL_MID_W: number;   // 927
  export const SCHOOL_NEAR_W: number;  // 1162
  /** The bleachers on the near layer: their x span and top row. Task 6's crowd sits on them. */
  export const BLEACHERS: { x0: number; x1: number; top: number };
  /** The flagpole on the mid layer: its x and the row of its top. Task 6's flag flies from it. */
  export const FLAGPOLE: { x: number; top: number };
  export function schoolLayers(): VenueLayers;
  ```
  - **`drawLayers` keeps its signature.** It draws the venue it actually has art for (`art.venues[venue] ? venue : 'backyard'`), shifted down by `viewOf(cam).nearSY - stageFor(drawn).view.nearSY` rows. Every layer, and the joggers, use that shift.
  - In a School match the shift is 0. On a small camera the School sits 120 rows higher, so its near touchline lands on row 176. That is where `project` puts the backdrop's juggler and the VS card's pair.

**The look**, from the spec's *The School Field's look* and the approved sketch:
- **References.** `.superpowers/brainstorm/277036-1793245809/sources/autumn-x.png` is the sketch, and `look-mock.mts` beside it has the shapes and colours. Both are gitignored and on this machine only. If they're gone, draw from the spec's description.
- **far** (534×300, tiles): a pale morning sky with a low sun and thin clouds, and a hazy far tree line in muted autumn colours down to the scenery's foot. Opaque.
- **mid:**
  - The two-storey pale-brick school, about mid-layer x 15–300 as in the sketch, so the postcard frames it. It has a flat roof, a canopy over navy doors, and a plain sign with no words or crest.
  - The flagpole, without its flag (Task 6).
  - The yellow bus parked beside the school, and big orange and gold trees.
  - Everything stands on the row above the fence. Transparent in the top rows and below `SCHOOL_FAR_SY`.
- **near:**
  - The chain-link fence along the far touchline, 16 rows standing on `SCHOOL_FAR_SY`, with posts and a top rail like the end fences.
  - Small aluminium bleachers on the far touchline with empty seats (the crowd is Task 6's).
  - Leaves piled along the fence foot. Transparent below `SCHOOL_FAR_SY`.
- **ground:** today's `pitchGround(chainLinkEnd, SCHOOL_FIELD, BIG_VIEW)`, plus fallen leaves scattered over the far part of the pitch (z ≥ 96). The leaves lie on grass pixels only, never on a painted line.

- [ ] **Step 1: Write the failing tests**
  - `school.test.ts` keeps its ground tests. The test 'the far, mid and near layers fill the view or are empty stand-ins' gives way to:
    - **Sizes.** far is 534×300; mid is `SCHOOL_MID_W`×300 and near `SCHOOL_NEAR_W`×300; each covers its scroll, as the interface's formula says.
    - **far** is opaque and tiles without a seam, as `backyard.test.ts` checks.
    - **mid** holds the school's brick and the bus's yellow, as master colours from the sketch, and autumn crown colours (flame, gold). Its top rows are transparent.
    - **near** has chain-link (silver or slate) on the fence rows at three x outside `BLEACHERS`, and aluminium inside `BLEACHERS`.
    - **Scenery never covers the pitch:** mid and near are transparent on every row below `SCHOOL_FAR_SY`, as the Backyard's 'only the ground layer covers the pitch'.
    - **Leaves** in autumn colours lie on the ground at some z ≥ 96, never at z < 64. The line tests still pass.
  - `matchView.test.ts`, with the recorder and `venueArt` fixture already there. `VENUE_ART` gains `school: venueArt('school')` (Task 6 adds its `schoolLife`), so the test 'a venue with no art falls back to the Backyard' moves from `'school'` to `'stadium'`.

```ts
it('a venue drawn on a camera of another size shifts so the near touchlines meet', () => {
  const layerYs = (cam: Camera, venue: VenueId) => {
    const { g, drawn } = recorder();
    drawLayers(g, cam, VENUE_ART, venue);
    return new Set(drawn.filter(d => /\/(far|mid|near|ground)$/.test(d.name)).map(d => d.y));
  };
  expect(layerYs({ x: 0 }, 'school')).toEqual(new Set([-120]));
  expect(layerYs({ x: 0, view: BIG_VIEW }, 'school')).toEqual(new Set([0]));
  expect(layerYs({ x: 0 }, 'park')).toEqual(new Set([0]));
  expect(layerYs({ x: 0 }, 'stadium')).toEqual(new Set([0])); // no art: the Backyard, unshifted
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/art/venues/school.test.ts src/scenes/matchView.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the layers and the shift.

- [ ] **Step 4: Run the tests, then look at it.**
  - Run `npx vitest run && npx tsc --noEmit`. Expected: PASS.
  - Write a scratch tsx script in the scratchpad, after `tools/render-keepers.ts`. It composites the four layers at camera x 0, 400 and 784 (parallax as `drawLayers`) into 534×300 PNGs, ×2, with `tools/png.ts`.
  - Read them beside `autumn-x.png`. Check the sky and tree line read as morning, the brick as pale, and the bus as a bus. Check the fence and bleachers sit on the far touchline and nothing on the school looks like words.

- [ ] **Step 5: Commit**

```bash
git add src/art src/scenes && git status --short
git commit -m "feat: draw the School Field on an autumn morning"
```

---

### Task 6: The School Field's life, and stills to the parent

**Files:**
- Create: `src/art/venues/schoolLife.ts`, `src/art/venues/schoolLife.test.ts`, `src/scenes/schoolView.ts`, `src/scenes/schoolView.test.ts`, `src/audio/goalCrowd.ts`, `src/audio/goalCrowd.test.ts`
- Modify: `src/scenes/art.ts` (`GameArt.schoolLife`), `src/scenes/matchView.ts` (`drawLayers` draws the life; `cheer`), `src/audio/cues.ts` (`'cheer'`), `src/audio/synth.ts` (`CrowdLevel`), `src/scenes/matchScene.ts` (the venue's goal crowd)
- Test: `src/scenes/matchView.test.ts`, `src/scenes/matchScene.test.ts`, `src/audio/cues.test.ts`, `src/audio/synth.test.ts`

**Interfaces:**
- Consumes: `BLEACHERS`, `FLAGPOLE`, `SCHOOL_FAR_SY` (Task 5); `drawLayers`' shift.
- Produces:
  ```ts
  // schoolLife.ts (master ids, like every venue's art)
  /** The crowd's box on the near layer, its top-left: on the bleachers. */
  export const CROWD_AT: { x: number; y: number };
  /** Kids and parents on the bleachers, each frame the box's size: two bob frames, and two cheering ones (on their feet, arms up). */
  export function crowdFrames(): { bob: readonly [IndexedImage, IndexedImage]; cheer: readonly [IndexedImage, IndexedImage] };
  /** The flag's top-left on the mid layer, at the flagpole's top. */
  export const FLAG_AT: { x: number; y: number };
  export const FLAG_FRAMES = 3;
  /** A plain striped flag rippling. */
  export function flagFrames(): IndexedImage[];
  export interface Leaf { color: MasterColor; startX: number; y: number; speed: number; swayPx: number; swayS: number }
  /** Four or five leaves drifting across, in the School's art rows; x in screen px, wrapping over the view's width. */
  export const LEAVES: readonly Leaf[];
  /** One leaf's two tumble frames, about 3×3 px. */
  export function leafFrames(color: MasterColor): readonly [IndexedImage, IndexedImage];
  // art.ts
  export interface SchoolLifeCanvases {
    crowd: { bob: readonly [HTMLCanvasElement, HTMLCanvasElement]; cheer: readonly [HTMLCanvasElement, HTMLCanvasElement] };
    flag: readonly HTMLCanvasElement[];
    leaves: readonly (readonly [HTMLCanvasElement, HTMLCanvasElement])[]; // one per LEAVES entry
  }
  GameArt.schoolLife: SchoolLifeCanvases;
  // schoolView.ts
  export const CROWD_FPS = { bob: 2, cheer: 6 } as const;
  export const FLAG_FPS = 6;
  export const LEAF_FPS = 4;
  /** Where drawLayers put the School's layers this frame: the mid and near layers' left edges, the rows they shifted by, the view's width. */
  export interface LayerAt { midX: number; nearX: number; dy: number; viewW: number }
  export function drawFlag(g: CanvasRenderingContext2D, life: SchoolLifeCanvases, at: LayerAt, nowS: number): void;
  export function drawCrowd(g: CanvasRenderingContext2D, life: SchoolLifeCanvases, at: LayerAt, nowS: number, cheer: boolean): void;
  export function drawLeaves(g: CanvasRenderingContext2D, life: SchoolLifeCanvases, at: LayerAt, nowS: number): void;
  // matchView.ts
  export function drawLayers(g, cam, art, venue: VenueId = 'backyard', nowS = 0, cheer = false): void;
  // synth.ts
  export type CrowdLevel = 'off' | 'low' | 'match' | 'cheer' | 'roar';  // CROWD_GAIN.cheer 0.25: a bleacher crowd, quieter than the roar
  // goalCrowd.ts
  /** How a venue's crowd greets Harrison's goal: the cue, and the level the crowd swells to. The School's bleachers cheer; everywhere else roars as before. */
  export function goalCrowd(venue: VenueId): { cue: Cue; level: CrowdLevel };
  ```
  - **Drawing order** at the School: far, mid, `drawFlag`, near, `drawCrowd`, ground, `drawLeaves`. Everything is behind the players, and scenery never touches play.
  - **`drawMatch`** passes `cheer = hud.moment !== null`. The crowd cheers for Harrison's goals, as the roar does today; an away goal still groans.
  - **The `cheer` cue**, by design and not by ear: a shorter, brighter noise swell than the roar, with a few claps, at under the roar's gain.
  - **`matchScene`** plays `goalCrowd(match.venue).cue` wherever feedback or the hat-trick plays `'roar'`, and sets its `level` wherever it set `'roar'`: the goal, and resuming from pause mid-moment.

- [ ] **Step 1: Write the failing tests**
  - **`schoolLife.test.ts`:**
    - **The crowd.** All four frames are one size. The box sits on the bleachers, inside `BLEACHERS`' x span and wholly above `SCHOOL_FAR_SY`. The two bob frames differ, and each cheer frame has opaque pixels above the bob frames' topmost opaque row (arms up).
    - **The flag.** `FLAG_FRAMES` frames, all one size, no two alike, with at least two colours. `FLAG_AT` sits within 1 px of `FLAGPOLE`'s x and its top.
    - **The leaves.** `LEAVES` has 4–5 entries in at least 3 colours, and each `leafFrames` pair is two different frames of at most 4×4.
  - **`schoolView.test.ts`**, with a recorder like `matchView.test.ts`'s:
    - **`drawCrowd`** draws at `(at.nearX + CROWD_AT.x, CROWD_AT.y + at.dy)`. Its bob frames alternate at `CROWD_FPS.bob`, and its cheer frames show only while `cheer`.
    - **`drawFlag`** draws at `(at.midX + FLAG_AT.x, FLAG_AT.y + at.dy)`, and its frame advances at `FLAG_FPS`.
    - **`drawLeaves`** draws each leaf once per call with x in `[0, at.viewW)`. Their x changes over time, and each y stays within `leaf.y + at.dy ± leaf.swayPx`.
  - **`matchView.test.ts`:**
    - At `'school'` the life draws in the order above (give `VENUE_ART` a `schoolLife` of named canvases).
    - With `cheer` true a cheer frame is drawn.
    - `drawMatch` on a School world with `hud.moment` set draws `art.schoolLife.crowd.cheer.*` (fakeArt's names). Without it, a bob frame is drawn.
  - **`matchScene.test.ts`:**
    - At a School match Harrison's goal plays `'cheer'`, never `'roar'`. `ctx.audio.crowd` is `'cheer'` through the moment and `'match'` after it.
    - Backyard matches still play `'roar'` (the existing tests).
  - **`goalCrowd.test.ts`:** `school` gives `{ cue: 'cheer', level: 'cheer' }`; `backyard` and `park` give `{ cue: 'roar', level: 'roar' }`.
  - **`cues.test.ts` and `synth.test.ts`:** `'cheer'` exists with its peak gain under the roar's, and `CROWD_GAIN.match < CROWD_GAIN.cheer < CROWD_GAIN.roar`.

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/art/venues src/scenes src/audio`. Expected: FAIL (the modules are missing).

- [ ] **Step 3: Implement** the interfaces above. The crowd is varied in skin, hair and tops, in existing master colours, and it bobs, never marches in step. The flag is plain stripes, with no emblem.

- [ ] **Step 4: Run the whole suite, the types and the build.** Run `npx vitest run && npx tsc --noEmit && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/art src/scenes src/audio && git status --short
git commit -m "feat: bring the School Field's crowd, flag and leaves to life"
```

- [ ] **Step 6: Stills of the venue, to the parent alone**
  - **The harness.** Before starting a dev server, check `ss -ltnp | rg 5179`. In the page, use the harness from the dev-environment notes:
    - `createMatchScene` for `matchById('school-1')`, on an in-memory context: `createSaveSlots` over a plain object store, with no-op audio and rumble;
    - `loadGameArt()`;
    - stepped by hand with built InputFrames, and drawn onto a 534×300 canvas;
    - each frame POSTed as a PNG to a 127.0.0.1:5181 receiver, saving to `preview/school/` (gitignored).
  - **Four stills:**
    1. the kickoff at the centre spot;
    2. Harrison attacking the right goal, their keeper set and the bleachers in view;
    3. his goal, with the crowd cheering;
    4. Steady Eddie's end, with the school and the bus behind.
  - **Check them.** Scale each ×2 nearest-neighbour with plain `python3` PIL and Read it. Fix anything that clashes: a crowd lost against the bleachers, a leaf that reads as the ball, anything on the school that looks like words.
  - **Send them** with `SendUserFile`. Say they're for the parent only, because Harrison wants to be surprised, and that the opponent is Max standing in until plan 4. Ask for approval.
  - **While waiting,** Tasks 7–9 go on. On request, redraw and resend. Note the verdict in the status memory note. Nothing merges with unapproved art.

---

### Task 7: Tryouts on the venue screen and the VS card

**Files:**
- Modify: `src/scenes/venueScene.ts` (`panelLines`; export `PANEL_TEXT_W`), `src/scenes/vsScene.ts` (`vsLines`)
- Test: `src/scenes/venueScene.test.ts`, `src/scenes/vsScene.test.ts`

**Interfaces:**
- Consumes: `Venue.words` and `SCHOOL` (Task 2); the shifted backdrop (Task 5).
- Produces:
  - `panelLines(match)`'s title is the boss's `name`, or `${words.match} ${rung} - ${name}` for every other match.
  - `vsLines(match, p)`'s title is `words.boss` for a boss, or `${words.match} ${rung}`.
  - `PANEL_TEXT_W = HINT_RIGHT - PANEL_TEXT_X`, the panel text's width (274).

- [ ] **Step 1: Write the failing tests**
  - **`venueScene.test.ts`:**
    - `panelLines(school-3)` is `['TRYOUT 3 - LOFTY LOLA', 'SHE CHIPS ANY KEEPER OFF HIS LINE.', 'BONUS: SCORE FROM A CHIP']`.
    - Gus's lines are `['GOALIE GUS', 'THE CAPTAIN. HE FILLS THE WHOLE GOAL.', 'BONUS: PUT 3 PAST GUS']`.
    - The Park's `park-2` and the Backyard's `backyard-1` lines are unchanged.
    - **Every School line fits.** For every School match: `measureText(title, 2) + 2 <= PANEL_TEXT_W`, and each other line `measureText(line) + 2 <= PANEL_TEXT_W` (Review Focus 3).
    - **The nodes.** `[1…8].map(n => nodeX(matchById(\`school-${n}\`)!))` is `[16, 47, 78, 109, 139, 170, 201, 232]`: one row, spread over the Backyard's span, clear of each other's cursor ring and of the boss node.
    - **Drawing**, after Sam, at the School:
      - the venue draws `art.venues.school.layers.far` behind it, and `SCHOOL FIELD` and `STARS 0/27`;
      - the boss node draws Max's face as a silhouette (the stand-in) until tryout 8 is passed.
    - **A press.** A on tryout 1 opens its VS card; A on tryout 2 blips.
  - **`vsScene.test.ts`:**
    - `school-3`'s lines are `['TRYOUT 3', 'HARRISON VS LOFTY LOLA', 'BONUS: SCORE FROM A CHIP']`. The card draws `art.venues.school.layers.far` and Max's idle sprite, the stand-in.
    - Gus's lines are `['THE SCHOOL BOSS', 'HARRISON VS GOALIE GUS', 'BONUS: PUT 3 PAST GUS']`, and his card plays `bossSting`.
    - After a loss to Gus there are still three lines: his tip is plan 5's.
    - The Park's and the Backyard's cards are unchanged.

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/scenes/venueScene.test.ts src/scenes/vsScene.test.ts`. Expected: FAIL on the TRYOUT and THE SCHOOL BOSS titles.

- [ ] **Step 3: Implement** the interfaces above.

- [ ] **Step 4: Run the scene tests and the types.** Run `npx vitest run src/scenes && npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes && git status --short
git commit -m "feat: call the School Field's matches tryouts"
```

---

### Task 8: Results, the Hub and Help at the School

**Files:**
- Modify: `src/scenes/resultsScene.ts` (`careerLine`), `src/scenes/helpScene.ts`
- Test: `src/scenes/resultsScene.test.ts`, `src/scenes/hubScene.test.ts`, `src/scenes/helpScene.test.ts`

**Interfaces:**
- Consumes: `Venue.words` (Task 2).
- Produces:
  - `careerLine`, for a first win:
    - at a boss: `${hudName} BEATEN! ${words.done}`;
    - at the last numbered match of a venue with a boss: `${boss name} AWAITS!`, as today;
    - at any other numbered match: `${words.match} ${rung} ${words.beaten}`.

    Everything else is unchanged.
  - Help's THE MATCH page gains `FROM THE SCHOOL FIELD ON, A KEEPER GUARDS EACH GOAL.` as its third-from-last line, so Biscuit's and Sam's lines stay last. Plan 5 adds Gus's line after Sam's.

- [ ] **Step 1: Write the failing tests**
  - **`resultsScene.test.ts`, `careerLine`:**
    - a first win at `school-3` gives `TRYOUT 3 PASSED!`;
    - at `school-8`, `GOALIE GUS AWAITS!`;
    - over Gus, `GUS BEATEN! YOU MADE THE TEAM!`;
    - an improved replay of `school-2` at 3 stars, `NEW BEST: 3 STARS!`;
    - a loss at `school-3`, `LOLA TAKES THIS ONE. GO AGAIN!`;
    - the Park's `MATCH 1 BEATEN!` and `SAM BEATEN! THE PARK DONE!`, unchanged.
  - **`resultsScene.test.ts`, the menu** (Review Focus 1):
    - After a first win over Sam, NEXT MATCH starts `school-1`'s VS card.
    - After the first win at `school-8`, it starts Gus's.
    - After the first win over Gus the items are `['CAREER', 'SHOP', 'HUB']`, and CAREER opens the road map with the cursor on the School.
  - **`hubScene.test.ts`:**
    - A profile with tryouts 1–2 passed draws `NEXT: LOFTY LOLA - SCHOOL FIELD 3/8` and Lola's blurb.
    - With Gus beaten it draws `YOU MADE THE TEAM! STARS n/27` and `STATE: COMING SOON`.
  - **`helpScene.test.ts`:** THE MATCH page holds the keepers' line, with Biscuit's and Sam's lines still last. The existing check that every help line fits and uses only font characters covers the new line.

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/scenes/resultsScene.test.ts src/scenes/hubScene.test.ts src/scenes/helpScene.test.ts`. Expected: FAIL on PASSED!, YOU MADE THE TEAM! and the Help line.

- [ ] **Step 3: Implement** the interfaces above.

- [ ] **Step 4: Run the scene tests and the types.** Run `npx vitest run src/scenes && npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes && git status --short
git commit -m "feat: lead Results, the Hub and Help into the School"
```

---

### Task 9: Every tryout plays, with Max standing in

**Files:**
- Modify: `src/scenes/matchScene.ts` (doc comment only: the School's opponents are Max standing in)
- Test: `src/scenes/matchScene.test.ts`

**Interfaces:**
- Consumes: the catalog's School matches (Task 2); plan 2's `keeperLevel`, `keeperLineup` and `keeperLooks`.
- Produces: nothing new. This task pins the venue playing end to end.

- [ ] **Step 1: Write the tests**

```ts
describe('the School Field, with Max standing in', () => {
  it('every tryout and Gus build Max at the ladder stats, on the big pitch with keepers', () => {
    for (const m of SCHOOL.matches) {
      const s = createMatchScene(testContext({ profile: { ...newProfile(), difficulty: 'hard' } }), 3, m);
      expect(s.size, m.id).toBe(BIG_VIEW);
      expect(s.world.field).toBe(SCHOOL_FIELD);
      expect(s.world.away.stats).toEqual(maxStats(m.rung)); // Gus's slot, rung 0, clamps to rung 1's
      expect(s.world.maxProfile).toBe(DIFFICULTY.hard);
      expect(s.hud.awayName).toBe(m.hudName);
      expect([s.world.keepers!.home.profile, s.world.keepers!.away.profile]).toEqual([keeperProfile(keeperLevel(m), 'normal'), keeperProfile(keeperLevel(m), 'hard')]);
      expect(keeperLooks(m).away).toBe(m.kind === 'match' && m.rung % 2 === 1 ? 'backupA' : 'backupB');
      expect(clockText(s.world.match).text).toBe('2:00');
    }
  });

  it('a tryout plays to full time and pays out, whatever the score', () => {
    const ctx = testContext({ profile: PARK_DONE_PROFILE });
    const s = createMatchScene(ctx, 5, matchById('school-1')!);
    let next: Scene | null = null;
    for (let i = 0; i < 200 * 60 && !next; i++) next = s.update(frame(), STEP);
    expect(next?.kind).toBe('results');
    expect(ctx.profile.totals.matches).toBe(1);
    const r = s.reward!.summary.result;
    if (r === 'win') expect(ctx.profile.career.stars['school-1']).toBeGreaterThanOrEqual(1);
    if (r === 'lose') expect(ctx.profile.career.lossStreaks['school-1']).toBe(1);
  });
});
```
  `PARK_DONE_PROFILE` is a profile with Sam beaten: the same stars as Task 2's `PARK_DONE`.

  An idle Harrison is enough for the full-time test: the clock runs out, and golden goal ends in a result or a draw. If 200 s of play ever ends without Results, that's a bug to find, not a limit to raise.

- [ ] **Step 2: Run them.** Run `npx vitest run src/scenes/matchScene.test.ts`. Expected: PASS with no source change, because the catalog's `opponent: 'max'` and plan 2's keepers already do it. A failure here is a real gap. Fix it in the scene, with `superpowers:systematic-debugging` if it isn't obvious.

- [ ] **Step 3: Measure the stand-in, for information** (see *Max standing in*).
  - Write a scratch tsx script in the scratchpad that copies `keeperMatch` from `keeperScripts.ts`, with the away side's stats set to `opponentStats('max', rung)`. It plays the scripted Harrison at `DRILL_STATS` against Max on Normal, with `keeperLineup(keeperLevel(m), 'normal')`, on seeds 100–131.
  - Run it for tryout 1, tryout 8 and Gus's slot.
  - Note Harrison's wins, draws and losses, and the mean goals a side, for As built and the parent. There is no band, and nothing is tuned.

- [ ] **Step 4: Commit**

```bash
git add src/scenes && git status --short
git commit -m "test: play every tryout with Max standing in"
```

---

### Task 10: Browser check, the screens' stills, review and As built

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-school-field-design.md` (a new "As built: plan 3" section)

- [ ] **Step 1: Run everything.** Run `npx vitest run && npx tsc --noEmit && npm run build`. Expected: PASS. Note the test count.

- [ ] **Step 2: Walk the career in the live loop.**
  - **Setup.** Use the dev server and the live-loop technique from the dev-environment notes (swap scenes in, feed scripted InputFrames). The profile has Sam beaten and lives in an in-memory context or spare slot 5. It must never be Harrison's save.
  - **The walk:**
    1. The Hub reads `NEXT: MAX - SCHOOL FIELD 1/8`.
    2. CAREER opens the road map: six stops, the cursor on the School's postcard, `STARS n/156`.
    3. The venue screen shows SCHOOL FIELD, `STARS 0/27`, eight nodes, and the juggler on the School's grass.
    4. The VS card says TRYOUT 1.
    5. The match runs at 3×, crisp, through pause and resume, and a staged win at full time.
    6. Results says `TRYOUT 1 PASSED!`, and NEXT MATCH leads to tryout 2's card.
  - **Then the end.** With a profile at tryout 8 passed: Gus's card, a staged win, `GUS BEATEN! YOU MADE THE TEAM!`, then CAREER. STATE reads COMING SOON and blips.
  - **The save code screen** shows the longest code in five small lines, clear of the status line.

- [ ] **Step 3: Stills of the screens, to the parent alone.**
  - Draw pixel-exact 320×180 stills of the road map, the venue screen and the VS card with the School on them, by the dev notes' canvas-and-receiver method.
  - Read them. Check the text fits, the juggler and the VS pair stand on the grass, and the postcard shows the school.
  - Send them with `SendUserFile` to the parent alone, as in Task 6. Add the Hub and Results stills to the report only if something there looks off.

- [ ] **Step 4: A fresh review.** Use `superpowers:requesting-code-review`, with a fresh reviewer on the most capable model, on this plan's commits (f715522..HEAD). Fix its Critical and Important findings, each with a test. Its minors are deferred, and listed in As built.

- [ ] **Step 5: Write "As built: plan 3"** in the spec. Record what this plan chose and why:
  - the venue words, and the blurbs shortened for the Hub;
  - `TOTAL_STARS` 156;
  - the six-stop layout and the postcard rule;
  - `drawLayers`' shift;
  - the life: crowd, flag and leaves, cheering only for Harrison's goals;
  - the `cheer` cue and level, by design;
  - v7, with the longest code and `MAX_ENTRY`;
  - the wave counting for neither new bonus;
  - the stand-in's measured numbers;
  - the parent's verdict on the stills;
  - the review's fixes and deferred minors;
  - the test count.

  Then the notes for plans 4–5:
  - the School matches' `opponent` fields to change;
  - `opponentStats` will need the venue, for Max and Tia to come back tougher;
  - Gus's slot is rung 0;
  - Gus's tip, Help line and sting are still to do.

- [ ] **Step 6: Commit, update the memory note, and stop.**

```bash
git add docs/superpowers/specs/2026-10-28-school-field-design.md && git status --short
git commit -m "docs: record the School Field as built"
```

  Update the status memory note: plan 3 is built at its commit, with the parent's verdict on the stills, and plan 4 comes next in a fresh session. Then report to the parent. Ask before any merge into `main` or any push; this plan does neither.
