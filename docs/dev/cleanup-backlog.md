# Search-and-destroy backlog (2026-06-14 → worked through 2026-06-15)

A 4-agent audit (dead-code / magic-numbers / bespoke / R-side) drove a cleanup
pass; this file tracked the remainder. The bulk is now SHIPPED.

## Shipped — first pass (2026-06-14)
- Dead code: `isClipped` (axis-utils), `bandingSpecToString` (banding),
  `__resetCellComponents` (render-component-registry), `findCondition`
  (schema/banks).
- Magic number: char-width `0.55` → `TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO` (×4).
- Bespoke → `lib/color-resolution.ts`: `resolveMarkerColor` (×5+pictogram) +
  `buildThresholdStops` (badge+ring).
- VIZ fallback palette → `VIZ_DEFAULT_SERIES_COLORS`.

## Shipped — backlog worked through (2026-06-15)
- Dead: `TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT` (deprecated, zero consumers).
- `formatBarValue` → `lib/formatters.ts` (was hand-duplicated in CellBar +
  bar-svg-renderer — the parity-risk class; DOM + export now share it).
- `LABEL_FONT_PX {sm:9,base:11,lg:12}` → `CELL_GEOMETRY.labelFontPx` (was dup
  in ring + pictogram renderers + width-behaviors).
- Group-header level tint opacity → `GROUP_HEADER.LEVEL_TINT_OPACITY`; legend
  strip magic → a named `LEGEND` constant (positioning multipliers kept as-is).
- **VIZ mark geometry** → a `VIZ` constant: height ratios (bar/boxplot 0.7,
  violin 0.8), per-effect opacity defaults (0.85/0.7/0.5), violin stroke ratios
  (0.33/0.67) were duplicated literals in BOTH the DOM `Viz*.svelte` and the
  SVG export; one source now, wysiwyg gate guards the equality.
- **Axis-label dispatch** → `column-types.ts::isAxisBearingColumn` +
  `columnAxisLabel`: the forest/viz_* type list + the per-type `axisLabel` read
  were copied across layout-zoom AND svg-generator (4 sites); one source now —
  a new axis-bearing type is wired in exactly one place.
- R `utils-oklch.R`: bisection cap `40` + contrast step `0.02` → named
  `OKLCH_GAMUT_BISECT_ITERS` / `CONTRAST_SEARCH_STEP`.

## Resolved on inspection (no change needed)
- **`"0.75rem"`/`"0.875rem"` font fallbacks** (svg-generator): they're the
  SECONDARY `?? "…"` on `readLabelSize`/`readCellSize`, which already return a
  string — the role token IS read; the rem is a harmless dead tail. Left as-is.
- **`#2563eb`**: every occurrence is a `var(--tv-accent, #2563eb)` CSS var()
  fallback — idiomatic, reads the token. Not a magic-number smell.

## Remaining (minor / accepted)
- **Per-renderer marker-fill bundle pattern** (`resolveSemanticBundle(cell) ??
  resolveSemanticBundle(row)`) — the cascade is already centralized
  (`resolveMarkerColor`); the few remaining raw bundle reads are in renderers
  that need the bundle object itself (not just the fill), so no clean shared
  signature. Accepted.
- **LABEL_FONT_PX as a type-ROLE** (vs fixed px scaled by glyph size) — noted in
  the constant; a future refinement under feedback_type_roles_not_multipliers,
  not a dup smell.
