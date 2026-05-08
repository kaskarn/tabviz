# Core S7 classes for tabviz
# Generic table specification with point + interval data

#' GroupSpec: A grouping/category of rows
#'
#' @param id Unique identifier for the group
#' @param label Display label for the group
#' @param collapsed Whether the group starts collapsed
#' @param parent_id ID of parent group for nesting (optional)
#'
#' @export
GroupSpec <- new_class(

  "GroupSpec",
  properties = list(
    id = class_character,
    label = class_character,
    collapsed = new_property(class_logical, default = FALSE),
    parent_id = new_property(class_character, default = NA_character_)
  )
)

#' Create a group specification
#'
#' Helper function for defining row groups with optional nesting.
#'
#' @param id Unique identifier for the group
#' @param label Display label for the group
#' @param parent Parent group ID for nesting (optional)
#' @param collapsed Whether the group starts collapsed
#'
#' @return A GroupSpec object
#' @export
web_group <- function(id, label = id, parent = NULL, collapsed = FALSE) {
  GroupSpec(
    id = as.character(id),
    label = as.character(label),
    collapsed = collapsed,
    parent_id = if (is.null(parent)) NA_character_ else as.character(parent)
  )
}

#' EffectSpec: Specification for a single effect (point + interval)
#'
#' Used for multiple-effect forest plots where each row displays
#' several related estimates (e.g., odds ratio and hazard ratio).
#'
#' @param id Unique identifier for the effect
#' @param point_col Column name for point estimates
#' @param lower_col Column name for lower bounds
#' @param upper_col Column name for upper bounds
#' @param label Display label for this effect in legends
#' @param color Optional color for this effect's interval
#' @param shape Optional shape: "square", "circle", "diamond", "triangle"
#' @param opacity Optional opacity (0-1)
#'
#' @export
EffectSpec <- new_class(
  "EffectSpec",
  properties = list(
    id = class_character,
    point_col = class_character,
    lower_col = class_character,
    upper_col = class_character,
    label = new_property(class_character, default = NA_character_),
    color = new_property(class_character, default = NA_character_),
    shape = new_property(class_character, default = NA_character_),
    opacity = new_property(class_numeric, default = NA_real_)
  ),
  validator = function(self) {
    valid_shapes <- c("square", "circle", "diamond", "triangle")
    if (!is.na(self@shape) && !self@shape %in% valid_shapes) {
      return(paste("shape must be one of:", paste(valid_shapes, collapse = ", ")))
    }
    if (!is.na(self@opacity) && (self@opacity < 0 || self@opacity > 1)) {
      return("opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a forest effect specification
#'
#' Defines a single effect (point + interval) for multi-effect forest plots.
#' Used with `viz_forest()` to display multiple effects per row.
#'
#' Marker styling args follow the canonical order
#' `(color, shape, opacity)`. Marker `size` is intentionally absent: in
#' multi-effect plots, size is driven row-wise by the `marker_size` arg of
#' `set_marker_style()` (or the legacy `marker_size` arg on `tabviz()`),
#' applied uniformly to every effect on a row so weights remain comparable.
#'
#' @param point Column name for point estimates
#' @param lower Column name for lower bounds
#' @param upper Column name for upper bounds
#' @param label Display label (defaults to point column name)
#' @param color Color for this effect (optional)
#' @param shape Marker shape: "circle" (default), "square", "diamond", "triangle"
#' @param opacity Marker opacity from 0 to 1 (optional)
#'
#' @return An EffectSpec object
#' @export
effect_forest <- function(point, lower, upper, label = NULL, color = NULL,
                          shape = NULL, opacity = NULL) {
  EffectSpec(
    id = point,
    point_col = point,
    lower_col = lower,
    upper_col = upper,
    label = label %||% point,
    color = color %||% NA_character_,
    shape = shape %||% NA_character_,
    opacity = opacity %||% NA_real_
  )
}

#' GroupSummary: Aggregate statistics for a group
#'
#' Used to display summary rows (e.g., pooled estimates in meta-analysis,
#' category averages in QC data).
#'
#' @param group_id The group this summary belongs to
#' @param point Point estimate for the summary
#' @param lower Lower bound
#' @param upper Upper bound
#' @param metadata Additional summary statistics as named list
#'
#' @export
GroupSummary <- new_class(
  "GroupSummary",
  properties = list(
    group_id = class_character,
    point = class_numeric,
    lower = class_numeric,
    upper = class_numeric,
    metadata = new_property(class_list, default = list())
  ),
  validator = function(self) {
    # Validate that lower and upper are numeric scalars before comparison
    if (length(self@lower) == 1 && length(self@upper) == 1 &&
        is.numeric(self@lower) && is.numeric(self@upper) &&
        !is.na(self@lower) && !is.na(self@upper)) {
      if (self@lower > self@upper) {
        return("lower must be <= upper")
      }
    }
    NULL
  }
)

#' PlotLabels: Title, subtitle, caption, and footnote for a plot
#'
#' @param title Main title (displayed at top)
#' @param subtitle Subtitle (below title)
#' @param caption Caption (below plot)
#' @param footnote Footnote (below caption, typically italicized)
#'
#' @export
PlotLabels <- new_class(
  "PlotLabels",
  properties = list(
    title = new_property(class_character, default = NA_character_),
    subtitle = new_property(class_character, default = NA_character_),
    caption = new_property(class_character, default = NA_character_),
    footnote = new_property(class_character, default = NA_character_)
  )
)

#' PaginateSpec: Pagination configuration for a tabviz
#'
#' Use [paginate_spec()] (or shortcuts `paginate = TRUE` / `paginate = <int>`
#' / `paginate_letter()` / `paginate_a4()` / `paginate_slide()`) on `tabviz()`
#' to break long tables into multiple pages. The HTML viewer renders one page
#' at a time with prev/next controls; PDF export emits one logical page per
#' PDF page (merged via `qpdf::pdf_combine`).
#'
#' Breakpoints are computed once on the R side and stored on the wire so the
#' HTML viewer and PDF export agree on where pages start and end.
#'
#' @param rows Maximum data rows per page (positive integer).
#' @param break_on Where forced page breaks may occur: `"split"`, `"group"`,
#'   or `"none"`.
#' @param keep_groups If `TRUE`, never break in the middle of a group.
#' @param orphan_min Minimum rows on a trailing page.
#' @param repeat_header,repeat_legend,repeat_title Whether the column
#'   header / legend / title repeat on each page.
#' @param footnotes_on Where footnotes appear: `"last"` or `"every"`.
#' @param page_label Page-of-N rendering: `TRUE` / `FALSE`, `"x"`,
#'   `"x_of_y"`, or a function.
#' @param oversized_group_policy What to do when a single group exceeds
#'   `rows`: `"overflow"`, `"warn"`, or `"error"`.
#'
#' @export
PaginateSpec <- new_class(
  "PaginateSpec",
  properties = list(
    rows = new_property(class_integer, default = 30L),
    break_on = new_property(class_character, default = "split"),
    keep_groups = new_property(class_logical, default = TRUE),
    orphan_min = new_property(class_integer, default = 3L),
    repeat_header = new_property(class_logical, default = TRUE),
    repeat_legend = new_property(class_logical, default = TRUE),
    repeat_title = new_property(class_logical, default = TRUE),
    footnotes_on = new_property(class_character, default = "last"),
    # page_label accepts TRUE/FALSE, "x", "x_of_y", or a function (rendered
    # at runtime). class_any keeps the door open for the function form;
    # constructor-side validation enforces the allowed shapes.
    page_label = new_property(class_any, default = "x_of_y"),
    oversized_group_policy = new_property(class_character, default = "overflow")
  ),
  validator = function(self) {
    if (length(self@rows) != 1L || self@rows < 1L) {
      return("`rows` must be a positive integer scalar")
    }
    if (!self@break_on %in% c("split", "group", "none")) {
      return("`break_on` must be one of: split, group, none")
    }
    if (length(self@orphan_min) != 1L || self@orphan_min < 0L) {
      return("`orphan_min` must be a non-negative integer scalar")
    }
    if (self@orphan_min >= self@rows) {
      return("`orphan_min` must be less than `rows`")
    }
    if (!self@footnotes_on %in% c("last", "every")) {
      return("`footnotes_on` must be one of: last, every")
    }
    if (!self@oversized_group_policy %in% c("overflow", "warn", "error")) {
      return("`oversized_group_policy` must be one of: overflow, warn, error")
    }
    NULL
  }
)

#' WebSpec: Core specification for web-native table visualizations
#'
#' This is the central data structure that can be rendered as:
#' - A forest plot (table + graphical interval column)
#' - An interactive table (table only)
#' - Other visualizations (upset plots, etc.)
#'
#' @param data Processed data as a data.frame
#' @param group_col Column name for grouping (optional, deepest level)
#' @param group_cols All group column names for hierarchical grouping (for composite ID building)
#' @param columns List of ColumnSpec objects defining table columns (including viz_forest).
#'   The leftmost visible column acts as the row identifier (sticky-left, row-drag surface).
#' @param extra_columns List of ColumnSpec objects hidden by default but available in the
#'   interactive column picker. Authors use this to pre-configure how specific optional
#'   columns should render when a user adds them.
#' @param available_exclude Character vector of data column names to exclude from the
#'   interactive column picker (e.g. sensitive fields that should never be surfaced).
#' @param groups List of GroupSpec objects
#' @param summaries List of GroupSummary objects
#' @param overall_summary Optional overall summary (GroupSummary)
#' @param theme WebTheme object
#' @param interaction InteractionSpec object
#'
#' @usage NULL
#' @export
WebSpec <- new_class(
  "WebSpec",
  properties = list(
    data = class_data.frame,
    group_col = new_property(class_character, default = NA_character_),
    group_cols = new_property(class_character, default = character(0)),
    columns = new_property(class_list, default = list()),
    extra_columns = new_property(class_list, default = list()),
    available_exclude = new_property(class_character, default = character(0)),
    groups = new_property(class_list, default = list()),
    summaries = new_property(class_list, default = list()),
    overall_summary = new_property(
      new_union(GroupSummary, class_missing),
      default = NULL
    ),
    theme = new_property(class_any, default = NULL),  # Set in web_spec()
    interaction = new_property(class_any, default = NULL),  # Set in web_spec()
    # Authored initial state applied at first paint — picked up by the widget
    # before mount so Shiny dashboards don't see a flash of unsorted/unfiltered
    # content before a proxy push lands. NULL means "no initial state". Set
    # via tabviz(initial_sort=, initial_filters=, initial_hidden_columns=).
    initial_state = new_property(class_any, default = NULL),
    labels = new_property(class_any, default = NULL),  # PlotLabels for title/subtitle/etc
    watermark = new_property(class_character, default = NA_character_),  # Optional centered diagonal watermark text
    # Watermark styling. NA defers to `theme.colors.foreground` and 0.07
    # opacity — the v0.20 baseline. Explicit values let users tweak the
    # glyph color / visibility from `set_watermark()` or the settings panel.
    watermark_color = new_property(class_character, default = NA_character_),
    watermark_opacity = new_property(class_numeric, default = NA_real_),
    # Row-level style column mappings
    row_bold_col = new_property(class_character, default = NA_character_),
    row_italic_col = new_property(class_character, default = NA_character_),
    row_color_col = new_property(class_character, default = NA_character_),
    row_bg_col = new_property(class_character, default = NA_character_),
    row_badge_col = new_property(class_character, default = NA_character_),
    row_icon_col = new_property(class_character, default = NA_character_),
    row_indent_col = new_property(class_character, default = NA_character_),
    row_type_col = new_property(class_character, default = NA_character_),
    # Semantic styling column mappings (T/F columns)
    row_emphasis_col  = new_property(class_character, default = NA_character_),
    row_muted_col     = new_property(class_character, default = NA_character_),
    row_accent_col    = new_property(class_character, default = NA_character_),
    # Semantic-token data-column slots. See R/classes-theme.R for the
    # corresponding RowSemantic bundles on RowCluster.
    row_fill_col      = new_property(class_character, default = NA_character_),
    # Marker style column mappings
    marker_color_col = new_property(class_character, default = NA_character_),
    marker_shape_col = new_property(class_character, default = NA_character_),
    marker_opacity_col = new_property(class_character, default = NA_character_),
    marker_size_col = new_property(class_character, default = NA_character_),
    # Deprecated: use marker_size_col instead
    weight_col = new_property(class_character, default = NA_character_),
    # Verbatim deparse of the original `tabviz()` / `forest_plot()` call
    # — surfaces in the "View source" panel as the baseline above the
    # recorded fluent operations. Captured once at the entry point; not
    # updated by modifiers. NA when absent (fluent-api-only specs).
    original_call = new_property(class_character, default = NA_character_),
    # Optional pagination spec — see [paginate_spec()]. NULL means single-page
    # output. Breakpoints are computed at serialization time so the HTML
    # viewer and PDF export agree on where pages start/end. Stored as
    # class_any so NULL ("no pagination") and a PaginateSpec are both valid;
    # constructor-side coercion via `as_paginate_spec()` keeps the value
    # canonical.
    paginate = new_property(class_any, default = NULL),
    # Target aspect ratio (width / height) for static export and the
    # widget's interactive control. `NA_real_` (default) means render at
    # natural aspect; a positive number triggers Mode-3 relayout via the
    # lever ladder. Set via `set_aspect_ratio()` (fluent / proxy / interactive).
    target_aspect = new_property(class_numeric, default = NA_real_)
  ),
  validator = function(self) {
    # Validate optional columns if specified
    cols <- names(self@data)

    if (!is.na(self@group_col) && !self@group_col %in% cols) {
      return(paste0("Column '", self@group_col, "' not found in data"))
    }

    NULL
  }
)

method(print, WebSpec) <- function(x, ...) {
  # Count forest columns and effects
  n_forest <- 0
  n_effects <- 0
  for (col in x@columns) {
    if (S7_inherits(col, ColumnSpec) && col@type == "forest") {
      n_forest <- n_forest + 1
      # Count inline effects in this forest column
      forest_opts <- col@options$forest
      if (!is.null(forest_opts$effects)) {
        n_effects <- n_effects + length(forest_opts$effects)
      } else if (!is.null(forest_opts$point)) {
        n_effects <- n_effects + 1  # Single inline effect
      }
    }
  }

  cli_inform(c(
    "A {.cls WebSpec} with {nrow(x@data)} row{?s}",
    "*" = "Columns: {length(x@columns)} ({n_forest} forest)",
    "*" = "Effects: {n_effects}",
    "*" = "Groups: {length(x@groups)}"
  ))
  invisible(x)
}

# ============================================================================
# Split Forest: Collection of plots split by variable values
# ============================================================================

#' SplitForest: A collection of forest plots split by variable values
#'
#' Container for multiple WebSpec objects, one per split combination.
#' Used when `split_by` is specified to create separate plots for each
#' subset of data based on the splitting variable(s).
#'
#' @param specs Named list of WebSpec objects (names are split value keys)
#' @param split_vars Character vector of column names used for splitting
#' @param split_tree Hierarchical navigation structure for the sidebar
#' @param shared_axis Whether to use shared axis range across all plots
#' @param shared_column_widths Whether every sub-plot uses identical
#'   per-column widths (stamped at construction). Added in v0.16; surfaces
#'   a runtime toggle in the split sidebar as of v0.19.
#' @param axis_range Numeric vector of length 2 with shared axis min/max (if shared_axis = TRUE)
#'
#' @export
SplitForest <- new_class(
  "SplitForest",
  properties = list(
    specs = new_property(class_list, default = list()),
    split_vars = new_property(class_character, default = character(0)),
    split_tree = new_property(class_list, default = list()),
    shared_axis = new_property(class_logical, default = FALSE),
    shared_column_widths = new_property(class_logical, default = FALSE),
    axis_range = new_property(class_numeric, default = c(NA_real_, NA_real_))
  ),
  validator = function(self) {
    if (length(self@specs) == 0) {
      return("SplitForest must contain at least one WebSpec")
    }
    for (name in names(self@specs)) {
      if (!S7_inherits(self@specs[[name]], WebSpec)) {
        return(paste0("All specs must be WebSpec objects, got invalid type for '", name, "'"))
      }
    }
    if (length(self@split_vars) == 0) {
      return("split_vars must contain at least one column name")
    }
    NULL
  }
)

method(print, SplitForest) <- function(x, ...) {
  total_rows <- sum(vapply(x@specs, function(s) nrow(s@data), integer(1)))
  cli_inform(c(
    "A {.cls SplitForest} with {length(x@specs)} plot{?s}",
    "*" = "Split by: {.field {x@split_vars}}",
    "*" = "Total rows: {total_rows}",
    "*" = "Shared axis: {.val {x@shared_axis}}",
    "",
    "Plots:",
    set_names(
      vapply(names(x@specs), function(k) {
        paste0("{.val ", k, "} ({nrow(x@specs[[\"", k, "\"]]@data)} rows)")
      }, character(1)),
      rep("*", length(x@specs))
    )
  ))
  invisible(x)
}
