# tabviz 0.20.2

## Column ID integrity pass

Fixes a class of brittle collision bugs in the column-id system
surfaced by a thorough audit. Every per-id state map in the store
(`columnWidths`, `axisZooms`, `columnOrderOverrides`,
`columnSpecOverrides`, `hiddenColumnIds`, `userResizedIds`), every
downstream consumer (SVG exporter, reorder handler, configure
popover, op recorder), and every emitted fluent-R call assumes ids
are globally unique within a spec. Until now that only held by
author discipline.

### R

- **Dedup walks the full column tree.** The previous dedup pass in
  `R/web_spec.R` only considered top-level columns. It now walks
  leaves inside `col_group()`s, group ids themselves, and the
  `extra_columns` slot in one shared id namespace. Collisions are
  renamed `_2`, `_3`, … (silently — the common trigger is the
  legitimate `col_numeric("n") + col_bar("n")` pattern).
- **`ColumnSpec` / `ColumnGroup` validators reject reserved ids.**
  `"__root__"` and `"__start__"` are frontend-internal scope
  markers; constructing a column with either now errors with a
  clear message. Other `__xxx__`-shaped ids (e.g. tabviz's own
  `__row_number__` label-column field) are not reserved.

### Frontend

- **`mintUniqueColumnId` closes five blind spots.** It previously
  only consulted `spec.columns` + `userInsertedColumns`. It now
  also checks `hiddenColumnIds`, `columnSpecOverrides`,
  `columnWidths`, `axisZooms`, `userResizedIds`, and the reserved
  sentinels. A user who hides "drug" and then adds a new column
  no longer risks getting back `"drug"` and silently inheriting
  the hidden column's width / axis zoom / override state.
- **`setSpec` resets every per-id state map.** `axisZooms` and
  `userResizedIds` previously survived spec swaps, so switching
  between sub-plots in a `SplitForest` could inherit a prior
  spec's zoom / resize flag when ids coincidentally matched.
  Joining `columnWidths` and `hiddenColumnIds` in the reset path.
- **Pure `mintUniqueId(base, taken)` helper exported for
  testing.** 11 bun tests pin the resolution logic end-to-end.

### Tests

16 new R tests in `tests/testthat/test-ids.R` cover reserved-id
rejection, top-level dedup, group-nested dedup, repeated group
headers, cross-namespace `extra_columns` dedup, and stable
base-id semantics. 11 new bun tests pin the resolution helper.

### Out of scope

- No public `id=` argument on `col_*()` helpers yet — the dedup
  path makes the common cases work. A user-facing id override is
  a natural follow-up.
- No separate namespace for group vs leaf ids. Keeping one
  namespace plus dedup is the small fix; the prefix-based scheme
  would ripple through every consumer.
- Hidden columns still hold their `columnWidths` / `axisZooms`
  entries (the user might unhide them). Only `setSpec` forces a
  full reset.

# tabviz 0.20.1

## Recorder + configure popover polish

Fixes from the first wave of beta feedback on v0.20.0.

### Recorder

- **Resize emits one record per drag.** The column-resize handler
  previously pushed a `resize_column()` call on every pointer move,
  producing dozens of records for a single drag. Dragging now uses a
  non-recorded `previewColumnWidth()` during the move and commits
  once on `pointerup`.
- **Text-input edits emit one record per commit.** Watermark, title,
  subtitle, caption, and footnote inputs now push a fluent record only
  on blur or Enter — typing `"DRAFT"` used to emit 5 records, it now
  emits 1. Added `previewWatermark()` and `previewLabel()` store
  methods and split `<TextField>`'s callbacks into `oninput` (live
  preview) and `onchange` (commit).
- **Theme-source pipe style.** The theme-operations emitter now
  places `|>` at end of previous line (tidyverse style) matching the
  table-ops output.
- **`originalCall` propagates through splits + `forest_plot()`.** Split
  sub-specs inherit the base spec's captured call; `forest_plot()`
  captures its own `match.call()` and passes it via the new internal
  `.original_call` arg to `tabviz()`. The "View source" panel no
  longer falls back to the `tabviz(...)` placeholder in these cases.

### Watermark

- **Color and opacity are now adjustable.** The Watermark settings
  section gains a color swatch and an opacity slider; the `set_watermark()`
  modifier accepts `color` and `opacity` args; `tabviz()` accepts
  `watermark_color` and `watermark_opacity` too. Defaults preserve the
  pre-0.20.1 visuals (inherit foreground, opacity 0.07).

### Column-configure popover

- **Alignment split into Cell / Header.** The segmented control that
  previously edited `align` while being labeled "Header alignment" now
  renders two independent segments: **Cell align** (drives `col@align`)
  and **Header align** (drives `col@headerAlign`, nullable — the
  "inherit" button clears the override).
- **Compact inline rows.** Editor fields switch from stacked
  label-above-control to a single-line `label | control` grid. Makes
  the popover noticeably denser without touching the slot rows
  (already inline).

### Theming

- **Semantic edits now update painted cells.** Editing
  `theme.semantics.accent.fg` (and muted/emphasis) in the Semantics
  tab previously had no effect on painted cells — `CellContent` read
  the palette slot directly. Per-token CSS vars are now emitted from
  the plot container and consumed by cell-level semantic classes, so
  painted cells re-render immediately when the bundle changes.
- **Border controls moved to Spacing.** The border-weight knobs
  (`row_border_width`, `header_border_width`, `row_group_border_width`)
  added in v0.19 moved from the Viz tab to the Spacing tab — they're
  spacing concepts, not viz concepts.
- **"Plot padding" removed from UI.** The field only affected SVG
  export, not the interactive widget, so having it in the Spacing
  tab was confusing. Still configurable via `set_spacing(padding = )`
  in R for SVG exports.

### Known deferred

- Viz-forest's configure popover still uses its own forest-specific
  layout rather than the multi-effect CRUD editor used by
  `viz_bar` / `viz_boxplot` / `viz_violin`. Harmonizing this is
  tracked for a later release.

# tabviz 0.20.0

## Operation recorder + unified "View source"

The in-widget "View source" panel now records non-theme
operations too — resize, add/remove/reorder columns, row
reorder, cell / title / subtitle / caption / footnote edits,
paint stamps, theme switches, watermark changes, and the
split-forest "align column widths" toggle. Every user action
is appended to an incremental log as a fluent R call; the
panel exposes three tabs:

- **Table ops** — the recorded log starting from your original
  `tabviz(...)` call (captured verbatim as of v0.20).
- **Theme** — the current theme snapshot, identical to the
  v0.19 "View theme source" output.
- **Combined** — `mytheme <- [theme chain]; tbl <- tabviz(...,
  theme = mytheme) |> [ops chain]`. Paste into R to reproduce
  the current widget.

Backtracking is deliberate — if you resize a column to 120
then back to 150, both calls appear in order. No attempt is
made to dedupe or compute minimal diffs.

### UI changes

- The "View source" icon lives on the main toolbar between the
  paint button and the reset button (`</>` glyph). The v0.19-era
  "View theme source" icon inside the Settings panel is retired.

### New fluent API

`R/modifiers.R` gains eight verbs that mirror the new recorder
records, so emitted code round-trips cleanly:

- `set_title()`, `set_subtitle()`, `set_caption()`, `set_footnote()` —
  update `spec@labels`; pass `NULL` to clear.
- `set_watermark()` — set or clear the diagonal watermark.
- `paint_row()`, `paint_cell()` — runtime verbs for Shiny proxies.
- `set_shared_column_widths()` — toggle a `SplitForest`'s
  align-widths flag.

### Internal

- `WebSpec` gains an `original_call` property captured via
  `match.call()` at the `tabviz()` entry point; serialized as
  `originalCall` in the widget payload.
- New `srcjs/src/lib/op-recorder.ts` owns R-literal quoting,
  call rendering, and per-op record constructors. All op
  emissions go through it so there's a single grep target
  when the fluent API evolves.
- `forestStore` gets an `opLog` state + `recordOp()` setter;
  `splitForestStore` pipes its split-level ops into the active
  sub-plot's log.
- 27 new bun tests pin the rendered R output for every op type.

# tabviz 0.19.0

## Interactive split widths + text/border controls

Four beta-feedback items, one release.

### Interactive `shared_column_widths` toggle

The split-plot sidebar gains an **Align column widths** checkbox in its
footer. Toggling it recomputes identical per-column widths across every
sub-plot at runtime — no bounce back to R for a rerender. The R arg
still sets the initial state (and still stamps widths server-side so
static SVG exports remain aligned).

### `cell_foreground` palette slot

`set_colors(cell_foreground = …)` lets you tint **data cell text**
without changing column headers, titles, captions, or UI chrome.
Cascades from `foreground` by default, so existing themes render
identically. The Colors tab surfaces a new "Cell text" swatch with a
short description clarifying what `foreground` covers.

### Row-group border now takes effect

`GroupHeaderStyles.levelN_border_bottom = TRUE` previously appeared to
do nothing — the default `.grid-cell` bottom border was already drawn
1px below the group header's inner border, so the two visually
stacked. Fixed: the row-group border is now drawn at the cell edge
(class `.group-row-bordered`), aligned with other row separators, and
its weight is controlled by the new `row_group_border_width` (below).

### Border-weight knobs

`set_shapes()` picks up three new numeric arguments:

- `row_border_width` — the separator between data rows (default 1).
- `header_border_width` — column header underlines, including primary
  / last / plot-header rows (default 2).
- `row_group_border_width` — the border drawn under row-group headers
  when a level toggle is on (default 1).

All three are also exposed in the Viz tab's new **Borders** section.
The SVG exporter honors them so screenshots match the live widget.

### Internal

- `ColorPalette` gains `cell_foreground` (NA = inherit `foreground`).
- `Shapes` gains `row_border_width`, `header_border_width`,
  `row_group_border_width`.
- `SplitForest` gains a `shared_column_widths` property.
- The frontend `SplitForestPayload` gains `sharedColumnWidths` and the
  `SplitForestStore` gains matching state + toggle actions.

# tabviz 0.18.1

## Documentation audit

Full pass over the prose docs to catch up with the features shipped
in 0.15–0.18:

- **Interactivity guide** gains a "Configure Columns (v0.18+)"
  section covering the per-column configure popover, the full CRUD
  viz-effect editor, the Axis sub-section, and the double-click
  shortcut from the axis into the popover.
- **Interactivity guide** already covered paint mode and inline
  title/subtitle/caption/footnote editing (both v0.15+); these
  sections remain.
- **`tabviz()` reference** adds the `shared_column_widths` arg.
- **`split_table()` reference** adds `shared_column_widths` to the
  signature and args table.
- **Interaction reference** clarifies `enable_edit` also gates
  title/subtitle/caption/footnote editing.
- **Cheatsheet** gets a `shared_column_widths` split-plot example.
- `quarto render` clean end-to-end; no stale references to the
  retired Axis theme tab or the old `group_padding` arg.

No code changes — this is a docs-only patch release.

# tabviz 0.18.0

## Multi-effect viz configure + axis cleanup

### viz_bar / viz_boxplot / viz_violin get interactive configure

Previously the three "dynamic-cardinality" viz column types were marked
`authorOnly` and had no interactive configure UI — users had to drop
back to R to edit them. The configure popover now includes a full CRUD
multi-effect editor:

- **Add effect** button inserts a blank row at the end.
- Each effect row shows its data binding(s), label (optional), color
  picker + hex input, opacity. Move-up / move-down / remove buttons
  live in the row header.
- `viz_boxplot` has a "Data shape" selector at the top: choose between
  array-column mode (single `data` field per effect) or precomputed
  stats mode (`min`/`q1`/`median`/`q3`/`max` plus optional
  `outliers`). The selector remembers your pick across sessions.
- `viz_violin` requires a single array `data` field per effect.
- `viz_bar` requires a single `value` field per effect.

The column-header context menu now surfaces "Configure…" for all three
viz types.

### Compact col_* slot rows

Slot-field selectors (Point / Lower / Upper for col_interval, Value for
col_bar, etc.) render as inline `Label: [select]` rows instead of
stacked label + select. Matches the advanced-settings inline idiom.
Required vs optional status shows as a muted trailing tag instead of a
parenthetical so the label reads cleanly at a glance.

### Removed: Axis theme tab

The theme-level Axis tab duplicated per-column settings once v0.17
exposed every axis knob on the viz_forest configure popover. Dropped
from the settings panel. `set_axis()` in R still exists as a
cross-cutting default; the interactive surface is now column-scoped.

### Notes

The authorOnly flag on viz_bar / viz_boxplot / viz_violin
`VisualTypeDef` entries is now honored only by the type picker (users
can't pick these from "Insert column" → type menu without an
`extra_columns` bundle from R). Configure on existing viz columns is
always available.

# tabviz 0.17.0

## Second beta feedback pass + deferred configure work

Follow-up on v0.16's feedback batch. The deferred column configure rework
landed (partially), plus a half-dozen smaller fixes from fresh feedback.

### Column configure — viz_forest gets full axis settings

`viz_forest` columns in the configure popover now expose every axis-level
knob: scale, null_value, axis_label, axis_range (min/max), axis_ticks
(comma-separated list), show_axis, axis_gridlines. Previously only
`scale` was editable interactively; users had to drop to R for the rest.

The Header row was compacted into a single inline strip:
`Header: [ input ] L | C | R  [✓ show]` — header text, alignment
segmented-control, and show-header checkbox all on one line.

viz_bar / viz_boxplot / viz_violin configure still routes through R
(their multi-effect surface doesn't fit the slot-based popover); that's
deferred further.

### Reverted — in-widget Add-label ghost affordances

Reserving empty header/footer slots for the v0.15 "Add title…" /
"Add subtitle…" / "Add caption…" / "Add footnote…" ghosts broke
intentional spacing between the table and whichever labels WERE set.
Reverted: PlotHeader and PlotFooter render only when a label is
present. Existing labels keep double-click editing; labels are added
via the Basics settings tab (where the four text fields already live).

### Fixed

- **Header background dark-mode bleed-through.** `ColorPalette@header_bg`
  defaulted to `"#ffffff"` in R, so every preset — including dark
  variants — serialized a white column-header bg over its dark row bg.
  Changed default to `NA_character_`; the serializer resolves `NA`
  to `row_bg` at emit time, giving every preset a palette-appropriate
  header band.
- **Row-group padding was horizontal.** v0.16 applied
  `spacing.row_group_padding` as horizontal padding, but user intent was
  *vertical* separation above each group header — breathing room
  between the previous rows and the next group label. Now applied as
  `padding-top` that stacks with `cell_padding_y`, and skipped for the
  first row so a group header directly below the column-header row
  doesn't get extra top gap.
- **plot_padding + container_padding compounded.** Two padding knobs
  with overlapping scope produced double gutters in the interactive
  widget. Kept `container_padding` as the single outer-gutter control
  for the live widget; `plot_padding` stays SVG-export-only (its
  historical role). UI hint updated in the Spacing tab.
- **Auto-column widths stale after theme/spacing changes.** Switching
  preset or editing typography / spacing / shapes in the panel left
  columns sized from the initial-mount measurement. `setTheme`,
  `setThemeObject`, and `setThemeField` (when editing a
  width-affecting section) now invalidate cached widths and re-run
  `measureAutoColumns()`.
- **Row-group background vs banding overlap.** When banding paints a
  level's row bg (group-mode or explicit `group-N`), that level's
  Background control in the Row groups tab is now disabled with a
  "Set by banding — change in Basics" chip, so users don't chase
  ghost edits.

# tabviz 0.16.0

## Beta feedback pass

Many users now on beta; feedback arrived in bulk. Covered in this release:

### Fixed

- **Paint chip white-on-white (#3).** The selected token chip in the paint
  popover used forced-white text on a primary-tinted transparent bg — which
  bled to near-white against the popover's bg in light themes. Switched to
  primary-color text on a pale primary tint; the same fix applies to the
  scope segmented-button.
- **Reset / Copy-code popups unresponsive (#2).** Added explicit
  `z-index` + `pointer-events: auto` on the modal card so host-page styles
  can't push the backdrop above the card.
- **Plot padding slider did nothing (#6).** The `--wf-padding` CSS var
  was emitted but no interactive rule consumed it. Applied as inner
  padding on `.tabviz-scalable`; interactive now matches SVG export.
- **`colors.row_bg` did nothing, `background` controlled row bg (#15a).**
  `.grid-cell` was reading `--wf-bg` (container) instead of `--wf-row-bg`.
  Changed to `var(--wf-row-bg, var(--wf-bg))`.
- **Boxplot/violin ignored theme shapes (#13).** `viz_boxplot` outline +
  outlier sizing and `viz_violin` outline/median/quartile strokes now read
  from `theme.shapes.lineWidth` and `theme.shapes.pointSize`.
- **Paint select-row collision (#9).** Entering paint mode clears any
  prior row selection so the selected tint doesn't fight painted bg.
- **Paint icon harder to spot when on (#10).** Active paint button now
  uses the accent palette slot at full saturation with a soft glow,
  distinct from the ambient primary tint used elsewhere on the toolbar.
- **Semantics tab edits appeared dead (#11).** Edits were correctly
  writing through; the confusion was that users edited a token with no
  matching flagged rows. Added a live row-count indicator and "No rows
  flagged — use the paint tool or row_* in R" hint per section.

### New

- **Row-groups settings tab (#12a).** Per-level (1/2/3) font size, weight,
  italic, background, border, plus indent_per_level — previously R-only.
- **`colors.header_bg` palette slot (#15b).** Tint the column-header row
  distinct from data rows. Cascades from `row_bg` when unset, so existing
  themes render identically.
- **`tabviz(split_by = ..., shared_column_widths = TRUE)` (#18).** Every
  sub-plot renders with the same per-column widths, computed once from
  the combined data. Default `FALSE`. Makes stacked screenshots
  (PowerPoint / slides) line up cleanly.
- **`spacing.column_group_padding` + `spacing.row_group_padding` (#1).**
  Split from the old `group_padding` (which only ever affected column
  groups). Old name still accepted with `lifecycle::deprecate_warn` —
  forwards to `column_group_padding`.
- **Custom TabSelect component (#4).** Themed trigger + listbox popover
  replaces the native `<select>` for the settings tab chooser.
- **"Shapes" → "Viz" tab (#12b).** Tab label only; R `set_shapes()`
  unchanged.

### UX polish

- **Ghost Add-label affordances on hover only (#8).** The "Add title…" /
  "Add subtitle…" / "Add caption…" / "Add footnote…" placeholders now
  fade in on header/footer hover or focus-within and stay invisible
  otherwise. Beta feedback: the always-visible 35%-opacity ghosts were
  distracting in published widgets.
- **R `row_bg = <col|formula>` and per-column `bg = <col>`.** These
  existed in the API but weren't documented well. Now reliably wired
  through to both interactive + SVG export paths (row) and CellContent +
  data-cell backgrounds (cell).

### Deferred to v0.17

- Column configure popover rework (#5, #7, #14, #17): compact layout,
  full per-type args, configure access for viz columns, axis settings
  moved into the per-column popover, double-click axis to open
  configure. Scoped for the next release — too large to land here
  without rushing.

# tabviz 0.15.0

## Interactive authoring pass

Widget chrome and settings-panel UX got tightened across the board based on
beta feedback.

### New: edit plot labels in the widget

Title, subtitle, caption, and footnote are now editable in two places:

- **Double-click** any existing label in the widget to rename it (or press
  Enter / F2 when focused). When `interaction.enableEdit` is on and a label is
  absent, a faded "Add title…" / "Add subtitle…" / "Add caption…" /
  "Add footnote…" affordance appears in its slot — clicking it opens the same
  inline editor.
- The **Basics** tab in the settings panel gains four text fields (Title,
  Subtitle, Caption, Footnote) that share the same state.

Session edits round-trip through `exportSpec` so `save_plot()` picks them up.

### New: paint tool for semantic classes

A new **paint-brush** button on the toolbar opens a small popover with three
token chips — Emphasis / Muted / Accent — and a Row / Cell scope toggle.
Pick a token, then click rows or cells to stamp the matching semantic flag
onto them. Clicking the same row/cell again clears the flag. Escape exits
paint mode; "Clear paint" wipes all session overrides.

Painted state merges into `visibleRows` and `exportSpec`, so the interactive
widget, `save_plot()`, and (future) view-source all see the same flags.
Paint coexists with R-supplied `row_emphasis = <col>` etc.: the column sets
the baseline, paint overrides per row.

### Compact widget chrome

- **Toolbar shrunk** from 32 × 32 buttons with 16 px icons down to 22 × 22
  with 13 px icons, moved to `top: 2px; right: 4px`. The toolbar now sits at
  roughly the same height as the title row rather than bleeding into data.
- **Settings tabs** replaced the horizontal scroll strip with a compact
  native `<select>`. Removed the fade-indicator plumbing; no more missed
  tabs at narrow panel widths.
- **Settings content** tightened: inline label + input rows, hints moved
  from a second line to `title=""` tooltips, smaller swatches (20 → 18 px),
  tighter section spacing. Roughly doubles the number of controls visible
  without scrolling in a 320–440 px panel.

### Fixed: Reset / theme-switch confirm dialogs

Clicking "Yes" on the Reset-all-edits confirm or the theme-switch confirm
used to occasionally do nothing. The store mutation and the dialog close
were happening in the same synchronous frame; under Svelte 5's fine-grained
reactivity that sometimes raced with the portal unmount effect, leaving the
widget showing the pre-reset state. Both `confirmReset` (SettingsPanel) and
`confirmPendingSwap` (ThemeSwitcher) now defer the close via
`queueMicrotask` so the store mutation flushes first.

# tabviz 0.14.0

## Theme audit: bug fixes, dead-field cleanup, accessibility

Systematic walk-through of every theme field flushed out eight real bugs plus
a handful of fields that had been declared, serialized, and exposed in the UI
but never consumed by any rendering code. All fixed or removed.

### Bug fixes

- **Semantic bundle in static export.** `svg-generator.ts` now consumes the
  resolved `SemanticBundle` for cell text fg / font-weight / font-style, so
  a cell in a `row_emphasis` / `row_muted` / `row_accent` row picks up the
  bundle's values instead of reaching directly into `theme.colors.{muted,
  accent}`. The interactive path already did this; static PNG/SVG export
  was out of sync.
- **`semantics.<token>.border` in static export.** Was rendered in the live
  widget but dropped in SVG. Now drawn as a bottom-edge line under the row.
- **`colors.summary_fill` for per-row summary diamonds.** Rows flagged via
  `row_type = "summary"` used to render their diamond from the effect-color
  cascade and silently ignored `colors.summary_fill`. Both paths (interactive
  and static) now honor it.
- **`axis.gridlines` / `gridline_style` in the forest axis.** Previously only
  rendered for viz-column axes (bar / boxplot / violin). The forest plot's own
  axis now draws gridlines when enabled, with the chosen dash style.
- **`set_effect_colors(theme, "#ff00ff")`.** Single-element vectors serialized
  as JSON strings (via `auto_unbox = TRUE`), and the frontend then indexed
  them one character at a time — producing near-black markers. `effect_colors`
  and `axis.tick_values` are now wrapped in `I()` to preserve arrays.

### Dead fields removed

These fields had no rendering consumers. They are gone from R classes, JSON
serialization, TypeScript types, settings-panel UI, and preset definitions:

- `spacing.section_gap`, `spacing.column_gap`
- `layout.plot_position`, `layout.table_width`
- `colors.interval_positive` / `interval_negative` / `interval_neutral`

`set_colors()` still accepts `ci_marker_positive` / `ci_marker_negative` /
`ci_marker_neutral` (plus their `interval_*` aliases) for back-compat but
emits a `lifecycle::deprecate_warn()` and discards the value. Use
`marker_color` in [viz_forest()] to color markers by direction, or a per-
effect literal color on the effect spec.

`tabviz(plot_position = ...)` and `render_tabviz_widget(plot_position = ...)`
similarly accept the argument for back-compat and warn; placement is
controlled by the order of `columns = list(...)`.

### Accessibility

Zero Svelte a11y warnings from the build. The multi-cell row layout uses the
primary cell as the keyboard-interactive surface and marks sibling cells as
`role="presentation"`; dblclick-to-edit on column-group headers now has
Enter / F2 keyboard parity.

### Documentation

`docs/reference/themes.qmd` and `docs/guide/themes.qmd` updated to reflect
the removed fields, document the marker-fill precedence chain, and flag
scope ambiguities (`group_padding` applies to column groups, not row groups;
`colors.interval` is a third-tier fallback preempted by
`shapes.effect_colors[0]`).

# tabviz 0.13.0

## Semantic classes become visual bundles

Beta feedback made it clear that the semantic classes (`row_emphasis`,
`row_muted`, `row_accent` + their cell-level counterparts) were under-powered.
They only toggled text color and weight; users asked for control over
backgrounds, borders, and marker fills too, and complained that names like
"accent" felt conflated with palette slots.

This release splits the two layers: `ColorPalette` stays as *palette inputs*
(the colors a theme brings to the table), and a new `Semantics` theme object
attaches each semantic token to a full visual bundle.

## New features

* **`SemanticBundle` S7 class** — per-token bundle with six optional fields:
  `fg`, `bg`, `border`, `marker_fill`, `font_weight`, `font_style`. `NA` on
  any field means "inherit / don't override"; a bundle can opt in to just
  the properties it cares about.

* **`Semantics` S7 class** on every `WebTheme`, exposing bundles for
  `emphasis`, `muted`, and `accent`. Defaults are derived from each preset's
  own palette + typography (via the new `default_semantics_for()` helper),
  so emphasized rows in `web_theme_jama()` now use JAMA's foreground rather
  than the shared default theme's.

* **`set_semantics()` fluent modifier** — accepts named-list overrides per
  token, e.g. `set_semantics(emphasis = list(bg = "#fefce8", font_weight = 700))`.
  Only the fields you mention change; everything else keeps the theme's
  defaults.

* **Settings panel: new `Semantics` tab** — slotted between *Colors* and
  *Typography*. Each of the three tokens gets a section with six
  `OptionalField`-wrapped controls (colors / weight / style). Each field has
  an "Inherit" checkbox that toggles between the theme default and an
  explicit value. Edits round-trip through `View source` as
  `set_semantics(<token> = list(...))`.

## Rendering migration

* **Single source of truth for bundle resolution** — `srcjs/src/lib/semantic-styling.ts`
  exposes `resolveSemanticBundle()`, consumed by both the live widget and the
  static SVG exporter. Bundle-based rendering replaces the three hardcoded
  paths that previously reached into `theme.colors.{accent|foreground|muted}`
  directly (`ForestPlot.svelte`, `svg-generator.ts`, `marker-styling.ts`).

* **Defaults mirror pre-0.13 rendering** — the initial bundle for each token
  is derived from the theme's palette in the same way the old hardcoded path
  did, so widgets that don't touch `set_semantics()` render identically to
  pre-migration. Visual regression suite confirms no shift in 35 rendered
  examples.

* **Bundles now drive more than color** — setting `bg` puts a row/cell
  background behind every semantically-classed row (both in the live widget
  and in static PNG/SVG export); `border` paints a bottom rule; `marker_fill`
  cascades into the forest / bar / boxplot / violin marker fills. These were
  not available before this release.

## Internals

* **`OptionalField.svelte`** — new small wrapper primitive composing an
  "Inherit" checkbox with any child field, for `null`-aware bundle editing.
  Ready to be reused by future theme sections with nullable properties.

* **Immutable spec updates for nested edits.** `setSemanticField()` in the
  store walks a fresh reference at every level from `spec` down to the
  changed bundle field, so Svelte 5's fine-grained reactivity invalidates
  every `$derived` that reads through `spec.theme` — avoiding a subtle
  reactivity bug where deep mutations wouldn't invalidate ancestor-level
  readers in the `ForestPlot` row loop.

## Breaking changes

Additive only: new `theme@semantics` property, new `set_semantics()` modifier,
new `theme.semantics` nested object in the serialized payload. No existing
code paths change behavior; package is experimental and this is the
foundation for future work around stock-theme tuning and a
semantic-reference docs page.

# tabviz 0.12.2

## UX

* **Horizontal scroll hint on the Settings tab bar.** v0.12.1's scroll hint fixed vertical-body discoverability; beta feedback was actually about the *tab strip* scrolling horizontally when all seven tab labels don't fit. The bar now renders subtle left / right fades that appear only on the sides with hidden tabs — mirroring the body's bottom-fade pattern. Hides when scrolled all the way to that end.

# tabviz 0.12.1

## UX

* **Settings panel: "Banding" tab renamed to "Basics", now covers banding + watermark.** The first tab was named after a single control; grouping table-wide display concerns under a broader "Basics" heading leaves room for future additions (row numbering, empty-state text, …) in the same tab.

* **Watermark is editable from the Basics tab.** Text field at the top of the tab body. Empty value clears the watermark (matches `tabviz(watermark = NULL)`). Reset restores whatever the R caller originally supplied (empty or the original `watermark = "DRAFT"` string) — not just emptied unconditionally.

* **Explicit close (×) button back in the bar.** Beta feedback: users didn't discover that backdrop click / Escape / re-clicking the toolbar gear all dismissed the panel. An icon-only close button now sits at the far right of the bar alongside View source / Reset. All four dismissal paths remain functional.

* **Scroll hint fade.** Beta feedback: users didn't realize the panel body was scrollable when content overflowed. The body now renders a subtle theme-aware gradient at the bottom edge that appears only when there's more content below the fold, and fades out when the user reaches the bottom.

## Bug fixes

* **Panel Reset now correctly restores R-side theme customizations.** The Settings panel's Reset button called `resetThemeEdits()`, which was still snapping the theme back to `THEME_PRESETS[baseThemeName]` — the raw preset — silently dropping any customization baked into the spec via `web_theme_modern() |> set_spacing(...)`. Fixed to use the `initialTheme` snapshot introduced in v0.10.4 for `resetState()`, so both reset paths are now equally faithful.

# tabviz 0.12.0

## New features

* **Shapes tab in the Settings panel.** Two sections: *Sizes* (point size, summary diamond height, CI line width, border radius — all `NumberField` sliders) and *Effect palette* (`ColorField` per slot, so users can recolor any palette index in place). Round-trips as `set_shapes(...)` in the "View source" export.

* **Axis tab in the Settings panel.** Four sections: *Range* (rangeMin / rangeMax as optional text fields with `"auto"` placeholder, plus ciClipFactor slider), *Ticks* (tickCount with auto), *Gridlines* (on/off toggle + solid/dashed/dotted segmented picker), *Behavior* (includeNull / nullTick / markerMargin toggles plus a three-state Symmetric segmented: Auto / On / Off). Round-trips as `set_axis(...)`.

* **Layout tab in the Settings panel.** Three sections: *Plot position* (Left / Right segmented), *Dimensions* (table width / plot width as auto-or-px text fields), *Container* (border toggle + border radius slider). Banding stays in its own tab. Round-trips as `set_layout(...)`.

All seven Settings tabs now ship real controls — `Banding`, `Colors`, `Typography`, `Spacing`, `Shapes`, `Axis`, `Layout` — mirroring the R theme surface (`set_colors()`, `set_typography()`, `set_spacing()`, `set_shapes()`, `set_axis()`, `set_layout()`, plus the dedicated banding grammar).

## Internals

* **Two new field primitives.** `BooleanField.svelte` (label + toggle switch, `role="switch"` with the proper `aria-checked`) and `SegmentedField.svelte` (label + N-option radiogroup with TypeScript generics so the value type is preserved end-to-end). Both follow the same 2-column grid layout as the existing `ColorField` / `NumberField` / `TextField` primitives.

# tabviz 0.11.0

## New features

* **Typography tab in the Settings panel.** Four sections — Font family, Sizes (small / base / large), Weights (normal / medium / bold, 100–900 step 100), Metrics (line height, header scale) — with live-updating controls. Writes flow through the same `setThemeField` path as Colors, so the "View source" export picks them up as `set_typography(...)` automatically.

* **Spacing tab in the Settings panel.** Three sections — Rows (row height, header height), Cell padding (horizontal, vertical), Gaps & container (section / axis / column / group / plot / container) — all as `NumberField` sliders with live px readouts. Round-trips as `set_spacing(...)` in the source export.

## UX

* **Settings panel: single-line header bar.** The former three-row chrome (title+close header, tab strip, footer with Reset / View source) has been collapsed into one ~40px row: `SETTINGS | ⎘ ↻ | Banding Colors Typography …`. The global actions (View source, Reset) moved into the bar as icon-only ghost buttons with tooltips; the footer is gone. Saves ~78px of vertical chrome — the tab body now gets roughly 2× the scroll area on a 300px-tall widget. Backdrop click, Escape, and re-clicking the toolbar gear all still dismiss the panel (the explicit close X was redundant and has been removed).

## Internals

* **New `NumberField` / `TextField` field primitives** in `srcjs/src/components/ui/`, mirroring the existing `ColorField` pattern. Used by the new Typography and Spacing tabs and ready for the remaining stubbed tabs (Shapes, Axis, Layout) to reuse in subsequent releases.

# tabviz 0.10.4

## Bug fixes

* **Reset now preserves R-side theme customizations.** `0.10.3`'s reset restored the theme from `THEME_PRESETS[baseThemeName]` — the raw preset — which silently dropped any customization baked into the spec's theme (e.g. `web_theme_modern() |> set_spacing(row_height = 40) |> set_typography(font_size_base = "14pt")`). Post-reset, font sizes and vertical spacing drifted back to the preset's defaults. The store now snapshots the incoming theme at spec / preset / custom-swap time and resets to *that* snapshot, so reset produces a widget that looks byte-for-byte identical to the initial mount.

* **Theme cloning hardened.** All deep clones of theme objects now go through a single `cloneTheme()` helper using JSON round-trip. `structuredClone()` was throwing `DataCloneError` when invoked on Svelte 5 `$state`-wrapped themes — themes are strictly JSON-safe plain data, so the round-trip is lossless and avoids the proxy trap.

# tabviz 0.10.3

## Bug fixes

* **Reset button no longer shifts the layout.** `resetState()` cleared `columnWidths` without re-running `measureAutoColumns()`, so the renderer fell through to `DEFAULT_COLUMN_WIDTH = 100` for every auto-sized column — producing a subtle layout shift on-screen *and* contaminating `save_plot()` / SVG exports (which read `columnWidths` via `getExportDimensions()`). Reset now re-measures and restores the theme from the active preset, so the widget post-reset looks and exports identically to a fresh mount.

* **Reset is now comprehensive.** The previous implementation forgot to clear multi-column `filters`, row/column reorder overrides, cell edits, and all the 0.10 additions (theme edits, banding override, banding-phase override). Reset is now documented with an explicit policy and covers every piece of user-modified runtime state.

* **Banding defaults to `"row"` on group-less data.** The R default is `"group"`, which silently fell back to row-level inside `computeBandIndexes()` when no groups existed — but left the settings panel showing "Group" as the active mode, confusing users. A coercion at spec init now makes the stored value match what's actually rendered.

* **ConfirmDialog hardened against double-fires.** The dialog now tracks a `resolving` flag that's reset on open, preventing a double-click or Enter-while-clicking from firing the confirm action twice.

## UX

* **Settings panel: "Groupings" → "Banding".** The tab only controls banding (mode, level, phase); the new name is more accurate and will coexist cleanly with a future dedicated "Rows" or "Groups" tab covering group-header styles and collapse defaults.

# tabviz 0.10.2

## Documentation

* **README: fix broken doc URLs.** `gallery.html`, `cookbook.html`, and `reference.html` returned 404 on the docs site — updated to the actual paths (`gallery/`, `guide/recipes.html`, `reference/`). Clears the corresponding `R CMD check --as-cran` URL NOTE.

# tabviz 0.10.1

## Bug fixes

* **Theme switcher now works in htmlwidget host environments.** `0.10.0` added a "Discard theme edits?" confirmation that used `window.confirm()` — but the RStudio viewer and some sandboxed Quarto / Shiny contexts auto-dismiss native browser dialogs, which silently aborted every theme swap (the dialog was never shown to the user; `window.confirm` just returned `false`, taking the "user canceled" branch). Replaced with an in-widget `<ConfirmDialog>` rendered via the `<Portal>` primitive, so confirmation works identically across all host environments. Same treatment for the Settings panel's **Reset** button.

# tabviz 0.10.0

## New features

* **Group-aware row banding with a proper grammar.** `tabviz(banding = ...)` and `set_layout(banding = ...)` now accept `"none"`, `"row"`, `"group"` (default), or `"group-n"` (where `n` is a group depth, 1-indexed from the outermost level). `"group"` alternates backgrounds at the deepest group level so each group reads as one continuous band — header and member rows share the same color — rather than striping every other row regardless of group boundaries. Defaults to BABA phase (first group banded) for visual separation from section headers above. When no groups are present, `"group"` falls back to row-level banding. The previous boolean `banding = TRUE/FALSE` is no longer accepted; a clear error points at the new grammar.

* **In-widget Settings panel (gear icon).** A new gear button on the toolbar opens a slide-in panel at ~40% width anchored to the widget's right edge. Tabbed layout (*Groupings*, *Colors*, plus stubs for *Typography* / *Spacing* / *Shapes* / *Axis* / *Layout* in subsequent releases) mirrors the R theme object structure — each tab maps to a `set_*()` modifier. The *Groupings* tab exposes banding mode, group level, and ABAB/BABA phase. The *Colors* tab provides swatch + hex controls for every field on `ColorPalette` (base / rows / intervals / summary). Edits apply live to the widget and can be copied out as an idiomatic R `set_*()` chain via the **View source** button — the natural payoff for iterating to a custom look.

## Internals

* **`<Portal>` primitive** for popovers (theme switcher, zoom panel, download menu, theme-source modal). Renders children into `document.body` so `position: fixed` is immune to ancestor `transform` / `filter` / `backdrop-filter` / `contain` / `will-change` — properties that silently break viewport-relative placement. Sidesteps a class of rendering bugs without requiring the toolbar CSS to stay containing-block-free forever.

* **Unified banding engine.** `computeBandIndexes()` in `$lib/banding.ts` is the single source of truth for which display row gets which band color, and is consumed by both the live Svelte widget and the static `save_plot()` / `render_visual_tests()` SVG export path — no divergence between interactive and exported views.

# tabviz 0.9.3

## New features

* **Optional table watermark via `tabviz(watermark = "...")`.** Pass any string (e.g. `"DRAFT"`, `"CONFIDENTIAL"`, `"PREVIEW"`) to render a subtle watermark behind the table rows. The text is centered on the rows region and rotated to follow that region's diagonal, so the angle adapts to the table's aspect ratio — wide tables get a shallow angle, tall tables a steep one. Theme-aware (uses the foreground color at low opacity); font size auto-fits to span ~70% of the diagonal, clamped to a sensible range. Renders identically in the web view and in `save_plot()` exports. `NULL` (default) draws no watermark.

# tabviz 0.9.2

## Bug fixes

* **`save_plot()` viz columns now expand to fill the requested canvas width.** When `viz_forest`, `viz_bar`, `viz_boxplot`, or `viz_violin` was used with `width = "auto"` (the default), `calculateSvgAutoWidths()` was pinning the column to its natural-min width (~200px) even when the caller asked for a 1600px export, leaving empty space on the right. Auto-width viz columns are now skipped during the natural-width pass and fall through to the expand-to-fill `layout.forestWidth` value, matching the web view. The `hasForestColumns` check that gates `forestWidth > 0` was also widened so a canvas with no forest column but a viz_bar / viz_boxplot / viz_violin still gets a non-zero plot area. User-resized widths from the web view (via `options.columnWidths`) and explicit `width = <number>` arguments are unaffected.

## Documentation

* **New guide page: Visualization Styling.** Documents the 4-layer marker color cascade (theme palette -> per-effect literal -> row semantic class -> per-row `marker_color`) with rendered examples across `viz_forest`, `viz_bar`, `viz_boxplot`, and `viz_violin`. Includes the single-effect (fill replacement) vs multi-effect (outline augment) behavior, NA-passthrough on `marker_color` formulas, and a combined-precedence demo showing all layers interacting on one plot. Cross-linked from each viz reference page.
* **De-emphasize the fluent API in the mainline guide.** The Row Styling, Cell Styling, and Themes pages no longer chain `set_*()` modifiers via the pipe in their primary examples; argument-based `tabviz()` / column-constructor / stepwise `set_*()` forms are used throughout. The fluent API remains fully supported (and is still showcased in `guide/fluent-api.qmd`) — pipe-friendly equivalents are now cross-referenced from a callout on each affected page rather than mixed into the main flow.
* **Themes guide: rendered swatch table.** The "Built-in Theme Palettes" section previously listed effect colors as inline backtick-formatted hex codes. It now generates an HTML swatch table directly from each theme's actual `shapes@effect_colors` slot — change a theme and the palette display updates automatically.

# tabviz 0.9.1

## Bug fixes

* **Document `ColumnSpec` slots `style_tooltip` and `formatter`.** Both slots were added in 0.9.0 but the `@param` entries were missing from the `ColumnSpec` roxygen block, producing an R CMD check WARNING. Doc-only fix; no behavior change.

# tabviz 0.9.0

## New features

* **Row semantic classes (`row_accent` / `row_emphasis` / `row_muted`) now cascade into viz cells.** Previously, declaring a row "special" via these classes only restyled the row's text — the forest marker, bar, box, or violin in that row kept its default per-effect color until you also wired in a literal `marker_color`. The classes now reach into all four viz column types automatically, with a single vs multi-effect rule:
  - **Single-effect viz** (one effect per column): the row's marker / bar / box / violin **fill** is replaced with the theme's accent / foreground / muted color.
  - **Multi-effect viz** (≥2 effects per column): per-effect color is **preserved** (so visual encoding survives), and an **outline** in the theme color is added around each glyph in that row.
  
  The four-layer precedence stack for marker color is now: `marker_color` (per-row literal, NA passes through) → row semantic class → per-effect literal → theme palette. Formulas are supported at every layer (e.g. `row_accent = ~ pval < 0.05`, `marker_color = ~ ifelse(pval < 0.001, "darkred", NA)`). See `gallery_17`–`gallery_21` for rendered examples covering forest, bar, boxplot, violin, and the precedence/NA-passthrough behavior.

* **`viz_bar()`, `viz_boxplot()`, and `viz_violin()` now support `annotations` and `null_value`.** Pass `annotations = list(refline(x, ...))` to draw vertical reference lines on any viz column (matching `viz_forest()`). `null_value = <number>` is a convenience shorthand that prepends a dashed reference line at that x — useful for marking a baseline (`null_value = 0` on a bar chart), a target threshold, or a clinical cutoff on box / violin plots. `forest_annotation()` (per-row glyphs) remains forest-specific.
* **`forest_annotation()` is now fully rendered.** Graduated from experimental in 0.9.0 — the per-row glyph annotation (circle / square / triangle / star, positioned `before` / `after` / `overlay` of the marker) renders in both the htmlwidget and the SVG/PNG export. Pass alongside `refline()` in `viz_forest(annotations = list(...))`. See the new `gallery_07_annotations.R` example for both annotation types together.
* **Per-row marker styling now applies to non-forest viz columns.** `tabviz(marker_color = "color_col")` and `marker_opacity = "opacity_col"` now drive `viz_bar`, `viz_boxplot`, and `viz_violin` cell colors as well as forest markers — useful for coloring bars by significance, distributions by group, etc. When set, the row-level value overrides any per-effect color/opacity for all glyphs in that row. `marker_shape` and `marker_size` remain forest-specific (the forest marker is the only shape-and-size-variant glyph).
* **Curate the interactive theme switcher with named labels, a session-wide default, and a fluent verb.** `web_interaction(enable_themes = ...)` now accepts named list entries to override each theme's displayed label (e.g. `list(Classical = web_theme_jama(), Modern = web_theme_modern())`), and its default reads from `getOption("tabviz.enable_themes", "default")` so a curated list can be set once per session. The spec's active `theme` is auto-included so users can always revert. New fluent modifier `selectable_themes()` mirrors the argument — chain it after `tabviz()` / `set_theme()` for post-hoc edits.

## API changes

* **`effect_boxplot()` and `effect_violin()` use `opacity` everywhere.** The user-facing argument was renamed from `fill_opacity` → `opacity` in 0.9.0 to match `effect_forest()` / `effect_bar()`. This release completes the migration: the underlying S7 slot is now `@opacity` (was `@fill_opacity`) and the JSON wire format writes `opacity` (was `fillOpacity`). The deprecated `fill_opacity` argument still works with a warning. JS readers fall back to the old `fillOpacity` JSON key for one release for compatibility with cached snapshots.
* **`viz_*()` documentation updated.** `@param ...` blocks now explain that named styling args (`bold`, `italic`, `color`, `bg`, etc.) flow through to `web_col()` alongside the positional `effect_*()` items. `na_text`, `tooltip`, and `formatter` are documented as no-ops on viz columns. `sortable = FALSE` is now noted explicitly. The stale `viz_bar(header_align = "left")` claim in the docstring (the actual default is `"center"`) is corrected.

## Breaking changes

* **All shipped themes now default to full interactivity.** `default_interaction_for_theme()` previously dispatched `jama`, `lancet`, `cochrane`, and `minimal` themes to `web_interaction_publication()` (everything off). It now returns `web_interaction_full()` for every theme, so `tabviz(..., theme = web_theme_jama())` — or switching themes interactively — no longer silently disables sort / resize / edit / reorder. Pass `interaction = web_interaction_publication()` explicitly to restore the print-clean behaviour.

## Bug fixes

* **Viz axis no longer drifts below the last row in SVG/PNG exports.** `save_plot()` placed `viz_bar` / `viz_boxplot` / `viz_violin` axis strips at `plotY + plotHeight`, which included a 1.5×rowHeight phantom overall-summary inflation whenever `spec.data.overall` was truthy. The forest axis used `rowsHeight` directly and was unaffected. Both paths now share the same formula.
* **Resize handle on non-forest viz columns no longer snaps to the 40px minimum on drag start.** `vizDefaultWidth` fell back to `layout.forestWidth` (0 when no forest column is present), so the first `pointermove` clamped to the minimum. The handle now uses the same width resolution chain as the render path: `columnWidths[id] ?? col.width ?? layout.forestWidth`.

# tabviz 0.8.0

## Breaking changes

* **Viz columns now show their header by default.** `viz_forest()`, `viz_bar()`, `viz_boxplot()`, and `viz_violin()` all default to `show_header = TRUE` (previously `FALSE`). Each viz helper also takes a new `header_align` argument with a type-appropriate default: `"center"` for `viz_forest`, `viz_boxplot`, and `viz_violin` (symmetric-around-null marks), `"left"` for `viz_bar` (bars grow left-to-right). Pass `show_header = FALSE` to restore the previous axis-only look. Header-text widths are now measured into fixed-width viz columns in both the browser and the SVG export path, so opting in won't silently truncate under themes with larger header fonts.
* **`web_interaction()` now defaults to full interactivity.** `enable_filters`, `enable_reorder_rows`, `enable_reorder_columns`, and `enable_edit` now default to `TRUE`. This matches `web_interaction_full()`, which remains available as a named helper. Callers that want the previous opt-in behavior should pass the flags explicitly (or use `web_interaction_minimal()` / `web_interaction_publication()`). Theme-based default dispatch via `default_interaction_for_theme()` is unchanged — publication-style themes still get the quiet preset.

## Bug fixes

* **Forest markers render correctly when multiple widgets share a page.** Viz column `<clipPath>` IDs were derived from `column.id` alone (e.g. `viz-clip-_forest_hr`), so a gallery page or Quarto report with several forest plots ended up with duplicate IDs. Browsers resolve `url(#…)` to the first match in the document, which meant later widgets got clipped against the first widget's (often smaller) clip rect — typically showing only the top row's marker. Clip IDs are now scoped to a per-widget random suffix.
* **Header alignment follows body alignment by default.** Right-aligned numeric bodies now get right-aligned headers; centered icon / badge / stars bodies get centered headers — uniformly in the browser and in SVG export. Previously the browser and svg-generator both had a viz-specific "always center" override that contradicted `ColumnHeaders.svelte`, and numeric headers rendered left while their columns were right-aligned. Override per column with `header_align = "..."`.
* **Exported table height no longer reserves ~76px of unused axis strip** when the table has no viz column at all. Pure tabular exports via `save_plot()` used to truncate by exactly that amount.
* **Theme change no longer wipes interactive column edits.** Using the theme switcher with a custom `enable_themes = list(...)` list went through `setSpec()`, which cleared user-driven inserts / hides / `updateColumn()` overrides as a side effect. Theme swaps now go through a dedicated `setThemeObject()` store method that only touches `spec.theme`.
* **Sort chevron is measured into header auto-width.** Sortable columns reserve ~16px for the sort glyph up front, so headers no longer truncate the first time a user clicks to sort.

## Version check

* New once-per-day, fail-silent check: when you call `tabviz()` interactively and a newer minor version exists on CRAN or GitHub, you get a single cli message with the install command. Cached under `tools::R_user_dir("tabviz", "cache")` so the network is hit at most once every 24h.
* Opt out with `options(tabviz.check_updates = FALSE)` or `Sys.setenv(TABVIZ_NO_UPDATE_CHECK = "1")`. Suppressed automatically in non-interactive sessions, CI, `testthat`, and R CMD check.

## Pan & zoom on viz columns

* **Mouse wheel, drag, double-click** to inspect any visualization column at arbitrary scale. Wheel zooms in/out around the cursor, click-and-drag pans, double-click resets to the default domain. Applies to `viz_forest`, `viz_bar`, `viz_boxplot`, and `viz_violin`.
* **Per-column state.** Two forest columns side-by-side can be zoomed independently; each column keeps its own effective domain.
* **WYSIWYG export.** Zoom/pan state is plumbed through `PrecomputedLayout` to the SVG/PNG export path — `save_plot()` (and the in-widget download button) captures exactly what you see in the browser, including boundary arrows when CIs extend past the zoomed window and clipped marks on the non-forest viz types.
* **Log-scale safe.** On `scale = "log"` forests the interaction rejects gestures that would push the lower bound to zero or below.
* **Session-only.** No R-side arguments, no Shiny round-trip — refreshing resets all columns to their default domains.

### Implementation notes

* New `axisZooms` map in `forestStore.svelte.ts` keyed by column id; `getEffectiveDomain()` substitutes the override anywhere a scale is built. Ticks regenerate from the zoomed domain so axis labels stay readable.
* New `zoomable` Svelte action in `srcjs/src/lib/zoom-interactions.ts` — scale-agnostic, handles linear vs log in the same code path.
* SVG `<clipPath>` is emitted per viz cell in both the Svelte renderer and `svg-generator.ts`, so marks that fall outside the zoomed window are clipped identically in the browser and in exports.
* `PrecomputedLayout` gains a sibling `vizColumns[]` array alongside the existing `forestColumns[]`, carrying per-column `xDomain` / `clipBounds`.

## Column editor UX

* **Type picker is now a cascading dropdown, not a chip grid.** Right-click → Insert column after… opens a compact menu: *Text* (leaf) / *Numbers* ▸ / *Composite* ▸ / *Visual* ▸ / *Icons* ▸. Visual types are split into *Simple* (bar, fill bar, sparkline, heatmap, stars) and *Complex* (forest plot) subgroups. Submenus open on hover with a short delay, or on click, and flip to the left when near the viewport edge.
* **Numeric presets baked into the menu.** *Number / Integer / Percent / Currency / P-value* each seed the editor with sensible defaults (e.g. Integer → `decimals: 0`, Percent → `suffix: "%"`, Currency → `prefix: "$"`) so most inserts commit in one or two clicks.
* **Editor popover is trimmed** — the Step-1 type grid is gone; what remains is just the field slots and type-specific options, with a small *Change type…* link that reopens the cascading menu.
* **Numeric prefix/suffix fields** are now editable from the popover, making it easy to fine-tune currency symbols or percentage displays after insertion.

## Internals

* `NumericColumnOptions` now declares the `prefix` / `suffix` fields that the runtime formatter has been reading — type definition catches up with actual behavior.
* Cleaned up 89 pre-existing `svelte-check` errors for CRAN readiness — all dead-code removals and type tightening, no behavior changes. Added R-side tests pinning the `viz_forest()` all-or-none contract the TS fallback relies on.

---

# tabviz 0.8.0

## Interactive column add / remove / configure

* **Right-click any column header to reshape the table at runtime.** The new header context menu offers three actions:
  - **Hide** — drop the column from view (reversible via the Reset button).
  - **Insert column after…** — open the new column editor anchored after the clicked header.
  - **Configure…** — re-open the editor on an existing column to swap its type, fields, or options in place.
* **Two-step column editor.** Step 1 picks a visual type from a compact chip-grid, categorized into Text / Number / Interval / Viz / Icon. Types that can't be built from the current data (e.g. violin with no array columns) are greyed out with an explanation tooltip. Step 2 fills in the type's typed field slots, with each slot dropdown filtered to compatible data columns. Composites (forest, interval, range, events) **auto-pair sibling fields** from naming patterns — picking `hr` pre-fills `hr_lo` / `hr_hi` / etc. Users can always override.
* **All data columns stay available in the picker**, even ones already on display. The same field can now be surfaced twice with different visuals (e.g. `hr` as formatted number *and* as a bar chart).
* **No payload bloat.** The widget already ships the full input data frame in each row's metadata — adding a column is purely a client-side act.

## R-side API

* New `extra_columns = list(col_*())` parameter on `tabviz()` / `web_spec()`. Authors can pre-configure optional columns with custom formatting / headers / options; users surfacing them via the picker get the author's spec instead of inferred defaults.
* New `available_exclude = c(...)` parameter to redact sensitive or internal-only fields from the picker.
* New `availableFields` manifest in the serialized payload (name, inferred category) — computed by the new internal helper `infer_field_category()`. Categories: `numeric`, `integer`, `string`, `logical`, `date`, `array-numeric`, `other`.

## Implementation

* Gated on `interaction@enable_edit`: publication themes stay read-only, dashboard-style themes get the full editing UX by default.
* `resetState()` now also clears all user-driven column add/hide/configure edits, so the existing Reset button covers the new feature out of the box.
* New frontend modules: `lib/column-compat.ts` (visual-type registry + slot compatibility + auto-pair), `components/controls/HeaderContextMenu.svelte`, `components/controls/ColumnEditorPopover.svelte`.
* Store extensions in `forestStore.svelte.ts`: `insertColumn`, `hideColumn`, `updateColumn`, `clearColumnEdits`, plus `availableFields` / `extraColumns` getters. The existing `effectiveColumnDefs` derivation applies hides / inserts / overrides recursively, so column groups participate too.
* `tsconfig.json`: explicit `$types` alias mapping so `svelte-check` stops flagging valid imports (Vite was resolving correctly at runtime already).

## Known gaps

* Keyboard-only and touch-device users have no alternative entry point yet (right-click only).
* Dynamic-cardinality viz types (multi-effect forest, multi-series viz_bar/boxplot/violin) are author-only — they can be shipped via `extra_columns` but not built from scratch in the runtime editor.

---

# tabviz 0.7.3

## Theme-driven interaction defaults

* **Widgets now feel interactive out of the box.** When `tabviz()` is called without an explicit `interaction` argument, the default interaction preset is chosen based on the theme:
  - **Dashboard-style themes** (`default`, `modern`, `dark`, `presentation`, `nature`) → `web_interaction_full()` (sort, filters, drag-and-drop, inline editing, hover effects all on).
  - **Publication-style themes** (`jama`, `lancet`, `cochrane`, `minimal`) → `web_interaction_publication()` (everything off — clean static output suitable for print).
* Users can still override at any time by passing an explicit `interaction = web_interaction(...)`.
* New exported helper `default_interaction_for_theme(theme)` returns the matching preset for a given theme, if you want to derive from it in custom code.

---

# tabviz 0.7.2

## Polish

* **Row drag: no more highlighted text.** Dragging a row no longer triggers the browser's native text selection. The fix combines three layers: `user-select: none` on the draggable label cell, a document-level `body.tabviz-dragging-rows` class that suppresses selection everywhere for the duration of the drag, and `e.preventDefault()` + `getSelection().removeAllRanges()` on pointerdown.

* **Visual feedback during and after drag.**
  * While a drag is active, the source row's label cell fades to ~55% opacity and picks up an inset primary-color bar on the left — the user can see exactly what they're moving without relying on the drop-indicator line alone.
  * On release, the row that just landed briefly tints in the primary color (~560 ms keyframe flash). The reorder feels confirmed rather than instantaneous.
  * Cursor switches to `grabbing` globally while a drag is in flight.

---

# tabviz 0.7.1

## Changes

* **Row-group counts `(n)` are now opt-in and off by default.** Previously every row-group header showed its descendant count (e.g. `Main Trials (12)`). That's now gated behind a new `show_group_counts` flag on `InteractionSpec` / `web_interaction()` and defaults to `FALSE`. To get the old behavior, pass `interaction = web_interaction(show_group_counts = TRUE)`.

## Implementation

* R-side: new `show_group_counts` property on `InteractionSpec`, passed through `web_interaction()`, serialized to `showGroupCounts` in the JSON payload.
* Browser: `ForestPlot.svelte` passes `rowCount` to `GroupHeader` only when the flag is on; otherwise `undefined` (the existing `{#if rowCount !== undefined}` gate in `GroupHeader.svelte` handles the rest).
* SVG export: `renderGroupHeader` is called with `rowCount = 0` when the flag is off, and the existing `if (rowCount > 0)` gate skips the "(n)" text.
* Label-column measurement (both browser-side canvas measurement and V8 headless estimation) now adds the count width only when the flag is on — auto-widths tighten up.

---

# tabviz 0.7.0

## Interactivity Redesign: one mode, no layout shifts

User feedback on the 0.6.0 edit/view mode dichotomy was negative — mode confusion, jarring column re-flow on toggle, header clutter. This release removes the mode entirely.

### What's new

* **No more edit mode.** The pencil-icon toggle is gone. Every interaction is available whenever its R-side feature flag is on (`enable_sort`, `enable_filters`, `enable_reorder_rows`, `enable_reorder_columns`, `enable_edit`). Zero in-widget state to manage.

* **Zero layout shift.** The interaction chrome (filter funnel, column drag grip) now renders in absolutely-positioned overlays that appear on header hover. Column auto-widths are measured once, identical on screen and in export. The dual-measurement `columnWidthsCompact` dictionary is gone.

* **Hover-reveal affordances.** On header hover: filter funnel + column drag grip fade in at the right edge (absolutely positioned, no flow impact). Leave the header → they fade out.

* **Whole-row drag.** The row drag grip icon is gone. Clicking a row still collapses (group header) or selects (data row); dragging it reorders. Disambiguation is threshold-based — a drag only commits if the pointer travels > 6 px before release. Cursor changes to `grab` when `enable_reorder_rows` is on.

* **Active-state indicators only.** Sort chevron appears inline only on the currently-sorted column. Filter funnel stays visible (persistently, full opacity) on columns that have an active filter. Other columns stay visually quiet at rest.

* **Editable cells get a subtle tint + text cursor** on hover, so double-click discoverability doesn't require an icon.

### Removed

* `EditModeToggle` component + `setEditMode` / `toggleEditMode` / `editMode` store state.
* `RowDragHandle` component — whole-row drag replaces it.
* `columnWidthsCompact` dictionary and the dual-pass measurement.
* Per-column icon width budget in `doMeasurement()`.

### Preserved

* R API is unchanged — every `enable_*` flag on `web_interaction()` works the same. Existing widgets don't need to change.
* WYSIWYG export still reflects the current view (filter + sort + reorder + edits), via the `exportSpec` derived.
* Shiny proxy methods (`applyFilter`, `clearFilter`, `sortBy`, `toggleGroup`) unchanged.
* Column resize still works (never mode-gated).

### Migration notes

* If you relied on the pencil-icon toggle to expose interactions, they're now live by default whenever the feature flag is set. Simplify.
* If you were using edit-mode-off as a "screenshot mode", the new default IS the clean state. Active sort/filter indicators still show, which matches the "show me what's being queried" intent of a screenshot.

---

# tabviz 0.6.1

## Bug Fixes

* **Row/group reorder export**: `exportSpec` now reorders `data.groups` by `rowOrderOverrides.groupOrderByParent`, so dragging a row-group to a new position among siblings is correctly reflected in the SVG/PNG download. Row-within-group reorders were already preserved; this closes the gap for group-level reorders. Added `srcjs/scripts/test-reorder-export.js` as a headless Puppeteer check for the reorder → export pipeline.
* **Debug hooks**: exposed `window.__tabvizStoreRegistry` and `window.__tabvizExports` (read-only helpers) for automated testing and DevTools inspection.

## CSS Encapsulation

* Tightened `:global(...)` selectors so they no longer match host-page elements that happen to use generic class names. Specifically:
  - `RowDragHandle.svelte`: `:global(.data-cell:hover)` / `:global(.group-row:hover)` now prefixed with `.tabviz-container`.
  - `ControlToolbar.svelte`: every tooltip rule (`.control-toolbar [data-tooltip]…`) is scoped under `.tabviz-container`.
* Confirmed via audit that every rule in the distributed `inst/htmlwidgets/tabviz.css` is either Svelte-hash-scoped or prefixed with `.tabviz-*` — no naked global selectors leak out. Theme CSS custom properties (`--wf-*`) are set inline on the container via a `style` attribute, so they shadow any outer `--wf-*` the host page might define.

---

# tabviz 0.6.0

## Interactivity Revamp

A major expansion of the browser-side interaction surface, with WYSIWYG exports preserved throughout.

### New interactions

* **Column sort** is now wired end-to-end: click a header to cycle asc → desc → none. Indicator chevron shown next to the header text. Sort is applied *within* row groups so grouped tables keep their structure. Enabled via `enable_sort = TRUE`.

* **Per-column filter popovers**: click the funnel icon on a column header to open a small text / numeric-range / categorical-checklist popover. Supports `contains`, `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `between`, `in`, `empty`, `notEmpty`. Kind is auto-detected from column type and sample values. Enabled via `enable_filters = TRUE`.

* **Drag-and-drop rows**: grab the handle on the left of a row and reorder within the same group. Group headers are themselves draggable among sibling groups sharing a parent. Enabled via `enable_reorder_rows = TRUE`.

* **Drag-and-drop columns**: grab a column header's handle to reorder within its column group. Column groups reorder among top-level siblings. The label column is structural and stays anchored. Enabled via `enable_reorder_columns = TRUE`.

* **Inline cell editing**: double-click a label, text, or numeric cell for an overlay `<input>` with validation and Enter/Esc/blur handling. Double-click a forest marker for a three-field estimate / lower / upper popover with keyboard trap. Enabled via `enable_edit = TRUE`.

* **Edit mode toggle** (toolbar, pencil icon): all interaction chrome (sort chevrons, filter funnels, drag handles, edit triggers) is hidden by default. Toggle on to enter an editing session. Column resize stays available in both modes. Default off.

* **Screenshot-quality exports**: SVG/PNG downloads always use the clean, icon-free layout with tight column widths — regardless of whether edit mode is currently active. Internally, a second `columnWidthsCompact` dictionary is measured alongside the interactive widths.

### WYSIWYG export

* A new `exportSpec` derived bakes all user changes (filter + sort + row reorder + column reorder + cell edits) into a fresh `WebSpec` consumed by the SVG/PNG generator. What you see is exactly what you get — the download captures the current view.

### Column width measurement

* Auto-width measurement now budgets the px cost of interaction icons (sort chevron, filter funnel, drag handle) when edit mode is on, so headers never clip. The compact widths path used by the export keeps the icon budget at zero.
* Manual column resizes (via the resize handle) are tracked in a `userResizedIds` set and preserved across edit-mode toggles and spec re-measurement.

### R API

* New `InteractionSpec` flags serialized to the widget:
  - `enable_filters` (renamed from deprecated `show_filters`, still accepted as alias)
  - `enable_reorder_rows`
  - `enable_reorder_columns`
  - `enable_edit`
* New `web_interaction_full()` helper enables every interaction in one call, as a peer of `web_interaction_minimal()` and `web_interaction_publication()`.
* All interactivity is session-only in the Svelte store; no R round-trip required. Existing Shiny proxy methods (`applyFilter`, `clearFilter`, `sortBy`, `toggleGroup`) continue to work and accept both the legacy single-field `FilterConfig` and the new per-column `ColumnFilter` shapes.

### Toolbar polish

* Tooltips on every toolbar button (zoom, theme, reset, edit mode, download), rendered instantly on hover via a pure CSS `data-tooltip` system.
* Filter popover now mounts at the widget root rather than inside the transform-scaled content wrapper, so it never gets clipped and always draws above everything else. Auto-flips above the trigger when near the bottom of the viewport.
* Obsolete "table mode" (`ViewToggle`) removed — it referenced a method that no longer exists.

### Docs

* New `docs/gallery/interactive.qmd` — dedicated showcase page for the full interactivity tour, filter + sort dashboard, column-group reorder, and forest-cell editing. Linked from the Gallery menu and the landing page.
* Landing page hero now runs the full-interactivity demo with a "Try the interactivity" callout.
* Gallery index adds a Row-Groups × Column-Groups feature showcase.

---

# tabviz 0.5.0

## New Column Types

* **`col_heatmap()`**: Color intensity column that interpolates background color from a palette based on numeric values. Supports custom palettes (2+ colors), fixed min/max ranges, configurable decimal places, and optional value display. Auto-contrasts text color for readability.

* **`col_progress()`**: Progress bar column that renders a filled bar proportional to a value. Supports custom max value, color, and optional percentage label.

* **`col_currency()`**: Currency formatting wrapper around `col_numeric()` with prefix/suffix symbol positioning (e.g., `$100` or `100€`), configurable decimals and thousands separator.

* **`col_date()`**: Date formatting column that formats `Date`/`POSIXct` values R-side during serialization using `format()`. Supports any R date format string (e.g., `"%b %d, %Y"`).

## Frontend

* **CellHeatmap component**: New Svelte component for heatmap cells with d3-style color interpolation and luminance-based text contrast.

* **CellProgress component**: New Svelte component for progress bar cells with CSS variable theming.

* **Numeric prefix/suffix**: `formatNumber()` now supports `prefix` and `suffix` options for currency and other formatted numeric displays.

* **SVG export**: Heatmap and progress column types are now rendered in SVG export (colored rect backgrounds for heatmap, track + fill bars for progress).

## Gallery Examples

* **gallery_17**: Dashboard-style table showcasing `col_heatmap()`, `col_progress()`, `col_currency()`, `col_date()`.
* **gallery_18**: Demonstrates `viz_bar()`, `viz_boxplot()`, `viz_violin()` side by side.

## Test Coverage

* Added test suites for column types, modifiers, viz columns, save_plot, and annotations.

---

# tabviz 0.4.2

## Bug Fixes

* **Axis height truncation**: Fixed web view axis area being truncated (was 44px, now 76px to match SVG). Axis labels are no longer cut off.

* **Column gap**: SVG now uses theme's `columnGap` (default 8px) instead of hardcoded 16px, matching web view spacing.

* **SVG font styling** (comprehensive visual audit):
  - Added `font-variant-numeric: tabular-nums` to SVG for consistent number alignment
  - Badge text now uses `fontWeightBold` (600) to match web CSS
  - Added missing `font-weight` to subtitle, caption, footnote, axis tick labels
  - Bar value text respects row styling (`row_bold`, `row_emphasis`)
  - Annotation labels now use theme typography (font-family, font-size-sm, font-weight-medium) and secondary color

---

# tabviz 0.4.1

## Bug Fixes

* **SVG export alignment**: Fixed multiple WYSIWYG issues between web view and SVG export:
  - **VIZ_MARGIN consistency**: SVG now uses the same 12px margin as web view (was 30px)
  - **Arrow positioning**: Fixed double offset causing arrows to be misaligned
  - **Font size precision**: Rounded to 2 decimal places to avoid rendering artifacts

* **SVG export resize**: Browser resize and manual column resize now correctly reflected in SVG export. Previously, forest column width was fixed regardless of user adjustments.

* **SVG header spacing**: Fixed vertical padding in column group headers to match web view by accounting for `cellPaddingY` in multi-row headers.

* **SVG footer spacing**: Reduced gap between axis and footnote from 72px to ~52px to match web view's layout.

* **Column groups detection**: Fixed `hasGroups` check to include unified columns (not just legacy left/right positioned columns).

## New Features

* **Viz column SVG rendering**: Added SVG export support for `viz_bar`, `viz_boxplot`, and `viz_violin` column types (previously missing from SVG output).

---

# tabviz 0.4.0

## Breaking Changes

* **`markerColors` → `effectColors`**: Unified theme property for cycling colors across all visualization types (forest, bar, boxplot, violin). This is a clean rename with no backward compatibility:
  - R: `marker_colors` property removed from `Shapes` class, replaced by `effect_colors`
  - R: `set_marker_colors()` removed, use `set_effect_colors()` instead
  - TypeScript: `shapes.markerColors` → `shapes.effectColors` in theme type

* **Effect color cascade**: All viz components now use the same color resolution:
  1. `effect.color` (explicit per-effect override)
  2. `theme.shapes.effectColors[idx]` (cycle through theme palette)
  3. Built-in fallback array

## New Features

* **Curated effect color palettes**: Each built-in theme now includes a curated 5-color `effectColors` palette designed for multi-effect visualizations:
  - **default**: Cyan/green/amber/red/purple (`#0891b2`, `#16a34a`, `#f59e0b`, `#ef4444`, `#8b5cf6`)
  - **modern**: Blue/green/amber/red/purple
  - **jama**: Grayscale progression
  - **lancet**: Classic Lancet journal colors
  - **nature**: Nature family warm tones
  - **cochrane**: Cochrane review colors
  - **dark**: Pastel tones for dark backgrounds
  - **minimal**: Slate grayscale
  - **presentation**: High-contrast primary colors

## Bug Fixes

* **Interactive dropdown clipping**: Fixed zoom controls, theme switcher, and download button dropdowns being clipped when the plot container is small or has `overflow: hidden`. Dropdowns now use viewport-relative fixed positioning to escape clipping containers.

## Improvements

* **Badge column styling**: Refined badge appearance with better vertical proportions:
  - Removed vertical padding for tighter fit within rows
  - Increased font weight (600) for better legibility
  - Uses relative font sizing (0.77em for base, 0.7em for small)

## Documentation

* **Effect colors guide**: Added comprehensive effect_colors palette table showing all 9 theme palettes with visual swatches
* **Visualizations index**: Updated guide to explain unified effectColors system for multi-effect styling
* **Fluent API reference**: Updated `set_effect_colors()` documentation with examples

---

# tabviz 0.3.0

## Breaking Changes

* **Package renamed from `webforest` to `tabviz`**: All references updated. Users should update their code:
  - `library(webforest)` → `library(tabviz)`
  - Widget classes changed from `"webforest"` to `"tabviz"`

* **Forest column configuration via `col_forest()`**: Forest plot columns are now defined using the `col_forest()` helper instead of top-level parameters. This unifies the column-based API:
  ```r
  # Old (deprecated)
  forest_plot(data, point = "hr", lower = "lower", upper = "upper")

  # New
  forest_plot(data, columns = list(
    col_text("study"),
    col_forest(point = "hr", lower = "lower", upper = "upper")
  ))
  ```

## Bug Fixes

* **Axis calculation with col_forest()**: Fixed critical bug where x-axis defaulted to 0.1-10 regardless of actual data. The axis calculation now correctly uses column names specified in `col_forest()` (e.g., `point = "hr"`) to look up values in row metadata. Previously, it was using literal strings `"point"`, `"lower"`, `"upper"`.

* **Svelte 5 $effect() outside component context**: Fixed JavaScript runtime errors in Shiny bindings where `$effect()` runes were used outside component initialization. Wrapped in `$effect.root()` to create proper reactive context.

* **ciClipFactor default mismatch**: Fixed inconsistency where R documentation specified default of 2.0 but JavaScript fallback used 3.0. Now consistently uses 2.0.

## Improvements

* **S7 class validators**: Added validation for critical classes:
  - `ColorPalette`: Validates all color properties are valid hex colors
  - `GroupSummary`: Type-safe comparison of lower/upper bounds
  - `InteractionSpec.enable_themes`: Validates list items are WebTheme objects

* **Lifecycle dependency**: Package now properly depends on `lifecycle` for deprecation warnings.

* **Unit tests for axis calculation**: Added comprehensive test suite (`axis-utils.test.ts`) covering linear/log scale ranges, CI clipping, custom column names, and tick generation.

---

# webforest 0.2.3

## New Features

* **Row banding**: New dedicated `rowBg` and `altBg` theme colors for alternating row backgrounds:
  - `set_colors(row_bg = ..., alt_bg = ...)` for explicit control
  - `set_layout(banding = TRUE/FALSE)` to toggle striped rows (default: TRUE)
  - Removed complex depth-based row shading in favor of simple alternation

* **Cascading color defaults**: Theme colors now cascade intelligently when not explicitly set:
  - Background chain: `background` → `row_bg` → `alt_bg`
  - Marker chain: `primary` → `interval` → `summary_fill`
  - Makes custom themes easier: set `primary` and `background`, get consistent colors everywhere

## Improvements

* **Tighter row heights**: All themes now have more compact, professional row heights while maintaining their relative character (minimal stays compact, presentation stays readable)

---

# webforest 0.2.2

## New Features

* **Simplified zoom system**: Replaced complex fit-mode system with intuitive zoom controls:
  - **Zoom slider** (50%-200%): Set your desired scale with +/- buttons or slider
  - **Auto-fit toggle** (default ON): Automatically shrinks content if it exceeds container width, never enlarges
  - **Fit to width button**: One-click to set zoom level that matches container width exactly
  - **Max size constraints**: Optional max-width and max-height limits via dropdown

* **New R API for zoom control**:
  - `zoom` parameter: Initial zoom level (0.5 to 2.0, default 1.0)
  - `auto_fit` parameter: Shrink to fit container if too large (default TRUE)
  - `max_width` / `max_height`: Optional pixel constraints
  - `show_zoom_controls`: Toggle zoom UI visibility
  - New `set_zoom()` fluent function for pipeline usage

## Improvements

* **Toolbar hover behavior**: Control toolbar now fades in on hover (floating mode) for a cleaner default appearance
* **Toolbar doesn't scale**: Toolbar stays at native size regardless of zoom level

## Breaking Changes

* Removed `fit_mode`, `width_mode`, `height_mode`, and `height_preset` parameters (replaced by zoom system)
* Removed `set_fit()` function (replaced by `set_zoom()`)

---

# webforest 0.2.1

## Bug Fixes

* **CI clipping extends axis to boundary**: When confidence intervals are clipped (extend beyond the clip threshold), the axis now extends to include the clip boundary. This ensures arrow indicators have visual space to extend to the axis edge rather than being truncated.

* **Multi-effect axis calculation**: Axis range calculation now considers all effects (not just primary) when determining axis limits. Previously, additional effects could render outside the visible axis range.

* **Log scale value filtering**: Non-positive values are now consistently filtered across web view and SVG export for log scale plots. Previously, the web view's default effect case didn't filter, causing potential inconsistencies.

* **R-side axis consistency**: The R-side shared axis calculation (`split_forest()` with `shared_axis = TRUE`) now matches JS-side behavior:
  - Applies `nice_domain()` before calculating clip boundaries (ensures alignment)
  - Uses multiplicative spread for log scale zero-span case (prevents invalid domain)
  - Applies final `nice_domain()` snap for cleaner axis limits

## Improvements

* **Code consolidation**: Removed duplicate implementations that could drift:
  - `NICE_Q` constant now exported from single source (`scale-utils.ts`)
  - `EFFECT_SPACING` and `getEffectYOffset()` moved to shared module (`rendering-constants.ts`)
  - `getEffectValue()` unified across web view and SVG generator

---

# webforest 0.2.0

## New Features

* **Container padding**: New `containerPadding` theme property via `set_layout(container_padding = ...)` adds left/right padding to the widget container, separate from plot area padding.

* **Header font scale**: New `headerFontScale` typography option via `set_typography(header_font_scale = ...)` controls header text size relative to base font (default: 1.05).

* **Group header theming**: New `set_group_headers()` fluent API for per-level group header styling:
  - Font size, weight, and italic per level
  - Custom background colors per level
  - Border bottom toggle per level
  - All preset themes now include tasteful group header defaults

## Bug Fixes

* **Column width calculation**: Fixed auto-width columns being too narrow when document has non-default font size. The rem-to-px conversion now uses actual document root font size instead of assuming 16px.

* **Group row background overlap**: Fixed visual artifact where semi-transparent backgrounds on adjacent cells created a darker band at cell boundaries. Group header backgrounds now use pre-computed solid colors.

* **Symmetric axis opt-in**: Symmetric axis is no longer auto-triggered when effects span both sides of null. Use `set_axis(symmetric = TRUE)` explicitly when needed.

* **Split forest axis scaling**: Fixed x-axis being computed from all data instead of per-split subset. The axis now correctly scales to fit only the data in the currently displayed split.

* **SVG axis alignment**: Fixed SVG export axis not matching web view. The SVG generator now applies the same `AXIS_LABEL_PADDING` (30px) used in the web renderer.

## Improvements

* **UI polish**: Refined cell padding, header styling, hover states, and text wrapping behavior for a more polished appearance.

* **Subtle group headers**: Default group header opacity reduced from 15%/10%/6% to more subtle values. Preset themes now have coordinated group header styling.

## Documentation

* **Documentation restructure**: Reorganized guides into focused topics (Quick Start, Themes, Columns, Row Styling, Row Groups, Forest Plots, Split Plots, Fluent API).

* **New gallery pages**: Split gallery into Basic Examples and Advanced Examples for easier navigation.

* **Troubleshooting guide**: Moved to Reference section with expanded content.

* **Color usage guide**: Added documentation for accent/muted color semantics and group header configuration.

---

# webforest 0.1.6

## Bug Fixes

* **SVG group header width**: Group headers in the label column now correctly account for chevron icon (12px), gaps, count text "(N)", and internal padding. Previously, group headers were measured without these elements, causing potential truncation.

* **SVG badge positioning**: Badge rendering now uses `estimateTextWidth()` for accurate positioning instead of crude character-count approximations. This ensures badges align consistently between web and SVG export.

* **Column group expansion**: SVG generator now properly expands child column widths when a column group header is wider than its children (matching web view behavior).

## Improvements

* **Group header backgrounds**: Increased opacity from 8%/5%/3% to 15%/10%/6% for more distinctive visual hierarchy. Backgrounds now span the full row width across all cells.

* **Width calculation documentation**: Added comprehensive comments explaining the width calculation algorithm in `rendering-constants.ts`, `svg-generator.ts`, and `width-utils.ts`.

* **`calculateLabelColumnWidth()` enhancement**: Now accepts optional `groups` parameter to measure group header widths including chevron, gap, label, and count elements.

## Documentation

Major documentation overhaul with improved discoverability and design pattern explanations:

* **Callouts throughout**: Added tip, note, and warning callouts to all guides explaining design patterns, when to use features, and common pitfalls

* **Hidden arguments documented**: Added documentation for `weight`, `row_bg`, `row_emphasis`, `row_muted`, `row_accent` parameters

* **Design pattern explanations**:
  - Column-mapping pattern (specify column names, not values)
  - Two-step workflow (web_spec → forest_plot)
  - Styling hierarchy (theme → row → cell)
  - Fluent API immutability

* **Improved reference pages**: `forest_plot()` now documents all arguments with organized sections (Core, Row Styling, Marker Styling, Split, Visual Override, Layout)

* **Better cross-references**: Added "See Also" sections linking related documentation

* **Quick start enhancements**: Clear explanation of four required mappings, scale selection guidance, two-step workflow benefits

---

# webforest 0.1.5

## Breaking Changes

* **`axis_trim` removed**: The `axis_trim` parameter has been replaced by a new, more powerful auto-scaling system. See "Smart Axis Auto-Scaling" below.

## New Features

* **Smart Axis Auto-Scaling**: Completely redesigned x-axis range calculation:
  - **Point estimates are sacred**: Axis range is based on point estimates, not CI bounds. All markers are always visible.
  - **CI truncation**: Wide CIs that would blow up the axis are truncated with arrow indicators instead
  - **Null value included**: The null reference line is always within the axis range (configurable)
  - **Null tick guaranteed**: A tick is always shown at the null value (configurable)
  - **At least 2 ticks**: Minimum of 2 ticks are always rendered
  - **Symmetric option**: Axis can be made symmetric around null (auto-enabled when effects are on both sides)
  - **Marker margin**: Half-marker-width added at edges so markers don't clip

* **New axis theme settings** in `AxisConfig`:
  - `padding`: Fraction of estimate range for padding (default: 0.10)
  - `ci_truncation_threshold`: Truncate CIs beyond this × estimate range (default: 2.0)
  - `include_null`: Always include null in range (default: TRUE)
  - `symmetric`: NULL = auto, TRUE = force, FALSE = disable
  - `null_tick`: Always show tick at null (default: TRUE)
  - `marker_margin`: Add marker padding at edges (default: TRUE)

---

# webforest 0.1.4

## New Features

* **Theme-controlled markers**: Multi-effect plots now use theme-defined colors and shapes by default. Configure via `set_marker_colors()` and `set_marker_shapes()`, or set in theme with `shapes$marker_colors` and `shapes$marker_shapes`. Effects without explicit styling cycle through defaults (square, circle, diamond, triangle).

* **Semantic row styling**: New row styling options for conditional formatting:
  - `row_emphasis`: Bold text, darker color for key rows
  - `row_muted`: Lighter color, reduced prominence
  - `row_accent`: Theme accent color highlight
  - Use via `web_spec()` parameters or CSS classes in custom rendering

* **Fluent theme API**: New `set_theme()` function accepts either a theme name string (`"jama"`, `"lancet"`, etc.) or a WebTheme object for easy theme switching in pipelines.

* **Enhanced col_percent()**: Now supports `digits` parameter for significant figures, and `multiply` defaults to `TRUE` (expects proportions 0-1, displays as percentages).

## Improvements

* **Axis padding**: Default axis padding is now 10% on each side of point estimates.

* **Split forest axis settings**: `axis_range` and `axis_ticks` now properly propagate to all splits when `shared_axis=TRUE`.

* **Multiple col_interval()**: Using multiple `col_interval()` columns now works correctly by generating unique internal field names.

* **Number abbreviation**: `abbreviateNumber()` now uses max 1 decimal (e.g., "11.1M" not "11M"), errors on values >= 1 trillion.

* **P-value width calculation**: Column auto-width now correctly measures superscript characters in formatted p-values.

## Bug Fixes

* **SVG border alignment**: Summary rows now render with correct 2px top borders in SVG export, matching web display.

* **Sparkline NaN handling**: `renderSparklinePath()` now filters NaN/Infinity values before rendering, preventing "M30,NaNZ" path errors.

* **Sigfig/decimals validation**: `col_numeric()`, `col_n()`, and `col_percent()` now error if both `digits` and `decimals` are specified.

---

# webforest 0.1.3

## Bug Fixes

* **Sparkline column width**: Fixed bug where sparkline columns were rendered overly wide. The auto-width calculation was stringifying the sparkline data array (e.g., "1,2,3,4,5...") instead of treating it as a visual element with fixed width. Sparkline columns now size correctly based on header text and 88px minimum (60px SVG + padding).

* **Visual column auto-sizing**: Added proper handling for visual column types (sparkline, bar, icon, badge, stars, img, range) in auto-width calculation. Each visual type now has appropriate minimum widths to ensure the visual content fits without truncation.

* **Border alignment**: Fixed sub-pixel border misalignment between CSS table borders and SVG plot gridlines. Removed the `-0.5` offset hack from SVG lines and added `shape-rendering="crispEdges"` for consistent border rendering across the table and plot areas.

## New Features

* **Programmatic theme control**: `web_interaction()` gains `enable_themes` parameter to control the theme switcher menu:
  - `"default"` (the default): Shows theme menu with all `package_themes()`
  - `NULL`: Disables theme selection entirely (hides menu icon)
  - A list of WebTheme objects: Shows theme menu with only the specified themes

* **`package_themes()`**: New function returning a named list of all themes distributed with the package (`default`, `minimal`, `dark`, `jama`, `lancet`, `modern`, `presentation`, `cochrane`, `nature`). Useful for subsetting available themes in `enable_themes`.

---

# webforest 0.1.2

## Axis & Interval Improvements

* **Axis outlier trimming** _(removed in v0.1.5)_: `forest_plot()` gained `axis_trim` parameter for IQR-based axis range trimming. This has been replaced by the new smart auto-scaling system in v0.1.5.

* **Arrow indicators**: Confidence intervals extending beyond axis bounds now display arrow indicators instead of whiskers, showing "continues beyond visible range".

* **Imprecise estimates**: `col_interval()` gains `imprecise_threshold` parameter. When the CI ratio (upper/lower) exceeds the threshold, displays "—" instead of numeric values.

## Label & Export Improvements

* **Auto-generated label headers**: When `label` is provided without explicit `label_header`, the header is auto-generated from the field name (e.g., `label = "study_name"` → header "Study Name"). When no label column is specified, uses "#" with row numbers.

* **SplitForest export**: `save_plot()` now accepts `SplitForest` objects directly, exporting all sub-plots to a directory structure matching the split hierarchy.

## UI Polish

* **Column auto-width**: All `col_*()` helpers now default to `width = NULL`, which triggers automatic width calculation based on content. Previously, columns had fixed pixel defaults (e.g., 90px for numeric, 160px for interval) that could truncate headers. Max auto-width increased from 400px to 600px.

* **Compact menus**: Reduced padding in theme switcher and layout toggle dropdowns for a more compact feel.

---

# webforest 0.1.1

## Column Formatting Enhancements

* **Interval formatting**: `col_interval()` gains `decimals` and `sep` parameters for customizing display format, plus `point`, `lower`, `upper` field overrides to show alternative effects (e.g., per-protocol results alongside ITT).

* **P-value abbreviation**: `col_pvalue()` now has `abbrev_threshold` parameter to display very small values as "<0.0001" instead of scientific notation.

* **Number abbreviation**: `col_numeric()`, `col_n()`, and `col_events()` gain `abbreviate` parameter to display large numbers with K/M/B suffixes (e.g., 1,234,567 → "1.2M").

* **Significant figures**: `col_numeric()` and `col_n()` gain `digits` parameter for formatting by significant figures instead of fixed decimals.

## Split Forest Improvements

* **Theme persistence**: Selected theme now persists when navigating between split subgroups.

* **Sidebar styling**: Replaced chevron icons with tree-style +/− box icons. Fixed top alignment with plot. Reduced spacing for more compact navigation.

* **Title concatenation**: When using `split_by` with a custom title, the title now displays as "{your_title} — {group_path}" instead of being overwritten.

## Reference Lines

* **Width and opacity**: `forest_refline()` gains `width` (default 1) and `opacity` (default 0.6) parameters for fine-tuning reference line appearance.

## Groups & Rows

* **Recursive row counting**: Group headers now show total count of ALL descendant rows including nested subgroups, not just direct children.

* **Spacer row handling**: Spacer rows now properly hide cell content (sparklines, etc.) instead of showing placeholder values.

## Theme Spacing

* **New spacing properties**: `set_spacing()` gains `axis_gap` (gap between table and x-axis, default 12px) and `group_padding` (left/right padding for column group headers, default 8px).

## Toolbar

* **Reset button**: New reset button (↺ icon) in the toolbar restores default view settings (clears selections, collapsed groups, sort/filter, column widths, layout mode).

## New Column Types

Six new column helpers for richer data presentation:

* **`col_icon()`** — Display icons or emoji with value-to-icon mapping. Great for status indicators (✓/✗), categorical markers, or any symbolic representation.

* **`col_badge()`** — Colored status badges with semantic variants (`success`, `warning`, `error`, `info`, `muted`) or custom hex colors. Perfect for publication status, categories, or any labeled data.

* **`col_stars()`** — Star ratings (1-5 scale) using Unicode ★/☆. Supports half-stars, custom colors, and configurable max stars. Ideal for quality scores, ratings, or risk assessments.

* **`col_img()`** — Inline images from URLs with shape options (`square`, `circle`, `rounded`), lazy loading, and graceful fallbacks. Use for logos, flags, or any visual identifiers.

* **`col_reference()`** — Truncated text with tooltip for full content, optional hyperlinks via `href_field`. Designed for DOIs, PubMed IDs, citations, or any reference identifiers.

* **`col_range()`** — Display min-max ranges from two fields (e.g., "18 – 65"). Smart decimal handling and configurable separator.

## Numeric Formatting

* **Thousands separators**: New `thousands_sep` parameter for `col_numeric()`, `col_n()`, and `col_events()`. Large integers now display as `12,345` instead of `12345`.
  - Default ON for `col_n()` and `col_events()` (integer columns)
  - Default OFF for `col_numeric()` (opt-in for decimal columns)

## Previous Changes

* **P-value formatting**: `col_pvalue()` now displays small values using Unicode superscript notation (e.g., `1.2×10⁻⁵`). New parameters: `digits` for significant figures, `exp_threshold` for exponential notation cutoff. Default `stars = FALSE` for cleaner display.

* **Fluent API**: `set_*()` functions now work directly on `forest_plot()` and `webtable()` outputs, not just `web_spec()` objects.

## 0.1.0

Second release of webforest with enhanced column formatting, new themes, and package datasets.

### New Features

* **Column formatting enhancements**:
  - `decimals` parameter for `col_numeric()` and `col_n()` to control decimal places
  - `na_text` parameter for all column types to customize missing value display
  - New `col_percent()` helper for percentage columns with `multiply` and `symbol` options
  - New `col_events()` helper for "events/n" display (e.g., "45/120")

* **New themes**:
  - `web_theme_cochrane()` - Cochrane systematic review style (compact, Cochrane blue)
  - `web_theme_nature()` - Nature family journal styling (clean, modern)

* **Marker styling**: Per-row control over marker appearance in the forest plot:
  - `marker_color`, `marker_shape`, `marker_opacity`, `marker_size` parameters in `web_spec()`/`forest_plot()`
  - `set_marker_style()` fluent API function
  - `web_effect()` gains `shape` and `opacity` parameters for multi-effect styling
  - New unified `theme.colors.interval` for default marker color

* **Package datasets**: Four datasets included for examples and testing:
  - `glp1_trials` - GLP-1 agonist cardiovascular outcomes trials (~25 rows)
  - `airline_delays` - Airline carrier delay performance (~40 rows)
  - `nba_efficiency` - NBA player efficiency ratings (~30 rows)
  - `climate_temps` - Regional temperature anomalies (~20 rows)

### Bug Fixes

* Fixed split sidebar showing "R" instead of "Region" for single-variable splits (JSON serialization issue with length-1 vectors)
* Fixed fill container mode triggering horizontal scrollbar due to padding/margin not accounted for in scaling
* Fixed infinite height growth loop in fill container mode
* Fixed tooltip positioning to stay within viewport bounds
* Changed tooltip display to opt-in behavior via `tooltip_fields` in `web_interaction()`

### Improvements

* Reduced height preset values for small/medium/large containers
* Compacted tooltip and layout toggle dropdown styling
* Refreshed default theme color palette to cyan tones

### Documentation

* New guide: "Package Datasets" with examples for all four datasets
* Gallery example 7: Marker styling showcase with shapes and colors by study design
* Gallery examples 20-21: NBA player efficiency and airline performance using package datasets
* Gallery example 12 updated to use `glp1_trials` dataset
* Cookbook recipes for marker color by significance and shapes by study type
* Reference docs for `set_marker_style()` and updated `web_effect()` signature

---

## 0.0.1

First public release of webforest.

### New Features

* **Split forest plots**: Create separate navigable plots for each value of a categorical variable with interactive sidebar navigation.
  - `split_by` parameter in `forest_plot()` for quick usage
  - `split_forest()` function for pipe-based workflow
  - Hierarchical splits: `split_by = c("sex", "age_group")` creates nested tree navigation
  - `shared_axis = TRUE` for consistent axis range across all subgroups
  - Floating sidebar with search, keyboard navigation, and collapsible sections
  - `save_split_forest()` exports all sub-plots to directory structure

* **Shiny support for split forests**:
  - `splitForestOutput()` and `renderSplitForest()` for Shiny apps
  - `splitForestProxy()` for programmatic control
  - `split_forest_select()` to change active subgroup from server

### Documentation

* New guide: "Split Forest Plots" with comprehensive examples
* Gallery examples 16-18: Regional subgroups, hierarchical navigation, three-level clinical trials
* Cookbook recipes for split_by and save_split_forest()
* Function reference for split_forest()

---

## 0.0.0.9006

### Breaking Changes

* **Simplified width modes**: `width_mode` now has two options: `"natural"` (default, centered) and `"fill"` (scale to fill container). Replaces previous `"fit"`, `"fill"`, `"responsive"` options.

## 0.0.0.9005

### New Features

* **Height presets**: New `height_preset` parameter with explicit size options: `"small"` (400px), `"medium"` (600px), `"large"` (1000px), `"full"` (natural height), `"container"` (fill parent). Deprecates `height_mode`.

* **Column enhancements**:
  - `header_align`: Independent header vs body alignment
  - `wrap = TRUE`: Text wrapping instead of truncation
  - `width = "auto"`: Content-based width calculation
  - Truncation tooltips on hover

### Improvements

* Increased default column widths (`col_text` 80→120px, `col_interval` 140→160px)
* Better annotation label collision avoidance
* Fixed gallery_07 example column positioning
* Fixed `height_preset = "full"` not overriding htmlwidgets container height

### Bug Fixes

* Fixed column group header ordering issue where standalone columns after a group would appear before the group header
* Fixed flattening of column groups where child columns inside groups were incorrectly filtered by position

## 0.0.0.9004

### New Features

* **Layout mode controls**: New toolbar button and R parameters for controlling plot container sizing:
  - `width_mode`: "fit" (shrink-wrap, default), "fill" (100%), or "responsive" (100% with font scaling)
  - `height_mode`: "auto" (natural height) or "scroll" (capped at viewport height)
  - Interactive dropdown in toolbar to switch modes on the fly
  - Responsive mode scales text down (min 0.6x) to fit wide plots without horizontal scroll

* **Explicit row styling API**: New `row_*` parameters in `forest_plot()`/`web_spec()` replace magic `.row_*` column naming convention. Use any column name and map it explicitly:
  - `row_type`, `row_bold`, `row_italic`, `row_indent`, `row_color`, `row_bg`, `row_badge`, `row_icon`
  - Example: `forest_plot(data, row_bold = "is_primary", row_badge = "sig_label")`

* **Fluent styling API**: New `set_row_style()` and `set_column_style()` functions for piped modifications:
  ```r
  spec |> set_row_style(bold = "is_primary", badge = "significance")
  ```

* **Per-cell styling**: Column specs now support style mappings for cell-level formatting:
  ```r
  col_text("study", badge = "sig_col", color = "status_color")
  ```

### Breaking Changes

* Removed support for `.row_*` magic columns (e.g., `.row_bold`, `.row_badge`). Migrate by:
  1. Rename columns to remove the dot prefix (`.row_bold` → `is_bold`)
  2. Add explicit parameters: `forest_plot(..., row_bold = "is_bold")`

## 0.0.0.9003

### New Features

* **Multi-effect rendering**: Display multiple effects per row with color-coded intervals. Use `effects = list(web_effect(...), ...)` to show ITT, Per-Protocol, As-Treated or other analyses side by side.
* **Hierarchical grouping**: Simple syntax for nested groups - `group = c("region", "country")` creates collapsible region > country hierarchy automatically.
* **Expanded gallery**: Added 10 fun/creative examples beyond clinical research:
  - Sports: NBA player efficiency, World Cup performance
  - Entertainment: Oscar films, video games, streaming shows
  - Finance: Stock sectors, cryptocurrency, housing markets
  - Science: Climate anomalies, wildlife conservation

### Improvements

* Unified `group` parameter now accepts single column, vector of columns for hierarchy, or list of `web_group()` for explicit control
* Multi-effect intervals render with vertical offset and custom colors in both web and SVG export
* **Interaction presets**: New `web_interaction_minimal()` (hover only) and `web_interaction_publication()` (fully static) for common scenarios

### Breaking Changes

* Removed deprecated function aliases: `col_ci()` (use `col_interval()`), `forest_col()` (use `web_col()`), `forest_interaction()` (use `web_interaction()`)

## 0.0.0.9002

* Restructured documentation into chapters: Quick Start, Themes, Columns, Grouping & Rows, Exporting, Axis & Annotations
* Added Cookbook with task-oriented recipes for common patterns
* Harmonized theming between web and SVG renderers via shared `rendering-constants.ts`

## 0.0.0.9001

* Unified axis scaling between web view and SVG export using shared `niceDomain()` logic for consistent, sensible tick values
* Improved SVG generator code quality: extracted constants, added input validation, reduced code duplication

## 0.0.0.9000

### New Features

* Interactive forest plots rendered with Svelte 5 and D3.js
* 7 preset themes: default, JAMA, Lancet, modern, presentation, dark, minimal
* Fluent theme customization API: `set_colors()`, `set_typography()`, `set_spacing()`, `set_shapes()`, `set_axis()`, `set_layout()`
* Column types: text, numeric, interval, bar, p-value, sparkline
* Column groups with shared headers
* Collapsible hierarchical row groups
* Reference line annotations
* Direct visual overrides on `forest_plot()`: `axis_range`, `axis_ticks`, `axis_gridlines`, `plot_position`, `row_height`
* Shiny integration with `forestOutput()` and `renderForest()`
* **Static image export**: New `save_plot()` function for exporting to SVG, PDF, or PNG using a unified JavaScript renderer (via V8)
* **Web download button**: Interactive plots now include a download button (appears on hover) with SVG/PNG export options, using the same renderer as `save_plot()` for consistent output
* New `enable_export` option in `web_interaction()` to control download button visibility

### Documentation

* Package guide with interactive examples
* Example gallery with 11 interactive demos (dark theme, nested groups, multiple effects, column groups, journal styles, and more)
* Enhanced README with visual hero image and simplified quick-start example

### Bug Fixes

* Fixed navbar visibility on documentation site caused by Tailwind/Bootstrap CSS conflict
