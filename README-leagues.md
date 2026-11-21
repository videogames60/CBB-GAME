# Leagues

A league is data: a list of conferences (and, optionally, the real schools in
them) plus a few rules. `dynasty/leagues.js` holds the built-in ones;
`League.generateLeague(seed, { league })` builds any of them. Everything else
(schedule, brackets, recruiting, rankings) reads the size from the league, so
the same code runs 8 teams or 500.

## The two presets

| | Compact | Full |
|---|---|---|
| Teams / conferences | 74 / 8 | 352 / 32 |
| Conference sizes | 8–10 | 9–16 |
| Tiers (conferences) | 3 · 2 · 2 · 1 | 6 · 8 · 9 · 9 |
| Average prestige by tier | 72 · 60 · 50 · 42 | 70 · 57 · 46 · 38 |
| Non-conference games | 11 | 11 |
| Conference games | home and away (14–18) | 20 (16–18 in the 9–10 team conferences) |
| Conference tournament | top 8 | everyone, byes for the top seeds |
| National tournament | 16 | 68: 64 + a First Four |
| Recruiting class | 237 | 1,126 |

Schools in a conference spread −14…+16 prestige around the tier average.

## Picking your school

On the setup screen: league, seed, conference (grouped by tier), then **School**:

- **Your own new program** replaces one school in that conference with yours
  (name, colours, the prestige you pick).
- **Any existing school**: you take it over as it is (its prestige, facilities,
  NIL and roster). Only your coach is yours.

## Rules

Each definition can carry `rules`; anything missing is filled in by size
(`Leagues.rulesFor`):

| Rule | Meaning | Default |
|---|---|---|
| `nonConfGames` | games per team outside the conference | 11 |
| `confGames` | conference games per team; 0 = everyone home and away | 0 up to 120 teams, else 20 |
| `confTourney` | teams in each conference tournament; 0 = all | 8 up to 120 teams, else 0 |
| `natField` | national tournament size (at least one per conference) | 8 / 16 / 32 / 68 by size |

**Conference schedule.** With `confGames`, a big conference plays everyone once
plus randomly chosen return games until every team has the count.

**Non-conference schedule.** Opponents come from the nearest-strength fifth of
the league (or the nearest 20), so blue bloods still host small schools.

**Brackets of any size.** A conference tournament that isn't a power of two
gives byes to its top seeds (a 10-team conference: 7v10 and 8v9 play in,
1–6 wait). A national field that isn't a power of two starts with play-in
games: in a 68-team field the four lowest-ranked automatic bids play for two
16 seeds and the last four at-large teams for two 11 seeds (the First Four).
Fields of 32 or more are seeded on an S-curve into four regions (East, West,
South, Midwest); the Final Four pairs region 1 with 4 and 2 with 3. Rounds are
named the usual way (Round of 64, Sweet 16, Elite Eight, Final Four).

## League files: custom leagues and rosters

A league file is a league as JSON: conferences, schools, their coaches and
their rosters. Two buttons make one:

- **Export league file** on the setup screen: the chosen league with that
  seed's schools, coaches and rosters, ready to edit.
- **Export league file** on the League tab, during a dynasty: the league as it
  is today (current prestige, coaches and rosters), to start a new dynasty from.

Edit it (by hand, or later in the league editor) and bring it back with
**Import league file…** on the setup screen. Imported leagues are remembered
in that browser (a Full-size file may be too big for browser storage; the game
says so, and you import it again after a reload). A file with problems isn't
used: you get a list of what's wrong instead.

Everything is optional except the conference list. The game generates the
league from the seed first, then lays the file over it, so a file can be
complete (an export: the league comes back exactly, whatever the seed) or
sparse (a few names and one star player; the rest is made up).

```json
{
  "id": "my-league",
  "name": "My League",
  "rules": { "nonConfGames": 11, "confGames": 18, "confTourney": 0, "natField": 68 },
  "tierPrestige": { "1": 72, "2": 60, "3": 50, "4": 42 },
  "defaultConf": "BIG",
  "conferences": [
    { "id": "BIG", "name": "Big Conference", "short": "BC", "tier": 1, "size": 12, "region": "Midwest",
      "schools": [
        { "name": "Gotham State", "mascot": "Bats", "abbr": "GSU", "color": "#1A5276", "city": "Chicago, IL",
          "prestige": 88, "homeCourt": 90, "facilities": 85, "nil": 92, "pipelines": { "IL-CHI": 70, "IN": 40 },
          "coach": { "name": "Bruce Wayne", "rating": 85, "recruiting": 80, "development": 75, "scouting": 70,
                     "offense": "motion", "defense": "man", "years": 9 },
          "players": [
            { "name": "Jalen Cross", "pos": "PG", "class": "JR", "height": "6-3", "ovr": 82, "potential": 88, "home": "Gary, IN" },
            { "name": "Marcus Hill", "pos": "C", "class": "FR", "height": 84,
              "ratings": { "intDef": 92, "block": 90, "reb": 88 } }
          ] }
      ] }
  ]
}
```

**Conference:** `id` (short code), `name`, `short`, `tier` 1–4, `size`, `region`
(Northeast, Southeast, Midwest, South, West) or `states` (like `["TX", "OK"]`):
only where made-up schools are placed; each school's own city is what
recruiting uses. List fewer `schools` than `size` and the rest are made up.

**School:** `name`, `mascot`, `abbr`, `color` (like `#1A5276`), `city` (a city
on the map, "Name, ST": see README-geo), `prestige` 20–96, `homeCourt` /
`facilities` / `nil` 1–99, `pipelines` (area id → strength 0–100), `coach`,
`players`. Without a city the school is placed in its conference's footprint;
without pipelines it gets starting ones near home.

**Coach:** `name`, `rating` (tactics), `recruiting`, `development`, `scouting`
(25–99), `offense` (balanced, motion, pace_space, grind, post, seven_seconds,
run_gun, iso), `defense` (man, gamble, zone23, zone131, press), `years`.

**Player:**

| Field | Values | If left out |
|---|---|---|
| `name`, `pos` | required; pos PG, SG, SF, PF, C | — |
| `class` | FR, SO, JR, SR | FR |
| `height` | inches (80) or "6-8" | from his archetype |
| `ratings` | any of close, mid, three, pass, handle, steal, block, perDef, intDef, reb, stamina (1–99) | generated |
| `ovr` | 25–99: the generated ratings are set to land on it | the school's usual level for his class |
| `potential` | 25–99 (never below his overall) | rolled |
| `temperament` | loyal, steady, restless, ambitious | rolled |
| `loyalty`, `workRate` | 0–99 | from temperament / rolled |
| `moneyWeight` | 0–1, how much money matters to him | rolled |
| `home` | his hometown, a city on the map ("Houston, TX") | near the school about half the time, else anywhere |
| `redshirt`, `redshirtUsed`, `archetype`, `wildcard` | as the game shows them | — |

Give ratings for full control, just an `ovr` to have ratings made to match, or
a few ratings to shape a player (the others are generated at the school's
level, so three great defensive ratings make a defensive specialist, not a
star). A roster holds 13; a shorter list is filled with generated players at
the positions it's thinnest. Salaries are set by the game from each player's
worth, as for any new dynasty. Ids, abbreviations and school names must be
unique; up to 500 teams. A Full export is about 1.6 MB, Compact about 0.3 MB.

## The league editor

`league-editor.html` (in the game folder; open it like the game) reads, edits
and writes league files. It uses the game's own code for players, schools,
overalls and checking, so what you see is what the game builds.

- **Start** from Compact or Full with a seed (the same schools and players the
  game would make), from a league already imported into the game, or **open**
  any league file. Whatever a file leaves out is filled in (it tells you how
  much), so you always edit the complete league.
- **League**: name, description, default conference, rules, tier prestige,
  and a table of conferences with their average prestige and overall.
- **Conference**: name, id, tier, region; its schools in one editable table
  (name, mascot, abbreviation, color, prestige, home court, facilities, NIL);
  add, delete, or move a school to another conference; add or delete
  conferences.
- **School**: the program, the coach (or a new random one) and the roster:
  every player's name, position, class, height, potential, all 11 ratings,
  temperament, loyalty, money weight, work rate and redshirt. The overall
  updates as you change ratings; type a new overall and his ratings move
  together until it lands. ↻ replaces a player with a new random one, and
  **New random roster** remakes the team at its prestige. Sort by any column.
- **Search** finds schools, coaches and players across the league.
- **Undo** (Ctrl+Z outside a text box) goes back step by step. The red/green
  count runs the game's file check as you edit; click it for the list.
- Your work is kept as a draft in the browser (offered on the start screen
  next time) until you save.
- **Save file** downloads the league file to import in the game. **Send to
  game** puts it straight into the game's League list in the same browser
  (open both pages the same way, e.g. from the same folder; a Full league may
  be too big for browser storage, then use Save file).

Later, if wanted: bulk changes (a whole conference's prestige), spreadsheet
(CSV) export and import of rosters, editing a dynasty save in progress.

## What scales with size, and how

- **Recruit quality** follows each kid's share of the class (best 71 →
  worst 41), so every school sees the same talent flow in any league and a
  bigger league stays as stable as the small one.
- **Asking prices and recruit priorities** are calibrated on the 237-kid
  class and read at the same share of the class (`refClass`): #1,126 of
  1,126 asks what #237 of 237 does.
- **Stars**: 5★ is the top 25 and 4★ the top 110 in any league (the elite are
  always few); 3★ reaches the same share of the class (76%).
- **AI recruiting**: each school ranks the kids it can afford by its own
  read and only looks closely at a shortlist (30, or 6 per offer it wants),
  with its depth chart and its money worked out once per turn.
- **Quadrants** (committee) are fractions of the league; polls are a top 25.
- **Draft**: the bar is absolute, so departures grow with the league (about
  20 a year at 352 teams, 4–6 at 74).
- **Screens**: Standings and Postseason show one conference at a time with a
  picker when there are more than 8; the League tab filters by conference,
  tier and name; the national bracket groups games by region and folds
  finished early rounds.

## Speed and size

`node tests/run.js speed` (add `league=full` for the big one):

| | Compact | Full |
|---|---|---|
| Build league + recruiting class | 0.2 s | 2.2 s |
| Schedule | 0.05 s | 0.7 s |
| A whole season, all games | about 15 s | about 90 s |
| of which recruiting | about 1 s | about 13 s |
| Offseason (decisions, portal, next class) | under 1 s | about 9 s |
| Save after one season | 2.4 MB | 11.6 MB |

A game takes about 11 ms in the engine. Games nobody watches skip recording
play-by-play, and the roll trace (see the Rolls tab) is only kept for games
you coach. In the browser, multi-day sims (Sim week, Sim to end, Quick sim,
getting to your next live game) run in chunks with a progress bar and a Stop
button, so a Full season doesn't freeze the page: about 0.7 s per game day.

Saves go to IndexedDB (no 5 MB cap) or a downloaded file, so a Full save fits.
