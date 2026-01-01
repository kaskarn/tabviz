#' Create a web specification for table visualizations
#'
#' `web_spec()` creates the core data structure that can be rendered as
#' a forest plot, interactive table, or other visualizations. This is
#' the recommended way to prepare data for rendering.
#'
#' @param data A data.frame, data.table, or tibble
#' @param point Column name for point estimates (unquoted or string)
#' @param lower Column name for lower bounds of intervals
#' @param upper Column name for upper bounds of intervals
#' @param label Column name for row labels (optional)
#' @param label_header Header text for the label column (default: "Study")
#' @param group Grouping specification. Can be:
#'   - Single string: Column name for flat grouping, e.g., `"category"`
#'   - Character vector: Column names for hierarchical nesting from outermost
#'     to innermost, e.g., `c("region", "country")` creates region > country
#'   - List of `web_group()` objects for explicit control over labels and structure
#' @param columns List of column specifications (use `col_*()` helpers)
#' @param scale Scale type: "linear" (default) or "log"
#' @param null_value Reference value for null effect. Default: 0 for linear, 1 for log
#' @param axis_label Label for the graphical axis
#' @param effects List of EffectSpec objects for multi-effect plots (use `web_effect()`)
#' @param annotations List of annotation objects (use `forest_refline()`, `forest_annotation()`)
#' @param title Main title (displayed above the plot)
#' @param subtitle Subtitle (displayed below the title)
#' @param caption Caption (displayed below the plot)
#' @param footnote Footnote (displayed below caption, italicized)
#' @param row_bold Column name for row-level bold styling (logical values)
#' @param row_italic Column name for row-level italic styling (logical values)
#' @param row_color Column name for row text color (CSS color strings)
#' @param row_bg Column name for row background color (CSS color strings)
#' @param row_badge Column name for label badges (text values)
#' @param row_icon Column name for label icons (emoji/unicode)
#' @param row_indent Column name for row indentation (numeric values)
#' @param row_type Column name for row type ("data", "header", "summary", "spacer")
#' @param theme Theme object (use `web_theme_*()` functions)
#' @param interaction Interaction settings (use `web_interaction()`)
#'
#' @return A WebSpec object that can be rendered with `forest_plot()` or `webtable()`
#'
#' @examples
#' \dontrun{
#' # Basic specification
#' data <- data.frame(
#'   item = c("A", "B", "C"),
#'   value = c(1.2, 0.8, 1.5),
#'   lo = c(0.9, 0.5, 1.1),
#'   hi = c(1.6, 1.2, 2.0)
#' )
#'
#' spec <- web_spec(data, point = "value", lower = "lo", upper = "hi", label = "item")
#'
#' # Render as forest plot
#' forest_plot(spec)
#'
#' # Render as table only
#' webtable(spec)
#'
#' # With log scale (for ratios)
#' spec_log <- web_spec(
#'   data,
#'   point = "value",
#'   lower = "lo",
#'   upper = "hi",
#'   scale = "log",
#'   null_value = 1,
#'   axis_label = "Odds Ratio"
#' )
#' }
#'
#' @export
web_spec <- function(
    data,
    point,
    lower,
    upper,
    label = NULL,
    label_header = "Study",
    group = NULL,
    columns = NULL,
    scale = c("linear", "log"),
    null_value = NULL,
    axis_label = NULL,
    effects = NULL,
    annotations = NULL,
    title = NULL,
    subtitle = NULL,
    caption = NULL,
    footnote = NULL,
    row_bold = NULL,
    row_italic = NULL,
    row_color = NULL,
    row_bg = NULL,
    row_badge = NULL,
    row_icon = NULL,
    row_indent = NULL,
    row_type = NULL,
    theme = web_theme_default(),
    interaction = web_interaction()) {
  # Match scale
 scale <- match.arg(scale)

  # Set default null_value based on scale
  if (is.null(null_value)) {
    null_value <- if (scale == "log") 1 else 0
  }

  # Set default axis_label
  if (is.null(axis_label)) {
    axis_label <- "Estimate"
  }

  # Convert data to data.frame
  data <- as.data.frame(data)

  # Resolve column names (support for strings)
  point_col <- as.character(substitute(point))
  if (length(point_col) > 1 || !point_col %in% names(data)) {
    # Try as literal string
    if (is.character(point) && point %in% names(data)) {
      point_col <- point
    } else {
      cli_abort("Column {.arg point} not found in data")
    }
  }

  lower_col <- as.character(substitute(lower))
  if (length(lower_col) > 1 || !lower_col %in% names(data)) {
    if (is.character(lower) && lower %in% names(data)) {
      lower_col <- lower
    } else {
      cli_abort("Column {.arg lower} not found in data")
    }
  }

  upper_col <- as.character(substitute(upper))
  if (length(upper_col) > 1 || !upper_col %in% names(data)) {
    if (is.character(upper) && upper %in% names(data)) {
      upper_col <- upper
    } else {
      cli_abort("Column {.arg upper} not found in data")
    }
  }

  # Handle optional label column
  label_col <- NA_character_
  if (!is.null(label)) {
    label_col <- as.character(substitute(label))
    if (length(label_col) > 1 || !label_col %in% names(data)) {
      if (is.character(label) && label %in% names(data)) {
        label_col <- label
      } else {
        cli_abort("Column {.arg label} not found in data")
      }
    }
  }

  # Handle grouping - supports three modes via the `group` parameter:
  # 1. group = "col" - single flat grouping column
  # 2. group = c("col1", "col2") - hierarchical grouping (col1 > col2)
  # 3. group = list(web_group(...)) - explicit group definitions

  group_col <- NA_character_
  resolved_groups <- list()

  if (!is.null(group)) {
    # Mode 3: Explicit list of web_group() objects
    if (is.list(group) && length(group) > 0) {
      # Validate that all elements are GroupSpec objects
      for (g in group) {
        if (!S7::S7_inherits(g, GroupSpec)) {
          cli_abort("{.arg group} list must contain {.fn web_group} objects")
        }
      }
      resolved_groups <- group

      # Use the first non-parent group's ID pattern to infer group column
      # For explicit groups, user should also specify which column to use
      # For now, we'll require at least one data column to match group IDs
      all_ids <- sapply(group, function(g) g@id)
      for (col in names(data)) {
        if (all(unique(data[[col]]) %in% all_ids)) {
          group_col <- col
          break
        }
      }
      if (is.na(group_col)) {
        cli_abort("Could not find a data column matching group IDs. Ensure data has a column with values matching your web_group() IDs.")
      }

    # Mode 2: Hierarchical grouping with multiple column names
    } else if (is.character(group) && length(group) > 1) {
      # Validate all group columns exist
      missing_cols <- setdiff(group, names(data))
      if (length(missing_cols) > 0) {
        cli_abort("Group columns not found in data: {.val {missing_cols}}")
      }

      # Use the deepest level (last column) as the row grouping column
      group_col <- group[length(group)]

      # Build hierarchical groups from data
      resolved_groups <- build_hierarchical_groups(data, group)

    # Mode 1: Single column flat grouping
    } else if (is.character(group) && length(group) == 1) {
      # Handle NSE (non-standard evaluation) or string
      group_col <- as.character(substitute(group))
      if (length(group_col) > 1 || !group_col %in% names(data)) {
        if (group %in% names(data)) {
          group_col <- group
        } else {
          cli_abort("Column {.arg group} not found in data")
        }
      }

      # Extract unique groups from data column
      unique_groups <- unique(data[[group_col]])
      unique_groups <- unique_groups[!is.na(unique_groups)]
      resolved_groups <- lapply(unique_groups, function(g) {
        GroupSpec(id = as.character(g), label = as.character(g))
      })

    } else {
      cli_abort("{.arg group} must be a column name, vector of column names, or list of {.fn web_group} objects")
    }
  }

  # Process columns - ensure they're ColumnSpec or ColumnGroup objects
  if (is.null(columns)) {
    columns <- list()
  } else {
    columns <- lapply(columns, function(col) {
      if (S7_inherits(col, ColumnSpec) || S7_inherits(col, ColumnGroup)) {
        col
      } else if (is.character(col)) {
        col_text(col)
      } else {
        cli_abort("columns must be ColumnSpec objects or column names")
      }
    })
  }

  # Build labels if any are provided
  labels <- NULL
  if (!is.null(title) || !is.null(subtitle) || !is.null(caption) || !is.null(footnote)) {
    labels <- PlotLabels(
      title = title %||% NA_character_,
      subtitle = subtitle %||% NA_character_,
      caption = caption %||% NA_character_,
      footnote = footnote %||% NA_character_
    )
  }

  # Process effects list
  effects_list <- list()
  if (!is.null(effects)) {
    effects_list <- effects
  }

  # Process annotations list
  annotations_list <- list()
  if (!is.null(annotations)) {
    annotations_list <- annotations
  }

  # Build and return WebSpec
  WebSpec(
    data = data,
    point_col = point_col,
    lower_col = lower_col,
    upper_col = upper_col,
    label_col = label_col,
    label_header = label_header,
    group_col = group_col,
    columns = columns,
    groups = resolved_groups,
    scale = scale,
    null_value = null_value,
    axis_label = axis_label,
    effects = effects_list,
    theme = theme,
    interaction = interaction,
    labels = labels,
    annotations = annotations_list,
    row_bold_col = row_bold %||% NA_character_,
    row_italic_col = row_italic %||% NA_character_,
    row_color_col = row_color %||% NA_character_,
    row_bg_col = row_bg %||% NA_character_,
    row_badge_col = row_badge %||% NA_character_,
    row_icon_col = row_icon %||% NA_character_,
    row_indent_col = row_indent %||% NA_character_,
    row_type_col = row_type %||% NA_character_
  )
}

#' Build hierarchical groups from column names
#'
#' Given a data frame and a vector of column names representing hierarchy levels,
#' creates GroupSpec objects with proper parent-child relationships.
#'
#' @param data The data frame
#' @param group_cols Character vector of column names, from outermost to innermost
#' @return List of GroupSpec objects
#' @keywords internal
build_hierarchical_groups <- function(data, group_cols) {
  groups <- list()
  seen_ids <- character()

  # Process each level of the hierarchy
  for (level in seq_along(group_cols)) {
    col <- group_cols[level]

    # Get unique values at this level, with their parent context
    if (level == 1) {
      # Top level - no parent
      unique_vals <- unique(data[[col]])
      unique_vals <- unique_vals[!is.na(unique_vals)]

      for (val in unique_vals) {
        id <- as.character(val)
        if (!id %in% seen_ids) {
          # Create nice label (title case)
          label <- gsub("_", " ", id)
          label <- tools::toTitleCase(label)

          groups <- c(groups, list(GroupSpec(
            id = id,
            label = label,
            parent_id = NA_character_
          )))
          seen_ids <- c(seen_ids, id)
        }
      }
    } else {
      # Nested level - need to determine parent from previous column
      parent_col <- group_cols[level - 1]

      # Get unique combinations of parent + current
      combos <- unique(data[, c(parent_col, col), drop = FALSE])
      combos <- combos[complete.cases(combos), , drop = FALSE]

      for (i in seq_len(nrow(combos))) {
        parent_val <- as.character(combos[i, parent_col])
        current_val <- as.character(combos[i, col])

        if (!current_val %in% seen_ids) {
          # Create nice label (title case)
          label <- gsub("_", " ", current_val)
          label <- tools::toTitleCase(label)

          groups <- c(groups, list(GroupSpec(
            id = current_val,
            label = label,
            parent_id = parent_val
          )))
          seen_ids <- c(seen_ids, current_val)
        }
      }
    }
  }

  groups
}

#' Extract data from a WebSpec
#'
#' @param x A WebSpec object
#' @param ... Ignored
#'
#' @return A data.frame
#' @export
as.data.frame.WebSpec <- function(x, ...) {
  x@data
}

# Register the S3 method for S7 class
method(as.data.frame, WebSpec) <- function(x, ...) {
  x@data
}
