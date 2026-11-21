# Awards, the player archive and series records

`dynasty/awards.js` (rules, every number in `Awards.CFG`), `ui/ui_awards.js` (the top of the Leaders & Awards tab, award lines on cards, the report card).

## The awards
Announced on **Selection Sunday** (after the conference tournaments):

| National | Each conference |
|---|---|
| Player of the Year | Player of the Year |
| Defensive Player of the Year | Freshman of the Year |
| Freshman of the Year | Coach of the Year |
| Sixth Man of the Year | All-Conference 1st and 2nd teams (5 each) |
| Most Improved Player | Tournament MVP |
| Coach of the Year | |
| All-American 1st, 2nd and 3rd teams (5 each) | |

After the title game: the national tournament's **Most Outstanding Player**.

During the season the Leaders & Awards tab shows the **races**: the top five in each national award, live.

## How winners are picked
- **Players:** per-game production `pts + 0.9 reb + 1.3 ast + 1.8 stl + 1.6 blk − 0.8 missed FG − 0.45 missed FT − 1.3 TO`, × team success `1 + 0.5 × (win% − .500)`. He needs 60% of his team's games and 12+ minutes a game. All-Americans and All-Conference are simply the next best by the same score, with no positions.
- **Defense:** `(2 stl + 1.8 blk + 0.3 dreb) per game + 0.08 × (average of his two defensive ratings − 50)`, × team success.
- **Freshman:** the best freshman by the player score.
- **Sixth Man:** started at most 35% of his games.
- **Most Improved:** the biggest jump in `ppg + 0.8 rpg + 1.2 apg` over last season (he needs 10+ games last year and 15+ minutes now). There's none in a league's first season.
- **Coach of the Year:** win % minus what the program is expected to win (the hot-seat bar, prestige-based). A regular-season conference title adds 6 for the conference award.
- **Tournament MVP / Most Outstanding Player:** production in those games only. For the Final Four, among its four teams, with the champion's players × 1.15.

## Where they're kept
- `lg.awards[year]`: national awards forever; conference awards for the last 10 seasons (to keep the save small).
- `p.awards` on every player and `c.awards` on every coach: `{ y, k }` with codes `POY DPOY FOY SIX MIP COY MOP AA1 AA2 AA3 CPOY CFOY CCOY AC1 AC2 CTMVP`. They show on player and coach cards ("🏆 2× 1st-team All-American, POY 2031").
- The season log announces Player and Coach of the Year and your team's honors. The offseason report has an awards card.

## The archive
When a player leaves the league (graduated, drafted, or declared and went undrafted), he's kept in `lg.archive.players` if any of these is true:
- he won anything beyond 2nd-team All-Conference
- he was drafted
- he scored 1,200+ career points

Each record holds his seasons (`[year, class, school, gp, ppg, rpg, apg]`), career totals, awards, draft pick and final overall. Records and the Hall of Fame (next passes) read from it. Size: about 290 bytes a player, about 130 players a year in the Full league, so about 2 MB over 50 seasons.

## Series records
Every pair of schools that has played keeps an all-time record (`lg.series["A|B"] = [A's wins, B's wins]`), including postseason games. It shows on the schedule ("3-5 all-time" / "first meeting"), the hub's next game, and the History tab (your most-played series).

## Coming next
- **Pass 2:** league and school records (single game, season, career, team), and the History tab reorganized.
- **Pass 3:** the Hall of Fame (league-wide) and retired jerseys (each school's own). Both are inducted right after a player leaves: a hard threshold, at most **5** a year each.
