/*
 * Custom Unit Quoting Engine
 * New Image & Hair Visions — internal sales tool
 *
 * Pure pricing logic, no DOM. Mirrors "HOW TO QUOTE CUSTOM UNITS":
 *   base price (size tier + hair length + hair type)
 *   + gray extra charge + add-ons  =  subtotal
 *   subtotal x density %           =  density charge
 *   subtotal + density charge      =  total
 *
 * Every amount comes from the pricing-list PDFs via pricing-data.js, and every
 * line reports the inventory ID it was pulled from so a rep can verify it
 * against the printed list.
 */
(function (global) {
  'use strict';

  var DATA = global.PRICING_DATA;

  var LEVELS = [
    { id: 'classic', label: 'Classic' },
    { id: 'signature', label: 'Signature' },
    { id: 'elite', label: 'Elite' }
  ];

  // Size tiers. Area is width x length in square inches.
  var TIERS = [
    { id: 'toh', code: 'TOH', label: 'Top of Head', short: 'TOH', maxArea: 79 },
    { id: 'threeQuarter', code: '34', label: '3/4 Cap', short: '3/4 Cap', maxArea: 99 },
    { id: 'full', code: 'FC', label: 'Full Cap', short: 'Full Cap', maxArea: Infinity }
  ];

  var HAIR_TYPES = [
    { id: 'regular', code: '', label: 'Regular Hair' },
    { id: 'remy', code: 'R', label: 'Remy / Cuticle Hair' },
    { id: 'euro', code: 'E', label: 'European Hair' },
    { id: 'highHeat', code: 'F', label: 'High Heat / Endura Fiber' },
    { id: 'highHeatRemy', code: 'M', label: 'High Heat Fiber w/ Indian Remy' }
  ];

  var GRAY_OPTIONS = [
    { id: 'none', label: 'No gray', charged: false },
    { id: 'synthetic', label: 'Regular Synthetic gray', charged: false, note: 'Regular Synthetic gray carries no extra charge.' },
    { id: 'human', label: 'Human Hair gray', charged: true, prefix: 'CUSHGREY', maxLength: 10 },
    { id: 'yak', label: 'Yak gray', charged: true, prefix: 'CUSYAKGREY' },
    { id: 'highHeat', label: 'High Heat gray', charged: true, prefix: 'CUSHHGREY' },
    { id: 'cwh', label: 'Chinese White Hair (CWH)', charged: true, prefix: 'CUSCWH', byPercent: true, maxLength: 6 }
  ];

  var CWH_PERCENTS = [
    { id: '50', label: '50% or less', codePart: '50' },
    { id: '80', label: '51% to 80%', codePart: '80' },
    { id: '100', label: '81% to 100%', codePart: '100' }
  ];

  var KNOT_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: 'front', label: 'Front only', codePart: 'FRONT' },
    { id: 'half', label: '1/2 Unit', codePart: 'HALF' },
    { id: 'full', label: 'Full Unit', codePart: 'FULL' }
  ];

  var SPARE_HAIR_OPTIONS = [
    { id: 'none', label: 'None' },
    { id: '1oz', label: '1 oz', code: 'CUSXHAIR1OZ' },
    { id: '2oz', label: '2 oz', code: 'CUSXHAIR2OZ' }
  ];

  // Extra density charge, straight off the pricing list.
  var DENSITY_BANDS = [
    { min: 0, max: 149.999, rate: 0, label: 'Under 150% — no extra charge' },
    { min: 150, max: 170, rate: 0.5, label: '150% – 170% — +50% of the subtotal' },
    { min: 170.001, max: 180, rate: 0.75, label: '180% — +75% of the subtotal' },
    { min: 180.001, max: Infinity, rate: 1, label: '181% and up — +100% of the subtotal' }
  ];

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function priceOf(level, code) {
    var table = DATA.levels[level];
    if (!table || !(code in table)) return null;
    return table[code];
  }

  function describe(code) {
    return DATA.descriptions[code] || '';
  }

  /* ---------- size ---------- */

  function tierFromArea(area) {
    if (!(area > 0)) return null;
    for (var i = 0; i < TIERS.length; i++) if (area <= TIERS[i].maxArea) return TIERS[i].id;
    return 'full';
  }

  /* ---------- hair length rows ---------- */

  // Which length rows exist for this level / hair type / tier, read off the data
  // itself so the app never claims a price the pricing list does not have.
  function availableLengths(level, hairTypeId, tierId, mode) {
    var tier = byId(TIERS, tierId);
    var lengths = [];
    if (!tier) return lengths;
    for (var len = 1; len <= 30; len++) {
      if (priceOf(level, baseCode(hairTypeId, tierId, len, mode)) != null) lengths.push(len);
    }
    return lengths;
  }

  function baseCode(hairTypeId, tierId, length, mode) {
    var tier = byId(TIERS, tierId);
    if (!tier) return '';
    if (mode === 'repair') return 'CUSREP' + tier.code + pad2(length);
    var type = byId(HAIR_TYPES, hairTypeId);
    if (!type) return '';
    return 'CUS' + tier.code + type.code + pad2(length);
  }

  // The shortest row that covers the requested length. The 06" row reads
  // "up to 06"", so anything at or below 6" lands there; in-between lengths
  // (e.g. 8.5") round up to the next row on the list.
  function resolveLengthRow(requested, lengths) {
    if (!lengths.length) return { row: null, reason: 'unavailable' };
    for (var i = 0; i < lengths.length; i++) {
      // i === 0 is the "up to 06"" row, which legitimately covers anything shorter.
      if (requested <= lengths[i]) return { row: lengths[i], rounded: i > 0 && requested !== lengths[i] };
    }
    return { row: null, reason: 'tooLong', max: lengths[lengths.length - 1] };
  }

  /* ---------- density ---------- */

  function densityBand(pct) {
    for (var i = 0; i < DENSITY_BANDS.length; i++) {
      if (pct >= DENSITY_BANDS[i].min && pct <= DENSITY_BANDS[i].max) return DENSITY_BANDS[i];
    }
    return DENSITY_BANDS[0];
  }

  /* ---------- the quote ---------- */

  function quote(input) {
    var out = {
      lines: [],
      subtotal: 0,
      density: { percent: input.density, rate: 0, amount: 0, label: '' },
      total: 0,
      warnings: [],
      errors: []
    };

    var level = input.level;
    if (!DATA.levels[level]) {
      out.errors.push('Pick a pricing level.');
      return out;
    }
    var mode = input.mode === 'repair' ? 'repair' : 'unit';
    var tier = byId(TIERS, input.tier);
    if (!tier) {
      out.errors.push('Enter the size so the tier can be determined.');
      return out;
    }

    function add(label, code, amount, note) {
      out.lines.push({
        label: label,
        code: code || null,
        catalog: code ? describe(code) : '',
        amount: round2(amount),
        note: note || null
      });
      out.subtotal += amount;
    }

    /* base unit price */
    var hairTypeId = mode === 'repair' ? 'regular' : input.hairType;
    var lengths = availableLengths(level, hairTypeId, tier.id, mode);
    var requested = Number(input.hairLength);

    if (!(requested > 0)) {
      out.errors.push('Enter the hair length.');
    } else {
      var resolved = resolveLengthRow(requested, lengths);
      if (!resolved.row) {
        if (resolved.reason === 'tooLong') {
          out.errors.push(
            'The pricing list stops at ' + resolved.max + '" for ' +
            (mode === 'repair' ? 'repairs' : byId(HAIR_TYPES, hairTypeId).label) +
            ' on a ' + tier.label + '. Check with the Custom Department for ' + requested + '".'
          );
        } else {
          out.errors.push('No pricing-list rows for that combination.');
        }
      } else {
        var code = baseCode(hairTypeId, tier.id, resolved.row, mode);
        var price = priceOf(level, code);
        var label = mode === 'repair'
          ? 'Repair — ' + tier.label + ', ' + (resolved.row === lengths[0] ? 'up to ' : '') + resolved.row + '"'
          : byId(HAIR_TYPES, hairTypeId).label + ' — ' + tier.label + ', ' +
            (resolved.row === lengths[0] ? 'up to ' : '') + resolved.row + '"';
        add(label, code, price);
        if (resolved.rounded) {
          out.warnings.push(
            requested + '" is not its own line on the pricing list — quoted from the ' +
            resolved.row + '" row. Confirm with the Custom Department.'
          );
        }
        if (hairTypeId !== 'regular' && mode === 'unit') {
          out.lines[out.lines.length - 1].note =
            'The ' + byId(HAIR_TYPES, hairTypeId).label + ' extra charge is already built into this price line.';
        }
      }
    }

    if (mode === 'repair') {
      out.subtotal = round2(out.subtotal);
      out.total = out.subtotal;
      out.warnings.push('The factory decides whether a unit can be repaired — no deposit is charged on repairs.');
      return out;
    }

    /* gray */
    var gray = byId(GRAY_OPTIONS, input.gray) || GRAY_OPTIONS[0];
    if (gray.charged) {
      var grayCode = gray.byPercent
        ? gray.prefix + (byId(CWH_PERCENTS, input.cwhPercent) || CWH_PERCENTS[0]).codePart + tier.code
        : gray.prefix + tier.code;
      var grayPrice = priceOf(level, grayCode);
      if (grayPrice == null) {
        out.errors.push('No gray charge on the list for ' + gray.label + ' on a ' + tier.label + '.');
      } else {
        var grayLabel = gray.label + ' — ' + tier.short;
        if (gray.byPercent) {
          grayLabel = gray.label + ' ' + (byId(CWH_PERCENTS, input.cwhPercent) || CWH_PERCENTS[0]).label + ' — ' + tier.short;
        }
        add(grayLabel, grayCode, grayPrice,
          'Flat rate by unit size' + (gray.byPercent ? ', priced by % of gray' : ' — the % of gray does not matter') + '.');
      }
      if (gray.maxLength && requested > gray.maxLength) {
        out.warnings.push(
          gray.label + ' is listed only up to ' + gray.maxLength + '" — this unit is ' + requested +
          '". Confirm with the Custom Department before quoting.'
        );
      }
      if (gray.id === 'highHeat' && input.hairType === 'highHeat') {
        out.warnings.push(
          'The hair is already High Heat Fiber, so the client may not technically owe the High Heat Grey charge. ' +
          'When it is unclear, quote it anyway to be safe.'
        );
      }
    } else if (gray.note) {
      out.lines.push({ label: gray.label, code: null, catalog: '', amount: 0, note: gray.note });
    }

    /* comb clips */
    var clips = Math.max(0, Math.floor(Number(input.clips) || 0));
    if (clips > 0) {
      var clipUnit = priceOf(level, 'CUSCLIPS');
      add('Comb clips — ' + clips + ' x $' + clipUnit.toFixed(2), 'CUSCLIPS', clipUnit * clips);
    }

    /* colorless rooting / invisible knots */
    var knots = byId(KNOT_OPTIONS, input.knots) || KNOT_OPTIONS[0];
    if (knots.codePart) {
      if (input.laceBase) {
        out.lines.push({
          label: 'Colorless rooting / invisible knots — ' + knots.label,
          code: null, catalog: '', amount: 0,
          note: 'Not charged on a lace base.'
        });
      } else {
        var knotCode = 'CUSCR' + tier.code + knots.codePart;
        add('Colorless rooting / invisible knots — ' + knots.label + ', ' + tier.short, knotCode, priceOf(level, knotCode));
      }
    }

    /* root color / streaking */
    if (input.rootColor) {
      var rcCode = 'CUSRCS' + tier.code;
      add('Root color / streaking — ' + tier.short, rcCode, priceOf(level, rcCode));
    }

    /* french injection */
    if (input.frenchTop) add('French injection — Top', 'CUSFRENCHTOP', priceOf(level, 'CUSFRENCHTOP'));
    if (input.frenchPart) add('French injection — Part', 'CUSFRENCHPART', priceOf(level, 'CUSFRENCHPART'));

    /* enclosed extra hair */
    var spare = byId(SPARE_HAIR_OPTIONS, input.spareHair);
    if (spare && spare.code) {
      add('Enclosed extra hair — ' + spare.label, spare.code, priceOf(level, spare.code));
    }

    /* extra fronts */
    var fronts = Math.max(0, Math.floor(Number(input.extraFronts) || 0));
    if (fronts > 0) {
      var frontUnit = priceOf(level, 'CUSXFRONTS');
      add('Extra fronts — ' + fronts + ' x $' + frontUnit.toFixed(2), 'CUSXFRONTS', frontUnit * fronts);
    }

    /* density — applied to the whole subtotal, last */
    out.subtotal = round2(out.subtotal);
    var pct = Number(input.density);
    if (!(pct > 0)) pct = 100;
    var band = densityBand(pct);
    out.density = {
      percent: pct,
      rate: band.rate,
      amount: round2(out.subtotal * band.rate),
      label: band.label
    };
    if (pct > 170 && pct < 180) {
      out.warnings.push(
        'The pricing list jumps from "150%–170%" to "180%" — ' + pct +
        '% is quoted at the 75% rate. Confirm with the Custom Department.'
      );
    }
    out.total = round2(out.subtotal + out.density.amount);
    return out;
  }

  global.QuoteEngine = {
    LEVELS: LEVELS,
    TIERS: TIERS,
    HAIR_TYPES: HAIR_TYPES,
    GRAY_OPTIONS: GRAY_OPTIONS,
    CWH_PERCENTS: CWH_PERCENTS,
    KNOT_OPTIONS: KNOT_OPTIONS,
    SPARE_HAIR_OPTIONS: SPARE_HAIR_OPTIONS,
    DENSITY_BANDS: DENSITY_BANDS,
    effective: DATA.effective,
    byId: byId,
    round2: round2,
    priceOf: priceOf,
    describe: describe,
    tierFromArea: tierFromArea,
    availableLengths: availableLengths,
    baseCode: baseCode,
    quote: quote
  };
})(window);
