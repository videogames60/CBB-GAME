# Coaches: staffs, the hot seat and the carousel

`dynasty/coaches.js` (rules, every number in `Coaches.CFG`), `ui/ui_staff.js` (the Staff tab and the carousel screens).

## Staff ratings
Every school has a head coach and two assistants. All four coaching ratings the game uses — tactics (the game engine), recruiting (weekly points, pipeline slots), development (player growth, the development pitch) and scouting (weekly points, how good AI reads are) — are the **staff rating**:

    staff = 50% head coach + 25% assistant 1 + 25% assistant 2        (CFG.split)

An empty chair is a **grad assistant**: 30 in everything, $10k. `Coaches.rating(team, key)` is the one place that's computed; set `split` to `[1, 0, 0]` to switch assistants off.

Your own head coach still improves with the points you spend on the Program tab. Those are his own ratings; the Staff tab shows them next to the staff's.

## One coach pool
Every coach is a head coach, an assistant, or in the pool of available coaches (about one per school). Each has an age, the four ratings, an asking salary, a contract and a job history (shown on his card: click any coach's name).

- **Aging:** each rating moves by age every offseason: about +2 a year in his early 30s, +1 to his late 30s, flat in his 50s, then a slow decline (`CFG.aging`). Your own head coach doesn't age.
- **Retiring:** from 62 on, 10% a year plus 5% for each year past 62; everyone by 72. Pool coaches unemployed more than 4 years retire too.
- **New coaches:** young coaches (26–34) join every year to keep the pool at about one per school.

## Pay and contracts
- **Asking salary** for an assistant job, by overall (the average of the four ratings): 40 → $30k, 50 → $55k, 60 → $90k, 70 → $150k, 80 → $250k, 90 → $420k. A head job asks twice that.
- **Everything comes out of the school's NIL money**, like player deals. Staff pay counts each cycle (it's on the money bar).
- **Contracts are 1–4 years and locked.** You choose the length when you hire, and it can't be changed after.
- **Extensions only in his final season:** Extend adds 1–4 more seasons at his ask *then*, re-priced from his current ratings, starting when the current deal ends. This season's pay doesn't change. A cheap deal for an improving young assistant lasts one contract, not forever. If you don't extend, he leaves when the deal is up.
- **Letting him go costs a buyout:** 50% of the pay left on his deal (`CFG.contract.buyout`), including a signed extension. During the season, that season's pay is already spent on top of it. In the offseason the buyout comes straight from the bank.
- **Your own salary** is set by the school (your ask as a head coach) whenever you sign: 4 years, re-signed automatically at the new number. A better coach costs more at the next contract.
- **New hires in the offseason** are paid from the next cycle on.
- **Poached** (hired away as a head coach): no buyout either way, and a signed extension is void.
- **AI schools** pay a head coach up to 12% of their collective and an assistant up to 4%, so the best coaches end up at the best jobs.

## Job security (the hot seat)
Every head coach has job security from 0 to 100 (a new hire starts at 60). After each season:

    move = 0.9 × (win % − expected win %) + 8 × (postseason score − expected)      capped at ±35

- **Expected win %** is the prestige bar minus 5: an A+ program expects about .750, a C about .450.
- **Postseason score and expectations** are the prestige ones (tournament 1, semifinal 2, runner-up 3, champion 5; a 90+ program is expected 1.5, 80+ 1.0, 70+ 0.5).

At 0 he's fired, but never in his first two seasons. You can switch off getting fired at setup ("You can be fired"). AI coaches use the same meter, and when an AI head coach's contract ends he's only re-signed with security of 40 or more.

## Reputation
What schools hire on (`CFG.reputation`): a head coach's last 4 seasons, weighted 4/3/2/1 with the newest counting most. A season scores

    win % × 60  +  postseason × 8  +  10 for Coach of the Year
    (postseason: tournament 1, Final Four 2, title game 3, national title 5)

so a .700 team that makes the tournament is about 50, a Final Four year about 65, and a title year 90+. A missing season (a new coach) counts as 30. Your reputation and the seasons behind it are on the Staff tab, under job security.

**A school wants at least `prestige − 25`:** a 90-prestige school wants 65, a 60 school wants 35, and nobody asks for less than 10. **80+ and any school with an opening will hire you.**

## The carousel
It's the first stage of the offseason, right after development and the draft and before roster decisions:

1. **Departures:**
   - your review
   - every retirement and firing
   - every non-renewal: an AI head coach whose contract ends is re-signed only if his job security is 40+, *and* only if the school can still afford his new asking price. If not he's **priced out** and tests the market: any opening at a school with a bigger budget than his can hire him, at up to that school's budget (a raise even if it's below his full ask), and athletic directors weigh a proven head coach's reputation (`CFG.reputation.hireWeight` = 0.4 a point over the neutral 30, on top of his ratings). When he moves up, his old school opens and joins the queue, best school first. If nobody hires him he re-signs at home for what the school can pay. That's how a great run at a mid-major leads to a bigger job (in a 10-season Compact check: about 6 of every 20 priced-out coaches moved, to schools averaging about 7 prestige higher).
   - every assistant whose contract is up
2. **Open jobs:** every head job that opened, with why. The ones whose reputation bar you clear have a **Take the job** button, and you can take one any offseason, or stay.
   - **Moving:** your coach (ratings, points, record) goes with you; the new school's players, money, recruits and pipelines become yours; your old job opens for the AI; your assistants stay behind.
   - **Salary:** the new school pays your asking price up to what it can afford (its head-coach budget). When you re-sign at your own school, the same cap applies, so nobody pays you more than they can.
   - **If you're fired** you must take one. At least three openings always want you: the lowest-prestige ones, and if there aren't enough, a school whose coach is on the hot seat lets him go and calls you.
3. **Head jobs fill, best school first:** each takes the best coach it can afford. Candidates are the pool plus every other school's assistants, scored by overall, tactics, a little for head-coaching experience, and less after 60.
4. **AI schools fill open assistant chairs** with the best coach they can afford. Yours stay open for you: hire on the Staff tab any time.

**Contracts are honored.** An assistant leaves before his contract is up only for a head job: a promotion, and only in the carousel. That's how good assistants get poached. AI head coaches never walk out mid-contract; they move when they're fired, not re-signed, or priced out.

## Coach growth
AI head coaches bank 30% of the coach points a season earns (`Program.CFG.coach.aiPointShare = 0.3`) and spend them automatically; your coach gets them all and you spend them. Before this and the budget rule, average head-coach overall climbed about 17 over 50 Compact seasons; now it's about 7 (young coaches still grow with age, and the best ones get hired, so some climb is natural).

## Not in yet
AI schools firing assistants.
