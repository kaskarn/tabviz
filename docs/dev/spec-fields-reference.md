# tabviz WebSpec field reference

**Status:** Phase 0d deliverable G5. Inventory of every field that crosses the R↔JS wire, classified by whether it's general (applies to any table), forest-specific (only meaningful when the spec has a `forest` column), or viz-family-specific.
**Audience:** API designers who need to know which fields can be lifted to a published `@tabviz/core` type and which encode the package's forest-plot heritage. Maintainers cleaning up internal types. Anyone writing a consumer that doesn't render forest plots.

This document is the canonical answer to the question raised in `docs/dev/frontend-split-spec.md` §1.4 ("Forest plot biases run deep, and we keep them"). It does not propose changes — it records the asymmetry so consumers can reason about it.

---

## Classification

Every field is one of:

- **General** — applies to any rendered table. Reusable in a `@tabviz/core` published API without renaming or repurposing.
- **Forest** — only fires when the spec has at least one `type: "forest"` column. Outside that context the field is dead weight on the wire; tolerated for symmetry with the forest path.
- **Viz** — only fires for `viz_bar` / `viz_boxplot` / `viz_violin` columns. Same forest-style "general types, special-case meaning" pattern.
- **Chrome** — viewer / export ornament that doesn't depend on column types (watermark, pagination, plot labels).
- **Debug** — wire metadata for the "View Source" feature, not a rendering input.

The classification is **field-by-field**, not type-by-type. A general interface like `WebData` can have one forest-only field (`summaries`) and one chrome-only field (`overall`).

---

## Top-level `WebSpec`

| Field | Kind | Notes |
|---|---|---|
| `version` | General | Wire-format version (`"1.0"`). See `docs/dev/versioning.md`. |
| `data` | General | Rows + groups (+ forest-only summaries; see below). |
| `columns` | General | Column tree (any column type). |
| `extraColumns` | General | Hidden-by-default columns surfaced by the configure UI; orthogonal to forest. |
| `availableFields` | General | Slot-compatibility hints for the editor; orthogonal to forest. |
| `theme` | General | Full theme; applies to every rendered table. |
| `interaction` | General | Sort / collapse / filter / paint flags. |
| `layout` | Forest | `plotWidth` is the forest column's pixel width; ignored when no forest column. |
| `labels` | Chrome | Plot title / subtitle / caption / footnote — viewer ornament. |
| `watermark` / `watermarkColor` / `watermarkOpacity` | Chrome | Free-floating text overlay; viewer ornament. |
| `paginate` | Chrome | Page-break config + precomputed page ranges; affects every column type uniformly. |
| `initialState` | General | One-shot seed for sort / filter / hidden columns at mount. |
| `targetAspect` / `targetAspectAnchor` | General | Aspect-ratio target for export and the in-widget slider. |
| `originalCall` | Debug | `deparse(call)` from R for the View Source baseline line. |

## `WebData`

| Field | Kind | Notes |
|---|---|---|
| `rows` | General | Data rows. |
| `groups` | General | Group tree (banding, group headers, collapse). |
| `summaries` | Forest | Per-group summary diamonds (point/lower/upper). No effect on non-forest renders. |
| `overall` | Forest | Whole-table summary diamond. Forest-only. |
| `groupCol` | General | Source column used for grouping (display metadata). |
| `weightCol` | Forest | Sample-size weight column for diamond width; forest-only. |

## `Row`

`Row` itself is general (`id`, `label`, `metadata`, `groupId`, `style`). Every field is reusable.

## `Group`, `GroupSummary`, `OverallSummary`

| Type / Field | Kind | Notes |
|---|---|---|
| `Group.id` / `.label` / `.parentId` / `.depth` / `.collapsed` | General | Group hierarchy + UI state. |
| `Group.weight` | Forest | Pooled sample size for summary diamond width. |
| `GroupSummary.{ point, lower, upper, groupId }` | Forest | Per-group meta-analytic summary. Forest-only. |
| `OverallSummary.{ point, lower, upper, label, weight }` | Forest | Whole-table summary diamond. Forest-only. |

## `EffectSpec`

`EffectSpec` (`id`, `pointCol`, `lowerCol`, `upperCol`, `label`, `color`, `shape`, `opacity`) is **forest-specific**. The point/lower/upper triple is the forest-plot interval idiom; reusing this type for a non-forest column would force a misleading naming.

`MarkerShape` (`"square" | "circle" | "diamond" | "triangle"`) is general (used by forest markers + the paint-tool legend), but in practice all current consumers are forest-flavored.

## Column types — `ColumnSpec.type` discriminator

| `type` literal | Kind | Notes |
|---|---|---|
| `"text"` | General | Plain string cell. |
| `"numeric"` | General | Number with format options. |
| `"interval"` | Forest | Point + CI display (e.g. `"1.2 (0.8, 1.6)"`); naming reflects forest heritage. |
| `"percent"` | General | Numeric with `%` suffix. |
| `"events"` | Forest | `n / N` cell with optional rate. Used as a forest sidecar. |
| `"bar"` | General | Inline bar (intensity / fraction); not a forest column. |
| `"pvalue"` | General | Auto-formatted p-value. |
| `"sparkline"` | General | Inline mini-line. |
| `"icon"` / `"badge"` / `"stars"` / `"pictogram"` / `"ring"` / `"img"` / `"reference"` | General | Glyph / ornament cells. |
| `"range"` | General | Min/max display. |
| `"heatmap"` | General | Color-coded numeric. |
| `"progress"` | General | Bar with explicit `value / max`. |
| `"forest"` | **Forest** | The defining viz column; everything in `ForestColumnOptions` applies. |
| `"viz_bar"` / `"viz_boxplot"` / `"viz_violin"` | Viz | Focal viz family with their own axes; share `VizColumnOptionsBase`. |

## `ForestColumnOptions`

Every field below is forest-only.

| Field | Notes |
|---|---|
| `point` / `lower` / `upper` | Source columns for the single-effect inline case. |
| `effects` | Multi-effect list (replaces the inline triple when present). |
| `scale` | `"linear"` or `"log"`. Log scale shifts `nullValue` default from 0 to 1. |
| `nullValue` | Reference line (vertical 0 / 1). |
| `axisLabel` / `showAxis` / `axisRange` / `axisTicks` / `axisGridlines` | Axis chrome. |
| `width` | Pixel width of the forest column (overrides `layout.plotWidth`). |
| `annotations` | Reference lines + freeform labels. |
| `sharedAxis` | Split-forest knob: share axis range across splits. |

## `VizColumnOptions*`

`VizColumnOptionsBase` and the three subtypes (`VizBarColumnOptions`, `VizBoxplotColumnOptions`, `VizViolinColumnOptions`) are **viz-family-specific**. They share `scale`/`nullValue`/`axisRange`/`axisTicks`/`axisGridlines`/`axisLabel`/`showAxis` with `ForestColumnOptions` but are not interchangeable — the renderer dispatches on the column type discriminator and treats the shared shape as "axis machinery," not "forest plot."

Per-type fields (e.g. `barWidth`, `whiskerType`, `bandwidth`) are subtype-only.

## `ColumnSpec` (general)

| Field | Kind | Notes |
|---|---|---|
| `id` / `field` / `header` / `width` / `align` / `headerAlign` / `wrap` / `sortable` / `showHeader` | General | Universal column knobs. |
| `type` | General | Discriminator (see table above). |
| `options` | Mixed | A union over per-type option types; the kind of the option block matches the kind of the column. |
| `format` | General | Numeric format hint. |

## `ColumnGroup`

General. Pure tree structure (`columns`, `header`, depth bookkeeping); no forest semantics.

## `WebTheme` (delegated to `WebThemeV2`)

The theme is general — every section applies to every render. Within the theme:

| Subsection | Kind | Notes |
|---|---|---|
| `colors` / `text` / `spacing` / `shapes` | General | Universal styling. |
| `plot` (tick marks, axis line, gridlines) | Forest | Theme block consumed only when an axis is rendered (forest + viz columns). |
| `layout.banding` / `layout.plotWidth` | General / Forest | `banding` is general; `plotWidth` is forest-only (mirrors `WebSpec.layout.plotWidth`). |

## `InteractionSpec`

General. Every flag (`enableSort`, `enableFilter`, `enableCollapse`, `enableSelect`, `enableHover`, `enableResize`, `enableExport`, `enableReorderRows`, `enableReorderColumns`, `enableEdit`, `showFilters`, `showLegend`, `showGroupCounts`) applies to every render.

## `LayoutSpec`

| Field | Kind | Notes |
|---|---|---|
| `plotWidth` | Forest | Pixel width of the forest column (or `"auto"`). Ignored when no forest column is present. |

## `PaginationConfig` / `PageRange`

Chrome. Pagination is a viewer/export concern; it applies uniformly to every column type. The `breakOn` enum has a `"split"` value that's only meaningful for split-widget specs but doesn't affect the column kind.

## `PlotLabels`

Chrome — `title` / `subtitle` / `caption` / `footnote`.

## Style + semantic types

| Type | Kind | Notes |
|---|---|---|
| `RowStyle` / `CellStyle` | General | Paint / semantic / per-row visual overrides. |
| `MarkerStyle` | Forest | Point shape / color / opacity for forest markers. |
| `MarkerShape` | General | Enum reused by forest + the paint-tool legend. |
| `StyleMapping` | General | Token → style/CellStyle map. |
| `SemanticBundle` / `SemanticToken` / `Semantics` | General | Selection / paint primitives. |
| `GroupHeaderStyles` | General | Per-group-header CSS-shaped overrides. |

## Wire-format envelopes & events

Not properties of `WebSpec`; documented separately:

- **Source-tagging envelope** (`ShinyEnvelope<T>`) — `docs/dev/source-tagging.md`
- **Event contract** (typed events + Shiny wire-field map) — `docs/dev/event-contract.md`
- **Proxy method dispatch** — `srcjs/src/spec/proxy-args.ts` (typed); `docs/dev/r-js-sync-points.md` §S3 covers the cross-side sync.

---

## What a `@tabviz/core` consumer should expect

If we publish `@tabviz/core` as a "general tabular viz" package, the forest-flavored fields stay on the wire but become opt-in:

- A non-forest spec **omits** `data.summaries`, `data.overall`, `data.weightCol`, `layout.plotWidth`, every `ForestColumnOptions` block, and every `theme.plot.*` field that only the axis renderer reads.
- The viz column types (`viz_bar` / `viz_boxplot` / `viz_violin`) are independent of forest plotting and ship as first-class types in their own right.
- `ColumnSpec.type === "interval"` and `"events"` carry forest plot vocabulary in their *names* but render cleanly without a forest column present (they're just cell formatters).

Renaming the forest-flavored types for a v2 wire format is a deliberate decision deferred per §1.4 of the spec.

---

## Source of truth

- TS types: `srcjs/src/types/index.ts`, `srcjs/src/types/theme-v2.ts`
- JSON Schema: `srcjs/src/spec/v1.0.json`
- Event names + Shiny wire fields: `srcjs/src/spec/events.ts`
- R-side serializer: `R/utils-serialize.R`

When any of these change, refresh the relevant row in this document.
