/* =====================================================================
   HOOPS DYNASTY — OFFSEASON
   Turns one season into the next:

     archive   → every team and player gets a history entry, career
                 totals accumulate
     draft     → underclassmen declare or test the waters, then 60 picks
                 (draft.js); seniors who are left graduate
     advance   → FR→SO→JR→SR, eligibility ticks
     arrivals  → each school's signed recruiting class joins, then
                 walk-ons fill the roster to 13 (recruiting.js). Without
                 the recruiting module, rosters refill with generated
                 freshmen whose quality tracks program prestige.
     prestige  → drifts with results: deep runs build a program,
                 losing seasons erode it
     rollover  → records reset, a new schedule is generated, the next
                 recruiting cycle opens

   Deliberately NOT here yet: player development/potential growth
   (design still open) and transfers (waiting on factors that feed it).
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const Sample = req ? require("../sim/sample_teams.js") : root.SampleTeams;
  const League = req ? require("./league.js") : root.League;
  const Season = req ? require("./season.js") : root.Season;
  const Development = req ? require("./development.js") : root.Development;
  const recruitingModule = () => req ? require("./recruiting.js") : root.Recruiting;
  const Draft = req ? require("./draft.js") : root.Draft;
  const programModule = () => req ? require("./program.js") : root.Program;
  const rosterModule = () => req ? require("./roster.js") : root.Roster;
  const portalModule = () => req ? require("./portal.js") : root.Portal;
  const pipelinesModule = () => req ? require("./pipelines.js") : root.Pipelines;
  const awardsModule = () => req ? require("./awards.js") : root.Awards;
  const hofModule = () => req ? require("./hof.js") : root.HallOfFame;
  const coachesModule = () => req ? require("./coaches.js") : root.Coaches;
  const hashN = (...xs) => xs.reduce((h, x) => (Math.imul(h ^ (x >>> 0), 0x9e3779b1) ^ (h >>> 15)) >>> 0, 0x811c9dc5);

  const CFG = {
    /* Prestige is the long-run reputation. Like home court and NIL, every
       grade has a win % it must beat to hold — the same bars as NIL (a C
       needs .500, an A .750, an A+ .800) — but the rate is about half and
       everything is damped by inertia, so it moves 3–4× slower than NIL.
       A blue blood stuck around .500 slides about 1.4 a year (0.8 if it
       still makes the tournament); a few years of that and it's still a good program, just not elite.
       Postseason runs add on top. */
    prestige: {
      champion: 5, finalist: 3, semifinal: 2, tournament: 1,
      offset: { "A+": 30, "A": 25, "A-": 21, "B+": 17, "B": 12, "B-": 8, "C+": 4, "C": 0, "C-": -3, "D+": -6, "D": -10, "D-": -14, "F": -20 },
      rate: 0.08,           // prestige points per win-% point above/below the bar
      maxRecord: 2.5,       // cap on the record part of a season's move
      floor: 20, ceiling: 99,
      inertia: 0.6,         // drift is slow: applied change × this
      /* A big program is EXPECTED to go deep, so the postseason counts against
         what its prestige expects (like the win % bar): [prestige at least, expected
         postseason score]. An A+ (90+) is expected to reach about the second weekend:
         a Final Four (+2) beats that, a first-round exit (+1) falls short. */
      expect: [[90, 1.5], [80, 1.0], [70, 0.5]],
      /* a slow pull toward the league's average prestige: dynasties fade unless
         they keep winning, and the worst programs rebuild (new coach, new money).
         Share of the gap closed per season. Long-run checked with tests/longrun.js. */
      pull: 0.02,
    },
    /* A building's reputation is earned and has to be defended. Every grade
       carries a home win % you must beat to hold it: an A gym needs ~70%, a B
       needs 60%. Beat your bar and the rating climbs by the margin; fall short
       and it drops by the margin. So a team winning 79% at home keeps rising
       until the bar catches up, and nobody holds an A without dominating.
       `rate` keeps it slow — this is a reputation, not a thermometer. */
    homeCourt: {
      /* The bar is set RELATIVE to how often home teams win league-wide
         (~60%), not to 50%. Otherwise every team clears the bar every year —
         home advantage itself guarantees a winning home record — and the whole
         league ratchets upward. C is an average building; an A means winning
         about 20 points more often at home than the league does. */
      offset: {
        "A+": 25, "A": 20, "A-": 17, "B+": 14, "B": 10, "B-": 7,
        "C+": 4, "C": 0, "C-": -3, "D+": -6, "D": -10, "D-": -14, "F": -20,
      },
      rate: 0.13,            // share of the margin applied per season
      overall: 0.25,         // overall record nudges it a little too
      minHomeGames: 6,       // too few home games to judge: barely move
      floor: 10, ceiling: 99,
    },

    freshmen: {
      qualityBase: 32,      // + prestige * scale = average incoming talent
      prestigeScale: 0.40,
      spread: 7,
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const CLASS_NEXT = { FR: "SO", SO: "JR", JR: "SR" };

  /* ---------------- results / archive ---------------- */
  function postseasonResult(lg, season, teamId) {
    const P = season.post;
    if (!P || !P.field) return { label: "—", score: 0 };
    if (P.national && P.national.champion === teamId) return { label: "National champion", score: CFG.prestige.champion };
    const inField = P.field.some(f => f.id === teamId);
    if (!inField) {
      const won = P.autobids && Object.values(P.autobids).includes(teamId);
      return { label: won ? "?" : "—", score: 0 };
    }
    // how far did they get?
    let lastRound = 0;
    P.national.rounds.forEach((r, i) => {
      for (const gid of r) {
        const g = season.games[gid];
        if (g.home === teamId || g.away === teamId) lastRound = i;
      }
    });
    const total = P.national.rounds.length;
    if (lastRound === total - 1) return { label: "Runner-up", score: CFG.prestige.finalist };
    if (lastRound === total - 2) return { label: "Semifinal", score: CFG.prestige.semifinal };
    const rn = (P.national.roundNames || [])[lastRound];
    return { label: rn ? `Tournament (${rn})` : `Tournament (round ${lastRound + 1})`, score: CFG.prestige.tournament };
  }

  function archiveSeason(lg, season) {
    const year = lg.season;
    const Records = req ? require("./records.js") : root.Records;
    if (Records) Records.seasonEnd(lg, season);   // season records, before the season's stats are archived and cleared
    const apRank = Object.fromEntries((season.rankings ? season.rankings.ap : []).map(r => [r.id, r.rank]));
    const comRank = Object.fromEntries((season.rankings ? season.rankings.committee : []).map(r => [r.id, r.rank]));

    for (const t of lg.teams) {
      const res = postseasonResult(lg, season, t.id);
      t.history.push({
        year, w: t.record.w, l: t.record.l, confW: t.record.confW, confL: t.record.confL,
        ap: apRank[t.id] || null, committee: comRank[t.id] || null,
        postseason: res.label, coach: t.coach.name, prestige: t.prestige,
      });
      t.coach.careerW += t.record.w; t.coach.careerL += t.record.l; t.coach.years++;

      for (const p of t.players) {
        const pg = Season.perGame(p);
        p.history.push({ year, class: p.class, team: t.abbr, redshirt: p.redshirt, ...pg });
        for (const k of Object.keys(p.career)) if (typeof p.season[k] === "number") p.career[k] += p.season[k];
      }
    }
  }

  /* ---------------- departures ---------------- */

  /* The draft (draft.js) has already taken its picks; seniors who are left graduate.
     A drafted (or declared) underclassman's salary for next season was set aside: it comes back. */
  function processDepartures(lg, rand, draft) {
    const out = {};   // teamId -> { graduated, drafted, withdrew }
    for (const t of lg.teams) {
      const graduated = [], keep = [];
      const d = draft ? draft.byTeam[t.id] : { drafted: [], withdrew: [], gone: [] };
      const drafted = [...d.drafted, ...d.gone.map(x => ({ ...x, undrafted: true }))];
      for (const x of drafted) if (x.early) t.bank = Math.round((t.bank || 0) + (x.salary || 0));
      for (const p of t.players) {
        if (p.class === "SR" && !p.redshirt) { graduated.push(snapshot(p, "graduated")); if (awardsModule()) awardsModule().archive(lg, p, t, "graduated"); }   // a senior who redshirted comes back
        else keep.push(p);
      }
      t.players = keep;
      out[t.id] = { graduated, drafted, withdrew: d.withdrew };
    }
    return out;
  }

  const snapshot = (p, why) => ({
    id: p.id, name: p.name, pos: p.pos, class: League.classLabel(p), ovr: League.ovrOf(p),
    potential: p.potential, why,
  });

  /* ---------------- advancement & arrivals ---------------- */
  function advanceClasses(lg) {
    for (const t of lg.teams) for (const p of t.players) {
      if (p.redshirt) {
        // a redshirt year doesn't count: same class next year, now "RS-"
        p.redshirtUsed = true; p.redshirt = false;
      } else {
        p.class = CLASS_NEXT[p.class] || "SR";
        p.eligibilityUsed++;
      }
      p.season = League.emptySeasonStats();
    }
  }

  function recruitFreshmen(lg, rand) {
    const incoming = {};
    for (const t of lg.teams) {
      const arrived = [];
      const q = clamp(Math.round(CFG.freshmen.qualityBase + t.prestige * CFG.freshmen.prestigeScale), 28, 88);
      let n = 0;
      while (t.players.length < 13) {
        // fill the thinnest position first
        const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
        t.players.forEach(p => counts[p.pos]++);
        const pos = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
        const pq = clamp(q + Math.round((rand() * 2 - 1) * CFG.freshmen.spread), 25, 92);
        const base = Sample.generatePlayer(rand, { id: `${t.id}-y${lg.season + 1}-${++n}`, pos, base: pq, quality: pq });
        const player = League.dynastyPlayer(rand, base, { cls: "FR", quality: pq, home: League.Geo.hometown(rand, t.city, League.Geo.CFG.walkOnLocal).key });
        t.players.push(player);
        arrived.push(snapshot(player, "freshman"));
      }
      incoming[t.id] = arrived;
    }
    return incoming;
  }

  /* ---------------- home court drift ---------------- */
  function updateHomeCourt(lg, season) {
    const H = CFG.homeCourt;
    const changes = {};
    const home = {};
    for (const t of lg.teams) home[t.id] = { w: 0, l: 0 };
    let lgW = 0, lgN = 0;
    for (const g of season.games) {
      if (!g.played || g.neutral) continue;
      const rec = home[g.home];
      if (rec) g.homeScore > g.awayScore ? rec.w++ : rec.l++;
      if (g.homeScore > g.awayScore) lgW++;
      lgN++;
    }
    const leagueHome = lgN ? 100 * lgW / lgN : 60;   // the bar floats with the league
    for (const t of lg.teams) {
      const r = home[t.id];
      const games = r.w + r.l;
      if (!games) continue;
      const homePct = 100 * r.w / games;
      const allGames = t.record.w + t.record.l;
      const allPct = allGames ? 100 * t.record.w / allGames : 50;

      const bar = leagueHome + (H.offset[League.grade(t.homeCourt)] ?? 0);
      let delta = (homePct - bar) + H.overall * (allPct - bar);
      delta *= H.rate;
      if (games < H.minHomeGames) delta *= games / H.minHomeGames;   // small sample

      const before = t.homeCourt;
      t.homeCourt = clamp(Math.round(t.homeCourt + delta), H.floor, H.ceiling);
      if (t.homeCourt !== before) changes[t.id] = t.homeCourt - before;
    }
    return changes;
  }

  /* ---------------- prestige drift ---------------- */
  const prestigeBar = (t) => 50 + (CFG.prestige.offset[League.grade(t.prestige)] ?? 0);
  function updatePrestige(lg, season) {
    const P = CFG.prestige, changes = {}, detail = {};
    const mean = lg.teams.reduce((x, t) => x + t.prestige, 0) / lg.teams.length;
    for (const t of lg.teams) {
      const res = postseasonResult(lg, season, t.id);
      const pct = 100 * t.record.w / Math.max(1, t.record.w + t.record.l);
      const bar = prestigeBar(t);
      const record = clamp((pct - bar) * P.rate, -P.maxRecord, P.maxRecord);
      const expect = (P.expect.find(([min]) => t.prestige >= min) || [0, 0])[1];
      const post = res.score - expect;
      const pull = P.pull * (mean - t.prestige);
      const delta = (post + record) * P.inertia + pull;
      const before = t.prestige;
      t.prestige = clamp(+(t.prestige + delta).toFixed(1), P.floor, P.ceiling);
      if (t.prestige !== before) changes[t.id] = +(t.prestige - before).toFixed(1);
      detail[t.id] = { before, after: t.prestige, bar, record: +(record * P.inertia).toFixed(1), post: +(post * P.inertia).toFixed(1), expect, postLabel: res.label, pull: +pull.toFixed(1) };
    }
    lastPrestigeDetail = detail;
    return changes;
  }
  let lastPrestigeDetail = {};

  /* ---------------- the whole offseason ---------------- */
  /* Order matters:
       archive        — history is written from the season just played
       XP + growth    — he develops as the class he actually played
       departures     — graduation and the draft read post-growth ratings
       transfers      — minutes-vs-expectation from the season just played
       advance        — everyone moves up a class
       arrivals       — signed recruits join, walk-ons fill to 13
       next cycle     — a new recruiting class and a fresh collective budget */
  /* Part 1: everything up to your roster decisions. */
  function beginOffseason(lg, season) {
    const rand = Engine.makeRng((season.seed ^ (lg.season * 7919)) >>> 0);
    const Recruiting = recruitingModule(), Roster = rosterModule();
    if (Recruiting && lg.recruiting && !lg.recruiting.closed) Recruiting.signingDay(lg, season);   // safety: nobody left in limbo
    lg.offseason = { stage: "decisions" };
    const Coaches = coachesModule();
    if (Coaches) Coaches.ensure(lg);
    archiveSeason(lg, season);
    const prestigeChanges = updatePrestige(lg, season);
    const homeCourtChanges = updateHomeCourt(lg, season);
    // NIL grade, bank, facilities, coach points/turnover — while this cycle's books are still open
    const Program = programModule();
    const program = Program ? Program.endOfSeason(lg, season, rand) : null;
    lg.offseason.settled = true;   // the books are closed: from here every offseason screen counts money from the bank
    lg.offseason.newCoach = {};

    // the draft, part 1: at season's end underclassmen declare or test the waters (on what they showed this season)
    const draftYear = lg.season + 1;
    const declarations = Draft ? Draft.declare(lg, draftYear) : null;
    for (const t of lg.teams) for (const p of t.players) p.xp = Development.seasonXP(p, t, season);
    const development = Development.developAll(lg, rand);
    // part 2, draft day: testers decide, 60 picks (before your roster decisions, so you know who's gone)
    const draft = Draft ? Draft.run(lg, draftYear) : null;

    // the depth chart as it stood this season, before anyone leaves
    const seasonRole = Object.fromEntries(lg.teams.map(t => [t.id, Roster.seasonRoles(t)]));
    const departures = processDepartures(lg, rand, draft);
    Roster.prepare(lg, seasonRole);
    // the coaching carousel, step 1 (after development: the staff that coached the season developed it):
    // the hot seat, retirements, firings, expired contracts. Hiring waits for you (finishCarousel).
    if (Coaches) {
      lg.offseason.carousel = Coaches.seasonEnd(lg, season, Engine.makeRng(hashN(lg.seed, lg.season, 0xca70)));
      lg.offseason.stage = "carousel";
    }
    lg.offseason.part = { carousel: lg.offseason.carousel || null, departures, draft: draft ? { year: draftYear, picks: draft.picks, prestige: draft.prestige, leaguePicks: draft.leaguePicks, declarations } : null, prestigeChanges, prestigeDetail: lastPrestigeDetail, homeCourtChanges, development, program };
    return lg.offseason.part;
  }

  /* The carousel, step 2: AI schools hire (after you've taken a new job, if you were fired). */
  function finishCarousel(lg) {
    const Coaches = coachesModule(), car = lg.offseason && lg.offseason.carousel;
    if (!Coaches || !car) { if (lg.offseason) lg.offseason.stage = "decisions"; return null; }
    if (car.userFired && !car.newJob) return { ok: false, why: "Pick your next job first." };
    Coaches.runHiring(lg, Engine.makeRng(hashN(lg.seed, lg.season, 0xca71)));
    lg.offseason.stage = "hiring";   // the hiring results; the UI moves on to "decisions"
    return { ok: true, carousel: car };
  }

  /* Part 2: AI decisions and the transfer rolls, then the portal opens. */
  function transferWindow(lg, season) {
    const rand = Engine.makeRng((season.seed ^ (lg.season * 104729) ^ 0x7a5) >>> 0);
    const Roster = rosterModule(), Portal = portalModule();
    const transfers = Roster.processTransfers(lg, rand);
    const Program = programModule();
    if (Program) for (const t of lg.teams) t.bank = Math.min(t.bank || 0, Program.CFG.bank.cap);   // refunds can't push past the carry-over cap
    if (Portal) Portal.open(lg, transfers, Engine.makeRng(hashN(lg.seed, lg.season, 0x9047)));
    for (const id in transfers) transfers[id].forEach(x => { delete x.player; });   // the portal holds the players now
    lg.offseason.transfers = transfers;
    lg.offseason.stage = Portal ? "portal" : "finish";
    return transfers;
  }
  /* one portal round (players decide, then the AI moves); after round 3 it closes */
  function portalRound(lg) {
    const Portal = portalModule();
    if (!lg.portal || lg.portal.closed) return;
    Portal.nextRound(lg, Engine.makeRng(hashN(lg.seed, lg.season, lg.portal.round, 0x90a1)));
  }

  /* Part 3: portal signings arrive, classes advance, the new class, next cycle. */
  function finishOffseason(lg, season) {
    const rand = Engine.makeRng((season.seed ^ (lg.season * 130363) ^ 0x3c1) >>> 0);
    const Recruiting = recruitingModule(), Portal = portalModule();
    const part = lg.offseason.part, transfers = lg.offseason.transfers || {};
    if (Portal && lg.portal && !lg.portal.closed) Portal.close(lg, Engine.makeRng(hashN(lg.seed, lg.season, 0x90c1)));
    // pipelines: this year's signings build their areas, then everything fades (before the pools are cleared)
    const Pipelines = pipelinesModule(), Geo = League.Geo, signings = [];
    if (lg.recruiting) for (const r of lg.recruiting.pool) if (r.status === "committed") signings.push({ teamId: r.commitTo, area: Geo.areaOf(r.home), stars: r.stars });
    if (lg.portal) for (const r of lg.portal.pool) if (r.status === "committed") signings.push({ teamId: r.commitTo, area: Geo.areaOf(r.home), transfer: true });
    const pipeGained = Pipelines ? Pipelines.yearEnd(lg, signings) : {};
    // the Hall of Fame and retired jerseys: this offseason's departures and retired head coaches
    const car = lg.offseason.carousel, HOF = hofModule();
    const hof = HOF ? HOF.induct(lg, car ? car.departures.filter(d => d.why === "retired" && d.hist) : []) : null;
    const portal = Portal && lg.portal ? Portal.arrivals(lg) : null;
    advanceClasses(lg);
    const recruitingClass = Recruiting && lg.recruiting ? lg.recruiting : null;
    const incoming = recruitingClass ? Recruiting.arrivals(lg, rand) : recruitFreshmen(lg, rand);
    for (const t of lg.teams) {
      League.autoRotation(t);
      League.assignNumbers(t);   // jersey numbers for the newcomers now (the report and roster show them)
      // your hand-set rotation can't survive a roster turnover: you get a fresh one at your depth to tweak
      if (t.isUser && t.rotationMode === "manual") t.rotationReset = true;
    }
    lg.season++;
    if (Recruiting && recruitingClass) {
      lg.lastRecruitingLog = recruitingClass.log.slice(0, 60);
      Recruiting.startCycle(lg, lg.season);
      Recruiting.ensure(lg);
    }
    const me = lg.teams.find(t => t.isUser);
    // development: full detail for your team; everyone else keeps his growth and top 4 changes (it's kept all
    // season for player cards and the preseason breakout pick, and was the biggest part of a save)
    const development = {};
    for (const id in (part.development || {})) development[id] = lg.byId[id] && lg.byId[id].isUser ? part.development[id]
      : part.development[id].map(d => ({ id: d.id, name: d.name, delta: d.delta, before: d.before, after: d.after, changes: [...(d.changes || [])].sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 4) }));
    const report = { year: lg.season, ...part, development, hof, transfers, incoming, pipelines: me ? pipeGained[me.id] || {} : {}, portal: portal ? { incoming: portal.incoming, summary: portal.summary, log: lg.portal.log.slice(0, 80) } : null };
    lg.portal = null;
    lg.offseason = null;
    lg.lastOffseason = report;
    return report;
  }

  /* the whole thing at once (AI-only sims and tests) */
  function runOffseason(lg, season) {
    beginOffseason(lg, season);
    const car = lg.offseason.carousel;
    if (car && car.userFired && car.offers.length) coachesModule().takeJob(lg, car.offers[0]);   // unattended: the best offer
    finishCarousel(lg);
    lg.offseason.stage = "decisions";
    transferWindow(lg, season);
    while (lg.portal && !lg.portal.closed) portalRound(lg);
    return finishOffseason(lg, season);
  }

  /* rollover: build the next season (call after runOffseason) */
  function nextSeason(lg) {
    return Season.startSeason(lg, (lg.season * 1013904223) >>> 0);
  }

  const Offseason = { CFG, runOffseason, beginOffseason, finishCarousel, transferWindow, portalRound, finishOffseason, nextSeason, postseasonResult, updateHomeCourt, prestigeBar };
  if (typeof module !== "undefined") module.exports = Offseason;
  else root.Offseason = Offseason;
})(typeof window !== "undefined" ? window : globalThis);
