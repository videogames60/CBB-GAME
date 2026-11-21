/* =====================================================================
   HOOPS SIM — PLAY-BY-PLAY TEXT
   The engine emits events; this file turns them into sentences.
   Add as many lines as you like to any list — one is picked at random.

   Placeholders: {player} {defender} {blocker} {victim} {assist} {from} {to}
                 {team} {on} {look} {num} {of} {pts}
   {look} is filled from LOOK below based on how open the shot was.
   Return null from describe() to hide an event type entirely.
   ===================================================================== */
(function (root) {
  const TEXT = {
    showPasses: false,        // true = log every pass (very chatty)
    showSubs: true,

    LOOK: { open: "wide-open", neutral: "", contested: "contested" },

    templates: {
      shot_made: {
        close: ["{player} finishes the {look} layup{assist}", "{player} scores inside{assist}", "{player} gets to the rim and lays it in{assist}"],
        mid:   ["{player} knocks down the {look} mid-range jumper{assist}", "{player} hits from the elbow{assist}", "{player} pulls up and buries it{assist}"],
        three: ["{player} drains the {look} three{assist}", "{player} from downtown, good!{assist}", "{player} splashes a triple{assist}"],
      },
      shot_missed: {
        close: ["{player} misses the {look} layup", "{player} can't finish over {defender}", "{player} rims out at the basket"],
        mid:   ["{player} misses the {look} mid-range jumper", "{player} pulls up, off the back iron", "{player} is short from the elbow"],
        three: ["{player} misses the {look} three", "{player} fires from deep, no good", "{player} off the mark from beyond the arc"],
      },
      shot_blocked: ["{defender} swats {player}'s shot away!", "{player} gets stuffed by {defender}", "{defender} with the rejection on {player}"],
      and_one: ["{player} scores and draws the foul on {defender}!", "And one! {player} finishes through contact", "{player} finishes through the hit — and one!"],
      fouled_shooting: ["{defender} fouls {player} on the shot", "{player} is fouled shooting by {defender}"],
      fouled_drive: ["{defender} fouls {player} on the drive", "{player} draws the foul attacking the basket"],
      fouled_reach: ["{player} reaches in on {on}", "Reach-in foul, {player}"],
      fouled_post: ["{defender} fouls {player} in the post", "{player} is hacked working on the block"],
      fouled_intentional: ["{player} fouls {on} immediately to stop the clock", "{team} sends {on} to the line — deliberate foul"],
      off_charge: ["{player} charges into {on}", "Offensive foul — {player} runs {on} over"],
      off_moving:  ["{player} called for a moving screen", "Illegal screen on {player}"],

      ft_made: ["{player} makes free throw {num} of {of}"],
      ft_missed: ["{player} misses free throw {num} of {of}"],

      steal: {
        onball: ["{player} picks {victim}'s pocket!", "{player} strips {victim}"],
        lane:   ["{player} jumps the passing lane and steals it", "{player} intercepts the pass"],
        strip:  ["{player} strips {victim} on the drive", "{victim} loses it driving, {player} comes up with it"],
        board:  ["{player} rips it right back from {victim} after the rebound", "{victim} grabs the board but {player} strips it away"],
        screen: ["{player} steals it out of the pick and roll"],
      },
      turnover: {
        loose: ["{player} travels", "{player} throws it away", "{player} steps out of bounds"],
        shotclock: ["Shot clock violation on {team}", "{player} can't get a shot off — shot clock"],
        post: ["{player} loses it in the post", "{player} is stripped on the block"],
        charge: ["Charge — turnover, {player}"],
        moving: ["Moving screen — turnover, {player}"],
      },
      steal_post: ["{player} digs down and takes it off {victim}"],
      fastbreak: ["{player} pushes it up the floor"],
      buzzer: ["Horn sounds — {player} couldn't get a shot off", "{team} runs out of time"],
      rebound_off: ["{player} grabs the offensive rebound", "{player} keeps it alive on the offensive glass"],
      rebound_def: ["{player} pulls down the rebound", "{player} secures the defensive board"],
      pass: ["{from} passes to {to}"],
      sub: ["{in} checks in for {out}"],
      timeout: ["Timeout, {team} ({left} left)"],
      media_timeout: ["Media timeout"],
      tip: ["{team} controls the tip", "{player} wins the tip over {over}"],
      period_start: ["Second half underway, {team} ball"],
      overtime_start: ["Overtime! {team} ball"],
      period_end: ["End of period. {team0} {s0}, {team1} {s1}"],
      end_game: ["Final: {team0} {s0}, {team1} {s1}"],
    },

    pickLine(list) { return list[Math.floor(Math.random() * list.length)]; },

    fill(tpl, data) {
      return tpl.replace(/\{(\w+)\}/g, (_, k) => (data[k] == null ? "" : data[k])).replace(/\s{2,}/g, " ").replace(/\s+,/g, ",");
    },

    clock(e) {
      const m = Math.floor(Math.max(0, e.clock) / 60), s = Math.floor(Math.max(0, e.clock) % 60);
      const label = e.period <= 2 ? `H${e.period}` : `OT${e.period - 2}`;
      return `${label} ${m}:${String(s).padStart(2, "0")}`;
    },

    describe(e) {
      const t = TEXT.templates;
      const d = { ...e, look: TEXT.LOOK[e.openness] || "", assist: e.assistBy ? ` (${e.assistBy} assist)` : "" };
      switch (e.type) {
        case "shot":
          if (e.blocked) return TEXT.fill(TEXT.pickLine(t.shot_blocked), d);
          if (e.made && e.fouled) return TEXT.fill(TEXT.pickLine(t.and_one), d) + (e.assistBy ? ` (${e.assistBy} assist)` : "");
          return TEXT.fill(TEXT.pickLine(e.made ? t.shot_made[e.zone] : t.shot_missed[e.zone]), d);
        case "foul":
          if (e.offensive) return TEXT.fill(TEXT.pickLine(e.kind === "charge" ? t.off_charge : t.off_moving), d);
          if ((e.kind === "shooting" || e.kind === "drive") && e.andOne) return null; // covered by and_one
          if (e.kind === "post") return TEXT.fill(TEXT.pickLine(t.fouled_post), { player: e.on, defender: e.player });
          if (e.kind === "intentional") return TEXT.fill(TEXT.pickLine(t.fouled_intentional), d);
          if (e.kind === "shooting") return TEXT.fill(TEXT.pickLine(t.fouled_shooting), { player: e.on, defender: e.player });
          if (e.kind === "drive") return TEXT.fill(TEXT.pickLine(t.fouled_drive), { player: e.on, defender: e.player });
          return TEXT.fill(TEXT.pickLine(t.fouled_reach), d);
        case "ft": return TEXT.fill(TEXT.pickLine(e.made ? t.ft_made : t.ft_missed), d);
        case "steal": return TEXT.fill(TEXT.pickLine(t.steal[e.how] || t.steal.onball), d);
        case "turnover":
          if (e.how === "charge" || e.how === "moving") return null;  // the offensive-foul line already covered it
          return TEXT.fill(TEXT.pickLine(t.turnover[e.how] || t.turnover.loose), d);
        case "rebound": return TEXT.fill(TEXT.pickLine(e.offensive ? t.rebound_off : t.rebound_def), d);
        case "fastbreak": return TEXT.showPasses ? TEXT.fill(TEXT.pickLine(t.fastbreak), d) : null;
        case "buzzer": return TEXT.fill(TEXT.pickLine(t.buzzer), d);
        case "pass": return TEXT.showPasses ? TEXT.fill(TEXT.pickLine(t.pass), d) : null;
        case "sub": return TEXT.showSubs ? TEXT.fill(TEXT.pickLine(t.sub), d) + (e.reason && e.reason !== "coach" ? ` (${e.reason})` : "") : null;
        case "timeout": return TEXT.fill(TEXT.pickLine(t.timeout), d);
        case "media_timeout": return TEXT.fill(TEXT.pickLine(t.media_timeout), d);
        case "tip": return TEXT.fill(TEXT.pickLine(t.tip), d);
        case "period_start": return TEXT.fill(TEXT.pickLine(e.overtime ? t.overtime_start : t.period_start), d);
        case "period_end": return TEXT.fill(TEXT.pickLine(t.period_end), { team0: e.teams[0], team1: e.teams[1], s0: e.score[0], s1: e.score[1] });
        case "end_game": return TEXT.fill(TEXT.pickLine(t.end_game), { team0: e.teams[0], team1: e.teams[1], s0: e.score[0], s1: e.score[1] });
        default: return null;
      }
    },
  };

  if (typeof module !== "undefined") module.exports = TEXT;
  else root.TEXT = TEXT;
})(typeof window !== "undefined" ? window : globalThis);
