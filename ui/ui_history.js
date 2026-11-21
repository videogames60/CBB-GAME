/* HOOPS DYNASTY UI — the History tab: a program's history (yours or any
   school's), the league year by year, the record book, the Hall of Fame. */
const HISTV = { view: "program", team: null, recs: "game" };
const histTeam = () => (HISTV.team && LG.byId[HISTV.team]) || me();
const POSTRANK = (label) => /National champion/.test(label) ? 5 : /Runner-up/.test(label) ? 4 : /Semifinal/.test(label) ? 3 : /Tournament/.test(label) ? 1 : 0;

function vHistory(){
  const nav = [["program","Program"],["league","League"],["records","Record book"],["hof",`Hall of Fame${LG.hof?` (${LG.hof.players.length+LG.hof.coaches.length})`:""}`]];
  const top = `<div class="row" style="margin-bottom:10px">${nav.map(([k,l])=>`<button class="quiet ${HISTV.view===k?"on":""}" onclick="HISTV.view='${k}';render()">${l}</button>`).join("")}</div>`;
  return top + ({ program: vHistProgram, league: vHistLeague, records: vHistRecords, hof: vHistHof })[HISTV.view]();
}

/* ---------- one program ---------- */
function vHistProgram(){
  const t = histTeam(), H = t.history;
  const pick = `<select style="margin-left:8px" onchange="HISTV.team=this.value;render()">
    ${[...LG.teams].sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${x.id}" ${x.id===t.id?"selected":""}>${x.name}${x.isUser?" (you)":""}</option>`).join("")}</select>`;
  if (!H.length) return `<div class="card"><h2>${t.name} ${pick}</h2><p class="hint">History builds up season by season.</p></div>`;
  const w = H.reduce((a,h)=>a+h.w,0), l = H.reduce((a,h)=>a+h.l,0);
  const n = (re) => H.filter(h => re.test(h.postseason||"")).length;
  const picks = Draft.teamPicks(LG, t.id);
  const big = (v, lbl) => `<div><div class="big">${v}</div><div class="hint">${lbl}</div></div>`;
  // coaches, in order
  const coaches = [];
  for (const h of H) { const c = coaches[coaches.length-1]; if (c && c.name === h.coach) { c.to = h.year; c.w += h.w; c.l += h.l; } else coaches.push({ name: h.coach, from: h.year, to: h.year, w: h.w, l: h.l }); }
  // the best players who played here (archived careers)
  const greats = (LG.archive ? LG.archive.players : []).filter(x => x.schools.includes(t.abbr))
    .map(x => ({ x, aw: Awards.unpackAwards(x.awards), score: hofLite(x) })).sort((a,b) => b.score - a.score).slice(0, 12);
  const ser = Awards.seriesFor(LG, t.id).slice(0, 10);
  return `<div class="card"><h2>${t.name} ${t.mascot} ${pick}</h2>
      <div class="row" style="gap:24px;margin:4px 0 4px">
        ${big(`${w}-${l}`, `${H.length} season${H.length===1?"":"s"} (${(w/Math.max(1,w+l)).toFixed(3).slice(1)})`)}
        ${big(n(/National champion/), "national titles")}${big(n(/National champion|Runner-up/), "title games")}${big(n(/National champion|Runner-up|Semifinal/), "Final Fours")}
        ${big(n(/champion|Runner-up|Semifinal|Tournament/), "tournaments")}${big(H.filter(h=>h.ap&&h.ap<=25).length, "AP top-25 finishes")}
        ${big(picks.length, `draft picks (${picks.filter(x=>x.round===1).length} 1st round)`)}
      </div></div>
    <div class="g"><div class="card"><h2>Year by year</h2>
      <table><thead><tr><th>Year</th><th>Record</th><th>Conf</th><th>AP</th><th class="l">Postseason</th><th>Prestige</th><th class="l">Coach</th></tr></thead><tbody>
      ${[...H].reverse().map(h=>`<tr><td>${yrs(h.year)}</td><td>${h.w}-${h.l}</td><td>${h.confW}-${h.confL}</td><td>${h.ap?"#"+h.ap:"—"}</td><td class="l" style="${POSTRANK(h.postseason)>=3?"color:var(--gold);font-weight:700":""}">${h.postseason}</td><td>${League.grade(h.prestige)}</td><td class="l">${h.coach}</td></tr>`).join("")}
      </tbody></table></div>
    <div>${jerseysCard(t)}<div class="card"><h2>School records</h2>${recBook(Records.school(LG, t.id), 5)}</div>
      <div class="card"><h2>Coaches</h2>${coaches.reverse().map(c=>`<div class="res"><span class="sc">${c.from}${c.to>c.from?`–${String(c.to+1).slice(2)}`:""}</span><span>${c.name}</span><span class="sc">${c.w}-${c.l}</span></div>`).join("")}</div>
      ${greats.length?`<div class="card"><h2>Best players</h2>${greats.map(({x,aw})=>`<div class="res"><span class="sc">${x.from ?? (x.seasons && x.seasons[0] ? x.seasons[0][0] : "")}–${String(x.to+1).slice(2)}</span>
        <span>${x.name} <span class="pill">${x.pos}</span> <span class="hint" style="font-size:11px">${Awards.summary(aw)||""}${x.draft?` · drafted #${x.draft.pick} (${x.draft.year})`:""}</span></span><span class="sc">${x.career.pts} pts</span></div>`).join("")}
        <p class="hint" style="margin:6px 0 0">Former players with awards, draft picks or 1,200+ points.</p></div>`:""}
      ${ser.length?`<div class="card"><h2>Most-played series</h2>${ser.map(x=>`<div class="res"><span class="sc">${LG.byId[x.opp].abbr}</span><span>${LG.byId[x.opp].name}</span><span class="sc"><b class="${x.w>=x.l?"W":"L"}">${x.w}-${x.l}</b></span></div>`).join("")}</div>`:""}
    </div></div>`;
}
/* a rough weight for ordering a school's best players (the Hall of Fame has its own score) */
function hofLite(x){
  const W = { POY: 30, MOP: 15, AA1: 15, AA2: 10, AA3: 7, DPOY: 8, FOY: 4, SIX: 3, MIP: 3, CPOY: 6, CTMVP: 3, CFOY: 2, AC1: 4, AC2: 2 };
  return Awards.unpackAwards(x.awards).reduce((a, k) => a + (W[k.k] || 0), 0) + x.career.pts / 150 + (x.draft ? (x.draft.round === 1 ? 10 : 4) : 0);
}

/* ---------- the record book: a league's or a school's ---------- */
function recBook(book, careerN){
  const L = Records.LABEL;
  const fmtV = (k, v) => k === "winPct" ? v.toFixed(3).slice(1) : v;
  const row = (k, r, tag) => r ? `<div class="res aw"><span class="sc">${L[k]}</span>
      <span><b>${fmtV(k, r.v)}</b> ${r.n}${tag && LG.byId[r.t] ? ` <span class="hint">${LG.byId[r.t].abbr}</span>` : ""} <span class="hint" style="font-size:11px">${yrs(r.y)}${r.x?` · ${r.x}`:""}</span></span></div>` : "";
  const league = book === LG.records?.league;
  const sec = (title, keys, b) => { const rows = keys.map(k => row(k, b[k], league)).join(""); return rows ? `<div class="sect">${title}</div>${rows}` : ""; };
  const career = Records.CFG.career.filter(k => (book.career[k]||[]).length).map(k => `<div><div class="sect">${L[k]}</div>${book.career[k].slice(0, careerN).map((r,i)=>`<div class="res race"><span class="sc">${i+1}</span><span><b>${r.v}</b> ${r.n}${league&&LG.byId[r.t]?` <span class="hint">${LG.byId[r.t].abbr}</span>`:""} <span class="hint" style="font-size:11px">${r.x||""}</span></span></div>`).join("")}</div>`).join("");
  const any = Object.keys(book.game).length || Object.keys(book.season).length;
  if (!any) return `<p class="hint">Records start with the first game of the dynasty.</p>`;
  return sec("Single game", Records.CFG.game, book.game)
    + sec("Single season", [...Records.CFG.avg, ...Records.CFG.season], book.season)
    + sec("Team", ["wins", "winPct", "streak", "teamPts", "margin"], book.team)
    + (career ? `<div class="sect">Career (finished careers)</div><div class="g3">${career}</div>` : "");
}
function vHistRecords(){
  const B = Records.ensure(LG).league;
  return `<div class="card"><h2>League record book</h2>${recBook(B, 10)}
    <p class="hint" style="margin:8px 0 0">Records start when the dynasty does. Season averages need 60% of the team's games. Career lists count finished careers. Any school's records: Program view, pick the school.</p></div>`;
}

/* ---------- the league, year by year ---------- */
function vHistLeague(){
  const years = {};
  for (const t of LG.teams) for (const h of t.history) {
    const y = years[h.year] || (years[h.year] = { ff: [] });
    const r = POSTRANK(h.postseason);
    if (r === 5) y.champ = t; else if (r === 4) y.runner = t; else if (r === 3) y.ff.push(t);
  }
  const list = Object.keys(years).map(Number).sort((a,b)=>b-a);
  if (!list.length) return `<div class="card"><p class="hint">The league's history starts after the first season.</p></div>`;
  const aw = (y, k) => { const e = LG.awards && LG.awards[y] && LG.awards[y].national && LG.awards[y].national[k]; return e ? `${e.name} <span class="hint">${LG.byId[e.teamId]?LG.byId[e.teamId].abbr:""}</span>` : "—"; };
  // the most successful programs
  const prog = LG.teams.map(t => ({ t, ti: t.history.filter(h=>POSTRANK(h.postseason)===5).length, ff: t.history.filter(h=>POSTRANK(h.postseason)>=3).length, tr: t.history.filter(h=>POSTRANK(h.postseason)>=1).length }))
    .filter(x => x.tr).sort((a,b) => b.ti-a.ti || b.ff-a.ff || b.tr-a.tr).slice(0, 15);
  const ab = (t) => t ? `<span class="${t.isUser?"me":""}" style="${t.isUser?"color:var(--gold);font-weight:700":""}">${t.abbr}</span>` : "—";
  return `<div class="card"><h2>Year by year</h2>
    <table><thead><tr><th>Year</th><th class="l">Champion</th><th>Runner-up</th><th>Final Four</th><th class="l">Player of the Year</th><th class="l">Coach of the Year</th><th class="l">Most Outstanding</th></tr></thead><tbody>
    ${list.map(y => { const Y = years[y]; return `<tr><td>${yrs(y)}</td><td class="l"><b>${Y.champ?Y.champ.name:"—"}</b></td><td>${ab(Y.runner)}</td><td>${Y.ff.map(ab).join(", ")||"—"}</td>
      <td class="l">${aw(y,"POY")}</td><td class="l">${aw(y,"COY")}</td><td class="l">${aw(y,"MOP")}</td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="card"><h2>Most successful programs</h2>
    <table><thead><tr><th class="l">School</th><th>Titles</th><th>Final Fours</th><th>Tournaments</th></tr></thead><tbody>
    ${prog.map(x=>`<tr class="${x.t.isUser?"me":""}"><td class="l"><span class="editable" onclick="HISTV.view='program';HISTV.team='${x.t.id}';render()">${x.t.name}</span></td><td>${x.ti}</td><td>${x.ff}</td><td>${x.tr}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ---------- the Hall of Fame ---------- */
const HOFV = { mine: false };
function vHistHof(){
  const H = LG.hof || { players: [], coaches: [] }, t = me();
  const P = [...H.players].filter(x => !HOFV.mine || x.schools.includes(t.abbr)).sort((a,b) => b.y - a.y || b.score - a.score);
  const C = [...H.coaches].filter(x => !HOFV.mine || x.schools.includes(t.abbr)).sort((a,b) => b.y - a.y || b.score - a.score);
  const sch = (list) => list.map(ab => { const s = LG.teams.find(x => x.abbr === ab); return s ? `<span class="editable" onclick="HISTV.view='program';HISTV.team='${s.id}';render()">${s.name}</span>` : ab; }).join(", ");
  return `<div class="card"><h2>Hall of Fame — players (${H.players.length})
      <button class="quiet ${HOFV.mine?"on":""}" style="margin-left:8px;padding:3px 9px;font-size:11px" onclick="HOFV.mine=!HOFV.mine;render()">${t.abbr} only</button></h2>
    ${P.map(x=>`<div class="res ${x.schools.includes(t.abbr)?"mine":""}"><span class="sc">${x.y+1}</span>
      <span>${x.num!=null?`<span class="jn">#${x.num}</span>`:""}<b>${x.name}</b> <span class="pill">${x.pos}</span> <span class="hint">${sch(x.schools)}</span>
        <div class="hint" style="font-size:11px">${x.line}${x.honors?` · ${x.honors}`:""}${x.titles?` · ${x.titles} title${x.titles>1?"s":""}`:x.ff?` · ${x.ff} Final Four${x.ff>1?"s":""}`:""}${x.draft?` · drafted #${x.draft.pick} (${x.draft.year})`:""}</div></span>
      <span class="sc">${x.score}</span></div>`).join("") || `<p class="hint">${HOFV.mine?"Nobody from your school yet.":"Nobody yet."} Players are inducted the offseason they leave: a hard bar to clear (Players of the Year, All-Americans, title runs), at most ${HallOfFame.CFG.player.cap} a year.</p>`}
  </div>
  <div class="card"><h2>Hall of Fame — coaches (${H.coaches.length})</h2>
    ${C.map(x=>`<div class="res ${x.schools.includes(t.abbr)?"mine":""}"><span class="sc">${x.y+1}</span>
      <span><b>${x.name}</b> <span class="hint">${sch(x.schools)}</span>
        <div class="hint" style="font-size:11px">${x.w}-${x.l}${x.titles?` · ${x.titles} title${x.titles>1?"s":""}`:""}${x.ff?` · ${x.ff} Final Four${x.ff>1?"s":""}`:""}${x.coy?` · ${x.coy}× Coach of the Year`:""}</div></span>
      <span class="sc">${x.score}</span></div>`).join("") || `<p class="hint">Nobody yet. Head coaches are considered the offseason they retire: wins, titles, Final Fours and Coach of the Year awards (counted from the start of the dynasty).</p>`}
  </div>`;
}
/* a school's retired jerseys (program view) */
function jerseysCard(t){
  const J = (t.jerseys || []).slice().sort((a,b) => a.y - b.y);
  return `<div class="card"><h2>Retired jerseys${J.length?` — ${J.length}`:""}</h2>
    ${J.map(j=>`<div class="res"><span class="sc" style="font-size:15px;font-weight:800;color:var(--gold)">${j.num!=null?"#"+j.num:"—"}</span>
      <span><b>${j.name}</b> <span class="pill">${j.pos}</span> <span class="hint">${j.span}${j.hof?" · Hall of Fame":""}</span>
        <div class="hint" style="font-size:11px">${j.pts} pts here${j.honors?` · ${j.honors}`:""}</div></span><span></span></div>`).join("")
      || `<p class="hint">None yet. A school retires a jersey for a career that stands out by its own standard: the bigger the program, the higher the bar (${League.grade(t.prestige)} prestige: a legacy score of ${Math.round(HallOfFame.jerseyBar(t))}).</p>`}
    ${J.length?`<p class="hint" style="margin:6px 0 0">Retired numbers aren't worn again here.</p>`:""}</div>`;
}
