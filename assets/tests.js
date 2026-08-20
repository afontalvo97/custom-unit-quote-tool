/*
 * Regression tests — the 10 worked quotes from "CUSTOM QUOTES" (internal training).
 * Open index.html?test=1 to run them; results render in a panel at the top of the page.
 */
(function (global) {
  'use strict';

  var base = {
    level: 'classic', mode: 'unit', hairType: 'regular', gray: 'none', cwhPercent: '50',
    density: 100, laceBase: false, knots: 'none', clips: 0, rootColor: false,
    frenchTop: false, frenchPart: false, spareHair: 'none', extraFronts: 0
  };

  function q(overrides) {
    var input = {};
    for (var k in base) input[k] = base[k];
    for (var k2 in overrides) input[k2] = overrides[k2];
    return input;
  }

  var CASES = [
    { name: 'Ex 1 — TOH, simple base case',
      input: q({ tier: 'toh', hairLength: 7 }), subtotal: 423, total: 423 },

    { name: 'Ex 2 — TOH, European hair + human gray',
      input: q({ tier: 'toh', hairType: 'euro', hairLength: 5, gray: 'human', density: 115 }),
      subtotal: 575, total: 575 },

    { name: 'Ex 3 — 3/4 Cap, Remy + half-unit invisible knots',
      input: q({ tier: 'threeQuarter', hairType: 'remy', hairLength: 12, knots: 'half' }),
      subtotal: 1032, total: 1032 },

    { name: 'Ex 4 — Full Cap, gray + comb clips + density 150%',
      input: q({ tier: 'full', hairLength: 10, gray: 'human', clips: 6, density: 150 }),
      subtotal: 862, total: 1293 },

    { name: 'Ex 5 — Full Cap, heavy density 180%',
      input: q({ tier: 'full', hairLength: 14, density: 180 }),
      subtotal: 1353, total: 2367.75 },

    { name: 'Ex 6 — 3/4 Cap, Yak gray + light density',
      input: q({ tier: 'threeQuarter', hairLength: 6, gray: 'yak', density: 115 }),
      subtotal: 524, total: 524 },

    { name: 'Ex 7 — Full Cap, full-unit knots + root color',
      input: q({ tier: 'full', hairLength: 22, knots: 'full', rootColor: true }),
      subtotal: 2393, total: 2393 },

    { name: 'Ex 8 — TOH, High Heat fiber + High Heat gray + clips + density',
      input: q({ tier: 'toh', hairType: 'highHeat', hairLength: 8, gray: 'highHeat', clips: 4, density: 150 }),
      subtotal: 554, total: 831 },

    { name: 'Ex 9 — 3/4 Cap, synthetic gray (free) + French injection top',
      input: q({ tier: 'threeQuarter', hairLength: 10, gray: 'synthetic', frenchTop: true, density: 160 }),
      subtotal: 962, total: 1443 },

    { name: 'Ex 10 — TOH, "same as stock" with human gray',
      input: q({ tier: 'toh', hairLength: 6, gray: 'human', density: 100 }),
      subtotal: 394, total: 394 },

    // Extra guardrail checks beyond the training deck.
    { name: 'Guard — density 181%+ doubles the subtotal',
      input: q({ tier: 'full', hairLength: 14, density: 190 }),
      subtotal: 1353, total: 2706 },

    { name: 'Guard — lace base zeroes the invisible-knots charge',
      input: q({ tier: 'full', hairLength: 22, knots: 'full', laceBase: true }),
      subtotal: 2274, total: 2274 },

    { name: 'Guard — Signature level prices the same unit lower than Classic',
      input: q({ level: 'signature', tier: 'full', hairLength: 10, gray: 'human', clips: 6, density: 150 }),
      subtotal: 768, total: 1152 },

    { name: 'Guard — Elite level, same unit',
      input: q({ level: 'elite', tier: 'full', hairLength: 10, gray: 'human', clips: 6, density: 150 }),
      subtotal: 698, total: 1047 },

    { name: 'Guard — repair, Full Cap 12"',
      input: q({ mode: 'repair', tier: 'full', hairLength: 12 }),
      subtotal: 545, total: 545 },

    // --- Requested changes, Aug 2026 ---

    { name: 'HVI — 8x10 keeps 3/4 Cap pricing and flags the HVI Top of Head difference',
      input: q({ tier: 'threeQuarter', width: 8, length: 10, hairLength: 6 }),
      subtotal: 496, total: 496,
      warns: ['a Top of Head for HVI'] },

    { name: 'HVI — 10x8 flags it too (dimensions in either order)',
      input: q({ tier: 'threeQuarter', width: 10, length: 8, hairLength: 6 }),
      subtotal: 496, total: 496,
      warns: ['a Top of Head for HVI'] },

    { name: 'HVI — picking the tier by hand drops the 8x10 notice',
      input: q({ tier: 'toh', width: 0, length: 0, hairLength: 6 }),
      subtotal: 366, total: 366, noWarns: true },

    { name: 'European hair — 16" is past the 14" cap, still priced, flagged',
      input: q({ tier: 'toh', hairType: 'euro', hairLength: 16 }),
      subtotal: 1555, total: 1555,
      warns: ['European Hair only goes up to 14"'] },

    { name: 'European hair — 14" is inside the cap, no flag',
      input: q({ tier: 'toh', hairType: 'euro', hairLength: 14 }),
      subtotal: 1362, total: 1362, noWarns: true },

    { name: 'Yak gray — 8" is past the 6" cap, still priced, flagged',
      input: q({ tier: 'threeQuarter', hairLength: 8, gray: 'yak' }),
      subtotal: 594, total: 594,
      warns: ['Yak gray is listed only up to 6"'] },

    { name: 'Yak gray — 6" is inside the cap, no flag',
      input: q({ tier: 'threeQuarter', hairLength: 6, gray: 'yak' }),
      subtotal: 524, total: 524, noWarns: true },

    { name: 'Density — under 100% carries no extra charge',
      input: q({ tier: 'full', hairLength: 14, density: 'under100' }),
      subtotal: 1353, total: 1353, noWarns: true }
  ];

  function run() {
    return CASES.map(function (c) {
      var r = global.QuoteEngine.quote(c.input);
      var ok = r.errors.length === 0 && r.subtotal === c.subtotal && r.total === c.total;
      if (ok && c.warns) {
        ok = c.warns.every(function (needle) {
          return r.warnings.some(function (w) { return w.indexOf(needle) !== -1; });
        });
      }
      if (ok && c.noWarns) {
        ok = !c.warnings || r.warnings.length === 0;
      }
      return {
        name: c.name, pass: ok,
        expected: { subtotal: c.subtotal, total: c.total },
        actual: { subtotal: r.subtotal, total: r.total, errors: r.errors, warnings: r.warnings }
      };
    });
  }

  global.QuoteTests = { cases: CASES, run: run };
})(window);
