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
