# D37 — Forest-mark DOM↔export unification

**Status:** SUBSTANTIALLY RESOLVED 2026-06-18. Steps 1–4 landed (all
divergence-prone geometry shared across DOM/export, two real divergences
reconciled); steps 5–6 (per-element positions + the `drawMark` capstone)
DESCOPED — see the Decision section. D37's bug-prevention goal is met without
the high-risk structural rewrite.

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

1. **[DONE 2026-06-18] Shared glyph geometry.** Annotation triangle/star point
   math (star radii `1.2`/`0.5`, angles `π/2 + k·π/5`) → `lib/annotation-glyph.ts`.
   Byte-identical (gallery_07 stars unchanged). `annotation-glyph.test.ts`.
2. **[DONE 2026-06-18] Summary-diamond geometry.** `renderDiamond` ↔
   `SummaryDiamond.svelte` → `forest-mark-geometry.ts::summaryDiamondPoints`.
   Reconciled a real divergence: the DOM skipped the apex-clamp and used
   height=10 hardcoded; now matches the export (canonical). Export byte-identical.
3. **[DONE 2026-06-18] Marker geometry.** `markerDiamondPoints`/
   `markerTrianglePoints` shared by `renderMarker` ↔ `RowInterval.svelte`.
   Byte-identical. The per-effect inline summary diamond (in both renderInterval
   and RowInterval) also folded onto `summaryDiamondPoints` (unbounded clamp).
4. **[DONE 2026-06-18] Viz band layout.** `viz-mark-geometry.ts::vizBand` — the
   band-split formula (`max(floor,(total−gap·(n−1))/n)`, gap `n>1?2:0`) shared by
   ALL SIX viz layout sites (bar/boxplot/violin × DOM/export). Floors + the magic
   2px gap centralized; reconciled a violin sub-floor `maxWidth` divergence.
5. **[DESCOPED] Per-element positions + interval-body orchestration.** The
   residual duplication is (a) trivial `xScale(value)` positioning of whisker/box/
   bar/violin-path elements — no magic numbers, near-zero divergence risk — and
   (b) the `renderInterval`/`RowInterval` multi-effect *orchestration* (loop
   structure, muted-state), which is intrinsically framework-bound (string concat
   vs Svelte each-block) and can't share without the capstone. Low value to force.
6. **[DESCOPED — see Decision] The `drawMark` → `RenderNode` capstone.**

## Decision (2026-06-18): the capstone is descoped as unnecessary

D37's GOAL was to kill the *duplicated logic* so a bug isn't fixed twice (round-1's
non-finite bugs lived in both copies). That goal is **met by steps 1–4**: every
piece of divergence-prone geometry — the shape point-math (magic radii/angles) and
the band-split formulas (floors, ratios, the 2px gap) — now has ONE source, and
two real DOM/export divergences were reconciled along the way. The residual twin
code is either trivial `xScale()` calls (no logic to drift) or the per-framework
emission shell (Svelte elements vs strings), which is a *necessary* consequence of
the two runtimes, not accidental duplication. The `drawMark`→`RenderNode` capstone
would unify the emission *structure* too, but that is architectural purity with
**high regression risk on the hottest WYSIWYG code and low marginal bug-prevention
value** now that the geometry is shared. So it's descoped: not worth the risk.
Re-open only if the emission shells start drifting in practice.

## Risks / guardrails (for any future re-open)

- Forest marks are the hottest WYSIWYG code; keep `wysiwyg-diff --gate`,
  `forest-marks.browser.ts`, `glyph-cell-parity` green (CI-gated; flaky locally).
- The geometry extractions were validated byte-identical via `layout-metrics`
  (export geometry snapshot) — which transfers to the DOM because both paths call
  the SAME helper. That's why steps 1–4 were safe to land incrementally; the
  capstone would NOT have that property (it changes structure, not just sharing).
