#' Create an interactive table visualization
#'
#' `tabviz()` is the main entry point for creating interactive table visualizations.
#' It returns an htmlwidget that can be displayed in R Markdown, Quarto, Shiny, or
#' the RStudio viewer.
#'
#' Use `col_*()` helpers in the `columns` argument to define what to display:
#' - `col_forest()` for forest plot intervals (point + CI)
#' - `col_text()`, `col_numeric()`, `col_pvalue()` for formatted values
#' - `col_bar()`, `col_sparkline()` for inline visualizations
#' - `col_badge()`, `col_icon()`, `col_stars()` for categorical displays
#'
#' For multi-effect forest plots, pass a list of `web_effect()` objects to `col_forest()`.
#'
#' @importFrom stats complete.cases
#'
#' @param data A data.frame, data.table, or tibble
#' @param label Column name for row labels (optional)
#' @param label_header Header text for the label column (default: "Study")
#' @param group Grouping specification. Can be:
#'   - Single string: Column name for flat grouping, e.g., `"category"`
#'   - Character vector: Column names for hierarchical nesting from outermost
#'     to innermost, e.g., `c("region", "country")` creates region > country
#'   - List of `web_group()` objects for explicit control over labels and structure
#' @param columns List of column specifications (use `col_*()` helpers).
#'   Include `col_forest()` to add a forest plot column.
#' @param annotations List of annotation objects (use `forest_refline()`, `forest_annotation()`)
#' @param title Main title (displayed above the plot)
#' @param subtitle Subtitle (displayed below the title)
#' @param caption Caption (displayed below the plot)
#' @param footnote Footnote (displayed below caption, italicized)
#' @param row_bold Row-level bold styling. Column name (character) or formula
#'   (e.g., `~ p_value < 0.05`) evaluating to logical values.
#' @param row_italic Row-level italic styling. Column name or formula.
#' @param row_color Row text color. Column name or formula returning CSS color strings.
#' @param row_bg Row background color. Column name or formula returning CSS color strings.
#' @param row_badge Label badges. Column name or formula returning text values.
#' @param row_icon Label icons. Column name or formula returning emoji/unicode.
#' @param row_indent Row indentation. Column name or formula returning numeric values.
#' @param row_type Row type. Column name or formula returning "data", "header", "summary", "spacer".
#' @param row_emphasis Emphasis styling (bold + foreground). Column name or formula (logical).
#' @param row_muted Muted styling (lighter, reduced prominence). Column name or formula (logical).
#' @param row_accent Accent styling (theme accent color). Column name or formula (logical).
#' @param marker_color Marker fill color. Column name or formula returning CSS color strings.
#' @param marker_shape Marker shape. Column name or formula returning "square", "circle", "diamond", "triangle".
#' @param marker_opacity Marker opacity. Column name or formula returning numeric 0-1.
#' @param marker_size Marker size multiplier. Column name or formula returning numeric values.
#' @param weight Deprecated: use marker_size instead
#' @param theme Theme object (use `web_theme_*()` functions)
#' @param interaction Interaction settings (use `web_interaction()`)
#' @param axis_range Numeric vector c(min, max) to override axis range
#' @param axis_ticks Numeric vector of explicit tick positions
#' @param axis_gridlines Logical to show/hide gridlines
#' @param plot_position "left" or "right" to set forest plot position
#' @param row_height Numeric row height in pixels
#' @param zoom Initial zoom level (0.5 to 2.0, default 1.0)
#' @param auto_fit When TRUE (default), shrink content to fit container if too large
#' @param max_width Maximum container width in pixels (NULL for none)
#' @param max_height Maximum container height in pixels (NULL for none)
#' @param show_zoom_controls Show zoom controls on hover (default TRUE)
#' @param width Widget width (default NULL for auto)
#' @param height Widget height (default NULL for auto)
#' @param elementId HTML element ID (optional)
#' @param split_by Column name(s) to split data into separate plots with sidebar navigation.
#'   Creates a SplitForest with one plot per unique value (or combination of values).
#' @param shared_axis When `split_by` is used, whether to use the same axis range
#'   across all split plots. Default is `FALSE`.
#' @param .spec_only If TRUE, return the WebSpec object instead of rendering.
#'   Useful for programmatic manipulation before rendering.
#'
#' @return An htmlwidget object, or a WebSpec object if `.spec_only = TRUE`
#'
#' @examples
#' \dontrun{
#' # Basic forest plot - returns interactive widget
#' data <- data.frame(
#'   study = c("A", "B", "C"),
#'   estimate = c(1.2, 0.8, 1.5),
#'   ci_lo = c(0.9, 0.5, 1.1),
#'   ci_hi = c(1.6, 1.2, 2.0),
#'   n = c(100, 150, 200)
#' )
#'
#' tabviz(
#'   data,
#'   label = "study",
#'   columns = list(
#'     col_text("study"),
#'     col_forest(point = "estimate", lower = "ci_lo", upper = "ci_hi"),
#'     col_numeric("n", header = "N")
#'   )
#' )
#'
#' # Log scale for odds ratios
#' tabviz(
#'   data,
#'   label = "study",
#'   columns = list(
#'     col_forest(
#'       point = "estimate", lower = "ci_lo", upper = "ci_hi",
#'       scale = "log", null_value = 1, axis_label = "Odds Ratio"
#'     )
#'   )
#' )
#'
#' # Get the spec object for manipulation
#' spec <- tabviz(data, label = "study",
#'   columns = list(col_forest(point = "estimate", lower = "ci_lo", upper = "ci_hi")),
#'   .spec_only = TRUE
#' )
#' print(spec)
#' as.data.frame(spec)
#' }
#'
#' @export
tabviz <- function(
    data,
    label = NULL,
    label_header = "Study",
    group = NULL,
    columns = NULL,
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
    row_emphasis = NULL,
    row_muted = NULL,
    row_accent = NULL,
    marker_color = NULL,
    marker_shape = NULL,
    marker_opacity = NULL,
    marker_size = NULL,
    weight = NULL,
    theme = web_theme_default(),
    interaction = web_interaction(),
    # Rendering options
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = NULL,
    plot_position = NULL,
    row_height = NULL,
    zoom = 1.0,
    auto_fit = TRUE,
    max_width = NULL,
    max_height = NULL,
    show_zoom_controls = TRUE,
    width = NULL,
    height = NULL,
    elementId = NULL,
    split_by = NULL,
    shared_axis = FALSE,
    .spec_only = FALSE) {
  # Convert data to data.frame
  data <- as.data.frame(data)

  # Resolve column names - strings only (no NSE magic)
  check_column <- function(col, arg_name, data) {
    if (!is.character(col) || length(col) != 1) {
      cli_abort("{.arg {arg_name}} must be a single column name string")
    }
    if (!col %in% names(data)) {
      cli_abort("Column {.val {col}} not found in data")
    }
    col
  }

  # Validate forest column data columns exist
  validate_forest_columns(columns, data)

  # Handle optional label column
  label_col <- NA_character_
  if (!is.null(label)) {
    label_col <- check_column(label, "label", data)
    # Auto-generate label_header from field name if still default
    if (label_header == "Study") {
      # Prettify: "study_name" -> "Study Name", "studyID" -> "Study ID"
      label_header <- gsub("_", " ", label_col)
      label_header <- gsub("([a-z])([A-Z])", "\\1 \\2", label_header)
      label_header <- tools::toTitleCase(label_header)
    }
  } else {
    # No label column - use row numbers
    label_header <- "#"
  }

  # Handle grouping - supports three modes via the `group` parameter:
  # 1. group = "col" - single flat grouping column
  # 2. group = c("col1", "col2") - hierarchical grouping (col1 > col2)
  # 3. group = list(web_group(...)) - explicit group definitions

  group_col <- NA_character_
  group_cols <- character(0)  # For hierarchical grouping
  resolved_groups <- list()

  if (!is.null(group)) {
    # Mode 3: Explicit list of web_group() objects
    if (is.list(group) && length(group) > 0) {
      # Validate that all elements are GroupSpec objects
      for (g in group) {
        if (!S7_inherits(g, GroupSpec)) {
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

      # Store all group columns for composite ID building in serialization
      group_cols <- group

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

  # Process annotations list
  annotations_list <- list()
  if (!is.null(annotations)) {
    annotations_list <- annotations
  }

  # Resolve row styling expressions (supports formulas like ~ p_value < 0.05)
  # This modifies `data` if computed columns are needed
  style_resolved <- resolve_row_style_exprs(
    data = data,
    row_bold = row_bold,
    row_italic = row_italic,
    row_color = row_color,
    row_bg = row_bg,
    row_badge = row_badge,
    row_icon = row_icon,
    row_indent = row_indent,
    row_type = row_type,
    row_emphasis = row_emphasis,
    row_muted = row_muted,
    row_accent = row_accent,
    marker_color = marker_color,
    marker_shape = marker_shape,
    marker_opacity = marker_opacity,
    marker_size = marker_size,
    weight = weight
  )
  data <- style_resolved$data

  # Resolve column styling expressions (supports formulas like ~ .x < 0.05)
  # For cell-level styling, .x refers to the column's own values
  if (length(columns) > 0) {
    col_resolved <- resolve_all_column_styles(columns, data, env = parent.frame())
    columns <- col_resolved$columns
    data <- col_resolved$data
  }

  # Build WebSpec
 spec <- WebSpec(
    data = data,
    label_col = label_col,
    label_header = label_header,
    group_col = group_col,
    group_cols = group_cols,
    columns = columns,
    groups = resolved_groups,
    theme = theme,
    interaction = interaction,
    labels = labels,
    annotations = annotations_list,
    row_bold_col = style_resolved$row_bold,
    row_italic_col = style_resolved$row_italic,
    row_color_col = style_resolved$row_color,
    row_bg_col = style_resolved$row_bg,
    row_badge_col = style_resolved$row_badge,
    row_icon_col = style_resolved$row_icon,
    row_indent_col = style_resolved$row_indent,
    row_type_col = style_resolved$row_type,
    row_emphasis_col = style_resolved$row_emphasis,
    row_muted_col = style_resolved$row_muted,
    row_accent_col = style_resolved$row_accent,
    marker_color_col = style_resolved$marker_color,
    marker_shape_col = style_resolved$marker_shape,
    marker_opacity_col = style_resolved$marker_opacity,
    marker_size_col = style_resolved$marker_size,
    weight_col = style_resolved$weight
  )

  # Return spec only if requested
  if (.spec_only) {
    return(spec)
  }

  # Handle split_by: create split forest and render

  if (!is.null(split_by)) {
    split_result <- split_table(spec, by = split_by, shared_axis = shared_axis)
    return(forest_plot_split(split_result, width = width, height = height, elementId = elementId))
  }

  # Render the widget
  render_tabviz_widget(
    spec,
    axis_range = axis_range,
    axis_ticks = axis_ticks,
    axis_gridlines = axis_gridlines,
    plot_position = plot_position,
    row_height = row_height,
    zoom = zoom,
    auto_fit = auto_fit,
    max_width = max_width,
    max_height = max_height,
    show_zoom_controls = show_zoom_controls,
    width = width,
    height = height,
    elementId = elementId
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

        # Use composite ID to handle same value under different parents
        # e.g., Phase_II under program_a vs Phase_II under program_c
        composite_id <- paste0(parent_val, "__", current_val)

        if (!composite_id %in% seen_ids) {
          # Create nice label (title case)
          label <- gsub("_", " ", current_val)
          label <- tools::toTitleCase(label)

          groups <- c(groups, list(GroupSpec(
            id = composite_id,
            label = label,
            parent_id = parent_val
          )))
          seen_ids <- c(seen_ids, composite_id)
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

#' Validate forest column data columns exist
#'
#' Checks all col_forest() columns in the columns list (including nested groups)
#' and verifies their point/lower/upper columns exist in the data.
#' For multi-effect forest columns, validates all effect column references.
#'
#' @param columns List of ColumnSpec/ColumnGroup objects
#' @param data The data frame
#' @keywords internal
validate_forest_columns <- function(columns, data) {
  if (is.null(columns) || length(columns) == 0) {
    return(invisible(NULL))
  }

  col_names <- names(data)

  # Helper to check a column exists in data
  check_col <- function(col_name, col_type) {
    if (!is.null(col_name) && !col_name %in% col_names) {
      cli_abort("Forest column references {col_type} column {.val {col_name}} not found in data")
    }
  }

  # Recursive function to check forest columns
  check_forest <- function(cols) {
    for (col in cols) {
      if (S7_inherits(col, ColumnGroup)) {
        check_forest(col@columns)
      } else if (S7_inherits(col, ColumnSpec) && col@type == "forest") {
        opts <- col@options$forest
        if (!is.null(opts)) {
          # Check inline single-effect columns
          check_col(opts$point, "point")
          check_col(opts$lower, "lower")
          check_col(opts$upper, "upper")

          # Check inline multi-effect columns (effects is a list of serialized EffectSpec)
          if (!is.null(opts$effects) && is.list(opts$effects)) {
            for (i in seq_along(opts$effects)) {
              effect <- opts$effects[[i]]
              check_col(effect$pointCol, paste0("effect ", i, " point"))
              check_col(effect$lowerCol, paste0("effect ", i, " lower"))
              check_col(effect$upperCol, paste0("effect ", i, " upper"))
            }
          }
        }
      }
    }
  }

  check_forest(columns)
  invisible(NULL)
}

#' Render a WebSpec as an htmlwidget
#'
#' Internal function to render a WebSpec object as an htmlwidget.
#' Used by both `tabviz()` and `forest_plot()`.
#'
#' @param spec A WebSpec object
#' @param axis_range Numeric vector c(min, max) to override axis range
#' @param axis_ticks Numeric vector of explicit tick positions
#' @param axis_gridlines Logical to show/hide gridlines
#' @param plot_position "left" or "right" position
#' @param row_height Row height in pixels
#' @param zoom Initial zoom level
#' @param auto_fit Auto-fit to container
#' @param max_width Maximum width
#' @param max_height Maximum height
#' @param show_zoom_controls Show zoom controls
#' @param width Widget width
#' @param height Widget height
#' @param elementId Element ID
#' @param include_forest Whether to include forest plot data in serialization
#'
#' @return An htmlwidget
#' @keywords internal
render_tabviz_widget <- function(
    spec,
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = NULL,
    plot_position = NULL,
    row_height = NULL,
    zoom = 1.0,
    auto_fit = TRUE,
    max_width = NULL,
    max_height = NULL,
    show_zoom_controls = TRUE,
    width = NULL,
    height = NULL,
    elementId = NULL,
    include_forest = TRUE) {

  # Validate rendering options
  checkmate::assert_number(zoom, lower = 0.5, upper = 2.0)
  checkmate::assert_flag(auto_fit)
  checkmate::assert_flag(show_zoom_controls)
  if (!is.null(max_width)) checkmate::assert_number(max_width, lower = 100)
  if (!is.null(max_height)) checkmate::assert_number(max_height, lower = 100)

  # Apply visual overrides to theme
  if (!is.null(axis_range) && length(axis_range) == 2) {
    spec@theme@axis@range_min <- axis_range[1]
    spec@theme@axis@range_max <- axis_range[2]
  }
  if (!is.null(axis_ticks)) {
    # Filter ticks to axis_range if both are specified, with warning
    if (!is.null(axis_range) && length(axis_range) == 2) {
      in_range <- axis_ticks >= axis_range[1] & axis_ticks <= axis_range[2]
      if (!all(in_range)) {
        excluded <- axis_ticks[!in_range]
        cli_warn(c(
          "Some {.arg axis_ticks} values fall outside {.arg axis_range} and will be excluded.",
          "i" = "Excluded ticks: {.val {excluded}}",
          "i" = "axis_range: [{axis_range[1]}, {axis_range[2]}]"
        ))
        axis_ticks <- axis_ticks[in_range]
      }
    }
    spec@theme@axis@tick_values <- axis_ticks
  }
  if (!is.null(axis_gridlines)) {
    spec@theme@axis@gridlines <- axis_gridlines
  }
  if (!is.null(plot_position)) {
    spec@theme@layout@plot_position <- plot_position
  }
  if (!is.null(row_height)) {
    spec@theme@spacing@row_height <- row_height
  }

  # Serialize to JSON-ready structure
  payload <- serialize_spec(spec, include_forest = include_forest)

  # Add zoom and sizing settings
  payload$zoom <- zoom
  payload$autoFit <- auto_fit
  payload$maxWidth <- max_width
  payload$maxHeight <- max_height
  payload$showZoomControls <- show_zoom_controls

  # Create widget
  widget <- htmlwidgets::createWidget(
    name = "tabviz",
    x = payload,
    width = width,
    height = height,
    package = "tabviz",
    elementId = elementId,
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      defaultHeight = 400,
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = 400
    )
  )

  # Attach WebSpec for fluent API and save_plot() to use
  attr(widget, "webspec") <- spec
  attr(widget, "widget_type") <- "tabviz"

  widget
}

#' @rdname tabviz
#' @export
web_spec <- function(..., .spec_only = TRUE) {
  tabviz(..., .spec_only = .spec_only)
}
