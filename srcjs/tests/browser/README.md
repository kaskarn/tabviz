# tabviz browser harnesses

Puppeteer-based harnesses that mount tabviz in real headless Chromium —
the only place DOM-dependent behavior (measurement, ResizeObserver
feedback, real layout) can be verified. Two kinds live here:

- **Bench** (`run-bench.ts`) — times the htmlwidget binding's
  `renderValue` call end-to-end. Complements `srcjs/tests/perf/`
  (algorithmic-only Bun bench).
- **Correctness tests** (`*.browser.ts`) — mount a spec, assert
  DOM-measured behavior, exit non-zero on failure. For things the
  headless bun/vitest suites structurally cannot check.

  - `measure-rows.browser.ts` — the content-driven-height
    **measure-then-commit** loop (sizing-model.md §6): asserts wrapped /
    tall-content rows grow to their real rendered height and that the
    measure→commit→re-measure loop settles (no oscillation).
    Run: `bun run tests/browser/measure-rows.browser.ts [--bundle <p>] [--headed]`.

  - `details-panel.browser.ts` — **details/disclosure panels** (row-types.md
    §6): a row with `details` markdown owns a full-width disclosure panel.
    Asserts a pre-expanded (initialState) panel renders with markdown→HTML, a
    row without details has no panel/toggle, and clicking a toggle reveals the
    panel. Saves `/tmp/details-panel.png`.
    Run: `bun run tests/browser/details-panel.browser.ts [--headed]`.

  - `forest-marks.browser.ts` — the **forest mark x-position** WYSIWYG
    contract (region-tree.md §5): asserts rendered point markers land at
    the canonical forest scale (built from `plotRegion` via the shared
    `forest-scale.ts`, the same domain the V8/SVG export uses), so the live
    widget and the downloaded SVG agree. Guards against the DOM scale domain
    drifting (e.g. back onto `axisLimits`).
    Run: `bun run tests/browser/forest-marks.browser.ts [--bundle <p>] [--headed]`.

  - `glyph-cell-parity.browser.ts` — the **glyph-cell DOM↔export** pixel
    parity gate (cell-render-parity-review.md gap #2). For each visual column
    (badge/progress/ring/stars/pictogram/icon/bar/sparkline/heatmap) it crops
    the SAME fixed-width cell from the live widget (scale-1) and from a raster
    of `generateSVG(spec)` and pixel-diffs the glyph — the layer the numeric
    wysiwyg-diff is blind to. Per-column budgets encode the review's
    known-open ranks (badge/progress/heatmap) and only shrink; `--gate` fails
    on new/widened divergence. **Needs a healthy headless Chrome**: the
    widget-DOM screenshot hangs under the local capture flake, so locally it
    SKIPS (reports `⊘`, exits 0) — it MEASURES + gates in CI, the same
    screenshot mechanism `settings-consequence` proves works there. Budgets
    need one healthy run to calibrate before flipping CI to `--gate`.
    Run: `bun run tests/browser/glyph-cell-parity.browser.ts [--gate] [--only <col>] [--headed]`.

## Run

```bash
cd srcjs
npm run bench:browser                                # current build
npm run bench:browser -- --bundle <path/to/tabviz.js>  # specific build
npm run bench:browser -- --out tests/browser/foo.json  # save JSON results
npm run bench:browser -- --iters N                     # samples per scenario
npm run bench:browser -- --headed                      # show the browser window
```

Defaults: `--bundle inst/htmlwidgets/tabviz.js`, `--iters 5`, `--css`
matches the bundle's sibling.

## Layout

| File | Role |
|---|---|
| `fixtures.html` | Static HTML page with a `#widget` container + minimal `HTMLWidgets` shim. The bench injects the bundle as a `<script>` tag, then `window.HTMLWidgets.find('tabviz').factory(el, w, h).renderValue(spec)` mounts. |
| `fixtures.ts` | Wraps the synthetic `rows`/`columns` from `srcjs/tests/perf/fixtures.ts` into full `WebSpec` payloads with a resolved Cochrane theme. Two collections: `getSingleFixtures` (single specs) and `getSplitFixtures` (one per subset of a SplitForest). |
| `run-bench.ts` | Main driver. Launches Puppeteer, registers each spec under a string key on `window.__bench.specs`, and times `renderValue` mounts. Per-scenario wall-clock budget; on timeout, marks the scenario as `"timeout"` and bails the rest of the run so a partial result still lands on disk. |

## Comparing before/after

```bash
# Capture baseline against a previous bundle. The harness reads any path
# pointed at by --bundle/--css; you can git-show an older release out of
# version control without checking out the whole tree:
git show <prev-rev>:inst/htmlwidgets/tabviz.js  > /tmp/tabviz-prev.js
git show <prev-rev>:inst/htmlwidgets/tabviz.css > /tmp/tabviz-prev.css
npm run bench:browser -- --bundle /tmp/tabviz-prev.js --css /tmp/tabviz-prev.css \
  --out tests/browser/baseline-prev.json

# Rebuild current state, capture current:
npm run build
npm run bench:browser -- --out tests/browser/baseline-current.json

# Diff via JSON tools (jq, diff, your editor).
```

`tests/browser/baseline-current.json` and `baseline-prev.json` are the
two JSON artifacts the bench writes. They're not gitignored — checking
them in alongside refactor commits leaves a perf paper trail.

## Scenario taxonomy

| Scenario | What it stands in for |
|---|---|
| `renderValue` (small/medium/large) | Single-spec mount end-to-end: spec ingestion + measurement + first paint. |
| `split.renderAll` (small/medium/large) | N subsets of a SplitForest mounted in turn; sum is the total cost. Stands in for split_table rendering all panes. |

The 10k-row tier is intentionally excluded — the widget doesn't
virtualize today, so full DOM render of 150k cells trips the protocol
timeout regardless of measurement strategy. That's a known scale
ceiling, not a bench limitation.

## When scenarios time out

Each scenario has a wall-clock budget (`SCENARIO_BUDGET_MS`, currently
60s). A scenario that exceeds it records `"timeout"` in its result
slot. After the first timeout, Chrome is mid-render and subsequent
mounts can't recover inside the same page; the bench bails and marks
remaining scenarios as timeouts too. This is intentional — chasing
protocol-timeout configuration further would burn more time than the
results warrant. If you need to push past 60s, raise the budget or
restructure to launch a fresh page per scenario.

## arrange-tool.browser.ts (interactivity-UX arc P2)

Correctness gate for the arrange tool + seam grammar. Mounts a grouped
fixture with `interaction.enableArrange`, arms the toolbar mode with real
mouse input, and asserts: conservative default (no button without the
flag), row-kind handles + armed spacing seams appear, hover ghost-
highlights every row of the kind, dragging pins ALL rows of the kind with
a live px readout, Escape mid-drag cancels, double-click releases the pin,
column drag pins width + double-click autosizes, disarm removes all seams.

    cd srcjs && npm run build && bun run tests/browser/arrange-tool.browser.ts

## wysiwyg-diff gate mode (CI)

`bun run tests/browser/wysiwyg-diff.browser.ts --gate` applies the
budgeted-exception verdict: every finding must fall inside a
`GATE_EXCEPTIONS` budget (each annotated with its decision-register ID —
D8 estimator widths, D15 title-block arithmetic, measure-loop residuals);
anything NEW or over-budget exits non-zero. Never widen a budget without
a register decision. Runs in .github/workflows/js-ci.yaml.

Exits non-zero on failure. NOTE: drive drags with real `page.mouse` moves
(pointer capture) and detect double-press via `e.detail`/dblclick — the
toolbar overlaps the top-right header region when visible, so target the
FIRST column's boundary in fixtures.

## wysiwyg-diff.browser.ts (WYSIWYG DOM ⇄ SVG-export diff harness)

Measures divergence between the LIVE WIDGET (DOM render at actualScale=1,
autoFit forced off via the store registry, verified by `data-zoom`) and the
STATIC SVG EXPORT (`generateSVG(spec, { width: 800 })`, the production V8
estimator path) for the SAME `tabviz()`-authored spec, across a matrix of
theme × density × density_factor × shell_mode cases (nejm / brutalist /
synthwave / terminal / newsprint + compact / df1.3 / raised variants).

Per case it diffs: figure + artifact width/height, shell band / paper mat,
header-band top + height, row heights/pitch/group spans, per-column x/width
(DOM header cells by `data-header-id` vs `computeLayoutMetrics()`), and
title/subtitle/caption/footnote/header/cell/group-header font size/weight/
family (DOM computed style vs SVG `<text>`/`<g>` attrs matched by unique
probe strings). Geometry tolerance 1.5px; typography exact.

    cd srcjs && npm run build
    bun run tests/browser/wysiwyg-diff.browser.ts            # full matrix
    bun run tests/browser/wysiwyg-diff.browser.ts --case nejm-raised

Output: per-case findings + ranked aggregate on stdout; side-by-side PNGs
(`<case>-dom.png` / `<case>-svg.png`) + `report.json` in `/tmp/wysiwyg/`.
Browser-only effects (glass/glow/blobs) are the declared 1.0 boundary and
are NOT flagged; shell padding / paper mat / band geometry, gradient+grain
textures (slated for export parity), and typography ARE flagged.

NOTE: launches `headless: "shell"` — on this dev box the new headless mode's
`Page.captureScreenshot` hangs to protocolTimeout even on trivial pages,
while chrome-headless-shell rasters in ~0.5s (same Blink, identical layout
probes). This is a diagnosis harness (always exits 0 unless it crashes);
it is not a CI gate.
