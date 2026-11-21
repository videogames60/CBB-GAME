# Rotations and minutes

Files: `sim/engine.js` and `sim/tuning.js` (how subs work in a game), `dynasty/league.js` (depth presets, rules, AI depth), `dynasty/season.js` (which rotation a game uses), and the **Rotation** tab in `dynasty.html`.

## The Rotation tab
- **Auto** (the default): before every game the coach takes whoever is healthy, starts the best five (one per position where possible), and gives out minutes for a 7–10 man rotation by overall. That's the coach's own preference, adjusted for how good the bench is, and one man shorter in the postseason. Pick a **depth** button to fix the depth yourself, or **coach's choice** to hand it back.
- **Manual**: you set the starting five (any player in any slot) and every player's minutes. A depth button refills the minutes for that many men, then you tweak. Editing a minute, changing a starter, or changing minutes in the live-game pregame switches you to Manual. When the roster turns over in the offseason, a manual rotation is reset to a fresh suggestion and the tab tells you.
- **Rules** (checked before every game): at least 7 players get minutes, the 6th and 7th at least 5 each, nobody over 40, 200 in all. Anything off is listed with a **Fix it now** button, and gets fixed automatically at tip-off either way.
- **Stamina column**: about how many minutes his stamina carries before he plays tired: "fine", "tires late" (up to 4 over), or "will wear down". A typical 65-stamina starter is comfortable around 31.
- **Actual MPG** sits next to the plan.

## How the coach subs (auto control, every possession)
1. **Fouled out**: always.
2. **Exhausted**: always. The line drops for heavy-minute players (35% energy at ≤18 planned minutes, down to 5% at 40).
3. **Foul trouble** (not in crunch time): 2 fouls early or 3 in the first half, 4 in the second. A player planned for 34+ minutes stays in with two early fouls.
4. **Tired** (not in crunch time): 62% energy for a light-minute player, sliding to 10% for a 40-minute player. Planned big minutes means he plays through it and wears down instead of sitting.
5. **Minutes plan** (not in crunch time): a sub who's been in at least 2 minutes is swapped for someone further behind his plan. Any position can come back in; out of position counts as a minute's penalty. This is also how a rested or foul-troubled starter gets back in.
- A **rested** player sits until he's 20 points of energy above his rest line, so there's no in-and-out ping-pong.
- Players with **0 planned minutes** come in only in an emergency (fouls or exhaustion leave nobody else) or in **garbage time** (last 4 minutes, a 20+ point margin), when the auto coach empties the bench.
- **Crunch time** (last 4 minutes within 10 points, or overtime): no rests or minutes swaps, best available players.

## Fatigue (retuned)
Energy drains faster than before (`drainPerSec` 0.00065 → 0.00095) and media timeouts refill less (0.06 → 0.04), so heavy minutes cost something. A fully gassed player plays about 15% worse. Measured over 200 games between evenly matched teams:

| Plan | Starters' energy at the horn | Rating cost late | Wins /200 |
|---|---|---|---|
| 10-man | 75% | about −4% | 90–98 |
| 8-man | 60% | about −6% | 87–108 |
| 7-man, two stars at 40 | 45–50% | about −8% | 72–91 |

Before this change a 40-minute plan cost almost nothing (the iron five broke even). Team scoring is unchanged at about 70 a game over a full season.

## Plan vs what actually happens
- **10-man**: every player within about 1.5 minutes of plan.
- **8-man with starters at 33–36**: starters come in 2–3 under (foul trouble, the odd rest), the 6th–8th men a bit over.
- **Subs**: 25–40 a game per team (it used to be 60–100+ from rest-then-return ping-pong; a 40-minute plan alone caused 108 rest subs a game).
- **Season**: top players average about 35 minutes, about 2 per team over 30, about 8 per team at 10+. Before, nobody topped 31.

## AI coaches
Each coach has a depth preference, 7 to 10 (15 / 35 / 35 / 15%). It comes from a hash of his name, so the same seed still builds the same league, and a new hire can change a school's style. Before each game he goes one shorter if his bench averages more than 10 overall below his starters, one longer if it's within 4, and one shorter in the conference and national tournaments.

## Minutes by depth (best starter first, then bench by overall)
| Depth | Starters | Bench |
|---|---|---|
| 7 | 36 35 34 33 32 | 17 13 |
| 8 | 34 33 32 31 30 | 17 13 10 |
| 9 | 33 32 31 30 29 | 15 12 10 8 |
| 10 | 32 31 30 29 28 | 14 12 10 8 6 |

Up to 13 players can be given minutes by hand.

## Older saves
They start in Auto. Minutes you set on player cards in an older save are replaced by the auto rotation until you switch to Manual. Coaches get their depth preference on load.
