/* Recruiting balance check.
   node tests/recruit_check.js [seasons=3] [seed=42] [--fast]
   --fast skips playing the games (records stay 0-0), which is enough to
   check money and commit timing but not prestige/poll effects. */
const League = require("../dynasty/league.js");
const Season = require("../dynasty/season.js");
const Offseason = require("../dynasty/offseason.js");
const Recruiting = require("../dynasty/recruiting.js");

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const FAST = process.argv.includes("--fast");
const SEASONS = +args[0] || 3, SEED = +args[1] || 42;
const fmt = Recruiting.fmt;
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + "%" : "—";
const avg = (xs) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
const tierOf = (t) => t.prestige >= 75 ? "A (75+)" : t.prestige >= 60 ? "B (60-74)" : t.prestige >= 45 ? "C (45-59)" : "D (<45)";

const lg = League.generateLeague(SEED, { userTeam: { name: "Eastwood State", conf: "HRT", prestige: 45 } });
lg.teams.find(t => t.isUser).isUser = false;   // let the AI run every school, including the user slot
Recruiting.ensure(lg);

/* money at the start */
{
  const rows = {};
  for (const t of lg.teams) {
    const m = Recruiting.money(lg, t), k = tierOf(t);
    (rows[k] = rows[k] || []).push({ total: m.total, payroll: m.payroll, free: m.free, spots: Recruiting.openSpots(lg, t) });
  }
  console.log("\nBUDGETS AT START (per school, averaged by prestige tier)");
  console.log("tier        n   collective   next-yr payroll   free    open spots");
  for (const k of Object.keys(rows).sort()) {
    const r = rows[k];
    console.log(`${k.padEnd(10)} ${String(r.length).padStart(2)}   ${fmt(avg(r.map(x => x.total))).padStart(9)}   ${fmt(avg(r.map(x => x.payroll))).padStart(14)}   ${fmt(avg(r.map(x => x.free))).padStart(7)}   ${avg(r.map(x => x.spots)).toFixed(1)}`);
  }
  const R = lg.recruiting;
  console.log(`\nPool: ${R.pool.length} recruits. Asking: #1 ${fmt(R.pool[0].asking)}, #5 ${fmt(R.pool[4].asking)}, #25 ${fmt(R.pool[24].asking)}, #60 ${fmt(R.pool[59].asking)}, #110 ${fmt(R.pool[109].asking)}, #180 ${fmt(R.pool[179].asking)}`);
  console.log(`OVR / POT: #1 ${R.pool[0].ovr}/${R.pool[0].potential}, #25 ${R.pool[24].ovr}/${R.pool[24].potential}, #110 ${R.pool[109].ovr}/${R.pool[109].potential}, #200 ${R.pool[199].ovr}/${R.pool[199].potential}`);
}

let se = Season.startSeason(lg, SEED);
for (let y = 0; y < SEASONS; y++) {
  const t0 = Date.now();
  if (FAST) {
    // advance the calendar without games: run the daily hook only
    se.post = null;
    for (let d = 0; d < 112; d++) { se.day++; Recruiting.onDay(lg, se); }
    se.post = { phase: "done" };
    Recruiting.onDay(lg, se);
  } else {
    while (!Season.seasonComplete(se)) Season.simDay(lg, se);
  }
  const R = lg.recruiting;
  const signed = R.pool.filter(r => r.status === "committed");
  const byWeek = {};
  for (const r of signed) byWeek[r.commitWeek] = (byWeek[r.commitWeek] || 0) + 1;

  console.log(`\n=========== ${lg.season} cycle (${((Date.now() - t0) / 1000).toFixed(1)}s) ===========`);
  console.log(`signed ${signed.length}/${R.pool.length} (${pct(signed.length, R.pool.length)}); top 25 signed ${signed.filter(r => r.rank <= 25).length}, top 110 ${signed.filter(r => r.rank <= 110).length}`);
  console.log("commits by week: " + Object.keys(byWeek).sort((a, b) => a - b).map(w => `w${w}:${byWeek[w]}`).join(" "));
  const deal = signed.map(r => r.deal / r.asking);
  console.log(`deal / asking: median ${deal.sort((a, b) => a - b)[Math.floor(deal.length / 2)].toFixed(2)}, min ${deal[0].toFixed(2)}, max ${deal[deal.length - 1].toFixed(2)}`);
  const upsets = signed.filter(r => r.decision && r.decision.length > 1 && r.decision[0].offer < r.decision[1].offer).length;
  console.log(`won with a LOWER raw offer than the runner-up: ${upsets} of ${signed.filter(r => r.decision && r.decision.length > 1).length} contested`);

  // class quality by prestige tier
  const tiers = {};
  for (const t of lg.teams) {
    const mine = signed.filter(r => r.commitTo === t.id);
    const k = tierOf(t);
    (tiers[k] = tiers[k] || []).push({ n: mine.length, best: mine.length ? Math.min(...mine.map(r => r.rank)) : 999, avgRank: mine.length ? avg(mine.map(r => r.rank)) : null, stars5: mine.filter(r => r.stars === 5).length, spend: mine.reduce((s, r) => s + r.deal, 0), free: Recruiting.money(lg, t).free });
  }
  console.log("tier        signed/school  avg rank  best recruit  5★ per school   spend/school   money left");
  for (const k of Object.keys(tiers).sort()) {
    const r = tiers[k];
    console.log(`${k.padEnd(10)}  ${avg(r.map(x => x.n)).toFixed(1).padStart(10)}   ${avg(r.filter(x => x.avgRank).map(x => x.avgRank)).toFixed(0).padStart(7)}   ${avg(r.filter(x => x.best < 999).map(x => x.best)).toFixed(0).padStart(11)}   ${avg(r.map(x => x.stars5)).toFixed(2).padStart(12)}   ${fmt(avg(r.map(x => x.spend))).padStart(11)}   ${fmt(avg(r.map(x => x.free))).padStart(9)}`);
  }
  // class quality by SCOUTING tier: did good scouts find sleepers and dodge busts?
  // found = true value − public value of the kids it signed (+ sleepers, − busts);
  // paid = deal ÷ his true worth (over 1 = overpaid for what he really is)
  {
    const Co = require("../dynasty/coaches.js");
    const trueV = (r) => r.ovr + Recruiting.CFG.upsideWeight * Math.max(0, r.potential - r.ovr);
    const stier = (v) => v >= 75 ? "elite 75+" : v >= 60 ? "good 60-74" : v >= 45 ? "avg 45-59" : "weak <45";
    const rows = {};
    for (const t of lg.teams) {
      const sc = Co.rating(t, "scouting"), k = stier(sc), x = rows[k] = rows[k] || { schools: 0, sc: 0, pres: 0, kids: [] };
      x.schools++; x.sc += sc; x.pres += t.prestige;
      for (const r of signed.filter(r => r.commitTo === t.id)) x.kids.push({ gap: trueV(r) - Recruiting.publicValue(r), paid: r.deal / Math.max(1, Recruiting.worthOf(trueV(r))) });
    }
    console.log("scouting    schools  scout  prestige  signed  found/kid  sleepers(+2)  busts(-2)  paid vs true worth");
    for (const k of ["elite 75+", "good 60-74", "avg 45-59", "weak <45"]) {
      const x = rows[k]; if (!x) continue; const g = x.kids.map(z => z.gap), pd = x.kids.map(z => z.paid).sort((a, b) => a - b);
      console.log(`${k.padEnd(10)}  ${String(x.schools).padStart(7)}  ${(x.sc / x.schools).toFixed(0).padStart(5)}  ${(x.pres / x.schools).toFixed(0).padStart(8)}  ${String(x.kids.length).padStart(6)}  ${((avg(g) >= 0 ? "+" : "") + avg(g).toFixed(2)).padStart(9)}  ${pct(g.filter(v => v >= 2).length, g.length).padStart(12)}  ${pct(g.filter(v => v <= -2).length, g.length).padStart(9)}  ${pd.length ? pd[Math.floor(pd.length / 2)].toFixed(2).padStart(10) + " median" : ""}`);
    }
  }
  const negative = lg.teams.filter(t => Recruiting.money(lg, t).free < -1).length;
  console.log(`schools over budget: ${negative}`);
  console.log("sample commits:\n  " + R.log.filter(l => l.recruitId).slice(-6).map(l => l.text).join("\n  "));

  const rep = Offseason.runOffseason(lg, se);
  const inc = Object.values(rep.incoming).flat();
  console.log(`offseason: ${inc.filter(p => p.why === "recruit").length} recruits arrive, ${inc.filter(p => p.why === "walk-on").length} walk-ons; rosters ${[...new Set(lg.teams.map(t => t.players.length))].join(",")}`);
  const sal = lg.teams.flatMap(t => t.players.map(p => p.salary));
  console.log(`players missing a salary: ${sal.filter(s => s == null).length}`);
  se = Offseason.nextSeason(lg);
}
