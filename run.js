/* =====================================================================
   HOOPS DYNASTY — BALANCE CHECKS
     node tests/run.js            → quick (about 1–2 minutes)
     node tests/run.js full       → bigger samples (about 5–8 minutes)
     node tests/run.js scouting   → just one group (engine, positions,
                                    tactics, development, scouting, league, dynasty, speed)
     node tests/run.js league=compact speed → pick the league definition
                                    (leagues.js); the default is compact

   Each line prints the measured number and the range it should sit in,
   taken from the tuning passes written up in the READMEs. PASS = inside,
   WARN = outside (look at it; it may be fine if you changed that system on
   purpose, then update the range here).
   ===================================================================== */
const path = require("path");
const R = (f) => require(path.join(__dirname, "..", f));
const Engine = R("sim/engine.js"), T = R("sim/tuning.js"), Sample = R("sim/sample_teams.js");
const League = R("dynasty/league.js"), Season = R("dynasty/season.js"), Recruiting = R("dynasty/recruiting.js");
const Development = R("dynasty/development.js"), Offseason = R("dynasty/offseason.js");

const args = process.argv.slice(2);
const FULL = args.includes("full");
const LEAGUE = (args.find(a => a.startsWith("league=")) || "league=compact").slice(7);
const LOPT = { league: LEAGUE };
const ONLY = args.find(a => a !== "full" && !a.startsWith("league="));
const K = FULL ? 3 : 1;                        // sample size multiplier
let pass = 0, warn = 0; const pending = [];
function check(label, value, lo, hi, fmt = (v) => v.toFixed(1)) {
  const ok = value >= lo && value <= hi;
  ok ? pass++ : warn++;
  console.log(`  ${ok ? "PASS" : "WARN"}  ${label.padEnd(58)} ${fmt(value).padStart(8)}   [${fmt(lo)} – ${fmt(hi)}]`);
}
const pct = (v) => (100 * v).toFixed(1) + "%";
const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const group = (name, fn) => { if (ONLY && ONLY !== name) return; const t0 = Date.now(); console.log(`\n${name.toUpperCase()}`); fn(); console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)}s)`); };

/* copy of a team for mirror games: same players, new ids */
function mirror(team) {
  const B = Season.toSimTeam(team, false);
  B.id += "_b"; B.players = B.players.map(p => ({ ...p, id: p.id + "_b" }));
  const r = {}; for (const k in B.rotation) r[k + "_b"] = B.rotation[k]; B.rotation = r;
  if (B.isoTarget) B.isoTarget += "_b";
  return B;
}
function mirrorGames(teams, games, setupA, opts = {}) {
  let w = 0, n = 0, pd = 0;
  for (const team of teams) for (let s = 0; s < games; s++) {
    const A = Season.toSimTeam(team, false), B = mirror(team);
    for (const X of [A, B]) { X.coach.rating = 70; X.coach.offense = "balanced"; X.coach.defense = "man"; }
    setupA(A);
    const flip = s % 2, g = Engine.createGame(flip ? B : A, flip ? A : B, { seed: 9000 + s, homeCourt: null, ...opts });
    Engine.simulateGame(g);
    const a = g.teams[flip ? 1 : 0].score, b = g.teams[flip ? 0 : 1].score;
    if (a > b) w++; pd += a - b; n++;
  }
  return { win: w / n, margin: pd / n };
}

/* ---------------- the game engine vs college numbers ---------------- */
group("engine", () => {
  const rand = Engine.makeRng(1), OFF = Object.keys(T.styles.offense), DEF = Object.keys(T.styles.defense);
  const acc = { pts: 0, poss: 0, tpa: 0, tov: 0 }; let n = 0;
  for (let i = 0; i < 300 * K; i++) {
    const tm = [0, 1].map(j => Sample.generateTeam(rand, { id: j ? "B" : "A", quality: 58 + Math.floor(rand() * 21),
      coach: { rating: 40 + Math.floor(rand() * 60), offense: OFF[Math.floor(rand() * OFF.length)], defense: DEF[Math.floor(rand() * DEF.length)] } }));
    const g = Engine.createGame(tm[0], tm[1], { seed: 100000 + i }); Engine.simulateGame(g);
    for (const t of Engine.boxScore(g).teams) { const s = t.totals; acc.pts += s.pts; acc.poss += s.fga - s.oreb + s.tov + 0.475 * s.fta; acc.tpa += s.tpa; acc.tov += s.tov; n++; }
  }
  check("points per team per game (NCAA ~73)", acc.pts / n, 69, 77);
  check("possessions per team per game (NCAA ~68)", acc.poss / n, 64, 71);
  check("threes attempted (NCAA ~23)", acc.tpa / n, 19, 27);
  check("turnovers (NCAA ~11.5)", acc.tov / n, 9.5, 13.5);
});

/* ---------------- overall is even across positions ---------------- */
group("positions", () => {
  const rand = Engine.makeRng(9), out = {};
  for (const pos of Engine.POS_ORDER) { let s = 0; const N = 2000 * K; for (let i = 0; i < N; i++) { const p = Sample.generatePlayer(rand, { id: "x", pos, base: 60 }); s += Engine.overall(T, pos, p.ratings); } out[pos] = s / N; }
  const m = avg(Object.values(out));
  for (const pos of Engine.POS_ORDER) check(`${pos} overall vs the average, same generation quality`, out[pos] - m, -1.5, 1.5, (v) => (v >= 0 ? "+" : "") + v.toFixed(1));
  let cTop = 0; for (const seed of [42, 7, 99]) { const lg = League.generateLeague(seed, LOPT); Recruiting.ensure(lg); cTop += lg.recruiting.pool.slice(0, 25).filter(r => r.pos === "C").length; }
  check("centers in the recruiting top 25 (about 5 if even)", cTop / 3, 2, 8);
});

/* ---------------- tactics: nothing brutal ---------------- */
group("tactics", () => {
  const lg = League.generateLeague(42, LOPT); Season.startSeason(lg, 42);
  const teams = lg.teams.filter((t, i) => i % 6 === 0).slice(0, 12);
  for (const kind of ["offense", "defense"]) for (const name of Object.keys(T.styles[kind])) {
    if (name === "balanced" || name === "man") continue;
    const r = mirrorGames(teams, 20 * K, (A) => { A.coach[kind] = name; });
    check(`${kind} ${name}: win % vs the same roster on Balanced/Man`, r.win, 0.40, 0.58, pct);
  }
});

/* ---------------- development curves ---------------- */
group("development", () => {
  const rand = Engine.makeRng(11), classes = ["FR", "SO", "JR", "SR"];
  const byC = { FR: [], SO: [], JR: [], SR: [] };
  for (const seed of [42, 7, 99]) {
    const lg = League.generateLeague(seed, LOPT);
    for (const t of lg.teams) [...t.players].sort((a, b) => League.ovrOf(b) - League.ovrOf(a)).forEach((p, i) => { p.xp = i < 5 ? 1250 : i < 8 ? 850 : 450; byC[p.class].push(Development.developPlayer(rand, p, t).delta); });
  }
  check("league average gain, freshmen", avg(byC.FR), 5, 7.5);
  check("league average gain, seniors", avg(byC.SR), 1.8, 3.5);
  const lg = League.generateLeague(1, LOPT), team = lg.teams[0]; team.coach.development = 60; team.facilities = 55;
  const career = (pot) => { let tot = 0; const N = 150 * K;
    for (let t = 0; t < N; t++) { const p = JSON.parse(JSON.stringify(lg.teams[t % lg.teams.length].players[t % 10]));
      const o = League.ovrOf(p); for (const k in p.ratings) p.ratings[k] = Math.max(25, Math.min(99, Math.round(p.ratings[k] + 55 - o)));
      p.potential = pot; p.devRate = 1; for (let y = 0; y < 4; y++) { p.class = classes[y]; p.xp = 1250; tot += Development.developPlayer(rand, p, team).delta; } }
    return 55 + tot / N; };
  check("4-year starter from 55, potential 65 → senior overall", career(65), 65, 70);
  check("4-year starter from 55, potential 85 → senior overall", career(85), 80, 86);
  check("4-year starter from 55, potential 95 → senior overall", career(95), 84, 91);
});

/* ---------------- scouting & the recruiting board ---------------- */
group("scouting", () => {
  let n = 0, oOut = 0, pOut = 0, bad = 0, inv = 0, pairs = 0;
  for (const seed of [42, 7, 99, 123, 5]) {
    const lg = League.generateLeague(seed, LOPT); Recruiting.ensure(lg);
    const t = lg.teams[0]; let prev = null;
    for (const r of lg.recruiting.pool) {
      for (const L of [0, 1, 2, 3]) {
        r.scout[t.id] = [0, 25, 60, 100][L]; const v = Recruiting.scoutView(lg, t, r);
        const inO = r.ovr >= v.ovr[0] && r.ovr <= v.ovr[1], inP = r.potential >= v.pot[0] && r.potential <= v.pot[1];
        if (L === 0) { n++; if (!inO) oOut++; if (!inP) pOut++; const mid = (v.ovr[0] + v.ovr[1]) / 2; if (prev != null) { pairs++; if (mid > prev + 3) inv++; } prev = mid; }
        else { if (!inO || !inP) bad++; for (const k in v.ratings) { const b = v.ratings[k], x = r.player.ratings[k]; if (x < b[0] || x > b[1]) bad++; } }
      }
      r.scout[t.id] = 0;
    }
  }
  check("level 0: real overall outside the band (target ~1 in 4)", oOut / n, 0.18, 0.32, pct);
  check("level 0: real potential outside the band (target ~2 in 5)", pOut / n, 0.33, 0.50, pct);
  check("levels 1–3: bands that miss the truth (must be 0)", bad, 0, 0, (v) => String(v));
  check("board: next kid reads 3+ higher than the one above", inv / pairs, 0, 0.06, pct);
});

/* ---------------- a few dynasty seasons end to end ---------------- */
group("dynasty", () => {
  const years = FULL ? 4 : 2, lg = League.generateLeague(42, LOPT); Recruiting.ensure(lg);
  let s = Season.startSeason(lg, 42), drafted = 0, transfers = 0, problems = 0, headsOut = 0, promoted = 0;
  const leaguePicks = [];
  const Geo = require("../dynasty/geo.js"), Pipelines = require("../dynasty/pipelines.js");
  const geoSigned = { home: 0, close: 0, far: 0 }, geoLow = { home: 0, close: 0, far: 0 }, geoTop = { home: 0, close: 0, far: 0 };
  for (let y = 1; y <= years; y++) {
    let g = 0; while (!Season.seasonComplete(s) && g++ < 400) Season.simDay(lg, s);
    for (const rc of lg.recruiting.pool) if (rc.status === "committed") {   // geography: how far from home each signee goes
      const lvl = Geo.level(Geo.miles(lg.byId[rc.commitTo].city, rc.home)); geoSigned[lvl]++;
      if (rc.stars <= 3) geoLow[lvl]++; else geoTop[lvl]++;
    }
    const rep = Offseason.runOffseason(lg, s);
    for (const tid in rep.departures) drafted += rep.departures[tid].drafted.filter(p => p.early).length;   // underclassmen who left for the draft
    if (rep.draft) leaguePicks.push(rep.draft.leaguePicks);
    for (const tid in (rep.transfers || {})) transfers += rep.transfers[tid].length;
    if (rep.carousel) { headsOut += rep.carousel.departures.filter(d => d.role === "head").length; promoted += rep.carousel.hires.filter(h => h.role === "head" && h.from).length; }
    s = Offseason.nextSeason(lg);
    for (const t of lg.teams) { if (t.players.length !== 13) problems++; if (!Number.isFinite(t.bank || 0)) problems++; for (const p of t.players) if (p.salary == null || !Number.isFinite(League.ovrOf(p))) problems++; }
  }
  const all = lg.teams.flatMap(t => t.players.map(League.ovrOf));
  const Coaches = require("../dynasty/coaches.js");
  let staffBad = 0;
  for (const t of lg.teams) {
    if (!t.coach || t.coach.vacant || !t.coach.id || !Number.isFinite(t.coach.salary)) staffBad++;
    if (!Array.isArray(t.staff) || t.staff.length !== Coaches.CFG.slots) staffBad++;
    for (const k of Coaches.CFG.keys) if (!Number.isFinite(Coaches.rating(t, k))) staffBad++;
  }
  check("coaching staffs: vacant jobs, bad salaries or ratings (must be 0)", staffBad, 0, 0, (v) => String(v));
  check("head coaches leaving per year (share of schools %; few in year one)", 100 * headsOut / years / lg.teams.length, 0.5, 25);
  check("coach pool size per school", lg.coachPool.length / lg.teams.length, 0.7, 1.6, (v) => v.toFixed(2));
  const Awards = require("../dynasty/awards.js"), AY = Object.values(lg.awards || {}).filter(A => A.national);   // (the new season's entry holds only its preseason picks)
  let awBad = 0;
  for (const A of AY) { const N = A.national; if (!N.POY || !N.DPOY || !N.COY || !N.MOP) awBad++; for (const i of [1, 2, 3]) if (!N["AA" + i] || N["AA" + i].length !== 5) awBad++; }
  check(`awards: seasons missing a national award or All-American team (${AY.length} seasons; must be 0)`, AY.length === years ? awBad : 99, 0, 0, (v) => String(v));
  check("archived players per year, per 100 schools (save size)", (lg.archive ? lg.archive.players.length : 0) / years * 100 / lg.teams.length, 20, 90, (v) => v.toFixed(0));
  const Records = require("../dynasty/records.js"), RB = lg.records && lg.records.league;
  let recBad = 0;
  if (!RB) recBad = 99; else {
    for (const k of Records.CFG.game) if (!RB.game[k] || !(RB.game[k].v > 0)) recBad++;
    for (const k of ["wins", "teamPts", "margin", "streak"]) if (!RB.team[k]) recBad++;
    for (const k of Records.CFG.career) { const L = RB.career[k] || []; if (L.some((r, i) => i && r.v > L[i - 1].v)) recBad++; }
    const sch = Object.values(lg.records.schools);
    if (sch.length !== lg.teams.length) recBad++;
  }
  // Hall of Fame and retired jerseys: well-formed, capped, and no retired number still worn
  let hofBad = 0;
  const HF = lg.hof || { players: [], coaches: [] }, perYear = {};
  for (const x of HF.players) { perYear[x.y] = (perYear[x.y] || 0) + 1; if (!x.name || !(x.score >= require("../dynasty/hof.js").CFG.player.threshold)) hofBad++; }
  if (Object.values(perYear).some(n => n > 5)) hofBad++;
  for (const t of lg.teams) { const ret = new Set((t.jerseys || []).map(j => j.num)); if (t.players.some(p => ret.has(p.num))) hofBad++; const nums = t.players.map(p => p.num); if (new Set(nums).size !== nums.length) hofBad++; }
  check("Hall of Fame / jerseys: bad entries, over the cap, retired or duplicate numbers worn (must be 0)", hofBad, 0, 0, (v) => String(v));
  check("record book: missing league records, unsorted career lists, schools without records (must be 0)", recBad, 0, 0, (v) => String(v));
  check("record book size (KB, fixed: records replace each other)", JSON.stringify(lg.records).length / 1000 * 74 / lg.teams.length, 50, 400, (v) => v.toFixed(0));
  const ser = Object.values(lg.series || {}).reduce((x, r) => x + r[0] + r[1], 0), playedGames = lg.teams.reduce((x, t) => x + t.history.reduce((y, h) => y + h.w + h.l, 0), 0) / 2;
  check("series records count every game (recorded / played)", ser / Math.max(1, playedGames), 0.999, 1.001, (v) => v.toFixed(3));
  // moving on by choice: a coach with a great record takes an open job; his old school is filled in the same carousel
  {
    const lg2 = League.generateLeague(7, { ...LOPT, userTeam: { name: "Mover U", prestige: 40 } }); Recruiting.ensure(lg2);
    let s2 = Season.startSeason(lg2, 7), g2 = 0; while (!Season.seasonComplete(s2) && g2++ < 400) Season.simDay(lg2, s2);
    const u = lg2.teams.find(t => t.isUser);
    u.coach.repLog = [1, 2, 3].map(i => ({ y: 2000 + i, pct: 0.85, post: 5, coy: true }));   // three title seasons
    Offseason.beginOffseason(lg2, s2);
    const car = lg2.offseason.carousel, job = (car.jobs || []).find(j => j.interested);
    let moveBad = 0;
    if (!(car.jobs || []).length !== !job) moveBad++;   // with three title seasons on his record, some opening wants him
    if (job) {
      const r = Coaches.takeJob(lg2, job.teamId);
      if (!r.ok || !lg2.byId[job.teamId].isUser || u.isUser || !u.coach.vacant) moveBad++;
      Offseason.finishCarousel(lg2);
      if (lg2.teams.some(t => t.coach.vacant)) moveBad++;
      if (lg2.byId[job.teamId].coach.salary > Coaches.budget(lg2.byId[job.teamId], "head")) moveBad++;
    }
    check(`moving on by choice: problems (${job ? "took " + lg2.byId[job.teamId].name : "no opening that year"}; must be 0)`, moveBad, 0, 0, (v) => String(v));
  }
  console.log(`  INFO  head jobs filled by promoting an assistant`.padEnd(68) + `${promoted} of ${headsOut}`);
  check("rosters not 13, bad banks, missing salaries (must be 0)", problems, 0, 0, (v) => String(v));
  check("early draft departures per year, per 74 teams (low in a new league, ~8–10 by year 4)", drafted / years * 74 / lg.teams.length, 1.5, 12);   // ~4.5 averaged over seeds; one seed swings ±2
  const lpAvg = leaguePicks.reduce((x, y) => x + y, 0) / Math.max(1, leaguePicks.length), lpWant = 40 * lg.teams.length / 352;
  check(`league players drafted per year (of 60; ~${Math.round(lpWant)} for ${lg.teams.length} teams)`, lpAvg, Math.max(5, lpWant * 0.7), Math.min(60, lpWant * 1.35));
  check("transfers per team per year", transfers / years / lg.teams.length, 0.8, 1.8, (v) => v.toFixed(2));
  check("league average overall after the run", avg(all), 61, 68);
  const near = (o) => (o.home + o.close) / Math.max(1, o.home + o.close + o.far);
  const big = lg.teams.length > 150;   // the Full league is denser: more schools near every kid
  check(`recruits signing within ${Geo.CFG.miles.close} miles of home (${big ? "Full ~80%" : "Compact ~55–60%"})`, 100 * near(geoSigned), big ? 65 : 42, big ? 92 : 75, (v) => v.toFixed(0) + "%");
  // lower-ranked kids stay closer to home; only measurable in the Full league (in Compact, 4–5★ is half the class)
  const gap = 100 * (near(geoLow) - near(geoTop));
  if (big) check("…2–3★ minus 4–5★ signing near home (lower-ranked kids stay closer)", gap, 3, 40, (v) => v.toFixed(0) + " pts");
  else console.log(`  INFO  …2–3★ minus 4–5★ signing near home (measured in the Full league)`.padEnd(68) + gap.toFixed(0) + " pts");
  const extra = lg.teams.flatMap(t => Pipelines.describe(t).rows.filter(x => x.status === "active"));
  check("extra pipelines Established or better, per team", extra.filter(x => x.strength >= Pipelines.CFG.levels[1][0]).length / lg.teams.length, 0.05, 1.5, (v) => v.toFixed(2));
  const banks = lg.teams.map(t => t.bank || 0);
  check("average bank balance ($k)", avg(banks) / 1000, -500, 8000, (v) => v.toFixed(0));
});

/* ---------------- league presets: size, names, schedule ---------------- */
group("league", () => {
  // the map data (dynasty/geo.js): its own check, problems only
  const geo = require("child_process").spawnSync(process.execPath, [require("path").join(__dirname, "geo_check.js"), "short"], { encoding: "utf8" });
  check("geography data problems (node tests/geo_check.js lists them; must be 0)", geo.status === 0 ? 0 : (geo.stdout.match(/^  City|^  Area/gm) || [1]).length, 0, 0, v => String(v));
  const Leagues = require("../dynasty/leagues.js");
  for (const id of Object.keys(Leagues.LEAGUES)) {
    const def = Leagues.get(id), lg = League.generateLeague(42, { league: id }), r = Leagues.rulesFor(def);
    const bad = (lg.teams.length !== Leagues.teamCount(def)) + (new Set(lg.teams.map(t => t.name)).size !== lg.teams.length) + (new Set(lg.teams.map(t => t.abbr)).size !== lg.teams.length);
    check(`${id}: wrong team count, repeated names or abbreviations (must be 0)`, bad, 0, 0, v => String(v));
    const se = Season.startSeason(lg, 42), n = {};
    for (const g of se.games) for (const t of [g.home, g.away]) { n[t] = n[t] || { nc: 0, conf: 0 }; n[t][g.type]++; }
    const nc = Object.values(n).map(x => x.nc), cf = Object.values(n).map(x => x.conf);
    check(`${id}: teams short of ${r.nonConfGames} non-conference games`, nc.filter(x => x < r.nonConfGames).length, 0, Math.ceil(lg.teams.length * 0.03), v => String(v));
    const maxConf = r.confGames || 2 * (Math.max(...lg.conferences.map(c => c.teamIds.length)) - 1);
    check(`${id}: most conference games for a team (rule ${r.confGames || "home and away"})`, Math.max(...cf), 1, maxConf + 1, v => String(v));
    check(`${id}: regular season days`, se.lastDay, 85, 110, v => String(v));
  }
  // league files: export → check → import gives back the same league
  for (const id of ["compact", "full"]) {
    const lg = League.generateLeague(42, { league: id }), file = JSON.parse(JSON.stringify(League.exportDefinition(lg)));
    const c = Leagues.check(file);
    check(`${id}: problems in its own exported league file (must be 0)`, c.errors.length, 0, 0, v => String(v));
    Leagues.register(c.def);
    const back = League.generateLeague(7, { league: c.def.id });
    let diff = 0;
    lg.teams.forEach((t, i) => { const u = back.teams[i];
      if (t.name !== u.name || t.prestige !== u.prestige || t.coach.name !== u.coach.name || t.coach.rating !== u.coach.rating || t.nil !== u.nil) diff++;
      t.players.forEach((p, j) => { const q = u.players[j]; if (!q || p.name !== q.name || p.class !== q.class || League.ovrOf(p) !== League.ovrOf(q) || p.potential !== q.potential) diff++; }); });
    check(`${id}: schools or players that change in an export → import round trip (must be 0)`, diff, 0, 0, v => String(v));
  }
});

/* ---------------- speed (information, not pass/fail) ---------------- */
group("speed", () => {
  const Offseason2 = Offseason, sec = (t0) => ((Date.now() - t0) / 1000).toFixed(2) + "s";
  let t0 = Date.now();
  const lg = League.generateLeague(42, LOPT); Recruiting.ensure(lg);
  console.log(`  INFO  build league (${lg.teams.length} teams) + recruiting class (${lg.recruiting.pool.length} recruits)`.padEnd(68) + sec(t0));
  t0 = Date.now(); let s = Season.startSeason(lg, 42);
  console.log(`  INFO  schedule (${s.games.length} games)`.padEnd(68) + sec(t0));
  t0 = Date.now(); let days = 0, weekMs = 0, weeks = 0;
  const realOnDay = Recruiting.onDay;   // the season calls this at the end of every day; weekly work happens inside it
  Recruiting.onDay = (a, b) => { const w0 = Date.now(); realOnDay(a, b); const ms = Date.now() - w0; if (ms > 5) { weekMs += ms; weeks++; } };
  while (!Season.seasonComplete(s) && days++ < 400) Season.simDay(lg, s);
  Recruiting.onDay = realOnDay;
  console.log(`  INFO  whole season incl. postseason (${days} days)`.padEnd(68) + sec(t0));
  console.log(`  INFO    of which recruiting (${weeks} busy days, avg ${(weekMs / Math.max(1, weeks)).toFixed(0)} ms each)`.padEnd(68) + (weekMs / 1000).toFixed(2) + "s");
  t0 = Date.now(); Offseason2.beginOffseason(lg, s);
  console.log(`  INFO  offseason part 1 (development, departures, decisions setup)`.padEnd(68) + sec(t0));
  t0 = Date.now(); Offseason2.transferWindow(lg, s);
  console.log(`  INFO  transfer window + portal opens (${lg.portal.pool.length} in the portal)`.padEnd(68) + sec(t0));
  t0 = Date.now(); while (!lg.portal.closed) Offseason2.portalRound(lg);
  console.log(`  INFO  portal rounds + close`.padEnd(68) + sec(t0));
  t0 = Date.now(); Offseason2.finishOffseason(lg, s); s = Offseason2.nextSeason(lg);
  console.log(`  INFO  finish offseason + next recruiting class + schedule`.padEnd(68) + sec(t0));
  let size = 0; try { size = R("dynasty/save.js").pack(lg, s).length; } catch (e) { size = JSON.stringify({ lg, s: { ...s, byDay: null } }).length; }
  console.log(`  INFO  save size after one season`.padEnd(68) + (size / 1e6).toFixed(2) + " MB");
});

// saves: compressed and back gives the same league; plain JSON (older saves) still loads
{
  const Save = R("dynasty/save.js"), League2 = R("dynasty/league.js"), Season2 = R("dynasty/season.js");
  const lg = League2.generateLeague(42, LOPT), s = Season2.startSeason(lg, 42);
  for (let d = 0; d < 20; d++) Season2.simDay(lg, s);
  const json = Save.pack(lg, s);
  pending.push((async () => {
    const z = await Save.gzip(json), back = await Save.gunzip(z);
    check("save compression: smaller by (×)", json.length / z.length, 4, 20, (v) => v.toFixed(1) + "×");
    check("save compression: round trip is identical", back === json ? 1 : 0, 1, 1, (v) => v ? "yes" : "no");
    check("save compression: recognized as compressed, plain JSON isn't", Save.isGzip(z) && !Save.isGzip(new TextEncoder().encode(json)) ? 1 : 0, 1, 1, (v) => v ? "yes" : "no");
    const d = Save.unpack(back);
    check("save compression: unpacked league has every team", d.lg.teams.length === lg.teams.length ? 1 : 0, 1, 1, (v) => v ? "yes" : "no");
  })());
}

// recruiting: withdrawing an offer turns that kid's auto-recruiting off (no points on autopilot for a kid you've dropped)
{
  const Rec = R("dynasty/recruiting.js"), L = R("dynasty/league.js"), S2 = R("dynasty/season.js");
  const lg = L.generateLeague(42, LOPT); Rec.ensure(lg); S2.startSeason(lg, 42);
  const t = lg.teams.find(x => x.isUser) || lg.teams[0]; t.bank = 5e6;   // plenty of money: this is about the offer rules, not the budget
  const kid = lg.recruiting.pool.filter(r => r.status === "open").sort((a, b) => a.asking - b.asking)[0];
  Rec.setOffer(lg, t, kid, kid.asking); kid.interest[t.id].auto = true; Rec.markSeen(lg.recruiting.pool);
  const res = Rec.withdrawOffer(lg, t, kid);
  check("withdrawing an offer turns his auto-recruiting off", res.ok && !kid.interest[t.id].auto && !Rec.autoTargets(lg, t).includes(kid) ? 1 : 0, 1, 1, (v) => v ? "yes" : "no");
}

// recruiting: once he's seen your offer, a new one can't come in lower; the public board isn't sorted into runs by potential
{
  const Rec = R("dynasty/recruiting.js"), L = R("dynasty/league.js"), S2 = R("dynasty/season.js");
  const lg = L.generateLeague(42, LOPT); Rec.ensure(lg); S2.startSeason(lg, 42);
  const t = lg.teams.find(x => x.isUser) || lg.teams[0]; t.bank = 5e6;
  const kid = lg.recruiting.pool.filter(r => r.status === "open").sort((a, b) => a.asking - b.asking)[0];
  const amt = Math.round(kid.asking / 1000) * 1000;
  Rec.setOffer(lg, t, kid, amt); Rec.markSeen(lg.recruiting.pool); Rec.withdrawOffer(lg, t, kid); Rec.markSeen(lg.recruiting.pool);
  const lower = Rec.setOffer(lg, t, kid, amt - 5000), same = Rec.setOffer(lg, t, kid, amt);
  check("after withdrawing, a new offer can't be lower than the one he saw", !lower.ok && same.ok ? 1 : 0, 1, 1, (v) => v ? "yes" : "no");
  let c = 0, n = 0;
  for (const seed of [42, 7, 99, 5]) {
    const lg2 = L.generateLeague(seed, LOPT); Rec.ensure(lg2);
    const pot = [...lg2.recruiting.pool].sort((a, b) => a.rank - b.rank).map(r => r.pubPot);
    const res = pot.map((v, i) => { const w = pot.slice(Math.max(0, i - 4), i + 5); return v - w.reduce((x, y) => x + y, 0) / w.length; });
    const m = res.reduce((x, y) => x + y, 0) / res.length; let num = 0, den = 0;
    for (let i = 0; i < res.length - 1; i++) num += (res[i] - m) * (res[i + 1] - m);
    for (const v of res) den += (v - m) ** 2;
    c += num / den; n++;
  }
  check("public board: neighbors' public potential barely related (no runs)", c / n, -0.15, 0.10, (v) => v.toFixed(2));
}

// dead balls: subs only on a dead ball (never after a steal or a defensive rebound), timeouts only by the team with the ball or on a dead ball
{
  const Engine = R("sim/engine.js"), Sample = R("sim/sample_teams.js"), rand = Engine.makeRng(9);
  let live = 0, subs = 0, badTO = 0, queuedOk = 0;
  for (let i = 0; i < 60; i++) {
    const A = Sample.generateTeam(rand, { id: "A", name: "A", quality: 66 }), B = Sample.generateTeam(rand, { id: "B", name: "B", quality: 66 });
    const g = Engine.createGame(A, B, { seed: 50 + i, events: false, onEvent: (e, g) => { if (e.type === "sub" && e.reason !== "fouled out") { subs++; if (!g.deadBall) live++; } } });
    while (Engine.advance(g)) {
      if (!g.deadBall) {   // a live ball after a steal or a rebound: the other team can't stop play, and a sub waits
        if (Engine.callTimeout(g, 1 - g.offIdx)) badTO++;
        const t = g.teams[0], out = t.onCourt[0], inn = t.players.find(p => !t.onCourt.includes(p.id) && !p.fouledOut);
        if (i === 0 && inn && Engine.substitute(g, 0, out, inn.id) === "queued" && t.onCourt.includes(out)) queuedOk++;
      }
    }
  }
  check("subs on a live ball (must be 0)", live, 0, 0, (v) => `${v} of ${subs}`);
  check("timeouts by the team without the ball on a live ball (must be 0)", badTO, 0, 0, (v) => String(v));
  check("a coach's sub on a live ball waits for the dead ball", queuedOk > 0 ? 1 : 0, 1, 1, (v) => v ? "yes" : "no");
}

Promise.all(pending).then(() => {
  console.log(`\n${pass} passed, ${warn} to look at.`);
  process.exit(warn ? 1 : 0);
});
