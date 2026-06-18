# D37 — Forest-mark DOM↔export unification

**Status:** STARTED 2026-06-18 (incremental). Decision: register D37 option (a) —
collapse the forked forest-mark renderers into one shared source. This is a
multi-day arc executed in *safe, harness-gated increments*, NOT a big-bang
rewrite of the WYSIWYG-critical core.

## The problem

The schema renderer abstraction (`schemaRenderCell` + the `RenderNode` tree)
unifies DOM and export for **cells** (badge/ring/stars/sparkline): one renderer,
two thin walkers. But the **forest marks** — the library's core: interval, point
marker, summary diamond, viz-bar/boxplot/violin, custom-annotation glyphs — are
TWO full parallel implementations:

- **Export:** `svg-generator.ts` hand-draws them (`renderInterval` :1989,
  `renderDiamond`, `renderMarker`, `renderVizBar/Boxplot/Violin`, the annotation
  glyph block ~:5015).
- **DOM:** `components/forest/*.svelte` (`RowInterval`, `SummaryDiamond`, …) +
  `components/viz/*.svelte` + the annotation block in `TabvizPlot.svelte` ~:2200.

They share only leaf primitives (`forest-scale`, `marker-styling`, `arrow-utils`,
`rendering-constants`) and are otherwise kept in lockstep by hand, guarded by the
`wysiwyg-diff` / `forest-marks` / `glyph-cell-parity` measurement harnesses + the
DOM↔export divergence ledger. The `MarkRecipe` the ontology promises exists only
as a TYPE, not shared code. Cost: ~1500 LOC of twin logic, and the *same bug in
both copies* — round-1's non-finite (`Infinity → NaN coord`) bugs existed in BOTH
the DOM and export mark paths precisely because there are two copies.

## Can `RenderNode` express marks? (the linchpin — assessed 2026-06-18)

Partly. `RenderNode` kinds are `text | group | svg | spacer | image | component`
(`schema/render-types.ts`). The `svg` kind carries raw markup, so mark *shapes*
CAN ride the existing tree, and both walkers already handle it. **But** forest
marks differ from cells in a way the cell path doesn't model:

- Cells render in **cell-local** coordinates inside a column box.
- Marks render in **plot-scale** coordinates (x = `forestScale(value)`), can
  **overlay** the axis / reference lines / annotations, and depend on
  **cross-row** context (the shared column domain, the row's marker center).

So the unification is NOT "make `forest` a cell renderer." The shared unit is a
`drawMark(recipe, scale, resolver): RenderNode[]` that takes the scale + resolver
as context (the Architect's signature) and returns positioned nodes the DOM
mounts and the export serializes. Building that context-carrying mark renderer is
the real work.

## Migration order (each step harness-gated, individually shippable)

Shrink the fork from the leaves inward, so every step is small and the
`wysiwyg-diff`/`glyph-cell-parity` gates can catch any divergence:

1. **[DONE 2026-06-18] Shared glyph geometry.** The custom-annotation triangle/
   star point math (incl. the `1.2`/`0.5` star radii + `π/2 + k·π/5` angles) was
   duplicated verbatim in `svg-generator.ts` and `TabvizPlot.svelte`. Extracted to
   `lib/annotation-glyph.ts` (`trianglePoints`/`starPoints`, pure, V8-safe);
   both paths now call it. Byte-identical output verified (gallery_07 stars
   unchanged). Gate: `annotation-glyph.test.ts`. — *the template for the rest.*
2. **Diamond geometry.** `renderDiamond` (export) vs `SummaryDiamond.svelte`
   (DOM) — extract the shared point/clamp math next (same shape as step 1).
3. **Marker geometry.** `renderMarker` shapes vs the DOM marker — shared shape
   helpers (circle/square/triangle/diamond/etc.), like step 1.
4. **Interval body.** `renderInterval` vs `RowInterval.svelte` — the multi-effect
   stacking + interval-bar + muted-state logic. Larger; extract the geometry
   first, then the channel-wiring.
5. **Viz marks.** bar/boxplot/violin geometry (much already shares
   `viz-domain-utils`/`viz-utils` after the round-1 finite-guard pass).
6. **The `drawMark` capstone.** Once the geometry is all shared, introduce the
   `drawMark(recipe, scale, resolver) → RenderNode[]` seam: DOM mounts the tree,
   export serializes it via the `schemaRenderCell` path. Delete the twin render
   functions; retire the divergence ledger.

## Risks / guardrails

- Forest marks are the hottest, most WYSIWYG-sensitive code; every step MUST keep
  `wysiwyg-diff --gate`, `forest-marks.browser.ts`, and `glyph-cell-parity` green
  (CI-gated; some skip locally on the screenshot flake — download the artifacts).
- Keep each step BYTE-IDENTICAL where possible (pure geometry extraction) so the
  layout-metrics snapshots don't move; only the capstone (step 6) changes
  structure, and that lands behind the full harness battery.
- Do NOT attempt steps 4–6 in a long/unfocused session — they touch the core.
  Steps 1–3 are safe leaf extractions doable incrementally.
