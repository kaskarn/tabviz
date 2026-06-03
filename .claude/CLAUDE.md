# tabviz Package Development Conventions

DO NOT USE pkgdown

## Package Vision

tabviz is a **TypeScript/Svelte package (`@tabviz/core`, in `srcjs/`) with an R interface wrapper (the `tabviz` R package, in `R/`)**. The canonical authoring surface is JS; the R package is one consumer among potentially many.

- **`@tabviz/core`** owns the runtime: data model, rendering, formatters, width measurement, theme resolution, interactive state, SVG export. All semantics live here. JS authors can use it directly without R in the loop.
- **R package** is a wrapper providing: idiomatic R API, syntactic sugar (`col_*` helpers, fluent modifiers), data coercion, Shiny handlers, server-side reactivity. R produces the same spec shape a JS author would write — there is no privileged R-side computation path.
- Decisions about where logic lives default to **TS unless it is irreducibly R-side** (Shiny bindings, R-environment ergonomics, knit-time integration). When in doubt, put it in the TS package and have R call into it.

## Theme cascade rework — substantially landed on `feat/theme-rework`

**Status (2026-06-03):** Stage 1 substrate sprint is substantially LANDED on the long-lived `feat/theme-rework` branch. Steps 1–7 + 9 + 12 fully landed (~30 commits); steps 8 (R-side S7 slimming) + 10 (v3 dead-code purge) intentionally deferred to a follow-up session — v3 and v4 coexist via the consumer-bridge module and `buildThemeCSS` dual-emission. Stages 2–4 still designed-but-not-built.

- [`docs/dev/theme-cascade-rework.md`](../docs/dev/theme-cascade-rework.md) — vision, principles, staged plan, strategy.
- [`docs/dev/theme-cascade-stage-1-design.md`](../docs/dev/theme-cascade-stage-1-design.md) — Stage 1 substrate contract (manifest, CSS-var wire, override schema, `data-*` variants, resolver capabilities, row-kind heights, migration plan). LANDED.
- [`docs/dev/theme-cascade-stage-2-design.md`](../docs/dev/theme-cascade-stage-2-design.md) — typography cascade, shell/paper, surface textures, HC encoding fidelity. Not started.
- [`docs/dev/theme-cascade-stage-3-design.md`](../docs/dev/theme-cascade-stage-3-design.md) — editor architecture (Settings panel, Cascade Inspector, Spine UI, OKLCH picker, export). Not started.
- [`docs/dev/theme-cascade-refactor-notes.md`](../docs/dev/theme-cascade-refactor-notes.md) — running rationalization log; final landing entry at end.

**Substrate landed surface** (consumable from main once branch merges):
- **`srcjs/src/lib/theme/component-tokens.ts`** — manifest of `--tv-*` tokens with `consumedBy` declarations + drift gate.
- **`srcjs/src/lib/theme/consumer-bridge.ts`** — `getCssVars(theme)` / `readVar(cssVars, name, fallback)` / `readVarPx(...)` for SVG-attribute and JS consumers.
- **`srcjs/src/lib/theme/theme-wire.ts`** — wire surface: `createWire`, `setRoleBinding`, `pinTokenByName`, `releaseRole`, etc.
- **`srcjs/src/lib/theme/resolve-theme.ts`** — `resolveTheme(wire) → ResolvedTheme` (cssVars + ramps + roles + provenance).
- **`srcjs/src/lib/theme/inspect.ts`** — `inspectToken`, `listComponentTokens`, `formatTrace`.
- **`srcjs/src/lib/layout/row-kind-heights.ts`** — 5-layer per-row-kind height cascade.
- **R-side helpers** (`R/v4-inspect.R`): `list_component_tokens()`, `theme_css_vars()`, `inspect_token()`, `diff_themes()`, `contrast_report()`. **`set_polarity()`** is an alias for `set_mode()` matching the new vocabulary.
- **R serialization** sends `polarity` (not `mode`) — `mode` is now the accessibility axis (standard / high-contrast / reduced-transparency); polarity is the L-reflection axis.
- **DOM render path** reads v4 via `var(--tv-foo, var(--tv-foo-legacy))` chains in `TabvizPlot.svelte`; SVG export path reads via `getCssVars(theme)` + `readVar`/`readVarPx`.

**Strategy decisions** (vision doc §9):
- **Branch lives on `feat/theme-rework`** until step 10 (v3 purge) and step 8 (R-side S7 slim) close. Both are delete-only operations enabled by the substrate already being load-bearing.
- **No "v4" suffix in code anywhere.** Files stay at canonical paths.
- **Visual change accepted, not minimized.** Stage 1's visual sweep (`tests/visual/output/`) is clean across 57 PNGs; the v4 paths produce identical numbers to v3 for the layout-metrics fixtures (the v3 spacing pin layer enforces this).
- **Preset porting deferred to Stage 4.** v3's 18 presets continue to work via the dual-emission bridge.

**When working on theme-related code:** the v4 substrate IS the target. Read tokens via `readVar(cssVars, "--tv-foo", theme.foo.bar)` (existing v3 path stays as fallback). Add new manifest entries to `component-tokens.ts` rather than scattering inline reads. Update KNOWN_UNCONSUMED downward, not upward.

## Working in this Codebase

This package is developed in long, disjointed agentic sessions. Future agents (including you, next session) will not remember the current conversation. **Leave a clear trail.**

- **Update this `CLAUDE.md`** when you establish a new convention, learn a constraint future agents will hit, or build new test infrastructure worth sharing.
- **Look for existing code before writing new code.** Search `srcjs/src/lib/`, `srcjs/src/stores/`, `srcjs/src/spec/`, `srcjs/src/authoring/`, and `R/utils-*.R` for prior art. When you find near-duplicates while working in an area, consolidate.
- **Centralize, don't scatter.** Configuration, defaults, registries, and feature constants live in one discoverable place per concern (e.g. `R/themes.R`, `R/glyph-registry.R`, `srcjs/src/lib/font-presets.ts`). Prefer named constants over magic numbers, named functions over inline expressions, frozen module-level dispatch tables over scattered `const`s at call sites.
- **Document non-obvious *why*** in code comments only when the why isn't visible from the code itself.

## Codebase Ontology

The package is **specification-first**: authors construct a `WebSpec`, serialize it to JSON, and ship it to a renderer. The terms below are used consistently throughout the code; future work should use them too.

- **WebSpec** (`R/classes-core.R:259`, mirrored in `srcjs/src/spec/v1.0.json`) — the root container: `data`, `columns`, `theme`, `groups`, `summaries`, `interaction`, `initial_state`, `layout`, `labels`, `paginate`, plus *style-mapping columns* (`row_bold_col`, `marker_color_col`, …).
- **SplitForest** (`R/classes-core.R:411`) — a collection of WebSpecs plus shared axis range and column widths for split-by views.
- **Column** — has a `type` string (`text`, `numeric`, `interval`, `forest`, `sparkline`, `pictogram`, `pvalue`, `bar`, `events`, `icon`, `badge`, `ring`, `stars`, …) plus a type-specific `options` object. One R class (`ColumnSpec`) and one TS shape; types are flat instances with string discriminators.
- **Effect** (`R/classes-core.R:58`) — a single forest data series (point/lower/upper columns + label + color/shape/opacity). Multi-effect forest columns hold a list of these.
- **Annotation** (`R/classes-annotations.R`) — typed overlay on the plot (`ReferenceLine`, `CustomAnnotation`, …). Each is a distinct S7 class; serialization dispatches on `S7_inherits` in `serialize_annotation()` (`R/utils-serialize.R:917`).
- **Mark** — a visual element type (forest point, interval, bar, box, violin, lollipop). Each carries a `MarkRecipe` wiring channels (body/outline/line) to slot bundle fields.
- **Glyph** — a named SVG path (person, skull, leaf, …). Roster lives in `R/glyph-registry.R` and `srcjs/src/lib/glyph-registry.ts` and **must stay in sync** (parity tests guard this).
- **Slot** — a per-series visual styling bundle (`SlotRole`, `R/classes-theme.R:243`; `SlotBundle` is a deprecated alias at `:283`): fill, stroke, muted/emphasis variants, text_fg, shape. One slot per data series; the pooled summary reads slot[0].
- **Token** — a named semantic role applied to rows/cells. Paint-tool tokens: `emphasis`, `muted`, `accent`, `bold`, `fill` (`R/classes-theme.R:535-609`). Status tokens (`positive`, `negative`, `warning`, `info`) are orthogonal.
- **Tier** — the cascade levels in theme resolution. **Tier 1 = inputs** (primary, secondary, accent, series_anchors, fonts, neutrals, slot_style). **Tier 2 = derived roles** (surfaces, content, dividers, accent roles, semantics, series slots). **Tier 3 = component clusters** (Header, ColumnGroup, RowGroup, Row, Cell, FirstColumn, PlotScaffold, MarksRecipes, AxisConfig, Layout).
- **Cluster** — a Tier 3 region grouping bg/fg/rule/text-role (e.g. `RowCluster` with base/alt/hover/selected + semantic bundles + banding mode).
- **Cascade** — the resolution flow `Tier 1 → Tier 2 → Tier 3`, deterministic and **idempotent**: NA fields fill from upstream; user pins survive re-resolution. The cascade now runs TS-side (`srcjs/src/lib/theme/theme-resolve.ts`); R delegates to it via V8 in `resolve_from_inputs()` (`R/themes-api.R`), so `R/utils-theme-resolve.R` retains only the density-preset mirror used by parity tests.
- **Style mapping** — pointing the spec at *data columns* that supply per-row or per-cell style values (`row_bold_col`, `marker_color_col`, …). Styles are not embedded per row; they're extracted at serialization time from the mapped column.
- **Modifier** (`R/modifiers.R`) — a function that transforms a `WebSpec`, htmlwidget, or `tabviz_proxy`; dispatches on input class so the same modifier name does the right thing for each target.
- **Region tree** (`srcjs/src/lib/layout/region-tree.ts`) — the row-system foundation: rows are a tree of `RegionNode`s (`kind`/`traits`/`scope`, body = column-cells | free content, `children`) that `flatten()` projects into the flat `DisplayRow[]` the layout/render path consumes. `buildRegionTree` is structural (groups/rows/reorder, collapse-independent); `flatten` applies collapse + disclosure (`expandedRows`) at emit. The seam **details panels** and (future) **faceting** attach to. Design: `docs/dev/region-tree.md`.
- **RowKind** (`srcjs/src/lib/layout/row-kind.ts`) — single source of truth for "what kind of row": `data` / `group_header` / `spacer` / `summary` / `header` / `panel`. `resolveRowKind` + a `rowKindProps` table (banded / measuresWidth / rendersCells / summaryMarker) consolidate what were ~50 scattered predicates. `RegionKind = RowKind | "axis_strip"`.
- **Details / notes** — full-width free-content rows built on one primitive: a `panel` region (markdown, content-driven height). **Details** (`Row.details`, R `details=`/`details_expanded`) is a row-owned disclosure panel gated by `expandedRows`; **notes** (`WebSpec.notes`, R `add_note(after, content)`) are always-visible inserts. DOM renders markdown→HTML (`lib/markdown.ts`); SVG export renders markdown→plain-text band (`markdownToPlainText`).
- **Forest scale** (`srcjs/src/lib/layout/forest-scale.ts`) — the single source of truth for a forest column's x-scale, keyed by a `ForestScaleContext` (column + group + scaleType + domain + width). `buildForestScale` + the shared range/clamp helpers; the per-column `forestAxes` resolver (axis slice) retired the old global `xScale`. The `groupId` seam is what faceting extends.
- **Density** — spacing preset `compact` / `comfortable` / `spacious` (`srcjs/src/lib/theme/theme-adapter.ts::DENSITY_SPACING`, mirrored R-side `R/utils-theme-resolve.R::DENSITY_PRESETS` for parity) → `theme.spacing`. A continuous `densityFactor` (theme input, clamped [0.5, 2]) multiplies the preset (`scaleSpacing`). Per-row-kind height **overrides/pins** layer on top: `computeRowLayout`'s `rowKindHeights` map (set via `setRowKindHeight`, survives density/factor). The full per-kind cascade (theme/constructor/inheritance) is *designed not built* — `docs/dev/sizing-model.md` §8a.
- **Banding** — alternating-row background mode: `none` / `row` / `group` / `group-N` (`R/utils-banding.R`).
- **Wire version** — semver string at the top of every WebSpec. Major bumps are breaking; minor bumps are additive (`srcjs/src/spec/index.ts:22-91`, `R/wire-version.R`).

## Supported Runtimes

Designs must work across all of these, and prefer generic solutions to runtime-specific ones. If an optimization or feature only works in one runtime, it must be additive — never load-bearing for the others.

- **Interactive browser** — htmlwidget in HTML, RStudio viewer, standalone HTML.
- **V8 (R-side)** — server-side SVG/PNG export via the `V8` package; no DOM, no Canvas.
- **Static** — Quarto/RMarkdown knit output; widget JSON serialized at build time, rendered at view time.
- **Shiny** — server-driven reactivity; the widget receives updates from R and dispatches handlers back.

## Interactive Model

The widget supports interactive mutation of the underlying spec/data:

- Cell value edits (double-click)
- Row/cell token application via the paint tool (`emphasis`, `muted`, `accent`, `bold`, `fill`)
- Theme edits via the settings panel (Tier 1 inputs change → cascade re-resolves; user pins survive)
- Column reorder/resize, sort/filter, group collapse, pagination
- Details/disclosure panels (`toggleRowDetails`; `expanded_rows` syncs to Shiny)
- Per-row-kind height pins (`setRowKindHeight`; survives density). The interactive
  *affordance* (settings-panel control + drag handle) is designed not built — see the handoff.

Mutations must be efficient and granular — interactive edits should not require rebuilding bulk data structures.

## Package Status

- **Lifecycle stage**: Experimental (via `lifecycle::signal_stage()` in `.onLoad`).
- **Pre-release** — no backward-compatibility constraints on wire format, in-memory model, or API surface. Prefer clean breaks over compatibility shims.
- **Target**: CRAN submission for the R wrapper after stabilization.

## Frontend (TypeScript/Svelte)

### Location
Source in `srcjs/src/`; built output in `inst/htmlwidgets/`.

### Build targets
`cd srcjs && npm run build` produces all three runtime bundles (htmlwidget, split, V8). Individual targets in `srcjs/package.json` (`build:widget`, `build:split`, `build:v8`, `build:npm`).

### State management
Svelte 5 runes (`$state`, `$derived`, `$effect`, `$state.raw`, `untrack`). Stores live in `srcjs/src/stores/` as sliced state, composed in `forestStore.svelte.ts`.

**Critical rule — `spec` is `$state.raw`:** the root `spec` variable in `tabvizStore.svelte.ts` is held as `$state.raw<WebSpec | null>(null)`. That means **deep mutations are invisible to Svelte**. Writing `spec.theme.spacing.field = value` or `const t = spec.theme; t.field = value` will update the in-memory object but **will not trigger any re-render** — and you won't get a runtime error to tip you off.

The only ways to trigger reactivity on a spec change:
- Reassign the whole `spec` variable: `spec = { ...spec, X: ... }` (only inside the store).
- Call `deps.setSpec({...spec, ...})` from a slice (preferred).
- For nested theme paths use `writeThemePath(path, value)` in `slices/theme.svelte.ts` — it reconstructs `spec.theme` immutably and calls `setSpec`.

If you write a new mutation function on a slice, especially a `preview*` one called during pointer drag, **make sure it goes through `setSpec` or a helper that does**. This was the root cause of the 2026-05-25 "row resize doesn't preview during drag" regression (`previewThemeField` was directly mutating `spec.theme.spacing.field = v` — silently dead).

The drift gate `bun test src/export/svg-centering.test.ts` and the manual scrub of any new `preview*` / `setX` slice method are the only protections; there's no eslint rule for this yet.

### Formatting & measurement
`srcjs/src/lib/formatters.ts` and `srcjs/src/lib/width-utils.ts`. Must work in both browser (Canvas available) and V8 (no Canvas) — keep a pure-JS estimator path that does not depend on DOM APIs.

### Authoring API
`srcjs/src/authoring/` mirrors the R surface: `tabviz()`, `col_*` → `colText/colNumeric/vizForest/…`, modifiers. Parity notes in `docs/dev/r-ts-parity-notes.md`.

### Wire format
The JS spec is the wire format. `R/wire-version.R` + `srcjs/src/spec/index.ts` track the version; bump on shape changes (pre-release, no migration shims).

## R Wrapper Conventions

R code is a thin wrapper over the TS engine. Keep R idiomatic where it matters for R users, but resist building parallel logic that duplicates the TS package.

### Validation
Use `checkmate` for function argument validation:
```r
checkmate::assert_flag(show_legend)
checkmate::assert_number(decimals, lower = 0, upper = 10, null.ok = TRUE)
checkmate::assert_string(header, null.ok = TRUE)
checkmate::assert_choice(format, c("auto", "scientific", "decimal"))
```

### S7 classes
- Core authoring classes use S7 (`WebSpec`, `WebTheme`, `ColumnSpec`, `EffectSpec`, `GroupSpec`, `GroupSummary`, `SplitForest`, …).
- Use `@` for property access, not `$`.
- Validators go in the class definition, not external functions.
- S7 classes describe the **R authoring surface**; they serialize to the canonical JS spec shape.

### Error messages
Use `cli` for user-facing messages:
```r
cli::cli_abort("Column {.field {name}} not found in data")
cli::cli_warn("Using default theme because {.arg theme} is NULL")
```

### col_* helpers
Standard argument order: `field(s), header, width, type-specific params, ...`. All helpers delegate to `web_col()` (`R/classes-components.R:230`).

### API surface
Top-level `tabviz()` arguments are the preferred primary API; mirror on fluent modifiers as a secondary surface. Don't duplicate knobs that already belong to a contained object (themes, columns).

### NSE for column references
`R/utils-nse.R` resolves formula-based column references (`bold = ~is_significant`) to column names at spec construction time. Use the existing NSE helpers; don't roll your own quoting.

## Testing Instrumentation

### TS-side (`srcjs/`)
Inline `*.test.ts` next to source; `npm test` runs both bun and vitest.

**Runner split (load-bearing):** `*.test.ts` run under **bun**; `*.runes.ts` run under **vitest** (Svelte-compiler path, for rune state). `vitest.config.ts` `include` is `*.runes.ts` only — a plain `.vitest.ts` will be collected by *neither* runner and silently not run. **bun's runner can't resolve `@stdlib`** (pulled in by the real theme resolver via oklch), so a bun `.test.ts` that needs a resolved theme must either use a stub theme (see `sizing-fixtures.ts`) or move to a `.runes.ts` vitest file. Regenerate bun snapshots with `bun test <file> --update-snapshots`.

| Area | Location | Covers |
|---|---|---|
| Pure utilities | `src/lib/*.test.ts` | formatters, oklch, scale-utils, axis, text-wrap, theme-resolve, etc. |
| Spec validation | `src/spec/index.test.ts` | wire-spec shape |
| Store slices | `src/stores/**/*.test.ts` | events, column-id |
| JS authoring | `src/authoring/*.test.ts` | `tabviz`, `columns`, `modifiers` |
| htmlwidget bridge | `src/htmlwidgets/*.proxy.test.ts` | proxy contract |
| Sizing harness | `src/export/layout-metrics.test.ts` + `sizing-fixtures.ts` | box-model regression gate: snapshots `computeLayoutMetrics()` (per-row height/top/marker/kind/indent, per-column width+x, chrome dims, spacing-token echo) over a density/wrap/indent/spacer/group/overall/mixed fixture matrix + invariants. Locks geometry before/after sizing & row-kind refactors. Stub themes → runs under bun. Regenerate: `bun test src/export/layout-metrics.test.ts --update-snapshots`. Visual half: `debug-shapes.ts` (`renderDebugShapes`) draws the box model as labeled boxes; eyeball via R `render_debug_shapes(spec, "out.png")`. See `docs/dev/sizing-model.md` §6b and `srcjs/src/export/README.md` (indexes every export-side harness). |

Additional gates from `srcjs/`:
- `npm run check` — svelte-check type-check
- `npm run check:size` — bundle-size budget (`bundle-size-budget.json`)
- `npm run check:lockfiles` — npm + bun lockfile parity
- `npm run lint` — eslint (flat config, `eslint.config.js`). **Mixed baseline:** zero-violation bug-catcher rules are enforced as `error` (no-fallthrough, no-cond-assign, no-prototype-builtins, no-control-regex, + 4 TS rules); the rest are `warn` backlog (277 warnings after the first paydown — prefer-const 129, no-unused-vars 117, the rest small). Exits 0 today. `no-undef` off (TS handles it); `reportUnusedDisableDirectives` off (preserves intentional `no-console` guards in debug/bench). Chip warnings down, then promote those rules to `error`. Not yet a CI gate.
- `scripts/screenshot.js` — headless browser screenshot generator
- `scripts/dist-smoke.mjs` — smoke test for the published npm dist (runs in `build:npm`)
- `src/schema/columns/drift.test.ts` — CI drift gate. Every concrete-schema option must declare `consumedBy: string[]` listing the behaviors that read it (`"emitSource"`, `"sortKey"`, `"estimateWidth"`, `"formatValue"`, `"renderCell"`, `"contributeBanks"`, `"contributeConditions"`, `"aggregate"`, or `"editor"` for UI-only knobs). Options without a `consumedBy` annotation are grandfathered in a `KNOWN_UNCONSUMED` set; that list can only shrink. New options must annotate or explicitly grandfather (with a follow-up issue). The gate catches "added an option but nothing reads it" bugs.

### R-side (`tests/testthat/`)
testthat. Notable groups:
- `test-classes-*.R`, `test-theme-*.R` — class behavior + cascade resolution
- **`test-parity-columns.R`, `test-parity-themes.R`, `test-parity-split-shared.R`** — R↔TS parity, the critical guardrail for wrapper-over-runtime correctness. `test-parity-split-shared.R` (added Phase 3) locks the equivalence between R's `split_table()` shared-axis/widths output and TS's `computeSharedAxis`/`computeSharedWidths`.
- `test-theme-roster-sync.R` — guards the glyph/theme roster sync between R and TS
- `test-theme-css.R` — guards the `tabviz_theme_css()` R wrapper against the TS `getThemeCSS()` (R/TS via V8 produce identical output)
- `test-systemfonts-injection.R` — guards `.inject_systemfonts_widths()` (Phase 2.5 V8-export pixel-exact widths)
- `test-shiny-proxy.R`, `test-shiny-state.R` — Shiny integration
- `test-render-smoke.R`, `test-examples.R` — end-to-end smoke + gallery render
- `test-save-plot*.R`, `test-paginate.R`, `test-split_table.R` — pipeline-specific

Manual tests in `tests/manual/`; visual regression in `tests/visual/`.

### Visual regression
`tabviz::render_visual_tests()` renders example specs to PNG via the V8 + rsvg SVG export pipeline — same TS engine that drives the browser, executed in V8. Output in `tests/visual/output/` (gitignored). Review with the Read tool for clipping, alignment, theme styling, blank regions. Filter with `render_visual_tests("pattern")`.

### Performance bench harnesses

Three complementary benches measure different layers of the pipeline.
Run them when changing anything in the measurement, serialization, or
render path. All emit results to stdout; capture to a file with `>` for
before/after diffing.

| Harness | Location | What it measures | Run |
|---|---|---|---|
| **Bun (algorithmic)** | `srcjs/tests/perf/` | Cost of pure-JS algorithms (estimator, rank+top-K, theme resolve, formatters) over synthetic fixtures at 100→10k rows. No DOM, no Canvas; in-process Node. Captures algorithmic shape, not real-browser cost. | `cd srcjs && npm run bench` |
| **Puppeteer (real browser)** | `srcjs/tests/browser/` | Real Chromium mount: launches headless Chrome, injects any tabviz bundle (`--bundle <path>`). Two kinds: the **bench** (`run-bench.ts`, times `renderValue`) and **correctness tests** (`*.browser.ts`, assert DOM-measured behavior, exit non-zero on fail — for things headless bun/vitest can't check, e.g. `measure-rows.browser.ts` verifies the content-driven-height measure-then-commit loop grows rows + settles; `forest-marks.browser.ts` asserts forest mark x-positions match the canonical `plotRegion` scale (DOM↔export WYSIWYG); `details-panel.browser.ts` asserts details panels render markdown + toggle). Catches Canvas, DOM, layout cost. | `cd srcjs && npm run bench:browser` · `bun run tests/browser/measure-rows.browser.ts` |
| **R-side serialize** | `tests/perf/bench-r-serialize.R` | R-side stages: `split_table()` (incl. V8 round-trip for shared mode), `serialize_split_table()`, `toJSON`, `forest_plot_split()` factory, single-spec baseline. Real-world fixture: 1k rows / 10 subsets. | `Rscript tests/perf/bench-r-serialize.R` |

Each harness has its own README with run/diff instructions and known
floors. Baselines are checked in alongside the harnesses
(`baseline-prev.json`, `baseline-current.json`, `baseline.txt`) so a
change's perf impact can be audited from the commit alone.


## Building New Test Apparatus

Current instrumentation will not be sufficient as the package grows. **Tests and harnesses are both essential — and harnesses are often the bigger gap.**

The codebase already runs on more than unit tests: R↔TS parity tests, the V8+rsvg visual-regression pipeline, the bundle-size gate, the lockfile-parity gate, the roster-sync test, the npm dist-smoke check. These *harnesses* — instrumentation that captures behavior, compares against a baseline, and surfaces drift — catch the classes of bug that unit tests structurally cannot. Treat building new harnesses as first-class work, not as scaffolding around the "real" tests.

**Add unit tests aggressively** in the existing trees (`srcjs/src/**/*.test.ts`, `tests/testthat/test-*.R`). Don't invent a parallel test tree.

**Build new harnesses when the current ones don't cover a concern.** Examples of harnesses worth standing up if a gap appears:
- Fixture generators producing synthetic specs at chosen scales and shapes.
- Snapshot harnesses capturing wire JSON for regression.
- Session record/replay for mutation flows (paint, edit, sort, theme).
- Shiny harnesses with mocked sessions for state round-trips.

When you build a new harness, name it obviously, place it where future agents will find it, and add a one-line pointer under "Testing Instrumentation" in this file. A harness that no one else discovers is dead weight.

**Specific guardrails to extend, not bypass:**
- **R↔TS parity is precious.** Wire-shape changes or authoring-surface changes need parity-test coverage; roster additions need `test-theme-roster-sync.R` updates.
- **Visual regression needs both authoring paths.** As the JS authoring API matures, mirror R `inst/examples/` with TS-authoring examples under `srcjs/tests/visual/`.

A future agent must be able to discover and run any new test infrastructure without reading the conversation that created it.

## Workflow

### After Frontend Changes
1. `cd srcjs && npm run build`
2. `devtools::install(quick = TRUE)` — **skip if you've linked the dev bundle** (see below)
3. `tabviz::render_visual_tests()`
4. Review PNGs in `tests/visual/output/` with the Read tool
5. `cd srcjs && npm test` for TS unit tests

#### One-time setup: skip the install step

`node srcjs/scripts/link-htmlwidgets-dev.mjs` replaces the installed package's `htmlwidgets/` and `js/` directories with symlinks back to the source-tree `inst/htmlwidgets/` and `inst/js/`. After that, `npm run build` alone makes the new bundle visible to R — the ~15s `devtools::install` step drops out and the cycle becomes ~8s instead of ~25s. The script backs up the original dirs (`.preserved-<ts>`) and refuses to touch dirs outside known user libraries. Reverse with `--unlink` before publishing or rebuilding the actual package.

### After R-Wrapper Changes
- `devtools::test()` — unit tests
- `devtools::check()` — full R CMD check (before release)
- `cd docs && quarto render` — live R chunks catch JS regressions the SVG tests don't

## Documentation
- roxygen2 with markdown enabled for the R wrapper. Regenerate with
  `roxygen2::roxygenise()`; commit only your own `man/*.Rd` + NAMESPACE changes —
  the run also rewrites `.Rd`s for any in-flight `.R` docstring edits (others'
  work), which should NOT be bundled into an unrelated commit (`git checkout --`
  them).
- Design/architecture notes live in `docs/dev/*.md` (e.g. `sizing-model.md`,
  `row-types.md`, `r-ts-parity-notes.md`) — the durable cross-session trail.
  **Gotcha:** a bare `dev` scratch rule in `.gitignore` shadows `docs/dev/`, so
  **new** files there are silently ignored — `git add -f` them (existing tracked
  ones are unaffected). Verify with `git status` after adding.
- Examples should be runnable without external data when possible.
- Quarto site under `docs/` is the user-facing documentation; rebuild after each commit.

### Quarto iteration speed

Full-site `quarto render` is ~5 min (72 pages × ~4 s/page). The bottleneck is fundamental: 52 of 57 .qmd files have live R chunks, knitr forks a fresh R per file, and Quarto has no `--jobs` flag.

**Default iteration target: `docs/index.qmd` alone.** It's the hero example — a fully-loaded forest plot widget rendered via the same live R chunk path the rest of the site uses, and it picks up any JS bundle regression that would show up in the gallery. For UI/CSS work, `cd docs && quarto render index.qmd` (4–10 s) gives the regression-catching value of the full site at 1/30th the cost. Reach for the full-site render only at commit time or when changing something a single page wouldn't exercise (axis options, banding, group collapse, etc.).

Other faster paths:
- **Preview mode**: `cd docs && quarto preview index.qmd` — auto-reloads on save while you edit.
- **Single other page**: `cd docs && quarto render <path>.qmd` (4–10 s) for a specific feature area.
- **Parallel** via `xargs -n1 -P4` over the 52 R-chunk pages gave ~30% speedup in testing — not worth the complexity over single-page.

`freeze: auto` + `cache: true` (currently both off) would also speed full-site, BUT they defeat the purpose: the whole reason we rebuild after every commit is to re-execute R chunks against the **latest JS bundle**, which the freeze mechanism can't detect changing. Don't enable them without inventing a freeze-bust hook tied to bundle hash.
