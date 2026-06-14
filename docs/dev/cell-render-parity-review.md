# Per-column-type DOM↔export render parity review (2026-06-14)

A systematic review (extending the theme-token divergence-ledger work to CELL
CONTENT): every column type is rendered TWICE — a DOM path
(`components/table/Cell*.svelte` or inline in `svelte/TabvizPlot.svelte`) and an
SVG export path (a `schema/columns/*-renderer.ts` module or inline in
`export/svg-generator.ts`). The two can diverge — a WYSIWYG bug.

## Architecture (confirmed sound)

- DOM: `schemaRenderCell(col, …, "dom")` → a `RenderTree`; visual types return a
  `{kind:"component"}` node mounting `Cell*.svelte`.
- SVG: `schemaRenderCell(col, …, "svg")`; `forest`/`viz_*` skip dispatch and draw
  inline.
- **Registration coverage is complete** — every type has both paths, all
  V8-booted (the `schema/boot-coverage.test.ts` gate guards this). No type is
  DOM-only or export-only. The findings below are all VISUAL/LOGIC divergences
  WITHIN types that have both paths.
- Good consolidation already exists: `lib/rendering-constants.ts` centralizes
  `CELL_GEOMETRY` (pictogram/ring/stars/icon px+gap), `BAR`, `SPARKLINE`,
  `BADGE`, `BADGE_VARIANTS`. `ring`/`pictogram` are near-exemplary.

## Two structural gaps

1. **The drift gate (`schema/columns/drift.test.ts`) only checks an option HAS a
   `consumedBy` label + a `kind`** — NOT that BOTH renderers read it, nor that
   the value is honored equivalently. So a key-mismatch (stars below) passes it.
2. **No DOM↔export VISUAL parity coverage for any glyph cell.**
   `forest-marks.browser.ts` covers forest mark x-positions only; the wysiwyg
   matrix covers text/numeric/forest/pvalue/bar and measures font attrs + box
   geometry, NOT glyph rendering. sparkline/pictogram/stars/ring/badge/heatmap/
   icon/progress/img/viz_* have NO parity gate. **Recommended structural fix: a
   glyph-cell parity harness — mount `Cell*.svelte` at scale-1 vs
   `schemaRenderCell(…,"svg")`, pixel-diff.** It would have caught every rank 1–8
   item below. (Needs a non-contended browser env to develop — local Chrome was
   flaking 2026-06-13/14.)

## Findings (ranked by user-visible WYSIWYG impact)

| Rank | Type | Class | Detail | Status |
|---|---|---|---|---|
| 1 | **sparkline** | magic-number (severe) | DOM fixed 60px, SVG fills column; default height 20 vs 16 | **FIXED** (2336d3b): DOM fills column (measured wrapper); height centralized to `SPARKLINE.DEFAULT_HEIGHT` |
| 2 | **stars** | dead-option (key mismatch) | DOM/type/width-estimator read `maxStars`/`halfStars`; wire is `maxGlyphs`/`halfGlyphs` (SVG correct) → cap/half-fill inert in widget | **FIXED** (5cef797) |
| 3 | **heatmap** | **REAL export bug** + magic-number | dark-text: DOM fixed `#1a1a1a`, SVG `readContentPrimary` — LIGHT in a dark theme → unreadable light-on-light value text in dark-theme exports. **FIXED** (67dbf60): centralized to `HEATMAP_TEXT` (theme-independent contrast), both paths read it; verified via dark-theme export render. STILL OPEN (style drift): value-text font 0.75× vs 0.9×; SVG 2px inset gutter vs DOM fill |
| 4 | **progress** | magic-number (not centralized) | label min-width DOM 32 vs SVG `PROGRESS_LABEL_WIDTH=40`; label font 0.75× vs `*0.9`; track color `color-mix` vs `readDividerSubtle 0.5`. Geometry in module-local consts, not `rendering-constants`. `CellProgress.svelte:69,74,83` ↔ `progress-renderer.ts:31,69,74,81` | OPEN |
| 5 | **badge** | magic-number + dead-option | pill h-padding DOM `0 10px`(=20) vs SVG `BADGE.PADDING*2`(=8) → DOM badges wider; font-scale `0.77em` vs `BADGE.FONT_SCALE=0.8`; `size` honored in DOM, IGNORED by SVG. `CellBadge.svelte:114-119` ↔ `badge-renderer.ts:125,133` | OPEN |
| 6 | **icon** | magic-number (theme-conditional) | DOM sizes via CSS rem vars; SVG via absolute `CELL_GEOMETRY.icon.px`. Equal at default rem, drift when a theme overrides body/label font-size. `CellIcon.svelte:59-75` ↔ `icon-renderer.ts:32,72` | OPEN |
| 7 | **ring** | minor | geometry IDENTICAL + shared `CELL_GEOMETRY`; drift only in label font (DOM `em` vs SVG absolute `LABEL_FONT_PX`) + track-color default | LOW |
| 8 | **pictogram** | minor | slot/remap/half logic IDENTICAL + shared consts; drift only in the rare literal-char fallback half-state + empty-color default | LOW |
| 9 | **bar** | minor | SVG reads `BAR.*`; DOM CSS re-hardcodes 8/2/6/32 literals that match but don't import; track-color default differs | LOW |
| 10 | **viz_bar/boxplot/violin** | uncovered | share the scale (`buildVizScale`) + `VIZ_MARGIN` but hand-code mark geometry twice; NO parity gate (forest-marks covers forest only) | OPEN (gate) |
| 11 | **forest** | inline-vs-inline | best-tested (forest-marks); point size/whisker/multi-effect spacing shared | OK |
| — | text/numeric/interval/events | — | each registers ONE renderer for both targets — divergence-proof | OK |

## The pattern for OPEN items (rank 3-6)

Same as the theme-token reconcile: the DOM CSS uses relative units (`em`,
rem-vars, `color-mix`) and inline literals; the SVG uses absolute px from the
shared constant. They happen to agree at default themes but are UNGUARDED and
diverge under font-size overrides or where the literals genuinely differ (badge
padding 20 vs 8 is a current visible disagreement, not latent). The fix for each
is the now-familiar move: pick the canonical value (DOM = the live reference),
centralize it in `rendering-constants`, have BOTH paths read it. Each needs a
"which value" eyeball — best done WITH the glyph-cell parity harness so the fix
is verified, not asserted.
