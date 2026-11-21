/* HOOPS DYNASTY UI — Save slots and save files.
   Plain script (no modules): everything shares the page's globals, loaded in
   order by dynasty.html. */
/* ---------- save / load ----------
   Saves live in IndexedDB (built into the browser) in numbered slots.
   "Save" writes to the slot you're playing in; "Saves…" opens the slot
   list, where you can also download a save file or load one. */
let SLOT = null;                       // the slot this dynasty last saved to / loaded from
const extraState = () => ({ log: LOG.slice(0, 80), tab: TAB === "offseason" ? "offseason" : "hub", slot: SLOT });
function note(msg){ LOG.unshift(msg); if($("main").style.display!=="none") render(); }

async function saveGame(){
  if(!SLOT){ openSaves("save"); return; }
  try{
    const r = await Save.saveSlot(SLOT, LG, SE, extraState());
    note(`Saved to slot ${SLOT} (${Save.fmtSize(r.size)}).`);
  }catch(e){ alert("Save failed: "+e.message+"\n\nTry 'Download save file' from the Saves menu so nothing is lost."); }
}
function applyLoaded(d){
  LG = d.lg; SE = d.se; SE.byDay = Season.groupByDay(SE.games);
  Recruiting.ensure(LG);   // older saves: salaries, budgets and a recruiting class get filled in
  Program.ensure(LG);
  LOG = d.log || []; TAB = d.tab || "hub";
  if(TAB==="offseason" && !LG.pendingReport && !LG.offseason) TAB="hub";
  $("setup").style.display="none"; $("main").style.display="";
  closeCard(); render();
}
async function loadSlot(n){
  try{ const d = await Save.loadSlot(n); SLOT = n; applyLoaded(d); note(`Loaded slot ${n}.`); }
  catch(e){ alert("Load failed: "+e.message); }
}
function loadGame(){ openSaves("load"); }

let SAVES_MODE = "load";
async function openSaves(mode){
  SAVES_MODE = mode || (LG ? "save" : "load");
  try{ const moved = await Save.migrateLegacy(); if(moved) LOG.unshift(`Your old save was moved into slot ${moved}.`); }catch(e){}
  let slots = [];
  try{ slots = await Save.listSlots(); }catch(e){ alert("Saves unavailable: "+e.message); return; }
  const inGame = !!LG && $("main").style.display!=="none";
  const when = (ms) => new Date(ms).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  $("cardBox").innerHTML = `
    <div class="top"><div><div class="who">Saves</div>
      <div class="meta">Stored in this browser${SLOT?` · you're playing in slot ${SLOT}`:""}</div></div>
      <button class="close" onclick="closeCard()">×</button></div>
    ${slots.map(s=>`<div class="slot ${s.slot===SLOT?"cur":""}">
      <div class="sn">${s.slot}</div>
      <div class="sd">${s.empty?`<span class="hint">Empty</span>`:`<b>${s.meta.team}</b> <span class="hint">${s.meta.year}-${String(s.meta.year+1).slice(2)} · ${s.meta.record} · day ${s.meta.day}</span>
        <div class="hint">${when(s.meta.savedAt)} · ${Save.fmtSize(s.size)}</div>`}</div>
      <div class="sb">
        ${inGame?`<button class="${s.empty?"":"quiet"}" onclick="saveTo(${s.slot},${!s.empty})">Save here</button>`:""}
        ${s.empty?"":`<button class="quiet" onclick="loadSlot(${s.slot})">Load</button>
        <button class="quiet" title="Delete" onclick="delSlot(${s.slot})">✕</button>`}
      </div></div>`).join("")}
    <div class="sect">Save files</div>
    <p class="hint" style="margin:0 0 8px">A file on your computer: no size limit, a backup if the browser's data is ever cleared, and a way to move a dynasty to another browser or computer.</p>
    <div class="row">
      ${inGame?`<button class="quiet" onclick="downloadSave()">Download save file</button>`:""}
      <button class="quiet" onclick="$('saveFile').click()">Load save file…</button>
      <input type="file" id="saveFile" accept=".hoops,.json,.gz,application/json,application/gzip" style="display:none" onchange="loadFile(this)">
    </div>`;
  $("cardBg").classList.add("show");
}
async function saveTo(n, overwrite){
  if(overwrite && n!==SLOT && !confirm(`Overwrite slot ${n}?`)) return;
  SLOT = n;
  await saveGame();
  openSaves("save");
}
async function delSlot(n){
  if(!confirm(`Delete the save in slot ${n}? This can't be undone.`)) return;
  await Save.deleteSlot(n); if(SLOT===n) SLOT=null; openSaves(SAVES_MODE);
}
async function downloadSave(){ const r = await Save.download(LG, SE, extraState()); note(`Downloaded ${r.name} (${Save.fmtSize(r.size)}).`); }
async function loadFile(input){
  const f = input.files && input.files[0]; if(!f) return;
  try{ const d = await Save.readFile(f); SLOT = null; applyLoaded(d); note(`Loaded ${f.name}. Use Save to put it in a slot.`); }
  catch(e){ alert(e.message); }
}
document.addEventListener("keydown", e => {
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="s" && LG && $("main").style.display!=="none"){ e.preventDefault(); saveGame(); }
});

