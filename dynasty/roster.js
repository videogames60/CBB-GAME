/* =====================================================================
   HOOPS DYNASTY — ROSTER (transfer chance, contracts, offseason decisions)

   TRANSFER CHANCE is one number per returning player, built from reasons
   you can see and act on:

     minutes      this season's minutes vs what his spot on the depth chart
                  earned (counts a bit more for high-potential players)
     outlook      his projected role next season (after graduation, the
                  draft and your signed class)
     money        salary vs his ASK (what the open market would pay him):
                  no complaint at 85%+ of it, then it grows faster the
                  further under he is, maxing out at half his ask; scaled
                  by how much money matters to him; money-first or ambitious
                  players are happier when overpaid; a pay cut stings)
     winning      a losing season (much more for win-now players)
     new coach    his school changed coaches
     promise      a broken minutes promise from last offseason (big)
     locker room  a teammate was pushed out (this offseason, half next)
     random       a little noise
   then × temperament (loyal … restless) × how many options he has
   (better players can start elsewhere) × prestige (big programs keep
   players) × a small freshman damper. Capped at 65%.

   PAY is year to year: every offseason each player's pay is open again
   (fair pay is recalculated from his new ratings). There are no
   multi-year contracts; nothing stops a transfer, an offer only changes
   the money side.

   DECISIONS happen in the offseason after graduation, the draft and
   signing day, before the transfer rolls: offer new pay (raise or cut),
   promise minutes, or encourage a transfer (max 2; the roster notices). Raises are paid out of the bank now; anyone who
   leaves refunds next season's salary to the bank.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const League = req ? require("./league.js") : root.League;
  const recruiting = () => req ? require("./recruiting.js") : root.Recruiting;

  const CFG = {
    base: 0.01,
    minutes: { weight: 0.36, tolerance: 0.15, upsideBonus: 0.30, roleMinutes: [30, 18, 10, 4, 0] },   // starter, 6th–7th, rotation, end of bench, buried
    outlook: [0, 0.03, 0.08, 0.15, 0.22],
    money: { tolerance: 0.85, fullAt: 0.50, curve: 1.3, weight: 0.32, overpaidMax: 0.06, overpaidRate: 0.15, payCut: 0.02, payCutRate: 0.30 },   // pay cut: 2 + 30 × the share cut, more for money-first players
    winning: { winNow: 0.12, others: 0.03 },
    newCoach: 0.18,
    brokenPromise: 0.35, promiseSlack: 2,
    lockerRoom: { now: 0.03, last: 0.015 },
    noise: 0.02,
    loyalty: { at0: 1.45, per: 0.0095 },                         // × (1.45 − 0.0095 × loyalty): 95 → 0.55, 62 → 0.86, 40 → 1.07, 20 → 1.26
    /* role next year and money weigh more as he gets older (closer to the pros,
       fewer years left to wait): rising sophomore / junior / senior */
    classWeight: { FR: 1.0, SO: 1.3, JR: 1.6 },
    promiseFloor: 0.5,
    /* how much playing time matters to him (0.2–1.0) scales the minutes and
       role-next-year reasons: ×0.7 if he barely cares, ×1.3 if it's everything */
    ptCare: { lo: 0.7, hi: 1.3 },
    /* a short season is easier to swallow when he moves up next year (the
       guy ahead of him left): one spot up keeps half the minutes complaint,
       two or more keeps a fifth */
    movingUp: [1, 0.5, 0.2],                                           // a promise under half of what he wants covers nothing
    options: { at: 45, per: 40, min: 0.45, max: 1.3 },        // × clamp(min + (ovr − at)/per, min, max)
    prestigeDamper: 0.008, freshman: 0.85, cap: 0.65,
    maxPerTeam: 3, maxEncourage: 2,
    fairShare: 0.8,                                              // fair pay = this × his worth (same scale as starting salaries)
    askMoneyBoost: 0.25,                                         // he asks fair × (1 + this × money weight)
    ai: { keepTop: 9, raiseIfOver: 0.12, bankShare: 0.7 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hash = (...xs) => xs.reduce((h, x) => (Math.imul(h ^ (typeof x === "string" ? strH(x) : x >>> 0), 0x9e3779b1) ^ (h >>> 15)) >>> 0, 0x811c9dc5);
  function strH(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const unit = (...xs) => (hash(...xs) % 100000) / 100000;
  const mpgOf = (p) => p.season && p.season.gp ? (p.season.sec / 60) / p.season.gp : 0;

  /* ---------------- money ---------------- */
  const fairPay = (p) => recruiting().worthOf(recruiting().playerValue(p)) * CFG.fairShare;
  const roundMoney = (v) => { const s = v >= 100000 ? 5000 : v >= 10000 ? 1000 : 100; return Math.round(v / s) * s; };
  function askFor(p) {
    const a = fairPay(p) * (1 + CFG.askMoneyBoost * (p.moneyWeight || 0));
    return roundMoney(a);
  }

  /* ---------------- depth chart roles ----------------
     Same idea recruiting uses: best five by position (a player can fill a
     neighbouring slot at −3), then the bench by value. Role index:
     0 starter, 1 6th–7th man, 2 rotation, 3 end of bench, 4 buried. */
  const NEIGHBOR = { PG: ["SG"], SG: ["PG", "SF"], SF: ["SG", "PF"], PF: ["SF", "C"], C: ["PF"] };
  const ROLE_NAMES = ["Starter", "6th–7th man", "Rotation", "End of bench", "Buried"];
  function roles(pool) {   // pool: [{ id, pos, v }]
    const pairs = [];
    for (const p of pool) { pairs.push({ p, slot: p.pos, v: p.v }); for (const s of NEIGHBOR[p.pos] || []) pairs.push({ p, slot: s, v: p.v - 3 }); }
    pairs.sort((a, b) => b.v - a.v);
    const usedP = new Set(), usedS = new Set(), out = {};
    for (const x of pairs) { if (usedP.has(x.p.id) || usedS.has(x.slot)) continue; usedP.add(x.p.id); usedS.add(x.slot); out[x.p.id] = 0; if (usedS.size === 5) break; }
    pool.filter(p => !usedP.has(p.id)).sort((a, b) => b.v - a.v).forEach((p, i) => { out[p.id] = i <= 1 ? 1 : i <= 3 ? 2 : i <= 6 ? 3 : 4; });
    return out;
  }
  /* the season just played, from the roster as it stood (before anyone left) */
  function seasonRoles(team) {
    return roles(team.players.filter(p => !p.redshirt).map(p => ({ id: p.id, pos: p.pos, v: League.ovrOf(p) })));
  }
  /* next season: whoever is still here (and not pushed out) + the signed class */
  function nextRoles(lg, team) {
    const OS = lg.offseason || {};
    const out = new Set(OS.encouraged && OS.encouraged[team.id] || []);
    const pool = team.players.filter(p => !out.has(p.id)).map(p => ({ id: p.id, pos: p.pos, v: League.ovrOf(p) + 0.3 * Math.max(0, p.potential - League.ovrOf(p)) * 0.5 }));
    const R = lg.recruiting;
    if (R) for (const r of R.pool) if (r.status === "committed" && r.commitTo === team.id) pool.push({ id: r.id, pos: r.pos, v: r.ovr + 0.3 * Math.max(0, r.potential - r.ovr) });
    return roles(pool);
  }

  /* how much playing time matters to him, 0.2–1.0: a signed recruit or portal
     player keeps what he had in recruiting; everyone else gets one from his
     preferences (playing time → 0.8–1.0) or a fixed hash of his id (0.2–0.7) */
  function ptWeightOf(p) {
    if (p.ptWeight != null) return p.ptWeight;
    const u = unit(p.id, "pt");
    p.ptWeight = +((p.preferences || []).includes("playing_time") ? 0.8 + 0.2 * u : 0.2 + 0.5 * u).toFixed(2);
    return p.ptWeight;
  }
  const ptCareMult = (p) => CFG.ptCare.lo + (CFG.ptCare.hi - CFG.ptCare.lo) * clamp((ptWeightOf(p) - 0.2) / 0.8, 0, 1);
  /* the minutes he wants next season: what his best role (this year's or next year's) is worth */
  const wantedMinutes = (role, next) => Math.max(10, CFG.minutes.roleMinutes[Math.min(next, role)]);

  /* ---------------- the transfer chance ---------------- */
  function transferOdds(lg, team, p) {
    const OS = lg.offseason || {}, C = CFG, parts = [], mults = [];
    if (p.class === "SR" && !p.redshirt) return { chance: 0, parts, mults, note: "graduating" };
    const ovr = League.ovrOf(p), d = p.decision || {};
    const add = (key, label, v) => { if (Math.abs(v) >= 0.0005) parts.push({ key, label, v }); };
    add("base", "everyone thinks about it", C.base);

    // minutes this season vs the role he earned
    const role = (OS.seasonRole && OS.seasonRole[p.id]) ?? 2;
    const expected = C.minutes.roleMinutes[role], mpg = mpgOf(p);
    let minutesPart = 0;
    if (!p.redshirt && expected > 0) {
      const short = clamp(((expected - mpg) / expected - CFG.minutes.tolerance) / (1 - CFG.minutes.tolerance), 0, 1);   // a few minutes short isn't a complaint
      const upside = clamp((p.potential - ovr - 8) / 20, 0, 1);
      minutesPart = C.minutes.weight * short * (1 + C.minutes.upsideBonus * upside);
    }
    // next year's role
    const next = (OS.nextRoleCache && OS.nextRoleCache[team.id] || nextRoles(lg, team))[p.id] ?? 2;
    let outlookPart = C.outlook[next];
    // moving up next year (someone ahead of him left) softens last season's complaint
    const up = Math.max(0, role - next), upMult = C.movingUp[Math.min(up, C.movingUp.length - 1)];
    minutesPart *= upMult;
    // how much playing time matters to him
    const ptm = ptCareMult(p);
    minutesPart *= ptm;
    let outlookCare = ptm;
    const cw = C.classWeight[p.redshirt ? ({ SO: "FR", JR: "SO", SR: "JR" }[p.class] || "FR") : p.class] || 1;
    outlookPart *= cw * outlookCare;
    // a promise covers both, but only once it's at least half of what he wants:
    // nothing at half, everything at the full amount
    if (d.promise) {
      const want = wantedMinutes(role, next);
      const cover = clamp((d.promise / want - C.promiseFloor) / (1 - C.promiseFloor), 0, 1);
      minutesPart *= 1 - cover; outlookPart *= 1 - cover;
    }
    const careTxt = ptm >= 1.15 ? ", playing time matters a lot to him" : ptm <= 0.85 ? ", playing time doesn't matter much to him" : "";
    add("minutes", `last season: ${mpg.toFixed(0)} mpg; his spot (${ROLE_NAMES[role].toLowerCase()}) usually gets ~${expected}${up ? `; moving up to ${ROLE_NAMES[next].toLowerCase()} softens it` : ""}${careTxt}`, minutesPart);
    add("outlook", `next year: projected ${ROLE_NAMES[next].toLowerCase()}${careTxt}`, outlookPart);

    // money
    const salary = d.salary ?? p.salary ?? 0, fair = fairPay(p), ratio = salary / Math.max(1, fair);
    const M = C.money, mw = p.moneyWeight || 0;
    let money = 0;
    const ask = askFor(p), vsAsk = salary / Math.max(1, ask);
    if (vsAsk < M.tolerance) money = M.weight * Math.pow(clamp((M.tolerance - vsAsk) / (M.tolerance - M.fullAt), 0, 1), M.curve) * (0.3 + 0.7 * mw);
    money *= cw;
    if (ratio > 1.05 && (mw >= 0.5 || p.temperament === "ambitious")) money -= Math.min(M.overpaidMax, M.overpaidRate * (ratio - 1));
    let cutPart = 0;
    if (d.salary != null && d.salary < (p.salary || 0)) cutPart = (M.payCut + M.payCutRate * (((p.salary || 0) - d.salary) / Math.max(1, p.salary || 0))) * (0.6 + 0.8 * mw);
    add("money", vsAsk < M.tolerance ? `paid ${Math.round(vsAsk * 100)}% of what he'd get on the market (${recruiting().fmt(ask)})` : ratio > 1.05 ? `paid ${Math.round(ratio * 100)}% of fair` : "paid close to his ask", money);
    if (cutPart) add("paycut", `pay cut of ${Math.round(100 * ((p.salary || 0) - d.salary) / Math.max(1, p.salary || 0))}%`, cutPart);

    // winning
    const g = team.record ? team.record.w + team.record.l : 0, pct = g ? team.record.w / g : 0.5;
    if (pct < 0.5) add("winning", `${team.record.w}-${team.record.l} season`, (p.preferences || []).includes("win_now") ? C.winning.winNow * clamp((0.5 - pct) / 0.25, 0, 1) : C.winning.others * clamp((0.5 - pct) / 0.25, 0, 1));
    if (OS.newCoach && OS.newCoach[team.id]) add("coach", "new head coach", C.newCoach);
    if (p.promiseBroken) add("promise", `you promised ${p.promiseBroken.minutes} min, he got ${p.promiseBroken.got}`, C.brokenPromise);
    const lr = ((OS.encouraged && OS.encouraged[team.id] || []).length) * C.lockerRoom.now + ((team.pushedOutLast || 0) * C.lockerRoom.last);
    if (lr && !(OS.encouraged && (OS.encouraged[team.id] || []).includes(p.id))) add("locker", "a teammate was pushed out", lr);
    add("noise", "mood", (unit(p.id, lg.season, 7) * 2 - 1) * C.noise);

    const raw = Math.max(0, parts.reduce((s, x) => s + x.v, 0));
    const loy = League.loyaltyOf(p), tm = C.loyalty.at0 - C.loyalty.per * loy;
    mults.push({ label: `loyalty ${loy}`, m: tm });
    const op = clamp(C.options.min + (ovr - C.options.at) / C.options.per, C.options.min, C.options.max);
    mults.push({ label: op < 0.8 ? "few options elsewhere" : op > 1.1 ? "could start elsewhere" : "some options", m: op });
    const pr = clamp(1 - (team.prestige - 50) * C.prestigeDamper, 0.6, 1.3);
    mults.push({ label: `prestige ${League.grade(team.prestige)}`, m: pr });
    if (p.class === "FR") mults.push({ label: "freshman", m: C.freshman });
    const m = mults.reduce((s, x) => s * x.m, 1);
    const chance = clamp(raw * m, 0, C.cap);
    return { chance, parts: parts.map(x => ({ ...x, shown: x.v * m })), mults, role, next, fair, ask: askFor(p), mpg, expected };
  }

  /* ---------------- decisions ---------------- */
  function ensureDecision(p) { return p.decision || (p.decision = {}); }
  function bankCost(p) { const d = p.decision || {}; return d.salary != null ? d.salary - (p.salary || 0) : 0; }
  const step1k = (v) => Math.max(0, v) < 10000 ? roundMoney(Math.max(0, v)) : Math.round(v / 1000) * 1000;
  /* an offer of new pay for next season (he still decides in the transfer window) */
  function setDeal(lg, team, p, salary) {
    const d = ensureDecision(p); d.salary = step1k(salary);
    return { ok: true };
  }
  function clearDeal(p) { if (p.decision) delete p.decision.salary; }
  function promise(lg, team, p, minutes) {
    const d = ensureDecision(p);
    if (!minutes) { delete d.promise; return { ok: true }; }
    d.promise = clamp(Math.round(minutes), 5, 36);
    return { ok: true };
  }
  function encourage(lg, team, p, on) {
    const OS = lg.offseason; OS.encouraged = OS.encouraged || {};
    const list = OS.encouraged[team.id] = OS.encouraged[team.id] || [];
    if (on) {
      if (list.includes(p.id)) return { ok: true };
      if (list.length >= CFG.maxEncourage) return { ok: false, why: `You can push out at most ${CFG.maxEncourage} players a year.` };
      list.push(p.id);
    } else OS.encouraged[team.id] = list.filter(id => id !== p.id);
    if (OS.nextRoleCache) delete OS.nextRoleCache[team.id];
    return { ok: true };
  }

  /* AI schools: keep the players that matter, let the rest ride */
  function aiDecisions(lg, team) {
    const A = CFG.ai;
    const keep = [...team.players].sort((a, b) => League.ovrOf(b) - League.ovrOf(a)).slice(0, A.keepTop);
    let budget = Math.max(0, (team.bank || 0) * A.bankShare);
    for (const p of keep) {
      // the line where his money complaint starts: 85% of his ask (never below fair)
      const target = roundMoney(Math.max(fairPay(p), askFor(p) * CFG.money.tolerance));
      if ((p.salary || 0) >= target) continue;
      // well under it, or unhappy enough to matter: bring him up to it
      const under = (p.salary || 0) < target * 0.9;
      if (!under && transferOdds(lg, team, p).chance < A.raiseIfOver) continue;
      const cost = target - (p.salary || 0);
      if (cost > budget) continue;
      budget -= cost;
      setDeal(lg, team, p, target);
    }
  }

  /* ---------------- the offseason steps ---------------- */
  /* after graduation and the draft: roles are snapshotted */
  function prepare(lg, seasonRoleByTeam) {
    const OS = lg.offseason = lg.offseason || {};
    OS.seasonRole = Object.assign({}, ...Object.values(seasonRoleByTeam));
    OS.encouraged = {};
    OS.nextRoleCache = {};
    for (const t of lg.teams) for (const p of t.players) {
      p.decision = {};
      p.lastSalary = p.salary || 0;   // what he made the season that just ended (for the decisions screen)
      delete p.contractYears; delete p.salaryNext;   // older saves: multi-year deals are gone
      // last offseason's promise: kept or broken?
      p.promiseBroken = null;
      if (p.promise) {
        const got = mpgOf(p);
        if (got < p.promise - CFG.promiseSlack) p.promiseBroken = { minutes: p.promise, got: Math.round(got) };
        p.promise = null;
      }
    }
    for (const t of lg.teams) OS.nextRoleCache[t.id] = nextRoles(lg, t);
  }

  /* the rolls: encouraged players go, everyone else rolls their chance */
  function processTransfers(lg, rand) {
    const OS = lg.offseason || {}, out = {};
    for (const t of lg.teams) {
      if (!t.isUser) aiDecisions(lg, t);
      // apply deals (raises are paid from the bank now)
      for (const p of t.players) {
        const d = p.decision || {};
        if (d.salary != null) {
          t.bank = Math.round((t.bank || 0) - (d.salary - (p.salary || 0)));
          p.salary = d.salary;
        }
      }
      const pushed = new Set(OS.encouraged && OS.encouraged[t.id] || []);
      const leaving = [];
      for (const p of t.players) if (pushed.has(p.id)) leaving.push({ p, why: "encouraged" });
      let natural = 0;
      const odds = t.players.filter(p => !pushed.has(p.id)).map(p => ({ p, o: transferOdds(lg, t, p) })).sort((a, b) => b.o.chance - a.o.chance);
      for (const { p, o } of odds) {
        if (natural >= CFG.maxPerTeam) break;
        if (rand() < o.chance) { leaving.push({ p, why: "transfer", chance: o.chance, reasons: o.parts.filter(x => x.key !== "base" && x.key !== "noise" && x.shown > 0.01).sort((a, b) => b.shown - a.shown).slice(0, 2).map(x => x.key) }); natural++; }
      }
      const ids = new Set(leaving.map(x => x.p.id));
      // next season's salary was already set aside in the bank; it comes back
      for (const { p } of leaving) t.bank = Math.round((t.bank || 0) + (p.salary || 0));
      t.players = t.players.filter(p => !ids.has(p.id));
      for (const p of t.players) { if (p.decision && p.decision.promise) p.promise = p.decision.promise; p.decision = null; p.promiseBroken = null; }
      t.pushedOutLast = pushed.size;
      out[t.id] = leaving.map(({ p, why, chance, reasons }) => ({ id: p.id, name: p.name, pos: p.pos, class: League.classLabel(p), ovr: League.ovrOf(p), potential: p.potential,
        mpg: +mpgOf(p).toFixed(1), why, chance: chance != null ? +chance.toFixed(2) : null, reasons: reasons || [], player: p }));
    }
    return out;
  }

  /* older saves and brand-new leagues */
  function ensure(lg) {
    for (const t of lg.teams) for (const p of t.players) {
      delete p.contractYears; delete p.salaryNext;
      if (p.redshirtUsed == null) p.redshirtUsed = false;
    }
  }

  const Roster = { CFG, transferOdds, fairPay, askFor, seasonRoles, nextRoles, roles, ROLE_NAMES, wantedMinutes, ptWeightOf, setDeal, clearDeal, promise, encourage, bankCost,
    aiDecisions, prepare, processTransfers, ensure, mpgOf };
  if (typeof module !== "undefined") module.exports = Roster;
  else root.Roster = Roster;
})(typeof window !== "undefined" ? window : globalThis);
