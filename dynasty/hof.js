/* =====================================================================
   HOOPS DYNASTY — THE HALL OF FAME AND RETIRED JERSEYS

   Both happen at the end of each offseason (after the draft and the
   portal), for the players who just left: graduated, drafted, or
   declared and went undrafted (the archive, awards.js), and for the
   head coaches who retired.

   HALL OF FAME (the league's). A career score:
       awards       POY 40, All-American 18 / 12 / 8, Final Four MOP 15,
                    DPOY 12, conference POY 8, all-conference 5 / 2, ...
       production   career points / 100, rebounds / 150, assists / 120,
                    steals and blocks / 60
       winning      national titles 10, Final Fours 5 (with him there)
       the draft    top-5 pick 10, first round 6, second round 2
   Anyone at CFG.player.threshold or above is in, at most 5 a year (the
   best first). Coaches: wins, titles, Final Fours and Coach of the Year
   awards, with a much higher bar (CFG.coach: a coach needs titles or a
   run of Final Fours, not just a long career), at most 2 a year.

   RETIRED JERSEYS (each school's own). His legacy AT THAT SCHOOL: the
   awards he won there, his points and rebounds there, and what the
   team did with him (titles, Final Fours, tournaments), plus where he
   was drafted from there (team success counts less here than in the Hall
   of Fame). The bar rises with the school's prestige:
       threshold = base + perPrestige × prestige
   so a small school retires its best player ever, and a blue blood
   needs an All-American or a title run. At most 5 a school a year. A
   Hall of Famer's jersey is retired at the school where he did the most.

   Kept in lg.hof = { players: [...], coaches: [...] } and team.jerseys.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const awardsModule = () => req ? require("./awards.js") : root.Awards;

  const CFG = {
    awards: { POY: 40, AA1: 18, AA2: 12, AA3: 8, MOP: 15, DPOY: 12, FOY: 5, SIX: 3, MIP: 3, CPOY: 8, CTMVP: 3, CFOY: 2, AC1: 5, AC2: 2 },
    stats: { pts: 100, reb: 150, ast: 120, stl: 60, blk: 60 },   // one point per this many
    team: { title: 10, finalFour: 5, tournament: 1 },
    draft: { top5: 10, first: 6, second: 2 },
    player: { threshold: 120, cap: 5 },   // tuned: about one a year in Compact (tests/longrun-style check)
    /* coaches: rare on purpose (about one every 3 years in Compact). Titles and Final Fours
       carry it; wins alone don't (700 wins is under 18 points). Tuned on retired-coach careers
       from a 50-season Compact sim: 12 made it at a bar of 60 (and none in 20 Full seasons),
       17 at this one: a title plus a Final Four or two over a long career, or a few Final
       Fours and Coach of the Year awards without a title. */
    coach: { perWin: 1 / 40, title: 20, finalFour: 8, COY: 6, CCOY: 1, threshold: 40, cap: 2 },
    jersey: { base: 30, perPrestige: 0.45, cap: 5,
      team: { title: 6, finalFour: 3, tournament: 0.5 } },   // at a school, team success counts less: a title team's role players don't get their jerseys retired
  };
  const POSTRANK = (label) => /National champion/.test(label || "") ? 3 : /Runner-up|Semifinal/.test(label || "") ? 2 : /Tournament/.test(label || "") ? 1 : 0;

  /* what the team did in the seasons he was there: [{ title, finalFour, tournament }] */
  function teamRuns(lg, seasons) {
    const out = { title: 0, finalFour: 0, tournament: 0 };
    for (const s of seasons) {
      const t = lg.teams.find(x => x.abbr === s[2]); if (!t) continue;
      const h = t.history.find(x => x.year === s[0]); if (!h) continue;
      const r = POSTRANK(h.postseason);
      if (r === 3) out.title++;
      if (r >= 2) out.finalFour++;
      if (r >= 1) out.tournament++;
    }
    return out;
  }
  const draftPts = (d) => !d ? 0 : d.pick <= 5 ? CFG.draft.top5 : d.round === 1 ? CFG.draft.first : CFG.draft.second;
  const awardPts = (aw) => aw.reduce((a, x) => a + (CFG.awards[x.k] || 0), 0);
  const statPts = (c) => Object.entries(CFG.stats).reduce((a, [k, per]) => a + (c[k] || 0) / per, 0);

  /* the Hall of Fame score for an archived player (with the parts, for the card) */
  function playerScore(lg, x) {
    const aw = awardsModule().unpackAwards(x.awards);
    const runs = teamRuns(lg, x.seasons);
    const parts = { awards: awardPts(aw), stats: statPts(x.career), winning: runs.title * CFG.team.title + runs.finalFour * CFG.team.finalFour, draft: draftPts(x.draft) };
    return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts, runs, aw };
  }
  /* his legacy at one school */
  function legacyAt(lg, x, abbr) {
    const seasons = x.seasons.filter(s => s[2] === abbr);
    if (!seasons.length) return null;
    const years = new Set(seasons.map(s => s[0]));
    const aw = awardsModule().unpackAwards(x.awards).filter(a => years.has(a.y));
    const pts = seasons.reduce((a, s) => a + (s[4] || 0) * (s[3] || 0), 0), reb = seasons.reduce((a, s) => a + (s[5] || 0) * (s[3] || 0), 0);
    const runs = teamRuns(lg, seasons);
    const leftFromHere = x.schools[x.schools.length - 1] === abbr;
    const score = awardPts(aw) + pts / CFG.stats.pts + reb / CFG.stats.reb
      + runs.title * CFG.jersey.team.title + runs.finalFour * CFG.jersey.team.finalFour + runs.tournament * CFG.jersey.team.tournament
      + (leftFromHere ? draftPts(x.draft) : 0);
    return { score, seasons: seasons.length, pts: Math.round(pts), aw, runs };
  }
  const jerseyBar = (team) => CFG.jersey.base + CFG.jersey.perPrestige * team.prestige;

  function coachScore(lg, c) {
    const aw = c.awards || [];
    let titles = 0, ff = 0;
    for (const j of (c.hist || [])) {
      if (j.role !== "head" || !j.teamId) continue;
      const t = lg.byId[j.teamId]; if (!t) continue;
      for (const h of t.history) if (h.year >= (j.from ?? 0) && h.year <= (j.to ?? lg.season) && h.coach === c.name) { const r = POSTRANK(h.postseason); if (r === 3) titles++; if (r >= 2) ff++; }
    }
    const C = CFG.coach;
    const total = (c.w || 0) * C.perWin + titles * C.title + ff * C.finalFour + aw.filter(a => a.k === "COY").length * C.COY + aw.filter(a => a.k === "CCOY").length * C.CCOY;
    return { total, titles, ff, coy: aw.filter(a => a.k === "COY").length };
  }

  /* ---------------- the end of the offseason ---------------- */
  function induct(lg, retiredCoaches) {
    lg.hof = lg.hof || { players: [], coaches: [] };
    const year = lg.season, A = awardsModule();
    const out = { year, players: [], coaches: [], jerseys: [] };
    const leaving = (lg.archive ? lg.archive.players : []).filter(x => x.to === year);
    // Hall of Fame: players
    const cands = leaving.map(x => ({ x, s: playerScore(lg, x) })).filter(c => c.s.total >= CFG.player.threshold)
      .sort((a, b) => b.s.total - a.s.total).slice(0, CFG.player.cap);
    for (const { x, s } of cands) {
      // where he made his name: the school with the biggest legacy
      const home = x.schools.map(ab => ({ ab, l: legacyAt(lg, x, ab) })).filter(o => o.l).sort((a, b) => b.l.score - a.l.score)[0];
      const team = home && lg.teams.find(t => t.abbr === home.ab);
      const e = { id: x.id, name: x.name, pos: x.pos, y: year, teamId: team ? team.id : x.teamId, schools: x.schools, score: Math.round(s.total),
        line: `${x.career.pts} pts, ${x.career.reb} reb, ${x.career.ast} ast`, honors: A.summary(s.aw), titles: s.runs.title, ff: s.runs.finalFour, draft: x.draft || null };
      lg.hof.players.push(e); out.players.push(e);
    }
    // Hall of Fame: coaches who retired this year
    const cc = (retiredCoaches || []).map(c => ({ c, s: coachScore(lg, c) })).filter(o => o.s.total >= CFG.coach.threshold)
      .sort((a, b) => b.s.total - a.s.total).slice(0, CFG.coach.cap);
    for (const { c, s } of cc) {
      const jobs = (c.hist || []).filter(j => j.role === "head").map(j => j.team);
      const e = { id: c.id, name: c.name, y: year, schools: [...new Set(jobs)], w: c.w || 0, l: c.l || 0, titles: s.titles, ff: s.ff, coy: s.coy, score: Math.round(s.total) };
      lg.hof.coaches.push(e); out.coaches.push(e);
    }
    // retired jerseys, school by school
    const byTeam = {};
    for (const x of leaving) for (const ab of x.schools) {
      const team = lg.teams.find(t => t.abbr === ab); if (!team) continue;
      const l = legacyAt(lg, x, ab); if (!l) continue;
      const hofHere = out.players.some(p => p.id === x.id && p.teamId === team.id);
      if (l.score >= jerseyBar(team) || hofHere) (byTeam[team.id] = byTeam[team.id] || []).push({ x, l, hofHere });
    }
    for (const id in byTeam) {
      const team = lg.byId[id];
      const list = byTeam[id].sort((a, b) => (b.hofHere - a.hofHere) || (b.l.score - a.l.score)).slice(0, CFG.jersey.cap);
      team.jerseys = team.jerseys || [];
      for (const { x, l, hofHere } of list) {
        const span = `${x.seasons.filter(s => s[2] === team.abbr)[0][0]}–${String(year + 1).slice(2)}`;
        const e = { id: x.id, name: x.name, pos: x.pos, num: x.num, y: year, span, seasons: l.seasons, pts: l.pts, honors: A.summary(l.aw), hof: hofHere, score: Math.round(l.score) };
        team.jerseys.push(e); out.jerseys.push({ teamId: id, ...e });
      }
    }
    // the archive keeps growing for 50 seasons: once this year's class is judged, only the players
    // honored here keep their season-by-season lines; everyone else keeps his career summary
    const honored = new Set([...out.players.map(e => e.id), ...out.jerseys.map(e => e.id)]);
    for (const x of leaving) if (!honored.has(x.id) && x.seasons) { x.from = x.seasons.length ? x.seasons[0][0] : x.to; delete x.seasons; }
    return out;
  }

  const HallOfFame = { CFG, playerScore, legacyAt, jerseyBar, coachScore, induct };
  if (typeof module !== "undefined") module.exports = HallOfFame;
  else root.HallOfFame = HallOfFame;
})(typeof window !== "undefined" ? window : globalThis);
