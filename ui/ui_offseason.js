/* HOOPS DYNASTY UI — The offseason: roster decisions, the transfer portal, the offseason report.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ==================== OFFSEASON ==================== */
function goOffseason(){
  // pressing it again must not burn another year — just show the page
  // pressing it again must not burn another year: part 1 runs once, then you make your roster decisions
  if(!LG.pendingReport && !LG.offseason) Offseason.beginOffseason(LG, SE);
  TAB="offseason"; render();
}
/* ==================== ROSTER DECISIONS (offseason) ==================== */
const DEC = { msg: "", kind: "" };
const DEC_REASON = { paycut: "pay cut", minutes: "minutes", outlook: "role next year", money: "money", winning: "losing", coach: "new coach", promise: "broken promise", locker: "locker room" };
const pctTxt = (x) => `${Math.round(x*100)}%`;
/* how much he grew this offseason (development runs before roster decisions and the portal) */
function devDelta(teamId, pid){ const d = LG.offseason?.part?.development?.[teamId]?.find(x=>x.id===pid) || LG.lastOffseason?.development?.[teamId]?.find(x=>x.id===pid); return d ? d.delta : null; }
const devChip = (teamId, pid) => { const d = devDelta(teamId, pid); return d ? `<span class="dev" title="Grew ${d} overall this offseason">+${d}</span>` : ""; };
const chanceCls = (c) => c >= 0.3 ? "var(--red)" : c >= 0.15 ? "var(--amber)" : "var(--green)";
const wantsLabel = (mw) => (mw||0) >= 0.6 ? "money first" : (mw||0) >= 0.3 ? "balanced" : "fit first";
const loyaltyWord = (l) => l>=75?"very loyal":l>=50?"steady":l>=30?"ambitious":"restless";
const loyaltyTxt = (p) => { const l = League.loyaltyOf(p); return `<span title="0–99: how much he sticks around. Higher = less likely to transfer (×${(Roster.CFG.loyalty.at0-Roster.CFG.loyalty.per*l).toFixed(2)} on his transfer chance)">Loyalty <b style="color:var(--${l>=60?"green":l>=35?"ink":"amber"})">${l}</b> (${loyaltyWord(l)})</span>`; };
const moneyCare = (p) => Math.round(99 * Math.max(0, Math.min(1, p.moneyWeight || 0)));
const moneyTxt = (p) => { const m = moneyCare(p); return `<span title="0–99: how much money matters to him. It raises his ask (up to +25% at 99) and how much being underpaid bothers him.">Money <b style="color:var(--${m>=60?"amber":"ink"})">${m}</b> (${wantsLabel(p.moneyWeight)})</span>`; };
const personality = (p) => `${loyaltyTxt(p)} · ${moneyTxt(p)}`;
/* next season's pay, said plainly: last season's, or the offer you've made */
function dealStatus(p){
  const dd = p.decision||{};
  if (dd.salary != null) return { next: dd.salary, isNew: true };
  return { next: p.salary||0 };
}
/* Next season's offer: white = same as last season, green = a raise, red = a pay cut */
function offerCells(p){
  const dd = p.decision||{}, last = p.lastSalary ?? p.salary ?? 0;
  const next = dd.salary != null ? dd.salary : (p.salary||0);
  return { next, col: next > last ? "var(--green)" : next < last ? "var(--red)" : "var(--ink)" };
}
/* his chance with no offer on the table (to show what an offer changes) */
function chanceWithout(t, p){
  const d = p.decision; if (!d || d.salary == null) return null;
  const keep = d.salary; delete d.salary;
  const c = Roster.transferOdds(LG, t, p).chance;
  d.salary = keep;
  return c;
}
/* his chance with no promise, and with a promise of m minutes (his deal offer stays as is) */
function promisePreview(t, p, m){
  const d = p.decision || (p.decision = {}), keep = d.promise;
  delete d.promise; const without = Roster.transferOdds(LG, t, p).chance;
  d.promise = m; const withP = Roster.transferOdds(LG, t, p).chance;
  if (keep == null) delete d.promise; else d.promise = keep;
  return { without, with: withP };
}
function decBudget(t){
  const OS = LG.offseason, pushed = new Set(OS.encouraged?.[t.id]||[]);
  const raises = t.players.reduce((s,p)=>s+Roster.bankCost(p),0);
  const refunds = t.players.filter(p=>pushed.has(p.id)).reduce((s,p)=>s+(p.salary||0),0);
  return { bank: t.bank||0, raises, refunds, after: Recruiting.money(LG, t).free, collective: Recruiting.collectiveFor(t) };
}
function vDecisions(){
  const t = me(), OS = LG.offseason, part = OS.part, pushed = new Set(OS.encouraged?.[t.id]||[]);
  const B = decBudget(t), d = part.departures[t.id];
  const rows = t.players.map(p=>({ p, o: Roster.transferOdds(LG, t, p) })).sort((a,b)=>b.o.chance-a.o.chance);
  const expected = rows.filter(x=>!pushed.has(x.p.id)).reduce((s,x)=>s+x.o.chance,0);
  const row = ({p,o}) => {
    const out = pushed.has(p.id), dd = p.decision||{};
    const top = o.parts.filter(x=>x.key!=="base"&&x.key!=="noise"&&Math.abs(x.shown)>=0.01).sort((a,b)=>b.shown-a.shown).slice(0,3);
    return `<tr style="${out?"opacity:.45":""}">
      <td class="l"><span class="editable" onclick="openCard('${p.id}')" title="Player card (use Decide for his deal)"><b>${p.name}</b></span> <span class="pill">${League.classLabel(p)} ${p.pos}</span>${dd.promise?` <span class="pill">promised ${dd.promise} min</span>`:""}${out?` <span class="pill">pushed out</span>`:""}</td>
      <td><b>${League.ovrOf(p)}</b>${devChip(t.id,p.id)} <span class="grade ${League.grade(p.potential)}">${League.grade(p.potential)}</span></td>
      <td>${money$(p.lastSalary ?? p.salary ?? 0)}</td>
      ${(()=>{ const c = offerCells(p); return `<td><b style="color:${c.col}">${money$(c.next)}</b></td>`; })()}
      <td class="hint" style="font-size:12px">${money$(Roster.askFor(p))}<div style="font-size:11px">fair ${money$(o.fair)}</div></td>
      <td>${Roster.ROLE_NAMES[o.next]}</td>
      <td style="text-align:left">${out?"—":top.map(x=>`<span class="pill" title="${x.label}" style="${x.shown<0?"color:var(--green)":""}">${DEC_REASON[x.key]||x.key} ${x.shown>0?"+":""}${Math.round(x.shown*100)}</span>`).join(" ")||`<span class="hint">content</span>`}</td>
      <td>${(()=>{ if(out) return `<b style="font-size:16px;color:var(--dim)">leaving</b>`; const was = chanceWithout(t,p);
        return `${was!=null&&Math.round(was*100)!==Math.round(o.chance*100)?`<span class="hint">${pctTxt(was)} → </span>`:""}<b style="font-size:16px;color:${chanceCls(o.chance)}">${pctTxt(o.chance)}</b>`; })()}</td>
      <td><button class="quiet" style="padding:3px 9px;font-size:11px" onclick="openDecision('${p.id}')">Decide</button></td></tr>`;
  };
  return `
  <div class="card"><h2>Roster decisions — before the transfer window</h2>
    ${d.drafted.length||(d.withdrew||[]).length?`<p style="margin:0 0 6px"><b>The draft:</b> ${[...d.drafted.map(p=>`${p.name} (${draftTag(p)})`), ...(d.withdrew||[]).map(p=>`${p.name} tested the waters and is back`)].join(" · ")}</p>`:""}
    <p class="hint" style="margin:0">Click a player to change his pay, promise minutes or push him out. Then run the transfer window (at most ${Roster.CFG.maxPerTeam} leave on their own).</p>
    <div class="row" style="gap:22px;margin-top:10px">
      <div><div class="big">${expected.toFixed(1)}</div><div class="hint">players expected to leave</div></div>
      <div><div class="big" style="color:${B.after<0?"var(--red)":"var(--ink)"}">${B.after<0?"−"+money$(-B.after):money$(B.after)}</div><div class="hint">bank after your changes${B.raises?` (raises ${money$(B.raises)})`:""}${B.refunds?` · +${money$(B.refunds)} back from pushed-out players`:""}</div></div>
      <div><div class="big">${money$(B.collective)}</div><div class="hint">next year's collective (NIL ${League.grade(t.nil)})</div></div>
      <div><div class="big">${pushed.size}/${Roster.CFG.maxEncourage}</div><div class="hint">pushed out (each one unsettles the roster a little)</div></div>
    </div>
    ${moneyBarHtml(Recruiting.money(LG, t))}
    <details style="margin:8px 0 0"><summary class="hint" style="cursor:pointer"><b style="color:var(--ink)">How deals work</b> (all amounts are per season)</summary>
      <ul class="hint" style="margin:4px 0 0 16px;padding:0">
        <li>Every returning player stays unless he transfers. A deal only sets his pay; it never keeps him from leaving.</li>
        <li><b>Pay is year to year.</b> Every offseason each player's pay is open again, and his fair pay is recalculated from his new ratings. A player who improves a lot is worth a lot more.</li>
        <li><b>Colors</b> (next season's pay): white = same as last season, <span style="color:var(--green)">green</span> = a raise you offered, <span style="color:var(--red)">red</span> = a pay cut.</li>
        <li><b>What he expects:</b> his ask is what the open market would pay him (fair pay, plus more if money matters to him). At 85% of it or more he's happy; under that his money complaint grows faster the further under he is, and a money-first player paid half his ask is very likely to leave.</li>
        <li><b>Offers, not signings:</b> he still decides in the transfer window. If he stays, your offer is his pay next season; if he leaves, nothing is paid. With no offer, he plays next season at the same pay.</li>
        <li><b>Money:</b> raises are paid from your bank now (next season's pay was already set aside when the books closed); anyone who leaves sends his pay back. Cuts save the difference but hurt, more the bigger the cut and the more money matters to him. Below zero is debt.</li>
        <li>Players who improve a lot are worth a lot more on the market. You won't be able to pay everyone; pay the ones you can't lose.</li>
      </ul></details>
    <div class="rmsg ${DEC.kind}">${DEC.msg}</div>
    <div class="row" style="margin-top:10px"><button onclick="finishDecisions()">Done — open the transfer window</button></div>
  </div>
  <div class="card"><table><thead><tr><th class="l">Player</th><th>OVR/Pot</th><th title="Per season">Paid last season</th><th title="What he'd be paid in ${LG.season+1}-${String(LG.season+2).slice(2)} if he stays. White: same as last season. Green: a raise you offered. Red: a pay cut.">${LG.season+1} offer</th><th title="What he'd sign for next season">Asks</th><th title="The coach's depth chart for next season (best five by position, then the bench), counting only players still here and your signed class. It's also what the player expects. It only affects his transfer chance; your rotation decides real minutes.">Projected role next year</th><th class="l">Why he'd leave</th><th>Chance</th><th></th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table></div>`;
}
function openDecision(id){ CARD=null; REC.open=null; DEC.open=id; DEC.cardMsg=""; drawDecision(); $("cardBg").classList.add("show"); }
function drawDecision(){
  const t = me(), p = t.players.find(x=>x.id===DEC.open); if(!p) return;
  const o = Roster.transferOdds(LG, t, p), dd = p.decision||{}, OS = LG.offseason;
  const out = (OS.encouraged?.[t.id]||[]).includes(p.id);
  const ask1 = Roster.askFor(p), cur = dd.salary ?? p.salary ?? 0;
  $("cardBox").innerHTML = `
    <div class="top"><div><div class="who">${p.name}</div>
      <div class="meta">${League.classLabel(p)} · ${p.pos} · ${League.ovrOf(p)} ovr · pot ${League.grade(p.potential)} · ${Roster.mpgOf(p).toFixed(1)} mpg last season</div>
      <div class="hint">${personality(p)}</div></div>
      <div style="display:flex;gap:12px;align-items:flex-start"><div class="ovrBig"><b style="color:${out?"var(--dim)":chanceCls(o.chance)}">${out?"out":pctTxt(o.chance)}</b><div class="sub">transfer chance</div></div>
      <button class="close" onclick="closeCard()">×</button></div></div>
    <div class="sect">Why</div>
    ${o.parts.filter(x=>Math.abs(x.shown)>=0.002).map(x=>`<div class="res"><span class="sc">${DEC_REASON[x.key]||(x.key==="base"?"baseline":x.key==="noise"?"mood":x.key)}</span><span>${x.label}</span><span class="sc" style="color:${x.shown<0?"var(--green)":"inherit"}">${x.shown>0?"+":""}${(x.shown*100).toFixed(1)}</span></div>`).join("")}
    <p class="hint" style="margin:4px 0 0">Already multiplied by: ${o.mults.map(m=>`${m.label} ×${m.m.toFixed(2)}`).join(" · ")}. Capped at ${pctTxt(Roster.CFG.cap)}.</p>
    <div class="sect">His deal</div>
    <p style="margin:0">Last season ${money$(p.lastSalary ?? p.salary ?? 0)} · next season <b>${money$(dealStatus(p).next)}</b>${dealStatus(p).isNew?" (your offer)":""}</p>
    <p class="hint" style="margin:2px 0 0">Fair pay ${money$(o.fair)} · he asks <b style="color:var(--ink)">${money$(ask1)}</b> · at <b style="color:var(--ink)">${money$(Math.round(ask1*Roster.CFG.money.tolerance/1000)*1000)}</b> or more he has no money complaint. It's an offer: he still decides in the transfer window.</p>
    <div class="row" style="margin-top:8px">
      <div><label>New pay (per season)</label>${moneyInput("decAmt", Math.round((dd.salary ?? Math.max(p.salary||0, ask1))/1000)*1000)}</div>
      <button onclick="decDeal()">Make offer</button>
      ${dd.salary!=null?`<button class="quiet" onclick="decClear()">Take it back</button>`:""}
    </div>
    <p class="hint" style="margin:4px 0 0">Below his current pay is a pay cut: a 10% cut adds about ${Math.round((Roster.CFG.money.payCut+Roster.CFG.money.payCutRate*0.1)*(0.6+0.8*(p.moneyWeight||0))*100)} to his chance before multipliers, a 30% cut about ${Math.round((Roster.CFG.money.payCut+Roster.CFG.money.payCutRate*0.3)*(0.6+0.8*(p.moneyWeight||0))*100)}.</p>
    <div class="sect">Promise minutes next season</div>
    <div class="row"><div><label>Minutes per game</label><input type="number" id="decPromise" min="5" max="36" value="${dd.promise||""}" placeholder="—" style="width:80px"></div>
      <button class="quiet" onclick="decPromise()">${dd.promise?"Change":"Promise"}</button>${dd.promise?`<button class="quiet" onclick="decPromise(0)">Take it back</button>`:""}</div>
    <p class="hint" style="margin:4px 0 0">${(()=>{ const W = Roster.wantedMinutes(o.role,o.next), half = Math.ceil(W*Roster.CFG.promiseFloor);
      const pv = promisePreview(t, p, W);
      return `He wants about <b style="color:var(--ink)">${W}</b> minutes; under ${half} a promise does nothing. <b style="color:var(--ink)">Promising ${W}: ${pctTxt(pv.without)} → ${pctTxt(pv.with)}</b>.`; })()} Miss it by more than ${Roster.CFG.promiseSlack} a game and he's very likely gone next year.</p>
    <div class="sect">Push him out</div>
    <button class="quiet ${out?"on":""}" onclick="decPush(${!out})">${out?"Pushed out — undo":"Encourage him to transfer"}</button>
    <p class="hint" style="margin:4px 0 0">He leaves for sure and his salary comes back; teammates' chances rise a little. ${Roster.CFG.maxEncourage} a year at most.</p>
    <div class="rmsg ${DEC.cardKind||""}">${DEC.cardMsg||""}</div>`;
}
function decSay(res, ok){ DEC.cardMsg = res.ok ? ok : res.why; DEC.cardKind = res.ok ? "ok" : "err"; drawDecision(); render(); }
function decDeal(){ const t=me(), p=t.players.find(x=>x.id===DEC.open); const res=Roster.setDeal(LG,t,p,+$("decAmt").value||0); decSay(res, res.ok?`Offer made: ${money$(p.decision.salary)} for ${LG.season+1}. If he stays, it's his pay; if he transfers, nothing is paid.`:""); }
function decClear(){ const t=me(), p=t.players.find(x=>x.id===DEC.open); Roster.clearDeal(p); decSay({ok:true}, "Offer taken back: he's on his current pay."); }
function decPromise(v){ const t=me(), p=t.players.find(x=>x.id===DEC.open); const m = v===0?0:(+$("decPromise").value||0); Roster.promise(LG,t,p,m); decSay({ok:true}, m?`Promised ${p.decision.promise} minutes a game.`:"Promise taken back."); }
function decPush(on){ const t=me(), p=t.players.find(x=>x.id===DEC.open); const res=Roster.encourage(LG,t,p,on); decSay(res, on?`${p.name} will transfer.`:"He stays (for now)."); }
function finishDecisions(){
  const t=me(), B=decBudget(t);
  if(B.after<0 && !confirm(`These raises put your bank at −${money$(-B.after)}: that's debt (10% interest, and no new offers until you're back in the black). Go ahead?`)) return;
  Offseason.transferWindow(LG, SE);
  const gone = (LG.offseason.transfers[t.id]||[]).length;
  LOG.unshift(`Transfer window: ${gone?`${gone} player${gone>1?"s":""} left ${t.name}`:"nobody left"}. The portal is open (${LG.portal.pool.length} players).`);
  DEC.msg=""; PRT.filter="open"; render();
}
/* ==================== TRANSFER PORTAL (offseason) ==================== */
const PRT = { filter: "open", pos: "", sort: "rank", dir: 1, open: null, msg: "", kind: "" };
function portalNews(){
  const PTL = LG.portal; if(!PTL) return;
  const t = me(), mine = PTL.news.filter(n=>n.teamId===t.id);
  PTL.newsSeen = PTL.newsSeen||0;
  mine.slice(0, Math.max(0, mine.length-PTL.newsSeen)).reverse().forEach(n=>LOG.unshift(`<span style="color:${NEWS_STYLE[n.kind]||"var(--dim)"}">Portal:</span> ${n.text}`));
  PTL.newsSeen = mine.length;
  PTL.logSeen = PTL.logSeen||0;
  const fresh = PTL.log.slice(0, Math.max(0, PTL.log.length-PTL.logSeen)).reverse();
  for(const e of fresh){ const r = e.recruitId && PTL.pool.find(x=>x.id===e.recruitId);
    if(!r){ LOG.unshift(e.text); continue; }
    const it = r.interest[t.id];
    if(e.teamId===t.id) LOG.unshift(`<b style="color:var(--green)">Portal commit!</b> ${e.text}`);
    else if(it && (it.offer||it.watch||it.roundPts)) LOG.unshift(`<span style="color:var(--amber)">Lost a portal target:</span> ${e.text}`); }
  PTL.logSeen = PTL.log.length;
}
/* how a player left for the pros: "Rd 1 · #12", or declared and went undrafted */
const draftTag = (p) => p.undrafted ? "declared, undrafted" : p.pick ? `drafted Rd ${p.round} · #${p.pick}` : "went pro";

/* who's coming and going this offseason (portal screen + roster tab) */
function movesHtml(t){
  const OS = LG.offseason; if(!OS) return "";
  const dep = OS.part?.departures?.[t.id] || {graduated:[],drafted:[]}, tr = OS.transfers?.[t.id] || [];
  const hs = LG.recruiting ? LG.recruiting.pool.filter(r=>r.status==="committed"&&r.commitTo===t.id) : [];
  const pt = LG.portal ? LG.portal.pool.filter(r=>r.status==="committed"&&r.commitTo===t.id) : [];
  const line = (pill, name, extra, right) => `<div class="res"><span class="pill">${pill}</span><span>${name}${extra?` <span class="hint" style="font-size:11px">${extra}</span>`:""}</span><span class="sc">${right}</span></div>`;
  return `<div class="sect" style="margin-top:0">Coming next season</div>
    ${hs.map(r=>line(r.pos, `${r.name} <span class="stars">${starStr(r.stars)}</span>`, `#${r.rank} recruit`, `${bandTxt(sv(r).ovr)} / ${gradeBand(sv(r).pot)} · ${money$(r.deal)}`)).join("")}
    ${pt.map(r=>line(r.pos, `<span class="editable" onclick="openPortal('${r.id}')">${r.name}</span>`, `portal, from ${LG.byId[r.from].abbr}`, `${r.ovr} / ${League.grade(r.potential)} · ${money$(r.deal)}`)).join("")}
    ${!hs.length&&!pt.length?`<p class="hint">Nobody signed yet.</p>`:""}
    <div class="sect">Leaving</div>
    ${dep.graduated.map(p=>line(p.pos, p.name, "graduated", `${p.ovr} ovr`)).join("")}
    ${dep.drafted.map(p=>line(p.pos, p.name, draftTag(p), `${p.ovr} ovr`)).join("")}
    ${tr.map(p=>{ const r = LG.portal && LG.portal.pool.find(x=>x.id===p.id); const dest = r && r.status==="committed" ? ` → ${LG.byId[r.commitTo].abbr}` : "";
      return line(p.pos, r?`<span class="editable" onclick="openPortal('${p.id}')">${p.name}</span>`:p.name, `transferred${dest} · ${p.why==="encouraged"?"pushed out":`${(p.reasons||[]).map(k=>DEC_REASON[k]||k).join(", ")||"his own call"}${p.chance!=null?` · <span title="His transfer chance when the window opened">${pctTxt(p.chance)} chance</span>`:""}`}`, `${p.ovr} ovr · ${p.mpg} mpg`); }).join("")}
    ${!dep.graduated.length&&!dep.drafted.length&&!tr.length?`<p class="hint">Nobody.</p>`:""}`;
}
function vPortal(){
  const t = me(), PTL = LG.portal, F = money$;
  const sp = Portal.spots(LG, t), free = Portal.free(LG, t), pts = PTL.pointsLeft[t.id]||0;
  const roundTxt = PTL.closed ? "closed" : `round ${PTL.round} of ${Portal.CFG.rounds}`;
  const mine = PTL.pool.filter(r=>r.status==="committed"&&r.commitTo===t.id);
  const hsCount = LG.recruiting ? LG.recruiting.pool.filter(r=>r.status==="committed"&&r.commitTo===t.id).length : 0;
  let rows = PTL.pool.map(r=>{ const it=r.interest[t.id]||{rel:Portal.CFG.relStart,offer:0}; const ev = r.status==="open" && !(r.from===t.id && r.why==="encouraged") ? Portal.evaluate(LG,t,r) : null;
    return { r, it, ev, price: ev ? r.asking/ev.mult : null, mine: !!(it.offer||it.watch||it.roundPts) }; });
  if(PRT.filter==="open") rows = rows.filter(x=>x.r.status==="open");
  if(PRT.filter==="board") rows = rows.filter(x=>x.mine||x.r.commitTo===t.id);
  if(PRT.filter==="afford") rows = rows.filter(x=>x.r.status==="open"&&x.price!=null&&x.price<=free+(x.it.offer||0));
  if(PRT.pos) rows = rows.filter(x=>x.r.pos===PRT.pos);
  const key = { rank:x=>x.r.rank, ovr:x=>x.r.ovr, pot:x=>x.r.potential, ask:x=>x.r.asking, price:x=>x.price??1e12, ppg:x=>x.r.ppg, yrs:x=>x.r.yearsLeft }[PRT.sort];
  rows.sort((a,b)=>(key(a)-key(b))*PRT.dir);
  const TH=(k,l)=>`<th class="sortable ${PRT.sort===k?"sorted":""}" onclick="prtSort('${k}')">${l}${PRT.sort===k?(PRT.dir>0?" ▲":" ▼"):""}</th>`;
  const fb=(k,l)=>`<button class="quiet ${PRT.filter===k?"on":""}" onclick="PRT.filter='${k}';render()">${l}</button>`;
  const status = (r) => {
    if(r.status==="committed") return r.commitTo===t.id?`<span class="chip you">signed with you</span>`:`<span class="chip">${LG.byId[r.commitTo].abbr}</span>`;
    if(r.status==="unsigned") return `<span class="gone">unsigned</span>`;
    if(r.from===t.id && r.why==="encouraged") return `<span class="hint">you pushed him out</span>`;
    const st = Portal.standings(LG, r); if(!st.length) return `<span class="gone">no offers</span>`;
    return st[0].teamId===t.id?`<span class="lead">you lead</span>${st.length>1?` <span class="hint">of ${st.length}</span>`:""}`:`<span class="trail">${LG.byId[st[0].teamId].abbr} leads</span> <span class="hint">of ${st.length}</span>`;
  };
  const why = (r) => (r.why==="encouraged"?["pushed out"]:(r.reasons||[]).map(k=>DEC_REASON[k]||k)).join(", ")||"—";
  return `<div class="g">
  <div class="card"><h2>Transfer portal — ${roundTxt}</h2>
    <div class="row" style="gap:22px">
      <div><div class="big" style="color:${free<0?"var(--red)":"var(--ink)"}">${free<0?"−"+F(-free):F(free)}</div><div class="hint">bank you can offer from</div></div>
      <div><div class="big">${sp}</div><div class="hint">open scholarships</div></div>
      <div><div class="big">${pts}<span class="hint" style="font-size:13px"> / ${Recruiting.weeklyPoints(t)}</span></div><div class="hint">points left this round</div>
        <label class="hint" style="display:flex;gap:5px;align-items:center;margin-top:4px;cursor:pointer" title="Each round, max out everyone on your portal board (offered or starred): offered players first, best overall first. Single players can be set to auto from their card."><input type="checkbox" ${t.portalAuto?"checked":""} onchange="prtAutoAll(this.checked)"> auto-recruit my whole board</label></div>
    </div>
    ${moneyBarHtml(Recruiting.money(LG, t))}
    <p class="hint" style="margin:6px 0 0">${PTL.closed?"The portal is closed.":PTL.round<Portal.CFG.rounds?`End of this round: about ${Math.round(Portal.CFG.commit.byRound[PTL.round-1]*100)}% of players with offers decide, then the other schools move.`:"Last round: closing the portal makes everyone left decide; anyone unsigned is gone."}</p>
    <div class="rmsg ${PRT.kind}">${PRT.msg}</div>
    <div class="row" style="margin-top:10px">
      ${PTL.closed?`<button onclick="finishPortal()">Finish the offseason</button>`:PTL.round<Portal.CFG.rounds?`<button onclick="portalNext()">End round ${PTL.round}</button>`:`<button onclick="portalNext()">Close the portal</button>`}
      ${!PTL.closed?`<button class="quiet" onclick="finishPortal()" title="Skip ahead: the remaining rounds play out without you">Sim to the end</button>`:""}
    </div>
  </div>
  <div class="card"><h2>${t.name} — ${hsCount} signed recruit${hsCount===1?"":"s"}${mine.length?`, ${mine.length} from the portal`:""}</h2>
    ${movesHtml(t)}
    <h2 style="margin-top:12px">Around the country</h2>
    <div class="log" style="max-height:130px">${PTL.log.slice(0,12).map(e=>`<div class="res"><span class="sc">${e.round>Portal.CFG.rounds?"close":"rd "+e.round}</span><span style="grid-column:span 2">${e.text}</span></div>`).join("")||`<p class="hint">No commitments yet.</p>`}</div>
  </div></div>
  <div class="card">
    <div class="filters">${fb("open","Available")}${fb("all","All")}${fb("board","Your board")}${fb("afford","You can afford")}
      <select onchange="PRT.pos=this.value;render()"><option value="">All positions</option>${["PG","SG","SF","PF","C"].map(p=>`<option ${PRT.pos===p?"selected":""}>${p}</option>`).join("")}</select>
      <span class="hint">${rows.length} players · click one to recruit him</span></div>
    <table><thead><tr><th class="l">☆</th>${TH("rank","#")}<th class="l">Player</th><th>Pos</th>${TH("ovr","OVR")}${TH("pot","Pot")}${TH("yrs","Next yr")}${TH("ppg","Last yr")}<th>From</th><th class="l">Why he left</th>${TH("ask","Asking")}${TH("price","Your price")}<th>Status</th><th>Your offer</th><th>Rel</th></tr></thead><tbody>
    ${rows.slice(0,120).map(({r,it,price})=>`<tr class="rc ${it.offer||it.watch?"mine":""}" onclick="openPortal('${r.id}')">
      <td class="l"><button class="watch ${it.watch?"on":""}" onclick="event.stopPropagation();prtWatch('${r.id}')">${it.watch?"\u2605\uFE0E":"\u2606\uFE0E"}</button></td>
      <td>${r.rank}</td><td class="l"><b>${r.name}</b></td><td>${r.pos}</td><td class="num"><b>${r.ovr}</b>${devChip(r.from,r.id)}</td><td><span class="grade ${League.grade(r.potential)}">${League.grade(r.potential)}</span></td>
      <td>${nextClass(r.player)}</td><td class="hint">${r.mpg} mpg · ${r.ppg} ppg</td><td>${r.from===t.id?`<b style="color:var(--amber)" title="He left your program">you</b>`:LG.byId[r.from].abbr}</td><td class="l hint">${why(r)}</td>
      <td>${F(r.asking)}</td><td>${price==null?"—":`<span class="${price<r.asking*0.97?"lead":price>r.asking*1.03?"trail":""}">${F(price)}</span>`}</td>
      <td>${status(r)}</td><td>${it.offer?F(it.offer):"—"}</td><td>${r.interest[t.id]?Math.round(it.rel):"—"}${r.status==="open"&&(it.auto||(t.portalAuto&&(it.offer||it.watch)))?` <span class="pill" title="Auto-recruiting">A</span>`:""}</td></tr>`).join("")}
    </tbody></table>
  </div>`;
}
function prtAutoAll(on){ const t=me(); t.portalAuto=on; if(on){ const n=Portal.autoPoints(LG,t); if(n) LOG.unshift(`Auto-spent ${n} portal points on your board.`); } render(); }
function prtAutoOne(){ const t=me(), r=LG.portal.pool.find(x=>x.id===PRT.open); const it=Portal.interestOf(r,t.id);
  if(t.portalAuto&&(it.offer||it.watch)&&!it.auto){ prtSay({ok:false, why:"He's already auto-recruited through your whole-board setting."}); return; }
  it.auto=!it.auto; if(it.auto){ const n=Portal.autoPoints(LG,t,r); prtSay({ok:true}, n?`Auto-recruiting him: ${n} points spent now, ${Recruiting.CFG.points.capPerRecruit} every round.`:`Auto-recruiting him from next round.`); } else prtSay({ok:true},"Auto-recruiting off for him."); }
/* his class next season (portal players haven't moved up yet) */
function nextClass(p){ const rs = p.redshirtUsed || p.redshirt; const c = p.redshirt ? p.class : ({FR:"SO",SO:"JR",JR:"SR"}[p.class]||"SR"); return (rs?"RS-":"")+c; }
function prtSort(k){ if(PRT.sort===k) PRT.dir*=-1; else { PRT.sort=k; PRT.dir=(k==="rank"||k==="ask"||k==="price")?1:-1; } render(); }
function prtWatch(id){ const r=LG.portal.pool.find(x=>x.id===id), t=me(); const it=Portal.interestOf(r,t.id); it.watch=!it.watch; if(PRT.open) drawPortal(); else render(); }
function portalNext(){ Offseason.portalRound(LG); portalNews(); PRT.msg=""; render(); }
function finishPortal(){
  if(!LG.portal.closed){ while(!LG.portal.closed) Offseason.portalRound(LG); portalNews(); }
  LG.pendingReport = Offseason.finishOffseason(LG, SE);
  render();
}
function openPortal(id){ CARD=null; REC.open=null; DEC.open=null; PRT.open=id; PRT.cardMsg=""; drawPortal(); $("cardBg").classList.add("show"); }
function drawPortal(){
  const t = me(), PTL = LG.portal, r = PTL && PTL.pool.find(x=>x.id===PRT.open); if(!r) return;
  const p = r.player, it = r.interest[t.id] || { rel: Portal.CFG.relStart, offer: 0, roundPts: 0 }, F = money$;
  const RL = {close:"Close",mid:"Mid-range",three:"Three",pass:"Passing",handle:"Handle",steal:"Steal",block:"Block",perDef:"Per. D",intDef:"Int. D",reb:"Rebound",stamina:"Stamina"};
  const rline = (k) => { const v=p.ratings[k]; return `<div class="rline"><span class="lbl">${RL[k]}</span><span class="rbar"><b class="${v>=75?"":v>=55?"mid":"low"}" style="width:${v}%"></b></span><span style="text-align:right;font-weight:700">${v}</span></div>`; };
  let body = "";
  if (r.status === "open" && !(r.from === t.id && r.why === "encouraged")) {
    const ev = Portal.evaluate(LG, t, r), st = Portal.standings(LG, r), od = Recruiting.commitOdds(st);
    const price = r.asking/ev.mult, leader = st[0];
    const toLead = leader && leader.teamId!==t.id ? Math.ceil(leader.effective*1.03/ev.mult/1000)*1000 : null;
    const cap = Recruiting.CFG.points.capPerRecruit, left = PTL.pointsLeft[t.id]||0, canPts = !PTL.closed && left>0 && (it.roundPts||0)<cap;
    body = `
    <div class="sect">Your pitch — ${t.name}</div>
    <table class="pitch"><thead><tr><th class="l">Factor</th><th class="l">How you stack up</th><th>Effect</th></tr></thead><tbody>
      ${ev.parts.map(x=>`<tr><td>${x.label}</td><td class="hint l">${x.note}</td><td>${fxCell(x.change*ev.damp)}</td></tr>`).join("")}
      <tr class="me"><td>Multiplier</td><td class="hint l">fit counts ${Math.round(100*ev.damp)}% for him</td><td><b>× ${ev.mult.toFixed(3)}</b></td></tr>
    </tbody></table>
    <p class="hint" style="margin:6px 0 0">He's asking ${F(r.asking)}. With your fit, an offer of about <b style="color:var(--ink)">${F(price)}</b> meets it. Fair pay on his ratings is about ${F(r.worth)}.</p>
    <div class="sect">The race</div>
    ${st.length?`<table><thead><tr><th>School</th><th>Offer</th><th>× fit</th><th>Effective</th><th>Odds</th></tr></thead><tbody>
      ${st.slice(0,6).map((s,i)=>`<tr class="${s.teamId===t.id?"me":""}"><td>${i===0?"▶ ":""}${LG.byId[s.teamId].name}</td><td>${F(s.offer)}</td><td>${s.mult.toFixed(3)}</td><td><b>${F(s.effective)}</b></td><td>${oddsTxt(od[i].odds)}</td></tr>`).join("")}
    </tbody></table>`:`<p class="hint">Nobody has offered yet.</p>`}
    <div class="sect">Recruit him</div>
    <div class="row">
      <div><label>Points (this round ${it.roundPts||0}/${cap} · ${left} left)</label><div class="row" style="gap:4px">${[5,10,20].map(n=>`<button class="quiet" ${canPts?"":"disabled"} onclick="prtPts(${n})">+${n}</button>`).join("")}
        <button class="quiet ${it.auto||(t.portalAuto&&(it.offer||it.watch))?"on":""}" title="Spend ${cap} points on him every round automatically" onclick="prtAutoOne()">${it.auto?"Auto ✓":t.portalAuto&&(it.offer||it.watch)?"Auto (board) ✓":"Auto"}</button></div></div>
      <div><label>Relationship</label><div class="big" style="font-size:15px">${Math.round(it.rel)}<span class="hint"> / 100</span></div></div>
    </div>
    <div class="row" style="margin-top:10px">
      <div><label>NIL offer per season · you have ${F(Portal.free(LG,t)+(it.offer||0))}</label>${moneyInput("prtAmt", it.offer||Math.round(price/1000)*1000)}</div>
      <button ${PTL.closed?"disabled":""} onclick="prtOffer()">${it.offer?"Change offer":"Make offer"}</button>
      ${toLead?`<button class="quiet" onclick="$('prtAmt').value=${toLead}">Enough to lead: ${F(toLead)}</button>`:""}
      ${it.offer?`<button class="quiet" onclick="prtWithdraw()" title="${(it.seen||0)>0?"He's seen this offer: withdrawing costs relationship":"Made since the last refresh: free to take back"}">${(it.seen||0)>0?"Withdraw":"Take it back (free)"}</button>`:""}
    </div>
    <div class="rmsg ${PRT.cardKind||""}">${PRT.cardMsg||""}</div>`;
  } else if (r.status === "committed") {
    body = `<div class="sect">Committed to ${LG.byId[r.commitTo].name} — ${F(r.deal)} a season</div>
      ${r.decision?`<table><thead><tr><th>School</th><th>Offer</th><th>× fit</th><th>Effective</th></tr></thead><tbody>${r.decision.map(d=>`<tr class="${d.teamId===t.id?"me":""}"><td>${d.teamId===r.commitTo?"✔ ":""}${LG.byId[d.teamId].name}</td><td>${F(d.offer)}</td><td>${d.mult.toFixed(3)}</td><td><b>${F(d.effective)}</b></td></tr>`).join("")}</tbody></table>`:""}
      ${r.odds!=null?`<p class="hint">He picked them at ${Math.round(r.odds*100)}% odds${r.odds<0.4?" — an upset":""}.</p>`:""}`;
  } else body = `<p class="hint" style="margin-top:8px">${r.from===t.id?"You pushed him out; he isn't coming back.":"He didn't find a school."}</p>`;
  $("cardBox").innerHTML = `
    <div class="top"><div>
      <div class="who">${r.name}</div>
      <div class="meta">${nextClass(p)} next season (${r.yearsLeft} season${r.yearsLeft>1?"s":""} left) · ${p.pos} · ${Math.floor(p.height/12)}'${p.height%12}" · ${p.archetype||""} · from ${LG.byId[r.from].name} · from ${Geo.label(r.home)}${r.home?` <span class="hint">(${Math.round(Geo.miles(me().city, r.home))} mi, ${Geo.level(Geo.miles(me().city, r.home))})</span>`:""}</div>
      <div class="hint">${personality(p)}</div>
      ${r.from===t.id&&r.why!=="encouraged"?`<div class="hint" style="color:var(--amber)">He left you and is testing his value on the market. You can bid to bring him back like anyone else.</div>`:""}
      <div class="hint">Last season ${r.mpg} mpg, ${r.ppg} ppg · left because: ${r.why==="encouraged"?"pushed out":(r.reasons||[]).map(k=>DEC_REASON[k]||k).join(", ")||"—"}</div>
      <button class="quiet ${it.watch?"on":""}" style="padding:3px 10px;font-size:11px;margin:4px 0" onclick="prtWatch('${r.id}')">${it.watch?"On your board ✓":"+ Add to your board"}</button>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div class="ovrBig"><b>${r.ovr}</b><div class="sub">overall${devDelta(r.from,r.id)?` <span class="dev">+${devDelta(r.from,r.id)} this offseason</span>`:""}</div></div>
      <div class="ovrBig"><b class="grade ${League.grade(r.potential)}">${League.grade(r.potential)}</b><div class="sub">potential ${r.potential}</div></div>
      <div class="ovrBig"><b>${Recruiting.workRating(p.devRate)}</b><div class="sub">work rate</div></div>
      <button class="close" onclick="closeCard()">×</button>
    </div></div>
    ${body}
    <div class="sect">Ratings</div><div class="rgrid">${Engine.RATING_KEYS.map(rline).join("")}</div>`;
}
function prtSay(res, ok){ PRT.cardMsg = res.ok ? ok : res.why; PRT.cardKind = res.ok ? "ok" : "err"; drawPortal(); }
function prtPts(n){ const r=LG.portal.pool.find(x=>x.id===PRT.open); const res=Portal.addPoints(LG, me(), r, n); prtSay(res, res.ok?`Spent ${res.spent} points → relationship ${Math.round(res.rel)}.`:""); }
function prtOffer(){ const r=LG.portal.pool.find(x=>x.id===PRT.open); const res=Portal.setOffer(LG, me(), r, +$("prtAmt").value||0); prtSay(res, res.lowered?`Offer lowered to ${money$(r.interest[me().id].offer)} a season (free: he hasn't seen it yet).`:`Offer on the table: ${money$(r.interest[me().id].offer)} a season.`); }
function prtWithdraw(){ const r=LG.portal.pool.find(x=>x.id===PRT.open); const res=Portal.withdraw(LG, me(), r); prtSay(res, res.free?"Offer taken back. No harm done: he hadn't seen it yet.":"Offer withdrawn (it costs you some relationship)."); }

function vOffseason(){
  if (LG.offseason && LG.offseason.stage === "carousel") return vCarousel();
  if (LG.offseason && LG.offseason.stage === "hiring") return vHiring();
  if (LG.offseason && LG.offseason.stage === "decisions") return vDecisions();
  if (LG.offseason && LG.offseason.stage === "portal") return vPortal();
  const rep = LG.pendingReport, t = me();
  if(!rep) return `<div class="card"><p class="hint">No offseason report.</p></div>`;
  const d = rep.departures[t.id], inc = rep.incoming[t.id];
  const li = (p) => `<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="pill">${p.class}</span></span><span class="sc">${p.ovr} ovr / pot ${League.grade(p.potential)}</span></div>`;
  const drafted = Object.entries(rep.departures).flatMap(([tid,dd])=>dd.drafted.map(p=>({...p,team:LG.byId[tid]})))
    .sort((a,b)=>b.ovr-a.ovr).slice(0,12);
  const pc = rep.prestigeChanges[t.id];
  const dev = (rep.development?.[t.id]||[]).filter(d=>t.players.some(p=>p.id===d.id)||true);
  const devRow = (d) => {
    const bits = d.changes.sort((a,b)=>(b.to-b.from)-(a.to-a.from)).slice(0,5)
      .map(c=>`${RLABEL[c.k]||c.k} ${c.from}→${c.to}`).join(" · ");
    return `<div class="devrow"><div class="who"><b>${d.name}</b> <span class="pill">${d.class} ${d.pos}</span>
      <div class="chg">${bits||"no change"}</div></div>
      <div class="big ${d.delta>0?"up":"flat"}">${d.before}→${d.after} ${d.delta>0?"+"+d.delta:"—"}</div></div>`;
  };
  const tr = rep.transfers?.[t.id] || [];
  const pg = Object.entries(rep.pipelines||{});
  const pipeNote = pg.length ? `<div class="card"><h2>Pipelines</h2><p class="hint" style="margin:0">This year's signings built: ${pg.map(([a,v])=>`${(Geo.AREA[a]||{}).name||a} +${Math.round(v)}`).join(" · ")}. Every area then faded a little; see the Program tab.</p></div>` : "";
  return (League.dynastyOver(LG) ? vDynastyOver() : `<div class="row topNext"><button onclick="startNextSeason()">Start the ${LG.season}-${String(LG.season+1).slice(2)} season</button></div>`) + vYearInReview(rep) + vAwardsReport(LG.season - 1) + pipeNote + `<div class="g">
    <div class="card"><h2>Development — ${t.name}</h2>

      ${dev.map(devRow).join("")}
    </div>
    <div class="card"><h2>Departures — ${t.name}</h2>
      ${d.graduated.length?`<div class="sect" style="margin-top:0">Graduated</div>${d.graduated.map(li).join("")}`:""}
      <div class="sect">The draft</div>${d.drafted.map(p=>`<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="pill">${p.class}</span> <span class="hint">${draftTag(p)}</span></span><span class="sc">${p.ovr} ovr / pot ${League.grade(p.potential)}</span></div>`).join("")}
      ${(d.withdrew||[]).map(p=>`<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="pill">${p.class}</span> <span class="hint">tested the waters, back next season</span></span><span class="sc">${p.ovr} ovr</span></div>`).join("")}
      ${!d.drafted.length&&!(d.withdrew||[]).length?`<p class="hint">Nobody from your program.</p>`:""}
      ${tr.length?`<div class="sect">Transferred out</div>${tr.map(p=>`<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="pill">${p.class}</span>${(()=>{ const dest = rep.portal && Object.entries(rep.portal.incoming).find(([tid,l])=>l.some(x=>x.id===p.id)); return dest?` <span class="hint">→ ${LG.byId[dest[0]].abbr}</span>`:rep.portal?` <span class="hint">→ unsigned</span>`:""; })()}${p.why==="encouraged"?` <span class="pill">pushed out</span>`:p.chance!=null?` <span class="hint" style="font-size:11px">${Math.round(p.chance*100)}% · ${(p.reasons||[]).map(k=>DEC_REASON[k]||k).join(", ")}</span>`:""}</span><span class="sc">${p.ovr} ovr · ${p.mpg} mpg</span></div>`).join("")}`:`<div class="sect">Transferred out</div><p class="hint">Nobody left the program.</p>`}
      ${rep.portal?`<div class="sect">From the portal</div>${(rep.portal.incoming[t.id]||[]).map(p=>`<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="hint">from ${LG.byId[p.from].abbr}</span></span><span class="sc">${p.ovr} ovr / pot ${League.grade(p.potential)} · ${Recruiting.fmt(p.deal)}</span></div>`).join("")||`<p class="hint">Nobody from the portal.</p>`}`:""}
      <div class="sect">Incoming freshmen</div>${inc.map(p=>p.why==="recruit"
        ? `<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="stars">${"★".repeat(p.stars)}</span> <span class="pill">#${p.rank}</span>${p.tag?` <span class="tag ${p.tag}">${p.tag==="steal"?"Steal":"Bust"}</span>`:""}
            ${p.seenOvr&&p.seenLevel<3?`<div class="hint" style="font-size:11px">you had him at ${p.seenOvr[0]===p.seenOvr[1]?p.seenOvr[0]:p.seenOvr.join("–")} ovr / ${p.seenPot.join("–")} pot${p.seenLevel===0?" (unscouted)":""}${p.seenLevel===0&&(p.ovr<p.seenOvr[0]||p.ovr>p.seenOvr[1]||p.potential<p.seenPot[0]||p.potential>p.seenPot[1])?` <b style="color:var(--amber)">· the services' read was off</b>`:""}</div>`:""}</span>
            <span class="sc">${p.ovr} ovr / pot ${League.grade(p.potential)} · ${Recruiting.fmt(p.deal)}</span></div>`
        : `<div class="res"><span class="pill">${p.pos}</span><span>${p.name} <span class="pill">walk-on</span></span><span class="sc">${p.ovr} ovr / pot ${League.grade(p.potential)}</span></div>`).join("")}
      ${(()=>{ const pd = rep.prestigeDetail && rep.prestigeDetail[t.id];
        const parts = pd ? [`record ${pd.record>0?"+":""}${pd.record} vs a .${String(pd.bar*10).padStart(3,"0").slice(0,3)} bar`, pd.post?`${pd.postLabel==="—"?"no tournament":pd.postLabel} ${pd.post>0?"+":""}${pd.post}${pd.expect?` (a program like yours is expected to go deep)`:""}`:"", pd.pull?`pull toward the pack ${pd.pull>0?"+":""}${pd.pull}`:""].filter(Boolean).join(" · ") : "";
        return pc?`<p class="hint" style="margin-top:10px">Program prestige ${pc>0?"rose":"fell"} ${Math.abs(pc)} to ${t.prestige}${parts?` (${parts})`:""}.</p>`:""; })()}
    </div>
    ${(()=>{ const pr = rep.program && rep.program.teams[t.id]; if(!pr) return "";
      const bits = (b) => b.map(([l,v])=>`${l} +${v}`).join(" · ");
      return `<div class="card"><h2>Program — ${t.name}</h2>
        <div class="res"><span class="sc">NIL</span><span>${pr.nil.before} → <b>${pr.nil.after}</b> <span class="grade ${League.grade(pr.nil.after)}">${League.grade(pr.nil.after)}</span>
          <div class="hint" style="font-size:11px">record ${pr.nil.record>0?"+":""}${pr.nil.record} vs a .${String(pr.nil.bar*10).padStart(3,"0").slice(0,3)} bar${pr.nil.milestones.length?` · ${bits(pr.nil.milestones)}`:""}${pr.nil.pull?` · boosters settling ${pr.nil.pull>0?"+":""}${pr.nil.pull}`:""}</div></span>
          <span class="sc">${money$(t.collective)} next cycle</span></div>
        <div class="res"><span class="sc">Money</span><span>${bankResult(pr.money)}</span><span></span></div>
        <div class="res"><span class="sc">Facilities</span><span>wore down ${pr.facilityDecay} to ${t.facilities}</span><span></span></div>
        <div class="res"><span class="sc">Coach</span><span><b>+${pr.coachPoints.total} points</b> <span class="hint" style="font-size:11px">${bits(pr.coachPoints.bits)}</span></span><span><button class="quiet" style="padding:3px 9px;font-size:11px" onclick="go('program')">Spend</button></span></div>
      </div>`; })()}
    ${rep.carousel && rep.carousel.hires.some(h=>h.role==="head") ? `<div class="card"><h2>Coaching changes</h2>
      ${rep.carousel.hires.filter(h=>h.role==="head").map(h=>{ const d=rep.carousel.departures.find(x=>x.role==="head"&&x.teamId===h.teamId);
        return `<div class="res"><span class="sc">${LG.byId[h.teamId].abbr}</span><span>${d?`${d.name} ${d.why} · `:""}<b>${h.name}</b> hired${h.from?` (${h.moved?"moving up from":"from"} ${LG.byId[h.from].abbr})`:""}</span><span></span></div>`; }).join("")}</div>` : ""}
    <div class="card"><h2>The ${rep.draft?rep.draft.year+" ":""}draft — first round</h2>
      ${rep.draft?rep.draft.picks.filter(x=>x.round===1).map(x=>`<div class="res ${x.team===t.id?"mine":""}"><span class="sc">${x.pick}</span><span>${x.name} <span class="pill">${x.outside?x.pos:x.class+" "+x.pos}</span></span><span class="sc">${x.outside?x.from:LG.byId[x.team].abbr}</span></div>`).join("")
        +`<p class="hint" style="margin:6px 0 0">${rep.draft.leaguePicks} of the 60 picks came from the league. Every pick, and your program's record: the <span class="editable" onclick="go('draft')">Draft tab</span>.</p>`:""}
      ${League.dynastyOver(LG) ? "" : `<div class="row" style="margin-top:14px"><button onclick="startNextSeason()">Start the ${LG.season}-${String(LG.season+1).slice(2)} season</button></div>`}
    </div></div>`;
}
/* after the last season: the career in one card, and how to keep going */
function vDynastyOver(){
  const t = me(), H = t.history, n = H.length;
  const w = H.reduce((x, h) => x + h.w, 0), l = H.reduce((x, h) => x + h.l, 0);
  const has = (re) => H.filter(h => re.test(h.postseason || ""));
  const titles = has(/champion/i), finals = has(/champion|runner-up/i), ff = has(/champion|runner-up|semifinal/i), tourn = has(/champion|runner-up|semifinal|tournament/i);
  const best = H.slice().sort((a, b) => (b.w - b.l) - (a.w - a.l))[0];
  const picks = Draft.teamPicks(LG, t.id);
  const big = (v, lbl) => `<div><div class="big">${v}</div><div class="hint">${lbl}</div></div>`;
  return `<div class="card" style="border-top:3px solid var(--gold)"><h2>Your dynasty is complete — ${n} season${n === 1 ? "" : "s"}</h2>
    <div class="row" style="gap:24px;margin:6px 0 12px">
      ${big(`${w}-${l}`, `record (${(100 * w / Math.max(1, w + l)).toFixed(1)}%)`)}
      ${big(titles.length, "national titles")}${big(finals.length, "title games")}${big(ff.length, "Final Fours")}${big(tourn.length, "tournaments")}
      ${big(picks.length, `draft picks (${picks.filter(x => x.round === 1).length} first-round)`)}
      ${big(League.grade(t.prestige), `prestige now (started ${League.grade(H[0] ? H[0].prestige : t.prestige)})`)}
    </div>
    ${best ? `<p class="hint">Best season: ${best.year}-${String(best.year + 1).slice(2)}, ${best.w}-${best.l}${best.postseason && best.postseason !== "—" ? `, ${best.postseason}` : ""}.${titles.length ? ` Titles: ${titles.map(h => h.year + 1).join(", ")}.` : ""}</p>` : ""}
    <p style="margin:10px 0 6px">A dynasty runs ${League.MAX_SEASONS} seasons. To keep going, export the league as it stands (every school, coach and roster) and start a new dynasty from that file: import it on the setup screen and take over ${t.name} or anyone else.</p>
    <div class="row" style="margin-top:8px">
      <button onclick="exportCurrentLeague()">Export league file</button>
      <button class="quiet" onclick="downloadSave()">Download this save</button>
      <button class="quiet" onclick="if(confirm('Leave this dynasty and go to the setup screen? Save first if you want to keep it.')) location.reload()">New dynasty</button>
    </div>
    <p class="hint" style="margin:8px 0 0">Your program's year-by-year record stays in the <span class="editable" onclick="go('history')">History tab</span>.</p>
  </div>`;
}
function startNextSeason(){
  if (League.dynastyOver(LG)) { render(); return; }
  SE = Offseason.nextSeason(LG);
  LG.pendingReport = null;
  LOG = [`${LG.season}-${String(LG.season+1).slice(2)} season begins.`];
  TAB="hub"; render();
}

