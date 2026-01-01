# Core S7 classes for webforest
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
    color = new_property(class_character, default = NA_character_)
  )
)

#' Create an effect specification
#'
#' Defines a single effect (point + interval) for multi-effect forest plots.
#'
#' @param point Column name for point estimates
#' @param lower Column name for lower bounds
#' @param upper Column name for upper bounds
#' @param label Display label (defaults to point column name)
#' @param color Color for this effect (optional)
#'
#' @return An EffectSpec object
#' @export
web_effect <- function(point, lower, upper, label = NULL, color = NULL) {
  EffectSpec(
    id = point,
    point_col = point,
    lower_col = lower,
    upper_col = upper,
    label = label %||% point,
    color = color %||% NA_character_
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
    if (length(self@lower) > 0 && length(self@upper) > 0 &&
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

#' WebSpec: Core specification for web-native table visualizations
#'
#' This is the central data structure that can be rendered as:
#' - A forest plot (table + graphical interval column)
#' - An interactive table (table only)
#' - Other visualizations (upset plots, etc.)
#'
#' @param data Processed data as a data.frame
#' @param point_col Column name for point estimates
#' @param lower_col Column name for lower bounds
#' @param upper_col Column name for upper bounds
#' @param label_col Column name for row labels
#' @param group_col Column name for grouping (optional)
#' @param columns List of ColumnSpec objects defining table columns
#' @param groups List of GroupSpec objects
#' @param summaries List of GroupSummary objects
#' @param overall_summary Optional overall summary (GroupSummary)
#' @param scale Scale type: "linear" or "log"
#' @param null_value Reference value for null effect (0 for linear, 1 for log)
#' @param axis_label Label for the graphical axis
#' @param theme WebTheme object
#' @param interaction InteractionSpec object
#'
#' @usage NULL
#' @export
WebSpec <- new_class(
  "WebSpec",
  properties = list(
    data = class_data.frame,
    point_col = class_character,
    lower_col = class_character,
    upper_col = class_character,
    label_col = new_property(class_character, default = NA_character_),
    label_header = new_property(class_character, default = "Study"),
    group_col = new_property(class_character, default = NA_character_),
    columns = new_property(class_list, default = list()),
    groups = new_property(class_list, default = list()),
    summaries = new_property(class_list, default = list()),
    overall_summary = new_property(
      new_union(GroupSummary, class_missing),
      default = NULL
    ),
    scale = new_property(class_character, default = "linear"),
    null_value = new_property(class_numeric, default = 0),
    axis_label = new_property(class_character, default = "Estimate"),
    effects = new_property(class_list, default = list()),  # List of EffectSpec for multi-effect
    theme = new_property(class_any, default = NULL),  # Set in web_spec()
    interaction = new_property(class_any, default = NULL),  # Set in web_spec()
    labels = new_property(class_any, default = NULL),  # PlotLabels for title/subtitle/etc
    annotations = new_property(class_list, default = list()),  # ReferenceLine, CustomAnnotation, etc.
    # Row-level style column mappings
    row_bold_col = new_property(class_character, default = NA_character_),
    row_italic_col = new_property(class_character, default = NA_character_),
    row_color_col = new_property(class_character, default = NA_character_),
    row_bg_col = new_property(class_character, default = NA_character_),
    row_badge_col = new_property(class_character, default = NA_character_),
    row_icon_col = new_property(class_character, default = NA_character_),
    row_indent_col = new_property(class_character, default = NA_character_),
    row_type_col = new_property(class_character, default = NA_character_)
  ),
  validator = function(self) {
    # Validate required columns exist
    cols <- names(self@data)

    if (!self@point_col %in% cols) {
      return(paste0("Column '", self@point_col, "' not found in data"))
    }
    if (!self@lower_col %in% cols) {
      return(paste0("Column '", self@lower_col, "' not found in data"))
    }
    if (!self@upper_col %in% cols) {
      return(paste0("Column '", self@upper_col, "' not found in data"))
    }

    # Validate optional columns if specified
    if (!is.na(self@label_col) && !self@label_col %in% cols) {
      return(paste0("Column '", self@label_col, "' not found in data"))
    }
    if (!is.na(self@group_col) && !self@group_col %in% cols) {
      return(paste0("Column '", self@group_col, "' not found in data"))
    }

    # Validate scale
    if (!self@scale %in% c("linear", "log")) {
      return("scale must be 'linear' or 'log'")
    }

    # Validate data values
    points <- self@data[[self@point_col]]
    lowers <- self@data[[self@lower_col]]
    uppers <- self@data[[self@upper_col]]

    if (any(lowers > uppers, na.rm = TRUE)) {
      return("lower values must be <= upper values")
    }

    # For log scale, values must be positive

if (self@scale == "log") {
      if (any(points <= 0, na.rm = TRUE) ||
          any(lowers <= 0, na.rm = TRUE) ||
          any(uppers <= 0, na.rm = TRUE)) {
        return("All point/lower/upper values must be positive for log scale")
      }
    }

    NULL
  }
)

#' Print method for WebSpec
#' @export
method(print, WebSpec) <- function(x, ...) {
  cli_inform(c(
    "A {.cls WebSpec} with {nrow(x@data)} row{?s}",
    "*" = "Point: {.field {x@point_col}}",
    "*" = "Interval: {.field {x@lower_col}} to {.field {x@upper_col}}",
    "*" = "Scale: {.val {x@scale}} (null = {x@null_value})",
    "*" = "Columns: {length(x@columns)}",
    "*" = "Groups: {length(x@groups)}"
  ))
  invisible(x)
}

# ============================================================================
# Meta-analysis convenience classes (optional add-ons)
# ============================================================================

#' Heterogeneity: Meta-analysis heterogeneity statistics
#'
#' Optional metadata for meta-analysis use cases.
#'
#' @param i2 I-squared statistic (0-100)
#' @param q Cochran's Q statistic
#' @param q_pvalue P-value for Q statistic
#' @param tau2 Tau-squared (between-study variance)
#'
#' @export
Heterogeneity <- new_class(
  "Heterogeneity",
  properties = list(
    i2 = new_property(class_numeric, default = NA_real_),
    q = new_property(class_numeric, default = NA_real_),
    q_pvalue = new_property(class_numeric, default = NA_real_),
    tau2 = new_property(class_numeric, default = NA_real_)
  ),
  validator = function(self) {
    if (!is.na(self@i2) && (self@i2 < 0 || self@i2 > 100)) {
      return("i2 must be between 0 and 100")
    }
    NULL
  }
)
