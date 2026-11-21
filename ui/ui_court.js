/* HOOPS DYNASTY UI — the court view in the live game.
   A half court (the team with the ball always attacks the basket at the top)
   with the ten players on the floor: the offense as solid circles on standard
   spots, each defender a step off his man toward the basket (matched by
   position, the same way the engine matches them). The ball follows the
   play-by-play as it's revealed: passes, shots, free throws, rebounds,
   steals and turnovers; possession changes flip the colors.

   It reads the same events as the play-by-play (ui_live.js calls courtEvent
   for each one as it appears, and courtSync after a jump), so it never runs
   ahead of what you've seen. Players are found by name within their team's
   five on the floor. Tap a player for his card. */
const COURT = { on: true, off: 0, ball: null, lineup: [[], []], shot: null, flash: "", flashCls: "", anim: true };
try { const v = localStorage.getItem("hoopsDynasty.court"); if (v === "0") COURT.on = false; } catch (e) {}
const CT = {
  W: 500, H: 470, rim: { x: 250, y: 52 },
  // offensive spots in position order (PG, SG, SF, PF, C)
  spots: [{ x: 250, y: 340 }, { x: 425, y: 245 }, { x: 75, y: 245 }, { x: 140, y: 118 }, { x: 345, y: 104 }],
  ft: { x: 250, y: 205 },
};
const POS_RANK = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
function courtToggle() {
  COURT.on = !COURT.on;
  try { localStorage.setItem("hoopsDynasty.court", COURT.on ? "1" : "0"); } catch (e) {}
  courtRender(false);
}
/* lineups and possession straight from the game (after a jump: Possession, Sim to end, a sub) */
function courtSync() {
  if (!G) return;
  COURT.lineup = G.teams.map(t => t.onCourt.slice());
  COURT.off = G.over ? COURT.off : G.offIdx;
  const pl = G.pos && G.pos.player;
  COURT.ball = pl && G.teams[COURT.off].onCourt.includes(pl) ? pl : courtHandler(COURT.off);   // a new possession: his best ball handler until the next play names someone
  COURT.shot = null; COURT.flash = "";
  courtPlace(); courtRender(false);
}
/* phones: the court goes right under the scoreboard; wider screens: top of the middle column */
function courtPlace() {
  const c = $("gCourtWrap"); if (!c) return;
  const phone = window.matchMedia && window.matchMedia("(max-width:640px)").matches;
  const want = phone ? $("gBoard") : null;
  if (phone) { if (c.previousElementSibling !== want) want.after(c); }
  else { const mid = document.querySelector(".gmid"); if (mid && mid.firstElementChild !== c) mid.prepend(c); }
}
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(max-width:640px)");
  (mq.addEventListener ? mq.addEventListener("change", courtPlace) : mq.addListener(courtPlace));
}
function courtStart() { COURT.lineup = G.teams.map(t => t.onCourt.slice()); COURT.off = 0; COURT.ball = null; COURT.shot = null; COURT.flash = ""; courtPlace(); courtRender(false); }
/* find a player by name among the five on the floor for a team */
function courtFind(teamIdx, name) {
  if (teamIdx == null || !name) return null;
  const id = COURT.lineup[teamIdx].find(i => G.byId[i] && G.byId[i].name === name);
  return id || null;
}
const teamIdxByName = (n) => G.teams.findIndex(t => t.name === n);
/* the other team gets it (after a make or a dead-ball turnover). The engine only picks who
   brings it up when the next possession starts (at random, weighted to handling + passing),
   so until the next play names him, the ball goes to the five's best ball handler. */
function courtFlip(to) { COURT.off = to; COURT.ball = courtHandler(to); COURT.shot = null; }
function courtHandler(ti) {
  const five = COURT.lineup[ti].map(id => G.byId[id]).filter(Boolean);
  if (!five.length) return null;
  return five.reduce((a, b) => (b.ratings.handle + b.ratings.pass > a.ratings.handle + a.ratings.pass ? b : a)).id;
}
function courtEvent(e, animate) {
  if (!G || !e) return;
  const ti = e.teamIdx;
  COURT.shot = null; COURT.flash = "";
  switch (e.type) {
    case "tip": COURT.off = ti; COURT.ball = courtFind(ti, e.player); break;
    case "period_start": { const i = teamIdxByName(e.team); if (i >= 0) courtFlip(i); break; }
    case "sub": {
      const L = COURT.lineup[ti], k = L.indexOf(e.outId);
      if (k >= 0) L[k] = e.inId; else if (!L.includes(e.inId)) L.push(e.inId);
      if (COURT.ball === e.outId) COURT.ball = e.inId;
      break;
    }
    case "pass": if (ti !== COURT.off) COURT.off = ti; COURT.ball = courtFind(ti, e.to) || COURT.ball; break;
    case "fastbreak": COURT.off = ti; COURT.ball = courtFind(ti, e.player) || COURT.ball; break;
    case "shot": {
      if (ti !== COURT.off) COURT.off = ti;
      const id = courtFind(ti, e.player); COURT.ball = id;
      COURT.shot = { id, zone: e.zone };
      COURT.flash = e.blocked ? "BLOCKED" : e.made ? (e.zone === "three" ? "THREE!" : "GOOD") : "MISS";
      COURT.flashCls = e.made ? "make" : "miss";
      courtRender(animate);
      if (e.made && !e.fouled) setTimeout(() => { if (G && COURT.shot && COURT.shot.id === id) { courtFlip(1 - ti); COURT.flash = ""; courtRender(animate); } }, courtMs() * 1.4);
      return;
    }
    case "ft": {
      if (ti !== COURT.off) COURT.off = ti;
      const id = courtFind(ti, e.player); COURT.ball = id; COURT.shot = { id, zone: "ft" };
      COURT.flash = e.made ? "FT GOOD" : "FT MISS"; COURT.flashCls = e.made ? "make" : "miss";
      courtRender(animate);
      if (e.made && e.num === e.of) setTimeout(() => { if (G && COURT.shot && COURT.shot.id === id) { courtFlip(1 - ti); COURT.flash = ""; courtRender(animate); } }, courtMs() * 1.4);
      return;
    }
    case "rebound": COURT.off = ti; COURT.ball = courtFind(ti, e.player); if (!e.offensive) COURT.flash = ""; break;
    case "steal": COURT.off = ti; COURT.ball = courtFind(ti, e.player); COURT.flash = "STEAL"; COURT.flashCls = "miss"; break;
    case "turnover": courtFlip(1 - ti); COURT.flash = "TURNOVER"; COURT.flashCls = "miss"; break;
    case "end_game": COURT.ball = null; break;
    default: break;
  }
  courtRender(animate);
}
/* how long a move takes, from the live game's speed (ui_live.js) */
const courtMs = () => Math.max(120, Math.min(450, 0.6 * 650 / (typeof gSpeedV === "number" ? gSpeedV : 2)));
/* a team's five in position order (the engine's matchup order) */
function courtOrder(ti) {
  return COURT.lineup[ti].map(id => G.byId[id]).filter(Boolean)
    .sort((a, b) => (POS_RANK[a.pos] ?? 9) - (POS_RANK[b.pos] ?? 9)).map(p => p.id);
}
function courtSpot(i, id) {
  const base = CT.spots[i] || CT.spots[0];
  if (!COURT.shot || COURT.shot.id !== id) return base;
  const z = COURT.shot.zone;
  if (z === "ft") return CT.ft;
  const dx = base.x - CT.rim.x, dy = base.y - CT.rim.y, d = Math.hypot(dx, dy) || 1;
  const r = z === "three" ? 236 : z === "mid" ? 150 : 34;
  return { x: CT.rim.x + dx / d * r, y: CT.rim.y + Math.max(8, dy / d * r) };
}
function courtRender(animate) {
  const box = $("gCourt"); if (!box) return;
  const btn = $("gCourtBtn"); if (btn) btn.classList.toggle("on", COURT.on);
  $("gCourtWrap").style.display = COURT.on ? "" : "none";
  if (!COURT.on || !G) return;
  const off = COURT.off, def = 1 - off;
  const O = courtOrder(off), D = courtOrder(def);
  const ms = animate ? courtMs() : 0;
  const tO = G.teams[off], tD = G.teams[def];
  const pos = {};
  O.forEach((id, i) => { pos[id] = courtSpot(i, id); });
  D.forEach((id, i) => {   // a step off his man, toward the basket, a little to the inside
    const m = pos[O[i]] || CT.spots[i];
    pos[id] = { x: m.x + (CT.rim.x - m.x) * 0.22 + (m.x < CT.rim.x ? 10 : -10), y: m.y + (CT.rim.y - m.y) * 0.22 };
  });
  const ballAt = COURT.shot && COURT.flash && (COURT.flashCls === "make" || COURT.flash === "MISS" || COURT.flash === "FT MISS") ? { x: CT.rim.x, y: CT.rim.y + 4 }
    : COURT.ball && pos[COURT.ball] ? { x: pos[COURT.ball].x + 15, y: pos[COURT.ball].y - 13 } : { x: CT.rim.x, y: CT.H - 30 };
  if (!box.querySelector("svg")) box.innerHTML = courtSvg();
  const svg = box.querySelector("svg");
  // players: keep one <g> per player id so CSS transitions can move them
  const layer = svg.querySelector(".pl"), seen = new Set();
  const draw = (id, isOff, team) => {
    const p = G.byId[id]; if (!p) return;
    seen.add(id);
    let g = layer.querySelector(`[data-id="${id}"]`);
    if (!g) {
      g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("data-id", id); g.setAttribute("class", "cp");
      g.innerHTML = `<circle r="17"></circle><text dy="5"></text>`;
      g.onclick = () => openCard(id);
      g.style.transform = `translate(${pos[id].x}px,${pos[id].y}px)`;
      layer.appendChild(g);
    }
    g.style.transition = ms ? `transform ${ms}ms ease` : "none";
    g.style.transform = `translate(${pos[id].x}px,${pos[id].y}px)`;
    const c = g.querySelector("circle");
    c.setAttribute("fill", isOff ? team.color : "#101820");
    c.setAttribute("stroke", isOff ? (id === COURT.ball ? "#fff" : "rgba(0,0,0,.45)") : team.color);
    c.setAttribute("stroke-width", isOff ? (id === COURT.ball ? 3 : 1.5) : 3);
    const tx = g.querySelector("text"); tx.textContent = p.num != null ? p.num : p.name.split(" ").pop().slice(0, 3);
    tx.setAttribute("class", isOff ? "on" : "d");
    g.querySelector("title")?.remove();
    const ttl = document.createElementNS("http://www.w3.org/2000/svg", "title"); ttl.textContent = `${p.name} (${p.pos}) — ${team.abbr}`; g.appendChild(ttl);
  };
  O.forEach(id => draw(id, true, tO)); D.forEach(id => draw(id, false, tD));
  layer.querySelectorAll(".cp").forEach(g => { if (!seen.has(g.getAttribute("data-id"))) g.remove(); });
  const ball = svg.querySelector(".ball");
  ball.style.transition = ms ? `transform ${ms}ms ease` : "none";
  ball.style.transform = `translate(${ballAt.x}px,${ballAt.y}px)`;
  const fl = svg.querySelector(".flash");
  fl.textContent = COURT.flash || ""; fl.setAttribute("class", "flash " + (COURT.flashCls || ""));
  // the caption: who has it, who's guarding him
  const h = COURT.ball && G.byId[COURT.ball];
  const di = h ? O.indexOf(h.id) : -1, dg = di >= 0 && D[di] ? G.byId[D[di]] : null;
  const nm = (p) => `${p.num != null ? "#" + p.num + " " : ""}${p.name.split(" ").pop()}`;
  $("gCourtCap").innerHTML = h ? `<span class="dot" style="background:${tO.color}"></span><b>${tO.abbr}</b> ball · ${nm(h)} <span class="hint">(${h.pos})</span>${dg ? ` <span class="hint">guarded by</span> ${nm(dg)}` : ""}`
    : `<span class="dot" style="background:${tO.color}"></span><b>${tO.abbr}</b> ball`;
}
/* the half court (NCAA, 10 units a foot: 50 ft wide, 47 ft deep; the rim 5.25 ft from the baseline) */
function courtSvg() {
  const { W, H, rim } = CT;
  const arc = 221;   // three-point line, 22 ft 1.75 in
  const cornerY = rim.y + Math.sqrt(arc * arc - (W / 2 - 34) ** 2);   // where the arc meets the corner lines (3 ft 4 in from the sideline)
  return `<svg viewBox="0 0 ${W} ${H}" class="courtSvg" role="img" aria-label="Court view">
    <rect x="0" y="0" width="${W}" height="${H}" class="floor"/>
    <g class="lines">
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}"/>
      <rect x="190" y="2" width="120" height="190"/>
      <circle cx="250" cy="190" r="60"/>
      <path d="M 34 2 L 34 ${cornerY} A ${arc} ${arc} 0 0 0 ${W - 34} ${cornerY} L ${W - 34} 2"/>
      <path d="M 190 ${H - 2} A 60 60 0 0 1 310 ${H - 2}"/>
      <path d="M 210 52 A 40 40 0 0 0 290 52"/>
      <line x1="220" y1="40" x2="280" y2="40" class="board"/>
    </g>
    <circle cx="${rim.x}" cy="${rim.y}" r="9" class="rim"/>
    <g class="pl"></g>
    <circle r="7" class="ball"/>
    <text x="250" y="150" class="flash"></text>
  </svg>`;
}
