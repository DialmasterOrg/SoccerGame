# Keepers and the School Field (7c) — Design

Amends `2026-10-22-harrison-soccer-design.md` (the main spec) and follows
`2026-10-27-roadmap-after-the-park-design.md` (the roadmap),
`2026-10-27-the-park-design.md` (Plan 7b, the pattern a new venue
follows) and every later spec. Where they disagree, this document wins.
Anything it doesn't touch still stands.

## Intent

Plans 1–10 are live (`main` at `14de5b1`). Harrison has the Backyard, the
Park, skill moves, five save slots with Stamina, and the Locker Room. The
roadmap's next stop is **7c: keepers and the School Field**, the third
venue, with eight matches and the boss **Goalie Gus**.

Harrison asked for one more thing on 2026-10-28: from the School Field on,
**a bigger pitch in both length and depth, "more like a competition-sized
field", with bigger goals so a keeper has room to move in the goal.** The
Backyard and the Park stay as they are.

So 7c does three things at once:

- **A bigger stage.** From the School Field on, matches draw on a bigger
  canvas with every sprite at its native pixel size, on a pitch twice as
  long and twice as deep, with goals twice as wide.
- **Keepers.** A computer keeper in each goal, Harrison's own included,
  doing "normal keeper stuff" (his words, via the parent): moving to
  intercept the ball, sometimes diving to catch it, and drop-kicking it
  back out after a catch.
- **The School Field.** An autumn Saturday morning at a made-up school.
  Harrison is **trying out for the school team**: eight tryout matches
  against the team's regulars, then the captain and keeper, Goalie Gus.
  Beat him and he makes the team.

Harrison wants to be surprised by the opponents, so the cast's sheets and
GIFs go to the parent alone.

## What was decided

By the parent and Harrison, in the 7c brainstorm (2026-10-28):

- **The match canvas is 534×300** from the School Field on (Harrison
  picked option B of four shown at real size on his screen). Menus, the
  Backyard and the Park stay 320×180.
- **Harrison plays on a 1920×1080 monitor with the browser maximized.**
  Today's 320×180 shows there at 5× (a 1600×900 frame). 534×300 shows at
  3×: a 1602×900 frame, the menus' own size.
- **The pitch** is 1280 long and 128 deep, with goals 56 wide and 48 high,
  painted lines, boards as today, and Harrison's speeds, jump and kick
  power unchanged.
- **School Field matches last 120 real seconds** (the parent), and golden
  goal up to 60.
- **Every match clock counts down** (the parent: "that makes it a lot
  easier to see how long is left"), the Backyard and the Park included.
- **Keepers** play as below; Harrison's three points are the core.
  **Harrison's own keeper always plays at Normal:** the difficulty
  setting changes only the opponents (raised by the builder check, the
  parent's answer).
- **The look is an autumn Saturday morning** (Harrison picked it over a
  sunny-day sketch).
- **The cast is "Tryouts"** (option 1 of three), with the roster, lessons
  and bonuses below, and Gus's design below.
- **The work is five plans,** on one branch with one merge after Gus.

**The designer's proposals that the parent heard played back and accepted**
are everything else in this document unless marked *(designer's call)*,
which means it was decided while writing and is the builder's to revisit
with the parent if it doesn't work.

## The match canvas

- **School Field matches (and every later venue's) draw on a 534×300
  canvas.** Every sprite, the ball, the goals and the pitch effects stay at
  their native pixel size; the canvas simply shows more of the world.
- **Everything else stays 320×180:** the title, Hub, road map, venue
  screen, VS card, Results, Shop, Locker Room, Help, Options, saves, and
  every Backyard and Park match.
- **Scaling stays whole-number, as today** (`computeViewport`): each scene
  says what size it draws at, and the screen fits whichever is showing by
  the largest whole scale. On Harrison's screen both come out at the same
  frame (1600×900 and 1602×900). On other screens the match frame comes
  out a little smaller than the menus' (on a maximized 4K window at
  dpr 1.25: the match at 6×, 3204×1800; the menus at 11×, 3520×1980). That
  is accepted.
- **The camera** keeps today's behaviour (follows the ball with smoothing
  and look-ahead, clamped to the pitch). Its view width and the screen row
  of the near touchline become settings of the view instead of the
  constants `VIEW_W` and `NEAR_SY`, so the Backyard and the Park keep 320
  and 176 exactly. In the mockups the near touchline sat 4 rows above the
  bottom (row 296) *(builder may move it)*.
- **Venue art and goal sprites are built from any field,** not from the
  Backyard constant (`goalSprites`, `pitchGround` and the end fences read
  `BACKYARD` today).
- **The match world reads its field from `world.field`** already (physics,
  goals, AI). The School Field is a new `Field` value plus whatever the AI
  needs to know about pitch size (see *The cast* and *Keepers*).
- **Tests cover both views.** The Backyard and the Park draw and play
  exactly as today; their snapshot and tuning tests pass unchanged.

## The pitch

All School Field numbers below were drawn in the brainstorm mockups and
approved; the builder may nudge them, keeping the spirit.

- **Size: 1280 long × 128 deep** (today 640 × 64). On the 534 canvas
  about 42% of the length is in view (today 50%).
- **Goals: 56 wide × 48 high** (today 28 × 28). Left goal line at x 40,
  net back at 20; right goal line at 1240, net back at 1260; posts at
  z 36 and 92; crossbar underside at 48, thickness 2. End fences' inner
  faces at x 4 and 1276. A keeper standing in the middle blocks about a
  fifth of the goal; a dive reaches most of it but not the corners.
- **Painted white lines:** both touchlines, both goal lines, the halfway
  line and centre circle, both penalty boxes, both goal areas and the
  penalty spots. In the mockups: penalty box 110 out from the goal line
  and z 10–118; goal area 36 out and z 26–102; spot 76 out; circle radius
  36. **No rule uses them except one:** the penalty box is the area each
  keeper guards and never leaves. There are still no fouls, penalties,
  throw-ins, corners or goal kicks.
- **Boards as today:** solid chain-link fences at both ends and along the
  far touchline, and an invisible board along the near touchline. A ball
  over the bar or past the end bounces back into play.
- **Harrison's speeds, jump and kick power don't change.** They're his
  Shop stats and should feel the same everywhere. Running from his own box
  to theirs takes about 8 s at Speed 6 (about 4 s today); a full-power
  shot takes about 2 s to cross the whole pitch, so long shots become
  something a keeper can save. Ball physics are unchanged.
- **Kickoff** is from the centre spot (x 640, z 64), the side that
  conceded kicking off, as today. The keepers stand in their goals.
- **Every guarantee Plans 2–10 made still holds** on the new pitch: bodies
  and the ball stay inside the field, never in a goal frame or its roof,
  never stuck. The one exception is a keeper blown into his net by the
  Energy Wave (see *Keepers*).

## Match length and the clock

- **School Field matches last 120 real seconds** (the Backyard and Park
  keep 90). **Golden goal** lasts up to 60 s at the School Field
  *(designer's call: in step with the longer match)* and stays 45 at the
  Backyard and Park. Still tied after it: a draw, as today.
- **The clock counts down in every match,** in real minutes and seconds:
  `2:00` to `0:00` at the School Field, `1:30` to `0:00` at the Backyard
  and Park *(m:ss is the designer's call)*. In golden goal the GOLDEN GOAL
  banner shows as today and the clock counts golden goal's own time down
  (`1:00` or `0:45` to `0:00`) in gold *(designer's call)*.
- **The Backyard's rung 7 bonus** reads `SCORE IN THE FIRST 30 SECONDS`
  in place of `...30 MINUTES`. The rule is unchanged: a goal in the first
  30 real seconds of a 90-second match. Anything else that shows or keys
  on a game minute keeps its meaning; how the match stores time is the
  builder's.
- The countdown and the reworded bonus are **the only changes the
  Backyard and the Park see** in 7c.

## The HUD and effects at 534×300

- **The HUD is laid out fresh for 534×300, with its text at twice the
  font size** (a 320×180 HUD doubled won't fit: 534 isn't a whole multiple
  of 320). That covers the score line, the clock, the stamina bar, the
  POWER meter, the off-screen ball arrow, the big banners (GOAL!!!, KICK
  OFF, FULL TIME, GOLDEN GOAL, `GUS SCORES`) with the goal callout and
  BONUS DONE!, and the pause menu. On Harrison's screen the score text
  comes out slightly bigger than today (6 screen pixels per font pixel,
  today 5).
- **Effects on the pitch stay at native pixels,** the same size next to
  the players as today: the aura, the beam, the shot trail, speed lines,
  skids, the outfit effects, the charge bar and power-up bar, the impact
  silhouettes, shadows.
- **The small callouts over a player** (PERFECT, SHOOT!, STEPOVER!,
  RAINBOW FLICK!) stay at today's font size *(designer's call)*: their
  size next to him doesn't change, and on his screen the letters come out
  about 18 px tall.
- The goal moment's flash covers the whole canvas; its shake keeps
  today's pixel sizes.

## Keepers

### How they play

- **Each goal has one,** the opponent's and Harrison's own. Harrison only
  ever controls himself; both keepers are computer players that play by
  the same rules.
- **Bodies:** a regular keeper has the same physics body as every player
  (Goalie Gus is bigger). Players can't pass through a keeper.
- **Where they go:** inside their own penalty box, never out of it.
- **Moving to intercept** (Harrison's point 1): he shuffles across his
  goal to stay between the ball and the goal, steps off his line as the
  ball comes closer to narrow the angle, and comes out to grab a loose
  ball in his box he can reach first, or to meet a dribbler who's through
  on goal and smother the ball at his feet.
- **Shots** (point 2): he reads where a shot will cross his line and moves
  there; when he can't get there on his feet, he **dives**. He **catches**
  what he can hold. A shot that's too hard or at the edge of his reach is
  **pushed away** instead: wide, over, or back out, so there are rebounds
  to chase. Which shots are too hard comes from his skill, the shot's
  speed and how far he has to reach: a PERFECT strike, or a volley or
  header from close in, is more often pushed away.
- **High balls:** he catches or punches what he can reach. A chip over a
  keeper who has come off his line goes in.
- **After a catch** (point 3) he **holds the ball** for a moment (about
  1.5 s, the builder's), standing still; nobody may play the ball or
  challenge him while he holds it, and players don't crowd him. Then he
  **drop-kicks it long upfield**, landing around the halfway line or
  beyond, toward his side's attacking half, with some spread. **No throws
  or rolled passes.** A drop kick is never a shot on goal.
- **Harrison's keeper always plays at Normal** (the parent: Easy only
  makes the opponents easier, Hard only makes them harder to beat). He
  keeps pace with the venue: in each tryout he's exactly as good as that
  match's opposing keeper is on Normal, whatever the difficulty setting.
  So on Normal the keepers cancel out; on Easy only the other keeper is
  weaker, and on Hard only the other keeper is sharper. Against Gus he
  plays at tryout 8's keeper's Normal level *(designer's call)*. Changing
  the difficulty mid-match never changes him.
- **The Energy Wave beats any keeper.** If the beam reaches a keeper, he's
  blown back into his net with the ball and it's a goal, as the main spec
  says a keeper is by the Blaze Shot's top tier. Being blown in is the one
  time a body enters a goal: he lands inside the net and walks back out.
  **Goalie Gus is the exception** (see below). The outfield opponent backs
  off a powered-up Harrison by the fair rules, as today.
- **Tricks:** a keeper who comes out to meet Harrison can be fooled when
  he's squared up at the sell, like an outfield opponent: a stepover sends
  him diving the wrong way, and a rainbow flick lifts the ball over him.
  The skill-moves spec's wise and cooldown rules apply.
- **Harrison's steal and slides** do nothing to a keeper holding the ball.

### How good they are

- **They get sharper through the School Field.** The first match's keeper
  is slower and catches less; each later one is a bit better. Easy,
  Normal and Hard apply to the **opponents' keeper** as to every
  opponent, mid-match included; Harrison's keeper stays at Normal (above).
  Every tuning band in this document is measured with Harrison's keeper
  at Normal, the only level he plays.
- **Targets on Normal, against the venue's first keeper:**
  - long shots from outside the box are mostly saved (about 3 in 4);
  - a well-placed shot from inside the box into a corner scores about
    half the time;
  - going one-on-one and waiting for the keeper to commit, then going
    round him, chipping him or using a stepover, scores most of the time.
  Easy lets in more, Hard fewer.
- **No wall:** every keeper can be beaten by a normal shot, with no trick
  or power move. A test pins it.
- **No soft goals:** every keeper, Harrison's above all, always stops a
  slow ball coming straight at him (no slow roller under a dive), on
  every difficulty and at every level through the venue. A test pins it.
- **Scores look like football:** School Field matches end with a few
  goals a side, not ten.
- **Measured in CI** like every opponent, with scripted Harrisons in
  headless matches (a long-shooter, a corner-placer and a one-on-one
  player; scripts, measures, seeds and bands are the builder's). The
  keepers' dials are the builder's: reaction, positioning error, how far
  he comes out, dive reach, the catch-or-push line.

### The keepers' cast

- **STEADY EDDIE**, Harrison's keeper: a fellow trialist, the same in
  every School Field match *(name is the designer's; it stands unless the
  parent changes it at the sheet)*.
- **Two backup keepers** take turns in the opponents' goal through the
  eight tryouts, each a bit sharper than the last. Unnamed on the HUD;
  their looks are the builder's.
- Every keeper wears a keeper's top unlike any kit in the game, with
  gloves.

### Keeper art

In this side view the goal mouth runs into the screen, so **a dive goes up
the screen (toward the far post) or down it (toward the near post)**, not
sideways. Keepers need new poses on the shared body system: a ready
crouch, a shuffle, a dive toward each post, a catch, a push-away, holding
the ball, the drop kick and getting up. A dive must read clearly in the
oblique view. The keepers' sheet and GIF go to the parent (see *Art and
approval*).

## The School Field in the career

### The catalog

The School Field joins the catalog as data: eight matches and a boss,
each with a stable id the save keys on.

| # | Id | Opponent (HUD name) | How they play | Bonus | Settled |
|---|---|---|---|---|---|
| 1 | `school-1` | MAX (MAX), returning | trying out too: Max's all-round game, tougher than rung 10 | SCORE FROM OUTSIDE THE BOX *(new)* | in play |
| 2 | `school-2` | HEADER HANK (HANK) | wins high balls | SCORE A HEADER | in play |
| 3 | `school-3` | LOFTY LOLA (LOLA) | chips any keeper off his line | SCORE FROM A CHIP | in play |
| 4 | `school-4` | FAKE-OUT FINN (FINN) | shapes to shoot, then dribbles | WIN THE BALL WITH 3 STEALS | in play |
| 5 | `school-5` | TRICKY TIA (TIA), returning | her fake now ends in a shot | KEEP A CLEAN SHEET | full time |
| 6 | `school-6` | POACHER PRIYA (PRIYA) | follows every shot in | SCORE A REBOUND *(new)* | in play |
| 7 | `school-7` | NUTMEG NIKO (NIKO) | slips it through his legs | SCORE A PERFECT STRIKE | in play |
| 8 | `school-8` | PINPOINT PAIGE (PAIGE) | sets herself, then picks a corner | DON'T LET PAIGE SCORE *(new)* | full time |
| Boss | `school-boss` | GOALIE GUS (GUS) | captain and keeper | PUT 3 PAST GUS *(new)* | in play |

- **New bonuses**, each a pure function of the match summary, which
  records what it needs:
  - `SCORE FROM OUTSIDE THE BOX`: one of Harrison's goals came from a
    kick he struck with the ball outside the opponents' penalty box.
  - `SCORE A REBOUND`: one of Harrison's goals came from a kick he struck
    within about 2 s of the opponents' keeper pushing the ball away.
  - `DON'T LET PAIGE SCORE`: the same rule as Biscuit's and Sam's.
  - `PUT 3 PAST GUS`: Harrison scores at least 3 against Gus.
- **The venue's stars are out of 27;** the career after 7c reaches 75.
  The coin milestones stay 10 / 25 / 50 / 75 *(designer's call: the
  roadmap's extra steps such as 100 and 125 aren't reachable until the
  State Championship, so they belong to its design)*.

### Unlocking and progress

- **The School Field opens when Speedy Sam is beaten** (the Park is
  done). Before that its stop stays LOCKED, as today.
- Matches unlock in order by winning; Gus unlocks once match 8 is beaten.
  A School match is **beaten** when its stars are at least 1, as in the
  Park. The **next match** is the first unbeaten match in the first venue
  that isn't done: rungs, Biscuit, Park 1–4, Sam, School 1–8, Gus. Once
  everything open is beaten, it's Gus, as a replay.
- Replays, stars that only go up, loss streaks and milestones all work as
  in 7a and 7b.

### The road map

- **A sixth stop, STATE, joins the road** between the School and the
  Stadium (the roadmap's State Championship). Spacing for six stops is
  the builder's.
- Once Sam is beaten, the School's stop is a **postcard** like the Park's
  (a crop of the autumn art in a gold frame, SCHOOL FIELD and `0/27`).
- Once Gus is beaten, the **STATE** stop reads COMING SOON in place of
  LOCKED. It can't be entered.

### The venue screen

- Title `SCHOOL FIELD`, `STARS n/27`, eight numbered nodes and Gus's boss
  node (a silhouette until unlocked). With eight nodes the layout is the
  builder's (two rows are fine).
- **Matches are called tryouts** on this venue's screens *(designer's
  call)*: the panel reads `TRYOUT 3 - LOFTY LOLA` (`GOALIE GUS` for the
  boss), then the blurb, bonus, stars and `A PLAY   B BACK`.
- **Blurbs state facts only** (wording the builder's):
  - Max: `HE'S TRYING OUT TOO. HE'S GOT BETTER.`
  - Hank: `HE WINS EVERY BALL IN THE AIR.`
  - Lola: `SHE CHIPS ANY KEEPER OFF HIS LINE.`
  - Finn: `HE SHAPES TO SHOOT. THEN HE DOESN'T.`
  - Tia: `SHE MOVED TO YOUR SCHOOL. HER FAKE IS SHARPER.`
  - Priya: `SHE FOLLOWS EVERY SHOT IN.`
  - Niko: `HE PUTS IT THROUGH YOUR LEGS.`
  - Paige: `THE TEAM'S TOP SCORER. SHE PICKS A CORNER.`
  - Gus: `THE CAPTAIN. HE FILLS THE WHOLE GOAL.`
- The autumn School Field drifts behind it, with Harrison juggling, as on
  the other venue screens.

### The Hub, the VS card, Results and Help

- **Hub career lines** (wording the builder's): `NEXT: LOFTY LOLA -
  SCHOOL FIELD 3/8` and her blurb; `NEXT: GOALIE GUS` and `THE SCHOOL
  BOSS!`; once Gus is beaten, `YOU MADE THE TEAM! STARS 24/27` and
  `STATE: COMING SOON`.
- **The VS card:** `TRYOUT 3` with `HARRISON VS LOFTY LOLA` over the
  School Field, the bonus line; for Gus, `GOALIE GUS - SCHOOL BOSS` with
  his boss sting. Whether keepers appear on the card is the builder's.
- **Gus's tip:** once Harrison has lost to Gus, Gus's VS card adds `TIP:
  KEEP IT LOW. MAKE HIM DIVE.` until he wins. The tryout kids get no tip.
- **Results' career news:** `TRYOUT 3 PASSED!`, `GOALIE GUS AWAITS!`
  after tryout 8, `GUS BEATEN! YOU MADE THE TEAM!`, and `NEW BEST: 3
  STARS!` on an improved replay. Once Gus is beaten, NEXT MATCH becomes
  CAREER as after Biscuit and Sam.
- **Help** gains one line about Gus, there from the start like Biscuit's
  and Sam's, and one line saying keepers guard the goals from the School
  Field on (facts only; wording the builder's).

## The School Field's look

- **An autumn Saturday morning,** as the approved sketch: a pale morning
  sky with a low sun and thin clouds; a hazy far tree line; a two-storey
  pale-brick school with a flat roof, a canopy over navy doors, a plain
  sign with no words or crest, and a flagpole with a plain striped flag;
  a yellow school bus parked beside it; big orange and gold trees; small
  aluminium bleachers on the far touchline with kids and parents
  watching; chain-link fences along the far touchline and at both ends;
  fallen leaves along the fence foot and scattered over the far part of
  the pitch. Its warm oranges set it apart from the Park's summer greens.
- **A made-up school,** not Harrison's: no name, crest or anything taken
  from a real school.
- **Four parallax layers** like the other venues (far, mid, near,
  ground), drawn fresh in the game's art style at the 534×300 height. The
  sketch is the direction, not the art.
- **Life** *(designer's call, like the Park's joggers)*: the bleacher
  crowd bobs and cheers on goals, the flag ripples, and a few leaves drift
  across. Scenery never touches play.
- The goals use goal sprites built from the School Field's goal.

## The cast: the fair rules

Every human opponent at the School Field plays by the rules that made Max
fair, as in the Park (the fair-Max and Park specs are the authority):
Harrison's steal button with each opponent's clean-steal odds, the
wrong-footed beat, the kickoff hold, the keep-out zone, the sideways
slide clear and drag-back, backing off a powered-up Harrison with Max's
braceSense and backOffS, the skill-moves rules for being fooled, and
Easy / Normal / Hard. Each opponent has its own three difficulty
profiles, every Easy number gentler than Normal's and every Normal gentler
than Hard's. Distances in Max's profile that assume today's pitch
(kickoff spots, shooting ranges, the keep-out zone's depth) are set for
the bigger pitch per opponent *(the builder's)*. None of them has a power
move.

## The cast

Each kid uses the shared human body system with their own head (side,
three-quarter and front), hair, skin tone and kit, as varied a bunch as
the Park crew. Their physics bodies are Max's size *(designer's call; a
bigger body drawing for Hank is welcome on the same physics body)*. No
two kits alike, none red like Harrison's home kit, none blue like Max's.
The palette may grow as the Park's did, with its cap moved deliberately.
Each plays differently, not just with different numbers.

1. **MAX, returning.** He's trying out too: Max's all-round game, with
   better stats and a harder profile than rung 10. Harrison's first taste
   of keepers against a familiar face.
2. **HEADER HANK.** Wins high balls: he reads where a keeper's drop kick,
   a chip or a big bounce will come down, gets under it and heads it on,
   at goal when in range. He heads Harrison's chips and lofted balls
   clear. Both keepers drop-kick long, so high balls come all match.
   *Lesson:* keep it on the ground.
3. **LOFTY LOLA.** Chips any keeper who has come off his line once she's
   in range, and chips over a Harrison who charges at her head-on.
   *Lesson:* close her down before she reaches the box.
4. **FAKE-OUT FINN.** Shapes to shoot, and if Harrison slides or reaches
   in, cuts the ball past him; if Harrison waits, he shoots for real or
   fakes again. **He fakes only Harrison, never Harrison's keeper,**
   because Harrison can't control his keeper. *Lesson:* don't dive in,
   wait for the real touch.
5. **TRICKY TIA, returning.** She moved to Harrison's school. Her Park
   fake (the lean, the cut into the room) now ends in a shot at goal;
   stats and profile tougher than in the Park. *Lesson:* stay goal-side.
6. **POACHER PRIYA.** Follows every shot in, and goes for any ball a
   keeper pushes away; when Harrison attacks she lingers upfield for the
   counter. *Lesson:* track back, and clear the loose ball.
7. **NUTMEG NIKO.** When Harrison stands still and square in his path,
   close in, Niko pushes the ball through his legs and runs round him. A
   Harrison who's moving or side-on can't be nutmegged. Bodies stay
   solid: only the ball goes through. *Lesson:* stay side-on and moving.
8. **PINPOINT PAIGE.** The team's top scorer. She takes a touch to set
   herself, then shoots for a corner with little error, and only with a
   clear look: a Harrison standing in her line blocks it. *Lesson:* get
   in her line before she sets.

**Stats** are the builder's, each kid a little stronger overall than the
one before, starting above rung-10 Max, with one standout stat apiece
(Hank's Jump, Paige's accuracy and Power, and so on).

### Measuring the cast

Like the Park crew, each kid gets a tuning test with a scripted "decent
kid" Harrison, updated for keepers and the bigger pitch (he places shots,
follows up rebounds), at stats one level above the kid's, on fixed seeds:

- **Easy** about 80% (band 0.7–0.9), **Normal** about 60% (0.5–0.7),
  **Hard** about as tough as Max's Hard (the builder sets the band);
- Easy ≥ Normal ≥ Hard;
- every match ends with a result and no ball sitting still for long.

**Personality checks,** each kid against Max's brain at the same stats
(measures and bands the builder's), for example: Hank wins more headers;
Lola chips more and scores more chips; Finn fakes and gets past a lunging
Harrison; Tia's fakes end in shots; Priya gets more rebounds; Niko
nutmegs a still, square Harrison and never a moving one; Paige's shots
land nearer the corners. If a target can't be met without breaking the
personality, the builder stops and reports the numbers rather than
widening the bands.

**Nothing in the Backyard or the Park moves:** every existing tuning
test, the AI-vs-AI tests and the no-kit parity test pass unchanged.

## Goalie Gus

### The look

A big, friendly giant: about a third taller and broader than Harrison
(the main spec's "scaled up"), enormous gloves, a captain's armband, a
keeper's top in a colour nobody else wears. The rest is the builder's
within that. He celebrates a save with a glove clap.

### How he plays

- **He fills the goal.** His bigger body covers far more of the mouth than
  any keeper so far, and he catches shots struck straight at him or high.
- **He's slow to get down:** low shots into the corners beat him. After a
  dive he takes a moment to get back up, so a rebound or a quick second
  shot finds an open goal.
- **He comes out big** to smother a dribbler in his box; a stepover, or a
  rainbow flick over him, beats that.
- **His drop kicks are huge,** landing deep in Harrison's half for his
  partner to chase. **No goal ever comes straight from his kick:**
  Harrison's keeper always gathers one that reaches him.
- **His partner is weak:** one of the backup keepers playing out of
  position, at low stats. Harrison has the ball most of the match; the
  fight is scoring. The HUD and banners name GUS.
- **The Energy Wave:** Gus is the one keeper who can stop it, and only
  when he's **set**: on his feet, on his line, facing the beam. Caught
  after a dive, getting up, or out of his goal, he's blown into the net
  like anyone. *Lesson:* make him move first.
- **The lesson,** never stated in the game except by the tip after a
  loss: keep it low, make him dive, follow up.

### Tuning target

Measured like Biscuit and Sam, with scripted Harrisons at tuning stats
the builder picks (about where a Harrison who has passed the tryouts
would be):

- a **blaster**, who shoots hard and high from range and never follows
  up, loses nearly every match on Normal;
- a **worker**, who shoots low for the corners, follows up rebounds, and
  draws Gus out to chip or step over him, wins about half on Normal
  (around 0.8 on Easy and 0.3 on Hard).

Every match ends with a result and no ball sitting still for long. These
are tests, so a change that breaks the lesson fails CI.

## The save: profile version 7

- **No new fields.** The School Field adds catalog ids (`school-1` …
  `school-8`, `school-boss`) that `career.stars` and `career.lossStreaks`
  load because they're in the catalog.
- **The version goes to 7 anyway,** for the reason v4 did: a v6 tab left
  open could otherwise write over School stars. A v1–v6 save loads with
  no School progress.
- **The save code** appends, in its append-only way, the nine School star
  counts and Gus's loss streak. An older code still applies, with no
  School stars. `MAX_ENTRY` (153) grows to fit the longest code; it must
  still show on the entry screen (the builder lays it out).
- Clamps as before: stars 0–3, streaks 0–99. Storage that throws never
  stops the game. Two-tab sync is unchanged.

## Sound

By design, not by ear, like everything so far: a keeper's glove thump on
a catch, a dive's rush, the drop kick's thud and Gus's bigger boom, a
push-away's slap, the bleacher crowd's cheer on goals at the School Field
(quieter than a stadium), and Gus's boss sting. Tune in `cues.ts` once
someone listens.

## Art and approval

**New art, all code-drawn:**

- the keepers' poses; STEADY EDDIE, the two backup keepers and their tops
  and gloves;
- the six new kids (heads in three facings, front faces for the panel,
  VS card and HUD, kits, hair, skin tones; Hank's bigger drawing if any);
- Goalie Gus's bigger body, head, gloves, armband and save clap;
- the School Field's four layers, crowd, flag and leaves, the goal sprites
  for the bigger goal, and the postcard;
- the 534×300 HUD.

**Harrison wants to be surprised,** so every sheet and GIF goes to the
parent alone:

- **keepers:** a sheet (Eddie and the backups, every keeper pose) and a
  GIF of a dive and a catch, then a drop kick;
- **the School Field:** stills of the venue at 534×300 with a match in it;
- **the cast:** a sheet (the six new kids, faces, heads, idle, run and
  shoot frames) and a GIF of one personality in play (Niko's nutmeg or
  Hank's header, the builder's pick);
- **Gus:** a sheet and a GIF of him saving, then beaten low.

Nothing merges with unapproved art.

## Goals

- From the School Field on, matches feel like real football on a real
  pitch: room to run, real goals, and keepers.
- Keepers who do what Harrison pictured: move to intercept, dive, catch,
  drop-kick it out. Beating one feels earned; his own keeper feels like
  help.
- Eight tryout opponents who each feel different within a minute, each
  with something Harrison can work out, and a boss who's a wall until he
  learns to keep it low and make him dive.
- Every match's clock shows how long is left.
- His save moves to v7 losing nothing; the Backyard and Park play exactly
  as before.

## Non-goals (this round)

- **Gus as Harrison's keeper.** He becomes it from the State
  Championship on; that's the State Championship's design to build.
- **The State Championship** beyond its road-map stop reading COMING
  SOON; 2v2 and later venues.
- **Any change to the Backyard or the Park** beyond the countdown clock
  and rung 7's reworded bonus: same canvas, pitch, 90-second matches,
  opponents and tuning.
- **Harrison controlling a keeper,** passing to one, or penalties,
  throw-ins, corners or fouls.
- **New moves, power moves or Shop items;** new coin milestones.
- **The quiet ease-off** and retuning by ear.

## Anti-goals

These would make it a failure even if it technically works:

- **A wall keeper:** a keeper who saves everything, so only tricks or the
  wave score.
- **Soft goals by his own keeper:** a slow roller under a dive.
- **Losing through no fault of his own:** an opponent who fools
  Harrison's keeper, or a goal straight from a keeper's drop kick.
- **Eight Maxes in different shirts.** The personality checks guard it.
- **Unfair the way Max used to be:** every fair rule applies to every
  School Field opponent.
- **A blurry or uneven picture:** the 534×300 match must scale by whole
  numbers like everything else.
- **Losing or lowering progress.** The v7 move keeps everything; stars
  never go down.
- **Broken places:** every body and ball obeys every guarantee Plans 2–10
  made, on the new pitch too.
- **A babyish tone,** and **likeness slips:** the kids, keepers and Gus
  are made up, the school is made up, and there's no surname anywhere.

## Constraints

- **Saves:** fields are only ever appended; `profileFrom` loads any
  version ≥ 1 field by field and caps runaway counts; nothing earned or
  bought is ever taken back; storage that throws never stops the game;
  the save code's fields are append-only.
- **No-kit parity** and the unchanged Backyard and Park, above.
- **On-screen text** uses only uppercase letters, digits and
  `' - : ! ? . , / + < >`. No parentheses.
- **Assets:** no image, audio or font files. Everything is code.
- **The stack:** Vite, TypeScript, Canvas, Vitest. Pure, tested modules
  for the catalog, objective rules and the save, as before.
- **Screens:** School Field matches draw at 534×300; every other screen
  and every Backyard and Park match at 320×180; all scale by whole
  numbers. The brainstorm mockups are in the gitignored
  `.superpowers/brainstorm/277036-1793245809/` folder for this machine
  only (`sources/scale-mock.mts` and `look-mock.mts` paint with the real
  art); draw from the descriptions if they're gone.
- **Approvals:** the sheets and GIFs before merging; ask before every
  merge into `main` and every push (the repo is public, Pages deploys on
  push). Work on the branch.

## Left to the builder

- Module and file layout: how a scene declares its resolution, where view
  settings live, the keeper brain's module (`ai.ts` is near 580 lines, so
  keepers and the new personalities want their own modules), how
  personalities become data, how the match picks its field, canvas, clock
  length and keepers from the venue.
- Every number marked as the builder's: keeper dials and per-match skill
  steps, the hold time, drop-kick range and spread, each kid's stats and
  profiles, Gus's size, reach, get-up time, punt and brace condition, the
  partner's stats, and the exact test bands, scripts and seeds.
- How match time is stored, provided the countdown, golden goal and the
  `early` bonus behave as described.
- Looks within the descriptions; names stand unless the parent changes
  them at the sheets; the backup keepers' looks; wording of blurbs, Hub,
  Results, VS and Help lines within the character set.
- Layouts: eight nodes on the venue screen, six stops on the road map,
  the save code's entry screen, the 534×300 HUD.
- Whether keepers appear on the VS card.

## Plans and release

Five plan documents, each executed inline in its own fresh session, in
order, on branch `plan-7c-school-field` (this spec's branch, from main
`14de5b1`), with **one merge after Gus**, so no half-built School Field
reaches Harrison:

1. **The big pitch:** per-scene resolution and the 534×300 match canvas;
   view settings for the camera; venue art and goals from any field; the
   School Field's `Field`; the 534×300 HUD; the countdown clock in every
   match and rung 7's wording; 120-second matches and 60-second golden
   goal by venue.
2. **Keepers:** the keeper body and brain (positioning, coming out,
   dives, catch or push away, high balls, holding, drop kick), Harrison's
   keeper, the wave and tricks against keepers, keeper difficulty and its
   CI measures, the no-wall and no-soft-goal tests, the keepers' art
   (sheet and GIF to the parent).
3. **The School Field:** the autumn layers and life, the catalog and the
   four new bonuses, profile v7 and the save code, the road map's sixth
   stop, the venue screen, Hub, VS card, Results and Help, with Max as a
   stand-in opponent in every slot so the venue plays end to end (stills
   to the parent).
4. **The tryouts cast:** the six new kids' personalities and art, Max and
   Tia returning, their tuning and personality tests (sheet and GIF to
   the parent).
5. **Goalie Gus:** his body, brain, partner, punt and brace rule, his tip,
   Help line and sting, his tuning test (sheet and GIF to the parent);
   then the final review and release.

Each plan adds an "As built" section to this spec. Before merging into
`main` and before pushing, ask. After release, update the memory note.

## Build order change

The build order, as amended by Plans 3–10 and the roadmap:

7. Career mode and what Harrison asked for after the Park:
   - 7a. The career spine (done)
   - 7b. The Park, four opponents and Speedy Sam (done)
   - Skill moves (done)
   - Save slots and the Stamina upgrade (done)
   - The Locker Room, first round (done)
   - ~~Quick Match~~ (shelved)
   - **7c. Keepers and the School Field: the 534×300 match canvas, the
     bigger pitch, the countdown clock, keepers, 8 tryouts and Goalie Gus
     (this document; five plans)**
   - The State Championship: 8 rounds and Showtime Shay, with Gus in
     Harrison's goal
   - 7d. 2v2 and the City Stadium: 8 matches and the Twins
   - 7e. The World Cup Final: 8 matches and the Golden Boot champion
8. Training Ground
9. The other power moves, forms, Power Clash, the bicycle and scorpion
   kicks, the rest of the Locker Room's cosmetics and celebrations,
   Trophy Room
10. Polish (settings, difficulty and the quiet ease-off, balancing)

## As built: plan 1

Built on 2026-10-28. Checked in the browser on stills drawn by the real
match scene (the School reached through a `CareerMatch` with
`venue: 'school'`) and in the live loop. The choices this spec left to
the builder, and what changed on the way:

- **The view rides on the camera.** `View` in `src/game/camera.ts` is
  the canvas size, the near touchline's screen row and the HUD's scale:
  `SMALL_VIEW` is 320×180, row 176, HUD at 1×; `BIG_VIEW` is 534×300,
  row 296, HUD at 2×. `Camera` carries an optional `view` (absent means
  the small one) and `project(x, y, z, cam)` reads it, so every drawing
  path works in either view. `VIEW_W` and `NEAR_SY` are gone.
- **A stage per venue.** `Stage` in `src/game/stage.ts` is a field, a
  view and the match and golden-goal lengths. `SMALL_STAGE` is the
  Backyard's field, the small view, 90 s and 45 s; `SCHOOL_STAGE` is
  `SCHOOL_FIELD` (in `field.ts`, with its painted `markings`), the big
  view, 120 s and 60 s. `stageFor` gives the Backyard and the Park the
  small stage and every later venue the School's. `createWorld` takes
  the stage as its last argument, and the match scene picks it from the
  venue.
- **Each scene says its size.** `Scene.size` (absent means
  `MENU_SIZE`, 320×180); the loop calls `screen.resize` with it before
  every draw, which does nothing unless the size changed, and turns
  smoothing off again after a resize. On a 1928×1969 device-pixel
  window the School match showed at 3× (1602×900) and Help, the Hub and
  a Backyard match at 6× (1920×1080), every frame crisp, through
  match → pause → Help → back → restart → quit to Hub (the match swapped
  into the live loop by hand, since no menu reaches the School yet).
- **The HUD is a 267×150 layer, doubled.** At the big view the score,
  clock, stamina bar, POWER meter, banners, goal callout, BONUS DONE!,
  off-screen arrow and pause menu are laid out at 1× in a 267×150
  canvas (`createHudLayer`), cleared each frame and drawn onto the
  match canvas at 534×300, so text and its outlines double together.
  The pitch, its effects and the callouts over a player (PERFECT, the
  trick callouts, SHOOT!) stay on the match canvas at native size; the
  flash and impact frames cover the whole canvas. The POWER meter keeps
  to the layer's right edge (`powerMeterX0(hudW)`), and the arrow sits
  under the ball in layer pixels, clear of it. In the small view the
  HUD draws straight onto the canvas as before.
- **The clock** shows the seconds left, rounded up, as `m:ss`; golden
  goal counts its own time down in gold. Game minutes still run 0–90
  over any length, so goal records and the early bonus keep their
  meaning in a 90-second match.
- **Pitch art for any field.** `src/art/venues/pitch.ts` holds `plot`,
  `along`, `pitchGround(endFence, field, view)` and
  `goalSprites(goal)`; the Backyard and the Park ground and goals are
  pixel-identical to main's (pinned by hashes). `GameArt.goalsFor(field)`
  makes each field's goals once. The School's ground is 1319×300 with
  its white lines and a chain-link end fence at each end, on the face
  toward the pitch (x 4 and 1276). Its far layer is a stand-in morning
  sky and its mid and near layers are empty, until plan 3.
- **The Backyard matches main** pixel for pixel apart from its clock
  (checked on the same seeded frame from both builds).
- **The nets are 28 deep, not 20:** their backs are at x 12 and 1268,
  so the gap behind each net is 8, as at the Backyard, too narrow for a
  player. With the backs at 20 and 1260 a player could walk up the end
  fence behind a net, under its roof, where the ball can never go (the
  final review found it). The goal lines, posts, bar and lines are as
  drawn in the mockups.
- **Today's AI needed no change on the big pitch.** Whole AI-vs-AI
  matches at Normal on seeds 1–8 all finish with a result, no ball left
  resting unreached, nobody stuck, nobody in a goal and nobody behind a
  net; they scored 1-4, 1-2, 2-3, 2-1, 3-2, 4-1, 4-3 and 4-5. Easy and
  Hard, checked the same way outside the suite, hold too.
- **1657 tests**, typecheck and build green.

Notes for plan 3:

- The School art is 300 rows tall with its near touchline on row 296.
  Any 320×180 screen that shows the School (the road map's postcard,
  the venue screen, the VS card, a backdrop) must offset or crop it.
  None can yet: `art.venues.school` exists now, but `venueOpen` keeps
  the School shut while it has no matches, so no menu draws it.
- The far layer tiles by its width, so the School's real far layer
  should be at least 534 wide, as the stand-in is.
- `stageFor` sends every venue after the Park to the School's stage.

## As built: plan 2

Built on 2026-10-29. Checked in the browser on frames drawn by the real
match scene (tryout 1 moved to the School, backup A in their goal): a
shot to the far post, his dive and catch, getting up, the hold and the
drop kick. The choices this spec left to the builder, and what changed
on the way:

- **The keeper's shape.** A `Keeper` record rides on an ordinary
  `Player` body (`BASE_STATS`, the shared physics body), as Biscuit
  does. `World.keepers` is null on the small stage, so the Backyard
  and the Park play exactly as before; `Stage.keepers` turns them on
  from the School Field. `createWorld` takes the lineup as its last
  argument, and `stepWorld` steps both keepers itself, so every caller
  still passes two intents. Three modules: `keeper.ts` (profiles by
  difficulty and level, the acts, the hold and the drop kick),
  `keeperAi.ts` (where he stands, reading shots, coming out) and
  `keeperSaves.ts` (catch or push away). A keeper's centre never leaves
  `penaltyArea` (the painted box); bodies resolve as one group of four.
- **The dials** (`KEEPER_LEVELS`, levels 1 to 8 straight lines): the
  plan's starting values except `comeOutPx` (Easy 16/16, Normal 21/19,
  Hard 21/17), which decides most close shots, and `smotherAt` (Easy
  18/20, Normal 20/24, Hard 22/26), kept beyond the dive's first reach
  so a smother takes a moment to arrive. Harrison's keeper plays at
  Normal at the match's level; their keeper at the difficulty, changed
  mid-match from the pause menu with his dive playing out.
- **Measured** with headless drills against the scripted Harrison
  (`keeperScripts.ts`, a level up on rung-10 Max, his real aim error;
  seeds 100-163). Goals let in from long shots outside the box, Easy/
  Normal/Hard: .39/.26/.15 at level 1 (Normal saves .74), .23/0/0 at
  level 8. From placed corner shots inside the box: .76/.43/.33 at
  level 1, .63/.40/.19 at level 8. A patient one-on-one on Normal
  scores .77 (rounding him by winding up while stepping across, a
  judged chip, or a stepover). No wall: the sharpest keeper still lets
  in .19 of corners (Hard 7). No soft goals: no slow roller ever goes
  in, at either keeper, any level or difficulty. Scripted School
  matches on Normal average .45 goals a side, at most 2, and the ball
  never sits still in play for more than 3.6 s. Long shots at level 8
  on Normal and Hard are all saved; corners keep every keeper beatable.
- **The drop kick** is aimed to first bounce at halfway + his attacking
  direction × (−40 to +240), z 24-104, launched at 40° with its speed
  solved against air drag; measured first bounces land 340-700 from the
  right keeper (and mirrored). It carries backspin (−7) so it checks up
  near halfway; without it the bounces ran on to the far box. Nobody
  plays it while it climbs. While a keeper holds the ball, everyone
  else waits out where his kick comes down, around halfway.
- **Rules the builder added** (each in the ledger as a ruling): a
  keeper coming out at a dribbler sets himself on the angle as the
  attacker winds up a kick, never backing toward his line (without it
  no chip could beat a rushing keeper); "at his feet" for coming out
  means within 10 px ahead, or his own touch still running with him; a
  ball at a dribbler's feet is won only by the smother, never plucked
  off them standing; a smother's reach grows over the dive, so a ball
  knocked away as he commits gets past him (up-and-down dives keep
  their full reach); he gathers a loose ball he can reach from inside
  his box; a ball the trick is carrying is Harrison's; keepers make no
  saves while the wave is live.
- **What the whole-match tests and the tuning made me fix:** a pushed
  ball that started the tick inside his zone was re-pushed every tick
  forever (now he can't touch it for 0.25 s after a push); a tip-over
  far off his line leapt the ball 170 px (it now carries to the bar in
  0.25 s); a pushed ball resting 6 px outside his box went unreached
  (his reach); every drop kick was an 800 px chase. The keepers'
  whole AI-vs-AI test plays both sides at the scripted Harrison's
  stats: at Base stats neither side scores often enough against any
  keeper that meets the targets (3 goals in 24 matches).
- **The art and the parent's verdict.** Steady Eddie (emerald, a
  flat-top), backup A (berry, a brown mop; BACKUP MO on the sheet) and
  backup B (lemon, a top bun; BACKUP JUNE on the sheet), all with
  gloves; the backups' names never show on the HUD. Dives are a flat
  dive figure turned a quarter (mirrored first for the near post),
  mirrored after the turn for a left-facing keeper and leaned with
  depth, three frames each, baked per facing. The palette grew to 70
  colours (nine for the three tops). **The parent approved the sheet
  and GIF on 2026-10-29.** Eddie keeps Harrison's goal; backup A takes
  odd tryouts and backup B even ones and the boss. Four cues by design,
  not by ear: glove, dive, parry, punt.
- **The final review** (a fresh reviewer, "with fixes") found two
  Important issues, both fixed: Harrison could still play a ball a
  keeper had (power up, fire the wave, start a trick or a drag-back off
  a ball caught in a dive, and a wave fired off his own keeper's catch
  rode the drop kick into the far goal); now one rule, `ballOutOfPlay`,
  keeps a held ball or a climbing drop kick out of everything he does,
  ends a live wave, and their keeper's save ends his power-up. A keeper
  fooled by a stepover was drawn frozen in a run frame through his
  wrong-way dive; his act now wins over the fooled clip. Its third, the
  whole AI-vs-AI test's stats, is the parent's call.
- **Deferred from the final review:** the keeper can hover in his
  rush 0.5 px short of a ball resting 10.5-11 px past his box with no
  one else near; a blown keeper aimed at a corner can fly round the
  net or through the side netting (never from where his brain stands
  him); the high-ball backpedal runs at his full speed, not
  `BACKPEDAL_SHARE` (unused; chips were measured this way); review-focus
  tests 1, 3, 4 and 5 pin less than they say (the behaviour was probed
  and holds); `keepers.strike` isn't cleared on a catch or a drop kick,
  so plan 3 must clear it before SCORE FROM OUTSIDE THE BOX trusts it;
  `PUSH_REARM_S * 60` hardcodes the tick rate; a ball caught in a dive
  by the near board is parked through it for a moment; the keepers'
  kept intent and push re-arm live in module WeakMaps, not on `Keeper`;
  `CROWD_GAP` is now only a test bound; the two match tests (both sides
  score, the still-ball bound) each turn on a goal or two, so a small
  change can tip them (the drop kick's backspin was set at −7 for both).
- **1738 tests**, typecheck and build green.

Notes for plans 3-5:

- `KeeperEvents.pushed` is there for SCORE A REBOUND; `keepers.strike.x`
  and `markings.box` give SCORE FROM OUTSIDE THE BOX, once the strike is
  cleared on a catch and a drop kick (see the deferred list).
- `keeperLooks` gives the boss backup B until Gus.
- Gus needs a bigger body, which `bodies.ts` doesn't have yet: one
  `PLAYER_R` for everyone.
- The wave's keeper rule has no brace yet (Gus's is plan 5's).
- The tryouts cast inherits Max's attacking AI, which rarely beats a
  keeper from range at low stats; plan 4's personalities should be
  measured against keepers.

## As built: plan 3

Built on 2026-10-29. Checked in the browser on frames drawn by the real
scenes, and in the live loop: the Hub, the road map, the venue screen,
the VS card, a tryout at 3× (crisp through pause and resume, a staged win
at full time), Results, the next card, Gus's card and win, CAREER back to
the map, STATE, and the save code screen. The choices this spec left to
the builder, and what changed on the way:

- **Every venue has words.** `Venue.words` (`match`, `beaten`, `boss`,
  `done`) gives the Backyard and the Park exactly today's text (MATCH,
  BEATEN!, BACKYARD BOSS / THE PARK BOSS, BACKYARD DONE! / THE PARK
  DONE!) and the School TRYOUT, PASSED!, THE SCHOOL BOSS and YOU MADE THE
  TEAM!; a venue with no matches yet reads `${name} BOSS` / `${name}
  DONE!`. The panel, the VS card, Results and the Hub all read them. Tia's
  and Paige's blurbs are shortened from this spec's (`SHE MOVED HERE. HER
  FAKE IS SHARPER.`, `THE TOP SCORER. SHE PICKS A CORNER.`): the spec's
  ran 229 and 209 px, wider than the Hub card's 200. Every School line is
  measured against its slot in a test (the Hub card, the panel at 2×, the
  stops' names and labels).
- **The catalog.** `SCHOOL` is `school-1`..`school-8` then
  `school-boss`, every one `opponent: 'max'` until plans 4 and 5; an
  empty `STATE` venue sits between it and the Stadium, so the road has
  six stops and `TOTAL_STARS` is the roadmap's 156 (`(10 + 1 + 5 + 4 ×
  9) × 3`). Beating Sam now leads on: Results after Sam offers NEXT
  MATCH to tryout 1 (it was CAREER), and the Hub reads `NEXT: MAX -
  SCHOOL FIELD 1/8`.
- **The road map.** Six 46×30 cards at cx 28/78/136/190/240/290, y
  122/106/90/74/58/42, with the widest gaps round the School and the
  State for SCHOOL FIELD and COMING SOON; names 33 and labels 42 below.
  A postcard is cut from its venue's own layers, drawn at the venue's
  own view size, from x 118 and 48 rows above the venue's far touchline
  (`postcardFrom`): the Backyard and the Park keep today's 64, the
  School's is 120, so its card shows the school's window and door.
- **The School on 320×180 screens.** `drawLayers` shifts any venue by
  the camera's near-touchline row less the venue's own (`viewOf(cam).nearSY
  - stageFor(venue).view.nearSY`), so the 300-row School sits 120 rows
  up on the venue screen, the VS card and the backdrop, its near
  touchline on row 176 where `project` stands the juggler and the VS
  pair. The joggers and the School's life shift with their layers.
- **The look.** Four layers at 534×300 (`src/art/venues/school.ts`),
  from the approved sketch in the existing 70 master colours (no new
  colour). Far (534 wide, tiles): a pale morning sky in three bands with
  a low sun, thin clouds and a hazy tree line of tan crowns painted
  wrapped so the seam is invisible, over a solid band, a strip of
  beaten earth behind the fence, and whatever the ground covers. The
  sun sits at x 200, not the sketch's 74: a 534-wide far layer wraps
  within the view past camera x 320, and at 74 two suns showed. Mid
  (927 wide): the two-storey pale-brick school at x 15–300 (flat
  charcoal roof, white-framed windows, a canopy over navy doors, a navy
  sign panel with a gold stripe and nothing on it), the flagpole at
  310, the yellow bus at 318–388, and big orange and gold trees to the
  layer's end, so the school and the bus stand behind Eddie's end and
  trees behind the far half. Near (1162 wide): the chain-link fence (a
  slate top rail, slate posts every 40, a silver cross-hatch every 4
  px) of 16 rows standing on the far touchline (row 168), the
  aluminium bleachers (five tiers of silver seats and slate risers,
  gray rails) at near x 960–1094 so they are in view when Harrison
  attacks the right goal, and leaves piled three rows deep at the fence
  foot. Ground: plan 1's pitch with 2×1 leaves scattered from z 96 up,
  on grass pixels only, never on a line.
- **The life** (`schoolLife.ts`, `schoolView.ts`): eighteen kids and
  parents on the bleachers in a 126×40 box, varied in skin, hair and
  tops, bobbing at 2 fps with every third lifted a pixel (never in step)
  and on their feet with arms up at 6 fps through Harrison's goal
  moment (`hud.moment`), as the roar is; an away goal still groans. A
  plain navy-and-white striped flag, 15×10, three frames at 6 fps,
  rippling from the hoist out. Five leaves (flame, gold, flameDark,
  flameLight, goldDark) drifting in screen px at 14–26 px/s, swaying
  2–3 px, tumbling at 4 fps, in the art rows 70–140. Drawing order at
  the School: far, mid, the flag, near, the crowd, the ground, the
  leaves. Scenery never touches play.
- **Sound, by design and not by ear.** `goalCrowd(venue)` picks the
  cue and crowd level for his goal: the School's bleachers `cheer`
  (a 1.6 s noise swell at gain 0.3 rising 800→1400 Hz, with three short
  claps; under the roar's 0.45 and 2.5 s) and the crowd holds a new
  `cheer` level (`CROWD_GAIN.cheer` 0.25, between `match` 0.12 and
  `roar` 0.4) through the moment and a pause; everywhere else roars as
  before. The hat-trick's second roar follows the venue too.
- **The bonuses.** `GoalRecord` gains `outsideBox` and `rebound`, both
  false without keepers. `goalFacts.ts` reads them on the tick of his
  goal: `outsideBox` when the strike's `(x, z)` lies outside their
  penalty box (a point on the edge counts as inside); `rebound` when
  his kick came within `REBOUND_S` 2 s of their keeper's push (a
  `KeeperWatch` times the pushes; his own keeper's push never counts).
  Both need a live kick of his that isn't the wave and a strike that is
  his: **a wave goal counts for neither**, since the wave makes no
  strike and the one there would be stale (the builder's reading of
  "a kick he struck"). A strike now carries `z`, and a catch and a drop
  kick clear it, so it can't follow the ball. The in-play bonuses are
  SCORE FROM OUTSIDE THE BOX, SCORE A REBOUND and PUT 3 PAST GUS;
  DON'T LET PAIGE SCORE is Sam's clean sheet under her name. Plan 2's
  keeper, drill and match tests were unchanged by the cleared strike
  (no stop was needed).
- **The save.** Profile v7 adds no fields; the bump stops a v6 tab
  writing over School stars, and a v6 save or code loads with none. The
  save code appends the nine School star counts then Gus's loss streak
  after every v6 field. The longest code is 167 characters (was 151),
  `MAX_ENTRY` 169, and the small code size shows up to five lines of
  eight groups, which end above the status line even on the entry
  screen (checked in a still).
- **Max standing in.** Every School slot builds Max at the slot's
  ladder stats (Gus's rung 0 clamps to rung 1's) with keepers at the
  slot's level, under the catalog's names (HANK on the HUD, `GUS
  SCORES`). Measured once for information on Normal, seeds 100–131,
  against the scripted Harrison at the drills' stats: tryout 1 W21 D6
  L5 (0.88 goals a side to 0.25), tryout 8 W10 D19 L3 (0.47 to 0.19),
  Gus's slot (rung-1 stats, keeper level 8) W15 D16 L1 (0.59 to 0.03);
  Max never scored more than 2. Nothing is tuned for him.
- **Tests.** The staged School goals in the match tests hold X 0.6 s,
  not the plan's 0.2 s: at Power 1 a 0.2 s shot from x 1000 stops at x
  1194, short of the line. Existing pins of the School as empty moved
  to the new truth (`profile.test`'s unknown id is now `state-1`; the
  v6-shape pins read v7; "a newer build" is v8).
- **The art and the parent's verdict.** Four stills of the venue at
  534×300 (kickoff, attacking the right goal with the bleachers,
  his goal with the crowd on its feet, Eddie's end with the school and
  the bus) and three of the 320×180 screens went to the parent alone on
  2026-10-29. **The parent approved all of it the same day** ("I approve
  of all the art. This looks good.").
- **The final review** (a fresh reviewer on the most capable model:
  "ready to merge") found nothing Critical or Important. Its minors are
  deferred: `goalFacts` takes the right goal as `goals[1]` by position
  where `noteKick` finds it by side; the keeper watch isn't reset on a
  goal or kickoff, so a kickoff kick that scored untouched within 2 s of
  sim time of a push before the previous goal would count as a rebound
  (it can only over-credit, never take a star away); `noise()` is
  duplicated in `school.ts` and `schoolLife.ts`, and `schoolLife`'s
  `fill` is scenery's `fillRect`; `venueScene` and `vsScene` find the
  venue by hand where `venueById` exists; Help has no vertical-fit test
  (THE MATCH's eleven lines end at row 139, 23 above the footer, and
  plan 5 adds Gus's line); `drawLayers` has six positional parameters;
  and on every 320×180 screen the School's shift hides its sky (the top
  rows show the tree band and the school's lower storeys), which the
  parent saw in the approved stills. Its declined-to-judge list was
  ruled on: Gus's VS title is `THE SCHOOL BOSS` over `HARRISON VS
  GOALIE GUS` rather than this spec's `GOALIE GUS - SCHOOL BOSS` (VS
  wording was left to the builder, and it matches the Park's card); the
  venue screen's juggler stands just outside the School's left box, on
  grass.
- **1820 tests**, typecheck and build green.

Notes for plans 4–5:

- The School matches' `opponent` fields are the only change the cast
  needs in the catalog: plan 4 sets tryouts 2–8's, plan 5 Gus's.
- `opponentStats(id, rung)` takes no venue: Max at tryout 1 and Tia at
  tryout 5 come back at the Park's and the ladder's stats until plan 4
  gives it one.
- Gus's slot is rung 0; `keeperLevel` already sends a boss to the top
  level and `keeperLooks` gives him backup B until plan 5.
- Gus's tip (`TIP: KEEP IT LOW. MAKE HIM DIVE.`), his Help line after
  Sam's, and his boss sting are still to do; the VS card already plays
  `bossSting` for him and keeps three lines after a loss.
- `GoalRecord.outsideBox` and `rebound` are recorded in every match,
  so plan 4's Priya and plan 5's Gus need no new facts.

## Amended after the parent's first playtest (2026-10-29): softer keepers

The parent's first match at the School on Normal ended 0-0 with every
shot saved, which felt too hard to score on. The keepers' targets above
(*How good they are*) are softened, every difficulty and level one notch:

- **Targets on Normal, against the venue's first keeper:** long shots
  from outside the box are saved about two in three (was three in four);
  a well-placed shot into a corner from inside the box scores about
  three in four (was half); a patient one-on-one scores nearly every
  time. Easy lets in nearly half of long shots and three in four
  corners; Hard's first keeper is about the old Normal.
- **What moved, and why not more.** The dials that decide scoring are
  the reaction time (long shots and the one-on-one), how far he comes
  off his line and his standing reach (corner shots); dive length, catch
  pace and positioning error barely move the drills. The reaction time
  stays under a hard shot's flight from the box's edge (650 px/s over
  180 px is 0.28 s): a first try at 0.32 s on Normal left him unable to
  move for one, so every rocket from the box's edge scored and he never
  pushed a ball away (the push guarantee's test caught it). Normal's
  first keeper is now at 0.27 s (was 0.24), comes out 17 (was 21), with
  a standing reach of 1 in depth and 41 high (was 2 and 42); Easy's
  first at 0.34 s (was 0.30), Hard's at 0.22 s (was 0.20); every last
  keeper 0.03-0.04 s slower than before, with the rest of the dials a
  notch softer each. `KEEPER_LEVELS` in `src/game/keeper.ts` has the
  numbers.
- **Measured** (seeds 100-163), goals let in: long shots E/N/H
  .46/.35/.24 at level 1, .26/.11/0 at level 8; placed corners
  .77/.73/.49 at level 1, .77/.60/.33 at level 8; the one-on-one on
  Normal .94 at level 1, .58 at level 8. No wall: the sharpest keeper
  lets in .33 of corners. No soft goals: no slow roller ever goes in.
  Hard shots from the box's edge are still pushed away (24 of 64 on
  Normal's first keeper) and never into his own goal. Scripted matches
  on Normal average .63 goals a side, at most 4. Harrison's own keeper
  plays at Normal, so he lets in more too; plan 4's cast is measured
  against these keepers, not the old ones.
- The bands in `keeperTuning.test.ts` pin the new targets, and a new
  band pins Easy's first keeper.
- **The drop kick is shorter** (the parent's ask, the same day): its
  first bounce is aimed 10 to 190 px short of halfway, on the keeper's
  own side of it (it used to be 40 short to 240 past), so it usually
  comes down a little short of the line; the backspin still checks it up
  there, and the players still wait out where it comes down.
- **The goals are wider** (the parent's ask, the same day, after another
  playtest: scoring still felt a little too hard): the School Field's
  goal mouth is 68 deep (z 30-98), not the brainstorm's 56 (z 36-92),
  still 48 high and 4 px inside the goal area each side; the goal
  sprites follow the geometry. A keeper's dive now covers about half of
  the mouth instead of two thirds. Measured (seeds 100-163), goals let
  in: long shots E/N/H .56/.41/.34 at level 1, .37/.19/.10 at level 8;
  placed corners .86/.84/.72 at level 1, .86/.75/.64 at level 8; the
  one-on-one on Normal .94 at level 1. No slow roller ever goes in;
  scripted Normal matches average .63 goals a side, at most 2. The
  Normal corner band is now .65-.9.
