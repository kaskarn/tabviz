# R → TS delegation bridge over V8.
#
# Now that V8 is a hard Import, thin-wrapper col_* / viz_* / theme_*
# helpers can delegate construction to the bundled TS authoring builders
# instead of hand-rolling the same wire-shape object in R. Eliminates
# drift and shrinks the R-side surface.
#
# The V8 context is a singleton, lazy-initialized on first call. The
# bundled JS lives at `inst/js/svg-generator.js` (built from
# `srcjs/src/export/v8-entry.ts`, which exposes `callBuilder(name, args)`
# as a global). One bundle covers SVG export + authoring delegation.

# Internal: cached V8 context. Initialized on first `tabviz_v8()` call.
.tabviz_v8_ctx <- new.env(parent = emptyenv())

# Internal: locate the bundled v8 JS.
tabviz_v8_js_path <- function() {
  js_file <- system.file("js/svg-generator.js", package = "tabviz")
  if (js_file == "" || !file.exists(js_file)) {
    # devtools::load_all() path — bypass system.file's installed lookup.
    js_file <- file.path(
      system.file(package = "tabviz"), "..", "..", "inst", "js", "svg-generator.js"
    )
  }
  if (!file.exists(js_file)) {
    cli::cli_abort(c(
      "tabviz V8 bundle not found at {.path {js_file}}.",
      "i" = "Rebuild with {.code cd srcjs && npm run build:v8}."
    ))
  }
  js_file
}

# Singleton accessor — lazy V8 init, sources the bundle once.
tabviz_v8 <- function() {
  if (is.null(.tabviz_v8_ctx$ctx)) {
    .tabviz_v8_ctx$ctx <- V8::v8()
    .tabviz_v8_ctx$ctx$source(tabviz_v8_js_path())
  }
  .tabviz_v8_ctx$ctx
}

#' Call a TS authoring builder via V8 and return its wire-shape result.
#'
#' `name` is the exported builder symbol (e.g. `"colText"`, `"vizForest"`);
#' `args` is a named list matching the builder's argument object.
#' `options` is an optional second argument for builders that take a
#' `(draft, options)` signature (e.g. `resolveTheme(draft, { validate })`);
#' when `NULL` the builder is called single-argument. Returns the parsed
#' result as a base-R list (`jsonlite::fromJSON` semantics — lists for
#' objects, vectors for primitive arrays).
#'
#' R-side `col_*` helpers that simply pack args into a wire-shape list
#' delegate through this function so R and TS produce byte-identical
#' output by construction (no parallel implementations to drift).
#'
#' @param name Builder name (TS symbol).
#' @param args Named list of arguments.
#' @param options Optional second args list for two-arg builders.
#' @return A base-R list matching the TS builder's return type.
#' @noRd
ts_call <- function(name, args, options = NULL) {
  ctx <- tabviz_v8()
  args_json <- jsonlite::toJSON(args, auto_unbox = TRUE, null = "null", na = "null")
  result_json <- if (is.null(options)) {
    ctx$call("callBuilder", name, args_json)
  } else {
    options_json <- jsonlite::toJSON(options, auto_unbox = TRUE, null = "null", na = "null")
    ctx$call("callBuilder", name, args_json, options_json)
  }
  # Simplify primitive arrays back to vectors so options fields like
  # `thresholds`, `palette`, `seriesAnchors` round-trip as `c(0.33, 0.66)`
  # not `list(0.33, 0.66)`. Keep nested objects as lists
  # (simplifyDataFrame = FALSE) so cluster shapes don't collapse into
  # data frames.
  jsonlite::fromJSON(
    result_json,
    simplifyVector = TRUE,
    simplifyDataFrame = FALSE,
    simplifyMatrix = FALSE
  )
}

#' Build the V8 options bag for a theme resolve (buildTheme / resolveFromInputs).
#'
#' Single source for the `{ name, roleOverrides?, pins?, components? }`
#' omit-when-empty shape passed as the builders' second arg — was duplicated
#' verbatim across resolve_from_inputs / theme_css_vars / serialize_theme.
#' @noRd
.theme_v8_opts <- function(name, role_overrides = list(), pins = list(),
                           components = list()) {
  opts <- list(name = name)
  if (length(role_overrides) > 0L) opts$roleOverrides <- role_overrides
  if (length(pins) > 0L) opts$pins <- pins
  if (length(components) > 0L) opts$components <- components
  opts
}

#' Delegate a `col_*` helper to its TS mirror, then wrap in S7 via web_col.
#'
#' Shared boilerplate for R column helpers that delegate construction to
#' TS via `ts_call(builder_name, ts_args)`. Computes the wire shape JS-side,
#' then wraps in an R-side `ColumnSpec` via `web_col(...)` so R-only
#' concerns (style mappings, formatter slot, S7 validators) keep working.
#'
#' Caller-supplied `extra_args` (the `...` from the wrapping `col_*()`)
#' shadow the TS-computed defaults — e.g. when `tabviz()` internally
#' pins `id = "label"` on the row-label column, the explicit id overrides
#' the TS-computed default.
#'
#' @param builder_name TS builder symbol (e.g. `"colText"`).
#' @param ts_args Named list passed to `ts_call`.
#' @param type Column type string for `web_col()`'s explicit `type=` arg.
#'   The TS shape's `type` field is authoritative; this arg lets the caller
#'   pin a type when the TS shape might compute differently (rare).
#' @param na_text NA replacement text; threaded through to `web_col`.
#' @param extra_args The caller's `...` as a list.
#' @return A `ColumnSpec` S7 object.
#' @noRd
delegate_to_web_col <- function(builder_name, ts_args, type = NULL, na_text = NULL, extra_args = list()) {
  shape <- ts_call(builder_name, ts_args)
  args <- list(
    field   = shape$field,
    header  = shape$header,
    type    = type %||% shape$type,
    id      = shape$id,
    width   = if (identical(shape$width, "auto")) NULL else shape$width,
    options = shape$options %||% list(),
    na_text = na_text
  )
  # Forward fields the TS shape sets that web_col would otherwise default
  # differently. Keeps type-specific defaults (e.g. forest's
  # `sortable = false`, viz_*'s `flex = true`, header-align overrides)
  # owned by the TS builder rather than re-encoded R-side per builder.
  if (!is.null(shape$align))       args$align        <- shape$align
  if (!is.null(shape$headerAlign)) args$header_align <- shape$headerAlign
  if (!is.null(shape$showHeader))  args$show_header  <- shape$showHeader
  # `wrap` is boolean OR a numeric line-count — preserve numerics (as.logical(3)
  # would truncate a 3-line cap to TRUE). Latent today (no builder bakes a
  # numeric wrap default); guarded so a future one can't silently lose it.
  if (!is.null(shape$wrap))
    args$wrap <- if (is.numeric(shape$wrap)) shape$wrap else as.logical(shape$wrap)
  if (!is.null(shape$sortable))    args$sortable     <- shape$sortable
  if (!is.null(shape$flex))        args$flex         <- shape$flex
  args[names(extra_args)] <- extra_args
  do.call(web_col, args)
}

# Local null-coalesce. Identical to rlang's %||% but inlined here so the
# v8-bridge has zero dependencies beyond V8 + jsonlite.
`%||%` <- function(x, y) if (is.null(x)) y else x
