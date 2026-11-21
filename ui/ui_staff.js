/* HOOPS DYNASTY UI — the Staff tab (you, your assistants, job security,
   the coaches you can hire) and the coaching carousel screens at the start
   of the offseason. The rules live in dynasty/coaches.js. */
const STF = { sort: "ovr", dir: -1, years: 2, msg: "", kind: "", show: 40, role: "" };
const CK = () => Coaches.CFG.keys;
const CL = (k) => Coaches.CFG.labels[k];
const shortL = { rating: "Tac", recruiting: "Rec", development: "Dev", scouting: "Sct" };
const rCell = (v) => `<span class="${v>=75?"up":v<45?"low":""}">${v}</span>`;
const secColor = (s) => s <= Coaches.CFG.security.hot ? "var(--red)" : s <= Coaches.CFG.security.warn ? "var(--amber)" : "var(--green)";
function coachLine(c){ return c ? `<span class="editable" onclick="openCoach('${c.id}')">${c.name}</span>` : `<span class="hint">${Coaches.CFG.grad.name}</span>`; }
const lastJob = (c) => { const h = (c.hist||[]).slice().reverse().find(x => x.team); return h ? `${h.role==="head"?"head coach":"assistant"}, ${h.team}` : ""; };

/* ==================== STAFF TAB ==================== */
function vStaff(){
  const t = me(), C = Coaches.CFG, h = t.coach, m = Recruiting.money(LG, t);
  const S = C.split, grad = C.grad.rating;
  const staffRow = (k) => {
    const a = t.staff.map(x => x ? x[k] : grad);
    return `<tr><td class="l">${CL(k)}</td><td>${rCell(h[k])}</td>${a.map(v=>`<td>${rCell(v)}</td>`).join("")}<td><b>${Coaches.rating(t,k)}</b></td></tr>`;
  };
  const sec = h.security ?? C.security.start, fireable = Coaches.canFireUser(LG);
  const expW = Offseason.prestigeBar(t) + C.security.expectWinOffset;
  const expP = (Offseason.CFG.prestige.expect.find(([min]) => t.prestige >= min) || [0,0])[1];
  const expPost = expP >= 1.5 ? "a deep tournament run" : expP >= 1 ? "a tournament bid and a win" : expP > 0 ? "a tournament bid" : "nothing in particular";
  const chair = (a, i) => a ? `<div class="res">
      <span class="sc">#${i+1}</span>
      <span>${coachLine(a)} <span class="pill">${a.age}</span> <span class="hint">${CK().map(k=>`${shortL[k]} ${a[k]}`).join(" · ")}</span>
        <div class="hint" style="font-size:11px">${money$(a.salary)} a season · ${a.contract} season${a.contract===1?"":"s"} left${a.ext?` <b style="color:var(--green)">· extended: ${a.ext.years} more at ${money$(a.ext.salary)}</b>`:a.contract<=1?` <b style="color:var(--amber)">· final season: extend now at ${money$(Coaches.ask(a))} or he leaves</b>`:""}</div></span>
      <span class="row" style="gap:4px;justify-content:flex-end">
        ${Coaches.canExtend(a)?`<button class="quiet" style="padding:3px 8px;font-size:11px" onclick="stfExtend(${i})" title="Adds the seasons set below at his ask today, starting when this deal ends">Extend ${STF.years} yr</button>`
          :`<span class="hint" style="font-size:11px;align-self:center" title="Contracts are locked; extensions open in his final season">${a.ext?"extended":"locked"}</span>`}
        <button class="quiet" style="padding:3px 8px;font-size:11px" onclick="stfFire(${i})" title="Buyout: ${money$(Coaches.buyout(LG,a))}">Let go</button></span></div>`
    : `<div class="res"><span class="sc">#${i+1}</span><span><span class="hint">${C.grad.name}</span> <span class="hint">· ${C.grad.rating} in everything · ${money$(C.grad.salary)}</span>
        <div class="hint" style="font-size:11px">An empty chair. Hire someone from the list below.</div></span><span></span></div>`;
  // the available coaches
  const pool = LG.coachPool.filter(c => !STF.role || (STF.role === "young" ? c.age <= 35 : (c.years||0) > 0));
  const key = (c) => STF.sort === "ovr" ? Coaches.ovr(c) : STF.sort === "ask" ? Coaches.ask(c) : STF.sort === "age" ? c.age : c[STF.sort];
  const list = pool.slice().sort((a, b) => STF.dir * (key(a) - key(b)) || Coaches.ovr(b) - Coaches.ovr(a));
  const TH = (k, l) => `<th class="sortable ${STF.sort===k?"on":""}" onclick="stfSort('${k}')">${l}${STF.sort===k?(STF.dir<0?" ▾":" ▴"):""}</th>`;
  const open = t.staff.some(a => !a);
  return `<div class="g">
    <div class="card"><h2>Your staff</h2>
      <p class="hint" style="margin:0 0 8px">Every coaching rating the game uses is the staff's: ${Math.round(S[0]*100)}% you, ${Math.round(S[1]*100)}% each assistant.</p>
      <table><thead><tr><th class="l"></th><th>${h.name.split(" ").pop()} (you)</th>${t.staff.map((a,i)=>`<th>${a?a.name.split(" ").pop():"grad asst."}</th>`).join("")}<th>Staff</th></tr></thead>
        <tbody>${CK().map(staffRow).join("")}</tbody></table>
      <div class="sect">Assistants</div>
      ${t.staff.map(chair).join("")}
      <div class="row" style="margin-top:8px;align-items:center">
        <label style="margin:0" title="For new hires and extensions">Contract length</label>
        ${[1,2,3,4].map(y=>`<button class="quiet ${STF.years===y?"on":""}" style="padding:3px 9px" onclick="STF.years=${y};render()">${y} yr</button>`).join("")}
      </div>
      <p class="hint" style="margin:8px 0 0">Staff pay this cycle ${money$(Coaches.staffPay(t))} (yours ${money$(h.salary||0)}). It comes out of the same money as player deals${m.offseason?"; new hires start being paid next cycle":""}. Contracts are locked: extend an assistant in his final season (at his ask then), and letting him go costs ${Math.round(Coaches.CFG.contract.buyout*100)}% of what's left on his deal${m.offseason?"":", on top of this season's pay"}.
        ${STF.msg?`<br><b style="color:var(--${STF.kind==="err"?"red":"green"})">${STF.msg}</b>`:""}</p>
    </div>
    <div class="card"><h2>Job security</h2>
      ${fireable ? `<div class="row" style="gap:18px;align-items:center;margin-bottom:8px">
        <div><div class="big" style="color:${secColor(sec)}">${Math.round(sec)}</div><div class="hint">of 100</div></div>
        <div style="flex:1"><div class="moneybar"><i style="width:${sec}%;background:${secColor(sec)}"></i></div>
          <div class="hint" style="margin-top:4px"><b style="color:${secColor(sec)}">${Coaches.securityWord(sec)}</b>${(h.tenure||0) < C.security.grace ? ` · new hire: safe for ${C.security.grace-(h.tenure||0)} more season${C.security.grace-(h.tenure||0)===1?"":"s"}` : ""}</div></div></div>
        <p class="hint" style="margin:0">For a ${League.grade(t.prestige)} program the athletic director expects about <b>.${String(Math.round(expW*10)).padStart(3,"0")}</b> and ${expPost}. Beat it and security climbs; miss and it falls. At 0 you're fired.</p>`
        : `<p class="hint">Job security is off for this dynasty: you can't be fired.</p>`}
      ${repBlock(h)}
      <div class="kv" style="margin-top:10px">
        <span class="k">Contract</span><span>${money$(h.salary||0)} a season · ${h.contract||0} season${h.contract===1?"":"s"} left (re-signs automatically at the school's new number)</span>
        <span class="k">At ${t.abbr}</span><span>${h.tenure||0} season${h.tenure===1?"":"s"}</span>
        <span class="k">Career</span><span>${h.careerW||0}-${h.careerL||0}${(h.hist||[]).length>1?` · ${h.hist.map(x=>x.team).join(" → ")}`:""}</span>
      </div>
    </div></div>
    <div class="card"><h2>Available coaches — ${pool.length}</h2>
      <div class="row" style="margin-bottom:8px">
        ${[["","All"],["young","Young (35 and under)"],["head","Former head coaches"]].map(([k,l])=>`<button class="quiet ${STF.role===k?"on":""}" onclick="STF.role='${k}';render()">${l}</button>`).join("")}
        <span class="hint" style="margin-left:auto">${open?"Hire puts him in your empty chair for the contract length above.":"Both chairs are filled: let someone go to hire."}</span>
      </div>
      <table><thead><tr><th class="l">Coach</th>${TH("age","Age")}${TH("ovr","OVR")}${CK().map(k=>TH(k,shortL[k])).join("")}<th class="l">Last job</th>${TH("ask","Asks")}<th></th></tr></thead>
      <tbody>${list.slice(0, STF.show).map(c=>`<tr><td class="l">${coachLine(c)}${c.left?` <span class="hint" style="font-size:11px">· ${c.left}</span>`:""}</td><td>${c.age}</td><td><b>${Coaches.ovr(c)}</b></td>${CK().map(k=>`<td>${rCell(c[k])}</td>`).join("")}
        <td class="l hint">${lastJob(c)||"—"}</td><td>${money$(Coaches.ask(c))}</td>
        <td><button class="quiet" style="padding:3px 9px;font-size:11px" ${open?"":"disabled"} onclick="stfHire('${c.id}')">Hire</button></td></tr>`).join("")}</tbody></table>
      ${list.length > STF.show ? `<button class="quiet" style="margin-top:8px" onclick="STF.show+=40;render()">Show more</button>` : ""}
    </div>`;
}
/* your reputation: what schools hire on (coaches.js) */
function repBlock(c){
  const R = Coaches.CFG.reputation, rep = Coaches.reputation(c), log = (c.repLog || []).slice().reverse();
  const upTo = rep >= R.anySchool ? 99 : rep + R.needBelow;   // the most prestigious school that wants you
  const POST = { 0: "", 1: "tournament", 2: "Final Four", 3: "title game", 5: "national title" };
  return `<div style="margin-top:12px"><div class="row" style="gap:18px;align-items:center">
      <div><div class="big">${rep}</div><div class="hint">reputation</div></div>
      <div class="hint" style="flex:1">What schools hire on: your last ${R.weights.length} seasons, newest counting most. ${rep >= R.anySchool ? "<b>Any school</b> with an opening would hire you." : `Openings at schools up to about <b>${League.grade(upTo)}</b> prestige (${upTo}) would hire you.`}
        ${log.length ? `<div style="font-size:11px;margin-top:3px">${log.map(x => `${x.y}: .${String(Math.round(x.pct*1000)).padStart(3,"0")}${POST[x.post] ? ", " + POST[x.post] : ""}${x.coy ? ", Coach of the Year" : ""}`).join(" · ")}</div>` : `<div style="font-size:11px;margin-top:3px">No seasons yet: a new coach starts at ${R.neutral}.</div>`}</div>
    </div></div>`;
}
function stfSort(k){ if(STF.sort===k) STF.dir*=-1; else { STF.sort=k; STF.dir=(k==="ask"||k==="age")?1:-1; } render(); }
function stfSay(res, ok){ STF.msg = res.ok ? ok : res.why; STF.kind = res.ok ? "ok" : "err"; render(); }
function stfHire(id){ const res = Coaches.hire(LG, me(), id, null, STF.years); stfSay(res, res.ok ? `Hired ${res.coach.name}: ${money$(res.pay)} a season for ${res.years} season${res.years===1?"":"s"}.` : ""); if(CARD===null&&$("cardBg").classList.contains("show")) closeCard(); }
function stfFire(i){ const a = me().staff[i]; if(!a) return; const b = Coaches.buyout(LG, a);
  if(!confirm(`Let ${a.name} go?${LG.offseason&&LG.offseason.settled?"":" This season's pay is already spent."}${b?` His buyout is ${money$(b)} (half of what's left on his deal).`:""}`)) return;
  const res = Coaches.fire(LG, me(), i); stfSay(res, res.ok ? `${a.name} is gone${res.buyout?` (buyout ${money$(res.buyout)})`:""}; a grad assistant fills in until you hire someone.` : ""); }
function stfExtend(i){ const res = Coaches.extend(LG, me(), i, STF.years); stfSay(res, res.ok ? `Extended: ${res.years} more season${res.years===1?"":"s"} at ${money$(res.pay)} a season, starting when his current deal ends.` : ""); }

/* any coach's card: ratings, job, history */
function openCoach(id){
  const f = Coaches.findCoach(LG, id); if(!f) return;
  const c = f.c, t = f.team;
  const bar = (label,v) => `<div class="rline"><span class="lbl">${label}</span><span class="rbar"><b class="${v>=75?"":v>=55?"mid":"low"}" style="width:${v}%"></b></span><span style="text-align:right;font-weight:700">${v}</span></div>`;
  const where = t ? `${f.slot < 0 ? "Head coach" : "Assistant"}, ${t.name}${t.isUser?" (your staff)":""}` : `Available${c.left?` (${c.left})`:""}`;
  const canHire = !t && me().staff.some(a => !a);
  $("cardBox").innerHTML = `<div class="top"><div><div class="who">${c.name}</div><div class="meta">${where} · age ${c.age} · overall ${Coaches.ovr(c)}</div></div><button class="close" onclick="closeCard()">×</button></div>
    <div class="kv">
      ${t?`<span class="k">Contract</span><span>${money$(c.salary||0)} a season · ${c.contract} season${c.contract===1?"":"s"} left</span>`:`<span class="k">Asks</span><span>${money$(Coaches.ask(c))} as an assistant · ${money$(Coaches.ask(c,"head"))} as a head coach</span>`}
      ${f.slot<0&&t?`<span class="k">Job security</span><span style="color:${secColor(c.security??60)}">${Coaches.securityWord(c.security)} (${Math.round(c.security??60)})</span>`:""}
      <span class="k">Head coaching</span><span>${c.years||0} season${c.years===1?"":"s"}${c.careerW+c.careerL?` · ${c.careerW}-${c.careerL}`:""}</span>
      <span class="k">Runs</span><span>${TUNING.styles.offense[c.offense]?TUNING.styles.offense[c.offense].label:"—"} / ${TUNING.styles.defense[c.defense]?TUNING.styles.defense[c.defense].label:"—"}</span>
    </div>
    ${awardsLine(c.awards)}
    <div class="rgrid" style="grid-template-columns:1fr">${CK().map(k=>bar(CL(k),c[k])).join("")}</div>
    ${f.slot<0&&t?`<div class="sect">Staff at ${t.abbr}</div>
      ${t.staff.map(a=>`<div class="res"><span class="sc">Asst.</span><span>${a?`<span class="editable" onclick="openCoach('${a.id}')">${a.name}</span> <span class="hint">${Coaches.ovr(a)} ovr</span>`:`<span class="hint">${Coaches.CFG.grad.name}</span>`}</span><span></span></div>`).join("")}
      <div class="hint" style="margin-top:4px">Staff ratings: ${CK().map(k=>`${CL(k)} ${Coaches.rating(t,k)}`).join(" · ")} · program prestige ${League.grade(t.prestige)}</div>`:""}
    ${(c.hist||[]).length?`<div class="sect">Career</div>${c.hist.slice().reverse().map(x=>`<div class="res"><span class="sc">${x.from??"—"}–${x.to??"now"}</span><span>${x.role==="head"?"Head coach":"Assistant"}, ${x.team}</span><span class="sc">${x.w}-${x.l}</span></div>`).join("")}`:""}
    ${canHire?`<div class="row" style="margin-top:10px"><button onclick="stfHire('${c.id}')">Hire as your assistant (${STF.years} yr, ${money$(Coaches.ask(c))})</button></div>`:""}`;
  CARD = null; $("cardBg").classList.add("show");
}

/* ==================== THE CAROUSEL (offseason, first) ==================== */
function vCarousel(){
  const car = LG.offseason.carousel, rv = car.review, t = me();
  const nameOf = (id) => id ? LG.byId[id].name : "";
  const mineGone = car.departures.filter(d => d.role === "asst" && (d.teamId === (car.formerTeam || t.id)));
  const whyCls = (w) => w === "fired" ? "var(--red)" : w === "retired" ? "var(--muted)" : "var(--amber)";
  const myCoach = car.userCoach || t.coach, rep = Coaches.reputation(myCoach);
  const mustMove = car.userFired && !car.newJob;
  let html = "";
  if (mustMove) {
    html += `<div class="card" style="border-top:3px solid var(--red)"><h2>You've been fired</h2>
      <p style="margin:0">${nameOf(car.formerTeam)} went .${String(Math.round(rv.pct*10)).padStart(3,"0")} against an expected .${String(Math.round(rv.expectWin*10)).padStart(3,"0")}, and your job security ran out. Pick your next job from the schools that want you below.</p></div>`;
  } else if (car.newJob) {
    html += `<div class="card" style="border-top:3px solid var(--gold)"><h2>New job: ${t.name}</h2><p class="hint" style="margin:0">${car.userFired?`You were let go by ${nameOf(car.formerTeam)}`:`You left ${nameOf(car.formerTeam)}`} and took over at ${t.name}: ${money$(t.coach.salary)} a season for ${t.coach.contract} seasons. Your coach kept his ratings, points and record; ${t.name}'s players, money, recruits and pipelines are now yours. Your old assistants stayed behind.</p></div>`;
  } else if (rv) {
    html += `<div class="card"><h2>Your review — ${t.name}</h2>
      <div class="res aw"><span class="sc">Record</span><span>.${String(Math.round(rv.pct*10)).padStart(3,"0")} against an expected .${String(Math.round(rv.expectWin*10)).padStart(3,"0")} · ${rv.post==="—"?"no tournament":rv.post}</span></div>
      ${rv.canBeFired?`<div class="res aw"><span class="sc">Job security</span><span><b style="color:${secColor(rv.after)}">${Math.round(rv.before)} → ${Math.round(rv.after)}</b> · ${Coaches.securityWord(rv.after)}${rv.tenure<Coaches.CFG.security.grace?" (new hire: safe for now)":""}</span></div>`:`<p class="hint">Job security is off: you can't be fired.</p>`}
      ${(car.renewed||[]).filter(r=>r.teamId===t.id).map(r=>`<div class="res aw"><span class="sc">Contract</span><span>Re-signed for ${r.years} seasons at ${money$(r.salary)} a season</span></div>`).join("")}
    </div>`;
  }
  // every open head job, and whether it would hire you
  const jobs = car.jobs || [];
  const open = jobs.filter(j => j.interested).length;
  html += `<div class="card"><h2>Open jobs — ${jobs.length} <span class="hint" style="text-transform:none;letter-spacing:0;font-weight:400;margin-left:8px">your reputation <b style="color:var(--ink)">${rep}</b>${car.newJob?"":` · ${open} interested in you`}</span></h2>
    ${jobs.map(j => { const o = LG.byId[j.teamId], hl = o.history[o.history.length-1], d = car.departures.find(x => x.teamId === j.teamId && x.role === "head");
      return `<div class="res ${j.interested&&!car.newJob?"mine":""}"><span class="sc"><span class="grade ${League.grade(o.prestige)}">${League.grade(o.prestige)}</span></span>
        <span><b>${o.name}</b> <span class="hint">${conf(o.conf).name} · ${Geo.label(o.city)}</span>
          <div class="hint" style="font-size:11px">last season ${hl?hl.w+"-"+hl.l:"—"}${hl&&hl.postseason&&hl.postseason!=="—"?` (${hl.postseason})`:""} · NIL ${League.grade(o.nil)} · facilities ${League.grade(o.facilities)} · ${d?`${d.name} <span style="color:${whyCls(d.why)}">${d.why}</span>`:"open"} · pays up to ${money$(Coaches.budget(o,"head"))}</div></span>
        <span>${car.newJob ? "" : j.interested ? `<button onclick="carTake('${j.teamId}')">Take the job</button>` : `<span class="hint" title="Reputation this school wants in its next coach">needs ${j.need}</span>`}</span></div>`; }).join("") || `<p class="hint">No head jobs open this year.</p>`}
    <p class="hint" style="margin:8px 0 0">${mustMove ? "You must take one of the jobs that want you." : car.newJob ? "" : "Taking a job moves you there: your coach comes with you, the roster, money and recruits are the new school's, and your old job opens for the AI schools. Or continue and stay put."}
      Schools hire on reputation: your last 4 seasons (record, tournament runs, Coach of the Year). The more prestigious the school, the more it wants; ${Coaches.CFG.reputation.anySchool}+ and anyone will take you.</p></div>
  <div class="g"><div class="card"><h2>Your assistants</h2>
      ${mineGone.map(d=>`<div class="res mine"><span class="sc">${d.why}</span><span>${d.name}</span><span></span></div>`).join("")||`<p class="hint">Nobody left your staff.</p>`}
      <p class="hint" style="margin:8px 0 0">${car.departures.filter(d=>d.role==="asst").length} assistants left their jobs league-wide (contracts up or retired). Good assistants, yours included, can be hired away as head coaches.</p></div>
    <div class="card"><h2>Next</h2><p class="hint" style="margin:0">The open jobs are filled best school first: each takes the best coach it can afford, from the available coaches or another school's assistants.</p></div></div>
  <div class="row" style="margin-top:4px"><button ${mustMove?"disabled":""} onclick="carHire()">${car.newJob?"Continue: schools hire":"Stay and continue: schools hire"}</button></div>`;
  // the same button at the top too, so a long page doesn't need scrolling
  return `<div class="row topNext"><button ${mustMove?"disabled":""} onclick="carHire()">${car.newJob?"Continue: schools hire":"Stay and continue: schools hire"}</button></div>` + html;
}
function vHiring(){
  const car = LG.offseason.carousel, t = me();
  const heads = car.hires.filter(h => h.role === "head");
  const open = t.staff.some(a => !a);
  return `<div class="row topNext"><button onclick="carDone()">Continue to roster decisions</button></div><div class="g"><div class="card"><h2>New head coaches — ${heads.length}</h2>
      ${heads.map(h=>`<div class="res ${h.teamId===t.id?"mine":""}"><span class="sc">${LG.byId[h.teamId].abbr}</span><span>${coachLine({id:h.id,name:h.name})} <span class="hint">${h.ovr} ovr · ${money$(h.salary)}</span></span><span class="sc">${h.moved?`moved up from ${LG.byId[h.from].abbr}`:h.from?`promoted from ${LG.byId[h.from].abbr}`:"hired"}</span></div>`).join("")||`<p class="hint">No openings this year.</p>`}</div>
    <div class="card"><h2>Your staff for ${LG.season+1}-${String(LG.season+2).slice(2)}</h2>
      ${(car.poached||[]).map(p=>`<div class="res mine"><span class="sc">Poached</span><span>${p.name} is the new head coach at ${LG.byId[p.to].name}</span><span></span></div>`).join("")}
      ${t.staff.map((a,i)=>`<div class="res"><span class="sc">#${i+1}</span><span>${a?`${coachLine(a)} <span class="hint">${Coaches.ovr(a)} ovr · ${a.contract} season${a.contract===1?"":"s"} left</span>`:`<span class="hint">empty (grad assistant)</span>`}</span><span></span></div>`).join("")}
      <p class="hint" style="margin:8px 0 0">${open?`You have an open chair. Hire from the <span class="editable" onclick="go('staff')">Staff tab</span> now or any time during the season.`:"Both chairs are filled."} ${car.hires.filter(h=>h.role==="asst").length} assistant jobs were filled around the league.</p></div></div>
    <div class="row" style="margin-top:4px"><button onclick="carDone()">Continue to roster decisions</button>${open?` <button class="quiet" onclick="go('staff')">Hire an assistant first</button>`:""}</div>`;
}
function carTake(id){
  const car = LG.offseason.carousel, o = LG.byId[id];
  if (!car.userFired && !confirm(`Leave ${me().name} for ${o.name}? Your roster, recruits and assistants stay behind.`)) return;
  const res = Coaches.takeJob(LG, id); if(!res.ok){ alert(res.why); return; }
  STF.msg = "";   // a new school: no leftover staff messages
  LOG.unshift(`You're the new head coach at ${res.team.name}.`); render();
}
function carHire(){ const res = Offseason.finishCarousel(LG); if(res && res.ok===false){ alert(res.why); return; } TAB="offseason"; render(); }
function carDone(){ LG.offseason.stage = "decisions"; TAB="offseason"; render(); }
