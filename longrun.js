/* =====================================================================
   HOOPS DYNASTY — LONG-RUN STABILITY CHECK
   Sims many seasons with nobody at the controls and watches for slow
   drift: prestige piling up at the top (or the bottom), money running
   away or drying up, talent concentrating in a few schools, ratings
   inflating, the save file and the sim time growing year after year.

     node tests/longrun.js                    → 50 seasons, Compact league
     node tests/longrun.js 30 league=full     → 30 seasons, Full league (slow: ~1 min a season)
     node tests/longrun.js 50 seed=7 csv      → another seed; also writes tests/longrun.csv

   Prints a row every season, then trend checks comparing the first 10
   seasons with the last 10. PASS / WARN like tests/run.js.
   ===================================================================== */
const path = require("path"), fs = require("fs");
const R = (f) => require(path.join(__dirname, "..", f));
const League = R("dynasty/league.js"), Season = R("dynasty/season.js"), Recruiting = R("dynasty/recruiting.js");
const Offseason = R("dynasty/offseason.js"), Save = R("dynasty/save.js"), Pipelines = R("dynasty/pipelines.js"), Coaches = R("dynasty/coaches.js");

const args = process.argv.slice(2);
const YEARS = +(args.find(a => /^\d+$/.test(a)) || 50);
const LEAGUE = (args.find(a => a.startsWith("league=")) || "league=compact").slice(7);
const SEED = +((args.find(a => a.startsWith("seed=")) || "seed=42").slice(5));
const CSV = args.includes("csv");

const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const sd = (a) => { const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mb = (n) => (n / 1e6).toFixed(2);

/* size of each part of the save, to see what grows */
function sizes(lg, s) {
  const J = (x) => (x == null ? 0 : JSON.stringify(x).length);
  let teamHist = 0, playerHist = 0, players = 0, coach = 0;
  for (const t of lg.teams) {
    teamHist += J(t.history); coach += J(t.coach);
    for (const p of t.players) { playerHist += J(p.history); players += J(p); }
  }
  const packed = Save.pack(lg, s);
  const out = { total: packed.length, stored: require("zlib").gzipSync(packed).length, teamHist, playerHist, players: players - playerHist, coach,
    draftHistory: J(lg.draftHistory), recruiting: J(lg.recruiting), lastOffseason: J(lg.lastOffseason), lastRecruitingLog: J(lg.lastRecruitingLog), season: J({ ...s, byDay: null }) };
  // anything else at the top level of the league
  out.awards = J(lg.awards); out.records = J(lg.records); out.archive = J(lg.archive); out.series = J(lg.series); out.hof = J(lg.hof); out.coachPool = J(lg.coachPool);
  out.staff = lg.teams.reduce((a, t) => a + J(t.staff) + J(t.coach), 0);
  const known = new Set(["teams", "byId", "draftHistory", "recruiting", "lastOffseason", "lastRecruitingLog", "awards", "records", "archive", "series", "hof", "coachPool"]);
  out.otherLeague = 0; out.otherKeys = {};
  for (const k of Object.keys(lg)) if (!known.has(k)) { const n = J(lg[k]); out.otherLeague += n; if (n > 20000) out.otherKeys[k] = n; }
  return out;
}

function snapshot(lg, s, rep, simSec, offSec) {
  const T = lg.teams, ovr = (p) => League.ovrOf(p);
  const teamStr = T.map(t => avg(t.players.map(ovr).sort((a, b) => b - a).slice(0, 8)));
  const pres = T.map(t => t.prestige), banks = T.map(t => t.bank || 0);
  const allP = T.flatMap(t => t.players), ovrs = allP.map(ovr);
  const sortedStr = [...teamStr].sort((a, b) => b - a);
  const champ = s.post && s.post.national ? s.post.national.champion : null;
  let problems = 0;
  for (const t of T) {
    if (t.players.length !== 13) problems++;
    if (!Number.isFinite(t.bank || 0) || !Number.isFinite(t.prestige)) problems++;
    for (const p of t.players) if (p.salary == null || !Number.isFinite(ovr(p)) || !Number.isFinite(p.potential)) problems++;
  }
  const rp = lg.recruiting ? lg.recruiting.pool : [];
  return {
    year: lg.season, simSec, offSec,
    presAvg: avg(pres), presSd: sd(pres), presTop: pct(pres, 0.95), presLow: pct(pres, 0.05),
    atCeil: pres.filter(x => x >= 95).length, atFloor: pres.filter(x => x <= 22).length,
    ovrAvg: avg(ovrs), ovrTop: pct(ovrs, 0.99), potAvg: avg(allP.map(p => p.potential)),
    rating99: allP.reduce((n, p) => n + Object.values(p.ratings).filter(v => v >= 99).length, 0),
    strTop: avg(sortedStr.slice(0, Math.max(5, Math.round(T.length * 0.05)))), strSd: sd(teamStr),
    bankAvg: avg(banks), bankMax: Math.max(...banks), inDebt: banks.filter(b => b < 0).length,
    nilAvg: avg(T.map(t => t.nil)), facAvg: avg(T.map(t => t.facilities)), homeAvg: avg(T.map(t => t.homeCourt)),
    coachAvg: avg(T.map(t => (t.coach.rating + t.coach.recruiting + t.coach.development + t.coach.scouting) / 4)),
    staffAvg: avg(T.map(t => ["rating", "recruiting", "development", "scouting"].reduce((a, k) => a + Coaches.rating(t, k), 0) / 4)),
    staffPay: avg(T.map(t => Coaches.staffPay(t))),
    emptyChairs: T.reduce((a, t) => a + (t.staff || []).filter(x => !x).length, 0),
    headsOut: rep && rep.carousel ? rep.carousel.departures.filter(d => d.role === "head").length : 0,
    fired: rep && rep.carousel ? rep.carousel.departures.filter(d => d.role === "head" && d.why === "fired").length : 0,
    hof: lg.hof ? lg.hof.players.length : 0, hofC: lg.hof ? lg.hof.coaches.length : 0,
    jerseys: T.reduce((a, t) => a + (t.jerseys || []).length, 0),
    archived: lg.archive ? lg.archive.players.length : 0,
    payroll: avg(T.map(t => t.players.reduce((x, p) => x + (p.salary || 0), 0))),
    pipes: avg(T.map(t => Pipelines.describe(t).rows.filter(x => x.status === "active").length)),
    champ, problems,
    heap: process.memoryUsage().heapUsed,
    recPool: rp.length,
  };
}

console.log(`Long run: ${YEARS} seasons, ${LEAGUE} league, seed ${SEED}\n`);
const lg = League.generateLeague(SEED, { league: LEAGUE }); Recruiting.ensure(lg);
let s = Season.startSeason(lg, SEED);
const rows = [], champs = [], ff = new Map();
const hdr = "year  sim  off  presAvg  sd   p95  p05 ceil flr | ovr  p99  pot | strTop strSd | bank$k  max$k debt | nil  fac  home coach | pipes  save MB  heap MB";
console.log(hdr);
for (let y = 1; y <= YEARS; y++) {
  let t0 = Date.now(), g = 0;
  while (!Season.seasonComplete(s) && g++ < 400) Season.simDay(lg, s);
  const simSec = (Date.now() - t0) / 1000;
  // final four this year (for the "how many different programs" count)
  if (s.post && s.post.national) {
    const N = s.post.national, semi = N.rounds[N.rounds.length - 2] || [];
    for (const gid of semi) { const gm = s.games[gid]; for (const id of [gm.home, gm.away]) ff.set(id, (ff.get(id) || 0) + 1); }
  }
  const sDone = s;
  t0 = Date.now();
  const rep = Offseason.runOffseason(lg, s);
  s = Offseason.nextSeason(lg);
  const offSec = (Date.now() - t0) / 1000;
  const r = snapshot(lg, sDone, rep, simSec, offSec);
  if (r.champ) champs.push(r.champ);
  if (y === 1 || y % 5 === 0 || y === YEARS) { r.size = sizes(lg, s); }
  rows.push(r);
  const f = (v, w, d = 0) => (typeof v === "number" ? v.toFixed(d) : String(v)).padStart(w);
  console.log(`${r.year} ${f(simSec, 4)} ${f(offSec, 4, 1)} ${f(r.presAvg, 7, 1)} ${f(r.presSd, 4, 1)} ${f(r.presTop, 5)} ${f(r.presLow, 4)} ${f(r.atCeil, 4)} ${f(r.atFloor, 3)} | ${f(r.ovrAvg, 4, 1)} ${f(r.ovrTop, 4)} ${f(r.potAvg, 4, 0)} | ${f(r.strTop, 6, 1)} ${f(r.strSd, 5, 2)} | ${f(r.bankAvg / 1000, 6)} ${f(r.bankMax / 1000, 6)} ${f(r.inDebt, 4)} | ${f(r.nilAvg, 4)} ${f(r.facAvg, 4)} ${f(r.homeAvg, 4)} ${f(r.coachAvg, 5)} | ${f(r.pipes, 5, 2)} ${r.size ? f(mb(r.size.total), 8) : "        "} ${f(r.heap / 1e6, 7)}${r.problems ? "  PROBLEMS " + r.problems : ""}`);
  // a save every 10 seasons must load back
  if (y % 10 === 0) { const back = Save.unpack(Save.pack(lg, s)); if (!back || !back.lg || back.lg.teams.length !== lg.teams.length) { console.log("  SAVE ROUND TRIP FAILED"); process.exitCode = 1; } }
}

/* ---------------- what grows ---------------- */
const sized = rows.filter(r => r.size);
console.log(`\nSave size by part (MB):`);
const parts = ["total", "players", "playerHist", "teamHist", "staff", "coachPool", "archive", "awards", "records", "series", "hof", "draftHistory", "recruiting", "lastOffseason", "season", "otherLeague"];
console.log("year  " + parts.map(p => p.slice(0, 10).padStart(11)).join(""));
for (const r of sized) console.log(`${r.year}  ` + parts.map(p => mb(r.size[p]).padStart(11)).join("") + (Object.keys(r.size.otherKeys).length ? "   " + Object.entries(r.size.otherKeys).map(([k, n]) => `${k} ${mb(n)}`).join(", ") : ""));

/* ---------------- trend checks: first 10 vs last 10 ---------------- */
let pass = 0, warn = 0;
function check(label, value, lo, hi, fmt = (v) => v.toFixed(1)) {
  const ok = value >= lo && value <= hi; ok ? pass++ : warn++;
  console.log(`  ${ok ? "PASS" : "WARN"}  ${label}`.padEnd(74) + `${fmt(value)}`.padStart(10) + `   [${fmt(lo)} … ${fmt(hi)}]`);
}
/* a new league fills in over its first few seasons (young rosters grow into it): the "before" window skips them */
const WARM = rows.length >= 25 ? 5 : 0;
const n = Math.min(10, Math.floor((rows.length - WARM) / 2)), A = rows.slice(WARM, WARM + n), B = rows.slice(-n);
const m = (rs, k) => avg(rs.map(r => r[k]));
const drift = (k) => m(B, k) - m(A, k);
console.log(`\nTrends (seasons ${WARM + 1}–${WARM + n} → last ${n}):`);
check("roster / money / rating problems, all seasons (must be 0)", rows.reduce((x, r) => x + r.problems, 0), 0, 0, String);
check("average prestige drift", drift("presAvg"), -6, 6);
check("prestige spread (sd) drift", drift("presSd"), -4, 4);
check("schools at 95+ prestige, last seasons (share of league %)", 100 * m(B, "atCeil") / lg.teams.length, 0, 6);
check("schools at the prestige floor, last seasons (share %)", 100 * m(B, "atFloor") / lg.teams.length, 0, 12);
check("league average overall drift", drift("ovrAvg"), -2.5, 2.5);
check("99th-percentile overall drift", drift("ovrTop"), -3, 3);
check("ratings at 99 per team, drift", drift("rating99") / lg.teams.length, -1, 1, (v) => v.toFixed(2));
check("top-5% team strength drift", drift("strTop"), -3, 3);
check("team strength spread drift", drift("strSd"), -1.5, 1.5, (v) => v.toFixed(2));
check("average bank drift ($k)", drift("bankAvg") / 1000, -1500, 1500, (v) => v.toFixed(0));
check("schools in debt, last seasons (share %)", 100 * m(B, "inDebt") / lg.teams.length, 0, 20);
check("NIL average drift", drift("nilAvg"), -8, 8);
check("facilities average drift", drift("facAvg"), -8, 8);
check("home court average drift", drift("homeAvg"), -8, 8);
check("coach ratings average drift", drift("coachAvg"), -5, 9);   // some inflation is accepted: young coaches grow and the best get hired (about half what it was before the budget rule)
check("payroll per team drift ($k)", drift("payroll") / 1000, -800, 800, (v) => v.toFixed(0));
check("staff rating average drift (what the game uses)", drift("staffAvg"), -5, 7);
check("staff pay per team drift ($k)", drift("staffPay") / 1000, -300, 300, (v) => v.toFixed(0));
check("head coaches leaving per season, last seasons (share %)", 100 * m(B, "headsOut") / lg.teams.length, 3, 20);
check("empty assistant chairs, last seasons (share of chairs %)", 100 * m(B, "emptyChairs") / (2 * lg.teams.length), 0, 15);
console.log(`  INFO  Hall of Fame: ${rows[rows.length-1].hof} players, ${rows[rows.length-1].hofC} coaches · jerseys retired: ${rows[rows.length-1].jerseys} · archived players: ${rows[rows.length-1].archived}`);
check("active pipelines per team drift", drift("pipes"), -0.6, 0.6, (v) => v.toFixed(2));
check("sim time per season: last vs first (×)", m(B, "simSec") / Math.max(0.01, m(A, "simSec")), 0, 1.4, (v) => v.toFixed(2));
check("offseason time: last vs first (×)", m(B, "offSec") / Math.max(0.01, m(A, "offSec")), 0, 1.6, (v) => v.toFixed(2));
const s0 = sized[0].size.total, s1 = sized[sized.length - 1].size.total, yrs = sized[sized.length - 1].year - sized[0].year;
check(`save growth per season (MB; ${mb(s0)} → ${mb(s1)})`, (s1 - s0) / Math.max(1, yrs) / 1e6, -1, lg.teams.length > 150 ? 0.25 : 0.06, (v) => v.toFixed(3));
{ const z0 = sized[0].size.stored, z1 = sized[sized.length - 1].size.stored;   // what a slot or file actually holds (save.js compresses)
  check(`save as stored, compressed (MB; ${mb(z0)} → ${mb(z1)}), growth per season`, (z1 - z0) / Math.max(1, yrs) / 1e6, -1, lg.teams.length > 150 ? 0.05 : 0.012, (v) => v.toFixed(3)); }
const distinct = new Set(champs).size, field0 = (lg.league && lg.league.rules && lg.league.rules.natField) || 16;
check(`different national champions (${champs.length} seasons)`, distinct / Math.max(1, champs.length), field0 >= 64 ? 0.3 : 0.2, 1, (v) => `${distinct}`.padStart(2) + ` (${(v * 100).toFixed(0)}%)`);
const ffTop = [...ff.values()].sort((a, b) => b - a)[0] || 0;
const field = (lg.league && lg.league.rules && lg.league.rules.natField) || 16;   // a Final Four is two wins in a 16-team field, four in 64
check(`most Final Four trips by one school (share of seasons %; ${field}-team field)`, 100 * ffTop / Math.max(1, champs.length), 0, field >= 64 ? 40 : field >= 32 ? 50 : 65);
console.log(`\n  INFO  Final Four programs: ${ff.size} different, top: ${[...ff.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, k]) => `${lg.byId[id].name} ${k}`).join(", ")}`);

if (CSV) {
  const keys = Object.keys(rows[0]).filter(k => k !== "size");
  fs.writeFileSync(path.join(__dirname, `longrun-${LEAGUE}-${SEED}.csv`), [keys.join(","), ...rows.map(r => keys.map(k => r[k]).join(","))].join("\n"));
  console.log(`  wrote tests/longrun-${LEAGUE}-${SEED}.csv`);
}
console.log(`\n${pass} passed, ${warn} to look at.`);
process.exit(warn ? 1 : 0);
