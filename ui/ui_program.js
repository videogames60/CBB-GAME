/* HOOPS DYNASTY UI — Program tab: NIL and the bank, facilities, coach ratings.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ==================== PROGRAM ==================== */
/* "Collective $4.2M + carried over $300k = $4.5M this cycle" */
function bankLine(m){
  if(m.offseason) return `Offseason: everything is paid from your bank, <b>${m.bank<0?"−"+money$(-m.bank):money$(m.bank)}</b>${m.raises?` (−${money$(m.raises)} in raises you've offered)`:""}${m.refunds?` (+${money$(m.refunds)} back from players you pushed out)`:""}. Same number on every offseason screen.`;
  if(m.debt) return `Collective <b>${money$(m.collective)}</b> − debt <b style="color:var(--red)">${money$(m.debt)}</b> = <b>${money$(m.collective-m.debt)}</b> this cycle`;
  if(m.carry) return `Collective <b>${money$(m.collective)}</b> + carried over <b style="color:var(--green)">${money$(m.carry)}</b> = <b>${money$(m.total)}</b> this cycle`;
  return `Collective <b>${money$(m.collective)}</b> this cycle`;
}
/* what the offseason did to the bank */
function bankResult(r){
  if(!r) return "";
  if(r.debt) return `<b style="color:var(--red)">−${money$(r.debt)} debt</b> going into next cycle${r.interest?` (includes ${money$(r.interest)} interest)`:""}`;
  const paid = r.paidOff ? " · debt paid off" : "";
  if(r.carried) return `<b style="color:var(--green)">${money$(r.carried)}</b> carried over to next cycle${r.lost?` · ${money$(r.lost)} over the ${money$(Program.CFG.bank.cap)} cap was lost`:""}${paid}`;
  return "Every dollar used" + paid;
}
const PRG = { msg: "", kind: "" };
function vProgram(){
  const t = me(), m = Recruiting.money(LG, t), C = Program.CFG.coach, F = Program.CFG.facilities;
  const grade = (v) => `<span class="grade ${League.grade(v)}">${League.grade(v)}</span>`;
  const bar = Program.nilBar(t);
  const last = LG.lastOffseason?.program?.teams?.[t.id];
  const costN = (n) => Program.upgradeCost(t, n);
  const over = m.free < 0;
  const coachRow = (k) => `<div class="rline" style="grid-template-columns:96px 1fr 44px 120px"><span class="lbl">${C.labels[k]}</span>
      <span class="rbar"><b class="${t.coach[k]>=75?"":t.coach[k]>=55?"mid":"low"}" style="width:${t.coach[k]}%"></b></span>
      <span style="text-align:right;font-weight:700">${t.coach[k]}</span>
      <span class="row" style="gap:4px;justify-content:flex-end">${[1,5].map(n=>`<button class="quiet" style="padding:2px 8px;font-size:11px" ${(t.coach.points||0)>0&&t.coach[k]<C.cap?"":"disabled"} onclick="prgCoach('${k}',${n})">+${n}</button>`).join("")}</span></div>`;
  const why = (bits) => bits.map(([l,v])=>`${l} +${v}`).join(" · ");
  return `<div class="g">
  <div class="card"><h2>NIL & boosters</h2>
    <div class="row" style="gap:24px">
      <div><div class="big">${grade(t.nil)} <span class="hint" style="font-size:13px">${t.nil}</span></div><div class="hint">NIL grade</div></div>
      <div><div class="big">${money$(t.collective||0)}</div><div class="hint">collective this cycle</div></div>
      <div><div class="big" style="color:${m.debt?"var(--red)":m.carry?"var(--green)":"var(--ink)"}">${m.debt?"−"+money$(m.debt):"+"+money$(m.carry)}</div><div class="hint">${m.debt?`debt (${Math.round(Program.CFG.bank.debtInterest*100)}% a year)`:"carried over"}</div></div>
    </div>
    <p style="margin:10px 0 0">${bankLine(m)}</p>
    <p class="hint" style="margin:8px 0 0">To hold your grades this season: NIL ${League.grade(t.nil)} needs about a <b style="color:var(--ink)">.${String(Math.round(bar*10)).padStart(3,"0").slice(0,3)}</b> season, prestige ${grade(t.prestige)} about a <b style="color:var(--ink)">.${String(Offseason.prestigeBar(t)*10).padStart(3,"0").slice(0,3)}</b>. Unspent money carries over (up to ${money$(Program.CFG.bank.cap)}).</p>
    ${last?`<div class="sect">Last offseason</div><p class="hint" style="margin:0">NIL ${last.nil.before} → <b style="color:var(--ink)">${last.nil.after}</b> · record ${last.nil.record>0?"+":""}${last.nil.record} (needed .${String(last.nil.bar*10).padStart(3,"0").slice(0,3)})${last.nil.milestones.length?` · ${why(last.nil.milestones)}`:""}${last.nil.pull?` · boosters settling ${last.nil.pull>0?"+":""}${last.nil.pull}`:""}</p>${last.money?`<p class="hint" style="margin:4px 0 0">Money: ${bankResult(last.money)}</p>`:""}`:""}
  </div>
  <div class="card"><h2>Facilities</h2>
    <div class="row" style="gap:24px">
      <div><div class="big">${grade(t.facilities)} <span class="hint" style="font-size:13px">${t.facilities}</span></div><div class="hint">facilities</div></div>
      <div><div class="big" style="color:${over?"var(--red)":"var(--ink)"}">${money$(m.free)}</div><div class="hint">money free</div></div>
    </div>
    <p class="hint" style="margin:10px 0 0">Speeds up development and helps your development pitch. Wears down about ${Math.round(F.decayBase + Math.max(0,t.facilities-F.decayAbove)/F.decayPer)} a year at this level.</p>
    <div class="row" style="margin-top:10px">
      ${[1,3,5].map(n=>`<button class="${n===1?"":"quiet"}" ${!over&&costN(n)<=m.free&&t.facilities+n<=F.ceiling?"":"disabled"} onclick="prgFac(${n})">+${n} · ${money$(costN(n))}</button>`).join("")}
    </div>
    ${t.facSpent?`<p class="hint" style="margin:6px 0 0">Spent on facilities this cycle: ${money$(t.facSpent)}</p>`:""}
    ${last&&last.facilityDecay?`<p class="hint" style="margin:6px 0 0">Wore down ${last.facilityDecay} last offseason.</p>`:""}
  </div></div>
  <div class="card"><h2>${t.coach.name} — coach ratings</h2>
    <div class="row" style="gap:24px;margin-bottom:8px">
      <div><div class="big" style="color:${t.coach.points?"var(--gold)":"var(--ink)"}">${t.coach.points||0}</div><div class="hint">points to spend</div></div>
      <div style="align-self:center"><button class="quiet" ${(t.coach.points||0)>0?"":"disabled"} onclick="prgAuto()">Auto-spend</button></div>
    </div>
    ${C.keys.map(coachRow).join("")}
    ${last?`<p class="hint" style="margin:4px 0 0">Last season: +${last.coachPoints.total} (${why(last.coachPoints.bits)})</p>`:""}
    <p class="hint" style="margin:4px 0 0">These are yours alone; the game uses the staff's (you plus two assistants): <span class="editable" onclick="go('staff')">Staff tab</span>.</p>
    <div class="rmsg ${PRG.kind}">${PRG.msg}</div>
  </div>` + vPipelines(t);
}
/* your recruiting footprint: home area, the areas that count, the ones fading */
function vPipelines(t){
  const d = Pipelines.describe(t), C = Pipelines.CFG;
  const row = (r) => `<div class="rline" style="grid-template-columns:200px 1fr 44px 120px"><span class="lbl">${r.name}${r.status==="home"?` <span class="pill">home</span>`:""}</span>
      <span class="rbar"><b class="${r.strength>=70?"":r.strength>=45?"mid":"low"}" style="width:${r.strength}%"></b></span>
      <span style="text-align:right;font-weight:700">${r.strength}</span><span class="hint" style="text-align:right">${r.level}${r.status==="fading"?" · fading":""}</span></div>`;
  const counted = d.rows.filter(r=>r.status!=="fading"), fading = d.rows.filter(r=>r.status==="fading");
  return `<div class="card"><h2>Pipelines — ${d.used} of ${d.slots} slots${t.city?` · ${Geo.label(t.city)}`:""}</h2>
    ${counted.map(row).join("")}
    ${fading.length?`<div class="sect" style="margin-top:8px">Fading (beyond your slots)</div>${fading.map(row).join("")}`:""}
    <p class="hint" style="margin:8px 0 0">Home never drops below ${d.floor}. Developing ${C.levels[2][0]}+ · Established ${C.levels[1][0]}+ · Strong ${C.levels[0][0]}+. See them on the <span class="editable" onclick="go('map')">Map</span>.</p>
  </div>`;
}
function prgSay(res, ok){ PRG.msg = res.ok ? ok : res.why; PRG.kind = res.ok ? "ok" : "err"; render(); }
function prgFac(n){ const res = Program.buyFacilities(LG, me(), n); prgSay(res, res.ok ? `Facilities up to ${res.level} for ${money$(res.cost)}.` : ""); }
function prgCoach(k,n){ const res = Program.spendCoach(me(), k, n); prgSay(res, res.ok ? `${Program.CFG.coach.labels[k]} +${res.spent}.` : ""); }
function prgAuto(){ Program.autoSpendCoach(me()); prgSay({ok:true}, "Points spent."); }

/* signing-day heads-up: once near the end of the regular season, once at Selection Sunday */
function signingWarning(){
  const R = LG && LG.recruiting; if(!R || R.closed || !SE) return;
  const t = me(), spots = Recruiting.openSpots(LG, t);
  if(spots <= 0) return;
  const leading = R.pool.filter(r => r.status==="open" && Recruiting.standings(LG, r, SE).some(s=>s.teamId===t.id)
    && Recruiting.standingsSeen(LG, t, r, SE)[0].teamId===t.id).length;
  const stage = SE.post && SE.post.phase==="national" ? 2 : SE.day >= SE.lastDay - 10 ? 1 : 0;
  if(stage <= (R.warned||0)) return;
  R.warned = stage;
  if(leading >= spots) return;
  LOG.unshift(`<b style="color:var(--amber)">Signing day is coming</b> (after the title game): ${spots} open scholarship${spots>1?"s":""}, and you're leading for ${leading}. Empty spots become walk-ons.`);
}

