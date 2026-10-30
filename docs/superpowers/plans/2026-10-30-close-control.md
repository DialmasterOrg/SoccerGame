# Close Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Harrison turns with the ball, the ball follows him onto his new line. Each turn risks a heavy touch: the chance grows with the turn's sharpness and his pace, falls with Control, and is never zero. Turning right round works like the drag-back in any direction. Every opponent is re-measured and only lightly retuned.

**Architecture:**
- **His dribble's line.** Each of his dribble touches records the direction it sent the ball (`Player.dribbleLine`).
- **The turn touch.** A new Harrison-only world rule in `closeControl.ts` runs each tick, next to the drag-back. It fires when the stick points more than 10° off that line, short of a turn-round, with the ball his along the line. It rolls once on the world's own touch stream: either a heavy touch (the ball squirts off loose) or a clean turn.
- **The clean turn.** For `TURN_TOUCH_S` (0.15 s) the ball is eased round to `FOOT_SPOT` ahead of him along his new run, with his own contacts quiet, exactly as the drag-back moves it. Then it's knocked on along his new run like a normal touch.
- **The turn-round.** The drag-back gains a direction (`Player.turnDir`). Today's pull-back along the pitch is unchanged. A stick pulled back against his dribble's line by `STICK_BACK` (≥ 120°) in any other direction starts the same plant-and-roll.
- **Not back at his own goal.** No turn touch when the new run heads within 60° of straight at his own goal (`n.x * upfield < -BACK_LIMIT`, with `BACK_LIMIT` 0.5). The spec's "Not back at his own goal" says why.
- **Where it was proved.** This mechanism was spiked in this worktree before the plan was written, then reverted. Measured over 60 cut timings at Speed 5, Control 1/5/10:
  - Heavy touches: 90° at a run .27/.10/.03; at a sprint .45/.23/.05.
  - Every clean turn ended with his dribble touches along the new run.
  - A depth turn-round kept the ball 30/30 at a run and at a sprint.
  - Two variants were tried and dropped:
    - **A velocity-driven roll:** Gus's worker fell to .25.
    - **An instant re-aim for small turns:** Paige on Normal fell to .38.
  - The position roll plus the own-goal exception is what holds the scripted Harrisons at today's rates. The whole sweep is in Task 5.

**Tech Stack:** TypeScript 7, Vitest 4, Node 20, tsx.

**Spec:** `docs/superpowers/specs/2026-10-30-close-control-design.md`. Read all of it. Its "The rule", "Re-checking every opponent" and the "My call" notes are the authority on behaviour, the retune rule and the targets.

## Global Constraints

- **Harrison only.** The computer players' dribbling, `carry`, brains and the scripted Harrisons' scripts don't change. The new rules run only for `w.home`.
- **Unchanged:** straight-line dribbling, today's drag-back along the pitch, the keep-out shield (`keepOut`), stopping (the ball rolls on), tricks, steals.
- **No** new art, sound, words, Help lines, controls, save fields or save-code change.
- **Randomness:** the heavy-touch roll draws only from `World.touchRng`, never `w.rng`. That keeps every other random event in every tuned match on its current sequence.
- **Every venue,** the dog matches included. The Backyard and Park rates may change, by the parent's ask.
- **Retune rule** (the spec's, verbatim in intent):
  - left alone inside its range unless the scripted Harrison's win rate fell by more than 0.1;
  - above its range → nudge just back inside, at the easy edge;
  - below its range, or fell by more than 0.1 → retune easier, aiming at today's rate;
  - no retune makes an opponent harder than today;
  - only dials that don't change personality or lesson;
  - **stop and send the parent the numbers** if a range or a lesson bar (chaser/racer low, matador − racer, keeper drill bands, a kid's personality check) can't be met that way. Never widen a band.
- **Git:**
  - Work in the worktree `/home/cdial/HarryGame1/.claude/worktrees/dribble-control` on branch `worktree-dribble-control`. Never touch `state-championship-design` or the main checkout's working tree.
  - Run `git status --short` before every commit.
  - Conventional Commits, 50/72, no AI attribution trailers.
- **Commands,** run from the worktree root:
  - one file: `npx vitest run <file>`
  - the whole suite: `npx vitest run` (about 2 minutes)
  - types: `npx tsc --noEmit`
  - build: `npm run build`
- **The rates tool:** `npx tsx .superpowers/dribble-tools/rates.mts <out>.txt` (gitignored; about 7 minutes; 114 lines). The "before" numbers are `.superpowers/dribble-tools/before.txt`, measured at `1b497ca`.
- **The spike:** `.superpowers/dribble-tools/spike/` (gitignored) holds it for reference: its diff, its `closeControl.ts` (env-var dials, a shared generator: not to copy as is), and its drill, turn-round, variant and trick scripts.
- **Ledger:** rulings and measured numbers go in `.superpowers/sdd/2026-10-30-close-control/progress.md` (gitignored), then into As built.
- **Approvals:**
  - Any art turns up → the parent alone.
  - Ask before any merge into `main` and any push. The repo is public, and Pages deploys on push.

## Review Focus

1. **A turn touch near a wall, a post or a net.** The rolled spot must be placeable (`canPlace`), or no turn touch happens and the ball plays on as today. Never through a net, never stuck in a fence. (Task 2 test: cutting toward the side wall with the ball against it.)
2. **Max reaching the ball during the 0.15 s roll.** His touch must win it: the roll ends when anyone else plays it, as the drag-back's does, and Harrison's contacts are quiet only during the roll. (Task 2 test.)
3. **A trick, shot, slide, jump or drag-back pressed during the roll.** Each ends the roll cleanly: the ball is left where it is and never moved by two rules in one tick. (Task 2 test: a trick press mid-roll; a shot wind-up mid-roll.)
4. **Kickoff and goals.** A roll or a turn-round in progress when play stops leaves nothing behind. `reset()` rebuilds the player, so the new fields must default to null. (Task 1 test.)
5. **The dog matches.** Biscuit's carried ball is never turned, and Harrison's contacts with a jinking dog still work when no roll is on. (Task 2 test: no turn touch while `dog.carrying`.)

---

### Task 1: The dribble's line, the touch stream and the new fields (no behaviour change)

**Files:**
- Modify: `src/game/player.ts`, the `Player` interface and `createPlayer`
- Modify: `src/game/contact.ts`, `dribble()`
- Modify: `src/game/steal.ts`, `trap()`
- Modify: `src/game/world.ts`: `World`, `WorldEvents`, `quietEvents`, `createWorld`
- Test: `src/game/contact.test.ts`, `src/game/world.test.ts`

**Interfaces:**
- Produces:
  - `Player.dribbleLine: { x: number; z: number } | null` (unit vector) is the way his last dribble touch sent the ball.
    - `dribble()` sets it to his run's unit direction on every knock (not on the keep-out trap).
    - `trap()` in steal.ts sets it to null.
    - It starts null.
  - `Player.turnTouch: { x: number; z: number; leftS: number } | null` is a clean turn's roll under way: his new run's unit direction and the time left. It starts null.
  - `Player.turnDir: { x: number; z: number } | null` is the unit direction a turn-round rolls the ball to. It starts null.
  - `World.touchRng: Rng` is created in `createWorld` as `seeded(seed ^ TOUCH_SEED)`, with `const TOUCH_SEED = 0x2f6b9d1` in world.ts.
  - `WorldEvents.turn: 'turned' | 'heavy' | null`, typed inline for now (Task 2 replaces it with its `TurnOutcome`). `quietEvents()` gives `turn: null`, and the `w.events = {...}` at the end of `stepWorld` sets `turn: null` for now.

- [ ] **Step 1: Write the failing tests**
  - In `contact.test.ts`: `it('a dribble touch records the line it sent the ball along')`. Run Harrison at (60, 80) px/s into the ball at his touch point, call `resolveContacts`, then `expect(p.dribbleLine!.x).toBeCloseTo(0.6, 9)` and `expect(p.dribbleLine!.z).toBeCloseTo(0.8, 9)`.
  - In `world.test.ts`:
    - `it('a new world has a touch stream of its own')`: two worlds with seed 7 draw the same first `touchRng()`, and it differs from the first `rng()` draw.
    - `it('kickoff clears the new dribble state')`: set `home.dribbleLine`, `home.turnTouch` and `home.turnDir`, call `placeForKickoff(w)`, then expect all three to be null.

- [ ] **Step 2: Run them to see them fail**
  Run: `npx vitest run src/game/contact.test.ts src/game/world.test.ts`
  Expected: FAIL (the properties don't exist).

- [ ] **Step 3: Add the fields, the line, the stream and the event slot as in Interfaces**

- [ ] **Step 4: Run the tests, the types and the whole suite**
  Run: `npx tsc --noEmit && npx vitest run`
  Expected: all pass (2048 + 3).

- [ ] **Step 5: Prove nothing moved**
  Run: `npx tsx .superpowers/dribble-tools/rates.mts task1.txt && diff .superpowers/dribble-tools/before.txt .superpowers/dribble-tools/task1.txt`
  Expected: no output.

- [ ] **Step 6: Commit**
  `refactor: record the dribble's line and a touch stream`

---

### Task 2: The turn touch (cuts up to 120°)

**Files:**
- Create: `src/game/closeControl.ts`
- Create: `src/game/closeControl.test.ts`
- Modify: `src/game/stats.ts` (add `turnRisk`), `src/game/stats.test.ts`
- Modify: `src/game/dragBack.ts`: export `DRAG_SIDE`, and add `ballIsHisAlong`
- Modify: `src/game/world.ts`: wire the rule into `stepWorld` and `dogContacts`
- Modify: `src/game/tricks.ts`: `startTrick` clears `home.dribbleLine`. The trick carries the ball, and afterwards his line falls back to his facing. (The spike showed a stale line set off a needless turn touch on a trick's exit; this held the spammer guard vs Sam on Easy.)

**Interfaces:**
- Consumes: Task 1's fields, `World.touchRng`, `WorldEvents.turn`.
- Produces:
  - `turnRisk(s: Stats): number` in stats.ts: `curve(s.control, 0.25, 0.06)`. This is the chance a 90° cut at a run gives the ball away.
  - In dragBack.ts:
    - `ballIsHisAlong(w: World, line: { x: number; z: number }): boolean`: the ball is low (`BALL_LOW`), ahead along `line` by 0 to `DRAG_REACH`, at most `DRAG_SIDE` off it, not in the dog's mouth and not at Max's feet.
    - `ballIsHis(w)` becomes `ballIsHisAlong(w, { x: home.facing, z: 0 })`, with behaviour identical.
  - In closeControl.ts:
    - `export type TurnOutcome = 'turned' | 'heavy'`. `WorldEvents.turn` becomes `TurnOutcome | null`.
  - In contact.ts, `keepingOut(p, ball, field, runX = p.vx)` gains the optional run direction it judges, so the turn touch can ask about his new run. Every existing call is unchanged.
    - The constants: `TURN_MIN_DEG = 10`, `BACK_LIMIT = 0.5`, `ANGLE_POWER = 2.2`, `PACE_POWER = 1.6`, `PACE_CAP = 1.6`, `TURN_TOUCH_S = 0.15`, and `HEAVY = { mix: 0.3, push: 2, lockS: 0.3 }`.
    - `heavyTouchChance(stats: Stats, turnDeg: number, pace: number): number` = `turnRisk(stats) * (turnDeg / 90) ** ANGLE_POWER * Math.min(pace, PACE_CAP) ** PACE_POWER`. Here `pace` is his speed ÷ `runSpeed(stats)`, so the Speed stat adds nothing.
    - `turnWithBall(w: World, intent: PlayerIntent): TurnOutcome | null` starts a turn touch, or returns null.
    - `stepTurnTouch(w: World, dt: number): void` runs a clean turn's roll.
  - `stepWorld` order:
    - `const turn = live ? turnWithBall(w, homeIntent) : null;` goes right after `startDragBack`.
    - `stepTurnTouch(w, dt)` goes right after `stepDragBack(w, dt)`.
    - In `contact`, home is quiet while `home.turnTouch !== null`, as for `turnS`.
    - The `dogContacts` gate adds `w.home.turnTouch === null`.
    - When `turn` is set, `kicks[0]` gets `touched: true` before `creditMeter`/`noteLastKind`. It counts as a dribble touch for the meter and `lastKind`.
    - `w.events.turn = turn`.

**The rule** (`turnWithBall`). Return null unless every one of these holds:
- **The match:** in play; no live wave; `!ballOutOfPlay(w)`; the ball not `through`.
- **Harrison:** `home.state === 'ground'` and `y === 0`; `turnS === 0`, `trick === null`, `turnTouch === null`, `stumbleS === 0`, `touchCooldown === 0`; running faster than 20 px/s.
- **The ball:** `ball.touchedBy === 'home'`.
- **The stick:** not centred; with `line = home.dribbleLine ?? { x: home.facing, z: 0 }` and `n` the stick's unit direction, `ballIsHisAlong(w, line)`, the angle between `n` and `line` at least `TURN_MIN_DEG`, and `n·line > -STICK_BACK` (export `STICK_BACK` from dragBack.ts).
- **The spot:** `canPlace(ball, home.x + n.x * FOOT_SPOT, home.z + n.z * FOOT_SPOT, w.field)`.
- **Not back at his own goal:**
  - `n.x * upfield >= -BACK_LIMIT`, where `upfield` is +1 for home, as `upfieldOf` in contact.ts (export it);
  - and `!keepingOut(home, ball, w.field, n.x)`. The keep-out shield wins: near his own goal, a turn toward it is left to today's dribble, which shields.

Then roll `w.touchRng() < heavyTouchChance(home.stats, angleDeg, speed / runSpeed(home.stats))`. Let `push = touchPush(home.stats) * home.handling.touchScale`.
- **Heavy:**
  - the ball's ground velocity = `unit((1 - HEAVY.mix) * line + HEAVY.mix * n) * (speed + HEAVY.push * push)`;
  - `touchCooldown = HEAVY.lockS`;
  - `dribbleLine = null`;
  - return `'heavy'`.
- **Clean:**
  - the ball's `vx`/`vz` = 0;
  - `turnTouch = { x: n.x, z: n.z, leftS: TURN_TOUCH_S }`;
  - `dribbleLine = n`;
  - `touchCooldown = TURN_TOUCH_S`;
  - return `'turned'`.

**The roll** (`stepTurnTouch`), modelled on `stepDragBack`:
- **Ends with the ball left where it is** (no move) when any of these happens:
  - play has stopped (`w.match.phase !== 'playing'`);
  - he's not on the ground;
  - a `trick` or `turnS` started;
  - anyone played the ball (it has any velocity or is off the ground);
  - the target isn't placeable.
- **Otherwise,** ease the ball toward `home + n * FOOT_SPOT` with `k = min(1, dt / leftS)`, and count `leftS` down.
- **At zero:**
  - the ball's ground velocity = `n * (speed + push)`;
  - `touchCooldown = TOUCH_COOLDOWN_S`;
  - `turnTouch = null`.

- [ ] **Step 1: Write the failing tests** in `closeControl.test.ts` and `stats.test.ts`, on staged worlds, as in `dragBack.test.ts`. Set `w.touchRng = () => 0.999` for clean turns and `() => 0` for heavy ones.
  - `turnRisk` is .25 at Control 1 and .06 at Control 10, linear between.
  - `heavyTouchChance` pins the spec's table (`toBeCloseTo(_, 2)`):

    | Cut | Control 1 | Control 5 | Control 10 |
    |-----|-----------|-----------|------------|
    | 90° at a run (pace 1) | .25 | .167 | .06 |
    | 90° at a sprint (pace 1.45) | .45 | .30 | .109 |
    | 45° at a run | .054 | .036 | .013 |

    - 20° at a run, Control 1 is ≤ .01.
    - Every turn of 10° or more is > 0 at Control 10.
    - The same pace at Speed 1 and Speed 10 gives the same chance.
  - `'a cut up the screen rolls the ball round to his new front, then knocks it on his new way'`: dribbling right, stick (0, 1). Expect:
    - `turn === 'turned'`;
    - after 0.15 s, the ball within 1 px of `home + (0, FOOT_SPOT)`;
    - its velocity along +z at his speed + touchPush;
    - `events.kicks[0].touched` true on the cut tick.
  - `'a heavy touch squirts off nearer his old line, faster than a touch, and he can't touch it for a beat'`: the angle of the ball's velocity is between the old line and the new one, nearer the old (< 45° off it for a 90° cut); its speed ≥ his speed + 1.9 × push; no home touch for 0.3 s; `dribbleLine` null.
  - `'no turn touch for a drift under 10°, nor when the ball isn't his'`: one case each:
    - 8°;
    - Max's last touch;
    - ball in the air;
    - ball 30 px ahead;
    - 12 px off his line;
    - winding up;
    - in a drag-back;
    - stumbling;
    - wave live;
    - dog carrying.
  - `'a stick pulled back 120° or more is left to the turn-round'`: stick at 130° → `turnWithBall` returns null.
  - `'a cut heading back at his own goal is no turn touch'`. In midfield, dribbling up the screen, stick (−0.9, −0.44): `turnWithBall` returns null. With stick (−0.4, 0.92) it returns `'turned'`.
  - `'near his own goal, a turn toward it is left to the shield'`. Harrison is dribbling up the screen 60 px in front of his own goal line, stick (−0.7, 0.7). Expect `turnWithBall` to return null and the next dribble touch to trap as `keepOut` does.
  - `'a goal or a whistle mid-roll ends the roll'`: set `w.match.phase = 'goal'` mid-roll. Expect `turnTouch` null on the next step and the ball not moved by the roll.
  - `'Max playing the ball mid-roll wins it: the roll ends and Harrison's feet stay quiet only while it lasts'`. (Review Focus 2.)
  - `'a trick or a shot pressed mid-roll ends the roll, and the ball is moved by one rule only'`. (Review Focus 3.)
  - `'a cut toward a wall with no room for the ball is no turn touch'`. Harrison is at z = BALL_R + 4 with the ball at the near wall, stick (0, -1). (Review Focus 1.)
  - `'the heavy roll draws from the touch stream only'`: spy on `w.rng` to show it isn't called during a turn touch.
  - In `tricks.test.ts`: `'starting a trick clears his dribble line'`.

- [ ] **Step 2: Run to see them fail**
  Run: `npx vitest run src/game/closeControl.test.ts src/game/stats.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `turnRisk`, `ballIsHisAlong`, closeControl.ts and the stepWorld wiring as above**

- [ ] **Step 4: Run the tests, the types, and the existing dribble/drag-back/steal/trick/nutmeg tests**
  Run: `npx tsc --noEmit && npx vitest run src/game/closeControl.test.ts src/game/stats.test.ts src/game/contact.test.ts src/game/dragBack.test.ts src/game/steal.test.ts src/game/tricks.test.ts src/game/nutmeg.test.ts src/game/world.test.ts`
  Expected: PASS. (Tuning suites may now fail. That's Task 5's work, not this task's.)

- [ ] **Step 5: Commit**
  `feat: keep the ball on a turn, with a heavy touch`

---

### Task 3: Turning round in any direction

**Files:**
- Modify: `src/game/dragBack.ts`: `startDragBack`, `stepDragBack`
- Test: `src/game/dragBack.test.ts`

**Interfaces:**
- Consumes: `Player.turnDir`, `Player.dribbleLine`, and `ballIsHisAlong` and `STICK_BACK` from Task 2.
- Produces: `startDragBack` keeps its signature and return. `stepDragBack` rolls the ball to `home + turnDir * FOOT_SPOT`.

**Behaviour:**
- Today's rule runs first and is unchanged. It also sets `turnDir = { x: newFacing, z: 0 }` and `dribbleLine = turnDir`.
- Failing that, a turn-round starts when all of these hold:
  - he's running faster than 20 px/s;
  - `ball.touchedBy === 'home'`;
  - with `line = dribbleLine ?? { x: facing, z: 0 }` and `n` the stick's unit direction, `n·line ≤ -STICK_BACK` and `ballIsHisAlong(w, line)`.
- The turn-round itself:
  - `turnS = TURN_S`;
  - `turnDir = dribbleLine = n`;
  - the ball is stopped (as today);
  - facing doesn't change. It changes only if his stick's x does, through `stepPlayer`, as now.

- [ ] **Step 1: Write the failing tests**
  - `'running up the screen, pulling the stick down turns him round with the ball'`. Expect:
    - `turnS > 0`;
    - after `TURN_S`, the ball within 1 px of `home + (0, -FOOT_SPOT)`;
    - facing unchanged.
  - `'a back-diagonal pull turns him round too'`: stick (0.6, -0.8) after running up.
  - `'pulling back along the pitch is today's drag-back'`: every existing drag-back test passes, plus `turnDir` equals `(newFacing, 0)`.
  - `'a 110° cut is a turn touch, not a turn-round'`: `turnS === 0` and `events.turn` set.

- [ ] **Step 2: Run to see them fail**
  Run: `npx vitest run src/game/dragBack.test.ts`
  Expected: FAIL on the new tests only.

- [ ] **Step 3: Implement as above**

- [ ] **Step 4: Run the drag-back, trick and close-control tests, and the types**
  Run: `npx tsc --noEmit && npx vitest run src/game/dragBack.test.ts src/game/closeControl.test.ts src/game/tricks.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `feat: turn round with the ball in any direction`

---

### Task 4: The cut drill (pins the feel in CI)

**Files:**
- Create: `src/game/cutScripts.ts`
- Create: `src/game/cutDrills.test.ts`

**Interfaces:**
- Produces:
  - `cutTrial(o: { control: number; speed: number; sprint: boolean; deg: number; phaseTicks: number }): { turn: TurnOutcome | 'none'; keptTouches: number }`.
    - It runs on a School-stage world with Max parked at (width − 30, 10) on `NO_INTENT`. Harrison starts at (300, 25) with the ball at (308, 25), `touchedBy: 'home'`. He dribbles right for `60 + phaseTicks` ticks, then holds the stick at `deg` (positive is up the screen) for 60 ticks.
    - `turn` is the first `events.turn` after the cut, or `'none'`.
    - `keptTouches` counts his dribble touches along the new run (within 20°) after any roll ends.
    - `touchRng` is the world's own: seed `1000 + phaseTicks`.
  - `cutRates(o, trials = 120): { heavy: number; turned: number; none: number }`, over `phaseTicks` 0 to `trials` − 1.
  - `turnRoundTrial(stick: { x: number; z: number }, sprint: boolean, phaseTicks: number): boolean`: he runs up the screen from (300, 40) for `18 + phaseTicks % 15` ticks, pulls the stick, and the result is whether the ball is ahead of him along the stick, within 30 px, 0.5 s later. The geometry is the spike's, chosen to stay clear of the walls.

- [ ] **Step 1: Write the drill tests**, all at Speed 5 unless named. Bands are wide enough for 120 trials:
  - Heavy rate, 90° at a run: Control 1 in .15 to .35, Control 5 in .08 to .25, Control 10 in .01 to .12.
  - Heavy rate, 90° at a sprint: Control 1 in .32 to .58, Control 5 in .18 to .42, Control 10 in .03 to .2.
  - 20° at a run: the heavy rate is ≤ .03 at every Control, and `turned + heavy` is 1 (every 20° cut is a turn touch).
  - Every clean 90° turn at a run and at a sprint has `keptTouches ≥ 1`.
  - Speed 1 and Speed 10, Control 5, 90° at a run: the heavy rates differ by ≤ .08.
  - `turnRoundTrial` keeps the ball in ≥ 28 of 30 for down and for back-diagonal (0.6, −0.8), at a run and at a sprint.
  - A straight dribble (deg 0) never makes a turn touch, at Control 1, 5 and 10.

- [ ] **Step 2: Run them**
  Run: `npx vitest run src/game/cutDrills.test.ts`
  Expected: PASS. If a heavy band misses, adjust only `ANGLE_POWER`/`PACE_POWER`/`turnRisk`'s ends within the spec's table, re-run Task 2's chance tests, and log it.

- [ ] **Step 3: Commit**
  `test: pin the feel of turning with the ball`

---

### Task 5: Re-measure every opponent and retune

**Files** (only the dials the retune rule allows, and only for the opponents that need them):
- Modify: `src/game/ai.ts` (`DIFFICULTY`, Max)
- Modify: `src/game/crew.ts` (`CREW_PROFILES`)
- Modify: `src/game/sam.ts` (`SAM_PROFILES`)
- Modify: `src/game/tryouts.ts` (`TRYOUT_PROFILES`)
- Modify: `src/game/gus.ts` (`GUS_PROFILES`, `GUS_PARTNER_PROFILES`)
- Modify, only if a pinned baseline literal must move to the new truth: `src/game/maxTuning.test.ts`'s `HARD_BASELINE`. Never widen a band.

**What the spike's sweep predicts.** This is `.superpowers/dribble-tools/spike2.txt`, the spike with the own-goal exception, against `before.txt`. It's noisy: the spike drew its rolls from a shared generator, not `touchRng`. Re-measure; don't retune from these numbers.

| Expect | Matchups (before → spike) | Test it would fail |
|--------|---------------------------|--------------------|
| Above range, nudge harder to the easy edge | Max r10 Normal .625 → .719; Brick Normal .594 → .750; Leo Normal .625 → .750; School Max Easy .813 → .953; Lola Easy .766 → .938 | Normal ≤ .7, Easy ≤ .9 |
| Above the Hard ceiling | Hank Hard .047 → .172; School Tia Hard .063 → .125 | `HARD_CEILING` .1 |
| Sam's bands | matador Normal .609 → .813, Hard .422 → .500 | matador N .4–.65, H .15–.45 |
| Gus | blaster Normal .141 → .219 (the lesson bar); worker Hard .422 → .563 | blaster N ≤ .15; worker H .15–.45 |
| Fell by more than 0.1, retune easier | Pete Normal .641 → .531 | the retune rule |
| **Likely STOP** | tricks vs Max Normal: plain .625 → .766, trickster .672 → .641 to .672 | `trickTuning`'s "tricks beat plain vs Max on Normal" |

What held: Biscuit's chaser stayed 0 (also at Stamina 10); the racer stayed ≤ .15 on Normal; matador − racer grew; the keeper drills were unchanged to the digit.

- [ ] **Step 1: Run the whole suite and the sweep**
  Run: `npx vitest run 2>&1 | tail -40` and `npx tsx .superpowers/dribble-tools/rates.mts after.txt`
  Then compare `before.txt` and `after.txt` line by line: a short Python diff printing each rate's change, with ±0.1 marked.

- [ ] **Step 2: Sort every failing test and every moved rate**
  Use the retune rule in Global Constraints. Write each verdict in the ledger as one of:
  - inside and left;
  - nudge harder to the edge;
  - retune easier;
  - STOP.

- [ ] **Step 3: STOP check, before any retune**
  If a lesson bar fails, send the parent the numbers and the options, then wait. The lesson bars are:
  - tricks vs Max and Sam;
  - the spammer guards;
  - the chaser and racer staying low;
  - matador − racer;
  - Gus's blaster;
  - the keeper drills;
  - a kid's personality checks in `describeTryout`.

  First try the cheap fixes that don't touch an opponent:
  - **The tricks bar:** starting a trick clears `dribbleLine` (Task 2 already does this). Then check whether a heavy touch or a roll fires on the trickster's exit cut. Count `events.turn` in the 1 s after a sold trick, using `.superpowers/dribble-tools/spike/tricks.mts` as the starting point.
  - **Gus's blaster bar:** this is an opponent retune (his partner's pace or reaction, on Normal only), not a lesson change.

  The options to put to the parent for the tricks bar:
  - (a) make the tricks stronger against Max, for example a longer fooled time on Normal;
  - (b) accept that plain play now beats Max as well as tricks do, and re-rule the check to "tricks no worse than plain by more than 0.06";
  - (c) something they suggest.

  Don't change the check without their word.

- [ ] **Step 4: Retune, one opponent and one difficulty at a time**
  - Sweep candidate dials without editing source, as in the memory notes: mutate `TRYOUT_PROFILES[id][d]`, `CREW_PROFILES`, `SAM_PROFILES`, `DIFFICULTY` or `GUS_*` in a scratch `tsx` script, and measure 64 seeds with the tuning file's own match helper.
  - Prefer the smallest change to one of: `reactionS`, `paceFactor`, `cleanSteal`.
  - A "nudge harder" lands just inside the easy edge: Easy ≤ .9 means aim .86–.89; Normal ≤ .7 means .66–.69; the Hard ceiling .1 means ≤ .094.
  - Then write the dial in source, with a one-line comment: `// Close control (2026-10-30): <old> → <new>`.
  - Re-run that opponent's tuning file. The opponent's other difficulties must still pass, along with Easy ≥ Normal ≥ Hard.

- [ ] **Step 5: Whole suite and sweep again**
  Run: `npx vitest run && npx tsx .superpowers/dribble-tools/rates.mts final.txt`
  Expected: all green. No opponent's rate is below today's by more than 0.1. No retuned opponent is harder than `before.txt`.

- [ ] **Step 6: The before/after table**
  Write the table: every line of `before.txt` against `final.txt`, the dials changed (old → new), and each verdict. Put it in the ledger now; it goes to the parent and into As built in Task 6.

- [ ] **Step 7: Commit**, one commit per opponent retuned, e.g. `fix: nudge School Max back into his Easy range`.

---

### Task 6: Browser check, playtest code, review, As built

**Files:**
- Modify: `docs/superpowers/specs/2026-10-30-close-control-design.md` (add "As built")

- [ ] **Step 1: Browser check** on the dev server, `npx vite --port 5179 --strictPort --host 127.0.0.1` (check `ss -ltnp | rg 5179` first; see the dev-environment notes in memory).
  - In a spare slot (never slot 1) start a School match. Using the in-page stepping harness (`window.__soccer`, hand-built InputFrames), dribble right and cut up.
  - Draw frames before, during and after the roll, and check the ball curves round with no jump.
  - Repeat at the Backyard.
  - These are stills of Harrison in play, not new art. They go to the parent with the report.

- [ ] **Step 2: A playtest code** for a spare slot, made like the memory notes' earlier codes: School open, Control 5, level 12. Give it to the parent with the dev-server URL.

- [ ] **Step 3: Whole-branch verification**
  Run: `npx tsc --noEmit && npx vitest run && npm run build`
  Expected: all green. Record the counts.

- [ ] **Step 4: A fresh reviewer** (superpowers:requesting-code-review) on `1b497ca..HEAD`. Fix any Critical/Important in their own commits; defer minors to As built.

- [ ] **Step 5: As built** in the spec: the dials as shipped, the drill's measured rates, the before/after opponents table from Task 5, every ruling from the ledger, deferred minors. Commit `docs: record close control as built`.

- [ ] **Step 6: Report to the parent and ask** (superpowers:finishing-a-development-branch): merge into `main`, push, or keep. Don't merge or push without their word.
