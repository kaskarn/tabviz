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
#' `args` is a named list matching the builder's argument object. Returns
#' the parsed result as a base-R list (`jsonlite::fromJSON` semantics —
#' lists for objects, vectors for primitive arrays).
#'
#' R-side `col_*` helpers that simply pack args into a wire-shape list
#' delegate through this function so R and TS produce byte-identical
#' output by construction (no parallel implementations to drift).
#'
#' @param name Builder name (TS symbol).
#' @param args Named list of arguments.
#' @return A base-R list matching the TS builder's return type.
#' @noRd
ts_call <- function(name, args) {
  ctx <- tabviz_v8()
  args_json <- jsonlite::toJSON(args, auto_unbox = TRUE, null = "null", na = "null")
  result_json <- ctx$call("callBuilder", name, args_json)
  jsonlite::fromJSON(result_json, simplifyVector = FALSE)
}
