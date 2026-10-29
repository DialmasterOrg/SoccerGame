# Harrison's Road to the Cup — Design

> **Amended 2026-10-23** after Harrison's first playtest by
> `2026-10-23-depth-and-menus-design.md`. It adds a depth band with solid
> players, near/far-post aiming, and a title screen, Help and Options, and it
> shifts the build order by one step. Where they disagree, the amendment wins.

Working title. Harrison gets to pick the final name.

## Intent

A browser soccer game made for one specific kid: Harrison, age 12. The main
character is Harrison himself, drawn as 8-bit pixel art with roughly the level
of detail and fluid animation of the original Prince of Persia. The game should
be something he can pick up for 5–10 minutes at a time and still feel
progress building over weeks: earning coins, upgrading his player, unlocking
new moves and looks, and working through a career that ends at a World Cup
final.

The point is delight and ownership. It's *his* game, with *him* in it, wearing
*his* number. Success is Harrison choosing to come back to it on his own and
wanting to show it to friends.

## What the parent decided

- Browser game, played on a **computer with a gamepad**.
- Main character is **Harrison**, built from reference photos (to be supplied),
  in 8-bit pixel art at **Prince of Persia-level detail**.
- He goes by **"Harrison"** (not Harry). **Jersey number 12.** He is **12 years
  old**.
- The game is about **playing soccer**.
- It has **upgrades and things to earn**. **Some upgrades are big, powerful
  effects in the style of Dragon Ball Z.**
- **Short sessions, long-term progression.**
- **One player only.** No local multiplayer.
- **No deadline.** Built in order, finished when it's finished.
- He plays it **from a GitHub Pages site in his own browser**, including while
  it's still being built.
- **Dad is not in the game.**

Everything else in this document is the designer's call unless marked
otherwise, and the parent may still push back on any of it.

## Goals

- Harrison is clearly recognisable: in-game by silhouette, hair and colours;
  in the portrait by face.
- Matches feel good with a gamepad: responsive, physical, skill-based. A
  12-year-old should be able to get better at it.
- Every session ends with something earned (coins, XP, a personal best) and
  most sessions end with something new to buy or unlock.
- Big moments feel big: goals get slow motion, screen shake, crowd roar,
  rumble and Harrison's own celebration.

## Non-goals

- Realistic 11-a-side soccer, positions, fouls, offside, throw-ins, corners.
- Online play, accounts, leaderboards, servers of any kind.
- Local multiplayer or a second controller.
- Touch-screen controls or a mobile layout.
- A level editor or character creator for other people.

## Anti-goals (would make it a failure even if it works)

- Ads, a real-money store, loot boxes, or anything that feels like a mobile
  game's monetisation.
- Daily streaks or timers that punish him for not playing.
- Losing saved progress.
- A babyish tone. He's 12; it should feel like a cool sports game, with humour,
  not a toddler game.
- Walls where he's stuck losing the same match over and over with no way
  forward.
- Shipping the reference photos anywhere.

## Constraints

- Runs in a desktop browser (Chrome/Edge primary, Firefox best-effort) via the
  standard Gamepad API. Xbox-style controller assumed.
- Full keyboard fallback so it can be tested and played without a controller.
- No external art, music or sound files. Everything is drawn or synthesised in
  code, so there is nothing to license.
- Reference photos stay out of git (a gitignored `reference/` folder if they
  land in the repo at all) and out of every deployed build. Only the derived
  pixel art is committed. No surname anywhere in the game. The parent is
  sharing the photos with Claude specifically so it can make the pixel art,
  so using them for that is intended.
- The repo (`DialmasterOrg/SoccerGame`) is **public** (the parent's choice), so
  `.gitignore` excludes `*.jpg`, `*.jpeg` and `reference/`. Check before every
  commit that no photo is staged.
- Fully static site: no backend.

---

## The game

### Camera and field

Side-view, like Prince of Persia. The field is about two screens wide (≈640
logical pixels at the 320×180 internal resolution); the camera follows the
ball with smoothing and is clamped to the field. Goals sit at each end. Behind
each goal and above the field edge are boards/fences/walls depending on the
venue: a ball that goes over the crossbar or past the end hits the boards and
bounces back into play. No throw-ins, corners or goal kicks; no fouls. If the
ball goes very high an off-screen arrow shows where it is.

A goal is scored when the whole ball crosses the goal line under the crossbar.
Posts and crossbar are solid and the ball rebounds off them with a satisfying
clang.

### Match format

- Match clock shows 0'→90' and runs one game-minute per real second, so a
  match is 90 real seconds.
- Kickoff from the centre at the start and after each goal (the side that
  conceded kicks off).
- Tied at 90': **golden goal** for up to 45 more seconds. Still tied: it's a
  draw.
- Pause with Start: Resume / Restart / Quit (quit forfeits rewards).

The format grows through the career:

1. 1v1, open goals, no keepers (Backyard, Park).
2. 1v1 plus a computer goalkeeper on each side (School Field).
3. 2v2 plus keepers, with a computer teammate (City Stadium, World Cup Final).

Harrison only ever controls himself. His keeper and teammate are computer
controlled.

### Controls

Default gamepad mapping (Xbox layout):

| Input | Action |
|---|---|
| Left stick / D-pad | Run left/right. Holding up/down while shooting aims high/low. |
| A | Jump. Ball touching his head mid-jump is a header, aimed by the stick. |
| X | Shoot. Tap for a quick shot; hold to charge, release to fire. In the air: volley. |
| B | With the ball: chip/lob (hold for distance). Without: slide tackle. |
| Y | With a full super meter: hold to power up, release to unleash the equipped power move. |
| RT | Sprint (uses stamina, which recovers when not sprinting). |
| RB | Skill move: step-over by default; with stick up, rainbow flick (once unlocked). |
| LB | 2v2: pass to teammate / call for the ball. |
| Start | Pause. |

Menus: stick/D-pad to move, A to confirm, B to go back.

Charged shots have a sweet spot near the top of the charge bar. Releasing in
it gives a "PERFECT" flash and a faster, more accurate shot. Overcharging
makes the shot wilder.

Bicycle kick (once unlocked): airborne, ball above head height, press X with
the stick pointing away from the goal he's attacking.

Keyboard fallback, adjustable by the builder: arrows move, Z jump, X shoot,
C chip/tackle, V super, Shift sprint, D skill, S pass, Enter/Esc pause.

Rumble (where the browser supports `vibrationActuator`): short pulse on hard
shots, post hits and tackles; a longer one on goals.

### Ball and player physics

- Ball has gravity, air drag, rolling friction, bounce, and simple spin
  (topspin makes it dip and skip forward on bounce, backspin makes it check up).
- Dribbling: when Harrison runs with the ball it stays near his feet with small
  touches. The Control stat sets how close and how hard it is to knock loose.
- Contact or a slide tackle from an opponent can knock the ball free.
- Exact constants are the builder's to tune, aiming for: a full-power shot
  crosses the field in about a second; a max-stat jump clears roughly 1.2× his
  height; the game feels quick and arcade-like, not floaty.

### Computer players

Each opponent has stats (same four as Harrison) and a personality that shapes
its decisions: aggressive presser, defensive blocker, long-range shooter,
dribbler. Difficulty comes from reaction time, accuracy, aggression and stats.

Goalkeepers position themselves between ball and goal, dive, catch, punch, and
throw or kick the ball back out. Keeper skill scales by venue.

The 2v2 teammate supports, passes to Harrison when he calls for it or when
he's open, and defends.

Difficulty setting: Easy / Normal / Hard (default Normal). After three losses
in a row on the same career match, that opponent quietly eases off about 10%
per extra loss, down to a floor. There's no message about it.

---

## Progression

He earns three things:

- **Coins:** spent in the shop.
- **XP:** levels Harrison up; levels unlock new moves and shop items.
- **Stars:** 1–3 per career match, a mark of mastery and a source of bonus
  rewards.

### Career mode

Five venues, each with four regular matches and a boss. Matches unlock in
order by winning. Beating the boss unlocks the next venue. Stars don't gate
progress, which avoids grind walls; difficulty provides natural pacing because
later opponents need upgraded stats and moves.

Stars per match: 1 for winning, 2 for winning by 2+ goals, 3 for also
completing that match's bonus objective (e.g. "score a header", "don't
concede", "score from a chip", "score a volley"). Star milestones (e.g. 10,
25, 50, 75 stars) award cosmetics.

| # | Venue | Format | Boss |
|---|---|---|---|
| 1 | Backyard (fence, washing line, evening sun) | 1v1, open goals | **Biscuit the Dog**: very fast, steals the ball and runs off with it, can't shoot hard |
| 2 | The Park (trees, joggers in the background) | 1v1, open goals | **Speedy Sam**: blazing pace, weak shot |
| 3 | School Field (school building, small bleachers) | 1v1 + keepers | **Goalie Gus**: an oversized opposing keeper with a weak outfield partner |
| 4 | City Stadium (night, floodlights) | 2v2 + keepers | **The Twins**: two opponents who pass sharply and press together |
| 5 | World Cup Final (huge crowd, fireworks) | 2v2 + keepers | **The Golden Boot champion and partner**: a fictional superstar striker, the best all-round opponent in the game |

Regular opponents each have a distinct look (different head/hair and palette)
and personality. Biscuit the Dog is a hand-animated quadruped; everyone else
uses the shared human body system.

### Quick Match

Pick any unlocked venue and opponent. Full coin and XP rewards, no stars.

*Shelved indefinitely (2026-10-28):* career replays already cover it. See
section 4 of `2026-10-27-roadmap-after-the-park-design.md`.

### Rewards

The builder tunes the exact numbers to these targets. Starting points:

- Win 60 coins, draw 30, loss 15. +10 per goal scored. +15 for a "style goal"
  (header, volley, chip, bicycle kick, power move). +20 for a clean sheet.
- Power moves and their tiers are the big-ticket items: each one should feel
  like a goal to save up for.
- First win of each day: +50 coins. Missing a day costs nothing.
- XP roughly proportional to coins; level curve gets gradually steeper.
- Pacing targets: early on, something new is affordable every 2–3 matches;
  later, every ~5. Finishing the career takes about 4–6 hours of total play,
  i.e. a few weeks of short sessions. Fully maxing everything takes longer.

### Shop: stats

Four stats, levels 1–10, cost rising about 35% per level:

- **Speed:** run and sprint speed.
- **Shot Power:** maximum shot speed and charge rate.
- **Jump:** jump height (better headers, volleys, bicycle kicks).
- **Control:** tighter dribbling, harder to knock off the ball, more accurate
  chips and passes.

Opponents use the same stats, so upgrades matter in a way he can feel.

### Moves (unlocked by level, free to use, timing-based)

Available from the start: shoot, charged shot, chip, header, volley, slide
tackle, sprint. Unlocked by level (the builder picks exact levels, spread
through the career): step-over feint, rainbow flick (flick the ball over an
opponent's head), bicycle kick, scorpion kick.

### Power moves (Dragon Ball Z-style)

The parent asked for some upgrades to be big, powerful effects: "think Dragon
Ball Z". These are the game's showpiece upgrades. The feel is an open homage,
but every name is original (no DBZ names, characters or attacks).

**Powering up.** The super meter fills from touches, tackles, shots on target
and style goals. With a full meter, **hold Y to power up**:

- Harrison drops into a charging stance.
- An energy aura flares around him, and his hair glows and lifts.
- The ground shakes, grass and pebbles float up, and the crowd gasps.
- The controller rumbles harder the longer he holds.

A full power-up takes about a second. **Release Y to unleash** the equipped
power move. If he's tackled while charging, the power-up is cancelled but he
keeps the meter, so picking the moment matters.

**Power moves.** One is equipped at a time. Each is unlocked by level, bought
with coins, then upgraded through **three tiers** that make it faster, bigger
and flashier.

- **Blaze Shot:** the ball is wreathed in fire with a roaring flame trail and
  leaves scorch marks where it bounces. At tier 3 a save knocks the keeper
  into the net with it.
- **Energy Wave:** the headline move. He strikes the ball inside a huge
  horizontal energy beam that crosses the screen and sends defenders flying.
- **Dragon Strike:** the ball becomes a pixel energy dragon that snakes up and
  then dives under the crossbar. This replaces the earlier Dipper.
- **Blink Dash:** he vanishes and reappears further upfield with the ball,
  leaving afterimages. This replaces the earlier Lightning Dash.
- **Meteor Volley:** he leaps high, a giant glowing ball charges above him,
  and he volleys it down into the goal.
- **Thunder Header:** lightning strikes the ball as he heads it.

**Power forms.** These change how he looks while powered up and during
celebrations. They unlock by level, are equipped in the Locker Room, and each
adds a small bonus to how fast the meter fills.

- **Base:** white aura.
- **Golden Form:** gold aura, glowing golden spiky hair, sparks.
- **Storm Form:** gold aura crackling with blue lightning.
- **Ultra Form:** blue-white aura, silver-blue hair.

**Anime effects.** Power moves, and big goals in general, draw on a shared
set of effects:

- speed lines across the screen
- impact frames: one or two frames of high-contrast silhouette at the moment
  of contact
- screen flash, heavy shake and slow motion
- dust and debris, shockwave rings
- glowing particle trails and crackling pixel energy

**Power Clash.** The bosses in venues 4 and 5 have their own power moves. When
his power move meets theirs (beam against beam, or both striking the ball at
once), the two energies lock together mid-field and he mashes X to overpower
it. If he wins, the ball rockets toward their goal; if he loses, it flies
toward his.

### Cosmetics (look only, no stats)

- **Kits:** jersey/shorts/socks colour sets. He starts with his club's red
  home and black away kits (see Art direction); others are bought. Number 12
  always.
- **Boots:** colours, starting with volt yellow; premium boots leave a short
  trail when sprinting.
- **Balls:** classic, retro, gold, fire, and so on.
- **Accessories:** headband, wristbands, captain's armband, clear-framed
  glasses.
- **Aura colours** for his power-up, beyond those that come with his power
  forms.
- **Celebrations:** knee slide, backflip, robot, airplane, the spin-jump
  "Siuuu", and **"Point to the Back"**: a close-up back-view of Harrison
  pointing at **HARRISON 12** on his shirt. One is equipped and plays after
  each of his goals.

### Training Ground (short drills, 45–60 seconds, for quick sessions)

Each drill pays coins on a sliding scale and tracks a personal best.

- **Keepy-Uppy:** press in time as the ball drops to his foot; the timing
  window shrinks as the streak grows.
- **Target Practice:** targets appear in the goal (corners, under the bar);
  shoot from various spots before the clock runs out.
- **Crossbar Challenge:** hit the crossbar from increasing distances.
- **Beat the Keeper:** 5 shots from different spots against a keeper.

Keepy-Uppy and Target Practice are open from the start; Crossbar Challenge
unlocks at venue 2, Beat the Keeper at venue 3.

### Trophy Room

- A trophy for each venue completed.
- Around 20 achievements that pay coins: first goal, first header, hat-trick,
  10/50/100 juggles, bicycle-kick goal, clean sheet vs a boss, and so on.
- Career stats: matches, wins, goals, style goals, biggest win, best streaks.

### Screens

Title ("Press Start") → **Hub** (Harrison's portrait, level, coins) →
Career / Quick Match / Training / Shop / Locker Room (kit, boots, ball,
accessories, celebration, equipped power move and power form) / Trophy Room /
Settings.

After every match or drill: a **Results** screen that tallies coins and XP
with sound, shows level-ups and anything newly unlocked, and offers
"Play again" or "Back".

Settings: difficulty, music and SFX volume, controls reference, export/import
save code, reset save (with a confirmation step).

---

## Art direction

### Look

- Internal resolution 320×180, scaled up by the largest whole number that fits
  the window, letterboxed, with smoothing off (crisp pixels).
- A fixed master palette of around 40 colours, including bright energy
  colours (glowing gold, white, electric blue, flame orange, violet) for
  auras and power moves. Each in-game sprite uses about 12 or fewer. The
  builder picks the palette.
- Venues have 2–3 parallax layers (sky; distant scenery; crowd or fence) over a
  pitch with mowing stripes. Crowds are animated with simple pixel bobbing.
- Goals drawn with a pixel net pattern that ripples when the ball hits it.
- A custom bitmap pixel font in code; a large chunky font for "GOAL!!!",
  "PERFECT", "LEVEL UP".

### Harrison

**What he looks like** (from the four reference photos, which stay local):

- **Hair:** his most recognisable feature. Light brown with golden-blond
  ends, long on top with a heavy fringe swept forward and slightly to one
  side, reaching his eyebrows and partly covering his forehead. Sides and
  back are short in a high taper fade, close to skin around and behind the
  ears. In profile it reads as a forward-sweeping wedge over a faded side.
- **Face:** fair, peachy skin with a little pink in the cheeks, nose and
  lips. Light blue-grey eyes, straight brows mostly hidden under the fringe,
  a straight nose, a calm, slightly serious resting expression.
- **Details:** small silver stud earrings in both ears (one bright pixel
  each in the portrait; one pixel on the profile sprite where it shows).
  Sometimes wears clear-framed glasses (offered as a Locker Room accessory,
  not the default).
- **Build:** tall and lean for 12, long legs, narrow shoulders.
- **Team kits** (from his club photos; no real logos, sponsor text or club
  crest reproduced, just a simple shield):
  - **Home (default):** red jersey with white stripes over the shoulders and
    down the sleeves, red shorts with white side stripes, red socks.
  - **Away:** black jersey with white shoulder stripes, black shorts with
    white side stripes, black socks.
  - **Boots:** neon volt-yellow.

At Prince of Persia scale the face is only a handful of pixels, so likeness is
split across two pieces of art:

- **In-game sprite:** standing height about 40 px in a frame about 24 px wide.
  Realistic proportions for a 12-year-old (head about 1/6 of his height), not
  chibi or big-headed. Recognisable from hair shape and colour, skin tone,
  build, and kit.
- **Portrait:** about 64×64, hand-placed pixels, front or three-quarter view,
  with shading. This is where the face really reads as him. Expressions:
  neutral, shouting/celebrating, determined, disappointed. Used on the hub,
  the match scoreboard (small crop), results screens and the goal close-up.

**How the sprite gets made:**

- His **head** (side profile, three-quarter and front) is hand-authored pixel
  art from the photos.
- His **body** is a pose skeleton (hips, knees, ankles, shoulders, elbows,
  wrists, neck) with keyframes per animation and interpolated in-betweens,
  drawn at native pixel resolution as limbs with two-tone shading and an
  automatic one-pixel dark outline. This gives smooth, many-frame motion in
  the spirit of Prince of Persia's rotoscoping without hand-drawing every
  frame.
- **Clothing** is colour regions on the body (jersey, shorts, socks, boots,
  skin), so kits and boots are colour swaps. Frames are pre-drawn into
  off-screen images at load and redrawn when he changes cosmetics.
- Other human characters reuse the same body system with different heads,
  palettes and sizes (Goalie Gus is scaled up).

**Animations needed** (approximate frame counts): idle 4, run 8, sprint 8,
jump 3, land 2, shoot (wind-up, charge-hold, strike, follow-through, recover)
5, chip 4, header 3, volley 4, slide tackle 4, stumble/fall/get-up 5,
step-over 4, rainbow flick 6, bicycle kick 6, scorpion kick 6, each
celebration 6–12, disappointed 3, victory 4. Keepers additionally need ready,
dive, catch, punch and throw.

**Approval checkpoint:** before the rest of the game is built around him, the
builder produces a **character sheet image** (portrait in every expression,
plus idle, run, shoot and jump frames in his kit) and hands it to the parent
for sign-off. Iterate until the parent (and ideally Harrison) says it looks
like him.

## Audio

All synthesised with Web Audio in an 8-bit style (square, triangle and noise
voices).

- **SFX:** soft and hard kicks, bounce, post/crossbar clang, net swish,
  whistle (kickoff/full time), crowd roar swell on goals, crowd "ooh" on near
  misses, tackle thud, menu move/confirm/back, coin tally ticks, purchase,
  level-up jingle, unlock jingle.
- **Music:** title theme, menu loop, an optional quieter match loop, victory
  jingle, defeat jingle. Composed as note data in code.
- Separate music and SFX volume settings.

## Technical approach

- **Vite + TypeScript** (strict mode). Plain HTML5 Canvas 2D. No game engine,
  and ideally no runtime dependencies.
- Fixed-timestep simulation at 60 Hz, rendered on `requestAnimationFrame`.
  Game logic stays separate from rendering so physics, AI and economy can be
  unit tested.
- Code areas: engine (loop, input, renderer, camera, scenes), art (palette,
  font, pixel heads, pose skeleton, sprite baking, backgrounds), audio (synth,
  SFX, music data), game (ball, players, AI, match rules, drills), meta (save,
  economy, catalog of upgrades/cosmetics/opponents/venues, achievements),
  scenes (title, hub, career map, match, results, shop, locker, training,
  trophy room, settings). Exact layout is the builder's call.
- **Input:** Gamepad API with standard mapping, polled each frame; connect and
  disconnect handled gracefully; on-screen prompts use A/B/X/Y glyphs.
  Keyboard fallback for everything.
- **Saving:** `localStorage`, versioned schema with migrations, autosave after
  every result, purchase and settings change. **Save code** export/import (a
  copyable string with a checksum) as a backup and for moving computers.
- **Saves survive development.** Every save from the very first one must keep
  working through every later build:
  - Migrations run from schema version 1 onward.
  - Unlocks are worked out from his progress when a save loads, so a move
    added in a later build is granted on the spot if he's already past its
    level.
  - Rebalancing prices or the XP curve never takes away anything he already
    bought or earned.
- **Tests:** Vitest for physics, economy and pricing, save/load and
  migrations, unlock rules and achievements. Visual work is checked in a real
  browser with screenshots during development.
- **Character sheet tooling:** a dev-only page or script that draws every
  frame to a PNG, so the art can be reviewed without playing.
- **Hosting:** GitHub Pages, served straight from this repo at
  `https://dialmasterorg.github.io/SoccerGame/`. It's set up at step 2 so
  Harrison plays at the permanent address from his very first playtest and
  his saves never have to move.
  - A GitHub Actions workflow runs on every push to `main`: it runs the tests,
    builds `dist/`, and deploys it with the official Pages actions
    (`upload-pages-artifact` + `deploy-pages`). Pages source is set to
    "GitHub Actions" in the repo settings (a one-time step for the parent if
    the builder can't do it via `gh`).
  - Because Harrison plays the live site, `main` must always be playable.
    Work happens on branches and merges to `main` when it's ready for him.
  - Every GitHub Pages site in the org shares one browser origin
    (`dialmasterorg.github.io`), so the save uses a game-specific
    `localStorage` key. A custom domain would change the origin; the save
    code covers that.
  - Vite's `base` is `/SoccerGame/`.
  - Photos are never committed or deployed.

## Build order

Each step ends with something playable or reviewable.

1. **Pixel Harrison.** Portrait (four expressions), head in three facings,
   pose skeleton, and idle/run/shoot/jump frames in a default kit, plus the
   character sheet PNG. **Parent approval required.** If the photos haven't
   arrived, step 2 can start with a placeholder character and swap him in
   afterwards.
2. **A basic match.** Backyard venue, 1v1 against a basic AI, ball physics,
   all starting moves, goals, timer, score, kickoff, gamepad and keyboard.
   Plus the GitHub Pages deploy pipeline. **Harrison playtests it at the real
   address.** If this isn't fun, fix it before going on.
3. **Big moments and sound.** Goal slow motion, screen shake, "GOAL!!!",
   celebrations, crowd, rumble, SFX and music, plus the shared anime effects
   (particles, speed lines, impact frames, shockwaves, aura rendering).
4. **Progression core.** Save system (including save code export/import),
   coins, XP and levels, Results screen, Hub, Shop with the four stats.
5. **Career mode.** All five venues and backgrounds, 20 regular opponents plus
   5 bosses, stars and bonus objectives, goalkeepers, 2v2 with teammate AI,
   Quick Match.
6. **Training Ground.** The four drills.
7. **Moves, power moves and cosmetics.** Level-unlocked moves, super meter,
   powering up, the six power moves with their tiers, power forms, Power
   Clash, Locker Room, all cosmetics and celebrations, Trophy Room and
   achievements.
8. **Polish.** Settings, difficulty and the quiet ease-off, balancing pass.

Later, if wanted: instant replay of goals, rain and snow, family members as
opponents or teammates.

## Left to the builder

Physics constants, exact prices and XP curve (within the pacing targets), the
palette, file and module layout, AI internals, music composition, opponent
names and looks beyond those listed, keyboard mapping details, and the tooling
used to produce the character sheet PNG.

## Designer's calls (not confirmed by the parent)

Side-view; 1v1 growing into keepers and then 2v2; no fouls or set pieces;
golden goal; four stats; the moves listed; the power move, power form and
Power Clash details (the parent asked for the DBZ feel, not these specifics);
drills chosen to
suit side-view (Crossbar Challenge and Beat the Keeper instead of a face-on
penalty shootout or cone weaving); venue list and bosses including Biscuit the
Dog; the reward numbers; the Vite + TypeScript + Canvas stack; 320×180
resolution; hand-made head plus skeleton body; the cool-not-cute tone; saves
that survive every build, with unlocks granted retroactively; save code
export at step 4; GitHub Actions deploy to Pages set up at step 2; the final
boss as a fictional Golden Boot champion; club kits reproduced as colours
only, without logos or sponsor; glasses as an optional accessory.

## Still open

- His favourite goal celebration. Until known, the default is "Point to the
  Back".

## Amended 2026-10-29: Harrison's off-screen marker

The camera follows the ball, so on the School Field's bigger pitch
Harrison can be off the side of the screen. When he is, gold chevrons at
that edge of the HUD, at his row (about his chest), point the way to him:
one chevron within 60 px of the edge, two within 180, three beyond. There
is no marker while he is in view. `homeMarker` in `matchView.ts` is the
rule; the chevrons draw in HUD-layer pixels, so they double at the big
view like the rest of the HUD.
