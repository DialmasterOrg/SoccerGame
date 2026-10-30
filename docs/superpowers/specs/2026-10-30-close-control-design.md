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
