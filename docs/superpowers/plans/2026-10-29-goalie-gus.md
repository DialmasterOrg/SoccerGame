# Goalie Gus (7c, plan 5 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The School Field's boss slot gets Goalie Gus: a big, friendly keeper-captain in their goal who fills it, catches what's high or straight at him, is slow to get down, comes out big, drop-kicks it huge and can stop the Energy Wave when he's set. His weak partner plays the outfield. Gus is tuned to his lesson in CI, his tip, Help line and sting land, his sheet and GIF go to the parent alone, and the branch gets its release review.

**Architecture:**
- **Bodies of any size.** A `Player` may carry its own `radius` and `height`. Every rule that asks where a body is or what it touches reads them through `radiusOf`/`heightOf`. Nobody but Gus sets them, so everyone else plays number for number as before.
- **Gus is a keeper with his own dials and rules.** Two new dials that every keeper gets (`lowReachZ`, `getDownS`) make "fills the goal, slow to get down" a matter of numbers. The level keepers get values that change nothing. What only Gus does rides on `Keeper.gus` (a `GusRules` record, null for every other keeper): his size, his huge drop kick and the wave brace. The lineup carries it (`KeeperLineup.gus`), so `keeper.ts` never imports him.
- **Plan 4's hooks, where they fit.** `TryoutMove`, `onBallPlay` and the rest are outfield hooks. Gus is a keeper, so his rules live in `keeper.ts`, `keeperAi.ts`, `keeperSaves.ts` and `wave.ts`. His partner plays Max's plain brain. Reused: the frozen School script (`schoolHarrisonIntent`) as the worker's base, `openCorner`, `judgedChip`, `harrisonStatsFor`, `keeperWorld`-style staged worlds, the keeper drills, and the `REBOUND_S` follow-up count. `describeTryout` isn't reused: Gus has the boss bands (Sam's shape).
- **His match.** `school-boss` gets `opponent: 'gus'`. To the outfield code, `'gus'` is a human opponent whose stats, profile and sprites are his partner's (BACKUP MO, playing out of position). The keepers come from `lineupFor(match, d)`: Eddie at tryout 8's Normal level, and Gus at the difficulty.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 4, Canvas 2D, Node 20, tsx; plain `python3` with PIL for the GIF and stills.

**Spec:** `docs/superpowers/specs/2026-10-28-school-field-design.md`. Read:
- *Keepers* (all of it) and *Goalie Gus* (all of it);
- *The Hub, the VS card, Results and Help*, *Sound*, *Art and approval*;
- *Constraints*, *Left to the builder*, plan 5's bullet in *Plans and release*;
- *As built* for plans 1–4, above all plan 2's notes for plans 3–5 and plan 4's *Notes for plan 5*;
- *Amended after the parent's first playtest: softer keepers*, which also records the shorter drop kicks and the 68-deep goals (z 30–98).

## Global Constraints

- **Nothing that exists moves.** This covers the Backyard, the Park, the tryouts and the level keepers:
  - every existing tuning test (`maxTuning`, `crewTuning`, `samTuning`, `dogTuning`, `keeperTuning`, every tryout file), every AI-vs-AI test and the no-kit parity test pass unchanged;
  - no `KEEPER_LEVELS` dial changes, except that the two new dials take values that change nothing;
  - the measured baseline is identical, number for number. Run `npx tsx .superpowers/school-tools/baseline.mts after.txt`, then `diff .superpowers/school-tools/baseline-rates.txt .superpowers/school-tools/after.txt`. Expected: no output. Run it after Tasks 1, 3 and 4, and in Task 8.

  Only the pins of Gus's stand-in move to the new truth: `career.test`'s School opponents, and `matchScene.test`'s "statsAt('school-boss')" and boss `keeperLooks`.
- **The fair rules hold in Gus's match.** His partner keeps every one of them (the fair-Max and Park specs are the authority): Harrison's steal, the wrong-footed beat, the kickoff hold, the keep-out zone, the slide clear and drag-back, backing off a powered-up Harrison, and being fooled. Harrison's steal and slides do nothing to a keeper holding the ball. A keeper's catch or a climbing drop kick stays out of play (`ballOutOfPlay`).
- **Harrison's keeper.** Against Gus, Eddie plays `keeperProfile(KEEPER_TOP_LEVEL, 'normal')` on every difficulty. Changing the difficulty mid-match changes only Gus.
- **Difficulty order.** Every Easy dial is gentler than Normal's, and every Normal dial gentler than Hard's. This holds for Gus's profile (Task 3) and for his partner's (Task 5).
- **On-screen text.** This plan adds two lines: the tip `TIP: KEEP IT LOW. MAKE HIM DIVE.` and one Help line. Each uses only uppercase letters, digits and `' - : ! ? . , / + < >`, with no parentheses, and is measured against its slot.
- **Assets and likeness.** No image, audio or font files; everything is code. No surname anywhere. Gus, his partner and the school are made up.
- **Palette.** Task 2 adds one ramp (three colours) for Gus's top. It moves the cap in `colors.test.ts` from 79 to 82 on purpose, with a comment naming Gus.
- **Saves.** No change. Profile v7 and the save code are untouched, and opponent ids are never saved.
- **Sound** is by design, not by ear, like every cue so far.
- **Approvals.** Gus's sheet (Task 2) and GIF (Task 8) go to **the parent alone** with `SendUserFile`, because Harrison wants to be surprised. So do any stills of Gus. The art gates the merge, not the next task. Ask before every merge into `main` and every push: the repo is public, and Pages deploys on push.
- **Git.** Work on `plan-7c-school-field`. Run `git status --short` before every commit. Commits follow Conventional Commits, 50/72, with no AI attribution trailers.
- **Commands.** Run everything from the project root:
  - one file: `npx vitest run <file>`
  - the whole suite: `npx vitest run`
  - the types: `npx tsc --noEmit`
  - the build: `npm run build`
- **Ledger.** Keep rulings and measured numbers in `.superpowers/sdd/2026-10-29-goalie-gus/progress.md` (gitignored). They go into As built in Task 8.
- **Deferred minors.** Plans 1–4's deferred minors stay deferred. The release review in Task 8 lists any it thinks should block.

## The calls this plan makes

The parent approves these with the plan. Each is the builder's per the spec unless marked.

- **His size.** His physics body has radius 7 and height 53 (everyone else: 5 and 40). He is drawn about 54 px tall in a 63×72 frame on anchor (31, 69), against Harrison's 41. His front face is at most 12 px wide, so it fits the boss node at 2×.
- **His look.** The parent can change any of it at the sheet:
  - a ginger crop with freckles and a wide grin, on the light skin ramp;
  - a **cyan** top, a new ramp nobody else wears, with white trim;
  - the gold captain's armband (the Locker Room's) on his near arm;
  - white gloves 5 px across, where a keeper's are 3.
- **His partner** is **BACKUP MO** (backup A), playing out of position in his berry keeper top and gloves:
  - Stats are Speed 3, Power 3, Jump 2, Control 3, Stamina 1.
  - He plays Max's brain with Max's dials, a touch slower: pace 0.85/0.9/0.95 on Easy/Normal/Hard.
  - His name never shows: the HUD says GUS.
  - His clash family is purple, so he changes into white when Harrison wears purple.
  - Backup June isn't used: her lemon top is too close to Harrison's GOLD kit.
- **"Fills the goal, slow to get down"** is two dials every keeper gets:
  - `lowReachZ` is his reach in depth beyond his body for a ball whose centre is under `LOW_Y` = 14 px, about his knee.
  - `getDownS`: a dive's gloves reach out to such a ball only over this long.
  - Every level keeper has `lowReachZ = reachZ` and `getDownS = 0`, so they play exactly as before.
  - Gus starts at `lowReachZ` 0 and `getDownS` 0.3 s on Normal, with a big standing reach above that height (`reachZ` 6, `reachY` 54, over the 48 bar).
- **After a dive he's slow up.** Normal starts at `downS` 0.8 and `getUpS` 0.8, against 0.42 for tryout 8's keeper.
- **The glove clap.** When he holds a save, the hold opens with a clap of the ball between his gloves (a new `clap` pose, 0.45 s). It makes no sound.
- **His drop kick:**
  - It first lands 160–360 px into Harrison's half (x 280–480), against everyone else's 10–190 short of halfway.
  - The players wait out at x 380 while he holds.
  - Until someone touches it, Eddie always holds it (catch odds 1). A test pins "no goal straight from his kick".
- **The brace.** Gus stops the wave when he is set:
  - in the `'set'` act, on his feet and not fooled;
  - facing the beam;
  - no further out than his set spot can take him: radius + `SET_OFF` + `comeOutPx`.
  
  He catches it. It's a save: the brace cue, his clap, his hold and his drop kick follow. Rushing, diving, down, getting up, fooled, or walking back from further out, he is blown into his net like anyone. There is no "saw it coming" distance, which is Max's 65 px.
- **Sounds:**
  - `boom` is his drop kick, deeper and louder than `punt`;
  - `gusSting` is his VS card's sting: `bossSting` a fourth lower, with two glove thumps on the end;
  - the other bosses keep `bossSting`.
- **Help line**, after Sam's: `GOALIE GUS FILLS THE GOAL. HE CAN EVEN STOP THE WAVE.` These are facts, and the lesson isn't in it. The tip is the spec's.
- **Tuning.**
  - **The stats** are `GUS_TUNING_STATS = harrisonStatsFor(TRYOUT_STATS.paige)` = 7/10/4/7, Stamina 1: a Harrison who has passed the tryouts.
  - **The blaster** is the Park script shooting from 320 px, every shot held until it has been full for 0.25 s. He never follows up.
  - **The worker** is the frozen School script (placed shots, follow-ups) with four changes:
    - he shoots from inside 110 px;
    - he lets every shot go at 0.45 of his charge, so it stays low;
    - when Gus comes out, he chips him or steps over him;
    - he picks between the two by a seeded draw, half each.
  - **Bands**, as Sam's:
    - the blaster wins ≤ .15 on Normal;
    - the worker wins .4–.65 on Normal, .65–.95 on Easy and .15–.45 on Hard;
    - the worker beats the blaster by ≥ .3 on every difficulty.
- **The GIF** is drawn by the real match scene in the page: a high shot he catches and claps, then a low shot past his slow dive.
- **The release review** is a fresh reviewer on the most capable model. It reads everything not yet on `main` (`git diff 7a09e3e..HEAD`: Paige, plan 4's review fix and Gus) and plays the School end to end headless, against Harrisons the scripts never play.

## Tuning Gus (Task 6 follows this)

1. **Run** `npx vitest run src/game/gusTuning.test.ts src/game/gusDrills.test.ts` to see where he sits.
2. **Sweep at runtime** from a scratch `npx tsx` script in the scratchpad. Mutate `GUS_PROFILES[d]` and `GUS_PARTNER_PROFILES[d]`, then play `gusMatch(d, seed, who)` over `GUS_SEEDS` and the drills over their seeds. Move these first:
   - `getDownS`, `lowReachZ` and `reactionS` (low corners);
   - `reachZ` and `holdOdds` (straight and high);
   - `downS` and `getUpS` (rebounds);
   - `comeOutPx` and `smotherAt` (the chip and the stepover);
   - then the partner's `paceFactor` and `cleanSteal`.
   
   `reactionS` stays under 0.28 s, the rule the keepers learned (plan 2's amendment).
3. **Keep Easy gentler than Normal, and Normal than Hard** (Task 3's and Task 5's tests). Task 3's and Task 4's staged tests are part of the lesson, so tuning keeps them passing.
4. **Never move** `BLASTER`, `WORKER`, `GUS_TUNING_STATS`, a band, a level keeper's dial or a stat once Task 6 Step 4 freezes them.
5. **The STOP rule.** If the bands and the lesson can't both be met, stop. Send the parent the E/N/H rates for both scripts, the drill rates and the dials tried, and wait. The lesson is: the blaster loses, the worker wins about half, the drills show high saved and low beaten, and there is no goal from his kick. Don't widen a band.
6. **Write the values** into `gus.ts` with a comment giving the measured rates, as `sam.ts` does.

## Review Focus

1. **A difficulty change mid-match against Gus.** `backHere` sets their keeper's profile when Options changes the difficulty. Read through `keeperProfile(keeperLevel(m), d)`, it would turn Gus into a level-8 backup with Gus's body. Expected:
   - Gus gets `GUS_PROFILES[d]` and keeps his `gus` rules, radius and height;
   - whatever act he's in plays out;
   - Eddie doesn't change.
   
   Pinned in Task 5.
2. **Gus blown into his net with his bigger body.** The net is 28 deep and 68 wide, and he is 14 across. Expected: he lands inside it, never behind it or through the side netting, gets up and walks out within 3 s, and never ends a tick in the roof span. Pinned in Task 4.
3. **Harrison squeezed between Gus's bigger body and a post or the near board.** Expected: after one `resolveAll`, no two bodies overlap by their own radii, nobody stands in a goal, and Gus is still in his box. Pinned in Task 1.
4. **The VS card after a loss.** The TIP line is the card's fourth, and Gus is 13 px taller than anyone else on it. His face also goes in the 28 px boss node at 2×. Expected:
   - his top pixel row on the card is below the tip line's bottom;
   - his face at `BOSS_FACE_SCALE` fits the node;
   - his face in the panel ends left of `PANEL_TEXT_X`.
   
   Pinned in Task 7.
5. **A wave that reaches Gus at the edges of "set".** The cases:
   - the tick he gets up from a dive;
   - walking back to his line after a rush, further out than his set band;
   - the tick after he catches a save, still holding;
   - fooled by a stepover.
   
   Expected:
   - getting up, walking back and fooled: blown into his net, and it's a goal;
   - holding: the wave never fires, because `ballOutOfPlay` ends it.
   
   Pinned in Task 4.

---

### Task 1: Bodies of any size

No behaviour changes: every body today has no `radius` or `height`, so every number is as before.

**Files:**
- Modify:
  - `src/game/player.ts`: the `radius?`/`height?` fields and `radiusOf`/`heightOf`; `stepPlayer`'s clamps at the boards.
  - `src/game/bodies.ts`: the pair gap is `radiusOf(a) + radiusOf(b)` in `overlapping`, `pushApart`, `sidestep` and `brushPast`. Each body's own radius applies in `onPitch`, `keepOutOfGoals`, `keepInNet` and `confine`.
  - `src/game/zones.ts`: `ballInBody` uses the body's radius and height.
  - `src/game/contact.ts`: `bodyNormal` and `blockBall` use the body's radius; the slide's `feetX`/`feetZ` use the opponent's.
  - `src/game/wave.ts`: `reaches` and the brace's ball spot use the body's radius.
  - `src/game/keeperAi.ts`: `setSpot`, `answer`'s line and gap, and `inReach` use the keeper's radius.
  - `src/game/keeperSaves.ts`: `inStandingZone` uses the keeper's radius.
- Test: `src/game/bodies.test.ts`, `src/game/zones.test.ts`, `src/game/player.test.ts`, `src/game/keeperAi.test.ts`, `src/game/wave.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // player.ts
  export interface Player {
    // ...
    /** His body's radius when it isn't PLAYER_R: Goalie Gus's. */
    radius?: number;
    /** His height when it isn't PLAYER_H. */
    height?: number;
  }
  export const radiusOf = (p: Pick<Player, 'radius'>): number => p.radius ?? PLAYER_R;
  export const heightOf = (p: Pick<Player, 'height'>): number => p.height ?? PLAYER_H;
  ```
  The AI modules (`ai.ts`, the kids, `dogAi.ts`, the scripts) keep `PLAYER_R`. They only ever reason about outfield bodies.

- [ ] **Step 1: Write the failing tests**
  - `bodies.test.ts`:
    - "bodies of different sizes rest exactly their two radii apart": a radius-7 body and a plain one, overlapping on open grass, end 12 apart after `resolveBodies`.
    - "a big body keeps its own radius inside the boards and out of a goal": a radius-7 body pushed toward z 0 ends at z ≥ 7. One overlapping the right goal's mouth ends with `x ≤ lineX − 7`.
    - **Review Focus 3**, "Harrison squeezed between a big keeper and a post": a School world, their keeper with radius 7 standing at his near post (z = z0 + 7), and Harrison overlapping him from the pitch side against the post. After one `resolveAll`:
      - every pair is at least its two radii apart (±1e-6);
      - nobody is in `inGoalBox` grown by their own radius;
      - the keeper is still inside his `area`.
      
      Repeat it at the near board (z = 7).
  - `zones.test.ts`: a ball centre 9 px from a radius-7 body at y 3 is in his body (`ballInBody`). From a plain body it isn't. A ball at y 50 is in a body of height 53, and not in a plain one.
  - `player.test.ts`: `stepPlayer` stops a radius-7 body running at the near board with its centre at z 7.
  - `keeperAi.test.ts`: with the ball far off (x 640), a keeper whose body has radius 7 has `setSpot(w, k).x` exactly `lineX − 7 − SET_OFF` in the right goal.
  - `wave.test.ts`: a beam passing 14 px to the side of a radius-7 body reaches it, and doesn't reach a plain one (`WAVE_HALF_WIDTH` 8 + radius).

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/bodies.test.ts src/game/zones.test.ts src/game/player.test.ts src/game/keeperAi.test.ts src/game/wave.test.ts`
  Expected: FAIL. The new cases fail because every rule still reads `PLAYER_R`/`PLAYER_H`.

- [ ] **Step 3: Implement** `radiusOf`/`heightOf` and read them in every place the Files list names. Where a rule used `2 * PLAYER_R` between two bodies, use the sum of their radii.

- [ ] **Step 4: Run the tests, the suite and the baseline**

  Run: `npx vitest run && npx tsc --noEmit && npx tsx .superpowers/school-tools/baseline.mts after.txt && diff .superpowers/school-tools/baseline-rates.txt .superpowers/school-tools/after.txt`
  Expected: PASS, and `diff` prints nothing.

- [ ] **Step 5: Commit** with `refactor: give each body its own size`.

---

### Task 2: Gus's art, and the parent's approval

**Files:**
- Create: `src/art/keepers/gus.ts`, `src/art/keepers/gus.test.ts`, `tools/render-gus.ts`
- Modify:
  - `src/art/body/proportions.ts`: `FrameSpec` and `BodyProportions.frame?`.
  - `src/art/body/pose.ts`: `frameOf`; `solvePose` takes the anchor from `frameOf(body)`.
  - `src/art/body/drawFigure.ts`: the image is `frameOf(body)`'s size; `BodyExtras.gloveSize?`.
  - `src/art/keepers/poses.ts`: the `clap` pose; `diveFrames` reads `frameOf(body)` in place of `FRAME_W`/`FRAME_H`.
  - `src/art/keepers/keepers.ts`: `KeeperId` gains `'gus'`; his name, heads and look; `keeperBody`, `keeperExtras`.
  - `src/art/colors.ts`, `src/art/colors.test.ts`: the cyan ramp; cap 82.
  - `src/scenes/art.ts`: `KeeperSprites.anchor`; `keeperSprites` bakes with `keeperBody(id)`/`keeperExtras(id)`; the `gus` getter.
  - `src/scenes/keeperView.ts`: body and pose frames draw at `sprites.anchor`.
  - `package.json`: `"gus": "tsx tools/render-gus.ts"`.
- Test: `src/art/keepers/gus.test.ts`, `src/art/keepers/keepers.test.ts`, `src/art/keepers/poses.test.ts`, `src/art/colors.test.ts`, `src/scenes/art.test.ts`, `src/scenes/keeperView.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // proportions.ts
  export interface FrameSpec { w: number; h: number; anchor: Point }
  export interface BodyProportions {
    // ...
    /** The frame he's drawn in when it isn't FRAME_W×FRAME_H on ANCHOR: Goalie Gus's. */
    frame?: FrameSpec;
  }
  // pose.ts
  export function frameOf(b: BodyProportions): FrameSpec; // b.frame ?? { w: FRAME_W, h: FRAME_H, anchor: ANCHOR }
  // drawFigure.ts
  export interface BodyExtras {
    // ...
    /** Gloves this many px across, not GLOVE's 3: Goalie Gus's. */
    gloveSize?: number;
  }
  // art/keepers/gus.ts
  export const GUS_FRAME: FrameSpec;     // { w: 63, h: 72, anchor: { x: 31, y: 69 } }, odd width so flipX keeps the anchor
  export const GUS_BODY: BodyProportions; // thigh 12, shin 12, foot 5, ankleHeight 1, torso 16, upperArm 9, forearm 8,
                                          // thighWidth 6, shinWidth 4, upperArmWidth 4, forearmWidth 3, torsoWidth 9, frame GUS_FRAME
  export const GUS_HEADS: Readonly<Record<HeadFacing, HeadSprite>>;
  export const GUS_EXTRAS: BodyExtras;   // { ...KEEPER_EXTRAS, armband: true, gloveSize: 5 }
  /** Where a held ball's centre sits in his hold frames, from his anchor: x ahead, y up. The sim parks the ball there. */
  export const GUS_HANDS: Point;
  // keepers.ts
  export type KeeperId = 'eddie' | 'backupA' | 'backupB' | 'gus';
  // KEEPER_NAMES.gus = 'GOALIE GUS'
  export function keeperBody(id: KeeperId): BodyProportions;  // GUS_BODY for 'gus', HARRISON_BODY otherwise
  export function keeperExtras(id: KeeperId): BodyExtras;     // GUS_EXTRAS for 'gus', KEEPER_EXTRAS otherwise
  // poses.ts
  export type KeeperPose = /* ... */ | 'clap'; // 3 frames at 8 fps: gloves apart at the chest, together on the ball, apart
  // scenes/art.ts
  export interface KeeperSprites {
    // ...
    /** The feet point of his body and pose frames: ANCHOR, or Gus's. */
    anchor: Point;
  }
  ```

- [ ] **Step 1: Write the failing tests**
  - `gus.test.ts` (art):
    - `frameOf(HARRISON_BODY)` is `{ w: 49, h: 56, anchor: ANCHOR }`.
    - Gus's standing figure (`standingPose(GUS_BODY)`) spans 52–56 rows, with its lowest opaque row on `GUS_FRAME.anchor.y`. Harrison's spans 40–42.
    - Gus's heads are 11–13 px tall, and the front one is at most 12 px wide.
    - His standing frame has more glove pixels than Eddie's, and some `C.Armband` pixels.
    - Every one of his frames uses at most 14 colours.
    - In his hold frames his gloves are within 3 px of `GUS_HANDS`, on the pattern of `poses.test.ts`'s hold test.
  - `keepers.test.ts`: the "no keeper's top is any kit's colour" test covers four keepers, with four distinct tops. `KEEPER_NAMES.gus` is `'GOALIE GUS'`.
  - `poses.test.ts`: every pose, `clap` included, has its frames for Eddie. A Gus far-post dive's gloves land up the screen and right of its anchor, as Eddie's do.
  - `colors.test.ts`: at most 82 colours; `cyan` present; the cap comment names Gus's top.
  - `art.test.ts`: `art.keepers.gus.anchor` is `GUS_FRAME.anchor`, and Eddie's is `ANCHOR`.
  - `keeperView.test.ts`: a fake-art draw places a keeper's pose frame at `sx − sprites.anchor.x`.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/art src/scenes/art.test.ts src/scenes/keeperView.test.ts`
  Expected: FAIL. `gus.ts` doesn't exist, and `KeeperId` has no `'gus'`.

- [ ] **Step 3: Draw him**
  - **The frame.** `frameOf` threads through `solvePose`, `drawFigure` and `diveFrames`. `bakeAll`, `bakeKeeperPoses` and `spriteSet` need no change: they already pass the body.
  - **The heads.** Three facings in `ART_LEGEND`: a ginger crop on the flame ramp (`flameDark`/`flame`/`flameLight`), freckles in the skin shadow, and a wide grin.
  - **The look.** `cyanDark` `#0a6a86`, `cyan` `#18b4d8` and `cyanLight` `#7ee0f4`. Trim is white, shorts are the keepers' charcoal and slate, and socks are cyan. The armband is the Locker Room's gold.
  - **The clap pose** goes in `KEEPER_KEYS`. Every keeper bakes it; only Gus shows it (Task 5).
  - **The sheet.** `tools/render-gus.ts`, on the pattern of `render-keepers.ts`, writes `preview/gus-sheet.png`. Its rows:
    1. Harrison, Eddie and Gus standing side by side, for size;
    2. Gus's three heads and his face;
    3. idle and run;
    4. every keeper pose, the clap included;
    5. both dives, facing right;
    6. BACKUP MO in the outfield clips (idle, run, the shoot frames), in his berry top and gloves.

- [ ] **Step 4: Run the tests and render the sheet**

  Run: `npx vitest run && npx tsc --noEmit && npm run gus`
  Expected: PASS, and the sheet written. Look at it with Read. Fix anything that reads poorly before sending it, above all the dives at his size.

- [ ] **Step 5: Commit** with `feat: draw Goalie Gus`.

- [ ] **Step 6: The parent's approval, alone.** Send the sheet to the parent with `SendUserFile`. Give one line each on his look, his size against Harrison's, the partner, and the clap. Say that the GIF follows in Task 8. Carry on with Task 3 meanwhile; nothing merges until the parent approves. Fold any change they ask for into the art, re-run the Task 2 tests, and send it again.

---

### Task 3: Gus in goal: fills it, slow to get down, comes out big

**Files:**
- Create: `src/game/gus.ts`, `src/game/gus.test.ts`
- Modify:
  - `src/game/keeper.ts`:
    - the two new dials in `KeeperProfile` and in all six `KEEPER_LEVELS` profiles;
    - `KeeperLineup.gus?` and `Keeper.gus`;
    - `createKeeper` sets the body's radius and height from the rules, and `placeKeepers` keeps them;
    - `heldSpot` uses his hands, boot and dive-ball spot.
  - `src/game/keeperSaves.ts`:
    - `LOW_Y`;
    - the standing zone's depth reach by the ball's height;
    - in a dive, a low ball's reach grows over `getDownS`.
  - `src/game/keeperAi.ts`: `answer`'s on-his-feet reach by the read's height.
  - `src/game/testKeepers.ts`: `keeperWorld({ gus })`.
  - `src/game/keeper.test.ts`: the `BETTER` table gains the two dials.
- Test: `src/game/gus.test.ts`, `src/game/keeper.test.ts`

**Interfaces:**
- Consumes: `radiusOf` (Task 1), `GUS_HANDS` (Task 2).
- Produces:
  ```ts
  // keeper.ts
  export interface KeeperProfile {
    // ... after reachZ:
    /** His reach in depth beyond his body for a low ball (centre under LOW_Y): reachZ for every level keeper. */
    lowReachZ: number;
    // ... after diveS:
    /** A dive's gloves reach a low ball only over this long: 0 for every level keeper. */
    getDownS: number;
  }
  export interface KeeperLineup {
    home: KeeperProfile;
    away: KeeperProfile;
    /** Their keeper is Goalie Gus: his body and his rules. */
    gus?: GusRules;
  }
  export interface Keeper { /* ... */ gus: GusRules | null }
  // keeperSaves.ts
  /** A ball whose centre is under this, px, is low: a keeper has to get down to it. */
  export const LOW_Y = 14;
  // gus.ts
  export interface GusRules {
    radius: number;      // 7
    height: number;      // 53
    hands: Point;        // GUS_HANDS
    boot: Point;         // { x: 11, y: 8 }
    diveBallPx: number;  // 13: a ball caught in his dive lies this far along it
  }
  export const GUS: GusRules;
  export const GUS_PROFILES: Record<Difficulty, KeeperProfile>;
  /** Eddie at tryout 8's Normal keeper, Gus at `d`. */
  export function gusLineup(d: Difficulty): KeeperLineup; // { home: keeperProfile(KEEPER_TOP_LEVEL, 'normal'), away: GUS_PROFILES[d], gus: GUS }
  // testKeepers.ts
  export function keeperWorld(o: { /* ... */ gus?: boolean }): World; // gus: their keeper is Gus at o.difficulty
  ```
  **Gus's starting profiles.** Task 6 tunes them; every dial is in Easy ≤ Normal ≤ Hard order.

  | Dial | Easy | Normal | Hard |
  |---|---|---|---|
  | reactionS | 0.23 | 0.19 | 0.16 |
  | speed | 104 | 112 | 120 |
  | posErrPx | 5 | 3 | 2 |
  | comeOutPx | 24 | 26 | 28 |
  | reachZ | 5 | 6 | 7 |
  | lowReachZ | 0 | 0 | 1 |
  | reachY | 52 | 54 | 56 |
  | diveTravel | 9 | 10 | 11 |
  | diveReach | 14 | 16 | 18 |
  | diveS | 0.44 | 0.4 | 0.36 |
  | getDownS | 0.36 | 0.3 | 0.25 |
  | catchSpeed | 440 | 480 | 520 |
  | holdOdds | 0.9 | 0.95 | 0.97 |
  | downS | 0.95 | 0.8 | 0.7 |
  | getUpS | 0.95 | 0.8 | 0.7 |
  | smotherAt | 28 | 30 | 32 |

- [ ] **Step 1: Write the failing tests**
  - `keeper.test.ts`:
    - The `BETTER` table gains `lowReachZ: 1` and `getDownS: -1`.
    - At every level and difficulty, `lowReachZ` equals `reachZ` and `getDownS` is 0.
    - `GUS_PROFILES` keeps Easy ≤ Normal ≤ Hard on every `BETTER` dial.
  - `gus.test.ts` (staged, on `keeperWorld({ gus: true })`, Normal unless named):
    - **set**: "Gus kicks off set in their goal, his own size": his body has radius 7 and height 53, at x `1240 − 7 − SET_OFF`, z 64. Eddie is as `keeper.test` pins him.
    - **straight**: "a hard shot struck straight at him is caught". `shotAt` from (1100, 64) at z 64, speed 600, with the vy that crosses his line at y ≈ 25. It gives `events.keeper.caught === 'away'` within 1 s, on seeds 1–16.
    - **high**: "a high shot for the top corner is saved". From (1060, 64), at z 92, speed 600, with the vy that crosses his line at y ≈ 40. He catches or pushes on all 16 seeds.
    - **low corner**: "a low shot for the bottom corner beats him". From (1140, 64), at z 92, speed 420, vy 0. It's a goal on at least 12 of 16 seeds. The same drill against `keeperProfile(KEEPER_TOP_LEVEL, 'normal')`, which also covers high balls, is listed in the ledger for comparison.
    - **getting down**: "his gloves get down to a low ball slowly". Stage him in `act 'dive'` with `dive { dirX: 0, dirZ: 1 }` and `actT` 0.05. A slow ball 16 px along the dive at y 3 isn't met by `keeperSaves`. The same ball at y 30 is held or pushed.
    - **slow up**: "after a dive he's slow up". Force a far-post dive. A shot at the near post struck while he's in `'getUp'` scores. His `'down'` plus `'getUp'` lasts `downS + getUpS` (1.6 s on Normal).
    - **comes out**: "he comes out big". A dribbler (Harrison at 0.35 pace, touching it on) through on goal from 150 px out brings him into `'rush'`. Before the smother, he is further off his line than a level-8 Normal keeper at the same tick.
    - **tricks**: "a stepover or a rainbow flick beats his rush". On the pattern of `keeper.test.ts`'s trick tests, with `tricks: true`, a stepover sold squared-up sends him diving the wrong way. A flick over him leaves the ball beyond him with him unable to play it.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/gus.test.ts src/game/keeper.test.ts`
  Expected: FAIL. `gus.ts` doesn't exist, and the profiles lack the dials.

- [ ] **Step 3: Implement**
  - Add the dials to `KeeperProfile` and to every `KEEPER_LEVELS` profile (`lowReachZ` = that profile's `reachZ`, `getDownS` 0). Write `gus.ts` with the table above and `GUS`.
  - In `inStandingZone`, the depth reach is `lowReachZ` for a ball under `LOW_Y` and `reachZ` otherwise. Do the same in `answer`, by `read.y`.
  - In `inDiveZone`, a ball under `LOW_Y` is reached along the dive only up to `diveReach × min(1, actT / getDownS)` when `getDownS > 0`. The smother keeps its own progress.

- [ ] **Step 4: Run the tests, the suite and the baseline**

  Run: `npx vitest run && npx tsc --noEmit && npx tsx .superpowers/school-tools/baseline.mts after.txt && diff .superpowers/school-tools/baseline-rates.txt .superpowers/school-tools/after.txt`
  Expected: PASS, and `diff` prints nothing.

- [ ] **Step 5: Commit** with `feat: Goalie Gus fills the goal`.

---

### Task 4: His huge drop kick, and the brace

**Files:**
- Modify:
  - `src/game/gus.ts`: `GusRules.punt`; `bracesWave`.
  - `src/game/keeper.ts`:
    - `dropKick` lands by `k.gus?.punt ?? PUNT`;
    - `standOffSpot` waits where the holding keeper's kick lands;
    - `Keepers.gusPunt`;
    - `catchWave`.
  - `src/game/keeperSaves.ts`: an untouched Gus drop kick is always held.
  - `src/game/wave.ts`: Gus braces when he's set; otherwise he's blown in, as any keeper is.
  - `src/game/world.ts`:
    - `held` and `punting` are read after `stepWave`;
    - `gusPunt` is cleared by any outfield contact, any keeper save or a goal.
  - `src/audio/cues.ts`: the `boom` cue.
  - `src/audio/matchFeedback.ts`: Gus's drop kick plays `boom`.
- Test: `src/game/gus.test.ts`, `src/audio/matchFeedback.test.ts`, `src/audio/cues.test.ts`

**Interfaces:**
- Consumes: `GusRules`, `gusLineup` (Task 3).
- Produces:
  ```ts
  // gus.ts
  export interface GusRules {
    // ...
    /** His drop kick's first bounce: halfway + his attacking direction × (from + rng × spread). */
    punt: { from: number; spread: number }; // { from: 160, spread: 200 }
  }
  /** He stops the wave: set, on his feet and not fooled, facing it, and no further out than his set spot takes him (radius + SET_OFF + comeOutPx). */
  export function bracesWave(w: World, k: Keeper, wave: Wave): boolean;
  // keeper.ts
  export interface Keepers {
    // ...
    /** Gus's drop kick, untouched since his boot: the keeper it reaches always holds it. */
    gusPunt: boolean;
  }
  /** The wave caught: he holds it, standing, as a save. */
  export function catchWave(w: World, k: Keeper): void;
  // cues.ts
  export type Cue = /* ... */ | 'boom';
  ```

- [ ] **Step 1: Write the failing tests** (`gus.test.ts`, on `keeperWorld({ gus: true })`)
  - **landing**: "his drop kicks land deep in Harrison's half". Gus holds a caught ball (`startHold`), and Harrison and the partner are parked at (900, 124). On seeds 1–64, the ball's first bounce is at x 270–490.
  - **no goal from his kick**:
    - "no goal ever comes straight from his kick, and Eddie holds one that reaches him";
    - as above, with nobody else touching it, on seeds 1–64 and every difficulty;
    - stepping until the ball rests or 8 s pass, `events.goal` is never `'away'`;
    - on every seed where the ball entered Harrison's box, `events.keeper.caught === 'home'` happened before it came to rest.
  - **waiting**: "players wait where his kick comes down": while Gus holds, `standOffSpot(w, w.away, gus).x` is 380.
  - **clearing**: "a touch makes it an ordinary ball". `gusPunt` is false once Harrison heads it, and false after any kickoff.
  - **the brace**:
    - "set, he catches the wave". Gus set and still, Harrison powered up and ready on the ball at (1000, 64), facing him, X pressed (on `keeper.test.ts`'s wave pattern). Within 0.5 s:
      - `events.power.braced` fires;
      - `w.keepers.away.holding` is true;
      - `w.wave.outcome` is `'braced'`, and the wave is no longer live;
      - no goal follows within 2 s.
    - "rushing, diving, down or getting up, he's blown in". The same wave with him in `'rush'`, `'dive'`, `'down'` or `'getUp'` blows him into his net, and it's a goal.
  - **Review Focus 5**, "the edges of set". Each case is a goal by the wave:
    - the beam reaches him on the last tick of `'getUp'`;
    - he's in `'set'` but 8 px further out than `radius + SET_OFF + comeOutPx`, walking back;
    - he's fooled by a stepover.
    
    With Gus holding a save, Harrison powered up and pressing X fires nothing (`canFireWave` is false).
  - **Review Focus 2**: "blown into his net, his big body fits and walks out". After a goal by the wave, on every tick until he's out:
    - his centre stays between the goal line and `backX − 7`, and between `z0 + 7` and `z1 − 7`, while `inNet`;
    - he's never in `roofSpan` outside the mouth;
    - `inNet` clears within 3 s of his getting up.
  - `matchFeedback.test.ts`: `punted: 'away'` with Gus in their goal gives `boom` and no `punt`. A level keeper's gives `punt`.
  - `cues.test.ts`: `boom` exists, with every voice inside the cue rules the file already checks.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/game/gus.test.ts src/audio`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - `dropKick` aims by `k.gus?.punt ?? PUNT` and sets `gusPunt` when it's his.
  - `keeperSaves` treats `gusPunt` as a hold chance of 1, as the smother is.
  - In `stepWave`, when the beam reaches their keeper and `k.gus && bracesWave(w, k, wave)`:
    - `catchWave`;
    - outcome `'braced'`, not live;
    - the beam ends at his gloves;
    - `out.braced`;
    - return.
    
    Otherwise `blowKeeper`, as today.
  - `boom`: a triangle 80→40 Hz, 0.2 s at gain 0.4, under a lowpassed noise thud, with `minGapS` 0.3.

- [ ] **Step 4: Run the tests, the suite and the baseline**

  Run: `npx vitest run && npx tsc --noEmit && npx tsx .superpowers/school-tools/baseline.mts after.txt && diff .superpowers/school-tools/baseline-rates.txt .superpowers/school-tools/after.txt`
  Expected: PASS, and `diff` prints nothing.

- [ ] **Step 5: Commit** with `feat: Gus's huge drop kick and his brace`.

---

### Task 5: Gus's match: the boss slot, his partner, his looks in play

**Files:**
- Modify:
  - `src/meta/career.ts`: `OpponentId` gains `'gus'`; `school-boss` gets `opponent: 'gus'`.
  - `src/meta/locker.ts`: `OPPONENT_FAMILY.gus` is `'purple'`.
  - `src/game/tryouts.ts`: export the `profiles` helper.
  - `src/game/gus.ts`: the partner's stats and profiles, `lineupFor`, `awayKeeperProfile`.
  - `src/game/opponents.ts`: `HumanOpponentId` gains `'gus'`, read from the partner's numbers.
  - `src/scenes/art.ts`:
    - `OPPONENT_LOOKS.gus` is the partner (backup A's heads and look, `KEEPER_EXTRAS`);
    - its face is Gus's;
    - `OpponentLook` gains `extras?` and `face?`;
    - `opponentArt` and `opponentIn` pass the extras.
  - `src/scenes/keeperView.ts`: `keeperLooks` by opponent; Gus's clap; shadows by radius.
  - `src/scenes/matchScene.ts`: the lineup from `lineupFor`; `backHere` uses `awayKeeperProfile`; the stand-in comment goes.
- Test: `src/meta/career.test.ts`, `src/meta/locker.test.ts`, `src/game/opponents.test.ts`, `src/game/tryouts.test.ts`, `src/scenes/keeperView.test.ts`, `src/scenes/matchScene.test.ts`, `src/scenes/venueScene.test.ts`

**Interfaces:**
- Consumes: `gusLineup`, `GUS_PROFILES` (Task 3); `keeperLineup`, `keeperLevel` (plan 2); the `clap` pose (Task 2).
- Produces:
  ```ts
  // career.ts
  export type OpponentId = 'max' | 'biscuit' | 'brick' | 'leo' | 'tia' | 'pete' | 'sam' | TryoutKidId | 'gus';
  // gus.ts
  /** BACKUP MO, playing out of position. */
  export const GUS_PARTNER_STATS: Readonly<Stats>; // { speed: 3, power: 3, jump: 2, control: 3, stamina: 1 }
  /** Max's dials, a touch slower: paceFactor 0.85 / 0.9 / 0.95. */
  export const GUS_PARTNER_PROFILES: Record<Difficulty, AiProfile>;
  /** A match's keepers: Gus's lineup for his match, every other at its level. */
  export function lineupFor(m: Pick<CareerMatch, 'kind' | 'rung' | 'opponent'>, d: Difficulty): KeeperLineup;
  export const awayKeeperProfile = (m: Pick<CareerMatch, 'kind' | 'rung' | 'opponent'>, d: Difficulty): KeeperProfile => lineupFor(m, d).away;
  // keeperView.ts
  /** Eddie in Harrison's goal; Gus in his own match; else backup A on odd tryouts, backup B on even ones. */
  export function keeperLooks(m: Pick<CareerMatch, 'kind' | 'rung' | 'opponent'>): { home: KeeperId; away: KeeperId };
  /** His hold opens with the clap for this long, after any catch pose. */
  export const CLAP_S = 0.45;
  ```
  `art.opponents.gus.sprites` are the partner's: what the match draws for the away body. `art.opponents.gus.face` is Gus's: what the venue screen draws for the boss.

- [ ] **Step 1: Write the failing tests**
  - `career.test.ts`: the School's opponents are `['max', 'hank', 'lola', 'finn', 'tia', 'priya', 'niko', 'paige', 'gus']`. Rewrite the "Max stands in for Gus" comment.
  - `opponents.test.ts`: `opponentStats('gus', 0, 'school')` is `GUS_PARTNER_STATS`; the profile is `GUS_PARTNER_PROFILES[d]`; handling is normal.
  - `tryouts.test.ts`: the "every Easy dial is gentler" test covers `GUS_PARTNER_PROFILES`.
  - `locker.test.ts`: `changeKitFor('purple', 'gus')` is `'white'`, and `changeKitFor('home', 'gus')` is null.
  - `keeperView.test.ts`:
    - `keeperLooks({ kind: 'boss', rung: 0, opponent: 'gus' })` is `{ home: 'eddie', away: 'gus' }`, and the tryouts are as before.
    - Gus holding with no pose and `actT` 0.1 shows `{ kind: 'pose', name: 'clap' }`. At `actT` 0.6 he shows `hold`. Eddie at `actT` 0.1 shows `hold`.
  - `matchScene.test.ts`:
    - Gus's match puts Gus in their goal (`world.keepers.away.gus` set, radius 7) at `GUS_PROFILES[d]`, with Eddie at `keeperProfile(KEEPER_TOP_LEVEL, 'normal')` on every difficulty.
    - The away body plays at `GUS_PARTNER_STATS`, and the HUD's name is GUS.
    - The match draws `art.keepers.gus` in their goal and `art.opponents.gus.sprites` for the away body. Read the fake art's paths.
    - Update the stand-in pins: `statsAt('school-boss')` is the partner's, and the boss's `keeperLooks` is `'gus'`.
    - **Review Focus 1**, "a difficulty change mid-match keeps Gus as Gus": start on Normal, put him in `'dive'`, then go to Options and back with Hard. Expected:
      - `away.profile` is `GUS_PROFILES.hard`;
      - `away.gus` is still `GUS`, with radius 7;
      - he's still in `'dive'`;
      - `home.profile` is unchanged.
  - `venueScene.test.ts`: the boss node and the panel draw `art.opponents.gus.face` once Gus is unlocked.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/meta src/game/opponents.test.ts src/game/tryouts.test.ts src/scenes/keeperView.test.ts src/scenes/matchScene.test.ts src/scenes/venueScene.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - The match builds its keepers from `lineupFor(match, difficulty)`. `backHere` sets `world.keepers.away.profile = awayKeeperProfile(match, difficulty)`.
  - `keeperFrame` shows Gus's `clap` from the end of his catch pose (or from the start of a hold after a dive) for `CLAP_S`, then the plain hold.
  - Shadows: a standing keeper's patch is `2 × radius − 5` wide, and the lying strip is `14 × radius / 5`, rounded. That gives 5 and 14 for everyone today, and 9 and 20 for Gus.

- [ ] **Step 4: Run the suite**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** with `feat: Goalie Gus is the School boss`.

---

### Task 6: Gus tuned to his lesson (a STOP point)

**Files:**
- Create: `src/game/gusScripts.ts`, `src/game/gusScripts.test.ts`, `src/game/gusTuning.test.ts`, `src/game/gusDrills.test.ts`
- Modify:
  - `src/game/keeperScripts.ts`: drill kinds `'high'` and `'lowCorner'`; `drill` and `goalRate` take an optional lineup.
  - `src/game/gus.ts`: the tuned values, with their measured comment.
- Test: the three new test files.

**Interfaces:**
- Consumes: `gusLineup`, `GUS_PARTNER_*` (Tasks 3, 5); `schoolScriptMemo`/`schoolHarrisonIntent`, `harrisonIntent`/`scriptMemo`, `openCorner`, `judgedChip`, `trickSetup`.
- Produces:
  ```ts
  // keeperScripts.ts
  export type Drill = 'long' | 'corner' | 'oneOnOne' | 'roller' | 'high' | 'lowCorner';
  export function drill(kind: Drill, level: number, d: Difficulty, seed: number, side?: KeeperSide, watch?: (w: World) => void, lineup?: KeeperLineup): DrillOutcome;
  export function goalRate(kind: Drill, level: number, d: Difficulty, seeds: readonly number[], side?: KeeperSide, lineup?: KeeperLineup): number;
  // gusScripts.ts
  /** A Harrison who has passed the tryouts: a level up on Pinpoint Paige. */
  export const GUS_TUNING_STATS: Readonly<Stats>; // harrisonStatsFor(TRYOUT_STATS.paige)
  export const GUS_SEEDS: readonly number[];      // 100–163
  /** Hard and high from range: every shot held until it has been full for overS; never follows up. */
  export const BLASTER = { shootRange: 320, overS: 0.25 };
  /** Low for the corners, follows up, and draws Gus out to chip or step over him. */
  export const WORKER = { shootRange: 110, charge: 0.45, chipOff: 24, chipLineY: 40, stepoverGap: 68 };
  export type GusScript = 'blaster' | 'worker';
  export interface GusMatchTraits {
    goals: number;
    /** His goals that crossed the line under LOW_Y. */
    lowGoals: number;
    /** His goals struck within REBOUND_S of Gus pushing the ball away. */
    reboundGoals: number;
    /** Away goals while Gus's drop kick was untouched: always 0. */
    puntGoals: number;
    partnerGoals: number;
    /** Of the play ticks either outfielder has the ball, Harrison's share. */
    possession: number;
    strayTicks: number;
  }
  export interface GusMatch extends MaxMatch { traits: GusMatchTraits }
  export function gusMatch(d: Difficulty, seed: number, who: GusScript, stats?: Readonly<Stats>): GusMatch;
  ```
  - **The world.** `createWorld` with the tuning stats, the partner's stats and profile, normal handling, `trickSetup(d, 'gus')`, `SCHOOL_STAGE` and `gusLineup(d)`.
  - **The drills.**
    - `'high'`: from 120–220 px out, z 24–104, charge 0.9–1, aim far, near or straight.
    - `'lowCorner'`: from 70–120 px out, z 30–98, charge 0.35–0.5 at `openCorner`.

- [ ] **Step 1: Write the scripts' tests** (`gusScripts.test.ts`, staged and whole-match)
  - The blaster lets a shot go only with `charge` 1 and `overchargeS` ≥ 0.25, and starts each from ≤ 320 px of the line. Over two whole Normal matches, every one of his kicks of kind `'shot'`, the kickoff shot aside, meets this.
  - The worker lets every shot go at a charge ≤ 0.45 + one tick's charge.
  - The worker chips Gus. In a staged one-on-one, Gus rushes from his line and is ≥ 24 px off it, with the worker's draw on chip: his next kick is a `'chip'`.
  - The worker steps over Gus. With the draw on stepover, his next trick is a stepover.
  - The worker follows a push up within 2 s, as the School script does.

- [ ] **Step 2: Write the scripts** until Step 1 passes.

  Run: `npx vitest run src/game/gusScripts.test.ts`
  Expected: PASS.

- [ ] **Step 3: Write the tuning tests**
  - `gusTuning.test.ts`, on `samTuning.test.ts`'s pattern (each match played once and shared):
    - the blaster wins ≤ 0.15 on Normal;
    - the worker wins 0.4–0.65 on Normal, 0.65–0.95 on Easy and 0.15–0.45 on Hard;
    - worker − blaster ≥ 0.3 on every difficulty;
    - every match ends with a result, the ball never sits still for more than 4 s, and `strayTicks` is 0;
    - `puntGoals` is 0 in every match;
    - on Normal, the worker's `lowGoals` are at least 0.6 of his goals, and his `reboundGoals` total at least 3;
    - on Normal, the worker's `possession` averages at least 0.6, and `partnerGoals` average at most 1.
  - `gusDrills.test.ts`, with `gusLineup(d)` against level 8 on `GUS_SEEDS`:
    - Normal `'high'` `goalRate` ≤ 0.2;
    - Normal `'lowCorner'` ≥ 0.4, and at least 0.3 above `'high'`;
    - Easy ≥ Normal ≥ Hard on both;
    - **no wall**: Hard `'lowCorner'` ≥ 0.15, and Normal `'oneOnOne'` ≥ 0.5;
    - **no soft goals**: `'roller'` is 0 on every difficulty.

  Keep each `it` under about 30 s locally. CI runs about 2× slower against the 90 s `testTimeout`.

- [ ] **Step 4: Freeze the scripts, then tune** as *Tuning Gus* says.
  - Freezing means `BLASTER`, `WORKER` and `GUS_TUNING_STATS` don't move from here on.
  - Write the ledger's first line with the untuned rates.
  - Follow the STOP rule if the bands and the lesson can't both be met.

- [ ] **Step 5: Run the suite and the baseline**

  Run: `npx vitest run && npx tsc --noEmit && npx tsx .superpowers/school-tools/baseline.mts after.txt && diff .superpowers/school-tools/baseline-rates.txt .superpowers/school-tools/after.txt`
  Expected: PASS, and `diff` prints nothing.

- [ ] **Step 6: Commit** with `feat: tune Goalie Gus to his lesson`.

---

### Task 7: His card, his tip, his sting, and Help

**Files:**
- Modify:
  - `src/meta/career.ts`: Gus's `tip`.
  - `src/scenes/vsScene.ts`: Gus is drawn from his keeper sprites; `gusSting` plays for him.
  - `src/audio/cues.ts`: `gusSting`.
  - `src/scenes/helpScene.ts`: his line after Sam's; `helpLineYs`, shared by `draw` and the fit test.
- Test: `src/meta/career.test.ts`, `src/scenes/vsScene.test.ts`, `src/scenes/helpScene.test.ts`, `src/scenes/venueScene.test.ts`, `src/audio/cues.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // career.ts: the school-boss entry
  tip: 'TIP: KEEP IT LOW. MAKE HIM DIVE.'
  // helpScene.ts
  /** Each line's top row on its page, and the bottom of the last line's text. */
  export function helpLineYs(lines: readonly string[]): { ys: number[]; bottom: number };
  // cues.ts
  export type Cue = /* ... */ | 'gusSting';
  ```

- [ ] **Step 1: Write the failing tests**
  - `career.test.ts`: every School match's tip is null except Gus's, which is `'TIP: KEEP IT LOW. MAKE HIM DIVE.'`.
  - `vsScene.test.ts`:
    - After one loss to Gus, `vsLines` ends with the tip, and the tip's measured width fits `BASE_W`. Before any loss there's no tip.
    - Gus's card plays `gusSting` and not `bossSting`. Sam's and Biscuit's play `bossSting`.
    - The card draws `art.keepers.gus.poses.ready.left.0`, not the partner's sprites.
    - **Review Focus 4**: Gus's top opaque row on the card (`PITCH_Y − anchor.y` plus the first opaque row of his ready frame) is below the tip line's bottom (`LINE_YS[3]` + the text's height).
  - `venueScene.test.ts` (**Review Focus 4**): Gus's face × `BOSS_FACE_SCALE` fits `BOSS_NODE.size`, and `FACE_AT.x` + the face's width ≤ `PANEL_TEXT_X`.
  - `helpScene.test.ts`:
    - THE MATCH page has `GOALIE GUS FILLS THE GOAL. HE CAN EVEN STOP THE WAVE.` right after Sam's line.
    - Every page's `helpLineYs(lines).bottom` is at least 2 rows above the footer row, `BASE_H − 18`.
  - `cues.test.ts`: `gusSting` exists, within the cue rules.

- [ ] **Step 2: Run them to see them fail**

  Run: `npx vitest run src/meta/career.test.ts src/scenes/vsScene.test.ts src/scenes/venueScene.test.ts src/scenes/helpScene.test.ts src/audio/cues.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  - `gusSting` is `bossSting`'s voices with every frequency × 0.75, plus two glove thumps (triangle 150→80 Hz, 0.09 s) at 0.55 s and 0.7 s.
  - The card draws Gus facing Harrison at `AWAY_X − anchor.x`, `PITCH_Y − anchor.y`.

- [ ] **Step 4: Run the suite**

  Run: `npx vitest run && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** with `feat: Gus's card, tip, sting and Help line`.

---

### Task 8: The GIF, the walk, the release review, and As built

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-school-field-design.md` (As built: plan 5)
- Scratch only (scratchpad or the gitignored `preview/`): the GIF, the stills, the playtest code.

- [ ] **Step 1: The baseline, the suite and the build**

  Run: `npx vitest run && npx tsc --noEmit && npm run build && npx tsx .superpowers/school-tools/baseline.mts after.txt && diff .superpowers/school-tools/baseline-rates.txt .superpowers/school-tools/after.txt`
  Expected: PASS, the build written, and `diff` prints nothing.

- [ ] **Step 2: The GIF, to the parent alone**
  - **The scene.** Start the dev server (`npx vite --port 5179 --strictPort --host 127.0.0.1`; check the port first). In the page, build Gus's match with the real match scene, on the in-page harness technique in `dev-environment-notes`.
  - **The staging.** First a high shot struck at him that he catches and claps. Then, after his drop kick and a kickoff, a low shot into the far corner past his slow dive.
  - **The frames.** Post them to the 5181 receiver, then assemble `preview/gus-save.gif` at 3× nearest with PIL.
  - **Sending.** Send it to the parent with `SendUserFile`, with a line on what it shows. Their look at it gates the merge.

- [ ] **Step 3: The browser walk**
  - **Context.** Use an in-memory `testContext` profile with the School open through tryout 8, so Harrison's real slots are never touched.
  - **What to see:**
    - the venue screen (Gus's face in the node and the panel);
    - the VS card, before a loss and after one (the tip);
    - Gus's match at exactly 3× (uniform 3×3 blocks, HUD `HARRISON 0-0 GUS`, Gus in cyan, MO in berry);
    - Harrison in PURPLE, putting MO in white;
    - a wave Gus braces;
    - a goal;
    - Results reading `GUS BEATEN! YOU MADE THE TEAM!`;
    - the Hub reading `STATE: COMING SOON`.
  - **Stills.** Stills of Gus go to the parent alone.

- [ ] **Step 4: The playtest code**
  - Encode a v7 save code with `saveCode.ts` from a tsx script. It has the School beaten through tryout 8 at 1 star each, stats Speed 7, Power 9, Jump 4, Control 6, Stamina 5, level 12, Golden Form and the Energy Wave, and 1500 coins.
  - Give the code to the parent for a spare slot, never slot 1.
  - Their feedback folds in only on their word, as separate commits with tests.

- [ ] **Step 5: The release review**
  - **The reviewer.** Dispatch a fresh reviewer on the most capable model with `superpowers:requesting-code-review`.
  - **Scope:**
    - `git diff 7a09e3e..HEAD`;
    - this plan and the spec;
    - the School end to end headless, against Harrisons the scripts never play: idle, wave spam (does a set Gus ever fail to brace, or brace when he shouldn't?), chip spam, parked in his own goal mouth, and standing in Gus's punt landing zone.
  - **After.** Fix every Critical and Important finding with a test. Record the minors as deferred. Re-run Step 1.

- [ ] **Step 6: As built**
  - Add "As built: plan 5" to the spec. On the pattern of plans 1–4, it covers:
    - his dials and measured rates;
    - the rulings;
    - the calls flagged to the parent;
    - the review's fixes and the deferred minors;
    - the parent's verdicts on the sheet and GIF.
  - Commit with `docs: record Goalie Gus as built`.

- [ ] **Step 7: Memory, then the finish**
  - Update `harrison-soccer-status` with where things stand.
  - Run `superpowers:finishing-a-development-branch`.
  - **Ask the parent before any merge into `main` and before any push.** Pages deploys on push. After a push, watch the deploy and check the live bundle.
