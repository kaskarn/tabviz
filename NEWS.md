# webforest (development version)

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

## New Features

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

## Documentation

* Package guide with interactive examples
* Example gallery with 11 interactive demos (dark theme, nested groups, multiple effects, column groups, journal styles, and more)
* Enhanced README with visual hero image and simplified quick-start example

## Bug Fixes

* Fixed navbar visibility on documentation site caused by Tailwind/Bootstrap CSS conflict
