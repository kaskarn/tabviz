#' Create an interactive forest plot
#'
#' `forest_plot()` renders a web-native, interactive forest plot visualization.
#' It can accept either a WebSpec object (from `web_spec()`) or raw data.
#'
#' Forest plots display point estimates with intervals alongside tabular data.
#' While commonly used for meta-analysis, they work for any data with
#' point + interval structure (QC measurements, regression coefficients, etc.).
#'
#' @param x Either a WebSpec object or a data.frame/data.table/tibble
#' @param ... Arguments passed to `web_spec()` when x is a data frame.
#'   Common arguments: `point`, `lower`, `upper`, `label`, `group`,
#'   `columns`, `scale`, `null_value`, `axis_label`, `weight`, `theme`, `interaction`
#' @param axis_range Numeric vector c(min, max) to override axis range from theme
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
    ...,
    axis_range = NULL,
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

  # Handle WebSpec or raw data
  if (inherits(x, "webforest::WebSpec")) {
    spec <- x
  } else if (is.data.frame(x)) {
    spec <- web_spec(x, ...)
  } else {
    cli_abort("{.arg x} must be a WebSpec object or a data frame")
  }

  # Apply visual overrides to theme
  if (!is.null(axis_range) && length(axis_range) == 2) {
    spec@theme@axis@range_min <- axis_range[1]
    spec@theme@axis@range_max <- axis_range[2]
  }
  if (!is.null(axis_ticks)) {
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

  # Attach WebSpec for save_plot() to use

  attr(widget, "webspec") <- spec

  widget
}

#' Plot method for WebSpec
#'
#' Renders a WebSpec as a forest plot.
#'
#' @param x A WebSpec object
#' @param ... Additional arguments passed to forest_plot
#'
#' @return An htmlwidget
#' @export
method(plot, WebSpec) <- function(x, ...) {
  forest_plot(x, ...)
}
