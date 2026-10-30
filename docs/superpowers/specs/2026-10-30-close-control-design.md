# Close control: keeping the ball on a turn

Amends the main spec (`2026-10-22-harrison-soccer-design.md`) and the
fair-Max spec's turning fix (`2026-10-27-fair-max-design.md`, the
drag-back). Built on branch `worktree-dribble-control`, off `main` at
`1b497ca`, in its own worktree, so the State Championship design on
`state-championship-design` is never touched. The State Championship's
opponents are tuned after this ships, against the new dribble.

## Intent

Harrison's only feedback after playing the School Field (2026-10-30):
dribbling and moving around the field, it's too easy to lose the ball,
especially when turning or moving up and down the screen (in depth). It
happens at every venue.

He expected what happens in real soccer: when you turn with the ball,
you keep it. The parent's shape for the fix, in their words: it should
be linked to his Control; "there should always be a chance to lose
control of the ball, even if his control is maxed out"; and the chance
should depend on "how quickly he is changing his orientation while
moving... it's easier to maintain control while dribbling consistently
in one direction, but harder if you suddenly turn."

### What the code does today

Harrison's dribble is knock-and-chase (`contact.ts` `dribble`). When his
touch point (7 px ahead of him along his *current* run) comes within 7 px
of the ball, the ball is knocked on along his run at his speed plus his
Control's touch push (60 px/s at Control 1, 25 at Control 10). It rolls
ahead, he catches it up, and he touches it again. When he changes direction,
his touch point swings round with him, but the ball keeps rolling the old
way. The only turn that keeps it is the drag-back, which the fair-Max spec
added for pulling the stick straight back.

Measured on the School pitch (a headless drill, 30 cut timings each,
Speed 5). The table shows the share of cuts where his next touch sends the
ball his new way within 0.6 s:

| Cut | 20° | 45° | 60° | 90° | 135° |
|-----|-----|-----|-----|-----|------|
| at a run, Control 1/5/10 | 0 / .03 / 0 | 0 | 0 | 0 | 1 (drag-back) |
| at a sprint, Control 1/5/10 | .03 / .03 / .03 | 0 | 0 | 0 | 1 (drag-back) |

So today **any** change of direction loses the ball, even a gentle 20°
drift. The ball runs on 25-30 px past his line, and on a 90° cut 75-115
px. Control makes no difference. The computer players never suffer this,
because their brains steer at the ball every tick (and use `carry` for
their fakes). Harrison's stick doesn't steer at the ball.

## Goals

1. **The ball follows his turns.** With the ball his, a change of
   direction (a cut up or down the screen, a diagonal, a curve) plays it
   onto his new line.
2. **Control decides how reliably.** Higher Control loses it less often
   on the same turn.
3. **Never risk-free.** Every turn with the ball has some chance of a
   heavy touch, even at Control 10.
4. **Sharper and faster turns are riskier.** A sudden hard cut is riskier
   than a gentle curve through the same total angle. A cut at a sprint is
   riskier than the same cut at a run. Dribbling steadily one way is the
   safest, as today.
5. **A lost ball is a heavy touch.** It squirts off loose, roughly along
   his old line, and whoever gets there first has it.
6. **Every venue**, the Backyard and Park included (the parent's ask:
   their numbers change for the first time).
7. **Opponents stay about as hard as today**, retuned only lightly (see
   "Re-checking every opponent").

## Non-goals

- The computer players' dribbling, their `carry`, and their brains don't
  change.
- Straight-line dribbling doesn't change. He still knocks it a little
  ahead with each touch, and Control still sets how far.
- The drag-back (stick pulled back the other way along the pitch, the
  ball close) doesn't change, and stays the clean way to turn round. It
  gains a twin for turning round in depth (see "Turning round" below).
- The keep-out shield near his own goal (`keepOut`) doesn't change. It
  wins over a turn touch.
- Stopping with the ball doesn't change. Letting go of the stick still
  lets the ball roll on.
- No new art, sound, words, Help lines, controls or save change.
- The scripted Harrisons (the tuning yardsticks) don't change. They meet
  the new dribble as they are, so before and after compare like with like.

## Anti-goals (a failure even if it works)

- **A glued ball.** If turns become free, the game loses the "always a
  chance" the parent asked for.
- **The ball visibly snapping or teleporting** to his new line.
- **Untouchable Harrison.** Defenders must still win the ball the ways
  they do today: meeting it in front of him, a slide, a 50/50. His body
  still shields it only from behind.
- **Gentle moves losing it.** Small stick drifts and curves should
  practically never cost the ball, or it will feel random and unfair.
- **Opponents getting noticeably harder.**

## The rule

**His ball.** The ball is his to turn with when all of these hold:

- He touched it last (`touchedBy` is his team).
- It's on the ground.
- It's in his close-control zone: ahead of him within the reach where a
  dribbled ball runs between touches, and near his lane in depth.
- He's on his feet and running: not winding up, kicking, sliding, in the
  air, in a trick, in a drag-back, stumbling, fallen or blown.
- It's not at the opponent's feet, in the dog's mouth, or going through
  his legs (a nutmeg).

The existing `ballIsHis` (drag-back) and `maxHasBall` describe nearly the
same thing, so reuse them where they fit.

**The turn touch.** When his run turns more than a small angle away from
the ball's line, he plays it onto his new line. The ball leaves along his
new run at his speed plus his Control's touch push, as a normal touch
does, aimed so it meets his new line just ahead of him rather than jumping
there. A turn touch is a dribble touch: it uses the same cooldown, counts
as a touch for the power meter and the lastKind rules, and goes through
the same `canPlace` and goal checks. Gentle curves make several small
turn touches. One hard cut makes one big one.

**The risk.** Each turn touch has a chance of being heavy. The chance:

- grows faster than the turn's angle, so one 90° snap is riskier than
  three 30° steps (this is how "how quickly he turns" comes in);
- grows with his pace going into the turn, measured against his own run
  speed: a sprint is about twice a run, and slower than a run is safer
  still. The Speed stat itself adds no risk, so buying Speed never makes
  his dribbling worse. (My call: the builder check asked whether raw px/s
  should count. Run speed grows 1.42× from Speed 1 to 10, about as much as
  a sprint, so that would quietly punish every Speed upgrade.)
- shrinks with Control;
- is never zero.

**My targets** for one snap cut, as the chance of a heavy touch. These are
my guesses: the parent passed on a playtest spike and asked for a best
guess. The cut drill pins them as bands.

| One snap cut | Control 1 | Control 5 | Control 10 |
|--------------|-----------|-----------|------------|
| 90° at a run | ~25% | ~15% | ~6% |
| 90° at a sprint | ~45% | ~30% | ~12% |
| 45° at a run | ~6% | ~4% | ~2% |
| a 20° nudge at a run | ≤1% | ≤1% | ≤1%, but above 0 |

For a feel check: Harrison plays the School Field at about Control 5-6.
There he'd keep about 6 hard cuts in 7 at a run, and most gentle steering
would never cost him the ball.

Past 90° the chance keeps rising on the same curve, up to the point where
the turn becomes a turn-round (below).

**Not back at his own goal.** A cut whose new run heads back at his own
goal (within 60° of straight at it) gets no turn touch, and the ball
plays on as today. Turning round is still allowed in every direction, so
running at his own goal with the ball, he pulls back to turn upfield, as
today.

This is my call, made while planning. A spike of the rule without this
exception made the School's scripted Harrison concede far more goals:
Tia on Easy went from 0.23 conceded a match to 1.75, and the win rate
from .83 to .36. Of his 72 turn touches a match, 64 pointed back at his
own goal. The scripted Harrison runs round a ball it has just touched to
get goal-side, and close control kept the ball glued to it on the way.
With the exception in, Tia, Paige, Gus and Max were back at today's
rates, within noise. A player who wants to go back toward his own goal
with the ball is rare. When he does, the keep-out shield near his goal
already treats that run specially.

**Turning round.** A turn back against his run is a turn-round, not a
cut. That means the stick pushes back against the ball's line at least as
hard as the drag-back's `STICK_BACK` (0.5), which is about 120° or more.
It works like today's drag-back in every direction: he plants for the
drag-back's `TURN_S`, the ball is stopped and rolled round to his new
front, and he goes on with it. It's clean, and it costs him the plant, not
the ball.

- Along the pitch this is today's drag-back, unchanged.
- In depth (running up the screen, then pulling down) and on back
  diagonals it's new. Today those turns always lose the ball, and they're
  the "moving up and down" half of Harrison's complaint.
- My call, from the approved "the drag-back stays the clean way to turn
  round": deliberate reversals cost time, while hard cuts at pace risk the
  ball. His facing (left/right) changes only when the stick says so, as
  today.

**The heavy touch.** The ball squirts off between his old line and his
new one, nearer the old, faster than a normal touch (about twice the
push). He can't touch it again for a beat (about 0.3 s), so it runs loose.
After that it's an ordinary loose ball: he can chase it, and anyone
meeting it first has it.

**Defenders.** No new rule. Between touches the ball rolls loose, as
today. A defender meeting it in front of him takes it (or it's a 50/50),
slides still win it, and his body still blocks it from behind. A turn
touch never happens when the opponent has the ball or is playing it this
tick. It never sends the ball through a body, a net, a post or a fence.

## Re-checking every opponent

Every opponent is tuned against scripted Harrisons who dribble, so every
one is measured before and after:

- **Backyard:** Max, the crew (Brick, Leo, Tia, Pete), and Biscuit with
  the blocker and chaser scripts.
- **Park:** Sam with the racer and matador scripts, the stamina guard,
  and the trick checks.
- **School:** the keepers' drills and match, School Max, School Tia, Hank,
  Lola, Finn, Priya, Niko, Paige, and Gus (with his drills).
- Each opponent's personality checks are included.

The gitignored `.superpowers/school-tools/baseline.mts` in the main
checkout records most of these rates and can be extended to the rest.
Every rate that moves goes to the parent in a before/after table, moved
or not.

**The retune rule (the parent's call: "slightly retune the opponents,
but I don't want to make them too much harder"):**

With 64 seeds, any change to the dribble moves every rate by a few seeds
from noise alone (one seed is 0.016), and the scripted Harrisons (the
computer's brain, which steers at the ball) can lose or gain from the new
rule. So "harder" means the scripted Harrison's win rate fell by more
than 0.1 (about 6 seeds in 64).

- An opponent still inside its tested range, and not harder by that
  measure, is left alone, wherever it moved.
- If Harrison now wins more than its range allows, nudge its dials just
  back inside the range, at the easy edge. It still ends up a little
  easier than today.
- If Harrison now wins less than its range allows, or the opponent is
  harder by more than 0.1 even inside its range, retune it easier,
  aiming at today's rate.
- No retune makes an opponent harder than it is today. (My call: this
  settles the builder check's question of how "left alone inside its
  range" and "never harder" fit together.)
- Retune only the dials that don't change an opponent's personality or
  lesson: reaction, pace, clean-steal odds and the like.
- **Stop and bring the numbers to the parent** if an opponent can't get
  back inside its range without changing what it teaches. The same goes
  if a lesson bar breaks: the chaser and racer staying low against
  Biscuit and Sam, matador minus racer, the keeper drills' bands, or a
  kid's personality check. Never widen a band.

## Testing

- **A cut drill**, headless and in CI like `gusDrills`. It runs cuts at
  Control 1/5/10, at 20/45/90° and at a run and a sprint, over many cut
  timings, and pins the heavy-touch rates to bands around the table
  above. It also checks that a clean turn touch sends the ball his new
  way, that Speed 1 and Speed 10 at a run carry the same risk, and that a
  turn-round in depth and on a back diagonal keeps the ball.
- **Straight dribbling is unchanged:** a straight dribble at each Control
  touches the ball where and when it does today.
- **Unit tests** for each condition of "his ball", for the turn touch's
  aim, and for the heavy touch's shape and lockout. They use an injected
  roll, so no test depends on luck.
- **The whole suite**, typecheck and build stay green, with every tuning
  suite passing after any retune.

## Left to the builder

- The turn threshold angle.
- The exact chance curve, fit to the table.
- The size of the close-control zone.
- How the turn touch is aimed to converge on his line.
- The heavy touch's exact angle, speed and lockout.
- Whether to draw the heavy-touch roll from its own seeded stream. This is
  recommended: it keeps the other random events in every tuned match on
  their current sequence, so before/after rates differ only by the
  dribble.
- Where the code lives. It's probably a Harrison-only option on
  `resolveContacts` beside `keepOut`, used in both the Max/kid matches
  and the dog matches.

## Afterwards

The plan is written next (superpowers:writing-plans), then built inline.
When the build is done:

- a playtest save code for a spare slot, run on the dev server;
- the before/after opponents table and every call made, sent to the
  parent;
- a fresh review.

Ask before any merge into `main` and any push. There's no art in this
change. If any turns up, it goes to the parent alone.

## As built (2026-10-30)

Built inline over two sessions on `worktree-dribble-control` (1b497ca..HEAD). The parent made eight calls along the way; each is
below. Every number here is 64 seeds (100-163) unless it says otherwise; one seed is 0.016, and any change to Harrison's play re-rolls
every match, so a 64-seed rate moves about ±0.06 from noise alone.

### The rule as shipped (`src/game/closeControl.ts`)

- A turn touch fires when the stick points `TURN_MIN_DEG` (10°) or more off his dribble's line, short of a turn-round (`STICK_BACK`),
  with the ball his along that line, room for it at his new front (`canPlace`), and the new run not heading within 60° of straight at his
  own goal (`BACK_LIMIT` 0.5).
- Heavy-touch chance = `turnRisk(Control)` (0.25 at Control 1 to 0.06 at 10) × (angle / 90°)^2.2 × min(pace, 1.6)^1.6, pace being his
  speed over his own run speed. Rolled once per turn on `World.touchRng`.
- A heavy touch squirts the ball off 30% toward his new way at his speed + 2 touch pushes; he can't touch it for 0.3 s.
- A clean turn rolls the ball round to `FOOT_SPOT` ahead along his new run over `TURN_TOUCH_S` (0.15 s), riding his run as it goes, then
  knocks it on his new way (his speed + a touch push). The knock tick starts the ball one step short, so it moves once that frame, not
  twice. (The browser check found a ~7 px one-frame pop at the end of every clean turn before this; now the steps run 1.1 to 2.9 px.)
- Turning right round in any direction works like the drag-back (`Player.turnDir`).

**Cut drill (`cutDrills.test.ts`, 240 trials; 480 measured):** a 90° cut at a run gives the ball away .225 / .165 / .060 of the time at
Control 1 / 5 / 10, at a sprint .394 / .252 / .094. Sprint cuts sit a little under the design table (~45/30/12%), since a quarter of
snaps land just after a touch, when he has already slowed in the turn.

### Fixes beyond the plan

- **ALL_ROUND** (`ai.ts`): the all-round dials, Max's before close control. The crew, Sam, the tryout kids, Gus's partner and Biscuit's
  brace sense spread it; `DIFFICULTY` is Max's own copy, so retuning Max moves no one else.
- **A clean steal that can't take the ball is a poke** (`steal.ts` `canTake`): Harrison standing, no trap spot, the ball beyond his
  feet. It used to wrong-foot Max over a ball that never moved, again at every press (a stall, Pete Normal seed 152).
- **`Steer.into`** (`ai.ts`): steering to a ball a player means to play never stops short, so a ball wedged behind a goal line inside
  his reach still gets touched; and a speedster on the wrong side of a ball behind his own line goes at it when the fence leaves no room
  to go round (three stalls).

### Opponents: before / after / final

Before = 1b497ca; after = the rule alone (dd27c8c); final = as shipped. The keeper drills (long, corner, one-on-one, roller at levels 1
and 8, every difficulty) were identical to the digit throughout.

| Matchup | Before | After close control | Final | Final − before |
|---|---|---|---|---|
| max r10 easy | 0.875 | 0.969 | 0.844 | -0.031 |
| max r10 normal | 0.625 | 0.688 | 0.625 | +0.000 |
| max r10 hard | 0.016 | 0.109 | 0.016 | +0.000 |
| max r1 easy | 0.813 | 0.844 | 0.938 | +0.125 |
| max r1 normal | 0.813 | 0.781 | 0.719 | -0.094 |
| max r1 hard | 0.125 | 0.156 | 0.031 | -0.094 |
| crew brick easy | 0.828 | 0.906 | 0.813 | -0.015 |
| crew brick normal | 0.594 | 0.766 | 0.609 | +0.015 |
| crew brick hard | 0.031 | 0.031 | 0.031 | +0.000 |
| crew leo easy | 0.859 | 0.969 | 0.859 | +0.000 |
| crew leo normal | 0.625 | 0.641 | 0.625 | +0.000 |
| crew leo hard | 0.063 | 0.156 | 0.047 | -0.016 |
| crew tia easy | 0.766 | 0.859 | 0.813 | +0.047 |
| crew tia normal | 0.594 | 0.609 | 0.531 | -0.063 |
| crew tia hard | 0.000 | 0.016 | 0.031 | +0.031 |
| crew pete easy | 0.797 | 0.844 | 0.703 | -0.094 |
| crew pete normal | 0.641 | 0.656 | 0.547 | -0.094 |
| crew pete hard | 0.031 | 0.047 | 0.000 | -0.031 |
| sam racer easy | 0.188 | 0.219 | 0.156 | -0.032 |
| sam racer normal | 0.094 | 0.078 | 0.109 | +0.015 |
| sam racer hard | 0.109 | 0.047 | 0.141 | +0.032 |
| sam matador easy | 0.922 | 0.984 | 0.922 | +0.000 |
| sam matador normal | 0.609 | 0.906 | 0.828 | +0.219 |
| sam matador hard | 0.422 | 0.578 | 0.484 | +0.062 |
| dog blocker easy | 0.875 | 0.781 | 0.844 | -0.031 |
| dog blocker normal | 0.594 | 0.750 | 0.625 | +0.031 |
| dog blocker hard | 0.219 | 0.125 | 0.188 | -0.031 |
| dog chaser easy | 0.000 | 0.000 | 0.000 | +0.000 |
| dog chaser normal | 0.000 | 0.000 | 0.000 | +0.000 |
| dog chaser hard | 0.000 | 0.000 | 0.000 | +0.000 |
| stamina10 dog chaser easy | 0.000 | 0.000 | 0.000 | +0.000 |
| stamina10 dog chaser normal | 0.000 | 0.000 | 0.000 | +0.000 |
| stamina10 dog chaser hard | 0.000 | 0.000 | 0.000 | +0.000 |
| stamina10 sam racer easy | 0.203 | 0.234 | 0.203 | +0.000 |
| stamina10 sam racer normal | 0.141 | 0.094 | 0.078 | -0.063 |
| stamina10 sam racer hard | 0.156 | 0.172 | 0.125 | -0.031 |
| stamina10 sam matador easy | 0.984 | 1.000 | 0.922 | -0.062 |
| stamina10 sam matador normal | 0.781 | 0.859 | 0.859 | +0.078 |
| stamina10 sam matador hard | 0.547 | 0.688 | 0.516 | -0.031 |
| trick max plain easy | 0.875 | 0.969 | 0.844 | -0.031 |
| trick max plain normal | 0.625 | 0.688 | 0.625 | +0.000 |
| trick max plain hard | 0.016 | 0.109 | 0.016 | +0.000 |
| trick max trickster easy | 0.688 | 0.891 | 0.766 | +0.078 |
| trick max trickster normal | 0.672 | 0.578 | 0.516 | -0.156 |
| trick max trickster hard | 0.063 | 0.031 | 0.031 | -0.032 |
| trick max spammer easy | 0.438 | 0.250 | 0.266 | -0.172 |
| trick max spammer normal | 0.203 | 0.266 | 0.141 | -0.062 |
| trick max spammer hard | 0.047 | 0.016 | 0.031 | -0.016 |
| trick sam plain easy | 0.672 | 0.547 | 0.625 | -0.047 |
| trick sam plain normal | 0.516 | 0.547 | 0.531 | +0.015 |
| trick sam plain hard | 0.281 | 0.328 | 0.297 | +0.016 |
| trick sam trickster easy | 0.547 | 0.641 | 0.750 | +0.203 |
| trick sam trickster normal | 0.547 | 0.641 | 0.547 | +0.000 |
| trick sam trickster hard | 0.484 | 0.516 | 0.328 | -0.156 |
| trick sam spammer easy | 0.719 | 0.813 | 0.594 | -0.125 |
| trick sam spammer normal | 0.500 | 0.500 | 0.609 | +0.109 |
| trick sam spammer hard | 0.422 | 0.469 | 0.047 | -0.375 |
| keeperMatch easy L1 | 0.656 | 0.781 | 0.438 | -0.218 |
| keeperMatch normal L1 | 0.281 | 0.563 | 0.406 | +0.125 |
| keeperMatch hard L1 | 0.375 | 0.375 | 0.313 | -0.062 |
| school max easy | 0.813 | 0.922 | 0.750 | -0.063 |
| school max normal | 0.594 | 0.609 | 0.594 | +0.000 |
| school max hard | 0.063 | 0.172 | 0.031 | -0.032 |
| school hank easy | 0.828 | 0.844 | 0.828 | +0.000 |
| school hank normal | 0.578 | 0.594 | 0.531 | -0.047 |
| school hank hard | 0.047 | 0.125 | 0.031 | -0.016 |
| school lola easy | 0.766 | 0.922 | 0.859 | +0.093 |
| school lola normal | 0.594 | 0.750 | 0.672 | +0.078 |
| school lola hard | 0.063 | 0.047 | 0.063 | +0.000 |
| school finn easy | 0.781 | 0.875 | 0.844 | +0.063 |
| school finn normal | 0.531 | 0.594 | 0.609 | +0.078 |
| school finn hard | 0.047 | 0.188 | 0.063 | +0.016 |
| school tia easy | 0.828 | 0.859 | 0.828 | +0.000 |
| school tia normal | 0.563 | 0.734 | 0.578 | +0.015 |
| school tia hard | 0.063 | 0.188 | 0.078 | +0.015 |
| school priya easy | 0.875 | 0.875 | 0.844 | -0.031 |
| school priya normal | 0.578 | 0.734 | 0.594 | +0.016 |
| school priya hard | 0.078 | 0.172 | 0.094 | +0.016 |
| school niko easy | 0.813 | 0.813 | 0.875 | +0.062 |
| school niko normal | 0.547 | 0.547 | 0.531 | -0.016 |
| school niko hard | 0.047 | 0.031 | 0.031 | -0.016 |
| school paige easy | 0.797 | 0.797 | 0.891 | +0.094 |
| school paige normal | 0.609 | 0.656 | 0.625 | +0.016 |
| school paige hard | 0.031 | 0.094 | 0.063 | +0.032 |
| gus blaster easy | 0.375 | 0.531 | 0.281 | -0.094 |
| gus blaster normal | 0.141 | 0.141 | 0.125 | -0.016 |
| gus blaster hard | 0.016 | 0.125 | 0.031 | +0.015 |
| gus worker easy | 0.781 | 0.781 | 0.813 | +0.032 |
| gus worker normal | 0.641 | 0.688 | 0.516 | -0.125 |
| gus worker hard | 0.422 | 0.594 | 0.391 | -0.031 |

**Dials changed (each with a `Close control (2026-10-30)` comment):**
- Max: Normal paceFactor 1.03 → 1.055, Hard 1.1 → 1.16 (Easy unchanged).
- Brick: Easy reactionS 0.22 → 0.2 and cleanSteal 0.9 → 0.85; Normal paceFactor 1.05 → 1.06 and cleanSteal 0.75 → 0.6.
- Leo: Easy cleanSteal 0.9 → 0.7 and reactionS 0.22 → 0.2; Normal cleanSteal 0.65 → 0.5 and paceFactor 1.06 → 1.05; Hard paceFactor
  1.15 → 1.18.
- Speedy Sam: Easy reactionS 0.22 → 0.2; Hard reactionS 0.1 → 0.08 and cleanSteal 0.55 → 0.53; Normal unchanged.
- Biscuit: Normal dwellS 0.35 → 0.3.
- School Max: Easy paceFactor 1 → 1.02, Hard 1.1 → 1.14. Hank: Hard cleanSteal 0.55 → 0.45. Lola: Easy cleanSteal 0.9 → 0.75 and
  reactionS 0.22 → 0.17, Normal cleanSteal 0.75 → 0.71. Finn: Hard reactionS 0.1 → 0.08. School Tia: Normal reactionS 0.16 → 0.14,
  Hard paceFactor 1.15 → 1.2. Priya: Easy paceFactor 1 → 1.03 and reactionS 0.22 → 0.2, Normal paceFactor 1.03 → 1.05, Hard cleanSteal
  0.55 → 0.45. Niko: Normal reactionS 0.16 → 0.18.
- Gus's partner (BACKUP MO): Easy reactionS 0.22 → 0.2; Normal paceFactor 0.95 → 0.97 and reactionS 0.16 → 0.19; Hard paceFactor
  0.95 → 1.05 and cleanSteal 0.4 → 0.35. Gus's own keeper dials unchanged.
- Left alone (inside their ranges): crew Tia, Pete, Paige, the keepers.

### The parent's calls

1. Retune per the rule (too-easy opponents back to their range's easy edge).
2. Tricks vs Max on Normal: drop "tricks beat plain play" (on 192 seeds tricks never beat plain play, before close control either:
   .656 vs .682); keep the cap (no more than plain + 0.2), the beat-share floors and Hard ≤ .25. A trick multiplier was built, swept
   (×1.25 to ×2.5, wider windows) and reverted: only about one trick a match fools Max.
3. Mashing vs Sam: the guard holds on Normal only (on Easy, stop-start play makes Sam overshoot, his own lesson; only 2 of 40 mashed
   tricks fool him; 192 seeds before close control: .781 vs .583).
4. Sam Normal keeps his dials; the matador's Normal cap is 0.95 (192 seeds: .667 before close control, .844 after; racers and plain
   play unchanged; every dial that pulled it under .65 broke the Stamina-10 racer guard or made plain play much harder).
5. Sam's skid is measured as his own slide while fooled at speed (11.6 px vs a fooled Max's 2.0 on 192 seeds; 12.2 vs 2.1 before),
   not his gap to Harrison, which turning with the ball shortened.
6. Fix the end-of-turn pop and retune with margin: every out-of-band opponent two or three seeds inside its band.
7. Gus's follow-up check asks for at least one follow-up goal in 64 Normal matches, not three (192 seeds: 9 before, 6 after).
8. Hard Sam's matador cap is .55, not .45 (192 seeds: .505 before close control, .490 after his retune; no reaction or clean-steal dial
   held .45 on the test seeds with the racer beaten by .3, and fewer slides didn't help on 192 seeds).

### Rulings

- Straight dribbling unchanged: Task 1's before/after sweep was identical, 114 lines.
- The shield test uses stick (−0.45, 0.89): the plan's (−0.7, 0.7) is already refused by `BACK_LIMIT`.
- "Max playing the ball mid-roll" asserts the ball is played (his touch or a 50/50 squirt) and the roll ends: the roll's chord passes
  within his body radius, a fair 50/50 per the spec.
- A running touch cooldown blocks a turn touch (the rule needs it).
- The cut drill cuts 40 + phase % 40 ticks in, so a Stamina-1 sprinter isn't exhausted; 240 trials, not 120 (sampling luck at 120).
- Sprint cuts measure a little under the design table (see above).
- ALL_ROUND split (see above).
- Leo's long shots and Hank's headers are personality checks on Normal profiles; small dial nudges restored them (Leo: Normal pace
  1.05; Hank: back to his original clean steals, 6.39 headers vs 5.82).
- Biscuit's Normal retune uses dwellS (his stealing time): reactionS from .1 to .16 gave .56 to .75 with nothing in range.
- The trick stepover order (Max ≥ Tia ≥ Brick) is measured over 64 seeds, as Pete's is: 32 seeds held 4-7 fooling stepovers each.
- Max Normal pace 1.055, not 1.06: at 1.06 he missed scoring on an idle Harrison inside `ai.test`'s 30 s (seed 7; 32.5 s).
- Gus Normal's worker reads .516 on the test seeds (.641 before), but .557 vs .625 on 192 seeds, inside the never-harder rule, with the
  blaster at .146; every partner dial that kept the worker higher let the blaster past .15.
- The mashing guard vs Normal Sam is measured over 192 seeds (64 read .609 vs .549 after the carry fix; 192 read .484 vs .505).
- The "cut up the screen" test's spot check allows one tick of rolling friction (7.967 vs 8), from the carry fix.
- `Steer.into` changes the brain the scripted Harrisons also use, in three rare spots only (a ball wedged within reach in a pocket, a
  speedster with no room to go round), to end stalls the "nothing stuck" checks require.
- Fixed from the final review: a heavy turn touch dribbling at his own goal near it could squirt the ball into his own net past the
  shield (now the shield keeps that ball, as before); and a roll or drag-back pulled a keeper's held ball out of his gloves after a
  smother (a ball out of play now ends either).
- The two broader steal fixes tried first (any untrappable steal a poke; plus the ball beyond his feet) moved Max Normal to .766 and
  .828 and were dropped for the standing-only version.

### Flags

- Tricks against Max on Normal now lose to plain play (.516 vs .625; .578-.63 when the parent made call 2, at Max's old pace): the
  parent's call 2 accepts it.
- Other trick measures that moved more than .1 (no bar covers them): trick-script Hard Sam .484 → .328, mashing vs Easy Max .438 → .266,
  mashing vs Hard Sam .422 → .047.
- Gus Normal's worker .641 → .516 on the test seeds (.625 → .557 on 192, ruled above).
- Pete, left alone, moved a lot with the re-rolls: Easy .797 → .703, Normal .641 → .547. Max's first rung on Hard .125 → .031.
- School Max Easy kept paceFactor 1.02 from the first retune and now reads .750 (before .813); on 192 seeds .807 (at 1.0: .870), so the
  dial still holds him near his old rate.
- Pete Easy (.703, floor .7) and Paige Easy (.891, cap .9) were left alone inside their bands but sit within a seed of an edge: the
  next change to Harrison's play may knock them out.
- `keeperMatch` (an untested AI-vs-AI measure) moved: Easy .656 → .438, Normal .281 → .406.

### Deferred minors (final review)

- Turns are judged against the last touch's line (or his facing when there's none), not the ball's actual roll: 14% of scripted turn
  touches fired with the ball already within 10° of the stick, about one heavy touch from no real turn every 16 matches.
- A light pull back along the pitch (stick 0.25-0.5) now starts a turn-round, and his facing stays the old way for the 0.2 s plant.
- A steal tap mid-roll doesn't end the roll; clearing `home.turnTouch` in `trap()` would.
- `cutScripts` counts the roll's own knock as a kept touch (clean turns measure 3-4; the drill's bar is 1); the shot and trick mid-roll
  tests don't assert that only one rule moved the ball.
- 17 of the branch's commit subjects run over 50 characters.
- `RUNNING` and `BALL_LOW` are duplicated across `closeControl.ts` and `dragBack.ts`.
