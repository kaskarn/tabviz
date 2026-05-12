# Splitting the tabviz frontend into a standalone JS package

**Status:** Design draft, 2026-05-12
**Authors:** Antoine + Claude
**Scope:** Architecture, ontology, and implementation spec for extracting `srcjs/` into a versioned npm package consumed by the R `tabviz` package and at least one organizational web application.

---

## 0. Philosophical preface

This document is principally an engineering plan, but the technical decisions only make sense in light of what we think tabviz *is* and what it could become. So before any architecture, some honest thoughts.

### What tabviz actually is

Tables and charts are usually treated as separate genres. Tables are for lookup; charts are for pattern recognition. The textbook account says tables answer "what is the value of X for entity Y?" and charts answer "how does X vary across the population?" — and so they live in different parts of the document, the dashboard, the paper.

This account is wrong about how serious analytical work actually reads. In a regression table, in a CONSORT outcomes summary, in a meta-analysis forest plot, in an A/B test scorecard, in a NYT league table — the unit of analysis is the **row**, and the row participates in *both* lookup and comparison. The eye reads horizontally to gather a study's attributes (HR, 95% CI, sample size, weight, p-value) and reads vertically to compare across studies (which trial showed the biggest effect, which had the tightest CI, which dominated the pooled estimate). Forcing this work into a separate "table" and "chart" panel destroys one of the two reading axes. The forest plot was invented to keep both.

So the operational definition we should commit to: **a tabular visualization is a single object where rows index entities, columns project attributes, and one or more columns render their attribute as a mark on a domain shared across the column (not the row).** A table with sparklines isn't quite this — sparklines are per-row, internal-domain. A chart with row labels isn't this either — its positional axis is the chart's, not the column's. The tabular visualization commits to *column-scoped coordinate systems anchored to a shared row identity*. That is the genre.

This is why forest plots feel different from scatter plots, why regression tables feel different from coefficient charts, why the JAMA-style baseline table feels different from anything you can build in ggplot. The genre exists. It is undernamed because most tooling treats it as a special case of either tables or charts. tabviz is unusual in treating it as the default.

### Where tabviz sits in the lineage

The R ecosystem has several ancestors and cousins, each of which gets *part* of the problem right:

- **`gt`** is typographic-first. Cells can contain SVG, but the system reasons about text, footnotes, spanners, alignment. Charts in `gt` are guests.
- **`reactable`** is web-first and interactive, but it's a *table* — it gives you HTML cells and leaves the visualization to you. The mark vocabulary is your problem.
- **`forestplot` / `forester` / `forestploter`** are forest-specific and often rigid; you can render a forest, but you can't smoothly extend to multi-effect comparisons, distributions, or general dashboards.
- **`gtsummary`** is excellent for regression and baseline summaries but conceptualized around statistical workflows, not display semantics.
- **`ggdist` / `ggplot2`** is chart-first; the table is at best a faceting accident.

tabviz sits between `gt`'s typographic discipline and `reactable`'s interactivity, but with stronger opinions than either about *which marks belong in tabular contexts*: `forest`, `viz_bar`, `viz_boxplot`, `viz_violin`, `bar`, `sparkline`, `pictogram`, `ring`, `heatmap`, `stars`, `pvalue`, `interval`, `range`. This vocabulary is deliberate. It is the vocabulary of statistical and editorial communication, not the vocabulary of generic data viz. Naming the genre and curating its vocabulary is the package's strongest position.

### What the frontend has quietly become

The frontend started as an htmlwidgets renderer for an R package. It is no longer only that. Three signals:

1. **`svg-generator.ts` is a 5000-line pure renderer.** It takes a WebSpec JSON, optionally a precomputed layout, and returns a complete SVG. No Svelte, no DOM, no globals. The R package's V8 export path calls it directly. This is already a publishable library; it just happens to live in the same repo as everything else.
2. **The spec language is the actual product.** `WebSpec`, `ColumnSpec`, `WebTheme` are the load-bearing artifacts — once you have a well-typed spec, both the live widget and the headless renderer are mechanical. The interesting design work is in the schema, not the rendering.
3. **The component layer has grown into something with its own gravity.** A 1633-line column editor popover, a 717-line column type menu, a 737-line theme control, a 429-line theme switcher. These aren't htmlwidget glue. They are the beginnings of an authoring environment.

The frontend is now three things stacked together: a *pure renderer* (svg-generator and friends), a *spec language* (types + the implicit ontology), and a *Svelte authoring/interaction shell*. Treating these three as one is what makes `index.svelte.ts` a 512-line file that mixes htmlwidget binding, Shiny IO, proxy dispatch, and library exports. The split this document proposes is mostly a recognition that they are already three things.

### Why split now (and what could pull us in)

The triggering question is whether a non-R consumer — an organization's web application — should be able to render tabvizes with visual parity to R-rendered output. That alone justifies the work: shipping a versioned, documented JS package is the only honest way to deliver that guarantee. Anything else is a vendored snapshot that drifts.

But there are larger opportunities the split also opens up, and they're worth naming so we don't accidentally close them off in the technical design:

- **Editorial publishing.** Pair the spec with proper web font loading (the Cinzel/EB Garamond/etc. plan already in the theme roadmap) and you have a tool for explainer journalism. The NYT, Pew, and BBC visual desks are constantly building one-off tables that are really tabular visualizations. A JS-first package with a clean spec is the right shape for that audience.
- **Clinical and regulatory.** CONSORT/JAMA/Lancet have rigid layout expectations that the current theme system can already approximate. A versioned spec and reproducible headless rendering is what regulatory submission workflows want.
- **Embedded analytics.** The proximate use case — a web app that needs tabvizes inside it — generalizes. Once one organization integrates, others can.
- **An authoring environment.** The column editor popover is the seed of a real visual builder. A JS-native package makes it possible to ship that builder as a standalone tool, not buried in an R widget.

Each of these strengthens the case for treating the spec language as the primary artifact and the renderers (live + headless) as consumers of it. Each of these is also a temptation to overscope. The first split should ship a clean version of what exists; the opportunities are what justify the work, not what defines it.

### What we should resist — and what we deliberately do not

This document originally counseled against pre-split refactoring on the grounds that "the split should not become a refactor." On reflection that framing was too coarse. There are two kinds of complexity at play, and they behave differently across a publication boundary:

- **Structural debt** — the *shape* of the interface: untyped proxy dispatch, informal Shiny envelope, no typed event model, dual filter APIs, missing methods, unversioned wire format. This debt touches the public surface. Once published, it calcifies into the public contract; consumers depend on it; fixing later means breaking releases.
- **Size/clarity debt** — the *internals* of the implementation: a 4261-line store, a 3526-line top component, hardcoded theme presets, internal jargon. This debt does not touch the public surface — after the split, the public API wraps these internals and consumers never see them. But it does become harder to fix once the team grows risk-averse around a shipped surface, and it compounds quietly inside the codebase.

We have made the deliberate decision to **pay down all discernable technical debt before the split** — both categories, in that priority order. Structural debt because it locks in; size/clarity debt because deferring it under publication pressure tends to be deferral forever. The full inventory is in §2.6; the phased plan is in §4.

The discipline this requires is distinguishing **paydown** from **speculative abstraction**. Paydown means cleaning up what is already there — typing the existing wire envelope, decomposing the existing store, deleting confirmed-dead code. Speculative abstraction means designing for hypothetical future consumers — generalizing forest-specific fields, anticipating use cases no one has asked for. The first is discharge; the second is debt accumulation under a flattering name. Throughout this work we do the first and refuse the second.

There are **deliberate exceptions** to this rule. Each must clear a specific bar: *enabling a documented external consumer use case with no acceptable workaround*. v1 has two:

1. **Porting the Tier 1 → 2 → 3 theme resolver from R to JS** (§3.7, Phase 0c-C5). Without it, every web-app team that wants a custom brand theme must install R or hand-author resolved Tier 1+2+3 JSON. Cascade *plan* is locked (2026-04-29); we port against the locked plan, gated on the R-side implementation landing first.
2. **Adding a JS target to the View Source feature** (§3.11, Phase 0c-C12). The existing R-target emitter is unsuitable for npm consumers; reframing the serializer as multi-target (R + JS in v1, Python and others later) is a small extension over the existing implementation and gives both audiences a copy-paste reproducer in their own language. The JS target's emitted code uses the same `createTabviz` / `createTheme` API surface we're already publishing — sync risk is minimal.

Both are one-time porting/extension costs. **Neither is a precedent.** Future requests for "while we're shipping JS-facing functionality, why not also..." should still be refused unless they meet the same bar.

What we still refuse:

- **Lifting forest-specific fields out of shared types.** `sharedAxis`, `nullValue`, `ci_clip_factor`, summary diamonds — these are forest-specific but live on shared types. Cleaning them up is a *redesign* keyed to future consumer needs, not paydown of existing debt. Spec v2 territory; left alone.
- **Touching the aspect ladder algorithm.** We rename internal jargon and document the algorithm for clarity (that *is* paydown). We do not change behavior. The algorithm is load-bearing for visual parity with R-side export.
- **Adding programmatic theme features beyond the locked cascade plan.** v1 *does* ship `createTheme()` factories on both R and JS (stance revised — see §3.7) and ports the Tier 1 → 2 → 3 resolver as the one-exception-to-paydown above. What remains refused: web-font loading machinery, editorial typography knobs richer than the cascade plan covers, Tier 2/Tier 3 overrides foregrounded as primary API. Those wait for v2.
- **Anticipatory generalizations for the web-app consumer.** Until they tell us what they actually need, we ship what exists.

Three more notes worth surfacing because they shape decisions downstream rather than rule things in or out:

- **Forest plot biases run deep, and we keep them.** Many fields (`sharedAxis`, `nullValue`, `axisGridlines`, `ci_clip_factor`, summary diamonds) are forest-specific but live on shared types. Cleaning this up is a v2 spec question; doing it under split pressure produces a worse answer than doing it deliberately later. Document the asymmetry (G5); don't lift in v1.
- **The theme cascade rework is mid-flight — but its plan is locked.** The 2026-04-29 plan (primary + secondary + accent, two-tier mirror chain) is implementation-in-progress R-side. v1 ships `createTheme()` on both R and JS, designed against the locked plan and gated on R-side implementation landing first. See §3.7 and R3.
- **Versioning is implicit today.** With a second consumer this becomes a real problem fast. The plan below makes versioning explicit from day one of the split, even if migration logic isn't needed yet. Once two consumers exist, you cannot retrofit unversioned wire formats.

### One unresolved philosophical question

The current architecture says rows are atomic (`row.id` is the contract; everything else is overlay) and columns project views into a flat metadata dict. This is the right model for tables. But several features pull in the other direction: a forest column owns its axis (chart-like), `viz_*` columns carry effect arrays (multi-series, chart-like), the summary diamond is a different mark type living in the same column (compositional, chart-like). The library is half-table, half-chart, and the asymmetry is productive rather than incoherent — but worth naming, because the public API will have to commit to one stance per surface.

Our recommendation: **the public API commits to the table stance.** Rows are the primary axis of identity. Columns project. Marks live in columns. Where chart-like behavior is needed (shared axes across columns, multi-effect series), it appears as *options on a column*, not as a parallel object model. This is what we have today; we should formalize it as the package's stance rather than drift toward a more chart-y model under the pressure of new features.

With that framing, the rest of the document.

---

## 1. Ontology of the spec language

A tabviz spec is a description of a tabular visualization, not of a rendering. Renderers are downstream. This section names the commitments the spec makes — the implicit ontology that any v1 of the public API has to honor, and that any future v2 has to deliberately revise.

### 1.1 Rows are atomic, addressable, and stable

Every row has a unique string `id` that persists through sorts, filters, selections, and edits. Every styling overlay, every selection, every paint operation, every drag — all of it keys off `row.id`. The id is the contract: "this row remains this row." If the id changes, all overlay state is lost. Consumers must treat ids as stable across reloads if they want stable interactive state across reloads.

### 1.2 Data lives in a flat metadata dict; columns project views

Each row carries `metadata: Record<string, unknown>` — its full data payload, untyped at the schema level. Each `ColumnSpec` names a `field: string` that targets one key in that dict. The column does not own the data; it reads one projection. Multiple columns may project the same field — e.g., `col_numeric("hr")` and `col_bar("hr")` both render "hr" differently. Style mappings work the same way: `styleMapping.color = "highlight_col"` tells the painter "look up `row.metadata.highlight_col` to decide this cell's color."

This is a deliberate choice. It keeps the data model flat and the column model fat. Adding a new mark type means adding a column type, not extending the data schema.

### 1.3 Columns own their domain and rendering contract

A `forest` column owns its scale (linear/log), null value, axis range, tick positions, gridlines, and CI rendering rules. A `viz_bar` column owns its effect array and orientation. These are properties of the column, not of the theme or the row. The theme provides *color and spacing*; the column provides *semantics and interactivity*. This separation is what lets a single theme drive a wildly heterogeneous set of column types without per-column theme overrides.

### 1.4 Semantic tokens are orthogonal to data and decoupled from color

`emphasis`, `muted`, `accent`, `bold`, `fill` are *flags*, not colors. They can be set by data formulas (`row_emphasis = ~ pvalue < 0.05`), by the painter UI (click-to-paint), or by mapping columns. A row can carry multiple tokens; precedence resolves which one paints. Critically, a token has no intrinsic color — it reads from the theme's `row.<token>` bundle. Authors can rebrand "what emphasis means" by editing the theme, without touching any data or column configs.

This orthogonality is the single most important affordance of the spec language. It is what makes the same spec render coherently across the Cochrane, Lancet, JAMA, and editorial themes. Preserve it in the public API; do not let consumers couple semantics to color shortcuts.

### 1.5 Groups form a rooted forest, not a tree

Rows can belong to groups via `groupId`. Groups have `parentId` and `depth`. The structure is hierarchical (groups can nest), but a row belongs to exactly one group. Groups are collapsible. Critically, groups are a *structural overlay*, not a data transformation — collapsing a group does not aggregate its rows; it hides them.

### 1.6 Themes are a cascade from inputs to bindings

The theme system has three tiers (`R/classes-theme.R`):

- **Tier 1 — Inputs:** author-facing knobs (primary, secondary, accent, neutral ramp, font families, status colors, slot style, series anchors).
- **Tier 2 — Semantic roles:** derived from Tier 1 (surfaces, content levels, dividers, accent roles, text roles, status colors, series bundles, spacing tokens).
- **Tier 3 — Component bindings:** what concrete UI regions read (header cluster, row cluster, cell cluster, plot scaffold, marks recipes, annotation cluster).

Authors edit Tier 1; the resolver fills NA fields downstream. The cascade is opaque (OKLCH math, mixing rules) but stable. The current rework moves chrome texture from primary to secondary and treats accent as orthogonal (layered emphasis only — never default column ornament). The v1 public API ships `createTheme()` factories on both R and JS sides, designed against the locked cascade plan and gated on the R-side implementation landing first — see §3.7.

### 1.7 Pagination is precomputed R-side, not on the wire

`PaginationConfig` carries `pageLabel`, rows-per-page, break-on strategy, and a *precomputed* `pages` array of `(startIdx, endIdx)` ranges. The JS viewer never reflows; it renders the page range it's told to. This guarantees PDF export agrees with the live preview.

### 1.8 Interactivity is opt-in at the spec level

`InteractionSpec` has flags for sort, filter, collapse, edit, resize, themes. Authors choose what to expose. Disable all and you get a publication-ready static image. This is a *user-facing* opt-in, not a developer-facing one, and the public API should preserve it as a first-class field rather than reframing it as "options."

### 1.9 Versioning is implicit and permissive (today)

There is no `version` field on WebSpec. Old payloads still parse because the JS side treats every non-essential field as optional. R-side `lifecycle::deprecate_warn()` guides authors at the builder level. With a second consumer, this regime is no longer enough — see §3.4.

### 1.10 The four overlays

Putting it together: a tabviz spec is a **data lattice** (rows × fields) with four orthogonal overlays:

1. **Structural** — groups (rows within a spec) and panes (specs within a split, `SplitWebSpec` only — see §1.11)
2. **Styling** — row styles, semantic tokens, cell overrides
3. **Visual** — theme (Tier 1 → 2 → 3 cascade)
4. **Interactive** — sort, filter, selection, edit, resize (opt-in)

Each overlay is independent. Editing one does not leak into others. This is what enables fine-grained author control without combinatorial complexity. *The public API of the JS package should preserve this orthogonality on every surface.* Convenience APIs that collapse overlays into single calls are fine on top, but the underlying spec should remain four-axis.

The interactive overlay has a *seed*: `initialState` on the wire carries sort, filters, and hiddenColumns at mount time, applied before first paint so dashboards don't flash unsorted content (see `index.svelte.ts:283-304`). It is conceptually "the interactive overlay's initial values," not a fifth overlay — the same dimensions a live consumer can mutate, just initialized rather than blank. The public API exposes both surfaces (initial-at-mount and live mutation) on the same field names with the same shapes.

This section is the **ontology**, not the field reference. Several wire fields exist that aren't ontologically load-bearing (`watermark`/`watermarkColor`/`watermarkOpacity`, `originalCall` for R deparse debugging, `availableFields` for the editor's slot compatibility, `extraColumns` for hidden-by-default presets). They are documented in deliverable G5 (spec-fields reference); they are not commitments the public API should be designed around.

### 1.11 Split specs: the pane axis

A `SplitWebSpec` is a collection of `WebSpec` panes plus navigation/sidebar config. It **extends §1.10's structural overlay with a second partitioning axis**: panes partition specs within a split, where groups partition rows within a spec. Same overlay type, different scale. The ontological commitments specific to split specs:

- **Row-id uniqueness is per-pane, not global.** Each pane is its own WebSpec; row IDs need only be unique within their pane. Cross-pane row identity is not promised by the spec — if a consumer wants to "select the same study across two panes," that requires an explicit join key authored by the spec builder, not a tabviz-provided identity. This keeps each pane's interactive state independent and avoids accidental cross-coupling.
- **Theme cascades from split spec to panes.** The `SplitWebSpec` carries a top-level theme; individual panes inherit it but may override specific fields. The cascade follows the same Tier 1 → 2 → 3 model — a pane-level theme override populates only the fields it names, with the rest inherited from the split-level theme.
- **Pane addressability is a top-level axis.** Panes are keyed by `paneKey` (string); the split widget exposes `setActivePane(key)` and emits `paneChange` events. This is orthogonal to row IDs and field names — three independent addressing axes in a split spec (`paneKey`, `rowId`, `field`) versus two in a single spec.
- **Per-pane interactivity is independent unless explicitly mirrored.** Sort, filter, selection, paint state are pane-scoped. Authors who want mirrored state (e.g., synchronized sort across panes) must author a top-level interaction binding; the split widget does not synchronize by default. This keeps the four-overlays orthogonality consistent — panes are part of the structural overlay, not a data join.

Why this is the same overlay type as groups rather than a new kind of object: panes don't transform data (like grouping doesn't), they don't restyle (like the styling overlay does), and they don't theme (like the visual overlay does). They organize the data lattice into addressable chunks — the same job groups do, one level up. So §1.10's four overlays stay four; the structural overlay just has two partitioning axes available, one of which (panes) is only present when the top-level spec is a `SplitWebSpec`.

---

## 2. Current state inventory

This section names what exists, where the seams already are, and where the couplings live. It is the synthesis of four parallel codebase walks; file paths and line numbers are pointers, not exhaustive.

### 2.1 The three already-implicit layers

The frontend already separates into three layers cleanly, even though they share one build tree:

**Layer A — Pure renderer (publishable as-is).** ~6500 lines across:

- `srcjs/src/lib/svg-generator.ts` (5347 lines) — the headless SVG pipeline
- `srcjs/src/lib/scale-utils.ts`, `axis-utils.ts`, `typography-layout.ts`, `width-utils.ts`, `viz-utils.ts`, `formatters.ts`, `oklch.ts`, `banding.ts`, `semantic-styling.ts`, `marker-styling.ts`, `glyph-registry.ts`, `arrow-utils.ts`, `font-presets.ts`, `header-variant.ts`, `theme-source.ts`, `rendering-constants.ts`, `column-compat.ts` — pure utilities
- `srcjs/src/v8-entry.ts` (28 lines) — the thin JSON-in/JSON-out shim R's V8 calls

These have no Svelte runes, no DOM access (except a documented optional canvas path for text measurement), no globals. `svg-generator.ts` is the proof: V8 already calls it for visual tests with zero browser environment.

**Layer B — Spec language (types + schemas).** ~41K of TS types in `srcjs/src/types/index.ts` plus the parallel S7 class definitions in `R/classes-core.R`, `R/classes-theme.R`, `R/web_spec.R`. This is the wire contract. WebSpec, ColumnSpec (24 types, discriminated union), ColumnGroup, WebTheme (3-tier cascade), InteractionSpec, LayoutSpec, PaginationConfig, PlotLabels, GroupSpec, Row.

**Layer C — Svelte authoring/interaction shell.** Everything in `srcjs/src/components/` (70 files, ~15K lines) and `srcjs/src/stores/` (forestStore.svelte.ts at 4261 lines, splitForestStore at 466). Plus ForestPlot.svelte (3526 lines) and the entry files `index.svelte.ts`, `index-split.svelte.ts`. This layer is where Svelte 5 runes (`$state`, `$derived`, `$effect`) live, where the DOM is touched, where Shiny and HTMLWidgets globals are read.

### 2.2 The wire contract surface

The R↔JS coupling lives in four distinct places, each cleanly identifiable:

**(a) Initial spec serialization — R → JS.** `R/utils-serialize.R` (`serialize_spec()`, lines 9-37) converts S7 objects to the JSON-ready WebSpec the htmlwidget receives. Field renaming (snake → camel) happens *here*, not scattered. NA → null happens here. List-column unwrapping (sparkline `list(c(1,2,3))` → `[1,2,3]`) happens here. **This is the single normalization point for the outbound spec wire format.**

**(b) Proxy method dispatch — R → JS at runtime.** R calls `R/shiny.R::invoke_proxy_method()` (lines 74-81), which uses `session$sendCustomMessage("tabviz-proxy", ...)`. The JS handler is `srcjs/src/index.svelte.ts:26-232` — the `proxyMethods` table. 18 methods today: `sortBy`, `applyFilter`, `clearFilter`, `selectRows`, `toggleGroup`, `addColumn`, `hideColumn`, `moveColumn`, `setColumnWidth`, `updateColumn`, `setCell`, `setRowLabel`, `clearEdits`, `setRowSemantic`, `setCellSemantic`, `setTheme`, `setZoom`, `setAspectRatio`, `updateData`. **Each method is a thin coercion + dispatch into one store method.**

**(c) Shiny input bindings — JS → R.** `srcjs/src/index.svelte.ts:337-483`. 19 per-field emitters (`selected`, `hover`, `sort`, `filters`, `row_styles`, `cell_styles`, `paint_tool`, `collapsed_groups`, `hidden_columns`, `column_order`, `column_widths`, `cell_edits`, `label_edits`, `zoom`, `axis_zooms`, `banding`, `plot_width`, `visible_rows`) plus a 150ms-debounced `_state` aggregate bundle. Every emission uses a uniform envelope: `{ value, source: "user"|"proxy", ts }`. The `source` tag is what lets Shiny dashboards filter their own writes (`req(input$tbl_sort$source == "user")`).

**(d) V8 headless rendering — R → JS, synchronous, no browser.** `R/paginate.R::save_plot()` (lines 373-485) loads the V8 bundle from `srcjs/src/v8-entry.ts` and calls `generateSVG(specJson, options)` or `computeNaturalDimensions(specJson)`. Synchronous, no DOM, no runtime state. The output SVG is post-processed by R (fonts, scaling, conversion via rsvg).

**Coupling summary:** all four boundaries are localized. The wire contract is not scattered across the codebase. This is the single most important fact for the split — extraction is feasible because the coupling already runs through narrow seams.

### 2.3 What's surprisingly clean

- The three build targets (`vite.config.ts`, `vite.config.split.ts`, `vite.config.v8.ts`) already prove the layering works. The V8 build excludes Svelte entirely; the main and split builds share `svg-generator` across both live and export paths.
- The store exposes a coherent ~80-method public surface. The proxy table is a thin adapter over it.
- Forest plots and tabular cells share one rendering pipeline (svg-generator) and one layout pipeline (the "aspect ladder" in the store).
- Field renaming and NA handling are isolated in `R/utils-serialize.R`, not scattered across handlers.

### 2.4 The aspect ladder, briefly

Worth naming because it spans store + svg-generator. `forestStore.svelte.ts` ~lines 900-1200 computes layout from `targetAspect` and `targetAspectAnchor` via a sequence of "levers" (1A, 1B, 1C, 2C, etc.). The svg-generator accepts the precomputed layout to ensure live and exported renderings agree to the pixel. This is one of the more sophisticated pieces of the codebase and one of the most fragile to refactor. Paydown work renames the lever jargon and adds inline documentation; it does not change behavior. The public API exposes `targetAspect` and `targetAspectAnchor` as spec fields, full stop.

### 2.5 Discernable technical debt — full inventory

This is the complete list of debt items we have committed to paying down before the split. Each is categorized by type (structural / size-clarity / dead-code / docs) and tagged with a priority (P0 = blocks public API correctness; P1 = blocks publication safety; P2 = improves internal velocity). Items are addressed in the phased plan in §4.

#### Structural debt (interface shape — locks into the public API once shipped)

- **S1. Untyped proxy dispatch with per-handler coercion.** `srcjs/src/index.svelte.ts:26-232`. Every handler does `args.rowId as string`, `args.column as ColumnSpec`, etc. Coercion should happen *once*, at the wire boundary, with typed result. **P0.**
- **S2. Informal Shiny envelope contract.** `{ value, source, ts }` is used uniformly but has no TS type definition. `source: "user" | "proxy"` is convention. Type it as a first-class contract. **P0.**
- **S3. No typed event emitter on the store.** Today the Shiny output bindings emit per-field via `setInputValue("${id}_${field}", ...)` strings. There is no JS-internal event API; consumers can only listen via Shiny globals. Add a typed `instance.on(event, cb)` emitter, route Shiny bindings through it. **P0.**
- **S4. Dual filter API.** Store has both `setFilter(config)` (legacy single-field) and `setColumnFilter(field, filter)` (multi-column). Proxy handler at `index.svelte.ts:38-51` branches on shape inference (`"kind" in f`). Consolidate to one typed API; remove the inference. **P0.**
- **S5. Missing `clearSemantic` / `clearCellSemantic` methods.** `index.svelte.ts:171-176` and `:184-191` manually iterate over `["bold", "emphasis", "muted", "accent", "fill"]` to clear all tokens. Should be one store method. **P0.**
- **S6. Unversioned WebSpec.** No `version` field on the wire. With a second consumer this becomes a real problem fast. Add `version: "1"` field; validate on ingest. **P0.**
- **S7. Wire-format renaming partially scattered.** Mostly localized in `R/utils-serialize.R`, but `index.svelte.ts:111` still translates `header_align` → `headerAlign` in the `updateColumn` proxy handler. Move the last stragglers into the single normalization point. **P0.**
- **S8. `setTheme` accepts name-or-object via inference.** Proxy at `index.svelte.ts:195-202` accepts `args.name` (string) but the comment notes "Full WebTheme payloads are not yet applied runtime-side; silently accept so the proxy call doesn't error." Tighten: either accept both with explicit discrimination, or split into two methods. **P0.**
- **S9. `setAspectRatio` accepts NA/null/non-finite/<=0 as "clear" via inference.** `index.svelte.ts:218-224`. Make the contract explicit: `setAspectRatio({ ratio: null })` clears; non-null finite positive pins. **P1.**
- **S10. Window globals leak from core.** `__tabvizExports`, `__tabvizStoreRegistry`, `HTMLWidgets.widget`, `Shiny.addCustomMessageHandler` all in core. Globals are an adapter concern. Move them to the htmlwidgets adapter layer in-place. **P1.**
- **S11. Updates pass through `proxyMethods.updateColumn` with imperative merge logic in JS.** `index.svelte.ts:93-119` reads current spec, merges named fields by hand, distinguishes top-level vs options. This belongs in a typed `instance.updateColumn(id, patch)` method, not in dispatch glue. **P0.**
- **S12. `moveColumn` / `moveRow` have parallel before/newIndex inference.** `index.svelte.ts:73-87, :126-140`. Pick one positional model; remove inference. **P1.**
- **S13. `TABVIZ_STATE_FIELDS` is a hand-mirrored R-side fan-out of the JS field list.** `R/shiny.R:100` hardcodes every emission field name the widget produces; used by `tabviz_state()` and `tabviz_state_envelope()`. The JS-side typed event emitter (S3) and this R constant must stay in sync. Decide a sync mechanism: generate the R constant from the TS event type list at build time, or pin via a doc-tested mirror with a check that fails CI on drift. **P0** (shipping the typed event API without solving this guarantees drift).
- **S14. The split widget has its own parallel proxy / state / spec surface that is structurally identical but textually duplicated.** `R/shiny.R::split_tabviz_proxy`, `tabviz-split-proxy` channel, `index-split.svelte.ts`, `splitForestStore.svelte.ts`. Same typed-dispatch + typed-events refactor needed (S1-S12 applied to the split widget). Address in Phase 0a alongside the single widget; share the normalization layer. **P0.**
- **S15. "View Source" embeds R-API knowledge in TS source-serializer files with no automated drift guard, and is single-target by construction.** `theme-source.ts` (121 lines) generates R `web_theme(...)` strings; `SourceModal.svelte` (372 lines) embeds further R-code-gen inline; `op-recorder.ts` (271 lines) carries the action log feeding both. Three problems: (a) R-API signatures (function names, argument names, helper calls) are duplicated in TS templates with no test that the emitted code runs; (b) the serializer hardcodes R as the output language, so adding a JS target requires structural rework, not a flag; (c) the recorder and serializer are colocated in ways that conflate "action history" (generic) with "reproducing code" (target-specific). Refactor to a multi-target architecture (target registry + per-target serializer modules), separating op-recording from source emission. Live-widget-only concern (V8 bundle doesn't include it; static contexts unaffected). **P1** (publication-safety — without a JS target, npm consumers cannot copy-paste a reproducer in their own language).

#### Size/clarity debt (internal — does not lock in, but compounds quietly)

- **C1. `forestStore.svelte.ts` (4261 lines, ~80 public methods).** Methods are well-shaped; size reflects feature breadth. Decompose along domain seams: data ingestion, sort/filter, columns, rows/groups, cells, semantics/paint, layout/zoom/aspect, axis-zoom, edits/history, ui-state. Target: 8-12 files, each <600 lines, all re-exported through a single `createForestStore()` factory that returns the same combined surface. **P2.**
- **C2. `ForestPlot.svelte` (3526 lines).** Top-level orchestrator does too much. Decompose into: header, table body, plot body, controls, overlays, scaffolding. Internal Svelte component split; no public API impact. **P2.**
- **C3. `ColumnEditorPopover.svelte` (1633 lines).** Type selection, option editing, preview — three concerns in one component. Split into TypePicker + OptionsEditor + Preview. **P2.**
- **C4. `ColumnTypeMenu.svelte` (717 lines)**, **`ThemeControl.svelte` (737 lines)**, **`ZoomControls.svelte` (617 lines)**, **`SettingsPanel.svelte` (399 lines) + 13 V2 control subcomponents.** Audit each for internal coherence; split where one component owns multiple concerns. **P2.**
- **C5. Hardcoded `theme-presets.ts` (586 lines, ~30 themes as TS literal) + JS resolver port.** Replace with R-authored canonical presets serialized at build time to `srcjs/src/themes/presets.json`; JS loads as data. Add a typed loader and the JS resolver port (see §3.7). Themes become data; the resolver is the algorithm. **P1** (publication-safety — without the JS resolver, every web-app team that wants a custom brand has to install R or hand-author resolved Tier 1+2+3 JSON). Gated on cascade-rework implementation landing R-side first; if the gate slips past Phase 3, C5 defers to v1.1 and v1.0 ships with bundled-preset themes only (see §4 timeline footnote).
- **C6. `rendering-constants.ts` (392 lines, all numeric).** Some are CSS-shaped (spacing, padding, opacities); migrate those to CSS custom properties driven by theme tokens. Constants that are layout-algorithm-internal (svg-generator math) stay as TS. **P2.**
- **C7. Aspect ladder lever naming.** "Lever 1A," "Lever 1B," "Phase 7E" — internal jargon undocumented outside commit messages. Rename in source (descriptive names: `forestAbsorb`, `nonForestScale`, `layoutOverflow`); add a doc comment at the top of the algorithm explaining the model. Behavior unchanged. **P2.**
- **C8. `width-utils.ts` dual measurement paths.** Canvas measurement + character-class estimation fallback. The fallback is rarely exercised in browser; complexity may be overkill given the V8 path uses estimation exclusively. Audit usage; simplify if the live widget can always use canvas. **P2.**
- **C9. `svg-generator.ts` (5347 lines).** This is the pure renderer; size comes from per-column-type render functions. Reasonable as-is. Split candidate is per-column-type files (`render-forest.ts`, `render-bar.ts`, etc.) but only if the seams come out cleanly. Audit first; refactor only if it clarifies. **P2 (audit-then-decide).**
- **C10. Split widget shell sizing.** `SplitForestPlot.svelte`, `components/split/SplitSidebar.svelte` (~387 lines), `splitForestStore.svelte.ts` (466 lines). The split shell is smaller than the main widget but still benefits from the same decomposition discipline if its internals are tangled. Audit alongside C2/C3; split where the seams justify it. **P2.**
- **C11. `column-compat.ts` purpose clarification.** Despite the filename, this is not a back-compat shim — it's the **visual-type registry** used by `ColumnEditorPopover` for slot compatibility (which field categories a given column type accepts). 350 lines of declarative metadata. Stays with the Svelte shell (it's editor-specific); rename to `column-types-registry.ts` to stop misleading readers. **P2** (rename + relocate; no behavior change).
- **C12. View Source: refactor to multi-target architecture + ship JS target.** Per S15 and §3.11. Extract a `SourceTarget` interface (`{ id: string; label: string; serialize(state: TabvizState): string }`). Re-implement the current R-code-gen as the `"r"` target. Add the `"js"` target — emits `createTabviz(...)` / `createTheme(...)` calls against the v1 public API. Rebuild `SourceModal.svelte` as a tabbed UI with one tab per registered target. Separate op-recorder (generic action log; stays as today) from source serializer (target-specific). **Dependencies:** the JS target depends on the public `createTabviz` / `createTheme` signatures being stable, which means C12's JS-target portion lands after Phase 0c-C5 (`createTheme` ships) and after Phase 1 (`createTabviz` factory extracted). The R-target refactor and the target-registry interface can land earlier in Phase 0c. **P2** for the refactor; the JS-target addition is the deliberate exception per §0.

#### Dead / redundant code (low risk, clears the path)

- **D1. `setContinuousMode` / continuous mode theme setting.** No UI binding found. Verify unused; remove. **P1.**
- **D2. `previewColumnWidth()` / `previewLabel()`.** Preview methods write ephemeral state but components don't visibly render previews. Verify; remove if unused or document and finish if half-done. **P1.**
- **D3. Legacy `setFilter()` (single-field).** Superseded by `setColumnFilter()`. Remove after S4 consolidation. **P1.**
- **D4. Unused store getters / methods.** Audit the ~80-method surface for unused entries (grep callers); remove confirmed orphans. **P2.**
- **D5. Dev/test window globals if unused.** `__tabvizExports` and `__tabvizStoreRegistry` are documented as dev aids; verify which tests still depend on them; gate behind a build flag or remove. **P1.**

#### Documentation / contract debt

- **G1. No JSON Schema for WebSpec.** Publish a machine-readable schema for v1; consumers can validate offline. **P1.**
- **G2. No documented event contract.** The Shiny output bindings have implicit field names and payload shapes. Document them as TS types and a markdown reference, even before publishing. **P1.**
- **G3. Source-tag semantics undocumented.** `{ source: "user" | "proxy" }` envelope is the basis of feedback-loop prevention in dashboards but has no written contract. Type and document. **P1.**
- **G4. Internal "lever" terminology.** See C7. **P2.**
- **G5. No documentation of forest-specific vs general fields.** Authors and future consumers cannot tell which fields are reusable across column types. Annotate in TS types and produce a reference table. **P2.**
- **G6. Synchronization audit — every place an R-side constant mirrors a JS-side definition.** `TABVIZ_STATE_FIELDS` (S13), `tabviz-proxy` method-names list (R-side vs `proxyMethods` table), theme preset names (post-C5), column-compat field maps, **and the View Source target emitters (R and JS, per S15/C12)**. For each, decide and document: generate, doc-test, or accept manual sync. The View Source targets specifically need round-trip doc-tests: (a) R-target — emit code from a known WebSpec, eval in R, assert reconstructed spec equals input; (b) JS-target — emit code from a known WebSpec, import + run, assert resulting state equals input. Both run in CI. Output is `docs/dev/r-js-sync-points.md`. Executed in §4 Phase 0e (running parallel with Phase 0d). **P1.**

#### Out of scope (deliberately not paid down)

- Lifting forest-specific fields out of shared types into a forest-only sub-namespace. Redesign, not paydown.
- **Programmatic theme features beyond the locked cascade plan.** v1 *does* ship `createTheme()` factories on both R and JS sides (the one §0 exception to paydown-only discipline, justified in §3.7). What remains out of scope: web-font loading machinery, editorial typography knobs richer than the cascade plan covers, Tier 2/Tier 3 overrides foregrounded as primary API. Those wait for v2.
- Splitting `svg-generator.ts` by column type unless audit reveals clean seams. Audit-then-decide.
- Any new feature work, control flow generalization, or anticipatory abstraction.

**Total debt items: 15 structural (S1-S15), 12 size-clarity (C1-C12), 5 dead-code (D1-D5), 6 documentation (G1-G6). Estimated paydown effort: see §4.**

---

## 3. Target architecture

The proposal is to split the frontend into a versioned npm package, `@tabviz/core` (working name), which the R package consumes as a built artifact and which a second web-app consumer can depend on directly.

### 3.1 Package shape

```
@tabviz/core
├── /                → vanilla JS factory API + types + headless export
│                      (the "framework-free" surface; the web-app
│                      consumer likely lives here unless they use Svelte)
│                      exports: createTabviz, createSplitTabviz, createTheme,
│                      types, instance/event/state types
├── /svelte          → Svelte 5 component exports for direct composition:
│                      <ForestPlot store={...} />, <SplitForestPlot ... />,
│                      createForestStore, createSplitForestStore
├── /export          → headless rendering: exportToSVG, exportToPNG,
│                      computeNaturalDimensions. Pure functions; work in
│                      browser, Node, or V8.
├── /spec            → JSON Schema files for WebSpec / SplitWebSpec /
│                      ColumnSpec / WebTheme; machine-readable validators
└── /htmlwidgets     → R adapter glue: BOTH htmlwidget bindings (tabviz
                       and tabviz_split) + Shiny bridges. The R package's
                       only entry point; nothing else imports from here.
```

Five subpath exports, one package, single repo, single version. The split is *publication topology*, not source topology.

**Three build artifacts** (preserving today's topology with the split widget as first-class):

| Build entry | Output | Consumer |
|---|---|---|
| `htmlwidgets/index.ts` | `inst/htmlwidgets/tabviz.js` | R htmlwidget binding (single) |
| `htmlwidgets/index-split.ts` | `inst/htmlwidgets/tabviz_split.js` | R htmlwidget binding (split) |
| `export/v8-entry.ts` | `inst/js/svg-generator.js` | R V8 export pipeline |

The V8 bundle remains in `inst/js/` (where R's `save_plot()` expects it), not `inst/htmlwidgets/`. The npm package additionally exports `createTabviz`, `createSplitTabviz`, the Svelte components, and the export functions through the subpath exports above — those are the artifacts the web-app consumer reaches for. The htmlwidgets bundles are the artifacts the R package vendors into `inst/`.

**On the split widget.** `tabviz_split` is a first-class member of the genre, not an R-workflow quirk — split views let authors parse complex datasets (subgroup drill-down, hierarchical comparison) without flattening into one giant table. The web-app consumer will want them too. v1 of the package ships `createSplitTabviz()` as a peer of `createTabviz()` with its own typed spec (`SplitWebSpec` — a collection of `WebSpec` panes plus navigation/sidebar config, mirroring `R/split_table.R`). Both factories share the same instance event/method shapes where they overlap.

### 3.2 The public JS API

The package's primary user-facing artifacts are two factories that create instances — one for single widgets, one for split widgets:

```ts
import { createTabviz, createSplitTabviz } from "@tabviz/core";

const instance = createTabviz(element, spec, options?);
const splitInstance = createSplitTabviz(element, splitSpec, options?);

// Imperative API — typed methods, no string dispatch (shared shape)
instance.update(newSpec);
instance.sortBy({ column: "hr", direction: "asc" });
instance.applyFilter({ field, filter });          // ColumnFilter shape
instance.clearFilter();
instance.selectRows(ids);
instance.setSemantic({ rowId, token });            // null token → clear all
instance.setCellSemantic({ rowId, field, token });
instance.setTheme(themeOrName);                    // resolved on ingest
instance.setZoom({ zoom, autoFit, maxWidth, maxHeight });
instance.setAspectRatio({ ratio, anchor });        // ratio=null clears
// ... one method per proxy verb, same payload shapes

// Typed events — replaces Shiny per-field setInputValue
instance.on("change", (state: TabvizState) => { ... });   // debounced bundle
instance.on("sort", (sort) => { ... });
instance.on("filter", (filters) => { ... });
instance.on("select", (ids) => { ... });
// ... one event per Shiny field emitted today

instance.destroy();
```

`createSplitTabviz()` returns an instance with the same event/method shapes plus a small additional surface: `instance.setActivePane(key)`, `instance.on("paneChange", ...)`, etc. The two share enough that a wrapper around both is feasible if a consumer wants framework-agnostic composition; v1 does not ship that wrapper but does not foreclose it.

Notes on shape:

1. **Method names match proxy verbs, with R-isms removed.** Coercion (`as string`, NA → null) lives in one normalization layer in the htmlwidgets adapter (§3.5); the instance API speaks camelCase and typed args throughout.
2. **Events fire with full typed payloads, not field strings.** The current Shiny code emits each field individually via `setInputValue("${id}_${field}", ...)`. The public API emits typed events; the Shiny adapter maps events back to per-field `setInputValue` calls with the same envelope.
3. **The instance owns state. Consumers subscribe.** The current model — store-owned truth, observers via $effect — is preserved. A controlled-component mode (consumer owns state) is *not* in v1. Defer until asked.
4. **No globals in core.** `window.__tabvizExports`, `window.__tabvizStoreRegistry`, `window.HTMLWidgets.widget()`, `window.Shiny.addCustomMessageHandler()` all live exclusively in the htmlwidgets adapter after the split.
5. **No framework assumptions on the main entry.** The vanilla factories work in any TS/JS environment. The `/svelte` subpath is for consumers who want to compose the Svelte components directly.

### 3.3 The Svelte component subpath

For consumers building Svelte apps directly:

```svelte
<script>
  import { ForestPlot, createForestStore } from "@tabviz/core/svelte";

  const store = createForestStore();
  $effect(() => store.setSpec(spec));
</script>

<ForestPlot {store} />
```

This is the existing setup, just exported. It is the path the htmlwidgets adapter uses internally (the adapter is also a Svelte consumer).

### 3.4 Spec versioning

Effective immediately upon the split, WebSpec gets an explicit `version` field at the top level:

```ts
type WebSpec = {
  version: "1.0";   // semver string; pre-release follows §3.4 rules
  data: WebData;
  columns: ColumnDef[];
  // ... rest unchanged
};
```

**Pre-release stance.** Until we publish the first stable major (i.e., 1.0.0 as a public release with active external consumers at Phase 3), we are in the "everybody relax" zone: we may evolve the wire format freely between releases, including breaking changes, with no migration handlers expected. The version field is still emitted and validated — that's load-bearing infrastructure that needs to be present on day one — but the *policy* around bumps is informal until we have downstream consumers locked in.

Note on the version string itself: during pre-release we emit `"1.0"` for simplicity (the schema file is `v1.0.json`), but **stability is declared at Phase 3 publish, not by the version string**. A reader seeing `"1.0"` in the wire format during Phase 0 should treat it as "the shape we expect 1.0 to settle to," not "this is the stable contract you can pin against." The published `@tabviz/core@1.0.0` is the stability declaration; everything before that is provisional even when the wire emits the same string. (Alternatives considered: emitting `"1.0-pre"` during pre-release, or carrying a `stable: false` flag adjacent. Both were rejected as bookkeeping noise — the publish event is the unambiguous signal.)

**Steady-state versioning rules (post-pre-release):**

- **R side emits `version` on every spec.** `R/utils-serialize.R` writes it unconditionally.
- **Major bumps are breaking and accompanied by a migration handler.** v2 ingest can detect a v1 payload and either upcast or refuse with a clear message.
- **Minor bumps are strictly additive.** New fields ship as minor bumps (1.0 → 1.1). Older readers must ignore unknown fields. To make this safe, the JSON Schema for v1 is published with `additionalProperties: true` (or per-object equivalents), and v1.x readers explicitly skip-without-error any field they don't recognize. This is the *contract* that makes minor bumps work; without it, "minor = additive" is wishful thinking.
- **Patch bumps are documentation/internal only.** No wire-format change.
- **The `/spec` subpath publishes JSON Schema per minor.** v1.0, v1.1, ... Consumers pick one and validate against it.

**Validation symmetry vs. polish asymmetry.** Validation is *symmetric* — the same ingest layer runs in both the R-bundled htmlwidget path and the external web-app consumer path. Code complexity stays low. What is *asymmetric* is the polish: rich migration handlers, helpful error messages, fallback paths, version-skew telemetry — that work concentrates on the external consumer path, because that's where lockstep doesn't protect you. The htmlwidget path's version check is a near-trivial equality assertion; the external path's version check is a real consumer-facing diagnostic. Same code, different investment.

**R-side validation also has a job.** Even though R+JS are lockstep in the htmlwidget case, `R/utils-serialize.R` benefits from validating its own output against the published schema before sending — catches builder-side bugs at their source rather than at the widget. Worth wiring up via `jsonvalidate` once the schema is stable (Phase 0d-G1).

Once we have external consumers, you cannot retrofit explicit versioning. The field and the validation scaffold go in on day one; the policy hardens when the first external consumer ships.

### 3.5 The R adapter (`/htmlwidgets` subpath)

The R adapter is the *only* part of the package that knows R, htmlwidgets, or Shiny exist. It does three things:

**(a) Registers the htmlwidget binding.**

```ts
import { createTabviz } from "@tabviz/core";

HTMLWidgets.widget({
  name: "tabviz",
  type: "output",
  factory: (el, width, height) => {
    let instance: TabvizInstance | null = null;
    return {
      renderValue: (raw) => {
        if (!instance) instance = createTabviz(el, raw, { width, height });
        else instance.update(raw);
        if (window.Shiny && el.id) bindShiny(el.id, instance);
      },
      resize: (w, h) => instance?.setDimensions(w, h),
    };
  },
});
```

**(b) Receives Shiny custom messages and translates to instance method calls.**

```ts
window.Shiny?.addCustomMessageHandler("tabviz-proxy", (msg) => {
  const instance = registry.get(msg.id);
  if (!instance) return;
  // Coerce R-isms here, not in the core. NA → null is already done R-side.
  switch (msg.method) {
    case "sortBy": return instance.sortBy(msg.args);
    case "applyFilter": return instance.applyFilter(msg.args);
    // ... 18 cases
  }
});
```

**(c) Subscribes to instance events and forwards to Shiny.**

```ts
function bindShiny(id: string, instance: TabvizInstance) {
  instance.on("sort", (sort) => emit(id, "sort", sort));
  instance.on("filter", (filters) => emit(id, "filters", filters));
  instance.on("change", (bundle) => emit(id, "state", bundle));   // debounced
  // ... 19 event subscriptions
}

function emit(id: string, field: string, value: unknown) {
  window.Shiny.setInputValue(
    `${id}_${field}`,
    { value, source: getSource(field), ts: Date.now() },
    { priority: "event" }
  );
}
```

The `source: "user" | "proxy"` envelope is preserved exactly. The debouncing for the `_state` aggregate is preserved exactly. The point is the *adapter file is ~150 lines*, not the ~480 lines it is today inside the core.

### 3.6 The headless export subpath

The pure-function rendering pipeline (`exportToSVG`, `exportToPNG`, `computeNaturalDimensions`) lives in `srcjs/src/lib/export.ts` and `svg-generator.ts` today. The split promotes them to a dedicated subpath:

```ts
import {
  exportToSVG,
  exportToPNG,
  computeNaturalDimensions,
} from "@tabviz/core/export";

const svg: string = exportToSVG(spec, { width, height, precomputedLayout? });
const png: Blob = await exportToPNG(spec, { width, height, scale: 2 });
const { width, height, aspect } = computeNaturalDimensions(spec);
```

`computeNaturalDimensions` is what R's `save_plot()` pipeline calls to derive width/height before invoking `exportToSVG` — exposing it publicly lets web-app consumers do the same auto-sizing logic without reverse-engineering the layout algorithm.

The V8 entry (`v8-entry.ts`) is a thin shim that re-exposes these to the V8 global scope for R's `inst/js/svg-generator.js` bundle. After the split it imports from the package's own export module rather than reaching into `lib/`.

### 3.7 Theming in v1

Earlier drafts of this document deferred a JS-side programmatic theme API to v2, on the grounds that the cascade rework was in flight. Revisiting: the *plan* is locked (per `project_theme_cascade_rework.md`, locked 2026-04-29). The *implementation* is in progress, but we can design against the locked plan and ship the API concurrent with the implementation landing. Coupling the npm package's themes to R-availability-at-build-time would force every web-app team that wants a custom brand theme to install R or hand-author resolved Tier 1+2+3 JSON. Neither is acceptable.

**v1 theme stance (revised):**

- **Presets ship JS-side as data (JSON), authored canonically R-side.** `R/themes.R`, `R/themes-lotr.R`, etc. continue to be the source of truth for what "lancet" or "cochrane" means. At build time, the R-side preset list is serialized to JSON and shipped as part of `@tabviz/core` under `themes/presets.json`. The JS bundle reads them as data, not code.
- **The resolver (Tier 1 → Tier 2 → Tier 3) ports to JS.** Same algorithm both sides, designed against the locked cascade plan: OKLCH derivations, mixing rules, status colors, mark recipes. The resolver lives in `@tabviz/core` at `srcjs/src/lib/theme-resolver.ts` (port) and `R/utils-theme-resolver.R` (current). Both honor the same locked plan; either can produce a fully-resolved `WebTheme` from Tier 1 inputs.
- **Theme factories on both sides.** R-side: `tabviz::web_theme(primary = "#0891b2", secondary = "...", ...)` (today's API, adapted to the locked cascade). JS-side: `createTheme({ primary: "#0891b2", secondary: "...", ... })` returning a fully-resolved `WebTheme`. Same Tier 1 input contract; same output shape.
- **Wire format is the resolved theme.** Whether R or JS authored it, what crosses the wire is a fully-resolved `WebTheme` (all three tiers populated). The renderer doesn't need to know which side authored it. Authors can also pass `themeName: "lancet"` as a shortcut — the ingest layer resolves the name to the bundled preset.
- **Tier 2 / Tier 3 overrides are allowed but discouraged.** The factory's Tier 1 input is the primary affordance. Overrides (e.g., "use this primary but override the header-cluster background specifically") are an escape hatch, accepted via an `overrides: {...}` field on `createTheme`. Documented as power-user; not foregrounded.

**What v1 still doesn't do:** anything not in the locked cascade plan. Editorial-theme web-font wiring is its own roadmap item (`project_editorial_themes.md`); v1 ships the resolver and factories but does not include web-font loading or font-family customization beyond what the cascade plan covers. Tier 1 → Tier 2 → Tier 3 derivation is the contract; ornament/typography richer than that is v2 territory.

**What this changes from earlier drafts.** The "no programmatic theme API in v1" stance was too restrictive. The cascade plan is locked; designing against it is safe. Shipping the resolver in JS is a one-time porting cost that unblocks the web-app consumer permanently. The risk this introduces (R3 in §5.2) is recharacterized: the regret would be shipping a v1 factory API that the cascade-rework-implementation lands differently from. Mitigation: implement Phase 0c-C5 (preset migration + JS resolver port) *after* the cascade-rework implementation lands R-side, so both sides ship together against the same locked plan.

### 3.8 What gets cleaner inside the codebase

Even before any second consumer exists, the split forces these clarifications:

1. **`index.svelte.ts` shrinks from 512 lines to ~50** (just the public exports and Svelte component re-exports). Everything else moves to its appropriate adapter.
2. **The proxy dispatch table becomes a typed switch ~50 lines** in the htmlwidgets adapter. Today's per-handler coercion (`args.rowId as string`) becomes a single normalization step at the wire boundary.
3. **The Shiny event-emit block becomes ~80 lines in the htmlwidgets adapter**, subscribing to ~20 typed events from the instance. Today's ~150 lines of `$effect(() => emit("foo", store.bar))` are gone — the instance owns its own emission via the event API.
4. **`setRowSemantic` / `setCellSemantic` get a `clearSemantic(rowId)` and `clearCellSemantic(rowId, field)` method on the instance**, eliminating the manual loop over `["bold", "emphasis", "muted", "accent", "fill"]` in two places.
5. **The filter API consolidates** to a single typed surface, eliminating the legacy/new branch in the dispatch.
6. **Spec versioning becomes load-bearing**, with R and JS agreeing on a wire version.

These are gains regardless of whether the second consumer ever ships. They are the reason this is worth doing even before the web-app team is committed.

### 3.9 What stays the same

Explicitly *not* changing — behavior or external contracts:

- **The store's public surface and method signatures.** The internal file layout decomposes in Phase 0c (C1 in §2.5), but every method name, signature, and behavior is preserved. Consumers (instance API, components, R adapter) see no change.
- **The svg-generator pipeline.** Pure today, pure tomorrow. May internally decompose per §2.5-C9 if the audit reveals clean seams; no behavior change.
- **The V8 export contract.** `generateSVG(specJson, options)` and `computeNaturalDimensions(specJson)` remain V8-global-scope-callable from R. Build output path stays `inst/js/svg-generator.js`.
- **The aspect ladder algorithm.** Lever jargon renames (C7); algorithm unchanged.
- **The Shiny envelope `{ value, source, ts }`.** Adapter-level contract, preserved exactly. Phase 0a-S2 types it but does not change its shape.
- **Both htmlwidget binding names** (`tabviz` and `tabviz_split`) and **both Shiny custom-message channel names** (`tabviz-proxy` and `tabviz-split-proxy`).
- **All wire-format field names, NA encoding, snake↔camel translation.** Live in `R/utils-serialize.R`; the split does not touch them.

This is deliberate. The split should be invisible to a tabviz R user. No behavior changes, no breaking API on the R side, no visual regressions.

### 3.10 Multi-binding package layout

The package ships **two htmlwidget bindings** (single + split) and **one V8 export bundle** as three distinct R-facing artifacts, all built from one source tree. The single source tree contains both widget shells, but they remain independently buildable and independently runnable — neither pulls the other into its bundle.

| Concern | Single (`tabviz`) | Split (`tabviz_split`) | V8 export |
|---|---|---|---|
| Entry | `srcjs/src/htmlwidgets/index.ts` | `srcjs/src/htmlwidgets/index-split.ts` | `srcjs/src/export/v8-entry.ts` |
| Build config | `vite.config.ts` | `vite.config.split.ts` | `vite.config.v8.ts` |
| Output | `inst/htmlwidgets/tabviz.js` | `inst/htmlwidgets/tabviz_split.js` | `inst/js/svg-generator.js` |
| Public factory | `createTabviz(el, spec)` | `createSplitTabviz(el, splitSpec)` | `exportToSVG / computeNaturalDimensions` (pure functions) |
| Store | `createForestStore()` | `createSplitForestStore()` (composes multiple `createForestStore` internally) | none — pure |
| Top component | `<ForestPlot />` | `<SplitForestPlot />` (composes `<ForestPlot />` internally via the sidebar) | none — pure |
| R adapter functions | `tabvizOutput`, `renderTabviz`, `tabviz_proxy`, `tabviz-proxy` channel | `splitTabvizOutput`, `renderSplitTabviz`, `split_tabviz_proxy`, `tabviz-split-proxy` channel | `save_plot()` via `V8::v8()` |
| State emission | per-widget Shiny inputs (`<id>_<field>`) | same shape, prefixed with split-widget id | none |

**Shared internals across the two widget builds:**

- `createForestStore` — the per-pane state container (split widget composes N of these)
- `createTheme` / `theme-resolver` — shared theming
- `source-serializer` — the multi-target View Source registry + targets (R + JS in v1; see §3.11). Live-widget-only; not in the V8 bundle.
- All `lib/*` modules — rendering, formatting, layout, scaling
- All `components/*` for cells, forest marks, viz columns
- `types/index.ts` — shared TS types
- `htmlwidgets-glue` shared utilities (Shiny envelope, source tagging, normalization)

The two `htmlwidgets/index*.ts` entries are thin shells that import shared modules and bind their respective htmlwidget + Shiny channel. The v8-entry is even thinner — pure function exports for the V8 global scope.

**Why this works.** The split widget *is* a composition of single widgets — its store wraps multiple `ForestStore` instances; its component embeds `ForestPlot` once per active pane. Treating them as peers at the build/export layer (rather than one-as-feature-of-the-other) reflects what they actually are and lets the npm package expose both factories with the same public-API discipline.

### 3.11 Multi-target View Source

The widget's "View Source" affordance — a button that emits reproducing code for the current state — exists today as an R-only emitter. In v1 we reframe it as **multi-target**: the modal becomes a tabbed UI, each tab corresponding to a registered source-language target. v1 ships two:

- **R** — calls to `tabviz()`, `col_*` helpers, `web_theme(...)`, plus mutation chain (`set_sort`, `set_filter`, `set_aspect_ratio`, paint operations). Same output as today, but routed through the new target interface.
- **TS / JS** — calls to `createTabviz(element, spec)`, with `createTheme({...})` for the theme. Targets the v1 public JS API; the spec literal is the resolved WebSpec.

Future targets (Python, JSON spec dump, etc.) plug in by registering against the same interface — no further structural work. Python in particular is "not a concern for now, but greatly facilitated by this refactor."

**Architecture.**

```ts
interface SourceTarget {
  id: string;                                  // "r" | "js" | "python" | ...
  label: string;                               // shown on the tab
  mimeType: string;                            // for clipboard / syntax highlighting
  serialize(state: TabvizState): string;       // pure: state → code
}
```

Targets register at module load. `SourceModal.svelte` reads the registry, renders one tab per target, and calls `serialize(currentState)` when each tab is activated. The op-recorder (generic action log) is a separate module — it captures what the user did, the serializer reads current state, the two are decoupled.

**Where it lives in the package.** Core, not htmlwidgets-adapter — both R and JS targets are first-class, and at least one (JS) is what the npm consumer actually wants. The R target is part of the core package even though "R code" sounds R-adapter-flavored; the alternative (relocating to htmlwidgets-adapter) was rejected once R became one target among several.

**Static contexts.** The source serializer is interactive-only — never invoked during V8/headless rendering. The V8 bundle (`inst/js/svg-generator.js`) does not import the serializer or the modal. In static htmlwidget embeds (knitr/Quarto rendered to non-interactive HTML), the button is gated by `InteractionSpec` flags — disabled all-interactions → no button, no modal, no serializer call. Publication-ready static images pay zero cost for this feature.

**Sync risk and mitigation.** Each target's serializer embeds knowledge of a target language's API surface. Risk: drift when that API evolves (R `tabviz()` adds an arg; JS `createTabviz` signature changes). Mitigation: G6 round-trip doc-tests — emit code from a known WebSpec, evaluate/import in the target language, assert reconstructed state equals input. Two test suites (R-target test runs in `testthat`; JS-target test runs in vitest). Both gate CI.

**Why this is a §0 exception rather than paydown.** The R target alone is paydown (the existing implementation refactored to fit the registry). The JS target is genuinely new functionality — it doesn't exist today. We accept it because the alternative is shipping an npm package whose View Source feature emits a language the consumer doesn't use. The marginal cost is low (we already type `createTabviz`'s signature; serializing against our own public API is mechanical) and the consumer benefit is high (copy-paste reproducer in their own language). Same bar as the theme-resolver port; same one-time-not-precedent stance.

---

## 4. Migration plan

The plan has two halves: a **pre-split debt paydown program** (Phases 0a-0d), and the **split itself** (Phases 1-4). Total estimated effort is a quarter — call it ~12 weeks of focused work — with Phase 0 taking roughly two-thirds of that. Each phase lands as one or several PRs; each leaves the codebase in a green state. Visual tests pass byte-identical (or with reviewed diffs) at every phase boundary.

The ordering is not arbitrary: structural debt (Phase 0a) blocks API-shape decisions in the split; dead code (Phase 0b) reduces the surface to refactor in 0c; size/clarity refactoring (Phase 0c) needs the cleaned-up structural surface to converge cleanly; documentation (Phase 0d) needs the final shapes to document.

### Phase 0a — Structural debt paydown (in-place)

**Goal:** every public-API-shaping wart from §2.5 fixed in the current codebase, with no package structure change. The codebase behaves identically to today (visual tests + Shiny dashboards unchanged) but internally has the shape we want to publish.

Concrete work, item by item from §2.5:

1. **S6 + G1**: Add `version` field to `WebSpec` and `SplitWebSpec` types. Emit from `R/utils-serialize.R`. Validate on JS ingest with a clear error message on unknown major. Publish initial JSON Schema for v1.0 at `srcjs/src/spec/v1.0.json` with the `additionalProperties: true` posture documented in §3.4. *(~2 days)*
2. **S2 + G3**: Define `ShinyEnvelope<T>` type: `{ value: T; source: "user" | "proxy"; ts: number }`. Use it explicitly throughout the Shiny bindings (both single and split widgets). Document the source-tag contract in `docs/dev/source-tagging.md`. *(~1 day)*
3. **S3 + S13**: Design and implement a typed event emitter on the store. Event types: `change`, `sort`, `filter`, `select`, `hover`, `columnOrder`, `columnWidths`, `rowStyles`, `cellStyles`, `paintTool`, `collapsedGroups`, `hiddenColumns`, `cellEdits`, `labelEdits`, `zoom`, `axisZooms`, `banding`, `plotWidth`, `visibleRows`. Re-route the `$effect(() => setInputValue(...))` block to subscribe to typed events and forward each to Shiny. **Solve the R↔JS sync question for `TABVIZ_STATE_FIELDS`** in the same PR: pick generate-at-build-time, doc-tested mirror, or another mechanism (decided in §4-0e audit), and wire it up. Without this, the typed event API will drift from R's reader. **Behavior identical**; structure typed. *(~1.5 weeks)*
4. **S1 + S7 + S11 + S12**: Lift per-handler coercion out of `proxyMethods`. Define typed argument interfaces per method (`SortByArgs`, `ApplyFilterArgs`, etc.). Coercion (NA → null, snake → camel for any stragglers, type checks) becomes one `normalizeProxyArgs(method, raw)` function at the boundary, shared between single and split widgets. Per-method handlers receive typed args. Move the inline merge logic of `updateColumn` into the store as `store.updateColumn(id, patch)`. **Keep `srcjs/src/index.proxy.test.ts` green throughout** and refactor it alongside as the canonical typed-dispatch fixture. *(~1 week)*
5. **S4 + D3**: Consolidate the filter API. Pick the typed `setColumnFilter(field, ColumnFilter)` shape; remove `setFilter(config)`. Remove the dispatch-side branch. *(~2 days)*
6. **S5**: Add `store.clearSemantic(rowId)` and `store.clearCellSemantic(rowId, field)`. Replace the manual loops over `["bold", "emphasis", "muted", "accent", "fill"]` in two dispatch handlers. *(~half day)*
7. **S8**: Disentangle `setTheme`. Either accept both name and full theme with explicit `{ kind: "name", value: "lancet" } | { kind: "theme", value: WebTheme }`, or split into `setThemeByName(name)` and `setTheme(theme)`. Pick whichever feels cleaner; document. *(~half day)*
8. **S9**: Make `setAspectRatio` contract explicit: `{ ratio: number | null, anchor: "width" | "height" | "auto" }`. `null` clears. No inference from NaN/Infinity/<=0. *(~half day)*
9. **S10**: Move all `window.HTMLWidgets`, `window.Shiny`, `window.__tabvizExports`, `window.__tabvizStoreRegistry` references into a shared `srcjs/src/htmlwidgets-glue.ts` module that both `index.svelte.ts` and `index-split.svelte.ts` import from. Neither entry touches globals directly. *(~2 days)*
10. **S14**: Apply S1-S12 to the split widget (`index-split.svelte.ts`, `split_tabviz_proxy`, `tabviz-split-proxy` channel) using the shared `normalizeProxyArgs` + typed event infrastructure built above. Same normalization layer, same envelope, same event emitter pattern — just bound to the split widget's id and channel. *(~3-4 days)*

**Phase 0a deliverable:** all P0 structural items resolved across both widgets. The stores (single + split) have their eventual public-API shape. `index.svelte.ts` and `index-split.svelte.ts` reduce to ~150 lines each, almost all of which is htmlwidget+Shiny registration delegating to shared glue. Visual tests pass byte-identical. Shiny dashboards pass unchanged.

**Estimated: 4 weeks.** Lands as 6-8 PRs, each independently mergeable.

### Phase 0b — Dead code removal

**Goal:** delete what isn't used, document what's kept.

1. **D1**: Audit `setContinuousMode` callers. If unused, remove the store method, the spec field, and the R-side setter. *(~half day)*
2. **D2**: Audit `previewColumnWidth`, `previewLabel`, and any other `preview*` methods. If preview rendering exists somewhere, document; if not, remove. *(~half day)*
3. **D4**: Run a usage audit across the ~80 store methods. List orphans (no caller in src/, tests/, or R/). Remove confirmed orphans. *(~1 day)*
4. **D5**: Audit `__tabvizExports` and `__tabvizStoreRegistry` usage in `tests/visual/` and `srcjs/scripts/`. If used by tests, gate behind a `__DEV__` flag in the build; if unused, remove. *(~half day)*

**Phase 0b deliverable:** zero confirmed-dead methods, fields, or globals. The remaining surface is what's actually used.

**Estimated: 3-4 days.** One PR.

### Phase 0c — Size/clarity refactoring

**Goal:** decompose the largest modules along their natural seams. Behavior identical; structure clearer.

This is the longest and highest-risk phase. Each decomposition is one or two PRs with thorough visual-test review.

1. **C1 — forestStore decomposition.** The thorniest item in this entire program. Svelte 5 reactive primitives (`$state`, `$derived`, `$effect`) don't compose across module boundaries the way Pinia/Zustand slices do — `$state` at module scope behaves differently than `$state` returned from a factory function. Decomposing into 10 sub-files that re-export into one factory requires a deliberate composition idiom; we cannot just split a closure and expect it to keep working.

   **Pre-step: idiom selection and proof.** Before touching the bulk of the store, pick one of three idioms, write a single slice end-to-end in that idiom, verify it behaves identically (visual tests + a targeted reactivity test), and only then proceed:
   - (a) **Parameter-passing**: each sub-module exports functions that take a state record (the `$state` objects) as an argument; the factory creates state once and threads it through.
   - (b) **Svelte class-field idiom**: convert the factory to a class with `$state` fields; sub-modules become classes that share a parent via composition or context.
   - (c) **Method-only split**: keep the factory closure for state declarations, split only method definitions into helper modules that close over the state record.

   *(Pre-step: ~3-4 days to evaluate and prototype one slice.)*

   Once the idiom is fixed, decompose along domain seams into ~10-12 modules:
   - `store/data.ts` — spec ingestion, current page
   - `store/sort-filter.ts` — sort, column filters
   - `store/columns.ts` — column ops (insert, hide, move, width, update)
   - `store/rows-groups.ts` — row selection, group collapse, row reorder
   - `store/cells.ts` — cell edits, label edits
   - `store/semantics.ts` — paint tool, row/cell semantics, theme tokens
   - `store/layout-zoom.ts` — dimensions, zoom, autofit, aspect ratio, banding, plot width
   - `store/axis.ts` — axis zooms, effective domains
   - `store/theme.ts` — theme switching, theme field edits, snapshots
   - `store/events.ts` — typed event emitter (added in 0a)
   - `store/source.ts` — source tagging, op recorder
   - `store/splitForestStore.ts` — composition of N forest stores for the split widget (existing 466-line file, decomposed alongside)

   A `createForestStore()` factory composes the slices into the combined surface today's consumers expect. **The public method signatures are unchanged.** The decomposition is internal. *(~2.5 weeks of decomposition work after the pre-step, one PR per slice or grouped where coupled.)*

   **Total C1 estimate: 3 weeks.** This is the single highest-risk item in the entire program; consider freezing other paydown work during the pre-step so the idiom decision has full attention.

2. **C2 — ForestPlot.svelte decomposition.** Split into:
   - `ForestPlot.svelte` (orchestrator, <500 lines)
   - `ForestHeader.svelte` (title/subtitle/labels region)
   - `ForestTableBody.svelte` (grid of cells, banding, group headers)
   - `ForestPlotBody.svelte` (interval markers, summary diamonds, axis)
   - `ForestControls.svelte` (toolbar, settings panel mount)
   - `ForestOverlays.svelte` (tooltips, popovers, modals)
   
   *(~1 week)*

3. **C3 — ColumnEditorPopover decomposition.** Split into `TypePicker.svelte` + `OptionsEditor.svelte` + `EditorPreview.svelte`. *(~3 days)*

4. **C4 — Other large components audit.** `ColumnTypeMenu`, `ThemeControl`, `ZoomControls`, `SettingsPanel`. For each, evaluate whether internal seams are clean enough to split usefully; split where yes, leave where no. *(~1 week)*

5. **C5 — Theme presets + JS resolver.** Per the §3.7 stance: replace hardcoded `theme-presets.ts` with R-authored presets serialized to `srcjs/src/themes/presets.json` at build time (R is canonical). Port the Tier 1 → 2 → 3 resolver from `R/utils-serialize.R` to `srcjs/src/lib/theme-resolver.ts`, designed against the locked cascade plan. Implement `createTheme({ primary, secondary, accent, ... })` returning a fully-resolved `WebTheme`. Testing strategy: snapshot every preset's fully-resolved theme as emitted by R AND as recomputed by the JS resolver from Tier 1 inputs alone; byte-compare the two in CI. Without this gate, "same algorithm both sides" is wishful. **Gated on the cascade-rework implementation landing R-side first** so both sides ship against the same locked plan. *(~1.5-2 weeks: preset serialization 2-3 days, resolver port 5-7 days, snapshot test suite 2-3 days)*

6. **C6 — Migrate CSS-shaped constants.** Identify entries in `rendering-constants.ts` that are visual (spacing, padding, opacity) and migrate to CSS custom properties on `.tabviz-container`, driven by theme tokens. Keep algorithmic constants in TS. *(~3 days)*

7. **C7 — Aspect ladder cleanup.** Rename levers to descriptive names (`forestAbsorb`, `nonForestScale`, `layoutOverflow`, `heightLadder`); add a doc-comment header explaining the algorithm and the anchor model. Add unit tests pinning current behavior at known aspect-ratio inputs. **No algorithmic change.** *(~3 days)*

8. **C8 — width-utils audit.** Confirm canvas measurement is always available in browser; simplify fallback path or document why both are kept. *(~1 day)*

9. **C9 — svg-generator audit.** Read through the 5347 lines; identify whether per-column-type render functions have clean seams. If yes, split into `render-forest.ts`, `render-bar.ts`, etc. If no, leave alone and document why with an inline justification at the top of the file. *(~2 days for audit; +1 week if split)*

10. **C10 — Split widget shell decomposition.** Audit `SplitForestPlot.svelte` and `components/split/SplitSidebar.svelte` (387 lines) for internal tangle. Split where seams justify it; leave whole if already clean. *(~3 days)*

11. **C11 — Rename `column-compat.ts` to `column-types-registry.ts`.** Relocate to `components/controls/` (it's editor-specific). No behavior change. *(~half day)*

12. **C12 — View Source: refactor + JS target.** Per §3.11. Two sub-stages:
    - **C12-a (refactor, lands in 0c):** Extract `SourceTarget` interface, re-implement existing R-code-gen as the `"r"` target against the new interface. Separate op-recorder (action log; stays as today) from serializer modules. Rebuild `SourceModal.svelte` as a tabbed UI with one tab per registered target — initially just the R tab. Visual + behavior parity with today's View Source. *(~1 week)*
    - **C12-b (JS target, lands after Phase 1):** Implement the `"js"` target, emitting `createTabviz(element, spec)` + `createTheme({...})` calls against the v1 public API. Add the JS-target round-trip doc-test (see G6). *(~1 week)*
    
    C12-a is paydown; C12-b is the §0 exception. C12-b is gated on Phase 1 (createTabviz factory extracted) and Phase 0c-C5 (createTheme shipped). Total ~2 weeks.

**Phase 0c deliverable:** no source file in `srcjs/src/` exceeds ~700 lines without an inline justification comment at the top explaining why. Visual tests pass byte-identical or with reviewed-and-approved minor diffs. The codebase is recognizably the same library, internally rearranged. C12-b ships in Phase 1.5 once `createTabviz` is stable.

**Estimated: 7-8 weeks.** This phase carries the highest regression risk (C1 alone is 3 weeks); landing it as small grouped PRs with full visual-test runs at each step is essential. C12-a fits inside this window; C12-b lands in a Phase 1.5 follow-on.

### Phase 0d — Documentation & contract solidification

**Goal:** everything the public API will commit to is written down before the split.

1. **G1** — Finalize JSON Schema for `WebSpec` v1 (started in 0a). Generate from TS types where possible. *(~2 days)*
2. **G2** — Write the event contract: every typed event, its payload shape, its semantics, its source-tag rules. `docs/dev/event-contract.md`. *(~2 days)*
3. **G3** — Document the source-tagging envelope (started in 0a). *(rolled in)*
4. **G4** — Aspect ladder doc-comment header (rolled into C7). *(rolled in)*
5. **G5** — Annotate forest-specific vs general fields in `srcjs/src/types/index.ts` with TSDoc tags. Produce a reference table in `docs/dev/spec-fields-reference.md`. *(~2 days)*
6. **Versioning policy doc** — `docs/dev/versioning.md` covering: when to bump major, how migration works, R↔JS compatibility matrix mechanism. *(~1 day)*
7. **Public API reference draft** — sketch the eventual README for `@tabviz/core`, even though we haven't published yet. Forces us to confirm everything's documentable. *(~2 days)*

**Phase 0d deliverable:** every public surface is written down. If a reviewer asks "what does this method do, what does it emit, what's its contract" the answer is in a file, not in our heads.

**Estimated: 1.5 weeks.** Mostly writing.

### Phase 0e — Synchronization audit (parallel with 0d)

**Goal:** every place where an R-side constant or shape mirrors a JS-side definition is identified and assigned a sync mechanism. No silent drift between the two sides. This phase produces deliverable G6 from §2.5.

Known sync points (audit may surface more):

1. **`TABVIZ_STATE_FIELDS` (`R/shiny.R:100`) ↔ JS-side typed event emitter** (Phase 0a-S3). Decide: build-time generate the R constant from the TS event-type list; or doc-test mirror with a CI check.
2. **`tabviz-proxy` method names (R-side dispatcher in `R/shiny.R`) ↔ JS-side `proxyMethods` keys / `normalizeProxyArgs` switch.** Same decision.
3. **Theme preset names (R-side `R/themes.R` exports) ↔ JS-side `themes/presets.json`** (Phase 0c-C5). The build pipeline serializes R presets to JSON; sync is automatic by construction.
4. **`tabviz-split-proxy` method names ↔ split-widget JS dispatch.** Same as #2.
5. **Column type names (R `col_*` helpers ↔ TS `ColumnSpec` discriminator).** Document the mapping; doc-test that the union is complete.
6. **Wire field name conventions (R snake_case ↔ JS camelCase).** Already localized in `R/utils-serialize.R`; document as the canonical translation table.

For each sync point, decide one of:
- **Generate**: one side authored, the other derived at build time (preferred where the relationship is mechanical)
- **Doc-test**: both sides authored, a test asserts they stay in sync (preferred where authoring on both sides is genuinely useful)
- **Manual sync**: documented, no automated enforcement (only for items that change rarely and obviously)

Output: `docs/dev/r-js-sync-points.md` enumerating each, the chosen mechanism, and the file/line locations on both sides.

**Estimated: 1 week** (audit + decisions + wiring up the generators/doc-tests for items #1 and #2 in particular).

### Phase 1 — Extract the public instance API (in-place)

With Phase 0 complete, this becomes mechanical:

1. Create `srcjs/src/lib/createTabviz.ts` exporting `createTabviz(el, spec, options)` and `TabvizInstance`. Create `srcjs/src/lib/createSplitTabviz.ts` exporting `createSplitTabviz(el, splitSpec, options)` and `SplitTabvizInstance`. Both are thin facades over their respective stores (already shaped correctly thanks to 0a) plus event emitter plus lifecycle (mount/destroy).
2. Rewrite `index.svelte.ts` and `index-split.svelte.ts` to consume the factories rather than reaching into the stores directly. The htmlwidget+Shiny adapters dispatch custom messages to typed instance methods and subscribe to typed instance events for forwarding to Shiny.
3. Visual tests + Shiny dashboards unchanged. The codebase looks like a published package internally but still builds the same three artifacts.

**Estimated: 1 week.** One or two PRs (single and split factories can land independently).

### Phase 1.5 — View Source JS target (after Phase 1)

C12-b from §2.5: with `createTabviz` and `createTheme` factories now stable (Phase 1 done, Phase 0c-C5 done), implement the `"js"` target for View Source and add the round-trip doc-test (G6). Ships as a second tab in the SourceModal alongside the existing R tab.

**Estimated: 1 week.** Mostly mechanical — serializing against our own typed public API. Doc-test is the careful part.

### Phase 2 — Restructure source tree for subpath exports

```
srcjs/src/
├── core/                (vanilla factories + types + instance API)
│   ├── createTabviz.ts
│   ├── createSplitTabviz.ts
│   └── createTheme.ts
├── svelte/              (Svelte components + stores)
│   ├── ForestPlot.svelte
│   ├── SplitForestPlot.svelte
│   ├── createForestStore.ts
│   └── createSplitForestStore.ts
├── export/              (headless rendering pure functions)
│   ├── exportToSVG.ts
│   ├── exportToPNG.ts
│   ├── computeNaturalDimensions.ts
│   └── v8-entry.ts      (R V8 global-scope shim)
├── spec/                (TS types + JSON Schema)
│   ├── types.ts
│   ├── v1.0.json
│   └── ...
└── htmlwidgets/         (R adapters — both bindings live here)
    ├── index.ts         (entry: tabviz binding)
    ├── index-split.ts   (entry: tabviz_split binding)
    ├── glue.ts          (shared Shiny + globals)
    └── normalize.ts     (shared proxy-arg normalization)
```

Three vite configs route to their respective destinations:

| Vite config | Entry | Output |
|---|---|---|
| `vite.config.ts` | `srcjs/src/htmlwidgets/index.ts` | `inst/htmlwidgets/tabviz.js` |
| `vite.config.split.ts` | `srcjs/src/htmlwidgets/index-split.ts` | `inst/htmlwidgets/tabviz_split.js` |
| `vite.config.v8.ts` | `srcjs/src/export/v8-entry.ts` | `inst/js/svg-generator.js` |

`package.json` gets `exports` entries for `.`, `./svelte`, `./export`, `./spec`, `./htmlwidgets`. No npm publish yet.

**Estimated: 1 week.** File moves and import-path updates. Visual tests byte-identical.

### Phase 3 — Publish to npm

Pre-publish checks:

- TypeScript types complete on every public export; `tsc --noEmit` clean
- JSON Schema validates against real serialized payloads from R (regression-check the schema)
- **CSS deliverable for npm consumers.** Today's vite configs use `cssCodeSplit: false` and inline CSS into the IIFE — fine for an htmlwidget consumer, surprising for an npm consumer. Add a `style.css` artifact (or per-entry `style: "..."` export field) so web-app consumers can `import "@tabviz/core/style.css"` normally.
- **V8 bundle size budget.** V8 instantiation in R is slow; growth in `inst/js/svg-generator.js` taxes every export call. Add a CI gate that warns on >10% size growth without justification in the PR description. Same gate for parse-cost (Node `--experimental-vm-modules` test or similar).
- **Toolchain canonicalization.** `srcjs/` currently has both `bun.lock` and `package-lock.json`; CI must canonicalize one. State which package manager builds the published artifact (recommend npm for compatibility with downstream toolchains; `bun-types` stays in `devDependencies` if used in test scripts).
- README documenting subpaths, SemVer policy (per §3.4), the JSON Schema location, and how to consume from non-Svelte frameworks
- CI builds the artifact reproducibly (same hash twice in a row)

Publish `@tabviz/core@1.0.0`. R package's build pipeline pins an exact version and vendors all three built bundles into `inst/` at their respective destinations. A compatibility table in `R/zzz.R` records the JS version range the R package supports and the htmlwidget loader checks at init.

**Estimated: 1.5 weeks.**

### Phase 4 — Integrate with the org's web app

Web-app team imports `@tabviz/core`. We learn what's missing by watching what they reach into internals for. Iterate on minor versions. Additive changes liberal; breaking changes batched into a v2 if/when needed.

### Phase 5 (eventually) — v2 theme features, Python View Source target, and other post-v1 additions

v1 ships the programmatic `createTheme()` factory + Tier 1→2→3 resolver on both sides (Phase 0c-C5) and the multi-target View Source with R + JS targets (§3.11, Phase 0c-C12 + Phase 1.5). What v1 does *not* ship:

- **Theme features beyond the cascade plan.** Web-font loading machinery, editorial-typography knobs, foregrounded Tier 2/Tier 3 overrides. Waits for cascade-rework production experience + editorial-themes plan (`project_editorial_themes.md`) settling.
- **Python View Source target.** The multi-target architecture from §3.11 makes this mechanical to add (register a `"python"` target with its serializer); v1 just doesn't ship it. When a Python API for tabviz eventually exists, the View Source feature accepts it as a third tab without further refactoring.
- **Other targets that haven't been requested** (JSON spec dump, Quarto chunk, screenshot URL, ...). Add as use cases emerge; each one is one new file plus a registry entry.

Out of scope for this work.

### Total timeline

| Phase | Work | Estimate |
|---|---|---|
| 0a | Structural debt (both widgets) | 4 weeks |
| 0b | Dead code | 3-4 days |
| 0c | Size/clarity (C1 ~3w; C5 see †; C12-a) | 7-8 weeks |
| 0d | Documentation | 1.5 weeks |
| 0e | Synchronization audit (parallel with 0d) | 1 week |
| 1 | Extract instance APIs (single + split) | 1 week |
| 1.5 | View Source JS target (C12-b) | 1 week |
| 2 | Restructure source tree | 1 week |
| 3 | Publish | 1.5 weeks |
| **Total to first npm publish** | | **~18 weeks (one quarter + ~5 weeks)** |
| 4 | Web-app integration | Ongoing |
| 5 | v2 theme features beyond cascade plan; Python View Source target; etc. | Future |

**† Cross-program dependency:** Phase 0c-C5 (theme presets + JS resolver port, ~1.5-2 weeks) is gated on the R-side cascade-rework implementation landing first (`project_theme_cascade_rework.md`, plan locked 2026-04-29). If the R-side rework hasn't landed by the start of Phase 0c, C5 defers — either to later in Phase 0c (if cascade-rework lands mid-program) or to v1.1 (if it slips past Phase 3). In the latter case, v1.0 ships with bundled-preset themes only and no JS `createTheme()` factory; the web-app consumer uses presets until v1.1. This is a real schedule dependency on a separate program; check status before committing to Phase 0c's window.

This is honest. The work is real. Phase 0c-C1 alone is the thorniest single item — three weeks of Svelte-5-runes-composition work that has to land carefully. C5 carries the cross-program dependency above. The user signing up for this should understand the order of magnitude before starting; the original "one quarter" framing was right in spirit but a bit tight on the day-count.

### Stopping rules

Two ways to know we're done with paydown, in case the program tries to grow:

1. **Phase 0a is done when every item in the S1-S14 list is closed.** No more, no less.
2. **Phase 0c is done when no source file exceeds ~700 lines *without an inline justification comment at the top of the file* explaining why.** The threshold is a forcing function, not an absolute. `svg-generator.ts` may keep its size with a documented rationale (e.g., "per-column-type render functions don't decompose cleanly per Phase 0c-C9 audit"); the store factory may keep its size with a similar note. The rule is to make every exception *visible* in the source, not to mechanically enforce a line count.

If new debt is discovered mid-flight, add it to the §2.5 list explicitly; do not silently expand scope. If the new item is genuinely structural (P0), pause and address it. If it's size/clarity (P2), append to the Phase 0c checklist with a one-line justification. If it's a hypothetical-future-consumer redesign, refuse and note in §5.

---

## 5. Open questions & risks

### 5.1 Decisions to make before implementation

**Q1: What is the package name?** `@tabviz/core` is the working name. Alternatives: `@tabviz/widget`, `@tabviz/render`, `tabviz-js`. Worth deciding with the org's web-app team since they'll see it in their `package.json`.

**Q2: Where does the R package get the JS from at build time?** Two paths: (a) vendor the built artifact into `inst/htmlwidgets/` from the local source (today's behavior, adjusted for the new build entry), or (b) install from npm at R package build time. Path (a) is simpler and works for CRAN; path (b) requires Node in CI. Recommend (a) for v1.

**Q3: What's the relationship between R package version and JS package version?** Two independent semvers, with a compatibility table maintained in `R/zzz.R` (or similar) that the htmlwidget loader checks on init. Recommend they not lockstep; allow JS to ship faster.

**Q4: How does the JSON Schema get used?** R-side validation via `jsonvalidate`? JS-side runtime validation via ajv? Or just typecheck-only, no runtime validator? Recommend: publish the schema, do not run it at runtime by default. Consumers can opt in.

**Q5: How are visual tests rerouted?** Today `tests/visual/` calls the V8 path. After split, it calls the same V8 path through the new subpath. Verify no regressions; visual tests are byte-comparable per the standing setup.

**Q6: Does the web-app team commit before Phase 1?** If they don't, Phases 0-2 are still net positive cleanups. Phases 3-4 only justify themselves with a second consumer. Worth confirming the commit before starting Phase 3.

**Q7: Build-time R dependency for theme presets.** Per §3.7 and Phase 0c-C5, the canonical theme presets live R-side and serialize to JSON at build time. Confirm: does the npm publish pipeline have R available? Two paths: (a) generate `presets.json` as a committed artifact (R touches it in a separate commit, JS build consumes the committed file), or (b) require R in the JS build (CI complexity). Recommend (a) — committed JSON is simpler and avoids cross-toolchain CI.

**Q8: Idiom for store decomposition (Phase 0c-C1).** The pre-step picks (a) parameter-passing, (b) Svelte class-field, or (c) method-only split. Worth resolving early — the decision affects every store slice downstream and is hard to change mid-flight. Could even be a separate spike landing before Phase 0a starts.

### 5.2 Risks

**R1: Phase 0 expands without bound.** The biggest risk, given the decision to pay down debt comprehensively before splitting. Every refactor reveals adjacent things that could also be refactored. "While I'm here" is the slogan that turns a one-quarter program into a one-year program with no shipped value. The stopping rules in §4 are the primary defense: Phase 0a is done when the S-list is closed; Phase 0c is done when files are under the line threshold. Anything that doesn't fit those rules is either added explicitly to §2.5 (with a sentence justifying it as discernable existing debt rather than speculative redesign) or refused. Mid-flight discoveries get the same triage: is it on the list, or is it scope creep dressed as paydown?

**R2: The web-app team's needs diverge from R's.** If the second consumer wants something materially different from what the R widget needs, the public API has to bridge both. Risk is small (the use case is tabular viz in both cases), but worth surfacing early — schedule a design conversation with them between Phases 1 and 2.

**R3: Theme API misalignment with cascade rework.** Per the revised §3.7 stance, v1 ships `createTheme()` factories on both R and JS sides, designed against the locked-2026-04-29 cascade plan. The risk: if the cascade-rework *implementation* lands with subtle deviations from the locked plan, the JS resolver port could ship against the wrong target. Mitigation: gate Phase 0c-C5 on the R-side cascade-rework implementation completing first; port the JS resolver against the already-shipped R behavior, not against the plan document.

**R8: Svelte 5 store decomposition risk (Phase 0c-C1).** Svelte 5's runes are not framework-agnostic in their composition semantics; decomposing a 4261-line factory closure can produce subtle reactivity bugs that visual tests don't catch. Mitigation: the pre-step idiom selection + single-slice prototype is non-negotiable. If the prototype reveals the decomposition idiom is awkward, escalate — possibly to leaving the store as one file with an inline justification under the §4 stopping rule, accepting C1 as documented technical debt rather than forcing a risky decomposition.

**R4: Forest-specific cruft leaks into the "general" API.** `targetAspect`, `axisZooms`, `bandingOverride`, `plotWidth` are general; `sharedAxis`, `nullValue`, `ci_clip_factor`, summary diamonds are forest-specific but live on shared types. If the web-app team's use case is non-forest tabvizes, the asymmetry will surface as awkwardness. Mitigation: document forest-specific fields explicitly; do not lift them out in v1.

**R5: Spec versioning never gets used and rots.** If we add `version: "1"` and never bump it, the validation code becomes dead. Mitigation: add the version field anyway. The cost is ~20 lines of code; the benefit is being able to bump it when needed without retrofitting.

**R6: The Shiny envelope hides a contract.** `{ value, source, ts }` is well-understood today but is informal — there's no type definition consumers can depend on. Risk surfaces when a third consumer (a non-Shiny but still-Shiny-like adapter, e.g., a Plumber-driven API) wants similar source-tagging. Mitigation: type the envelope explicitly in the htmlwidgets adapter; let other adapters copy the shape if they need it.

**R7: The aspect ladder is fragile and undocumented.** The "levers" naming scheme is internal jargon. If it breaks during refactoring, debugging is slow. Mitigation: do not touch it; route the public `targetAspect`/`targetAspectAnchor` API straight through to the existing store fields.

### 5.3 Things we deliberately leave open

- Whether the package eventually moves to its own repo. Not in v1. Single repo for now.
- Whether `/svelte` should also ship Vue/React/SolidJS subpaths. No. Build them when asked.
- Whether the column editor popover should be extractable as a standalone authoring widget. Possibly significant; not now.
- Whether the spec language should grow non-tabular forms (small multiples, dashboards). Probably not — that's a different product.
- What v2 of the spec looks like. Hard to predict; the cascade rework and any forest-specific lifting will inform it.

---

## 6. Summary

- The frontend is already three layers (pure renderer + spec language + Svelte shell); the split formalizes what already exists.
- The wire contract is localized in four narrow seams; extraction is feasible without disturbing the renderer or the visual tests.
- Publish as one package with five subpath exports (vanilla / svelte / export / spec / htmlwidgets) and three build artifacts (`tabviz.js`, `tabviz_split.js`, `svg-generator.js`). Single repo, single version.
- **Split widget is first-class.** v1 ships `createTabviz` and `createSplitTabviz` as peer factories, with `SplitWebSpec` as a top-level spec type. Both htmlwidget bindings preserved.
- Version the spec explicitly on day one; SemVer policy is relaxed pre-release (everybody relax), tightens to additive-minor + `additionalProperties: true` once external consumers ship.
- Validation is *symmetric* in code, *asymmetric* in polish — R-side validation is cheap and useful even on the lockstep path; rich messages and migration handlers concentrate on the external consumer path.
- **Theme stance revised: factories on both sides.** v1 ships `tabviz::web_theme(...)` (R) and `createTheme({...})` (JS), both honoring the locked-2026-04-29 cascade plan. JS resolver ports from R; presets stay R-canonical, serialized to JSON at build time. Gated on the cascade-rework implementation landing R-side first.
- **View Source becomes multi-target.** v1 ships R + JS tabs in the modal; future Python tab plugs into the same registry. Live-widget-only; doesn't affect static rendering. R-target is paydown; JS-target is the second deliberate §0 exception.
- **Pay down all discernable technical debt before the split** — 15 structural items (S1-S15), 12 size-clarity (C1-C12), 5 dead-code (D1-D5), 6 documentation/sync (G1-G6). Structural debt locks into the public API; size/clarity debt compounds quietly. Refuse speculative redesigns; accept narrowly-scoped exceptions only at the §0 bar.
- **R↔JS synchronization audit (Phase 0e)** identifies every mirrored constant or shape across the boundary and assigns a sync mechanism. No silent drift. Source-target serializers get round-trip doc-tests (emit → eval → assert).
- Phase the work: structural paydown (both widgets, 4w) → dead code (4d) → size/clarity refactor incl. C12-a (7-8w) → docs + sync (1.5w + 1w) → extract instance APIs (1w) → View Source JS target (1w) → restructure (1w) → publish (1.5w). **~18 weeks** to first npm publish.
- Biggest risks: Phase 0 expanding without bound (R1, stopping rules), and the Svelte-5 store decomposition idiom (R8, pre-step prototype is non-negotiable).

The opportunity behind all of this: tabular visualization is an underrecognized genre, and tabviz is well-positioned to own it across R, JS, editorial, clinical, and embedded-analytics audiences. The split is the technical move that lets the spec language — the genuinely interesting artifact — reach beyond the R world. Paying down debt first is what makes that move stick.
