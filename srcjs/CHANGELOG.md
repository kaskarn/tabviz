# @tabviz/core changelog

This file follows [Keep a Changelog](https://keepachangelog.com).
Wire-format versioning policy lives in
[`docs/dev/versioning.md`](../docs/dev/versioning.md).

## 0.1.5 — 2026-05-15

### Fixed
- **Explicit `col_text(..., width = N)` is now a hard pin.** Previously, if
  the column header text was estimated wider than `N`, both
  `calculateSvgAutoWidths` (SVG export) and `measureLeafColumn`
  (live widget store) silently auto-grew the column to fit the header —
  treating `width = N` as a floor rather than a pin. That broke WYSIWYG
  between the spec and the export, and made it impossible to author a
  deliberately-narrow column with a long header (the header would push
  the column out from under the author). The new contract: `width = N`
  means exactly N pixels; headers that don't fit clip via the existing
  `text-overflow: ellipsis` CSS (or wrap, when `wrap = TRUE` is set).
  `width = "auto"` / `NULL` / `NA` continue to auto-measure. Partial
  context for [GH #6](https://github.com/kaskarn/tabviz/issues/6) —
  the remaining "downloaded plot layout differs" symptom needs the
  reporter's clarification on which export path (`save_plot()` vs the
  in-widget Download button), tracked separately on the issue.

## 0.1.4 — 2026-05-15

### Fixed
- **Half-fill glyph (`col_pictogram(half_glyphs = TRUE)`) rendered as a full
  star with a translucent gray rectangle over the right half — visibly
  artifacted on any non-white theme background.** Both the live widget
  (`CellPictogram.svelte`) and the SVG export (`export/svg-generator.ts`)
  were doing the same `<rect>`-with-opacity overlay trick, whose
  appearance depended on the cell background color underneath. Replaced
  with a `<clipPath>`-based approach: empty outline rendered underneath,
  filled path on top clipped to the left half of the viewBox. The result
  is bg-color independent, viewBox-aware (works for any glyph viewBox,
  not just `0 0 24 24`), and produces a proper "half star" silhouette.
  `<clipPath>` ids are scoped per component instance (live) and per
  `(row.id, column.id, slot, path-hash)` (SVG export) to keep the
  document-wide id namespace clean.

## 0.1.3 — 2026-05-14

### Fixed
- **Dropdown popovers now clamp to the viewport** ([GH #5](https://github.com/kaskarn/tabviz/issues/5)).
  `autoPosition` (the Svelte action driving the download / theme-switcher /
  export-fallback popovers) gained a second-pass safety net: after the
  first-pass placement applies, it re-measures the dropdown's actual rendered
  rect and clamps any edge that overflows the viewport inward by 8px. Catches
  the cases the first-pass math can miss — late-loading webfonts shifting the
  dropdown's intrinsic width, containing-block leaks from a transformed
  ancestor, container CSS that constrains width differently than measured.
  The clamp math is extracted as a pure function (`computeViewportClamp`) with
  9 unit tests covering all edge directions.

## 0.1.2 — 2026-05-14

### Fixed
- **Column-hide was a no-op for user-inserted columns** ([GH #7](https://github.com/kaskarn/tabviz/issues/7)).
  `applyColumnEdits` filtered the original spec columns by `hiddenColumnIds`
  but pushed `userInsertedColumns` unconditionally, so an inserted-then-hidden
  column stayed visible. Both inserted-column loops now honor the hidden set.
- **JAMA theme header hover became unreadable** ([GH #4](https://github.com/kaskarn/tabviz/issues/4)).
  The `.header-cell.sortable:hover` rule swapped in `var(--tv-border)` as the
  background — fine for most themes, but JAMA's `divider.subtle` is pure black,
  so the hover went black against unchanged dark text. Replaced with the
  `color-mix(in srgb, var(--tv-accent) 12%, var(--tv-bg))` accent-tint pattern
  used by other hover states in the file — contrast-safe across all four themes.

### Internal
- Added a regression test for the wrap+newline contract in `wrap-text.test.ts`
  ([GH #3](https://github.com/kaskarn/tabviz/issues/3) — closed as already-fixed
  in current code; the test pins the symmetric `\r?\n` splitting between the
  live widget and the SVG exporter so it doesn't silently drift).

## 0.1.1 — 2026-05-14

### Fixed
- README oversold "framework-free." Added an Installation section that
  explicitly notes Svelte 5 must be installed as a peer for the main
  `@tabviz/core` entry and `@tabviz/core/svelte`. (`/export` and
  `/spec` work without it.)

### Added
- `engines.node` (>=18) so consumers on older Node see a clear warning
  rather than cryptic ESM resolution errors.
- `sideEffects: ["**/*.css"]` so consumer bundlers (webpack, esbuild,
  rollup) can tree-shake the JS while preserving CSS-import side effects.
- `prepublishOnly` script that runs the full build chain + CI gates
  before each publish — prevents accidentally shipping stale `dist/`.

### Internal
- Bundled-output bytes unchanged from 0.1.0 (the metadata-only changes
  don't alter rollup's emit).

## 0.1.0 — 2026-05-14

Initial public release. The JS runtime for the
[`tabviz`](https://github.com/kaskarn/tabviz) R package, packaged as
an npm consumable.

### Subpaths
- `@tabviz/core` — `createTabviz` / `createSplitTabviz` factories +
  wire-format TypeScript types
- `@tabviz/core/svelte` — `ForestPlot`, `SplitForestPlot` components
  + `createForestStore` / `createSplitForestStore`
- `@tabviz/core/export` — `exportToSVG`, `exportToPNG`,
  `computeNaturalDimensions` (pure-function pipeline, no Svelte
  dependency)
- `@tabviz/core/spec` — TypeScript types + JSON Schema (`v1.0.json`)
  for validating WebSpec payloads
- `@tabviz/core/style.css` — standalone stylesheet for npm consumers

### Wire format
- Version `1.0`. Locked surface; minor versions stay backward-compatible
  per the versioning policy.
