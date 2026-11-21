/* =====================================================================
   HOOPS DYNASTY — AWARDS, THE PLAYER ARCHIVE, SERIES RECORDS

   AWARDS. On Selection Sunday (the conference tournaments are done):
     national    Player of the Year, Defensive POY, Freshman of the Year,
                 Sixth Man, Most Improved, Coach of the Year,
                 All-American 1st / 2nd / 3rd teams (five each)
     each conf.  Player of the Year, Freshman of the Year, Coach of the
                 Year, All-Conference 1st / 2nd teams, tournament MVP
   After the title game: the national tournament's Most Outstanding Player.

   HOW PLAYERS ARE JUDGED. A per-game production score
       pts + 0.9 reb + 1.3 ast + 1.8 stl + 1.6 blk
           − 0.8 missed FG − 0.45 missed FT − 1.3 turnovers
   times team success (a .750 team's player × 1.125, a .250 team's × 0.875).
   He needs 60% of his team's games and 12+ minutes a game. Defense:
   steals, blocks, defensive rebounds and his two defensive ratings.
   Sixth Man: started at most 35% of his games. Most Improved: the biggest
   jump in production over last season. Coach of the Year: the record most
   above what the program's prestige expects (the hot-seat bar), plus a
   conference title. Tournament awards use only those games.

   Winners are kept in lg.awards[year] (conference awards for the last 10
   years; national ones forever) and on each player (p.awards) and coach.

   THE ARCHIVE. A player who leaves (graduates, is drafted, or declared
   and went undrafted) is kept in lg.archive if he won anything beyond
   2nd-team all-conference, was drafted, or scored 1,200+ points: his seasons, totals, awards and draft pick.
   Records and the Hall of Fame (next) read from it.

   SERIES. Every pair of schools that has played keeps an all-time record
   (lg.series).
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const League = req ? require("./league.js") : root.League;
  const offseasonModule = () => req ? require("./offseason.js") : root.Offseason;
  const coachesModule = () => req ? require("./coaches.js") : root.Coaches;

  const CFG = {
    eff: { pts: 1, reb: 0.9, ast: 1.3, stl: 1.8, blk: 1.6, miss: 0.8, ftMiss: 0.45, tov: 1.3 },
    team: 0.5,                 // × (1 + team × (win% − .5))
    minGames: 0.6, minMpg: 12,
    def: { stl: 2.0, blk: 1.8, dreb: 0.3, rating: 0.08 },
    sixthMaxStart: 0.35,
    mip: { minPrevGp: 10, minMpg: 15 },
    coy: { confTitle: 6 },
    allTeams: 3, perTeam: 5, confTeams: 2,
    keepConfYears: 10,
    archive: { minCareerPts: 1200 },
  };
  /* award codes → names (players: p.awards = [{ y, k }], coaches: c.awards) */
  const NAMES = {
    POY: "Player of the Year", DPOY: "Defensive Player of the Year", FOY: "Freshman of the Year",
    SIX: "Sixth Man of the Year", MIP: "Most Improved Player", COY: "Coach of the Year", BRK: "Breakout candidate",
    AA1: "All-American (1st team)", AA2: "All-American (2nd team)", AA3: "All-American (3rd team)",
    MOP: "Tournament Most Outstanding Player",
    CPOY: "Conference Player of the Year", CFOY: "Conference Freshman of the Year", CCOY: "Conference Coach of the Year",
    AC1: "All-Conference (1st team)", AC2: "All-Conference (2nd team)", CTMVP: "Conference Tournament MVP",
  };
  const SHORT = { POY: "POY", DPOY: "DPOY", FOY: "FOY", SIX: "6MOY", MIP: "MIP", COY: "COY", AA1: "1st-team All-American", AA2: "2nd-team All-American", AA3: "3rd-team All-American",
    MOP: "Final Four MOP", CPOY: "Conf. POY", CFOY: "Conf. FOY", CCOY: "Conf. COY", AC1: "1st-team All-Conf.", AC2: "2nd-team All-Conf.", CTMVP: "Conf. tourney MVP" };

  /* ---------------- scoring ---------------- */
  const reb = (s) => (s.oreb || 0) + (s.dreb || 0);
  function effTotal(s) {
    const E = CFG.eff;
    return (s.pts || 0) * E.pts + reb(s) * E.reb + (s.ast || 0) * E.ast + (s.stl || 0) * E.stl + (s.blk || 0) * E.blk
      - ((s.fga || 0) - (s.fgm || 0)) * E.miss - ((s.fta || 0) - (s.ftm || 0)) * E.ftMiss - (s.tov || 0) * E.tov;
  }
  const winPct = (t) => { const g = t.record.w + t.record.l; return g ? t.record.w / g : 0.5; };
  const teamMult = (t) => 1 + CFG.team * (winPct(t) - 0.5);
  function eligible(p, t) {
    const s = p.season, games = t.games || (t.record.w + t.record.l);
    return s.gp >= Math.max(1, CFG.minGames * games) && s.sec / 60 / Math.max(1, s.gp) >= CFG.minMpg;
  }
  const playerScore = (p, t) => effTotal(p.season) / Math.max(1, p.season.gp) * teamMult(t);
  function defScore(p, t) {
    const s = p.season, gp = Math.max(1, s.gp), D = CFG.def;
    return ((s.stl || 0) * D.stl + (s.blk || 0) * D.blk + (s.dreb || 0) * D.dreb) / gp
      + (((p.ratings.perDef || 50) + (p.ratings.intDef || 50)) / 2 - 50) * D.rating;
  }
  /* last season's production (from his history line) vs this season's */
  const prodOf = (pg) => (pg.ppg || 0) + 0.8 * (pg.rpg || 0) + 1.2 * (pg.apg || 0);
  function mipScore(p, Season) {
    const prev = p.history && p.history[p.history.length - 1];
    if (!prev || (prev.gp || 0) < CFG.mip.minPrevGp) return null;
    const now = Season.perGame(p);
    if (now.mpg < CFG.mip.minMpg) return null;
    return prodOf(now) - prodOf(prev);
  }
  function coachScore(lg, t, confTitle) {
    const O = offseasonModule(), C = coachesModule();
    const expect = O.prestigeBar(t) + (C ? C.CFG.security.expectWinOffset : -5);
    return 100 * winPct(t) - expect + (confTitle ? CFG.coy.confTitle : 0);
  }
  /* "21.4 ppg, 8.2 rpg, 3.1 apg" — his best three numbers */
  function lineOf(p, Season, def) {
    const g = Season.perGame(p);
    if (def) return `${g.ppg} ppg, ${g.rpg} rpg, ${g.spg} spg, ${g.bpg} bpg`;   // defense: always steals and blocks
    const parts = [["ppg", g.ppg], ["rpg", g.rpg], ["apg", g.apg], ["spg", g.spg], ["bpg", g.bpg]];
    const main = parts.slice(0, 3), extra = parts.slice(3).filter(([, v]) => v >= 2);
    return [...main, ...extra].map(([k, v]) => `${v} ${k}`).join(", ");
  }

  /* everyone eligible, with the team he plays for */
  function pool(lg, filter) {
    const out = [];
    for (const t of lg.teams) for (const p of t.players) if (!p.redshirt && eligible(p, t) && (!filter || filter(p, t))) out.push({ p, t });
    return out;
  }
  const entry = (p, t, Season, extra, def) => ({ pid: p.id, name: p.name, pos: p.pos, cls: League.classLabel(p), teamId: t.id, line: lineOf(p, Season, def), ...(extra || {}) });
  const coachEntry = (t, extra) => ({ cid: t.coach.id || null, name: t.coach.name, teamId: t.id, line: `${t.record.w}-${t.record.l}`, ...(extra || {}) });
  function give(p, year, k) { p.awards = p.awards || []; if (!p.awards.some(a => a.y === year && a.k === k)) p.awards.push({ y: year, k }); }
  function giveCoach(c, year, k) { if (!c || c.vacant) return; c.awards = c.awards || []; c.awards.push({ y: year, k }); }

  /* live races (the Leaders & Awards tab during the season) */
  function race(lg, kind, n = 5) {
    const Season = req ? require("./season.js") : root.Season;
    if (kind === "COY") return lg.teams.filter(t => t.record.w + t.record.l > 0).map(t => ({ t, score: coachScore(lg, t, false) })).sort((a, b) => b.score - a.score).slice(0, n)
      .map(x => coachEntry(x.t, { score: +x.score.toFixed(1) }));
    let rows;
    if (kind === "DPOY") rows = pool(lg).map(x => ({ ...x, score: defScore(x.p, x.t) * teamMult(x.t) }));
    else if (kind === "FOY") rows = pool(lg, (p) => p.class === "FR").map(x => ({ ...x, score: playerScore(x.p, x.t) }));
    else if (kind === "SIX") rows = pool(lg, (p) => (p.season.gs || 0) <= CFG.sixthMaxStart * p.season.gp).map(x => ({ ...x, score: playerScore(x.p, x.t) }));
    else if (kind === "MIP") rows = pool(lg).map(x => ({ ...x, score: mipScore(x.p, Season) })).filter(x => x.score != null);
    else rows = pool(lg).map(x => ({ ...x, score: playerScore(x.p, x.t) }));
    return rows.sort((a, b) => b.score - a.score).slice(0, n).map(x => entry(x.p, x.t, Season, { score: +x.score.toFixed(1) }, kind === "DPOY"));
  }

  /* ---------------- Selection Sunday: the regular-season awards ---------------- */
  function regular(lg, season) {
    const Season = req ? require("./season.js") : root.Season;
    const year = lg.season, P = season.post || {};
    const A = { year, national: {}, conf: {} };
    const take = (kind) => { const r = race(lg, kind, 1)[0]; return r || null; };
    const N = A.national;
    N.POY = take("POY"); N.DPOY = take("DPOY"); N.FOY = take("FOY"); N.SIX = take("SIX"); N.MIP = take("MIP"); N.COY = take("COY");
    const top = race(lg, "POY", CFG.allTeams * CFG.perTeam);
    for (let i = 0; i < CFG.allTeams; i++) N[`AA${i + 1}`] = top.slice(i * CFG.perTeam, (i + 1) * CFG.perTeam);
    // conferences
    for (const c of lg.conferences) {
      const teams = new Set(c.teamIds), inConf = (p, t) => teams.has(t.id);
      const all = pool(lg, inConf).map(x => ({ ...x, score: playerScore(x.p, x.t) })).sort((a, b) => b.score - a.score);
      const fr = all.filter(x => x.p.class === "FR");
      const cA = {};
      if (all[0]) cA.CPOY = entry(all[0].p, all[0].t, Season);
      if (fr[0]) cA.CFOY = entry(fr[0].p, fr[0].t, Season);
      for (let i = 0; i < CFG.confTeams; i++) cA[`AC${i + 1}`] = all.slice(i * CFG.perTeam, (i + 1) * CFG.perTeam).map(x => entry(x.p, x.t, Season));
      // conference coach of the year: regular-season conference champion gets the bump
      const pct = (t) => (t.record.confW + t.record.confL) ? t.record.confW / (t.record.confW + t.record.confL) : 0;
      const best = Math.max(...c.teamIds.map(id => pct(lg.byId[id])));
      const coy = c.teamIds.map(id => lg.byId[id]).map(t => ({ t, s: coachScore(lg, t, pct(t) === best && best > 0) })).sort((a, b) => b.s - a.s)[0];
      if (coy) cA.CCOY = coachEntry(coy.t);
      // tournament MVP: the champion's best player in the conference tournament
      const champ = P.conf && P.conf[c.id] && P.conf[c.id].champion;
      if (champ) {
        const t = lg.byId[champ];
        const m = t.players.filter(p => p.season.ct && p.season.ct.gp).map(p => ({ p, s: effTotal(p.season.ct) })).sort((a, b) => b.s - a.s)[0];
        if (m) cA.CTMVP = { ...entry(m.p, t, Season), line: tourneyLine(m.p.season.ct) };
      }
      A.conf[c.id] = cA;
    }
    // hand them out
    for (const k of ["POY", "DPOY", "FOY", "SIX", "MIP"]) if (N[k]) give(findP(lg, N[k].pid), year, k);
    for (let i = 1; i <= CFG.allTeams; i++) for (const e of N[`AA${i}`]) give(findP(lg, e.pid), year, `AA${i}`);
    if (N.COY) giveCoach(lg.byId[N.COY.teamId].coach, year, "COY");
    for (const id in A.conf) {
      const cA = A.conf[id];
      for (const k of ["CPOY", "CFOY", "CTMVP"]) if (cA[k]) give(findP(lg, cA[k].pid), year, k);
      for (let i = 1; i <= CFG.confTeams; i++) for (const e of cA[`AC${i}`] || []) give(findP(lg, e.pid), year, `AC${i}`);
      if (cA.CCOY) giveCoach(lg.byId[cA.CCOY.teamId].coach, year, "CCOY");
    }
    season.awards = A;
    keep(lg, A);
    // the news
    if (P.log) {
      const nm = (e) => `${e.name} (${lg.byId[e.teamId].abbr})`;
      if (N.POY) P.log.push(`Player of the Year: ${nm(N.POY)}, ${N.POY.line}.`);
      if (N.COY) P.log.push(`Coach of the Year: ${nm(N.COY)}, ${N.COY.line}.`);
      const u = lg.teams.find(t => t.isUser);
      if (u) {
        const mine = [];
        for (const p of u.players) for (const a of (p.awards || []).filter(a => a.y === year)) mine.push(`${p.name}: ${NAMES[a.k]}`);
        for (const a of (u.coach.awards || []).filter(a => a.y === year)) mine.push(`${u.coach.name}: ${NAMES[a.k]}`);
        if (mine.length) P.log.push(`Your honors: ${mine.join("; ")}.`);
      }
    }
    return A;
  }
  const tourneyLine = (s) => { const gp = Math.max(1, s.gp); return `${s.gp} games, ${(s.pts / gp).toFixed(1)} ppg, ${(reb(s) / gp).toFixed(1)} rpg`; };
  function findP(lg, pid) { for (const t of lg.teams) { const p = t.players.find(x => x.id === pid); if (p) return p; } return { awards: [] }; }

  /* ---------------- after the title game ---------------- */
  function final(lg, season) {
    const Season = req ? require("./season.js") : root.Season;
    const P = season.post, N = P && P.national;
    if (!N || !N.champion) return null;
    const total = N.rounds.length;
    const ff = new Set();
    for (const gid of (N.rounds[total - 2] || [])) { const g = season.games[gid]; if (g) { ff.add(g.home); ff.add(g.away); } }
    if (!ff.size) ff.add(N.champion);
    let best = null;
    for (const id of ff) {
      const t = lg.byId[id];
      for (const p of t.players) {
        const s = p.season.nt; if (!s || !s.gp) continue;
        const sc = effTotal(s) * (id === N.champion ? 1.15 : 1);
        if (!best || sc > best.sc) best = { p, t, sc };
      }
    }
    if (!best) return null;
    const A = season.awards || (season.awards = { year: lg.season, national: {}, conf: {} });
    A.national.MOP = { ...entry(best.p, best.t, Season), line: tourneyLine(best.p.season.nt) };
    give(best.p, lg.season, "MOP");
    keep(lg, A);
    if (P.log) P.log.push(`Most Outstanding Player: ${best.p.name} (${best.t.abbr}), ${A.national.MOP.line}.`);
    return A.national.MOP;
  }

  /* lg.awards[year]: national forever, conference awards for the last few years (save size) */
  function keep(lg, A) {
    lg.awards = lg.awards || {};
    const before = lg.awards[A.year];
    if (before && before.preseason && !A.preseason) A.preseason = before.preseason;   // keep the preseason picks with the year
    lg.awards[A.year] = A;
    for (const y of Object.keys(lg.awards)) if (+y <= A.year - CFG.keepConfYears) { delete lg.awards[y].conf; if (lg.awards[y].preseason) delete lg.awards[y].preseason.conf; }
  }

  /* ---------------- PRESEASON picks (when the season starts) ----------------
     Display only: they aren't honors and don't go on anyone's card.
       Player of the Year, All-American and All-Conference: overall + 0.25 ×
         last season's production (ppg + 0.8 rpg + 1.2 apg), so a proven
         returner edges an untested player with the same rating. Teams are
         2 guards, 2 forwards and a center.
       Defensive POY: his four defensive ratings (perimeter D, interior D, steal, block).
       Freshman of the Year: the best freshman by overall.
       Breakout candidate: the biggest overall jump in this offseason's development. */
  const GUARD = new Set(["PG", "SG"]), FWD = new Set(["SF", "PF"]);
  function lastProd(p) { const h = p.history && p.history[p.history.length - 1]; return h && (h.gp || 0) >= 10 ? prodOf(h) : 0; }
  function preEntry(p, t, extra) {
    const h = p.history && p.history[p.history.length - 1];
    const last = h && (h.gp || 0) >= 10 ? ` · last season ${h.ppg} ppg, ${h.rpg} rpg` : "";
    return { pid: p.id, name: p.name, pos: p.pos, cls: League.classLabel(p), teamId: t.id, line: `${League.ovrOf(p)} ovr${last}`, ...(extra || {}) };
  }
  /* teams of five: 2 guards, 2 forwards, 1 center, best first */
  function positionalTeams(rows, n) {
    const left = rows.slice(), teams = [];
    for (let i = 0; i < n; i++) {
      const team = [];
      for (const [set, k] of [[GUARD, 2], [FWD, 2], [new Set(["C"]), 1]]) {
        for (let j = 0; j < k; j++) { const idx = left.findIndex(r => set.has(r.p.pos)); if (idx >= 0) team.push(left.splice(idx, 1)[0]); }
      }
      while (team.length < CFG.perTeam && left.length) team.push(left.shift());   // a short position: best available
      teams.push(team);
    }
    return teams;
  }
  function preseason(lg, season) {
    const year = lg.season, all = [];
    for (const t of lg.teams) for (const p of t.players) if (!p.redshirt) all.push({ p, t, s: League.ovrOf(p) + 0.25 * lastProd(p) });
    all.sort((a, b) => b.s - a.s);
    const dev = lg.lastOffseason && lg.lastOffseason.development || {};
    const P = { year, national: {}, conf: {} }, N = P.national;
    N.POY = all[0] ? preEntry(all[0].p, all[0].t) : null;
    const defR = (p) => ((p.ratings.perDef || 50) + (p.ratings.intDef || 50) + (p.ratings.steal || 50) + (p.ratings.block || 50)) / 4;
    const d = all.slice().sort((a, b) => defR(b.p) - defR(a.p))[0];
    N.DPOY = d ? preEntry(d.p, d.t, { line: `defense ${Math.round(defR(d.p))} · ${League.ovrOf(d.p)} ovr` }) : null;
    const fr = all.filter(x => x.p.class === "FR" && !(x.p.history || []).length).sort((a, b) => League.ovrOf(b.p) - League.ovrOf(a.p))[0];
    N.FOY = fr ? preEntry(fr.p, fr.t) : null;
    let brk = null;
    for (const x of all) { const g = (dev[x.t.id] || []).find(z => z.id === x.p.id); if (g && g.delta > 0 && (!brk || g.delta > brk.delta)) brk = { ...x, delta: g.delta }; }
    N.BRK = brk ? preEntry(brk.p, brk.t, { line: `+${brk.delta} overall this offseason → ${League.ovrOf(brk.p)}` }) : null;
    positionalTeams(all, CFG.allTeams).forEach((team, i) => { N[`AA${i + 1}`] = team.map(x => preEntry(x.p, x.t)); });
    for (const c of lg.conferences) {
      const ids = new Set(c.teamIds), rows = all.filter(x => ids.has(x.t.id));
      const cP = {};
      if (rows[0]) cP.CPOY = preEntry(rows[0].p, rows[0].t);
      const cf = rows.filter(x => x.p.class === "FR" && !(x.p.history || []).length).sort((a, b) => League.ovrOf(b.p) - League.ovrOf(a.p))[0];
      if (cf) cP.CFOY = preEntry(cf.p, cf.t);
      positionalTeams(rows, CFG.confTeams).forEach((team, i) => { cP[`AC${i + 1}`] = team.map(x => preEntry(x.p, x.t)); });
      P.conf[c.id] = cP;
    }
    lg.awards = lg.awards || {};
    const cur = lg.awards[year] || (lg.awards[year] = { year, national: null, conf: null });
    cur.preseason = P;
    return P;
  }

  /* ---------------- tournament stats and series (called for every game) ---------------- */
  const TKEYS = ["pts", "oreb", "dreb", "ast", "stl", "blk", "tov", "fgm", "fga", "ftm", "fta"];
  function onGame(lg, game, row, p) {
    if (game.type !== "ct" && game.type !== "nt") return;
    const s = p.season[game.type] || (p.season[game.type] = { gp: 0, ...Object.fromEntries(TKEYS.map(k => [k, 0])) });
    s.gp++;
    for (const k of TKEYS) s[k] += row[k] || 0;
  }
  function recordSeries(lg, game) {
    const a = game.home < game.away ? game.home : game.away, b = a === game.home ? game.away : game.home;
    const key = `${a}|${b}`, homeWon = game.homeScore > game.awayScore;
    const aWon = (a === game.home) === homeWon;
    lg.series = lg.series || {};
    const r = lg.series[key] || (lg.series[key] = [0, 0]);
    aWon ? r[0]++ : r[1]++;
  }
  /* your all-time record against another school: { w, l } */
  function series(lg, teamId, oppId) {
    const a = teamId < oppId ? teamId : oppId, r = (lg.series || {})[`${a}|${a === teamId ? oppId : teamId}`];
    if (!r) return { w: 0, l: 0 };
    return a === teamId ? { w: r[0], l: r[1] } : { w: r[1], l: r[0] };
  }
  /* every series for one school, most games first */
  function seriesFor(lg, teamId) {
    const out = [];
    for (const key in (lg.series || {})) {
      const [a, b] = key.split("|");
      if (a !== teamId && b !== teamId) continue;
      const opp = a === teamId ? b : a, s = series(lg, teamId, opp);
      out.push({ opp, ...s });
    }
    return out.sort((x, y) => (y.w + y.l) - (x.w + x.l));
  }

  /* ---------------- the archive: players who left ---------------- */
  /* why: "graduated" | "drafted" | "declared"; draft: { year, pick, round } */
  function archive(lg, p, team, why, draft) {
    const Records = req ? require("./records.js") : root.Records;
    if (Records) Records.careerEnd(lg, p, team);   // career records: every finished career, archived or not
    const car = p.career || {};
    const notable = (p.awards || []).some(a => a.k !== "AC2") || draft || (car.pts || 0) >= CFG.archive.minCareerPts;   // 2nd-team all-conference alone isn't enough
    if (!notable) return null;
    lg.archive = lg.archive || { players: [] };
    const schools = [...new Set((p.history || []).map(h => h.team))];
    /* kept small (this grows for 50 seasons): seasons are [year, class, school, gp, ppg, rpg, apg] */
    const rec = {
      id: p.id, name: p.name, pos: p.pos, num: p.num, teamId: team.id, schools, to: lg.season, left: why,
      seasons: (p.history || []).map(h => [h.year, h.class, h.team, h.gp, h.ppg, h.rpg, h.apg]),
      career: { gp: car.gp || 0, pts: car.pts || 0, reb: reb(car), ast: car.ast || 0, stl: car.stl || 0, blk: car.blk || 0 },
      awards: (p.awards || []).map(a => `${a.k}${a.y}`), ovr: League.ovrOf(p),
    };
    if (draft) rec.draft = draft;
    lg.archive.players.push(rec);
    return rec;
  }
  /* archived awards are stored as "AA12031"; back to { k, y } */
  const unpackAwards = (list) => (list || []).map(x => typeof x === "string" ? { k: x.slice(0, -4), y: +x.slice(-4) } : x);
  const findArchived = (lg, id) => (lg.archive && lg.archive.players.find(x => x.id === id)) || null;

  /* "2× All-American, 2031 Player of the Year" */
  function summary(awards, year) {
    if (!awards || !awards.length) return "";
    const list = year != null ? awards.filter(a => a.y === year) : awards;
    const count = {};
    for (const a of list) (count[a.k] = count[a.k] || []).push(a.y);
    const order = ["POY", "MOP", "DPOY", "COY", "AA1", "AA2", "AA3", "FOY", "SIX", "MIP", "CPOY", "CCOY", "CTMVP", "CFOY", "AC1", "AC2"];
    return order.filter(k => count[k]).map(k => count[k].length > 1 ? `${count[k].length}× ${SHORT[k]}` : `${SHORT[k]}${year == null ? ` ${count[k][0]}` : ""}`).join(", ");
  }

  const Awards = { CFG, NAMES, SHORT, unpackAwards, preseason, effTotal, playerScore, defScore, race, regular, final, onGame, recordSeries, series, seriesFor, archive, findArchived, summary };
  if (typeof module !== "undefined") module.exports = Awards;
  else root.Awards = Awards;
})(typeof window !== "undefined" ? window : globalThis);
