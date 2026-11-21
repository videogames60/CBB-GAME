/* =====================================================================
   HOOPS DYNASTY — SEASON
   Schedule, day-by-day simulation, standings, and season statistics.

   The sim engine is used for every game in the country. A full slate of
   ~50 games takes well under a second, so nothing here is approximated.
   Only the user's games keep a full box score; everyone else rolls up
   into season totals.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const TUNING = req ? require("../sim/tuning.js") : root.TUNING;
  const League = req ? require("./league.js") : root.League;
  /* the staff rating (50% head coach, 25% each assistant: coaches.js) */
  const staffR = (team, key) => { const C = req ? require("./coaches.js") : root.Coaches; return C ? C.rating(team, key) : (team.coach[key] ?? 50); };

  /* league rules (game counts, tournament sizes) come from the league
     definition: lg.league.rules, see Leagues.rulesFor */
  const awardsModule = () => req ? require("./awards.js") : root.Awards;
  const recordsModule = () => req ? require("./records.js") : root.Records;
  const rulesOf = (lg) => (lg.league && lg.league.rules) || { nonConfGames: 11, confGames: 0, confTourney: 8, natField: 16 };

  const SCHEDULE = {
    nonConfGames: 11,        // per team (the league's rules override this)
    minGap: 2,               // days between any team's games (1 = back-to-back allowed)
    confStart: 42,           // day index conference play begins
    confSpacing: 3,
    keepBoxScores: 8,        // recent full box scores kept for the user's team
  };

  const POST = {
    /* field sizes are league rules (confTourney, natField): lg.league.rules */
    restDays: 2,             // days between postseason rounds
    breakAfterRegular: 2,    // rest before conference tournaments
    breakAfterConf: 1,       // days between conference finals and Selection Sunday
    breakAfterSelection: 3,  // ... and before the national tournament tips
  };

  /* ---------------- SCHEDULE ---------------- */
  /* Circle method: a double round-robin inside each conference, plus a
     non-conference slate weighted toward similar-strength opponents. */
  function roundRobin(ids) {
    const arr = ids.slice();
    if (arr.length % 2) arr.push(null);
    const n = arr.length, rounds = [];
    let rot = arr.slice(1);
    for (let r = 0; r < n - 1; r++) {
      const order = [arr[0], ...rot], pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = order[i], b = order[n - 1 - i];
        if (a && b) pairs.push(r % 2 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      rot.unshift(rot.pop());
    }
    return rounds;
  }

  function buildSchedule(lg, rand) {
    const games = [];
    let gid = 0;
    const add = (day, home, away, type) => {
      games.push({ id: gid++, day, home, away, type, played: false, homeScore: null, awayScore: null, result: null });
    };

    /* --- non-conference: every team gets exactly nonConfGames ---
       Greedy pairing: always serve the team with the greatest remaining need,
       preferring a similar-strength, out-of-conference opponent it hasn't met. */
    const RU = rulesOf(lg);
    const need = Object.fromEntries(lg.teams.map(t => [t.id, RU.nonConfGames]));
    const strength = Object.fromEntries(lg.teams.map(t => [t.id, League.teamStrength(t)]));
    const window = Math.max(20, Math.round(lg.teams.length / 5));
    const nearCache = {};
    const nearest = (a) => nearCache[a] || (nearCache[a] = lg.teams.map(t => t.id).filter(id => id !== a).sort((x, y) => Math.abs(strength[x] - strength[a]) - Math.abs(strength[y] - strength[a])));
    const metBy = Object.fromEntries(lg.teams.map(t => [t.id, new Set()]));   // who has already met whom
    const meet = (a, b) => { metBy[a].add(b); metBy[b].add(a); };
    const homeCount = Object.fromEntries(lg.teams.map(t => [t.id, 0]));

    /* per-team busy calendar so nobody plays twice in a day or on tired legs */
    const busy = Object.fromEntries(lg.teams.map(t => [t.id, new Set()]));
    const canPlay = (id, day) => {
      for (let d = day - SCHEDULE.minGap + 1; d <= day + SCHEDULE.minGap - 1; d++) if (busy[id].has(d)) return false;
      return true;
    };
    const book = (id, day) => busy[id].add(day);

    let guard = 0;
    while (guard++ < 60000) {
      // the team with the most games still to book (ties broken at random)
      let top = -1, ties = [], openCount = 0;
      for (const t of lg.teams) {
        const n = need[t.id]; if (n <= 0) continue; openCount++;
        if (n > top) { top = n; ties = [t.id]; } else if (n === top) ties.push(t.id);
      }
      if (openCount < 2) break;
      const a = ties[Math.floor(rand() * ties.length)];

      // open opponents nearest in strength (the nearest 20, or a fifth of a big
      // league, so big schools still host small ones): out of conference and new first
      const near = nearest(a), ma = metBy[a], confA = lg.byId[a].conf;
      const collect = (ok) => { const out = []; for (const b of near) { if (need[b] > 0 && ok(b)) { out.push(b); if (out.length >= window) break; } } return out; };
      let cands = collect(b => lg.byId[b].conf !== confA && !ma.has(b));
      if (!cands.length) cands = collect(b => !ma.has(b));        // allow same conference
      if (!cands.length) cands = collect(() => true);             // allow a rematch
      if (!cands.length) { need[a] = 0; continue; }
      const b = cands[Math.floor(Math.pow(rand(), 2) * cands.length)];

      // find a day both teams are free (with the gap); scan from a random start
      const lastNC = SCHEDULE.confStart - 3;
      const start = 2 + Math.floor(rand() * (lastNC - 2));
      let day = -1;
      for (let k = 0; k < lastNC; k++) {
        const d = 2 + ((start - 2 + k) % (lastNC - 1));
        if (canPlay(a, d) && canPlay(b, d)) { day = d; break; }
      }
      if (day < 0) { meet(a, b); continue; }   // no shared free day; try another pairing

      meet(a, b);
      need[a]--; need[b]--;
      book(a, day); book(b, day);
      const aHome = homeCount[a] === homeCount[b] ? rand() < 0.5 : homeCount[a] < homeCount[b];
      const home = aHome ? a : b, away = aHome ? b : a;
      homeCount[home]++;
      add(day, home, away, "nc");
    }

    /* --- conference: everyone home and away, or for a big conference
       (rules.confGames) everyone once plus enough return games to reach
       the count, the return legs picked at random --- */
    for (const conf of lg.conferences) {
      const rounds = roundRobin(conf.teamIds);
      const back = rounds.map(r => r.map(([h, a]) => [a, h]));
      let all = [...rounds, ...back];
      const want = RU.confGames || 0;
      if (want > 0 && want < 2 * (conf.teamIds.length - 1)) {
        const extra = back.slice();
        for (let i = extra.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [extra[i], extra[j]] = [extra[j], extra[i]]; }
        all = rounds.slice();
        const played = (id) => all.reduce((n, r) => n + r.filter(p => p[0] === id || p[1] === id).length, 0);
        while (extra.length && Math.min(...conf.teamIds.map(played)) < want) all.push(extra.shift());
      }
      all.forEach((pairs, i) => {
        const day = SCHEDULE.confStart + i * SCHEDULE.confSpacing;
        pairs.forEach(([h, a]) => add(day, h, a, "conf"));
      });
    }

    games.sort((x, y) => x.day - y.day || x.id - y.id);
    games.forEach((g, i) => { g.id = i; });
    return games;
  }

  /* ---------------- SIM ONE GAME ---------------- */
  /* ctx.postseason: AI coaches (and auto-mode users) shorten the bench by one.
     A hand-set rotation is played as set, after the 7-man / 200-minute check. */
  function toSimTeam(team, isHome, ctx = {}) {
    let rotation;
    if (team.isUser && team.rotationMode === "manual" && team.rotation) rotation = League.checkRotation(team.rotation, team.players).rot;
    else rotation = League.autoRotation(team, ctx);
    return {
      id: team.id, name: team.name, mascot: team.mascot, abbr: team.abbr, color: team.color,
      coach: {
        rating: staffR(team, "rating"), offense: team.coach.offense,
        defense: team.coach.defense, lateGame: team.coach.lateGame || "auto",
      },
      control: "auto",
      rotation,
      isoTarget: team.isoTarget || null,
      players: team.players.filter(p => !p.redshirt && !p.injured).map(p => ({
        id: p.id, name: p.name, num: p.num, pos: p.pos, height: p.height, starter: !!p.starter,
        ratings: p.ratings, archetype: p.archetype,
      })),
    };
  }

  /* Home court is applied inside the engine (tuning.homeCourt), scaled by the
     home school's homeCourt rating. Nothing to do here but pass it through. */

  function simGame(lg, game, seed, opts = {}) {
    const home = lg.byId[game.home], away = lg.byId[game.away];
    const neutral = !!game.neutral;
    const ctx = { postseason: game.type === "ct" || game.type === "nt" };
    const g = Engine.createGame(toSimTeam(home, true, ctx), toSimTeam(away, false, ctx),
      { seed, debug: !!opts.debug, events: !!opts.debug, homeCourt: neutral ? null : home.homeCourt });
    Engine.simulateGame(g);
    const box = Engine.boxScore(g);
    return { g, box };
  }

  /* ---------------- STAT ROLLUP ---------------- */
  const STAT_KEYS = ["sec", "pts", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "oreb", "dreb", "ast", "stl", "blk", "tov", "pf"];

  /* the top 25 a game is played against: this week's AP poll, or before
     the first poll, the 25 strongest rosters */
  function topIds(lg, season) {
    const ap = season && season.rankings && season.rankings.ap;
    if (ap && ap.length) return new Set(ap.map(r => r.id));
    return new Set([...lg.teams].sort((a, b) => League.teamStrength(b) - League.teamStrength(a)).slice(0, 25).map(t => t.id));
  }

  function applyBox(lg, game, box, keepBox, season) {
    const home = lg.byId[game.home], away = lg.byId[game.away];
    const post = game.type === "ct" || game.type === "nt";
    const top = topIds(lg, season);
    const Awards = awardsModule(), Records = recordsModule();
    const hs = box.score[0], as = box.score[1];
    game.played = true; game.homeScore = hs; game.awayScore = as;
    game.ot = box.periods > 2 ? box.periods - 2 : 0;
    const ht = box.teams[0].totals;
    game.poss = +(ht.fga - ht.oreb + ht.tov + 0.475 * ht.fta).toFixed(1);

    [[home, box.teams[0], hs, as, true], [away, box.teams[1], as, hs, false]].forEach(([team, side, pf, pa, isHome]) => {
      const won = pf > pa;
      const r = team.record;
      won ? r.w++ : r.l++;
      if (game.type === "conf") won ? r.confW++ : r.confL++;
      if (isHome) won ? r.homeW++ : r.homeL++; else won ? r.awayW++ : r.awayL++;
      r.streak = won ? (r.streak >= 0 ? r.streak + 1 : 1) : (r.streak <= 0 ? r.streak - 1 : -1);
      if (r.streak > (r.best || 0)) r.best = r.streak;   // longest winning streak this season (records)
      const opp = isHome ? away : home;
      if (Records) Records.onTeamGame(lg, season, team, opp, pf, pa);
      team.ptsFor = (team.ptsFor || 0) + pf;
      team.ptsAgainst = (team.ptsAgainst || 0) + pa;
      const poss = side.totals.fga - side.totals.oreb + side.totals.tov + 0.475 * side.totals.fta;
      team.possFor = (team.possFor || 0) + poss;

      const byId = Object.fromEntries(team.players.map(p => [p.id, p]));
      for (const row of side.players) {
        const p = byId[row.id];
        if (!p) continue;
        if (row.sec > 0) {
          p.season.gp++; if (row.starter) p.season.gs++;
          if (post) p.season.postGp = (p.season.postGp || 0) + 1;                       // development: big stage
          if (top.has(isHome ? game.away : game.home)) p.season.qualityGp = (p.season.qualityGp || 0) + 1;
        }
        else { p.season.dnp++; continue; }
        for (const k of STAT_KEYS) p.season[k] += row[k] || 0;
        if (post && Awards) Awards.onGame(lg, game, row, p);   // conference / national tournament lines (tournament awards)
        if (Records) Records.onPlayerGame(lg, season, team, opp, row, p);
      }
      team.games = (team.games || 0) + 1;
    });

    if (Awards) Awards.recordSeries(lg, game);   // all-time head-to-head
    game.result = {
      home: { score: hs, top: topScorer(box.teams[0]) },
      away: { score: as, top: topScorer(box.teams[1]) },
    };
    if (keepBox) game.box = box;
  }

  function topScorer(side) {
    const p = [...side.players].sort((a, b) => b.pts - a.pts)[0];
    return p ? { name: p.name, pts: p.pts, reb: p.oreb + p.dreb, ast: p.ast } : null;
  }

  /* ---------------- SEASON CONTROL ---------------- */
  function startSeason(lg, seed) {
    const rand = Engine.makeRng(seed ^ 0x5eed);
    lg.teams.forEach(t => {
      t.record = { w: 0, l: 0, confW: 0, confL: 0, homeW: 0, homeL: 0, awayW: 0, awayL: 0, streak: 0 };
      t.ptsFor = 0; t.ptsAgainst = 0; t.possFor = 0; t.games = 0;
      t.players.forEach(p => { p.season = League.emptySeasonStats(); });
      League.assignNumbers(t);   // jersey numbers for newcomers (and anyone who lost his to a retired jersey)
      if (!t.isUser) League.aiRedshirts(t);
      if (!(t.isUser && t.rotationMode === "manual")) League.autoRotation(t);
    });
    const games = buildSchedule(lg, rand);
    const lastDay = games.reduce((m, g) => Math.max(m, g.day), 0);
    const Awards = awardsModule();
    if (Awards) Awards.preseason(lg);   // preseason Player of the Year, All-Americans, All-Conference (display only)
    return { games, day: 0, lastDay, endDay: lastDay, seed, byDay: groupByDay(games), post: null };
  }

  function groupByDay(games) {
    const m = {};
    for (const g of games) (m[g.day] = m[g.day] || []).push(g);
    return m;
  }

  /* Simulate every game on the current day. Returns the games played. */
  function simDay(lg, season, opts = {}) {
    const today = season.byDay[season.day] || [];
    const played = [];
    for (const game of today) {
      if (game.played) continue;
      const isUser = lg.byId[game.home].isUser || lg.byId[game.away].isUser;
      if (isUser && opts.skipUser) continue;
      const { box } = simGame(lg, game, hash(season.seed, game.id));
      applyBox(lg, game, box, isUser, season);
      played.push(game);
    }
    if (opts.skipUser && today.some(g => !g.played)) return played;   // user game left: day stays open
    finishDay(lg, season);
    return played;
  }

  /* the end-of-day bookkeeping: clock forward, weekly polls, postseason,
     recruiting (weekly tick, then signing day once the champion is crowned) */
  function finishDay(lg, season) {
    trimBoxScores(lg, season);
    season.day++;
    maybeUpdateRankings(lg, season);
    if (season.day > season.lastDay) {
      if (!season.post) startConfTourneys(lg, season);
      advancePostseason(lg, season);
    }
    const Recruiting = req ? require("./recruiting.js") : (typeof window !== "undefined" ? window.Recruiting : globalThis.Recruiting);
    if (Recruiting && lg.recruiting) Recruiting.onDay(lg, season);
  }

  /* ---- live (user-coached) games ----
     prepareLiveDay: fast-forwards to the user's next game, sims everyone
     else that day, and returns { game, home, away, seed } ready for
     Engine.createGame. The day stays open until finishLiveGame is called
     with the finished engine game's box score. */
  function prepareLiveDay(lg, season) {
    const r = simToNextUserGame(lg, season, "stop");
    if (r.stop !== "user_game") return null;
    simDay(lg, season, { skipUser: true });   // everyone else plays; day stays open
    const game = r.game;
    return {
      game, played: r.played,
      home: lg.byId[game.home], away: lg.byId[game.away],
      seed: hash(season.seed, game.id),
      homeCourt: game.neutral ? null : lg.byId[game.home].homeCourt,
    };
  }
  function finishLiveGame(lg, season, game, box) {
    applyBox(lg, game, box, true, season);
    finishDay(lg, season);
  }

  function trimBoxScores(lg, season) {
    const withBox = season.games.filter(g => g.box);
    if (withBox.length > SCHEDULE.keepBoxScores) {
      withBox.slice(0, withBox.length - SCHEDULE.keepBoxScores).forEach(g => { delete g.box; });
    }
  }

  const hash = (a, b) => (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)) >>> 0;

  /* weekly poll day: every 7th day of season time */
  function maybeUpdateRankings(lg, season) {
    const Rankings = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./rankings.js") : (typeof window !== "undefined" ? window.Rankings : globalThis.Rankings);
    if (season.day - (season.lastPollDay || 0) >= 7 || season.day > season.lastDay) {
      season.lastPollDay = season.day;
      Rankings.updateWeekly(lg, season);
    }
  }

  function maxDay(season) { return season.endDay || season.lastDay; }

  /* Advance day by day until the user's team has a game.
       mode "stop"  → stop on the day BEFORE the user's game is simulated
       mode "play"  → simulate that day (user's game included) and stop
     Returns { stop, day, game, played }. */
  function simToNextUserGame(lg, season, mode = "stop") {
    const out = [];
    const isUserGame = (g) => !g.played && (lg.byId[g.home].isUser || lg.byId[g.away].isUser);
    while (!seasonComplete(season)) {
      const today = season.byDay[season.day] || [];
      const userGame = today.find(isUserGame);
      if (userGame) {
        if (mode === "stop") return { stop: "user_game", day: season.day, game: userGame, played: out };
        out.push(...simDay(lg, season));
        return { stop: "played_user_game", day: season.day - 1, game: userGame, played: out };
      }
      out.push(...simDay(lg, season));
    }
    return { stop: "season_over", played: out };
  }

  function regularSeasonComplete(season) { return season.day > season.lastDay; }
  function seasonComplete(season) { return regularSeasonComplete(season) && season.post && season.post.phase === "done" && season.day > (season.endDay || 0); }

  /* ---------------- POSTSEASON ----------------
     Runs through the same simDay loop. Rounds are scheduled onto real days,
     the next round's games appear when the previous one finishes, and the
     user's games still stop the fast-forward. */

  function schedulePostGame(season, day, home, away, type, tag) {
    const g = { id: season.games.length, day, home, away, type, tag, neutral: true, played: false, homeScore: null, awayScore: null, result: null };
    season.games.push(g);
    (season.byDay[day] = season.byDay[day] || []).push(g);
    season.endDay = Math.max(season.endDay || season.lastDay, day);
    return g;
  }

  /* ---- brackets of any size ----
     A bracket is a list of entries in bracket order, each a team ({ id }),
     an empty slot ({ bye }) or the winner of a game still to finish
     ({ game }). Each round pairs neighbours: a team next to a bye goes
     through, two teams play. A field that isn't a power of two gets byes
     for its top seeds; the national tournament can start with play-in
     games instead (68 = 64 + a First Four). */
  function bracketOrder(n) {         // seeds in bracket order for a power of two: 1,16,8,9,5,12,...
    if (n === 1) return [1];
    const p = bracketOrder(n / 2), r = [];
    for (const x of p) r.push(x, n + 1 - x);
    return r;
  }
  const pow2Up = (n) => { let s = 1; while (s < n) s *= 2; return s; };
  const pow2Down = (n) => { let s = 1; while (s * 2 <= n) s *= 2; return s; };
  const winnerOf = (g) => g.homeScore > g.awayScore ? g.home : g.away;

  function roundName(slots, national, big) {
    if (slots === 2) return national ? "Championship" : "Final";
    if (slots === 4) return big ? "Final Four" : "Semifinals";
    if (slots === 8) return big ? "Elite Eight" : "Quarterfinals";
    if (big && slots === 16) return "Sweet 16";
    return national ? `Round of ${slots}` : "First round";
  }

  /* play the next round of a bracket starting on `day`; the round's games
     can be spread over `spread` days */
  function pairRound(season, B, day, type, tagOf, spread = 1) {
    const next = [], gids = [], slots = B.entries.length;
    for (let i = 0; i < slots; i += 2) {
      const a = B.entries[i], b = B.entries[i + 1];
      if (a.bye && b.bye) next.push({ bye: true });
      else if (b.bye) next.push(a);
      else if (a.bye) next.push(b);
      else {
        const k = gids.length;
        const g = schedulePostGame(season, day + (k % spread), a.id, b.id, type, tagOf(i / 2, slots / 2));
        gids.push(g.id); next.push({ game: g.id });
      }
    }
    B.entries = next;
    if (gids.length) { B.rounds.push(gids); B.roundNames.push(roundName(slots, type === "nt", !!B.big)); }
    return gids.length;
  }

  /* when the latest round is over: winners move up, the next round is set.
     Returns "waiting", "next" or "champion". */
  function stepBracket(season, B, type, tagOf, spread = 1) {
    const last = B.rounds[B.rounds.length - 1] || [];
    const games = last.map(id => season.games[id]);
    if (games.some(g => !g.played)) return "waiting";
    B.entries = B.entries.map(e => e.game != null ? { id: winnerOf(season.games[e.game]) } : e);
    if (B.entries.length === 1) { B.champion = B.entries[0].id; return "champion"; }
    const day = (games.length ? Math.max(...games.map(g => g.day)) : season.lastDay) + POST.restDays;
    while (!pairRound(season, B, day, type, tagOf, spread) && B.entries.length > 1) {}   // a round of only byes plays nothing
    if (B.entries.length === 1 && B.entries[0].id) { B.champion = B.entries[0].id; return "champion"; }
    return "next";
  }

  function startConfTourneys(lg, season) {
    const P = season.post = { phase: "confTourney", conf: {}, autobids: {}, log: [] };
    const day0 = season.lastDay + POST.breakAfterRegular;
    const cap = rulesOf(lg).confTourney;
    for (const conf of lg.conferences) {
      const ranked = standings(lg, conf.id);
      const field = ranked.slice(0, cap > 0 ? Math.min(cap, ranked.length) : ranked.length);
      const seeds = field.map((r, i) => ({ seed: i + 1, id: r.id }));
      const size = pow2Up(seeds.length);
      const B = { seeds, rounds: [], roundNames: [], champion: null,
        entries: bracketOrder(size).map(sd => sd <= seeds.length ? { id: seeds[sd - 1].id } : { bye: true }) };
      P.conf[conf.id] = B;
      if (seeds.length === 1) { B.champion = seeds[0].id; P.autobids[conf.id] = B.champion; continue; }
      pairRound(season, B, day0, "ct", (slot) => ({ conf: conf.id, round: B.rounds.length, slot }));
    }
  }

  /* called after each simulated day: advance any bracket whose round finished */
  function advancePostseason(lg, season) {
    const P = season.post;
    if (!P || P.phase === "done") return;

    if (P.phase === "confTourney") {
      let allDone = true;
      for (const conf of lg.conferences) {
        const B = P.conf[conf.id];
        if (B.champion) continue;
        const r = stepBracket(season, B, "ct", (slot) => ({ conf: conf.id, round: B.rounds.length, slot }));
        if (r === "champion") {
          P.autobids[conf.id] = B.champion;
          P.log.push(`${lg.byId[B.champion].name} wins the ${conf.name} tournament (auto bid).`);
        } else allDone = false;
      }
      if (allDone && Object.keys(P.autobids).length === lg.conferences.length) {
        selectionSunday(lg, season);
        if (awardsModule()) awardsModule().regular(lg, season);   // the season's awards
      }
      return;
    }

    if (P.phase === "national") {
      const N = P.national;
      const r = stepBracket(season, N, "nt", nationalTag(N), 2);
      if (r === "champion") {
        P.phase = "done";
        P.log.push(`${lg.byId[N.champion].name} are national champions.`);
        if (awardsModule()) awardsModule().final(lg, season);   // Most Outstanding Player
      }
    }
  }
  /* which region a national game belongs to (by its place in the bracket) */
  const nationalTag = (N) => (slot, games) => ({ round: N.rounds.length, slot,
    region: games >= N.regions.length ? N.regions[Math.floor(slot / (games / N.regions.length))] : null });

  const REGION_NAMES = ["East", "West", "South", "Midwest"];

  /* Selection Sunday: auto bids plus at-large by committee rank, seeded on
     an S-curve across the regions. Play-in games (if the field isn't a
     power of two) go to the lowest-ranked auto bids and the last at-large
     teams in, half each, like the First Four. */
  function selectionSunday(lg, season) {
    const Rankings = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./rankings.js") : (typeof window !== "undefined" ? window.Rankings : globalThis.Rankings);
    const P = season.post;
    const com = Rankings.committee(lg, season);
    const comRank = Object.fromEntries(com.map(r => [r.id, r.rank]));
    const auto = new Set(Object.values(P.autobids));
    const size = rulesOf(lg).natField;

    const field = [...auto].map(id => ({ id, auto: true }));
    for (const r of com) {
      if (field.length >= size) break;
      if (auto.has(r.id)) continue;
      const rec = lg.byId[r.id].record;
      if (rec.w < rec.l) continue;                       // no at-large bid for a losing record
      field.push({ id: r.id, auto: false });
    }
    const rk = (f) => comRank[f.id] || 999;
    field.sort((a, b) => rk(a) - rk(b));
    field.forEach((f, i) => { f.overall = i + 1; });

    /* play-ins */
    const main = pow2Down(field.length), playIns = field.length - main;
    const used = new Set(), games = [];
    const worst = (list, n) => list.filter(f => !used.has(f.id)).sort((a, b) => rk(b) - rk(a)).slice(0, n);
    const addGames = (list, nGames) => {
      const take = worst(list, 2 * nGames).sort((a, b) => rk(a) - rk(b));
      for (let i = 0; i + 1 < take.length && games.length < playIns; i += 2) { games.push([take[i], take[i + 1]]); used.add(take[i].id); used.add(take[i + 1].id); }
    };
    addGames(field.filter(f => f.auto), Math.ceil(playIns / 2));
    addGames(field.filter(f => !f.auto), playIns - games.length);
    if (games.length < playIns) addGames(field, playIns - games.length);

    /* the main-bracket lines: each direct team, and each play-in pair (ranked by its better team) */
    const lines = [...field.filter(f => !used.has(f.id)).map(f => ({ teams: [f], rank: rk(f) })),
                   ...games.map(pr => ({ teams: pr, rank: rk(pr[0]), playIn: true }))].sort((a, b) => a.rank - b.rank);
    const R = main >= 32 ? 4 : 1, perRegion = main / R;
    const regions = REGION_NAMES.slice(0, R).length === R && R > 1 ? REGION_NAMES.slice(0, R) : ["Bracket"];
    const byRegion = regions.map(() => []);
    lines.forEach((ln, k) => {
      const seedLine = Math.floor(k / R), pos = k % R;
      const reg = seedLine % 2 ? R - 1 - pos : pos;                     // snake down the seed lines
      ln.seed = seedLine + 1; ln.region = regions[reg];
      ln.teams.forEach(f => { f.seed = ln.seed; f.region = R > 1 ? ln.region : null; if (ln.playIn) f.playIn = true; });
      byRegion[reg][seedLine] = ln;
    });

    // bubble: first teams left out, in committee order
    P.firstOut = com.filter(r => !field.some(f => f.id === r.id) && lg.byId[r.id].record.w >= lg.byId[r.id].record.l).slice(0, 4).map(r => r.id);
    P.field = field.sort((a, b) => a.seed - b.seed || a.overall - b.overall);
    P.selectionRankings = { committee: com };
    P.phase = "national";
    P.log.push(`Selection Sunday: ${field.filter(f => !f.auto).length} at-large bids handed out.`);

    /* bracket: regions in Final Four order (1 v 4, 2 v 3), each in seed order */
    const regionOrder = R === 4 ? [0, 3, 1, 2] : [0];
    const N = P.national = { rounds: [], roundNames: [], champion: null, entries: [], regions: regionOrder.map(i => regions[i]), big: main >= 64 };
    const day0 = (season.endDay || season.lastDay) + POST.breakAfterSelection;
    const ffGames = [];
    for (const ri of regionOrder) for (const sd of bracketOrder(perRegion)) {
      const ln = byRegion[ri][sd - 1];
      if (!ln.playIn) { N.entries.push({ id: ln.teams[0].id }); continue; }
      const g = schedulePostGame(season, day0, ln.teams[0].id, ln.teams[1].id, "nt", { round: 0, slot: ffGames.length, region: R > 1 ? ln.region : null, playIn: true });
      ffGames.push(g.id); N.entries.push({ game: g.id });
    }
    if (ffGames.length) { N.rounds.push(ffGames); N.roundNames.push(main >= 64 ? "First Four" : "Play-in"); }
    else pairRound(season, N, day0, "nt", nationalTag(N), 2);
  }

  /* ---------------- STANDINGS & LEADERS ---------------- */
  function standings(lg, confId) {
    const teams = lg.teams.filter(t => !confId || t.conf === confId);
    return teams.map(t => ({
      id: t.id, name: t.name, abbr: t.abbr, conf: t.conf, isUser: t.isUser,
      w: t.record.w, l: t.record.l, confW: t.record.confW, confL: t.record.confL,
      pct: t.record.w + t.record.l ? t.record.w / (t.record.w + t.record.l) : 0,
      confPct: t.record.confW + t.record.confL ? t.record.confW / (t.record.confW + t.record.confL) : 0,
      diff: t.games ? +((t.ptsFor - t.ptsAgainst) / t.games).toFixed(1) : 0,
      streak: t.record.streak,
    })).sort((a, b) => b.confPct - a.confPct || b.pct - a.pct || b.diff - a.diff);
  }

  function perGame(p) {
    const gp = Math.max(1, p.season.gp), s = p.season;
    return {
      gp: s.gp, mpg: +(s.sec / 60 / gp).toFixed(1), ppg: +(s.pts / gp).toFixed(1),
      rpg: +((s.oreb + s.dreb) / gp).toFixed(1), apg: +(s.ast / gp).toFixed(1),
      spg: +(s.stl / gp).toFixed(1), bpg: +(s.blk / gp).toFixed(1), tpg: +(s.tov / gp).toFixed(1),
      fgPct: s.fga ? +(100 * s.fgm / s.fga).toFixed(1) : 0,
      tpPct: s.tpa ? +(100 * s.tpm / s.tpa).toFixed(1) : 0,
      ftPct: s.fta ? +(100 * s.ftm / s.fta).toFixed(1) : 0,
    };
  }

  function leaders(lg, stat = "ppg", minGames = 5, limit = 25) {
    const rows = [];
    for (const t of lg.teams) for (const p of t.players) {
      if (p.season.gp < minGames) continue;
      if (stat === "fgPct" && p.season.fgm < 2.5 * p.season.gp) continue;   // shooting %: at least 2.5 makes a game (like the NCAA's minimum)
      if (stat === "tpPct" && p.season.tpm < 1 * p.season.gp) continue;
      if (stat === "ftPct" && p.season.ftm < 1.5 * p.season.gp) continue;
      const pg = perGame(p);
      rows.push({ id: p.id, name: p.name, pos: p.pos, class: p.class, team: t.abbr, teamName: t.name, isUser: t.isUser, ...pg });
    }
    return rows.sort((a, b) => b[stat] - a[stat]).slice(0, limit);
  }

  const Season = {
    SCHEDULE, POST, rulesOf, bracketOrder, buildSchedule, startSeason, simDay, simGame, simToNextUserGame, seasonComplete, regularSeasonComplete, maybeUpdateRankings, maxDay, prepareLiveDay, finishLiveGame, finishDay,
    standings, leaders, perGame, applyBox, toSimTeam, groupByDay, topScorer, STAT_KEYS,
  };
  if (typeof module !== "undefined") module.exports = Season;
  else root.Season = Season;
})(typeof window !== "undefined" ? window : globalThis);
