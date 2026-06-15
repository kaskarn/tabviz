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
   **PARTLY CLOSED (2026-06-14, `types/option-type-parity.assert.ts`)**: a
   compile-time gate now asserts each hand-written `*ColumnOptions` (what the DOM
   cells import) is a key-SUBSET of the schema-generated `*BucketOptions` — so a
   hand-written type can't declare an option the schema lacks (the stars
   `maxStars` root). Covers the 15 PURE-OPTION types. FOLLOW-UP it surfaced: the
   6 field-carrying types (forest/interval/range/viz*) CONFLATE data fields +
   discriminator + internal keys with options in their hand-written
   `*ColumnOptions` — a design smell worth separating (fields vs options) so they
   too can be gated.
2. **No DOM↔export VISUAL parity coverage for any glyph cell.**
   `forest-marks.browser.ts` covers forest mark x-positions only; the wysiwyg
   matrix covers text/numeric/forest/pvalue/bar and measures font attrs + box
   geometry, NOT glyph rendering. sparkline/pictogram/stars/ring/badge/heatmap/
   icon/progress/img/viz_* had NO parity gate.
   **BUILT 2026-06-14: `srcjs/tests/browser/glyph-cell-parity.browser.ts`** —
   mounts the widget at scale-1, rasters `generateSVG(spec)`, pixel-diffs each
   visual column's (fixed-width) cell. Per-column budgets encode the open ranks
   below; `--gate` fails on new/widened divergence. It would have caught every
   rank 1–8 item. CAVEAT: the widget-DOM screenshot hangs under the local
   headless-Chrome capture flake (deadlocks bun's loop — see the harness
   docstring + CLAUDE.md trap), so it SKIPS locally and only MEASURES in CI
   (same screenshot path `settings-consequence` proves works there).
   **CALIBRATED + GATING 2026-06-14** (CI run 27512901960). First clean run
   measured (DPR-1 crops, curved-edge AA puts a perfect match at 4–8%):
   pictogram 4.2 · icon 6.5 · ring 7.4 · stars 7.4 · sparkline 8.9 ·
   progress 9.2 · badge 13.4 · bar 14.2 · heatmap 23.8 (%). All visually
   verified from the `glyph-parity-crops` artifact — the curved-glyph cells
   (ring/stars/pictogram) MATCH; the residual is AA, not divergence. Budgets =
   measured × ~1.6 and only shrink. The first run also caught + fixed two
   HARNESS bugs (missing `bootBuiltinBehaviors` text-degraded the SVG →
   heatmap read 71%; an invalid `glyph:"circle"` fixture) — so no real export
   bug was hiding behind the big numbers. The ranks 3–5 reconciles below now
   have their verification tool: fix → the cell's measured % drops → shrink its
   budget to lock it.

## Findings (ranked by user-visible WYSIWYG impact)

| Rank | Type | Class | Detail | Status |
|---|---|---|---|---|
| 1 | **sparkline** | magic-number (severe) | DOM fixed 60px, SVG fills column; default height 20 vs 16 | **FIXED** (2336d3b): DOM fills column (measured wrapper); height centralized to `SPARKLINE.DEFAULT_HEIGHT` |
| 2 | **stars** | dead-option (key mismatch) | DOM/type/width-estimator read `maxStars`/`halfStars`; wire is `maxGlyphs`/`halfGlyphs` (SVG correct) → cap/half-fill inert in widget | **FIXED** (5cef797) |
| 3 | **heatmap** | **REAL export bug** + magic-number | dark-text: DOM fixed `#1a1a1a`, SVG `readContentPrimary` — LIGHT in a dark theme → unreadable light-on-light value text in dark-theme exports. **FIXED** (67dbf60): centralized to `HEATMAP_TEXT`. Value font 0.9×→**label-role** `readLabelSize` (b38d280). RESIDUAL OPEN: SVG `x=2` 2px inset gutter vs DOM 100% fill — the dominant diff (measured 24.1%); needs the DOM fill-box extent measured before matching |
| 4 | **progress** | magic-number (not centralized) | **RECONCILED** (b38d280/2c73219): geometry centralized to `PROGRESS` const; label font `*0.9`→**label-role** `readLabelSize`; label width 40→`max(32, MEASURED)` (was a fixed slot — wide labels overran); track `--tv-cell-border`→`--tv-border` @0.5 to match the DOM `color-mix`. 9.2→10.1% (residual is bar-fill AA) |
| 5 | **badge** | magic-number + dead-option | **RECONCILED** (b38d280): the `BADGE.PADDING` conflation (ONE const for width AND height, across draw + DOM/SVG estimators → badges under-sized) split into `PADDING_X:10`(=DOM `0 10px`)/`PADDING_Y:4`; `FONT_SCALE 0.8→0.77` (DOM `0.77em`). 13.4→9.7%. (badge font is a DOM `em` literal, not a role — mirroring is correct here. `size`-option in SVG still TODO) |
| 6 | **icon** | magic-number (theme-conditional) | DOM sizes via CSS rem vars; SVG via absolute `CELL_GEOMETRY.icon.px`. Equal at default rem, drift when a theme overrides body/label font-size. `CellIcon.svelte:59-75` ↔ `icon-renderer.ts:32,72` | OPEN |
| 7 | **ring** | minor | geometry IDENTICAL + shared `CELL_GEOMETRY`; drift only in label font (DOM `em` vs SVG absolute `LABEL_FONT_PX`) + track-color default | LOW |
| 8 | **pictogram** | minor | slot/remap/half logic IDENTICAL + shared consts; drift only in the rare literal-char fallback half-state + empty-color default | LOW |
| 9 | **bar** | minor | **RECONCILED**: label font→label-role `readLabelSize`; label width `max(32, MEASURED)` (b38d280/2c73219); track color `--tv-cell-border`→`--tv-border` to match the DOM `.bar-track` (da7f968). 14.3→10.2%, residual is fill-edge AA | OK |
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
