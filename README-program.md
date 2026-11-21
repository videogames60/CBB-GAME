# Program: NIL, facilities, coach (v1)

New file `dynasty/program.js`, run once per offseason from `offseason.js` (after results are final, before the next recruiting cycle opens). The Program tab is the player's view of it. Every number lives in `Program.CFG`.

## NIL grade and boosters
Works like home court. Each grade has a win rate it must beat to hold, as an offset from .500 (F needs .300, C .500, B .620, A .750, A+ .800). Each offseason:

- **record:** (win % − bar) × 0.15, capped at ±6
- **milestones:** conference title +2, conference tournament +1, tournament bid +1, each tournament win +1, Final Four +2, title +4
- **boosters settle:** 15% of the gap to what the program's prestige supports (prestige × 0.85), so one great run lifts the grade but doesn't pin it at 99

The collective is recalculated from the grade when the next class opens.

## Prestige vs NIL
Both follow success, and both have a win-% bar per grade, the same bars for both (C .500, B .620, A .750, A+ .800). Prestige lives in `offseason.js` (`Offseason.CFG.prestige`).

| | NIL (money) | Prestige (reputation) |
|---|---|---|
| record | 0.15 per win-% point vs the bar, cap ±6 | 0.08 per point, cap ±2.5 |
| postseason | conf title +2, conf tourney +1, bid +1, each tournament win +1, Final Four +2, title +4 | tournament 1, semifinal 2, runner-up 3, champion 5, **minus what the program is expected to do**: 1.5 at 90+, 1.0 at 80+, 0.5 at 70+ |
| pull | — | 2% of the gap to the league's average prestige, every season |
| damping | drifts 15% toward prestige × 0.85 | the whole change × 0.6 |
| best year / bad year | about +15 / −3 to −6 | about +3.6 / −1.5 |

An A+ program that goes .500 loses about 1.4 prestige a year (0.8 if it still makes the tournament), but 4–5 NIL a year. Over 20 simulated seasons the five starting blue bloods ended anywhere from 74 to 96 instead of all hitting the old 96 ceiling (the ceiling is now 99), and the number of 85+ programs grows from 5–6 to about 9–13 (it was 17 under the old fixed .600/.400 rule).

### Why the expectation and the pull (long-run check)
`tests/longrun.js` sims 50 seasons unattended. Without them prestige pulled apart every season: in Compact the spread went from 14.6 to 24, a fifth of the league ended at 95+, the bottom 5% sat on the floor, and four schools made 21–24 Final Fours each. A blue blood got +1.2 for every Final Four on top of its record, so a program that was supposed to go deep kept climbing for doing it. Now a 90+ program has to reach the second weekend just to break even in the postseason, a first-round exit costs it a little, and everyone drifts slowly toward the middle unless they keep earning their spot. Over 50 seasons the spread now moves by 1–2 points, with about one school at 95+. The draft's prestige bonus was cut too (0.3 per first-rounder, 0.15 per second, at most 0.75 a year) because it went almost entirely to the schools already at the top.

## Money: one bank balance
Each cycle you have **this year's collective + your bank balance**. The Program tab and the recruiting money bar spell it out: "Collective $1.21M + carried over $983k = $2.19M this cycle", or "Collective $1.21M − debt $3.00M = −$1.79M this cycle".

- **Carry-over:** whatever isn't spent on players or facilities stays in the bank at the offseason, up to **$25M** (anything above the cap is lost, and the report says so).
- **Debt:** spend more than you have (usually a grade drop while your players' deals stay the same) and the balance goes negative. It grows **10% each offseason** and comes out of the next collective first. While free money is negative you can't make offers or buy facilities.
- **Careful with salaries:** player deals are paid again every year, but carried-over money only comes once. A big balance is best spent on facilities or on deals you can still cover next year.
- **AI schools** only put a quarter of their balance toward player deals each cycle (`Recruiting.CFG.ai.bankShare`), and build facilities toward a **target**: their prestige plus a fixed lean of their own (±8, so some schools are builders and some save), between 30 and 95. Below the target they put up to 30% of their free money (capped at one year's collective) into closing the gap; at or above it, up to 15% just to cover the year's wear. So a school that wins more (higher prestige, bigger NIL collective, more left over) builds more, and one that slips lets its arena age. Over 50 Compact seasons the league average holds about 55–57 (it starts near 52; with the old flat 12% it slid to about 40).
- Old saves: an existing debt becomes a negative balance automatically.

## Facilities
Bought with NIL money a point at a time: about $100k per point at 50, $240k at 70, $580k at 90 (×1.045 per level). They decay each offseason by 1 + (level − 60)/25, rounded.

## Coach
Points each season: 2, +1 per 3 wins over .500, conference title +2, conference tournament +1, bid +2, +1 per tournament win, Final Four +2, title +4 (a title run is around 15–25). You spend them on the Program tab (+1 or +5, or Auto-spend); ratings go up to 99. AI coaches auto-spend, leaning into their strengths.

**Turnover:** AI coaches past 14 years retire at 18% a season; after two straight sub-.400 seasons (and at least 3 years) they're fired 45% of the time. About 6–7 coaching changes a year across 74 schools.

**Creation:** on the setup screen, 240 points across tactics, recruiting, development and scouting (30–90 each), with presets: Balanced, Recruiter, Developer, Tactician, Talent eye.

## Also in this pass
- **Relationship weight** now varies by temperament: loyal 0.85–1.0, steady 0.6–0.8, restless 0.4–0.6, ambitious 0.25–0.45.
- **Signing-day warning** in the season log near the end of the regular season and again at Selection Sunday, if you're leading for fewer recruits than you have open scholarships.

## Long-run check
`node program_check.js [seasons] [seed]` sims a whole league and prints NIL, facilities, coach ratings, prestige (with spread, 85+ and sub-35 counts), debt and bank balances every few seasons, plus where the starting top five ended up. Over 20 seasons on two seeds: NIL average settles about +5 above where it starts, facilities +7 to +8, coach average +6 to +9. AI banks build to an average of about $8M (a few hit the $25M cap), and no AI school ends up in debt.
