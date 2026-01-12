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
