#' Create an interactive forest plot
#'
#' `forest_plot()` is a convenience wrapper around `tabviz()` that automatically
#' creates a forest plot column from point/lower/upper arguments. For full control
#' over columns and layout, use `tabviz()` directly with `col_forest()`.
#'
#' Forest plots display point estimates with confidence intervals alongside tabular data.
#' While commonly used for meta-analysis, they work for any data with
#' point + interval structure (QC measurements, regression coefficients, etc.).
#'
#' @param x Either a WebSpec object, a SplitForest object, or a data.frame/data.table/tibble
#' @param point Column name for point estimates (string). Required when x is a data frame
#'   and `effects` is not provided.
#' @param lower Column name for lower bounds of intervals (string). Required when x is a
#'   data frame and `effects` is not provided.
#' @param upper Column name for upper bounds of intervals (string). Required when x is a
#'   data frame and `effects` is not provided.
#' @param effects List of `web_effect()` objects for multi-effect plots. When provided,
#'   `point`, `lower`, and `upper` are ignored.
#' @param label Column name for row labels (optional string)
#' @param group Grouping column name(s) or list of `web_group()` objects
#' @param columns Additional column specifications (use `col_*()` helpers).
#'   These are added alongside the auto-generated forest column.
#' @param scale Scale type: "linear" (default) or "log"
#' @param null_value Reference value for null effect. Default: 0 for linear, 1 for log
#' @param axis_label Label for the graphical axis
#' @param theme Theme object (use `web_theme_*()` functions)
#' @param ... Additional arguments passed to `tabviz()`.
#'   See `?tabviz` for all available options including row styling, marker styling,
#'   annotations, labels, and rendering options.
#' @param split_by Column name(s) to split data into separate plots with sidebar navigation.
#' @param shared_axis When `split_by` is used, whether to use the same axis range
#'   across all split plots. Default is `FALSE`.
#' @param width Widget width (default NULL for auto)
#' @param height Widget height (default NULL for auto)
#' @param elementId HTML element ID (optional)
#'
#' @return An htmlwidget object
#'
#' @examples
#' \dontrun{
#' # Quick forest plot from data
#' data <- data.frame(
#'   study = c("Study A", "Study B", "Study C"),
#'   hr = c(0.72, 0.85, 0.91),
#'   lower = c(0.55, 0.70, 0.75),
#'   upper = c(0.95, 1.03, 1.10)
#' )
#'
#' forest_plot(data, point = "hr", lower = "lower", upper = "upper", label = "study")
#'
#' # Log scale for odds/hazard ratios
#' forest_plot(data, point = "hr", lower = "lower", upper = "upper",
#'             label = "study", scale = "log", null_value = 1)
#'
#' # Multi-effect plot (e.g., ITT vs Per-Protocol)
#' forest_plot(
#'   data,
#'   label = "study",
#'   effects = list(
#'     web_effect("itt_or", "itt_lo", "itt_hi", label = "ITT", color = "#2563eb"),
#'     web_effect("pp_or", "pp_lo", "pp_hi", label = "Per-Protocol", color = "#16a34a")
#'   ),
#'   scale = "log", null_value = 1
#' )
#'
#' # For more control, use tabviz() directly
#' tabviz(
#'   data,
#'   label = "study",
#'   columns = list(
#'     col_text("study"),
#'     col_forest(point = "hr", lower = "lower", upper = "upper",
#'                scale = "log", null_value = 1),
#'     col_numeric("n", header = "N")
#'   )
#' )
#' }
#'
#' @seealso [tabviz()] for full control, [col_forest()] for forest column options
#'
#' @export
forest_plot <- function(
    x,
    point = NULL,
    lower = NULL,
    upper = NULL,
    effects = NULL,
    label = NULL,
    group = NULL,
    columns = NULL,
    scale = NULL,
    null_value = NULL,
    axis_label = NULL,
    theme = NULL,
    ...,
    split_by = NULL,
    shared_axis = FALSE,
    width = NULL,
    height = NULL,
    elementId = NULL) {

  # Handle SplitForest objects directly
  if (S7_inherits(x, SplitForest)) {
    return(forest_plot_split(x, width = width, height = height, elementId = elementId))
  }

  # Handle WebSpec objects - render directly
 if (S7_inherits(x, WebSpec)) {
    # If split_by specified, create split forest
    if (!is.null(split_by)) {
      split_result <- split_table(x, by = split_by, shared_axis = shared_axis)
      return(forest_plot_split(split_result, width = width, height = height, elementId = elementId))
    }

    return(render_tabviz_widget(
      x,
      width = width,
      height = height,
      elementId = elementId,
      ...
    ))
  }

  # Must be a data.frame at this point
  if (!is.data.frame(x)) {
    cli_abort("{.arg x} must be a WebSpec object, SplitForest object, or a data frame")
  }

  # Build columns list - auto-add col_forest() from point/lower/upper or effects
  user_columns <- columns %||% list()

  has_inline <- !is.null(point) && !is.null(lower) && !is.null(upper)
  has_effects <- !is.null(effects) && length(effects) > 0

  if (has_effects) {
    # Multi-effect mode
    forest_col <- col_forest(
      effects = effects,
      scale = scale %||% "linear",
      null_value = null_value,
      axis_label = axis_label %||% "Effect"
    )
    user_columns <- c(user_columns, list(forest_col))
  } else if (has_inline) {
    # Single effect mode
    forest_col <- col_forest(
      point = point,
      lower = lower,
      upper = upper,
      scale = scale %||% "linear",
      null_value = null_value,
      axis_label = axis_label %||% "Effect"
    )
    user_columns <- c(user_columns, list(forest_col))
  }

  # Build tabviz args
  tabviz_args <- list(
    data = x,
    label = label,
    group = group,
    columns = if (length(user_columns) > 0) user_columns else NULL,
    theme = theme,
    width = width,
    height = height,
    elementId = elementId,
    .spec_only = !is.null(split_by)  # Only get spec if we need to split
  )

  # Add extra args from ...
  extra_args <- list(...)
  tabviz_args <- c(tabviz_args, extra_args)

  # Remove NULLs
  tabviz_args <- tabviz_args[!vapply(tabviz_args, is.null, logical(1))]

  result <- do.call(tabviz, tabviz_args)

  # If split_by specified, create and render split forest
  if (!is.null(split_by)) {
    split_result <- split_table(result, by = split_by, shared_axis = shared_axis)
    return(forest_plot_split(split_result, width = width, height = height, elementId = elementId))
  }

  result
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

  payload <- serialize_split_table(x, include_forest = TRUE)

  # Create widget
  widget <- htmlwidgets::createWidget(
    name = "tabviz_split",
    x = payload,
    width = width,
    height = height,
    package = "tabviz",
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
