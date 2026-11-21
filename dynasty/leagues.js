/* =====================================================================
   HOOPS DYNASTY — LEAGUE DEFINITIONS
   A league definition is plain data: the conferences (name, tier, size,
   region) and, optionally, the actual schools in each. League.generateLeague
   builds a league from whichever definition you pick.

     conference:  { id, name, short, tier 1–4, size, region,
                    schools?: [{ name, mascot, abbr, color, prestige }] }
     A conference without a schools list gets made-up schools from the
     name pools below (that's how the built-in presets work). A schools
     list may be shorter than size; the rest are made up. Any field of a
     school may be left out.

     tierPrestige: the average prestige of a school in each conference tier
                   (schools spread −14…+16 around it)
     rules (all optional; missing ones are filled in by size, see rulesFor):
       nonConfGames  games per team outside the conference (11)
       confGames     conference games per team; 0 = everyone home and away
       confTourney   how many teams make each conference tournament; 0 = all
       natField      national tournament size. A field that isn't a power of
                     two gets play-in games (68 = 64 + a First Four)

   This file is the seed of custom leagues: a conference editor or an
   imported league file only has to produce one of these objects.
   ===================================================================== */
(function (root) {
  const NAMES = {
    places: ["Ashford", "Bellhaven", "Calloway", "Danforth", "Eastwood", "Fairmont", "Granville", "Hollencrest", "Ironwood", "Jamesport", "Kingsbury", "Lakemont", "Marbury", "Northfield", "Oakhurst", "Pinehurst", "Queensbridge", "Ridgeview", "Stonebridge", "Thornton", "Underhill", "Vandermeer", "Westbrook", "Yorkfield", "Alderbrook", "Braxton", "Cedarville", "Dunmore", "Elmsworth", "Fallbrook", "Glenmoor", "Harrowgate", "Inglewood", "Kestrel Bay", "Larkspur", "Millbrook", "Norwood", "Orchard Hill", "Prescott", "Rockvale", "Selby", "Tanglewood", "Ellsworth", "Wexford", "Ashbury", "Blackwell", "Carrington", "Deerfield", "Fenwick", "Greystone", "Havenport", "Kirkwood", "Linden", "Merridew", "Oakmont", "Pembroke", "Rosemont", "Shelburne", "Trenholm", "Waverly", "Ambrose", "Bexley", "Colbourne", "Dorsey", "Edgemere", "Fitzhugh", "Galewood", "Hartsfield", "Kenmore", "Lockhaven", "Montrose", "Norbury", "Ravenna", "Sutcliffe", "Templeton", "Abernathy", "Acton", "Addison", "Alcott", "Allendale", "Alton", "Amherst", "Andover", "Appleton", "Arden", "Arlington", "Ashland", "Atherton", "Auburn", "Avondale", "Bainbridge", "Baldwin", "Bancroft", "Barrington", "Bartlett", "Bayport", "Beacon", "Bedford", "Belmont", "Benton", "Berkley", "Bishop", "Blakely", "Bloomfield", "Bolton", "Bradford", "Brandon", "Brentwood", "Briarcliff", "Bridgeton", "Brighton", "Bristol", "Brookfield", "Burlington", "Cadwell", "Cambria", "Camden", "Canfield", "Carlisle", "Carver", "Castleton", "Chadwick", "Chandler", "Chatham", "Chester", "Clayton", "Clearwater", "Clifton", "Clinton", "Colfax", "Concord", "Copley", "Cortland", "Crandall", "Cromwell", "Dalton", "Darby", "Davenport", "Dayton", "Delmar", "Denton", "Derby", "Dexter", "Dover", "Draper", "Dryden", "Dumont", "Eastgate", "Easton", "Eldridge", "Elkhart", "Emerson", "Endicott", "Everett", "Fairfax", "Fairhaven", "Farley", "Fayette", "Fenton", "Fleming", "Forsyth", "Foxboro", "Franklin", "Freeport", "Fulton", "Gainsborough", "Garland", "Garrison", "Glendale", "Goshen", "Grafton", "Granger", "Greenfield", "Greenville", "Hadley", "Halston", "Hamilton", "Hampden", "Hancock", "Harlow", "Harmon", "Hartwell", "Hastings", "Hawthorne", "Hayden", "Hendrick", "Highland", "Hillsdale", "Holbrook", "Holloway", "Hopewell", "Houghton", "Hudson", "Huntley", "Irving", "Jasper", "Jefferson", "Kendall", "Kensington", "Kent", "Kingsley", "Lancaster", "Langley", "Lawson", "Lexington", "Lincoln", "Livingston", "Lockwood", "Lowell", "Ludlow", "Lyndon", "Madison", "Malvern", "Mansfield", "Marion", "Marshall", "Maxwell", "Mayfield", "Medford", "Melrose", "Meriden", "Milford", "Monroe", "Morrow", "Newbury", "Newcastle", "Newport", "Northgate", "Oakdale", "Oberlin", "Ogden", "Oxford", "Palmer", "Parkhurst", "Paxton", "Pierce", "Plainfield", "Porter", "Preston", "Princeton", "Putnam", "Quincy", "Radcliffe", "Raleigh", "Randolph", "Redmond", "Remington", "Richmond", "Riverton", "Rochester", "Rockford", "Rowan", "Rutherford", "Salem", "Sanford", "Saxon", "Sheffield", "Shelby", "Sherwood", "Somerset", "Southgate", "Spencer", "Stafford", "Stanton", "Sterling", "Stockton", "Stratford", "Sumner", "Sutton", "Talbot", "Taunton", "Thayer", "Tilden", "Townsend", "Trenton", "Tyler", "Upton", "Vernon", "Wakefield", "Walden", "Walton", "Warren", "Warwick", "Wellesley", "Wendell", "Weston", "Whitfield", "Whitman", "Wilkes", "Willard", "Windham", "Winslow", "Woodbury", "Woodland", "Worthing", "Wyndham", "Yardley"],
    suffix: ["State", "University", "College", "A&M", "Tech", "Union", "Institute", ""],
    mascots: ["Ravens", "Miners", "Bulldogs", "Wolverines", "Foxes", "Titans", "Mariners", "Colonels", "Pioneers", "Hawks", "Badgers", "Raiders", "Lions", "Stallions", "Falcons", "Gators", "Cougars", "Crusaders", "Vikings", "Panthers", "Timberwolves", "Rams", "Owls", "Bears", "Broncos", "Cardinals", "Eagles", "Jackrabbits", "Knights", "Mustangs", "Otters", "Spartans", "Thunderbirds", "Wildcats", "Yellowjackets", "Coyotes", "Grizzlies", "Herons", "Lancers", "Sentinels", "Aces", "Admirals", "Anchors", "Archers", "Aztecs", "Bandits", "Bison", "Blazers", "Bobcats", "Buccaneers", "Chargers", "Chiefs", "Comets", "Condors", "Cyclones", "Defenders", "Dolphins", "Dragons", "Ducks", "Explorers", "Flames", "Generals", "Gladiators", "Golden Bears", "Griffins", "Guardians", "Hornets", "Huskies", "Jaguars", "Javelinas", "Kingfishers", "Lakers", "Leopards", "Lumberjacks", "Marauders", "Monarchs", "Musketeers", "Navigators", "Ospreys", "Patriots", "Pelicans", "Phoenix", "Pirates", "Quakers", "Rangers", "Rattlers", "Red Foxes", "Redhawks", "Rebels", "Rockets", "Roadrunners", "Sabres", "Saints", "Scots", "Seahawks", "Settlers", "Sharks", "Skyhawks", "Sooners", "Stags", "Storm", "Tigers", "Tornadoes", "Trojans", "Voyagers", "Warhawks", "Warriors", "Wolves", "Wranglers"],
    colors: ["#C0392B", "#2471A3", "#1E8449", "#7D3C98", "#B7950B", "#CA6F1E", "#17A589", "#A93226", "#2E4053", "#196F3D", "#6C3483", "#B9770E", "#1A5276", "#922B21", "#0E6655", "#5B2C6F", "#D35400", "#1F618D", "#145A32", "#4A235A", "#9A7D0A", "#AF601A", "#117864", "#78281F", "#1B2631", "#0B5345", "#512E5F", "#9C640C", "#154360", "#641E16", "#0E6251", "#4D5656"],
  };

  const LEAGUES = {
    compact: {
      id: "compact", name: "Compact", blurb: "74 teams in 8 conferences",
      defaultConf: "HRT",
      tierPrestige: { 1: 72, 2: 60, 3: 50, 4: 42 },
      rules: { nonConfGames: 11, confGames: 0, confTourney: 8, natField: 16 },
      conferences: [
        { id: "GRT", name: "Great Lakes", short: "GL", tier: 1, size: 10, region: "Midwest" },
        { id: "ATC", name: "Atlantic Coast", short: "AC", tier: 1, size: 10, region: "Southeast" },
        { id: "PAC", name: "Pacific Conference", short: "PC", tier: 1, size: 10, region: "West" },
        { id: "SUN", name: "Sunbelt Alliance", short: "SA", tier: 2, size: 10, region: "South" },
        { id: "NOR", name: "Northern League", short: "NL", tier: 2, size: 10, region: "Northeast" },
        { id: "HRT", name: "Heartland", short: "HL", tier: 3, size: 8, region: "Midwest" },
        { id: "PDM", name: "Piedmont", short: "PM", tier: 3, size: 8, region: "Southeast" },
        { id: "FRN", name: "Frontier", short: "FR", tier: 4, size: 8, region: "West" },
      ],
    },
    full: {
      id: "full", name: "Full", blurb: "352 teams in 32 conferences, a 68-team national tournament",
      defaultConf: "OZK",
      tierPrestige: { 1: 70, 2: 57, 3: 46, 4: 38 },
      rules: { nonConfGames: 11, confGames: 20, confTourney: 0, natField: 68 },
      conferences: [
        { id: "BIG", name: "Big Continental", short: "BC", tier: 1, size: 16, region: "Midwest" },
        { id: "SEA", name: "Seaboard", short: "SB", tier: 1, size: 16, region: "Southeast" },
        { id: "PCF", name: "Pacific Federation", short: "PF", tier: 1, size: 16, region: "West" },
        { id: "ATL", name: "Atlantic Ten-Six", short: "A6", tier: 1, size: 14, region: "Northeast" },
        { id: "SWC", name: "Southwest", short: "SW", tier: 1, size: 12, region: "South" },
        { id: "MTN", name: "Mountain Union", short: "MU", tier: 1, size: 12, region: "West" },
        { id: "VAL", name: "Valley", short: "VA", tier: 2, size: 12, region: "Midwest" },
        { id: "CAP", name: "Capital", short: "CP", tier: 2, size: 12, region: "Northeast" },
        { id: "GCF", name: "Gulf Coast", short: "GC", tier: 2, size: 11, region: "South" },
        { id: "PRA", name: "Prairie", short: "PR", tier: 2, size: 11, region: "Midwest" },
        { id: "BLR", name: "Blue Ridge", short: "BR", tier: 2, size: 10, region: "Southeast" },
        { id: "CAS", name: "Cascade", short: "CA", tier: 2, size: 10, region: "West" },
        { id: "KEY", name: "Keystone", short: "KS", tier: 2, size: 10, region: "Northeast" },
        { id: "RIO", name: "Rio Grande", short: "RG", tier: 2, size: 10, region: "South" },
        { id: "LKS", name: "Lakeshore", short: "LS", tier: 3, size: 12, region: "Midwest" },
        { id: "PDT", name: "Piedmont", short: "PD", tier: 3, size: 12, region: "Southeast" },
        { id: "HRL", name: "Heartland", short: "HL", tier: 3, size: 10, region: "Midwest" },
        { id: "BAY", name: "Bayou", short: "BY", tier: 3, size: 10, region: "South" },
        { id: "SIE", name: "Sierra", short: "SI", tier: 3, size: 10, region: "West" },
        { id: "COL", name: "Colonial", short: "CL", tier: 3, size: 10, region: "Northeast" },
        { id: "OZK", name: "Ozark", short: "OZ", tier: 3, size: 10, region: "South" },
        { id: "TID", name: "Tidewater", short: "TW", tier: 3, size: 9, region: "Southeast" },
        { id: "CNY", name: "Canyon", short: "CN", tier: 3, size: 9, region: "West" },
        { id: "FRT", name: "Frontier", short: "FR", tier: 4, size: 10, region: "West" },
        { id: "NWD", name: "Northwoods", short: "NW", tier: 4, size: 10, region: "Midwest" },
        { id: "HAR", name: "Harbor", short: "HB", tier: 4, size: 10, region: "Northeast" },
        { id: "DLT", name: "Delta", short: "DL", tier: 4, size: 10, region: "South" },
        { id: "PIN", name: "Pinelands", short: "PL", tier: 4, size: 10, region: "Southeast" },
        { id: "PLN", name: "High Plains", short: "HP", tier: 4, size: 10, region: "Midwest" },
        { id: "SND", name: "Sandhills", short: "SH", tier: 4, size: 10, region: "Southeast" },
        { id: "MSA", name: "Mesa", short: "MS", tier: 4, size: 9, region: "West" },
        { id: "GRN", name: "Green Mountain", short: "GM", tier: 4, size: 9, region: "Northeast" },
      ],
    },
  };

  /* a definition by id, or a definition object passed straight through */
  function get(def) {
    if (def && typeof def === "object") return def;
    return LEAGUES[def || "compact"] || LEAGUES.compact;
  }
  const teamCount = (def) => get(def).conferences.reduce((s, c) => s + c.size, 0);

  /* a definition's rules with the gaps filled in by league size */
  function rulesFor(def) {
    def = get(def);
    const n = teamCount(def), confs = def.conferences.length, r = { ...(def.rules || {}) };
    if (r.nonConfGames == null) r.nonConfGames = 11;
    if (r.confGames == null) r.confGames = n > 120 ? 20 : 0;
    if (r.confTourney == null) r.confTourney = n > 120 ? 0 : 8;
    if (r.natField == null) r.natField = n >= 250 ? 68 : n >= 120 ? 32 : n >= 40 ? 16 : 8;
    r.natField = Math.max(2, Math.min(n, Math.max(r.natField, confs)));   // room for every auto bid
    return r;
  }
  const list = () => Object.values(LEAGUES).map(d => ({ id: d.id, name: d.name, blurb: d.blurb, teams: teamCount(d), conferences: d.conferences.length }));

  /* ---------------- league files ----------------
     A league file is a definition as JSON (export one from the setup screen
     to start from). check() cleans one up and lists what's wrong; a file
     with problems isn't used. */
  const REGIONS = ["Northeast", "Southeast", "Midwest", "South", "West"];
  const geo = () => (typeof module !== "undefined" && typeof require !== "undefined") ? require("./geo.js") : root.Geo;
  function check(raw) {
    const errors = [];
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.conferences)) return { errors: ["The file needs a \"conferences\" list."] };
    const def = { id: String(raw.id || "custom").replace(/[^\w-]/g, "").slice(0, 24) || "custom", name: String(raw.name || "Custom league").slice(0, 40),
      blurb: raw.blurb ? String(raw.blurb).slice(0, 120) : "", tierPrestige: { 1: 72, 2: 60, 3: 50, 4: 42, ...(raw.tierPrestige || {}) },
      rules: raw.rules && typeof raw.rules === "object" ? { ...raw.rules } : undefined, conferences: [] };
    const ids = new Set(), names = new Set();
    raw.conferences.forEach((c, i) => {
      const where = `Conference ${i + 1}${c && c.name ? ` (${c.name})` : ""}`;
      if (!c || typeof c !== "object") { errors.push(`${where}: not an object.`); return; }
      const id = String(c.id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (!id) errors.push(`${where}: needs an id (a short code like "BIG").`);
      else if (ids.has(id)) errors.push(`${where}: id ${id} is used twice.`);
      ids.add(id);
      const schools = Array.isArray(c.schools) ? c.schools : [];
      const size = c.size == null ? schools.length : Math.round(+c.size);
      if (!(size >= 2 && size <= 40)) errors.push(`${where}: size must be 2–40 (or give a schools list).`);
      if (schools.length > size) errors.push(`${where}: ${schools.length} schools listed but size is ${size}.`);
      const tier = Math.round(+c.tier || 3);
      if (tier < 1 || tier > 4) errors.push(`${where}: tier must be 1–4.`);
      const region = REGIONS.includes(c.region) ? c.region : "Midwest";
      if (c.region && !REGIONS.includes(c.region)) errors.push(`${where}: region must be one of ${REGIONS.join(", ")}.`);
      let states;
      if (c.states != null) {
        const known = new Set(geo().STATES());
        if (!Array.isArray(c.states)) errors.push(`${where}: states must be a list like ["TX", "OK"].`);
        else { states = c.states.map(x => String(x).toUpperCase()); const bad = states.filter(x => !known.has(x)); if (bad.length) errors.push(`${where}: unknown state${bad.length > 1 ? "s" : ""} ${bad.join(", ")}.`); }
      }
      const clean = [];
      schools.forEach((sc, j) => {
        if (!sc || typeof sc !== "object") { errors.push(`${where}, school ${j + 1}: not an object.`); return; }
        const o = {};
        if (sc.name) { o.name = String(sc.name).slice(0, 40); if (names.has(o.name)) errors.push(`${where}: school "${o.name}" appears twice in the league.`); names.add(o.name); }
        if (sc.mascot) o.mascot = String(sc.mascot).slice(0, 30);
        if (sc.abbr) o.abbr = String(sc.abbr).toUpperCase().replace(/[^A-Z0-9&]/g, "").slice(0, 4);
        if (sc.color) { if (/^#[0-9a-fA-F]{6}$/.test(sc.color)) o.color = sc.color; else errors.push(`${where}, ${o.name || "school " + (j + 1)}: color must look like #1A5276.`); }
        if (sc.prestige != null) { const p = Math.round(+sc.prestige); if (p >= 20 && p <= 96) o.prestige = p; else errors.push(`${where}, ${o.name || "school " + (j + 1)}: prestige must be 20–96.`); }
        const who = `${where}, ${o.name || "school " + (j + 1)}`;
        if (sc.city != null) { if (geo().CITY[sc.city]) o.city = sc.city; else errors.push(`${who}: city "${sc.city}" isn't on the map (geo.js); use "Name, ST" like "Chapel Hill, NC".`); }
        if (sc.pipelines != null) {
          if (typeof sc.pipelines !== "object" || Array.isArray(sc.pipelines)) errors.push(`${who}: pipelines must look like {"TX-HOU": 40}.`);
          else { o.pipelines = {}; for (const a in sc.pipelines) { const v = int(sc.pipelines[a], 0, 100); if (!geo().AREA[a]) errors.push(`${who}: pipeline area "${a}" isn't on the map.`); else if (v == null) errors.push(`${who}: pipeline ${a} must be 0–100.`); else o.pipelines[a] = v; } }
        }
        for (const k of ["homeCourt", "facilities", "nil"]) if (sc[k] != null) { const v = Math.round(+sc[k]); if (v >= 1 && v <= 99) o[k] = v; else errors.push(`${who}: ${k} must be 1–99.`); }
        if (sc.coach != null) o.coach = checkCoach(sc.coach, who, errors);
        if (sc.players != null) o.players = checkPlayers(sc.players, who, errors);
        clean.push(o);
      });
      def.conferences.push({ id, name: String(c.name || id).slice(0, 40), short: String(c.short || id.slice(0, 2)).slice(0, 4), tier, size, region, ...(states ? { states } : {}), schools: clean });
    });
    const n = def.conferences.reduce((a, c) => a + (c.size || 0), 0);
    if (def.conferences.length < 2) errors.push("A league needs at least 2 conferences.");
    if (n > 500) errors.push(`${n} teams is more than the 500 the game supports.`);
    const abbrs = def.conferences.flatMap(c => c.schools.map(s => s.abbr).filter(Boolean));
    const dup = abbrs.find((a, i) => abbrs.indexOf(a) !== i);
    if (dup) errors.push(`Abbreviation ${dup} is used by two schools.`);
    def.defaultConf = def.conferences.some(c => c.id === raw.defaultConf) ? raw.defaultConf : (def.conferences[0] || {}).id;
    return { def, errors };
  }
  /* coaches and rosters in a league file */
  const POSITIONS = ["PG", "SG", "SF", "PF", "C"], CLASSES = ["FR", "SO", "JR", "SR"];
  const TEMPERAMENTS = ["loyal", "steady", "restless", "ambitious"];
  const RATINGS = ["close", "mid", "three", "pass", "handle", "steal", "block", "perDef", "intDef", "reb", "stamina"];
  const ROSTER_MAX = 13;
  const styles = () => { const T = typeof module !== "undefined" && typeof require !== "undefined" ? require("../sim/tuning.js") : root.TUNING; return T && T.styles; };
  const int = (v, lo, hi) => { const n = Math.round(+v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  function checkCoach(c, who, errors) {
    if (typeof c !== "object") { errors.push(`${who}: coach must be an object.`); return undefined; }
    const o = {};
    if (c.name) o.name = String(c.name).slice(0, 40);
    for (const k of ["rating", "recruiting", "development", "scouting"]) if (c[k] != null) { const v = int(c[k], 25, 99); if (v == null) errors.push(`${who}: coach ${k} must be 25–99.`); else o[k] = v; }
    const S = styles();
    if (c.offense != null) { if (S && !S.offense[c.offense]) errors.push(`${who}: coach offense "${c.offense}" isn't one of ${Object.keys(S.offense).join(", ")}.`); else o.offense = c.offense; }
    if (c.defense != null) { if (S && !S.defense[c.defense]) errors.push(`${who}: coach defense "${c.defense}" isn't one of ${Object.keys(S.defense).join(", ")}.`); else o.defense = c.defense; }
    if (c.years != null) { const v = int(c.years, 0, 60); if (v == null) errors.push(`${who}: coach years must be 0–60.`); else o.years = v; }
    return o;
  }
  const heightOk = (h) => { if (typeof h === "number") return h >= 64 && h <= 92; const m = String(h).match(/^\s*(\d)\s*['\-\s]\s*(\d{1,2})/); return !!m && +m[1] * 12 + +m[2] >= 64 && +m[1] * 12 + +m[2] <= 92; };
  function checkPlayers(list, who, errors) {
    if (!Array.isArray(list)) { errors.push(`${who}: players must be a list.`); return undefined; }
    if (list.length > ROSTER_MAX) errors.push(`${who}: ${list.length} players; a roster holds ${ROSTER_MAX}.`);
    const out = [];
    list.forEach((p, i) => {
      const w = `${who}, player ${i + 1}${p && p.name ? ` (${p.name})` : ""}`;
      if (!p || typeof p !== "object") { errors.push(`${w}: not an object.`); return; }
      const o = {};
      if (!p.name) errors.push(`${w}: needs a name.`); else o.name = String(p.name).slice(0, 40);
      if (!POSITIONS.includes(p.pos)) errors.push(`${w}: pos must be one of ${POSITIONS.join(", ")}.`); else o.pos = p.pos;
      if (p.class != null) { if (!CLASSES.includes(p.class)) errors.push(`${w}: class must be FR, SO, JR or SR.`); else o.class = p.class; }
      if (p.height != null) { if (!heightOk(p.height)) errors.push(`${w}: height must be 64–92 inches (or like "6-8").`); else o.height = p.height; }
      if (p.ovr != null) { const v = int(p.ovr, 25, 99); if (v == null) errors.push(`${w}: ovr must be 25–99.`); else o.ovr = v; }
      if (p.potential != null) { const v = int(p.potential, 25, 99); if (v == null) errors.push(`${w}: potential must be 25–99.`); else o.potential = v; }
      if (p.ratings != null) {
        if (typeof p.ratings !== "object") errors.push(`${w}: ratings must be an object.`);
        else { o.ratings = {}; for (const k in p.ratings) { if (!RATINGS.includes(k)) { errors.push(`${w}: unknown rating "${k}" (ratings are ${RATINGS.join(", ")}).`); continue; } const v = int(p.ratings[k], 1, 99); if (v == null) errors.push(`${w}: ${k} must be 1–99.`); else o.ratings[k] = v; } }
      }
      if (p.temperament != null) { if (!TEMPERAMENTS.includes(p.temperament)) errors.push(`${w}: temperament must be one of ${TEMPERAMENTS.join(", ")}.`); else o.temperament = p.temperament; }
      for (const [k, lo, hi] of [["loyalty", 0, 99], ["workRate", 0, 99]]) if (p[k] != null) { const v = int(p[k], lo, hi); if (v == null) errors.push(`${w}: ${k} must be ${lo}–${hi}.`); else o[k] = v; }
      if (p.moneyWeight != null) { const v = +p.moneyWeight; if (!(v >= 0 && v <= 1)) errors.push(`${w}: moneyWeight must be 0–1.`); else o.moneyWeight = v; }
      if (p.home != null) { if (geo().CITY[p.home]) o.home = p.home; else errors.push(`${w}: hometown "${p.home}" isn't on the map; use "Name, ST" like "Houston, TX".`); }
      for (const k of ["redshirt", "redshirtUsed"]) if (p[k]) o[k] = true;
      if (p.archetype) o.archetype = String(p.archetype).slice(0, 30);
      if (p.wildcard) o.wildcard = String(p.wildcard).slice(0, 30);
      out.push(o);
    });
    return out;
  }

  /* add a checked definition to the list (an imported file) */
  function register(def) { LEAGUES[def.id] = def; return def; }

  const Leagues = { NAMES, LEAGUES, REGIONS, get, teamCount, list, rulesFor, check, register };
  if (typeof module !== "undefined") module.exports = Leagues;
  else root.Leagues = Leagues;
})(typeof window !== "undefined" ? window : globalThis);
