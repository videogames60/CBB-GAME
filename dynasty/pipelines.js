/* =====================================================================
   HOOPS DYNASTY — PIPELINES
   A school's recruiting footprint: how established it is in each area of
   the map (geo.js). A pipeline is a strength 0–100 per area:

       Developing 20+   ·   Established 45+   ·   Strong 70+

   • Your HOME area (where the school is) always counts and never drops
     below a floor (higher for big programs). It doesn't use a slot.
   • Besides home, only your strongest few areas count: 2 slots, 3 with a
     60+ staff recruiting rating (coaches.js), 4 with 80+. Anything beyond fades fast.
   • Signing a kid from an area builds it (more for better kids, some for a
     transfer); every offseason everything fades a little. So a pipeline is
     earned by recruiting an area year after year.
   • In recruiting a pipeline is its own factor (see Recruiting.evaluate):
     it helps with every kid from that area, most with kids who care about
     staying close to home. It adds to the distance factor, so a school in
     Maine with a strong New York City pipeline can compete with the city's
     own schools there, and a city school with one gets a little extra.

   Every number lives in CFG.
   ===================================================================== */
(function (root) {
  const req = (typeof module !== "undefined" && typeof require !== "undefined");
  const Geo = req ? require("./geo.js") : root.Geo;
  /* the staff rating (50% head coach, 25% each assistant: coaches.js) */
  const staffR = (team, key) => { const C = req ? require("./coaches.js") : root.Coaches; return C ? C.rating(team, key) : (team.coach[key] ?? 50); };

  const CFG = {
    levels: [[70, "Strong", 1.0], [45, "Established", 0.67], [20, "Developing", 0.33]],   // [from strength, name, recruiting score]
    homeFloor: 50,                 // the home area never drops below this ...
    homeFloorPerPrestige: 0.4,     // ... plus this per prestige point above 50 (a 90 program: 66)
    slots: [[80, 4], [60, 3], [0, 2]],   // extra areas that count, by the coach's recruiting rating
    gain: { base: 8, perStar: 4, transfer: 10 },  // per signing from the area: 2★ 8, 3★ 12, 4★ 16, 5★ 20; a transfer 10
    cap: 100,
    fade: 0.88,                    // every offseason, counted pipelines keep this share ...
    fadeUnused: 0.6,               // ... and ones beyond your slots this share
    drop: 4,                       // below this it's gone
    start: {                       // a new league: a couple of pipelines near home, plus a far one for the biggest programs
      near: [1, 2],                // how many nearby areas (within "close" range)
      strength: [18, 45],          // their strength, plus prestige above 50 × 0.3
      blueBlood: 80,               // prestige from which a program also has one far-off big area
      farStrength: [30, 50],
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const homeArea = (team) => team.area || Geo.areaOf(team.city);
  const floorOf = (team) => clamp(Math.round(CFG.homeFloor + CFG.homeFloorPerPrestige * Math.max(0, (team.prestige || 50) - 50)), 0, CFG.cap);
  function slotsOf(team) { const r = team.coach ? staffR(team, "recruiting") : 50; for (const [min, n] of CFG.slots) if (r >= min) return n; return 2; }
  function levelOf(strength) {
    for (const [min, name, score] of CFG.levels) if (strength >= min) return { name, score, min };
    return { name: "None", score: 0, min: 0 };
  }
  function strengthIn(team, areaId) {
    const s = (team.pipelines && team.pipelines[areaId]) || 0;
    return areaId === homeArea(team) ? Math.max(s, floorOf(team)) : s;
  }
  /* the areas that count right now: home, plus the strongest few */
  function active(team) {
    const home = homeArea(team), P = team.pipelines || {};
    const extras = Object.keys(P).filter(a => a !== home && P[a] >= CFG.levels[CFG.levels.length - 1][0])
      .sort((a, b) => P[b] - P[a]).slice(0, slotsOf(team));
    return { home, extras };
  }
  /* the recruiting score (0–1) a school's pipeline gives with a kid from this area */
  function score(team, areaId) {
    if (!areaId) return 0;
    const { home, extras } = active(team);
    if (areaId !== home && !extras.includes(areaId)) return 0;
    return levelOf(strengthIn(team, areaId)).score;
  }
  /* for screens: every area this school has, strongest first */
  function describe(team) {
    const { home, extras } = active(team), P = team.pipelines || {};
    const row = (a, status) => ({ area: a, name: (Geo.AREA[a] || {}).name || a, strength: Math.round(strengthIn(team, a)), level: levelOf(strengthIn(team, a)).name, status });
    const rows = [row(home, "home"), ...extras.map(a => row(a, "active"))];
    for (const a of Object.keys(P).sort((x, y) => P[y] - P[x])) if (a !== home && !extras.includes(a) && P[a] >= CFG.drop) rows.push(row(a, "fading"));
    return { rows, slots: slotsOf(team), used: extras.length, floor: floorOf(team) };
  }

  /* a new league's starting footprints */
  function init(lg, rand) {
    const S = CFG.start;
    for (const t of lg.teams) {
      if (t.pipelines && Object.keys(t.pipelines).length && !t.pipelines.__seed) continue;   // given by a league file
      t.area = Geo.areaOf(t.city);
      const P = t.pipelines = { [t.area]: floorOf(t) };
      const city = Geo.CITY[t.city];
      const near = Geo.AREAS.filter(a => a.id !== t.area && city && Geo.miles(city, a) <= Geo.CFG.miles.close);
      const n = Math.min(slotsOf(t), S.near[0] + Math.floor(rand() * (S.near[1] - S.near[0] + 1)));
      const bonus = Math.max(0, t.prestige - 50) * 0.3;
      for (let i = 0; i < n && near.length; i++) {
        const a = pick(rand, near, x => x.talent);
        near.splice(near.indexOf(a), 1);
        P[a.id] = Math.round(clamp(S.strength[0] + rand() * (S.strength[1] - S.strength[0]) + bonus, 0, CFG.cap));
      }
      if (t.prestige >= S.blueBlood) {
        const far = Geo.AREAS.filter(a => !P[a.id] && a.talent >= 20 && city && Geo.miles(city, a) > Geo.CFG.miles.close);
        if (far.length) { const a = pick(rand, far, x => x.talent); P[a.id] = Math.round(S.farStrength[0] + rand() * (S.farStrength[1] - S.farStrength[0])); }
      }
    }
  }
  function pick(rand, list, w) {
    let total = 0; for (const x of list) total += w(x);
    let r = rand() * total;
    for (const x of list) if ((r -= w(x)) <= 0) return x;
    return list[list.length - 1];
  }

  /* Once a year (the offseason, when the new class and transfers arrive):
     signings build their areas, then everything fades. signings:
     [{ teamId, area, stars, transfer }] */
  function yearEnd(lg, signings) {
    const G = CFG.gain, gained = {};
    for (const s of signings) {
      const t = lg.byId[s.teamId]; if (!t || !s.area) continue;
      t.pipelines = t.pipelines || {};
      const add = s.transfer ? G.transfer : G.base + G.perStar * Math.max(0, (s.stars || 2) - 2);
      t.pipelines[s.area] = Math.min(CFG.cap, (t.pipelines[s.area] || 0) + add);
      (gained[t.id] = gained[t.id] || {})[s.area] = ((gained[t.id] || {})[s.area] || 0) + add;
    }
    for (const t of lg.teams) {
      const P = t.pipelines = t.pipelines || {};
      const { home, extras } = active(t);
      for (const a of Object.keys(P)) {
        const keep = a === home || extras.includes(a) ? CFG.fade : CFG.fadeUnused;
        P[a] = Math.round(P[a] * keep * 10) / 10;
        if (a === home) P[a] = Math.max(P[a], floorOf(t));
        else if (P[a] < CFG.drop) delete P[a];
      }
    }
    return gained;
  }

  const Pipelines = { CFG, levelOf, strengthIn, slotsOf, floorOf, active, score, describe, init, yearEnd, homeArea };
  if (typeof module !== "undefined") module.exports = Pipelines;
  else root.Pipelines = Pipelines;
})(typeof window !== "undefined" ? window : globalThis);
