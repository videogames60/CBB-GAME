# Transfer portal (transfers in)

New file `dynasty/portal.js`. Small hooks in `recruiting.js` (portal players start schools at a neutral relationship, and portal signings count on next year's depth chart) and `offseason.js` (a third offseason stop). The screen is in `dynasty.html`. Every number lives in `Portal.CFG`.

## Where it sits in the offseason
Roster Decisions → **Done** runs the transfer window → **Portal** (3 rounds) → **Finish the offseason**: portal signings join, classes advance, the recruiting class and walk-ons arrive, next cycle. You can save in the middle of the portal. AI-only sims (`runOffseason`) play the portal out automatically.

## Who's in it
Everyone who transferred out that offseason, from every school (about 85–90 a year), ranked by value (overall + 0.35 × upside).
- **Ratings, potential, work rate and last season's minutes and points are all exact.** No scouting.
- The card and board also show his old school, why he left, and the seasons he has left.
- He can't go back to the school he just left.

## How a portal player decides
- **Same rule as recruiting:** effective offer = offer × his fit, with the same five factors.
- **Playing time weight is high** (0.6–1.0); it's usually why he left. It's judged on your real next-year roster: returning players, your signed class, and portal players you've already signed.
- **Relationship starts at a neutral 50** with every school. Points (same weekly pool as recruiting, 20 per player per round) push you above it. Withdrawing an offer costs 15.
- **His ask** = what he'd have asked his own school (fair pay + more if money matters to him) **+10%**, because he's on the open market.
- **Rounds:**
  - AI schools make opening offers before round 1.
  - At the end of rounds 1 and 2, players decide first and then the AI moves, so a new AI offer always sits a round. The base chance to decide is 38% after round 1 and 55% after round 2, ×1.6 with a clear leader (10%+), ×0.6 in a close race (under 3%), ×1.2 with a single offer.
  - **Holdout:** if no offer reaches 85% of his ask, the chance is ×0.5, and lower still the more money matters to him.
  - **Close (after round 3):** AI schools with open spots make last offers, then everyone left decides with the usual odds. Anyone unsigned leaves the game.
- **Who he picks** uses the same odds as recruiting (3% ahead ≈ 60/40, 10% ≈ 83/17).

## Money
- **Everything comes from your bank.** Next season's salaries were already set aside when the books closed, and everyone who left sent his back, so losing players funds replacing them.
- **Offers hold their amount** until he decides. A signing is paid when he commits (like a raise). You can't offer more than the bank holds.
- **Deals run 2 years**, or 1 if he has one season left.

## AI schools
- **Budget:** 60% of their bank.
- **Pricing:** off his exact fair pay +10%, scaled by the role he'd have at that school: starter 100%, 6th–7th man 80%, rotation 60%, end of bench 25%, buried 8% (walk-on money). Rich programs still pay their bench: the floor rises with prestige (walk-on money at prestige 40 and below, up to about 45% of his value at 90+), so a blue blood's 11th man is a real player on real money. Normally they go up to 1.1× that (1.4× for a school with money to burn).
- **Who they chase:** players who'd help (they skip a player well below their top 9 who'd sit), with a strong penalty for players others are already chasing, so offers spread out.
- **Raises and give-ups** work like recruiting.

## Calibration (3 seasons, two seeds)
- 86–91 players a year; **94–98% find a school**.
- Commits: about 25–28% after round 1, 22–24% after round 2, about half at the close.
- A typical deal is about 0.8 of his ask in effective terms (depth players sign cheap).
- Average overall of portal signings: about 65–67 for A and B schools, 63–64 for C, 60–61 for D. A schools don't pay up for players who'd sit behind their deep rosters; they get their stars from high school recruiting.
- **Rosters always end at exactly 13.** Walk-ons now mostly fill the spots nobody else wants (about 0.1–0.3 per team a year).
- **Over 12 seasons:** AI banks average about $3M (they spend on the portal), debt stays rare, facilities hold steady around 51, and prestige, NIL and recruiting are unchanged.

## On the screen
- **Portal board:** filters (Available / All / Your board / You can afford / position) and sortable columns: rank, overall, potential, **class next season** (SO, JR, RS-SR…), last season, asking price, your price.
- **Player card:** exact ratings, your pitch, the race with odds, points (with a per-player **Auto** toggle), offer, withdraw, and an "enough to lead" button.
- **Auto-recruit my whole board** (checkbox): each round, 20 points to everyone you've offered or starred, offered players first, best overall first.
- **Coming and going:** the portal screen (and the Roster tab during the offseason) lists your signed recruits, portal signings, and everyone leaving (graduated, went pro, transferred, with where he went and why).
- **Buttons:** End round / Close the portal / Finish the offseason, and **Sim to the end**, which plays out the remaining rounds without you.
- Your board's Status column shows who leads. Commits and lost targets go to your season log. (The separate "Your targets" news list was dropped.)
- **The offseason report** shows where each of your departed players went ("→ SEA" or "→ unsigned") and a *From the portal* list.

## Later (noted)
- Unsigned players can return to their old school (with a "do I want him back" choice).
- Promising minutes as a recruiting pitch, for portal players and high schoolers.
- Center balance: portal asks show centers priced well below similar forwards because of the position adjustment. That's the center-balance item.

## Update: one offseason money number
Once the books close at the end of the season, everything in the offseason is paid from your **bank**: raises, portal signings, and facilities bought in the offseason. Roster decisions, the portal, the recruiting tab and the program tab all show the same free number (bank − raises you've offered + pay of players you pushed out − portal offers out), with the same bar: raises, signed in the portal, offers out, free. Before, the recruiting tab counted last season's leftover twice.

Portal offers say the deal length (2 seasons, or 1 if it's his last), the list and card show a green +N for how much he grew this offseason, and portal players show loyalty.

## Update: old schools can bid, free take-back, chances shown
- **His old school can bid to bring him back.** He's testing his value on the market, so his old school (you or the AI) can offer like anyone else. A player you **pushed out** won't come back. In the portal list, your former players show "you" in the From column, and their card says he's testing his value.
- **Taking back an offer is free until the round ends** (nobody has seen it yet): lower it down to what he saw last round, or take it back. After that, offers only go up and withdrawing costs 15 relationship.
- **Players who left** show the transfer chance they had when the window opened (e.g. "role next year, money · 19% chance"), so you can see if you got unlucky.
