# Player development

Files: `dynasty/development.js` (XP and growth), `dynasty/season.js` (counts big games), `dynasty/league.js` (season stat fields). This replaces the "Development" section of README.md.

## XP during the season
- **Minutes** are the floor: a full starter's season is 1,000 XP. Deep bench earns 22% of that, redshirts 55%.
- **Production** above what his class is expected to give per 40 minutes adds more.
- **Big games** (these never counted before, because nothing recorded them):
  - every conference or national tournament game he plays: +12
  - every game he plays against a top-25 team (this week's AP poll; before the first poll, the 25 strongest rosters): +6, postseason included
  - both scale with his minutes share. A champion's star picks up about 200 extra XP, about a fifth of a season. A typical player gets about 50.

## Rating points at the offseason
Points = 70 × work rate × class × **potential rate** × XP × coach × facilities × luck.

| Factor | Range |
|---|---|
| Work rate | 0.85–1.25 |
| Class | FR 1.00, SO 0.85, JR 0.65, SR 0.45 |
| Potential rate | 0.35 at potential, +0.04 per point below it, up to 1.35 (25+ below). Past potential: 0.15 |
| XP | 0.26–1.50 |
| Coach development | 0.90–1.12 |
| Facilities | 0.95–1.06 |
| Luck | 0.80–1.25 |

**Potential is a rate, not a wall.** The further a player is below his potential, the faster he grows, in a straight line. A 55 with 95 potential outgrows a 55 with 75 potential from his first offseason. He can still pass his potential, slowly.

**Where points land:** randomly, one at a time across the 10 ratings. There's no per-rating limit any more (it used to be 9 per offseason, which also capped overall gains at +9). A point that lands on a rating already at 99 rerolls onto one that isn't, so nothing is wasted.

## Calibration (four-year starters who arrive at 55)
| Potential | Yearly gain | As a senior |
|---|---|---|
| 65 | +7 / 4 / 1 / 1 | 67 |
| 75 | +11 / 6 / 3 / 1 | 76 |
| 85 | +13 / 8 / 4 / 2 | 83 |
| 95 | +13 / 11 / 6 / 3 | 88 |
| 85, low work rate | | 80 |
| 85, high work rate | | 86 |

Best single offseason is about +17 to +22 (a raw, high-potential, hard-working freshman with a lucky summer).

League-wide average gains (FR +6.1, SO +4.9, JR +4.2, SR +2.6) are close to the old rules. Over six simulated seasons the league average overall goes 62 → 66 and levels off, the same as under the old rules. That's the starting league settling, not inflation.

Before: every good freshman starter gained +8 or +9 no matter his work rate or luck. A 95-potential and an 85-potential player finished at 81 and 80.
