# Fluent API for modifying WebSpec objects
# These functions allow piping modifications after creating a spec

#' Set row-level styling on a WebSpec
#'
#' Provides a fluent API for setting row-level styling based on column values.
#' Style values are read from the specified columns at render time.
#'
#' @param x A WebSpec object or an htmlwidget created by forest_plot/webtable
#' @param bold Column name containing logical values for row-level bold
#' @param italic Column name containing logical values for row-level italic
#' @param color Column name containing CSS color strings for row text color
#' @param bg Column name containing CSS color strings for row background color
#' @param badge Column name containing text for badges on the label column
#' @param icon Column name containing emoji/unicode for icons on the label column
#' @param indent Column name containing numeric values for row indentation
#' @param type Column name containing row type ("data", "header", "summary", "spacer")
#'
#' @return The modified WebSpec object (or widget)
#'
#' @examples
#' \dontrun{
#' forest_data |>
#'   web_spec(hr, lower, upper) |>
#'   set_row_style(bold = "is_primary", badge = "significance") |>
#'   forest_plot()
#' }
#'
#' @export
set_row_style <- function(
    x,
    bold = NULL,
    italic = NULL,
    color = NULL,
    bg = NULL,
    badge = NULL,
    icon = NULL,
    indent = NULL,
    type = NULL) {
  # Extract WebSpec from widget if needed
  spec <- if (inherits(x, "htmlwidget")) {
    attr(x, "webspec")
  } else if (S7_inherits(x, WebSpec)) {
    x
  } else {
    cli_abort("x must be a WebSpec or htmlwidget")
  }

  # Update spec properties
  if (!is.null(bold)) spec@row_bold_col <- bold
  if (!is.null(italic)) spec@row_italic_col <- italic
  if (!is.null(color)) spec@row_color_col <- color
  if (!is.null(bg)) spec@row_bg_col <- bg
  if (!is.null(badge)) spec@row_badge_col <- badge
  if (!is.null(icon)) spec@row_icon_col <- icon
  if (!is.null(indent)) spec@row_indent_col <- indent
  if (!is.null(type)) spec@row_type_col <- type

  # Return same type as input
  if (inherits(x, "htmlwidget")) {
    # Re-create widget with updated spec
    if (inherits(x, "forest_plot")) {
      forest_plot(spec)
    } else {
      webtable(spec)
    }
  } else {
    spec
  }
}

#' Set column-level styling on a WebSpec
#'
#' Provides a fluent API for setting per-cell styling on specific columns.
#' The styling is based on values from other columns in the data.
#'
#' @param x A WebSpec object or an htmlwidget created by forest_plot/webtable
#' @param column The field name of the column to style
#' @param bold Column name containing logical values for cell-level bold
#' @param italic Column name containing logical values for cell-level italic
#' @param color Column name containing CSS color strings for cell text color
#' @param bg Column name containing CSS color strings for cell background color
#' @param badge Column name containing text for per-cell badges
#' @param icon Column name containing emoji/unicode for per-cell icons
#'
#' @return The modified WebSpec object (or widget)
#'
#' @examples
#' \dontrun{
#' forest_data |>
#'   web_spec(hr, lower, upper) |>
#'   set_column_style("study", badge = "significance", bold = "is_primary") |>
#'   forest_plot()
#' }
#'
#' @export
set_column_style <- function(
    x,
    column,
    bold = NULL,
    italic = NULL,
    color = NULL,
    bg = NULL,
    badge = NULL,
    icon = NULL) {
  # Extract WebSpec from widget if needed
  spec <- if (inherits(x, "htmlwidget")) {
    attr(x, "webspec")
  } else if (S7_inherits(x, WebSpec)) {
    x
  } else {
    cli_abort("x must be a WebSpec or htmlwidget")
  }

  # Find and update the column
  found <- FALSE
  for (i in seq_along(spec@columns)) {
    col <- spec@columns[[i]]

    # Handle ColumnGroup - search within
    if (S7_inherits(col, ColumnGroup)) {
      for (j in seq_along(col@columns)) {
        if (col@columns[[j]]@field == column) {
          if (!is.null(bold)) col@columns[[j]]@style_bold <- bold
          if (!is.null(italic)) col@columns[[j]]@style_italic <- italic
          if (!is.null(color)) col@columns[[j]]@style_color <- color
          if (!is.null(bg)) col@columns[[j]]@style_bg <- bg
          if (!is.null(badge)) col@columns[[j]]@style_badge <- badge
          if (!is.null(icon)) col@columns[[j]]@style_icon <- icon
          spec@columns[[i]] <- col
          found <- TRUE
          break
        }
      }
    } else if (S7_inherits(col, ColumnSpec) && col@field == column) {
      if (!is.null(bold)) col@style_bold <- bold
      if (!is.null(italic)) col@style_italic <- italic
      if (!is.null(color)) col@style_color <- color
      if (!is.null(bg)) col@style_bg <- bg
      if (!is.null(badge)) col@style_badge <- badge
      if (!is.null(icon)) col@style_icon <- icon
      spec@columns[[i]] <- col
      found <- TRUE
    }

    if (found) break
  }

  if (!found) {
    cli_warn("Column '{column}' not found in spec columns")
  }

  # Return same type as input
  if (inherits(x, "htmlwidget")) {
    if (inherits(x, "forest_plot")) {
      forest_plot(spec)
    } else {
      webtable(spec)
    }
  } else {
    spec
  }
}
