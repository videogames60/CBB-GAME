/* =====================================================================
   HOOPS DYNASTY — RECORDS (the league's and every school's)

   SINGLE GAME     points, rebounds, assists, steals, blocks, threes
                   (checked as every game is played)
   SINGLE SEASON   the same six as totals, plus points / rebounds /
                   assists per game (60% of his team's games to qualify)
                   (checked at the end of each season)
   CAREER          top-10 lists in the league, top-5 at each school:
                   points, rebounds, assists, steals, blocks, threes,
                   from finished careers (checked when a player leaves).
                   A school's list counts only what he did there.
   TEAM            most wins in a season, best record, most points in a
                   game, biggest win, longest winning streak.

   A record is { v, n: name, t: teamId, y: year, x: detail }. Records
   start when the dynasty does. From the second season on, a new league
   record or a new record at your school makes the news.

   Kept in lg.records = { league: {...}, schools: { teamId: {...} } }.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");

  const CFG = {
    game: ["pts", "reb", "ast", "stl", "blk", "tpm"],
    season: ["pts", "reb", "ast", "stl", "blk", "tpm"],
    avg: ["ppg", "rpg", "apg"],
    career: ["pts", "reb", "ast", "stl", "blk", "tpm"],
    careerTop: { league: 10, school: 5 },
    minGames: 0.6,
  };
  const LABEL = { pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals", blk: "Blocks", tpm: "Threes", ppg: "Points per game", rpg: "Rebounds per game", apg: "Assists per game",
    wins: "Wins in a season", winPct: "Best record", teamPts: "Points in a game", margin: "Biggest win", streak: "Winning streak" };

  const blank = () => ({ game: {}, season: {}, career: {}, team: {} });
  function ensure(lg) {
    if (!lg.records) lg.records = { league: blank(), schools: {} };
    return lg.records;
  }
  const school = (lg, teamId) => { const R = ensure(lg); return R.schools[teamId] || (R.schools[teamId] = blank()); };
  const news = (season, line) => { if (season) (season.news = season.news || []).push(line); };
  const announce = (lg) => lg.startYear != null && lg.season > lg.startYear;   // the first season sets everything: no news

  /* set rec[key] if v beats it; returns true when it was beaten (not just set for the first time) */
  function beat(book, key, v, entry) {
    const cur = book[key];
    if (cur && v <= cur.v) return null;
    book[key] = { v, ...entry };
    return cur ? "beat" : "set";
  }

  /* ---------------- every game ---------------- */
  /* row: the player's box line; team/opp: schools; season: for the news */
  function onPlayerGame(lg, season, team, opp, row, p) {
    const vals = { pts: row.pts || 0, reb: (row.oreb || 0) + (row.dreb || 0), ast: row.ast || 0, stl: row.stl || 0, blk: row.blk || 0, tpm: row.tpm || 0 };
    const L = ensure(lg).league.game, S = school(lg, team.id).game;
    for (const k of CFG.game) {
      const v = vals[k]; if (!v) continue;
      const e = { n: p.name, t: team.id, y: lg.season, x: opp.abbr };
      const l = beat(L, k, v, e);
      const s = beat(S, k, v, e);
      if (announce(lg)) {
        if (l === "beat") news(season, `New league record: ${p.name} (${team.abbr}) had ${v} ${LABEL[k].toLowerCase()} against ${opp.name}.`);
        else if (s === "beat" && team.isUser) news(season, `New school record: ${p.name} had ${v} ${LABEL[k].toLowerCase()} against ${opp.name}.`);
      }
    }
  }
  function onTeamGame(lg, season, team, opp, pf, pa) {
    const e = { n: team.name, t: team.id, y: lg.season, x: `${pf}-${pa} vs ${opp.abbr}` };
    for (const book of [ensure(lg).league.team, school(lg, team.id).team]) {
      beat(book, "teamPts", pf, e);
      if (pf > pa) beat(book, "margin", pf - pa, e);
    }
  }

  /* ---------------- end of the season (before the offseason clears it) ---------------- */
  function seasonEnd(lg, season) {
    const Season = req ? require("./season.js") : root.Season;
    const L = ensure(lg).league;
    for (const t of lg.teams) {
      const S = school(lg, t.id), games = t.record.w + t.record.l;
      // team
      const rec = `${t.record.w}-${t.record.l}`;
      for (const book of [L.team, S.team]) {
        beat(book, "wins", t.record.w, { n: t.name, t: t.id, y: lg.season, x: rec });
        if (games >= 10) beat(book, "winPct", +(t.record.w / games).toFixed(3), { n: t.name, t: t.id, y: lg.season, x: rec });
        if (t.record.best) beat(book, "streak", t.record.best, { n: t.name, t: t.id, y: lg.season, x: rec });
      }
      // players
      for (const p of t.players) {
        const s = p.season; if (!s || !s.gp) continue;
        const tot = { pts: s.pts, reb: s.oreb + s.dreb, ast: s.ast, stl: s.stl, blk: s.blk, tpm: s.tpm };
        const e = { n: p.name, t: t.id, y: lg.season };
        for (const k of CFG.season) if (tot[k]) for (const book of [L.season, S.season]) beat(book, k, tot[k], { ...e, x: `${s.gp} games` });
        if (s.gp >= CFG.minGames * games) {
          const g = Season.perGame(p);
          for (const k of CFG.avg) for (const book of [L.season, S.season]) beat(book, k, g[k], { ...e, x: `${s.gp} games` });
        }
      }
    }
  }

  /* ---------------- a finished career (when he leaves) ---------------- */
  function insertTop(list, n, entry) {
    if (list.length >= n && entry.v <= list[list.length - 1].v) return list;
    list.push(entry); list.sort((a, b) => b.v - a.v);
    if (list.length > n) list.length = n;
    return list;
  }
  function careerEnd(lg, p, team) {
    const L = ensure(lg).league.career, car = p.career || {};
    const tot = { pts: car.pts || 0, reb: (car.oreb || 0) + (car.dreb || 0), ast: car.ast || 0, stl: car.stl || 0, blk: car.blk || 0, tpm: car.tpm || 0 };
    const H = p.history || [];
    const spanOf = (a, b) => a === b ? `${a}-${String(a + 1).slice(2)}` : `${a}–${String(b + 1).slice(2)}`;   // "2031-32" or "2028–32"
    const span = H.length ? spanOf(H[0].year, H[H.length - 1].year) : "";
    for (const k of CFG.career) if (tot[k]) L[k] = insertTop(L[k] || [], CFG.careerTop.league, { v: tot[k], n: p.name, t: team.id, y: lg.season, x: span });
    // each school he played for: only his seasons there (rebuilt from his per-game lines)
    const byAbbr = {};
    for (const h of H) (byAbbr[h.team] = byAbbr[h.team] || []).push(h);
    for (const abbr in byAbbr) {
      const sch = lg.teams.find(x => x.abbr === abbr); if (!sch) continue;
      const hs = byAbbr[abbr], gp = (h) => h.gp || 0;
      const there = { pts: hs.reduce((a, h) => a + h.ppg * gp(h), 0), reb: hs.reduce((a, h) => a + h.rpg * gp(h), 0), ast: hs.reduce((a, h) => a + h.apg * gp(h), 0),
        stl: hs.reduce((a, h) => a + (h.spg || 0) * gp(h), 0), blk: hs.reduce((a, h) => a + (h.bpg || 0) * gp(h), 0) };
      if (hs.length === H.length) Object.assign(there, { pts: tot.pts, reb: tot.reb, ast: tot.ast, stl: tot.stl, blk: tot.blk, tpm: tot.tpm });   // all his seasons were here: exact totals
      const S = school(lg, sch.id).career, span2 = spanOf(hs[0].year, hs[hs.length - 1].year);
      for (const k of CFG.career) { const v = Math.round(there[k] || 0); if (v) S[k] = insertTop(S[k] || [], CFG.careerTop.school, { v, n: p.name, t: sch.id, y: lg.season, x: span2 }); }
    }
  }

  const Records = { CFG, LABEL, ensure, school, onPlayerGame, onTeamGame, seasonEnd, careerEnd };
  if (typeof module !== "undefined") module.exports = Records;
  else root.Records = Records;
})(typeof window !== "undefined" ? window : globalThis);
