const TUNING = {
  clock: {
    halfSeconds: 1200, otSeconds: 300, shotClock: 30, orebShotClock: 20, foulResetTo: 20,
    forcedShotAt: 4, buzzerShotAt: 6, pushUpBelow: 15, violationChance: 0.10, urgentAt: 9,
    mediaTimeouts: [960, 720, 480, 240],
  },
  time: {
    bringUp: [7, 12], transitionUp: [2, 3], pass: [3, 6], drive: [4, 7], iso: [5, 9], post: [4, 8],
    screen: [5, 9], shot: [1, 2], reset: [3, 5], outlet: [2, 3], kickout: [1, 2],
    handoff: [0, 1],   // the easy pass to a guard after a rebound happens while they bring it up: almost no extra time
  },
  action: {
    base: { pass: 46, drive: 18, shoot: 9, iso: 8, screen: 18, post: 6 },
    kPass: 0.025, kHandle: 0.025, kShoot: 0.03, catchShootMult: 2.2, putbackMult: 3.0,
    urgent: { shoot: 3.0, pass: 0.5, drive: 1.2, iso: 0.3, screen: 0.4, post: 0.2 },
    kPost: 0.03, postMinHeight: 78,
  },
  hazard: {
    onBallSteal: { base: 0.006, kSteal: 0.03 },
    looseTurnover: { base: 0.022, kHandle: 0.02 },
    reachFoul: { base: 0.042, kSteal: 0.015 },
  },
  pass: {
    kTarget: 0.02, kInitiator: 0.055, initiatorFloor: 58,
    steal: { base: 0.016, kLane: 0.03, kOnBall: 0.012, laneShare: 0.7 },
    kickout: { base: 0.008, kLane: 0.03 },
  },
  post: {
    base: { score: 34, foul: 12, kickOut: 22, fade: 16, turnover: 7, reset: 11 },
    kScore: 0.03, kFoul: 0.012, kKick: 0.02, kFade: 0.02, kTov: 0.025, entrySteal: 0.012, kEntry: 0.03,
  },
  drive: {
    base: { layup: 40, kickOut: 20, pullUp: 15, foul: 15, strip: 6, charge: 2.4 },
    kLayup: 0.02, kKick: 0.02, kPull: 0.02, kFoul: 0.012, kStrip: 0.03, kCharge: 0.01,
    andOne: 0.33, isoBonus: 1.3, screenBonus: 1.3,
  },
  iso: { base: { shoot: 34, drive: 34, reset: 24, strip: 8 }, kShoot: 0.02, kDrive: 0.025, kStrip: 0.03 },
  screen: {
    base: { pullUp: 22, roll: 26, drive: 20, kick: 14, reset: 12, turnover: 9, moving: 2.6 },
    kPull: 0.02, kRoll: 0.025, kRollPass: 0.01, kDrive: 0.02, kTov: 0.02, kMoving: 0.006,
  },
  zone: {
    base: { close: 15, mid: 18, three: 185 }, kRating: 0.07, pullupThreeMult: 0.85,
    bySource: {
      iso: { close: 0.55, mid: 2.80, three: 0.85 },
      screen: { close: 0.85, mid: 1.60, three: 0.95 },
      catch: { close: 0.70, mid: 0.95, three: 1.30 },
      pullup: { close: 1.00, mid: 1.00, three: 1.00 },
      forced: { close: 1.00, mid: 1.00, three: 1.00 },
      putback: { close: 9.00, mid: 0.60, three: 0.10 },
      post: { close: 5.00, mid: 1.40, three: 0.05 },
    },
  },
  openness: {
    bySource: {
      catch: { close: { open: 40, neutral: 40, contested: 20 }, mid: { open: 38, neutral: 42, contested: 20 }, three: { open: 40, neutral: 40, contested: 20 } },
      pullup: { close: { open: 15, neutral: 45, contested: 40 }, mid: { open: 18, neutral: 44, contested: 38 }, three: { open: 14, neutral: 40, contested: 46 } },
      iso: { close: { open: 26, neutral: 42, contested: 32 }, mid: { open: 30, neutral: 44, contested: 26 }, three: { open: 24, neutral: 42, contested: 34 } },
      drive: { close: { open: 34, neutral: 38, contested: 28 }, mid: { open: 22, neutral: 44, contested: 34 }, three: { open: 10, neutral: 40, contested: 50 } },
      roll: { close: { open: 42, neutral: 38, contested: 20 }, mid: { open: 30, neutral: 45, contested: 25 }, three: { open: 30, neutral: 45, contested: 25 } },
      screen: { close: { open: 25, neutral: 45, contested: 30 }, mid: { open: 30, neutral: 45, contested: 25 }, three: { open: 26, neutral: 44, contested: 30 } },
      putback: { close: { open: 30, neutral: 40, contested: 30 }, mid: { open: 20, neutral: 40, contested: 40 }, three: { open: 20, neutral: 40, contested: 40 } },
      forced: { close: { open: 5, neutral: 30, contested: 65 }, mid: { open: 6, neutral: 30, contested: 64 }, three: { open: 6, neutral: 28, contested: 66 } },
      post: { close: { open: 20, neutral: 44, contested: 36 }, mid: { open: 26, neutral: 46, contested: 28 }, three: { open: 20, neutral: 45, contested: 35 } },
    },
    kOpen: 0.015, kickoutOpenMult: 1.7,
  },
  shot: {
    fgPct: {
      close: { open: 0.66, neutral: 0.54, contested: 0.41 },
      mid: { open: 0.48, neutral: 0.40, contested: 0.32 },
      three: { open: 0.39, neutral: 0.32, contested: 0.25 },
    },
    kOff: 0.022, kDef: 0.015, contestFactor: { open: 0.15, neutral: 0.5, contested: 1.0 },
    fouledPenalty: -0.5, contestedCloseUsesCenter: true,
  },
  block: {
    base: {
      close: { open: 0.035, neutral: 0.10, contested: 0.18 },
      mid: { open: 0.005, neutral: 0.02, contested: 0.05 },
      three: { open: 0.002, neutral: 0.008, contested: 0.025 },
    },
    kBlock: 0.033, kHeight: 0.08,
  },
  foul: {
    shooting: {
      close: { open: 0.05, neutral: 0.14, contested: 0.23 },
      mid: { open: 0.015, neutral: 0.04, contested: 0.07 },
      three: { open: 0.005, neutral: 0.015, contested: 0.035 },
    },
    kDraw: 0.01, bonusFrom: 7, doubleBonusFrom: 10,
  },
  ft: { base: 0.70, kSkill: 0.02 },
  rebound: {
    pos: { PG: 0.68, SG: 0.74, SF: 0.92, PF: 1.10, C: 1.18 },
    kReb: 0.022, kHeight: 0.030, offTeamMult: 0.47, shooterMult: 0.55, ftMissOffMult: 0.5, blockedDefMult: 1.25,
  },
  transition: {
    driveMult: 1.7, layupMult: 1.35, openMult: 1.5, breakBase: 0.055, kBreakSpeed: 0.02,
    breakShotClock: 24, missedShotBonus: 1.35, tovLogit: 0.35,
    kRebounder: 0.025,                 // fast breaks off a rebound: × e^(k × (rebounder's handling + passing)/2 − 60)): a guard pushes more than a center
    stripBase: 0.009, kStrip: 0.04,    // right after a defensive rebound his man strips it back (his steal vs the rebounder's handling)
    stealBreak: 0.70,                  // a steal turns into a fast break this often (× pace); otherwise he pulls it out
    afterMakeBreak: 0.015,             // a fast break after a made basket (× pace): rare
  },
  offFoul: { countsAsTeamFoul: true },
  lateGame: {
    enabled: true, endOfHalf: true, halfHoldShootAt: 8, halfTimeScale: 1.05,
    holdShootAt: 6, chaseShootAt: 13, chaseMaxDeficit: 3, holdShootMult: 0.04, holdPassMult: 1.8,
    milkSeconds: 150, milkLead: 1, milkShootMult: 0.45, milkTimeScale: 1.35,
    hurrySeconds: 85, hurryDeficit: 1, hurryShootMult: 1.8, hurryTimeScale: 0.58,
    threeSeconds: 45, threeMult: 6.0, threeSecondsPerPoint: 9, threeMultBig: 3.4,
    foulSecondsBase: 16, foulSecondsPerPoint: 4.5, foulSecondsMax: 75, foulMinDeficit: 1, foulMaxDeficit: 10,
    foulSecondsPerTrip: [2, 4], huntWorstShooter: true,
  },
  homeCourt: {
    earlyMinutes: 4, lateMinutes: 4, earlyMult: 1.45, lateMult: 1.60, baseMult: 0.72, ftLogit: -0.04,
    shotLogit: 0.13, foulLogit: -0.16, tovLogit: 0.15, openBonus: 0.16, weakMult: 0.45, strongMult: 1.75,
  },
  tip: { kHeight: 0.20, kBlock: 0.02 },
  assist: { freshness: { shoot: 1.0, drive: 0.80, post: 0.62, screen: 0.34, iso: 0.12 }, minCount: 0.04 },
  /* CHANGES OF POSSESSION (engine.js: rebound, turnover, the start of a possession)
     handoff: with no fast break, the rebounder (or a player who stole it and pulled it out)
       gives it to the team's best ball handler: chance = sigmoid(handoffK × (gap − handoffGap)),
       gap = how far his handling + passing trails the best teammate's. A center nearly always,
       the best handler never (he just goes).
     safeSteal: that easy pass gets picked off this often (plus kLane per point of the receiver's
       defender's steal over the passer's passing, plus pressing/gambling defenses' steal bonus).
     push: on a fast break the man with the ball pushes it himself with chance
       sigmoid(pushK × (handling − pushHandle)); otherwise he throws it ahead to whoever's running
       (picked with flatK × the usual lean to ball handlers), stolen rushSteal of the time (same extras). */
  outlet: { kHandler: 0.05, handoffK: 0.4, handoffGap: 5, safeSteal: 0.0025, rushSteal: 0.02, kLane: 0.05,
            pushK: 0.25, pushHandle: 60, flatK: 0.5 },
  /* FATIGUE: energy drains on the floor (slower with more stamina, a little extra for hard
     actions) and comes back on the bench. Being tired costs a share of every rating on a
     curve: nothing while he's fresh (above freshAt), then steeper as he tires, reaching
     maxPenalty at floorAt:  penalty = maxPenalty × ((freshAt − energy) / (freshAt − floorAt)) ^ curve
     An average player (60 stamina) reaches the red (65%) after about 7–8 minutes on the floor,
     a 75 after about 9; at the coach's usual rest point (62%) he's down about −5 overall, deep
     in the red (45%) about −11. (Before: about −4 at the rest point, and red after ~5 minutes.) */
  fatigue: {
    enabled: true, drainPerSec: 0.00076, kStamina: 0.012,
    actionCost: { drive: 0.0032, iso: 0.0032, screen: 0.0016, shoot: 0.0008, pass: 0.0004 },
    recoverPerSec: 0.0012, halftimeRecover: 0.55, maxPenalty: 0.30, freshAt: 0.85, floorAt: 0.25, curve: 1.3,
  },
  rotation: {
    defaultMinutes: { starters: [34, 32, 31, 30, 28], bench: [16, 12, 9, 5, 3] },
    tolerance: 1.5, swapGap: 2, tiredBelow: 0.62, exhausted: 0.35, posPenalty: 4,
    earlyFouls: 2, earlySeconds: 600, firstHalfFouls: 3, secondHalfFouls: 4,
    closeSeconds: 240, closeMargin: 10, foulOutAt: 5,
    /* the plan is followed, not worshipped: a player planned for heavy
       minutes is only rested when he's much more tired (40 min → rests
       below 10% energy instead of 62%), so he plays through it and wears
       down. Fouls and real exhaustion still pull anyone. */
    heavyFrom: 18, tiredAtMax: 0.10, exhaustedAtMax: 0.05,
    returnEnergy: 0.85,    // a rested player sits until he's 20 points above his rest line (at most this)
    starMinutes: 34,       // planned this many minutes or more: stays in with two early fouls
    minStint: 120,         // a sub gets at least this many seconds before a minutes-based swap pulls him
    garbage: { seconds: 240, margin: 20 },   // late blowout: the bench gets the minutes
  },
  timeout: { perGame: 4, energy: 0.04, mediaEnergy: 0.04, possessions: 3, tovLogit: -0.4, defBonus: 2 },   // a team timeout and a media timeout both give the five on the floor +4% energy; halftime is the big one
  ai: { runTrigger: 8, lateSeconds: 120, lateMargin: 8 },
  ovr: {
    /* The weighted average runs hot or cold by position (a center's formula
       leans on rebounding/blocks/interior D, which generate high). Measured at
       equal generation quality; subtracted so equally good players show the
       same overall at every position. On-court play never reads overall. */
    posOffset: { PG: 0.6, SG: -2.4, SF: -2.3, PF: -1.1, C: 5.3 },
    weights: {
      PG: { close: 8, mid: 10, three: 14, pass: 18, handle: 18, steal: 8, block: 1, perDef: 13, intDef: 2, reb: 8 },
      SG: { close: 10, mid: 13, three: 17, pass: 9, handle: 13, steal: 8, block: 2, perDef: 14, intDef: 4, reb: 10 },
      SF: { close: 13, mid: 12, three: 13, pass: 9, handle: 10, steal: 8, block: 5, perDef: 13, intDef: 7, reb: 10 },
      PF: { close: 16, mid: 9, three: 7, pass: 5, handle: 5, steal: 5, block: 11, perDef: 7, intDef: 14, reb: 21 },
      C: { close: 18, mid: 5, three: 3, pass: 4, handle: 3, steal: 3, block: 16, perDef: 4, intDef: 20, reb: 24 },
    },
  },
  coach: { minScale: 0.4, maxScale: 1.0 },
  styles: {
    offense: {
      balanced: { label: "Balanced",
        fit: { keys: ["pass", "handle", "three", "close"], mode: "avg", low: 58, high: 77, min: 0.40, max: 1.10 },
        action: { pass: 1, drive: 1, shoot: 1, iso: 1, screen: 1, post: 1 }, zone: { close: 1, mid: 1, three: 1 },
        o: { open: 0.15 }, passTarget: {}, timeScale: 1.0, cost: {} },
      seven_seconds: { label: "7 Seconds",
        fit: { keys: ["handle", "stamina"], mode: "avg", low: 60, high: 79, min: 0.35, max: 1.15 },
        action: { pass: 0.75, drive: 1.3, shoot: 1.3, iso: 0.9, screen: 0.7, post: 0.5 }, zone: { close: 1.1, mid: 0.7, three: 1.3 },
        o: { openClose: 0.90, openThree: 0.50 }, passTarget: {}, timeScale: 0.85, breakMult: 3.0,   // 7 Seconds lives on the break
        cost: { tovLogit: 0.15, orebMult: 0.85, fatigueMult: 1.04 } },   // 7 Seconds teams are built on conditioning
      motion: { label: "Motion",
        fit: { keys: ["pass", "handle"], mode: "avg", low: 56, high: 75, min: 0.35, max: 1.15 },
        action: { pass: 1.35, drive: 0.9, shoot: 0.95, iso: 0.5, screen: 1.1, post: 1.0 }, zone: { close: 0.95, mid: 1.1, three: 1.0 },
        o: { open: 0.95 }, passTarget: {}, timeScale: 1.1, cost: { tovLogit: 0.06, fatigueMult: 1.12 } },
      post: { label: "Post",
        fit: { keys: ["close", "pass"], mode: "bigs", low: 57, high: 78, min: 0.35, max: 1.15 },
        action: { pass: 1.1, drive: 0.8, shoot: 0.9, iso: 1.0, screen: 0.9, post: 2.6 }, zone: { close: 1.35, mid: 1.0, three: 0.75 },
        o: { openClose: 1.15, draw: 0.55 }, passTarget: { C: 1.8, PF: 1.4 }, timeScale: 1.1,
        cost: { tovLogit: 0.14, fatigueMult: 1.05 } },
      pace_space: { label: "Pace and Space",
        fit: { keys: ["three"], mode: "avg", low: 56, high: 78, min: 0.35, max: 1.15 },
        action: { pass: 1.05, drive: 1.4, shoot: 1.0, iso: 0.8, screen: 1.0, post: 0.4 }, zone: { close: 1.1, mid: 0.5, three: 1.5 },
        o: { openThree: 1.05, openClose: 0.35 }, kickMult: 1.7, passTarget: {}, timeScale: 0.95,
        cost: { tovLogit: 0.08, orebMult: 0.90 } },
      grind: { label: "Grind It Out",
        fit: { keys: ["handle", "pass"], mode: "avg", low: 56, high: 75, min: 0.35, max: 1.15 },
        action: { pass: 1.25, drive: 0.9, shoot: 0.65, iso: 0.9, screen: 1.25, post: 1.2 }, zone: { close: 1.15, mid: 1.0, three: 0.9 },
        o: { open: 0.70, secure: 0.50 }, passTarget: {}, timeScale: 1.32, cost: { fatigueMult: 1.10 } },
      run_gun: { label: "Run and Gun",
        fit: { keys: ["stamina", "handle"], mode: "avg", low: 60, high: 79, min: 0.35, max: 1.15 },
        action: { pass: 0.8, drive: 1.2, shoot: 1.3, iso: 0.9, screen: 0.7, post: 0.4 }, zone: { close: 1.1, mid: 0.7, three: 1.25 },
        o: { openClose: 0.95, openThree: 0.30 }, breakMult: 3.5, passTarget: {}, timeScale: 0.82,
        cost: { tovLogit: 0.10, orebMult: 0.85, fatigueMult: 1.10, openPenalty: 0.06 } },
      iso: { label: "Iso",
        fit: { keys: ["close", "mid", "three", "handle"], mode: "target", low: 64, high: 86, min: 0.30, max: 1.20 },
        action: { pass: 0.8, drive: 1.1, shoot: 0.9, iso: 3.0, screen: 0.9, post: 0.5 }, zone: { close: 1.0, mid: 1.1, three: 1.0 },
        o: { open: 0.40 }, isoSelfMult: 2.4, isoTargetMult: 5.0, isoDeferMult: 0.5, passTarget: {}, timeScale: 1.05,
        cost: { tovLogit: 0.10 } },
    },
    defense: {
      man: { label: "Man", fit: { keys: ["perDef", "intDef"], mode: "avg", low: 59, high: 79, min: 0.40, max: 1.10 },
        d: { open: -0.40, closeOpen: -0.15 }, cost: {} },
      gamble: { label: "Gamble", fit: { keys: ["steal", "perDef"], mode: "avg", low: 59, high: 80, min: 0.30, max: 1.15 },
        d: { steal: 0.55 }, cost: { foul: 0.24, open: 0.20, drebMult: 0.95 } },
      zone23: { label: "2-3 Zone", fit: { keys: ["block", "intDef"], mode: "bigs", low: 65, high: 89, min: 0.30, max: 1.15 },
        d: { blockClose: 0.60, foul: -0.25, closeOpen: -0.40 }, cost: { threeOpen: 0.24, steal: -0.22, drebMult: 0.90 } },
      zone131: { label: "1-3-1", fit: { keys: ["steal", "perDef"], mode: "avg", low: 59, high: 80, min: 0.30, max: 1.15 },
        d: { steal: 0.50, threeOpen: -0.10 }, cost: { closeOpen: 0.28, drebMult: 0.86, foul: 0.08 } },
      press: { label: "Full-Court Press", fit: { keys: ["stamina", "steal"], mode: "min", low: 53, high: 74, min: 0.25, max: 1.10 },
        d: { steal: 0.55 }, cost: { fatigueMult: 1.17, closeOpen: 0.26, open: 0.08, foul: 0.18 },   // fatigue costs eased when subs became dead-ball only
        stealBreak: 0.90 },   // its steals come in the backcourt: almost always a run-out (others: transition.stealBreak)
    },
  },
};
if (typeof module !== "undefined") module.exports = TUNING;
else if (typeof window !== "undefined") window.TUNING = TUNING;
