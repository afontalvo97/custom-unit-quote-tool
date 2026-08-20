/*
 * UI wiring for the Custom Unit Quote Tool.
 * Reads the form, calls QuoteEngine.quote(), renders the breakdown. No storage,
 * no network — everything runs in the rep's browser.
 */
(function () {
  'use strict';

  var E = window.QuoteEngine;
  var $ = function (id) { return document.getElementById(id); };

  var state = { level: 'classic' };

  /* ---------- helpers ---------- */

  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fillSelect(el, options) {
    el.innerHTML = '';
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.label;
      el.appendChild(opt);
    });
  }

  function num(el) {
    var v = parseFloat(el.value);
    return isNaN(v) ? 0 : v;
  }

  /* ---------- populate static selects ---------- */

  fillSelect($('hair-type'), E.HAIR_TYPES);
  fillSelect($('gray'), E.GRAY_OPTIONS);
  fillSelect($('cwh-percent'), E.CWH_PERCENTS);
  fillSelect($('knots'), E.KNOT_OPTIONS);
  fillSelect($('spare-hair'), E.SPARE_HAIR_OPTIONS);
  $('effective').textContent = 'Pricing lists effective ' + E.effective;

  /* ---------- read the form ---------- */

  function currentTier() {
    if (document.querySelector('input[name="sizeMode"]:checked').value === 'manual') {
      return $('tier-select').value;
    }
    var area = num($('width')) * num($('length'));
    return E.tierFromArea(area);
  }

  function readInput() {
    var manual = document.querySelector('input[name="sizeMode"]:checked').value === 'manual';
    return {
      level: state.level,
      mode: $('repair-mode').checked ? 'repair' : 'unit',
      tier: currentTier(),
      // Only meaningful in width x length mode; picking a tier by hand overrides it.
      width: manual ? 0 : num($('width')),
      length: manual ? 0 : num($('length')),
      hairType: $('hair-type').value,
      hairLength: num($('hair-length')),
      gray: $('gray').value,
      cwhPercent: $('cwh-percent').value,
      density: state.densityUnder100 ? E.UNDER_100 : (num($('density')) || 100),
      laceBase: $('lace-base').checked,
      knots: $('knots').value,
      clips: num($('clips')),
      rootColor: $('root-color').checked,
      frenchTop: $('french-top').checked,
      frenchPart: $('french-part').checked,
      spareHair: $('spare-hair').value,
      extraFronts: num($('extra-fronts'))
    };
  }

  /* ---------- readouts ---------- */

  function renderSizeReadout(input) {
    var el = $('size-readout');
    var manual = document.querySelector('input[name="sizeMode"]:checked').value === 'manual';
    if (manual) {
      el.className = 'readout strong';
      el.textContent = 'Quoting as ' + E.byId(E.TIERS, input.tier).label +
        ' — some units are measured by circumference, so confirm which measurement you are working from.';
      return;
    }
    var area = E.round2(num($('width')) * num($('length')));
    if (!area) {
      el.className = 'readout';
      el.textContent = 'Enter width and length — 0–79 = Top of Head · 79.1–99 = 3/4 Cap · 99+ = Full Cap.';
      return;
    }
    el.className = 'readout strong';
    el.textContent = area + ' sq in → ' + E.byId(E.TIERS, input.tier).label;
  }

  function renderLengthReadout(input) {
    var el = $('length-readout');
    el.className = 'readout';
    var lengths = input.tier
      ? E.availableLengths(input.level, input.mode === 'repair' ? 'regular' : input.hairType, input.tier, input.mode)
      : [];
    el.hidden = !lengths.length;
    if (!lengths.length) { el.textContent = ''; return; }
    el.textContent = 'Pricing list carries up to ' + lengths[lengths.length - 1] + '" for this combination' +
      ' (rows: up to ' + lengths[0] + '", then every inch).';
  }

  function renderDensityReadout(input) {
    var el = $('density-readout');
    var band = null;
    if (input.density === E.UNDER_100) {
      band = E.byId(E.DENSITY_BANDS, E.UNDER_100);
    } else {
      for (var i = 0; i < E.DENSITY_BANDS.length; i++) {
        var b = E.DENSITY_BANDS[i];
        if (b.min === undefined) continue;
        if (input.density >= b.min && input.density <= b.max) { band = b; break; }
      }
    }
    el.className = band && band.rate ? 'readout strong' : 'readout';
    el.textContent = band ? band.label : '';
  }

  /* ---------- render the quote ---------- */

  function renderQuote(input, result) {
    var levelLabel = E.byId(E.LEVELS, input.level).label;
    var tierLabel = input.tier ? E.byId(E.TIERS, input.tier).short : '—';
    $('quote-badge').textContent = levelLabel + ' · ' + tierLabel + (input.mode === 'repair' ? ' · Repair' : '');

    var list = $('quote-lines');
    list.innerHTML = '';

    if (!result.lines.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Fill in the size and hair length to build the quote.';
      list.appendChild(empty);
    }

    result.lines.forEach(function (line) {
      var li = document.createElement('li');

      var label = document.createElement('span');
      label.className = 'line-label';
      label.textContent = line.label;

      var amount = document.createElement('span');
      amount.className = 'line-amount' + (line.amount === 0 ? ' free' : '');
      amount.textContent = line.amount === 0 ? 'No charge' : money(line.amount);

      li.appendChild(label);
      li.appendChild(amount);

      var meta = [];
      if (line.code) meta.push(line.code);
      if (line.note) meta.push(line.note);
      if (meta.length) {
        var m = document.createElement('span');
        m.className = 'line-meta';
        if (line.code) {
          var c = document.createElement('span');
          c.className = 'line-code';
          c.textContent = line.code;
          c.title = line.catalog;
          m.appendChild(c);
          if (line.note) m.appendChild(document.createTextNode(' · ' + line.note));
        } else {
          m.textContent = line.note;
        }
        li.appendChild(m);
      }
      list.appendChild(li);
    });

    $('subtotal').textContent = money(result.subtotal);
    $('density-label').textContent = 'Density ' + result.density.percent + '%' +
      (result.density.rate ? ' (+' + Math.round(result.density.rate * 100) + '% of subtotal)' : ' — no extra charge');
    $('density-amount').textContent = money(result.density.amount);
    $('density-row').hidden = input.mode === 'repair';
    $('total').textContent = money(result.total);

    // Don't scold the rep before they've typed anything.
    var pristine = !input.hairLength && !num($('width')) && !num($('length'));
    renderAlerts($('quote-errors'), pristine ? [] : result.errors);
    renderAlerts($('quote-warnings'), result.warnings);
  }

  function renderAlerts(el, items) {
    el.innerHTML = '';
    el.hidden = !items.length;
    items.forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      el.appendChild(li);
    });
  }

  /* ---------- plain-text quote for copy/paste ---------- */

  function quoteText(input, result) {
    var lines = [];
    lines.push('CUSTOM ' + (input.mode === 'repair' ? 'REPAIR' : 'UNIT') + ' QUOTE — ' +
      E.byId(E.LEVELS, input.level).label + ' pricing');
    if (input.tier) lines.push('Size tier: ' + E.byId(E.TIERS, input.tier).label);
    lines.push('');
    result.lines.forEach(function (l) {
      lines.push('  ' + l.label + '  ' + (l.amount === 0 ? 'no charge' : money(l.amount)) +
        (l.code ? '  [' + l.code + ']' : ''));
    });
    lines.push('');
    lines.push('  Subtotal: ' + money(result.subtotal));
    if (input.mode !== 'repair') {
      lines.push('  Density ' + result.density.percent + '%: ' +
        (result.density.rate ? '+' + money(result.density.amount) + ' (' + Math.round(result.density.rate * 100) + '% of subtotal)' : 'no extra charge'));
    }
    lines.push('  TOTAL ESTIMATE: ' + money(result.total));
    if (result.warnings.length) {
      lines.push('');
      result.warnings.forEach(function (w) { lines.push('  ! ' + w); });
    }
    lines.push('');
    lines.push('This is just an estimate based on the information you provided.');
    lines.push('The price may change once we receive the custom order form.');
    return lines.join('\n');
  }

  /* ---------- update loop ---------- */

  function update() {
    var repair = $('repair-mode').checked;
    document.querySelectorAll('.card').forEach(function (card) {
      var h = card.querySelector('h2');
      if (!h) return;
      var stepEl = h.querySelector('.step');
      if (!stepEl) return;
      var n = stepEl.textContent;
      if (n === '3' || n === '4' || n === '5') card.style.display = repair ? 'none' : '';
    });
    $('hair-type').disabled = repair;

    var showCwh = $('gray').value === 'cwh';
    $('cwh-field').hidden = !showCwh;

    var knotsSelected = $('knots').value !== 'none';
    $('lace-check').classList.toggle('off', !knotsSelected);

    var manual = document.querySelector('input[name="sizeMode"]:checked').value === 'manual';
    $('wl-inputs').hidden = manual;
    $('manual-tier').hidden = !manual;

    var input = readInput();
    var result = E.quote(input);

    renderSizeReadout(input);
    renderLengthReadout(input);
    renderDensityReadout(input);
    renderQuote(input, result);

    document.querySelectorAll('#density-chips button').forEach(function (b) {
      var d = b.dataset.density;
      b.classList.toggle('active', d === E.UNDER_100
        ? input.density === E.UNDER_100
        : Number(d) === input.density);
    });

    state.lastText = quoteText(input, result);
  }

  /* ---------- events ---------- */

  document.querySelectorAll('.level').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.level = btn.dataset.level;
      document.querySelectorAll('.level').forEach(function (b) {
        b.setAttribute('aria-checked', String(b === btn));
      });
      update();
    });
  });

  document.querySelectorAll('#density-chips button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.density === E.UNDER_100) {
        // No single number stands for "under 100%", so it is a mode of its own.
        state.densityUnder100 = true;
        $('density').value = '';
      } else {
        state.densityUnder100 = false;
        $('density').value = btn.dataset.density;
      }
      update();
    });
  });

  $('density').addEventListener('input', function () {
    if ($('density').value !== '') state.densityUnder100 = false;
  });

  $('quote-form').addEventListener('input', update);
  $('quote-form').addEventListener('change', update);
  $('quote-form').addEventListener('submit', function (e) { e.preventDefault(); });

  $('reset-btn').addEventListener('click', function () {
    // Call reset through the prototype: a form exposes its own controls as named
    // properties, so any control called "reset" would otherwise shadow the method.
    HTMLFormElement.prototype.reset.call($('quote-form'));
    state.densityUnder100 = false;
    update();
  });

  $('print').addEventListener('click', function () { window.print(); });

  $('copy').addEventListener('click', function () {
    var btn = $('copy');
    var done = function (ok) {
      btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
      setTimeout(function () { btn.textContent = 'Copy quote'; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.lastText).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = state.lastText;
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(ok);
    }
  });

  /* ---------- optional self-test (index.html?test=1) ---------- */

  if (/[?&]test/.test(location.search) && window.QuoteTests) {
    var panel = $('test-panel');
    panel.hidden = false;
    var results = window.QuoteTests.run();
    var failed = results.filter(function (r) { return !r.pass; }).length;
    panel.innerHTML = '<strong>' + (results.length - failed) + '/' + results.length +
      ' pricing checks passed</strong><br>' +
      results.map(function (r) {
        return '<span class="' + (r.pass ? 'pass' : 'fail') + '">' + (r.pass ? '✓' : '✗') + ' ' + r.name +
          (r.pass ? '' : ' — expected ' + JSON.stringify(r.expected) + ', got ' + JSON.stringify(r.actual)) + '</span>';
      }).join('<br>');
  }

  update();
})();
