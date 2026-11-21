/* HOOPS DYNASTY UI — the Draft tab.
   During the season: a live mock draft (60 picks, league players and outside
   prospects) and your players' outlook. After a draft: every pick, by year,
   and your program's record (which feeds your development pitch). */
let DRAFTV = { year: null, all: false, leagueOnly: null };   // leagueOnly: null = on when the league gets few picks

function vDraft(){
  const t = me(), H = LG.draftHistory || [];
  const inOffseason = !!LG.offseason;          // classes haven't moved up yet: no mock until the new season
  const mockYear = LG.season + 1;
  let html = `<div class="g">`;

  // ---- the mock draft ----
  if (!inOffseason) {
    const m = Draft.mock(LG, mockYear);
    const mine = m.filter(x => !x.outside && x.t.id === t.id);
    const outlook = (x) => x.outside ? `<span class="hint">${x.from}</span>` : x.outlook === "senior" ? `<span class="hint">senior</span>` : x.outlook === "declare" ? `<b style="color:var(--amber)">likely to declare</b>` : `<span class="hint">would test the waters</span>`;
    const row = (x) => `<tr class="${!x.outside && x.t.id === t.id ? "me" : ""}"><td>${x.pick}</td>
      <td class="l">${x.outside ? x.name : `<span class="editable" onclick="openCard('${x.p.id}')">${x.p.name}</span>`}</td>
      <td>${x.outside ? x.pos : `${League.classLabel(x.p)} ${x.p.pos}`}</td>
      <td class="l">${x.outside ? `<span class="hint">outside the league</span>` : x.t.name}</td>
      <td>${x.outside ? "" : League.ovrOf(x.p)}</td><td>${x.outside ? "" : `<span class="grade ${League.grade(x.p.potential)}">${League.grade(x.p.potential)}</span>`}</td>
      <td class="l">${outlook(x)}</td></tr>`;
    const only = DRAFTV.leagueOnly ?? (Draft.leaguePicks(LG, mockYear) < 20);
    const shown = only ? m.filter(x => !x.outside) : DRAFTV.all ? m : m.slice(0, 30);
    html += `<div class="card"><h2>${mockYear} mock draft</h2>
      <p class="hint" style="margin:0 0 6px">About ${Draft.leaguePicks(LG, mockYear)} of the 60 picks come from the league this year.</p>
      <table><thead><tr><th>#</th><th class="l">Player</th><th></th><th class="l">School</th><th>OVR</th><th>Pot</th><th class="l">Outlook</th></tr></thead><tbody>
      ${shown.map((x, i) => (!only && i === 30 ? `<tr><td colspan="7" class="sect" style="padding-top:8px">Round 2</td></tr>` : "") + row(x)).join("")}</tbody></table>
      <div class="row" style="margin-top:8px">
        <button class="quiet ${only ? "on" : ""}" onclick="DRAFTV.leagueOnly=!${only};render()">League players only</button>
        ${only ? "" : `<button class="quiet" onclick="DRAFTV.all=!DRAFTV.all;render()">${DRAFTV.all ? "First round only" : "Show round 2"}</button>`}
      </div>
    </div>`;
    // your players' outlook
    html += `<div><div class="card"><h2>Your players</h2>
      ${mine.length ? mine.map(x => `<div class="res"><span class="sc">#${x.pick}</span><span>${x.p.name} <span class="pill">${League.classLabel(x.p)} ${x.p.pos}</span></span><span class="sc">${x.outlook === "senior" ? "senior" : x.outlook === "declare" ? "likely to declare" : "may test the waters"}</span></div>`).join("")
        : `<p class="hint">Nobody on your roster projects in this year's draft.</p>`}
</div>`;
  } else {
    html += `<div class="card"><h2>Mock draft</h2><p class="hint">The ${mockYear + 1} mock draft opens when the new season starts.</p></div><div>`;
  }

  // ---- your program in the draft ----
  const picks = Draft.teamPicks(LG, t.id), rep = t.draftRep || 0;
  const bonus = Math.round(100 * Draft.devBonus(t) / Draft.CFG.reputation.devBonus);
  html += `<div class="card"><h2>Your program in the draft</h2>
    <div class="row" style="gap:22px;margin-bottom:6px">
      <div><div class="big">${picks.length}</div><div class="hint">picks, all time</div></div>
      <div><div class="big">${picks.filter(x => x.round === 1).length}</div><div class="hint">first-rounders</div></div>
      <div><div class="big">${bonus}%</div><div class="hint">draft record in your development pitch</div></div>
    </div>
    ${picks.slice().reverse().slice(0, 12).map(x => `<div class="res"><span class="sc">${x.year}</span><span>${x.name} <span class="pill">${x.class} ${x.pos}</span></span><span class="sc">Rd ${x.round} · #${x.pick}</span></div>`).join("")}
  </div>`;

  // most picks, last few drafts
  const recent = H.slice(-Draft.CFG.reputation.years), count = {};
  for (const e of recent) for (const x of e.picks) if (x.team) count[x.team] = (count[x.team] || 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) html += `<div class="card"><h2>Most picks — last ${recent.length} draft${recent.length > 1 ? "s" : ""}</h2>
    ${top.map(([id, n]) => `<div class="res ${id === t.id ? "mine" : ""}"><span class="sc">${n}</span><span>${LG.byId[id].name}</span><span class="sc">${(LG.byId[id].draftRep || 0).toFixed(1)} rep</span></div>`).join("")}</div>`;
  html += `</div></div>`;

  // ---- past drafts ----
  if (H.length) {
    const year = DRAFTV.year && H.some(e => e.year === DRAFTV.year) ? DRAFTV.year : H[H.length - 1].year;
    const e = H.find(x => x.year === year);
    html += `<div class="card"><h2>Draft results
        <select style="margin-left:8px" onchange="DRAFTV.year=+this.value;render()">${H.slice().reverse().map(x => `<option ${x.year === year ? "selected" : ""}>${x.year}</option>`).join("")}</select></h2>
      <div class="g"><div><table><tbody>${e.picks.slice(0, 30).map(draftRow).join("")}</tbody></table></div>
      <div><table><tbody>${e.picks.slice(30).map(draftRow).join("")}</tbody></table></div></div>
      <p class="hint">${e.picks.filter(x => !x.outside).length} of 60 picks from the league.</p></div>`;
  }
  return html;
}
function draftRow(x){
  const mine = x.team === me().id;
  return `<tr class="${mine ? "me" : ""}"><td>${x.pick}</td><td class="l">${x.name}</td><td>${x.outside ? x.pos : `${x.class} ${x.pos}`}</td>
    <td class="l">${x.outside ? `<span class="hint">${x.from}</span>` : LG.byId[x.team] ? LG.byId[x.team].abbr : "?"}</td></tr>`;
}
