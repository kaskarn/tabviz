# @tabviz/core changelog

This file follows [Keep a Changelog](https://keepachangelog.com).
Wire-format versioning policy lives in
[`docs/dev/versioning.md`](../docs/dev/versioning.md).

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
