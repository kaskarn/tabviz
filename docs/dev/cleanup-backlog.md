# Search-and-destroy backlog (2026-06-14)

A 4-agent audit (dead-code / magic-numbers / bespoke / R-side) drove a cleanup
pass. The HIGH-value, low-risk items shipped (see below). This file tracks the
REMAINDER — each is real but either smaller, coupled to test surfaces, or
carries visual-regression risk that wants the glyph-parity / wysiwyg gate to
verify. Pick off as bandwidth allows; verify each against the CI gates.

## Shipped this pass
- Dead code removed: `isClipped` (axis-utils), `bandingSpecToString` (banding),
  `__resetCellComponents` (render-component-registry), `findCondition`
  (schema/banks — its callers were a different local fn).
- Magic number tethered: char-width `0.55` → `TYPOGRAPHY.AVG_CHAR_WIDTH_RATIO`
  (4 sites: ring/pictogram renderers + width-behaviors ×2).
- Bespoke consolidation → `lib/color-resolution.ts`: `resolveMarkerColor`
  (cascade dup ×5+pictogram) + `buildThresholdStops` (badge+ring).
- VIZ fallback palette `["#3b82f6",…]` (×3) → `VIZ_DEFAULT_SERIES_COLORS`.

## Remaining — magic numbers / dedup
- **`LABEL_FONT_PX {sm:9,base:11,lg:12}`** duplicated in ring-renderer +
  pictogram-svg-renderer (+ inline in width-behaviors ring branch). Move to
  `CELL_GEOMETRY`. NUANCE: it's glyph-SIZE-scaled label px, and both export it
  via `__testing` — update those + decide whether it should instead derive from
  the `label` type-role scaled by glyph size (see
  feedback_type_roles_not_multipliers).
- **VIZ height multipliers** `rowHeight * 0.7` (vizBar), `* 0.7` (vizBoxplot),
  `* 0.8` (vizViolin) in svg-generator — scattered, must match the
  Viz*.svelte DOM components. Centralize into a VIZ constant AFTER confirming
  each matches its DOM half (wysiwyg gate). Same for violin stroke ratios
  `* 0.33` / `* 0.67`.
- **Hardcoded `"0.75rem"` / `"0.875rem"`** font fallbacks (svg-generator
  ~1814/1856-7) — should read the role token or a constant, not a rem literal.
- **Group-header level opacity** `0.15/0.10/0.06` (svg-generator ~1766) →
  a `GROUP_HEADER` level→opacity map.
- **`"#2563eb"` accent fallback** duplicated (svg-generator + a couple Cell
  components inline styles) — should read `--tv-accent`.
- **Legend geometry** `padding+4` / `glyph+5` / `+16` spacing + `fontSize*0.3`/
  `*0.35` glyph Y-offsets (svg-generator ~1625-1634). Mostly POSITIONING math,
  not type sizes — name the constants; do NOT convert Y-offsets to role reads.
- **`TYPOGRAPHY.TEXT_BASELINE_ADJUSTMENT` (0.35, @deprecated)** — audit its
  remaining consumers; migrate to `dominant-baseline="central"` and delete.

## Remaining — bespoke / untethered
- **`formatBarLabel`** (bar-svg-renderer) mirrors CellBar's `formattedValue()`
  by hand → move to `lib/formatters.ts` so DOM + export share one source
  (parity risk class).
- **Inline axis-label type dispatch** (`layout-zoom.svelte.ts` ~312): an
  if-chain on `forest`/`viz_bar`/`viz_boxplot`/`viz_violin` checking
  `options.<type>.axisLabel` — route through a schema query so new viz types
  don't need this site edited.
- **Per-renderer marker-fill bundle pattern** (`resolveSemanticBundle(cell) ??
  resolveSemanticBundle(row)`) still appears outside the cascade in a few spots
  — fold into `color-resolution.ts` if a clean signature emerges.

## R-side (audited CLEAN — minor only)
- `utils-oklch.R`: extract the bisection loop limit `40` and contrast step
  `0.02` into named constants. Everything else (WCAG coeffs, save_plot width
  constants with TS-parity comments, paginate preset row counts) is already
  named or standard. No dead code, no bespoke (delegation discipline holds).
