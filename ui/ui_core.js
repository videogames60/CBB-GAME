/* HOOPS DYNASTY UI — Globals, setup screen, coach creation, sim controls, the header and tab router.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
const $ = (id) => document.getElementById(id);
let LG = null, SE = null, TAB = "hub", LOG = [];

/* ---------- setup ---------- */
window.addEventListener("DOMContentLoaded",()=>{ if($("dbgBox")) $("dbgBox").checked = DEBUG; });
/* setup: which league (a definition from leagues.js, or an imported league
   file), then its conferences (grouped by tier), then a school: your own new
   program (it replaces one) or any existing school, taken over as it is */
const IMPORTED_KEY = "hoopsDynasty.leagueFiles";
try { for (const d of JSON.parse(localStorage.getItem(IMPORTED_KEY) || "[]")) { const c = Leagues.check(d); if (!c.errors.length) Leagues.register(c.def); } } catch (e) {}
function fillLeagues(pick){
  $("sLeague").innerHTML = Leagues.list().map(d => `<option value="${d.id}" ${d.id===pick?"selected":""}>${d.name} — ${d.teams} teams, ${d.conferences} conferences</option>`).join("");
}
fillLeagues();
function fillConfs(){
  const def = Leagues.get($("sLeague").value), rules = Leagues.rulesFor(def);
  const tiers = [...new Set(def.conferences.map(c => c.tier))].sort();
  $("sConf").innerHTML = tiers.map(t => `<optgroup label="Tier ${t}">${def.conferences.filter(c => c.tier === t).map(c =>
    `<option value="${c.id}" ${c.id===def.defaultConf?"selected":""}>${c.name} (${c.size} teams)</option>`).join("")}</optgroup>`).join("");
  $("sLeagueNote").textContent = `${def.blurb || def.name}. ${rules.nonConfGames} non-conference games, ${rules.confGames ? rules.confGames + " conference games" : "conference home and away"}, ${rules.confTourney ? "top " + rules.confTourney + " in each conference tournament" : "everyone in the conference tournament"}, a ${rules.natField}-team national tournament.`;
  fillSchools();
}
/* the schools need the league built from the seed: a preview, cached */
let PREVIEW = null;
function previewLeague(){
  const key = $("sLeague").value + "|" + (+$("sSeed").value || 42);
  if (!PREVIEW || PREVIEW.key !== key) PREVIEW = { key, lg: League.generateLeague(+$("sSeed").value || 42, { league: $("sLeague").value }) };
  return PREVIEW.lg;
}
function fillSchools(){
  const lg = previewLeague(), c = lg.conferences.find(x => x.id === $("sConf").value) || lg.conferences[0];
  const teams = c.teamIds.map(id => lg.byId[id]).sort((a, b) => b.prestige - a.prestige);
  $("sSchool").innerHTML = `<option value="">Your own new program (replaces a school)</option>` +
    teams.map(t => `<option value="${t.id}">${t.name} ${t.mascot} — prestige ${League.grade(t.prestige)}</option>`).join("");
  schoolPicked();
}
function schoolPicked(){
  const own = !$("sSchool").value;
  $("sOwn").querySelectorAll("input,select").forEach(i => i.disabled = !own);
  $("sOwn").style.opacity = own ? "" : ".45";
}
/* your own program's city: anywhere on the map (default: where the school it replaces is) */
(function fillCities(){
  const by = {};
  for (const c of Object.values(Geo.CITY)) (by[c.state] = by[c.state] || []).push(c);
  $("sCity").innerHTML = `<option value="">Where the school it replaces is</option>` + Object.keys(by).sort().map(st =>
    `<optgroup label="${st}">${by[st].sort((a,b)=>a.name.localeCompare(b.name)).map(c => `<option value="${c.key}">${c.name}, ${st}</option>`).join("")}</optgroup>`).join("");
})();
fillConfs();

/* league files: export the selected league with this seed's schools, edit it, import it back */
function downloadJSON(obj, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" }));
  a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
/* setup: the chosen league with this seed's schools, coaches and rosters */
function exportLeagueFile(){
  const def = Leagues.get($("sLeague").value);
  const out = League.exportDefinition(previewLeague(), { id: (def.id || "custom") + "-" + (+$("sSeed").value || 42), name: `${def.name} (seed ${+$("sSeed").value || 42})`,
    blurb: def.blurb || "", defaultConf: def.defaultConf });
  out.tierPrestige = def.tierPrestige;
  downloadJSON(out, `${out.id}.json`);
}
/* in a dynasty: today's league (schools, coaches, rosters as they are now) as a file to start a new dynasty from */
function exportCurrentLeague(){
  const out = League.exportDefinition(LG, { id: `${LG.league ? LG.league.id : "league"}-${LG.season}`, name: `${LG.league ? LG.league.name : "League"} ${LG.season}-${String(LG.season+1).slice(2)}` });
  downloadJSON(out, `${out.id}.json`);
}
function importLeagueFile(input){
  const f = input.files && input.files[0]; if (!f) return;
  f.text().then(txt => {
    let raw; try { raw = JSON.parse(txt); } catch (e) { alert("That file isn't valid JSON: " + e.message); return; }
    const c = Leagues.check(raw);
    if (c.errors.length) { alert(`That league file has ${c.errors.length} problem${c.errors.length>1?"s":""}:\n\n• ` + c.errors.slice(0, 15).join("\n• ") + (c.errors.length > 15 ? `\n…and ${c.errors.length - 15} more` : "")); return; }
    if (Leagues.LEAGUES[c.def.id] && ["compact", "full"].includes(c.def.id)) c.def.id += "-custom";
    Leagues.register(c.def);
    try { const list = JSON.parse(localStorage.getItem(IMPORTED_KEY) || "[]").filter(d => d.id !== c.def.id); list.push(c.def); localStorage.setItem(IMPORTED_KEY, JSON.stringify(list)); }
    catch (e) { alert(`"${c.def.name}" is loaded and ready to start, but it's too big for this browser to remember (browser storage holds about 5 MB). After a reload, import the file again.`); }
    fillLeagues(c.def.id); PREVIEW = null; fillConfs();
  }).finally(() => { input.value = ""; });
}

/* ---------- coach creation ---------- */
function drawCoachBuild(dist){
  const C = Program.CFG.coach;
  dist = dist || { ...C.presets.Balanced };
  $("coachBuild").innerHTML = `<div><label>Preset</label><select id="cPreset" onchange="drawCoachBuild({...Program.CFG.coach.presets[this.value]})">
      ${Object.keys(C.presets).map(k=>`<option value="${k}" ${JSON.stringify(C.presets[k])===JSON.stringify(dist)?"selected":""}>${k.replace("_"," ")}</option>`).join("")}<option value="" ${Object.keys(C.presets).some(k=>JSON.stringify(C.presets[k])===JSON.stringify(dist))?"":"selected"}>Custom</option></select></div>
    ${C.keys.map(k=>`<div><label>${C.labels[k]}</label><input type="number" id="c_${k}" min="${C.min}" max="${C.max}" value="${dist[k]}" oninput="coachPoolNote()"></div>`).join("")}`;
  coachPoolNote();
}
function coachDist(){ const C=Program.CFG.coach, d={}; for(const k of C.keys) d[k]=Math.max(C.min,Math.min(C.max,+$("c_"+k).value||0)); return d; }
function coachPoolNote(){
  const C=Program.CFG.coach, d=coachDist(), used=C.keys.reduce((a,k)=>a+d[k],0), left=C.pool-used;
  $("coachPool").innerHTML = `${used} of ${C.pool} points used${left?` · <b style="color:${left<0?"var(--red)":"var(--gold)"}">${left>0?left+" left":(-left)+" over"}</b>`:" ✓"} · each rating ${C.min}–${C.max}. Tactics runs your schemes in games, Recruiting sets your weekly recruiting points, Development grows your players, Scouting sets your weekly scouting points.`;
  return left;
}
window.addEventListener("DOMContentLoaded", ()=>{ if($("coachBuild")) drawCoachBuild(); setTimeout(() => helpFirst("welcome"), 200); });

function newDynasty(){
  if(coachPoolNote() < 0){ alert(`Your coach uses more than ${Program.CFG.coach.pool} points. Take some off first.`); return; }
  const seed = +$("sSeed").value || 42;
  LG = League.generateLeague(seed, { userTeam: {
    takeOver: $("sSchool").value || null,
    name: $("sName").value || "Eastwood State", mascot: $("sMascot").value, city: $("sCity").value || null,
    abbr: ($("sAbbr").value||"").toUpperCase(), color: $("sColor").value,
    conf: $("sConf").value, prestige: +$("sPrestige").value, coachName: $("sCoach").value,
  }, league: $("sLeague").value });
  LG.options = { canBeFired: !$("sFire") || $("sFire").checked };
  Program.applyCreation(me(), coachDist());
  Recruiting.ensure(LG); Program.ensure(LG);
  SLOT = null;
  SE = Season.startSeason(LG, seed);
  LOG = [`${LG.season}-${String(LG.season+1).slice(2)} season begins. The recruiting board is open.`];
  $("setup").style.display="none"; $("main").style.display="";
  TAB="hub"; render();
}

const me = () => LG.teams.find(t => t.isUser);
const jn = (p) => p && p.num != null ? `<span class="jn">#${p.num}</span>` : "";   // jersey number
const conf = (id) => LG.conferences.find(c => c.id === id);

/* ---------- sim controls ----------
   Multi-day sims run a day at a time with a break for the page between
   chunks, so a big league shows progress (and a Stop button) instead of
   freezing. step() sims one day and returns true to stop. */
let SIMMING = null;
function runDays(label, step, done){
  if (SIMMING) return;
  const t0 = Date.now(), day0 = SE.day;
  SIMMING = { stop: false };
  const bar = $("simBar"), end = Season.maxDay(SE);
  const show = () => { bar.style.display = ""; bar.innerHTML = `<span>${label} — day ${SE.day} of ${end}${SE.day > day0 ? ` · ${((Date.now()-t0)/1000).toFixed(0)}s` : ""}</span><span class="bar"><i style="width:${Math.min(100, 100*SE.day/Math.max(1,end))}%"></i></span><button class="quiet" onclick="SIMMING.stop=true">Stop</button>`; };
  const finish = () => { SIMMING = null; bar.style.display = "none"; if (done) done((Date.now()-t0)/1000); render(); };
  const chunk = () => {
    const until = Date.now() + 60;
    while (Date.now() < until) {
      if (SIMMING.stop || Season.seasonComplete(SE)) return finish();
      if (step()) return finish();
    }
    show(); setTimeout(chunk, 0);
  };
  show(); setTimeout(chunk, 0);
}
const userGameToday = () => (SE.byDay[SE.day] || []).find(g => !g.played && (LG.byId[g.home].isUser || LG.byId[g.away].isUser));
function simDay(){ const p = Season.simDay(LG, SE); logResults(p); render(); }
function playNext(){
  // fast-forward the country to the user's next game, then play it
  runDays("Simming to your next game", () => { const mine = userGameToday(); logResults(Season.simDay(LG, SE)); return !!mine; });
}
/* weeks run day 0-6, 7-13, ... : recruiting points refresh and polls update
   at the start of each one. "Sim week" stops at the start of the next week. */
const weekOf = (day) => Math.floor(day/7) + 1;
function simWeek(){
  runDays("Simming the week", () => { logResults(Season.simDay(LG,SE)); return SE.day % 7 === 0; });
}
/* the "Sim to…" menu: stop before your next game, at the conference tournaments, at Selection Sunday, ... */
function simTo(where){
  if (!where) return;
  if (where === "week") return simWeek();
  if (where === "end") return simSeason();
  if (where === "game") {
    if (userGameToday()) { note("Your next game is today: Play game or Quick sim game."); return; }
    const mineLeft = Object.values(SE.games || {}).some(g => !g.played && (LG.byId[g.home].isUser || LG.byId[g.away].isUser));
    if (!mineLeft && SE.post) { note("You have no games left this season."); return; }
    return runDays("Simming to your next game", () => { logResults(Season.simDay(LG, SE)); return !!userGameToday(); },
      () => { if (userGameToday()) LOG.unshift("Your next game is today."); });
  }
  if (where === "conf") return runDays("Simming to the conference tournaments", () => { logResults(Season.simDay(LG, SE)); return !!SE.post; },
    () => { if (SE.post) LOG.unshift("The regular season is over: conference tournaments are next."); });
  if (where === "ncaa") return runDays("Simming to Selection Sunday", () => { logResults(Season.simDay(LG, SE)); return !!(SE.post && SE.post.phase !== "confTourney"); },
    () => { if (SE.post && SE.post.phase === "national") LOG.unshift("Selection Sunday: the national tournament field is set."); });
}
function simSeason(){
  runDays("Simming to the end", () => { logResults(Season.simDay(LG,SE)); return false; },
    (s) => { if (Season.seasonComplete(SE)) LOG.unshift(`Season complete (${s.toFixed(1)}s).`); });
}
function logResults(games){
  recruitNews();
  signingWarning();
  if(SE.news && SE.news.length){ while(SE.news.length) LOG.unshift(SE.news.shift()); }   // records broken (records.js)
  if(SE.post && SE.post.log && SE.post.log.length){
    while(SE.post.log.length) LOG.unshift(SE.post.log.shift());
  }
  for(const g of games){
    const h=LG.byId[g.home], a=LG.byId[g.away];
    if(!h.isUser && !a.isUser) continue;
    const meT = h.isUser ? h : a, opp = h.isUser ? a : h;
    const my = h.isUser ? g.homeScore : g.awayScore, their = h.isUser ? g.awayScore : g.homeScore;
    LOG.unshift(`${my>their?"W":"L"} ${my}-${their} ${h.isUser?"vs":"at"} ${opp.name}${g.ot?` (${g.ot}OT)`:""}`);
  }
}

/* ---------- render ---------- */
const TABS = [["hub","Hub"],["schedule","Schedule"],["roster","Roster"],["rotation","Rotation"],["recruiting","Recruiting"],["program","Program"],["staff","Staff"],["map","Map"],["standings","Standings"],["rankings","Rankings"],["postseason","Postseason"],["leaders","Leaders & Awards"],["draft","Draft"],["league","League"],["history","History"]];
function render(){
  const t = me(), c = conf(t.conf);
  const done = Season.seasonComplete(SE);
  const phase = !Season.regularSeasonComplete(SE) ? "Regular season"
    : !SE.post ? "Conference tournaments"
    : SE.post.phase === "confTourney" ? "Conference tournaments"
    : SE.post.phase === "national" ? "National tournament" : "Season complete";
  const myRank = (() => {
    if (!SE.rankings) return "";
    const apFull = LG.teams.map(x => ({ id: x.id, s: (SE.apScores||{})[x.id] || 0 })).sort((a,b)=>b.s-a.s);
    const apPos = apFull.findIndex(r => r.id === t.id) + 1;
    const com = SE.rankings.committee.find(r => r.id === t.id);
    return `AP ${apPos<=25?"#"+apPos:"#"+apPos+" (unranked)"} · committee #${com ? com.rank : "—"}`;
  })();
  $("teamHdr").innerHTML = `
    <div class="badge" style="background:${t.color}">${t.abbr}</div>
    <div class="who"><div class="nm">${t.name} ${t.mascot}</div>
      <div class="sub">${c.name} · ${LG.season}-${String(LG.season+1).slice(2)} <span class="hint">(season ${Math.min(League.seasonNumber(LG), League.MAX_SEASONS)} of ${League.MAX_SEASONS})</span> · ${t.coach.vacant ? `<span class="hint">between jobs</span>` : `<span class="coachLine" onclick="openCoachCard('${t.id}')">${t.coach.name} (tactics ${t.coach.rating})</span>`} · ${myRank}</div></div>
    <div class="stat"><b>${t.record.w}-${t.record.l}</b><span>overall</span></div>
    <div class="stat"><b>${t.record.confW}-${t.record.confL}</b><span>${c.short}</span></div>
    <div class="stat"><b class="grade ${League.grade(t.prestige)}">${League.grade(t.prestige)}</b><span>prestige</span></div>
    <div class="stat"><b class="grade ${League.grade(t.homeCourt)}">${League.grade(t.homeCourt)}</b><span>home court</span></div>
    <div class="stat"><b>${done ? "—" : "Week "+weekOf(SE.day)}</b><span>${done ? phase : `day ${SE.day} · ${phase.toLowerCase()}`}</span></div>
    <div class="right">
      ${done ? `<button onclick="goOffseason()">${LG.offseason?({carousel:"Coaching carousel",hiring:"Coaching carousel",portal:"Transfer portal"}[LG.offseason.stage]||"Roster decisions"):LG.pendingReport?"View offseason":"Advance to offseason"}</button>` : `
      <button onclick="startLive()">Play game</button>
      <span class="more">
      <button class="quiet" onclick="playNext()">Quick sim game</button>
      <button class="quiet" onclick="simDay()">Sim day</button>
      <select class="simTo" onchange="simTo(this.value); this.value=''" title="Sim ahead to a point in the season">
        <option value="">Sim to…</option>
        <option value="game">my next game (stop before it)</option>
        <option value="week">next week (day ${(Math.floor(SE.day/7)+1)*7})</option>
        <option value="conf" ${SE.post?"disabled":""}>conference tournaments</option>
        <option value="ncaa" ${SE.post&&SE.post.phase!=="confTourney"?"disabled":""}>the national tournament</option>
        <option value="end">end of season</option>
      </select>`}
      ${done ? `<span class="more">` : ""}
      <button class="quiet" onclick="saveGame()" title="Save to ${SLOT?"slot "+SLOT:"a slot"} (Ctrl+S)">Save</button>
      <button class="quiet" onclick="openSaves('save')">Saves…</button>
      <button class="quiet" onclick="helpIndex()" title="Help: how every screen works">?</button>
      </span>
      <button class="quiet moreBtn" onclick="$('teamHdr').classList.toggle('open')">More ▾</button>
    </div>`;
  $("tabs").innerHTML = (DEBUG ? [...TABS, ["debug","Debug"]] : TABS).map(([k,l])=>`<button class="quiet ${TAB===k?"on":""}" onclick="go('${k}')">${l}</button>`).join("");
  { const on = $("tabs").querySelector("button.on"); if (on && $("tabs").scrollWidth > $("tabs").clientWidth) $("tabs").scrollLeft = on.offsetLeft - $("tabs").clientWidth / 2 + on.offsetWidth / 2; }   // phones: the tab strip scrolls; keep yours in view
  const hk = helpKeyFor(TAB);
  $("view").innerHTML = (hk ? helpBar(hk) : "") + ({hub:vHub,schedule:vSchedule,roster:vRoster,rotation:vRotation,recruiting:vRecruiting,program:vProgram,staff:vStaff,map:vMap,draft:vDraft,standings:vStandings,rankings:vRankings,postseason:vPostseason,leaders:vLeaders,league:vLeague,offseason:vOffseason,history:vHistory,debug:vDebug})[TAB]();
  if (hk) helpFirst(hk);
}
function go(t){
  if (TAB === "history" && t !== "history" && typeof HISTV !== "undefined") HISTV.team = null;   // back to your own school next time
  TAB=t; $("teamHdr").classList.remove("open"); render(); }
/* PHONES: every table scrolls sideways in its own box (the page never gets wider than
   the screen), with the first column pinned. Wraps any table added anywhere, so every
   screen and card gets it without each one knowing. */
function wrapTables(root){
  for (const t of (root || document).querySelectorAll("table")) {
    if (t.parentElement && t.parentElement.classList.contains("tscroll")) continue;
    const w = document.createElement("div"); w.className = "tscroll";
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  }
}
if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  let wrapQueued = false;
  new MutationObserver(() => { if (wrapQueued) return; wrapQueued = true; requestAnimationFrame(() => { wrapQueued = false; wrapTables(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
}

