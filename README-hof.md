# Jersey numbers, preseason picks, the Hall of Fame, retired jerseys, year in review

## Jersey numbers (`League.assignNumbers`, league.js)
- **The set:** basketball's usual numbers, digits 0–5 only: 0–5, 10–15, 20–25, 30–35, 40–45, 50–55.
- **No duplicates:** every player on a team has his own, and never one the school has retired.
- **Keeping a number:** a player keeps his number. A transfer keeps his too if it's free at his new school.
- **Assigning:** anyone without one (freshmen, walk-ons, transfers whose number is taken) gets a free number picked from a hash of his id. This runs at the start of every season, and when an older save loads.
- **Where they show:** the roster, player cards, the live game and box scores.

## Preseason picks (`Awards.preseason`, awards.js)
Made when each season starts. Display only: they aren't honors and never go on a player's card.
- **Player of the Year, All-American and All-Conference:** overall + 0.25 × last season's production (ppg + 0.8 rpg + 1.2 apg, if he played 10+ games). Teams are 2 guards, 2 forwards and a center.
- **Defensive Player of the Year:** the average of perimeter D, interior D, steal and block.
- **Freshman of the Year:** the best incoming freshman by overall.
- **Breakout candidate:** the biggest overall jump in this offseason's development.

The Leaders & Awards tab shows them until teams have played 5 games, then switches to the live races. They stay a toggle away ("Preseason picks") for every season, so you can compare. They're stored in `lg.awards[year].preseason`; the conference picks are dropped after 10 seasons, like conference awards.

## The Hall of Fame (`dynasty/hof.js`)
**When:** at the end of every offseason, after the draft and the portal.

**Candidates:**
- players who just left: graduated, drafted, or declared and went undrafted (only archived players qualify, see README-awards)
- head coaches who retired that offseason

**Player score:**
- **Awards:** POY 40, All-American 18 / 12 / 8, Final Four MOP 15, DPOY 12, conference POY 8, FOY 5, all-conference 5 / 2, Sixth Man / MIP / conference tourney MVP 3, conference FOY 2.
- **Production:** career points / 100, rebounds / 150, assists / 120, steals and blocks / 60.
- **Winning** (team results while he was there): title 10, Final Four 5.
- **Draft:** top-5 pick 10, first round 6, second round 2.

**Bar:** 120, at most 5 a year, best first. That's about one a year in Compact: Players of the Year, multiple All-Americans, title runs.

**Coaches:** wins / 40, titles 20, Final Fours 8, Coach of the Year 6, conference COY 1. The bar is 40, at most 2 a year. It's meant to be rare: a coach needs a title plus a Final Four or two over a long career, or a few Final Fours and Coach of the Year awards without one; a long, winning career alone doesn't do it (700 wins is under 18 points). In a 50-season Compact sim 17 coaches made it, about one every three years (a bar of 60 let in 12, and none in 20 seasons of the Full league). Coaching careers count from the start of the dynasty, so coaches start making it as careers lengthen.

Stored in `lg.hof = { players, coaches }`, with a summary of each career. History → Hall of Fame lists them, with an "only your school" filter.

## Retired jerseys (`team.jerseys`)
**Each school by its own standard.** A player's legacy at a school counts only his seasons there:
- awards won there
- points / 100 and rebounds / 150 there
- team success while there, which counts less than in the Hall of Fame: title 6, Final Four 3, tournament 0.5 (a title team's role players don't get jerseys)
- his draft spot if he left from there

**Bar:** 30 + 0.45 × prestige. A D school (about 30 prestige) needs about 44; an A school (about 88) needs about 70. So a small school retires its best player ever, and a blue blood needs an All-American career or a starring role on a title team.

**Cap and Hall of Famers:** at most 5 a school a year. A Hall of Famer's jersey is always retired at the school where his legacy is biggest.

**Retired numbers** show on the program's History page (in gold), and that number isn't worn there again: anyone holding it gets a new one the next season.

## Year in review
The first card of the offseason report:
- your season: record, AP finish, postseason, prestige change
- honors
- records set (league and school; careers that made the top lists, one line a player)
- your draft picks
- any jerseys your school retired
- this year's Hall of Fame class
