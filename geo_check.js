/* =====================================================================
   GEOGRAPHY CHECK — node tests/geo_check.js
   Checks dynasty/geo.js and prints what it adds up to, for tuning:
     • problems: missing areas, duplicate cities, odd coordinates, a city far
       from the rest of its area (usually a typo or the wrong area)
     • every area: talent, share of a recruiting class, recruits per class in
       the Compact (237) and Full (1,126) leagues, cities
     • a few distances, as a sanity check
   `node tests/geo_check.js short` prints only problems and the totals.
   ===================================================================== */
const Geo = require("../dynasty/geo.js");
const SHORT = process.argv.includes("short");
const problems = [];

/* ---- data checks ---- */
const areaIds = new Set();
for (const a of Geo.AREAS) {
  if (areaIds.has(a.id)) problems.push(`Area ${a.id} is listed twice.`);
  areaIds.add(a.id);
  if (!(a.talent >= 0)) problems.push(`Area ${a.id}: talent must be 0 or more.`);
  if (!Geo.CITIES_IN[a.id].length) problems.push(`Area ${a.id} has no cities (it can't produce recruits or hold schools).`);
}
const keys = new Set();
for (const row of Geo.CITIES) {
  const [name, state, area, lat, lon, w] = row;
  const key = Geo.keyOf(name, state);
  if (keys.has(key)) problems.push(`City ${key} is listed twice.`);
  keys.add(key);
  if (!areaIds.has(area)) problems.push(`City ${key}: area "${area}" doesn't exist.`);
  if (!(lat > 18 && lat < 72 && lon > -170 && lon < -66)) problems.push(`City ${key}: ${lat}, ${lon} isn't in the US.`);
  if (!(w > 0)) problems.push(`City ${key}: weight must be more than 0.`);
}
/* a city far from the rest of its area is usually a coordinate typo */
for (const a of Geo.AREAS) {
  const list = Geo.CITIES_IN[a.id];
  if (list.length < 2 || a.spread) continue;   // spread-out areas are marked in geo.js
  for (const c of list) {
    const others = list.filter(x => x !== c);
    const near = Math.min(...others.map(o => Geo.miles(c, o)));
    if (near > 260) problems.push(`City ${c.key} is ${Math.round(near)} miles from anything else in ${a.id} — check its coordinates or area.`);
  }
}

/* every city lands on the Map tab's 975 × 610 map */
for (const c of Object.values(Geo.CITY)) {
  const [x, y] = Geo.project(c.lat, c.lon);
  if (!(x >= 0 && x <= 975 && y >= 0 && y <= 610)) problems.push(`City ${c.key} falls off the map (${Math.round(x)}, ${Math.round(y)}).`);
}

/* ---- report ---- */
const shares = Geo.talentShares();
const rows = Geo.AREAS.map(a => ({ a, share: shares[a.id] || 0, cities: Geo.CITIES_IN[a.id] })).sort((x, y) => y.share - x.share);
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
if (!SHORT) {
  console.log("AREAS (by share of a recruiting class)\n");
  console.log(pad("area", 9) + pad("name", 36) + lpad("talent", 7) + lpad("share", 8) + lpad("Compact", 9) + lpad("Full", 7) + "  cities");
  for (const r of rows) console.log(pad(r.a.id, 9) + pad(r.a.name, 36) + lpad(r.a.talent, 7) + lpad((100 * r.share).toFixed(1) + "%", 8)
    + lpad((r.share * 237).toFixed(1), 9) + lpad((r.share * 1126).toFixed(0), 7) + "  " + r.cities.map(c => c.name).join(", "));

  /* by state, for the big picture */
  const byState = {};
  for (const r of rows) for (const c of r.cities) { const s = byState[c.state] = byState[c.state] || { share: 0 }; s.share += r.share * c.w / r.cities.reduce((t, x) => t + x.w, 0); }
  console.log("\nBY STATE (top 15): " + Object.entries(byState).sort((a, b) => b[1].share - a[1].share).slice(0, 15).map(([s, v]) => `${s} ${(100 * v.share).toFixed(1)}%`).join(" · "));

  console.log("\nDISTANCES (home ≤ " + Geo.CFG.miles.home + " mi, close ≤ " + Geo.CFG.miles.close + " mi)");
  for (const [a, b] of [["Chapel Hill, NC", "Charlotte, NC"], ["Portland, ME", "Brooklyn, NY"], ["Laramie, WY", "Denver, CO"], ["Dallas, TX", "El Paso, TX"],
                        ["Lawrence, KS", "Kansas City, MO"], ["Los Angeles, CA", "San Francisco, CA"], ["Durham, NC", "Washington, DC"], ["Bloomington, IN", "Louisville, KY"]]) {
    const m = Geo.miles(a, b);
    console.log("  " + pad(a + " → " + b, 44) + lpad(Math.round(m), 5) + " mi  " + Geo.level(m));
  }
}
console.log(`\n${Geo.AREAS.length} areas, ${Geo.CITIES.length} cities, ${new Set(Geo.CITIES.map(c => c[1])).size - 1} states + DC.`);
if (problems.length) { console.log(`\n${problems.length} PROBLEM${problems.length > 1 ? "S" : ""}:`); problems.forEach(p => console.log("  " + p)); process.exit(1); }
console.log("No problems.");
