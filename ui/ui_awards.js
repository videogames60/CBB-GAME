/* HOOPS DYNASTY UI — awards: the races during the season and the winners
   (top of the Leaders & Awards tab), past years, and the bits shown on
   cards. The rules live in dynasty/awards.js. */
const AWV = { year: null, conf: null, pre: false };
const yrs = (y) => `${y}-${String(y + 1).slice(2)}`;
const awName = (k) => Awards.NAMES[k];
function awWho(e){
  if (!e) return `<span class="hint">—</span>`;
  const t = LG.byId[e.teamId], here = t && t.players.some(p => p.id === e.pid);
  const nm = e.pid ? (here ? `<span class="editable" onclick="openCard('${e.pid}')">${e.name}</span>` : e.name) : (e.cid ? `<span class="editable" onclick="openCoach('${e.cid}')">${e.name}</span>` : e.name);
  return `${nm}${e.cls?` <span class="pill">${e.cls} ${e.pos}</span>`:""} <span class="hint">${t?t.abbr:""}${e.line?` · ${e.line}`:""}</span>`;
}
const awRow = (label, e, mine) => `<div class="res aw ${mine?"mine":""}"><span class="sc">${label}</span><span>${awWho(e)}</span></div>`;
const isMine = (e) => e && e.teamId === me().id;

/* the top of the Leaders & Awards tab:
   preseason picks → (after 5 games a team) the live races → (Selection Sunday) the winners.
   Any year's preseason picks are a toggle away. */
function vAwardsTop(){
  const years = Object.keys(LG.awards || {}).map(Number).sort((a, b) => b - a);
  const year = AWV.year && LG.awards && LG.awards[AWV.year] ? AWV.year : LG.season;
  const A = (LG.awards || {})[year] || {};
  const live = year === LG.season && !A.national;
  const played = LG.teams.some(x => x.record.w + x.record.l >= 5);
  const pre = AWV.pre || (live && !played);
  const pick = years.length ? `<select style="margin-left:8px" onchange="AWV.year=+this.value||null;AWV.pre=false;render()">
      ${years.map(y=>`<option value="${y}" ${y===year?"selected":""}>${yrs(y)}${y===LG.season&&!LG.awards[y].national?" (now)":""}</option>`).join("")}</select>` : "";
  const toggle = A.preseason ? `<button class="quiet ${pre?"on":""}" style="margin-left:8px;padding:3px 9px;font-size:11px" onclick="AWV.pre=${!pre};render()" ${live&&!played?"disabled":""}>${pre?(live?"Live races":"Final awards"):"Preseason picks"}</button>` : "";
  if (pre && A.preseason) return vPreseason(A.preseason, pick + toggle, live && !played);
  if (live) return vAwardRaces(pick + toggle);
  return vWinners(year, A, pick + toggle);
}
function vWinners(year, A, controls){
  const N = A.national;
  const confId = AWV.conf && A.conf && A.conf[AWV.conf] ? AWV.conf : (A.conf && A.conf[me().conf] ? me().conf : null);
  const C = confId && A.conf ? A.conf[confId] : null;
  const team = (list) => (list||[]).map(e => `<div class="res one ${isMine(e)?"mine":""}"><span>${awWho(e)}</span></div>`).join("");
  return `<div class="g"><div class="card"><h2>${yrs(year)} awards ${controls}</h2>
      ${["POY","DPOY","FOY","SIX","MIP","COY","MOP"].map(k => awRow(awName(k), N[k], isMine(N[k]))).join("")}
      ${!N.MOP && year === LG.season ? `<p class="hint" style="margin:6px 0 0">The tournament's Most Outstanding Player is named after the title game.</p>` : ""}
    </div>
    <div class="card"><h2>All-Americans</h2>
      ${[1,2,3].map(i => `<div class="sect">${["First","Second","Third"][i-1]} team</div>${team(N["AA"+i])}`).join("")}
    </div></div>
    ${C ? confCard(A.conf, confId, (C) => `<div class="g"><div>${["CPOY","CFOY","CCOY","CTMVP"].map(k => awRow(awName(k).replace("Conference ",""), C[k], isMine(C[k]))).join("")}</div>
      <div><div class="sect" style="margin-top:0">First team</div>${team(C.AC1)}<div class="sect">Second team</div>${team(C.AC2)}</div></div>`, "Conference awards")
      : year < LG.season - Awards.CFG.keepConfYears + 1 ? `<div class="card"><p class="hint">Conference awards are kept for the last ${Awards.CFG.keepConfYears} seasons.</p></div>` : ""}`;
}
function confCard(confs, confId, body, title){
  return `<div class="card"><h2>${title}
    <select style="margin-left:8px" onchange="AWV.conf=this.value;render()">${LG.conferences.filter(c=>confs[c.id]).map(c=>`<option value="${c.id}" ${c.id===confId?"selected":""}>${c.name}</option>`).join("")}</select></h2>
    ${body(confs[confId])}</div>`;
}
/* the preseason picks (display only: nobody keeps these as honors) */
function vPreseason(P, controls, early){
  const N = P.national;
  const team = (list) => (list||[]).map(e => `<div class="res one ${isMine(e)?"mine":""}"><span>${awWho(e)}</span></div>`).join("");
  const confId = AWV.conf && P.conf && P.conf[AWV.conf] ? AWV.conf : (P.conf && P.conf[me().conf] ? me().conf : null);
  return `<div class="g"><div class="card"><h2>${yrs(P.year)} preseason ${controls}</h2>
      ${[["POY","Player of the Year"],["DPOY","Defensive Player of the Year"],["FOY","Freshman of the Year"],["BRK","Breakout candidate"]].map(([k,l]) => awRow(l, N[k], isMine(N[k]))).join("")}
      <p class="hint" style="margin:6px 0 0">${early?"Picked from ratings and last season before a game is played. The live races take over after a few weeks; awards are announced on Selection Sunday.":"How the season was expected to go: picked from ratings and last season before a game was played."}</p></div>
    <div class="card"><h2>Preseason All-Americans</h2>
      ${[1,2,3].map(i => `<div class="sect">${["First","Second","Third"][i-1]} team</div>${team(N["AA"+i])}`).join("")}
    </div></div>
    ${confId ? confCard(P.conf, confId, (C) => `<div class="g"><div>${awRow("Player of the Year", C.CPOY, isMine(C.CPOY))}${awRow("Freshman of the Year", C.CFOY, isMine(C.CFOY))}</div>
      <div><div class="sect" style="margin-top:0">First team</div>${team(C.AC1)}<div class="sect">Second team</div>${team(C.AC2)}</div></div>`, "Preseason All-Conference") : ""}`;
}
/* during the season: who's leading each race */
function vAwardRaces(pick){
  const t = me();
  const kinds = [["POY","Player of the Year"],["DPOY","Defensive POY"],["FOY","Freshman of the Year"],["SIX","Sixth Man"],["MIP","Most Improved"],["COY","Coach of the Year"]];
  const played = LG.teams.some(x => x.record.w + x.record.l >= 5);
  return `<div class="card"><h2>Award races — announced on Selection Sunday ${pick}</h2><div class="g3">
    ${kinds.map(([k,l]) => { const r = Awards.race(LG, k, 5);
      return `<div><div class="sect" style="margin-top:0">${l}</div>${r.map((e,i)=>`<div class="res race ${e.teamId===t.id?"mine":""}"><span class="sc">${i+1}</span><span>${awWho(e)}</span></div>`).join("")||`<p class="hint">${k==="MIP"&&LG.season===LG.startYear?"Needs a previous season to compare.":"Nobody qualifies yet."}</p>`}</div>`; }).join("")}
  </div><p class="hint" style="margin:6px 0 0">Players need 60% of their team's games and 12+ minutes a game. Team success counts: the best player on a winner beats the same numbers on a loser.</p></div>`;
}
/* one line of honors for a card */
function awardsLine(list){
  const s = Awards.summary(Awards.unpackAwards(list));
  return s ? `<div class="hint" style="margin:-2px 0 6px">🏆 ${s}</div>` : "";
}
/* this offseason's honors for the report */
function vAwardsReport(year){
  const A = LG.awards && LG.awards[year]; if (!A || !A.national) return "";
  const t = me(), N = A.national;
  // read straight from the year's award lists (players who've since left count too)
  const mine = [];
  const add = (k, e) => { if (e && e.teamId === t.id) mine.push(`${e.name}: ${awName(k)}`); };
  for (const k in N) Array.isArray(N[k]) ? N[k].forEach(e => add(k, e)) : add(k, N[k]);
  const C = A.conf && A.conf[t.conf];
  if (C) for (const k in C) Array.isArray(C[k]) ? C[k].forEach(e => add(k, e)) : add(k, C[k]);
  return `<div class="card"><h2>${year}-${String(year+1).slice(2)} awards</h2>
    ${["POY","DPOY","FOY","COY","MOP"].map(k => awRow(awName(k), N[k], isMine(N[k]))).join("")}
    <div class="sect">Your honors</div>${mine.map(x=>`<div class="res one mine"><span>${x}</span></div>`).join("")||`<p class="hint">None this year.</p>`}
    <p class="hint" style="margin:6px 0 0">Every award and All-American team: the <span class="editable" onclick="AWV.year=${year};go('leaders')">Leaders & Awards tab</span>.</p></div>`;
}
/* all-time record against a school */
function seriesTxt(oppId){
  const s = Awards.series(LG, me().id, oppId);
  return s.w + s.l ? `${s.w}-${s.l} all-time` : "first meeting";
}

/* the offseason report's first card: your year in review, and the Hall of Fame class */
function vYearInReview(rep){
  const t = me(), year = rep.year - 1, h = t.history.find(x => x.year === year);
  if (!h) return "";
  const lines = [];
  const pc = rep.prestigeChanges && rep.prestigeChanges[t.id];
  // records set this season (your school's book, and the league's by your players)
  const L = Records.LABEL, mine = [];
  const scan = (book, scope) => {
    for (const part of ["game", "season", "team"]) for (const k in book[part]) { const r = book[part][k]; if (r.y === year && r.t === t.id) mine.push(`${scope} record — ${L[k]}${part==="game"&&k!=="teamPts"&&k!=="margin"?" in a game":part==="season"&&!/pg$/.test(k)&&k!=="wins"&&k!=="winPct"&&k!=="streak"?" in a season":""}: <b>${k==="winPct"?r.v.toFixed(3).slice(1):r.v}</b> ${part==="team"?"":r.n}`); }
    // careers that made the top lists: one line a player
    const who = {};
    for (const k in book.career) for (const r of book.career[k]) if (r.y === year && r.t === t.id) (who[r.n] = who[r.n] || []).push(`${L[k].toLowerCase()} ${r.v}`);
    for (const n in who) mine.push(`${n} joins the ${scope==="League"?"league's career top 10":"school's career top 5"}: ${who[n].join(", ")}`);
  };
  scan(Records.ensure(LG).league, "League");
  scan(Records.school(LG, t.id), "School");
  const picks = rep.draft ? rep.draft.picks.filter(x => x.team === t.id) : [];
  const jerseys = rep.hof ? rep.hof.jerseys.filter(j => j.teamId === t.id) : [];
  const hofP = rep.hof ? rep.hof.players : [], hofC = rep.hof ? rep.hof.coaches : [];
  const A = LG.awards && LG.awards[year], honors = [];
  if (A && A.national) { const add = (k, e) => { if (e && e.teamId === t.id) honors.push(e.name); }; for (const k in A.national) Array.isArray(A.national[k]) ? A.national[k].forEach(e => add(k, e)) : add(k, A.national[k]); if (A.conf && A.conf[t.conf]) for (const k in A.conf[t.conf]) Array.isArray(A.conf[t.conf][k]) ? A.conf[t.conf][k].forEach(e => add(k, e)) : add(k, A.conf[t.conf][k]); }
  const item = (label, body) => `<div class="res aw"><span class="sc">${label}</span><span>${body}</span></div>`;
  return `<div class="card" style="border-top:3px solid var(--gold)"><h2>${yrs(year)} in review — ${t.name}</h2>
    ${item("The season", `<b>${h.w}-${h.l}</b> (${h.confW}-${h.confL} conference)${h.ap?` · finished #${h.ap} in the AP poll`:""} · ${h.postseason==="—"?"no tournament":h.postseason}${pc?` · prestige ${pc>0?"+":""}${pc}`:""}`)}
    ${honors.length ? item("Honors", `${honors.length} award${honors.length>1?"s":""} and all-team selection${honors.length>1?"s":""} (below)`) : ""}
    ${mine.length ? item("Records", mine.slice(0, 8).join("<br>") + (mine.length > 8 ? `<br><span class="hint">…and ${mine.length-8} more (History → Program)</span>` : "")) : ""}
    ${picks.length ? item("The draft", picks.map(x => `${x.name} (#${x.pick})`).join(", ")) : ""}
    ${jerseys.length ? item("Jerseys retired", jerseys.map(j => `<b>${j.num!=null?"#"+j.num+" ":""}${j.name}</b> (${j.span}${j.hof?", Hall of Fame":""})`).join(", ")) : ""}
    ${item("Hall of Fame class", hofP.length || hofC.length ? [...hofP.map(x => `${x.schools.includes(t.abbr)?"<b>":""}${x.name}${x.schools.includes(t.abbr)?"</b>":""} <span class="hint">${x.schools.join(", ")}${x.honors?` · ${x.honors}`:""}</span>`), ...hofC.map(x => `Coach ${x.name} <span class="hint">${x.w}-${x.l}${x.titles?`, ${x.titles} title${x.titles>1?"s":""}`:""}</span>`)].join("<br>") : `<span class="hint">Nobody this year.</span>`)}
    ${hofP.length || hofC.length ? `<p class="hint" style="margin:6px 0 0">Every inductee: History → Hall of Fame.</p>` : ""}
  </div>`;
}
