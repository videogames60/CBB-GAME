/* =====================================================================
   HOOPS DYNASTY — LEAGUE
   Builds the world: regions, conferences, schools, coaches, and rosters.

   Every player carries the full dynasty record (class, potential, xp,
   scouting, preferences) even though only some of it is used yet — the
   season loop, recruiting and progression all read the same object.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const Sample = req ? require("../sim/sample_teams.js") : root.SampleTeams;
  const TUNING = req ? require("../sim/tuning.js") : root.TUNING;
  const Leagues = req ? require("./leagues.js") : root.Leagues;   // league definitions (conferences, schools, name pools)
  const Geo = req ? require("./geo.js") : root.Geo;               // the map: cities, areas, distances
  const Pipelines = req ? require("./pipelines.js") : root.Pipelines;

  /* ---------------- WORLD DATA (edit freely) ---------------- */
  const REGIONS = ["Northeast", "Southeast", "Midwest", "South", "West"];

  /* Conferences, schools and the school name pools live in leagues.js (a
     league definition). The compact 74-team league is the default. */
  const CONFERENCES = Leagues.get("compact").conferences;   // kept for anything that still reads the old list
  const { places: PLACES, suffix: SUFFIX, mascots: MASCOTS, colors: COLORS } = Leagues.NAMES;
  const COACH_FIRST = ["Bill", "Roy", "Tom", "Jim", "Rick", "Dan", "Greg", "Mark", "Kevin", "Steve", "Brad", "Chris", "Matt", "Pat", "Ray", "Hank", "Walt", "Gene", "Lon", "Buzz", "Cliff", "Dale", "Ernie", "Frank", "Gus", "Hal", "Ike", "Jack", "Lou", "Moe"];
  const COACH_LAST = ["Hargreaves", "Callahan", "Dunleavy", "Ferrante", "Gillespie", "Hobbs", "Ingram", "Jerrold", "Kittridge", "Lombard", "Marchetti", "Nunnally", "Ostrander", "Pettigrew", "Quillen", "Rasmussen", "Sallinger", "Tarkanian", "Underwood", "Vandergrift", "Whitlock", "Yeager", "Ziegler", "Boudreau", "Castellano", "Delaney", "Ericsson", "Fitzsimmons"];

  /* ---------------- RATINGS / GRADES ---------------- */
  const GRADE_CUTS = [
    [93, "A+"], [88, "A"], [84, "A-"], [80, "B+"], [75, "B"], [71, "B-"],
    [66, "C+"], [61, "C"], [56, "C-"], [50, "D+"], [44, "D"], [38, "D-"], [0, "F"],
  ];
  function grade(v) { for (const [cut, g] of GRADE_CUTS) if (v >= cut) return g; return "F"; }

  const CLASSES = ["FR", "SO", "JR", "SR"];
  const PREFERENCES = ["win_now", "playing_time", "development", "close_to_home", "nil", "playstyle"];
  const TEMPERAMENTS = ["loyal", "steady", "restless", "ambitious"];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

  function emptySeasonStats() {
    return { gp: 0, gs: 0, sec: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, dnp: 0, postGp: 0, qualityGp: 0 };
  }

  /* Turn a sim-generated player into a full dynasty player. */
  /* home: his hometown (a city key, "Houston, TX") */
  function dynastyPlayer(rand, p, { cls, quality, home }) {
    const ovr = Engine.overall(TUNING, p.pos, p.ratings);
    const yearsLeft = 4 - CLASSES.indexOf(cls);
    // potential: room to grow, biggest for freshmen
    const room = ri(rand, 2, 6 + yearsLeft * 5);
    const out = {
      ...p,
      class: cls,
      redshirt: false,
      eligibilityUsed: CLASSES.indexOf(cls) + 1,
      potential: clamp(ovr + room, 25, 99),
      breakthroughs: 0,
      xp: 0,
      devRate: +(0.85 + rand() * 0.4).toFixed(2),     // personal development speed
      home: home || null,
      preferences: [pick(rand, PREFERENCES), pick(rand, PREFERENCES)].filter((v, i, a) => a.indexOf(v) === i),
      temperament: pick(rand, TEMPERAMENTS),
      loyalty: null,                                   // 0–99, filled in below from his temperament
      scoutLevel: 3,                                   // your own players are fully known
      scoutedRatings: null,
      season: emptySeasonStats(),
      career: emptySeasonStats(),
      history: [],
    };
    loyaltyOf(out);
    return out;
  }

  /* ---------------- COACHES ---------------- */
  /* Every coach gets a scheme he actually runs, so the league isn't 74 teams
     all playing balanced/man. Weights keep the plain styles common and the
     gimmick styles rare, the way real basketball looks. Iso is excluded here
     because it needs a designated go-to guy the roster may not have. */
  const OFFENSE_WEIGHTS = [
    ["balanced", 26], ["motion", 18], ["pace_space", 14], ["grind", 12],
    ["post", 10], ["seven_seconds", 9], ["run_gun", 7], ["iso", 4],
  ];
  const DEFENSE_WEIGHTS = [
    ["man", 46], ["gamble", 16], ["zone23", 20], ["zone131", 10], ["press", 8],
  ];
  function weightedPick(rand, table) {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [k, w] of table) { if ((r -= w) <= 0) return k; }
    return table[0][0];
  }

  function makeCoach(rand, prestige) {
    const base = clamp(prestige + ri(rand, -12, 12), 25, 95);
    return withDepth({
      name: pick(rand, COACH_FIRST) + " " + pick(rand, COACH_LAST),
      rating: base,                                   // in-game tactics (the sim reads this)
      recruiting: clamp(base + ri(rand, -15, 15), 25, 99),
      development: clamp(base + ri(rand, -15, 15), 25, 99),
      scouting: clamp(base + ri(rand, -15, 15), 25, 99),
      offense: weightedPick(rand, OFFENSE_WEIGHTS),
      defense: weightedPick(rand, DEFENSE_WEIGHTS),
      lateGame: "auto",
      years: ri(rand, 1, 12), careerW: 0, careerL: 0,
    });
  }

  /* ---------------- ROSTER ---------------- */
  /* 13 scholarships: a realistic class spread, better players skewed to upperclassmen. */
  /* city: the school's city; about half the roster grew up within "close" range of it */
  function makeRoster(rand, teamId, quality, city) {
    const plan = [
      ["SR", 3], ["JR", 3], ["SO", 3], ["FR", 4],
    ];
    /* which position lands in which class slot is shuffled per school (its
       own little generator, so the league's random stream is untouched):
       on average every position gets the same mix of seniors and freshmen */
    const positions = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C", "SG", "SF", "PF"];
    let h = [...String(teamId)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    for (let i = positions.length - 1; i > 0; i--) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const j = h % (i + 1); [positions[i], positions[j]] = [positions[j], positions[i]]; }
    const players = [];
    let n = 0;
    for (const [cls, count] of plan) {
      for (let i = 0; i < count; i++) {
        const idx = players.length;
        // upperclassmen are further along; freshmen are rawer but have more room
        const bump = { SR: 5, JR: 2, SO: -2, FR: -7 }[cls];
        const q = clamp(quality + bump + ri(rand, -6, 6), 25, 95);
        const base = Sample.generatePlayer(rand, { id: `${teamId}-p${++n}`, pos: positions[idx % positions.length], base: q, quality: q });
        players.push(dynastyPlayer(rand, base, { cls, quality: q, home: Geo.hometown(rand, city, Geo.CFG.rosterLocal).key }));
      }
    }
    // starters = best five by position-weighted overall, one per position where possible
    assignStarters(players);
    return players;
  }

  function assignStarters(players) {
    players.forEach(p => { p.starter = false; });
    const used = new Set();
    for (const pos of ["PG", "SG", "SF", "PF", "C"]) {
      const best = players.filter(p => p.pos === pos && !used.has(p.id) && !p.redshirt)
        .sort((a, b) => ovrOf(b) - ovrOf(a))[0];
      if (best) { best.starter = true; used.add(best.id); }
    }
    const need = 5 - players.filter(p => p.starter).length;
    if (need > 0) {
      players.filter(p => !p.starter && !p.redshirt).sort((a, b) => ovrOf(b) - ovrOf(a)).slice(0, need).forEach(p => { p.starter = true; });
    }
  }
  const ovrOf = (p) => Engine.overall(TUNING, p.pos, p.ratings);
  /* "RS-SO": a redshirt year doesn't use eligibility, so he's a class behind his years */
  const classLabel = (p) => (p.redshirtUsed ? "RS-" : "") + p.class;

  /* AI schools redshirt a freshman who'd be buried this year but has a lot
     of room to grow: he keeps the year of eligibility. At most 2, and never
     if it leaves fewer than 11 available players. */
  function aiRedshirts(team) {
    const fr = team.players.filter(p => p.class === "FR" && !p.redshirtUsed && !p.redshirt && !p.injured);
    const byOvr = team.players.filter(p => !p.redshirt && !p.injured).sort((a, b) => ovrOf(b) - ovrOf(a));
    const buried = new Set(byOvr.slice(10).map(p => p.id));
    let n = 0;
    for (const p of fr.filter(p => buried.has(p.id) && p.potential - ovrOf(p) >= 15).sort((a, b) => (b.potential - ovrOf(b)) - (a.potential - ovrOf(a)))) {
      if (n >= 2 || team.players.filter(x => !x.redshirt && !x.injured).length <= 11) break;
      p.redshirt = true; n++;
    }
    return n;
  }

  /* An iso offense needs a go-to guy. Re-pick whenever the roster turns over,
     or the engine quietly falls back to balanced. */
  function pickIsoTarget(team) {
    if (team.coach.offense !== "iso") return team.isoTarget || null;
    const best = team.players.filter(p => !p.redshirt)
      .map(p => ({ p, s: ovrOf(p) + p.ratings.close * 0.15 + p.ratings.mid * 0.15 + p.ratings.handle * 0.1 }))
      .sort((a, b) => b.s - a.s)[0];
    team.isoTarget = best ? best.p.id : null;
    return team.isoTarget;
  }

  /* ---------------- rotations ----------------
     Minutes by rotation depth (7–10 men). Starters get the first five
     slots (best overall → most minutes), the bench is ordered by overall,
     anyone past the depth gets 0 (garbage time only). Always 200 total. */
  const ROTATION = { starter: 34, backup: 11, third: 4 };   // legacy, kept for old callers
  const DEPTH_MINUTES = {
    7: { starters: [36, 35, 34, 33, 32], bench: [17, 13] },
    8: { starters: [34, 33, 32, 31, 30], bench: [17, 13, 10] },
    9: { starters: [33, 32, 31, 30, 29], bench: [15, 12, 10, 8] },
    10: { starters: [32, 31, 30, 29, 28], bench: [14, 12, 10, 8, 6] },
  };
  const ROT_RULES = { minDepth: 7, maxDepth: 10, minBenchMinutes: 5, maxMinutes: 40, total: 200 };
  const healthy = (p) => !p.redshirt && !p.injured;
  function buildRotation(players, depth = 9) {
    const rot = {}, active = players.filter(healthy);
    players.forEach(p => { rot[p.id] = 0; });
    const d = clamp(Math.round(depth), ROT_RULES.minDepth, ROT_RULES.maxDepth);
    const T = DEPTH_MINUTES[d];
    const st = active.filter(p => p.starter).sort((a, b) => ovrOf(b) - ovrOf(a)).slice(0, 5);
    const bn = active.filter(p => !st.includes(p)).sort((a, b) => ovrOf(b) - ovrOf(a));
    st.forEach((p, i) => { rot[p.id] = T.starters[i]; });
    bn.slice(0, d - st.length).forEach((p, i) => { rot[p.id] = T.bench[i] ?? T.bench[T.bench.length - 1]; });
    return balanceRotation(rot, players);
  }
  /* scale to exactly 200 (whole minutes, none over 40) */
  function balanceRotation(rot, players) {
    const ids = players.filter(healthy).map(p => p.id).filter(id => (rot[id] || 0) > 0);
    let total = ids.reduce((s, id) => s + rot[id], 0);
    if (!total) return rot;
    const scale = ROT_RULES.total / total;
    ids.forEach(id => { rot[id] = clamp(Math.round(rot[id] * scale), 1, ROT_RULES.maxMinutes); });
    let diff = ROT_RULES.total - ids.reduce((s, id) => s + rot[id], 0), guard = 0;
    const order = [...ids].sort((a, b) => rot[b] - rot[a]);
    while (diff !== 0 && guard++ < 400) {
      for (const id of diff > 0 ? order : [...order].reverse()) {
        if (diff === 0) break;
        const v = rot[id] + Math.sign(diff);
        if (v < 1 || v > ROT_RULES.maxMinutes) continue;
        rot[id] = v; diff -= Math.sign(diff);
      }
    }
    return rot;
  }
  /* What a hand-made rotation will actually be played as: at least 7 men
     (the 6th and 7th at 5+ minutes), nobody over 40, 200 in total.
     Returns { rot, problems } and never changes the original. */
  function checkRotation(rotIn, players) {
    const R = ROT_RULES, rot = {}, problems = [];
    const active = players.filter(healthy);
    players.forEach(p => { rot[p.id] = healthy(p) ? clamp(Math.round(rotIn[p.id] || 0), 0, R.maxMinutes) : 0; });
    const playing = () => active.filter(p => rot[p.id] > 0).sort((a, b) => rot[b.id] - rot[a.id]);
    if (playing().length < R.minDepth) {
      problems.push(`Only ${playing().length} players have minutes; at least ${R.minDepth} need some. The best of the rest get ${R.minBenchMinutes}.`);
      for (const p of active.filter(p => !rot[p.id]).sort((a, b) => ovrOf(b) - ovrOf(a))) { if (playing().length >= R.minDepth) break; rot[p.id] = R.minBenchMinutes; }
    }
    const pl = playing();
    for (let i = 5; i < Math.min(R.minDepth, pl.length); i++) if (rot[pl[i].id] < R.minBenchMinutes) { rot[pl[i].id] = R.minBenchMinutes; problems.push(`${pl[i].name} raised to ${R.minBenchMinutes} minutes (your 6th and 7th men need at least ${R.minBenchMinutes}).`); }
    const total = active.reduce((s, p) => s + rot[p.id], 0);
    if (total !== R.total) {
      problems.push(`Minutes add up to ${total}, not ${R.total}; they'll be scaled to fit.`);
      // keep the 6th/7th-man floor while scaling: scale everyone else
      const floor = new Set(playing().slice(5, R.minDepth).filter(p => rot[p.id] <= R.minBenchMinutes).map(p => p.id));
      const fixed = [...floor].reduce((s, id) => s + rot[id], 0);
      const rest = active.filter(p => rot[p.id] > 0 && !floor.has(p.id));
      const restTotal = rest.reduce((s, p) => s + rot[p.id], 0) || 1;
      rest.forEach(p => { rot[p.id] = rot[p.id] * (R.total - fixed) / restTotal; });
      balanceRotation(rot, players);
    }
    return { rot, problems };
  }
  /* An AI coach's (or an auto-mode user's) depth for tonight: his own
     preference, one shorter if the bench is a big drop-off, one longer if
     it's nearly as good, and one shorter in the postseason. */
  function rotationDepth(team, ctx = {}) {
    const base = team.isUser && team.rotationDepth ? team.rotationDepth : (team.coach.depth || 9);
    const active = team.players.filter(healthy).sort((a, b) => ovrOf(b) - ovrOf(a));
    let d = base;
    if (!(team.isUser && team.rotationDepth)) {
      const top = active.slice(0, 5), bench = active.slice(5, Math.max(6, base));
      const avg = (xs) => xs.length ? xs.reduce((s, p) => s + ovrOf(p), 0) / xs.length : 0;
      const gap = avg(top) - avg(bench);
      if (gap > 10) d--; else if (gap < 4) d++;
    }
    if (ctx.postseason) d--;
    return clamp(Math.min(d, active.length), ROT_RULES.minDepth, ROT_RULES.maxDepth);
  }
  /* auto mode: starters and minutes from tonight's healthy roster */
  function autoRotation(team, ctx = {}) {
    const active = team.players.filter(healthy);
    team.players.forEach(p => { p.starter = false; });
    assignStarters(active);
    const depth = rotationDepth(team, ctx);
    team.rotation = buildRotation(team.players, depth);
    team.rotationDepthUsed = depth;
    return team.rotation;
  }
  /* how many men a coach likes to play (7–10, mostly 8–9). Taken from a
     hash of his name rather than the league's random stream, so the same
     seed still builds the same league. */
  const DEPTH_ODDS = [[7, 0.15], [8, 0.35], [9, 0.35], [10, 0.15]];
  function rollDepth(rand) { let x = rand(); for (const [d, w] of DEPTH_ODDS) { if ((x -= w) <= 0) return d; } return 9; }
  function depthFor(name) { let h = 2166136261; for (const ch of String(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return rollDepth(() => (h >>> 0) / 4294967296); }
  function withDepth(c) { c.depth = depthFor(c.name); return c; }

  /* Team strength for scheduling / preseason expectations: top-heavy weighting. */
  function teamStrength(team) {
    const sorted = team.players.filter(p => !p.redshirt).map(ovrOf).sort((a, b) => b - a);
    const top5 = sorted.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    const next3 = sorted.slice(5, 8).reduce((s, v) => s + v, 0) / Math.max(1, sorted.slice(5, 8).length);
    return +(top5 * 0.8 + next3 * 0.2).toFixed(1);
  }

  /* ---------------- SCHOOLS ---------------- */
  function makeSchool(rand, { id, conf, tier, usedNames, usedAbbr, usedCities = new Set(), def, given = {} }) {
    let name = given.name, tries = 0;
    if (!name) do {
      const place = pick(rand, PLACES), suf = pick(rand, SUFFIX);
      name = (suf ? `${place} ${suf}` : place).trim();
    } while (usedNames.has(name) && ++tries < 60);
    usedNames.add(name);

    let abbr = given.abbr || Sample.autoAbbr(name), t2 = 0;
    if (!given.abbr) while (usedAbbr.has(abbr) && t2 < 26) { abbr = Sample.autoAbbr(name).slice(0, 2) + String.fromCharCode(65 + t2); t2++; }   // a given abbreviation is kept as is
    usedAbbr.add(abbr);

    /* prestige by conference tier, with spread inside each */
    const tierBase = ((def && def.tierPrestige) || { 1: 72, 2: 60, 3: 50, 4: 42 })[tier] ?? 50;
    const rolled = clamp(Math.round(tierBase + ri(rand, -14, 16)), 20, 96);
    const prestige = given.prestige != null ? clamp(Math.round(given.prestige), 20, 96) : rolled;
    const quality = clamp(Math.round(34 + prestige * 0.42 + ri(rand, -4, 4)), 30, 88);
    /* where it is: the file's city, or a city in the conference's footprint */
    const city = given.city && Geo.CITY[given.city] ? given.city : Geo.placeSchool(rand, Geo.statesOf(conf), usedCities);
    usedCities.add(city);

    const school = {
      id, name, abbr, mascot: given.mascot || pick(rand, MASCOTS), color: given.color || pick(rand, COLORS),
      conf: conf.id, region: conf.region, city, area: Geo.areaOf(city),
      prestige,
      /* Big programs pack big buildings. Tied firmly to prestige, but the
         league-wide mean is held steady so home advantage doesn't inflate. */
      homeCourt: clamp(Math.round(prestige * 0.95 + ri(rand, 0, 26) - 17), 10, 99),
      facilities: clamp(Math.round(prestige * 0.7 + ri(rand, -10, 25)), 15, 99),
      nil: clamp(Math.round(prestige * 0.8 + ri(rand, -20, 25)), 5, 99),
      pipelines: null,                 // set by Pipelines.init (or the league file)
      coach: makeCoach(rand, prestige),
      players: makeRoster(rand, id, quality, city),
      isoTarget: null,
      isUser: false,
      record: { w: 0, l: 0, confW: 0, confL: 0, homeW: 0, homeL: 0, awayW: 0, awayL: 0, streak: 0 },
      history: [],
    };
    applyFile(school, given);
    return school;
  }

  /* ---------------- LEAGUE FILES: schools, coaches, rosters ----------------
     Everything above is generated first (same random draws as always), then
     whatever the league file gives replaces it: program ratings, the coach,
     and the roster. A school's file roster may be short: generated players
     fill it to 13. A player given only an overall gets ratings generated to
     match; one given some ratings gets the rest generated around them. */
  const RATING_FIELDS = [...Engine.RATING_KEYS, "stamina"];
  const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
  const ROSTER_SIZE = 13;
  function strHash(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  /* 80, "6-8", "6'8", 6'8" → inches */
  function parseHeight(h) {
    if (typeof h === "number") return Math.round(h);
    const m = String(h || "").match(/^\s*(\d)\s*['\-\s]\s*(\d{1,2})/);
    return m ? +m[1] * 12 + +m[2] : null;
  }
  const workToDev = (w) => +(0.85 + clamp(w, 0, 99) / 99 * 0.4).toFixed(2);
  const devToWork = (d) => clamp(Math.round(((d || 1) - 0.85) / 0.4 * 99), 0, 99);

  function applyFile(t, given) {
    for (const k of ["homeCourt", "facilities", "nil"]) if (given[k] != null) t[k] = clamp(Math.round(given[k]), 1, 99);
    if (given.pipelines && typeof given.pipelines === "object") {
      t.pipelines = {};
      for (const a in given.pipelines) if (Geo.AREA[a]) t.pipelines[a] = clamp(Math.round(+given.pipelines[a] || 0), 0, 100);
    }
    if (given.coach) {
      const c = given.coach;
      for (const k of ["rating", "recruiting", "development", "scouting"]) if (c[k] != null) t.coach[k] = clamp(Math.round(c[k]), 25, 99);
      if (c.offense && TUNING.styles.offense[c.offense]) t.coach.offense = c.offense;
      if (c.defense && TUNING.styles.defense[c.defense]) t.coach.defense = c.defense;
      if (c.years != null) t.coach.years = Math.max(0, Math.round(c.years));
      if (c.name) { t.coach.name = String(c.name); withDepth(t.coach); }
    }
    if (Array.isArray(given.players) && given.players.length) {
      const rand = Engine.makeRng(strHash(t.id + "|" + t.name + "|roster"));
      const level = clamp(Math.round(34 + t.prestige * 0.42), 30, 88);   // the school's usual roster quality
      const mine = given.players.slice(0, ROSTER_SIZE).map((g, i) => filePlayer(rand, `${t.id}-p${i + 1}`, g, t.city, level));
      // short roster: generated players fill it (positions the file is thinnest at first)
      const fill = t.players.slice().sort((a, b) => mine.filter(p => p.pos === a.pos).length - mine.filter(p => p.pos === b.pos).length);
      let n = mine.length;
      while (mine.length < ROSTER_SIZE && fill.length) { const p = fill.shift(); p.id = `${t.id}-p${++n}`; mine.push(p); }
      t.players = mine;
      assignStarters(t.players);
    }
  }

  /* one player from a league file */
  function filePlayer(rand, id, g, city, level = 55) {
    const pos = POSITIONS.includes(g.pos) ? g.pos : "SF";
    const cls = CLASSES.includes(g.class) ? g.class : "FR";
    const given = g.ratings || {};
    const target = g.ovr != null ? clamp(Math.round(g.ovr), 25, 99) : null;
    // generate around the target overall (or, without one, the school's level for his class),
    // put in the ratings the file gives, then nudge the generated ones onto the target
    const known = RATING_FIELDS.filter(k => given[k] != null);
    const guess = target != null ? target : clamp(level + { SR: 5, JR: 2, SO: -2, FR: -7 }[cls], 25, 95);
    const base = Sample.generatePlayer(rand, { id, pos, base: guess, quality: guess });
    for (const k of known) base.ratings[k] = clamp(Math.round(given[k]), 1, 99);
    if (target != null) {
      const free = RATING_FIELDS.filter(k => given[k] == null && k !== "stamina");
      for (let i = 0; i < 4 && free.length; i++) {
        const diff = target - Engine.overall(TUNING, pos, base.ratings);
        if (!diff) break;
        for (const k of free) base.ratings[k] = clamp(base.ratings[k] + diff, 1, 99);
      }
    }
    if (g.name) base.name = String(g.name);
    const h = parseHeight(g.height); if (h) base.height = clamp(h, 64, 92);
    if (g.archetype) base.archetype = String(g.archetype);
    base.wildcard = g.wildcard || null;
    const home = g.home && Geo.CITY[g.home] ? g.home : Geo.hometown(rand, city, Geo.CFG.rosterLocal).key;
    const p = dynastyPlayer(rand, base, { cls, quality: guess, home });
    const ovr = Engine.overall(TUNING, pos, p.ratings);
    if (g.potential != null) p.potential = clamp(Math.round(g.potential), ovr, 99);
    if (g.redshirt) p.redshirt = true;
    if (g.redshirtUsed) p.redshirtUsed = true;
    if (TEMPERAMENTS.includes(g.temperament)) { p.temperament = g.temperament; p.loyalty = null; loyaltyOf(p); }
    if (g.loyalty != null) p.loyalty = clamp(Math.round(g.loyalty), 0, 99);
    if (g.moneyWeight != null) p.moneyWeight = clamp(+g.moneyWeight, 0, 1);
    if (g.workRate != null) p.devRate = workToDev(g.workRate);
    return p;
  }

  /* A league as a league file: every school with its program ratings, coach
     and roster, so it can be edited and imported to start a new dynasty
     exactly as it is. Works on a fresh league or one in progress (today's
     rosters, prestige and coaches). */
  /* one player / one school as they appear in a league file */
  function playerToFile(p) {
    const o = { name: p.name, pos: p.pos, class: p.class, height: p.height, ovr: ovrOf(p), potential: p.potential,
      ratings: Object.fromEntries(RATING_FIELDS.map(k => [k, Math.round(p.ratings[k])])),
      archetype: p.archetype || undefined, temperament: p.temperament, loyalty: loyaltyOf(p),
      moneyWeight: p.moneyWeight != null ? +p.moneyWeight.toFixed(2) : undefined, workRate: devToWork(p.devRate), home: p.home || undefined };
    if (p.redshirt) o.redshirt = true;
    if (p.redshirtUsed) o.redshirtUsed = true;
    if (p.wildcard) o.wildcard = p.wildcard;
    return o;
  }
  function schoolToFile(t) {
    return {
      name: t.name, mascot: t.mascot, abbr: t.abbr, color: t.color, prestige: t.prestige, city: t.city,
      homeCourt: t.homeCourt, facilities: t.facilities, nil: t.nil,
      pipelines: t.pipelines ? Object.fromEntries(Object.entries(t.pipelines).map(([a, v]) => [a, Math.round(v)])) : undefined,
      coach: { name: t.coach.name, rating: t.coach.rating, recruiting: t.coach.recruiting, development: t.coach.development, scouting: t.coach.scouting,
        offense: t.coach.offense, defense: t.coach.defense, years: t.coach.years },
      players: t.players.map(playerToFile) };
  }
  function exportDefinition(lg, meta = {}) {
    const rules = lg.league && lg.league.rules;
    return {
      format: "hoops-league", version: 1,
      id: meta.id || ((lg.league && lg.league.id) || "custom") + "-edit",
      name: meta.name || ((lg.league && lg.league.name) || "Custom") + " (edited)",
      blurb: meta.blurb || "", rules, defaultConf: meta.defaultConf || (lg.teams.find(t => t.isUser) || {}).conf || lg.conferences[0].id,
      conferences: lg.conferences.map(c => ({ id: c.id, name: c.name, short: c.short, tier: c.tier, size: c.teamIds.length, region: c.region, states: c.states && c.states.length ? c.states : undefined,
        schools: c.teamIds.map(id => schoolToFile(lg.byId[id])) })),
    };
  }

  /* ---------------- BUILD ---------------- */
  /* opts.league: a league definition id ("compact") or a definition object */
  function generateLeague(seed, opts = {}) {
    const rand = Engine.makeRng(seed);
    const def = Leagues.get(opts.league);
    const usedNames = new Set(), usedAbbr = new Set(), usedCities = new Set();
    for (const c of def.conferences) for (const s of c.schools || []) { if (s.name) usedNames.add(s.name); if (s.abbr) usedAbbr.add(s.abbr); if (s.city) usedCities.add(s.city); }
    const teams = [], conferences = def.conferences.map(({ schools, ...c }) => ({ ...c, teamIds: [] }));

    for (const [ci, conf] of conferences.entries()) {
      const given = def.conferences[ci].schools || [];
      for (let i = 0; i < conf.size; i++) {
        const t = makeSchool(rand, { id: `${conf.id}${i + 1}`, conf, tier: conf.tier, usedNames, usedAbbr, usedCities, def, given: given[i] || {} });
        teams.push(t);
        conf.teamIds.push(t.id);
      }
    }

    /* the user's program: takes over an existing school as it is ... */
    const takeOver = opts.userTeam && opts.userTeam.takeOver && teams.find(t => t.id === opts.userTeam.takeOver);
    if (takeOver) {
      takeOver.isUser = true;
      if (opts.userTeam.coachName) takeOver.coach.name = opts.userTeam.coachName;
    }
    /* ... or replaces a school in the chosen conference */
    else if (opts.userTeam) {
      const conf = conferences.find(c => c.id === opts.userTeam.conf) || conferences[0];
      const idx = teams.findIndex(t => t.conf === conf.id);
      const slot = teams[idx];
      Object.assign(slot, {
        name: opts.userTeam.name || slot.name,
        mascot: opts.userTeam.mascot || slot.mascot,
        abbr: (opts.userTeam.abbr || slot.abbr).toUpperCase(),
        color: opts.userTeam.color || slot.color,
        isUser: true,
      });
      // abbreviations identify schools in history, records and the Hall of Fame: yours must be unique
      const taken = new Set(teams.filter(t => t !== slot).map(t => t.abbr));
      if (taken.has(slot.abbr)) { const base = slot.abbr.slice(0, 3); let n = 2; while (taken.has(base + n)) n++; slot.abbr = base + n; }
      // your program's city (it replaces this school, so it can be anywhere)
      if (opts.userTeam.city && Geo.CITY[opts.userTeam.city] && opts.userTeam.city !== slot.city) {
        slot.city = opts.userTeam.city; slot.area = Geo.areaOf(slot.city); slot.pipelines = null;
        if (opts.userTeam.prestige == null) slot.players = makeRoster(rand, slot.id, clamp(Math.round(34 + slot.prestige * 0.42), 30, 88), slot.city);
      }
      if (opts.userTeam.prestige != null) {
        /* the building, the boosters and the facilities follow the prestige
           you picked (keeping this school's own random lean from generation) */
        const old = slot.prestige, P = opts.userTeam.prestige;
        const lean = (v, mean) => clamp(v - mean, -8, 8);   // a smaller version of this slot's own lean
        slot.homeCourt = clamp(Math.round(P * 0.95 - 4 + lean(slot.homeCourt, old * 0.95 - 4)), 10, 99);
        slot.facilities = clamp(Math.round(P * 0.7 + 7.5 + lean(slot.facilities, old * 0.7 + 7.5)), 15, 99);
        slot.nil = clamp(Math.round(P * 0.8 + 2.5 + lean(slot.nil, old * 0.8 + 2.5)), 5, 99);
        slot.prestige = opts.userTeam.prestige;
        slot.players = makeRoster(rand, slot.id, clamp(Math.round(34 + slot.prestige * 0.42), 30, 88), slot.city);
      }
      if (opts.userTeam.coachName) slot.coach.name = opts.userTeam.coachName;
    }

    for (const t of teams) pickIsoTarget(t);
    /* starting pipelines (its own random stream: the league above is unchanged by it) */
    Pipelines.init({ teams }, Engine.makeRng((seed ^ 0x919e) >>> 0));

    return {
      seed, season: opts.startYear || 2027, startYear: opts.startYear || 2027,
      league: { id: def.id || "custom", name: def.name || "Custom", teams: teams.length, rules: Leagues.rulesFor(def) },   // which definition built it, and its rules
      conferences, teams,
      byId: Object.fromEntries(teams.map(t => [t.id, t])),
    };
  }

  /* LOYALTY 0–99: how much he sticks around. It sits inside a band set by
     his temperament (restless 10–29, ambitious 30–49, steady 50–74, loyal
     75–95) and comes from a hash of his id, so it never touches the
     league's random stream. Transfer odds scale with it. */
  const LOYALTY_BAND = { restless: [10, 29], ambitious: [30, 49], steady: [50, 74], loyal: [75, 95] };
  function loyaltyOf(p) {
    if (p.loyalty != null) return p.loyalty;
    const [a, b] = LOYALTY_BAND[p.temperament] || LOYALTY_BAND.steady;
    let h = 2166136261; for (const c of String(p.id) + "|loyalty") h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    p.loyalty = a + ((h >>> 0) % (b - a + 1));
    return p.loyalty;
  }

  /* HOW LONG A DYNASTY RUNS. After the last season's offseason the game
     stops; export the league file (schools, coaches, rosters as they are)
     to keep going in a fresh dynasty. Long runs were checked out to this
     length with tests/longrun.js. */
  const MAX_SEASONS = 50;
  const startYearOf = (lg) => lg.startYear ?? Math.min(lg.season, ...lg.teams.flatMap(t => t.history.slice(0, 1).map(h => h.year)));
  /* which season this is (1 = the first), and whether the dynasty is over (the offseason after the last one is done) */
  const seasonNumber = (lg) => lg.season - startYearOf(lg) + 1;
  const dynastyOver = (lg) => seasonNumber(lg) > MAX_SEASONS;

  /* JERSEY NUMBERS: basketball's usual set (digits 0–5 only). Everyone on a
     team has his own, never one the school has retired. A player keeps his
     number (a transfer too, if it's free at his new school); anyone without
     one, or sharing one, gets a free number picked from a hash of his id.
     Called at the start of every season, so every newcomer is covered. */
  const NUMBERS = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 40, 41, 42, 43, 44, 45, 50, 51, 52, 53, 54, 55];
  function assignNumbers(team) {
    const retired = new Set((team.jerseys || []).map(j => j.num).filter(n => n != null));
    const taken = new Set(), need = [];
    for (const p of team.players) {
      if (p.num != null && !taken.has(p.num) && !retired.has(p.num)) taken.add(p.num);
      else need.push(p);
    }
    for (const p of need) {
      const free = NUMBERS.filter(n => !taken.has(n) && !retired.has(n));
      let h = 2166136261; for (const ch of String(p.id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      p.num = free.length ? free[(h >>> 0) % free.length] : 99;
      taken.add(p.num);
    }
  }

  const League = {
    MAX_SEASONS, startYearOf, seasonNumber, dynastyOver, NUMBERS, assignNumbers,
    loyaltyOf, LOYALTY_BAND,
    generateLeague, makeRoster, makeSchool, makeCoach, dynastyPlayer, assignStarters,
    OFFENSE_WEIGHTS, DEFENSE_WEIGHTS, buildRotation, ROTATION, DEPTH_MINUTES, ROT_RULES, balanceRotation, checkRotation, rotationDepth, autoRotation, rollDepth, depthFor,
    teamStrength, ovrOf, classLabel, aiRedshirts, grade, emptySeasonStats, pickIsoTarget,
    REGIONS, Geo, CONFERENCES, CLASSES, PREFERENCES, MASCOTS, COLORS, PLACES, exportDefinition, playerToFile, schoolToFile, filePlayer, parseHeight, RATING_FIELDS, ROSTER_SIZE, TEMPERAMENTS, workToDev, devToWork,
  };
  if (typeof module !== "undefined") module.exports = League;
  else root.League = League;
})(typeof window !== "undefined" ? window : globalThis);
