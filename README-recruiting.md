# Recruiting (v1: high school)

New file `dynasty/recruiting.js`; small hooks in `season.js`, `offseason.js` and `dynasty.html`. Every number lives in `Recruiting.CFG`.

## The one rule

A recruit weighs each school's **effective offer** (the best one is the favorite, not a sure thing; see *Odds*):

```
effective = NIL offer × (1 + fit total × fit dampener)
fit total = Σ  school score (−1…+1) × his weight (0.2…1) × max swing
dampener  = 1 − 0.7 × money weight
```

| factor | school score from | max swing |
|---|---|---|
| playing time | projected role on next year's depth chart (returning players + your commits + him; anyone can fill his own or a neighbouring slot at −3 overall) | 0.20 |
| proximity | miles from his hometown to your school (README-geo): home (≤150) +1, close (≤500) +0.35, far −0.75 | 0.15 |
| prestige | program prestige, plus a bump for a current AP rank | 0.15 |
| development | coach development + facilities, plus your draft record (recent picks; README-draft) | 0.10 |
| relationship | your recruiting points (0–100, 50 = neutral) | 0.15 |
| pipeline | your pipeline in his home area, if it counts (home area or one of your slots): Developing 0.33, Established 0.67, Strong 1. Weight: his proximity weight, at least 0.4 | 0.12 |

**Where kids sign.** AI schools lean toward kids where they have a distance or pipeline edge (`CFG.ai.localPull`, smaller for big programs, which recruit nationally). In the Full league about 80% of recruits sign within 500 miles of home: 3★ kids mostly stay regional, 5★ kids go national far more often. In a crowded area everyone has the home edge, so it decides little; in an empty one, the nearby school has it alone (for kids at its level). Pipelines: README-geo.

Weights come from the player's existing `preferences` (a listed preference rolls 0.8–1.0); top-60 recruits lean toward prestige and development. Money weight comes from the `nil` preference and temperament. Most players sit at 0–0.4, true mercenaries near 1.0. The multiplier is clamped to 0.6–1.5.

## Money

- **Collective**: a yearly budget from the school's NIL grade (≈$0.25M at the bottom to $20M at the top).
- **Worth**: one scale for what any player is worth a year, by **value** = overall + 0.35 × upside. (There used to be a position adjustment here because centres' overall ran hot; overall itself is now even across positions, see below.) It's calibrated to the asking curve: value 86 ≈ the #1 recruit ($2.6M), 77 ≈ #25 ($800k), 65 ≈ #110 ($120k).
- **Payroll**: every player has a salary. A new league's players get 80% of their worth (±25%, more for money-first players), capped so returning payroll never starts over 65% of the collective; that lands payroll at about 35–55% of the collective. Recruits keep their signed deal; walk-ons earn $0–5k. Deals renew every year.
- **Setup prestige** now also sets the school's NIL grade, home court and facilities to match (it used to leave the original slot's, so a prestige-80 pick could have a D-level collective).
- **Free money** = collective + bank balance (carried-over money, or minus debt; see README-program) − next year's payroll (non-seniors) − signed recruits − offers out − facilities bought this cycle. Offers reserve their amount until the recruit decides or you withdraw (which halves your relationship with him).

## The season

- The board opens on day 1 with ~3.2 recruits per school, ranked; asking price follows rank (≈$2.6M for #1, $800k for #25, $120k for #110, $35k for #180), ±20%, more for money-first kids, less for loyal ones.
- **Opening day**: AI schools make their first offers before day 1, so the board starts contested.
- **Weekly tick** (every 7 days): relationships with no contact decay 3; uncommitted recruits roll to commit; **then** AI schools raise, give up, make new offers and spend points (so any new AI offer sits on the board a full week before it can win anyone); everyone's points refresh (20 + 0.5 × coach recruiting: 45 for a 50 coach, 55 for a 70, 65 for a 90, so you can max out about 2–3 kids a week at 20 each). **Auto-recruit**: an **Auto** button on each recruit's card, or an **auto-recruit my whole board** checkbox (everyone you've offered or starred). At each refresh, auto kids get 20 points each in order of public rank, best first, until your points run out; turning one on spends on him right away. Auto kids show an **A** on the board. Manual spending still works on top.
- **News**: offers, raises and lead changes for kids on your board go to your season log and a *Your board — latest* list on the Recruiting tab.
- **Odds**: when a kid decides, each school's chance is its effective offer to the 15th power, shared out. Tied = even split (three-way tie ⅓ each); 3% ahead ≈ 60/40; 10% ≈ 83/17; 20% ≈ 95/5. The race table shows the odds as best you can tell; upsets are flagged in the log and on the card.
- **How AI schools price a kid**: from **their own read** of him (below), turned into dollars on the same worth scale everyone uses. Fit doesn't change what a school will pay; it only changes how good the offer looks to the kid. They open at his ask if he's worth it to them, at his worth if he's asking too much, and normally go no higher than 1.1× worth (1.4× for a school with money to burn). When outbid they raise to beat the leader by a random 4–8%, if that's still within their limit. So a good scout who sees a sleeper pays up for him; a weak scout who believes a bust's ranking overpays. The recruit card's **market value** is his worth on the public read (public overall and potential).
- **AI turn order** is shuffled every week (and on signing day), so no school always gets the last word in a bidding war.
- **Commit roll**: chance ramps from 4% to 20% over the season (top-25 slower early). Two smooth curves change it: the **lead** over the next offer slides it from ×0.5 (tied) up to ×2 (a 10%+ lead), so 3% ahead ≈ ×0.95 and 6% ≈ ×1.4; and if the best offer is **under his line** (90% of asking early, sliding to 60%), it fades from ×1 at the line to ×0.25 at 20% under it. The portal works the same way (its own numbers in portal.js).
- **Signing day** (after the title game): everyone left decides (same odds); AI schools with empty scholarships make last offers until the board settles. Your empty scholarships become walk-ons.
- **Offseason**: signed classes join after departures and transfers, walk-ons fill to 13, the next class is generated.

## Balance check

`node recruit_check.js [seasons] [seed] [--fast]` sims full seasons and prints budgets, commit timing, deal-to-asking ratios, how often fit beat a bigger raw offer, and class quality by prestige tier. Seed 42, current calibration:

- 94% of recruits sign in year one; every top-25 recruit signs every year
- best recruit by prestige tier: A ~#29–38, B ~#56–70, C ~#77–88, D ~#89–114
- the school with the smaller raw offer wins about 1 in 8 contested recruits
- nobody goes over budget across five seasons; free money settles as four classes of deals build up on payroll

## Scouting

Nobody sees a recruit's true ratings until they scout him.

- **Public rank.** Rank is simply the **public overall** (ties broken by public potential). The public overall is the true overall plus a weighted roll: ±0–2 70% of the time, ±3–5 22%, ±6–8 8%. Public potential is a separate read that misses twice as much, and it isn't part of the rank, so raw high-ceiling kids are the natural sleepers. Stars and asking price follow rank.
- **Points.** You gain 10 + 0.25 × coach scouting a week (26 for a 65 scout). They pile up all season, then reset when the next class opens (each class starts with one week's worth).
- **Levels** (total points on one recruit):

| Level | Pts | Overall | Potential | Each rating | Also |
|---|---|---|---|---|---|
| 0 | 0 | about 9 wide (7–11), can be wrong | about 11 (9–13), can be wrong | 14 | — |
| 1 | 25 | 8 | 11 | 12 | what he wants, so your fit and your price |
| 2 | 60 | 4 | 6 | 6 | work rate as a 30-wide range (it sits off-centre by a fixed random amount, so the middle isn't the answer) |
| 3 | 100 | exact | exact | exact | exact work rate |

- **Level 0 is the public read.** Each band is centred on the public numbers plus your school's own small read (up to about ±2.5, a little more for a weak scouting coach), and is *not* moved to contain the truth. So the board reads like the rankings: the #1 kid looks like the best kid (about 82–89), and the list goes down from there (only about 3% of neighbours look out of order). Where the public was wrong, the truth falls outside: about **1 in 4** for overall, **2 in 5** for potential (the public read is right within 2 points only about half the time, so scouting matters). Widths vary a little kid to kid. Shown with a "~" and a dotted underline. The offseason report says "the services' read was off" when you signed an unscouted kid it missed on.
- **Level 1 and up: always right.** Fixed width, centred on the public read (± a little jitter), then slid just far enough to contain the truth. Most kids show the truth near the middle; sleepers and busts show it near an edge. Level 1 does *not* have to sit inside level 0, so scouting a kid the public got wrong makes his band jump. Level 2 sits inside level 1. Every rating band shares the overall band's random position (and, at level 0, your school's same read), so you can't average ratings to work out the overall. Checked on ~1,200 recruits × 3 levels: the truth is always inside from level 1 on.
- **Until level 1** your pitch effects, multiplier, "your price" and who leads the race are hidden.
- **Until level 3** your playing-time pitch is judged at the bottom and top of his scouted range, so his role can show as a range ("6th–7th man – Starter") and so can the effect, the multiplier and your price (the board shows the middle with "~"). The race is shown as you'd judge it from the middle of his range. The recruit himself always decides on the truth.
- **Arrival reveal.** On the offseason page each signed recruit shows the range you had him at, and a Steal or Bust tag when he lands 4+ overall (or 8+ potential) away from the public read.
- **AI schools** read each kid once, when the class comes out, and keep that read all year. Overall and potential separately, two rolls each: (1) the public number ± up to 2, pure luck; (2) a roll from 0 to 1 for how far from there toward the truth they get, skewed by the staff's scouting rating (`CFG.scout.ai`). An average staff (50) gets halfway on average; an elite one (90) about 68% of the way and 80%+ of the way almost 2 times in 5; a weak one (25) about 38%, with 80%+ about 1 in 8. Potential's roll counts 85% as much (upside is harder to read, but the public misses it by more, so that's where most sleepers are). Their value read is the usual value formula on their numbers: overall + 0.35 × (potential − overall). It sets their price ceiling, and who they target (plus a small bonus or penalty, `CFG.ai.bargain`, when they think a kid is better or worse than his ranking). Distance and pipelines add a pull too (`localPull`, now 3.5: with truer reads the old 8 kept talent too local). In `tests/recruit_check.js` (12 cycles, Compact), the kids elite scouting staffs signed were worth +0.6 value points over their ranking on average, good +0.3, average −0.1, weak −0.9, and weak staffs paid about 10% more for what their kids really were.
- **Work rate** is the hidden development multiplier (0.85–1.25), shown on a 0–99 scale, next to overall and potential at the top of the recruit card and in its own column on the board. (Before this fix it showed 99 for every scouted kid.)
- Signed recruits stay banded until they arrive on campus in the offseason; then everything is exact.

## Not in yet

Transfer portal, underpaid players asking to leave, final-three lists, booster events.

## Overall is even across positions
The overall formula used to run hot or cold by position: built from the same quality, a center read **+5.3**, a point guard +0.6, a power forward −1.1, and the wings −2.3 / −2.4. On-court play never reads overall (games use the individual ratings), so games were fine. But everything that reads overall was skewed: recruit rank, worth and pay, expected minutes and transfer chance, starters and bench order, and draft departures. For example, centers were 13 of 24 early departures over three seasons.

- **The fix.** `tuning.ovr.posOffset` subtracts each position's offset inside the overall formula, so equally good players show the same overall at every position. Recruits now average within about a point at every position. The position adjustment in worth is zeroed.
- **A point of overall is worth about the same at every position.** +1 overall on a starter is worth 0.31–0.40 points of margin a game (centers at the low end, noise about ±0.04), so no reweighting was needed.
- **Starting rosters** now shuffle which position lands in which class slot per school. Before, most point guards were seniors and juniors and most power forwards freshmen.
- **Draft bar** 92 → 91 keeps early departures at about 7 a year, now spread across positions (3 seasons: PG 5, SG 5, SF 4, PF 5, C 3).
- Old saves aren't adjusted: their stored potentials were on the old scale, so centers in an old save grow a bit faster for a few years.

## Update: taking back an offer
On the **day** you make an offer or a raise you can **lower** it (down to what he'd already seen) or **take it back for free**. Once the day ends he's seen it: offers can only go up, and withdrawing costs half the relationship as before. The button says "Take it back (free)" or "Withdraw" accordingly.

Offer boxes: hold − or + to keep stepping (it speeds up the longer you hold); the arrow keys in the box step too.

## Update: unscouted kids show money only
At scouting level 0 you can't tell who a kid really favors, so the board's status shows only the **biggest money offer** ("top $: KSU · 4 offers") and the race on his card is sorted by money offered, not by what he'd actually pick. From level 1 you see the effective offers and the real leader.
