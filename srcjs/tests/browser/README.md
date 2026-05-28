# tabviz browser bench

Puppeteer-based bench harness. Mounts synthetic specs in real headless
Chromium and times the htmlwidget binding's `renderValue` call —
end-to-end mount cost including measurement, theme application, and
DOM construction. Complements `srcjs/tests/perf/` (algorithmic-only Bun
bench).

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
