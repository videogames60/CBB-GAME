/* HOOPS DYNASTY UI — help and the first-time tips.

   Every screen has a help card. The first time you open a screen it pops
   up; after that it lives in a slim "ⓘ How this screen works" bar at the
   top of the screen that opens the same card. The ? button in the header
   lists every topic, and can switch the pop-ups off or show them again.

   TO EDIT THE TEXT: change HELP below. Each topic has
     title   the card's heading
     short   one line, shown in the collapsed bar
     body    the card itself (HTML). A function is fine when the text needs
             a live number from the game's settings, so it stays right if
             you tune the game.
   What you've seen is remembered in this browser only. */

const HELP = {
  welcome: {
    title: "Welcome to Hoops Dynasty",
    short: "How a dynasty works",
    body: () => `
      <p>You're the head coach of a college program. Every year runs the same loop:</p>
      <ol>
        <li><b>The season.</b> Play your games live or sim them. Win to raise your prestige, NIL money and tournament hopes.</li>
        <li><b>Recruiting, all season long.</b> High school players weigh your money offer and how well you fit them. They sign by the end of the season.</li>
        <li><b>The postseason.</b> Conference tournaments, then the national tournament.</li>
        <li><b>The offseason.</b> The draft, player development, roster decisions (pay, promises), the transfer portal, then your new class arrives.</li>
      </ol>
      <p>Every screen has a help card like this one. It pops up the first time you open the screen, then stays in the <b>ⓘ bar</b> at its top. The <b>?</b> button in the header lists them all.</p>
      <p><b>Setting up:</b> pick a league (Compact, 74 teams; Full, 352; or one you made in the league editor), a conference, and either create your own program or take over an existing school. Low prestige is a rebuild; high prestige is a contender.</p>`,
  },
  hub: {
    title: "Hub",
    short: "Your next game, your team at a glance, your scheme",
    body: () => `
      <p>Your home screen: the next game and opponent, team stats, leaders, recent results and the season log.</p>
      <p><b>Moving the season along</b> (header buttons):</p>
      <ul>
        <li><b>Play game</b> takes you to your next game and lets you coach it live.</li>
        <li><b>Quick sim game</b> sims through your next game.</li>
        <li><b>Sim day / Sim week / Sim to end</b> keep going without stopping (a bar shows progress; Stop any time).</li>
      </ul>
      <p><b>Your scheme</b> is the offense and defense your team runs in every simulated game. Each has a <b>fit</b> grade for your current players: a scheme helps more when the roster suits it and your coach's tactics rating is high. Balanced and Man are the safe picks; the rest pay off more when they fit and cost you when they don't.</p>`,
  },
  schedule: {
    title: "Schedule",
    short: "Every game this season, results and what's next",
    body: () => `
      <p>Your full schedule: non-conference games first, then conference play, then the postseason as you reach it. The <b>Runs</b> column shows each opponent's scheme so you can plan.</p>
      <p>Home court matters (about 3–4 points for the home team, more in a great building). Postseason games are on neutral courts.</p>`,
  },
  roster: {
    title: "Roster",
    short: "Your players: ratings, stats, cards",
    body: () => `
      <p>Click a column to sort; switch between per-game <b>Stats</b> and raw <b>Ratings</b>. Click a player for his card: every rating, his season and career, history and hometown.</p>
      <p><b>Overall</b> is a summary for comparing players (on the same scale at every position); games use the individual ratings. <b>Potential</b> is how fast he can still grow: the higher it is, the more each season's development gives him.</p>
      <p><b>Redshirt</b> (on his card): he sits the season out but still develops, and keeps a year of eligibility.</p>`,
  },
  rotation: {
    title: "Rotation",
    short: "Who starts and how many minutes everyone plays",
    body: () => { const R = League.ROT_RULES || {}; return `
      <p><b>Auto</b> rebuilds the rotation before every game from whoever is healthy: the best five start and minutes follow overall, for the depth your coach likes (one man shorter in the postseason). Set a depth to override it.</p>
      <p><b>Manual</b> lets you set the starters and every player's minutes yourself. They stay until you change them or the roster turns over. The coach still pulls players in foul trouble or when they're exhausted, and empties the bench in a blowout.</p>
      <p><b>Rules:</b> at least ${R.minDepth ?? 7} players get minutes, nobody over ${R.maxMinutes ?? 40}, ${R.total ?? 200} in all. A heavy-minute player stays in through early fouls and plays tired instead of sitting, so expect him to fade late.</p>`; },
  },
  recruiting: {
    title: "Recruiting",
    short: "Offers, fit, scouting and points: how kids pick a school",
    body: () => { const C = Recruiting.CFG; return `
      <p><b>How a kid picks:</b> he compares each school's <b>effective offer</b> = your NIL money offer × his <b>fit</b> with your school. Fit is playing time, distance from home, your pipeline in his area, prestige, development and your relationship, each counting only as much as he cares about it. The best effective offer is the favorite, not a sure thing; about 20% ahead is close to a lock.</p>
      <p><b>Timing:</b> kids decide at the weekly refresh, before the other schools move, so you always get a week to answer a new offer. Everyone left signs or goes unsigned on signing day, after the title game. Empty scholarships become walk-ons.</p>
      <p><b>Money:</b> an offer holds its money until he decides or you withdraw. Pull one the same day you made it and it's free; later, it hurts the relationship.</p>
      <p><b>Scouting:</b> nobody sees a recruit's true ratings. Unscouted, you see the services' read, which is sometimes wrong. Spend scouting points to narrow his ranges (levels at ${C.scout.levels.join(" / ")} points); level 1 also shows what he wants and what your offer is really worth to him. The other schools scout too: each one forms its own read of every kid at the start of the cycle (better scouting staffs usually get closer to the truth, but anyone can get lucky or whiff) and bids on what it thinks he's worth. A school that's suddenly all over a low-ranked kid may know something.</p>
      <p><b>Recruiting points</b> build the relationship: up to ${C.points.capPerRecruit} a week per kid, and a week with no contact costs a little. Auto-recruiting spends them for you.</p>
      <p><b>Board tools:</b> ☆ adds a kid to your board; filter by position or <b>near you / your pipeline areas</b>. The hometown column marks <span style="color:var(--green)">home</span> (within ${Geo.CFG.miles.home} miles) and close (within ${Geo.CFG.miles.close}); ▲ is one of your pipeline areas.</p>`; },
  },
  recruitCard: {
    title: "A recruit",
    short: "Scout him, see your pitch, make an offer",
    body: () => `
      <p><b>Top:</b> his ranges (unscouted they're the services' read, which can be wrong), stars, hometown and distance from you.</p>
      <p><b>Scouting:</b> spend points to narrow his overall, potential and other ratings; at level 1 you learn what he wants.</p>
      <p><b>Your pitch:</b> how your school stacks up on each thing he weighs (playing time, proximity, prestige, development, relationship, pipeline) and what it does to your offer. The <b>multiplier</b> is the total: an offer of $100k at ×1.20 counts as $120k to him.</p>
      <p><b>The race:</b> who has offered and, once you can see what he wants, each school's odds if he decided today.</p>
      <p><b>Offer:</b> set an amount and offer. Your price is the offer that meets his ask with your fit. Points build the relationship.</p>`,
  },
  program: {
    title: "Program",
    short: "Money, NIL, prestige, facilities, your coach, pipelines",
    body: () => { const P = Pipelines.CFG; return `
      <p><b>NIL grade and the collective:</b> your boosters' money for player deals each cycle. Win more than the bar for your grade and it climbs; fall short and they pull back. Big moments (conference titles, tournament wins, Final Fours) add bumps.</p>
      <p><b>Prestige:</b> the long-run reputation. It works like NIL (a win % bar to hold it) but moves 3–4× slower, so it reflects years of winning. Big programs are also expected to go deep in the tournament: an early exit costs them, and every program drifts slowly toward the middle unless it keeps earning its spot. It drives recruiting pull, starting talent and your home crowd.</p>
      <p><b>The bank:</b> money you don't spend carries over to next cycle. Spend more than you have and it's debt: it grows each offseason, comes off the next collective first, and blocks new offers and facilities until it's paid. Player deals repeat every year but carried-over money only comes once, so a big balance is best spent on facilities.</p>
      <p><b>Facilities</b> speed up development and help your development pitch. Each point costs more than the last, and they wear down every offseason.</p>
      <p><b>Coach points</b> come from each season (more for winning, titles and tournament runs). Spend them on tactics, recruiting, development or scouting. Ratings only go up.</p>
      <p><b>Pipelines:</b> your standing in each area of the map. Developing ${P.levels[2][0]}+, Established ${P.levels[1][0]}+, Strong ${P.levels[0][0]}+. A pipeline helps with every recruit from that area. Your home area always counts and never drops below its floor (higher for big programs). Besides it, your strongest 2 count (3 with a 60+ staff recruiting rating, 4 with 80+); others fade fast. Signing kids from an area builds it; every offseason they fade a little.</p>`; },
  },
  staff: {
    title: "Staff",
    short: "You, your two assistants, job security, coaches to hire",
    body: () => { const C = Coaches.CFG; return `
      <p><b>Staff ratings:</b> every coaching rating the game uses (tactics in games, recruiting points, development, scouting) is the staff's: ${Math.round(C.split[0]*100)}% you and ${Math.round(C.split[1]*100)}% each assistant. An empty chair is a grad assistant (${C.grad.rating} in everything).</p>
      <p><b>Hiring:</b> pick anyone from the available coaches. He signs at his asking price for the contract length you choose (1–${C.contract.max} years). Pay comes out of the same money as player deals, every cycle.</p>
      <p><b>Contracts are locked.</b> In an assistant's final season you can <b>extend</b> him 1–${C.contract.max} more seasons at his ask then (re-priced from his ratings), starting when the current deal ends. Otherwise he leaves when it's up. <b>Letting him go</b> costs a buyout of ${Math.round(C.contract.buyout*100)}% of the pay left on his deal (and during the season, that season's pay is already spent).</p>
      <p><b>Assistants change:</b> young ones improve a little each year, older ones slowly decline. When a contract ends he leaves unless you've extended him, and a good assistant can be hired away to be a head coach elsewhere.</p>
      <p><b>Your own coach</b> improves with the points you spend on the Program tab. The school sets his pay when he signs; a better coach costs more at the next contract.</p>
      <p><b>Reputation</b> (under job security): what schools hire on, from your last 4 seasons. It decides which open jobs you can take in the coaching carousel each offseason.</p>
      <p><b>Job security:</b> the athletic director expects a record and a postseason from a program of your prestige. Beat it and security climbs; miss and it falls. At 0 you're fired (never in your first ${C.security.grace} seasons), unless you switched that off at setup.</p>`; },
  },
  carousel: {
    title: "The coaching carousel",
    short: "Firings, retirements and hiring, before the draft",
    body: () => `
      <p>Right after the season, every head coach gets his review. Coaches retire, get fired (job security at 0), or aren't re-signed when their contracts end. Assistants leave when their contracts are up.</p>
      <p><b>Open jobs:</b> every head job that opened this year, with why it opened. The schools that would hire you have a <b>Take the job</b> button; the rest show the reputation they want. Schools hire on <b>reputation</b> (your last 4 seasons: record, tournament runs, Coach of the Year), and the more prestigious the school, the more it wants. You can move any offseason, or stay. Moving takes your coach (ratings, points, record) to the new school; its roster, money and recruits become yours, your old job opens for the AI, and your assistants stay behind. The new school pays what it can afford. AI coaches move too: one who outgrows what his school can pay is <b>priced out</b>, and a bigger school with an opening can lure him away.</p>
      <p><b>If you're fired,</b> you must take one of the jobs that want you; at least a few always do.</p>
      <p><b>Then schools hire,</b> best program first: each takes the best coach it can afford, from the available coaches or another school's assistants (a promotion is the only way an assistant leaves before his contract is up). AI schools fill their assistant chairs; yours are up to you on the Staff tab.</p>`,
  },
  map: {
    title: "Map",
    short: "Your footprint: pipelines, distance rings, recruits, schools",
    body: () => `
      <p>Switch layers on and off at the top:</p>
      <ul>
        <li><b>Pipelines:</b> areas shaded by level; your home area has a dashed outline.</li>
        <li><b>Distance rings:</b> ${Geo.CFG.miles.home} miles (home) and ${Geo.CFG.miles.close} miles (close) around campus. Recruits care about distance as much as they care about staying near home.</li>
        <li><b>Your board:</b> recruits you've offered or starred, colored by status. Click one to open his card.</li>
        <li><b>Whole class:</b> every recruit this year; bigger dots are more stars.</li>
        <li><b>Schools:</b> diamonds by tier, yours in gold. Click one to see its pipelines and rings.</li>
        <li><b>Your roster's hometowns.</b></li>
      </ul>
      <p><b>Country / Around</b> zooms. Hover anything for details.</p>`,
  },
  standings: {
    title: "Standings",
    short: "Conference standings",
    body: () => `<p>Ordered by conference record, then overall record, then point differential. Conference standings set the seeds for the conference tournament. In a big league, pick a conference at the top (yours first).</p>`,
  },
  rankings: {
    title: "Rankings",
    short: "Efficiency, the polls, and the committee",
    body: () => `
      <p>Three lists that disagree on purpose:</p>
      <ul>
        <li><b>Adjusted efficiency</b> is how good teams really are: points scored and allowed per 100 possessions, corrected for opponents and venue.</li>
        <li><b>The AP and Coaches polls</b> are human: slow to move, impressed by records and big wins.</li>
        <li><b>The committee resume</b> is what picks and seeds the national tournament: efficiency, quadrant record (Q1 wins count most, Q4 losses hurt most), schedule strength and road wins. A losing record can't get an at-large bid.</li>
      </ul>
      <p>All three update every week.</p>`,
  },
  postseason: {
    title: "Postseason",
    short: "Conference tournaments and the national tournament",
    body: () => `
      <p><b>Conference tournaments</b> come first; each winner gets an automatic bid. Byes go to the top seeds when the field isn't a full bracket.</p>
      <p><b>Selection Sunday:</b> the rest of the field is filled with at-large bids by committee rank. In a big league the field is 68: a First Four (the four lowest automatic bids, and the last four at-large teams) and then 64 teams in four regions.</p>
      <p>Your games stop the sim like any other: play them live or quick sim.</p>`,
  },
  leaders: {
    title: "Leaders & Awards",
    short: "Award races, winners, and the league's stat leaders",
    body: () => `
      <p><b>During the season:</b> the award races, the top five in each. <b>On Selection Sunday</b> the awards are announced: Player of the Year, Defensive Player of the Year, Freshman of the Year, Sixth Man, Most Improved, Coach of the Year and three All-American teams, plus every conference's Player, Freshman and Coach of the Year, two All-Conference teams and its tournament MVP. The national tournament's Most Outstanding Player is named after the title game.</p>
      <p><b>How players are judged:</b> per-game production (points, rebounds, assists, steals and blocks, minus misses and turnovers), with team success counting. The best player on a winner beats the same numbers on a loser. Players need 60% of their team's games and 12+ minutes a game. Sixth Man: started at most a third of his games. Most Improved: the biggest jump over last season. Coach of the Year: the record furthest above what his program is expected to do.</p>
      <p>Past years are in the year picker. Awards also show on player and coach cards. Below the awards are the per-game stat leaders.</p>`,
  },
  draft: {
    title: "The draft",
    short: "Mock draft, who might leave, your draft record",
    body: () => { const D = Draft.CFG; return `
      <p><b>Draft stock</b> = overall + upside (potential above overall) + youth (a freshman goes higher than an otherwise equal senior) + the scouts' read.</p>
      <p><b>${D.picks} picks</b>, not all from your league: some go to prospects from outside it (international, G League). About ${Draft.leaguePicks(LG, LG.season + 1)} come from the league this year.</p>
      <p><b>Who leaves:</b> at season's end, underclassmen projected in the first round (1–${D.declareBy}) declare; ${D.declareBy + 1}–${D.testUpTo} test the waters. On draft day, before your roster decisions, testers still projected in the top ${D.stayIfBy} stay in and the rest come back. Seniors are always in. A drafted underclassman's salary comes back to your bank.</p>
      <p><b>Your draft record</b> (recent picks, first-rounders counting double) adds to the development part of your recruiting pitch, and each pick adds a little prestige.</p>`; },
  },
  league: {
    title: "League",
    short: "Every team, filters, and exporting the league",
    body: () => `
      <p>Every team with record, ratings (prestige, home court, NIL as letter grades), coach and scheme. Filter by conference, tier or name.</p>
      <p><b>Export league file</b> saves the league as it is today (schools, coaches, rosters) to edit in the league editor or start a new dynasty from.</p>`,
  },
  history: {
    title: "History",
    short: "Programs, the league year by year, the record book",
    body: () => `
      <p><b>Program:</b> any school's history (yours first; pick another from the list). It has the all-time record, titles and Final Fours, year by year, school records, its coaches, its best former players and its most-played series.</p>
      <p><b>League:</b> every season's champion, runner-up, Final Four, Player and Coach of the Year and Most Outstanding Player, plus the most successful programs.</p>
      <p><b>Record book:</b> the league's records for a single game, a single season, a career and a team. Records start when the dynasty does; a new league record, or one at your school, makes the news.</p>
      <p><b>Retired jerseys</b> (on each program's page): a school retires a jersey when a career there stands out by that school's own standard. The bigger the program, the higher the bar, so a small school retires its best player ever and a blue blood needs an All-American or a title run. A retired number isn't worn there again.</p>
      <p><b>Hall of Fame:</b> the league's best careers, inducted the offseason they leave. The bar is high: Players of the Year, All-Americans, title runs, big numbers, top draft picks. At most ${HallOfFame.CFG.player.cap} a year, often fewer or none. Head coaches are considered when they retire, and the bar is higher still: it takes national titles or a run of Final Fours, not just a long career (at most ${HallOfFame.CFG.coach.cap} a year).</p>`,
  },
  live: {
    title: "Playing a game live",
    short: "Pregame, then coaching: subs, timeouts, schemes",
    body: () => `
      <p><b>Pregame:</b> scout the opponent's best players, pick your offense and defense (and go-to guy for Iso), and set target minutes (they must total 200).</p>
      <p><b>In the game:</b></p>
      <ul>
        <li><b>The court</b> shows the ten players on the floor: the team with the ball in solid circles attacking the basket at the top, each defender a step off his man. The ball follows the play-by-play (passes, shots, rebounds, steals), and the line under it says who has it and who's guarding him. Tap a player for his card; the <b>Court</b> button hides or shows it.</li>
        <li><b>Play</b> runs it at the chosen speed; <b>Possession</b> steps one at a time; <b>Sim to end</b> lets your assistant finish it.</li>
        <li><b>Subs:</b> use the sub menu next to a player on the floor. Watch energy and fouls; the game pauses for foul trouble and opponent runs.</li>
        <li><b>Timeout:</b> a short rest and a defensive bump for a few possessions. Only the team with the ball can call one on a live ball; anyone can on a dead ball.</li>
        <li><b>Subs</b> happen on dead balls (a make, a foul, a violation, a timeout, before a free throw). Pick one on a live ball and he checks in at the next one. <b>Stop at dead balls</b> pauses Play at each one so you can make changes. The newest play is at the top of the play-by-play.</li>
        <li><b>Auto-coach</b> handles subs for you; <b>Late-game AI</b> holds for the last shot, milks a lead, fouls when trailing.</li>
        <li><b>Box score</b> and the <b>Rolls</b> tab (every dice roll with its odds) are under the play-by-play. On a phone the two lineups are tabs there too (<b>Away</b>, <b>Home</b>); your sub menus are in yours.</li>
      </ul>`,
  },
  decisions: {
    title: "Roster decisions",
    short: "Raises, promises and pushing players out, before transfers",
    body: () => { const C = Roster.CFG; return `
      <p>The draft has happened and your seniors have graduated. Every returning player has a <b>transfer chance</b>; the chips say why (minutes, his role next year, money, ...).</p>
      <p>Click a player to:</p>
      <ul>
        <li><b>Offer new pay</b> for next season (a raise or a cut). He asks what the open market would pay; at ${Math.round(C.money.tolerance * 100)}% of that or more he has no money complaint. It's an offer, not a lock: he still decides in the transfer window.</li>
        <li><b>Promise minutes.</b> It covers his minutes and role worries, but break it and he'll remember.</li>
        <li><b>Push him out:</b> he leaves for sure and his salary comes back, but teammates notice (a small bump to their chances).</li>
      </ul>
      <p>When you're done, the transfer window runs: everyone rolls his chance (at most ${C.maxPerTeam} leave on their own).</p>`; },
  },
  portal: {
    title: "The transfer portal",
    short: "Sign players who transferred out of other schools",
    body: () => `
      <p>Everyone who transferred out this offseason, league-wide. Ratings are exact: you've seen them play.</p>
      <p>Fit works like recruiting, with playing time counting extra (it's usually why they left). Every school starts at a neutral relationship; points push you above it. A player asks a little more than he would have from his old school.</p>
      <p>The portal runs in rounds. At the end of each round some players decide (more each round), then the other schools move. In the last round, schools with open spots make final offers and everyone left decides; anyone unsigned is gone.</p>
      <p>Offers hold money from your bank until he decides. Pay is per season and renegotiated every offseason.</p>`,
  },
  report: {
    title: "The offseason report",
    short: "Development, departures, arrivals and changes",
    body: () => `
      <p><b>Development:</b> every player's growth this offseason. It comes from minutes and production, his class, a hidden work rate, your staff's development rating and facilities, plus some luck. Potential sets how fast he grows.</p>
      <p><b>Departures and arrivals:</b> the draft, graduations, transfers out, portal signings and your new freshmen (with how your scouting read compared to the truth).</p>
      <p><b>Program:</b> NIL, money, facilities, coach points and prestige for the new season, plus your pipelines' growth.</p>
      <p><b>Year in review</b> (the first card): your season, honors, records set, draft picks, any jerseys your school retired, and this year's Hall of Fame class.</p>
      <p>When you're ready, start the next season. A dynasty runs ${League.MAX_SEASONS} seasons; after the last one you can export the league and keep going in a new dynasty.</p>`,
  },
};

/* ---------------- remembered per browser ---------------- */
const HELP_KEY = "hoopsDynasty.help";
let HELPST = { seen: {}, off: false, open: {} };
try { const s = JSON.parse(localStorage.getItem(HELP_KEY) || "null"); if (s) HELPST = { seen: s.seen || {}, off: !!s.off, open: s.open || {} }; } catch (e) {}
function helpSave(){ try { localStorage.setItem(HELP_KEY, JSON.stringify(HELPST)); } catch (e) {} }
const helpBody = (k) => { const h = HELP[k]; return h ? (typeof h.body === "function" ? h.body() : h.body) : ""; };

/* the slim bar at the top of a screen; opens into the full card */
function helpBar(k){
  const h = HELP[k]; if (!h) return "";
  const open = !!HELPST.open[k];
  return `<div class="helpBar ${open ? "open" : ""}">
    <button class="helpHead" onclick="helpToggle('${k}')"><span class="i">ⓘ</span> <b>${h.title}</b> <span class="hint">${open ? "" : "— " + h.short}</span><span class="chev">${open ? "▾" : "▸"}</span></button>
    ${open ? `<div class="helpBody">${helpBody(k)}</div>` : ""}
  </div>`;
}
function helpToggle(k){ HELPST.open[k] = !HELPST.open[k]; helpSave(); render(); }

/* the first time a screen is opened: its card pops up */
let helpQueue = null;
function helpFirst(k){
  if (!HELP[k] || HELPST.off || HELPST.seen[k]) return;
  if ($("helpBg").classList.contains("show")) { helpQueue = k; return; }   // one at a time
  helpShow(k, true);
}
let HELPCUR = null;
function helpShow(k, first){
  const h = HELP[k]; if (!h) return;
  HELPCUR = k;
  $("helpCard").innerHTML = `<div class="top"><div class="who">${h.title}</div><button class="close" onclick="helpClose('${k}')">×</button></div>
    <div class="helpBody">${helpBody(k)}</div>
    <div class="row" style="margin-top:12px;align-items:center">
      <button onclick="helpClose('${k}')">Got it</button>
      ${first ? `<label style="display:inline-flex;align-items:center;gap:6px;margin:0 0 0 8px;font-size:12px"><input type="checkbox" onchange="HELPST.off=this.checked;helpSave()"> Don't show these tips</label>` : ""}
      <span class="hint" style="margin-left:auto">${first ? "This stays in the ⓘ bar at the top of the screen." : ""}</span>
    </div>`;
  $("helpBg").classList.add("show");
}
function helpClose(k){
  if (k) { HELPST.seen[k] = true; helpSave(); }
  $("helpBg").classList.remove("show");
  if (helpQueue && helpQueue !== k) { const q = helpQueue; helpQueue = null; setTimeout(() => helpFirst(q), 50); }
}
/* the ? button: every topic, and the switches */
function helpIndex(){
  HELPCUR = null;
  $("helpCard").innerHTML = `<div class="top"><div class="who">Help</div><button class="close" onclick="$('helpBg').classList.remove('show')">×</button></div>
    <div class="helpIdx">${Object.entries(HELP).map(([k, h]) => `<div class="res" style="cursor:pointer" onclick="helpShow('${k}')"><span class="sc">ⓘ</span><span><b>${h.title}</b> <span class="hint">${h.short}</span></span><span></span></div>`).join("")}</div>
    <div class="row" style="margin-top:12px;align-items:center">
      <label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:12px"><input type="checkbox" ${HELPST.off ? "" : "checked"} onchange="HELPST.off=!this.checked;helpSave()"> Show tips the first time I open a screen</label>
      <button class="quiet" style="margin-left:auto" onclick="HELPST.seen={};HELPST.off=false;helpSave();$('helpBg').classList.remove('show');render()">Show all the tips again</button>
    </div>`;
  $("helpBg").classList.add("show");
}
/* which help topic belongs to the screen that's showing */
function helpKeyFor(tab){
  if (tab === "offseason") { const st = LG && LG.offseason && LG.offseason.stage; return st === "carousel" || st === "hiring" ? "carousel" : st === "decisions" ? "decisions" : st === "portal" ? "portal" : "report"; }
  return HELP[tab] ? tab : null;
}
