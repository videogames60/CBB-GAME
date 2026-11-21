# Roster decisions, pay, transfers out, redshirts

New file `dynasty/roster.js`. The offseason in `dynasty/offseason.js` is now two parts with your decisions in between. The screen is in `dynasty.html`. Every number lives in `Roster.CFG`.

## Offseason order
1. Signing day safety, history, prestige, home court, the books close (bank settles, NIL updates, coaching changes).
2. Player growth.
3. Seniors graduate (not redshirting seniors) and players leave for the draft. A drafted player's salary for next season goes back to the bank.
4. **Roster Decisions** (your screen). AI schools decide by the same rules.
5. The transfer window: players you pushed out leave, then everyone else rolls his chance (at most 3 per team leave on their own). Everyone who leaves sends next season's salary back to the bank (capped at the $25M carry-over).
6. The transfer portal: 3 rounds, see README-portal.
7. Portal signings join, classes advance (with the redshirt rule), the signed class and walk-ons arrive, rotations, the next recruiting cycle.

Saves keep the in-between state, so you can save in the middle of your decisions.

## Transfer chance (one number per player)
Reasons, added up:

| Reason | How it works |
|---|---|
| Baseline | 2% |
| Minutes | His minutes vs what his depth-chart spot earned (starter 30, 6th–7th 18, rotation 10, end of bench 4, buried 0), ignoring the first 15% short. Up to +36, about 30% more for high-potential players. Not counted for a redshirt season. |
| Role next year | His projected role after graduation, the draft, anyone you pushed out and your signed class: starter 0, 6th–7th +3, rotation +8, end of bench +15, buried +22 |
| Money | Salary vs fair pay (80% of his worth, same scale as starting salaries). No complaint above 85% of fair; up to +22 below that, scaled by how much money matters to him; halved while he's under contract; −up to 6 if a money-first or ambitious player is overpaid; + a pay cut: (2 + 30 × the share cut) × (0.6 + 0.8 × money weight), so a 10% cut is about +4 for a typical player and +7 for a money-first one, before multipliers |
| Losing | Up to +12 for players with the win-now preference, +3 for everyone else |
| New coach | +18 if his school changed coaches |
| Broken promise | +35 if you promised minutes last offseason and he got more than 2 a game fewer |
| Locker room | +3 per teammate pushed out this offseason, +1.5 per one pushed out last offseason |
| Mood | ±2 random |

Then multiplied by **loyalty** (0–99: × (1.45 − 0.0095 × loyalty), so 95 → ×0.55, 62 → ×0.86, 40 → ×1.07, 20 → ×1.26), by options (a 45 overall ×0.45 up to ×1.3 at 79+, so players who can't start elsewhere stay), by prestige (big programs keep players a bit better), and ×0.85 for freshmen. Capped at 65%. Graduating seniors don't count.

**Calibration** (4 seasons, two seeds): about 1.2–1.3 transfers per team per year. Rotation and bench players leave about 16–20% of the time, starters about 12%. Loyal players 8%, restless 21%. Schools with a new coach run about 29% against about 14%. Among players who actually left, the most common reasons were minutes and role next year, then money and losing.

## Pay (year to year)
- There are **no multi-year contracts**. Every offseason each player's pay is open again, and his fair pay is recalculated from his new ratings. (2-year deals were removed: they only halved money complaints for a season and added a lot of rules.)
- **His ask** = fair pay × (1 + 0.25 × money weight). Any amount is accepted; less than he makes now is a pay cut.
- **Nothing blocks a transfer.** An offer only changes the money side.
- **Raises are paid out of the bank now**, because next season's salaries were already set aside when the books closed. A bank below zero is debt (you're asked to confirm).

## The decisions table
All amounts are **per season**. Columns: Paid last season · **(next year) offer** · Asks (with fair pay) · Projected role next year · Why he'd leave · Chance.

**Colors in the offer:** white = same pay as last season · green = a raise you offered · red = a pay cut.

**It's an offer, not a signing.** He still decides in the transfer window. If he stays, the offer is his pay next season; if he leaves, nothing is paid. With no offer he plays next season at the same pay. When an offer changes his odds, Chance shows it ("11% → 8%"). A fair offer clears his money complaint but doesn't fix minutes or role.

**Projected role next year** · Why he'd leave · Chance.

**Projected role next year** is the coach's depth chart for next season: the best five by position (a player can fill a neighboring spot), then the bench by overall plus a bit of upside, counting only players still here plus your signed class. It's also what the player expects. It only feeds his transfer chance (the "role next year" reason); your rotation decides real minutes.

The rules sit in one collapsible **How deals work** box at the top instead of on every row. Cards show **Loyalty** (0–99) and **Wants** (money first / balanced / fit first): loyalty is how likely he is to leave; wants is what he asks for and how much being underpaid bothers him.

## Your actions
- **Offer new pay**: an amount for next season.
- **Promise minutes** (5–36 a game next season). He wants about the minutes of his best role (this season's or next year's: starter 30, 6th–7th man 18, rotation 10). A promise under half of that does nothing; from half up it covers more of his minutes and role-next-year reasons, all of them at the full amount (wants 30: 15 covers nothing, 20 a third, 25 two thirds, 30 everything). It shows on the Rotation tab during the season, flagged when you're behind. Miss it by more than 2 a game and he gets +35 next offseason.
- **Encourage a transfer** (max 2 a year): he leaves for sure and his salary comes back. The roster notices (locker room above).

## AI schools
They look at their top 9 players. Anyone paid under fair, if he's under 85% of it or has a 12%+ chance, is raised to fair pay, if half the bank covers it. They don't promise minutes or push players out. In a 12-season league run, AI banks now average about $5M (they used to hoard $8–9M), debt stays rare, and NIL, prestige and recruiting are unchanged.

## Redshirts
- A redshirt season doesn't use eligibility: he stays in the same class next year and is shown as **RS-FR / RS-SO / RS-JR / RS-SR**. **One per career**, any class.
- A redshirting senior doesn't graduate; he comes back as an RS-SR.
- Only redshirted players get a fifth year, so "grad transfers" are just RS players transferring before their last season.
- **AI schools redshirt** a freshman who'd be buried on their depth chart (outside the top 10) and is 15+ points below his potential: at most 2 a season, never leaving fewer than 11 available players. That's about one per school a year, so RS players show up in the portal and get a fifth year.

## Notes
- **Market value moves fast:** a player who jumps 6–8 points can double his worth, so after a good development year much of a roster is "underpaid". You can't pay everyone; pay the ones you can't lose.
- **Transfers out go to the portal**, where any school (but his old one) can sign them. See README-portal.

## Update: loyalty, older players care more, weak promises, starting contracts
- **Loyalty is a number, 0–99.** It sits inside his temperament's band (restless 10–29, ambitious 30–49, steady 50–74, loyal 75–95) and drives the transfer multiplier above. Recruits show it at scouting level 2; your players and portal players always show it.
- **Role next year and money weigh more as he gets older:** × 1.0 for a rising sophomore, × 1.3 for a rising junior, × 1.6 for a rising senior. The bases went up too (role next year 0 / 4 / 10 / 18 / 26 by role, money weight 0.28). For a typical junior the two now add about 9 points instead of 3–4. Transfers stay at about 1.3 per team per year.
- **Promises** need to be at least half of what he wants to count at all (see above).
- **Growth shows on the decisions screen:** a green +N next to overall is what he grew this offseason. Development runs before roster decisions and the portal, so you always negotiate on the new ratings.
- **Offer boxes** have big − / + buttons and a step picker (±1k, ±5k, ±10k), remembered in your browser.

## Update: moving up, playing-time care, clearer card
- **Moving up softens last season's minutes complaint.** If he's projected a better spot next year (the player ahead of him graduated or left), he waited his turn: one spot up keeps half the minutes complaint, two or more keeps a fifth.
- **How much playing time matters to him** scales the minutes and role-next-year reasons from ×0.7 (barely cares) to ×1.3 (it's everything). Signed recruits and portal players keep their weight from recruiting; everyone else gets one from his preferences (playing time → high) or a fixed roll.
- **The card says which season each number is about.** Minutes: "last season: 3 mpg; his spot (end of bench) usually gets ~4". Role next year: "projected rotation". Promise: "for next season he wants real minutes: about 10 (what his best spot plays, never less than rotation minutes)", with a preview: "Promising 10: 9% → 2%".
- Transfers stay at about 1.3 per team per year.

## Update: players expect their market value
- **Money is measured against his ask** (what the open market would pay him: fair pay × (1 + 0.25 × money weight)), not fair pay.
- **No complaint at 85% of his ask or more.** Below that it grows faster the further under he is (a curve), reaching its maximum at half his ask: 0.32 × (0.3 + 0.7 × money weight) × the class weight (rising sophomore 1.0, junior 1.3, senior 1.6), before loyalty and the other multipliers.
- A money-first sophomore at 72–78 overall with loyalty 62, paid the same after a breakout: 85% of ask → 7% total chance, 75% → 13%, 65% → 22%, **50% → 38%**. You can get away with it, but it's risky. A fit-first player with the same gap is about half that.
- **AI schools** raise their top 9 to 85% of the ask (never below fair) when they're well under it or likely to leave, and now spend up to 70% of their bank on it (was 50%).
- To keep league-wide transfers in line: the baseline everyone has is 1 point (was 2) and role-next-year is back to 0 / 3 / 8 / 15 / 22 by role (still × the class weight). Transfers run about 1.45 per team per year.

## Update: money care 0–99, player card from decisions
- Cards show **Money 0–99** next to Loyalty: how much money matters to him (raises his ask up to +25% at 99 and how much being underpaid bothers him).
- On the roster decisions screen, clicking a name opens his **player card**; **Decide** opens the deal screen.
