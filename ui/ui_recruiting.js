/* HOOPS DYNASTY UI — Recruiting tab, scouting display, the recruit card, money inputs and the money bar.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ==================== RECRUITING ==================== */
const REC = { filter: "all", pos: "", sort: "rank", dir: 1, limit: 60, open: null, msg: "", msgKind: "" };
const money$ = (v) => Recruiting.fmt(v);
/* offer box: big −/+ buttons and a step picker (remembered in this browser) */
let MSTEP = (()=>{ try{ return +localStorage.getItem("hoopsStep") || 1000; }catch(e){ return 1000; } })();
function moneyInput(id, value, width=120){
  return `<span class="minp"><button type="button" class="quiet" onpointerdown="mHold(event,'${id}',-1)" title="−${money$(MSTEP)} (hold to keep going)">−</button><input type="number" id="${id}" min="0" step="${MSTEP}" value="${value}" style="width:${width}px"><button type="button" class="quiet" onpointerdown="mHold(event,'${id}',1)" title="+${money$(MSTEP)} (hold to keep going)">+</button>
    <select class="mstep" title="How much − and + move the offer" onchange="mSetStep(this.value)">${[1000,5000,10000].map(v=>`<option value="${v}" ${v===MSTEP?"selected":""}>±${v/1000}k</option>`).join("")}</select></span>`;
}
/* press and hold − / +: one step now, then repeating, faster the longer you hold */
let MHOLD = null;
function mHold(ev, id, dir){
  ev.preventDefault(); mStop(); mStep(id, dir);
  let n = 0; const tick = () => { mStep(id, dir); n++; MHOLD = setTimeout(tick, n < 8 ? 90 : n < 25 ? 45 : 20); };
  MHOLD = setTimeout(tick, 380);
}
function mStop(){ if (MHOLD) { clearTimeout(MHOLD); MHOLD = null; } }
["pointerup","pointercancel","blur"].forEach(e => window.addEventListener(e, mStop));
document.addEventListener("pointerleave", mStop);
function mStep(id, dir){ const el=$(id); if(!el) return; el.value = Math.max(0, Math.round(((+el.value||0) + dir*MSTEP)/1000)*1000); }
function mSetStep(v){ MSTEP=+v||1000; try{ localStorage.setItem("hoopsStep", String(MSTEP)); }catch(e){} document.querySelectorAll(".minp").forEach(w=>{ w.querySelector("input").step=MSTEP; w.querySelectorAll("button")[0].title="−"+money$(MSTEP); w.querySelectorAll("button")[1].title="+"+money$(MSTEP); w.querySelector("select").value=MSTEP; }); }
/* where the money is going: one bar for the season and the offseason */
function moneyBarHtml(m){
  const segs = m.offseason
    ? [[m.raises,"#7fb4e0","raises you've offered"],[m.signed,"var(--green)","signed in the portal"],[m.pending,"var(--gold)","offers out"],[m.debt,"var(--red)","debt"]]
    : [[m.payroll,"#5c6b82","returning payroll"],[m.committed,"var(--green)","signed recruits"],[m.pending,"var(--gold)","offers out"],[m.staff||0,"#b58cd6","coaching staff"],[m.facilities,"#7fb4e0","facilities"],[m.debt,"var(--red)","debt"]];   // one pot: this year's collective + last year's leftover
  const total = Math.max(1, m.offseason ? (m.bank + m.signed + (m.refunds||0) + m.debt) : m.total);
  return `<div class="moneybar" title="${money$(total)} in all">${segs.map(([v,c])=>v>0?`<i style="width:${Math.max(0,100*v/total)}%;background:${c}"></i>`:"").join("")}</div>
    <div class="legend">${segs.filter(([v],i)=>v>0||(!m.offseason&&i<3)).map(([v,c,l])=>`<span><span class="sw" style="background:${c}"></span>${l} <b>${money$(v)}</b></span>`).join("")}<span>free <b style="color:${m.free<0?"var(--red)":"var(--ink)"}">${m.free<0?"−"+money$(-m.free):money$(m.free)}</b></span></div>`;
}
const starStr = (n) => "★".repeat(n);
/* where he's from, relative to you: "Houston, TX" + home/close + your pipeline there */
const recMiles = (t, r) => Geo.miles(t.city, r.home);
function homeCell(t, r){
  const m = recMiles(t, r), lvl = Geo.level(m), pipe = Pipelines.score(t, Geo.areaOf(r.home));
  const area = (Geo.AREA[Geo.areaOf(r.home)]||{}).name || "";
  return `<span title="${area} · ${m==null?"?":Math.round(m)+" mi from campus"}">${r.home ? Geo.CITY[r.home].name+", "+Geo.CITY[r.home].state : "?"}</span>`
    + (lvl==="home"?` <span class="pill" style="color:var(--green)">home</span>`:lvl==="close"?` <span class="pill">close</span>`:"")
    + (pipe>0?` <span class="pill" style="color:var(--gold)" title="Your ${Pipelines.levelOf(Pipelines.strengthIn(t, Geo.areaOf(r.home))).name} pipeline in ${area}">▲</span>`:"");
}

/* ---------- scouting display helpers ---------- */
const sv = (r) => Recruiting.scoutView(LG, me(), r);
const bandTxt = (b) => !b ? "?" : b[0]===b[1] ? `${b[0]}` : `${b[0]}–${b[1]}`;
const bandMid = (b) => b ? (b[0]+b[1])/2 : 0;
function gradeBand(b){
  if(!b) return "?";
  const lo = League.grade(b[0]), hi = League.grade(b[1]);
  return lo===hi ? `<span class="grade ${lo}">${lo}</span>` : `<span class="grade ${lo}">${lo}</span><span class="hint">–</span><span class="grade ${hi}">${hi}</span>`;
}
/* level 0 is the services' read and can be wrong: shown dotted-underlined with a ~ */
const ROUGH_TIP = "Services' read (scouting level 0): it can be off. About 1 in 4 kids' overall and 2 in 5 kids' potential fall outside it. From level 1 your own scouting is always right.";
const roughWrap = (v, html) => v.rough ? `<span title="${ROUGH_TIP}" style="border-bottom:1px dotted var(--dim);cursor:help">~${html}</span>` : html;
function pips(level){ return `<span class="pips" title="scouting level ${level} of 3">${[1,2,3].map(i=>`<i class="${i<=level?"on":""}"></i>`).join("")}</span>`; }
const workWord = (w) => w>=80?"gym rat":w>=60?"hard worker":w>=40?"average":w>=20?"coasts":"lazy";

/* commit news for the season log: your recruits, your targets, and the top 25 */
const oddsTxt = (o) => o>=0.995?"99%":o<0.01?"<1%":`${Math.round(o*100)}%`;
const NEWS_STYLE = { offer:"var(--dim)", raise:"var(--amber)", lost:"var(--red)", lead:"var(--green)" };
function recruitNews(){
  const R = LG && LG.recruiting; if(!R) return;
  const t = me();
  // offers, raises and lead changes on the kids on your board (recruiting.js writes them each refresh)
  const news = (R.news||[]).filter(n=>n.teamId===t.id);
  R.newsSeen = R.newsSeen || 0;
  const freshNews = news.slice(0, Math.max(0, news.length - R.newsSeen)).reverse();
  R.newsSeen = news.length;
  for(const n of freshNews) LOG.unshift(`<span style="color:${NEWS_STYLE[n.kind]||"var(--dim)"}">Recruiting:</span> ${n.text}`);
  R.logSeen = R.logSeen || 0;
  const fresh = R.log.slice(0, Math.max(0, R.log.length - R.logSeen)).reverse();
  R.logSeen = R.log.length;
  for(const e of fresh){
    const r = e.recruitId ? R.pool.find(x=>x.id===e.recruitId) : null;
    if(!r){ LOG.unshift(e.text); continue; }
    const mineTarget = r.interest[t.id] && (r.interest[t.id].offer || r.interest[t.id].rel > 0 || r.interest[t.id].watch);
    if(e.teamId===t.id) LOG.unshift(`<b style="color:var(--green)">Commit!</b> ${e.text}`);
    else if(mineTarget) LOG.unshift(`<span style="color:var(--amber)">Lost a target:</span> ${e.text}`);
    else if(r.rank<=25) LOG.unshift(e.text);
  }
}

function recStatus(r, t){
  if(r.status==="committed"){
    const tm = LG.byId[r.commitTo];
    return r.commitTo===t.id ? `<span class="chip you">signed with you</span>` : `<span class="chip">${tm.abbr}</span>`;
  }
  const st = Recruiting.standings(LG, r, SE);
  if(!st.length) return `<span class="gone">no offers</span>`;
  // who's really ahead depends on what he wants: unknown until you scout him
  // unscouted: you can't tell who's really ahead, only who's offering the most money
  if(!sv(r).wants){ const top = [...st].sort((a,b)=>b.offer-a.offer)[0];
    return `<span class="hint" title="Biggest money offer. Who he actually favors depends on what he wants: scout him to level 1.">top $: ${top.teamId===t.id?"you":LG.byId[top.teamId].abbr}${st.length>1?` · ${st.length} offers`:""}</span>`; }
  const lead = Recruiting.standingsSeen(LG, t, r, SE)[0].teamId;
  if(lead===t.id) return `<span class="lead">you lead</span>${st.length>1?` <span class="hint">of ${st.length}</span>`:""}`;
  return `<span class="trail">${LG.byId[lead].abbr} leads</span> <span class="hint">of ${st.length}</span>`;
}

function vRecruiting(){
  const t = me(), R = LG.recruiting;
  if(!R) return `<div class="card"><p class="hint">Recruiting opens with the season.</p></div>`;
  const m = Recruiting.money(LG, t), spots = Recruiting.openSpots(LG, t);
  const pts = R.pointsLeft[t.id] || 0, ptsWeek = Recruiting.weeklyPoints(t);
  const nextTick = Math.ceil((SE.day+1)/7)*7;
  const pctOf = (v) => Math.max(0, 100*v/Math.max(1,m.total));
  const over = m.free < 0;
  const myClass = R.pool.filter(r=>r.status==="committed" && r.commitTo===t.id).sort((a,b)=>a.rank-b.rank);

  // board rows
  let rows = R.pool.map(r=>{
    const it = r.interest[t.id] || {rel:0,offer:0};
    const v = sv(r);
    const er = r.status==="open" && v.wants ? Recruiting.evaluateRange(LG, t, r, SE) : null;
    return { r, it, er, v, price: er ? r.asking/er.mid.mult : null, exact: er ? er.exact || Math.abs(er.lo.mult-er.hi.mult)<0.0005 : true, mine: !!(it.offer || it.rel>0 || it.watch || v.pts>0) };
  });
  if(REC.filter==="board") rows = rows.filter(x=>x.mine);
  if(REC.filter==="open") rows = rows.filter(x=>x.r.status==="open");
  if(REC.filter==="afford") rows = rows.filter(x=>x.r.status==="open" && (x.price ?? x.r.asking) <= m.free + (x.it.offer||0));
  if(REC.pos) rows = rows.filter(x=>x.r.pos===REC.pos);
  if(REC.near==="close") rows = rows.filter(x=>Geo.level(recMiles(t,x.r))!=="far");
  if(REC.near==="pipe") rows = rows.filter(x=>Pipelines.score(t, Geo.areaOf(x.r.home))>0);
  const key = { rank:x=>x.r.rank, ovr:x=>bandMid(x.v.ovr), pot:x=>bandMid(x.v.pot), work:x=>x.v.work?bandMid(x.v.work):-1, scout:x=>x.v.pts, ask:x=>x.r.asking, price:x=>x.price==null?1e12:x.price, offer:x=>x.it.offer||0, rel:x=>x.it.rel||0, name:x=>x.r.name }[REC.sort];
  rows.sort((a,b)=>{ const x=key(a), y=key(b); return (typeof x==="string"?x.localeCompare(y):x-y)*REC.dir; });
  const total = rows.length;
  rows = rows.slice(0, REC.limit);
  const TH=(k,l)=>`<th class="sortable ${REC.sort===k?"sorted":""}" onclick="recSort('${k}')">${l}${REC.sort===k?(REC.dir>0?" ▲":" ▼"):""}</th>`;
  const fb=(k,l)=>`<button class="quiet ${REC.filter===k?"on":""}" onclick="recFilter('${k}')">${l}</button>`;

  return `<div class="g">
  <div class="card">
    <h2>${R.year+1} recruiting class · week ${R.week}${R.closed?" · signing day has passed":""}</h2>
    <div class="row" style="gap:22px">
      <div><div class="big ${over?"neg":""}" style="color:${over?"var(--red)":"var(--ink)"}">${money$(m.free)}</div><div class="hint">${m.offseason?"money free (offseason)":"money free"}</div></div>
      <div><div class="big">${spots}</div><div class="hint">open scholarships</div></div>
      <div><div class="big">${pts}<span class="hint" style="font-size:13px"> / ${ptsWeek}</span></div><div class="hint">points left this week${R.closed?"":` · refresh day ${nextTick} (week ${weekOf(nextTick)})`}</div>
        <label class="hint" style="display:flex;gap:5px;align-items:center;margin-top:4px;cursor:pointer" title="At each weekly refresh, max out everyone on your board (offered or starred), best-ranked first. Single recruits can be set to auto from their card. You can still spend by hand."><input type="checkbox" ${t.autoPoints?"checked":""} onchange="recAutoPts(this.checked)"> auto-recruit my whole board</label></div>
      <div><div class="big">${Math.floor((R.scoutPts[t.id]||0)*10)/10}</div><div class="hint">scouting points · +${Recruiting.weeklyScout(t).toFixed(1)} a week, they pile up all season</div></div>
    </div>
    ${moneyBarHtml(m)}
    <p class="hint" style="margin:4px 0 0">${bankLine(m)}</p>
    ${m.staff?`<p class="hint" style="margin:2px 0 0">Coaching staff this year: ${[t.coach&&!t.coach.vacant?`${t.coach.name} (head) ${money$(t.coach.salary||0)}`:null, ...(t.staff||[]).filter(Boolean).map(a=>`${a.name} ${money$(a.salary||0)}`)].filter(Boolean).join(" · ")} — it comes out of the same pot.</p>`:""}
  </div>
  <div class="card">
    <h2>Your class — ${myClass.length} signed</h2>
    ${myClass.map(r=>`<div class="res" style="cursor:pointer" onclick="openRecruit('${r.id}')"><span class="pill">${r.pos}</span><span>${r.name} <span class="stars">${starStr(r.stars)}</span> <span class="pill">#${r.rank}</span></span><span class="sc">${bandTxt(sv(r).ovr)} / ${gradeBand(sv(r).pot)} · ${money$(r.deal)}</span></div>`).join("") || `<p class="hint">Nobody yet. ${R.closed?"":"Put points into a few recruits, make offers, and watch who leads."}</p>`}
    <h2 style="margin-top:12px">Your board — latest</h2>
    <div class="log" style="max-height:150px">${(R.news||[]).filter(n=>n.teamId===t.id).slice(0,15).map(n=>`<div class="res" style="cursor:pointer" onclick="openRecruit('${n.recruitId}')"><span class="sc">wk ${n.week}</span><span style="grid-column:span 2;color:${n.kind==="lead"?"var(--green)":n.kind==="lost"?"var(--red)":"inherit"}">${n.text}</span></div>`).join("")||`<p class="hint">Offers, raises and lead changes for the kids on your board show up here after each weekly refresh.</p>`}</div>
    <h2 style="margin-top:12px">Around the country</h2>
    <div class="log" style="max-height:170px">${R.log.slice(0,12).map(e=>`<div class="res"><span class="sc">wk ${e.week}</span><span style="grid-column:span 2">${e.text}</span></div>`).join("")||`<p class="hint">No commitments yet.</p>`}</div>
  </div></div>
  <div class="card">
    <div class="filters">
      ${fb("all","All")}${fb("open","Uncommitted")}${fb("board",`Your board (${R.pool.filter(x=>{const i=x.interest[t.id];return i&&(i.offer||i.rel>0||i.watch);}).length})`)}${fb("afford","You can afford")}
      <select onchange="recPos(this.value)"><option value="">All positions</option>${["PG","SG","SF","PF","C"].map(p=>`<option ${REC.pos===p?"selected":""}>${p}</option>`).join("")}</select>
      <select onchange="REC.near=this.value;REC.limit=60;render()" title="Where they're from"><option value="">Anywhere</option><option value="close" ${REC.near==="close"?"selected":""}>Within ${Geo.CFG.miles.close} miles</option><option value="pipe" ${REC.near==="pipe"?"selected":""}>Your pipeline areas</option></select>
      <span class="hint">${total} recruits · click one to recruit him</span>
    </div>
    <table><thead><tr><th class="l" title="Your board">☆</th>${TH("rank","#")}<th class="l">★</th>${TH("name","Recruit").replace('<th class="','<th class="l ')}<th>Pos</th>${TH("scout","Scout")}${TH("ovr","OVR")}${TH("pot","Pot")}${TH("work","Work")}<th class="l" title="Hometown · green = home (within ${Geo.CFG.miles.home} mi), close = within ${Geo.CFG.miles.close} · ▲ = your pipeline area">Hometown</th>${TH("ask","Asking")}${TH("price","Your price")}<th>Status</th>${TH("offer","Your offer")}${TH("rel","Rel")}</tr></thead><tbody>
    ${rows.map(({r,it,er,v,price,exact,mine})=>`<tr class="rc ${mine?"mine":""}" onclick="openRecruit('${r.id}')">
      <td class="l"><button class="watch ${it.watch?"on":""}" title="${it.watch?"Remove from":"Add to"} your board" onclick="event.stopPropagation();recWatch('${r.id}')">${it.watch?"\u2605\uFE0E":"\u2606\uFE0E"}</button></td>
      <td>${r.rank}</td><td class="stars l">${starStr(r.stars)}</td><td class="l"><b>${r.name}</b></td><td>${r.pos}</td><td>${pips(v.level)}</td><td class="num">${roughWrap(v, bandTxt(v.ovr))}</td>
      <td>${roughWrap(v, gradeBand(v.pot))}</td>
      <td class="num" title="Work rate: revealed at scouting level 2">${v.work?`<span style="color:var(--${bandMid(v.work)>=65?"green":bandMid(v.work)>=35?"ink":"red"})">${bandTxt(v.work)}</span>`:`<span class="hint">?</span>`}</td>
      <td class="l">${homeCell(t,r)}</td>
      <td>${money$(r.asking)}</td>
      <td>${r.status!=="open"?"—":price==null?`<span class="hint" title="Scout him to level 1 to see what he wants">?</span>`:`<span class="${price<r.asking*0.97?"lead":price>r.asking*1.03?"trail":""}" title="${exact?"":"middle of your range — open him for the full range"}">${exact?"":"~"}${money$(price)}</span>`}</td>
      <td>${recStatus(r,t)}</td>
      <td>${it.offer?money$(it.offer):"—"}</td><td>${it.rel?Math.round(it.rel):"—"}${r.status==="open"&&(it.auto||(t.autoPoints&&(it.offer||it.watch)))?` <span class="pill" title="Auto-recruiting: ${Recruiting.CFG.points.capPerRecruit} points a week">A</span>`:""}</td></tr>`).join("")}
    </tbody></table>
    ${total>REC.limit?`<div class="row" style="margin-top:10px"><button class="quiet" onclick="REC.limit+=60;render()">Show more (${total-REC.limit} left)</button></div>`:""}
  </div>`;
}
function recSort(k){ if(REC.sort===k) REC.dir*=-1; else { REC.sort=k; REC.dir = (k==="rank"||k==="name"||k==="price"||k==="ask")?1:-1; } render(); }
function recAutoPts(on){ const t=me(); t.autoPoints=on; if(on){ const n=Recruiting.autoPoints(LG,t); if(n) note(`Auto-spent ${n} recruiting points on your board.`); else render(); } else render(); }
function recAutoOne(){ const r=recFind(REC.open), t=me(); const it=r.interest[t.id]||(r.interest[t.id]={rel:0,offer:0,weekPts:0});
  if(t.autoPoints && (it.offer||it.watch) && !it.auto){ recSay({ok:false, why:"He's already auto-recruited through your whole-board setting. Untick that box on the Recruiting tab to manage him by hand."}); return; }
  it.auto=!it.auto;
  if(it.auto){ const n=Recruiting.autoPoints(LG,t,r); recSay({ok:true}, n?`Auto-recruiting him: ${n} points spent now, ${Recruiting.CFG.points.capPerRecruit} every week from here.`:`Auto-recruiting him: ${Recruiting.CFG.points.capPerRecruit} points every week (none left to spend this week).`); }
  else recSay({ok:true}, "Auto-recruiting off for him."); }
function recFilter(f){ REC.filter=f; REC.limit=60; render(); }
function recPos(p){ REC.pos=p; REC.limit=60; render(); }

/* ---------- the recruit card ---------- */
function openRecruit(id){ REC.open=id; REC.msg=""; drawRecruit(); $("cardBg").classList.add("show"); helpFirst("recruitCard"); }
function recFind(id){ return LG.recruiting.pool.find(r=>r.id===id); }
function fxCell(v){ const pct=Math.round(v*1000)/10; return `<span class="fx ${pct>0.05?"pos":pct<-0.05?"neg":"zero"}">${pct>0?"+":""}${pct.toFixed(1)}%</span>`; }
function drawRecruit(){
  const r = recFind(REC.open); if(!r) return;
  const t = me(), it = r.interest[t.id] || {rel:0,offer:0,weekPts:0};
  const R = LG.recruiting, cap = Recruiting.CFG.points.capPerRecruit;
  const p = r.player, v = sv(r), L = Recruiting.CFG.scout.levels;
  const wantBar = (label, w, note) => `<div class="wantline"><span class="lbl">${label}</span>
    <span class="rbar"><b style="width:${Math.round(w*100)}%"></b></span><span class="hint">${note}</span></div>`;
  const care = (w) => w>=0.8?"a lot":w>=0.5?"some":"a little";
  const fitShare = Math.round(100*(1-Recruiting.CFG.moneyDamp*r.moneyWeight));
  const moneyLabel = r.moneyWeight>=0.6?"money-first":r.moneyWeight>=0.3?"money matters":"fit matters";

  /* ---- scouting block ---- */
  const have = Math.floor((R.scoutPts[t.id]||0)*10)/10;
  const toNext = v.next!=null ? Math.ceil((v.next - v.pts)*10)/10 : 0;
  const scoutBlock = `
    <div class="sect">Scouting — level ${v.level} of 3 ${pips(v.level)}</div>
    <div class="scbar"><b style="width:${Math.min(100,v.pts)}%"></b>${L.slice(0,2).map(x=>`<i style="left:${x}%"></i>`).join("")}</div>
    <div class="hint">${Math.round(v.pts*10)/10} / 100 points on him · you have ${have} · level 1 at ${L[0]} (what he wants), 2 at ${L[1]} (tighter + work rate), 3 at ${L[2]} (exact)</div>
    ${v.rough?`<div class="hint" style="margin-top:4px;color:var(--amber)">Unscouted: the services' ranges can be wrong. Your own (level 1+) always contain the truth.</div>`:""}
    ${v.level<3?`<div class="row" style="gap:4px;margin-top:6px">
      ${[5,10,25].map(n=>`<button class="quiet" ${have>0?"":"disabled"} onclick="recScout(${n})">+${n}</button>`).join("")}
      <button class="quiet" ${have>0?"":"disabled"} onclick="recScout(${toNext})">To level ${v.level+1} (${toNext})</button>
    </div>`:""}`;

  /* ---- what he wants (level 1+) ---- */
  const wants = v.wants ? `
    ${wantBar("Playing time", r.weights.pt, care(r.weights.pt))}
    ${wantBar("Close to home", r.weights.prox, care(r.weights.prox))}
    ${wantBar("Prestige", r.weights.prestige, care(r.weights.prestige))}
    ${wantBar("Development", r.weights.dev, care(r.weights.dev))}
    ${wantBar("Money", r.moneyWeight, moneyLabel)}`
    : `<p class="hint unknown" style="margin:0">Unknown. Scout him to level 1 (${L[0]} points) to learn what he wants, and what an offer from you is really worth to him.</p>`;

  let body = "";
  if(r.status==="open"){
    const er = Recruiting.evaluateRange(LG, t, r, SE), ev = er.mid;
    // unscouted, all you can see is the money: the race is sorted by offer, not by what he'd actually pick
    const st = v.wants ? Recruiting.standingsSeen(LG, t, r, SE) : [...Recruiting.standingsSeen(LG, t, r, SE)].sort((a,b)=>b.offer-a.offer);
    const odds = Recruiting.commitOdds(st);
    const leader = st[0];
    const myPrice = r.asking/ev.mult;
    const priceLo = r.asking/er.hi.mult, priceHi = r.asking/er.lo.mult;
    const ranged = !er.exact && Math.abs(er.lo.mult-er.hi.mult) >= 0.0005;
    const toLead = v.wants && leader && leader.teamId!==t.id ? Math.ceil(leader.effective*1.03/ev.mult/1000)*1000 : null;
    const room = Recruiting.money(LG, t).free + (it.offer||0);
    const left = R.pointsLeft[t.id]||0, weekPts = it.weekPts||0;
    const canPts = !R.closed && left>0 && weekPts<cap;
    // one factor's effect: a range when what you know about him leaves it open
    const fx = (i) => {
      const a = er.lo.parts[i].change*er.lo.damp, b = er.hi.parts[i].change*er.hi.damp;
      if(Math.abs(a-b) < 0.0005) return fxCell(a);
      return `${fxCell(Math.min(a,b))} <span class="hint">to</span> ${fxCell(Math.max(a,b))}`;
    };
    const note = (i) => {
      const a = er.lo.parts[i].note, b = er.hi.parts[i].note;
      return a===b ? a : `${a} – ${b}`;
    };
    body = `
    <div class="sect">Your pitch — ${t.name}</div>
    <table class="pitch"><thead><tr><th class="l">Factor</th><th class="l">How you stack up</th><th>Effect</th></tr></thead><tbody>
      ${ev.parts.map((pt,i)=>`<tr><td>${pt.label}</td><td class="hint l">${note(i)}</td><td>${v.wants?fx(i):`<span class="hint">?</span>`}</td></tr>`).join("")}
      <tr class="me"><td>Multiplier</td><td class="hint l">${v.wants?`fit counts ${fitShare}% for him`:"scout him to see"}</td><td><b>${!v.wants?"?":ranged?`× ${er.lo.mult.toFixed(3)} – ${er.hi.mult.toFixed(3)}`:`× ${ev.mult.toFixed(3)}`}</b></td></tr>
    </tbody></table>
    <p class="hint" style="margin:6px 0 0">${(()=>{ const mv=Recruiting.marketValue(r), x=r.asking/mv;
      return `<span title="What schools think a kid with his public profile is worth, and roughly what they'll pay">Market value about <b style="color:var(--ink)">${money$(mv)}</b></span> · ${x>1.2?"he's asking well above it and may hold out":x<0.85?"he's asking below it: expect a bidding war":"his ask is in line with it"}.`; })()}</p>
    <p class="hint" style="margin:4px 0 0">He's asking ${money$(r.asking)}.${!v.wants?` Scout him to level 1 to see what your offer is worth to him.`
      : ranged?` With your fit, <b style="color:var(--ink)">${money$(priceLo)} – ${money$(priceHi)}</b> meets it (scouting narrows it).`
      : ` With your fit, about <b style="color:var(--ink)">${money$(myPrice)}</b> meets it.`}</p>

    <div class="sect">The race${v.wants&&!er.exact?" — as best you can tell":""}</div>
    ${st.length?`<table><thead><tr><th>School</th><th>Offer</th>${v.wants?"<th>× fit</th><th>Effective</th><th title='His chance of picking each school if he decides now'>Odds</th>":""}</tr></thead><tbody>
      ${st.slice(0,6).map((s,i)=>`<tr class="${s.teamId===t.id?"me":""}"><td>${v.wants&&i===0?"▶ ":""}${LG.byId[s.teamId].name}</td><td>${money$(s.offer)}</td>${v.wants?`<td>${s.mult.toFixed(3)}</td><td><b>${money$(s.effective)}</b></td><td>${oddsTxt(odds[i].odds)}</td>`:""}</tr>`).join("")}
    </tbody></table>
${st.length>6?`<p class="hint">+${st.length-6} more</p>`:""}${v.wants?"":`<p class="hint">Sorted by money offered; scout him to level 1 to see who he favors.</p>`}`:`<p class="hint">Nobody has offered yet.</p>`}

    <div class="sect">Recruit him</div>
    <div class="row">
      <div><label>Points (this week ${weekPts}/${cap} · ${left} left)</label>
        <div class="row" style="gap:4px">${[5,10,20].map(n=>`<button class="quiet" ${canPts?"":"disabled"} onclick="recPts(${n})">+${n}</button>`).join("")}
          <button class="quiet ${it.auto||(t.autoPoints&&(it.offer||it.watch))?"on":""}" ${R.closed?"disabled":""} title="Spend ${cap} points on him every week automatically (best-ranked auto recruits get points first)" onclick="recAutoOne()">${it.auto?"Auto ✓":t.autoPoints&&(it.offer||it.watch)?"Auto (board) ✓":"Auto"}</button></div></div>
      <div><label>Relationship</label><div class="big" style="font-size:15px">${Math.round(it.rel||0)}<span class="hint"> / 100</span></div></div>
    </div>
    <p class="hint" style="margin:6px 0 0">+${(Recruiting.CFG.points.gain*(1+(it.rel||0)/Recruiting.CFG.points.compound)).toFixed(2)} relationship per point now · up to ${cap} a week · 50 is neutral · points refresh day ${(Math.floor(SE.day/7)+1)*7}.</p>
    <div class="row" style="margin-top:10px">
      <div><label>NIL offer per season (renegotiated every offseason) · you have ${money$(room)} for it</label>
        ${moneyInput("recAmt", it.offer||Math.round((v.wants?myPrice:r.asking)/1000)*1000)}</div>
      <button ${R.closed?"disabled":""} onclick="recOffer()">${it.offer?"Change offer":"Make offer"}</button>
      ${toLead?`<button class="quiet" ${R.closed?"disabled":""} onclick="$('recAmt').value=${toLead}">Enough to lead: ${ranged?"~":""}${money$(toLead)}</button>`:""}
      ${it.offer?`<button class="quiet" onclick="recWithdraw()" title="${(it.seen||0)>0?"He's seen this offer: withdrawing costs relationship":"Made since the last refresh: free to take back"}">${(it.seen||0)>0?"Withdraw":"Take it back (free)"}</button>`:""}
    </div>
    <div class="rmsg ${REC.msgKind}">${REC.msg}</div>`;
  } else {
    const tm = LG.byId[r.commitTo];
    body = `<div class="sect">Committed to ${tm.name} — ${money$(r.deal)} a season</div>
    ${r.decision?`<p class="hint" style="margin:0 0 6px">How the top offers compared when he decided:</p>
    <table><thead><tr><th>School</th><th>Offer</th><th>× fit</th><th>Effective</th></tr></thead><tbody>
      ${r.decision.map(d=>`<tr class="${d.teamId===t.id?"me":""}"><td>${d.teamId===r.commitTo?"✔ ":""}${LG.byId[d.teamId].name}</td><td>${money$(d.offer)}</td><td>${d.mult.toFixed(3)}</td><td><b>${money$(d.effective)}</b></td></tr>`).join("")}
    </tbody></table>
    ${r.odds!=null&&r.decision.length>1?`<p class="hint" style="margin:6px 0 0">He picked ${tm.name} at ${Math.round(r.odds*100)}% odds${r.odds<0.4?" — an upset":""}.</p>`:""}
    <p class="hint" style="margin-top:6px">${tm.name}'s fit: ${r.decision[0].parts.filter(x=>Math.abs(x.change)>=0.005).map(x=>`${x.label.toLowerCase()} ${x.change>0?"+":""}${(x.change*100).toFixed(1)}% (${x.note})`).join(" · ")||"neutral"}</p>`:""}
    ${r.commitTo===t.id?`<p class="hint">His real ratings show once he arrives on campus in the offseason.</p>`:""}`;
  }

  /* ---- ratings: a shaded range until fully scouted ---- */
  const rcls = (x) => x>=75?"":x>=55?"mid":"low";
  const rateLine = (k) => {
    const b = v.ratings[k], mid = bandMid(b);
    const bar = b[0]===b[1] ? `<b class="${rcls(b[0])}" style="width:${b[0]}%"></b>`
      : `<b class="${rcls(mid)}" style="width:${b[0]}%"></b><span class="band" style="left:${b[0]}%;width:${b[1]-b[0]}%;background:var(--${mid>=75?"green":mid>=55?"amber":"red"})"></span>`;
    return `<div class="rline"><span class="lbl">${RLABEL[k]}</span><span class="rbar">${bar}</span><span style="text-align:right;font-weight:700" class="num">${bandTxt(b)}</span></div>`;
  };
  const work = v.work ? `<div class="hint" style="margin-top:8px">Work rate ${bandTxt(v.work)} (${v.work[0]===v.work[1]?workWord(v.work[0]):`${workWord(v.work[0])} to ${workWord(v.work[1])}`}): how fast he develops. A high-work kid grows into his potential sooner; a low one may never reach it.</div>`
    : `<div class="hint unknown" style="margin-top:8px">Work rate (how fast he develops) shows at scouting level 2.</div>`;

  $("cardBox").innerHTML = `
    <div class="top"><div>
      <div class="who">${r.name} <span class="stars">${starStr(r.stars)}</span></div>
      <div class="meta">#${r.rank} nationally · ${r.pos} · ${Math.floor(r.height/12)}'${r.height%12}" · ${r.archetype} · from ${homeCell(t, r)} <span class="hint">(${(Geo.AREA[Geo.areaOf(r.home)]||{}).name||""}, ${recMiles(t,r)==null?"?":Math.round(recMiles(t,r))} mi)</span>${v.level>=2?` · ${loyaltyTxt(p)}`:v.wants?` · <span class="hint" title="Loyalty shows at scouting level 2">loyalty ?</span>`:""}</div>
      <button class="quiet ${(r.interest[me().id]||{}).watch?"on":""}" style="padding:3px 10px;font-size:11px;margin:-4px 0 4px" onclick="recWatch('${r.id}');drawRecruit()">${(r.interest[me().id]||{}).watch?"On your board ✓":"+ Add to your board"}</button>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div class="ovrBig" ${v.rough?`title="${ROUGH_TIP}"`:""}><b class="num" style="${v.level<3?"font-size:22px":""}">${v.rough?"~":""}${bandTxt(v.ovr)}</b><div class="sub" style="white-space:nowrap">${v.rough?"services' read":"overall"}</div></div>
      <div class="ovrBig" ${v.rough?`title="${ROUGH_TIP}"`:""}><b style="${v.level<3?"font-size:20px":""}">${v.rough?"~":""}${gradeBand(v.pot)}</b><div class="sub">potential${v.level<3?` ${bandTxt(v.pot)}`:""}</div></div>
      <div class="ovrBig" title="Work rate: how fast he develops. Revealed at scouting level 2, exact at 3."><b class="num" style="font-size:${v.work&&v.work[0]===v.work[1]?28:20}px;${v.work?`color:var(--${bandMid(v.work)>=65?"green":bandMid(v.work)>=35?"ink":"red"})`:"color:var(--dim)"}">${v.work?bandTxt(v.work):"?"}</b><div class="sub" style="white-space:nowrap">work rate</div><div class="sub" style="white-space:nowrap">${v.work?(v.work[0]===v.work[1]?workWord(v.work[0]):"~"+workWord(Math.round(bandMid(v.work)))):"scout to level 2"}</div></div>
      <button class="close" onclick="closeRecruit()">×</button>
    </div></div>
    ${scoutBlock}
    <div class="sect">What he wants</div>
    ${wants}
    ${dbgRecruitLine(r)}
    ${body}
    <div class="sect">Ratings${v.rough?" — the services' read, can be off":v.level<3?" — the real number is somewhere in each range":""}</div>
    <div class="rgrid">${Engine.RATING_KEYS.map(rateLine).join("")}</div>
    ${work}`;
}
function closeRecruit(){ closeCard(); }
/* your board: a watch list, separate from offers and points */
function recWatch(id){ const r=recFind(id), t=me(); const it=r.interest[t.id]||(r.interest[t.id]={rel:0,offer:0,weekPts:0});
  it.watch=!it.watch; if(!REC.open) render(); }
function recSay(res, okText){ REC.msg = res.ok ? okText : res.why; REC.msgKind = res.ok ? "ok" : "err"; drawRecruit(); }
function recPts(n){ const r=recFind(REC.open); const res=Recruiting.addPoints(LG, me(), r, n);
  recSay(res, res.ok ? `Spent ${res.spent} points → relationship +${res.gained.toFixed(1)} (now ${Math.round(res.rel)}).` : ""); }
function recScout(n){ const r=recFind(REC.open); const res=Recruiting.scout(LG, me(), r, n);
  recSay(res, res.ok ? `Scouted ${Math.round(res.spent*10)/10} points.${res.levelUp?` Level ${res.level} reached!`:""}` : ""); }
function recOffer(){ const r=recFind(REC.open); const v=+$("recAmt").value||0; const res=Recruiting.setOffer(LG, me(), r, v); recSay(res, res.lowered?`Offer lowered to ${money$(r.interest[me().id].offer)} a season (free: he hasn't seen it yet).`:`Offer on the table: ${money$(r.interest[me().id].offer)} a season.`); }
function recWithdraw(){ const r=recFind(REC.open), it=r.interest[me().id]||{}; if((it.seen||0)>0 && !confirm("Withdraw your offer? You get the money back, but he's already seen it and won't forget it: your relationship is cut in half.")) return; const res=Recruiting.withdrawOffer(LG, me(), r); recSay(res, (res.free?"Offer taken back. No harm done: he hadn't seen it yet.":"Offer withdrawn (relationship cut in half).")+(res.autoOff?" Auto-recruiting is off for him now.":"")); }

