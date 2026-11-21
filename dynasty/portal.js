/* =====================================================================
   HOOPS DYNASTY — TRANSFER PORTAL (transfers in)

   Everyone who transferred out (yours and the AI's) lands here after the
   transfer window. It runs like a short recruiting season — the same fit,
   the same effective offer, the same odds — with these differences:

     • 3 rounds. AI schools make opening offers before round 1. At the end
       of rounds 1 and 2 players decide FIRST, then the AI moves (so any new
       AI offer sits a round before it can win anyone). After round 3 the
       portal closes: AI schools with open spots make last offers and
       everyone left decides. Anyone still unsigned leaves the game.
     • Commit chance: ~38% after round 1, ~55% after round 2, more with a
       clear leader, less in a close race, and much less when nobody meets
       his ask — money-first players hold out the longest.
     • No scouting: ratings, potential, last season's stats are all known.
     • He asks his own-school price (Roster.askFor) + 10% for the open
       market. AI schools price him off his exact worth.
     • Playing time matters more (that's usually why he left).
     • Relationship starts at a neutral 50 with every school (3 rounds isn't
       time to build from zero); points push you above it.
     • Money comes out of the BANK: offers hold their amount until he
       decides, and a signing is paid when he commits (next season's
       salaries were already set aside when the books closed; everyone who
       left sent his back). Pay is per season, renegotiated every offseason like everyone else.
     • His old school can bid to bring him back (he's testing his value),
       unless it pushed him out.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Engine = req ? require("../sim/engine.js") : root.Engine;
  const League = req ? require("./league.js") : root.League;
  const recruiting = () => req ? require("./recruiting.js") : root.Recruiting;
  const roster = () => req ? require("./roster.js") : root.Roster;

  const CFG = {
    rounds: 3,
    marketPremium: 0.10,
    relStart: 50,
    /* curves (recruiting.js): the lead slides the chance from closeRaceMult (tied) to clearLeadMult
       (a clearLead lead); under holdoutAt × asking it fades to the holdout cut at holdoutFade under */
    commit: { byRound: [0.38, 0.55], clearLead: 0.10, clearLeadMult: 1.6, closeRaceMult: 0.6,
              holdoutAt: 0.85, holdoutFade: 0.20, holdoutMult: 0.5, holdoutMoney: 0.35, soleOfferMult: 1.2, cap: 0.95 },
    weights: { pt: [0.6, 1.0] },        // he cares about playing time
    rosterSize: 13,
    /* what an AI school will pay depends on the role he'd have there: a starter is worth his full price,
       an 11th–13th man is walk-on money (it would rather keep the bank) */
    roleFactor: [[1.0, 1.0], [0.4, 0.8], [0, 0.6], [-0.6, 0.25], [-1, 0.08]],
    ai: { targetsPerSpot: 1.5, stretch: 2.2, openOffer: [0.90, 1.05], raiseChance: 0.6, raiseOver: 1.04,
          maxPay: 1.10, richShare: 0.9, richMaxPay: 1.4, giveUpChance: 0.5, crowding: 2.5, bankShare: 0.6 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const between = (rand, a, b) => a + rand() * (b - a);
  function strH(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const roundMoney = (v) => { const s = v >= 100000 ? 5000 : v >= 10000 ? 1000 : 100; return Math.round(v / s) * s; };
  const floorMoney = (v) => { const s = v >= 100000 ? 5000 : v >= 10000 ? 1000 : 100; return Math.max(0, Math.floor(v / s) * s); };
  const REL_WEIGHT = { loyal: [0.85, 1.0], steady: [0.6, 0.8], restless: [0.4, 0.6], ambitious: [0.25, 0.45] };
  const CLASS_LEFT = { FR: 3, SO: 2, JR: 1, SR: 1 };   // seasons left once classes advance (an SR still here redshirted)

  /* ---------------- building the pool ---------------- */
  function makeItem(lg, x, fromId) {
    const p = x.player, rand = Engine.makeRng(strH(p.id + "|portal|" + lg.season));
    const prefs = p.preferences || [];
    const hi = () => +between(rand, 0.8, 1.0).toFixed(2), w = () => +between(rand, 0.2, 0.7).toFixed(2);
    const [ra, rb] = REL_WEIGHT[p.temperament] || [0.5, 0.8];
    const weights = {
      pt: +between(rand, CFG.weights.pt[0], CFG.weights.pt[1]).toFixed(2),
      prox: prefs.includes("close_to_home") ? hi() : w(),
      prestige: prefs.includes("win_now") ? hi() : w(),
      dev: prefs.includes("development") ? hi() : w(),
      rel: +between(rand, ra, rb).toFixed(2),
    };
    const ovr = League.ovrOf(p);
    const yearsLeft = CLASS_LEFT[p.class] || 1;
    const fromTeam = lg.byId[fromId];
    return {
      id: p.id, player: p, name: p.name, pos: p.pos, height: p.height, archetype: p.archetype,
      home: p.home || (fromTeam && fromTeam.city) || null,
      ovr, potential: p.potential, pubOvr: ovr, pubPot: p.potential,
      from: fromId, why: x.why, reasons: x.reasons || [], mpg: x.mpg,
      ppg: p.season && p.season.gp ? +(p.season.pts / p.season.gp).toFixed(1) : 0,
      yearsLeft,
      weights, moneyWeight: p.moneyWeight || 0,
      asking: roundMoney(roster().askFor(p) * (1 + CFG.marketPremium)),
      worth: roster().fairPay(p),
      relDefault: CFG.relStart,
      status: "open", commitTo: null, deal: 0, commitRound: null, decision: null, odds: null,
      interest: {},
    };
  }

  function open(lg, transfers, rand) {
    const pool = [];
    for (const [fromId, list] of Object.entries(transfers)) for (const x of list) if (x.player) pool.push(makeItem(lg, x, fromId));
    pool.sort((a, b) => (b.ovr + 0.35 * Math.max(0, b.potential - b.ovr)) - (a.ovr + 0.35 * Math.max(0, a.potential - a.ovr)));
    pool.forEach((r, i) => { r.rank = i + 1; });
    lg.portal = { round: 1, closed: false, pool, pointsLeft: {}, log: [], news: [] };
    for (const t of lg.teams) lg.portal.pointsLeft[t.id] = recruiting().weeklyPoints(t);
    for (const t of lg.teams) if (t.isUser) autoPoints(lg, t);
    // the window opens contested: AI schools make their first offers
    for (const t of lg.teams) if (!t.isUser) aiRound(lg, t, rand);
    recruiting().markSeen(lg.portal.pool);
    return lg.portal;
  }

  /* ---------------- money & spots ---------------- */
  function pendingOf(lg, team) { let s = 0; for (const r of lg.portal.pool) if (r.status === "open" && r.interest[team.id]) s += r.interest[team.id].offer || 0; return s; }
  /* what you can still offer: the bank, minus offers out (signings were already paid) */
  function free(lg, team) { return (team.bank || 0) - pendingOf(lg, team); }
  function aiFree(lg, team) { return Math.max(0, (team.bank || 0) * CFG.ai.bankShare) - pendingOf(lg, team); }
  function spots(lg, team) {
    const R = lg.recruiting;
    const hs = R ? R.pool.filter(r => r.status === "committed" && r.commitTo === team.id).length : 0;
    const pc = lg.portal.pool.filter(r => r.status === "committed" && r.commitTo === team.id).length;
    return Math.max(0, CFG.rosterSize - team.players.length - hs - pc);
  }
  function interestOf(r, teamId) { return r.interest[teamId] || (r.interest[teamId] = { rel: CFG.relStart, offer: 0, roundPts: 0 }); }

  /* ---------------- actions (you and the AI) ---------------- */
  function setOffer(lg, team, r, amount) {
    if (r.status !== "open" || lg.portal.closed) return { ok: false, why: "He's off the market." };
    if (r.from === team.id && r.why === "encouraged") return { ok: false, why: "You pushed him out; he isn't coming back." };
    const it = interestOf(r, team.id);
    amount = Math.max(0, amount) < 10000 ? roundMoney(Math.max(0, amount)) : Math.round(amount / 1000) * 1000;   // offers move in $1k steps
    if (amount === it.offer) return { ok: false, why: "That's already your offer." };
    /* until the end of the round nobody has seen it: you can lower it, down to what he saw last round */
    if (amount < it.offer) {
      const seen = it.seen || 0;
      if (amount < seen) return { ok: false, why: `He's already seen ${recruiting().fmt(seen)} from you, so you can't go below that. You can lower a raise until the round ends, or withdraw (that costs relationship).` };
      it.offer = amount;
      return { ok: true, lowered: true };
    }
    if (spots(lg, team) <= 0) return { ok: false, why: "No open scholarships left." };
    const f = free(lg, team);
    if (amount - it.offer > f) return { ok: false, why: `Only ${recruiting().fmt(f + it.offer)} in the bank for this offer.` };
    it.offer = amount;
    return { ok: true };
  }
  function withdraw(lg, team, r, quiet) {
    const it = r.interest[team.id];
    if (!it || !it.offer) return { ok: false, why: "No offer to withdraw." };
    const seen = it.seen || 0;
    it.offer = 0;
    if (!quiet && seen > 0) it.rel = Math.max(0, it.rel - 15);   // one made this round is free to take back
    return { ok: true, free: seen <= 0 };
  }
  function addPoints(lg, team, r, pts) {
    const P = recruiting().CFG.points, PT = lg.portal;
    if (r.status !== "open" || PT.closed) return { ok: false, why: "He's off the market." };
    if (r.from === team.id && r.why === "encouraged") return { ok: false, why: "You pushed him out; he isn't coming back." };
    const it = interestOf(r, team.id);
    const left = PT.pointsLeft[team.id] || 0, room = P.capPerRecruit - (it.roundPts || 0);
    const n = Math.min(pts, left, room);
    if (n <= 0) return { ok: false, why: room <= 0 ? `Limit of ${P.capPerRecruit} points per player each round.` : "No recruiting points left this round." };
    const before = it.rel;
    it.rel = clamp(it.rel + n * P.gain * (1 + it.rel / P.compound), 0, 100);
    it.roundPts = (it.roundPts || 0) + n; PT.pointsLeft[team.id] = left - n;
    return { ok: true, spent: n, gained: it.rel - before, rel: it.rel };
  }
  const standings = (lg, r) => recruiting().standings(lg, r, null);
  const evaluate = (lg, team, r) => recruiting().evaluate(lg, team, r, null);

  /* ---------------- AI ---------------- */
  function roleFactor(ptScore) { for (const [s, f] of CFG.roleFactor) if (ptScore >= s - 0.01) return f; return CFG.roleFactor[CFG.roleFactor.length - 1][1]; }
  /* a blue blood's 11th man is still a real player on real money: the floor rises with prestige
     (about walk-on money at prestige 40 and below, ~45% of his value at 90+) */
  const benchFloor = (team) => clamp(0.08 + (team.prestige - 40) / 50 * 0.37, 0.08, 0.45);
  function aiPrice(team, r, ev) { return r.worth * (1 + CFG.marketPremium) * Math.max(roleFactor(ev.parts[0].score), benchFloor(team)); }   // ev: this school's evaluation of him (its playing-time score)
  function aiRound(lg, team, rand) {
    const A = CFG.ai, PT = lg.portal;
    const sp = spots(lg, team);
    const live = () => PT.pool.filter(r => r.status === "open" && r.interest[team.id] && r.interest[team.id].offer);
    if (sp <= 0) { for (const r of live()) withdraw(lg, team, r, true); return; }
    const perSpot = (aiFree(lg, team) + pendingOf(lg, team)) / sp;
    for (const r of live()) {
      const st = standings(lg, r), me = st.find(s => s.teamId === team.id);
      if (!me || st[0].teamId === team.id) continue;
      const needed = roundMoney((st[0].effective * A.raiseOver) / me.mult);
      const price = aiPrice(team, r, me) / me.mult;
      const cap = Math.max(price * A.maxPay, Math.min(perSpot * A.richShare, price * A.richMaxPay));
      if (needed <= cap && needed - me.offer <= aiFree(lg, team)) { if (rand() < A.raiseChance) interestOf(r, team.id).offer = needed; }
      else if (rand() < A.giveUpChance) withdraw(lg, team, r, true);
    }
    const mine = live(), want = Math.ceil(sp * A.targetsPerSpot);
    if (mine.length < want) {
      const perOffer = Math.max(3000, aiFree(lg, team) / (want - mine.length));
      const roles = roster().nextRoles(lg, team);
      const worst = Math.min(...team.players.map(League.ovrOf).sort((a, b) => b - a).slice(0, 9), 99);
      const cands = [];
      for (const r of PT.pool) {
        if (r.status !== "open" || (r.from === team.id && r.why === "encouraged") || (r.interest[team.id] && r.interest[team.id].offer)) continue;
        const ev = evaluate(lg, team, r);
        const cost = Math.min(r.asking, aiPrice(team, r, ev)) / ev.mult;
        if (cost > perOffer * A.stretch) continue;
        if (r.ovr < worst - 6 && ev.parts[0].score < 0) continue;            // not better than what we have, and he'd sit
        const need = ev.parts[0].score > 0 ? 4 : ev.parts[0].score < -0.5 ? -4 : 0;
        const crowd = Object.values(r.interest).filter(i => i.offer).length;
        cands.push({ r, cost, val: r.ovr + 0.35 * Math.max(0, r.potential - r.ovr) + need + rand() * 3 - A.crowding * crowd });
      }
      cands.sort((a, b) => b.val - a.val);
      for (const c of cands) {
        if (live().length >= want) break;
        const offer = floorMoney(Math.min(aiFree(lg, team), c.cost * between(rand, A.openOffer[0], A.openOffer[1])));
        if (offer < c.cost * 0.6 || offer <= 0) continue;
        interestOf(c.r, team.id).offer = offer;
      }
    }
    let pts = PT.pointsLeft[team.id] || 0;
    for (const r of live().sort(() => rand() - 0.5)) { if (pts <= 0) break; const res = addPoints(lg, team, r, recruiting().CFG.points.capPerRecruit); if (res.ok) pts -= res.spent; }
  }

  /* ---------------- decisions ---------------- */
  function commit(lg, r, ev, st, odds) {
    const team = lg.byId[ev.teamId], PT = lg.portal;
    r.status = "committed"; r.commitTo = team.id; r.deal = ev.offer; r.commitRound = PT.round; if (recruiting() && recruiting().touch) recruiting().touch(lg); r.odds = odds == null ? null : +odds.toFixed(3);
    const shown = st.slice(0, 3); if (!shown.includes(ev)) shown.push(ev);
    r.decision = shown.map(s => ({ teamId: s.teamId, offer: s.offer, mult: +s.mult.toFixed(3), effective: Math.round(s.effective) }));
    team.bank = Math.round((team.bank || 0) - r.deal);                       // paid now, like a raise
    for (const id in r.interest) if (id !== team.id) r.interest[id].offer = 0;
    const other = st.find(x => x !== ev), F = recruiting().fmt;
    const upset = odds != null && odds < 0.4 && st.length > 1 ? ` An upset: ${Math.round(odds * 100)}% odds.` : "";
    PT.log.unshift({ round: PT.round, recruitId: r.id, teamId: team.id,
      text: `${r.pos} ${r.name} (${r.ovr}, from ${lg.byId[r.from].name}) commits to ${team.name}${other ? ` over ${lg.byId[other.teamId].name}` : ""} (${F(r.deal)}).${upset}` });
    if (spots(lg, team) <= 0) for (const o of PT.pool) if (o.status === "open" && o.interest[team.id] && o.interest[team.id].offer) withdraw(lg, team, o, true);
  }
  function rollCommits(lg, rand, force) {
    const C = CFG.commit, PT = lg.portal, base = C.byRound[Math.min(PT.round - 1, C.byRound.length - 1)];
    for (const r of [...PT.pool].sort((a, b) => a.rank - b.rank)) {
      if (r.status !== "open") continue;
      const st = standings(lg, r).filter(s => spots(lg, lg.byId[s.teamId]) > 0);
      if (!st.length) continue;
      if (!force) {
        let p = base;
        const Rc = recruiting();
        p *= Rc.belowLineMult(st[0].effective, r.asking * C.holdoutAt, C.holdoutFade, C.holdoutMult * (1 - C.holdoutMoney * r.moneyWeight));
        if (st.length === 1) p *= C.soleOfferMult;
        else p *= Rc.leadMult(st, C.clearLead, C.closeRaceMult, C.clearLeadMult);
        if (rand() >= Math.min(C.cap, p)) continue;
      }
      const od = recruiting().commitOdds(st);
      let x = rand(), i = 0;
      for (; i < od.length - 1; i++) { if ((x -= od[i].odds) <= 0) break; }
      commit(lg, r, st[i], st, od[i].odds);
    }
  }

  /* news for the players you're after (offers, raises, lead changes) */
  const yours = (r, uid) => { const it = r.interest[uid]; return r.status === "open" && it && (it.offer || it.watch || it.roundPts); };
  function snapshot(lg) {
    const out = {};
    for (const u of lg.teams.filter(t => t.isUser)) {
      const m = out[u.id] = {};
      for (const r of lg.portal.pool) if (yours(r, u.id)) {
        const offers = {}; for (const id in r.interest) if (r.interest[id].offer) offers[id] = r.interest[id].offer;
        m[r.id] = { offers, lead: (standings(lg, r)[0] || {}).teamId };
      }
    }
    return out;
  }
  function news(lg, before) {
    const PT = lg.portal, F = recruiting().fmt;
    for (const uid in before) for (const rid in before[uid]) {
      const r = PT.pool.find(x => x.id === rid), b = before[uid][rid];
      if (!r || r.status !== "open") continue;
      const add = (text, kind) => PT.news.unshift({ teamId: uid, round: PT.round, recruitId: r.id, text, kind });
      for (const id in r.interest) {
        if (id === uid) continue;
        const now = r.interest[id].offer || 0, was = b.offers[id] || 0;
        if (now && !was) add(`${lg.byId[id].name} offered ${r.pos} ${r.name} ${F(now)}.`, "offer");
        else if (now > was) add(`${lg.byId[id].name} raised its offer for ${r.pos} ${r.name} to ${F(now)}.`, "raise");
      }
      const lead = (standings(lg, r)[0] || {}).teamId;
      if (b.lead === uid && lead && lead !== uid) add(`You lost the lead for ${r.pos} ${r.name} to ${lg.byId[lead].name}.`, "lost");
      else if (b.lead !== uid && lead === uid) add(`You took the lead for ${r.pos} ${r.name}.`, "lead");
    }
  }

  /* end of a round: players decide first, then the AI moves */
  function nextRound(lg, rand) {
    const PT = lg.portal;
    if (PT.closed) return;
    if (PT.round >= CFG.rounds) return close(lg, rand);
    rollCommits(lg, rand, false);
    PT.round++;
    const before = snapshot(lg);
    for (const t of lg.teams) if (!t.isUser) aiRound(lg, t, rand);
    news(lg, before);
    recruiting().markSeen(PT.pool);
    for (const r of PT.pool) for (const id in r.interest) r.interest[id].roundPts = 0;
    for (const t of lg.teams) PT.pointsLeft[t.id] = recruiting().weeklyPoints(t);
    for (const t of lg.teams) if (t.isUser) autoPoints(lg, t);
  }
  /* the window closes: last AI offers, everyone left decides, the rest leave */
  function close(lg, rand) {
    const PT = lg.portal;
    if (PT.closed) return;
    PT.round = CFG.rounds + 1;
    for (let k = 0; k < 10; k++) {
      rollCommits(lg, rand, true);
      let made = 0;
      for (const t of lg.teams) {
        if (t.isUser) continue;
        let sp = spots(lg, t) - PT.pool.filter(r => r.status === "open" && r.interest[t.id] && r.interest[t.id].offer).length;
        if (sp <= 0) continue;
        const each = aiFree(lg, t) / sp;
        if (each <= 0) continue;
        for (const r of PT.pool.filter(r => r.status === "open" && !(r.from === t.id && r.why === "encouraged") && !(r.interest[t.id] && r.interest[t.id].offer)).sort((a, b) => a.rank - b.rank)) {
          if (sp <= 0) break;
          const ev = evaluate(lg, t, r);
          const offer = floorMoney(Math.min(each, Math.min(r.asking, aiPrice(t, r, ev)) / ev.mult));
          if (offer <= 0) continue;
          interestOf(r, t.id).offer = offer; sp--; made++;
        }
      }
      if (!made) break;
    }
    rollCommits(lg, rand, true);
    PT.closed = true;
    const unsigned = PT.pool.filter(r => r.status === "open");
    unsigned.forEach(r => { r.status = "unsigned"; for (const id in r.interest) r.interest[id].offer = 0; });
    // they leave the game: their careers count for records, the archive and the Hall of Fame
    const Awards = req ? require("./awards.js") : root.Awards;
    if (Awards) for (const r of unsigned) if (r.player && lg.byId[r.from]) Awards.archive(lg, r.player, lg.byId[r.from], "unsigned");
    PT.log.unshift({ round: PT.round, text: `The portal closes: ${PT.pool.filter(r => r.status === "committed").length} of ${PT.pool.length} found a new school; ${unsigned.length} didn't.` });
  }

  /* signed portal players join their new rosters (before classes advance) */
  function arrivals(lg) {
    const PT = lg.portal, incoming = {};
    if (!PT) return incoming;
    for (const r of PT.pool) {
      if (r.status !== "committed") continue;
      const t = lg.byId[r.commitTo], p = r.player;
      p.salary = r.deal; p.starter = false; p.walkOn = false;
      if (r.weights) p.ptWeight = r.weights.pt;
      p.transferredFrom = r.from; p.decision = null; p.promise = null;
      t.players.push(p);
      (incoming[t.id] = incoming[t.id] || []).push({ id: p.id, name: p.name, pos: p.pos, class: League.classLabel(p), ovr: r.ovr, potential: r.potential, deal: r.deal, from: r.from, why: "portal" });
    }
    const summary = { total: PT.pool.length, signed: PT.pool.filter(r => r.status === "committed").length,
      unsigned: PT.pool.filter(r => r.status === "unsigned").map(r => ({ name: r.name, pos: r.pos, ovr: r.ovr, from: r.from })) };
    return { incoming, summary };
  }

  /* auto-recruiting, same as high school: per-player toggle or your whole
     board (offered or starred); offered players first, best overall first */
  function autoTargets(lg, team) {
    return lg.portal.pool.filter(r => { const it = r.interest[team.id]; return r.status === "open" && !(r.from === team.id && r.why === "encouraged") && it && (it.auto || (team.portalAuto && (it.offer || it.watch))); })
      .sort((a, b) => (!a.interest[team.id].offer - !b.interest[team.id].offer) || b.ovr - a.ovr);
  }
  function autoPoints(lg, team, only) {
    if (!lg.portal || lg.portal.closed) return 0;
    let spent = 0;
    for (const r of only ? [only] : autoTargets(lg, team)) {
      if ((lg.portal.pointsLeft[team.id] || 0) <= 0) break;
      const res = addPoints(lg, team, r, recruiting().CFG.points.capPerRecruit);
      if (res.ok) spent += res.spent;
    }
    return spent;
  }

  /* AI-only sims: the whole window at once */
  function autoRun(lg, transfers, rand) {
    open(lg, transfers, rand);
    while (!lg.portal.closed) nextRound(lg, rand);
  }

  const Portal = { CFG, autoPoints, autoTargets, open, nextRound, close, arrivals, autoRun, setOffer, withdraw, addPoints, free, spots, standings, evaluate, interestOf, pendingOf };
  if (typeof module !== "undefined") module.exports = Portal;
  else root.Portal = Portal;
})(typeof window !== "undefined" ? window : globalThis);
