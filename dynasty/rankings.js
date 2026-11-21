/* =====================================================================
   HOOPS DYNASTY — RANKINGS
   Three ways of ordering the same teams, on purpose:

   1. EFFICIENCY (KenPom-style)  — adjusted points per 100 possessions,
      iteratively corrected for opponent strength and venue. This is the
      closest thing to truth the sim has.

   2. POLLS (AP and Coaches)     — human-flavoured. They start from
      preseason expectations, move with inertia, overweight record and
      recent results, and carry voter noise. The Coaches poll is the
      same machinery with lazier, more record-friendly weights.

   3. COMMITTEE (NET-style)      — what actually picks and seeds the
      field: efficiency plus quadrant record plus schedule strength.

   Because the three disagree, snubs and surprise seeds happen naturally.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;

  const CFG = {
    effIterations: 25,
    homeCourtPts: 3.2,          // venue adjustment per 100 possessions

    preseason: {                 // turning prestige+roster into an expected rating
      strengthWeight: 1.35,      // per point of team strength above average
      prestigeWeight: 0.25,
    },

    /* Poll voters score teams 0-100 then rank. Weights differ by poll. */
    ap: {
      inertia: 0.55,             // share of last week's score that carries over
      eff: 0.45,                 // adjusted efficiency margin (the "eye test")
      winPct: 30,                // record
      qualityWin: 1.6,           // per Q1 win
      badLoss: 3.0,              // per Q4 loss
      recent: 4.5,               // last-5 form
      noise: 1.4,                // voter disagreement (seeded)
      preseasonFade: 0.72,       // how fast preseason opinion decays per week
    },
    coaches: {
      inertia: 0.70,             // lazier
      eff: 0.28,                 // watches less film
      winPct: 38,                // loves a record
      qualityWin: 1.2,
      badLoss: 2.2,              // slower to punish
      recent: 3.0,
      noise: 1.8,
      preseasonFade: 0.80,       // clings to preseason opinion longer
    },

    committee: {
      eff: 1.0,                  // efficiency margin (per point per 100)
      q1Win: 1.15,               // resume pieces
      q2Win: 0.35,
      q3Loss: 0.9,
      q4Loss: 2.2,
      sos: 0.30,                 // strength of schedule (per point above avg)
      winPct: 22,                // record matters: .500 teams don't get at-large bids
      roadWin: 0.22,             // per road/neutral win: the committee likes them
    },

    /* Quadrant boundaries as a FRACTION of the league, venue-shifted, so the
       same numbers work at 74 teams or 364. Real NET: Q1 home 1-30/364≈8%. */
    quads: {
      q1: { home: 0.08, neutral: 0.14, away: 0.20 },
      q2: { home: 0.20, neutral: 0.27, away: 0.34 },
      q3: { home: 0.45, neutral: 0.55, away: 0.65 },
    },
  };

  /* ---------------- game log ---------------- */
  /* Rankings read the season's played games in one pass. */
  function gameLog(lg, season) {
    const log = [];
    for (const g of season.games) {
      if (!g.played) continue;
      const hPoss = g.poss != null ? g.poss : 68;
      log.push({ home: g.home, away: g.away, hs: g.homeScore, as: g.awayScore, poss: hPoss, neutral: !!g.neutral, day: g.day, type: g.type });
    }
    return log;
  }

  /* ---------------- 1. ADJUSTED EFFICIENCY ---------------- */
  function efficiency(lg, season) {
    const ids = lg.teams.map(t => t.id);
    const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
    const games = [];
    for (const g of season.games) {
      if (!g.played || g.poss == null) continue;
      games.push(g);
    }
    const n = ids.length;
    const adjO = new Array(n).fill(103), adjD = new Array(n).fill(103);
    const lgAvg = { o: 103 };

    if (games.length) {
      // raw league average
      let pts = 0, poss = 0;
      for (const g of games) { pts += g.homeScore + g.awayScore; poss += 2 * g.poss; }
      lgAvg.o = 100 * pts / poss;
      adjO.fill(lgAvg.o); adjD.fill(lgAvg.o);

      for (let it = 0; it < CFG.effIterations; it++) {
        const sumO = new Array(n).fill(0), sumD = new Array(n).fill(0), cnt = new Array(n).fill(0);
        for (const g of games) {
          const h = idx[g.home], a = idx[g.away];
          const hc = g.neutral ? 0 : CFG.homeCourtPts;
          const hOff = 100 * g.homeScore / g.poss, aOff = 100 * g.awayScore / g.poss;
          // what each side "should" have scored given the opponent, venue-adjusted
          sumO[h] += hOff - (adjD[a] - lgAvg.o) - hc / 2; cnt[h]++;
          sumD[h] += aOff - (adjO[a] - lgAvg.o) + hc / 2;
          sumO[a] += aOff - (adjD[h] - lgAvg.o) + hc / 2; cnt[a]++;
          sumD[a] += hOff - (adjO[h] - lgAvg.o) - hc / 2;
        }
        for (let i = 0; i < n; i++) {
          if (!cnt[i]) continue;
          adjO[i] = 0.4 * adjO[i] + 0.6 * (sumO[i] / cnt[i]);
          adjD[i] = 0.4 * adjD[i] + 0.6 * (sumD[i] / cnt[i]);
        }
      }
    }

    const rows = ids.map((id, i) => ({
      id, team: lg.byId[id],
      adjO: +adjO[i].toFixed(1), adjD: +adjD[i].toFixed(1),
      margin: +(adjO[i] - adjD[i]).toFixed(1),
      gp: 0,
    }));
    rows.sort((a, b) => b.margin - a.margin);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  /* ---------------- helpers shared by polls & committee ---------------- */
  function resumeData(lg, season, effRows) {
    const effRank = Object.fromEntries(effRows.map(r => [r.id, r.rank]));
    const effMargin = Object.fromEntries(effRows.map(r => [r.id, r.margin]));
    const n = lg.teams.length;
    const q = CFG.quads;
    const quadOf = (oppRank, venue) => {
      const f = oppRank / n;
      if (f <= q.q1[venue]) return 1;
      if (f <= q.q2[venue]) return 2;
      if (f <= q.q3[venue]) return 3;
      return 4;
    };
    const data = {};
    for (const t of lg.teams) data[t.id] = { w: 0, l: 0, q1w: 0, q1l: 0, q2w: 0, q2l: 0, q3w: 0, q3l: 0, q4w: 0, q4l: 0, roadW: 0, sosSum: 0, gp: 0, last5: [] };

    const played = season.games.filter(g => g.played).sort((a, b) => a.day - b.day);
    for (const g of played) {
      const homeWon = g.homeScore > g.awayScore;
      for (const [id, opp, won, venue] of [
        [g.home, g.away, homeWon, g.neutral ? "neutral" : "home"],
        [g.away, g.home, !homeWon, g.neutral ? "neutral" : "away"],
      ]) {
        const d = data[id];
        if (!d) continue;
        const quad = quadOf(effRank[opp] || n, venue);
        won ? d.w++ : d.l++;
        d[`q${quad}${won ? "w" : "l"}`]++;
        if (won && venue !== "home") d.roadW++;
        d.sosSum += effMargin[opp] || 0;
        d.gp++;
        d.last5.push(won ? 1 : 0); if (d.last5.length > 5) d.last5.shift();
      }
    }
    return { data, effRank, effMargin };
  }

  /* ---------------- 2. POLLS ---------------- */
  /* Deterministic voter noise per (seed, team, week, poll). */
  function noiseFor(seed, teamId, week, which) {
    let h = seed ^ week * 2654435761;
    for (const c of teamId + which) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h = (h ^ (h >>> 13)) >>> 0;
    return (h % 1000) / 1000 * 2 - 1;   // -1..1
  }

  function preseasonScore(lg) {
    const League = req ? require("./league.js") : root.League;
    const strengths = lg.teams.map(t => League.teamStrength(t));
    const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    const out = {};
    lg.teams.forEach((t, i) => {
      out[t.id] = 50 + CFG.preseason.strengthWeight * (strengths[i] - avg) + CFG.preseason.prestigeWeight * (t.prestige - 55);
    });
    return out;
  }

  /* One poll update. prev = {teamId: score} from last week (or preseason). */
  function pollUpdate(lg, season, effRows, prev, week, which) {
    const P = CFG[which];
    const { data, effMargin } = resumeData(lg, season, effRows);
    const pre = season.preseasonScore;
    const out = {};
    for (const t of lg.teams) {
      const d = data[t.id];
      const winPct = d.gp ? d.w / d.gp : 0.5;
      const recent = d.last5.length ? d.last5.reduce((a, b) => a + b, 0) / d.last5.length - 0.5 : 0;
      const resume =
        P.eff * (effMargin[t.id] || 0)
        + P.winPct * (winPct - 0.5)
        + P.qualityWin * d.q1w
        - P.badLoss * d.q4l
        + P.recent * recent
        + P.noise * noiseFor(season.seed, t.id, week, which);
      const anchor = Math.pow(P.preseasonFade, week);        // preseason opinion decays
      const base = anchor * (pre[t.id] - 50) + (1 - anchor) * resume;
      const prevScore = prev && prev[t.id] != null ? prev[t.id] : (pre[t.id] - 50);
      out[t.id] = P.inertia * prevScore + (1 - P.inertia) * base + (d.gp === 0 ? 0 : 0);
    }
    return out;
  }

  function rankFromScores(lg, scores, top = 25) {
    return lg.teams
      .map(t => ({ id: t.id, team: t, score: scores[t.id] || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map((r, i) => ({ rank: i + 1, ...r }));
  }

  /* Call once per week of season time. Stores poll history on the season. */
  function updateWeekly(lg, season) {
    const effRows = efficiency(lg, season);
    season.preseasonScore = season.preseasonScore || preseasonScore(lg);
    season.pollWeek = (season.pollWeek || 0) + 1;
    season.apScores = pollUpdate(lg, season, effRows, season.apScores, season.pollWeek, "ap");
    season.coachScores = pollUpdate(lg, season, effRows, season.coachScores, season.pollWeek, "coaches");
    season.rankings = {
      week: season.pollWeek,
      eff: effRows,
      ap: rankFromScores(lg, season.apScores),
      coaches: rankFromScores(lg, season.coachScores),
      committee: committee(lg, season, effRows),
    };
    return season.rankings;
  }

  /* ---------------- 3. COMMITTEE ---------------- */
  function committee(lg, season, effRows) {
    const C = CFG.committee;
    effRows = effRows || efficiency(lg, season);
    const { data, effMargin } = resumeData(lg, season, effRows);
    const rows = lg.teams.map(t => {
      const d = data[t.id];
      const winPct = d.gp ? d.w / d.gp : 0;
      const sos = d.gp ? d.sosSum / d.gp : 0;
      const score =
        C.eff * (effMargin[t.id] || 0)
        + C.q1Win * d.q1w + C.q2Win * d.q2w
        - C.q3Loss * d.q3l - C.q4Loss * d.q4l
        + C.sos * sos
        + C.winPct * (winPct - 0.5)
        + C.roadWin * d.roadW;
      return {
        id: t.id, team: t, score: +score.toFixed(2),
        w: d.w, l: d.l, q1: `${d.q1w}-${d.q1l}`, q2: `${d.q2w}-${d.q2l}`,
        q3: `${d.q3w}-${d.q3l}`, q4: `${d.q4w}-${d.q4l}`,
        sos: +sos.toFixed(1), roadW: d.roadW,
      };
    }).sort((a, b) => b.score - a.score);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  const Rankings = { CFG, efficiency, committee, updateWeekly, resumeData, preseasonScore, gameLog };
  if (typeof module !== "undefined") module.exports = Rankings;
  else root.Rankings = Rankings;
})(typeof window !== "undefined" ? window : globalThis);
