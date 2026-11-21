/* HOOPS DYNASTY UI — Season screens: hub, schedule, roster, rotation, player and coach cards, standings, leaders, league, rankings, postseason, history, your scheme.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ---------- views ---------- */
function nextGame(){
  for(let d=SE.day; d<=SE.lastDay; d++){
    const gs = SE.byDay[d]||[];
    const g = gs.find(x=>!x.played && (LG.byId[x.home].isUser||LG.byId[x.away].isUser));
    if(g) return g;
  }
  return null;
}
/* the hub warns you when your job is on the line (Staff tab has the details) */
function hotSeatBanner(t){
  const C = Coaches.CFG.security, sec = t.coach.security;
  if (sec == null || sec > C.warn || !Coaches.canFireUser(LG) || (t.coach.tenure || 0) < C.grace - 1) return "";
  const games = t.record.w + t.record.l, expW = Offseason.prestigeBar(t) + C.expectWinOffset;
  const pace = games ? ` You're at .${String(Math.round(1000 * t.record.w / games)).padStart(3, "0")}.` : "";
  return `<div class="card" style="border-left:3px solid ${sec <= C.hot ? "var(--red)" : "var(--amber)"};padding:10px 14px">
    <b style="color:${sec <= C.hot ? "var(--red)" : "var(--amber)"}">${sec <= C.hot ? "Hot seat" : "Your seat is warm"}</b>: job security ${Math.round(sec)} of 100.
    The athletic director expects about .${String(Math.round(expW * 10)).padStart(3, "0")}${(Offseason.CFG.prestige.expect.find(([m]) => t.prestige >= m) || [0, 0])[1] ? " and a tournament run" : ""} from a ${League.grade(t.prestige)} program.${pace} At 0 you're fired after the season. <span class="editable" onclick="go('staff')">Staff tab</span></div>`;
}
function vHub(){
  const t = me(), ng = nextGame();
  const played = SE.games.filter(g=>g.played && (LG.byId[g.home].isUser||LG.byId[g.away].isUser));
  const recent = played.slice(-6).reverse();
  const lead = t.players.filter(p=>p.season.gp>0).map(p=>({p,s:Season.perGame(p)})).sort((a,b)=>b.s.ppg-a.s.ppg).slice(0,5);
  const diff = t.games ? ((t.ptsFor-t.ptsAgainst)/t.games).toFixed(1) : "—";
  const oOpts = Object.entries(TUNING.styles.offense).map(([k,v])=>`<option value="${k}" ${k===t.coach.offense?"selected":""}>${v.label}</option>`).join("");
  const dOpts = Object.entries(TUNING.styles.defense).map(([k,v])=>`<option value="${k}" ${k===t.coach.defense?"selected":""}>${v.label}</option>`).join("");
  const isoOpts = [...t.players].filter(p=>!p.redshirt).sort((a,b)=>League.ovrOf(b)-League.ovrOf(a))
    .map(p=>`<option value="${p.id}" ${p.id===t.isoTarget?"selected":""}>${p.name} (${p.pos}, ${League.ovrOf(p)})</option>`).join("");
  return hotSeatBanner(t) + `
  <div class="card">
    <h2>Your scheme</h2>
    <p class="hint">What your team runs in simulated games. You can still change it mid-game when you coach live.</p>
    <div class="row">
      <div><label>Offense</label><select id="schemeOff" onchange="setScheme()">${oOpts}</select></div>
      <div><label>Defense</label><select id="schemeDef" onchange="setScheme()">${dOpts}</select></div>
      <div id="schemeIsoWrap" style="display:${t.coach.offense==="iso"?"":"none"}"><label>Go-to guy</label><select id="schemeIso" onchange="setScheme()">${isoOpts}</select></div>
    </div>
    <p class="hint" style="margin-top:8px">${schemeFitNote(t)}</p>
  </div>
  <div class="g">
    <div class="card">
      <h2>Next game</h2>
      ${ng ? (()=>{ const home=LG.byId[ng.home], away=LG.byId[ng.away], opp=home.isUser?away:home;
        return `<div style="font-size:15px;font-weight:700">${home.isUser?"vs":"at"} ${opp.name} ${opp.mascot}</div>
        <div class="hint">${conf(opp.conf).name} · ${opp.record.w}-${opp.record.l} · prestige ${League.grade(opp.prestige)} · day ${ng.day} · you're ${seriesTxt(opp.id)}</div>
        <div class="hint coachLine" onclick="openCoachCard('${opp.id}')">${opp.coach.name} runs <b>${TUNING.styles.offense[opp.coach.offense].label}</b> / <b>${TUNING.styles.defense[opp.coach.defense].label}</b> — view coach</div>
        <table style="margin-top:10px"><thead><tr><th>Their top players</th><th>Cls</th><th>OVR</th><th>PPG</th></tr></thead><tbody>
        ${[...opp.players].sort((a,b)=>League.ovrOf(b)-League.ovrOf(a)).slice(0,5).map(p=>{const s=Season.perGame(p);
          return `<tr><td>${p.name} <span class="pill">${p.pos}</span></td><td>${League.classLabel(p)}</td><td>${League.ovrOf(p)}</td><td>${p.season.gp?s.ppg:"—"}</td></tr>`;}).join("")}
        </tbody></table>`;})() : `<p class="hint">No games left on the schedule.</p>`}
    </div>
    <div class="card">
      <h2>Team</h2>
      <table><tbody>
        <tr><td>Record</td><td>${t.record.w}-${t.record.l}</td></tr>
        <tr><td>Conference</td><td>${t.record.confW}-${t.record.confL}</td></tr>
        <tr><td>Home / Away</td><td>${t.record.homeW}-${t.record.homeL} / ${t.record.awayW}-${t.record.awayL}</td></tr>
        <tr><td>Point margin</td><td>${diff>0?"+":""}${diff}</td></tr>
        <tr><td>Streak</td><td>${t.record.streak>0?`W${t.record.streak}`:t.record.streak<0?`L${-t.record.streak}`:"—"}</td></tr>
        <tr><td>Team strength</td><td>${League.teamStrength(t)}</td></tr>
      </tbody></table>
      <h2 style="margin-top:14px">Leaders</h2>
      <table><thead><tr><th>Player</th><th>MPG</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead><tbody>
      ${lead.map(({p,s})=>`<tr><td>${p.name} <span class="pill">${League.classLabel(p)} ${p.pos}</span></td><td>${s.mpg}</td><td>${s.ppg}</td><td>${s.rpg}</td><td>${s.apg}</td></tr>`).join("")||`<tr><td colspan="5" class="hint">No games played yet.</td></tr>`}
      </tbody></table>
    </div>
  </div>
  <div class="g">
    <div class="card"><h2>Recent results</h2>
      ${recent.map(g=>{const home=LG.byId[g.home],a=LG.byId[g.away],opp=home.isUser?a:home;
        const my=home.isUser?g.homeScore:g.awayScore, th=home.isUser?g.awayScore:g.homeScore;
        const top=home.isUser?g.result.home.top:g.result.away.top;
        return `<div class="res"><span class="${my>th?"W":"L"}">${my>th?"W":"L"} ${my}-${th}</span>
          <span>${home.isUser?"vs":"at"} ${opp.name}${g.ot?` <span class="pill">${g.ot}OT</span>`:""}</span>
          <span class="sc">${top?`${top.name.split(" ").pop()} ${top.pts}`:""}</span></div>`;}).join("")||`<p class="hint">No games played yet.</p>`}
    </div>
    <div class="card"><h2>Season log</h2><div class="log">${LOG.slice(0,25).map(l=>`<div class="res"><span></span><span>${l}</span><span></span></div>`).join("")}</div></div>
  </div>`;
}

function vSchedule(){
  const t = me();
  const mine = SE.games.filter(g=>g.home===t.id||g.away===t.id).sort((a,b)=>a.day-b.day);
  return `<div class="card"><h2>${t.name} schedule — ${mine.length} games</h2>
  <table><thead><tr><th>Day</th><th>Opponent</th><th>Runs</th><th>Type</th><th>Result</th><th>Top scorer</th></tr></thead><tbody>
  ${mine.map(g=>{const home=LG.byId[g.home]===t, opp=home?LG.byId[g.away]:LG.byId[g.home];
    const my=home?g.homeScore:g.awayScore, th=home?g.awayScore:g.homeScore;
    const top=g.result?(home?g.result.home.top:g.result.away.top):null;
    return `<tr><td>${g.day}</td><td>${home?"vs":"at"} ${opp.name} <span class="pill">${opp.abbr}</span>${g.played?"":` <span class="hint" style="font-size:11px">${seriesTxt(opp.id)}</span>`}</td>
      <td>${TUNING.styles.offense[opp.coach.offense].label} / ${TUNING.styles.defense[opp.coach.defense].label}</td>
      <td>${g.type==="conf"?"Conf":"NC"}</td>
      <td>${g.played?`<span class="${my>th?"W":"L"}">${my>th?"W":"L"} ${my}-${th}</span>${g.ot?` <span class="pill">${g.ot}OT</span>`:""}`:"—"}</td>
      <td>${top?`${top.name} ${top.pts}p ${top.reb}r ${top.ast}a`:"—"}</td></tr>`;}).join("")}
  </tbody></table></div>`;
}

let ROSTER_SORT = { key: "min", dir: -1 }, ROSTER_MODE = "stats";
function vRoster(){
  const t = me();
  if (LG.offseason) return `<div class="card"><h2>This offseason — ${({carousel:"coaching carousel",hiring:"coaching carousel",portal:"transfer portal"})[LG.offseason.stage]||"roster decisions"}</h2>${movesHtml(t)}
    <p class="hint" style="margin:8px 0 0">The table below is this year's roster; newcomers join and classes move up when the offseason finishes.</p></div>` + vRosterTable();
  return vRosterTable();
}
function vRosterTable(){
  const t = me();
  const RK = [...Engine.RATING_KEYS, "stamina"];   // stamina doesn't count in overall, but it's his
  const rows = t.players.map(p=>{
    const s = Season.perGame(p);
    return { p, s, ovr: League.ovrOf(p), min: t.rotation?.[p.id] ?? 0 };
  });
  const val = (r,k) => k==="name"?r.p.name : k==="class"?League.CLASSES.indexOf(r.p.class) : k==="pos"?r.p.pos
    : k==="ht"?r.p.height : k==="ovr"?r.ovr : k==="pot"?r.p.potential : k==="min"?r.min : k==="nil"?(r.p.salary||0)
    : RK.includes(k)?r.p.ratings[k] : (r.s[k] ?? 0);
  rows.sort((a,b)=>{ const x=val(a,ROSTER_SORT.key), y=val(b,ROSTER_SORT.key);
    return (typeof x==="string" ? x.localeCompare(y) : x-y) * ROSTER_SORT.dir; });
  const TH = (k,label) => `<th class="sortable ${ROSTER_SORT.key===k?"sorted":""}" onclick="rosterSort('${k}')">${label}${ROSTER_SORT.key===k?(ROSTER_SORT.dir>0?" ▲":" ▼"):""}</th>`;
  const common = TH("name","Player")+TH("class","Cls")+TH("pos","Pos")+TH("ht","Ht")+TH("ovr","OVR")+TH("pot","Pot")+TH("nil","NIL")+TH("min","Min");
  let head, body;
  if(ROSTER_MODE==="stats"){
    head = common+TH("gp","GP")+TH("mpg","MPG")+TH("ppg","PPG")+TH("rpg","RPG")+TH("apg","APG")+TH("spg","SPG")+TH("bpg","BPG")+TH("fgPct","FG%")+TH("tpPct","3P%")+TH("ftPct","FT%");
    body = rows.map(r=>`<tr>${cellsCommon(r,t)}<td>${r.p.season.gp}</td><td>${r.s.mpg}</td><td>${r.s.ppg}</td><td>${r.s.rpg}</td><td>${r.s.apg}</td><td>${r.s.spg}</td><td>${r.s.bpg}</td><td>${r.s.fgPct||"—"}</td><td>${r.s.tpPct||"—"}</td><td>${r.s.ftPct||"—"}</td></tr>`).join("");
  } else {
    const labels = {close:"Cls",mid:"Mid",three:"3PT",pass:"Pas",handle:"Hnd",steal:"Stl",block:"Blk",perDef:"PerD",intDef:"IntD",reb:"Reb",stamina:"Sta"};
    head = common + RK.map(k=>TH(k,labels[k]||k)).join("");
    body = rows.map(r=>`<tr>${cellsCommon(r,t)}${RK.map(k=>`<td>${r.p.ratings[k]}</td>`).join("")}</tr>`).join("");
  }
  return `<div class="card">
  <h2>Roster — ${t.players.length} scholarships · payroll ${Recruiting.fmt(t.players.reduce((s,p)=>s+(p.salary||0),0))} of ${Recruiting.fmt(t.collective||0)}
    <button class="quiet ${ROSTER_MODE==="stats"?"on":""}" style="margin-left:10px;padding:3px 9px;font-size:11px" onclick="rosterMode('stats')">Stats</button>
    <button class="quiet ${ROSTER_MODE==="ratings"?"on":""}" style="padding:3px 9px;font-size:11px" onclick="rosterMode('ratings')">Ratings</button></h2>
  <p class="hint">Click a player for the full card (edit name, class, ratings, minutes). Click a column header to sort.</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <div class="row" style="margin-top:12px">
    <button class="quiet" onclick="go('rotation')">Set the rotation</button>
    <button class="quiet" onclick="editTeamName()">Rename school</button>
  </div></div>`;
}
/* ==================== ROTATION ==================== */
/* about how many minutes his stamina carries before he plays tired:
   calibrated on sims (an average-stamina starter at ~31 min finishes near 60% energy) */
const comfyMinutes = (p) => Math.min(40, Math.round(31 * Math.exp(0.012 * ((p.ratings.stamina||60) - 65))));
function vRotation(){
  const t = me(), R = League.ROT_RULES, manual = t.rotationMode === "manual";
  if (!manual) League.autoRotation(t);   // show what tonight would look like
  const active = t.players.filter(p=>!p.redshirt && !p.injured);
  const check = League.checkRotation(t.rotation||{}, t.players);
  const total = active.reduce((s,p)=>s+(t.rotation?.[p.id]||0),0);
  const playing = active.filter(p=>(t.rotation?.[p.id]||0)>0).length;
  const depthNow = manual ? playing : (t.rotationDepthUsed || League.rotationDepth(t));
  const starters = ["PG","SG","SF","PF","C"].map(pos=>active.find(p=>p.starter && p.pos===pos)||null);
  // starters not at their own position fill the empty slots
  const extra = active.filter(p=>p.starter && !starters.includes(p));
  for (let i=0;i<5;i++) if(!starters[i] && extra.length) starters[i]=extra.shift();
  const opt = (sel) => `<option value="">—</option>`+[...active].sort((a,b)=>League.ovrOf(b)-League.ovrOf(a)).map(p=>`<option value="${p.id}" ${sel&&sel.id===p.id?"selected":""}>${p.name} (${p.pos} ${League.ovrOf(p)})</option>`).join("");
  const warn = (p, m) => {
    if (!m) return "";
    const c = comfyMinutes(p), over = m - c;
    if (over <= 0) return `<span class="hint">fine up to ~${c}</span>`;
    if (over <= 4) return `<span style="color:var(--amber)">tires late (~${c} comfortable)</span>`;
    return `<span style="color:var(--red)">will wear down (~${c} comfortable)</span>`;
  };
  const POSI = { PG:0, SG:1, SF:2, PF:3, C:4 };
  const rows = [...t.players].sort((a,b)=>(b.starter-a.starter) || (a.starter ? POSI[a.pos]-POSI[b.pos] : League.ovrOf(b)-League.ovrOf(a))).map(p=>{
    const m = t.rotation?.[p.id]||0, s = Season.perGame(p), out = p.redshirt || p.injured;
    return `<tr class="${p.starter?"me":""}" style="${out?"opacity:.5":""}">
      <td class="l">${jn(p)}<span class="editable" onclick="openCard('${p.id}')">${p.name}</span> <span class="pill">${League.classLabel(p)} ${p.pos}</span>${p.starter?` <span class="pill">starter</span>`:""}${p.redshirt?` <span class="pill">redshirt</span>`:""}${p.injured?` <span class="pill">injured</span>`:""}${p.promise?` <span class="pill" style="${(p.season.gp&&Roster.mpgOf(p)<p.promise-2)||m<p.promise?"color:var(--amber)":""}" title="You promised him this many minutes a game this season; miss by more than 2 and he's very likely to transfer">promised ${p.promise}</span>`:""}</td>
      <td><b>${League.ovrOf(p)}</b></td><td>${p.ratings.stamina}</td>
      <td>${out?"—":manual?`<input type="number" min="0" max="${R.maxMinutes}" value="${m}" style="width:58px" onchange="rotMin('${p.id}',this.value)">`:`<b>${m}</b>`}</td>
      <td>${p.season.gp?s.mpg:"—"}</td>
      <td class="l">${out?"":warn(p,m)}</td></tr>`;
  }).join("");
  return `<div class="g">
  <div class="card"><h2>Rotation — ${manual?"set by you":"auto (your coach decides each game)"}</h2>
    <div class="row" style="gap:6px;align-items:center">
      <button class="${manual?"quiet":""}" onclick="rotMode('auto')">Auto</button>
      <button class="${manual?"":"quiet"}" onclick="rotMode('manual')">Manual</button>
      <span class="hint" style="margin:0 6px 0 14px">Depth:</span>
      ${[7,8,9,10].map(d=>`<button class="quiet ${!manual&&(t.rotationDepth||0)===d?"on":""}" onclick="rotDepth(${d})">${d}-man</button>`).join("")}
      ${!manual&&t.rotationDepth?`<button class="quiet" onclick="rotDepth(0)" title="Let the coach pick the depth from his own preference and the roster">coach's choice</button>`:""}
    </div>
    <p class="hint" style="margin:8px 0 0">${manual
      ? `Manual: your starters and minutes stay until you change them. A depth button refills minutes for that many men.`
      : `Auto: rebuilt before every game, best five start, ${depthNow}-man rotation${t.rotationDepth?"":` (${t.coach.name}'s choice)`}.`}</p>
    ${t.rotationReset&&manual?`<p style="margin:8px 0 0;color:var(--amber)">Your roster changed in the offseason, so your rotation was reset to a fresh suggestion. Tweak it here. <button class="quiet" style="padding:2px 8px;font-size:11px" onclick="me().rotationReset=false;render()">Got it</button></p>`:""}
  </div>
  <div class="card"><h2>Starting five</h2>
    <div class="row" style="gap:8px">${["PG","SG","SF","PF","C"].map((pos,i)=>`<div><label>${pos}</label><select onchange="rotStarter(${i},this.value,'${starters[i]?starters[i].id:""}')">${opt(starters[i])}</select></div>`).join("")}</div>
    <p class="hint" style="margin:8px 0 0">Anyone can start anywhere; out of position he guards and plays the slot you put him in.${manual?"":" Changing a starter switches you to Manual."}</p>
  </div></div>
  <div class="card"><h2>Minutes <span class="pill" style="${total===R.total?"":"color:var(--red)"}">${total} / ${R.total}</span> <span class="pill">${playing}-man</span></h2>
    ${manual&&check.problems.length?`<div style="margin:0 0 8px;color:var(--amber)">${check.problems.map(x=>`<div>• ${x}</div>`).join("")}
      <button class="quiet" style="margin-top:6px" onclick="rotFix()">Fix it now</button></div>`:""}
    <table><thead><tr><th class="l">Player</th><th>OVR</th><th>Sta</th><th>Plan</th><th>Actual MPG</th><th class="l">Stamina</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint" style="margin:8px 0 0">Rules: ${R.minDepth}+ players, 6th and 7th at least ${R.minBenchMinutes}, max ${R.maxMinutes}, ${R.total} total.</p>
  </div>`;
}
function rotMode(m){ const t=me(); if(m==="manual"){ t.rotationMode="manual"; t.rotation=League.checkRotation(t.rotation||{}, t.players).rot; } else { t.rotationMode="auto"; League.autoRotation(t); } render(); }
function rotDepth(d){ const t=me();
  if(t.rotationMode==="manual"){ t.rotation=League.buildRotation(t.players, d); }
  else { t.rotationDepth = d||null; League.autoRotation(t); }
  render(); }
function rotMin(id,v){ const t=me(); t.rotation[id]=Math.max(0,Math.min(League.ROT_RULES.maxMinutes,Math.round(+v||0))); render(); }
function rotFix(){ const t=me(); t.rotation=League.checkRotation(t.rotation, t.players).rot; render(); }
function rotStarter(i,id,holderId){ const t=me();
  if(t.rotationMode!=="manual"){ t.rotationMode="manual"; }
  const pos=["PG","SG","SF","PF","C"][i], active=t.players.filter(p=>!p.redshirt&&!p.injured);
  const cur = active.filter(p=>p.starter);
  // whoever held this slot steps down; the pick becomes a starter (if he started elsewhere, the two swap)
  const holder = cur.find(p=>p.id===holderId) || null, pick = t.players.find(p=>p.id===id);
  if(pick && pick.starter){ render(); return; }   // already in the five: they just trade spots
  if(holder) holder.starter=false;
  if(pick){ pick.starter=true; if((t.rotation[pick.id]||0) < 20){ const give = holder ? (t.rotation[holder.id]||0) : 28; if(holder){ t.rotation[holder.id]=t.rotation[pick.id]||0; } t.rotation[pick.id]=give; } }
  while(t.players.filter(p=>p.starter).length>5){ const x=t.players.filter(p=>p.starter&&p!==pick).sort((a,b)=>League.ovrOf(a)-League.ovrOf(b))[0]; x.starter=false; }
  render(); }
function cellsCommon(r,t){
  const p=r.p;
  return `<td>${jn(p)}<span class="editable" onclick="openCard('${p.id}')">${p.name}</span> <span class="pill">${p.archetype||""}</span></td>
    <td>${League.classLabel(p)}</td><td>${p.pos}</td><td>${Math.floor(p.height/12)}'${p.height%12}"</td>
    <td><b>${r.ovr}</b></td><td><span class="grade ${League.grade(p.potential)}">${League.grade(p.potential)}</span></td><td>${p.salary!=null?Recruiting.fmt(p.salary):"—"}</td><td>${r.min}</td>`;
}
function rosterSort(k){ if(ROSTER_SORT.key===k) ROSTER_SORT.dir*=-1; else ROSTER_SORT={key:k,dir:k==="name"||k==="pos"?1:-1}; render(); }
function rosterMode(m){ ROSTER_MODE=m; render(); }

/* ---------- player card (view + edit) ---------- */
const RLABEL = {close:"Close",mid:"Mid",three:"3PT",pass:"Pass",handle:"Handle",steal:"Steal",block:"Block",perDef:"PerD",intDef:"IntD",reb:"Reb",stamina:"Stam"};
let CARD = null;
function openCard(id){
  CARD = id; drawCard();
  $("cardBg").classList.add("show");
}
function closeCard(){ const wasRecruit = REC.open, wasPortal = PRT.open; CARD=null; REC.open=null; DEC.open=null; PRT.open=null; if(wasPortal && TAB==='offseason') setTimeout(render,0); $("cardBg").classList.remove("show"); if(wasRecruit && TAB==="recruiting") render(); }
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeCard(); });
function findPlayer(id){ for(const t of LG.teams){ const p=t.players.find(x=>x.id===id); if(p) return {p,t}; } return null; }
function drawCard(){
  const f = findPlayer(CARD); if(!f) return;
  const {p,t} = f, s = Season.perGame(p), edit = t.isUser;
  const labels = {close:"Close",mid:"Mid-range",three:"Three",pass:"Passing",handle:"Handle",steal:"Steal",block:"Block",perDef:"Per. D",intDef:"Int. D",reb:"Rebound",stamina:"Stamina"};
  const rline = (k) => {
    const v = p.ratings[k], cls = v>=75?"":v>=55?"mid":"low";
    return `<div class="rline"><span class="lbl">${labels[k]}</span>
      <span class="rbar"><b class="${cls}" style="width:${v}%"></b></span>
      ${edit?`<input type="number" min="25" max="99" value="${v}" onchange="cardRating('${k}',this.value)">`:`<span style="text-align:right;font-weight:700">${v}</span>`}</div>`;
  };
  const hist = p.history.length ? `<div class="statline">${p.history.map(hh=>`<span><b>${hh.year}</b>${hh.class} · ${hh.gp}gp ${hh.ppg}p ${hh.rpg}r ${hh.apg}a</span>`).join("")}</div>` : "";
  $("cardBox").innerHTML = `
    <div class="top"><div>
      <div class="who">${p.num!=null?`<span class="jn big" title="Jersey number">#${p.num}</span>`:""}${edit?`<span class="editable" onclick="cardName()">${p.name}</span>`:p.name}</div>
      <div class="meta">${edit?`<span class="editable" onclick="cardClass()">${League.classLabel(p)}</span>`:League.classLabel(p)} · ${p.pos} · ${Math.floor(p.height/12)}'${p.height%12}" · <span title="Stamina: how slowly he tires (not part of overall)">stamina <b>${p.ratings.stamina}</b></span> · ${p.archetype||""}${p.wildcard?" · "+p.wildcard:""} · ${t.abbr}${p.home?` · from ${Geo.label(p.home)}`:""}</div>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      ${(()=>{ const lp = (G && G.byId) ? G.byId[p.id] : null;
        if(lp){ const r = Engine.effRatings(G, lp), d = r.ovr - r.effOvr;
          return `<div class="ovrBig"><b>${r.effOvr}</b><div class="sub">${d>0?`${r.ovr} rested · <span class="down">-${d} tired</span>`:"at full strength"}</div></div>`; }
        return `<div class="ovrBig"><b>${League.ovrOf(p)}</b><div class="sub">overall</div></div>`; })()}
      <div class="ovrBig"><b class="grade ${League.grade(p.potential)}">${League.grade(p.potential)}</b><div class="sub">potential</div></div>
      ${p.salary!=null?`<div class="ovrBig"><b style="font-size:20px">${Recruiting.fmt(p.salary)}</b><div class="sub">NIL / year</div></div>`:""}
      <button class="close" onclick="closeCard()">×</button>
    </div></div>
    ${p.salary!=null?`<div class="hint" style="margin:-4px 0 6px">${p.walkOn?"Walk-on":p.recruitRank?`Signed as the ${"★".repeat(p.recruitStars||0)} #${p.recruitRank} recruit`:"On the roster"}</div>`:""}
    <div class="hint" style="margin:-2px 0 6px">${personality(p)}</div>
    ${awardsLine(p.awards)}
    ${dbgPlayerLine(p)}
    ${(()=>{ const g=LG.lastOffseason?.development?.[t.id]?.find(x=>x.id===p.id);
      return g&&g.delta>0?`<div class="hint" style="margin:2px 0 6px">Last offseason: <span class="up">+${g.delta} overall</span> (${g.changes.slice(0,4).map(c=>`${RLABEL[c.k]||c.k} +${c.to-c.from}`).join(", ")})</div>`:""; })()}
    ${edit?`<div class="row" style="margin:4px 0 8px"><div><label>Rotation minutes</label><input type="number" min="0" max="40" value="${t.rotation?.[p.id]??0}" onchange="cardMin(this.value)"></div>
      ${!p.redshirtUsed||p.redshirt?`<div><label title="Sits out the season but keeps his eligibility: same class next year (RS-), one per career">Redshirt</label><button class="quiet ${p.redshirt?"on":""}" onclick="cardRedshirt()">${p.redshirt?"Redshirting":"No"}</button></div>`:`<div><label>Redshirt</label><span class="hint">already used</span></div>`}</div>`:""}
    <div class="rgrid">${Engine.RATING_KEYS.map(rline).join("")}</div>
    <div class="statline">
      <span><b>${p.season.gp}</b>GP</span><span><b>${s.mpg}</b>MPG</span><span><b>${s.ppg}</b>PPG</span>
      <span><b>${s.rpg}</b>RPG</span><span><b>${s.apg}</b>APG</span><span><b>${s.fgPct||"—"}</b>FG%</span><span><b>${s.tpPct||"—"}</b>3P%</span>
    </div>${hist}`;
}
function cardRating(k,v){ const f=findPlayer(CARD); if(!f||!f.t.isUser)return; f.p.ratings[k]=Math.max(25,Math.min(99,+v||25)); drawCard(); if(TAB==="roster")render(); }
function cardMin(v){ const f=findPlayer(CARD); if(!f||!f.t.isUser)return; f.t.rotation=f.t.rotation||{}; f.t.rotationMode="manual"; f.t.rotation[f.p.id]=Math.max(0,Math.min(40,+v||0)); drawCard(); if(TAB==="roster"||TAB==="rotation")render(); }
function openCoachCard(teamId){
  const t = LG.byId[teamId]; if(!t) return;
  if (t.coach.id && typeof openCoach === "function") return openCoach(t.coach.id);   // the full coach card (ui_staff.js)
  const c = t.coach;
  const yrs = c.years||0, w=c.careerW||0, l=c.careerL||0;
  const bar = (label,v) => `<div class="rline"><span class="lbl">${label}</span>
    <span class="rbar"><b class="${v>=75?"":v>=55?"mid":"low"}" style="width:${v}%"></b></span>
    <span style="text-align:right;font-weight:700">${v}</span></div>`;
  $("cardBox").innerHTML = `
    <div class="top"><div>
      <div class="who">${c.name}</div>
      <div class="meta">${t.name} ${t.mascot} · ${conf(t.conf).name}${t.isUser?" · your program":""}</div>
    </div><button class="close" onclick="closeCard()">×</button></div>
    <div class="kv">
      <span class="k">Runs</span><span>${TUNING.styles.offense[c.offense].label} / ${TUNING.styles.defense[c.defense].label}</span>
      ${c.offense==="iso"&&t.isoTarget?`<span class="k">Go-to guy</span><span>${(t.players.find(p=>p.id===t.isoTarget)||{}).name||"—"}</span>`:""}
      <span class="k">Experience</span><span>${yrs} season${yrs===1?"":"s"} as a head coach</span>
      ${w+l?`<span class="k">Record with you</span><span>${w}-${l} (${(w/(w+l)).toFixed(3).slice(1)})</span>`:""}
      <span class="k">Program</span><span>prestige ${League.grade(t.prestige)} · facilities ${League.grade(t.facilities)} · NIL ${League.grade(t.nil)}</span>
    </div>
    <div class="rgrid" style="grid-template-columns:1fr">
      ${bar("Tactics",c.rating)}${bar("Recruiting",c.recruiting)}${bar("Development",c.development)}${bar("Scouting",c.scouting)}
    </div>
    ${t.history.length?`<div class="statline">${[...t.history].slice(-6).reverse().map(hh=>`<span><b>${hh.year}</b>${hh.w}-${hh.l}</span>`).join("")}</div>`:""}`;
  $("cardBg").classList.add("show");
}
function cardRedshirt(){ const f=findPlayer(CARD); if(!f||!f.t.isUser)return;
  f.p.redshirt=!f.p.redshirt;
  if(f.t.rotationMode==="manual"){ if(f.p.redshirt){ f.t.rotation[f.p.id]=0; if(f.p.starter){ f.p.starter=false; } } }
  else League.autoRotation(f.t);
  drawCard(); if(TAB==="roster")render(); }
function cardName(){ const f=findPlayer(CARD); if(!f)return; const v=prompt("Player name:",f.p.name); if(v){ f.p.name=v.trim(); drawCard(); if(TAB==="roster")render(); } }
function cardClass(){ const f=findPlayer(CARD); if(!f)return; const v=prompt("Class (FR, SO, JR, SR):",f.p.class); if(v&&League.CLASSES.includes(v.toUpperCase())){ f.p.class=v.toUpperCase(); drawCard(); if(TAB==="roster")render(); } }

function editTeamName(){
  const t = me();
  const n = prompt("School name:", t.name); if(n) t.name=n.trim();
  const m = prompt("Mascot:", t.mascot); if(m) t.mascot=m.trim();
  const a = prompt("Abbreviation:", t.abbr); if(a) t.abbr=a.trim().toUpperCase();
  render();
}
function autoDepth(){ const t=me(); t.rotationMode="auto"; League.autoRotation(t); render(); }

/* a big league shows one conference at a time (yours first); a small one shows them all */
let STAND_CONF = null;
function confPicker(cur, onchange, withAll){
  const tiers = [...new Set(LG.conferences.map(c=>c.tier))].sort();
  return `<select onchange="${onchange}">${withAll?`<option value="" ${!cur?"selected":""}>All conferences</option>`:""}${tiers.map(t=>`<optgroup label="Tier ${t}">${LG.conferences.filter(c=>c.tier===t).map(c=>`<option value="${c.id}" ${c.id===cur?"selected":""}>${c.name}${c.id===me().conf?" (yours)":""}</option>`).join("")}</optgroup>`).join("")}</select>`;
}
function vStandings(){
  const t = me(), big = LG.conferences.length > 8;
  const show = big ? [conf(STAND_CONF || t.conf)] : LG.conferences;
  const card = (c) => {
    const rows = Season.standings(LG, c.id);
    return `<div class="card"><h2>${c.name} <span class="pill">tier ${c.tier}</span></h2>
    <table><thead><tr><th>Team</th><th>Conf</th><th>Overall</th><th>Diff</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="${r.isUser?"me":""}"><td>${r.name}</td><td>${r.confW}-${r.confL}</td><td>${r.w}-${r.l}</td><td>${r.diff>0?"+":""}${r.diff}</td></tr>`).join("")}
    </tbody></table></div>`; };
  return (big ? `<div class="filters">Conference ${confPicker(STAND_CONF || t.conf, "STAND_CONF=this.value;render()")}
      <button class="quiet" onclick="STAND_CONF=null;render()">Mine</button></div>` : "")
    + `<div class="g">${show.map(card).join("")}</div>`;
}

function vLeaders(){
  const cats = [["ppg","Scoring"],["rpg","Rebounding"],["apg","Assists"],["spg","Steals"],["bpg","Blocks"],["fgPct","FG%"]];
  return vAwardsTop() + `<div class="g3">${cats.map(([k,label])=>`
    <div class="card"><h2>${label}</h2>
    <table><thead><tr><th>#</th><th>Player</th><th>Team</th><th>${label==="FG%"?"FG%":k.toUpperCase()}</th></tr></thead><tbody>
    ${Season.leaders(LG,k,8,10).map((r,i)=>`<tr class="${r.isUser?"me":""}"><td>${i+1}</td>
      <td>${r.name} <span class="pill">${r.class} ${r.pos}</span></td><td>${r.team}</td><td>${r[k]}</td></tr>`).join("")||`<tr><td colspan="4" class="hint">Not enough games yet.</td></tr>`}
    </tbody></table></div>`).join("")}</div>`;
}

let LEAGUE_F = { conf: "", tier: "", q: "" };
function vLeague(){
  const F = LEAGUE_F, q = F.q.trim().toLowerCase();
  const all = LG.teams.map(t=>({t, s:League.teamStrength(t), d: t.games?(t.ptsFor-t.ptsAgainst)/t.games:0}))
    .sort((a,b)=> (b.t.record.w-b.t.record.l)-(a.t.record.w-a.t.record.l) || b.d-a.d);
  all.forEach((r,i)=>{ r.n = i+1; });
  const rows = all.filter(r => (!F.conf || r.t.conf===F.conf) && (!F.tier || conf(r.t.conf).tier===+F.tier)
    && (!q || (r.t.name+" "+r.t.mascot+" "+r.t.abbr+" "+r.t.coach.name).toLowerCase().includes(q)));
  const tiers = [...new Set(LG.conferences.map(c=>c.tier))].sort();
  return `<div class="card"><h2>All teams — ${LG.teams.length}${rows.length<all.length?` · showing ${rows.length}`:""}
    <button class="quiet" style="float:right;margin-top:-6px" onclick="exportCurrentLeague()" title="Download this league as it is today (schools, coaches, rosters) as a league file: edit it, then import it on the setup screen to start a new dynasty from it">Export league file</button></h2>
  <div class="filters">
    ${confPicker(F.conf, "LEAGUE_F.conf=this.value;render()", true)}
    <select onchange="LEAGUE_F.tier=this.value;render()"><option value="">All tiers</option>${tiers.map(t=>`<option value="${t}" ${String(t)===F.tier?"selected":""}>Tier ${t}</option>`).join("")}</select>
    <input type="search" placeholder="Search school or coach" value="${F.q.replace(/"/g,"&quot;")}" onchange="LEAGUE_F.q=this.value;render()">
    ${F.conf||F.tier||F.q?`<button class="quiet" onclick="LEAGUE_F={conf:'',tier:'',q:''};render()">Clear</button>`:""}
  </div>
  <table><thead><tr><th>#</th><th>Team</th><th>Conf</th><th>Record</th><th>Diff</th><th>City</th><th>Prestige</th><th>Home</th><th>NIL</th><th>Coach</th><th>Offense</th><th>Defense</th><th>Strength</th></tr></thead><tbody>
  ${rows.map(r=>`<tr class="${r.t.isUser?"me":""}"><td>${r.n}</td><td>${r.t.name} ${r.t.mascot}</td>
    <td>${conf(r.t.conf).short}</td><td>${r.t.record.w}-${r.t.record.l}</td><td>${r.d>0?"+":""}${r.d.toFixed(1)}</td>
    <td class="hint">${Geo.label(r.t.city)}</td>
    <td class="grade ${League.grade(r.t.prestige)}">${League.grade(r.t.prestige)}</td>
    <td class="grade ${League.grade(r.t.homeCourt)}">${League.grade(r.t.homeCourt)}</td>
    <td class="grade ${League.grade(r.t.nil)}">${League.grade(r.t.nil)}</td>
    <td class="coachLine" onclick="openCoachCard('${r.t.id}')">${r.t.coach.name} (${r.t.coach.rating})</td>
    <td>${TUNING.styles.offense[r.t.coach.offense].label}</td>
    <td>${TUNING.styles.defense[r.t.coach.defense].label}</td>
    <td>${r.s}</td></tr>`).join("")||`<tr><td colspan="12" class="hint">No team matches.</td></tr>`}
  </tbody></table></div>`;
}

function vRankings(){
  if(!SE.rankings) return `<div class="card"><p class="hint">Polls come out after the first week of games.</p></div>`;
  const rk = SE.rankings, t = me();
  const apR = Object.fromEntries(rk.ap.map(r=>[r.id,r.rank]));
  const poll = (rows,label,cmp) => `<div class="card"><h2>${label} <span class="pill">week ${rk.week}</span></h2>
    <table><thead><tr><th>#</th><th>Team</th><th>Record</th>${cmp?"<th>AP</th>":""}</tr></thead><tbody>
    ${rows.map(r=>`<tr class="${r.id===t.id?"me":""}"><td>${r.rank}</td><td>${r.team.name}</td>
      <td>${r.team.record.w}-${r.team.record.l}</td>${cmp?`<td>${apR[r.id]?(apR[r.id]===r.rank?"—":(apR[r.id]<r.rank?"▼":"▲")+Math.abs(apR[r.id]-r.rank)):"NR"}</td>`:""}</tr>`).join("")}
    </tbody></table></div>`;
  return `<div class="g">${poll(rk.ap,"AP Poll")}${poll(rk.coaches,"Coaches Poll",true)}</div>
  <div class="card"><h2>Committee resume — how the field gets picked</h2>
  <p class="hint">Picks the at-large bids and seeds (not the polls). Q1 wins count most, Q4 losses hurt most.</p>
  <table><thead><tr><th>#</th><th>Team</th><th>Record</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>SOS</th><th>Score</th></tr></thead><tbody>
  ${rk.committee.slice(0,25).map(r=>`<tr class="${r.id===t.id?"me":""}"><td>${r.rank}</td><td>${r.team.name}</td>
    <td>${r.w}-${r.l}</td><td>${r.q1}</td><td>${r.q2}</td><td>${r.q3}</td><td>${r.q4}</td><td>${r.sos}</td><td>${r.score}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="card"><h2>Adjusted efficiency</h2>
  <p class="hint">Per 100 possessions, adjusted for opponent and venue.</p>
  <table><thead><tr><th>#</th><th>Team</th><th>AdjO</th><th>AdjD</th><th>Margin</th><th>Record</th></tr></thead><tbody>
  ${rk.eff.slice(0,25).map(r=>`<tr class="${r.id===t.id?"me":""}"><td>${r.rank}</td><td>${r.team.name}</td>
    <td>${r.adjO}</td><td>${r.adjD}</td><td>${r.margin>0?"+":""}${r.margin}</td><td>${r.team.record.w}-${r.team.record.l}</td></tr>`).join("")}
  </tbody></table></div>`;
}

let POST_CONF = null;
function vPostseason(){
  const t = me(), P = SE.post;
  if(!P) return `<div class="card"><p class="hint">Conference tournaments begin when the regular season ends (day ${SE.lastDay}).</p></div>`;
  const field = Object.fromEntries((P.field||[]).map(f=>[f.id,f]));
  const sd = (id, B) => { if (P.phase!=="confTourney" && field[id] && B==="nt") return `<span class="sc">${field[id].seed}</span> `;
    const s = B && B.seeds ? B.seeds.find(x=>x.id===id) : null; return s ? `<span class="sc">${s.seed}</span> ` : ""; };
  const gname = (gid, B) => { const g = SE.games[gid]; if(!g) return "";
    const hm=LG.byId[g.home], aw=LG.byId[g.away], mine = hm.isUser||aw.isUser;
    if(!g.played) return `<div class="res ${mine?"mine":""}"><span class="sc">day ${g.day}</span><span>${sd(g.home,B)}${hm.abbr} vs ${sd(g.away,B)}${aw.abbr}</span><span></span></div>`;
    const hw=g.homeScore>g.awayScore, w=hw?g.home:g.away, l=hw?g.away:g.home;
    return `<div class="res ${mine?"mine":""}"><span class="sc">day ${g.day}</span>
      <span>${sd(w,B)}<b>${LG.byId[w].abbr}</b> over ${sd(l,B)}${LG.byId[l].abbr}${g.ot?` <span class="pill">${g.ot}OT</span>`:""}</span>
      <span class="sc num">${Math.max(g.homeScore,g.awayScore)}-${Math.min(g.homeScore,g.awayScore)}</span></div>`; };
  const showConf = POST_CONF || t.conf, CB = P.conf[showConf];
  const big = LG.conferences.length > 8;
  let html = `<div class="g"><div class="card"><h2>${conf(showConf).name} tournament</h2>
    ${big?`<div class="filters">${confPicker(showConf, "POST_CONF=this.value;render()")}</div>`:""}
    ${CB.rounds.map((r,i)=>`<h2 style="margin-top:${i?10:0}px">${(CB.roundNames||[])[i]||"Round "+(i+1)}</h2>${r.map(g=>gname(g,CB)).join("")}`).join("")||`<p class="hint">Only one team: automatic bid.</p>`}
    ${CB.champion?`<p style="color:var(--gold);font-weight:700;margin:8px 0 0">${LG.byId[CB.champion].name} — champions, auto bid</p>`:""}
  </div>
  <div class="card"><h2>Auto bids — ${Object.keys(P.autobids).length} of ${LG.conferences.length}</h2>
    <div class="${big?"g":""}">${LG.conferences.map(c=>{const id=P.autobids[c.id];
      return `<div class="res ${id&&LG.byId[id].isUser?"mine":""}"><span class="sc">${c.short}</span><span>${id?LG.byId[id].name:"…in progress"}</span><span></span></div>`;}).join("")}</div>
  </div></div>`;
  if(P.field){
    const regions = [...new Set(P.field.map(f=>f.region).filter(Boolean))];
    const row = (f) => { const tm=LG.byId[f.id];
      return `<tr class="${tm.isUser?"me":""}"><td>${f.seed}</td><td>${tm.name}${f.playIn?` <span class="pill">play-in</span>`:""}</td><td>${tm.record.w}-${tm.record.l}</td><td>${f.auto?"auto":"at-large"}</td></tr>`; };
    if (regions.length) {
      html += `<div class="card"><h2>The field of ${P.field.length}</h2><div class="g">${regions.map(rg=>`<div class="region"><h3>${rg}</h3>
        <table><tbody>${P.field.filter(f=>f.region===rg).sort((a,b)=>a.seed-b.seed||a.overall-b.overall).map(row).join("")}</tbody></table></div>`).join("")}</div>
        <p class="hint">First four out: ${P.firstOut.map(id=>LG.byId[id].name).join(", ")}</p></div>`;
    } else {
      const half = Math.ceil(P.field.length/2);
      html += `<div class="card"><h2>The field of ${P.field.length}</h2>
      <div class="g"><div><table><tbody>${P.field.slice(0,half).map(row).join("")}</tbody></table></div>
      <div><table><tbody>${P.field.slice(half).map(row).join("")}</tbody></table></div></div>
      <p class="hint">First four out: ${P.firstOut.map(id=>LG.byId[id].name).join(", ")}</p></div>`;
    }
  }
  if(P.national){
    const N = P.national, current = N.rounds.length - 1;
    const roundHtml = (r, i) => {
      const games = r.map(id=>SE.games[id]);
      const byRegion = N.regions && N.regions.length > 1 && games.every(g=>g.tag&&g.tag.region) && games.length >= N.regions.length;
      const body = byRegion
        ? `<div class="g">${N.regions.map(rg=>`<div class="region"><h3>${rg}</h3>${games.filter(g=>g.tag.region===rg).map(g=>gname(g.id,"nt")).join("")}</div>`).join("")}</div>`
        : r.map(id=>gname(id,"nt")).join("");
      const title = (N.roundNames||[])[i] || "Round "+(i+1);
      // big brackets: earlier rounds fold away
      return games.length > 8 && i < current ? `<details style="margin-top:10px"><summary>${title} (${games.length} games)</summary>${body}</details>` : `<h2 style="margin-top:${i?10:0}px">${title}</h2>${body}`;
    };
    html += `<div class="card"><h2>National tournament</h2>
    ${N.rounds.map(roundHtml).join("")}
    ${N.champion?`<p style="color:var(--gold);font-weight:800;font-size:15px;margin:10px 0 0">🏆 ${LG.byId[N.champion].name} — national champions</p>`:""}
    </div>`;
  }
  return html;
}



function setScheme(){
  const t = me();
  t.coach.offense = $("schemeOff").value;
  t.coach.defense = $("schemeDef").value;
  if($("schemeIso")) t.isoTarget = $("schemeIso").value;
  if(t.coach.offense==="iso" && !t.isoTarget) League.pickIsoTarget(t);
  render();
}
/* how well the current five suit the chosen scheme, using the engine's own fit read */
function schemeFitNote(t){
  try{
    const g = Engine.createGame(Season.toSimTeam(t,true), Season.toSimTeam(t,false), {seed:1});
    const f = Engine.styleFit(g, 0);
    const one = (s) => !s.reads ? `${s.label}: fits any lineup`
      : `${s.label}: <b class="grade ${({excellent:"A",good:"B",average:"C",poor:"D",terrible:"F"})[s.grade]||"C"}">${s.grade}</b> fit${s.reads?` (reads ${s.reads})`:""}`;
    return one(f.offense) + " · " + one(f.defense);
  }catch(e){ return ""; }
}

