/* HOOPS DYNASTY UI — Debug tools (checkbox on setup or Ctrl+Shift+D).
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ==================== DEBUG ====================
   Turn on with the checkbox on the setup screen or Ctrl+Shift+D at any
   time. Adds a Debug tab plus hidden values and cheat buttons on player
   and recruit cards. */
let DEBUG = (()=>{ try{ return localStorage.getItem("hoopsDebug")==="1"; }catch(e){ return false; } })();
function setDebug(on){
  DEBUG = !!on; try{ localStorage.setItem("hoopsDebug", DEBUG?"1":"0"); }catch(e){}
  if($("dbgBox")) $("dbgBox").checked = DEBUG;
  if(LG && $("main").style.display!=="none"){ if(!DEBUG && TAB==="debug") TAB="hub"; render(); }
}
document.addEventListener("keydown", e => { if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==="d"){ e.preventDefault(); setDebug(!DEBUG); } });

function dbgSimUntil(stop, label){
  const t0 = Date.now(); let n = 0;
  while(!Season.seasonComplete(SE) && !stop() && n++ < 400) logResults(Season.simDay(LG, SE));
  note(`Debug: ${label} (${((Date.now()-t0)/1000).toFixed(1)}s).`);
}
function vDebug(){
  const t = me(), R = LG.recruiting, m = Recruiting.money(LG, t);
  const num = (id, v, w=70) => `<input type="number" id="${id}" value="${v}" style="width:${w}px">`;
  let size = "—"; try{ size = Save.fmtSize(Save.pack(LG, SE).length); }catch(e){}
  return `<div class="g">
  <div class="card"><h2>Your program</h2>
    <div class="row">
      <div><label>Prestige</label>${num("dPres", t.prestige)}</div>
      <div><label>Home court</label>${num("dHome", t.homeCourt)}</div>
      <div><label>Facilities</label>${num("dFac", t.facilities)}</div>
      <div><label>NIL grade</label>${num("dNil", t.nil)}</div>
    </div>
    <div class="row" style="margin-top:8px">
      <div><label>Coach tactics</label>${num("dTac", t.coach.rating)}</div>
      <div><label>Recruiting</label>${num("dRec", t.coach.recruiting)}</div>
      <div><label>Development</label>${num("dDev", t.coach.development)}</div>
      <div><label>Collective $/yr</label>${num("dCol", t.collective||0, 110)}</div>
    </div>
    <div class="row" style="margin-top:10px">
      <button onclick="dbgApply()">Apply</button>
      <button class="quiet" onclick="dbgNilGrade()" title="Set the collective to what the NIL grade normally gives">Collective from NIL grade</button>
    </div>
    <p class="hint" style="margin:8px 0 0">Free NIL money now ${money$(m.free)} · payroll ${money$(m.payroll)} · offers out ${money$(m.pending)}</p>
  </div>
  <div class="card"><h2>Calendar</h2>
    <p class="hint" style="margin:0 0 8px">Day ${SE.day} · week ${weekOf(SE.day)} · regular season ends day ${SE.lastDay}${Season.seasonComplete(SE)?" · season complete":""}</p>
    <div class="row">
      <div><label>Sim to day</label>${num("dDay", Math.min(SE.lastDay, SE.day+14))}</div>
      <button class="quiet" onclick="dbgSimUntil(()=>SE.day>=(+$('dDay').value||0),'simmed to day '+$('dDay').value);">Go</button>
      <button class="quiet" onclick="dbgSimUntil(()=>Season.regularSeasonComplete(SE),'simmed to end of regular season')">End of regular season</button>
      <button class="quiet" onclick="dbgSimUntil(()=>false,'simmed to signing day')">Signing day / season end</button>
    </div>
  </div></div>
  <div class="g">
  <div class="card"><h2>Recruiting</h2>
    <div class="row">
      <button class="quiet" onclick="R_=LG.recruiting;R_.pointsLeft[me().id]=Recruiting.weeklyPoints(me());note('Debug: points refilled.')">Refill this week's points</button>
      <button class="quiet" onclick="LG.recruiting.pointsLeft[me().id]+=500;note('Debug: +500 points.')">+500 points</button>
      <button class="quiet" onclick="dbgRel(100)">Board relationships → 100</button>
      <button class="quiet" onclick="dbgRel(0)">Board relationships → 0</button>
      <button class="quiet" onclick="LG.recruiting.scoutPts[me().id]=(LG.recruiting.scoutPts[me().id]||0)+200;note('Debug: +200 scouting points.')">+200 scouting points</button>
      <button class="quiet" onclick="LG.recruiting.pool.forEach(r=>{(r.scout||(r.scout={}))[me().id]=100});note('Debug: every recruit fully scouted.')">Scout everyone</button>
    </div>
    <div class="row" style="margin-top:8px">
      <button class="quiet" onclick="Recruiting.weekly(LG,SE);note('Debug: ran a recruiting week (AI moves + commit rolls).')" ${R&&!R.closed?"":"disabled"}>Run a recruiting week now</button>
      <button class="quiet" onclick="dbgSignLeads()" ${R&&!R.closed?"":"disabled"}>Sign every recruit I lead</button>
      <button class="quiet" onclick="Recruiting.startCycle(LG,LG.season);note('Debug: new recruiting class generated.')">New recruiting class</button>
    </div>
    <p class="hint" style="margin:8px 0 0">Recruit cards also get debug buttons (set relationship, sign him to you) while this is on.</p>
  </div>
  <div class="card"><h2>Roster</h2>
    <div class="row">
      <button class="quiet" onclick="dbgBoost(5)">+5 every rating, my team</button>
      <button class="quiet" onclick="dbgBoost(-5)">−5 every rating</button>
      <button class="quiet" onclick="dbgHeal()">Clear redshirts</button>
      <button class="quiet" onclick="me().coach.points=(me().coach.points||0)+10;note('Debug: +10 coach points.')">+10 coach points</button>
      <button class="quiet" onclick="{const v=prompt('Bank balance ($) — negative means debt:',me().bank||0); if(v!=null){Program.setBank(me(),+v||0); note('Debug: bank set to '+money$(me().bank)+'.');}}">Set bank balance</button>
    </div>
    <p class="hint" style="margin:8px 0 0">Player cards show hidden values (exact potential, work rate, money weight, preferences) while debug is on.</p>
    <h2 style="margin-top:14px">Save</h2>
    <p class="hint" style="margin:0">Current save size ${size} · slot ${SLOT||"none yet"}</p>
  </div></div>`;
}
let R_ = null;
function dbgApply(){
  const t = me(), v = (id) => +$(id).value;
  const c = (x,lo=10,hi=99)=>Math.max(lo,Math.min(hi,Math.round(x)));
  t.prestige = c(v("dPres"),20,96); t.homeCourt = c(v("dHome")); t.facilities = c(v("dFac"),15); t.nil = c(v("dNil"),5);
  t.coach.rating = c(v("dTac"),25); t.coach.recruiting = c(v("dRec"),25); t.coach.development = c(v("dDev"),25);
  t.collective = Math.max(0, Math.round(v("dCol")));
  note("Debug: program updated.");
}
function dbgNilGrade(){ const t=me(); t.nil=+$("dNil").value||t.nil; t.collective=Recruiting.collectiveFor(t); note(`Debug: collective set to ${money$(t.collective)} from NIL grade ${t.nil}.`); }
function dbgRel(v){ const t=me(); let n=0;
  for(const r of LG.recruiting.pool){ const it=r.interest[t.id]; if(r.status==="open"&&it&&(it.watch||it.offer||it.rel>0)){ it.rel=v; n++; } }
  note(`Debug: relationship set to ${v} with ${n} recruits on your board.`); }
function dbgSignLeads(){ const t=me(); let n=0;
  for(const r of LG.recruiting.pool){ if(r.status!=="open") continue; const st=Recruiting.standings(LG,r,SE);
    if(st[0]&&st[0].teamId===t.id&&Recruiting.openSpots(LG,t)>0){ Recruiting.forceCommit(LG,r,t.id,SE); n++; } }
  recruitNews(); note(`Debug: signed ${n} recruits you were leading.`); }
function dbgBoost(d){ for(const p of me().players) for(const k in p.ratings) p.ratings[k]=Math.max(25,Math.min(99,p.ratings[k]+d));
  note(`Debug: ${d>0?"+":""}${d} to every rating on your roster.`); }
function dbgHeal(){ const t=me(); t.players.forEach(p=>p.redshirt=false); League.assignStarters(t.players); t.rotation=League.buildRotation(t.players); note("Debug: redshirts cleared."); }

/* hidden values on a player card */
function dbgPlayerLine(p){
  if(!DEBUG) return "";
  return `<div class="dbg">DEBUG · potential ${p.potential} · work rate ${p.devRate} · money weight ${p.moneyWeight??"—"} · ${p.temperament||""} · wants ${(p.preferences||[]).join(", ")||"—"} · xp ${Math.round(p.xp||0)}
    <span class="row" style="display:inline-flex;gap:4px;margin-left:6px"><button class="quiet" onclick="dbgSal('${p.id}')">set NIL</button></span></div>`;
}
function dbgSal(id){ const f=findPlayer(id); const v=prompt("NIL per year ($):", f.p.salary||0); if(v!=null){ f.p.salary=Math.max(0,Math.round(+v||0)); drawCard(); } }
/* cheat buttons on a recruit card */
function dbgRecruitLine(r){
  if(!DEBUG) return "";
  return `<div class="dbg">DEBUG · TRUE ovr ${r.ovr} · pot ${r.potential} · public rating ${r.pubOvr??"—"} · work ${Recruiting.workRating(r.player.devRate)} · money weight ${r.moneyWeight} · weights pt ${r.weights.pt} / prox ${r.weights.prox} / prestige ${r.weights.prestige} / dev ${r.weights.dev}
    <div class="row" style="gap:4px;margin-top:6px">
      <button class="quiet" onclick="dbgScout('${r.id}',0)">scout 0</button><button class="quiet" onclick="dbgScout('${r.id}',100)">scout full</button>
      ${r.status==="open"?`<button class="quiet" onclick="dbgSetRel('${r.id}',0)">rel 0</button><button class="quiet" onclick="dbgSetRel('${r.id}',50)">rel 50</button><button class="quiet" onclick="dbgSetRel('${r.id}',100)">rel 100</button>
      <button class="quiet" onclick="dbgSign('${r.id}')">Sign him to us</button>`:""}
    </div></div>`;
}
function dbgScout(id,pts){ const r=recFind(id); (r.scout||(r.scout={}))[me().id]=pts; drawRecruit(); }
function dbgSetRel(id,v){ const r=recFind(id), t=me(); (r.interest[t.id]||(r.interest[t.id]={rel:0,offer:0,weekPts:0})).rel=v; drawRecruit(); }
function dbgSign(id){ const r=recFind(id); if(Recruiting.openSpots(LG,me())<=0){ alert("No open scholarships."); return; }
  Recruiting.forceCommit(LG,r,me().id,SE); recruitNews(); drawRecruit(); }
