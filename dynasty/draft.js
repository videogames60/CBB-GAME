/* =====================================================================
   HOOPS DYNASTY — THE DRAFT
   Two rounds, 60 picks, every offseason before roster decisions.

   DRAFT STOCK = overall + 0.45 × upside (potential above overall)
                 + youth (FR +4, SO +2.5, JR +1, SR 0) + scouts' noise
   The noise is fixed for a player for the year, so the mock draft is
   steady, plus a little extra on draft day.

   THE FIELD is your league's players plus prospects from outside it
   (international, G League and the like): they're placeholders that take
   draft slots, so not every pick comes from your league. About 40 of the
   60 picks go to league players in a 352-team league (two-thirds, like
   the real draft), scaled down for a smaller league (about 8 in the
   74-team one), give or take a few each year. The outside prospects'
   stock is spread like the league players', so now and then one goes top 5.

   WHO'S IN:
   • seniors: all of them (the undrafted just graduate)
   • underclassmen, decided at season's end (before development):
       projected 1st round (pick ≤ 30)  → declare
       projected 31–60                  → test the waters
     On draft day (after development), a tester still projected in the
     top 40 stays in; the rest withdraw and come back to school.
     A declared player who isn't drafted is gone anyway.

   AFTER: every pick is kept in the draft history. A school's recent picks
   build its DRAFT REPUTATION, which adds to its development pitch in
   recruiting, and each pick adds a little prestige.

   Every number lives in CFG.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const League = req ? require("./league.js") : root.League;
  const awardsModule = () => req ? require("./awards.js") : root.Awards;

  const CFG = {
    picks: 60, perRound: 30,
    leaguePicks: 40,              // league players drafted in a 352-team league (scaled by league size) ...
    refTeams: 352,
    minLeaguePicks: 6, maxLeaguePicks: 54,
    yearSwing: 0.15,              // ... ± this share from year to year
    upsideWeight: 0.45,
    youth: { FR: 4, SO: 2.5, JR: 1, SR: 0 },
    noise: 3,                     // scouts disagree (fixed for the year)
    draftDayNoise: 1.5,           // a little more on draft day
    declareBy: 30,                // projected pick to declare
    testUpTo: 60,                 // projected pick to test the waters
    stayIfBy: 40,                 // a tester stays in the draft if projected this high on draft day
    reputation: { first: 1, second: 0.5, fade: 0.8, years: 5, full: 3, devBonus: 0.35 },   // dev pitch: + devBonus × min(1, rep / full)
    prestige: { first: 0.3, second: 0.15, cap: 0.75 },   // per pick, capped per school per year
    outside: {
      first: ["Luka", "Nikola", "Mateo", "Victor", "Killian", "Ousmane", "Moussa", "Bogdan", "Dario", "Franz", "Rui", "Yuki", "Alperen", "Tidjane", "Zaccharie", "Josh", "Bennedict", "Isaac", "Tomas", "Andrej", "Kenji", "Amari", "Jamal", "Leonel", "Sasha"],
      last: ["Petrovic", "Diallo", "Okeke", "Marjanovic", "Sarr", "Fernandez", "Coulibaly", "Hachimura", "Bitadze", "Wagner", "Salaun", "Risacher", "Giddey", "Kalkbrenner", "Vukcevic", "Ndiaye", "Moreau", "Novak", "Kovac", "Tshibangu", "Lindqvist", "Akinola", "Bianchi", "Doumbia", "Ivanov"],
      from: ["France", "Serbia", "Spain", "Australia", "G League", "Germany", "Lithuania", "Nigeria", "Japan", "Canada (prep)", "Overtime Elite", "Turkey", "Slovenia", "Senegal", "Italy"],
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function h01(...parts) { let h = 2166136261; for (const c of parts.join("|")) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; }

  /* a player's stock this year (dayNoise: draft day) */
  function stock(p, year, dayNoise = false) {
    const ovr = League.ovrOf(p);
    let s = ovr + CFG.upsideWeight * Math.max(0, p.potential - ovr) + (CFG.youth[p.class] ?? 0) + (h01(p.id, year, "stock") * 2 - 1) * CFG.noise;
    if (dayNoise) s += (h01(p.id, year, "day") * 2 - 1) * CFG.draftDayNoise;
    return s;
  }
  /* how many league players go this year */
  function leaguePicks(lg, year) {
    const base = CFG.leaguePicks * lg.teams.length / CFG.refTeams;
    const n = Math.round(base * (1 - CFG.yearSwing + 2 * CFG.yearSwing * h01(lg.seed, year, "picks")));
    return clamp(n, CFG.minLeaguePicks, Math.min(CFG.maxLeaguePicks, CFG.picks));
  }
  /* the outside prospects this year: their stock spread like the league players who'd be picked */
  function outsiders(lg, year, leagueScores) {
    const n = CFG.picks - leaguePicks(lg, year), O = CFG.outside, top = leagueScores.slice(0, leaguePicks(lg, year));
    const out = [];
    for (let i = 0; i < n; i++) {
      const q = h01(lg.seed, year, "out", i), idx = Math.min(top.length - 1, Math.floor(q * top.length));
      const s = (top.length ? top[idx] : 80) + (h01(lg.seed, year, "outn", i) * 2 - 1) * 1.5;
      const pos = ["PG", "SG", "SF", "PF", "C"][Math.floor(h01(lg.seed, year, "pos", i) * 5)];
      out.push({ outside: true, id: `X${year}-${i}`, name: `${O.first[Math.floor(h01(lg.seed, year, "f", i) * O.first.length)]} ${O.last[Math.floor(h01(lg.seed, year, "l", i) * O.last.length)]}`,
        from: O.from[Math.floor(h01(lg.seed, year, "o", i) * O.from.length)], pos, score: s });
    }
    return out;
  }
  /* every league player who could be in this year's draft, best stock first */
  function leaguePool(lg, year, { day = false, filter = null } = {}) {
    const rows = [];
    for (const t of lg.teams) for (const p of t.players) {
      if (filter && !filter(p, t)) continue;
      rows.push({ p, t, score: stock(p, year, day) });
    }
    return rows.sort((a, b) => b.score - a.score);
  }
  /* a board of 60: league players and outside prospects by stock */
  function board(lg, year, pool) {
    const field = [...pool.map(r => ({ ...r, outside: false })), ...outsiders(lg, year, pool.map(r => r.score))];
    field.sort((a, b) => b.score - a.score);
    return field.slice(0, CFG.picks).map((x, i) => ({ ...x, pick: i + 1, round: i < CFG.perRound ? 1 : 2 }));
  }
  /* the MOCK DRAFT: everyone available as of today (seniors who'll graduate, and
     every underclassman as if he came out), with each underclassman's outlook */
  function mock(lg, year) {
    const pool = leaguePool(lg, year, { filter: (p) => !(p.class === "SR" && p.redshirt) });
    const b = board(lg, year, pool);
    for (const x of b) if (!x.outside) x.outlook = x.p.class === "SR" ? "senior" : x.pick <= CFG.declareBy ? "declare" : "testing";
    return b;
  }
  /* where a player sits on the mock board (null = not in the top 60) */
  function projection(lg, year, playerId) { const x = mock(lg, year).find(r => !r.outside && r.p.id === playerId); return x ? x.pick : null; }

  /* season's end (before development): underclassmen decide */
  function declare(lg, year) {
    const m = mock(lg, year), out = { declared: [], testing: [] };
    for (const x of m) {
      if (x.outside || x.p.class === "SR") continue;
      if (x.pick <= CFG.declareBy) { x.p.draftStatus = "declared"; out.declared.push(x.p.id); }
      else if (x.pick <= CFG.testUpTo) { x.p.draftStatus = "testing"; out.testing.push(x.p.id); }
    }
    return out;
  }

  /* draft day (after development): testers decide, then 60 picks.
     Returns { picks, byTeam: teamId → { drafted, withdrew, gone } } and
     removes the drafted (and declared-but-undrafted) from their teams. */
  function run(lg, year) {
    const graduating = (p) => p.class === "SR" && !p.redshirt;
    // testers: in if still projected high enough today
    const everyone = leaguePool(lg, year, { day: true, filter: (p) => graduating(p) || p.draftStatus });
    const asIfAll = board(lg, year, everyone);
    const withdrew = new Set();
    for (const x of asIfAll) if (!x.outside && x.p.draftStatus === "testing" && x.pick > CFG.stayIfBy) withdrew.add(x.p.id);
    for (const r of everyone) if (r.p.draftStatus === "testing" && !asIfAll.some(x => !x.outside && x.p.id === r.p.id)) withdrew.add(r.p.id);
    const pool = everyone.filter(r => !withdrew.has(r.p.id));
    const picks = board(lg, year, pool);
    const pickOf = new Map(picks.filter(x => !x.outside).map(x => [x.p.id, x]));
    const byTeam = {};
    for (const t of lg.teams) byTeam[t.id] = { drafted: [], withdrew: [], gone: [] };
    const Awards = awardsModule();
    for (const t of lg.teams) {
      t.players = t.players.filter(p => {
        const x = pickOf.get(p.id);
        if (x) { byTeam[t.id].drafted.push(snap(p, x)); if (Awards) Awards.archive(lg, p, t, "drafted", { year, pick: x.pick, round: x.round }); return false; }
        if (withdrew.has(p.id)) { byTeam[t.id].withdrew.push(snap(p)); delete p.draftStatus; return true; }
        if (p.draftStatus === "declared") { byTeam[t.id].gone.push(snap(p)); if (Awards) Awards.archive(lg, p, t, "declared"); return false; }   // declared, not picked: gone anyway
        return true;
      });
    }
    // history, reputation, prestige
    const entry = { year, picks: picks.map(x => x.outside
      ? { pick: x.pick, round: x.round, name: x.name, pos: x.pos, from: x.from, outside: true }
      : { pick: x.pick, round: x.round, name: x.p.name, pos: x.p.pos, class: League.classLabel(x.p), ovr: League.ovrOf(x.p), potential: x.p.potential, team: x.t.id }) };
    lg.draftHistory = lg.draftHistory || [];
    lg.draftHistory.push(entry);
    const prestige = {};
    for (const t of lg.teams) {
      t.draftRep = reputation(lg, t.id);
      const mine = entry.picks.filter(x => x.team === t.id);
      const bump = Math.min(CFG.prestige.cap, mine.reduce((s, x) => s + (x.round === 1 ? CFG.prestige.first : CFG.prestige.second), 0));
      if (bump > 0) { t.prestige = clamp(+(t.prestige + bump).toFixed(1), 20, 99); prestige[t.id] = bump; }
    }
    return { picks: entry.picks, byTeam, prestige, leaguePicks: picks.filter(x => !x.outside).length };
  }
  const snap = (p, x) => ({ id: p.id, name: p.name, pos: p.pos, class: League.classLabel(p), early: p.class !== "SR", ovr: League.ovrOf(p), potential: p.potential, salary: p.salary || 0,
    ...(x ? { pick: x.pick, round: x.round } : {}) });

  /* recent picks, newer ones counting more */
  function reputation(lg, teamId) {
    const R = CFG.reputation, H = lg.draftHistory || [], now = H.length ? H[H.length - 1].year : 0;
    let rep = 0;
    for (const e of H) {
      const age = now - e.year; if (age >= R.years) continue;
      for (const x of e.picks) if (x.team === teamId) rep += (x.round === 1 ? R.first : R.second) * Math.pow(R.fade, age);
    }
    return +rep.toFixed(2);
  }
  /* what draft reputation adds to the development pitch (0 … devBonus) */
  const devBonus = (team) => CFG.reputation.devBonus * Math.min(1, (team.draftRep || 0) / CFG.reputation.full);
  /* a school's picks, all years */
  function teamPicks(lg, teamId) { return (lg.draftHistory || []).flatMap(e => e.picks.filter(x => x.team === teamId).map(x => ({ year: e.year, ...x }))); }

  const Draft = { CFG, stock, leaguePicks, mock, projection, declare, run, reputation, devBonus, teamPicks };
  if (typeof module !== "undefined") module.exports = Draft;
  else root.Draft = Draft;
})(typeof window !== "undefined" ? window : globalThis);
