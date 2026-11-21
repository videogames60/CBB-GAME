/* =====================================================================
   HOOPS SIM — PLAYER & TEAM GENERATOR
   Builds players from archetypes.js and rosters around a "quality" number.
   The same generator will produce recruiting classes later, so every
   player carries an archetype label and a hidden potential.
   ===================================================================== */
(function (root) {
  const ARCH = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./archetypes.js")
             : (typeof ARCHETYPES !== "undefined" ? ARCHETYPES : root.ARCHETYPES);

  const FIRST = ["Marcus", "Jalen", "Devon", "Tyrese", "Malik", "Xavier", "Cameron", "Isaiah", "Elijah", "Trey", "Darius", "Amir", "Jaylen", "Andre", "Deshawn", "Quentin", "Julian", "Marquis", "Terrell", "Braxton", "Zion", "Nasir", "Reggie", "Corey", "Anthony", "Justin", "Damon", "Kobe", "Luka", "Nikola"];
  const LAST = ["Whitfield", "Carrington", "Boyd", "Mosley", "Radford", "Tatum", "Ellison", "Pruitt", "Hargrove", "Deloach", "Winslow", "Broussard", "Castellan", "Pemberton", "Okafor", "Vance", "Hollis", "Kessler", "Rutledge", "Marchetti", "Stringer", "Fontenot", "Grissom", "Ledoux", "Cantrell", "Youngblood", "Sherrod", "Delacroix", "Northcutt", "Rainwater"];
  const KEYS = ["close", "mid", "three", "pass", "handle", "steal", "block", "perDef", "intDef", "reb", "stamina"];
  const GRADE_ORDER = ["bust", "average", "good", "elite"];

  const clamp = (v) => Math.max(25, Math.min(99, Math.round(v)));
  const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
  function wpick(rand, items, wOf) {
    let total = 0; for (const it of items) total += wOf(it);
    let r = rand() * total;
    for (const it of items) { r -= wOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
  /* STAMINA is mostly its own thing, not a mirror of skill: a roll around `mean` (sd `sd`),
     plus `skill` × how far the player's quality is from 60, plus his position and archetype
     lean (an Energy big or a Pest runs high, centers a bit lower). A walk-on can be a gym rat
     and a star can tire fast. (It doesn't count in overall, and it doesn't develop.) */
  const STAMINA = { mean: 65, sd: 9, skill: 0.2 };
  /* bell-ish: mean + spread * (sum of 3 uniforms, centred and scaled to sd 1) */
  const bell = (rand, mean, sd) => mean + sd * ((rand() + rand() + rand()) - 1.5) / 0.5;

  /* One player. base = quality-derived number for this roster slot. */
  function generatePlayer(rand, { id, pos, base, quality = base }) {
    const P = ARCH.POS_BASE[pos], list = ARCH.byPosition[pos];
    const arch = wpick(rand, list, a => a.w);
    const wild = ARCH.wildcards.find(w => rand() < w.chance) || null;
    const gradeShift = wild && wild.effect === "bust" ? -1 : 0;

    const ratings = {}, grades = {};
    let spike = 0;
    for (const k of KEYS) {
      let v = base + (P[k] || 0) + ((arch.bonus && arch.bonus[k]) || 0);
      if (arch.sig.includes(k)) {
        let gi = GRADE_ORDER.indexOf(wpick(rand, GRADE_ORDER, g => ARCH.GRADES[g].w));
        gi = Math.max(0, gi + gradeShift);
        const gname = GRADE_ORDER[gi], range = ARCH.GRADES[gname].range;
        const scale = arch.mild ? 0.6 : 1;
        const bonus = ri(rand, range[0], range[1]) * scale;
        grades[k] = gname;
        spike += Math.max(0, bonus - 5);    // spike above a middling roll
        v += bonus;
      } else if (arch.weak.includes(k)) {
        v -= ARCH.weakPenalty + ri(rand, -3, 3);
        ratings[k] = v;                     // payback applied after we know the spike
        continue;
      } else {
        v += ri(rand, -ARCH.noise, ARCH.noise);
      }
      ratings[k] = v;
    }
    if (arch.weak.length && spike > 0) {
      const each = (ARCH.payback * spike) / arch.weak.length;
      for (const k of arch.weak) ratings[k] -= each;
    }
    { const lean = ratings.stamina - base;   // position + archetype (+ the usual noise)
      ratings.stamina = bell(rand, STAMINA.mean + STAMINA.skill * (base - 60), STAMINA.sd) + lean; }
    if (wild && wild.effect === "freak") { const k = KEYS[Math.floor(rand() * (KEYS.length - 1))]; ratings[k] = ri(rand, 92, 99); grades[k] = "elite"; }
    if (wild && wild.effect === "ironman") ratings.stamina = ri(rand, 93, 99);
    for (const k of KEYS) ratings[k] = clamp(ratings[k]);

    return {
      id, pos, ratings, grades,
      name: FIRST[Math.floor(rand() * FIRST.length)] + " " + LAST[Math.floor(rand() * LAST.length)],
      height: Math.round(bell(rand, arch.height, ARCH.heightSpread)),
      archetype: arch.name, wildcard: wild ? wild.name : null,
      potential: clamp(quality + ri(rand, -4, 18)),  // hidden; nothing reads it yet
    };
  }

  function generateTeam(rand, { id, name, mascot, abbr, color, quality = 65, coach = {} } = {}) {
    const players = [];
    let n = 0;
    for (const pos of ["PG", "SG", "SF", "PF", "C"]) {
      for (let slot = 0; slot < 2; slot++) {
        const base = quality + (slot === 0 ? ri(rand, 0, 6) : ri(rand, -12, -3));
        const p = generatePlayer(rand, { id: `${id}-${++n}`, pos, base, quality });
        p.starter = slot === 0;
        players.push(p);
      }
    }
    return { id, name, mascot, abbr: abbr || autoAbbr(name), color,
             coach: { rating: 60, offense: "balanced", defense: "man", ...coach }, players };
  }

  /* "Eastwood State" -> "EAS"; "North Carolina A&T" -> "NCA" */
  function autoAbbr(name) {
    if (!name) return "???";
    const words = name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
    if (words.length >= 3) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
    if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
    return (words[0] || "???").slice(0, 3).toUpperCase();
  }

  const SampleTeams = { generateTeam, generatePlayer, autoAbbr, ARCHETYPES: ARCH };
  if (typeof module !== "undefined") module.exports = SampleTeams;
  else root.SampleTeams = SampleTeams;
})(typeof window !== "undefined" ? window : globalThis);
