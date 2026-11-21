/* =====================================================================
   HOOPS DYNASTY — COACHES: STAFFS, THE COACH POOL, THE HOT SEAT, THE CAROUSEL

   STAFF. Every school has a head coach and two assistants. Each of the
   four coaching ratings (tactics, recruiting, development, scouting) the
   game uses is the STAFF rating:
       50% head coach + 25% each assistant          (CFG.split)
   An empty assistant chair is filled by a grad assistant (rating 30,
   almost free) until somebody is hired.

   ONE POOL. Every coach in the league is in one of three places: a head
   job, an assistant job, or the pool of available coaches. Coaches age:
   young ones improve a little every year, older ones slowly decline, and
   they retire in their 60s. Young coaches join the pool every year.
   Your own head coach doesn't age; he improves with the points you spend.

   PAY. Every coach has an asking salary from his ratings (a head job asks
   twice as much). It's paid out of the school's NIL bank, like player
   deals: the whole staff's pay comes off the top of every cycle's money.
   Contracts are 1–4 years at a locked salary. Your own head coach's pay
   is set by the school (his ask) whenever he signs. Fire an assistant
   during the season and that season's pay is already spent.

   THE HOT SEAT. Every head coach has job security (0–100). After each
   season it moves with his record and postseason against what the
   school's prestige expects (the same bars as prestige). At 0 he's fired,
   but never in his first two seasons. You can switch off getting fired
   at setup (lg.options.canBeFired).

   THE CAROUSEL (right after the season, before the draft):
     1. retirements, firings and expired contracts
     2. if you were fired: pick your next head job from the ones that want you
     3. open head jobs fill best school first: the best coach the school can
        afford, from the pool or another school's assistants (a promotion —
        the only way an assistant leaves before his contract is up)
     4. then AI schools fill open assistant chairs. Yours stay open for you
        (the Staff tab, any time).
   AI coaches never leave a job on their own.

   Every number lives in CFG.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const League = req ? require("./league.js") : root.League;
  const recruitingModule = () => req ? require("./recruiting.js") : root.Recruiting;
  const offseasonModule = () => req ? require("./offseason.js") : root.Offseason;

  const CFG = {
    keys: ["rating", "recruiting", "development", "scouting"],
    labels: { rating: "Tactics", recruiting: "Recruiting", development: "Development", scouting: "Scouting" },
    split: [0.5, 0.25, 0.25],         // head, assistant 1, assistant 2
    slots: 2,
    grad: { rating: 30, salary: 10000, name: "Grad assistant" },
    /* asking salary for an assistant job by overall (the average of the four ratings); a head job asks × head */
    salary: [[25, 10000], [40, 30000], [50, 55000], [60, 90000], [70, 150000], [80, 250000], [90, 420000], [99, 600000]],
    head: 2,
    contract: { head: [3, 5], asst: [1, 3], userHead: 4, max: 4,
      buyout: 0.5 },                  // letting someone go: this share of the pay for the seasons he has left (plus, in season, this season's pay is already spent)
    /* what an AI school will pay: a share of its collective */
    budget: { head: 0.12, asst: 0.04, minHead: 80000, minAsst: 25000 },
    aging: {
      /* average change per rating per year, by age (then ± noise) */
      byAge: [[32, 2.0], [39, 1.2], [47, 0.5], [55, 0], [61, -0.6], [99, -1.2]],
      noise: 1.2, floor: 25, cap: 99,
    },
    retire: { from: 62, chance: 0.10, perYear: 0.05, hard: 72, idleYears: 4 },
    pool: { perTeam: 1.0, young: [26, 34], youngQuality: [32, 62] },
    security: {
      start: 60, grace: 2,            // can't be fired in his first two seasons
      winRate: 0.9,                   // per win-% point above/below what's expected
      expectWinOffset: -5,            // expected win % = the prestige bar − 5 (an A+ school expects about .750)
      postRate: 8,                    // per point of postseason score above/below what's expected (Offseason.CFG.prestige.expect)
      maxMove: 35, warn: 40, hot: 20,
    },
    aiRenew: { headSecurity: 40, asstChance: 0.7, asstMinOvr: 40 },
    userOffers: { min: 3, below: 8 },   // fired: always at least `min` jobs that will take you (lowest prestige first)
    /* REPUTATION (0–100): what athletic directors hire on, from a head coach's last 4
       seasons, newest counting most (weights below). A season scores
         win % × 60 + postseason × 8 (tournament 1, semifinal 2, runner-up 3, title 5) + 10 for Coach of the Year
       Missing seasons (a new coach) count as `neutral`. A school wants at least
         prestige − needBelow   (a 90 school wants 65, a 60 school 35)
       and anyone at `anySchool` or higher is welcome everywhere. */
    reputation: { weights: [4, 3, 2, 1], winPct: 60, post: 8, coy: 10, neutral: 30, needBelow: 25, needMin: 10, anySchool: 80, hireWeight: 0.4 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
  function hash(...xs) { let h = 2166136261; for (const x of xs) { h ^= (x >>> 0) || 0; h = Math.imul(h, 16777619); } return h >>> 0; }
  function curve(anchors, x) {
    if (x <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [x1, y1] = anchors[i], [x0, y0] = anchors[i - 1];
      if (x <= x1) return Math.exp(Math.log(y0) + (Math.log(y1) - Math.log(y0)) * (x - x0) / (x1 - x0));
    }
    return anchors[anchors.length - 1][1];
  }
  /* an empty head job while the carousel runs: a stand-in with modest ratings (nothing reads a missing coach) */
  const vacant = () => ({ name: "Vacant", vacant: true, rating: 40, recruiting: 40, development: 40, scouting: 40, offense: "balanced", defense: "man", lateGame: "auto", depth: 9,
    years: 0, careerW: 0, careerL: 0, points: 0, salary: 0, hist: [] });
  const round5k0 = (v) => Math.round(v / 5000) * 5000;
  const round5k = (v) => Math.max(5000, Math.round(v / 5000) * 5000);

  /* ---------------- a coach ---------------- */
  const ovr = (c) => c ? Math.round(CFG.keys.reduce((s, k) => s + (c[k] || 0), 0) / CFG.keys.length) : CFG.grad.rating;
  const ask = (c, role = "asst") => round5k(curve(CFG.salary, ovr(c)) * (role === "head" ? CFG.head : 1));
  /* headYears: chance he's been a head coach before (the pool has some ex-head coaches; assistants mostly haven't) */
  function make(lg, rand, quality, age, headChance = 0) {
    const c = League.makeCoach(rand, quality);
    c.id = `C${++lg.coachSeq}`;
    c.age = age;
    c.years = age > 38 && rand() < headChance ? ri(rand, 1, Math.min(12, age - 36)) : 0;   // head-coaching seasons
    c.careerW = 0; c.careerL = 0; c.points = 0;
    c.role = null; c.teamId = null; c.salary = 0; c.contract = 0; c.tenure = 0; c.idle = 0;
    c.hist = [];        // jobs: { team, role, from, to, w, l }
    return c;
  }
  /* turn an existing head coach (league file, old save) into a full coach record */
  function fill(lg, rand, c, team, role) {
    if (!c.id) c.id = `C${++lg.coachSeq}`;
    if (c.age == null) c.age = clamp(36 + (c.years || 0) + ri(rand, 0, 10), 30, 66);
    if (c.points == null) c.points = 0;
    if (!c.hist) c.hist = [];
    c.role = role; c.teamId = team ? team.id : null;
    if (c.salary == null || !c.salary) c.salary = team ? ask(c, role) : 0;
    if (!c.contract) c.contract = role === "head" ? ri(rand, 1, 4) : ri(rand, 1, 3);
    if (c.tenure == null) c.tenure = role === "head" ? Math.min(c.years || 0, 6) : ri(rand, 0, 3);
    if (role === "head" && c.security == null) c.security = clamp(CFG.security.start + ri(rand, -15, 20), 25, 95);
    c.idle = 0;
    return c;
  }

  /* ---------------- set up a league's staffs and pool (new league or old save) ---------------- */
  function ensure(lg) {
    if (lg.coachPool) { for (const t of lg.teams) if (!t.staff) t.staff = [null, null]; return; }
    const rand = Engine.makeRng(hash(lg.seed, 0xc0ac4));
    lg.coachSeq = lg.coachSeq || 0;
    for (const t of lg.teams) {
      fill(lg, rand, t.coach, t, "head");
      if (t.isUser) { t.coach.salary = ask(t.coach, "head"); t.coach.contract = CFG.contract.userHead; t.coach.security = CFG.security.start; t.coach.tenure = 0; }
      t.staff = [];
      for (let i = 0; i < CFG.slots; i++) {
        const a = make(lg, rand, clamp(t.prestige * 0.8 + 6, 30, 85), ri(rand, 28, 56), 0.1);
        place(a, t, "asst", ri(rand, 1, 3));
        t.staff.push(a);
      }
    }
    lg.coachPool = [];
    const n = Math.round(lg.teams.length * CFG.pool.perTeam);
    for (let i = 0; i < n; i++) lg.coachPool.push(make(lg, rand, ri(rand, 30, 72), ri(rand, 28, 64), 0.35));
  }
  function place(c, team, role, years, salary) {
    c.role = role; c.teamId = team.id; c.contract = years; c.salary = salary != null ? salary : ask(c, role);
    c.tenure = 0; c.idle = 0; delete c.ext;
    c.hist = c.hist || [];
    c.hist.push({ team: team.abbr, teamId: team.id, role, from: null, to: null, w: 0, l: 0 });
    if (role === "head") { c.security = CFG.security.start; }
  }
  function toPool(lg, c, why) {
    c.role = null; c.teamId = null; c.salary = 0; c.contract = 0; c.tenure = 0; c.idle = 0;
    delete c.security; delete c.ext; c.left = why || null;
    lg.coachPool.push(c);
  }

  /* ---------------- the staff ratings the game uses ---------------- */
  /* rating(team, "recruiting") etc. Works on any team, even before ensure() (empty chairs = grad assistants). */
  function rating(team, key) {
    const S = CFG.split, h = team.coach ? (team.coach[key] ?? 50) : CFG.grad.rating;
    let v = S[0] * h;
    for (let i = 0; i < CFG.slots; i++) { const a = team.staff && team.staff[i]; v += S[i + 1] * (a ? (a[key] ?? 50) : CFG.grad.rating); }
    return Math.round(v);
  }
  /* what the whole staff costs a season */
  function staffPay(team) {
    let s = team.coach && team.coach.salary || 0;
    for (let i = 0; i < CFG.slots; i++) { const a = team.staff && team.staff[i]; s += a ? a.salary || 0 : CFG.grad.salary; }
    return s + (team.staffDead || 0);
  }
  function budget(team, role) {
    const col = team.collective || 2000000, B = CFG.budget;
    return role === "head" ? Math.max(B.minHead, col * B.head) : Math.max(B.minAsst, col * B.asst);
  }
  const findCoach = (lg, id) => {
    for (const t of lg.teams) { if (t.coach && t.coach.id === id) return { c: t.coach, team: t, slot: -1 }; const i = (t.staff || []).findIndex(a => a && a.id === id); if (i >= 0) return { c: t.staff[i], team: t, slot: i }; }
    const c = (lg.coachPool || []).find(x => x.id === id); return c ? { c, team: null, slot: null } : null;
  };

  /* ---------------- your staff: hire, fire, extend ---------------- */
  const inSeason = (lg) => !(lg.offseason && lg.offseason.settled);
  function hire(lg, team, coachId, slot, years) {
    ensure(lg);
    const c = lg.coachPool.find(x => x.id === coachId);
    if (!c) return { ok: false, why: "He's not available." };
    if (slot == null) slot = team.staff.findIndex(a => !a);
    if (slot < 0 || slot >= CFG.slots) return { ok: false, why: "Both assistant chairs are filled. Let someone go first." };
    if (team.staff[slot]) return { ok: false, why: "That chair is taken." };
    years = clamp(Math.round(years || 2), 1, CFG.contract.max);
    const pay = ask(c, "asst");
    const R = recruitingModule();
    if (R && lg.recruiting) {
      const free = R.money(lg, team).free;
      const now = inSeason(lg) ? pay - CFG.grad.salary : 0;   // in season his pay comes out of this cycle right away
      if (now > free) return { ok: false, why: `He asks ${R.fmt(pay)} a season; you have ${R.fmt(Math.max(0, free))} free.` };
    }
    lg.coachPool.splice(lg.coachPool.indexOf(c), 1);
    place(c, team, "asst", years, pay);
    c.hist[c.hist.length - 1].from = lg.season;
    team.staff[slot] = c;
    return { ok: true, coach: c, pay, years };
  }
  /* what letting him go costs on top of this season: buyout share × the seasons left after it (an extension he's signed counts too) */
  function buyout(lg, c) {
    const after = inSeason(lg) ? Math.max(0, c.contract - 1) : Math.max(0, c.contract);   // in the offseason his seasons left all lie ahead
    const owed = after * (c.salary || 0) + (c.ext ? c.ext.years * c.ext.salary : 0);
    return round5k0(CFG.contract.buyout * owed);
  }
  function fire(lg, team, slot) {
    const c = team.staff[slot];
    if (!c) return { ok: false, why: "That chair is empty." };
    const cost = buyout(lg, c);
    if (inSeason(lg)) team.staffDead = (team.staffDead || 0) + (c.salary || 0) - CFG.grad.salary + cost;   // this season's pay is spent (a grad assistant fills in) + the buyout
    else team.bank = Math.round((team.bank || 0) - cost);                                                   // offseason: the buyout straight from the bank
    delete c.ext;
    closeJob(lg, c);
    team.staff[slot] = null;
    toPool(lg, c, "let go");
    return { ok: true, coach: c, buyout: cost };
  }
  /* Contracts are locked. In his FINAL season (one left) you can extend him: 1–4 more
     seasons at his ask TODAY (re-priced from his current ratings), starting when the
     current deal ends. This season's pay doesn't change. */
  const canExtend = (c) => !!c && c.contract <= 1 && !c.ext;
  function extend(lg, team, slot, years) {
    const c = team.staff[slot];
    if (!c) return { ok: false, why: "That chair is empty." };
    if (c.ext) return { ok: false, why: `He's already extended: ${c.ext.years} more season${c.ext.years === 1 ? "" : "s"}.` };
    if (c.contract > 1) return { ok: false, why: `His contract runs ${c.contract} more seasons. You can extend him in his final season.` };
    years = clamp(Math.round(years || 2), 1, CFG.contract.max);
    const pay = ask(c, "asst");
    c.ext = { years, salary: pay };
    return { ok: true, pay, years };
  }
  function closeJob(lg, c) { const h = c.hist && c.hist[c.hist.length - 1]; if (h && h.to == null) h.to = lg.season; }

  /* ---------------- after the season: the hot seat, aging, departures ---------------- */
  function securityMove(lg, season, team) {
    const S = CFG.security, O = offseasonModule();
    const games = team.record.w + team.record.l, pct = games ? 100 * team.record.w / games : 50;
    const expectWin = O.prestigeBar(team) + S.expectWinOffset;
    const res = O.postseasonResult(lg, season, team.id);
    const expectPost = (O.CFG.prestige.expect.find(([min]) => team.prestige >= min) || [0, 0])[1];
    const move = clamp((pct - expectWin) * S.winRate + (res.score - expectPost) * S.postRate, -S.maxMove, S.maxMove);
    return { move: Math.round(move), expectWin: Math.round(expectWin), pct: Math.round(pct), post: res.label, expectPost };
  }
  function age(rand, c) {
    c.age++;
    const A = CFG.aging;
    const mean = (A.byAge.find(([to]) => c.age <= to) || [0, 0])[1];
    for (const k of CFG.keys) c[k] = clamp(Math.round(c[k] + mean + (rand() * 2 - 1) * A.noise), A.floor, A.cap);
  }
  const retires = (rand, c) => c.age >= CFG.retire.hard || (c.age >= CFG.retire.from && rand() < CFG.retire.chance + CFG.retire.perYear * (c.age - CFG.retire.from));
  const canFireUser = (lg) => !(lg.options && lg.options.canBeFired === false);

  /* Step 1 of the carousel. Returns the carousel record (also kept in lg.offseason.carousel). */
  function seasonEnd(lg, season, rand) {
    ensure(lg);
    const out = { year: lg.season, departures: [], renewed: [], review: null, userFired: false, openHead: [], openAsst: [], hires: [], offers: [], onMarket: [] };
    const gone = (c, team, role, why) => out.departures.push({ id: c.id, name: c.name, age: c.age, ovr: ovr(c), teamId: team ? team.id : null, role, why, w: c.careerW, l: c.careerL,
      ...(why === "retired" && (c.years || 0) > 0 ? { years: c.years, awards: c.awards || [], hist: c.hist || [] } : {}) });   // a retiring head coach's career, for the Hall of Fame
    for (const t of lg.teams) {
      const h = t.coach;
      // this season on each job record
      for (const c of [h, ...t.staff]) if (c) { const j = c.hist[c.hist.length - 1]; if (j) { j.w += t.record.w; j.l += t.record.l; if (j.from == null) j.from = lg.season; } c.tenure++; c.contract--;
        if (c.contract <= 0 && c.ext) { c.contract = c.ext.years; c.salary = c.ext.salary; delete c.ext; }   // his extension kicks in
      }
      // the hot seat
      const sm = securityMove(lg, season, t);
      const before = h.security ?? CFG.security.start;
      h.security = clamp(before + sm.move, h.tenure < CFG.security.grace ? 10 : 0, 100);
      // reputation: this season goes on his record
      const O = offseasonModule(), games = t.record.w + t.record.l;
      h.repLog = [...(h.repLog || []), { y: lg.season, pct: games ? +(t.record.w / games).toFixed(3) : 0.5, post: O.postseasonResult(lg, season, t.id).score,
        coy: (h.awards || []).some(a => a.y === lg.season && a.k === "COY") }].slice(-CFG.reputation.weights.length);
      if (t.isUser) out.review = { ...sm, before, after: h.security, tenure: h.tenure, canBeFired: canFireUser(lg), rep: reputation(h) };
      // aging (your own head coach doesn't age: he grows with the points you spend)
      if (!t.isUser) age(rand, h);
      for (const a of t.staff) if (a) age(rand, a);
    }
    for (const c of lg.coachPool) { age(rand, c); c.idle++; }

    for (const t of lg.teams) {
      const h = t.coach;
      // head coach
      if (t.isUser) {
        if (h.security <= 0 && h.tenure >= CFG.security.grace && canFireUser(lg)) {
          out.userFired = true; gone(h, t, "head", "fired"); closeJob(lg, h);
          out.userCoach = h; t.coach = vacant(); out.openHead.push(t.id); out.formerTeam = t.id;
        } else if (h.contract <= 0) {
          h.salary = Math.min(ask(h, "head"), budget(t, "head")); h.contract = CFG.contract.userHead;   // the school pays what it can
          out.renewed.push({ id: h.id, teamId: t.id, role: "head", salary: h.salary, years: h.contract });
        }
      } else {
        let why = null;
        if (retires(rand, h)) why = "retired";
        else if (h.security <= 0 && h.tenure >= CFG.security.grace) why = "fired";
        else if (h.contract <= 0) {
          if (h.security < CFG.aiRenew.headSecurity) why = "contract not renewed";
          else if (ask(h, "head") > budget(t, "head")) { h.market = true; out.onMarket.push(t.id); }   // he's outgrown what this school can pay: he tests the market (runHiring)
          else { h.contract = ri(rand, ...CFG.contract.head); h.salary = ask(h, "head"); }
        }
        if (why) {
          gone(h, t, "head", why); closeJob(lg, h); t.coach = vacant(); out.openHead.push(t.id);
          if (why !== "retired") toPool(lg, h, why);
        }
      }
      // assistants
      for (let i = 0; i < CFG.slots; i++) {
        const a = t.staff[i]; if (!a) { if (!t.isUser) out.openAsst.push([t.id, i]); continue; }
        let why = null;
        if (retires(rand, a)) why = "retired";
        else if (a.contract <= 0) {
          if (!t.isUser && ovr(a) >= CFG.aiRenew.asstMinOvr && rand() < CFG.aiRenew.asstChance) { a.contract = ri(rand, ...CFG.contract.asst); a.salary = ask(a, "asst"); }
          else why = "contract up";
        }
        if (why) {
          gone(a, t, "asst", why); closeJob(lg, a); t.staff[i] = null;
          if (!t.isUser) out.openAsst.push([t.id, i]);
          if (why !== "retired") toPool(lg, a, why);
        }
      }
      t.staffDead = 0;
    }
    // the pool: long-idle and old coaches retire; young coaches come in
    lg.coachPool = lg.coachPool.filter(c => {
      if (c.idle > CFG.retire.idleYears || retires(rand, c)) { if (c.idle <= 1) gone(c, null, null, "retired"); return false; }
      return true;
    });
    topUp(lg, rand);
    if (out.userFired) out.offers = userOffers(lg, out);
    out.jobs = openJobs(lg, out);
    return out;
  }
  /* a coach's reputation, 0–100 (CFG.reputation) */
  function reputation(c) {
    const R = CFG.reputation, log = (c && c.repLog) || [];
    let sum = 0, wsum = 0;
    R.weights.forEach((w, i) => {
      const s = log[log.length - 1 - i];
      const v = s ? s.pct * R.winPct + s.post * R.post + (s.coy ? R.coy : 0) : R.neutral;
      sum += w * v; wsum += w;
    });
    return Math.round(clamp(sum / wsum, 0, 100));
  }
  /* the reputation a school wants in its next head coach */
  const repNeeded = (team) => clamp(Math.round(team.prestige - CFG.reputation.needBelow), CFG.reputation.needMin, CFG.reputation.anySchool);
  /* every open head job this offseason, and whether it would hire you */
  function openJobs(lg, car) {
    const ut = lg.teams.find(t => t.isUser), u = car.userFired ? car.userCoach : ut && ut.coach;
    const rep = u ? reputation(u) : 0, mine = car.formerTeam || (ut && ut.id);
    return car.openHead.filter(id => id !== mine).map(id => {
      const t = lg.byId[id], need = repNeeded(t), d = car.departures.find(x => x.teamId === id && x.role === "head");
      return { teamId: id, need, interested: rep >= need || (car.offers || []).includes(id), why: d ? d.why : "open" };
    }).sort((a, b) => lg.byId[b.teamId].prestige - lg.byId[a.teamId].prestige);
  }
  function topUp(lg, rand) {
    const P = CFG.pool, want = Math.round(lg.teams.length * P.perTeam);
    while (lg.coachPool.length < want) lg.coachPool.push(make(lg, rand, ri(rand, ...P.youngQuality), ri(rand, ...P.young)));
  }

  /* fired: the open head jobs that would take you (lower-prestige schools first), at least a few */
  function userOffers(lg, car) {
    const former = lg.byId[car.formerTeam], cap = former ? former.prestige - CFG.userOffers.below : 60;
    const open = car.openHead.filter(id => id !== car.formerTeam).map(id => lg.byId[id]).sort((a, b) => b.prestige - a.prestige);
    let offers = open.filter(t => t.prestige <= cap);
    if (offers.length < CFG.userOffers.min) {
      const more = open.filter(t => !offers.includes(t)).sort((a, b) => a.prestige - b.prestige);
      offers = [...offers, ...more].slice(0, CFG.userOffers.min);
    }
    // still short: athletic directors with a coach on the hot seat call you (that coach is let go)
    if (offers.length < CFG.userOffers.min) {
      const hot = lg.teams.filter(t => !t.isUser && !t.coach.vacant && t.id !== car.formerTeam && !car.openHead.includes(t.id) && t.prestige <= Math.max(cap, 45))
        .sort((a, b) => (a.coach.security - b.coach.security) || (a.prestige - b.prestige));
      for (const t of hot.slice(0, CFG.userOffers.min - offers.length)) {
        const h = t.coach;
        car.departures.push({ id: h.id, name: h.name, age: h.age, ovr: ovr(h), teamId: t.id, role: "head", why: "fired", w: h.careerW, l: h.careerL });
        closeJob(lg, h); t.coach = vacant(); car.openHead.push(t.id); toPool(lg, h, "fired");
        offers.push(t);
      }
    }
    return offers.map(t => t.id);
  }
  /* you take the head job at teamId: fired, or moving on by choice (any open job that wants you) */
  function takeJob(lg, teamId) {
    const car = lg.offseason && lg.offseason.carousel;
    if (!car || car.newJob || car.hired) return { ok: false, why: "The carousel has moved on." };
    const job = (car.jobs || []).find(j => j.teamId === teamId);
    if (!job || !job.interested) return { ok: false, why: "That school isn't interested." };
    if (!car.userFired) {   // leaving by choice: your old job opens for the AI schools
      const mineT = lg.teams.find(x => x.isUser), mc = mineT.coach;
      car.departures.push({ id: mc.id, name: mc.name, age: mc.age, ovr: ovr(mc), teamId: mineT.id, role: "head", why: `left for ${lg.byId[teamId].name}`, w: mc.careerW, l: mc.careerL });
      closeJob(lg, mc); mineT.coach = vacant(); car.openHead.push(mineT.id);
      car.formerTeam = mineT.id; car.userCoach = mc; car.moved = true;
    }
    const old = lg.byId[car.formerTeam], t = lg.byId[teamId], c = car.userCoach;
    old.isUser = false;
    t.isUser = true;
    for (const k of ["rotationMode", "rotation", "rotationDepth", "rotationReset", "autoPoints", "portalAuto"]) delete t[k];
    t.coach = c;
    place(c, t, "head", CFG.contract.userHead, Math.min(ask(c, "head"), budget(t, "head")));   // the new school pays what it can
    c.hist[c.hist.length - 1].from = lg.season + 1;
    car.openHead = car.openHead.filter(id => id !== teamId);
    car.jobs = car.jobs.filter(j => j.teamId !== teamId);
    car.newJob = teamId;
    League.pickIsoTarget(t);
    return { ok: true, team: t };
  }

  /* Step 3–4 of the carousel: AI schools fill their open jobs. */
  function runHiring(lg, rand) {
    const car = lg.offseason.carousel;
    if (car.hired) return car;
    const userTeam = lg.teams.find(t => t.isUser);
    /* openings fill best school first. A coach testing the market (priced out at his school)
       is a candidate for any school that can pay more than his; if one hires him, his old
       school opens up and joins the queue. */
    const market = () => lg.teams.filter(o => !o.isUser && o.coach && o.coach.market);
    let guard = 0;
    while (guard++ < lg.teams.length * 2) {
      const t = lg.teams.filter(x => x.coach.vacant).sort((a, b) => b.prestige - a.prestige)[0];
      if (!t) break;
      const B = budget(t, "head");
      const cands = [];
      for (const c of lg.coachPool) cands.push({ c, from: null });
      for (const o of lg.teams) if (o !== t) o.staff.forEach((a, i) => { if (a) cands.push({ c: a, from: o, slot: i }); });
      for (const o of market()) if (o !== t && B > budget(o, "head")) cands.push({ c: o.coach, from: o, head: true });
      // schools hire on ratings, plus a proven head coach's reputation (CFG.reputation.hireWeight per point over neutral)
      const proven = (c) => c.repLog && c.repLog.length ? CFG.reputation.hireWeight * (reputation(c) - CFG.reputation.neutral) : 0;
      const score = (c) => ovr(c) + 0.2 * c.rating + Math.min(4, c.years || 0) - Math.max(0, c.age - 60) + proven(c);
      // a market coach takes any raise over what his school could pay; everyone else wants his asking price
      let pool = cands.filter(x => x.head || ask(x.c, "head") <= B);
      if (!pool.length) pool = cands.slice().sort((a, b) => ask(a.c, "head") - ask(b.c, "head")).slice(0, 5);
      const best = pool.sort((a, b) => score(b.c) - score(a.c))[0];
      const c = best.c;
      if (best.head) {   // a coach moving up: his old school opens
        closeJob(lg, c); delete c.market;
        car.departures.push({ id: c.id, name: c.name, age: c.age, ovr: ovr(c), teamId: best.from.id, role: "head", why: `left for ${t.name}`, w: c.careerW, l: c.careerL });
        best.from.coach = vacant(); car.openHead.push(best.from.id);
      } else if (best.from) {   // a promotion: his old chair opens
        closeJob(lg, c);
        best.from.staff[best.slot] = null;
        if (best.from.isUser) car.poached = [...(car.poached || []), { id: c.id, name: c.name, to: t.id }];
        else car.openAsst.push([best.from.id, best.slot]);
      } else lg.coachPool.splice(lg.coachPool.indexOf(c), 1);
      place(c, t, "head", ri(rand, ...CFG.contract.head), Math.min(ask(c, "head"), B));
      c.hist[c.hist.length - 1].from = lg.season + 1;
      if (!c.depth) c.depth = League.depthFor(c.name);
      t.coach = c;
      League.pickIsoTarget(t);
      car.hires.push({ teamId: t.id, id: c.id, name: c.name, role: "head", from: best.from ? best.from.id : null, moved: !!best.head, ovr: ovr(c), salary: c.salary });
    }
    // market coaches nobody hired: they re-sign at home for what the school can pay
    for (const o of market()) { const c = o.coach; delete c.market; c.contract = ri(rand, ...CFG.contract.head); c.salary = Math.min(ask(c, "head"), budget(o, "head")); }
    // assistants (AI schools only; yours stay open for you)
    const asst = car.openAsst.filter(([id]) => !lg.byId[id].isUser).sort((a, b) => lg.byId[b[0]].prestige - lg.byId[a[0]].prestige);
    for (const [id, slot] of asst) {
      const t = lg.byId[id]; if (t.staff[slot]) continue;
      const B = budget(t, "asst");
      const c = lg.coachPool.filter(x => ask(x, "asst") <= B).sort((a, b) => ovr(b) - ovr(a))[0];
      if (!c) continue;   // a grad assistant fills in
      lg.coachPool.splice(lg.coachPool.indexOf(c), 1);
      place(c, t, "asst", ri(rand, ...CFG.contract.asst));
      c.hist[c.hist.length - 1].from = lg.season + 1;
      t.staff[slot] = c;
      car.hires.push({ teamId: t.id, id: c.id, name: c.name, role: "asst", ovr: ovr(c), salary: c.salary });
    }
    topUp(lg, rand);
    car.hired = true;
    if (lg.offseason) lg.offseason.newCoach = Object.fromEntries(car.hires.filter(h => h.role === "head").map(h => [h.teamId, true]));
    return car;
  }

  /* the whole carousel at once (AI-only sims, tests): a fired user takes the best offer */
  function runCarousel(lg, season, rand) {
    const car = seasonEnd(lg, season, rand);
    lg.offseason.carousel = car;
    if (car.userFired && car.offers.length) takeJob(lg, car.offers[0]);
    runHiring(lg, rand);
    return car;
  }

  const securityWord = (s) => s == null ? "—" : s <= CFG.security.hot ? "Hot seat" : s <= CFG.security.warn ? "Warm" : s >= 80 ? "Untouchable" : "Safe";

  const Coaches = { CFG, ovr, ask, rating, staffPay, budget, ensure, hire, fire, extend, canExtend, buyout, findCoach, seasonEnd, runHiring, runCarousel, takeJob, userOffers, openJobs, reputation, repNeeded, securityMove, securityWord, canFireUser };
  if (typeof module !== "undefined") module.exports = Coaches;
  else root.Coaches = Coaches;
})(typeof window !== "undefined" ? window : globalThis);
