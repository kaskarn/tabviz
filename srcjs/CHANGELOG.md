# @tabviz/core changelog

This file follows [Keep a Changelog](https://keepachangelog.com).
Wire-format versioning policy lives in
[`docs/dev/versioning.md`](../docs/dev/versioning.md).

## [Unreleased]

### Fixed

* **Theme switch no longer crashes** with `Cannot read properties of
  undefined (reading 'containerBorder')`. `computeLiveConfigVars` read
  `theme.layout.containerBorder` raw while guarding `theme.series?.[0]`
  right above it — a transitioning/partial theme (no `layout` blob) threw,
  and the bad object corrupted every subsequent render. The container-border
  defaults (`false` / `8px`), previously hardcoded in three places, are now
  owned by one `resolveContainerBorder(layout)` helper
  (`lib/theme/layout-defaults.ts`) that the DOM emitter, the SVG export, and
  `buildTheme` all call — robust to absent layout, no drift.

### Changed

* **Interaction defaults are now MAXIMAL** (`BAKED_INTERACTION_DEFAULTS`).
  Author-grade affordances — `enableEdit`, `enableReorderRows`,
  `enableReorderColumns`, `enableAxisZoom`, `enableArrange` — default ON
  alongside the reader-safe set, so every affordance is available without
  re-enabling it per spec. Edits are local (never persist to the doc).
  `showGroupCounts` / `showFilters` stay off. Opt out per-spec, per-theme,
  or via the global `tabviz.interaction_defaults` tier (4-tier resolution
  chain unchanged). Decision register D9.
* **Text-width estimator is now empirical** (the V8/export path that runs
  without a canvas). The hand-tuned character-class multipliers — magic
  numbers that accreted via local nudges and over-budgeted column widths
  by ~7% — are replaced by REAL per-glyph advance tables measured offline
  from every preset's actual webfonts at anchor weights 400/700
  (`font-metrics.generated.ts`; regenerate with `npm run
  regen:font-metrics`). Resolution: primary family → its measured table
  (interpolating each glyph across the continuous weight axis) or fixed
  mono advance; unknown family → a serif/sans/mono class fallback. Residual
  vs a real canvas is kerning only (~1–2%). Export column widths are now
  sub-pixel-accurate to the browser.
* **Export label-column layout unified with the widget.** The
  label/primary column now participates in the export's multi-flex width
  distribution exactly as it does in the live widget's layout-zoom grid —
  it pins under provided widths (systemfonts/widget; stays pixel-exact) and
  flexes from-scratch (matches the screen). Forest/viz columns measure to
  their visual-min floor like the DOM. Closes the long-standing
  WYSIWYG flex-parity gap: the raw `generateSVG` path now matches the DOM
  layout (gate at 0 breaches). No wire or API change.

## 0.7.0 — 2026-06-13 — ship-readiness sweep + settings substrate

(Staged 2026-06-11 for the ship-readiness sweep; the settings-redesign
substrate landed before the first publish, so both ship together in
0.7.0 — the registry goes 0.6.0 → 0.7.0. Wire stays frozen at 1.10 and
the theme envelope at `tabviz-theme/v4`: every addition below is
additive.)

### Wire FROZEN at 1.10

Additive minors only from here; majors need a migration handler. The
published JSON Schema (`dist/tabviz-spec.schema.json`, 2020-12 dialect)
describes the frozen shape: hand-written top-level + per-column-type
option definitions generated from the schema registry. Unknown column
types stay valid (additive-minor contract); known types must satisfy
their definitions.

### Added

* **Structured spec diagnostics** on the `/spec` subpath: `validateSpec`
  collects `{path, code, message, severity}` issues (version, WebData
  shape, row/column id uniqueness, field references incl. forest
  options); `assertValidSpec` is the ingress wall in `createTabviz`
  (errors throw `SpecValidationError`; warnings surface).
* **MCP server** (`scripts/mcp-server.mjs`): dependency-free stdio
  JSON-RPC exposing `list_column_types` / `get_column_schema` /
  `list_themes` / `get_spec_schema` / `validate_spec` / `render_svg` —
  the LLM-driver path, importing only from `dist/`. Smoke:
  `npm run mcp:smoke`.
* **Theme house styles**: five presets ship `column_defaults` (nejm,
  terminal, brutalist, newsprint, synthwave); theme switches re-base the
  outgoing theme's bake (`rebaseThemeColumnDefaults`). Authorship
  contract: themes are the delegated half of authoring (D18) — author
  non-default values always win.
* **Consumer fixture** (`scripts/consumer-fixture.mjs`): author →
  shipped-schema validate → headless SVG, importing only `dist/` — runs
  in `build:npm`.
* **Settings UX rebuilt from first principles** (the `./svelte` widget):
  a five-surface panel — Variations · Labels · Edit-theme{Identity ·
  Plots · Styling} — each control gated on a visible-pixel consequence
  harness. New `ThemeInputs` fields (additive, `tabviz-theme/v4`):
  - `banding` / `banding_start` — alternating-row background as Tier-1
    structural-variant inputs (the grammar string `none|row|group|
    group-N`, and whether the first band is shaded), previously
    figure-only runtime state.
  - `series_overrides` — sparse per-series viz overrides indexed by slot
    (`{fill?, stroke?, shape?}`), overlaid after the `slot_style`
    derivation; the freeform escape hatch for marker styling. Hex/shape
    gated at every ingress.
* **`tag` is a first-class plot-label slot** (`PlotLabels.tag`): the
  caption-chip stamp, editable like title/subtitle/caption/footnote
  (was author-only).

### Fixed

* **Six column types silently exported as plain text** in headless
  (V8) rendering — pvalue (stars/pill), bar, heatmap, reference, range,
  img: their SVG renderers were registered only by the DOM boot. Split
  into V8-safe modules registered from both boots; gated by
  `schema/boot-coverage.test.ts` and the dual-target render sweep
  (`schema/render-coverage.runes.ts`).
* The significance pill inflated compact rows by 2px (DOM-only growth
  the export can't see) — its decoration box is now layout-neutral.
* The zoom dropdown had no Escape path (outside-click was the only
  dismissal).
* ARIA table semantics: the CSS grid now exposes a real
  table/row/columnheader/cell tree; `aria-sort` + keyboard sort on all
  sortable headers; `aria-expanded` tracks group collapse.
* **Multi-effect forest CI lines drew every series in slot-0's stroke**
  (`./export` + the DOM renderer) — each effect's interval line now
  follows its OWN series slot's stroke, so multi-series forests are
  distinguishable by line color (single-effect forests unchanged).

### Changed

* `enableThemes` rosters travel as slim inputs-form envelopes expanded
  in-widget (9-preset payload 43.9 kB → 8.4 kB).
* README rewritten as verified JS-author docs (every snippet ran
  against `dist/` first); MCP + schema sections added.

## 0.6.0 — 2026-06-10

### Added — the declarative theme contract surface

`@tabviz/core` now publishes the machine-drivable theme contract (the
"any language — or LLM — can drive it" surface):

* `parseThemeWire` / `buildThemeWire` — validated round-trip of the
  portable theme wire envelope, with a structured `ThemeIssue{path, code,
  message}` error list instead of opaque throws.
* `toDtcg` / `fromDtcg` — lossless interop with the Design Tokens
  Community Group format (reference / semantic / component groups;
  provenance preserved in `$extensions["com.tabviz.theme"]`).
* `suggestTheme(brandHex, …)` — derive a complete, contrast-checked theme
  from a single brand color, riding the cascade's own legibility
  guarantees.
* `listRoles` / `listComponentTokens` — the queryable role + `--tv-*`
  token roster (names are stable DTCG token names).

Role bindings now serialize as stable NAME aliases (e.g. `"neutral.5"`)
rather than internal `{ramp, grade}` coordinates, so a later ramp re-tune
doesn't silently re-target a saved theme.

### Changed — performance + internal cleanup

* `getCssVars` caches its base + v3-bridge overlay per theme identity
  (spacing pins still applied fresh per call); `region-tree` group walk is
  now O(G) (was O(G²)); shared-axis column widths are O(M·K) (was O(M²·K)).
* Removed dead internal modules (the unwired token-attribution + SVG-CSS
  extraction paths) and a no-op inspector toggle.

(0.5.0 was published without a changelog entry; this entry also covers the
contract surface, which predates the 0.5.0 tag but was never published.)

## 0.4.0 — 2026-05-21

### Changed — TS authoring surface now mirrors R defaults across the board

The R-side `viz_*` constructors and `col_date` now delegate shape
construction to the TS authoring API (`vizForest`, `vizBar`,
`vizBoxplot`, `vizViolin`, `colDate`). To make this work, the TS
builders absorbed the defaults that previously only lived R-side:

* `vizForest` now uses the `_forest_<point>` synthetic field, defaults
  `sortable: false` and `headerAlign: "center"`, falls back to the
  effect label for the header when one is present, and validates the
  same conditions R does (mutually exclusive `point/lower/upper` vs
  `effects`, finite/monotonic `axisRange`, positive `nullValue` and
  lower bound on log scale).
* `vizBar` / `vizBoxplot` / `vizViolin` mirror their R counterparts —
  synthetic field naming, header fallback to effect label, default
  `sortable: false`, default `headerAlign: "center"`, and a synthetic
  dashed refline prepended when `nullValue` is supplied.
* `colDate` joins the TS surface (`type: "text"` with `options.date`).

The pure-TS `tabviz()` constructor also picks up three R behaviors:

* Synthesizes a `__row_number__` "#" column when no `label` is given.
* Prettifies the default label header (`label: "study_name"` →
  `"Study Name"`).
* Uses positional `row_<1-based>` row ids (was: preferred `row.id`).

### Added

* `colDate({ field, format, ... })` — date column with strftime format.

## 0.3.5 — 2026-05-20

### Fixed — column editor recognized no fields under pure-TS `tabviz()`

The R-side `tabviz()` emits an `availableFields` manifest derived from
the data frame; the TS-side `tabviz()` didn't. With no manifest, the
in-widget column editor's "field" dropdown was empty and slot-category
checks rejected every field. `tabviz()` now mirrors
`R::serialize_available_fields()`, scanning `args.data[0]` keys and
inferring a `FieldCategory` (`numeric` / `string` / `date` /
`array-numeric` / `logical` / `other`) from the values across rows.

## 0.3.4 — 2026-04-29

### Changed — label column hoisted to its own wire slot

`WebSpec.labelColumn?: ColumnDef | null` is now a top-level field on
the wire shape, replacing the magic `columns[0].id === "label"`
convention. `tabviz()` populates it from `label:` / `labelHeader:`;
the store materializes the effective column list as
`[labelColumn, ...columns]` at render time. Legacy wires with an
inline `id: "label"` column continue to work via a one-line fallback
in the columns store. `emitJsSource()` round-trips the slot through
the `label:` sugar where possible, falling back to inline emission
for customized label columns (custom width/align).

### Fixed — `escapeXml` tolerates null input

Removed a hard throw on `escapeXml(null)` so optional string fields
on the serialized labelColumn (`headerAlign` etc.) don't crash the
SVG export pipeline.

## 0.3.3 — 2026-05-20

### Fixed — `tabviz()` now auto-inserts a label column

When `label: "region"` is set, the TS-side `tabviz()` now prepends a
`colText({ field: label, header: labelHeader ?? label, id: "label" })`
to `columns` — mirroring R's `tabviz()` behavior. Without this, the
bilingual gallery's OJS-rendered widget was missing its leftmost
identifier column. Caller-supplied columns with `id === "label"` are
preserved (no double-insert).

### Settings panel — removed half-baked "First column" toggle, moved Container to Spacing

The "First column: Default / Bold" toggle in the Layout tab was
half-baked (the rendering path doesn't fully honor the bold variant
yet); pulled until the renderer side catches up. The "Container"
section (border + radius) moved from the Layout tab to the Spacing
tab, where it sits below the existing token sections — better fit
with the other margin/padding controls.

## 0.3.2 — 2026-05-19

### Changed — BMJ is now the default theme

`tabviz({ ... })` without an explicit `theme:` now resolves to `themeBmj()`
(previously `themeCochrane`). Same change R-side; `set_theme("default")`
also routes to BMJ. The View Source emitter's preset-name folding
updates to omit `theme: "bmj"` when it matches the new default.

### Changed — Column-helper alignment with R for parity-via-delegation

Several TS builders now match R's wire shape exactly so R-side
delegation (post-`R/v8-bridge.R`) produces byte-identical output:

* **`colRange`** — args renamed from `{ field, minField, maxField }` to
  `{ low, high }`; default header is `"Range"`; field is computed as
  `_range_<low>_<high>` (synthetic, matches R's `default_column_id`).
* **`colEvents`** — field is computed as `_events_<events>_<n>` (was
  the bare `events` field name).
* **`colReference`** — default header is `"Reference"` (was the field
  name).
* **`colPercent`** — wire `type` is `"numeric"` (was `"custom"`); the
  renderer dispatches both through `formatNumber` so the change is
  internally consistent.

### R-side: 17 column helpers now delegate to TS via V8

`col_label`, `col_interval`, `col_pvalue`, `col_sparkline`, `col_percent`,
`col_events`, `col_icon`, `col_badge`, `col_pictogram`, `col_ring`,
`col_stars` (via pictogram), `col_img`, `col_reference`, `col_range`,
`col_heatmap`, `col_progress`, `col_currency` — all now compute wire
shape via `ts_call("colX", ts_args)` and wrap in S7 via `web_col()`.
Joins the earlier delegations of `col_text`, `col_numeric`, `col_n`,
`col_bar` for a 21-helper delegated set. Only `col_date` and the
`viz_*` family remain hand-rolled R-side (viz_* has complex annotation
serialization deferred to a separate round).

Behavior unchanged for callers; new parity tests in
`tests/testthat/test-parity-columns.R` pin the contract.

### `ts_call`: simplifyVector now true for primitive arrays

V8 round-trip parsing now uses `jsonlite::fromJSON(simplifyVector =
TRUE, simplifyDataFrame = FALSE, simplifyMatrix = FALSE)` so options
fields like `palette`, `thresholds`, `seriesAnchors` come back as R
vectors (the shape R-side tests expect) instead of lists. Nested
objects still parse as lists (so cluster shapes don't collapse to
data frames).

`col_ring` and `col_badge` additionally re-mark their threshold/colors
fields with `I()` after delegation — V8 round-trip strips the AsIs
class, and a length-1 `thresholds` would otherwise auto-unbox to a
scalar in the outgoing wire and crash the renderer's iteration.

## 0.3.1 — 2026-05-19

### Added — three more journal themes

* **`themeNejm`** — New England Journal of Medicine interpretation:
  deep navy primary (slightly darker than Lancet), muted crimson
  accent, Source Serif Pro. Distinct sibling to Lancet (old-gold
  accent + Georgia) and JAMA (pure mono).
* **`themeNature`** — Nature journal interpretation: deep red brand
  primary, charcoal secondary, sky-blue accent, PT Serif body with
  system-sans display. Modern editorial register.
* **`themeBmj`** — BMJ Group interpretation: cooler-than-Cochrane teal
  primary, warm-gray secondary, orange accent, modern sans throughout.

Each lands in the `journals` category of `package_themes()` and is
exercised by the existing R↔TS parity + roster-sync tests.

### Fixed — `colCurrency(abbreviate: true)` was dropping the prefix/suffix

`formatNumber` previously short-circuited the abbreviate branch with an
early `return abbreviateNumber(value)`, skipping the
prefix/suffix-application step. Result: `colCurrency({ symbol: "$",
abbreviate: true })` rendered `"75.5K"` instead of `"$75.5K"`. Restructured
the function so abbreviate, digits, and decimals all flow into a uniform
prefix/suffix step. Regression tests in
`srcjs/src/lib/formatters.test.ts`.

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
