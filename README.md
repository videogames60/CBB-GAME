# Hoops Dynasty

The dynasty layer sits on top of the existing sim. Every game in the country is
played with the full engine — no approximations — because a full slate of ~50
games takes well under a second.

## Files

```
sim/            the game engine: engine, tuning, archetypes, sample_teams, text
dynasty/
  geo.js        the map: areas (states, big ones split), cities with
                coordinates, recruit talent by area, distances
  draft.js      the draft: 60 picks, declaring and testing the waters,
                draft history and reputation
  pipelines.js  recruiting pipelines: strength per area, levels, slots,
                yearly growth from signings and fading
  leagues.js    league definitions: conferences (and optionally the schools in
                them) and rules as plain data; the Compact (74) and Full (352)
                presets, and league-file checking for custom leagues
  league.js     world generation from a definition: regions, conferences, schools, coaches,
                rosters, prestige, the dynasty player record, rotations
  ui_season.js     schedule, day-by-day simulation, standings, stat rollup,
                conference tournaments, Selection Sunday, national bracket
  rankings.js   adjusted efficiency, AP + Coaches polls, committee resume
  ui_recruiting.js high school recruiting: the pool, scouting, offers, AI schools
  ui_program.js    NIL, the bank, facilities, coach ratings and points
  roster.js     roster decisions: transfer odds, deals, promises
  portal.js     the transfer portal
  coaches.js    coaching staffs, the coach pool, job security, the coaching carousel
  awards.js     season awards, the player archive, series records
  records.js    the record book: league and school records
  ui_offseason.js  the year change: graduation, draft, development, decisions,
                transfers, portal, arrivals, prestige
  development.js player growth (XP → rating points)
  save.js       save slots and save files
dynasty.html    the dynasty game: page layout only
ui/             the dynasty screens, plain scripts loaded in order by
                dynasty.html (they share globals, no build step):
  ui_style.css     all styling
  ui_core.js       helpers, setup screen, sim controls, tabs, render
  ui_season.js     hub, schedule, roster, standings, rankings, leaders, league,
                   history, postseason
  ui_live.js       the live game screen
  ui_court.js      the court view in the live game (the ten players, matchups, the ball following the play-by-play)
  ui_offseason.js  roster decisions, the portal, the offseason report
  ui_program.js    the program tab
  ui_recruiting.js the recruiting board and recruit cards
  ui_saves.js      save slots and files
  ui_debug.js      the debug tab
  ui_map.js        the Map tab
  ui_draft.js      the Draft tab
  ui_staff.js      the Staff tab and the coaching carousel screens
  ui_awards.js     award races and winners (Leaders & Awards tab)
  ui_history.js    the History tab: programs, the league by year, the record book
  ui_help.js       the help text: every screen's tip (edit the words here)
  us_map.js        US state outlines for the map (generated data)
game.html       the exhibition viewer — coach a single game
league-editor.html  the league editor: edit league files (conferences,
                schools, coaches, every player), then import them in the game
harness.js      engine stat check against college numbers (see Tests)
tests/          balance checks and a browser smoke test (see Tests)
```

The sim never imports from `dynasty/`, so the tested part stays stable.

Each system has its own write-up: README-recruiting, README-program,
README-roster, README-portal, README-rotation, README-development.
README-draft covers the draft. README-coaches covers staffs, hiring, the hot seat and the carousel. README-awards covers awards, the archive and series records. README-records covers the record book and the History tab. README-geo covers the map data and how to tune it. README-leagues covers the two presets, custom league files and how
everything scales with league size.

## Tests

Run these after any change, from the game folder:

- `node tests/run.js` — about 35 balance checks in under a minute: engine stats vs college numbers, overall even across positions, no brutal tactics, development curves, scouting miss rates and board ordering, and two dynasty seasons end to end (rosters, money, draft, transfers). Each line shows the number and the range it should sit in. `node tests/run.js full` uses bigger samples; `node tests/run.js scouting` runs one group (engine, positions, tactics, development, scouting, dynasty, speed). The **speed** group times league build, a whole season (and the recruiting share of it), each offseason step and the save size; The **league** group checks both presets (team counts, unique names, schedule counts). `league=full` runs the dynasty and speed groups on the 352-team league (about 5 minutes). A WARN means look at it: if you changed that system on purpose, update the range in the file.
- `node tests/geo_check.js` — checks the map data and prints each area's share of a recruiting class (for tuning; see README-geo).
- `node tests/longrun.js [seasons] [league=full] [seed=N] [csv]` — the long-run stability check: sims up to 50 seasons unattended (Compact about 10 minutes, Full about a minute and a half a season) and prints a row a season (prestige spread, ratings, team strength, money, NIL, facilities, coaches, pipelines, save size, memory), what part of the save grows, then trend checks comparing seasons 6–15 with the last 10 (the first five are a new league filling in). Saves are round-tripped every 10 seasons. `csv` writes every row to tests/longrun-<league>-<seed>.csv.
- `node tests/program_check.js` — 20 seasons of the money/NIL/facilities economy.
- `node tests/recruit_check.js` — a few recruiting cycles: who signs where, for how much.
- `python3 tests/ui_smoke.py` — clicks through a whole year in the browser (every tab, a recruit, a live game, roster decisions, the portal, the next season, then an exhibition game in game.html) and fails on any JavaScript error. Needs `python3 -m http.server 8765` running in the game folder and Playwright (`pip install playwright && playwright install chromium`). Screenshots go to `tests/shots/`. `LEAGUE=full` runs it on the 352-team league (a few minutes), `TAKEOVER=1` coaches an existing school.
- `python3 tests/mobile_audit.py` — opens every main screen, a recruit card and a live game at phone size (390 px, an iPhone 14) and reports any screen wider than the phone and buttons too small to tap. Screenshots go to `tests/mshots/`. Same server as above.

**Phones.** Below 640 px wide the game switches to a phone layout (all in ui_style.css, plus two small pieces of ui_core.js): a slim header with the main button and a **More** menu, the tabs as one swipeable row, every table scrolling sideways in its own box with the first column pinned (ui_core.js wraps every table automatically), bigger buttons, cards full screen, and in the live game the court right under the scoreboard with the lineups as tabs.
- `node harness.js` — 400 games of random teams vs NCAA targets per team per game. `node harness.js 1 5 --box` prints one game's play-by-play and box score; `--endgame` checks comebacks and late fouling; `--styles` shows points per possession by scheme and fit; `--players` shows rating distributions from the generator.

## Running it

Open `dynasty.html`. Pick a league (Compact, Full, or one you imported), a
conference, then either create a program — name, mascot, abbreviation,
colour, prestige — or take over an existing school; build your coach and start. Prestige drives roster talent,
recruiting pull and home-court strength.

- **Play game** coaches your next game live; **Quick sim game** fast-forwards the country to your next game and plays it
- **Sim day / week / to end** advance without stopping (multi-day sims show a progress bar with a Stop button)
- **Help:** the first time you open an important screen its tip pops up; close it and it
  stays as the ⓘ bar at the top of that screen (click to open). The **?** button lists
  every tip and can switch the popups off or show them all again. All the text lives in
  `ui/ui_help.js` as plain HTML; numbers come from the CFG blocks so they stay right when tuned.
- **50 seasons** per dynasty (`League.MAX_SEASONS` in league.js). The header counts them; after the last offseason the report shows your career and offers to export the league as it stands, so you can keep going in a fresh dynasty.
- **Save / Saves…** write to numbered slots in the browser, or to a file. Both are compressed (the browser's built-in gzip, about 8× smaller: a 20-season Full league save is about 2–3 MB instead of 17). Save files end in `.hoops`; older plain `.json` saves still load.

## Coaching schemes

Every coach in the league is generated with a scheme he actually runs,
weighted so plain styles stay common and gimmicks stay rare (balanced 26%,
motion 18%, down to iso 4%; man 46% down to press 8%). Iso coaches get a
designated go-to guy, re-picked every offseason as the roster turns over.

**Balance.** A scheme's benefit scales with the coach's tactics rating and how
well the lineup fits it; its cost is the same for every coach (a better coach
never pays more for a bad fit). Balanced and Man have no cost and a smaller
ceiling: the safe picks. Against the same roster on Balanced/Man, every other
scheme lands at about 42–55% depending on fit; `tests/run.js` checks that none
falls below 40%.

Opponent schemes are visible on the next-game card, a **Runs** column on the
Schedule, the League tab, and under both team names on the live scoreboard.
Your own scheme is set on the Hub under **Your scheme**, with a live fit grade.

## The world

A league comes from a definition in `dynasty/leagues.js`: a list of
conferences (name, tier, size, region), each optionally with its real
schools, plus rules (game counts, tournament sizes). Missing schools are made
up. **Compact** is 74 teams in 8 conferences; **Full** is 352 teams in 32
conferences with a 68-team tournament. A league file (JSON) can define your
own, down to coaches and every player's ratings; export one from the setup
screen (or from the League tab mid-dynasty), edit it, import it. See
README-leagues. Each school has prestige, home
court, facilities and NIL as 0–99 ratings shown as letter grades, plus a coach
with separate tactics / recruiting / development / scouting ratings.

Schedule: 11 non-conference games against similar-strength teams outside your
conference, then the conference slate: everyone home and away in Compact, 20
games in Full's big conferences. No team ever plays twice in a day or on
back-to-back days (`SCHEDULE.minGap`).

**Overall is even across positions.** The overall formula subtracts a small
per-position offset (`tuning.ovr.posOffset`) so equally good players read the
same overall at every position. Games never read overall; rank, pay, minutes
expectations, starters and the draft do.

## Rankings — three lists that disagree on purpose

**Adjusted efficiency** (KenPom-style) is the truth: points per 100 possessions
scored and allowed, iteratively corrected for opponent strength and venue.

**The polls** are human. Both start from preseason expectations (roster
strength + prestige), then update weekly with inertia, record bias, reward for
Q1 wins, punishment for bad losses, recency, and seeded voter noise. The
Coaches poll uses the same machinery with lazier weights — more inertia, more
love of a good record, less efficiency, a longer preseason hangover — so the
two drift apart in believable ways.

**The committee resume** is what actually picks and seeds the field:
efficiency + quadrant record + schedule strength + road wins, with enough
weight on record that a .500 team can't sneak in. Quadrant boundaries are
league-size fractions, so the same code works at 74 or 364 teams.

All three update every 7 days of season time and live in `season.rankings`.

## Postseason

When the regular season ends, each conference runs a single-elimination
tournament (Compact: top 8; Full: everyone, with byes for the top seeds;
neutral court, rounds every 2 days). The winner gets the automatic bid.

Selection Sunday: one auto bid per conference plus at-large teams by committee
rank, with the First Four Out recorded for grievance purposes. Compact's field
is 16, seeded 1–16. Full's is 68: the First Four (the four lowest auto bids for
two 16 seeds, the last four at-large for two 11 seeds), then 64 teams seeded
1–16 in four regions, through the Final Four. Brackets of any size work (byes
or play-ins). Everything runs through the normal day loop, so your games carry
you through your conference tournament and (if you make it) the big one.

## Playing your games live

**Play game** opens the full coaching view: pregame scouting of the opponent,
style and go-to-guy picks, a rotation-minutes sheet that must total 200, then
the live game with play-by-play, speed control, possession stepping, timeouts,
mid-game style switches, manual substitutions (or auto-coach), foul-trouble and
opponent-run alerts, the lineup-fit readout, and the late-game situation strip.
**Sim to end** hands your bench to the assistant (auto subs) for the rest of
the game. The result flows straight back into the season.

The **Rolls** tab (here and in game.html) lists every dice roll the engine
made, with the odds: who handles the ball, which action, shot zone, how open,
foul, block, make, rebound, fast break. A gold line starts each possession.
Only games you coach keep it; simulated games skip it (and their
play-by-play) for speed.

## The offseason

When the champion is crowned, **Advance to offseason** runs the year change:

1. history entries; underclassmen projected in the first round declare,
   31–60 test the waters; then the draft (60 picks, before your roster
   decisions; README-draft); seniors left graduate
2. development (README-development)
3. **roster decisions**: transfer chances, deals, promises, pushing players out (README-roster)
4. the **transfer window** and the **transfer portal** (README-portal)
5. arrivals: signed recruits, portal signings, walk-ons to fill 13; classes
   advance; NIL, facilities, coach points and prestige update (README-program)

Prestige drifts: titles and tournament runs build a program, losing seasons
erode it, slowly (`Offseason.CFG.prestige`).

## Rotation

Auto or manual, 7- to 13-man, with AI coaches' depth varying by coach and
roster. See README-rotation.

## End of a half

The end of a non-final period has its own rule: inside the shot clock, hold
for the last shot **regardless of the score**, since nobody is protecting a
lead at halftime. No intentional fouling. End-of-half uses its own
`halfTimeScale` (1.05) rather than the end-of-game 1.35 stretch, and releases
at 0:08, so a slow action can't eat the attempt.

Two older buzzer problems were fixed along the way: a rebound with 8 seconds
left no longer gets walked up until the horn (`clock.pushUpBelow`), and an
action chosen with 6–8 seconds left forces an attempt (`clock.buzzerShotAt`).
Period-ending possessions that produce a shot went from 77% to 90%.

**Two-for-one** — pushing a quick shot around 0:35–0:45 to get the ball back —
is not built yet.

## Roster tools

Click any column header to sort; toggle between per-game **Stats** and raw
**Ratings** views. Click a player to open his card: every rating with bars,
season and career numbers, year-by-year history — and on your own roster the
card is editable: name, class, all eleven ratings, rotation minutes, redshirt.

## The player record

```js
{
  id, name, pos, height, archetype, wildcard, ratings, starter,
  class: "FR"|"SO"|"JR"|"SR", redshirt, redshirtUsed, eligibilityUsed,
  potential, xp, devRate, moneyWeight, salary, loyalty, ptWeight,
  homeRegion, preferences: [...], temperament,
  season: {...}, career: {...}, history: []
}
```

## Sim changes made for the dynasty layer

- **Home court** lives in `tuning.homeCourt`, scaled by the home school's
  rating. Home teams win about 59% at about +4.4 points (real NCAA ~60%, +3.5).
- **Rebounding** position weights compressed and the height coefficient halved,
  so guards rebound.
- **Assists**: `pass.kInitiator` reverses the ball to the best playmaker.
  Still light (about 12 a team vs a real 13.5).

## Performance

Measured by `node tests/run.js speed` (README-leagues has both leagues):

- Compact: build 0.2 s, a whole season about 15 s, the offseason under 1 s,
  a 2.4 MB save
- Full: build 2.2 s, a whole season about 90 s (0.7 s a game day), the
  offseason about 9 s, an 11.6 MB save (IndexedDB, so it fits)

## Not in yet

Awards and the record book, coach career mode, two-for-one, potential drift (boom/bust after a player arrives).
