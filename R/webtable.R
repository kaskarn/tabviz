#' Create an interactive web table (deprecated)
#'
#' `webtable()` is deprecated. Use `tabviz()` directly instead.
#'
#' The forest plot column is now controlled via `col_forest()` in the columns list.
#' Tables without a forest column simply omit `col_forest()`.
#'
#' @param x Either a WebSpec object or a data.frame/data.table/tibble
#' @param ... Arguments passed to `tabviz()` when x is a data frame.
#' @param zoom Initial zoom level (0.5 to 2.0, default 1.0)
#' @param auto_fit When TRUE (default), shrink content to fit container if too large
#' @param max_width Maximum container width in pixels (NULL for none)
#' @param max_height Maximum container height in pixels (NULL for none)
#' @param show_zoom_controls Show zoom controls on hover (default TRUE)
#' @param width Widget width (default NULL for auto)
#' @param height Widget height (default NULL for auto)
#' @param elementId HTML element ID (optional)
#'
#' @return An htmlwidget object
#'
#' @examples
#' \dontrun{
#' # Modern approach - use tabviz() directly
#' data <- data.frame(
#'   item = c("A", "B", "C"),
#'   value = c(1.2, 0.8, 1.5),
#'   n = c(100, 150, 75)
#' )
#'
#' # Table with custom columns (no forest plot)
#' tabviz(
#'   data,
#'   label = "item",
#'   columns = list(
#'     col_text("item"),
#'     col_numeric("value"),
#'     col_n("n")
#'   )
#' )
#'
#' # Add forest plot by including col_forest()
#' tabviz(
#'   data,
#'   label = "item",
#'   columns = list(
#'     col_text("item"),
#'     col_forest(point = "value", lower = "lo", upper = "hi"),
#'     col_n("n")
#'   )
#' )
#' }
#'
#' @seealso [tabviz()] for the main entry point
#'
#' @export
webtable <- function(
    x,
    ...,
    zoom = 1.0,
    auto_fit = TRUE,
    max_width = NULL,
    max_height = NULL,
    show_zoom_controls = TRUE,
    width = NULL,
    height = NULL,
    elementId = NULL) {

  # Handle WebSpec or raw data
  if (S7_inherits(x, WebSpec)) {
    spec <- x
  } else if (is.data.frame(x)) {
    spec <- tabviz(x, ..., .spec_only = TRUE)
  } else {
    cli_abort("{.arg x} must be a WebSpec object or a data frame")
  }

  # Use the shared rendering function with include_forest = FALSE
  render_tabviz_widget(
    spec,
    zoom = zoom,
    auto_fit = auto_fit,
    max_width = max_width,
    max_height = max_height,
    show_zoom_controls = show_zoom_controls,
    width = width,
    height = height,
    elementId = elementId,
    include_forest = FALSE
  )
}
