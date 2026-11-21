/* =====================================================================
   HOOPS SIM — PLAYER ARCHETYPES
   How players get built. Edit freely — this is data, not engine logic.

   Every rating starts at   team quality + position offset (POS_BASE below).
   Then the archetype rolls a GRADE for each of its SIGNATURE ratings:
       bust / average / good / elite   →  a random number inside that grade's
   range gets added. Elite can land in the 90s even on a mediocre team.
   WEAK ratings pay back part of the spike so specialists don't simply
   become better players. Everything else gets plain ±noise.

   Height: each archetype has a centre and a spread (inches). It is a bell
   curve, not a box — a 6'6" point guard is rare, not impossible.

   weight = how often the archetype is rolled, relative to the others at
   that position.
   ===================================================================== */
(function (root) {
  const ARCHETYPES = {

    /* offsets from team quality by position, before any archetype is applied */
    POS_BASE: {
      PG: { close: -6, mid: 2, three: 4, pass: 10, handle: 10, steal: 5, block: -18, perDef: 3, intDef: -12, reb: -14, stamina: 4 },
      SG: { close: -4, mid: 4, three: 6, pass: 1, handle: 4, steal: 3, block: -14, perDef: 3, intDef: -8, reb: -8, stamina: 2 },
      SF: { close: 0, mid: 3, three: 2, pass: -2, handle: 0, steal: 0, block: -6, perDef: 4, intDef: -2, reb: 0, stamina: 0 },
      PF: { close: 6, mid: -3, three: -8, pass: -8, handle: -10, steal: -5, block: 6, perDef: -4, intDef: 8, reb: 10, stamina: -2 },
      C: { close: 10, mid: -8, three: -16, pass: -12, handle: -16, steal: -8, block: 14, perDef: -10, intDef: 14, reb: 16, stamina: -4 },
    },

    /* grade roll for signature ratings: chance, then the bonus range added on top of base+posOffset */
    GRADES: {
      bust: { w: 10, range: [-11, -4] },
      average: { w: 45, range: [-1, 6] },
      good: { w: 33, range: [7, 14] },
      elite: { w: 12, range: [15, 27] },
    },
    noise: 6,             // ±noise on non-signature, non-weak ratings
    weakPenalty: 7,       // flat penalty on weak ratings ...
    payback: 0.35,        // ... plus this share of the total signature spike, spread across the weak ratings
    heightSpread: 2.0,    // one standard deviation, inches

    byPosition: {
      PG: [
        { name: "Floor general", w: 30, sig: ["pass", "handle"], weak: ["close", "block"], height: 74 },
        { name: "Scoring guard", w: 28, sig: ["three", "mid", "handle"], weak: ["pass", "perDef"], height: 74 },
        { name: "Pest", w: 20, sig: ["steal", "perDef", "stamina"], weak: ["three", "close"], height: 72 },
        { name: "Combo guard", w: 22, sig: ["handle", "mid"], weak: [], height: 75, mild: true },
      ],
      SG: [
        { name: "Sniper", w: 30, sig: ["three", "mid"], weak: ["handle", "perDef", "reb"], height: 76 },
        { name: "Slasher", w: 25, sig: ["handle", "close"], weak: ["three", "pass"], height: 77 },
        { name: "3-and-D", w: 28, sig: ["three", "perDef", "steal"], weak: ["handle", "pass"], height: 77 },
        { name: "Microwave", w: 17, sig: ["mid", "three", "close"], weak: ["pass", "perDef", "intDef"], height: 76 },
      ],
      SF: [
        { name: "Point forward", w: 20, sig: ["pass", "handle"], weak: ["block", "intDef"], height: 79 },
        { name: "Two-way wing", w: 32, sig: ["perDef", "steal", "three"], weak: ["pass"], height: 78 },
        { name: "Athlete", w: 26, sig: ["close", "reb", "block", "stamina"], weak: ["three", "mid", "pass"], height: 79 },
        { name: "Walking bucket", w: 22, sig: ["close", "mid", "three"], weak: ["pass", "perDef"], height: 78 },
      ],
      PF: [
        { name: "Stretch four", w: 26, sig: ["three", "mid"], weak: ["block", "intDef", "reb"], height: 80 },
        { name: "Bruiser", w: 30, sig: ["reb", "intDef", "close"], weak: ["three", "mid", "pass", "handle"], height: 82 },
        { name: "Face-up scorer", w: 24, sig: ["mid", "close", "handle"], weak: ["block", "perDef"], height: 80 },
        { name: "Small-ball four", w: 20, sig: ["perDef", "steal", "stamina"], weak: ["block", "reb"], height: 78 },
      ],
      C: [
        { name: "Rim protector", w: 32, sig: ["block", "intDef"], weak: ["close", "pass", "handle", "three"], height: 84 },
        { name: "Back-to-basket", w: 28, sig: ["close", "reb"], weak: ["three", "perDef", "handle"], height: 83 },
        { name: "Stretch five", w: 14, sig: ["three", "mid", "pass"], weak: ["block", "reb", "intDef"], height: 82 },
        { name: "Energy big", w: 26, sig: ["reb", "stamina", "steal"], weak: ["close", "mid", "three", "pass"], height: 82, bonus: { intDef: 5, block: 3 } },
      ],
    },

    /* any position, rolled after the archetype. chance is per player. */
    wildcards: [
      { name: "Freak", chance: 0.04, effect: "freak" },       // one random rating → 92–99
      { name: "Iron man", chance: 0.03, effect: "ironman" },  // stamina → 93–99
      { name: "Bust", chance: 0.04, effect: "bust" },         // every grade roll shifted down a tier
    ],
  };

  if (typeof module !== "undefined") module.exports = ARCHETYPES;
  else root.ARCHETYPES = ARCHETYPES;
})(typeof window !== "undefined" ? window : globalThis);
