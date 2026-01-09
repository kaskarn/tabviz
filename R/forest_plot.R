#' Create an interactive forest plot
#'
#' `forest_plot()` renders a web-native, interactive forest plot visualization.
#' It can accept either a WebSpec object (from `web_spec()`) or raw data.
#'
#' Forest plots display point estimates with intervals alongside tabular data.
#' While commonly used for meta-analysis, they work for any data with
#' point + interval structure (QC measurements, regression coefficients, etc.).
#'
#' @param x Either a WebSpec object, a SplitForest object, or a data.frame/data.table/tibble
#' @param point Column name for point estimates (string). Required when x is a data frame.
#' @param lower Column name for lower bounds of intervals (string). Required when x is a data frame.
#' @param upper Column name for upper bounds of intervals (string). Required when x is a data frame.
#' @param label Column name for row labels (optional string)
#' @param group Grouping column name(s) or list of `web_group()` objects
#' @param columns List of column specifications (use `col_*()` helpers)
#' @param scale Scale type: "linear" (default) or "log"
#' @param null_value Reference value for null effect. Default: 0 for linear, 1 for log
#' @param axis_label Label for the graphical axis
#' @param theme Theme object (use `web_theme_*()` functions)
#' @param row_bg Column name for row background color (CSS color strings).
#'   Use this for data-driven row highlighting.
#' @param ... Additional arguments passed to `web_spec()` when x is a data frame.
#'   See `?web_spec` for all available options including row styling, marker styling,
#'   effects, annotations, and labels.
#' @param split_by Column name(s) to split data into separate plots. When specified,
#'   creates a SplitForest with sidebar navigation. Can be a single column name or
#'   a character vector for hierarchical splits (e.g., `c("region", "age_group")`).
#' @param shared_axis When `split_by` is used, whether to use the same axis range
#'   across all split plots for easier comparison. Default is `FALSE`.
#' @param axis_range Numeric vector c(min, max) to override axis range from theme
#' @param axis_trim IQR multiplier for automatic outlier trimming. When set (e.g., 2),
#'   the axis range is computed as `median ± axis_trim * IQR` of the point estimates.
#'   Intervals extending beyond this range show arrow indicators.
#'   Ignored if `axis_range` is also specified.
#' @param axis_ticks Numeric vector of explicit tick positions
#' @param axis_gridlines Logical to show/hide gridlines (overrides theme)
#' @param plot_position "left" or "right" to override plot position from theme
#' @param row_height Numeric row height in pixels (overrides theme)
#' @param width_mode Layout width mode: "natural" (centered at natural width, default) or "fill" (scale to fill container)
#' @param height_preset Layout height preset: "small" (200px), "medium" (400px), "large" (600px),
#'   "full" (natural height, no constraint), or "container" (fill parent). Default is "full".
#' @param height_mode Deprecated. Use `height_preset` instead.
#' @param width Widget width (default NULL for auto)
#' @param height Widget height (default NULL for auto)
#' @param elementId HTML element ID (optional)
#'
#' @return An htmlwidget object
#'
#' @examples
#' \dontrun{
#' # Method 1: Direct from data
#' data <- data.frame(
#'   item = c("Line A", "Line B", "Line C"),
#'   median = c(1.2, 0.8, 1.5),
#'   min = c(0.9, 0.5, 1.1),
#'   max = c(1.6, 1.2, 2.0)
#' )
#'
#' forest_plot(data, point = "median", lower = "min", upper = "max", label = "item")
#'
#' # Method 2: From WebSpec (more control)
#' spec <- web_spec(
#'   data,
#'   point = "median",
#'   lower = "min",
#'   upper = "max",
#'   label = "item",
#'   scale = "log",
#'   null_value = 1
#' )
#'
#' # Inspect the spec
#' print(spec)
#' as.data.frame(spec)
#'
#' # Render as forest plot
#' forest_plot(spec)
#'
#' # With visual overrides
#' forest_plot(spec, axis_range = c(0.5, 2), axis_gridlines = TRUE)
#'
#' # Or as table only
#' webtable(spec)
#' }
#'
#' @seealso [web_spec()] for creating specifications, [webtable()] for table-only rendering
#'
#' @export
forest_plot <- function(
    x,
    point = NULL,
    lower = NULL,
    upper = NULL,
    label = NULL,
    group = NULL,
    columns = NULL,
    scale = NULL,
    null_value = NULL,
    axis_label = NULL,
    theme = NULL,
    row_bg = NULL,
    ...,
    split_by = NULL,
    shared_axis = FALSE,
    axis_range = NULL,
    axis_trim = NULL,
    axis_ticks = NULL,
    axis_gridlines = NULL,
    plot_position = NULL,
    row_height = NULL,
    width_mode = c("natural", "fill"),
    height_preset = c("full", "small", "medium", "large", "container"),
    height_mode = NULL,
    width = NULL,
    height = NULL,
    elementId = NULL) {

  # Validate layout mode arguments
  width_mode <- match.arg(width_mode)

  # Handle deprecated height_mode parameter
  if (!is.null(height_mode)) {
    cli::cli_warn(c(
      "{.arg height_mode} is deprecated.",
      "i" = "Use {.arg height_preset} instead.",
      "i" = 'Mapping "{height_mode}" to "{if (height_mode == "auto") "full" else "medium"}".'
    ))
    height_preset <- if (height_mode == "auto") "full" else "medium"
  } else {
    height_preset <- match.arg(height_preset)
  }

  # Handle SplitForest objects directly
  if (S7_inherits(x, SplitForest)) {
    return(forest_plot_split(x, width = width, height = height, elementId = elementId))
  }

  # Handle WebSpec or raw data
  if (S7_inherits(x, WebSpec)) {
    spec <- x
  } else if (is.data.frame(x)) {
    # Build args list from explicit parameters, omitting NULLs
    spec_args <- list(data = x)
    if (!is.null(point)) spec_args$point <- point
    if (!is.null(lower)) spec_args$lower <- lower
    if (!is.null(upper)) spec_args$upper <- upper
    if (!is.null(label)) spec_args$label <- label
    if (!is.null(group)) spec_args$group <- group
    if (!is.null(columns)) spec_args$columns <- columns
    if (!is.null(scale)) spec_args$scale <- scale
    if (!is.null(null_value)) spec_args$null_value <- null_value
    if (!is.null(axis_label)) spec_args$axis_label <- axis_label
    if (!is.null(theme)) spec_args$theme <- theme
    if (!is.null(row_bg)) spec_args$row_bg <- row_bg

    # Add any extra args from ...
    extra_args <- list(...)
    spec_args <- c(spec_args, extra_args)

    spec <- do.call(web_spec, spec_args)
  } else {
    cli_abort("{.arg x} must be a WebSpec object, SplitForest object, or a data frame")
  }

  # If split_by is specified, create a SplitForest and render it

  if (!is.null(split_by)) {
    split_result <- split_forest(spec, by = split_by, shared_axis = shared_axis)
    return(forest_plot_split(split_result, width = width, height = height, elementId = elementId))
  }

  # Apply visual overrides to theme
  if (!is.null(axis_range) && length(axis_range) == 2) {
    spec@theme@axis@range_min <- axis_range[1]
    spec@theme@axis@range_max <- axis_range[2]
  } else if (!is.null(axis_trim) && is.numeric(axis_trim)) {
    # Compute axis range from IQR-based trimming
    points <- spec@data[[spec@point_col]]
    points <- points[!is.na(points)]
    if (length(points) > 0) {
      med <- stats::median(points)
      iqr_val <- stats::IQR(points)
      spec@theme@axis@range_min <- med - axis_trim * iqr_val
      spec@theme@axis@range_max <- med + axis_trim * iqr_val
    }
  }
  if (!is.null(axis_ticks)) {
    # Filter ticks to axis_range if both are specified, with warning
    if (!is.null(axis_range) && length(axis_range) == 2) {
      in_range <- axis_ticks >= axis_range[1] & axis_ticks <= axis_range[2]
      if (!all(in_range)) {
        excluded <- axis_ticks[!in_range]
        cli::cli_warn(c(

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
  payload <- serialize_spec(spec, include_forest = TRUE)

  # Add layout mode settings
  payload$widthMode <- width_mode
  payload$heightPreset <- height_preset

  # Create widget
  widget <- htmlwidgets::createWidget(
    name = "webforest",
    x = payload,
    width = width,
    height = height,
    package = "webforest",
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
  attr(widget, "widget_type") <- "forest_plot"

  widget
}

method(plot, WebSpec) <- function(x, ...) {
  forest_plot(x, ...)
}

method(plot, SplitForest) <- function(x, ...) {
  forest_plot(x, ...)
}

#' Render a SplitForest as an htmlwidget
#'
#' Internal function to create the split forest widget.
#'
#' @param x A SplitForest object
#' @param width Widget width (default NULL for auto)
#' @param height Widget height (default NULL for auto)
#' @param elementId HTML element ID (optional)
#'
#' @return An htmlwidget
#' @keywords internal
forest_plot_split <- function(x, width = NULL, height = NULL, elementId = NULL) {
  # Serialize the SplitForest

  payload <- serialize_split_forest(x, include_forest = TRUE)

  # Create widget
  widget <- htmlwidgets::createWidget(
    name = "webforest_split",
    x = payload,
    width = width,
    height = height,
    package = "webforest",
    elementId = elementId,
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      defaultHeight = 600,
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = 600
    )
  )

  # Attach SplitForest for save_plot() to use
  attr(widget, "splitforest") <- x

  widget
}
