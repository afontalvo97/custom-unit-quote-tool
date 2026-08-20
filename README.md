# Custom Unit Quote Tool

Internal tool for the sales team: enter the specs a client gives you over the phone and get
the custom-unit price immediately, broken down line by line, with the inventory ID behind
every charge so it can be checked against the printed pricing list.

Nothing is stored and nothing is sent anywhere — the whole thing runs in the browser.

## Quoting flow (matches "HOW TO QUOTE CUSTOM UNITS")

1. **Pricing level** — Classic / Signature / Elite (top right).
2. **Size** — width × length in inches. `0–79` = Top of Head, `79.1–99` = 3/4 Cap, `99+` = Full Cap.
   Units measured by circumference use the "Circumference / pick tier" toggle.
3. **Hair length & type** — the length picks the price row; the hair type (Regular, Remy/Cuticle,
   European, High Heat, High Heat + Indian Remy) picks which table the row comes from. Both are
   already baked into the base price.
4. **Gray** — Human / Yak / High Heat are flat rates by size tier; CWH is priced by % of gray;
   Regular Synthetic gray is free.
5. **Density** — under 100% and under 150% are free, 150–170% adds 50%, 180% adds 75%,
   181%+ adds 100%.
6. **Extras** — comb clips, colorless rooting / invisible knots, root color / streaking,
   French injection (top / part), enclosed extra hair, extra fronts.

Order of operations, exactly as in the training deck:

```
base price + gray + extras            = subtotal
subtotal × density rate               = density charge
subtotal + density charge             = total estimate
```

A **Repair** toggle at the bottom prices off the repair list instead (no density, no add-ons,
no deposit — the factory decides whether a unit can be repaired).

## Verifying the math

Open `index.html?test=1`. A panel at the top runs the 10 worked quotes from the
"CUSTOM QUOTES" training deck plus 13 guardrail cases and shows pass/fail for each.
All 23 must pass before shipping a change.

From the command line:

```bash
node -e "global.window=global;require('./assets/pricing-data.js');require('./assets/pricing-engine.js');require('./assets/tests.js');
const r=window.QuoteTests.run();r.forEach(t=>console.log(t.pass?'ok  ':'FAIL',t.name));"
```

## Hosting

No backend, no build step, no dependencies — three static files plus the data. That means:

- **GitHub Pages works as-is.** Push the repo, then Settings → Pages → deploy from `main` / root.
  Same for Netlify, Vercel, S3, or an internal file share.
- **It also works straight off disk** — double-clicking `index.html` opens a fully working tool,
  no server required. Handy for a rep on a laptop with no connection.
- **Performance:** the entire app is ~50 KB (31 KB of that is the price data). It loads in one
  round trip, every quote is recomputed synchronously in well under a millisecond, and after the
  first visit the browser serves it from cache. A backend would make it slower, not faster.
- **Privacy:** because there is no server, no client information ever leaves the rep's machine.

The only thing you give up without a backend is anything that needs to be *shared or remembered* —
saved quotes, an audit log, per-rep logins, or pushing a price change without a redeploy. None of
that is in scope here, and prices only change once a year.

## Updating prices for a new year

1. Drop the new `{classic,signature,elite}-pricing-YYYY.pdf` files in the repo root.
2. Update `PDF` and `EFFECTIVE` at the top of `tools/extract_pricing.py`.
3. Run `python3 tools/extract_pricing.py` (needs `pdftotext`: `brew install poppler`).
4. Open `index.html?test=1` — expected totals in `assets/tests.js` will need updating to the new
   list, which is exactly the point: it forces someone to eyeball the new numbers.

The script reads the **CUSTOM** section of each PDF and writes `assets/pricing-data.js` as a flat
`{level: {INVENTORY_ID: price}}` map. Inventory IDs are identical across all three levels — only
the prices differ — so the app builds the ID it needs from the rep's inputs
(e.g. Full Cap + Euro hair + 12" → `CUSFCE12`) and looks the price up.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The form and the quote panel |
| `assets/pricing-engine.js` | All pricing logic, no DOM — the part to review when a rule changes |
| `assets/app.js` | Form wiring, rendering, copy/print |
| `assets/pricing-data.js` | Generated price tables (do not edit by hand) |
| `assets/tests.js` | The 10 training-deck quotes as regression tests |
| `assets/styles.css` | Styling, including print/PDF layout |
| `tools/extract_pricing.py` | Regenerates the price tables from the PDFs |

## Known judgment calls

These are places where the pricing list does not spell out an answer. The tool picks the safe
option and shows a warning telling the rep to confirm with the Custom Department:

- **In-between hair lengths** (e.g. 13.5") round **up** to the next row on the list.
- **Densities of 171–179%** are quoted at the 75% rate — the list jumps from "150%–170%" straight
  to "180%".
- **Human Hair gray over 10"** and **CWH over 6"** are past the listed maximum; the charge is still
  applied so the estimate is not low, with a warning attached.
- **High Heat gray on High Heat fiber** is charged, per the training deck: when it is unclear,
  quote it to be safe.
- **Lace base** zeroes the colorless-rooting charge and says so on the quote line.

## Company-specific size rule

An **8" × 10"** base is a **3/4 Cap for New Image** but a **Top of Head for HVI**. The tool
prices it as a 3/4 Cap and raises a notice telling the rep to switch to
"Circumference / pick tier" and select Top of Head if the order goes through HVI. Pricing is
untouched — only the notice is new. If other dimensions land differently between the two
companies, add them to `HVI_TOH_DIMENSIONS` in `assets/pricing-engine.js`.

## Length caps beyond the printed list

The pricing list carries rows the factory will not actually build. These are quoted from the
row so the estimate is never low, with a notice attached:

| Item | Available up to | Rows on the list up to |
| --- | --- | --- |
| European Hair | 14" | 18" |
| Yak gray | 6" | any size tier |
| Human Hair gray | 10" | any size tier |
| CWH | 6" | any size tier |

Caps live on `HAIR_TYPES` (`maxQuoteLength`) and `GRAY_OPTIONS` (`maxLength`) in the engine.
