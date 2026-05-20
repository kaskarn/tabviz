# @tabviz/core changelog

This file follows [Keep a Changelog](https://keepachangelog.com).
Wire-format versioning policy lives in
[`docs/dev/versioning.md`](../docs/dev/versioning.md).

## 0.3.0 — 2026-05-19

### Added — `design` theme category (8 new presets)

A third category in `package_themes()` alongside `journals` and `lotr`,
covering design-movement interpretations:

- **`themeBauhaus`** — red primary + blue secondary + yellow accent;
  Jost (Futura-substitute) typography. Exercises the two-tier identity
  cascade rather than mirroring; chrome texture picks up the blue tier.
- **`themeSwiss`** — near-black primary + mid-gray secondary + Swiss red
  accent; Helvetica system stack; no alt-row banding.
- **`themeTufte`** — sparse data-ink-only chrome; near-black primary +
  warm cream secondary; Crimson Pro serif.
- **`themeNewsprint`** — broadsheet B&W + red headline accent;
  Roboto Serif Condensed.
- **`themeSolarized` + `themeSolarizedDark`** — Ethan Schoonover's
  Solarized palette in light and dark variants. Paired via the new
  `lightDarkPair` field.
- **`themeTonal` + `themeTonalDark`** — Material You-style
  tonal-palette-from-seed; demonstrates the cascade's
  tonal-palette-generation behavior natively (no custom logic). Paired
  via `lightDarkPair`.

### Added — `WebThemeV2.lightDarkPair` field

New top-level wire field on `WebThemeV2`. Names a sibling theme that
flips the light/dark mode of the current theme; `null` for themes that
stand alone. Wire-only convention this round — the in-widget switcher's
`prefers-color-scheme` auto-mode is deferred to a follow-up.

### Drift safeguards

The R package side adds two new test files (`test-theme-roster-sync.R`
+ `test-parity-themes.R`) that exercise every preset across both
runtimes via V8. Combined with the existing JS-side byte-exact snapshot
test (`theme-resolve.test.ts`), the round-trip drift detection is now
threefold:

1. R↔TS roster sync (either side adds/drops a theme without the other → fail)
2. R↔TS resolved-wire-shape comparison within OKLab tolerance
3. JS-side byte-exact snapshot vs current resolver output

See `docs/dev/r-ts-parity-notes.md` for the workflow.

### Bumped

- Bundle size budget: +14 KB IIFE / +4 KB gzipped to absorb the 8 new
  resolved-theme snapshots (each ~1.5 KB).

## 0.2.2 — 2026-05-19

### Added — Spec modifiers

Static-spec fluent modifiers landed at `srcjs/src/authoring/modifiers.ts`,
mirroring R's `set_*` family: `setTitle`, `setSubtitle`, `setCaption`,
`setFootnote`, `setTheme`, `setZoom`, `addColumn`, `removeColumn`,
`updateColumn`. All pure, immutable, composable.

```ts
const spec = setFootnote(setTheme(tabviz({...}), "lancet"), "Source: …");
```

Runtime control of a mounted widget still uses the instance methods
returned by `createTabviz` (e.g. `instance.setTheme(...)`).

### Fixed — Column-builder parity drifts caught by the new R↔TS parity test

The `tests/testthat/test-parity-columns.R` harness (added R-side, paired
with the V8-via-Imports promotion) caught three drifts that landed as
TS-side fixes:

- **`colStars` now emits a `pictogram`-typed column** (`glyph = "star"`)
  to match R's `col_stars()`, which is itself a thin wrapper over
  `col_pictogram(glyph = "star")`. The "stars" column type the TS
  builder previously emitted was never produced by R-rendered widgets
  and effectively dead at the renderer.
- **`colInterval` uses the synthetic `_interval_<point>` field name**
  so multiple interval columns sharing the same point estimate get
  distinct ids. Mirrors R's `col_interval` + `default_column_id`
  synthetic-prefix convention.
- **`colSparkline` defaults `header` to `"Trend"`** (literal), matching
  R `col_sparkline(header = "Trend")`. Was falling through to the
  field name.

### Changed — `colCurrency` argument rename

`colCurrency({ currency: "$" })` → `colCurrency({ symbol: "$" })` to
match R's `col_currency(symbol = "$")`. Also added `position?: "prefix"
| "suffix"` argument (R has it; TS was missing). Pre-0.2.2 callers
should update; this is a breaking rename in the 0.2.x line, but the
previous arg name had been a parity bug — the alignment is the right
direction.

### Added — Live OJS rendering of the bilingual gallery + hover legibility fix

The two bilingual gallery pages (`docs/gallery/genetic-association.qmd`
and `docs/gallery/bilingual-dashboard.qmd`) now render the TypeScript
side *live* via Quarto's OJS engine — `@tabviz/core` loads from esm.sh
at page-load with Svelte's peer dep version pinned from
`srcjs/package-lock.json` (auto-bumped on each `quarto render`). Same
plot, both runtimes, one page.

CSS audit + migration: 13 hover/active sites that used bare identity
tokens (`var(--tv-border)`, `var(--tv-accent)`, etc.) as backgrounds
moved to a new contrast-safe `--tv-hover-bg` variable
(`color-mix(--tv-accent 8%, --tv-bg)`). Closes black-on-black hovers
in JAMA and dark themes across toolbar buttons, popovers, and the
theme switcher dropdown.

### Bumped

- Bundle size budget +0.5 KB IIFE / negligible gzipped to absorb the
  modifiers + V8 entry's authoring dispatcher.

## 0.2.1 — 2026-05-19

### Changed — TS is now canonical for `theme-presets-v2.json`

The R-resolved snapshot baseline shipped in 0.2.0 had ~1-25 channels of
per-pixel drift against the TS resolver near gamut boundaries (different
OKLab coefficient precision between `farver` and the hand-rolled Ottosson
implementation). The post-0.2.0 round inverts the parity: TS resolves the
7 preset Tier 1 inputs and writes `theme-presets-v2.json`, so the snapshot
matches the runtime resolver byte-exactly. The R-side resolver continues
to run server-side for R-rendered widgets; each runtime is canonical in
its own context.

Refresh command (run after any change to `oklch.ts`, `theme-resolve.ts`,
`theme-validate.ts`, or `theme-presets-inputs.ts`):

```sh
cd srcjs && bun run scripts/regenerate-theme-presets.ts
```

`theme-resolve.test.ts` is now byte-exact drift detection.

### Changed — R-side opportunistic streamlining

(R-package internal refactor; no observable behavior change. Listed here
since the regenerated JS bundle ships with this patch.)

- Deduped legacy-input migration check into `check_legacy_inputs(args, arg_hint)` —
  both `web_theme()` and `set_inputs()` previously hand-coded the same
  `brand`/`tertiary` deprecation `cli_abort` block.
- Unified `fill_na()` and `compose_text()` in `R/utils-theme-resolve.R` —
  same null-fallback iteration; `fill_na()` now dispatches on
  `inherits(source, "S7_object")` to handle both list-source and
  S7-source forms.
- Dropped unreachable defensive guard at line 583 of the old resolver
  (`secondary_deep` re-mirror inside `resolve_components`) —
  `resolve_inputs_mirrors` already guarantees the prop is non-NA before
  that code path runs.

### Bumped

- Bundle size budget: +16 KB / +5 KB gzipped to absorb the 3 LOTR preset
  snapshots that joined the JSON file (were resolved-at-load in 0.2.0).

## 0.2.0 — 2026-05-18

### Added — Authoring API

The JS side is now a first-class authoring target, not just a runtime that
consumes R-emitted specs. Every R helper has a TypeScript mirror exported
from the main entry:

```ts
import { tabviz, colText, colInterval, vizForest, themeLancet } from "@tabviz/core";

const spec = tabviz({
  data: rows, label: "study", theme: "lancet",
  columns: [
    colInterval({ point: "hr", lower: "lcl", upper: "ucl" }),
    vizForest({ point: "hr", lower: "lcl", upper: "ucl", scale: "log" }),
  ],
});
```

Surface:

- **`tabviz(args)`** — top-level WebSpec constructor; mirrors `R::tabviz()`.
- **Column builders** — `colText`, `colLabel`, `colNumeric`, `colN`,
  `colCurrency`, `colPercent`, `colInterval`, `colPvalue`, `colRange`,
  `colEvents`, `colBar`, `colSparkline`, `colHeatmap`, `colProgress`,
  `colBadge`, `colIcon`, `colStars`, `colPictogram`, `colRing`, `colImg`,
  `colReference`, `colGroup`. 1:1 with R's `col_*()` helpers; argument
  names + defaults match.
- **Viz builders** — `vizForest`, `vizBar`, `vizBoxplot`, `vizViolin`;
  effect helpers `effectForest`, `effectBar`, `effectBoxplot`,
  `effectViolin`. Annotation helper `refline()`.
- **Theme API** — preset constructors (`themeCochrane`, `themeLancet`,
  `themeJama`, `themeDark`, `themeDwarven`, `themeElvish`, `themeHobbit`);
  custom-theme constructor `webTheme()`; modifiers `setInputs`,
  `setVariants`, `setSpacing`, `setThemeField`; name-string resolver
  `resolveThemeRef()`.

### Added — Cascade resolver ported to JS (C5)

`R/utils-theme-resolve.R` is now mirrored by `srcjs/src/lib/theme-resolve.ts`:
the full 3-tier OKLCH cascade (Tier 1 inputs → Tier 2 chrome/data/text →
Tier 3 component clusters), the contrast validator, and density-preset
spacing all work JS-side. Means `theme: { extend: "lancet", overrides: {
inputs: { primary: "#..." } } }` re-derives every Tier 2/3 leaf from the
new Tier 1, no R round-trip required.

Parity with R-resolved snapshots is tested per-preset (`theme-resolve.test.ts`);
chrome (surface/content/divider) matches byte-exactly. Series slot bundles
and accent muted/tint variants are within OKLab precision (~1-25 channels
of drift near gamut boundaries; see [`docs/dev/r-ts-parity-notes.md`](https://github.com/kaskarn/tabviz/blob/main/docs/dev/r-ts-parity-notes.md)
for the known gap and Phase 2 mitigation path).

### Added — LOTR preset themes in TS

`themeDwarven`, `themeElvish`, `themeHobbit` — the easter-egg editorial
themes. Available via `tabviz({ theme: "dwarven" })` and the in-widget
theme switcher. Pre-release; may move to a separate package before CRAN.

### Changed — View Source JS tab

Was: dump the resolved WebSpec as a 200+ line JSON literal. Now: emit a
compact builder-style snippet using the new authoring API:

```ts
const spec = tabviz({
  data: tabvizData,                          // ← placeholder, not inlined
  theme: "lancet",                            // ← name-string when preset matches
  columns: [
    colInterval({ point: "hr", lower: "lcl", upper: "ucl" }),
    vizForest({ point: "hr", lower: "lcl", upper: "ucl", scale: "log" }),
  ],
});
```

Pure function (`srcjs/src/lib/source-emit.ts`); same op-log replay below
the spec block.

### Bumped

- Bundle size budget: tabviz.js / tabviz_split.js bumped to absorb the
  authoring layer (+21 KB IIFE / +6 KB gzipped). Main npm entry
  (`dist/index.mjs`): 5.32 KB gzipped, +1.3 KB over 0.1.5.

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
