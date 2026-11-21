(function (root) {
  const T0 = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./tuning.js")
           : (typeof TUNING !== "undefined" ? TUNING : root.TUNING);
  const POS_ORDER = ["PG", "SG", "SF", "PF", "C"];
  const RATING_KEYS = ["close", "mid", "three", "pass", "handle", "steal", "block", "perDef", "intDef", "reb"];

  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const logit = (p) => Math.log(p / (1 - p));
  const exps = (x) => Math.exp(x);
  function randInt(g, range) { return range[0] + Math.floor(g.rand() * (range[1] - range[0] + 1)); }
  /* Roll trace: when a game is created with debug: true, every roll is written
     to g.debug as one line ("label: a 40% · b 25% → a (roll 0.31)"). Off by
     default, so simulated games pay nothing for it. */
  const nm = (g, k) => { const p = g.byId && g.byId[k]; if (!p) return k; const w = p.name.split(" "); return w.length > 1 ? w[0][0] + ". " + w.slice(1).join(" ") : p.name; };
  const pct = (x) => (100 * x < 10 ? (100 * x).toFixed(1) : Math.round(100 * x)) + "%";
  function trace(g, line) { if (g.debug) g.debug.push(line); }
  function pick(g, weights, label) {
    let total = 0;
    for (const k in weights) if (weights[k] > 0) total += weights[k];
    const roll = g.rand();
    let r = roll * total, chosen = null;
    for (const k in weights) { if (weights[k] <= 0) continue; r -= weights[k]; if (r <= 0) { chosen = k; break; } }
    if (chosen === null) chosen = Object.keys(weights)[0];
    if (g.debug && label) {
      const opts = Object.keys(weights).filter(k => weights[k] > 0).sort((a, b) => weights[b] - weights[a]);
      g.debug.push(`${label}: ${opts.map(k => `${nm(g, k)} ${pct(weights[k] / total)}`).join(" · ")} → ${nm(g, chosen)} (roll ${roll.toFixed(2)})`);
    }
    return chosen;
  }
  function chance(g, x, label) {
    const p = sigmoid(x), roll = g.rand(), yes = roll < p;
    if (g.debug && label) g.debug.push(`${label}: ${pct(p)} → ${yes ? "yes" : "no"} (roll ${roll.toFixed(2)})`);
    return yes;
  }
  /* a plain probability roll, traced the same way */
  function roll(g, p, label) { return chance(g, logit(clamp(p, 1e-9, 1 - 1e-9)), label); }

  function emptyStats() { return { sec: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }; }
  function overall(T, pos, ratings) {
    const w = (T.ovr && T.ovr.weights && T.ovr.weights[pos]) || null;
    let s = 0, tot = 0;
    for (const k of RATING_KEYS) { const wk = w ? (w[k] || 0) : 1; s += wk * (ratings[k] || 50); tot += wk; }
    const off = (T.ovr && T.ovr.posOffset && T.ovr.posOffset[pos]) || 0;   // same scale at every position
    return Math.max(1, Math.min(99, Math.round(s / (tot || 1) - off)));
  }
  function prepTeam(T, team, idx) {
    const players = team.players.map(p => ({ ...p, ratings: { ...p.ratings }, teamIdx: idx, energy: 1, fouledOut: false, ovr: overall(T, p.pos, p.ratings), stats: emptyStats() }));
    let starters = players.filter(p => p.starter).slice(0, 5);
    if (starters.length < 5) {
      const used = new Set(starters.map(p => p.id));
      for (const pos of POS_ORDER) {
        if (starters.length >= 5) break;
        const best = players.filter(p => p.pos === pos && !used.has(p.id)).sort((a, b) => b.ovr - a.ovr)[0];
        if (best) { starters.push(best); used.add(best.id); }
      }
      players.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr).forEach(p => { if (starters.length < 5) { starters.push(p); used.add(p.id); } });
    }
    starters.forEach(p => { p.starter = true; });
    const t = {
      id: team.id, name: team.name, mascot: team.mascot || "", abbr: team.abbr || "", color: team.color || "#888", idx,
      coach: { rating: 60, offense: "balanced", defense: "man", lateGame: "auto", ...(team.coach || {}) },
      players, onCourt: starters.map(p => p.id), fouls: 0, score: 0, timeouts: T.timeout.perGame,
      control: team.control || "auto", homeEdge: 0, isoTarget: team.isoTarget || null, rotation: null, buff: 0,
    };
    t.rotation = team.rotation ? { ...team.rotation } : defaultRotation(T, players);
    return t;
  }
  function defaultRotation(T, players) {
    const R = T.rotation.defaultMinutes, rot = {};
    const st = players.filter(p => p.starter).sort((a, b) => b.ovr - a.ovr);
    const bn = players.filter(p => !p.starter).sort((a, b) => b.ovr - a.ovr);
    st.forEach((p, i) => { rot[p.id] = R.starters[i] || 0; });
    bn.forEach((p, i) => { rot[p.id] = R.bench[i] || 0; });
    return rot;
  }
  function createGame(teamA, teamB, opts = {}) {
    const T = opts.tuning || T0;
    const g = {
      T, opts, rand: makeRng(opts.seed == null ? (Date.now() & 0xffffffff) : opts.seed),
      teams: [prepTeam(T, teamA, 0), prepTeam(T, teamB, 1)],
      half: 0, clock: 0, shotClock: T.clock.shotClock, period: 0, offIdx: 0, pos: null, firstPoss: 0,
      events: [], debug: opts.debug ? [] : null, over: false, defenderOf: {}, byId: {},
      deadBall: true, mediaDone: {}, lastScore: [0, 0], run: { teamIdx: -1, pts: 0 },
    };
    if (opts.homeCourt != null) {
      const H = T.homeCourt;
      g.teams[0].homeEdge = H.weakMult + (H.strongMult - H.weakMult) * clamp(opts.homeCourt / 99, 0, 1);
    }
    g.teams.forEach(t => t.players.forEach(p => { g.byId[p.id] = p; }));
    setMatchups(g); refreshFit(g);
    return g;
  }
  const P = (g, id) => g.byId[id];
  const teamOf = (g, p) => g.teams[p.teamIdx];
  const onCourt = (g, team) => team.onCourt.map(id => g.byId[id]);
  const defenderOf = (g, p) => g.byId[g.defenderOf[p.id]];
  function setMatchups(g) {
    const a = onCourt(g, g.teams[0]).sort((x, y) => POS_ORDER.indexOf(x.pos) - POS_ORDER.indexOf(y.pos));
    const b = onCourt(g, g.teams[1]).sort((x, y) => POS_ORDER.indexOf(x.pos) - POS_ORDER.indexOf(y.pos));
    g.defenderOf = {};
    for (let i = 0; i < 5; i++) { g.defenderOf[a[i].id] = b[i].id; g.defenderOf[b[i].id] = a[i].id; }
  }
  function teamCenter(g, team, exclude) {
    return onCourt(g, team).filter(p => p.id !== exclude).sort((x, y) => (y.height - x.height) || (y.ratings.intDef - x.ratings.intDef))[0];
  }
  const DEF_KEYS = new Set(["steal", "perDef", "intDef", "block"]);
  function eff(g, p, key) {
    let r = p.ratings[key];
    if (DEF_KEYS.has(key) && g.teams[p.teamIdx].buff > 0) r += g.T.timeout.defBonus;
    return r * (1 - tiredness(g, p));
  }
  /* the share of his ratings fatigue takes right now (tuning.fatigue): none while fresh, steeper as he tires */
  function tiredness(g, p) {
    const F = g.T.fatigue;
    if (!F.enabled) return 0;
    const fresh = F.freshAt ?? 1, floor = F.floorAt ?? 0;
    const t = clamp((fresh - clamp(p.energy, 0, 1)) / Math.max(0.01, fresh - floor), 0, 1);
    return F.maxPenalty * Math.pow(t, F.curve ?? 1);
  }
  const offBuff = (g, off, pos) => (off.buff > 0 ? g.T.timeout.tovLogit : 0)
    + g.T.homeCourt.tovLogit * hcEdge(g, g.teams[1 - off.idx])
    + offCost(g, off, "tovLogit", "logit") - oBonus(g, off, "secure")
    + (pos && pos.transition ? g.T.transition.tovLogit : 0);
  function hcEdge(g, team) {
    const base = (team && team.homeEdge) || 0;
    if (!base) return 0;
    const H = g.T.homeCourt, half = g.T.clock.halfSeconds;
    let m = H.baseMult;
    if (g.period === 1 && g.clock > half - H.earlyMinutes * 60) m = H.earlyMult;
    else if (g.period >= 2 && g.clock <= H.lateMinutes * 60) m = H.lateMult;
    return base * m;
  }
  const bestShot = (g, p) => Math.max(eff(g, p, "close"), eff(g, p, "mid"), eff(g, p, "three"));
  const ftSkill = (g, p) => (eff(g, p, "mid") + eff(g, p, "three")) / 2;
  function coachScale(g, team) { const c = g.T.coach; return c.minScale + (c.maxScale - c.minScale) * clamp((team.coach.rating - 25) / 74, 0, 1); }
  function offStyle(g, team) {
    const st = g.T.styles.offense[team.coach.offense] || g.T.styles.offense.balanced;
    if (team.coach.offense === "iso" && !isoTargetOnCourt(g, team)) return g.T.styles.offense.balanced;
    return st;
  }
  function isoTarget(g, team) {
    if (team.isoTarget && g.byId[team.isoTarget]) return g.byId[team.isoTarget];
    const raw = (p) => Math.max(p.ratings.close, p.ratings.mid, p.ratings.three) + p.ratings.handle;
    const best = [...team.players].sort((a, b) => raw(b) - raw(a))[0];
    team.isoTarget = best ? best.id : null;
    return best;
  }
  const isoTargetOnCourt = (g, team) => { const t = isoTarget(g, team); return !!t && team.onCourt.includes(t.id); };
  const isIsoStyleActive = (g, team) => team.coach.offense === "iso" && isoTargetOnCourt(g, team);
  function defStyle(g, team) { return g.T.styles.defense[team.coach.defense] || g.T.styles.defense.man; }
  function rosterValue(g, team, F) {
    const men = onCourt(g, team);
    const val = (p) => F.keys.reduce((s, k) => s + eff(g, p, k), 0) / F.keys.length;
    let pool = men;
    if (F.mode === "bigs") pool = [...men].sort((a, b) => b.height - a.height).slice(0, 2);
    else if (F.mode === "guards") pool = [...men].sort((a, b) => a.height - b.height).slice(0, 3);
    const vals = pool.map(val);
    if (F.mode === "target") { const tg = isoTarget(g, team); return tg && team.onCourt.includes(tg.id) ? val(tg) : F.low; }
    if (F.mode === "min") return Math.min(...vals);
    if (F.mode === "best") return Math.max(...vals);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }
  function computeFit(g, team, style) {
    const F = style && style.fit;
    if (!F) return 1;
    const v = rosterValue(g, team, F);
    const t = clamp((v - F.low) / (F.high - F.low), 0, 1);
    return F.min + (F.max - F.min) * t;
  }
  function refreshFit(g) { for (const team of g.teams) { team.fitOff = computeFit(g, team, offStyle(g, team)); team.fitDef = computeFit(g, team, defStyle(g, team)); } }
  const fitOff = (g, team) => team.fitOff == null ? 1 : team.fitOff;
  const fitDef = (g, team) => team.fitDef == null ? 1 : team.fitDef;
  /* Benefits scale with the coach's tactics rating and roster fit. Costs are
     the style's own price, the same for every coach: tactics never makes the
     downside bigger. */
  function sMult(g, team, m) { return m == null ? 1 : 1 + (m - 1) * coachScale(g, team) * fitOff(g, team); }
  function dBonus(g, team, key) {
    const st = defStyle(g, team);
    return ((st.d && st.d[key] || 0) * coachScale(g, team) * fitDef(g, team)) + (st.cost && st.cost[key] || 0);
  }
  function sBenefit(g, team, key) { return sMult(g, team, offStyle(g, team)[key]); }
  function defCostMult(g, team, key) { const v = (defStyle(g, team).cost || {})[key]; return v == null ? 1 : v; }
  function oBonus(g, team, key) { const o = offStyle(g, team).o; return o && o[key] ? o[key] * coachScale(g, team) * fitOff(g, team) : 0; }
  function offCost(g, team, key, kind) {
    const v = (offStyle(g, team).cost || {})[key];
    if (v == null) return kind === "mult" ? 1 : 0;
    return v;
  }
  function actionTime(g, team, key) {
    const s = offStyle(g, team).timeScale || 1;
    let mult = 1 + (s - 1) * coachScale(g, team) * fitOff(g, team);
    if (g.late && team.idx === g.offIdx) {
      if (g.late.endOfHalf) mult *= g.T.lateGame.halfTimeScale;
      else if (g.late.offMode === "milk" || g.late.offMode === "hold") mult *= g.T.lateGame.milkTimeScale;
      else if (g.late.offMode === "hurry") mult *= g.T.lateGame.hurryTimeScale;
    }
    return Math.max(1, Math.round(randInt(g, g.T.time[key]) * mult));
  }
  function spend(g, sec, { shot = false, action = null, actor = null } = {}) {
    if (!shot) sec = Math.min(sec, Math.max(1, g.shotClock - 1));
    sec = Math.min(sec, g.clock);
    g.clock -= sec; g.shotClock -= sec;
    const F = g.T.fatigue;
    for (const team of g.teams) {
      const court = team.onCourt;
      for (const p of team.players) {
        if (court.includes(p.id)) {
          p.stats.sec += sec;
          if (F.enabled) p.energy = clamp(p.energy - sec * F.drainPerSec * offCost(g, team, "fatigueMult", "mult") * defCostMult(g, team, "fatigueMult") * exps(-F.kStamina * (p.ratings.stamina - 60)), 0, 1);
        } else if (F.enabled) p.energy = clamp(p.energy + sec * F.recoverPerSec, 0, 1);
      }
    }
    if (F.enabled && action && actor) actor.energy = clamp(actor.energy - (F.actionCost[action] || 0), 0, 1);
  }
  function emit(g, type, data) {
    if (g.opts.events === false && !g.opts.onEvent) { if (type === "foul") resolveFoulOuts(g); return null; }   // simulated games: no play-by-play kept
    const e = { type, period: g.period, clock: g.clock, ...data };
    g.events.push(e);
    if (g.opts.onEvent) g.opts.onEvent(e, g);
    if (type === "foul") resolveFoulOuts(g);
    return e;
  }
  const regSeconds = (g) => 2 * g.T.clock.halfSeconds;
  function elapsedFrac(g) {
    const T = g.T;
    const played = g.period <= 2 ? (g.period - 1) * T.clock.halfSeconds + (T.clock.halfSeconds - g.clock) : regSeconds(g) + (g.period - 2) * T.clock.otSeconds - g.clock;
    return played / regSeconds(g);
  }
  const deficit = (g, team, p) => (team.rotation[p.id] || 0) * 60 * elapsedFrac(g) - p.stats.sec;
  function inFoulTrouble(g, p) {
    const R = g.T.rotation, pf = p.stats.pf;
    const star = (g.teams[p.teamIdx].rotation[p.id] || 0) >= (R.starMinutes || 99);   // a coach keeps his heavy-minute guys in with two early fouls
    if (g.period === 1) return pf >= R.firstHalfFouls || (!star && pf >= R.earlyFouls && g.clock > R.earlySeconds);
    if (g.period === 2 && g.clock > R.closeSeconds) return pf >= R.secondHalfFouls;
    return false;
  }
  function crunchTime(g) {
    const R = g.T.rotation;
    return g.period > 2 || (g.period === 2 && g.clock <= R.closeSeconds && Math.abs(g.teams[0].score - g.teams[1].score) <= R.closeMargin);
  }
  function doSub(g, team, slot, inP, reason) {
    const out = g.byId[team.onCourt[slot]];
    team.onCourt[slot] = inP.id;
    g.lineupDirty = true;
    inP.inAt = gameSec(g);
    if (reason === "rest" || reason === "exhausted") out.resting = true;
    emit(g, "sub", { team: team.name, teamIdx: team.idx, in: inP.name, out: out.name, inId: inP.id, outId: out.id, reason });
  }
  const gameSec = (g) => elapsedFrac(g) * regSeconds(g);
  const lerp01 = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  /* how tired a player has to be before the coach rests him, by his planned minutes */
  function tiredAt(g, team, p) {
    const R = g.T.rotation, m = team.rotation[p.id] || 0;
    return lerp01(R.tiredBelow, R.tiredAtMax ?? R.tiredBelow, (m - (R.heavyFrom ?? 40)) / (40 - (R.heavyFrom ?? 40)));
  }
  function exhaustedAt(g, team, p) {
    const R = g.T.rotation, m = team.rotation[p.id] || 0;
    return lerp01(R.exhausted, R.exhaustedAtMax ?? R.exhausted, (m - (R.heavyFrom ?? 40)) / (40 - (R.heavyFrom ?? 40)));
  }
  function garbageTime(g) {
    const G = g.T.rotation.garbage;
    return !!G && g.period === 2 && g.clock <= G.seconds && Math.abs(g.teams[0].score - g.teams[1].score) >= G.margin;
  }
  function coachSubs(g, team, keep) {
    const R = g.T.rotation, auto = team.control === "auto", crunch = crunchTime(g), now = gameSec(g);
    const planned = (p) => (team.rotation[p.id] || 0) > 0;
    // anyone who sat to rest is ready again once he's recovered
    for (const p of team.players) if (p.resting && !team.onCourt.includes(p.id) && p.energy >= Math.min(R.returnEnergy ?? 0.85, tiredAt(g, team, p) + 0.20)) p.resting = false;
    const garbage = auto && garbageTime(g);
    for (let slot = 0; slot < team.onCourt.length; slot++) {
      const cur = g.byId[team.onCourt[slot]];
      if (keep && cur.id === keep) continue;   // he's shooting free throws
      let reason = null;
      if (cur.fouledOut) reason = "fouled out";
      else if (!auto) continue;
      else if (garbage) { if ((team.rotation[cur.id] || 0) >= 20) reason = "garbage time"; }
      else if (cur.energy < exhaustedAt(g, team, cur)) reason = "exhausted";
      else if (!crunch && inFoulTrouble(g, cur)) reason = "foul trouble";
      else if (!crunch && cur.energy < tiredAt(g, team, cur)) reason = "rest";
      else if (!crunch && now - (cur.inAt || 0) >= (R.minStint || 0)) {
        if (deficit(g, team, cur) < -R.tolerance * 60) reason = "rotation";
        // someone on the bench is further behind his plan (any position; out of position costs a minute) —
        // this is also how a rested or foul-troubled starter gets back in
        else if (team.players.some(c => !team.onCourt.includes(c.id) && !c.fouledOut && !c.resting && planned(c) && c.energy >= tiredAt(g, team, c) && !inFoulTrouble(g, c)
                   && deficit(g, team, c) - deficit(g, team, cur) - (c.pos === cur.pos ? 0 : 60) > R.swapGap * 60)) reason = "rotation";
      }
      if (!reason) continue;
      const bench = team.players.filter(p => !team.onCourt.includes(p.id) && !p.fouledOut);
      const must = reason === "fouled out";
      const pick = (allowUnplanned, allowResting) => {
        let best = null, bestScore = -Infinity;
        for (const c of bench) {
          if (!allowUnplanned && !planned(c)) continue;
          if (!allowResting && c.resting && !crunch) continue;
          if (!must && !crunch && reason !== "garbage time" && inFoulTrouble(g, c)) continue;
          if (!must && c.energy < exhaustedAt(g, team, c)) continue;
          let score = reason === "garbage time" ? -(team.rotation[c.id] || 0) - c.stats.sec / 60 + 5 * c.energy
            : crunch ? (team.rotation[c.id] || 0) + 10 * c.energy : deficit(g, team, c) / 60 + 6 * c.energy;
          if (c.pos !== cur.pos) score -= R.posPenalty;
          if (score > bestScore) { bestScore = score; best = c; }
        }
        return best;
      };
      // planned, rested players first; then anyone planned; guys with no minutes only in an emergency (or garbage time)
      let best = reason === "garbage time" ? pick(true, true) : pick(false, false) || pick(false, true);
      if (!best && (must || reason === "exhausted" || reason === "foul trouble")) best = pick(true, true);
      if (!best) continue;
      if (reason === "rotation" && deficit(g, team, best) - deficit(g, team, cur) < 60) continue;
      if (reason === "garbage time" && (team.rotation[best.id] || 0) >= 20) continue;
      doSub(g, team, slot, best, reason);
    }
  }
  /* a timeout: the team with the ball, or either team on a dead ball (college rules) */
  const canTimeout = (g, teamIdx) => !g.over && g.teams[teamIdx].timeouts > 0 && (g.deadBall || g.offIdx === teamIdx);
  function callTimeout(g, teamIdx) {
    const team = g.teams[teamIdx];
    if (!canTimeout(g, teamIdx)) return false;
    team.timeouts--; team.buff = g.T.timeout.possessions;
    if (g.pos && g.pos.transition) { g.pos.transition = false; }       // the defense gets set: no fast break after a timeout
    if (g.pos && g.pos.outlet) { g.pos.outlet = false; g.pos.player = null; }   // they inbound it: a ball handler brings it up
    for (const t of g.teams) for (const id of t.onCourt) { const p = g.byId[id]; p.energy = clamp(p.energy + g.T.timeout.energy, 0, 1); }
    g.deadBall = true; g.run = { teamIdx: -1, pts: 0 };
    emit(g, "timeout", { team: team.name, teamIdx, left: team.timeouts, score: [g.teams[0].score, g.teams[1].score] });
    return true;
  }
  function aiTimeout(g, team) {
    if (team.control !== "auto" || team.timeouts <= 0) return;
    const A = g.T.ai, opp = g.teams[1 - team.idx];
    const trailing = opp.score - team.score;
    const late = g.period >= 2 && g.clock <= A.lateSeconds;
    // stopping a run: on a dead ball, or on your own possession once it's set (never on your own fast break)
    const setPossession = g.offIdx === team.idx && !(g.pos && g.pos.transition);
    if (g.run.teamIdx === opp.idx && g.run.pts >= A.runTrigger && !late && (g.deadBall || setPossession) && canTimeout(g, team.idx)) return callTimeout(g, team.idx);
    if (late && trailing > 0 && trailing <= A.lateMargin && g.deadBall && g.offIdx === team.idx) return callTimeout(g, team.idx);
  }
  function mediaTimeout(g) {
    const marks = g.T.clock.mediaTimeouts || [];
    if (g.period > 2 || !g.deadBall) return;
    const done = g.mediaDone[g.period] || 0;
    if (done < marks.length && g.clock <= marks[done]) {
      g.mediaDone[g.period] = done + 1;
      for (const t of g.teams) for (const id of t.onCourt) { const p = g.byId[id]; p.energy = clamp(p.energy + g.T.timeout.mediaEnergy, 0, 1); }   // the same as a team timeout (the bench is resting anyway)
      emit(g, "media_timeout", { score: [g.teams[0].score, g.teams[1].score] });
    }
  }
  function trackRun(g) {
    const d0 = g.teams[0].score - g.lastScore[0], d1 = g.teams[1].score - g.lastScore[1];
    g.lastScore = [g.teams[0].score, g.teams[1].score];
    const scorer = d0 > 0 ? 0 : d1 > 0 ? 1 : -1;
    if (scorer < 0) return;
    if (g.run.teamIdx === scorer) g.run.pts += d0 + d1; else g.run = { teamIdx: scorer, pts: d0 + d1 };
  }
  /* SUBSTITUTIONS happen only on a dead ball (a made basket, a foul, a violation, a timeout,
     before each free throw), never after a steal or a defensive rebound. */
  function handleSubs(g, keep) {
    if (g.deadBall) {
      for (const team of g.teams) { applyQueued(g, team, keep); coachSubs(g, team, keep); }
      if (g.lineupDirty) { setMatchups(g); g.lineupDirty = false; }   // matchups only move when the five on the floor do
    }
    refreshFit(g);                                                     // fit follows fatigue, so every possession
  }
  /* your subs made on a live ball wait for the next dead ball */
  function applyQueued(g, team, keep) {
    const q = team.queued || [];
    team.queued = [];
    for (const { outId, inId } of q) {
      const slot = team.onCourt.indexOf(outId), inP = g.byId[inId];
      if (outId === keep || slot < 0 || !inP || team.onCourt.includes(inId) || inP.fouledOut) { if (outId === keep) team.queued.push({ outId, inId }); continue; }
      doSub(g, team, slot, inP, "coach");
    }
  }
  /* a coach's substitution: now on a dead ball, or queued for the next one ("queued") */
  function substitute(g, teamIdx, outId, inId) {
    const team = g.teams[teamIdx], slot = team.onCourt.indexOf(outId), inP = g.byId[inId];
    if (g.over || slot < 0 || !inP || inP.teamIdx !== teamIdx || team.onCourt.includes(inId) || inP.fouledOut) return false;
    if (!g.deadBall) {
      team.queued = (team.queued || []).filter(x => x.outId !== outId && x.inId !== inId);
      team.queued.push({ outId, inId });
      return "queued";
    }
    doSub(g, team, slot, inP, "coach"); setMatchups(g); refreshFit(g);
    return true;
  }
  function setStyle(g, teamIdx, { offense, defense } = {}) {
    const c = g.teams[teamIdx].coach;
    if (offense && g.T.styles.offense[offense]) c.offense = offense;
    if (defense && g.T.styles.defense[defense]) c.defense = defense;
    refreshFit(g);
  }
  function setIsoTarget(g, teamIdx, playerId) { g.teams[teamIdx].isoTarget = playerId || null; refreshFit(g); }
  function setLateGame(g, teamIdx, mode) { g.teams[teamIdx].coach.lateGame = mode === "off" ? "off" : "auto"; }
  function setControl(g, teamIdx, mode) { g.teams[teamIdx].control = mode === "manual" ? "manual" : "auto"; }
  function setRotation(g, teamIdx, minutes) { Object.assign(g.teams[teamIdx].rotation, minutes); }

  function lateContext(g) {
    const L = g.T.lateGame;
    const off = g.teams[g.offIdx], def = g.teams[1 - g.offIdx];
    const out = { offMode: null, shootAt: 0, huntThree: false, defFoul: false, endOfHalf: false };
    if (!L.enabled) return out;
    if (g.period < 2) {
      if (!L.endOfHalf || off.coach.lateGame === "off") return out;
      if (g.clock <= g.T.clock.shotClock) { out.offMode = "hold"; out.shootAt = L.halfHoldShootAt; out.endOfHalf = true; }
      return out;
    }
    const lead = off.score - def.score, clock = g.clock;
    const lastPossession = clock <= g.T.clock.shotClock;
    if (lastPossession) {
      if (lead >= 0) { out.offMode = "hold"; out.shootAt = L.holdShootAt; }
      else if (-lead <= L.chaseMaxDeficit) { out.offMode = "chase"; out.shootAt = L.chaseShootAt; }
    }
    if (!out.offMode) {
      if (lead >= L.milkLead && clock <= L.milkSeconds) out.offMode = "milk";
      else if (lead < 0 && -lead >= L.hurryDeficit && clock <= L.hurrySeconds) out.offMode = "hurry";
    }
    const down = -lead;
    if (down === 3 && clock <= L.threeSeconds) { out.huntThree = true; out.threeMult = L.threeMult; }
    else if (down >= 4 && clock <= down * L.threeSecondsPerPoint) { out.huntThree = true; out.threeMult = L.threeMultBig; }
    const defDown = lead;
    const window = Math.min(L.foulSecondsMax, L.foulSecondsBase + defDown * L.foulSecondsPerPoint);
    if (def.coach.lateGame !== "off" && defDown >= L.foulMinDeficit && defDown <= L.foulMaxDeficit && clock <= window && clock > 1) out.defFoul = true;
    if (off.coach.lateGame === "off") { out.offMode = null; out.huntThree = false; }
    return out;
  }
  function intentionalFoul(g, off, def, pos) {
    const L = g.T.lateGame;
    const targets = onCourt(g, off);
    const victim = L.huntWorstShooter ? targets.reduce((a, b) => ftSkill(g, b) < ftSkill(g, a) ? b : a) : P(g, pos.player);
    const fouler = onCourt(g, def).filter(p => p.stats.pf < g.T.rotation.foulOutAt - 1).sort((a, b) => a.stats.pf - b.stats.pf)[0] || defenderOf(g, victim) || onCourt(g, def)[0];
    spend(g, randInt(g, L.foulSecondsPerTrip));
    addFoul(g, def, fouler);
    emit(g, "foul", { team: def.name, teamIdx: def.idx, player: fouler.name, on: victim.name, kind: "intentional", teamFouls: def.fouls });
    if (def.fouls >= g.T.foul.doubleBonusFrom) { pos.ft = { shooter: victim.id, count: 2, oneAndOne: false }; return "freeThrows"; }
    if (def.fouls >= g.T.foul.bonusFrom) { pos.ft = { shooter: victim.id, count: 2, oneAndOne: true }; return "freeThrows"; }
    g.shotClock = Math.max(g.shotClock, g.T.clock.foulResetTo);
    pos.catch = false;
    return "possession";
  }
  function chooseHandler(g, team, exclude, lean = 1, label = "ball handler") {
    const w = {};
    onCourt(g, team).forEach(p => { if (p.id !== exclude) w[p.id] = exps(lean * g.T.outlet.kHandler * ((eff(g, p, "handle") + eff(g, p, "pass")) / 2 - 60)); });
    return g.byId[pick(g, w, label)];
  }
  const playmaking = (g, p) => (eff(g, p, "handle") + eff(g, p, "pass")) / 2;
  /* how much a team runs: faster offenses push more, scaled by the coach */
  function paceOf(g, team) { const st = offStyle(g, team).timeScale || 1; return (1 + (1 - st) * 2 * coachScale(g, team)) * sBenefit(g, team, "breakMult"); }
  /* a pass that can be picked off: base chance, the receiver's defender's steal vs the passer's passing, the defense's steal bonus */
  function outletStolen(g, passer, target, defTeam, base, label) {
    const O = g.T.outlet, td = defenderOf(g, target);
    return chance(g, logit(base) + O.kLane * (eff(g, td, "steal") - eff(g, passer, "pass")) + dBonus(g, defTeam, "steal"), label) ? td : null;
  }
  /* a fast break is on: the man with the ball pushes it himself, or throws it ahead to whoever's
     running. Returns { handler } or { stolenBy, passer } */
  function runBreak(g, team, opp, carrier) {
    const O = g.T.outlet;
    if (roll(g, sigmoid(O.pushK * (eff(g, carrier, "handle") - O.pushHandle)), g.debug && `${nm(g, carrier.id)} pushes it himself`)) return { handler: carrier };
    const target = chooseHandler(g, team, carrier.id, O.flatK, "outlet ahead to");
    spend(g, actionTime(g, team, "outlet"));
    const thief = outletStolen(g, carrier, target, opp, O.rushSteal, "outlet ahead stolen");
    if (thief) return { stolenBy: thief, passer: carrier };
    emit(g, "pass", { team: team.name, teamIdx: team.idx, from: carrier.name, to: target.name, outlet: true });
    return { handler: target };
  }
  function goBreak(g, team, opp, carrier) {
    const res = runBreak(g, team, opp, carrier);
    if (res.stolenBy) return turnover(g, team, opp, res.passer, res.stolenBy, "lane", true);
    emit(g, "fastbreak", { team: team.name, teamIdx: team.idx, player: res.handler.name });
    return endPossession(g, { toIdx: team.idx, player: res.handler.id, transition: true, outlet: false, dead: false, shotClock: g.T.transition.breakShotClock });
  }
  function endPossession(g, next) {
    g.offIdx = next.toIdx;
    g.deadBall = next.dead !== false;
    g.pos = { player: next.player || null, transition: !!next.transition, outlet: !!next.outlet, bringUp: true,
      shotClock: next.shotClock || g.T.clock.shotClock, catch: false, putback: false, kickout: false, assistBy: null, assistFresh: 1, passes: 0, source: null, zone: null, forced: false };
    return null;
  }
  function decayAssist(g, pos, action) {
    if (!pos.assistBy) return;
    const f = g.T.assist.freshness[action];
    pos.assistFresh = Math.max(g.T.assist.minCount, (pos.assistFresh == null ? 1 : pos.assistFresh) * (f == null ? 0 : f));
    if (f === 0) pos.assistBy = null;
  }
  function creditAssist(g, pos, scorer) {
    if (!pos.assistBy || pos.assistBy === scorer.id) return null;
    const fresh = pos.assistFresh == null ? 1 : pos.assistFresh;
    if (!roll(g, fresh, g.debug && `assist to ${nm(g, pos.assistBy)}`)) return null;
    const a = P(g, pos.assistBy);
    a.stats.ast++;
    return a;
  }
  function offensiveFoul(g, off, def, p, d, kind) {
    p.stats.pf++;
    if (g.T.offFoul.countsAsTeamFoul) off.fouls++;
    if (p.stats.pf >= g.T.rotation.foulOutAt) { p.fouledOut = true; g.pendingFoulOut = true; }
    p.stats.tov++;
    emit(g, "foul", { team: off.name, teamIdx: off.idx, player: p.name, on: d ? d.name : null, kind, offensive: true, teamFouls: off.fouls });
    emit(g, "turnover", { team: off.name, teamIdx: off.idx, player: p.name, how: kind });
    return endPossession(g, { toIdx: def.idx });
  }
  function turnover(g, off, def, p, d, how, isSteal) {
    p.stats.tov++;
    if (isSteal && d) {
      d.stats.stl++; emit(g, "steal", { team: def.name, teamIdx: def.idx, player: d.name, victim: p.name, how });
      // usually a fast break the other way; otherwise he pulls it out and they set up (the handoff applies)
      const sb = defStyle(g, def).stealBreak ?? g.T.transition.stealBreak;   // a pressing team's steals come in the backcourt
      if (roll(g, clamp(sb * paceOf(g, def), 0, 0.95), "fast break off the steal")) return goBreak(g, def, off, d);
      return endPossession(g, { toIdx: def.idx, player: d.id, outlet: true, dead: false });
    }
    emit(g, "turnover", { team: off.name, teamIdx: off.idx, player: p.name, how });
    return endPossession(g, { toIdx: def.idx, player: null, transition: false, dead: true });
  }
  function addFoul(g, defTeam, d) {
    d.stats.pf++; defTeam.fouls++;
    if (d.stats.pf >= g.T.rotation.foulOutAt) { d.fouledOut = true; g.pendingFoulOut = true; }
  }
  function resolveFoulOuts(g) {
    if (!g.pendingFoulOut) return;
    g.pendingFoulOut = false;
    for (const team of g.teams) {
      for (let slot = 0; slot < team.onCourt.length; slot++) {
        const cur = g.byId[team.onCourt[slot]];
        if (!cur.fouledOut) continue;
        const bench = team.players.filter(p => !team.onCourt.includes(p.id) && !p.fouledOut);
        if (!bench.length) continue;
        const best = bench.sort((a, b) => ((team.rotation[b.id] || 0) + 10 * b.energy + (b.pos === cur.pos ? 5 : 0)) - ((team.rotation[a.id] || 0) + 10 * a.energy + (a.pos === cur.pos ? 5 : 0)))[0];
        doSub(g, team, slot, best, "fouled out");
      }
    }
    setMatchups(g); refreshFit(g);
  }
  const NODES = {};
  NODES.possession = function (g, off, def, pos) {
    const T = g.T;
    if (g.clock <= 0) return endPossession(g, { toIdx: off.idx });
    if (!pos.player || !off.onCourt.includes(pos.player)) { pos.player = chooseHandler(g, off).id; pos.outlet = false; }
    let p = P(g, pos.player);
    if (pos.outlet) {   // he has it after a rebound (or pulled a steal out): usually he gives it to the best ball handler
      pos.outlet = false;
      const best = Math.max(...onCourt(g, off).filter(m => m.id !== p.id).map(m => playmaking(g, m)));
      const gap = best - playmaking(g, p);
      if (roll(g, sigmoid(T.outlet.handoffK * (gap - T.outlet.handoffGap)), g.debug && `${nm(g, p.id)} hands it to a guard`)) {
        const h = chooseHandler(g, off, p.id);
        spend(g, randInt(g, T.time.handoff || [0, 1]));
        const thief = outletStolen(g, p, h, def, T.outlet.safeSteal, "outlet stolen");
        if (thief) return turnover(g, off, def, p, thief, "lane", true);
        emit(g, "pass", { team: off.name, teamIdx: off.idx, from: p.name, to: h.name, outlet: true });
        pos.player = h.id; p = h;
      }
    }
    const d = defenderOf(g, p);
    const sc = Math.min(g.shotClock, g.clock);
    const late = g.late || { offMode: null };
    if (late.defFoul && !pos.fouledThisTrip) { pos.fouledThisTrip = true; return intentionalFoul(g, off, def, pos); }
    if (sc <= T.clock.forcedShotAt) {
      if (roll(g, T.clock.violationChance, "shot clock violation")) {
        p.stats.tov++;
        emit(g, "turnover", { team: off.name, teamIdx: off.idx, player: p.name, how: "shotclock" });
        return endPossession(g, { toIdx: def.idx });
      }
      pos.forced = true; pos.source = "forced"; return "shoot";
    }
    if (g.clock <= T.clock.buzzerShotAt) { pos.forced = true; pos.source = "forced"; return "shoot"; }
    const H = T.hazard;
    if (chance(g, logit(H.onBallSteal.base) + H.onBallSteal.kSteal * (eff(g, d, "steal") - eff(g, p, "handle")) + dBonus(g, def, "steal") + offBuff(g, off, pos), g.debug && `on-ball steal (${nm(g, d.id)} on ${nm(g, p.id)})`))
      return turnover(g, off, def, p, d, "onball", true);
    if (chance(g, logit(H.looseTurnover.base) + H.looseTurnover.kHandle * (60 - eff(g, p, "handle")) + offBuff(g, off, pos), "loose-ball turnover"))
      return turnover(g, off, def, p, null, "loose", false);
    if (chance(g, logit(H.reachFoul.base) + H.reachFoul.kSteal * (eff(g, d, "steal") - eff(g, p, "handle")) + dBonus(g, def, "foul"), "reach-in foul")) {
      addFoul(g, def, d);
      emit(g, "foul", { team: def.name, teamIdx: def.idx, player: d.name, on: p.name, kind: "reach", teamFouls: def.fouls });
      if (def.fouls >= T.foul.doubleBonusFrom) { pos.ft = { shooter: p.id, count: 2, oneAndOne: false }; return "freeThrows"; }
      if (def.fouls >= T.foul.bonusFrom) { pos.ft = { shooter: p.id, count: 2, oneAndOne: true }; return "freeThrows"; }
      g.shotClock = Math.max(g.shotClock, T.clock.foulResetTo);
      pos.catch = false;
      return "possession";
    }
    const A = T.action, st = offStyle(g, off);
    const w = {
      pass: A.base.pass * sMult(g, off, st.action.pass) * exps(A.kPass * (eff(g, p, "pass") - 60)),
      drive: A.base.drive * sMult(g, off, st.action.drive) * exps(A.kHandle * (eff(g, p, "handle") - 60)) * (pos.transition ? T.transition.driveMult : 1),
      shoot: A.base.shoot * sMult(g, off, st.action.shoot) * exps(A.kShoot * (bestShot(g, p) - 60)) * (pos.catch ? A.catchShootMult : 1) * (pos.putback ? A.putbackMult : 1),
      iso: A.base.iso * sMult(g, off, st.action.iso) * exps(A.kHandle * 0.7 * (eff(g, p, "handle") - 60)),
      screen: A.base.screen * sMult(g, off, st.action.screen),
      post: A.base.post * sMult(g, off, st.action.post) * exps(A.kPost * (postThreat(g, off, p) - 60)),
    };
    if (!postTarget(g, off, p)) w.post = 0;
    if (isIsoStyleActive(g, off)) {
      if (isoTarget(g, off).id === p.id) { const m = sBenefit(g, off, "isoSelfMult"); w.iso *= m; w.pass /= m; }
      else { const dm = sBenefit(g, off, "isoDeferMult"); for (const k of ["shoot", "drive", "iso", "screen", "post"]) w[k] *= dm; }
    }
    if (sc <= T.clock.urgentAt) for (const k in A.urgent) w[k] *= A.urgent[k];
    const L = T.lateGame;
    if (late.offMode === "hold" || late.offMode === "chase") {
      if (g.clock > late.shootAt + 1 && sc > T.clock.forcedShotAt + 2) { w.shoot *= L.holdShootMult; w.pass *= L.holdPassMult; w.iso *= 1.4; w.post *= 0.6; }
      else { w.shoot *= 6; w.pass *= 0.25; w.screen *= 0.5; w.post *= 0.5; }
    } else if (late.offMode === "milk") { w.shoot *= L.milkShootMult; w.pass *= 1.4; w.iso *= 1.2; }
    else if (late.offMode === "hurry") { w.shoot *= L.hurryShootMult; w.pass *= 0.6; w.screen *= 0.6; w.post *= 0.4; }
    const a = pick(g, w, g.debug && `${nm(g, p.id)} action`);
    const wasCatch = pos.catch;
    pos.catch = false;
    if (a === "shoot") { pos.source = pos.putback ? "putback" : (wasCatch ? "catch" : "pullup"); pos.zone = null; decayAssist(g, pos, "shoot"); return "shoot"; }
    pos.putback = false; pos.kickout = false;
    if (a === "pass") return "pass";
    decayAssist(g, pos, a);
    return a;
  };
  function postTarget(g, off, handler) {
    let best = null, bestV = -Infinity;
    for (const m of onCourt(g, off)) {
      if (m.id === handler.id || m.height < g.T.action.postMinHeight) continue;
      const v = eff(g, m, "close") + 0.3 * m.height;
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }
  const postThreat = (g, off, handler) => { const b = postTarget(g, off, handler); return b ? eff(g, b, "close") : 0; };
  function pickTarget(g, off, p, { kickout = false } = {}) {
    const st = offStyle(g, off), w = {};
    for (const m of onCourt(g, off)) {
      if (m.id === p.id) continue;
      const shooting = kickout ? Math.max(eff(g, m, "three"), eff(g, m, "mid")) : bestShot(g, m);
      const play = (eff(g, m, "pass") + eff(g, m, "handle")) / 2;
      w[m.id] = exps(g.T.pass.kTarget * (shooting - 60) + g.T.pass.kInitiator * Math.max(0, play - g.T.pass.initiatorFloor)) * sMult(g, off, st.passTarget[m.pos]);
      if (isIsoStyleActive(g, off) && isoTarget(g, off).id === m.id) w[m.id] *= sBenefit(g, off, "isoTargetMult");
    }
    return P(g, pick(g, w, kickout ? "kickout target" : "pass target"));
  }
  NODES.pass = function (g, off, def, pos) {
    const T = g.T, p = P(g, pos.player), d = defenderOf(g, p);
    spend(g, actionTime(g, off, "pass"), { action: "pass", actor: p });
    const target = pickTarget(g, off, p), td = defenderOf(g, target);
    const S = T.pass.steal;
    const x = logit(S.base) + S.kLane * (eff(g, td, "steal") - eff(g, p, "pass")) + S.kOnBall * (eff(g, d, "steal") - eff(g, p, "pass")) + dBonus(g, def, "steal") + offBuff(g, off, pos);
    if (chance(g, x, "pass stolen")) { const thief = roll(g, S.laneShare, "stolen in the lane (vs on the ball)") ? td : d; return turnover(g, off, def, p, thief, "lane", true); }
    emit(g, "pass", { team: off.name, teamIdx: off.idx, from: p.name, to: target.name });
    pos.player = target.id; pos.catch = true; pos.assistBy = p.id; pos.assistFresh = 1; pos.passes++; pos.transition = false;
    return "possession";
  };
  function kickOut(g, off, def, pos, p) {
    const target = pickTarget(g, off, p, { kickout: true }), td = defenderOf(g, target);
    spend(g, actionTime(g, off, "kickout"));
    const K = g.T.pass.kickout;
    if (chance(g, logit(K.base) + K.kLane * (eff(g, td, "steal") - eff(g, p, "pass")) + dBonus(g, def, "steal"), "kickout stolen")) return turnover(g, off, def, p, td, "lane", true);
    emit(g, "pass", { team: off.name, teamIdx: off.idx, from: p.name, to: target.name, kickout: true });
    pos.player = target.id; pos.catch = true; pos.kickout = true; pos.assistBy = p.id; pos.assistFresh = 1; pos.passes++;
    return "possession";
  }
  NODES.post = function (g, off, def, pos) {
    const T = g.T, PO = T.post, passer = P(g, pos.player);
    const big = postTarget(g, off, passer);
    if (!big) return "iso";
    spend(g, actionTime(g, off, "post"), { action: "iso", actor: big });
    pos.transition = false;
    const d = defenderOf(g, big);
    if (chance(g, logit(PO.entrySteal) + PO.kEntry * (eff(g, d, "steal") - eff(g, passer, "pass")) + dBonus(g, def, "steal") + offBuff(g, off, pos), "post entry stolen")) return turnover(g, off, def, passer, d, "lane", true);
    emit(g, "pass", { team: off.name, teamIdx: off.idx, from: passer.name, to: big.name, post: true });
    pos.assistBy = passer.id; pos.assistFresh = 1; pos.player = big.id;
    const gap = eff(g, big, "close") - eff(g, d, "intDef");
    const w = {
      score: PO.base.score * exps(PO.kScore * gap),
      foul: PO.base.foul * exps(PO.kFoul * gap + dBonus(g, def, "foul")),
      kickOut: PO.base.kickOut * exps(PO.kKick * (eff(g, big, "pass") - 60)),
      fade: PO.base.fade * exps(PO.kFade * (eff(g, big, "mid") - 60)),
      turnover: PO.base.turnover * exps(PO.kTov * (eff(g, d, "intDef") - eff(g, big, "handle")) + dBonus(g, def, "steal")),
      reset: PO.base.reset,
    };
    const o = pick(g, w, g.debug && `post-up ${nm(g, big.id)} vs ${nm(g, d.id)}`);
    if (o === "score") { pos.source = "post"; pos.zone = "close"; return "shoot"; }
    if (o === "fade") { pos.source = "post"; pos.zone = "mid"; return "shoot"; }
    if (o === "kickOut") { decayAssist(g, pos, "post"); return kickOut(g, off, def, pos, big); }
    if (o === "turnover") return turnover(g, off, def, big, d, "post", roll(g, 0.6, "post turnover is a steal"));
    if (o === "reset") return "possession";
    addFoul(g, def, d);
    emit(g, "foul", { team: def.name, teamIdx: def.idx, player: d.name, on: big.name, kind: "post", teamFouls: def.fouls });
    pos.ft = { shooter: big.id, count: 2, oneAndOne: false };
    return "freeThrows";
  };
  NODES.drive = function (g, off, def, pos) {
    const T = g.T, D = T.drive, p = P(g, pos.player), d = defenderOf(g, p);
    spend(g, actionTime(g, off, "drive"), { action: "drive", actor: p });
    const hd = eff(g, p, "handle") - eff(g, d, "perDef");
    const w = {
      layup: D.base.layup * exps(D.kLayup * hd) * (pos.transition ? T.transition.layupMult : 1) * (pos.fromIso ? D.isoBonus : 1) * (pos.fromScreen ? D.screenBonus : 1),
      kickOut: D.base.kickOut * exps(D.kKick * (eff(g, p, "pass") - 60)) * sBenefit(g, off, "kickMult"),
      pullUp: D.base.pullUp * exps(D.kPull * (eff(g, p, "mid") - 60)),
      foul: D.base.foul * exps(D.kFoul * hd * 0.5 + dBonus(g, def, "foul")),
      strip: D.base.strip * exps(D.kStrip * (eff(g, d, "steal") - eff(g, p, "handle")) + dBonus(g, def, "steal") + offBuff(g, off, pos)),
      charge: D.base.charge * exps(D.kCharge * (eff(g, d, "perDef") - eff(g, p, "handle"))),
    };
    pos.fromIso = false; pos.fromScreen = false;
    const o = pick(g, w, g.debug && `drive ${nm(g, p.id)} vs ${nm(g, d.id)}`);
    if (o === "layup") { pos.source = "drive"; pos.zone = "close"; return "shoot"; }
    if (o === "pullUp") { pos.source = "drive"; pos.zone = "mid"; pos.assistBy = null; return "shoot"; }
    if (o === "kickOut") { pos.transition = false; return kickOut(g, off, def, pos, p); }
    if (o === "strip") return turnover(g, off, def, p, d, "strip", true);
    if (o === "charge") return offensiveFoul(g, off, def, p, d, "charge");
    addFoul(g, def, d);
    const andOne = roll(g, D.andOne, "and-one");
    if (andOne) { p.stats.fga++; p.stats.fgm++; p.stats.pts += 2; off.score += 2; }
    emit(g, "foul", { team: def.name, teamIdx: def.idx, player: d.name, on: p.name, kind: "drive", andOne, teamFouls: def.fouls });
    if (andOne) {
      const a = creditAssist(g, pos, p);
      emit(g, "shot", { team: off.name, teamIdx: off.idx, player: p.name, defender: d.name, zone: "close", openness: "contested", source: "drive",
        made: true, blocked: false, fouled: true, pts: 2, assistBy: a ? a.name : null, score: [g.teams[0].score, g.teams[1].score] });
    }
    pos.ft = { shooter: p.id, count: andOne ? 1 : 2, oneAndOne: false, andOne };
    return "freeThrows";
  };
  NODES.iso = function (g, off, def, pos) {
    const T = g.T, I = T.iso, p = P(g, pos.player), d = defenderOf(g, p);
    spend(g, actionTime(g, off, "iso"), { action: "iso", actor: p });
    pos.transition = false;
    const hd = eff(g, p, "handle") - eff(g, d, "perDef");
    const w = {
      shoot: I.base.shoot * exps(I.kShoot * (bestShot(g, p) - 60)),
      drive: I.base.drive * exps(I.kDrive * hd),
      reset: I.base.reset,
      strip: I.base.strip * exps(I.kStrip * (eff(g, d, "steal") - eff(g, p, "handle")) + dBonus(g, def, "steal")),
    };
    const o = pick(g, w, g.debug && `iso ${nm(g, p.id)} vs ${nm(g, d.id)}`);
    if (o === "shoot") { pos.source = "iso"; pos.zone = null; return "shoot"; }
    if (o === "drive") { pos.fromIso = true; return "drive"; }
    if (o === "strip") return turnover(g, off, def, p, d, "strip", true);
    return "possession";
  };
  NODES.screen = function (g, off, def, pos) {
    const T = g.T, S = T.screen, p = P(g, pos.player), d = defenderOf(g, p);
    spend(g, actionTime(g, off, "screen"), { action: "screen", actor: p });
    pos.transition = false;
    const screener = teamCenter(g, off, p.id), sd = defenderOf(g, screener);
    const hd = eff(g, p, "handle") - eff(g, d, "perDef");
    const w = {
      pullUp: S.base.pullUp * exps(S.kPull * (Math.max(eff(g, p, "mid"), eff(g, p, "three")) - 60)),
      roll: S.base.roll * exps(S.kRoll * (eff(g, screener, "close") - eff(g, sd, "intDef")) + S.kRollPass * (eff(g, p, "pass") - 60)),
      drive: S.base.drive * exps(S.kDrive * hd), kick: S.base.kick, reset: S.base.reset,
      turnover: S.base.turnover * exps(S.kTov * (eff(g, d, "steal") - eff(g, p, "handle")) + dBonus(g, def, "steal")),
      moving: S.base.moving * exps(S.kMoving * (60 - eff(g, screener, "handle"))),
    };
    const o = pick(g, w, g.debug && `screen ${nm(g, screener.id)} for ${nm(g, p.id)}`);
    if (o === "pullUp") {
      pos.source = "screen";
      pos.zone = pick(g, { mid: exps(T.zone.kRating * (eff(g, p, "mid") - 60)), three: exps(T.zone.kRating * (eff(g, p, "three") - 60)) * T.zone.pullupThreeMult }, "pull-up from");
      return "shoot";
    }
    if (o === "roll") { pos.assistBy = p.id; pos.assistFresh = 1; pos.player = screener.id; pos.source = "roll"; pos.zone = "close"; return "shoot"; }
    if (o === "drive") { pos.fromScreen = true; return "drive"; }
    if (o === "kick") return kickOut(g, off, def, pos, p);
    if (o === "turnover") return turnover(g, off, def, p, d, "screen", true);
    if (o === "moving") return offensiveFoul(g, off, def, screener, sd, "moving");
    return "possession";
  };
  function pickZone(g, off, p, source) {
    const Z = g.T.zone, st = offStyle(g, off), w = {};
    const bs = (Z.bySource && Z.bySource[source]) || {};
    for (const z of ["close", "mid", "three"]) w[z] = Z.base[z] * (bs[z] == null ? 1 : bs[z]) * sMult(g, off, st.zone[z]) * exps(Z.kRating * (eff(g, p, z) - 60));
    if (g.late && g.late.huntThree) w.three *= (g.late.threeMult || g.T.lateGame.threeMult);
    if (source === "pullup" || source === "iso" || source === "forced") w.three *= Z.pullupThreeMult;
    return pick(g, w, g.debug && `${nm(g, p.id)} shot zone (${source})`);
  }
  NODES.shoot = function (g, off, def, pos) {
    const T = g.T, p = P(g, pos.player);
    if (g.clock <= 0) { emit(g, "buzzer", { team: off.name, teamIdx: off.idx, player: p.name }); return endPossession(g, { toIdx: off.idx }); }
    const source = pos.source || "pullup";
    const zone = pos.zone || pickZone(g, off, p, source);
    spend(g, actionTime(g, off, "shot"), { shot: true, action: "shoot", actor: p });
    let d = defenderOf(g, p);
    const offR = eff(g, p, zone);
    const defKey = zone === "close" ? "intDef" : "perDef";
    let defR = eff(g, d, defKey);
    const O = T.openness, ow = { ...O.bySource[source][zone] };
    const gap = offR - defR;
    const HC = T.homeCourt, hEdge = hcEdge(g, off), hDefEdge = hcEdge(g, def);
    const oOpen = HC.openBonus * hEdge + oBonus(g, off, "open") + (zone === "close" ? oBonus(g, off, "openClose") : 0) + (zone === "three" ? oBonus(g, off, "openThree") : 0);
    ow.open *= exps(O.kOpen * gap + oOpen - offCost(g, off, "openPenalty", "logit")
      + (zone === "three" ? dBonus(g, def, "threeOpen") : 0) + (zone === "close" ? dBonus(g, def, "closeOpen") : 0) + dBonus(g, def, "open"))
      * (pos.kickout ? O.kickoutOpenMult : 1) * (pos.transition ? T.transition.openMult : 1);
    ow.contested *= exps(-O.kOpen * gap * 0.5);
    const openness = pick(g, ow, g.debug && `${zone} openness vs ${nm(g, d.id)}`);
    if (zone === "close" && openness === "contested" && T.shot.contestedCloseUsesCenter) {
      const c = teamCenter(g, def);
      if (c) { d = c; defR = eff(g, d, "intDef"); }
    }
    const F = T.foul;
    const fouled = chance(g, logit(F.shooting[zone][openness]) + F.kDraw * (offR - defR) * 0.5 + dBonus(g, def, "foul") + oBonus(g, off, "draw") - HC.foulLogit * hDefEdge + HC.foulLogit * hEdge * 0, "shooting foul");
    let blocked = false;
    if (!fouled) {
      const B = T.block;
      blocked = chance(g, logit(B.base[zone][openness]) + B.kBlock * (eff(g, d, "block") - offR) + B.kHeight * (d.height - p.height) + (zone === "close" ? dBonus(g, def, "blockClose") : 0), g.debug && `blocked by ${nm(g, d.id)}`);
    }
    let made = false;
    if (!blocked) {
      const Sh = T.shot;
      made = chance(g, logit(Sh.fgPct[zone][openness]) + Sh.kOff * (offR - 60) - Sh.kDef * (defR - 60) * Sh.contestFactor[openness] + (fouled ? Sh.fouledPenalty : 0) + HC.shotLogit * hEdge, g.debug && `${nm(g, p.id)} ${zone} ${openness} makes`);
    }
    const pts = zone === "three" ? 3 : 2;
    let assisted = null;
    p.stats.fga++; if (zone === "three") p.stats.tpa++;
    if (made) { p.stats.fgm++; p.stats.pts += pts; off.score += pts; if (zone === "three") p.stats.tpm++; assisted = creditAssist(g, pos, p); }
    if (blocked) d.stats.blk++;
    emit(g, "shot", { team: off.name, teamIdx: off.idx, player: p.name, defender: d.name, zone, openness, source, made, blocked, fouled, pts: made ? pts : 0, assistBy: assisted ? assisted.name : null, score: [g.teams[0].score, g.teams[1].score] });
    if (fouled) {
      addFoul(g, def, d);
      emit(g, "foul", { team: def.name, teamIdx: def.idx, player: d.name, on: p.name, kind: "shooting", andOne: made, teamFouls: def.fouls });
      pos.ft = { shooter: p.id, count: made ? 1 : pts, oneAndOne: false, andOne: made };
      return "freeThrows";
    }
    if (made) {
      // a rare fast break after a make (running teams): a quick inbound and go
      if (roll(g, clamp(T.transition.afterMakeBreak * paceOf(g, def), 0, 0.2), "fast break after the make")) {
        const h = chooseHandler(g, def);
        emit(g, "fastbreak", { team: def.name, teamIdx: def.idx, player: h.name });
        return endPossession(g, { toIdx: def.idx, player: h.id, transition: true, dead: true, shotClock: T.transition.breakShotClock });
      }
      return endPossession(g, { toIdx: def.idx });
    }
    pos.reb = { shooter: p.id, blocked, zone, ftMiss: false };
    return "rebound";
  };
  NODES.freeThrows = function (g, off, def, pos) {
    const T = g.T, ft = pos.ft, p = P(g, ft.shooter);
    let lastMade = false;
    const road = T.homeCourt.ftLogit * hcEdge(g, def);
    for (let i = 1; i <= ft.count; i++) {
      g.deadBall = true; handleSubs(g, p.id);   // every free throw is a dead ball: both benches can sub (not the shooter)
      p.stats.fta++;
      lastMade = chance(g, logit(T.ft.base) + T.ft.kSkill * (ftSkill(g, p) - 60) + road, g.debug && `${nm(g, p.id)} free throw ${i} of ${ft.count}`);
      if (lastMade) { p.stats.ftm++; p.stats.pts++; off.score++; }
      emit(g, "ft", { team: off.name, teamIdx: off.idx, player: p.name, made: lastMade, num: i, of: ft.count, score: [g.teams[0].score, g.teams[1].score] });
      if (ft.oneAndOne && i === 1 && !lastMade) break;
    }
    pos.ft = null;
    g.deadBall = false;   // a missed last free throw is live
    if (lastMade) return endPossession(g, { toIdx: def.idx });
    pos.reb = { shooter: p.id, blocked: false, zone: "close", ftMiss: true };
    return "rebound";
  };
  NODES.rebound = function (g, off, def, pos) {
    const R = g.T.rebound, ctx = pos.reb, w = {};
    for (const team of g.teams) {
      const isOff = team.idx === off.idx;
      for (const pl of onCourt(g, team)) {
        let v = R.pos[pl.pos] * exps(R.kReb * (eff(g, pl, "reb") - 60) + R.kHeight * (pl.height - 78));
        if (isOff) {
          v *= R.offTeamMult * offCost(g, team, "orebMult", "mult");
          if (pl.id === ctx.shooter) v *= R.shooterMult;
          if (ctx.ftMiss) v *= R.ftMissOffMult;
        } else {
          v *= defCostMult(g, team, "drebMult");
          if (ctx.blocked) v *= R.blockedDefMult;
        }
        w[pl.id] = v;
      }
    }
    const r = P(g, pick(g, w, "rebound"));
    const offensive = r.teamIdx === off.idx;
    emit(g, "rebound", { team: teamOf(g, r).name, teamIdx: r.teamIdx, player: r.name, offensive });
    if (offensive) {
      r.stats.oreb++;
      g.shotClock = Math.max(g.shotClock, g.T.clock.orebShotClock);
      Object.assign(pos, { player: r.id, catch: false, putback: true, kickout: false, assistBy: null, assistFresh: 1, transition: false, source: null, zone: null, forced: false, reb: null });
      return "possession";
    }
    r.stats.dreb++;
    const TR = g.T.transition, team = g.teams[r.teamIdx];
    // 1. stripped right back: his man's steal against his handling; the other team has it at the rim
    const man = defenderOf(g, r);
    if (man && chance(g, logit(TR.stripBase) + TR.kStrip * (eff(g, man, "steal") - eff(g, r, "handle")), g.debug && `${nm(g, man.id)} strips ${nm(g, r.id)} right back`)) {
      r.stats.tov++; man.stats.stl++;
      emit(g, "steal", { team: off.name, teamIdx: off.idx, player: man.name, victim: r.name, how: "board" });
      g.shotClock = g.T.clock.shotClock;   // a change of possession: a fresh shot clock
      Object.assign(pos, { player: man.id, catch: false, putback: true, kickout: false, assistBy: null, assistFresh: 1, transition: false, source: null, zone: null, forced: false, reb: null });
      return "possession";
    }
    // 2. a fast break: more off a missed shot, a running team, and a rebounder who can handle and pass
    let speed = 0;
    for (const m of onCourt(g, team)) speed = Math.max(speed, (eff(g, m, "handle") + m.ratings.stamina) / 2);
    const p = TR.breakBase * paceOf(g, team) * exps(TR.kBreakSpeed * (speed - 60)) * exps(TR.kRebounder * (playmaking(g, r) - 60)) * (ctx.ftMiss ? 1 : TR.missedShotBonus);
    if (chance(g, logit(clamp(p, 0.001, 0.95)), "fast break")) return goBreak(g, team, off, r);
    // 3. no break: next possession, usually with an easy pass to his best ball handler first
    return endPossession(g, { toIdx: def.idx, player: r.id, outlet: true, dead: false });
  };
  function startPeriod(g) {
    g.period++;
    const T = g.T;
    g.clock = g.period <= 2 ? T.clock.halfSeconds : T.clock.otSeconds;
    const jumpBall = () => {
      const jumpers = g.teams.map(t => teamCenter(g, t));
      const x = T.tip.kHeight * (jumpers[0].height - jumpers[1].height) + T.tip.kBlock * (jumpers[0].ratings.block - jumpers[1].ratings.block);
      const winner = chance(g, x, g.debug && `tip won by ${g.teams[0].abbr || g.teams[0].name}`) ? 0 : 1;
      return { winner, jumpers };
    };
    if (g.period === 1) {
      const { winner, jumpers } = jumpBall();
      g.firstPoss = g.offIdx = winner;
      emit(g, "tip", { team: g.teams[winner].name, teamIdx: winner, player: jumpers[winner].name, over: jumpers[1 - winner].name });
    } else if (g.period === 2) { g.offIdx = 1 - g.firstPoss; emit(g, "period_start", { period: 2, team: g.teams[g.offIdx].name }); }
    else { const { winner } = jumpBall(); g.offIdx = winner; emit(g, "period_start", { period: g.period, team: g.teams[winner].name, overtime: true }); }
    if (g.period === 2) g.teams.forEach(t => { t.fouls = 0; });
    if (g.period === 2 && T.fatigue.enabled) g.teams.forEach(t => t.players.forEach(p => { p.energy = clamp(p.energy + T.fatigue.halftimeRecover, 0, 1); }));
    endPossession(g, { toIdx: g.offIdx });
    g.run = { teamIdx: -1, pts: 0 };
  }
  function runPossession(g) {
    g.late = lateContext(g);
    trackRun(g); mediaTimeout(g);
    for (const t of g.teams) aiTimeout(g, t);
    handleSubs(g);
    for (const t of g.teams) if (t.buff > 0) t.buff--;
    const off = g.teams[g.offIdx], def = g.teams[1 - g.offIdx];
    const pos = g.pos;
    g.shotClock = pos.shotClock;
    g.late = lateContext(g);
    if (pos.bringUp && g.clock > 0) {
      pos.bringUp = false;
      let up = actionTime(g, off, pos.transition ? "transitionUp" : "bringUp");
      if (g.clock <= g.T.clock.pushUpBelow) up = Math.min(up, Math.max(2, g.clock - g.T.clock.buzzerShotAt));
      spend(g, up);
    }
    g.late = lateContext(g);
    if (g.debug) {
      const lm = g.late && (g.late.offMode || g.late.defFoul || g.late.huntThree) ? ` · late: ${[g.late.offMode, g.late.huntThree && "needs a three", g.late.defFoul && "defense fouling"].filter(Boolean).join(", ")}` : "";
      g.debug.push(`── ${off.abbr || off.name} ball · ${g.period <= 2 ? "H" + g.period : "OT" + (g.period - 2)} ${Math.floor(g.clock / 60)}:${String(Math.floor(g.clock % 60)).padStart(2, "0")} · shot clock ${Math.round(g.shotClock)} · ${g.teams[0].score}-${g.teams[1].score}${pos.transition ? " · transition" : ""}${lm}`);
    }
    let node = "possession", guard = 0;
    while (node && guard++ < 80) node = NODES[node](g, off, def, pos);
  }
  function advance(g) {
    if (g.over) return false;
    if (g.period === 0 || g.clock <= 0) {
      if (g.period >= 2 && g.clock <= 0 && g.teams[0].score !== g.teams[1].score) {
        g.over = true;
        emit(g, "end_game", { score: [g.teams[0].score, g.teams[1].score], teams: [g.teams[0].name, g.teams[1].name] });
        return false;
      }
      if (g.period > 0) emit(g, "period_end", { period: g.period, score: [g.teams[0].score, g.teams[1].score], teams: [g.teams[0].name, g.teams[1].name] });
      startPeriod(g);
    }
    runPossession(g);
    return true;
  }
  function simulateGame(g) { while (advance(g)) { } return g; }
  function boxScore(g) {
    return {
      score: [g.teams[0].score, g.teams[1].score],
      teams: g.teams.map(t => {
        const players = t.players.map(p => ({ id: p.id, name: p.name, num: p.num, pos: p.pos, ovr: p.ovr, min: Math.round(p.stats.sec / 60), ...p.stats,
          energy: p.energy, fouledOut: p.fouledOut, onCourt: t.onCourt.includes(p.id), starter: !!p.starter, target: t.rotation[p.id] || 0,
          archetype: p.archetype || "", wildcard: p.wildcard || null, height: p.height }));
        const totals = players.reduce((s, p) => { for (const k in emptyStats()) s[k] += p[k]; return s; }, emptyStats());
        return { name: t.name, mascot: t.mascot, abbr: t.abbr, color: t.color, coach: t.coach, players, totals, fouls: t.fouls, timeouts: t.timeouts, control: t.control, buff: t.buff, fit: styleFit(g, t.idx) };
      }),
      periods: g.period,
    };
  }
  function styleFit(g, teamIdx) {
    const team = g.teams[teamIdx];
    const label = (s) => s >= 1.05 ? "excellent" : s >= 0.85 ? "good" : s >= 0.62 ? "average" : s >= 0.45 ? "poor" : "terrible";
    const one = (style, scale) => {
      const F = style.fit;
      return { label: style.label, scale, grade: F ? label(scale) : "n/a", reads: F ? F.keys.join(" + ") + (F.mode === "avg" ? "" : " (" + F.mode + ")") : null, value: F ? Math.round(rosterValue(g, team, F)) : null };
    };
    const out = { offense: one(offStyle(g, team), fitOff(g, team)), defense: one(defStyle(g, team), fitDef(g, team)) };
    if (team.coach.offense === "iso") {
      const tg = isoTarget(g, team);
      out.offense.isoTarget = tg ? tg.name : null;
      out.offense.fallback = !isoTargetOnCourt(g, team);
    }
    return out;
  }
  function effRatings(g, player) {
    const p = typeof player === "string" ? g.byId[player] : player;
    const base = {}, now = {};
    for (const k of RATING_KEYS) { base[k] = p.ratings[k]; now[k] = Math.round(eff(g, p, k)); }
    base.stamina = now.stamina = p.ratings.stamina;
    return { base, now, ovr: p.ovr, effOvr: overall(g.T, p.pos, now), energy: p.energy, height: p.height };
  }
  const Engine = { createGame, advance, simulateGame, boxScore, makeRng, POS_ORDER, RATING_KEYS,
    callTimeout, canTimeout, substitute, setStyle, setControl, setRotation, setIsoTarget, setLateGame, lateContext, inFoulTrouble, crunchTime, elapsedFrac, effRatings, overall, styleFit };
  if (typeof module !== "undefined") module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
