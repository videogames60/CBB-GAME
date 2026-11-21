# Records and the History tab

`dynasty/records.js` (rules, numbers in `Records.CFG`), `ui/ui_history.js` (the History tab).

## The record book
Kept for the league and for every school (`lg.records = { league, schools: { teamId } }`).

| | What | When it's checked |
|---|---|---|
| Single game | points, rebounds, assists, steals, blocks, threes | as each game is played |
| Single season | the same six as totals, plus points / rebounds / assists per game (60% of the team's games to qualify) | end of the season |
| Career | top 10 in the league and top 5 at each school: points, rebounds, assists, steals, blocks, threes | when a player leaves (graduates, is drafted, or declared and went undrafted) |
| Team | most wins, best record (10+ games), longest winning streak, most points in a game, biggest win | as games are played / end of the season |

- A record is `{ v, n: name, t: teamId, y: season, x: detail }` (opponent, games played, career span).
- **Records start when the dynasty does.** A player who was already in college counts only what he did from then on.
- **A school's career lists count only his seasons there.** A transfer shows up at both schools with each one's share, and in the league list with his whole career.
- **News:** from the second season on, a new league record, or a new record at your school, goes in the season log.
- **Size:** fixed (records replace each other): about 260 KB in Compact and about 1.2 MB in Full.

## The History tab
- **Program:** any school (yours by default; pick another from the list).
  - all-time record, titles, title games, Final Fours, tournaments, AP top-25 finishes and draft picks
  - year by year
  - the school's record book (career lists top 5)
  - its coaches with their records there
  - its best former players (from the archive: awards, draft picks, 1,200+ points)
  - its most-played series
- **League:**
  - every season's champion, runner-up, Final Four, Player of the Year, Coach of the Year and Most Outstanding Player
  - the most successful programs (titles, then Final Fours, then tournaments)
- **Record book:** the league's records, career lists top 10.
- **Hall of Fame:** next pass.
