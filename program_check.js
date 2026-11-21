/* Program economy check: does the league stay stable over a long dynasty?
   node tests/program_check.js [seasons=20] [seed=42] */
const League = require("../dynasty/league.js");
const Season = require("../dynasty/season.js");
const Offseason = require("../dynasty/offseason.js");
const Recruiting = require("../dynasty/recruiting.js");
const Program = require("../dynasty/program.js");
const SEASONS = +process.argv[2] || 20, SEED = +process.argv[3] || 42;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs) => { const m = avg(xs); return Math.sqrt(avg(xs.map(x => (x - m) ** 2))); };

const lg = League.generateLeague(SEED, {});
Recruiting.ensure(lg); Program.ensure(lg);
let se = Season.startSeason(lg, SEED);
const row = (tag) => {
  const T = lg.teams, coach = T.map(t => (t.coach.rating + t.coach.recruiting + t.coach.development + t.coach.scouting) / 4);
  const debt = T.filter(t => (t.bank || 0) < 0), saved = T.filter(t => (t.bank || 0) > 0);
  console.log(`${tag.padEnd(6)} NIL ${avg(T.map(t => t.nil)).toFixed(1)} (sd ${sd(T.map(t => t.nil)).toFixed(1)}, max ${Math.max(...T.map(t => t.nil))})`
    + `  facilities ${avg(T.map(t => t.facilities)).toFixed(1)} (max ${Math.max(...T.map(t => t.facilities))})`
    + `  coach avg ${avg(coach).toFixed(1)} (max ${Math.max(...coach).toFixed(0)})`
    + `  prestige ${avg(T.map(t => t.prestige)).toFixed(1)} (sd ${sd(T.map(t => t.prestige)).toFixed(1)}, 85+ ${T.filter(t => t.prestige >= 85).length}, <35 ${T.filter(t => t.prestige < 35).length})`
    + `  in debt ${debt.length}${debt.length ? ` (avg ${Recruiting.fmt(avg(debt.map(t => -t.bank)))})` : ""}`
    + `  banked ${saved.length}${saved.length ? ` (avg ${Recruiting.fmt(avg(saved.map(t => t.bank)))}, max ${Recruiting.fmt(Math.max(...saved.map(t => t.bank)))})` : ""}`);
};
row("start");
const blue = [...lg.teams].sort((a, b) => b.prestige - a.prestige).slice(0, 5).map(t => [t, t.prestige]);
let changes = 0, champs = [];
for (let y = 1; y <= SEASONS; y++) {
  while (!Season.seasonComplete(se)) Season.simDay(lg, se);
  const rep = Offseason.runOffseason(lg, se);
  changes += rep.program.coachChanges.length;
  const champ = Object.entries(rep.program.teams).find(([, r]) => r.summary.champion);
  if (champ) { const r = champ[1]; champs.push(`${lg.byId[champ[0]].name}: NIL ${r.nil.before}→${r.nil.after}, coach +${r.coachPoints.total}`); }
  if (y % 4 === 0 || y === 1) row(`y${y}`);
  se = Offseason.nextSeason(lg);
}
console.log(`coach changes over ${SEASONS} seasons: ${changes} (${(changes / SEASONS).toFixed(1)} a year of ${lg.teams.length} schools)`);
console.log("starting top 5 by prestige, start → end: " + blue.map(([t, p]) => `${t.abbr} ${p}→${t.prestige}`).join(", "));
console.log("champions' payoff:\n  " + champs.slice(-4).join("\n  "));
