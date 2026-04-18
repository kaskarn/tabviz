# Shiny bindings for tabviz.
#
# Public surface:
#   - tabvizOutput() / renderTabviz() — htmlwidget output/render bindings.
#   - tabviz_proxy() — build a proxy to update a running widget from server code.
#   - splitTabvizOutput() / renderSplitTabviz() / split_tabviz_proxy() — the
#     equivalent bindings for split-table plots.
#   - split_tabviz_select() — select a split-table plot by key.
#
# High-level verbs that operate on a proxy live in R/modifiers.R
# (sort_rows, filter_rows, add_column, set_theme, etc.).

#' Shiny output function for a tabviz plot
#'
#' @param outputId Output variable name
#' @param width Widget width (CSS units)
#' @param height Widget height (CSS units)
#'
#' @return A Shiny output element
#' @export
tabvizOutput <- function(outputId, width = "100%", height = "400px") {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    "tabviz",
    width,
    height,
    package = "tabviz"
  )
}

#' Shiny render function for a tabviz plot
#'
#' @param expr An expression that returns a widget from `tabviz()`
#' @param env The environment in which to evaluate expr
#' @param quoted Is expr a quoted expression?
#'
#' @return A Shiny render function
#' @export
renderTabviz <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) {
    expr <- substitute(expr)
  }
  htmlwidgets::shinyRenderWidget(expr, tabvizOutput, env, quoted = TRUE)
}

#' Create a tabviz proxy object
#'
#' Builds a proxy that can be used to update a tabviz plot in a Shiny app
#' without re-rendering the entire widget. Pass the proxy to any fluent
#' verb (`sort_rows()`, `filter_rows()`, `add_column()`, `set_theme()`, ...)
#' to dispatch an update message to the running widget.
#'
#' @param id The widget (output) id
#' @param session The Shiny session (default: current reactive domain)
#'
#' @return A `tabviz_proxy` object
#' @export
tabviz_proxy <- function(id, session = shiny::getDefaultReactiveDomain()) {
  if (is.null(session)) {
    cli_abort("{.fn tabviz_proxy} must be called from within a Shiny reactive context")
  }
  structure(
    list(id = id, session = session),
    class = "tabviz_proxy"
  )
}

#' Internal: invoke a proxy method
#'
#' Sends a `tabviz-proxy` custom message to the running widget with
#' `list(id, method, args)`.
#'
#' @keywords internal
invoke_proxy_method <- function(proxy, method, args) {
  if (!inherits(proxy, "tabviz_proxy")) {
    cli_abort("proxy must be a tabviz_proxy object created with {.fn tabviz_proxy}")
  }
  msg <- list(id = proxy$id, method = method, args = args)
  proxy$session$sendCustomMessage("tabviz-proxy", msg)
  invisible(proxy)
}

# ============================================================================
# Split-table bindings
# ============================================================================

#' Shiny output function for a split-table tabviz plot
#'
#' @param outputId Output variable name
#' @param width Widget width (CSS units)
#' @param height Widget height (CSS units)
#'
#' @return A Shiny output element
#' @export
splitTabvizOutput <- function(outputId, width = "100%", height = "600px") {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    "tabviz_split",
    width,
    height,
    package = "tabviz"
  )
}

#' Shiny render function for a split-table tabviz plot
#'
#' @param expr An expression that returns a split-table widget
#' @param env The environment in which to evaluate expr
#' @param quoted Is expr a quoted expression?
#'
#' @return A Shiny render function
#' @export
renderSplitTabviz <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) {
    expr <- substitute(expr)
  }
  htmlwidgets::shinyRenderWidget(expr, splitTabvizOutput, env, quoted = TRUE)
}

#' Create a split-table tabviz proxy object
#'
#' @param id The widget (output) id
#' @param session The Shiny session (default: current reactive domain)
#'
#' @return A `split_tabviz_proxy` object
#' @export
split_tabviz_proxy <- function(id, session = shiny::getDefaultReactiveDomain()) {
  if (is.null(session)) {
    cli_abort("{.fn split_tabviz_proxy} must be called from within a Shiny reactive context")
  }
  structure(
    list(id = id, session = session),
    class = "split_tabviz_proxy"
  )
}

#' Select a plot in a split-table tabviz via proxy
#'
#' @param proxy A `split_tabviz_proxy` object
#' @param key The key of the plot to select (e.g. "Male" or "Male__Young")
#'
#' @return The proxy object (invisibly), for chaining
#' @export
split_tabviz_select <- function(proxy, key) {
  if (!inherits(proxy, "split_tabviz_proxy")) {
    cli_abort("proxy must be a split_tabviz_proxy object created with {.fn split_tabviz_proxy}")
  }
  msg <- list(id = proxy$id, method = "selectPlot", args = list(key = key))
  proxy$session$sendCustomMessage("tabviz-split-proxy", msg)
  invisible(proxy)
}
