/* =====================================================================
   HOOPS DYNASTY — RECRUITING (v1: high school)

   One rule decides where a recruit signs:

       effective offer = NIL offer × (1 + fit total × fit dampener)

   FIT TOTAL is the sum of six factors. Each is
       school score (-1 … +1)  ×  how much HE cares (0.2 … 1)  ×  max swing
   so a factor can help or hurt, and only as much as the player cares.

       playing time   projected role on next year's depth chart
       proximity      miles from his hometown to the school (home / close / far, geo.js)
       prestige       program prestige + current AP rank
       development    coach development rating + facilities
       relationship   recruiting points you've put in
       pipeline       the school's pipeline in his home area (pipelines.js)

   FIT DAMPENER = 1 − 0.7 × money weight. A money-first kid barely
   notices fit; most players sit at 0–0.4 so fit decides close races.

   MONEY is a yearly collective budget (from the school's NIL grade).
   Next year's payroll comes off the top, then committed recruits, then
   pending offers, which reserve their amount until withdrawn or lost.

   COMMITS: each week every uncommitted recruit with an offer rolls to
   commit. The chance ramps up over the season, rises when one school
   clearly leads, falls in a close race, and falls when nothing meets
   his asking price (he'd rather wait). When he decides, he picks by
   ODDS: each school's effective offer to the 15th power, shared out (a
   3% lead ≈ 60/40, 20% ≈ 95/5). Kids decide at the weekly refresh
   BEFORE the AI moves, so a new AI offer always sits a week. Signing day
   after the title game: everyone left decides (same odds).

   WORTH: one scale of what a player is worth a year, by value (overall,
   position, upside). AI schools price recruits on it (the public read
   plus a little of their own), not on the asking price, so an
   overpriced kid gets lowballed and a bargain gets bid up. Returning
   players are paid 80% of it.

   SCOUTING: nobody sees a recruit's true ratings. The public rank,
   stars and asking price come from a PUBLIC rating = true overall + a
   weighted roll (usually ±2, sometimes ±8), and potential isn't in it at
   all — so raw high-ceiling kids are the natural sleepers. You spend
   scouting points (they pile up weekly, never reset) on a recruit; at
   25 / 60 / 100 total his bands narrow. Level 0 is the public read:
   bands centred on the public numbers (plus your school's small read), so
   the board reads like the rankings, and where the public was wrong the
   truth falls outside (about 1 in 8 for overall, 1 in 4 for potential).
   From level 1 every band contains the truth, and level 2 fits in level 1. Level 1 also shows what he wants (and so your real price),
   level 2 his work rate as a range, level 3 everything exact. Until then
   your playing-time pitch (and so your price) is judged across his range.

   Every number lives in CFG.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const Sample = req ? require("../sim/sample_teams.js") : root.SampleTeams;
  const League = req ? require("./league.js") : root.League;
  const Geo = req ? require("./geo.js") : root.Geo;
  const Pipelines = req ? require("./pipelines.js") : root.Pipelines;

  const CFG = {
    rosterSize: 13,
    poolPerTeam: 3.2,               // high school recruits generated per school

    /* recruit quality: generator base by share of the class (best → worst),
       so every school sees the same talent flow in a league of any size */
    quality: { top: 71, bottom: 41, spread: 4 },

    /* star ratings: 5★ and 4★ by national rank (the same few elite kids in
       any league); 3★ down to the same share of the class (180 of 237) */
    stars: [[25, 5], [110, 4], [180, 3], [Infinity, 2]],
    threeStarShare: 0.76,

    /* the curves below are calibrated on the 74-team league's class of 237.
       A bigger (or smaller) class reads them at the same share of the class:
       #1126 of 1126 asks what #237 of 237 does. */
    refClass: 237,

    /* asking price by (class-share) rank: [rank, $] anchors, log-interpolated */
    asking: [[1, 2600000], [5, 1600000], [25, 800000], [60, 320000], [110, 120000], [180, 35000], [260, 10000], [400, 5000]],
    askingVariance: 0.20,           // ± share
    moneyAskBoost: 0.30,            // money weight 1.0 → asks 30% more ...
    loyalAskCut: 0.15,              // ... a loyal kid with no money weight asks 15% less

    /* factor swings (max effect of each factor at full weight and ±1 score) */
    swing: { pt: 0.20, prox: 0.15, prestige: 0.15, dev: 0.10, rel: 0.15, pipe: 0.12 },
    /* distance from his hometown to the school (geo.js levels): the proximity score */
    prox: { home: 1.0, close: 0.35, far: -0.75 },
    /* a pipeline in his area (pipelines.js) counts for every kid, more for
       kids who care about home: its weight is his proximity weight, at least this */
    pipeWeightFloor: 0.4,
    weightFloor: 0.20,
    moneyDamp: 0.70,                // fit dampener = 1 − moneyDamp × money weight
    multClamp: [0.60, 1.50],
    outOfPositionPenalty: 3,        // overall points lost filling a neighbouring slot
    ptRoles: [                       // projected role → PT score
      { role: "Starter", score: 1.0 },
      { role: "6th–7th man", score: 0.4 },
      { role: "Rotation", score: 0.0 },
      { role: "End of bench", score: -0.6 },
      { role: "Buried", score: -1.0 },
    ],

    /* recruiting points */
    points: {
      base: 20, perRating: 0.5,     // weekly pool = base + coach.recruiting × perRating (a 50 coach maxes ~2 kids a week, a 90 coach ~3)
      capPerRecruit: 20,            // most you can put into one kid per week
      gain: 0.7,                    // relationship gained per point ...
      compound: 200,                // ... × (1 + relationship / compound)
      decay: 3,                     // relationship lost in a week with no contact
    },

    /* commit timing (weekly roll) */
    commit: {
      seasonDays: 112,              // ~regular season + postseason, for the ramp
      startChance: 0.04, endChance: 0.20,
      topRank: 25, topEarlyMult: 0.7,
      thresholdStart: 0.90, thresholdEnd: 0.60,   // share of asking price he wants met
      /* curves, not steps: under his line the chance fades from full at the line to
         belowThresholdMult at belowFade under it; the lead over the next offer slides the
         chance from closeRaceMult (tied) to clearLeadMult (a clearLead lead or more) */
      belowThresholdMult: 0.25, belowFade: 0.20,
      clearLead: 0.10, clearLeadMult: 2.0,
      closeRaceMult: 0.5,
      soleOfferMult: 1.3,
      /* When he decides, he doesn't just take the top number: each school's
         chance is its effective offer to this power, shared out. Tied = even
         split; 3% ahead ≈ 60/40; 10% ≈ 80/20; 20% ≈ 95/5. */
      oddsPower: 15,
    },

    /* collective budget by NIL grade: [nil, $] anchors, log-interpolated */
    budget: [[5, 250000], [20, 550000], [40, 1700000], [60, 4200000], [80, 11000000], [99, 20000000]],

    /* WORTH: what a player is worth a year, by VALUE = overall − position
       adjustment + 0.35 × upside (potential above overall). One scale for
       everyone: it's calibrated so a recruit's value lines up with the
       asking price for his rank (86 ≈ #1 at $2.6M, 77 ≈ #25, 65 ≈ #110).
       AI schools price recruits with it; returning players are paid from it. */
    worth: [[45, 10000], [49.5, 19000], [56, 35000], [60.7, 65000], [65.3, 120000], [68.5, 196000], [71.5, 320000], [74.5, 540000], [77, 800000], [80.4, 1350000], [82.5, 1600000], [86.5, 2600000], [92, 4000000]],
    upsideWeight: 0.35,
    returnerShare: 0.8,             // a returning player's salary = this × his worth (± variance)
    salaryVariance: 0.25,
    salaryMoneyBoost: 0.30,
    walkOnSalary: [0, 5000],
    startingPayrollCap: 0.65,       // a new league's roster never eats more than this share of the collective

    /* scouting */
    scout: {
      base: 10, perRating: 0.25,          // points per week = base + coach.scouting × perRating
      levels: [25, 60, 100],              // total points on one recruit to reach level 1 / 2 / 3
      // band widths by level 0..3 (0 = exact). Each rating band moves with the overall band.
      width: { ovr: [9, 8, 4, 0], pot: [11, 11, 6, 0], rating: [14, 12, 6, 0], work: [null, null, 30, 0] },
      // the public rating: true overall + a roll from one of these [chance, min, max] buckets
      publicRoll: [[0.50, 0, 2], [0.32, 3, 5], [0.18, 6, 9]],   // about half within 2: the board is a starting point, not the answer
      potMissScale: 2.0,                  // the public read on potential misses by 2× as much (upside is harder to call)
      bandJitter: 0.2,                    // bands sit around the public read, ± this share of their width
      /* AI SCHOOLS' READ of a kid, set once when the class comes out and kept all year.
         Overall and potential separately, two rolls each:
           1. start = the public number ± up to `wobble` (pure luck, the same for everyone)
           2. a roll from 0 to 1, how far from the start toward the truth it gets:
                read = start + roll × (truth − start)
              roll = u ^ (skewBase ^ ((50 − scouting) / 25)), u uniform: an average staff
              (50) rolls evenly (average 0.5), an elite one (90) about 0.68 on average
              and 80+ almost 2 in 5, a weak one (25) about 0.38 and 80+ about 1 in 8.
         Potential is harder: its roll counts `potReach` as much. */
      ai: { wobble: 2, skewBase: 1.6, potReach: 0.85 },
      /* Level 0 is the public read: each band is centred on the public
         numbers (so the board reads like the rankings) plus this school's own
         small read, and is NOT moved to contain the truth. Where the public
         was wrong, the truth falls outside: about 1 in 4 for overall, 2 in 5
         for potential. Band widths vary a little kid to kid. */
      level0: { widthVary: 2, teamRead: 2.5,     // ± width; this school's read sits up to ±teamRead × (1.3 − 0.006 × scouting) off the public one
        // how well known a kid is: the public miss × missMin…missMax and the unscouted range's width × widthMin…widthMax
        // (well known = narrow and closer; under the radar = wide and further off). Both average out to 1.
        exposure: { missMin: 0.5, missMax: 1.5, widthMin: 0.6, widthMax: 1.4 } },
    },

    /* AI schools */
    ai: {
      targetsPerSpot: 1.7,          // live offers kept per open scholarship
      stretch: 2.2,                 // will chase a kid costing up to this × its per-offer budget
      openOffer: [0.90, 1.05],      // first offer lands this share of asking, effective
      raiseChance: 0.55,
      raiseOver: [1.04, 1.08],      // raise to beat the leader by a random share in this range
      maxPay: 1.10,                 // normally won't pay more than this × what it thinks he's WORTH (its own read; fit doesn't change it) ...
      richShare: 0.9,               // ... unless that's still under this share of its per-scholarship money,
      richMaxPay: 1.4,              // ... in which case it goes up to this × what he's worth to it
      giveUpChance: 0.5,
      crowding: 0.6,                // value lost per school already offering him
      bargain: 0.5,                 // targeting: extra pull per point its value read sits above the public one (below: less)
      bankShare: 0.25,              // share of carried-over money it will put toward player deals each cycle
      localPull: 3.5,               // (was 8 when AI reads were noisier; with truer reads a bigger pull kept talent too local) its read of a kid gains this × (distance score + pipeline score): staffs work where they have an edge ...
      localPullPrestige: [0.9, 0.35],   // ... × this, from a prestige-30 program to a prestige-95 one (blue bloods recruit nationally)
      shortlist: 30,                // new targets: how many of the best affordable kids (by its own read) it looks at closely ...
      shortlistPerOffer: 6,         // ... or this many per offer it wants to make, whichever is more
    },
  };

  const POS = ["PG", "SG", "SF", "PF", "C"];
  const NEIGHBOR = { PG: ["SG"], SG: ["PG", "SF"], SF: ["SG", "PF"], PF: ["SF", "C"], C: ["PF"] };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  const between = (rand, a, b) => a + rand() * (b - a);
  const hash = (...xs) => xs.reduce((h, x) => (Math.imul(h ^ (x >>> 0), 0x9e3779b1) ^ (h >>> 15)) >>> 0, 0x811c9dc5);

  /* log-scale interpolation through [x, $] anchors */
  function curve(anchors, x) {
    if (x <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [x1, y1] = anchors[i], [x0, y0] = anchors[i - 1];
      if (x <= x1) return Math.exp(lerp(Math.log(y0), Math.log(y1), (x - x0) / (x1 - x0)));
    }
    return anchors[anchors.length - 1][1];
  }
  const moneyStep = (v) => v >= 100000 ? 5000 : v >= 10000 ? 1000 : 100;
  const roundMoney = (v) => Math.round(v / moneyStep(v)) * moneyStep(v);
  const floorMoney = (v) => Math.max(0, Math.floor(v / moneyStep(v)) * moneyStep(v));   // never rounds past what's there

  /* ---------------- player money attitude ---------------- */
  function rollMoneyWeight(rand, p) {
    let m = Math.pow(rand(), 1.6) * 0.40;                 // most players: 0–0.4, skewed low
    if ((p.preferences || []).includes("nil")) m = between(rand, 0.55, 1.0);
    if (p.temperament === "ambitious") m += 0.10;
    if (p.temperament === "loyal") m -= 0.10;
    return +clamp(m, 0, 1).toFixed(2);
  }
  function ensurePlayerMoney(rand, p) {
    if (p.moneyWeight == null) p.moneyWeight = rollMoneyWeight(rand, p);
    if (p.salary == null) p.salary = rollSalary(rand, p);
  }
  function playerValue(p) {
    const ovr = League.ovrOf(p);
    return ovr + CFG.upsideWeight * Math.max(0, (p.potential || ovr) - ovr);   // overall is already even across positions (tuning.ovr.posOffset)
  }
  const worthOf = (value) => curve(CFG.worth, value);
  function rollSalary(rand, p) {
    const base = worthOf(playerValue(p)) * CFG.returnerShare;
    const v = base * (1 + (rand() * 2 - 1) * CFG.salaryVariance) * (1 + CFG.salaryMoneyBoost * (p.moneyWeight || 0));
    return roundMoney(v);
  }
  const CoachesMod = () => req ? require("./coaches.js") : root.Coaches;
  /* the staff rating (50% head coach, 25% each assistant: coaches.js) */
  const staffR = (team, key) => { const C = CoachesMod(); return C ? C.rating(team, key) : (team.coach[key] ?? 50); };
  const collectiveFor = (team) => roundMoney(curve(CFG.budget, team.nil));

  /* ---------------- the recruit pool ---------------- */
  /* how much the relationship matters to him: loyal kids care most */
  const REL_WEIGHT = { loyal: [0.85, 1.0], steady: [0.6, 0.8], restless: [0.4, 0.6], ambitious: [0.25, 0.45] };
  function relWeight(rand, temperament) { const [a, b] = REL_WEIGHT[temperament] || [0.5, 0.8]; return +between(rand, a, b).toFixed(2); }

  function rollWeights(rand, prefs, rank) {
    const w = () => +between(rand, CFG.weightFloor, 0.7).toFixed(2);
    const hi = () => +between(rand, 0.8, 1.0).toFixed(2);
    const out = {
      pt: prefs.includes("playing_time") ? hi() : w(),
      prox: prefs.includes("close_to_home") ? hi() : w(),
      prestige: prefs.includes("win_now") ? hi() : w(),
      dev: prefs.includes("development") ? hi() : w(),
    };
    // the very best are thinking about the draft: stage and development matter more
    if (rank <= 60) {
      const tilt = 0.25 * (1 - (rank - 1) / 60);
      out.prestige = +clamp(out.prestige + tilt, CFG.weightFloor, 1).toFixed(2);
      out.dev = +clamp(out.dev + tilt, CFG.weightFloor, 1).toFixed(2);
    }
    return out;
  }

  function starsFor(rank, n) {
    for (const [cut, s] of CFG.stars) {
      const c = s === 3 && n ? Math.max(cut, Math.round(CFG.threeStarShare * n)) : cut;
      if (rank <= c) return s;
    }
    return 2;
  }
  /* a rank read at the same share of the 74-team league's class (see refClass) */
  const refRank = (rank, n) => n > 1 ? 1 + (rank - 1) * (CFG.refClass - 1) / (n - 1) : rank;

  function generatePool(lg, year) {
    const rand = Engine.makeRng(hash(lg.seed, year, 0x7ec));
    const n = Math.round(lg.teams.length * CFG.poolPerTeam);
    const Q = CFG.quality;
    const raw = [];
    for (let i = 0; i < n; i++) {
      const q = Math.round(lerp(Q.top, Q.bottom, i / (n - 1)) + (rand() * 2 - 1) * Q.spread);
      const pos = POS[Math.floor(rand() * 5)];
      const home = Geo.randomCity(rand).key;
      const base = Sample.generatePlayer(rand, { id: `R${year}-${i + 1}`, pos, base: q, quality: q });
      const player = League.dynastyPlayer(rand, base, { cls: "FR", quality: q, home });
      player.moneyWeight = rollMoneyWeight(rand, player);
      const ovr = League.ovrOf(player);
      // what the scouting services think: current ability only, with a weighted miss
      const roll = CFG.scout.publicRoll;
      const missOf = () => { let x = rand(), b = roll[roll.length - 1]; for (const r of roll) { if ((x -= r[0]) <= 0) { b = r; break; } }
        return (b[1] + Math.floor(rand() * (b[2] - b[1] + 1))) * (rand() < 0.5 ? -1 : 1); };
      // how well known he is (0 under the radar … 1 everyone's seen him): the services miss a known kid by less,
      // and a school's unscouted range is narrower for him (CFG.scout.level0.exposure)
      const exposure = rand(), E = CFG.scout.level0.exposure, missMul = E.missMin + (E.missMax - E.missMin) * (1 - exposure);
      const miss = Math.round(missOf() * missMul);
      const potMiss = Math.round(missOf() * CFG.scout.potMissScale * missMul);   // upside is harder to call than current ability
      const pub = clamp(Math.round(ovr + miss), 25, 99), pubPot = clamp(player.potential + potMiss, 25, 99);
      // the rank IS the public overall; ties go in random order (never by potential: that sorted the board into runs)
      raw.push({ player, ovr, pub, pubPot, exposure, score: pub + rand() * 0.5 });
    }
    raw.sort((a, b) => b.score - a.score);
    return raw.map((r, i) => {
      const rank = i + 1, p = r.player;
      const weights = rollWeights(rand, p.preferences || [], refRank(rank, raw.length));
      weights.rel = relWeight(rand, p.temperament);
      let ask = curve(CFG.asking, refRank(rank, raw.length)) * (1 + (rand() * 2 - 1) * CFG.askingVariance);
      ask *= 1 + CFG.moneyAskBoost * p.moneyWeight;
      if (p.temperament === "loyal") ask *= 1 - CFG.loyalAskCut * (1 - p.moneyWeight);
      return {
        id: p.id, rank, stars: starsFor(rank, raw.length), name: p.name, pos: p.pos, height: p.height,
        archetype: p.archetype, home: p.home, area: Geo.areaOf(p.home), ovr: r.ovr, potential: p.potential, pubOvr: r.pub, pubPot: r.pubPot, exposure: r.exposure,
        fog: { o: [rand(), rand(), rand()], p: [rand(), rand(), rand()], r: [rand(), rand(), rand()], w: [rand(), rand(), rand()], x: [rand(), rand(), rand(), rand(), rand(), rand()] },
        scout: {},             // teamId -> scouting points spent on him
        weights, moneyWeight: p.moneyWeight, asking: roundMoney(ask),
        status: "open", commitTo: null, commitWeek: null, deal: 0, decision: null,
        interest: {},          // teamId -> { rel, offer, weekPts }
        player: p,
      };
    });
  }

  /* ---------------- budget bookkeeping ---------------- */
  /* next year's payroll: everyone who isn't a senior */
  const returning = (team) => team.players.filter(p => p.class !== "SR");
  /* OFFSEASON money: once the books close at the end of the season, what's
     left is your bank, and everything in the offseason (raises, the portal,
     facilities) is paid from it. Every screen shows this same number. */
  function offseasonMoney(lg, team) {
    const OS = lg.offseason, bank = team.bank || 0;
    const Roster = req ? require("./roster.js") : root.Roster, Portal = req ? require("./portal.js") : root.Portal;
    let raises = 0, refunds = 0, pending = 0, signed = 0;
    if (OS.stage === "decisions" && Roster) {
      const out = new Set(OS.encouraged && OS.encouraged[team.id] || []);
      for (const p of team.players) { if (out.has(p.id)) refunds += p.salary || 0; else raises += Roster.bankCost(p); }
    }
    if (lg.portal && Portal) {
      pending = lg.portal.closed ? 0 : Portal.pendingOf(lg, team);
      for (const r of lg.portal.pool) if (r.status === "committed" && r.commitTo === team.id) signed += r.deal || 0;
    }
    const free = bank - raises + refunds - pending;
    return { offseason: true, bank, raises, refunds, pending, signed, collective: 0, carry: Math.max(0, bank), total: Math.max(0, bank) + signed,
      payroll: 0, committed: signed, facilities: 0, debt: Math.max(0, -bank), free };
  }
  function money(lg, team) {
    const R = lg.recruiting;
    if (lg.offseason && lg.offseason.settled) return offseasonMoney(lg, team);
    const payroll = returning(team).reduce((s, p) => s + (p.salary || 0), 0);
    let committed = 0, pending = 0;
    for (const r of R.pool) {
      if (r.status === "committed" && r.commitTo === team.id) committed += r.deal;
      else if (r.status === "open") { const it = r.interest[team.id]; if (it && it.offer) pending += it.offer; }
    }
    /* bank balance (program.js): positive = carried over from last cycle, negative = debt */
    const collective = team.collective || collectiveFor(team);
    const bank = team.bank || 0, carry = Math.max(0, bank), debt = Math.max(0, -bank);
    const total = collective + carry;
    const facilities = team.facSpent || 0;
    const C = CoachesMod(), staff = C ? C.staffPay(team) : 0;   // the coaching staff's pay this cycle
    return { collective, carry, total, payroll, committed, pending, facilities, staff, debt, free: total - payroll - committed - pending - facilities - staff - debt };
  }
  /* What an AI school will spend on players: player deals renew every year
     but carried-over money is one-time, so it only lets itself use a share
     of the bank each cycle (about one year of a four-year deal). */
  function aiFree(lg, team) {
    const m = money(lg, team);
    return m.free - (1 - CFG.ai.bankShare) * m.carry;
  }
  function openSpots(lg, team) {
    const commits = lg.recruiting.pool.filter(r => r.status === "committed" && r.commitTo === team.id).length;
    return Math.max(0, CFG.rosterSize - returning(team).length - commits);
  }

  /* ---------------- school scores (−1 … +1) ---------------- */
  /* Best five from next year's roster, where anyone can play his own slot or
     a neighbouring one (at a small overall penalty). Greedy on value. */
  function projectedOvr(p) { return League.ovrOf(p); }
  function recruitProjected(r) { return r.ovr + 0.3 * Math.max(0, r.potential - r.ovr); }

  /* next year's depth chart for a school (returning players, signed recruits,
     portal signings), rebuilt only when someone commits somewhere or the
     roster changes. It's read for every recruit a school looks at. */
  const depthCache = new WeakMap();
  const commitVer = new WeakMap();
  function touch(lg) { commitVer.set(lg, (commitVer.get(lg) || 0) + 1); }   // call after any commitment
  function depthBase(lg, team) {
    let byTeam = depthCache.get(lg);
    if (!byTeam) depthCache.set(lg, byTeam = {});
    const key = `${lg.season}|${commitVer.get(lg) || 0}|${lg.portal ? lg.portal.round : "-"}|${team.players.length}|${team.players.filter(p => p.redshirt).length}`;
    const hit = byTeam[team.id];
    if (hit && hit.key === key) return hit.list;
    const list = returning(team).filter(p => !p.redshirt).map(p => ({ id: p.id, pos: p.pos, v: projectedOvr(p) }));
    for (const c of lg.recruiting.pool) if (c.status === "committed" && c.commitTo === team.id) list.push({ id: c.id, pos: c.pos, v: recruitProjected(c) });
    if (lg.portal) for (const c of lg.portal.pool) if (c.status === "committed" && c.commitTo === team.id) list.push({ id: c.id, pos: c.pos, v: recruitProjected(c) });   // portal signings take minutes too
    byTeam[team.id] = { key, list };
    return list;
  }
  function ptRole(lg, team, r, value) {
    const pool = depthBase(lg, team).filter(p => p.id !== r.id);
    pool.push({ id: r.id, pos: r.pos, v: value != null ? value : recruitProjected(r) });
    const pairs = [];
    for (const p of pool) {
      pairs.push({ p, slot: p.pos, v: p.v });
      for (const s of NEIGHBOR[p.pos]) pairs.push({ p, slot: s, v: p.v - CFG.outOfPositionPenalty });
    }
    pairs.sort((a, b) => b.v - a.v);
    const usedP = new Set(), usedS = new Set();
    for (const x of pairs) {
      if (usedP.has(x.p.id) || usedS.has(x.slot)) continue;
      usedP.add(x.p.id); usedS.add(x.slot);
      if (usedS.size === 5) break;
    }
    const R = CFG.ptRoles;
    if (usedP.has(r.id)) return { ...R[0], idx: 0 };
    const bench = pool.filter(p => !usedP.has(p.id)).sort((a, b) => b.v - a.v);
    const i = bench.findIndex(p => p.id === r.id);
    const k = i <= 1 ? 1 : i <= 3 ? 2 : i <= 6 ? 3 : 4;
    return { ...R[k], idx: k };
  }
  /* how far his hometown is from the school, and what that's worth */
  const milesTo = (team, r) => Geo.miles(team.city, r.home);
  function proxScore(team, r) { const m = milesTo(team, r); return m == null ? 0 : CFG.prox[Geo.level(m)]; }
  function pipeScore(team, r) { return Pipelines.score(team, Geo.areaOf(r.home)); }
  function proxNote(team, r) { const m = milesTo(team, r); return m == null ? "hometown unknown" : `${Geo.level(m)} · ${Math.round(m)} mi`; }
  function pipeNote(team, r) {
    const a = Geo.areaOf(r.home), area = Geo.AREA[a];
    if (!area) return "—";
    const sc = pipeScore(team, r);
    return sc > 0 ? `${Pipelines.levelOf(Pipelines.strengthIn(team, a)).name} in ${area.name}` : `none in ${area.name}`;
  }
  function prestigeScore(lg, team, season) {
    let s = (team.prestige - 55) / 35;
    const ap = season && season.rankings ? season.rankings.ap.find(x => x.id === team.id) : null;
    if (ap) s += 0.25 * (26 - ap.rank) / 25;
    return clamp(s, -1, 1);
  }
  /* coach development + facilities, plus the school's recent draft picks (draft.js) */
  const DraftMod = () => req ? require("./draft.js") : root.Draft;
  function devScore(team) { const D = DraftMod(); return clamp(((staffR(team, "development") + team.facilities) / 2 - 60) / 30 + (D ? D.devBonus(team) : 0), -1, 1); }
  function relScore(rel) { return clamp((rel - 50) / 50, -1, 1); }

  /* The whole breakdown for one school and one recruit. */
  /* opts.ptValue: judge his playing time as if he were this good (used for
     what a school can SEE; the recruit himself always decides on the truth) */
  function evaluate(lg, team, r, season, opts = {}) {
    const it = r.interest[team.id] || { rel: r.relDefault || 0, offer: 0 };   // portal players start every school at a neutral 50
    const W = r.weights, S = CFG.swing, damp = 1 - CFG.moneyDamp * r.moneyWeight;
    const role = ptRole(lg, team, r, opts.ptValue);
    const parts = [
      { key: "pt", label: "Playing time", note: role.role, score: role.score, weight: W.pt, swing: S.pt },
      { key: "prox", label: "Proximity", note: proxNote(team, r), score: proxScore(team, r), weight: W.prox, swing: S.prox },
      { key: "prestige", label: "Prestige", note: `prestige ${League.grade(team.prestige)}`, score: prestigeScore(lg, team, season), weight: W.prestige, swing: S.prestige },
      { key: "dev", label: "Development", note: `staff dev ${staffR(team, "development")}, facilities ${League.grade(team.facilities)}${team.draftRep ? `, draft record +${Math.round(100 * DraftMod().devBonus(team) / DraftMod().CFG.reputation.devBonus)}%` : ""}`, score: devScore(team), weight: W.dev, swing: S.dev },
      { key: "rel", label: "Relationship", note: `${Math.round(it.rel)}/100`, score: relScore(it.rel), weight: W.rel ?? 1, swing: S.rel },
      { key: "pipe", label: "Pipeline", note: pipeNote(team, r), score: pipeScore(team, r), weight: Math.max(CFG.pipeWeightFloor, W.prox), swing: S.pipe },
    ];
    for (const p of parts) p.change = p.score * Math.max(CFG.weightFloor, p.weight) * p.swing;
    const fit = parts.reduce((s, p) => s + p.change, 0);
    const mult = clamp(1 + fit * damp, CFG.multClamp[0], CFG.multClamp[1]);
    return { teamId: team.id, parts, fit, damp, mult, offer: it.offer || 0, effective: (it.offer || 0) * mult, rel: it.rel || 0 };
  }

  /* All schools with an offer on the table, best effective first. */
  function standings(lg, r, season, opts = {}) {
    const out = [];
    for (const id in r.interest) {
      const it = r.interest[id];
      if (!it.offer) continue;
      out.push(evaluate(lg, lg.byId[id], r, season, opts));
    }
    return out.sort((a, b) => b.effective - a.effective);
  }

  /* ---------------- player actions (also used by the AI) ---------------- */
  function interestOf(r, teamId) { return r.interest[teamId] || (r.interest[teamId] = { rel: 0, offer: 0, weekPts: 0 }); }

  function addPoints(lg, team, r, pts) {
    const R = lg.recruiting, P = CFG.points;
    if (r.status !== "open") return { ok: false, why: "He has already committed." };
    const it = interestOf(r, team.id);
    const left = R.pointsLeft[team.id] || 0;
    const room = P.capPerRecruit - (it.weekPts || 0);
    const n = Math.min(pts, left, room);
    if (n <= 0) return { ok: false, why: room <= 0 ? `Weekly limit of ${P.capPerRecruit} points per recruit reached.` : "No recruiting points left this week." };
    const before = it.rel;
    it.rel = clamp(it.rel + n * P.gain * (1 + it.rel / P.compound), 0, 100);
    it.weekPts = (it.weekPts || 0) + n;
    R.pointsLeft[team.id] = left - n;
    return { ok: true, spent: n, gained: it.rel - before, rel: it.rel };
  }

  function setOffer(lg, team, r, amount) {
    if (r.status !== "open") return { ok: false, why: "He has already committed." };
    const it = interestOf(r, team.id);
    amount = Math.max(0, amount) < 10000 ? roundMoney(Math.max(0, amount)) : Math.round(amount / 1000) * 1000;   // offers move in $1k steps
    if (amount === it.offer) return { ok: false, why: "That's already your offer." };
    /* until the weekly refresh nobody has seen it: you can lower it, down to what he saw last week */
    if (amount < it.offer) {
      const seen = it.seen || 0;
      if (amount < seen) return { ok: false, why: `He's already seen ${fmt(seen)} from you, so you can't go below that. You can only lower an offer or raise on the day you make it; withdrawing now costs relationship.` };
      it.offer = amount;
      return { ok: true, lowered: true };
    }
    // once he's seen an offer from you, you can walk away but you can't come back cheaper
    if (it.floor && amount < it.floor) return { ok: false, why: `He's already seen ${fmt(it.floor)} from you. Coming back lower would be an insult: a new offer has to be at least that.` };
    if (openSpots(lg, team) <= 0) return { ok: false, why: "No open scholarships for next season." };
    const m = money(lg, team);
    if (m.free < 0) return { ok: false, why: `You're ${fmt(-m.free)} over budget${m.debt ? " (debt carried from last year)" : ""}. No new offers until you're back in the black.` };
    if (amount - it.offer > m.free) return { ok: false, why: `Only ${fmt(m.free + it.offer)} available for this offer.` };
    it.offer = amount;
    return { ok: true };
  }

  /* what each kid has seen from each school: offers below it can't be taken back for free */
  function markSeen(pool) { for (const r of pool) for (const id in r.interest) { const it = r.interest[id]; it.seen = it.offer || 0; if (it.seen > (it.floor || 0)) it.floor = it.seen; } }   // floor: the most he's seen from a school this cycle
  function withdrawOffer(lg, team, r, quiet) {
    const it = r.interest[team.id];
    if (!it || !it.offer) return { ok: false, why: "No offer to withdraw." };
    const seen = it.seen || 0;
    it.offer = 0;
    const autoOff = !!it.auto; it.auto = false;   // no more recruiting points on autopilot for a kid you've pulled the offer from
    // pulling an offer he's seen hurts the relationship; one made since the last refresh is free to take back
    if (!quiet && seen > 0) it.rel = Math.round(it.rel * 0.5);
    return { ok: true, free: seen <= 0, autoOff };
  }

  /* ---------------- AI schools ---------------- */
  /* One school's week. It counts its money once and keeps its own books as
     it moves (nothing else changes during its turn). New targets: it ranks
     the kids it can afford by its own read of them and only looks closely
     (playing time, fit, real cost) at a shortlist, so a 352-team league
     costs about what a 74-team one did per school. */
  function aiWeek(lg, team, rand, season) {
    const R = lg.recruiting, A = CFG.ai;
    const spots = openSpots(lg, team);
    const mine = R.pool.filter(r => r.status === "open" && r.interest[team.id] && r.interest[team.id].offer);
    if (spots <= 0) { for (const r of mine) withdrawOffer(lg, team, r, true); return; }
    const m0 = money(lg, team);
    let free = m0.free - (1 - A.bankShare) * m0.carry;            // = aiFree, kept up to date below
    const drop = (r) => { const was = r.interest[team.id].offer; withdrawOffer(lg, team, r, true); free += was; mine.splice(mine.indexOf(r), 1); };

    // respond to the market first: raise where we're losing and it's still worth it, give up where it isn't.
    // A school with money to burn will pay more than a kid's price; a poor one won't.
    const perSpot = (free + m0.pending) / spots;
    for (const r of mine.slice()) {
      const st = standings(lg, r, season);
      const me = st.find(s => s.teamId === team.id);
      if (!me || st[0].teamId === team.id) continue;
      const needed = roundMoney((st[0].effective * between(rand, A.raiseOver[0], A.raiseOver[1])) / me.mult);   // dollars it takes to pass him, at our fit
      const price = aiWorth(team, r);                    // what HE is worth to us (our read), in dollars: fit doesn't move it
      const cap = Math.max(price * A.maxPay, Math.min(perSpot * A.richShare, price * A.richMaxPay));
      if (needed <= cap && needed - me.offer <= free) { if (rand() < A.raiseChance) { free -= needed - me.offer; interestOf(r, team.id).offer = needed; } }
      else if (rand() < A.giveUpChance) drop(r);
    }

    // refill the board: enough live offers to cover the open scholarships,
    // each sized to what the budget can spread across them
    const want = Math.ceil(spots * A.targetsPerSpot);
    if (mine.length < want) {
      const perOffer = Math.max(3000, free / (want - mine.length));
      const reach = perOffer * A.stretch;
      // shortlist: affordable kids, best by this school's own read (crowd-adjusted), before the expensive look
      const quick = [];
      const pull = A.localPull * lerp(A.localPullPrestige[0], A.localPullPrestige[1], (team.prestige - 30) / 65);
      for (const r of R.pool) {
        if (r.status !== "open" || (r.interest[team.id] && r.interest[team.id].offer)) continue;
        if (r.asking > reach * 1.6) continue;                              // cheap pre-filter
        if (Math.min(r.asking, aiWorth(team, r)) > reach) continue;   // can't afford him
        let crowd = 0; for (const id in r.interest) if (r.interest[id].offer) crowd++;
        const v = aiRead(team, r), gap = v - publicValue(r);   // a bargain (we think he's better than his ranking) or a bad deal
        quick.push({ r, crowd, read: v + A.bargain * gap - A.crowding * crowd + pull * localEdge(team, r) });
      }
      quick.sort((x, y) => y.read - x.read);
      const cands = [];
      for (const q of quick.slice(0, Math.max(A.shortlist, want * A.shortlistPerOffer))) {
        const r = q.r, ev = evaluate(lg, team, r, season);
        // open at his ask if he's worth it, at his worth (to us) if he's asking too much (he can hold out)
        const cost = Math.min(r.asking, aiWorth(team, r));
        if (cost > reach) continue;
        const need = ev.parts[0].score > 0 ? 4 : ev.parts[0].score < -0.5 ? -4 : 0;
        // a kid half the country is already chasing is a worse bet than one nobody has noticed
        cands.push({ r, ev, cost, val: q.read + need + rand() * 3 });
      }
      cands.sort((a, b) => b.val - a.val);
      for (const c of cands) {
        if (mine.length >= want) break;
        const offer = floorMoney(Math.min(free, c.cost * between(rand, A.openOffer[0], A.openOffer[1])));
        if (offer < c.cost * 0.6 || offer <= 0) continue;
        interestOf(c.r, team.id).offer = offer;
        free -= offer; mine.push(c.r);
      }
    }

    // points: spread over the targets
    let pts = R.pointsLeft[team.id] || 0;
    for (const r of mine.slice().sort(() => rand() - 0.5)) {
      if (pts <= 0) break;
      const res = addPoints(lg, team, r, CFG.points.capPerRecruit);
      if (res.ok) pts -= res.spent;
    }
  }

  /* Signing day for the AI: any school with an empty scholarship makes a
     last offer to the best kid still on the board that it can afford,
     whatever his asking price. Leftovers take what they can get. */
  function aiFill(lg, team, season) {
    const R = lg.recruiting;
    let spots = openSpots(lg, team);
    const offers = R.pool.filter(r => r.status === "open" && r.interest[team.id] && r.interest[team.id].offer).length;
    if (spots - offers <= 0) return 0;
    let made = 0;
    const free = Math.max(0, aiFree(lg, team));
    const each = free / (spots - offers);
    // kids nobody has offered first, so late offers spread out instead of piling on one player
    const offersOn = (r) => Object.values(r.interest).filter(i => i.offer).length;
    const cands = R.pool.filter(r => r.status === "open" && !(r.interest[team.id] && r.interest[team.id].offer))
      .sort((a, b) => (offersOn(a) > 0) - (offersOn(b) > 0) || a.rank - b.rank);
    for (const r of cands) {
      if (spots - offers <= 0) break;
      const ev = evaluate(lg, team, r, season);
      const offer = floorMoney(Math.min(each, r.asking, aiWorth(team, r)));
      if (offer <= 0 && each > 0) continue;
      interestOf(r, team.id).offer = Math.max(offer, 100);
      spots--; made++;
    }
    return made;
  }

  /* ---------------- commits ---------------- */
  function seasonProgress(season) { return clamp((season ? season.day : 0) / CFG.commit.seasonDays, 0, 1); }

  function commitRecruit(lg, r, ev, season, st, odds) {
    const team = lg.byId[ev.teamId];
    r.status = "committed"; r.commitTo = team.id; r.deal = ev.offer; touch(lg);
    r.commitWeek = lg.recruiting.week; r.commitDay = season ? season.day : 0;
    r.odds = odds == null ? null : +odds.toFixed(3);
    const shown = st.slice(0, 3);
    if (!shown.includes(ev)) shown.push(ev);
    r.decision = shown.map(s => ({ teamId: s.teamId, offer: s.offer, mult: +s.mult.toFixed(3), effective: Math.round(s.effective),
      parts: s.parts.map(p => ({ key: p.key, label: p.label, note: p.note, change: +(p.change * s.damp).toFixed(3) })) }));
    // everyone else's offer comes off the books
    for (const id in r.interest) if (id !== team.id) r.interest[id].offer = 0;
    const other = st.find(x => x !== ev);
    const lead = other ? ` over ${lg.byId[other.teamId].name}` : "";
    const upset = odds != null && odds < 0.4 && st.length > 1 ? ` An upset: he picked them at ${Math.round(odds * 100)}% odds.` : "";
    lg.recruiting.log.unshift({ week: lg.recruiting.week, day: season ? season.day : 0, recruitId: r.id, teamId: team.id,
      text: `${r.stars}★ #${r.rank} ${r.pos} ${r.name} commits to ${team.name}${lead} (${fmt(r.deal)}).${upset}` });
    // a school that just filled its last spot pulls its other offers
    if (openSpots(lg, team) <= 0) for (const o of lg.recruiting.pool) if (o.status === "open" && o.interest[team.id] && o.interest[team.id].offer) withdrawOffer(lg, team, o, true);
  }

  /* each school's chance of being picked, if he decides now */
  /* commit-chance curves (also used by the portal) */
  function belowLineMult(top, line, fade, floor) {   // full at or over his line, sliding to `floor` at `fade` under it
    if (top >= line || line <= 0) return 1;
    return lerp(1, floor, (1 - top / line) / fade);
  }
  function leadMult(st, full, tied, clear) {          // tied → `tied`, a `full` lead or more → `clear`, in a straight line
    const margin = (st[0].effective - st[1].effective) / Math.max(1, st[0].effective);
    return lerp(tied, clear, margin / full);
  }
  function commitOdds(st) {
    if (!st.length) return [];
    const k = CFG.commit.oddsPower, top = Math.max(1, st[0].effective);
    const w = st.map(s => Math.pow(Math.max(0, s.effective) / top, k));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    return st.map((s, i) => ({ teamId: s.teamId, odds: w[i] / sum }));
  }
  function pickByOdds(st, rand) {
    const od = commitOdds(st);
    let x = rand();
    for (let i = 0; i < od.length; i++) { if ((x -= od[i].odds) <= 0) return { i, odds: od[i].odds }; }
    return { i: 0, odds: od[0].odds };
  }

  function rollCommits(lg, rand, season, force) {
    const C = CFG.commit, R = lg.recruiting;
    const prog = seasonProgress(season);
    const thresh = force ? 0 : lerp(C.thresholdStart, C.thresholdEnd, prog);
    for (const r of [...R.pool].sort((a, b) => a.rank - b.rank)) {
      if (r.status !== "open") continue;
      const st = standings(lg, r, season).filter(s => openSpots(lg, lg.byId[s.teamId]) > 0);
      if (!st.length) continue;
      if (!force) {
        let p = lerp(C.startChance, C.endChance, prog);
        if (r.rank <= C.topRank && prog < 0.5) p *= C.topEarlyMult;
        p *= belowLineMult(st[0].effective, r.asking * thresh, C.belowFade, C.belowThresholdMult);
        if (st.length === 1) p *= C.soleOfferMult;
        else p *= leadMult(st, C.clearLead, C.closeRaceMult, C.clearLeadMult);
        if (rand() >= p) continue;
      }
      const pick = pickByOdds(st, rand);
      commitRecruit(lg, r, st[pick.i], season, st, pick.odds);
    }
  }

  /* ---------------- scouting ---------------- */
  const weeklyScout = (team) => CFG.scout.base + staffR(team, "scouting") * CFG.scout.perRating;
  const workRating = (dev) => clamp(Math.round(((dev || 1) - 0.85) / 0.4 * 99), 0, 99);
  function strHash(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  /* what an AI school believes a kid is worth: mostly the public read,
     part of his real upside, and its own scouting error */
  /* distance + pipeline edge a school has with a kid (cached: both hold for the whole cycle) */
  const edgeCache = new WeakMap();
  function localEdge(team, r) {
    let c = edgeCache.get(r); if (!c) edgeCache.set(r, c = new Map());
    let v = c.get(team.id);
    if (v === undefined) c.set(team.id, v = proxScore(team, r) + pipeScore(team, r));
    return v;
  }
  const readCache = new WeakMap();   // recruit → Map(teamId → read): the same every time, so worked out once
  function aiRead(team, r) {
    let c = readCache.get(r); if (!c) readCache.set(r, c = new Map());
    let v = c.get(team.id);
    if (v === undefined) c.set(team.id, v = aiReadRaw(team, r));
    return v;
  }
  /* its value read of him: the same formula as everyone's value, on its own numbers */
  function aiReadRaw(team, r) {
    const n = aiNumbers(team, r);
    return n.ovr + CFG.upsideWeight * Math.max(0, n.pot - n.ovr);
  }
  /* what this school thinks his overall and potential are (CFG.scout.ai). Seeded by
     school + recruit, so it's the same all cycle without being saved. */
  function aiNumbers(team, r) {
    const A = CFG.scout.ai, rnd = Engine.makeRng(strHash(team.id + "|" + r.id));
    const e = Math.pow(A.skewBase, (50 - staffR(team, "scouting")) / 25);
    const one = (pub, truth, reach) => {
      const start = pub + (rnd() * 2 - 1) * A.wobble;
      const roll = Math.pow(rnd(), e) * reach;
      return start + roll * (truth - start);
    };
    const ovr = one(r.pubOvr != null ? r.pubOvr : r.ovr, r.ovr, 1);
    const pot = one(r.pubPot != null ? r.pubPot : r.potential, r.potential, A.potReach);
    return { ovr, pot };
  }

  /* the value the rankings give him (public overall and potential only) */
  function publicValue(r) {
    const o = r.pubOvr != null ? r.pubOvr : r.ovr, pt = r.pubPot != null ? r.pubPot : r.potential;
    return o + CFG.upsideWeight * Math.max(0, pt - o);
  }
  /* what a recruit is worth a year to an AI school: its own read, on the shared worth scale.
     That's its ceiling: a good scout pays up for a sleeper, a weak one overpays for a bust. */
  const aiWorth = (team, r) => worthOf(aiRead(team, r));

  /* Level 0: a band of width W centred on what the services believe plus
     their extra miss, and left there: it can miss the truth entirely.
     Level 1+: a band of fixed width W centred on the public read (nudged a
     little), then slid just far enough to contain the truth, so a sleeper
     or bust shows the truth near an edge. Level 2 sits inside level 1; level
     1 does NOT have to sit inside level 0, so scouting a kid the services
     got wrong makes his band jump. */
  function band(truth, widths, us, level, center, lo0 = 25, hi0 = 99, read0 = 0, vary = 0) {
    if (widths[level] == null) return null;            // not revealed at this level
    if (center == null) center = truth;
    if (level === 0) {
      const W = Math.max(2, widths[0] + Math.round(vary));
      if (W <= 0) return [truth, truth];
      const lo = Math.round(center + read0 - W / 2);
      const a = clamp(lo, lo0, hi0 - W), b = clamp(a + W, lo0, hi0);
      return [a, b];
    }
    let lo = -Infinity, hi = Infinity;
    for (let k = 1; k <= level; k++) {
      const W = widths[k];
      if (W == null) continue;
      if (W <= 0) return [truth, truth];
      const want = center - W / 2 + (us[k % us.length] - 0.5) * W * CFG.scout.bandJitter;
      const a = Math.max(truth - W, lo), b = Math.min(truth, hi - W);
      lo = b >= a ? clamp(want, a, b) : a;
      hi = lo + W;
    }
    return [clamp(Math.floor(lo), lo0, hi0), clamp(Math.ceil(hi), lo0, hi0)];
  }
  /* level 0: this school's own small read on the public numbers (weaker
     scouts drift further), and how wide each band runs for this kid */
  function level0Read(team, r) {
    const L0 = CFG.scout.level0, rnd = Engine.makeRng(strHash(team.id + "~" + r.id));
    const spread = L0.teamRead * (1.3 - 0.006 * staffR(team, "scouting"));
    const x = (r.fog && r.fog.x) || [0.5, 0.5], W = CFG.scout.width;
    const wMul = L0.exposure.widthMin + (L0.exposure.widthMax - L0.exposure.widthMin) * (1 - (r.exposure ?? 0.5));   // well known: narrow; under the radar: wide
    return { ovr: (rnd() * 2 - 1) * spread, pot: (rnd() * 2 - 1) * spread,
      wOvr: (x[0] - 0.5) * 2 * L0.widthVary + W.ovr[0] * (wMul - 1), wPot: (x[1] - 0.5) * 2 * L0.widthVary + W.pot[0] * (wMul - 1) };
  }

  function scoutPoints(lg, team, r) { return (r.scout && r.scout[team.id]) || 0; }
  function scoutLevel(lg, team, r) {
    const pts = scoutPoints(lg, team, r), L = CFG.scout.levels;
    return pts >= L[2] ? 3 : pts >= L[1] ? 2 : pts >= L[0] ? 1 : 0;
  }
  /* everything a school can see about a recruit right now */
  function scoutView(lg, team, r) {
    const level = scoutLevel(lg, team, r), W = CFG.scout.width, f = r.fog || { o: [0.5], p: [0.5], r: [0.5], w: [0.5] };
    const ratings = {};
    const miss = (r.pubOvr != null ? r.pubOvr : r.ovr) - r.ovr;          // ratings carry the same public miss as the overall
    const m0 = level0Read(team, r);                                      // ... and at level 0 this school's own read
    for (const k in r.player.ratings) ratings[k] = band(r.player.ratings[k], W.rating, f.r, level, r.player.ratings[k] + miss, 25, 99, m0.ovr, m0.wOvr);
    return {
      level, pts: scoutPoints(lg, team, r), next: CFG.scout.levels[level] || null,
      ovr: band(r.ovr, W.ovr, f.o, level, r.pubOvr, 25, 99, m0.ovr, m0.wOvr), pot: band(r.potential, W.pot, f.p, level, r.pubPot, 25, 99, m0.pot, m0.wPot),
      ratings, work: band(workRating(r.player.devRate), W.work, f.w, level, workRating(r.player.devRate) + (f.w[2] - 0.5) * 24, 0, 99),   // no public read on work rate: the band sits off-centre by a fixed random amount, so the middle isn't the answer
      wants: level >= 1,
      rough: level === 0,                                               // the services' read: can be off
    };
  }
  /* What a school can tell about its own pitch: playing time judged at the
     bottom and the top of his scouted range. Exact once fully scouted. */
  function viewValue(v, end) {
    const o = v.ovr[end], p = v.pot[end];
    return o + 0.3 * Math.max(0, p - o);
  }
  function evaluateRange(lg, team, r, season) {
    const v = scoutView(lg, team, r);
    if (v.level >= 3) { const e = evaluate(lg, team, r, season); return { lo: e, hi: e, mid: e, exact: true }; }
    const lo = evaluate(lg, team, r, season, { ptValue: viewValue(v, 0) });
    const hi = evaluate(lg, team, r, season, { ptValue: viewValue(v, 1) });
    const mid = evaluate(lg, team, r, season, { ptValue: (viewValue(v, 0) + viewValue(v, 1)) / 2 });
    return { lo, hi, mid, exact: false };
  }
  /* the race as this school sees it: everyone's playing-time pitch judged on
     the middle of its scouted range, not on the truth */
  function standingsSeen(lg, team, r, season) {
    const v = scoutView(lg, team, r);
    if (v.level >= 3) return standings(lg, r, season);
    return standings(lg, r, season, { ptValue: (viewValue(v, 0) + viewValue(v, 1)) / 2 });
  }

  function scout(lg, team, r, n) {
    const R = lg.recruiting;
    const have = R.scoutPts[team.id] || 0;
    const cur = scoutPoints(lg, team, r), need = CFG.scout.levels[2] - cur;
    if (need <= 0) return { ok: false, why: "He's fully scouted." };
    const spend = Math.min(n, need, Math.floor(have * 10) / 10);
    if (spend <= 0) return { ok: false, why: "No scouting points left. You get more every week." };
    const before = scoutLevel(lg, team, r);
    (r.scout || (r.scout = {}))[team.id] = cur + spend;
    R.scoutPts[team.id] = have - spend;
    return { ok: true, spent: spend, level: scoutLevel(lg, team, r), levelUp: scoutLevel(lg, team, r) > before };
  }

  /* debug: sign him to a school right now, at that school's current offer
     (or his asking price if it has none) */
  function forceCommit(lg, r, teamId, season) {
    if (r.status !== "open") return false;
    const it = interestOf(r, teamId);
    if (!it.offer) it.offer = r.asking;
    const ev = evaluate(lg, lg.byId[teamId], r, season);
    commitRecruit(lg, r, ev, season, [ev, ...standings(lg, r, season).filter(s => s.teamId !== teamId)]);
    return true;
  }

  /* ---------------- the weekly tick ---------------- */
  /* ---------------- news for the kids on your board ---------------- */
  const onBoard = (r, teamId) => { const it = r.interest[teamId]; return r.status === "open" && it && (it.offer || it.watch || it.rel > 0 || it.auto); };
  function boardSnapshot(lg, season) {
    const R = lg.recruiting, snap = {};
    for (const u of lg.teams.filter(t => t.isUser)) {
      const mine = snap[u.id] = {};
      for (const r of R.pool) {
        if (!onBoard(r, u.id)) continue;
        const offers = {}; for (const id in r.interest) if (r.interest[id].offer) offers[id] = r.interest[id].offer;
        mine[r.id] = { offers, lead: scoutLevel(lg, u, r) >= 1 ? (standingsSeen(lg, u, r, season)[0] || {}).teamId : null };
      }
    }
    return snap;
  }
  function boardNews(lg, season, before) {
    const R = lg.recruiting;
    R.news = R.news || [];
    for (const uid in before) {
      const u = lg.byId[uid];
      for (const rid in before[uid]) {
        const r = R.pool.find(x => x.id === rid), b = before[uid][rid];
        if (!r || r.status !== "open") continue;
        const who = `${r.stars}★ #${r.rank} ${r.pos} ${r.name}`;
        const add = (text, kind) => R.news.unshift({ teamId: uid, week: R.week, day: season ? season.day : 0, recruitId: r.id, text, kind });
        for (const id in r.interest) {
          if (id === uid) continue;
          const now = r.interest[id].offer || 0, was = b.offers[id] || 0;
          if (now && !was) add(`${lg.byId[id].name} offered ${who} ${fmt(now)}.`, "offer");
          else if (now > was) add(`${lg.byId[id].name} raised its offer for ${who} to ${fmt(now)} (was ${fmt(was)}).`, "raise");
        }
        if (b.lead != null && scoutLevel(lg, u, r) >= 1) {
          const lead = (standingsSeen(lg, u, r, season)[0] || {}).teamId;
          if (b.lead === uid && lead && lead !== uid) add(`You lost the lead for ${who} to ${lg.byId[lead].name}.`, "lost");
          else if (b.lead !== uid && lead === uid) add(`You took the lead for ${who}.`, "lead");
        }
      }
    }
    if (R.news.length > 200) R.news.length = 200;
  }

  function aiOrder(lg, rand) {
    const a = lg.teams.filter(t => !t.isUser);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function weekly(lg, season) {
    const R = lg.recruiting;
    if (!R || R.closed) return;
    R.week++;
    const rand = Engine.makeRng(hash(lg.seed, R.year, R.week, 0xa1));
    // last week's contact (or lack of it) settles first
    for (const r of R.pool) {
      if (r.status !== "open") continue;
      for (const id in r.interest) {
        const it = r.interest[id];
        if (!it.weekPts) it.rel = Math.max(0, it.rel - CFG.points.decay);
      }
    }
    // kids decide on the offers that have been on the table all week; THEN
    // the AI schools move, so every new or raised AI offer sits on the board
    // for a week where you can see it and answer before anyone can commit
    rollCommits(lg, rand, season, false);
    const before = boardSnapshot(lg, season);
    for (const t of aiOrder(lg, rand)) aiWeek(lg, t, rand, season);   // a new order every week: nobody always gets the last word
    boardNews(lg, season, before);
    markSeen(lg.recruiting.pool);   // from here on, everyone has seen this week's offers
    // fresh week
    for (const r of R.pool) for (const id in r.interest) r.interest[id].weekPts = 0;
    for (const t of lg.teams) R.pointsLeft[t.id] = weeklyPoints(t);
    for (const t of lg.teams) if (t.isUser) autoPoints(lg, t);
    for (const t of lg.teams) R.scoutPts[t.id] = (R.scoutPts[t.id] || 0) + weeklyScout(t);   // piles up through the season; resets with the next class
  }
  /* Auto-recruiting: at each refresh, max out (20 points each) every kid
     set to auto — one at a time with the per-player toggle, or everyone on
     your board (offered or starred) with the team-wide box. Kids you've
     offered go first, then the rest, best public rank first within each. Manual spending still works on top. */
  function autoTargets(lg, team) {
    const R = lg.recruiting;
    return R.pool.filter(r => {
      const it = r.interest[team.id];
      return r.status === "open" && it && (it.auto || (team.autoPoints && (it.offer || it.watch)));
    }).sort((a, b) => (!a.interest[team.id].offer - !b.interest[team.id].offer) || a.rank - b.rank);   // kids you've offered first, then the rest; best-ranked first within each
  }
  function autoPoints(lg, team, only) {
    const R = lg.recruiting;
    if (!R || R.closed) return 0;
    let spent = 0;
    for (const r of only ? [only] : autoTargets(lg, team)) {
      if ((R.pointsLeft[team.id] || 0) <= 0) break;
      const res = addPoints(lg, team, r, CFG.points.capPerRecruit);
      if (res.ok) spent += res.spent;
    }
    return spent;
  }
  const weeklyPoints = (team) => Math.round(CFG.points.base + staffR(team, "recruiting") * CFG.points.perRating);

  function signingDay(lg, season) {
    const R = lg.recruiting;
    if (!R || R.closed) return;
    const rand = Engine.makeRng(hash(lg.seed, R.year, 0x51d));
    for (const t of aiOrder(lg, rand)) aiWeek(lg, t, rand, season);
    // keep going until the board settles: kids pick, schools left short make new offers
    for (let round = 0; round < 25; round++) {
      rollCommits(lg, rand, season, true);
      let made = 0;
      for (const t of aiOrder(lg, rand)) made += aiFill(lg, t, season);
      if (!made) break;
    }
    rollCommits(lg, rand, season, true);
    R.closed = true;
    const signed = R.pool.filter(r => r.status === "committed").length;
    R.log.unshift({ week: R.week, day: season ? season.day : 0, text: `Signing day: ${signed} of ${R.pool.length} recruits signed. The rest go unsigned.` });
  }

  /* Called by the season loop at the end of every day. */
  function onDay(lg, season) {
    const R = lg.recruiting;
    if (!R || R.closed) return;
    const done = season.post && season.post.phase === "done";
    if (done) { signingDay(lg, season); return; }
    if (season.day > 0 && season.day % 7 === 0) weekly(lg, season);
    markSeen(R.pool);   // the day is over: today's offers can't be taken back for free any more
  }

  /* ---------------- setup, migration, offseason ---------------- */
  function startCycle(lg, year) {
    lg.recruiting = { year, week: 0, closed: false, pool: generatePool(lg, year), pointsLeft: {}, scoutPts: {}, log: [] };
    for (const t of lg.teams) {
      lg.recruiting.scoutPts[t.id] = weeklyScout(t);   // a fresh class starts with one week's worth; unspent points don't carry into it
      t.collective = collectiveFor(t);
      lg.recruiting.pointsLeft[t.id] = weeklyPoints(t);
    }
    // the board opens contested: AI schools make their opening offers (and
    // spend their first week's points) before day 1
    const rand = Engine.makeRng(hash(lg.seed, year, 0x0be));
    for (const t of lg.teams) if (!t.isUser) aiWeek(lg, t, rand, null);
    markSeen(lg.recruiting.pool);
    for (const t of lg.teams) lg.recruiting.pointsLeft[t.id] = weeklyPoints(t);
  }

  /* Safe to call any time: fills in whatever an older save is missing. */
  function ensure(lg) {
    if (CoachesMod()) CoachesMod().ensure(lg);   // staffs and the coach pool (their pay is part of the money)
    const rand = Engine.makeRng(hash(lg.seed, lg.season, 0xe5));
    for (const t of lg.teams) {
      if (t.collective == null) t.collective = collectiveFor(t);
      const fresh = t.players.filter(p => p.salary == null);
      for (const p of t.players) ensurePlayerMoney(rand, p);
      // salaries handed out just now follow what this school can actually pay:
      // a good player at a small school earns a small-school salary
      if (fresh.length) {
        const cap = t.collective * CFG.startingPayrollCap;
        const payroll = returning(t).reduce((s, p) => s + p.salary, 0);   // seniors aren't on next year's books
        if (payroll > cap) for (const p of fresh) p.salary = floorMoney(p.salary * cap / payroll);
      }
    }
    if (!lg.recruiting) startCycle(lg, lg.season);
    // saves from before scouting: give the open class scouting fog and everyone a points pool
    const R = lg.recruiting;
    if (!R.scoutPts) { R.scoutPts = {}; for (const t of lg.teams) R.scoutPts[t.id] = weeklyScout(t) * Math.max(1, R.week); }
    for (const r of R.pool) {
      if (!r.fog) r.fog = { o: [rand(), rand(), rand()], p: [rand(), rand(), rand()], r: [rand(), rand(), rand()], w: [rand(), rand(), rand()] };
      if (!r.fog.x) r.fog.x = [rand(), rand(), rand(), rand(), rand(), rand()];   // level-0 scouting miss
      if (r.pubOvr == null) r.pubOvr = r.ovr;
      if (r.pubPot == null) r.pubPot = r.potential;
      if (!r.scout) r.scout = {};
      for (const id in r.interest) if (r.interest[id].seen == null) r.interest[id].seen = r.interest[id].offer || 0;
      if (r.weights && r.weights.rel == null) r.weights.rel = relWeight(rand, r.player.temperament);
    }
  }

  /* Offseason: signed recruits join, walk-ons fill to 13, next cycle opens.
     Call after departures/transfers and class advancement. */
  function arrivals(lg, rand) {
    const R = lg.recruiting;
    const incoming = {};
    for (const t of lg.teams) {
      const arrived = [];
      if (R) for (const r of R.pool) {
        if (r.status !== "committed" || r.commitTo !== t.id) continue;
        const p = r.player;
        p.id = `${t.id}-${r.id}`;
        p.home = r.home;
        p.salary = r.deal;
        p.redshirtUsed = false;
        p.recruitRank = r.rank; p.recruitStars = r.stars;
        if (r.weights) p.ptWeight = r.weights.pt;   // how much playing time mattered to him carries into his transfer odds
        t.players.push(p);
        // the reveal: what this school had scouted, and how far the public read was off
        const seen = scoutView(lg, t, r), dO = r.ovr - (r.pubOvr ?? r.ovr), dP = r.potential - (r.pubPot ?? r.potential);
        const tag = (dO >= 4 || dP >= 8) && dO >= 0 ? "steal" : (dO <= -4 || dP <= -8) && dO <= 0 ? "bust" : null;
        arrived.push({ id: p.id, name: p.name, pos: p.pos, class: p.class, ovr: League.ovrOf(p), potential: p.potential, why: "recruit", rank: r.rank, stars: r.stars, deal: r.deal,
          seenOvr: seen.ovr, seenPot: seen.pot, seenLevel: seen.level, tag });
      }
      let n = 0;
      while (t.players.length < CFG.rosterSize) {
        const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
        t.players.forEach(p => counts[p.pos]++);
        const pos = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
        const q = clamp(Math.round(30 + t.prestige * 0.30 + (rand() * 2 - 1) * 5), 28, 70);
        const base = Sample.generatePlayer(rand, { id: `${t.id}-w${lg.season + 1}-${++n}`, pos, base: q, quality: q });
        const p = League.dynastyPlayer(rand, base, { cls: "FR", quality: q, home: Geo.hometown(rand, t.city, Geo.CFG.walkOnLocal).key });
        p.moneyWeight = rollMoneyWeight(rand, p);
        p.salary = roundMoney(between(rand, CFG.walkOnSalary[0], CFG.walkOnSalary[1]));
        p.walkOn = true;
        t.players.push(p);
        arrived.push({ id: p.id, name: p.name, pos: p.pos, class: p.class, ovr: League.ovrOf(p), potential: p.potential, why: "walk-on" });
      }
      incoming[t.id] = arrived;
    }
    return incoming;
  }

  /* ---------------- formatting ---------------- */
  function fmt(v) {
    v = Math.round(v || 0);
    const s = v < 0 ? "−" : "";
    v = Math.abs(v);
    if (v >= 1e6) return `${s}$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M`;
    if (v >= 1e3) return `${s}$${Math.round(v / 1e3)}k`;
    return `${s}$${v}`;
  }

  const Recruiting = {
    CFG, ensure, startCycle, onDay, weekly, signingDay, arrivals, touch,
    evaluate, standings, money, proxScore, pipeScore, milesTo, offseasonMoney, markSeen, openSpots, ptRole, addPoints, setOffer, withdrawOffer,
    weeklyPoints, playerValue, worthOf, aiWorth, publicValue, marketValue: (r) => worthOf(publicValue(r)), autoPoints, autoTargets, collectiveFor, aiFree, fmt, curve, forceCommit,
    scout, scoutView, scoutLevel, commitOdds, belowLineMult, leadMult, weeklyScout, workRating, aiRead, aiNumbers, evaluateRange, standingsSeen,
  };
  if (typeof module !== "undefined") module.exports = Recruiting;
  else root.Recruiting = Recruiting;
})(typeof window !== "undefined" ? window : globalThis);
