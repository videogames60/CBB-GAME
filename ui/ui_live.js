/* HOOPS DYNASTY UI — Coaching a game live: pregame, the live game screen, play-by-play, lineups, box score.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ==================== LIVE GAME ==================== */
let G=null, LIVE=null, gPbpCount=0, gPlaying=false, gSpeedV=2, gTimer=null, gView=null;
let gStopDead=false; try{ gStopDead = localStorage.getItem("hoopsDynasty.stopDead")==="1"; }catch(e){}
/* the play-by-play reads newest first: each new line goes on top */
function gPbpAdd(div){ const el=$("gPbp"); el.insertBefore(div, el.firstChild); el.scrollTop=0; }
function gToggleDead(){ gStopDead=!gStopDead; try{ localStorage.setItem("hoopsDynasty.stopDead", gStopDead?"1":"0"); }catch(e){} gSync(); }
const gAlerted={};
function styleOptions(kind, sel){
  return Object.entries(TUNING.styles[kind]).map(([k,v])=>`<option value="${k}" ${k===sel?'selected':''}>${v.label}</option>`).join("");
}
function startLive(){
  // a big league can be days from your next game: get there with the progress bar first
  if (!userGameToday() && !Season.seasonComplete(SE)) {
    runDays("Simming to your next game", () => { if (userGameToday()) return true; logResults(Season.simDay(LG, SE)); return false; },
      () => { if (userGameToday()) setTimeout(startLive, 0); });
    return;
  }
  helpFirst("live");
  const prep = Season.prepareLiveDay(LG, SE);
  if(!prep){ render(); return; }
  logResults(prep.played);
  LIVE = prep;
  const t = me(), opp = prep.home.isUser ? prep.away : prep.home;
  LIVE.ctx = { postseason: prep.game.type === "ct" || prep.game.type === "nt" };
  if (t.rotationMode !== "manual") League.autoRotation(t, LIVE.ctx);   // tonight's auto rotation, as the starting point
  LIVE.rotBefore = JSON.stringify(t.rotation);
  const rows = [...t.players].filter(p=>!p.redshirt).sort((a,b)=>(t.rotation?.[b.id]||0)-(t.rotation?.[a.id]||0)).map(p=>`
    <tr><td>${p.name} <span class="pill">${League.classLabel(p)} ${p.pos}</span></td><td>${League.ovrOf(p)}</td>
    <td><input type="number" min="0" max="40" data-id="${p.id}" value="${t.rotation?.[p.id]||0}" oninput="preRotSum()"></td></tr>`).join("");
  const isoOpts = [...t.players].sort((a,b)=>League.ovrOf(b)-League.ovrOf(a)).map(p=>`<option value="${p.id}" ${p.id===t.isoTarget?"selected":""}>${p.name} (${p.pos}, ${League.ovrOf(p)})</option>`).join("");
  const oppTop = [...opp.players].sort((a,b)=>League.ovrOf(b)-League.ovrOf(a))
    .map(p=>{const s=Season.perGame(p);return `<tr><td><span class="editable" onclick="openCard('${p.id}')">${p.name}</span> <span class="pill">${p.pos}</span></td><td>${League.classLabel(p)}</td><td>${League.ovrOf(p)}</td><td>${p.season.gp?s.ppg+" ppg":"—"}</td></tr>`;}).join("");
  $("pregame").innerHTML = `<div class="g">
    <div class="card"><h2>${prep.home.isUser?"Home":"Away"} ${prep.game.neutral?"(neutral court)":""} — ${prep.game.type==="ct"?"CONFERENCE TOURNAMENT":prep.game.type==="nt"?"NATIONAL TOURNAMENT":prep.game.type==="conf"?"conference game":"non-conference"}</h2>
      <div style="font-size:16px;font-weight:700">${t.name} ${t.mascot} (${t.record.w}-${t.record.l}) ${prep.home.isUser?"vs":"at"} ${opp.name} ${opp.mascot} (${opp.record.w}-${opp.record.l})</div>
      <div class="hint" style="margin-top:4px">${opp.coach.name} runs ${TUNING.styles.offense[opp.coach.offense].label} / ${TUNING.styles.defense[opp.coach.defense].label} · prestige ${League.grade(opp.prestige)}</div>
      <table style="margin-top:8px"><thead><tr><th>Their roster</th><th>Cls</th><th>OVR</th><th>PPG</th></tr></thead><tbody>${oppTop}</tbody></table>
      <div class="row" style="margin-top:12px">
        <div><label>Offense</label><select id="preOff">${styleOptions("offense", t.coach.offense)}</select></div>
        <div><label>Defense</label><select id="preDef">${styleOptions("defense", t.coach.defense)}</select></div>
        <div id="preIsoWrap" style="display:${t.coach.offense==="iso"?"":"none"}"><label>Go-to guy</label><select id="preIso">${isoOpts}</select></div>
      </div>
      <div class="row" style="margin-top:12px">
        <button onclick="tipOff()">Tip off</button>
        <button class="quiet" onclick="cancelLive()">Quick sim this game</button>
        <button class="quiet" onclick="backOut()">Back</button>
      </div></div>
    <div class="card"><h2>Rotation — target minutes (must total 200)</h2>
      <table class="rot"><thead><tr><th>Player</th><th>OVR</th><th>Min</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="sum" id="preSum">200</td></tr></tfoot></table></div>
  </div>`;
  $("preOff").onchange = ()=>{ $("preIsoWrap").style.display = $("preOff").value==="iso"?"":"none"; };
  $("main").style.display="none"; $("gameScreen").style.display=""; $("pregame").style.display=""; $("liveWrap").style.display="none";
  preRotSum();
}
function preRotSum(){ let s=0; document.querySelectorAll("#pregame .rot input").forEach(i=>s+=+i.value||0);
  const el=$("preSum"); el.textContent=s; el.className="sum"+(s===200?"":" bad"); }
/* leave the pregame screen without playing or simming anything */
function backOut(){
  LIVE = null;
  $("gameScreen").style.display="none"; $("main").style.display="";
  render();
}
function cancelLive(){
  const g=Engine.createGame(Season.toSimTeam(LIVE.home,true),Season.toSimTeam(LIVE.away,false),{seed:LIVE.seed,homeCourt:LIVE.homeCourt});
  Engine.simulateGame(g);
  Season.finishLiveGame(LG, SE, LIVE.game, Engine.boxScore(g));
  logResults([LIVE.game]); LIVE=null;
  $("gameScreen").style.display="none"; $("main").style.display=""; render();
}
function tipOff(){
  const t = me();
  const rot={}; let sum=0;
  document.querySelectorAll("#pregame .rot input").forEach(i=>{rot[i.dataset.id]=+i.value||0; sum+=+i.value||0;});
  if(sum!==200){ $("preSum").className="sum bad"; return; }
  if (JSON.stringify(Object.fromEntries(Object.keys(JSON.parse(LIVE.rotBefore)).map(k=>[k,rot[k]??JSON.parse(LIVE.rotBefore)[k]]))) !== LIVE.rotBefore) t.rotationMode = "manual";   // you changed it: it's yours now
  t.rotation = { ...t.rotation, ...rot };
  t.coach.offense=$("preOff").value; t.coach.defense=$("preDef").value;
  t.isoTarget = $("preIso") ? $("preIso").value : t.isoTarget;
  const A = Season.toSimTeam(LIVE.home, true, LIVE.ctx);
  const B = Season.toSimTeam(LIVE.away, false, LIVE.ctx);
  LIVE.meIdx = LIVE.home.isUser ? 0 : 1;
  (LIVE.meIdx===0?A:B).control="manual";
  G = Engine.createGame(A, B, {seed:LIVE.seed, homeCourt:LIVE.homeCourt, debug:true});
  gPbpCount=0; gRollCount=0; $("gRolls").innerHTML=""; $("gRolls").style.display="none"; gPlaying=false; gView=null; for(const k in gAlerted) delete gAlerted[k];
  document.documentElement.style.setProperty("--tA", G.teams[0].color||"#888");
  document.documentElement.style.setProperty("--tB", G.teams[1].color||"#888");
  $("pregame").style.display="none"; $("liveWrap").style.display="";
  $("gPbp").innerHTML=""; $("gBox").style.display="none"; $("gPbp").style.display="";
  $("gFinal").className="finalCard"; $("gFinal").innerHTML="";
  $("gOff").innerHTML=styleOptions("offense", t.coach.offense);
  $("gDef").innerHTML=styleOptions("defense", t.coach.defense);
  $("gIso").innerHTML=[...G.teams[LIVE.meIdx].players].sort((a,b)=>b.ovr-a.ovr).map(p=>`<option value="${p.id}" ${p.id===G.teams[LIVE.meIdx].isoTarget?"selected":""}>${p.name.split(" ").pop()} ${p.pos} ${p.ovr}</option>`).join("");
  $("gIsoWrap").style.display = t.coach.offense==="iso"?"":"none";
  gSpeed(gSpeedV); gBanner(""); gTab("pbp");
  courtStart();
  gRenderAll();
}
const M = () => G.teams[LIVE.meIdx];
function gSpeed(s){ gSpeedV=+s; document.querySelectorAll("[data-speed]").forEach(b=>b.classList.toggle("on",+b.dataset.speed===gSpeedV)); const sel=$("gSpeedSel"); if(sel) sel.value=String(gSpeedV); }
function gSync(){
  if(!G) return;
  $("gAuto").classList.toggle("on", M().control==="auto");
  const dB=$("gDead"); if(dB) dB.classList.toggle("on", gStopDead);
  $("gLate").classList.toggle("on", M().coach.lateGame!=="off");
  $("gPlay").textContent = gPlaying?"⏸ Pause":"▶ Play";
  $("gPlay").disabled=G.over; $("gStep").disabled=G.over||gPlaying; $("gEnd").disabled=G.over;
  $("gTO").disabled=!Engine.canTimeout(G,LIVE.meIdx);
  $("gTO").textContent=`Timeout (${M().timeouts})`;
  $("gTO").title=G.over||M().timeouts<=0?"No timeouts left":Engine.canTimeout(G,LIVE.meIdx)?"Stop play: a short rest and a defensive bump":"Only the team with the ball can call timeout on a live ball (or anyone on a dead ball)";
}
function gToggleAuto(){ Engine.setControl(G,LIVE.meIdx,M().control==="auto"?"manual":"auto"); gSync(); gLineup(); }
function gToggleLate(){ Engine.setLateGame(G,LIVE.meIdx,M().coach.lateGame==="off"?"auto":"off"); gSync(); gBoard(); }
function gStyle(){ Engine.setStyle(G,LIVE.meIdx,{offense:$("gOff").value,defense:$("gDef").value});
  $("gIsoWrap").style.display=$("gOff").value==="iso"?"":"none"; gBoard(); gFit(); }
function gIsoSet(){ Engine.setIsoTarget(G,LIVE.meIdx,$("gIso").value); gFit(); }
function gTimeout(){ if(Engine.callTimeout(G,LIVE.meIdx)){ gPause(); gRenderAll(); gBanner("Timeout. Make your changes, then press Play."); } }
function gDoSub(outId,inId){ if(!G||!inId)return; const r=Engine.substitute(G,LIVE.meIdx,outId,inId);
  if(r==="queued"){ const a=G.byId[inId], b=G.byId[outId]; gBanner(`${a.name} checks in for ${b.name} at the next dead ball (the ball is live).`); gLineup(); return; }
  if(r) gRenderAll(); }
function gBanner(m){ const b=$("gBanner"); b.textContent=m; b.style.display=m?"":"none"; }
function gTogglePlay(){ gPlaying?gPause():gPlay(); }
function gPause(){ gPlaying=false; clearTimeout(gTimer); gSync(); }
function gPlay(){ if(!G||G.over)return; gPlaying=true; gBanner(""); gSync(); gLoop(); }
function gLoop(){
  if(!gPlaying||!G||G.over){ gPause(); return; }
  const evBefore=G.events.length;
  const alive=Engine.advance(G);
  const perLine=650/gSpeedV;
  const reveal=()=>{
    if(!gPlaying) return;
    if(gPbpCount<G.events.length) gPbpOne();
    if(gPbpCount<G.events.length){ gTimer=setTimeout(reveal,perLine); return; }
    gBoard(); gLineup(); gFit(); gRollsRender(); if($("gBox").style.display!=="none") gBoxRender();
    const deadStop = gStopDead && alive && G.deadBall && !G.events.slice(evBefore).some(e=>e.type==="period_end");
    const stop=gAlerts()||!alive||G.events.slice(evBefore).some(e=>e.type==="period_end")||deadStop;
    if(deadStop && !$("gBanner").textContent) gBanner("Dead ball. Make your subs or changes, then press Play.");
    if(stop){ gPause(); if(!alive) gFinish(); return; }
    gTimer=setTimeout(gLoop,perLine);
  };
  reveal();
}
function gStep(){ if(!G||G.over)return; Engine.advance(G); gRenderAll(); gAlerts(); if(G.over) gFinish(); }
function gSimEnd(){ if(!G)return; gPause(); if(M().control==="manual") Engine.setControl(G,LIVE.meIdx,"auto");   /* nobody is there to sub: the assistant takes over */
  while(Engine.advance(G)); gRenderAll(); gFinish(); }
function gAlerts(){
  const t=M(), opp=G.teams[1-LIVE.meIdx]; let msg=null;
  for(const id of t.onCourt){ const p=G.byId[id], key=id+":"+p.stats.pf;
    if(p.stats.pf>=2&&!gAlerted[key]&&Engine.inFoulTrouble(G,p)){ gAlerted[key]=true; msg=`${p.name} has ${p.stats.pf} fouls.`; } }
  const rk="run:"+G.period+":"+G.run.teamIdx+":"+G.run.pts;
  if(G.run.teamIdx===opp.idx&&G.run.pts>=TUNING.ai.runTrigger&&!gAlerted[rk]){ gAlerted[rk]=true; msg=`${opp.name} on a ${G.run.pts}-0 run.`; }
  if(msg){ const div=document.createElement("div"); div.className="ev alert";
    div.innerHTML=`<span class="t">${TEXT.clock({period:G.period,clock:G.clock})}</span><span class="txt">${msg}</span><span class="s"></span>`;
    gPbpAdd(div);
    gBanner(msg+(M().control==="manual"?" Game paused.":"")); return M().control==="manual"; }
  return false;
}
const gClock=(c)=>{const m=Math.floor(Math.max(0,c)/60),s=Math.floor(Math.max(0,c)%60);return `${m}:${String(s).padStart(2,"0")}`;};
function gBoard(snap){
  const v=snap||{score:[G.teams[0].score,G.teams[1].score],clock:G.clock,period:G.period};
  const per=v.period===0?"Pregame":v.period<=2?`Half ${v.period}`:`OT${v.period-2}`;
  const tos=(t)=>"●".repeat(t.timeouts)+"○".repeat(Math.max(0,TUNING.timeout.perGame-t.timeouts));
  const [A,B]=G.teams;
  const run=G.run.pts>=4&&G.run.teamIdx>=0?`<div style="color:var(--amber)">${G.teams[G.run.teamIdx].name} ${G.run.pts}-0 run</div>`:"";
  let late="";
  if(!snap&&!G.over&&G.period>=2){
    const lc=Engine.lateContext(G);
    const who=G.teams[G.offIdx].abbr, dw=G.teams[1-G.offIdx].abbr;
    const m={hold:`${who} holding for the last shot`,chase:`${who} working for a quick score`,milk:`${who} running clock`,hurry:`${who} pushing the pace`}[lc.offMode];
    const bits=[]; if(m)bits.push(m); if(lc.huntThree)bits.push(`${who} needs a three`); if(lc.defFoul)bits.push(`${dw} fouling to stop the clock`);
    if(bits.length) late=`<div style="color:var(--gold);font-size:11px;margin-top:2px">${bits.join(" · ")}</div>`;
  }
  const sty=(t)=>`${TUNING.styles.offense[t.coach.offense].label} / ${TUNING.styles.defense[t.coach.defense].label}`;
  const L=B, R=A, lScore=v.score[1], rScore=v.score[0];   // away left, home right
  $("gBoard").innerHTML=`
    <div class="team"><span class="dot" style="background:${L.color}"></span><div><div>${L.name}${L.idx===LIVE.meIdx?" <span class='pill'>you</span>":""}</div><div class="score num">${lScore}</div><div class="tos">${tos(L)}</div><div class="style coachLine" onclick="openCoachCard('${L.id}')">${sty(L)}</div></div></div>
    <div class="mid"><div>${per}${G.over&&!snap?" — Final":""}</div><div class="clk num">${gClock(v.clock)}</div>${snap?"":`<div>shot clock ${Math.max(0,Math.round(G.shotClock))}</div>`}${snap?"":run}${late}</div>
    <div class="team right"><div><div>${R.name}${R.idx===LIVE.meIdx?" <span class='pill'>you</span>":""}</div><div class="score num">${rScore}</div><div class="tos">${tos(R)}</div><div class="style coachLine" onclick="openCoachCard('${R.id}')">${sty(R)}</div></div><span class="dot" style="background:${R.color}"></span></div>`;
}
function gFit(){
  const f=Engine.styleFit(G,LIVE.meIdx);
  const one=(kind,s)=>{
    if(!s.reads) return `<div class="fitrow"><div class="hd"><span class="nm2">${kind}: ${s.label}</span><span class="gr">no fit requirement</span></div><div class="why">Works with any lineup.</div></div>`;
    const pct=Math.round(100*Math.max(0,Math.min(1,(s.scale-0.30)/0.85)));
    const who=s.isoTarget?(s.fallback?`${s.isoTarget} is on the bench — running Balanced until he's back`:`go-to guy: ${s.isoTarget}`):`reads ${s.reads} — your five average ${s.value}`;
    return `<div class="fitrow"><div class="hd"><span class="nm2">${kind}: ${s.label}</span><span class="gr ${s.fallback?"average":s.grade}">${s.fallback?"benched":s.grade+" fit"}</span></div>
      <div class="why">${who}</div><div class="fitbar"><i class="${s.grade}" style="width:${pct}%"></i></div></div>`;
  };
  $("gFit").innerHTML=one("Offense",f.offense)+one("Defense",f.defense);
}
function gPbpOne(){
  const e=G.events[gPbpCount++];
  courtEvent(e, gPlaying);   // the court follows the play-by-play (ui_court.js)
  const line=TEXT.describe(e); if(line==null) return;
  const div=document.createElement("div"); div.className=gPbpClass(e);
  div.innerHTML=`<span class="t">${TEXT.clock(e)}</span><span class="txt">${line}</span><span class="s num">${e.score?`${e.score[0]}–${e.score[1]}`:""}</span>`;
  gPbpAdd(div);
  if(!gView) gView={score:[0,0],clock:e.clock,period:e.period};
  gView.clock=e.clock; gView.period=e.period; if(e.score) gView.score=e.score.slice();
  if(gPlaying) gBoard(gView);
}
function gPbpClass(e){
  let c="ev"; if(e.teamIdx===0)c+=" a"; if(e.teamIdx===1)c+=" b";
  if(e.type==="shot"&&e.made)c+=" made"; if(e.type==="turnover"||e.type==="steal")c+=" tov";
  if(e.type==="sub")c+=" sub"; if(e.type==="timeout"||e.type==="media_timeout")c+=" to";
  if(e.type==="period_start"||e.type==="period_end")c+=" period";
  return c;
}
/* Home team is always the right-hand panel; the away team is always on the
   left. Your own panel gets the sub controls. */
const gSides = () => ({ left: G.teams[1], right: G.teams[0] });   // teams[0] is home
/* live overall: what he's playing at right now, with the fatigue loss in red */
function gOvrCell(p){
  const r = Engine.effRatings(G, p), d = r.ovr - r.effOvr;
  return `<span class="ovrCell">${r.effOvr}${d>0?`<span class="drop">-${d}</span>`:""}</span>`;
}
function gLineup(){
  const s = gSides();
  gPanel("gLeft", s.left, "away");
  gPanel("gRight", s.right, "home");
}
function gPanel(elId, t, side){
  const mine = t.idx === LIVE.meIdx;
  const on = t.onCourt.map(id=>G.byId[id]);
  const bench = t.players.filter(p=>!t.onCourt.includes(p.id));
  const eBar=(p)=>{const e=Math.round(p.energy*100),cls=e>85?"":e>65?"mid":"low";   // green while fatigue costs nothing (85%+); red where it starts to bite
    const w=Math.max(2,Math.min(100,Math.round((e-40)/60*100)));
    return `<span class="ebar" title="energy ${e}%"><i class="${cls}" style="width:${w}%"></i></span><span class="epct">${e}%</span>`;};
  const pf=(p)=>{const c=p.stats.pf>=4?"bad":p.stats.pf>=3?"warn":"";return `<span class="pf ${c}">${p.stats.pf}</span>`;};
  const opts=(out)=>`<select onchange="gDoSub('${out.id}',this.value)"><option value="">sub…</option>${bench.filter(b=>!b.fouledOut).map(b=>`<option value="${b.id}">${b.name.split(" ").pop()} ${b.pos} ${Math.round(b.energy*100)}%</option>`).join("")}</select>`;
  const row=(p,sub)=>`<tr><td class="nm" onclick="openCard('${p.id}')">${jn(p)}${p.name.split(" ").pop()}<small>${p.pos}</small></td>
    <td>${gOvrCell(p)}</td><td>${p.stats.pts}</td><td>${pf(p)}</td><td>${eBar(p)}</td>${sub?`<td>${opts(p)}</td>`:""}</tr>`;
  const subs = mine && t.control==="manual";
  const queued = (t.queued||[]).map(q=>`${G.byId[q.inId].name.split(" ").pop()} for ${G.byId[q.outId].name.split(" ").pop()}`);
  $(elId).innerHTML=`<h2>${t.abbr}${mine?" (you)":""} <span class="side">${side==="home"?"HOME":"AWAY"}</span></h2>
    <div class="coachLine" onclick="openCoachCard('${t.id}')" style="font-size:11px;color:var(--dim);margin:-4px 0 6px">${(LG.byId[t.id]||{coach:{}}).coach.name||"Coach"} · ${TUNING.styles.offense[t.coach.offense].label} / ${TUNING.styles.defense[t.coach.defense].label}</div>
    <table><thead><tr><th>Player</th><th>OVR</th><th>Pts</th><th>PF</th><th>Energy</th>${subs?"<th></th>":""}</tr></thead>
    <tbody>${on.map(p=>row(p,subs)).join("")}</tbody></table>
    ${queued.length?`<div class="hint" style="margin:4px 0 0">At the next dead ball: ${queued.join(", ")}</div>`:""}
    <div class="sect">Bench</div>
    <table><tbody>${bench.map(p=>`<tr${p.fouledOut?' style="opacity:.4"':""}><td class="nm" onclick="openCard('${p.id}')">${jn(p)}${p.name.split(" ").pop()}<small>${p.pos}${p.fouledOut?" — fouled out":""}</small></td><td>${gOvrCell(p)}</td><td>${p.stats.pts}</td><td>${pf(p)}</td><td>${eBar(p)}</td>${subs?"<td></td>":""}</tr>`).join("")}</tbody></table>`;
}
function gBoxRender(){
  const b=Engine.boxScore(G);
  const side=(tb)=>{const T=tb.totals;
    return `<h2>${tb.name}</h2><table class="box"><thead><tr><th>Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th><th>FG</th><th>3P</th><th>FT</th></tr></thead><tbody>
    ${tb.players.filter(p=>p.sec>0).map(p=>`<tr class="${p.starter?"starter":""}"><td>${jn(p)}${p.name}</td><td>${Math.round(p.sec/60)}</td><td>${p.pts}</td><td>${p.oreb+p.dreb}</td><td>${p.ast}</td><td>${p.stl}</td><td>${p.blk}</td><td>${p.tov}</td><td>${p.pf}</td><td>${p.fgm}-${p.fga}</td><td>${p.tpm}-${p.tpa}</td><td>${p.ftm}-${p.fta}</td></tr>`).join("")}
    <tr class="total"><td>Total</td><td></td><td>${T.pts}</td><td>${T.oreb+T.dreb}</td><td>${T.ast}</td><td>${T.stl}</td><td>${T.blk}</td><td>${T.tov}</td><td>${T.pf}</td><td>${T.fgm}-${T.fga}</td><td>${T.tpm}-${T.tpa}</td><td>${T.ftm}-${T.fta}</td></tr></tbody></table>`;};
  $("gBox").innerHTML=side(b.teams[0])+side(b.teams[1]);
}
/* the tabs under the court: play-by-play, box score, rolls; on a phone also the two lineups (away, home) */
function gTab(t){ $("gPbp").style.display=t==="pbp"?"":"none"; $("gBox").style.display=t==="box"?"":"none";
  $("gRolls").style.display=t==="rolls"?"":"none";
  $("liveWrap").dataset.gtab=t;
  for(const [id,k] of [["gTabPbp","pbp"],["gTabBox","box"],["gTabRolls","rolls"],["gTabAway","away"],["gTabHome","home"]]) { const b=$(id); if(b) b.classList.toggle("on",t===k); }
  if(t==="box")gBoxRender(); if(t==="rolls")gRollsRender(); }
/* the engine's roll trace: every roll with its odds, a gold header per possession */
let gRollCount=0;
function gRollsRender(){
  const el=$("gRolls"); if(!G||!G.debug||el.style.display==="none") return;
  // newest possession on top; the rolls inside a possession stay in the order they happened
  for(;gRollCount<G.debug.length;gRollCount++){ const line=G.debug[gRollCount], d=document.createElement("div");
    d.textContent=line;
    if(line.startsWith("──") || !el.firstChild){ const blk=document.createElement("div"); blk.className="rblk"; if(line.startsWith("──")) d.className="ph"; blk.appendChild(d); el.insertBefore(blk, el.firstChild); }
    else el.firstChild.appendChild(d); }
  el.scrollTop=0;
}
function gRenderAll(){ gBoard(); gLineup(); gFit(); gRollsRender(); while(gPbpCount<G.events.length) gPbpOne(); courtSync(); if($("gBox").style.display!=="none")gBoxRender(); gSync(); }
function gFinish(){
  const b=Engine.boxScore(G);
  const myIdx=LIVE.meIdx, won=b.score[myIdx]>b.score[1-myIdx];
  const ot=b.periods>2?` (${b.periods-2}OT)`:"";
  const meBox=b.teams[myIdx];
  const top=[...meBox.players].sort((x,y)=>y.pts-x.pts)[0];
  $("gFinal").className="finalCard show"+(won?"":" lost");
  $("gFinal").innerHTML=`<b>Final${ot}: ${b.teams[0].name} ${b.score[0]}, ${b.teams[1].name} ${b.score[1]}</b> — ${won?"you won":"you lost"}.
    ${top?` ${top.name} led with ${top.pts}.`:""}
    <div style="margin-top:8px"><button onclick="endLive()">Continue season</button>
    <button class="quiet" onclick="gTab('box')">Box score</button></div>`;
  gSync();
}
function endLive(){
  Season.finishLiveGame(LG, SE, LIVE.game, Engine.boxScore(G));
  logResults([LIVE.game]);
  G=null; LIVE=null;
  $("gameScreen").style.display="none"; $("main").style.display="";
  TAB="hub"; render();
}

