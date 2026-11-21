/* =====================================================================
   BALANCE HARNESS
     node harness.js               → 400 games, random teams & styles
     node harness.js 1000 7        → 1000 games, seed 7
     node harness.js 1 5 --box     → one game, print play-by-play + box score
     node harness.js 1 5 --debug   → also print every roll (long!)

   Compares per-team-per-game averages to NCAA D1 men's ballpark targets.
   Change TARGETS if you'd rather balance toward NBA numbers.
   ===================================================================== */
const Engine = require("./sim/engine.js");
const Sample = require("./sim/sample_teams.js");
const TEXT = require("./sim/text.js");

const args = process.argv.slice(2);
const N = parseInt(args[0]) || 400;
const SEED = parseInt(args[1]) || 1;
const SHOW_BOX = args.includes("--box");
const DEBUG = args.includes("--debug");
const PLAYERS = args.includes("--players");
const STYLES = args.includes("--styles");
const ENDGAME = args.includes("--endgame");

/* node harness.js 2000 1 --endgame
   Checks that late-game behaviour looks like basketball: comeback rates from a
   given deficit, how often deliberate fouling happens, and what the last
   possession of a close game actually looks like. */
if (ENDGAME) {
  const T = require("./sim/tuning.js");
  const OFF = Object.keys(T.styles.offense), DEF = Object.keys(T.styles.defense);
  const rand = Engine.makeRng(SEED);
  let games = 0, close = 0, intentional = 0, intentionalGames = 0, ftLate = 0;
  const lastShot = { hold: 0, heldSeconds: [], chase: 0, chaseSeconds: [] };
  const deficit = {};   // "down N with <=60s" -> {n, won}
  const worstShooterHunted = { yes: 0, no: 0 };
  for (let i = 0; i < N; i++) {
    const tm = [0, 1].map(j => Sample.generateTeam(rand, { id: j ? "B" : "A", name: j ? "B" : "A", quality: 62 + Math.floor(rand() * 12),
      coach: { rating: 50 + Math.floor(rand() * 40), offense: OFF[Math.floor(rand() * OFF.length)], defense: DEF[Math.floor(rand() * DEF.length)] } }));
    const g = Engine.createGame(tm[0], tm[1], { seed: SEED * 7919 + i });
    // snapshot the score with a minute left in regulation
    let snap = null, fouls = 0;
    const onEvent = (e, gg) => {
      if (gg.period === 2 && !snap && gg.clock <= 60) snap = [gg.teams[0].score, gg.teams[1].score];
      if (e.type === "foul" && e.kind === "intentional") {
        fouls++;
        const off = gg.teams[1 - e.teamIdx];
        const men = off.onCourt.map(id => gg.byId[id]);
        const worst = men.reduce((a, b) => (b.ratings.mid + b.ratings.three) < (a.ratings.mid + a.ratings.three) ? b : a);
        if (worst.name === e.on) worstShooterHunted.yes++; else worstShooterHunted.no++;
      }
    };
    g.opts.onEvent = onEvent;
    Engine.simulateGame(g);
    games++;
    intentional += fouls; if (fouls) intentionalGames++;
    const final = [g.teams[0].score, g.teams[1].score];
    if (snap) {
      for (const ti of [0, 1]) {
        const d = snap[1 - ti] - snap[ti];
        if (d >= 1 && d <= 12) {
          const k = d;
          const o = deficit[k] || (deficit[k] = { n: 0, won: 0 });
          o.n++; if (final[ti] > final[1 - ti]) o.won++;
        }
      }
      if (Math.abs(snap[0] - snap[1]) <= 5) close++;
    }
    // last shot of regulation, when the game was within 3
    const evs = g.events.filter(e => e.period === 2);
    const shots = evs.filter(e => e.type === "shot");
    const lastSh = shots[shots.length - 1];
    if (lastSh && Math.abs(lastSh.score[0] - lastSh.score[1]) <= 6) {
      const before = lastSh.score[lastSh.teamIdx] - lastSh.pts;
      const opp = lastSh.score[1 - lastSh.teamIdx];
      if (before >= opp) { lastShot.hold++; lastShot.heldSeconds.push(lastSh.clock); }
      else if (opp - before <= 3) { lastShot.chase++; lastShot.chaseSeconds.push(lastSh.clock); }
    }
  }
  const med = (a) => { if (!a.length) return "-"; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  console.log(`${games} games (seed ${SEED}). ${close} were within 5 with a minute to play.\n`);
  console.log("Comeback rate — trailing by N with 1:00 left in regulation:");
  console.log("  down   games   won");
  for (const k of Object.keys(deficit).map(Number).sort((a, b) => a - b)) {
    const o = deficit[k];
    if (o.n < 20) continue;
    console.log(`  ${String(k).padStart(4)} ${String(o.n).padStart(7)} ${(100 * o.won / o.n).toFixed(1).padStart(6)}%`);
  }
  console.log(`\nDeliberate fouls: ${(intentional / games).toFixed(2)} per game, in ${(100 * intentionalGames / games).toFixed(1)}% of games`);
  console.log(`  worst free-throw shooter on the floor was the target ${(100 * worstShooterHunted.yes / Math.max(1, worstShooterHunted.yes + worstShooterHunted.no)).toFixed(0)}% of the time`);
  console.log(`\nLast shot of a close regulation:`);
  console.log(`  tied or leading (hold):  ${lastShot.hold} games, median ${med(lastShot.heldSeconds)}s left`);
  console.log(`  down 1-3 (chase):        ${lastShot.chase} games, median ${med(lastShot.chaseSeconds)}s left`);
  process.exit(0);
}

/* node harness.js 300 1 --styles
   For every style: points per possession with fit forced to its floor, its
   midpoint, and its ceiling, against a Balanced/Man opponent — plus the same
   number for plain Balanced/Man, so you can see what a scheme is worth and
   whether good fit actually beats bad fit. Also prints where real lineups
   land on each style's fit read, so `low`/`high` can be set from data. */
if (STYLES) {
  const T0 = require("./sim/tuning.js");
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const OFFS = Object.keys(T0.styles.offense), DEFS = Object.keys(T0.styles.defense);
  const Q = 68, COACH = 85;
  function series(kind, style, forced) {
    const T = clone(T0);
    const st = T.styles[kind][style];
    if (forced != null && st.fit) st.fit = { keys: ["handle"], mode: "avg", low: 0, high: 1, min: forced, max: forced };
    const rand = Engine.makeRng(SEED);
    let pts = 0, poss = 0, opts = 0, oposs = 0;
    for (let i = 0; i < N; i++) {
      const a = Sample.generateTeam(rand, { id: "A", quality: Q, coach: { rating: COACH, offense: kind === "offense" ? style : "balanced", defense: kind === "defense" ? style : "man" } });
      const b = Sample.generateTeam(rand, { id: "B", quality: Q, coach: { rating: COACH, offense: "balanced", defense: "man" } });
      const g = Engine.createGame(a, b, { seed: SEED * 1000 + i, tuning: T });
      Engine.simulateGame(g);
      const s = Engine.boxScore(g).teams[0].totals, o = Engine.boxScore(g).teams[1].totals;
      pts += s.pts; poss += s.fga - s.oreb + s.tov + 0.475 * s.fta;
      opts += o.pts; oposs += o.fga - o.oreb + o.tov + 0.475 * o.fta;
    }
    return kind === "offense" ? pts / poss : opts / oposs;
  }
  function fitPercentiles(kind, style) {
    const F = T0.styles[kind][style].fit; if (!F) return null;
    const rand = Engine.makeRng(SEED + 1), vals = [];
    for (let i = 0; i < 400; i++) {
      const t = Sample.generateTeam(rand, { id: "X", quality: 55 + Math.floor(rand() * 26) });
      const g = Engine.createGame(t, Sample.generateTeam(rand, { id: "Y", quality: 65 }), { seed: i });
      if (kind === "offense" && style === "iso") { /* target mode reads the auto-picked star */ }
      vals.push(Engine.styleFit(g, 0)[kind].value);
    }
    // styleFit reads the team's CURRENT style, so re-run with the style set
    return vals;
  }
  const base = { offense: series("offense", "balanced", null), defense: series("defense", "man", null) };
  console.log(`${N} games per cell, quality ${Q}, coach ${COACH}, opponent Balanced/Man (seed ${SEED})\n`);
  for (const kind of ["offense", "defense"]) {
    const list = kind === "offense" ? OFFS : DEFS;
    const label = kind === "offense" ? "PPP scored" : "PPP allowed (lower is better)";
    console.log(`${kind.toUpperCase()} — ${label}. Baseline ${kind === "offense" ? "Balanced" : "Man"} at natural fit: ${base[kind].toFixed(3)}`);
    console.log("style             fit=min   fit=mid   fit=max   natural   min→max   reads");
    for (const s of list) {
      const st = T0.styles[kind][s], F = st.fit;
      const nat = series(kind, s, null);
      if (!F) { console.log(`${s.padEnd(17)}     —         —         —     ${nat.toFixed(3)}      —      (no fit)`); continue; }
      const lo = series(kind, s, F.min), mid = series(kind, s, (F.min + F.max) / 2), hi = series(kind, s, F.max);
      const spread = kind === "offense" ? hi - lo : lo - hi;
      console.log(`${s.padEnd(17)} ${lo.toFixed(3).padStart(7)}   ${mid.toFixed(3).padStart(7)}   ${hi.toFixed(3).padStart(7)}   ${nat.toFixed(3).padStart(7)}   ${(spread >= 0 ? "+" : "") + spread.toFixed(3)}   ${F.keys.join("+")}${F.mode !== "avg" ? " (" + F.mode + ")" : ""} [${F.low}–${F.high}]`);
    }
    console.log();
  }
  // where do real lineups land on each fit read?
  console.log("FIT READ PERCENTILES across quality 55–80 rosters (starting five, rested):");
  console.log("style             p10   p25   p50   p75   p90   current low–high");
  for (const kind of ["offense", "defense"]) for (const s of (kind === "offense" ? OFFS : DEFS)) {
    const F = T0.styles[kind][s].fit; if (!F) continue;
    const rand = Engine.makeRng(SEED + 2), vals = [];
    for (let i = 0; i < 400; i++) {
      const coach = kind === "offense" ? { offense: s } : { defense: s };
      const t = Sample.generateTeam(rand, { id: "X", quality: 55 + Math.floor(rand() * 26), coach });
      const g = Engine.createGame(t, Sample.generateTeam(rand, { id: "Y", quality: 65 }), { seed: i });
      vals.push(Engine.styleFit(g, 0)[kind].value);
    }
    vals.sort((a, b) => a - b);
    const p = (q) => vals[Math.floor(vals.length * q)];
    console.log(`${s.padEnd(17)} ${String(p(0.1)).padStart(4)}  ${String(p(0.25)).padStart(4)}  ${String(p(0.5)).padStart(4)}  ${String(p(0.75)).padStart(4)}  ${String(p(0.9)).padStart(4)}   ${F.low}–${F.high}`);
  }
  process.exit(0);
}

/* node harness.js 10000 1 --players  → rating distributions from the generator, no games */
if (PLAYERS) {
  const rand = Engine.makeRng(SEED), T = require("./sim/tuning.js");
  const Q = parseInt(args[3]) || 65, KEYS = [...Engine.RATING_KEYS, "stamina"];
  const dist = {}, arch = {}, wild = {}, ht = {}, ovrs = [];
  KEYS.forEach(k => dist[k] = { sum: 0, n: 0, hi90: 0, hi95: 0, max: 0, lo40: 0, min: 99 });
  for (let i = 0; i < N; i++) {
    const team = Sample.generateTeam(rand, { id: "X", quality: Q });
    for (const p of team.players) {
      for (const k of KEYS) { const d = dist[k], v = p.ratings[k]; d.sum += v; d.n++; if (v >= 90) d.hi90++; if (v >= 95) d.hi95++; if (v <= 40) d.lo40++; d.max = Math.max(d.max, v); d.min = Math.min(d.min, v); }
      arch[p.pos + " " + p.archetype] = (arch[p.pos + " " + p.archetype] || 0) + 1;
      if (p.wildcard) wild[p.wildcard] = (wild[p.wildcard] || 0) + 1;
      const hk = p.pos; ht[hk] = ht[hk] || []; ht[hk].push(p.height);
      ovrs.push(Engine.overall(T, p.pos, p.ratings));
    }
  }
  const total = N * 10;
  console.log(`${total} players generated at quality ${Q} (seed ${SEED})\n`);
  console.log("Rating   mean   >=90   >=95   max   <=40   min");
  for (const k of KEYS) { const d = dist[k]; console.log(`${k.padEnd(8)} ${(d.sum / d.n).toFixed(1).padStart(5)} ${(100 * d.hi90 / d.n).toFixed(1).padStart(5)}% ${(100 * d.hi95 / d.n).toFixed(1).padStart(5)}%   ${String(d.max).padStart(3)} ${(100 * d.lo40 / d.n).toFixed(1).padStart(5)}%   ${String(d.min).padStart(3)}`); }
  ovrs.sort((a, b) => b - a);
  const pct = (p) => ovrs[Math.floor(ovrs.length * p)];
  console.log(`\nOVR: max ${ovrs[0]}, top 1% ${pct(0.01)}, median ${pct(0.5)}, bottom 10% ${pct(0.9)}, min ${ovrs[ovrs.length - 1]}; ${ovrs.filter(o => o >= 90).length} players 90+, ${ovrs.filter(o => o >= 95).length} at 95+`);
  console.log("\nHeight by position (mean, min, max):");
  for (const pos of Engine.POS_ORDER) { const a = ht[pos]; const f = (v) => Math.floor(v / 12) + "'" + (v % 12); console.log(`  ${pos}  ${f(Math.round(a.reduce((s, v) => s + v, 0) / a.length))}  ${f(Math.min(...a))}  ${f(Math.max(...a))}`); }
  console.log("\nArchetype frequency:");
  for (const k of Object.keys(arch).sort()) console.log(`  ${k.padEnd(24)} ${(100 * arch[k] / total).toFixed(1)}%`);
  console.log("\nWildcards:", Object.entries(wild).map(([k, v]) => `${k} ${(100 * v / total).toFixed(1)}%`).join(", "));
  process.exit(0);
}

const TARGETS = { // per team per game, NCAA D1 men ~2024
  pts: 73, poss: 68, fga: 56, fgPct: 0.445, tpa: 23, tpPct: 0.34, twoPct: 0.51,
  fta: 19, ftPct: 0.72, oreb: 9.5, orebPct: 0.29, ast: 13.5, tov: 11.5, stl: 6.5, blk: 3.3, pf: 17,
};

const OFF = Object.keys(require("./sim/tuning.js").styles.offense);
const DEF = Object.keys(require("./sim/tuning.js").styles.defense);

const rand = Engine.makeRng(SEED);
const acc = {}, byStyle = {};
const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };
let games = 0, ots = 0, maxPts = 0, minPts = 999, starterMin = 0, starterCount = 0, topScorer = 0;

for (let i = 0; i < N; i++) {
  const teams = [0, 1].map(j => Sample.generateTeam(rand, {
    id: j ? "B" : "A", name: j ? "Visitors" : "Home", quality: 58 + Math.floor(rand() * 21),
    coach: { rating: 40 + Math.floor(rand() * 60), offense: OFF[Math.floor(rand() * OFF.length)], defense: DEF[Math.floor(rand() * DEF.length)] },
  }));
  const g = Engine.createGame(teams[0], teams[1], { seed: SEED * 100000 + i, debug: DEBUG });
  Engine.simulateGame(g);
  const box = Engine.boxScore(g);
  if (box.periods > 2) ots++;
  games++;
  box.teams.forEach((t, ti) => {
    const s = t.totals;
    const opp = box.teams[1 - ti].totals;
    const row = { pts: s.pts, fga: s.fga, fgm: s.fgm, tpa: s.tpa, tpm: s.tpm, fta: s.fta, ftm: s.ftm, oreb: s.oreb, dreb: s.dreb, ast: s.ast, tov: s.tov, stl: s.stl, blk: s.blk, pf: s.pf,
      poss: s.fga - s.oreb + s.tov + 0.475 * s.fta, oppDreb: opp.dreb };
    for (const k in row) add(acc, k, row[k]);
    const st = byStyle[t.coach.offense] || (byStyle[t.coach.offense] = { n: 0 });
    st.n++; for (const k in row) add(st, k, row[k]);
    maxPts = Math.max(maxPts, s.pts); minPts = Math.min(minPts, s.pts);
    t.players.forEach(p => { topScorer = Math.max(topScorer, p.pts); });
    g.teams[ti].players.filter(p => p.starter).forEach(p => { starterMin += p.stats.sec / 60; starterCount++; });
  });
  if (SHOW_BOX) printGame(g, box);
}

function printGame(g, box) {
  console.log("\n=== PLAY-BY-PLAY ===");
  for (const e of g.events) {
    const line = TEXT.describe(e);
    if (line) console.log(`${TEXT.clock(e)}  ${line}`);
  }
  if (DEBUG) { console.log("\n=== ROLLS ==="); g.debug.forEach(l => console.log(l)); }
  console.log(`\n=== FINAL: ${box.teams[0].name} ${box.score[0]} - ${box.score[1]} ${box.teams[1].name} (${box.periods > 2 ? (box.periods - 2) + "OT" : "reg"}) ===`);
  for (const t of box.teams) {
    console.log(`\n${t.name}  (${t.coach.offense} / ${t.coach.defense}, coach ${t.coach.rating})`);
    console.log("Player                Pos OVR MIN PTS  FG     3P     FT    OR DR AST STL BLK TO PF");
    for (const p of t.players) {
      console.log(`${p.name.padEnd(21)} ${p.pos.padEnd(3)} ${String(p.ovr).padStart(3)} ${String(p.min).padStart(3)} ${String(p.pts).padStart(3)}  ${(p.fgm + "-" + p.fga).padEnd(6)} ${(p.tpm + "-" + p.tpa).padEnd(6)} ${(p.ftm + "-" + p.fta).padEnd(5)} ${String(p.oreb).padStart(2)} ${String(p.dreb).padStart(2)} ${String(p.ast).padStart(3)} ${String(p.stl).padStart(3)} ${String(p.blk).padStart(3)} ${String(p.tov).padStart(2)} ${String(p.pf).padStart(2)}`);
    }
    const s = t.totals;
    console.log(`TOTAL: ${s.pts} pts, FG ${s.fgm}-${s.fga}, 3P ${s.tpm}-${s.tpa}, FT ${s.ftm}-${s.fta}, OR ${s.oreb} DR ${s.dreb}, AST ${s.ast}, TO ${s.tov}, STL ${s.stl}, BLK ${s.blk}, PF ${s.pf}`);
  }
}

const n = games * 2;
const avg = (k) => acc[k] / n;
const rows = [
  ["Points", avg("pts"), TARGETS.pts],
  ["Possessions", avg("poss"), TARGETS.poss],
  ["FGA", avg("fga"), TARGETS.fga],
  ["FG%", acc.fgm / acc.fga, TARGETS.fgPct],
  ["3PA", avg("tpa"), TARGETS.tpa],
  ["3P%", acc.tpm / acc.tpa, TARGETS.tpPct],
  ["2P%", (acc.fgm - acc.tpm) / (acc.fga - acc.tpa), TARGETS.twoPct],
  ["FTA", avg("fta"), TARGETS.fta],
  ["FT%", acc.ftm / acc.fta, TARGETS.ftPct],
  ["OREB", avg("oreb"), TARGETS.oreb],
  ["OREB%", acc.oreb / (acc.oreb + acc.oppDreb), TARGETS.orebPct],
  ["Assists", avg("ast"), TARGETS.ast],
  ["Turnovers", avg("tov"), TARGETS.tov],
  ["Steals", avg("stl"), TARGETS.stl],
  ["Blocks", avg("blk"), TARGETS.blk],
  ["Fouls", avg("pf"), TARGETS.pf],
];
console.log(`\n${games} games (seed ${SEED}), ${ots} went to OT. Per team per game:`);
console.log("Stat          Sim     Target  Diff");
for (const [name, v, t] of rows) {
  const pct = t < 1;
  const f = (x) => pct ? (100 * x).toFixed(1) + "%" : x.toFixed(1);
  const d = pct ? ((v - t) * 100).toFixed(1) + "pp" : (v - t).toFixed(1);
  console.log(`${name.padEnd(13)} ${f(v).padStart(7)} ${f(t).padStart(8)}  ${d}`);
}
console.log(`\nStarter minutes avg ${(starterMin / starterCount).toFixed(1)}, team pts range ${minPts}-${maxPts}, best single-game scorer ${topScorer}`);

console.log("\nBy offensive playstyle (per team per game):");
console.log("Style           n    PTS   FGA  3PA  2P%   3P%   AST   TOV  Poss");
for (const k of Object.keys(byStyle)) {
  const s = byStyle[k], m = s.n;
  console.log(`${k.padEnd(14)} ${String(m).padStart(4)} ${(s.pts / m).toFixed(1).padStart(6)} ${(s.fga / m).toFixed(1).padStart(5)} ${(s.tpa / m).toFixed(1).padStart(4)} ${(100 * (s.fgm - s.tpm) / (s.fga - s.tpa)).toFixed(1).padStart(5)} ${(100 * s.tpm / s.tpa).toFixed(1).padStart(5)} ${(s.ast / m).toFixed(1).padStart(5)} ${(s.tov / m).toFixed(1).padStart(5)} ${(s.poss / m).toFixed(1).padStart(5)}`);
}
