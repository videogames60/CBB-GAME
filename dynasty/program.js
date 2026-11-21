/* =====================================================================
   HOOPS DYNASTY — PROGRAM (money, facilities, coach)

   Everything about a school that grows or shrinks between seasons.

   NIL GRADE works like home court. Every grade has a win rate it must
   beat to hold (C needs about .500, A about .750). Beat it and the grade
   climbs by part of the margin; fall short and the boosters pull back.
   On top of that, milestones (conference titles, tournament wins, Final
   Fours, a title) give one-time bumps. The collective — the NIL money
   each year — is recalculated from the grade every offseason.

   MONEY LIVES IN ONE BANK BALANCE. Each recruiting cycle you have this
   year's collective plus whatever is in the bank. At the offseason,
   whatever wasn't spent on players or facilities stays in the bank (up to
   a cap). If you spent more than you had (usually because the grade
   dropped while your players' deals stayed the same), the balance goes
   negative: that's DEBT, and it grows by the interest rate each offseason
   until it's paid back out of future collectives. While your free money
   is negative you can't offer anyone or upgrade.

   FACILITIES are bought with NIL money a point at a time; every point
   costs more than the last, and they decay each offseason, faster the
   higher they are.

   COACHES earn rating points from the season (wins, titles, deep runs).
   You spend yours on the Program tab; AI coaches spend theirs
   automatically. Retirements, firings and hiring are the coaching
   carousel (coaches.js).
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const League = req ? require("./league.js") : root.League;
  const recruiting = () => req ? require("./recruiting.js") : root.Recruiting;

  const CFG = {
    nil: {
      /* overall win % needed to hold each grade, as an offset from .500 */
      offset: { "A+": 30, "A": 25, "A-": 21, "B+": 17, "B": 12, "B-": 8, "C+": 4, "C": 0, "C-": -3, "D+": -6, "D": -10, "D-": -14, "F": -20 },
      rate: 0.15,             // grade points per win-% point above/below the bar
      maxDrift: 6,            // cap on the record part of a single season's move
      milestones: { confTitle: 2, confTourney: 1, bid: 1, ncaaWin: 1, finalFour: 2, champion: 4 },
      /* boosters follow the program's standing: the grade drifts back toward
         what its prestige supports, so one great run lifts it but doesn't
         lock it at the top forever */
      anchorPull: 0.15,
      anchorOf: (prestige) => prestige * 0.85,
      floor: 5, ceiling: 99,
    },
    bank: {
      cap: 25000000,          // most money that can carry over
      debtInterest: 0.10,     // a negative balance grows this much each offseason
    },
    facilities: {
      costBase: 100000, costGrowth: 1.045,   // a point costs costBase × growth^(level − 50)
      decayBase: 1, decayAbove: 60, decayPer: 25,   // decay = base + (level − above) / per, rounded
      floor: 15, ceiling: 99,
      /* AI schools aim for a level: their prestige + a lean of their own (some schools are
         builders, some save), within [aiMin, aiMax]. Below it they put up to `aiBuild` of their
         free money into facilities; at or above it, up to `aiKeep` to cover the year's wear.
         Free money is never more than one year's collective, so it comes down to winning
         (prestige, NIL grade) and how much the school has left after players and staff. */
      aiLean: 8, aiMin: 30, aiMax: 95, aiBuild: 0.30, aiKeep: 0.15,
    },
    coach: {
      base: 2, perWinsAbove: 3,             // +1 per 3 wins over .500
      milestones: { confTitle: 2, confTourney: 1, bid: 2, ncaaWin: 1, finalFour: 2, champion: 4 },
      cap: 99,
      aiPointShare: 0.3,                    // AI head coaches get this share of the points (head-coach overall climbed ~17 over 50 seasons at 1.0, ~11 at 0.5)
      keys: ["rating", "recruiting", "development", "scouting"],
      labels: { rating: "Tactics", recruiting: "Recruiting", development: "Development", scouting: "Scouting" },
      // AI turnover
      // creation
      pool: 240, min: 30, max: 90,
      presets: {
        Balanced:   { rating: 60, recruiting: 60, development: 60, scouting: 60 },
        Recruiter:  { rating: 50, recruiting: 85, development: 55, scouting: 50 },
        Developer:  { rating: 52, recruiting: 55, development: 85, scouting: 48 },
        Tactician:  { rating: 85, recruiting: 52, development: 55, scouting: 48 },
        Talent_eye: { rating: 55, recruiting: 60, development: 50, scouting: 75 },
      },
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------------- what happened this season ---------------- */
  function summary(lg, season, team) {
    const P = season.post || {};
    const games = team.record.w + team.record.l;
    const out = {
      w: team.record.w, l: team.record.l, winPct: games ? team.record.w / games : 0.5,
      confTitle: false, confTourney: false, bid: false, ncaaWins: 0, finalFour: false, champion: false,
    };
    // regular-season conference title: best conference record
    const conf = lg.conferences.find(c => c.id === team.conf);
    if (conf) {
      const pct = (t) => (t.record.confW + t.record.confL) ? t.record.confW / (t.record.confW + t.record.confL) : 0;
      const best = Math.max(...conf.teamIds.map(id => pct(lg.byId[id])));
      out.confTitle = games > 0 && pct(team) === best && best > 0;
    }
    out.confTourney = !!(P.autobids && Object.values(P.autobids).includes(team.id));
    out.bid = !!(P.field && P.field.some(f => f.id === team.id));
    if (P.national) {
      for (const g of season.games) {
        if (g.type !== "nt" || !g.played) continue;
        const won = (g.home === team.id && g.homeScore > g.awayScore) || (g.away === team.id && g.awayScore > g.homeScore);
        if (won) out.ncaaWins++;
      }
      const total = P.national.rounds.length;
      if (total >= 2) {
        const semis = P.national.rounds[total - 2] || [];
        out.finalFour = semis.some(id => { const g = season.games[id]; return g && (g.home === team.id || g.away === team.id); });
      }
      out.champion = P.national.champion === team.id;
    }
    return out;
  }

  function milestonePoints(s, M) {
    const bits = [];
    if (s.confTitle) bits.push(["conference title", M.confTitle]);
    if (s.confTourney) bits.push(["conference tournament", M.confTourney]);
    if (s.bid) bits.push(["tournament bid", M.bid]);
    if (s.ncaaWins) bits.push([`${s.ncaaWins} tournament win${s.ncaaWins > 1 ? "s" : ""}`, M.ncaaWin * s.ncaaWins]);
    if (s.finalFour) bits.push(["Final Four", M.finalFour]);
    if (s.champion) bits.push(["national title", M.champion]);
    return bits;
  }

  /* ---------------- NIL grade ---------------- */
  function nilBar(team) { return 50 + (CFG.nil.offset[League.grade(team.nil)] ?? 0); }
  function updateNil(team, s) {
    const N = CFG.nil;
    const bar = nilBar(team), pct = 100 * s.winPct;
    const record = clamp((pct - bar) * N.rate, -N.maxDrift, N.maxDrift);
    const miles = milestonePoints(s, N.milestones);
    const bonus = miles.reduce((a, [, v]) => a + v, 0);
    const pull = N.anchorPull * (N.anchorOf(team.prestige) - team.nil);
    const before = team.nil;
    team.nil = clamp(Math.round(team.nil + record + bonus + pull), N.floor, N.ceiling);
    return { before, after: team.nil, bar: Math.round(bar), record: +record.toFixed(1), pull: +pull.toFixed(1), milestones: miles };
  }

  /* ---------------- facilities ---------------- */
  const facilityCost = (level) => Math.round(CFG.facilities.costBase * Math.pow(CFG.facilities.costGrowth, level - 50) / 1000) * 1000;
  function upgradeCost(team, n = 1) { let c = 0; for (let i = 0; i < n; i++) c += facilityCost(team.facilities + i); return c; }
  function buyFacilities(lg, team, n = 1) {
    const F = CFG.facilities, R = recruiting();
    if (team.facilities >= F.ceiling) return { ok: false, why: "Facilities are maxed out." };
    n = Math.min(n, F.ceiling - team.facilities);
    const cost = upgradeCost(team, n);
    const free = R.money(lg, team).free;
    if (free < 0) return { ok: false, why: "You're over budget. Nothing can be bought until you're back in the black." };
    if (cost > free) return { ok: false, why: `That costs ${R.fmt(cost)}; you have ${R.fmt(free)} free.` };
    if (lg.offseason && lg.offseason.settled) team.bank = Math.round((team.bank || 0) - cost);   // offseason: straight from the bank
    else team.facSpent = (team.facSpent || 0) + cost;
    team.facilities += n;
    return { ok: true, cost, level: team.facilities };
  }
  /* a year's wear at this level */
  const facilityWear = (team) => Math.round(CFG.facilities.decayBase + Math.max(0, team.facilities - CFG.facilities.decayAbove) / CFG.facilities.decayPer);
  /* the level an AI school aims for: prestige ± its own lean (fixed per school, from its id) */
  function aiFacilityTarget(team) {
    const F = CFG.facilities, id = String(team.id);
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const lean = ((h % 1000) / 999 * 2 - 1) * F.aiLean;
    return Math.round(clamp(team.prestige + lean, F.aiMin, F.aiMax));
  }
  function decayFacilities(team) {
    const F = CFG.facilities;
    const d = facilityWear(team);
    const before = team.facilities;
    team.facilities = clamp(team.facilities - d, F.floor, F.ceiling);
    return before - team.facilities;
  }

  /* ---------------- coach ---------------- */
  function coachPoints(s) {
    const C = CFG.coach;
    const winsAbove = Math.max(0, s.w - s.l);
    const bits = [["season", C.base]];
    if (winsAbove >= C.perWinsAbove) bits.push([`${s.w}-${s.l} record`, Math.floor(winsAbove / C.perWinsAbove)]);
    bits.push(...milestonePoints(s, C.milestones));
    return { total: bits.reduce((a, [, v]) => a + v, 0), bits };
  }
  function spendCoach(team, key, n = 1) {
    const C = CFG.coach, c = team.coach;
    if (!C.keys.includes(key)) return { ok: false, why: "Unknown rating." };
    const have = c.points || 0;
    n = Math.min(n, have, C.cap - (c[key] || 0));
    if (n <= 0) return { ok: false, why: have <= 0 ? "No coach points to spend." : "That rating is maxed." };
    c[key] = (c[key] || 0) + n; c.points = have - n;
    return { ok: true, spent: n };
  }
  /* auto: lean into what he's already good at, a point at a time */
  function autoSpendCoach(team, rand) {
    const C = CFG.coach, c = team.coach;
    let guard = 0;
    while ((c.points || 0) >= 1 && guard++ < 200) {
      const open = C.keys.filter(k => c[k] < C.cap);
      if (!open.length) break;
      const w = open.map(k => Math.pow(c[k], 2));
      let r = (rand ? rand() : Math.random()) * w.reduce((a, b) => a + b, 0), pick = open[0];
      for (let i = 0; i < open.length; i++) { if ((r -= w[i]) <= 0) { pick = open[i]; break; } }
      c[pick]++; c.points--;
    }
  }
  /* setup screen: a coach built from a point pool */
  function applyCreation(team, dist) {
    const C = CFG.coach;
    for (const k of C.keys) team.coach[k] = clamp(Math.round(dist[k] ?? 60), C.min, C.max);
  }

  /* ---------------- bank balance ---------------- */
  /* Close the cycle that just ended. Free money left over goes into the
     bank (capped); a shortfall makes the balance negative, plus interest.
     Positive = carried into next cycle, negative = debt. */
  function settle(lg, team) {
    const B = CFG.bank, R = recruiting();
    const m = R.money(lg, team);
    const before = team.bank || 0;
    let bank, interest = 0, lost = 0;
    if (m.free >= 0) { bank = Math.min(m.free, B.cap); lost = m.free - bank; }
    else { interest = Math.round(-m.free * B.debtInterest); bank = m.free - interest; }
    team.bank = Math.round(bank);
    return { before, free: m.free, bank: team.bank, carried: Math.max(0, team.bank), debt: Math.max(0, -team.bank),
      interest, lost, paidOff: before < 0 && team.bank >= 0 };
  }
  function setBank(team, v) { team.bank = Math.round(clamp(v, -1e9, CFG.bank.cap)); }

  /* ---------------- the offseason step ----------------
     Call after the season's results are final and BEFORE the next
     recruiting cycle opens (that recomputes the collective from the grade). */
  function endOfSeason(lg, season, rand) {
    const out = { teams: {}, coachChanges: [] };
    for (const t of lg.teams) {
      const s = summary(lg, season, t);
      const r = { summary: s };
      // money first, while this cycle's books are still open
      if (!t.isUser && lg.recruiting) {
        const free = recruiting().money(lg, t).free;
        if (free > 0) {
          const F = CFG.facilities, target = aiFacilityTarget(t);
          const below = t.facilities < target;
          const budget = Math.min(free, t.collective || free) * (below ? F.aiBuild : F.aiKeep);
          const want = below ? target - t.facilities + facilityWear(t) : facilityWear(t);   // close the gap (and stay there), or just cover the wear
          let n = 0; while (n < want && upgradeCost(t, n + 1) <= budget && t.facilities + n < F.ceiling) n++;
          if (n) { const b = buyFacilities(lg, t, n); if (b.ok) r.aiFacilities = n; }
        }
      }
      if (lg.recruiting) r.money = settle(lg, t);
      t.facSpent = 0;
      r.nil = updateNil(t, s);
      r.facilityDecay = decayFacilities(t);
      const cp = coachPoints(s);
      t.coach.points = (t.coach.points || 0) + cp.total * (t.isUser ? 1 : CFG.coach.aiPointShare);   // AI coaches bank half (they'd inflate otherwise)
      r.coachPoints = cp;
      if (!t.isUser) autoSpendCoach(t, rand);   // retirements and firings happen in the coaching carousel (coaches.js)
      out.teams[t.id] = r;
    }
    return out;
  }

  /* older saves */
  function ensure(lg) {
    const Coaches = req ? require("./coaches.js") : root.Coaches;
    if (Coaches) Coaches.ensure(lg);
    for (const t of lg.teams) {
      League.assignNumbers(t);   // older saves: jersey numbers
      if (t.bank == null) t.bank = -(t.debt || 0);   // old saves kept debt separately
      delete t.debt;
      if (t.facSpent == null) t.facSpent = 0;
      if (t.coach.points == null) t.coach.points = 0;
      if (t.coach.depth == null) t.coach.depth = League.depthFor(t.coach.name);   // saves from before rotation depth
      for (const p of t.players) { delete p.contractYears; delete p.salaryNext; if (p.redshirtUsed == null) p.redshirtUsed = false; }
    }
  }

  const Program = { CFG, summary, nilBar, updateNil, facilityCost, upgradeCost, buyFacilities, decayFacilities, facilityWear, aiFacilityTarget,
    coachPoints, spendCoach, autoSpendCoach, applyCreation, settle, setBank, endOfSeason, ensure };
  if (typeof module !== "undefined") module.exports = Program;
  else root.Program = Program;
})(typeof window !== "undefined" ? window : globalThis);
