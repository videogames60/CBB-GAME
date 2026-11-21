/* HOOPS DYNASTY UI — the Map tab.
   One SVG of the US (ui/us_map.js outlines, Geo.project for points), drawn
   in layers you can switch: pipeline areas shaded by level, the 150/500-mile
   rings around a campus, recruits (your board by status, or the whole
   class), every school, your roster's hometowns. Click a school to see its
   footprint; click a recruit to open his card. */
let MAPV = { focus: null, zoom: "all", layers: { pipes: true, rings: true, board: true, cls: false, schools: true, roster: false } };

const MAP_COLORS = {
  Strong: "rgba(228,185,63,.62)", Established: "rgba(228,185,63,.38)", Developing: "rgba(228,185,63,.18)", None: "rgba(228,185,63,.08)",
  mine: "#5BB07F", offer: "#E4B93F", watch: "#EEE9DD", elsewhere: "#6b7686", cls: "rgba(170,186,208,.75)",
  tier: { 1: "#d96aa0", 2: "#5B9BD5", 3: "#9b7fd1", 4: "#8a96a6" },   // schools are diamonds in these; recruits are circles
};
const mapXY = (key) => { const c = Geo.CITY[key]; return c ? Geo.project(c.lat, c.lon) : null; };
/* several dots in one city: spread them a little, the same way every time */
function jitter(id, xy, amount = 5){
  let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = ((h >>> 0) % 360) * Math.PI / 180, r = ((h >>> 9) % 100) / 100 * amount;
  return [xy[0] + Math.cos(a) * r, xy[1] + Math.sin(a) * r];
}

/* which areas are a whole state (shade the state) and which share a state (draw a shape around their cities) */
let MAP_AREA_SHAPES = null;
function areaShapes(){
  if (MAP_AREA_SHAPES) return MAP_AREA_SHAPES;
  const statesOfArea = {}, areasOfState = {};
  for (const c of Object.values(Geo.CITY)) {
    (statesOfArea[c.area] = statesOfArea[c.area] || new Set()).add(c.state);
    (areasOfState[c.state] = areasOfState[c.state] || new Set()).add(c.area);
  }
  const shapes = {};
  for (const a of Geo.AREAS) {
    const st = [...(statesOfArea[a.id] || [])];
    if (st.length === 1 && areasOfState[st[0]].size === 1) { const s = US_MAP.states.find(x => x.id === st[0]); if (s) { shapes[a.id] = { d: s.d }; continue; } }
    const pts = Geo.CITIES_IN[a.id].map(c => Geo.project(c.lat, c.lon));
    shapes[a.id] = { hull: hull(pts) };
  }
  return (MAP_AREA_SHAPES = shapes);
}
/* convex hull (monotone chain) */
function hull(pts){
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const ptsPath = (pts) => pts.length ? "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z" : "";
function areaSvg(areaId, fill, stroke, dash){
  const sh = areaShapes()[areaId]; if (!sh) return "";
  const st = stroke ? ` stroke="${stroke}" stroke-width="1.6"${dash ? ` stroke-dasharray="${dash}"` : ""}` : "";
  if (sh.d) return `<path d="${sh.d}" fill="${fill}"${st}/>`;
  // a shape around the area's cities, padded with a wide round stroke in the same color
  const d = sh.hull.length >= 3 ? ptsPath(sh.hull) : sh.hull.length === 2 ? `M${sh.hull[0].join(",")}L${sh.hull[1].join(",")}` : "";
  const dot = sh.hull.length === 1 ? `<circle cx="${sh.hull[0][0]}" cy="${sh.hull[0][1]}" r="11" fill="${fill}"${st}/>` : "";
  return dot || `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>` + (stroke ? `<path d="${d}" fill="none"${st}/>` : "");
}
function ringSvg(cityKey, miles, label){
  const c = Geo.CITY[cityKey]; if (!c) return "";
  const pts = []; for (let b = 0; b < 360; b += 5) { const q = Geo.destination(c, miles, b); pts.push(Geo.project(q.lat, q.lon)); }
  const top = pts[0];
  return `<path d="${ptsPath(pts)}" fill="none" stroke="var(--ink)" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="5 4"/>
    <text x="${top[0] + 4}" y="${top[1] + 11}" class="mapLbl">${label}</text>`;
}

function mapFocus(id){ MAPV.focus = id; render(); }
function mapLayer(k, on){ MAPV.layers[k] = on; render(); }
function mapZoom(z){ MAPV.zoom = z; render(); }

function vMap(){
  const me_ = me(), focus = LG.byId[MAPV.focus] || me_, L = MAPV.layers, R = LG.recruiting;
  const W = US_MAP.width, H = US_MAP.height;
  // zoom: the whole country, or about 1,100 miles across around the campus
  let vb = `0 0 ${W} ${H}`;
  const fxy = mapXY(focus.city);
  if (MAPV.zoom === "near" && fxy) { const w = W / 2.6, h = H / 2.6; vb = `${(fxy[0] - w / 2).toFixed(0)} ${(fxy[1] - h / 2).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`; }
  const zs = MAPV.zoom === "near" ? 0.5 : 1;   // dots shrink when zoomed in
  let svg = `<svg viewBox="${vb}" class="usmap" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<g>${US_MAP.states.map(s => `<path d="${s.d}" class="st"><title>${s.name}</title></path>`).join("")}</g>`;

  // pipelines of the focused school
  const P = Pipelines.describe(focus);
  if (L.pipes) svg += `<g>${P.rows.slice().reverse().map(r => areaSvg(r.area, MAP_COLORS[r.level] || MAP_COLORS.None, r.status === "home" ? "var(--gold)" : null, r.status === "home" ? "4 3" : null)).join("")}</g>`;
  if (L.rings && focus.city) svg += ringSvg(focus.city, Geo.CFG.miles.close, `${Geo.CFG.miles.close} mi`) + ringSvg(focus.city, Geo.CFG.miles.home, `${Geo.CFG.miles.home}`);

  // the whole class, faint
  if (L.cls && R) svg += `<g>${R.pool.map(r => { const xy = mapXY(r.home); if (!xy) return ""; const [x, y] = jitter(r.id, xy, 6);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((1.4 + r.stars * 0.55) * (MAPV.zoom === "near" ? 0.65 : 1)).toFixed(1)}" fill="${MAP_COLORS.cls}"><title>${r.stars}★ #${r.rank} ${r.name} · ${Geo.label(r.home)}</title></circle>`; }).join("")}</g>`;

  // schools
  if (L.schools) svg += `<g>${LG.teams.map(t => { const xy = mapXY(t.city); if (!xy) return ""; const [x, y] = jitter(t.id, xy, 3);
      const c = conf(t.conf), mine = t.isUser, foc = t.id === focus.id;
      const r = (mine ? 7.5 : foc ? 7 : 4.6) * (MAPV.zoom === "near" ? 0.6 : 1);
      const pts = `${x.toFixed(1)},${(y - r).toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + r).toFixed(1)} ${(x - r).toFixed(1)},${y.toFixed(1)}`;
      return `<polygon points="${pts}" fill="${mine ? "var(--gold)" : MAP_COLORS.tier[c.tier] || "#888"}" stroke="${foc ? "var(--ink)" : "rgba(0,0,0,.55)"}" stroke-width="${foc ? 2 : 0.8}" class="pt" onclick="mapFocus('${t.id}')">
        <title>${t.name} ${t.mascot} · ${c.name} · ${Geo.label(t.city)} · prestige ${League.grade(t.prestige)}</title></polygon>`; }).join("")}</g>`;

  // your roster's hometowns
  if (L.roster) svg += `<g>${me_.players.map(p => { const xy = mapXY(p.home); if (!xy) return ""; const [x, y] = jitter(p.id, xy, 5), s = 4.2 * zs;
      return `<rect x="${(x - s).toFixed(1)}" y="${(y - s).toFixed(1)}" width="${2 * s}" height="${2 * s}" fill="#5B9BD5" stroke="#101820" stroke-width=".8"><title>${p.name} (${League.classLabel(p)} ${p.pos}) · ${Geo.label(p.home)}</title></rect>`; }).join("")}</g>`;

  // your board: offered, watched, signed with you, gone elsewhere
  const board = R ? R.pool.filter(r => { const it = r.interest[me_.id]; return (it && (it.offer || it.watch || it.rel > 0)) || (r.status === "committed" && r.commitTo === me_.id); }) : [];
  const statusOf = (r) => r.status === "committed" ? (r.commitTo === me_.id ? "mine" : "elsewhere") : (r.interest[me_.id] && r.interest[me_.id].offer) ? "offer" : "watch";
  if (L.board) svg += `<g>${board.map(r => { const xy = mapXY(r.home); if (!xy) return ""; const [x, y] = jitter(r.id, xy, 6), st = statusOf(r);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(5.2 * zs).toFixed(1)}" fill="${MAP_COLORS[st]}" stroke="#101820" stroke-width="1.2" class="pt" onclick="openRecruit('${r.id}')">
        <title>${r.stars}★ #${r.rank} ${r.name} (${r.pos}) · ${Geo.label(r.home)} · ${Math.round(Geo.miles(me_.city, r.home))} mi · ${st === "mine" ? "signed with you" : st === "elsewhere" ? "committed to " + LG.byId[r.commitTo].abbr : st === "offer" ? "you've offered" : "on your board"}</title></circle>`; }).join("")}</g>`;
  if (fxy) svg += `<text x="${fxy[0] + 9}" y="${fxy[1] - 7}" class="mapLbl strong">${focus.abbr}</text>`;
  svg += `</svg>`;

  // side panel: the focused school, its pipelines, your board by distance
  const lvl = { home: 0, close: 0, far: 0 }; let inPipe = 0;
  for (const r of board.filter(r => r.status === "open")) { lvl[Geo.level(Geo.miles(me_.city, r.home))]++; if (Pipelines.score(me_, Geo.areaOf(r.home)) > 0) inPipe++; }
  const signed = R ? R.pool.filter(r => r.status === "committed" && r.commitTo === me_.id) : [];
  const box = (k, label) => `<label class="tg"><input type="checkbox" ${L[k] ? "checked" : ""} onchange="mapLayer('${k}',this.checked)"> ${label}</label>`;
  const sw = (c, l, sq) => `<span class="lg"><span class="sw" style="background:${c};${sq ? "" : "border-radius:50%"}"></span>${l}</span>`;
  const c = conf(focus.conf);
  return `<div class="mapWrap">
    <div class="card mapCard">
      <div class="filters" style="margin-bottom:6px">
        <button class="quiet ${MAPV.zoom === "all" ? "on" : ""}" onclick="mapZoom('all')">Country</button>
        <button class="quiet ${MAPV.zoom === "near" ? "on" : ""}" onclick="mapZoom('near')">Around ${focus.abbr}</button>
        ${focus.id !== me_.id ? `<button class="quiet" onclick="mapFocus('${me_.id}')">Back to ${me_.abbr}</button>` : ""}
        <span style="margin-left:auto" class="row">${box("pipes", "Pipelines")}${box("rings", "Distance rings")}${box("board", "Your board")}${box("cls", "Whole class")}${box("schools", "Schools")}${box("roster", "Your roster's hometowns")}</span>
      </div>
      ${svg}
      <div class="legend mapLegend">
        ${L.pipes ? sw(MAP_COLORS.Strong, "Strong", 1) + sw(MAP_COLORS.Established, "Established", 1) + sw(MAP_COLORS.Developing, "Developing", 1) : ""}
        ${L.board ? sw(MAP_COLORS.mine, "signed with you") + sw(MAP_COLORS.offer, "offered") + sw(MAP_COLORS.watch, "on your board") + sw(MAP_COLORS.elsewhere, "went elsewhere") : ""}
        ${L.schools ? [1, 2, 3, 4].filter(t => LG.conferences.some(x => x.tier === t)).map(t => `<span class="lg"><span class="sw" style="background:${MAP_COLORS.tier[t]};transform:rotate(45deg) scale(.8)"></span>tier ${t} school</span>`).join("") + `<span class="lg"><span class="sw" style="background:var(--gold);transform:rotate(45deg) scale(.8)"></span>your school</span>` : ""}
        ${L.cls ? sw(MAP_COLORS.cls, "recruit in the class (bigger = more stars)") : ""}
        ${L.roster ? sw("#5B9BD5", "your player's hometown", 1) : ""}
      </div>
      <p class="hint" style="margin:4px 0 0">Click a school to see its footprint, a recruit to open his card. Hover anything for details.</p>
    </div>
    <div>
      <div class="card"><h2>${focus.isUser ? "Your program" : "School"}</h2>
        <div style="font-size:16px;font-weight:700">${focus.name} ${focus.mascot}</div>
        <div class="hint" style="margin:2px 0 8px">${Geo.label(focus.city)} · ${c.name} · prestige ${League.grade(focus.prestige)} · coach ${focus.coach.name} (staff recruiting ${Coaches.rating(focus,"recruiting")})</div>
        <div class="sect">Pipelines — ${P.used} of ${P.slots} slots</div>
        ${P.rows.map(r => `<div class="res"><span class="sc">${r.strength}</span><span>${r.name}${r.status === "home" ? ` <span class="pill">home</span>` : r.status === "fading" ? ` <span class="hint">fading</span>` : ""}</span><span class="sc">${r.level}</span></div>`).join("")}
      </div>
      ${R ? `<div class="card"><h2>Your recruiting map</h2>
        <div class="res"><span class="sc">${lvl.home}</span><span>on your board within ${Geo.CFG.miles.home} mi (home)</span><span></span></div>
        <div class="res"><span class="sc">${lvl.close}</span><span>within ${Geo.CFG.miles.close} mi (close)</span><span></span></div>
        <div class="res"><span class="sc">${lvl.far}</span><span>farther</span><span></span></div>
        <div class="res"><span class="sc">${inPipe}</span><span>from your pipeline areas</span><span></span></div>
        ${signed.length ? `<div class="sect" style="margin-top:8px">Signed so far</div>${signed.map(r => `<div class="res"><span class="sc">${r.stars}★</span><span>${r.name} · ${Geo.label(r.home)}</span><span class="sc">${Math.round(Geo.miles(me_.city, r.home))} mi</span></div>`).join("")}` : ""}
      </div>` : ""}
    </div>
  </div>`;
}
