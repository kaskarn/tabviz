# tabviz browser visual regression

Puppeteer-based screenshot+diff harness for the DOM-render path. Pairs
with `tabviz::render_visual_tests()` (V8/SVG-export path) — together
they cover both runtime targets.

## Run

```bash
# From R:
tabviz::render_browser_visual_tests()                 # full suite
tabviz::render_browser_visual_tests("jama|gallery_05") # subset

# Accept current output as new baseline (after intentional change):
tabviz::render_browser_visual_tests(update = TRUE)
```

Or invoke the node-side directly with already-generated fixtures:

```bash
cd srcjs
node tests/visual-browser/snapshot.mjs
node tests/visual-browser/snapshot.mjs --update
node tests/visual-browser/snapshot.mjs --threshold 0.05
```

## Layout

| Path | Role |
|---|---|
| `R/render_browser_visual_tests.R` | R wrapper. Sources `inst/examples/gallery_*.R` and saves each as a self-contained HTML widget into `fixtures/`. Then calls `snapshot.mjs`. |
| `srcjs/tests/visual-browser/snapshot.mjs` | Node-side. Reads every `*.html` in `fixtures/`, screenshots the `.tabviz-container` element via headless Chromium, compares against `baseline/<name>.png` with pixelmatch, writes mismatched diff PNGs to `output/`. |
| `srcjs/tests/visual-browser/fixtures/` | Auto-generated HTML widgets. Regenerated on every run. **Gitignored.** |
| `srcjs/tests/visual-browser/baseline/` | Reference PNGs. **Checked in.** Re-seed via `--update`. |
| `srcjs/tests/visual-browser/output/` | `<name>.actual.png` + `<name>.diff.png` for the most recent run. **Gitignored.** |

## Workflow

1. Touching `TabvizPlot.svelte`, `RenderTree.svelte`, or any
   cell-renderer wiring? Run the harness before opening the PR.
2. Diff failure: open `output/<name>.actual.png` + `output/<name>.diff.png`.
   If the change is unintentional, fix it. If intentional, re-run
   with `update = TRUE` and commit the new baselines with a message
   explaining the change.
3. New fixture (no baseline): the run reports `+ NEW`. Eyeball the
   `.actual.png`, then `--update` to seed.

## Threshold

`pixelmatch`'s `threshold` is the per-pixel match tolerance (0 strict,
1 permissive). Default is `0.1` — tolerant enough to absorb
sub-pixel-AA noise from font rendering, strict enough to catch real
layout / color shifts. Lower if you're hunting fidelity regressions;
raise if AA jitter dominates noise.

## When not to use

- Pure logic changes (formatters, sorters) — covered by unit tests.
- V8/SVG-export-only changes — that's `tabviz::render_visual_tests()`.
- Whole-widget interaction (paint tool, settings panel, drag) —
  would need step-by-step interaction scripts. Out of scope here.
