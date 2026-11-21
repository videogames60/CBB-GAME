/* =====================================================================
   HOOPS DYNASTY — DEVELOPMENT

   The loop: play → earn XP → cash it in at the offseason for rating
   points → those points land randomly across his ratings.

   XP is earned all season from minutes, from production above what his
   class is expected to give, and from big games (postseason, and games
   against ranked teams). Bench players and redshirts earn a practice
   floor, so nobody is frozen — but playing is always the best way to
   develop, which is what makes minutes a real decision.

   Rating points earned =
       basePoints
     × devRate        (hidden personal speed — the gym rat vs the coaster)
     × classMult      (the young grow faster)
     × potentialMult  (potential is a RATE: the further below it, the faster)
     × xpMult         (what he actually did this season)
     × coachMult      (coach development rating)
     × facilityMult   (program facilities)
     × luck           (some guys just have a summer)

   Every multiplier is bounded in CFG so they can't compound into
   something absurd.

   Where the points GO is deliberately simple for now: they roll randomly
   across his ratings, rerolling any rating already at 99, so no point is
   wasted. Archetype and box-score weighting can come later.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const TUNING = req ? require("../sim/tuning.js") : root.TUNING;
  const League = req ? require("./league.js") : root.League;
  /* the staff rating (50% head coach, 25% each assistant: coaches.js) */
  const staffR = (team, key) => { const C = req ? require("./coaches.js") : root.Coaches; return C ? C.rating(team, key) : (team.coach[key] ?? 50); };

  const CFG = {
    /* ---- XP earned during the season ---- */
    xp: {
      perMinute: 1.0,          // the floor: playing is how you develop
      benchFloor: 0.22,        // share of a starter's rate for deep bench
      redshirtRate: 0.55,      // redshirts practise all year: most of a season's growth
      productionWeight: 1.6,   // per point of per-40 production above class expectation
      bigGameBonus: 12,        // per postseason game played (conference or national tournament)
      qualityBonus: 6,         // per game played vs a top-25 team (any game, postseason included)
      // what each class is "expected" to produce per 40 minutes (pts+reb+ast)
      expected: { FR: 16, SO: 20, JR: 23, SR: 25 },
      // XP that represents a full, healthy season of development
      season: 1000,
    },

    /* ---- converting XP into rating points ---- */
    growth: {
      basePoints: 70,          // raw rating points; ~11 buy 1 overall, since overall
                               // is a weighted average across the 11 ratings
      xpCurve: 0.65,           // diminishing returns on XP (0=flat, 1=linear)
      xpRange: [0.26, 1.50],   // multiplier from XP earned: playing is the big lever

      classMult: { FR: 1.00, SO: 0.85, JR: 0.65, SR: 0.45 },

      // potential is a rate, not a wall: the multiplier rises in a straight
      // line with the gap to potential (gap 0 → atPot, +perPoint per point
      // of gap, up to max). Past potential he still grows, slowly.
      potential: { atPot: 0.35, perPoint: 0.04, max: 1.35, over: 0.15 },

      coachRange: [0.90, 1.12],      // maps coach.development 25→99
      facilityRange: [0.95, 1.06],   // maps school.facilities 25→99
      luckRange: [0.80, 1.25],       // the offseason dice
      luckSkew: 1.0,                 // >1 pushes toward good summers

      ratingCap: 99,           // no per-offseason limit per rating; a point that lands on a 99 rerolls
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  /* map a 25–99 rating onto a multiplier range */
  const fromRating = (v, [lo, hi]) => lerp(lo, hi, (v - 25) / 74);

  /* ---------------- XP: accrued at the end of a season ---------------- */
  /* Reads the season stat line the sim already produced. */
  function seasonXP(p, team, season) {
    const X = CFG.xp;
    if (p.redshirt) return X.season * X.redshirtRate;

    const gp = p.season.gp || 0;
    if (!gp) return X.season * X.benchFloor * 0.5;      // never dressed: a little practice

    const minutes = p.season.sec / 60;
    const per40 = (stat) => (p.season.sec > 0 ? (stat * 2400) / p.season.sec : 0);

    // the floor: minutes played, expressed against a full starter's season
    const starterMinutes = gp * 30;
    const minuteShare = clamp(minutes / Math.max(1, starterMinutes), 0, 1.15);
    const floor = lerp(X.benchFloor, 1, minuteShare);

    // production above what his class is expected to give
    const production = per40(p.season.pts) + per40(p.season.oreb + p.season.dreb) + per40(p.season.ast);
    const above = production - (X.expected[p.class] || 20);
    const bonus = above * X.productionWeight * minuteShare;

    // big stages accelerate development (counted in Season.applyBox)
    const post = p.season.postGp || 0;
    const quality = p.season.qualityGp || 0;
    const stage = (post * X.bigGameBonus + quality * X.qualityBonus) * minuteShare;

    return Math.max(0, X.season * floor + bonus * 10 + stage);
  }

  /* ---------------- potential: the growth rate ---------------- */
  function potentialMult(ovr, potential) {
    const P = CFG.growth.potential;
    const gap = potential - ovr;
    if (gap <= 0) return P.over;
    return Math.min(P.max, P.atPot + P.perPoint * gap);
  }

  /* ---------------- one player's offseason ---------------- */
  function developPlayer(rand, p, team) {
    const G = CFG.growth;
    const before = League.ovrOf(p);
    const beforeRatings = { ...p.ratings };

    const xp = p.xp || 0;
    const xpNorm = Math.pow(clamp(xp / CFG.xp.season, 0, 1.6), G.xpCurve);
    const xpMult = lerp(G.xpRange[0], G.xpRange[1], xpNorm / 1.35);

    const luckRoll = Math.pow(rand(), 1 / Math.max(0.2, G.luckSkew));
    const luck = lerp(G.luckRange[0], G.luckRange[1], luckRoll);

    const mult =
      (p.devRate || 1) *
      (G.classMult[p.class] || 0.7) *
      potentialMult(before, p.potential) *
      xpMult *
      fromRating(staffR(team, "development"), G.coachRange) *
      fromRating(team.facilities, G.facilityRange) *
      luck;

    const points = Math.max(0, Math.round(G.basePoints * mult));

    /* Where the points go: random, one at a time. A rating already at 99
       rerolls, so every point lands somewhere; only a player maxed
       everywhere loses points. */
    const keys = Engine.RATING_KEYS;
    const gained = {};
    for (let i = 0; i < points; i++) {
      const open = keys.filter(k => p.ratings[k] < G.ratingCap);
      if (!open.length) break;
      const k = open[Math.floor(rand() * open.length)];
      p.ratings[k] = p.ratings[k] + 1;
      gained[k] = (gained[k] || 0) + 1;
    }

    const after = League.ovrOf(p);
    p.xp = 0;
    return {
      id: p.id, name: p.name, pos: p.pos, class: p.class,
      before, after, delta: after - before,
      points, luck: +luck.toFixed(2),
      gained,
      changes: Object.keys(gained).map(k => ({ k, from: beforeRatings[k], to: p.ratings[k] })),
    };
  }

  /* Run development for every player in the league. Call BEFORE classes
     advance, so a player develops as the class he just played. */
  function developAll(lg, rand) {
    const report = {};
    for (const t of lg.teams) {
      report[t.id] = t.players.map(p => developPlayer(rand, p, t))
        .sort((a, b) => b.delta - a.delta);
    }
    return report;
  }

  /* Transfers out live in roster.js (transfer odds, deals, promises). */
  const Development = { CFG, seasonXP, developPlayer, developAll, potentialMult };
  if (typeof module !== "undefined") module.exports = Development;
  else root.Development = Development;
})(typeof window !== "undefined" ? window : globalThis);
