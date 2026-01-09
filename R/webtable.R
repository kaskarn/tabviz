#' Create an interactive web table
#'
#' `webtable()` renders a web-native, interactive table visualization
#' without the forest plot graphical column. Useful for displaying
#' tabular data with sorting, filtering, and other interactive features.
#'
#' @param x Either a WebSpec object or a data.frame/data.table/tibble
#' @param ... Arguments passed to `web_spec()` when x is a data frame.
#'   Common arguments: `point`, `lower`, `upper`, `label`, `group`,
#'   `columns`, `theme`, `interaction`
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
#' data <- data.frame(
#'   item = c("A", "B", "C"),
#'   value = c(1.2, 0.8, 1.5),
#'   lo = c(0.9, 0.5, 1.1),
#'   hi = c(1.6, 1.2, 2.0),
#'   n = c(100, 150, 75)
#' )
#'
#' # Create spec
#' spec <- web_spec(
#'   data,
#'   point = "value",
#'   lower = "lo",
#'   upper = "hi",
#'   label = "item",
#'   columns = list(col_n(), col_interval())
#' )
#'
#' # Table only (no forest column)
#' webtable(spec)
#'
#' # With forest column
#' forest_plot(spec)
#' }
#'
#' @seealso [web_spec()] for creating specifications, [forest_plot()] for forest plot rendering
#'
#' @export
webtable <- function(
    x,
    ...,
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
    cli_warn(c(
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

  # Serialize to JSON-ready structure (without forest column)
  payload <- serialize_spec(spec, include_forest = FALSE)

  # Add layout mode settings
  payload$widthMode <- width_mode
  payload$heightPreset <- height_preset

  # Create widget (uses same JS, but with includeForest = FALSE)
  widget <- htmlwidgets::createWidget(
    name = "webforest",
    x = payload,
    width = width,
    height = height,
    package = "webforest",
    elementId = elementId,
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      defaultHeight = 300,
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = 300
    )
  )

  # Attach WebSpec for fluent API and save_plot() to use
  attr(widget, "webspec") <- spec
  attr(widget, "widget_type") <- "webtable"

  widget
}
