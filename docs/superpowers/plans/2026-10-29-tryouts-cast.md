# The tryouts cast (7c, plan 4 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The eight School Field tryouts get their real opponents. Max and Tia come back tougher, and six new kids (Header Hank, Lofty Lola, Fake-Out Finn, Poacher Priya, Nutmeg Niko, Pinpoint Paige) each play their own way. Every kid is measured in CI against today's keepers. The cast's sheet and GIF go to the parent alone. Gus's slot is left for plan 5.

**Architecture:**
- **Who plays.** `tryouts.ts` holds the eight tryout opponents' stats and difficulty profiles, as `crew.ts` does for the Park. `opponentStats` and `opponentProfile` take an optional venue. At the School, Max and Tia read their tougher School entries. Without a venue, and everywhere else, they read exactly what they read today.
- **How they play.** Each new kid has a `Style`, and each personality lives in its own module (`hank.ts`, `lola.ts`, `finn.ts`, `priya.ts`, `niko.ts`, `paige.ts`). `ai.ts` changes in three places only:
  - a kid's own play with the ball at its feet;
  - its own play for a loose ball;
  - a move under way, played out tick by tick as Tia's fake already is.
  
  Today's styles never reach any of it. Two world rules are new: Finn's fake shot (`PlayerIntent.feint`) and Niko's nutmeg (`Ball.through`, started by `PlayerIntent.nutmeg` and checked by the world).
- **How they're measured.** `tryoutScripts.ts` plays whole School matches, with keepers at the tryout's level, against a scripted School Harrison. He is the Park's scripted Harrison plus placed shots and follow-ups. `describeTryout` builds each kid's band and personality tests, one test file per kid, so the files run in parallel.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 4, Canvas 2D, Node 20, tsx; plain `python3` with PIL for scaling stills and the GIF.

**Spec:** `docs/superpowers/specs/2026-10-28-school-field-design.md`. Read:
- *The cast: the fair rules*, *The cast*, *Measuring the cast*;
- *Art and approval*, *Constraints*, *Left to the builder*;
- plan 4's bullet in *Plans and release*;
- *As built* for plans 1–3, above all plan 3's notes for plans 4–5;
- *Amended after the parent's first playtest: softer keepers*, which also records the shorter drop kicks and the 68-deep goals.

## Global Constraints

- **The Backyard and the Park play and read exactly as before.** Every existing tuning test, AI-vs-AI test and the no-kit parity test passes unchanged, and so do every Backyard and Park screen test. Task 1 records today's measured rates and Task 11 checks them number for number. Only the pins of the School stand-in move to the new truth: `matchScene.test`'s "every tryout and Gus build Max at the ladder stats" and `career.test`'s "every School opponent is Max".
- **The keepers don't move.** No `KEEPER_LEVELS` dial changes. `keeperTuning.test.ts` and every keeper, drill and match test pass unchanged. Task 5 moves `judgedChip` and Task 2 moves the drills' open-side rule into a shared module, and the drills must give identical outcomes. If one doesn't, stop and find out why.
- **Every kid keeps every fair rule** (the fair-Max and Park specs are the authority):
  - Harrison's steal, with the kid's own clean-steal odds;
  - the wrong-footed beat after a clean steal;
  - the kickoff hold and the keep-out zone;
  - Harrison's sideways slide clear and drag-back;
  - backing off a powered-up Harrison with `braceSense` and `backOffS`;
  - being fooled by his tricks;
  - Easy, Normal and Hard.
  
  These come from `think`'s chain ahead of any personality. A personality's move must yield to them (Task 4). Every Easy dial is gentler than Normal's, and every Normal dial gentler than Hard's (pinned in Task 1). None of the kids has a power move.
- **The bands.** These are on fixed seeds 100–163, with the scripted School Harrison a level up on each kid's stats:
  - Easy 0.7–0.9;
  - Normal 0.5–0.7;
  - Hard ≤ 0.1, the Park's ceiling, set from Max's measured Hard;
  - Easy ≥ Normal ≥ Hard;
  - every match ends with a result, the ball never sits still for more than 4 s, and no body ever stands in a goal or behind a net.
- **The STOP rule.** If a kid can't meet the bands without breaking their personality, stop and send the parent the numbers. Don't widen a band. Don't move a keeper dial, the School script or a stat.
- **On-screen text.** This plan adds no lines: the names, HUD names, blurbs and bonuses exist since plan 3. Any line that does get added uses only uppercase letters, digits and `' - : ! ? . , / + < >`, with no parentheses, and is measured against its slot.
- **Assets and likeness.** No image, audio or font files. No surname anywhere. The kids are made up.
- **Palette.** Task 3 adds three kit ramps (nine colours). It moves the cap in `colors.test.ts` from 70 to 79 on purpose, with a comment naming the tryouts.
- **Saves.** No change. Match ids are unchanged, profile v7 and the save code are unchanged, and opponent ids are never saved.
- **Approvals.** The cast's sheet (Task 3) and GIF (Task 9) go to **the parent alone** with `SendUserFile`, because Harrison wants to be surprised. So do any stills of the kids. Nothing merges with unapproved art. The art gates the merge, not the next task, as in the Park. This plan ends on the branch: no merge into `main`, no push.
- **Git.** Work on `plan-7c-school-field` (a8b8a05 plus this plan's commit). Run `git status --short` before every commit. Commits follow Conventional Commits, 50/72, with no AI attribution trailers.
- **Commands.** Run everything from the project root:
  - one file: `npx vitest run <file>`
  - the whole suite: `npx vitest run`
  - the types: `npx tsc --noEmit`
  - the build: `npm run build`
- **Ledger.** Keep rulings and measured numbers in `.superpowers/sdd/2026-10-29-tryouts-cast/progress.md` (gitignored). They go into As built in Task 11.
- **Deferred minors.** Plans 1–3's deferred minors stay deferred.

## The calls this plan makes

The parent approves these with the plan. Each is the builder's per the spec unless marked.

- **The venue rule.** `opponentStats(id, rung, venue?)` and `opponentProfile(id, d, venue?)`:
  - At `'school'`, `'max'` and `'tia'` read `TRYOUT_STATS` and `TRYOUT_PROFILES`.
  - Everything else reads as today.
  - **Gus's slot**, still `opponent: 'max'` at the School, plays the School Max from now on, not rung-1 Max. It stays a stand-in, and plan 5 replaces it. Its catalog field is untouched.
- **Stats.** Each kid is one stat level stronger overall than the one before (Speed + Power + Jump + Control). The cast starts four levels above rung-10 Max (4/4/2/3), and every kid has one standout stat. Everyone plays at Stamina 1. Tuning moves profile dials, never stats.

  | Tryout | Kid | Speed | Power | Jump | Control | Total | Standout |
  |---|---|---|---|---|---|---|---|
  | 1 | MAX | 5 | 5 | 3 | 4 | 17 | all-round |
  | 2 | HANK | 4 | 4 | 7 | 3 | 18 | Jump |
  | 3 | LOLA | 5 | 5 | 3 | 6 | 19 | Control |
  | 4 | FINN | 7 | 5 | 3 | 5 | 20 | Speed |
  | 5 | TIA | 6 | 4 | 3 | 8 | 21 | Control (Park: 5/3/2/6) |
  | 6 | PRIYA | 8 | 5 | 3 | 6 | 22 | Speed |
  | 7 | NIKO | 6 | 5 | 3 | 9 | 23 | Control |
  | 8 | PAIGE | 6 | 9 | 3 | 6 | 24 | Power (and aim, by profile) |

- **Looks.** Skin tones are two each of the light, tan and brown already in the palette. The new kit ramps are olive, cocoa and plum. There is no gold kit in an even tryout: backup June's lemon top is in that goal. Every look can change at the sheet.

  | Kid | Skin | Hair | Kit |
  |---|---|---|---|
  | HANK | brown | short black hair, high on top | white jersey, charcoal shorts; drawn two pixels taller (`HANK_BODY`) |
  | LOLA | light | brown bob with a fringe | gold jersey, white shorts |
  | FINN | tan | sandy fringe swept over one eye | black jersey with gold trim |
  | PRIYA | tan | long black braid | olive jersey, white trim (new ramp) |
  | NIKO | light | dark curly top, short sides | cocoa jersey, white trim (new ramp) |
  | PAIGE | brown | two black puffs | plum jersey, white trim (new ramp) |

- **The School Harrison** (the yardstick every kid is measured against) is the Park's scripted Harrison at a shooting range of 200, with two changes:
  - **He places his shots.** His aim is the corner away from their keeper, set on every tick of his charge, including the one he lets go. The aim is read on the release tick.
  - **He follows up.** Within 2 s of their keeper's push, a ball at his feet within 180 px of the line is struck at once.
  
  He is frozen once Task 2 has measured School Max.

  A probe at a8b8a05 (32 seeds) played School Max's stats on Max's own dials against him, with keepers at level 1. It measured Easy .69, Normal .53, Hard .06 with placement, and .75/.56/.13 without. So the bands are within reach on today's keepers.
- **Personality definitions:**
  - **Niko's "square and still."** Harrison is facing Niko, on his feet, slower than 8 px/s, and not winding up, sliding, turning or in a trick. He is 26 px or less ahead in Niko's lane, with the ball within 4 px of his line. **"Side-on"** means facing the way Niko runs. The nutmeg is a world rule, so no brain can nutmeg a Harrison who isn't square and still. Only Harrison's outfield body lets the ball through, never his keeper's.
  - **Finn's fake shot** is a real wind-up he lets go without a kick, so Harrison's steal works on it like any wind-up. He shapes only with Harrison ahead in his lane.
  - **Tia's fake** ends in a shot through an optional profile field (`fakeShot`). The field is absent from the Park's profiles, so Park Tia is untouched.
  - **Priya** lingers: while Harrison has the ball, she stays no more than 160 px into her own half.
  - **Paige** sets herself for 0.3 s, aims at the corner away from Harrison's keeper, and never winds up with Harrison in her line.
- **Tricks.** Every new style fools like Max (`TRICK_SCALE` ×1), and School Tia keeps the dribbler's ×0.6.
- **The GIF** is Niko's nutmeg, the most novel thing on screen. It is drawn by the real match scene in the page, as the keepers' GIF was.
- **No new sound, callout, Help line or tip.** The spec names none for the tryouts, and Gus's are plan 5's.
- **The keep-out zone stays 150 px at the School.** It lies inside the 110-deep box's reach, where Harrison's keeper now stands. Each kid's kickoff spot and shooting range start from Max's and move only by tuning.
- **"Each stronger than the last"** is logged in Task 11, not pinned, as in the Park.
- **A fresh reviewer** ends this plan, as in plans 2 and 3. The release review stays plan 5's.

## Tuning a kid (every kid's task follows this)

1. **Run the kid's tuning file** to see where they sit. It is `describeTryout(id, personality)`, ~256 School matches, about 40 s locally at ~150 ms a match.
2. **Sweep `TRYOUT_PROFILES[id][d]` at runtime** from a scratch `npx tsx` script in the scratchpad. Mutate the object, then play `tryoutMatch(id, d, seed)` over `TRYOUT_SEEDS`.
   - Move the shared dials first: `reactionS`, `aimErrorDeg`, `aggression`, `cleanSteal`, `wrongFootedS`, `paceFactor`, `shootRange`, `kickoffSpot`.
   - Then the kid's own module constants, if the personality needs it. Record which in the ledger.
   - A personality dial that must differ by difficulty becomes an optional `AiProfile` field, absent from every existing profile.
3. **Keep Easy gentler than Normal, and Normal than Hard** (Task 1's test).
4. **Never move** a keeper dial, `SCHOOL_SCRIPT`, a stat or a band. If the bands and the personality can't both be met, follow the STOP rule. Send the parent the E/N/H rates, the personality measure and the dials tried, and wait.
5. **Write the values into `tryouts.ts`** with a comment giving the measured rates and the personality numbers, as `crew.ts` does.

## Review Focus

1. **A difficulty change mid-match at the School.** `backHere` re-reads the profile when Options changes the difficulty. Without the venue it would turn School Max into Backyard Max, and School Tia into Park Tia, mid-tryout. Expected: the tryout keeps its School profile at the new difficulty. Pinned in Task 1.
2. **Kits that clash.** A Harrison kit can share a family with a kid's kit: white with Hank, black or black-gold with Finn, gold with Lola, purple with Paige. A kid's top can also look like the keeper in their goal. Expected:
   - the kid changes kit whenever the families match;
   - no kit uses a keeper top's colours;
   - no gold-family kit plays in an even tryout, opposite backup June's lemon.
   
   Pinned in Task 3.
3. **A nutmeg that shouldn't happen, or one that never ends.** Cases:
   - Harrison moving, facing away, sliding, winding up, in a trick or fallen;
   - a ball heading at his keeper;
   - a `through` flag that survives a goal and kickoff, so a later ball passes through him.
   
   Expected: no nutmeg in any of these. His keeper always plays the ball, and the flag is gone after the ball clears him, after 0.4 s, or at any kickoff. Pinned in Task 9.
4. **A move left running when play changes.** Harrison powers up, a keeper catches the ball, a goal goes in, or his clean steal robs the kid mid-move. Expected: the move ends that tick. The kid never plays a held ball, never challenges a powered-up Harrison, and never stands frozen in a stale move. Pinned in Task 4.
5. **A kid who stalls.**
   - Paige waits for a clear look while Harrison stands in her line.
   - Finn shapes over and over at a Harrison who never moves.
   - Hank waits under a ball that a keeper has caught.
   
   Expected: each plays on within a second or so, and the ball never sits still long. Pinned in Tasks 4, 6 and 10, and in every kid's tuning file (`longestStillS ≤ 4`).

---

### Task 1: Max and Tia come back tougher

**Files:**
- Create: `src/game/tryouts.ts`, `src/game/tryouts.test.ts`
- Modify:
  - `src/game/opponents.ts`: the venue.
  - `src/meta/career.ts`: `tryout()` takes an opponent; tryout 5 becomes `'tia'`.
  - `src/scenes/matchScene.ts`: `match.venue` in both lookups and in `backHere`; the stand-in comment.
- Test: `src/game/opponents.test.ts`, `src/scenes/matchScene.test.ts`, `src/meta/career.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // tryouts.ts
  export type TryoutKidId = 'hank' | 'lola' | 'finn' | 'priya' | 'niko' | 'paige';
  /** Who plays a tryout: Max and Tia at their School best, and the six new kids. */
  export type TryoutOpponent = 'max' | 'tia' | TryoutKidId;
  /** In tryout order, 1 to 8. */
  export const TRYOUT_ORDER: readonly TryoutOpponent[] = ['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige'];
  export const TRYOUT_STATS: Readonly<Record<TryoutOpponent, Readonly<Stats>>>;      // the table above
  /** Mutable like DIFFICULTY, for headless sweeps; every entry its own object. */
  export const TRYOUT_PROFILES: Record<TryoutOpponent, Record<Difficulty, AiProfile>>;
  // opponents.ts
  export function opponentStats(id: HumanOpponentId, rung: number, venue?: VenueId): Stats;
  export function opponentProfile(id: HumanOpponentId, d: Difficulty, venue?: VenueId): AiProfile;
  ```
- Starting profiles:
  - `max`: copies of `DIFFICULTY[d]`.
  - `tia`: copies of `CREW_PROFILES.tia[d]`.
  - the six kids: copies of `DIFFICULTY[d]`, style `'allRound'`, until their own tasks.

- [ ] **Step 1: Record today's numbers.** Write a scratch script, `<scratchpad>/baseline.mts`, that prints the exact measured rates to `<scratchpad>/baseline-rates.txt`:
  - `maxMatch` at rung 10, E/N/H, seeds 100–163;
  - each crew kid's `opponentMatch`, E/N/H;
  - Sam's racer and matador, as `samTuning.test.ts` measures them;
  - Biscuit's blocker and chaser, as `dogTuning.test.ts` does;
  - `goalRate` for long, corner and oneOnOne at levels 1 and 8, E/N/H;
  - the scores of `keeperMatch` on seeds 100–131.
  
  Task 11 diffs against this file.

- [ ] **Step 2: Write the failing tests**

```ts
// tryouts.test.ts
const total = (s: Stats) => s.speed + s.power + s.jump + s.control;
it('each kid is a little stronger overall than the one before, and Max starts above rung 10', () => {
  const totals = TRYOUT_ORDER.map(id => total(TRYOUT_STATS[id]));
  totals.slice(1).forEach((t, i) => expect(t, TRYOUT_ORDER[i + 1]).toBe(totals[i]! + 1));
  expect(totals[0]).toBeGreaterThan(total(maxStats(LADDER_MATCHES)));
});
it('every kid but Max has one standout stat', () => { /* its top stat is strictly above its others */ });
it('Max and Tia are tougher than before: no stat lower, the total higher', () => { /* vs maxStats(10) and CREW_STATS.tia */ });
it('everyone plays at Stamina 1', () => { /* TRYOUT_ORDER */ });
it("every Easy dial is gentler than Normal's, and Normal's than Hard's", () => {
  const gentlerHigh = ['reactionS', 'aimErrorDeg', 'backOffS', 'cleanSteal', 'wrongFootedS'] as const;
  const harderHigh = ['aggression', 'braceSense', 'paceFactor'] as const;
  for (const id of TRYOUT_ORDER) {
    const { easy: e, normal: n, hard: h } = TRYOUT_PROFILES[id];
    for (const k of gentlerHigh) expect([e[k] >= n[k], n[k] >= h[k]], `${id} ${k}`).toEqual([true, true]);
    for (const k of harderHigh) expect([e[k] <= n[k], n[k] <= h[k]], `${id} ${k}`).toEqual([true, true]);
  }
});
it('the School profiles are their own objects, so tuning them never moves the Backyard or the Park', () => {
  for (const d of DIFFICULTIES) {
    expect(TRYOUT_PROFILES.max[d]).not.toBe(DIFFICULTY[d]);
    expect(TRYOUT_PROFILES.tia[d]).not.toBe(CREW_PROFILES.tia[d]);
    expect(TRYOUT_PROFILES.tia[d].style).toBe('dribbler');
  }
});
// opponents.test.ts
it('Max and Tia come back at their School stats and profiles at the School, and only there', () => {
  expect(opponentStats('max', 1, 'school')).toEqual(TRYOUT_STATS.max);
  expect(opponentStats('max', 0, 'school')).toEqual(TRYOUT_STATS.max); // Gus's slot, standing in until plan 5
  expect(opponentStats('max', 7, 'backyard')).toEqual(maxStats(7));
  expect(opponentStats('max', 7)).toEqual(maxStats(7));
  expect(opponentStats('tia', 5, 'school')).toEqual(TRYOUT_STATS.tia);
  expect(opponentStats('tia', 3, 'park')).toEqual(CREW_STATS.tia);
  for (const d of DIFFS) {
    expect(opponentProfile('max', d, 'school')).toBe(TRYOUT_PROFILES.max[d]);
    expect(opponentProfile('max', d)).toBe(DIFFICULTY[d]);
    expect(opponentProfile('tia', d, 'school')).toBe(TRYOUT_PROFILES.tia[d]);
    expect(opponentProfile('tia', d, 'park')).toBe(CREW_PROFILES.tia[d]);
  }
});
```

  In `matchScene.test.ts`, replace "every tryout and Gus build Max at the ladder stats" with "every School slot builds its catalog opponent at their School best". For each School match:
  - `away.stats` equals `opponentStats(m.opponent, m.rung, 'school')`;
  - `maxProfile` is `opponentProfile(m.opponent, 'hard', 'school')`;
  - the size, field, keeper, look and clock checks stay as they are.
  
  Also assert explicitly that `school-1` and `school-boss` give `TRYOUT_STATS.max`, and `school-5` gives `TRYOUT_STATS.tia`.
  
  Add a Review Focus 1 test, driven the way the existing "any new difficulty applied to the opponent" test drives Options: at `school-1` on Normal, change to Hard through the pause menu, then `world.maxProfile` is `TRYOUT_PROFILES.max.hard`. At `school-5`, it is `TRYOUT_PROFILES.tia.hard`.
  
  In `career.test.ts`, the School's opponents read `['max', 'max', 'max', 'max', 'tia', 'max', 'max', 'max', 'max']`.

- [ ] **Step 3: Run them to see them fail**

  Run: `npx vitest run src/game/tryouts.test.ts src/game/opponents.test.ts src/scenes/matchScene.test.ts src/meta/career.test.ts`
  Expected: FAIL, because `tryouts.ts` doesn't exist.

- [ ] **Step 4: Implement**
  - `tryouts.ts`: the stats from the table, and the profiles as above, each spread into its own object.
  - `opponents.ts`: the venue rule. Keep `trickSetup(d, opponent)`'s signature: a returning kid's style is the same everywhere.
  - `matchScene.ts`: pass `match.venue` to both lookups, in the build and in `backHere`. Rewrite the stand-in comment: Max stands in for Gus at his School best.
  - `career.ts`: give `tryout()` an opponent parameter, and set tryout 5 to `'tia'`.

- [ ] **Step 5: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS, with every Backyard and Park test unchanged.

- [ ] **Step 6: Commit** with `feat: bring Max and Tia back tougher at the School`.

---

### Task 2: The tryout harness, and School Max (a STOP point)

**Files:**
- Create:
  - `src/game/aiming.ts`, `src/game/aiming.test.ts`
  - `src/game/tryoutScripts.ts`, `src/game/tryoutScripts.test.ts`
  - `src/game/tryoutTuning.ts`
  - `src/game/schoolMaxTuning.test.ts`
- Modify:
  - `src/game/maxScripts.ts`: extract trait recording into `traitRecorder`.
  - `src/game/keeperScripts.ts`: its private `openSide` becomes `openCorner`.
  - `src/game/tryouts.ts`: School Max's tuned dials.

**Interfaces:**
- Produces:
  ```ts
  // aiming.ts
  /** The aim at the side of the goal `attacker` faces that's further from that goal's keeper ('far' on a tie, and with no keepers). */
  export function openCorner(w: World, attacker: Player): Aim;
  // maxScripts.ts: playMatchup records through this, drawing no random number, so its results stay identical
  export interface TraitRecorder { tick(w: World, awayIntent: PlayerIntent, awayWas: PlayerState): void; traits(brain: AiBrain): Traits }
  export function traitRecorder(w: World): TraitRecorder;
  // tryoutScripts.ts
  /** The School's scripted Harrison: the Park's, and he places his shots and follows up their keeper's pushes. Frozen after Task 2. */
  export const SCHOOL_SCRIPT = { shootRange: 200, followS: 2, followRange: 180, followCharge: 0.5 };
  export interface SchoolScriptMemo extends ScriptMemo { sincePushS: number }
  export function schoolScriptMemo(seed: number): SchoolScriptMemo;
  export function schoolHarrisonIntent(w: World, t: number, dt: number, memo: SchoolScriptMemo): PlayerIntent;
  export interface TryoutTraits extends Traits {
    headers: number;           // the kid's headers
    chips: number;             // the kid's chips struck
    chipGoals: number;         // its goals whose last kick of its own was a chip
    reboundTouches: number;    // its touches and kicks within REBOUND_S of Harrison's keeper pushing the ball away
    shotLines: number[];       // each of its shots headed inside the mouth: px from the nearer post where its line crosses
    shotsInLine: number;       // its shot wind-ups begun with Harrison's body across the line to its aim
    windUps: number;           // all its shot wind-ups
    strayTicks: number;        // ticks an outfield body stood in a goal or behind a net
  }
  export interface TryoutMatch extends MaxMatch { traits: TryoutTraits }
  /** A whole School match: keepers at `level` (Harrison's Normal, theirs `d`), the School Harrison a level up on m.stats. */
  export function playTryout(m: Matchup, level: number, d: Difficulty, seed: number, harrison?: Stats): TryoutMatch;
  /** `id` at its School stats and profile, keepers at its tryout's level (keeperLevel of its catalog match). */
  export function tryoutMatch(id: TryoutOpponent, d: Difficulty, seed: number): TryoutMatch;
  // tryoutTuning.ts
  export const TRYOUT_SEEDS: readonly number[];   // 100–163
  export const HARD_CEILING = 0.1;
  /** kid: the kid's Normal matches; max: Max's Normal brain at the kid's stats, same seeds and level. */
  export interface Personality { name: string; check(kid: readonly TryoutTraits[], max: readonly TryoutTraits[]): void }
  export function describeTryout(id: TryoutOpponent, personality: Personality | null): void;
  ```
- `describeTryout` writes, under `describe(id)`:
  - the Easy and Normal bands, and Hard ≤ `HARD_CEILING`;
  - Easy ≥ Normal ≥ Hard;
  - for all three difficulties, every match: a result, `longestStillS ≤ 4` and `strayTicks === 0`;
  - the personality, when given.
  
  It caches matches by id, difficulty and seed, as `crewTuning.test.ts` does. For `strayTicks`, reuse plan 1's whole-match checks for "in a goal" and "behind a net".
- In the personality lines of later tasks, `mean(kid.x)` is the mean of `x` over the kid's Normal matches, and likewise `max`'s. `shotLines` is flattened over the matches first.

- [ ] **Step 1: Write the failing tests**
  - `aiming.test.ts`, on `keeperWorld()`:
    - with their keeper at z 44, `openCorner(w, w.home)` is `'far'`; at z 84 it's `'near'`;
    - Harrison's keeper at z 44 gives `openCorner(w, w.away)` `'far'`;
    - a world without keepers gives `'far'`.
  - `tryoutScripts.test.ts`:
    - **On the release tick his aim is the open corner.** On `keeperWorld()` with Harrison on the ball 150 px out and their keeper at z 44, step `schoolHarrisonIntent` until its `shootHeld` turns false. That tick's `aim` is `'far'`.
    - **He follows up a push at once.** Put the ball at his feet 150 px out and his brain's next decision 0.3 s away (`memo.brain.nextDecisionS = 0.3`). With `memo.sincePushS = 0.5`, the first intent holds shoot. With `sincePushS = 2.5`, it doesn't, because his brain hasn't decided yet.
    - **The recording draws no random number.** `playTryout` twice on one seed gives identical results and traits.
  - `schoolMaxTuning.test.ts`: `describeTryout('max', null)`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/aiming.test.ts src/game/tryoutScripts.test.ts src/game/schoolMaxTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - **`openCorner`** keeps the drills' rule exactly: `|k.z − z0| > |k.z − z1| ? 'near' : 'far'`. `keeperScripts` uses it.
  - **`traitRecorder`** moves `playMatchup`'s per-tick recording out unchanged.
  - **`schoolHarrisonIntent`** as *The calls this plan makes* says. The brain is `HARRISON_SCRIPT` with `shootRange: SCHOOL_SCRIPT.shootRange` and the per-match reaction draw. The aim is set while his brain's plan is `'charge'`, the release tick included. Count `sincePushS` from `w.events.keeper.pushed === 'away'`.
  - **`playTryout`** is `playMatchup`'s loop on `SCHOOL_STAGE` with `keeperLineup(level, d)` and `MATCH_TICKS` 60 × 500. It records through `traitRecorder` plus the School traits:
    - a shot's line is projected straight from its velocity on its strike tick;
    - "across the line" means Harrison's centre within `PLAYER_R + BALL_R` of the segment from the ball to the aim's target on the line, between them.

- [ ] **Step 4: Run them, and check the Park and the drills are untouched**

  Run: `npx vitest run src/game/aiming.test.ts src/game/tryoutScripts.test.ts src/game/keeperTuning.test.ts src/game/maxTuning.test.ts src/game/crewTuning.test.ts`
  Expected: PASS. Re-run Task 1's baseline script: the rates are identical.

- [ ] **Step 5: Tune School Max** as *Tuning a kid* says. Start from the probe (Max's own dials: about .69/.53/.06). Hard will want a little more bite.
  
  **If School Max can't meet the bands, STOP.** Report to the parent before Task 3, because every later kid is measured the same way.

- [ ] **Step 6: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 7: Commit** with `feat: measure the tryouts against keepers`.

---

### Task 3: The six kids' art, and the parent's approval

**Files:**
- Create: `src/art/opponents/tryouts.ts`, `src/art/opponents/tryouts.test.ts`, `tools/render-tryouts.ts`
- Modify:
  - `src/art/colors.ts`, `src/art/colors.test.ts`: three ramps; cap 79.
  - `src/art/kits.ts`: six kits.
  - `src/art/body/proportions.ts`: `HANK_BODY`.
  - `src/scenes/art.ts`: `OPPONENT_LOOKS`.
  - `src/meta/career.ts`: `OpponentId`; tryouts 2–4 and 6–8.
  - `src/meta/locker.ts`: `OPPONENT_FAMILY`; `ClashFamily` gains `'olive' | 'brown'`.
  - `src/game/opponents.ts`: `HumanOpponentId` gains `TryoutKidId`, read from `TRYOUT_*`.
  - `package.json`: `"tryouts": "tsx tools/render-tryouts.ts"`.
- Test: `src/meta/career.test.ts`, `src/meta/locker.test.ts`, `src/game/opponents.test.ts`, `src/scenes/vsScene.test.ts`, `src/scenes/venueScene.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/art/opponents/tryouts.ts
  export const TRYOUT_HEADS: Readonly<Record<TryoutKidId, Record<HeadFacing, HeadSprite>>>;
  export const TRYOUT_BODY: Readonly<Record<TryoutKidId, BodyProportions>>;   // HANK_BODY for Hank, HARRISON_BODY for the rest
  export function tryoutLook(id: TryoutKidId): LookColors;
  // proportions.ts
  /** Header Hank: two pixels more torso and a pixel more upper arm, every length below the hip Harrison's, so he stands on the same feet and anchor. */
  export const HANK_BODY: BodyProportions;   // { ...HARRISON_BODY, torso: 14, upperArm: 8 }
  // career.ts
  export type OpponentId = 'max' | 'biscuit' | 'brick' | 'leo' | 'tia' | 'pete' | 'sam' | TryoutKidId;
  ```
  The six kids play as all-round brains at their own stats until their tasks, so the venue plays end to end.

- [ ] **Step 1: Write the failing tests**
  - `tryouts.test.ts` (art), on the pattern of `crew.test.ts`:
    - every head in every facing is 8–10 px tall, with its neck inside the image and no earring;
    - every frame stays within 13 colours;
    - the six jerseys are pairwise distinct;
    - no jersey is Harrison's `red`, Max's `blue` or Tia's `teal`, and no kit uses an `emerald*`, `berry*` or `lemon*` colour;
    - at least three different `Skin` colours across the six;
    - no even tryout's kid wears a gold-family jersey (`gold`, `goldDark`, `energyGold`, `energyGoldLight`): its goal has backup June's lemon top;
    - `HANK_BODY.torso` is greater than `HARRISON_BODY.torso`, and `standingHipHeight` is equal.
  - `colors.test.ts`: at most 79 colours, the three new ramps' base colours present, and the cap comment naming the tryouts' kits.
  - `locker.test.ts` (Review Focus 2): for every Harrison kit and every new kid, `changeKitFor(kit, id)` is non-null exactly when their families match. The change kit's jersey family then differs from Harrison's kit's.
  - `career.test.ts`: the School's opponents are `['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige', 'max']`.
  - `opponents.test.ts`: each new kid plays at `TRYOUT_STATS[id]` whatever the rung and venue, with `TRYOUT_PROFILES[id][d]` and normal handling.
  - `vsScene.test.ts` and `venueScene.test.ts`, on the pattern of the Park's tests for Sam's art: every tryout's VS card draws that kid's own sprites, and the venue panel draws that kid's face.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/art src/meta src/game/opponents.test.ts src/scenes/vsScene.test.ts src/scenes/venueScene.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Draw them** from the looks table.
  - Head grids use `ART_LEGEND`, like the crew's.
  - Kits are colours only, with no logos. The kit names are the builder's.
  - Add the nine master colours (olive, cocoa and plum, each dark, base and light). Plum's family is `'purple'`, olive's `'olive'`, cocoa's `'brown'`; the white kit is `'white'`, black `'black'`, gold `'yellow'`.
  - `tools/render-tryouts.ts`, modelled on `render-keepers.ts`, writes `preview/tryouts-sheet.png`. It has one row per kid: the name, the front face, the three head facings, then idle, every run frame and the shoot frames, in their kit.

- [ ] **Step 4: Run the tests and render the sheet**

  Run: `npx vitest run && npx tsc --noEmit && npm run tryouts`
  Expected: PASS, and the sheet written. Look at it with Read. Fix anything that clashes or reads poorly before sending it.

- [ ] **Step 5: Commit** with `feat: draw the tryouts cast`.

- [ ] **Step 6: The parent's approval, alone.** Send the sheet to the parent with `SendUserFile`, with one line per kid: their look and how they play. Say that Max and Tia keep their looks and that the GIF follows Niko's task. Carry on with Task 4 meanwhile; nothing merges until the parent approves. Iterate on any change they ask for, and send it again.

---

### Task 4: Header Hank, and the brain's room for personalities

**Files:**
- Create:
  - `src/game/tryoutMoves.ts`
  - `src/game/hank.ts`, `src/game/hank.test.ts`
  - `src/game/testTryouts.ts`
  - `src/game/hankTuning.test.ts`
- Modify:
  - `src/game/ai.ts`: `AiBrain.move` and `started`, `Steer`, `Style` gains `'header'`, the three hook points.
  - `src/game/tricks.ts`: `TRICK_SCALE.header` ×1.
  - `src/game/tryouts.ts`: Hank's style and dials.
  - `src/game/tryoutScripts.ts`: `TryoutTraits.moves`.
- Test: `src/game/ai.test.ts` (every existing case unchanged)

**Interfaces:**
- Produces:
  ```ts
  // ai.ts
  export type Style = /* today's six */ | 'header';   // later tasks add 'chipper' | 'faker' | 'poacher' | 'nutmegger' | 'sniper'
  export interface AiBrain { /* today's */ move: TryoutMove | null; started: Partial<Record<TryoutMove['kind'], number>> }
  /** decide's way to a spot, round goals and the opponent, at this decision's sprint and pace: handed to a kid's own play. */
  export interface Steer { base: PlayerIntent; to(x: number, z: number, aimZ?: number): PlayerIntent }
  // tryoutMoves.ts (each later task adds its variant and its dispatch case)
  export type TryoutMove = { kind: 'head'; t: number; at: { x: number; z: number }; jumpInS: number };
  /** A kid's own play with the ball at its feet; null to play as Max does. */
  export function onBallPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null;
  /** Its own play for a ball nobody has; null for the usual chase. */
  export function looseBallPlay(brain: AiBrain, w: World, me: Player, them: Player, steer: Steer): PlayerIntent | null;
  /** One tick of the move under way; false once it's over, and decide runs afresh this tick. */
  export function tickMove(brain: AiBrain, w: World, me: Player, them: Player, dt: number, steer: Steer): boolean;
  // hank.ts
  export const HEADING = { headY: 37, range: 160, reachS: 1.2 };   // starting values
  /** Where a high ball will pass head height on its way down, and in how long; null if it won't. */
  export function headSpot(w: World, me: Player): { x: number; z: number; inS: number } | null;
  // testTryouts.ts
  /** A School world in play at `level` (default the kid's tryout) with `id`'s brain on the away side; `asMax`: Max's Normal brain at the kid's stats. */
  export function kidWorld(id: TryoutOpponent, o?: { level?: number; d?: Difficulty; seed?: number; asMax?: boolean }): { w: World; brain: AiBrain };
  export function stepKid(w: World, brain: AiBrain, s: number, home?: PlayerIntent | ((w: World) => PlayerIntent)): void;
  // tryoutScripts.ts
  TryoutTraits.moves: Partial<Record<TryoutMove['kind'], number>>;   // a copy of the brain's started
  ```
- **The hooks.**
  - `onBallPlay` comes first in `decide`'s has-ball branch, after the speedster's knock-past and before the charge.
  - `looseBallPlay` comes first in the loose-ball branch.
  - A move under way plays out in `think` where the fake does.
  - At the top of `think`, `brain.move` is cleared, ending the move that tick, when any of these happens: play isn't `'playing'`; Harrison is powered up or his wave is live; a keeper holds the ball; the kid is fooled; Harrison's clean steal robbed it.
  - For today's six styles, every hook returns null without drawing from `w.rng`.
- **Hank's play.** He goes for a high ball when he can reach its head-height spot within `HEADING.reachS`, before it gets there and before Harrison is nearer. The ball is descending through `headY`, or rising toward a fall he can reach.
  - He runs to the spot at a sprint.
  - He jumps when the ball's time to head height equals his rise time to it for his Jump.
  - Within `HEADING.range` of the goal he attacks, facing it, he aims at `openCorner(w, me)`. Elsewhere he heads it straight on, upfield.
  - The rule doesn't ask whose ball it was, so he heads Harrison's chips and lofted balls clear the same way.

- [ ] **Step 1: Write the failing tests**
  - `hank.test.ts`, each over 16 staged variants with `kidWorld('hank')` and Harrison parked unless stated:
    - **A drop kick from Harrison's end comes down to him.** The ball goes from (200, 40 + 3i) with vx 330 and vy 300, and Hank is at (700, 64). Hank heads it before its first bounce (`w.events.kicks[1]?.kicked === 'header'`) in at least 12 variants. `asMax` in the same variants heads at most half as many.
    - **In range he heads at goal.** A ball drops to head height 100 px out from Harrison's goal line, with Hank under it facing that goal. After the header the ball moves at the goal (vx < 0), and its straight line crosses the line inside the mouth in at least 12.
    - **He heads Harrison's chip clear.** Harrison chips from x 900 at the right goal over Hank standing at x 1000. Hank's header sends it back upfield (vx < 0) in at least 12.
  - `ai.test.ts`:
    - **Moves end when play changes** (Review Focus 4). With Hank's head move under way, each of these leaves `brain.move` null on the next `think`, and that intent isn't a jump at a held ball:
      - (a) `w.match.phase = 'goal'`;
      - (b) Harrison powered up (`w.power.activeS > 0`);
      - (c) a keeper holding the ball;
      - (d) `w.events.steal = 'stole'`.
    - **Today's styles never use the hooks.** For each of today's styles, `onBallPlay` and `looseBallPlay` return null on staged worlds with the ball at its feet and loose. A counting wrapper on `w.rng` sees no draws.
  - `hankTuning.test.ts`, `describeTryout('hank', …)`. The personality "wins more headers": `mean(kid.headers) ≥ 1` and `≥ 2 × mean(max.headers)`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/hank.test.ts src/game/ai.test.ts src/game/hankTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the hooks, `Steer` (built from `decide`'s `moveTo`, also for `think`'s move tick) and Hank's play. Set Hank's style to `'header'`. A keeper catching the ball he waits under ends his move through the interruption rule.

- [ ] **Step 4: Tune Hank** as *Tuning a kid* says.

- [ ] **Step 5: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 6: Commit** with `feat: Header Hank wins the ball in the air`.

---

### Task 5: Lofty Lola

**Files:**
- Create: `src/game/lola.ts`, `src/game/lola.test.ts`, `src/game/lolaTuning.test.ts`
- Modify:
  - `src/game/aiming.ts`: `judgedChip`, moved from `keeperScripts.ts`.
  - `src/game/keeperScripts.ts`: uses it.
  - `src/game/ai.ts`: `'chipper'`.
  - `src/game/tricks.ts`, `src/game/tryouts.ts`, `src/game/tryoutMoves.ts`.
- Test: `src/game/aiming.test.ts`, `src/game/keeperTuning.test.ts` (unchanged)

**Interfaces:**
- Produces:
  ```ts
  // aiming.ts
  /** The charge whose chip by `p`, from where the ball is, crosses the goal it faces `lineY` px up, found by flying it as the real chip goes. */
  export function judgedChip(w: World, p: Player, lineY: number): number;
  // lola.ts
  export const LOFT = { keeperOff: 12, from: [90, 230] as const, lineY: 40, overAhead: 60, overLane: 12, closing: 80, overCharge: 0.4 };
  TryoutMove |= { kind: 'chip'; charge: number };   // she holds chip until her charge reaches it
  ```
- **Her play.**
  - **A keeper off his line.** With the ball at her feet within `LOFT.from` of Harrison's goal line, and his keeper at least `keeperOff` off it, she chips at `judgedChip(w, me, LOFT.lineY)`. Her profile's `aimErrorDeg` turns into a small charge error; the builder sets the scale. This needs Harrison not to be within `overAhead` in her lane.
  - **Harrison charging.** When he is running at her head-on (within `overAhead` ahead, within `overLane` of her line, closing faster than `closing` px/s), she plays a short chip over him at `overCharge`.
  - Otherwise she plays as Max does.

- [ ] **Step 1: Write the failing tests**
  - `aiming.test.ts`: on a staged one-on-one, `judgedChip` for the home player equals what the drills' private version gave. Record that value before moving it. For an away player facing the left goal, it mirrors it.
  - `lola.test.ts`, 16 variants each:
    - **She chips a keeper off his line.** Lola is on the ball 150–190 px out, with Harrison parked behind her. She chips in at least 14 variants and scores in at least 6. `asMax` never chips.
    - **Never a keeper on his line.** Hold Harrison's keeper on his line each tick; she never chips.
    - **Over a Harrison charging at her.** He runs at her flat out from 50 px ahead. She chips, the ball is above `PLAYER_H` as it passes his x, and he never touches it, in at least 12.
    - **Not over a still Harrison.** He stands 30 px ahead; she never chips over him.
  - `lolaTuning.test.ts`, "chips more, and scores from chips": `mean(kid.chips) ≥ 1` with `max`'s 0, and the kid's chip goals over the seeds ≥ 3 with `max`'s 0.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/aiming.test.ts src/game/lola.test.ts src/game/lolaTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** `judgedChip`'s move, with the drills using it, and her play.

- [ ] **Step 4: Run the drills.** `npx vitest run src/game/keeperTuning.test.ts` passes, and Task 1's baseline drill rates are identical. **Then tune Lola** as *Tuning a kid* says.

- [ ] **Step 5: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 6: Commit** with `feat: Lofty Lola chips any keeper off his line`.

---

### Task 6: Fake-Out Finn

**Files:**
- Create: `src/game/finn.ts`, `src/game/finn.test.ts`, `src/game/finnTuning.test.ts`
- Modify:
  - `src/game/player.ts`: `feint`.
  - `src/game/ai.ts`: `'faker'`.
  - `src/game/tricks.ts`, `src/game/tryouts.ts`, `src/game/tryoutMoves.ts`.
- Test: `src/game/player.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // player.ts
  /** The computer's fake shot: a wind-up let go with this set is dropped without a kick. Absent for Harrison. */
  PlayerIntent.feint?: boolean;
  // finn.ts
  export const SHAPE = { trigger: 70, lane: 14, holdS: 0.45, readS: 0.08, lunge: 60, cutS: 0.3, goS: 0.2, cooldownS: 1.5 };
  TryoutMove |= { kind: 'shape'; t: number; side: 1 | -1; cutAtS: number | null };
  ```
- **His play.** He shapes when Harrison (his outfield body, never a keeper) stands within `SHAPE.trigger` ahead and `lane` of his line, and Finn is within his `shootRange + SHAPE.trigger` of goal. Shaping means winding up (`shootHeld`, the charging pose) for up to `holdS`.
  - **Harrison commits:** he starts a slide, taps steal, or closes faster than `lunge` px/s. Finn sees it within `readS`, lets the wind-up go with `feint`, and cuts the ball past him on the roomier side under close control (`carry`) for `cutS`. Then he straightens at goal for `goS`.
  - **Harrison waits out `holdS`:** in range, Finn shoots for real. Out of range, he feints and dribbles on.
  - **No Harrison ahead:** he never shapes, and shoots as Max does.
  - No second shape for `cooldownS`.

- [ ] **Step 1: Write the failing tests**
  - `player.test.ts`: **a wind-up let go with `feint` is dropped.** No kick happens; he is back in `'ground'` with charge 0 and the ball still at his feet. Without `feint` the same release fires as today.
  - `finn.test.ts`, 16 variants each:
    - **A waiting Harrison gets a real shot or another shape.** Harrison stands still 50 px ahead in his lane, with Finn 150 px out. Finn is charging within one decision. After `holdS` there is a `'shot'` kick or a second shape, and in no variant is the ball still for more than 1 s (Review Focus 5).
    - **A slide is cut past.** Harrison starts a slide at him 0.15 s into the shape. 0.8 s later Finn has the ball (`maxHasBall(w.away, w.ball)`) and is past Harrison toward goal in at least 12. `asMax`, charging with the same slide coming, keeps it in at most half as many.
    - **A whiffed steal is cut past.** A steal tap from 35 px ahead, out of reach, gets the same answer.
    - **He never fakes the keeper.** Harrison is parked behind him and Finn is in range; every wind-up ends in a shot, and `started.shape` stays 0.
  - `finnTuning.test.ts`, "shapes to shoot, then doesn't": `mean(kid.moves.shape) ≥ 2` per match, and `max`'s 0.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/player.test.ts src/game/finn.test.ts src/game/finnTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** `feint` in `stepPlayer`'s charging case, and his play.

- [ ] **Step 4: Tune Finn** as *Tuning a kid* says.

- [ ] **Step 5: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 6: Commit** with `feat: Fake-Out Finn shapes to shoot, then doesn't`.

---

### Task 7: Tricky Tia returns

**Files:**
- Create: `src/game/schoolTiaTuning.test.ts`
- Modify:
  - `src/game/ai.ts`: a fake ends in a shot when `fakeShot` is set.
  - `src/game/tryouts.ts`: her School dials and `fakeShot`.
  - `src/game/tryoutScripts.ts`: `fakesToShot`.
- Test: `src/game/ai.test.ts`, `src/game/crewTuning.test.ts` (unchanged)

**Interfaces:**
- Produces:
  ```ts
  // ai.ts
  /** From this close to the goal line her fake ends in a shot (School Tia); absent, she dribbles on (the Park). */
  AiProfile.fakeShot?: number;   // starting value 220
  // tryoutScripts.ts
  export const FAKE_TO_SHOT_S = 1;
  TryoutTraits.fakesToShot: number;   // fakes followed by its wind-up within FAKE_TO_SHOT_S
  ```
- **Her play.** When her fake (the lean, the cut, the straightening) ends with the ball at her feet within `fakeShot` of the line she attacks, she winds up a shot at once, whatever her `shootRange`.

- [ ] **Step 1: Write the failing tests**
  - `ai.test.ts`: **her fake ends in a shot at the School.** On a School world, School Tia is 200 px from the goal line with Harrison standing 40 px ahead in her lane. She fakes, and she is charging within 0.2 s of the fake's end. Park Tia in the same stage is not: 200 is beyond her shootRange.
  - `schoolTiaTuning.test.ts`, "her fakes end in shots": `mean(kid.fakes) ≥ 2` with `max`'s 0, and `sum(fakesToShot) ≥ sum(fakes) / 2`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/ai.test.ts src/game/schoolTiaTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**, then **tune School Tia** as *Tuning a kid* says, starting from her Park dials.

- [ ] **Step 4: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS. `crewTuning.test.ts` and Task 1's baseline crew rates are unchanged.

- [ ] **Step 5: Commit** with `feat: Tricky Tia's fake now ends in a shot`.

---

### Task 8: Poacher Priya

**Files:**
- Create: `src/game/priya.ts`, `src/game/priya.test.ts`, `src/game/priyaTuning.test.ts`
- Modify:
  - `src/game/styles.ts`: `defendSpot('poacher')`.
  - `src/game/ai.ts`: `'poacher'`.
  - `src/game/tricks.ts`, `src/game/tryouts.ts`, `src/game/tryoutMoves.ts`.
- Test: `src/game/styles.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // priya.ts
  export const POACH = { lingerX: 160, followS: 2, pounceRange: 160 };
  TryoutMove |= { kind: 'follow'; t: number };
  // styles.ts: defendSpot('poacher', …) is allRound's spot, its x never more than POACH.lingerX into her own half from halfway
  ```
- **Her play.**
  - **Following in.** After her own shot, or Harrison's keeper pushing the ball away, she follows in for `followS`. She sprints to where the loose ball will be (as the chase predicts it). With it at her feet within `pounceRange` she shoots at once: a short charge at `openCorner(w, me)`.
  - **Lingering.** While Harrison has the ball she lingers upfield, at her `defendSpot`.

- [ ] **Step 1: Write the failing tests**
  - `styles.test.ts`:
    - with Harrison on the ball 100 px from Priya's goal line, `defendSpot('poacher', …)`'s x is at most `640 + POACH.lingerX`;
    - with the ball in Harrison's half, it equals allRound's.
  - `priya.test.ts`, 16 variants each:
    - **First to a ball the keeper pushes away.** Stage a push by Harrison's keeper, as `keeperSaves.test.ts` stages one, with Priya 70 px out and Harrison parked. She touches the ball first after the push in at least 12, and shoots within `followS` in at least 10. `asMax` is first in at most half as many.
    - **She runs on after her shot.** After a shot from 150 px out, she is at least 30 px nearer the goal line 0.6 s later. `asMax` moves less than 10.
  - `priyaTuning.test.ts`, "follows shots in, and lingers upfield": `mean(kid.reboundTouches) ≥ 0.5` and `≥ 2 × max's`, and `mean(kid.defendDepth) ≥ mean(max.defendDepth) + 80`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/styles.test.ts src/game/priya.test.ts src/game/priyaTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**, then **tune Priya** as *Tuning a kid* says.

- [ ] **Step 4: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** with `feat: Poacher Priya follows every shot in`.

---

### Task 9: Nutmeg Niko, and the GIF

**Files:**
- Create:
  - `src/game/nutmeg.ts`, `src/game/nutmeg.test.ts`
  - `src/game/niko.ts`, `src/game/niko.test.ts`
  - `src/game/nikoTuning.test.ts`
- Modify:
  - `src/game/ball.ts`: `Ball.through`.
  - `src/game/player.ts`: `PlayerIntent.nutmeg`.
  - `src/game/world.ts`: start and step the nutmeg; Harrison's contacts and steal skip a ball going through him; `placeForKickoff` clears it.
  - `src/game/ai.ts`: `'nutmegger'`.
  - `src/game/tricks.ts`, `src/game/tryouts.ts`, `src/game/tryoutMoves.ts`.
  - `src/game/tryoutScripts.ts`: `nutmegs`, `unfairNutmegs`.

**Interfaces:**
- Produces:
  ```ts
  // ball.ts
  /** A nutmeg under way: the ball passes through this side's outfield player, never its keeper, until it's clear of him or leftS runs out. */
  Ball.through?: { team: Team; leftS: number };
  // player.ts
  /** The computer's nutmeg, pressed this tick: the world pokes its ball through the legs of a still, square Harrison. Absent for Harrison. */
  PlayerIntent.nutmeg?: boolean;
  // nutmeg.ts
  export const NUTMEG = { ahead: 26, lane: 4, stillSpeed: 8, push: 150, passS: 0.4 };
  /** Harrison still and square in the away player's path, close in: on his feet, slower than stillSpeed, facing it, within `ahead` and `lane` of its line with the ball on his line too; not winding up, sliding, turning, tricking or fallen. */
  export function squareAndStill(w: World): boolean;
  /** A nutmeg press with its ball at its feet and squareAndStill: the ball goes through. Whether it did; nothing changes otherwise. */
  export function startNutmeg(w: World, intent: PlayerIntent): boolean;
  /** Counts it down; ends it once the ball is past his body (PLAYER_R + BALL_R beyond him along the push) or time is up. */
  export function stepNutmeg(w: World, dt: number): void;
  // niko.ts
  TryoutMove |= { kind: 'nutmeg'; t: number; side: 1 | -1 };
  // tryoutScripts.ts
  TryoutTraits.nutmegs: number;        // ticks a nutmeg started (ball.through appeared)
  TryoutTraits.unfairNutmegs: number;  // of those, started without squareAndStill on the world before the step
  ```
- **The world rule.**
  - `startNutmeg` runs before contacts and sets the ball off at `NUTMEG.push` along Niko's facing.
  - While `through` is for `'home'`, Harrison's outfield contacts are quiet and his steal can't reach it. His keeper plays and saves it as usual, and Niko's own contacts work once it's clear.
  - `placeForKickoff` deletes `through`.
- **Niko's play.** With the ball at his feet and `squareAndStill(w)`, he presses `nutmeg`. Then he runs round Harrison on the roomier side, at least `2 × PLAYER_R + 2` off his line until past him, and back onto the ball.

- [ ] **Step 1: Write the failing tests**
  - `nutmeg.test.ts` (Review Focus 3):
    - `squareAndStill` is true on the canonical stage. It is false with Harrison at 20 px/s, facing away, sliding, charging, turning, in a trick or fallen, 6 px off the ball's line, or 40 px away.
    - `startNutmeg` returns false and sets nothing whenever `squareAndStill` is false, press or no press.
    - Through the legs, the ball passes Harrison's x with no home contact event (`touched`, `blocked`, `kicked`) on any tick.
    - Once it's clear, `through` is gone, and a ball rolled at him is blocked again.
    - `placeForKickoff` clears it.
    - A through ball headed at Harrison's keeper is still saved or blocked by him.
  - `niko.test.ts`, 16 variants each:
    - **He nutmegs a still, square Harrison and runs round him.** Within 1.2 s Niko has the ball beyond Harrison in at least 12. Harrison never touched it, and the two bodies' centres stay at least `2 × PLAYER_R − 0.5` apart every tick.
    - **Never a moving or side-on one.** In the same stage, with Harrison moving at 30 px/s or facing away, `started.nutmeg` stays 0.
  - `nikoTuning.test.ts`, "nutmegs where Max never does, and only ever a still, square Harrison": `mean(kid.nutmegs) ≥ 0.5`, `max`'s 0, and `unfairNutmegs` 0 in every match.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/nutmeg.test.ts src/game/niko.test.ts src/game/nikoTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**, then **tune Niko** as *Tuning a kid* says. If the scripted Harrison is rarely square and still, the trigger's distances are Niko's dials to move; don't change the script.

- [ ] **Step 4: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** with `feat: Nutmeg Niko puts it through your legs`.

- [ ] **Step 6: The GIF, to the parent alone.** Use the in-page technique in the dev-environment memory note, as the keepers' GIF did.
  - Run the dev server on port 5179 (check `ss -ltnp | rg 5179` first).
  - Build `createMatchScene` for `school-7` with no-op audio and rumble and an in-memory `testContext`.
  - Stage Niko through on a still, square Harrison 160 px from Harrison's goal, with Eddie behind.
  - Step `update` by hand with a still Harrison, and draw every third tick for about 2.5 s into one grid canvas.
  - POST it once to the 5181 receiver. Slice and scale ×3 nearest-neighbour with plain `python3` PIL, into a GIF at 50 ms frames.
  
  Look at the frames: the ball, not a body, must go through. Send it with `SendUserFile` to the parent alone, saying what it shows.

---

### Task 10: Pinpoint Paige

**Files:**
- Create: `src/game/paige.ts`, `src/game/paige.test.ts`, `src/game/paigeTuning.test.ts`
- Modify:
  - `src/game/ai.ts`: `'sniper'`.
  - `src/game/tricks.ts`, `src/game/tryouts.ts`, `src/game/tryoutMoves.ts`.

**Interfaces:**
- Produces:
  ```ts
  // paige.ts
  export const SNIPE = { setS: 0.3, charge: 0.88, lookS: 1.2 };
  /** Harrison's body clear of the line from the ball to where `aim` crosses the goal `me` attacks (centre beyond PLAYER_R + BALL_R + 2 of it). */
  export function clearLook(w: World, me: Player, them: Player, aim: Aim): boolean;
  TryoutMove |= { kind: 'set'; t: number; aim: Aim } | { kind: 'look'; t: number; side: 1 | -1 };
  ```
- **Her play.** On the ball within her `shootRange`, she takes a touch to set herself: she stands with the ball at her feet (`carry`) for `setS`, aiming at `openCorner(w, me)`.
  - **A clear look:** she winds up a hard shot, held to `SNIPE.charge` of her charge time. Her accuracy is her profile's `aimErrorDeg`, starting at E 3, N 2, H 1.
  - **Harrison in her line:** she doesn't wind up. She carries the ball across in depth toward the nearer clear side, looking each tick, for up to `lookS`, then plays as Max does.

- [ ] **Step 1: Write the failing tests**
  - `paige.test.ts`, 16 variants each:
    - **She sets, then picks the corner away from the keeper.** With a clear look, she stands with the ball at her feet, moving less than 2 px, for `setS`, then shoots. The ball crosses the line within 10 px of the open post in at least 12.
    - **She won't shoot through Harrison** (Review Focus 5). With Harrison standing in her line, she never winds up while he blocks it. Within `lookS` she has a clear look and shoots, or plays on, and the ball is never still for more than 1 s.
    - **`asMax` lands further from the posts.** In the clear-look stage, Max's mean distance from the nearer post is larger than hers.
  - `paigeTuning.test.ts`, "picks corners, and only shoots with a clear look":
    - `mean(kid.shotLines) ≤ mean(max.shotLines) − 6`;
    - the kid's `shotsInLine / windUps` is at most 0.05, and below `max`'s.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/paige.test.ts src/game/paigeTuning.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**, then **tune Paige** as *Tuning a kid* says.

- [ ] **Step 4: Run the whole suite and the type check**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** with `feat: Pinpoint Paige picks a corner`.

---

### Task 11: The cast together, the review, and As built

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-school-field-design.md` (As built: plan 4), the memory note

- [ ] **Step 1: The whole suite, the type check and the build**

  Run: `npx vitest run && npm run build`
  Expected: PASS. Note the test count (it was 1820) and the suite's wall time.

- [ ] **Step 2: The Backyard and the Park, number for number.** Re-run Task 1's baseline script and diff it against `baseline-rates.txt`. Every number must be identical. If one moved, stop and find the change that moved it.

- [ ] **Step 3: Each stronger than the last, logged and not pinned.** On Normal, play one fixed School Harrison, at `harrisonStatsFor(TRYOUT_STATS.max)`, against each kid at their tryout's level, on seeds 100–163. Record the eight win rates in the ledger.

- [ ] **Step 4: A browser walk.** Use the dev server, an in-memory `testContext` profile with every tryout beaten, and the controller-scene technique from the memory note. Check:
  - the venue screen draws each kid's face at their node;
  - the VS card for tryouts 2, 5 and 8 shows the kid, Hank's taller sprite included;
  - each new kid's tryout plays a few seconds at 3×, crisp, with the HUD naming them;
  - a change-kit match: Harrison in white against Hank.
  
  Any stills go to the parent alone.

- [ ] **Step 5: Offer the parent a playtest.** Give them the dev server's address and a save code from a scratch script: tryouts 1–8 beaten on a spare slot, so every tryout is a replay. Say which kid teaches what. Fold in feedback as separate commits with their tests, only on their word.

- [ ] **Step 6: A fresh review.** Dispatch one reviewer on the most capable model over the branch since this plan's commit, with the spec and this plan. Fix every Critical and Important finding with tests. Defer minors, with a ruling each in the ledger.

- [ ] **Step 7: As built.** Add "As built: plan 4" to the spec:
  - the stats and dials as built;
  - each kid's E/N/H and their personality numbers against Max's brain;
  - the progression log;
  - the rulings and the deferred minors;
  - the parent's verdict on the sheet and the GIF;
  - notes for plan 5: Gus's slot plays the School Max until then; Help has no vertical-fit test and plan 5 adds Gus's line; and any hook Gus can reuse.

- [ ] **Step 8: Commit** with `docs: record the tryouts cast as built`. Update `harrison-soccer-status.md`: the branch head, what's built, the parent's art verdict, and that plan 5 (Gus) is next, in a fresh session. No merge into `main` and no push; the one merge comes after Gus.
