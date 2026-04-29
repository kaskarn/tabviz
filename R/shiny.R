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
# Outbound state — observability helpers
# ============================================================================
#
# Every Tier 1 + Tier 2 dimension the widget tracks is emitted as an envelope:
#   input$<id>_<dimension> = list(value = ..., source = "user"|"proxy", ts = ms)
# `tabviz_state()` and `tabviz_state_envelope()` are convenience readers that
# pull all dimensions into a single named list — the former unwraps to .value,
# the latter preserves the envelope so observers can filter on `source`.
#
# Tier 1 ships always. Tier 2 (axis_zooms / banding / plot_width) is only
# meaningful for forest-plot widgets but is harmless to read for table-only
# uses (the inputs simply never fire).

# Names of every Shiny input the widget emits. Kept here as the single source
# of truth so `tabviz_state()` and the vignette stay in sync if dimensions are
# added later.
TABVIZ_STATE_FIELDS <- c(
  # Tier 1
  "sort", "filters", "row_styles", "cell_styles", "paint_tool",
  "selected", "hover", "collapsed_groups", "hidden_columns",
  "column_order", "column_widths", "cell_edits", "label_edits", "zoom",
  # Tier 2
  "axis_zooms", "banding", "plot_width",
  # Derived
  "visible_rows"
)

#' Read the full observability state of a tabviz widget
#'
#' Pulls every per-dimension Shiny input the widget emits into a single named
#' list. The envelope (`source`, `ts`) is stripped — the returned list is the
#' raw values, suitable for direct use in dashboard logic. Use
#' [tabviz_state_envelope()] when you need to filter on the provenance tag.
#'
#' Two-way Shiny integration:
#' * **Widget → Shiny**: clicking a column header emits `input$<id>_sort`.
#' * **Shiny → Widget**: dashboards push state via [tabviz_proxy()] and the
#'   fluent verbs ([sort_rows()], [filter_rows()], ...).
#'
#' Dashboards that mirror widget state will typically also want to filter
#' out their own writes. That's what [tabviz_state_envelope()] is for —
#' check `state$<dim>$source == "user"` to react only to user-driven changes.
#'
#' @param input The Shiny `input` object
#' @param id The widget's output id (the same one passed to `tabvizOutput()`)
#' @return A named list with one entry per dimension. Missing inputs (the
#'   widget hasn't emitted yet) come through as `NULL`.
#' @seealso [tabviz_state_envelope()], [tabviz_proxy()]
#' @export
tabviz_state <- function(input, id) {
  checkmate::assert_string(id)
  envelopes <- tabviz_state_envelope(input, id)
  lapply(envelopes, function(e) if (is.null(e)) NULL else e$value)
}

#' Read the full observability state, envelope intact
#'
#' Like [tabviz_state()] but preserves each dimension's envelope, so callers
#' see `source` ("user" / "proxy") and `ts` alongside the value. Useful when
#' a `reactive()` should ignore proxy-originated mutations to avoid feedback
#' loops:
#'
#' ```r
#' observe({
#'   sort <- input[[paste0("tbl_sort")]]
#'   req(sort, sort$source == "user")
#'   # ... react only to user-driven sort changes
#' })
#' ```
#'
#' @inheritParams tabviz_state
#' @return A named list of envelopes, each with `value`, `source`, `ts`.
#' @export
tabviz_state_envelope <- function(input, id) {
  checkmate::assert_string(id)
  out <- lapply(TABVIZ_STATE_FIELDS, function(field) {
    key <- paste0(id, "_", field)
    input[[key]]
  })
  names(out) <- TABVIZ_STATE_FIELDS
  out
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
