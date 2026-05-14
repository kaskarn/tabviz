# @tabviz/core changelog

This file follows [Keep a Changelog](https://keepachangelog.com).
Wire-format versioning policy lives in
[`docs/dev/versioning.md`](../docs/dev/versioning.md).

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
