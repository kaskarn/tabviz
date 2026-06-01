#' Render the box-model debug view ("debug-shapes")
#'
#' The *visual* half of the sizing-verification harness (the numeric half is
#' the TS `computeLayoutMetrics` snapshot gate). Renders a spec's box model as
#' an SVG of labeled boxes instead of real cell content: every cell shows its
#' allocated box, horizontal padding regions (pink), the text-anchor inset
#' (red dot), the row marker-center (blue dash), and the row kind (fill color).
#'
#' Strips content so sizing errors become eyeball-obvious. Because it is a pure
#' function of the same `computeLayoutMetrics` the numeric gate snapshots, the
#' visual and numeric views agree by construction. Use it to sanity-check
#' geometry while working on the sizing / row-kind subsystems.
#'
#' @param spec A `WebSpec` (e.g. from [forest_plot()] or [tabviz()]).
#' @param file Optional output path. If it ends in `.png` and the `rsvg`
#'   package is available, a PNG is written; otherwise an `.svg` is written.
#'   When `NULL`, the raw SVG string is returned invisibly.
#' @param width PNG raster width in px (only when writing a PNG). `NULL` uses
#'   the SVG's natural width.
#'
#' @return The SVG string (invisibly when `file` is written).
#' @seealso `docs/dev/sizing-model.md` (§6b) for the harness design.
#' @export
render_debug_shapes <- function(spec, file = NULL, width = NULL) {
  if (!S7_inherits(spec, WebSpec)) {
    cli_abort("{.arg spec} must be a {.cls WebSpec}.")
  }
  if (!requireNamespace("V8", quietly = TRUE)) {
    cli_abort(c(
      "Package {.pkg V8} is required for {.fn render_debug_shapes}",
      "i" = "Install it with: {.code install.packages(\"V8\")}"
    ))
  }

  js_file <- .debug_shapes_js_file()
  spec_json <- jsonlite::toJSON(
    serialize_spec(spec),
    auto_unbox = TRUE, null = "null", na = "null"
  )

  ctx <- V8::v8()
  ctx$source(js_file)
  svg <- ctx$call("renderDebugShapes", spec_json)

  if (is.null(file)) {
    return(invisible(svg))
  }

  if (grepl("\\.png$", file, ignore.case = TRUE)) {
    if (!requireNamespace("rsvg", quietly = TRUE)) {
      cli_abort(c(
        "Package {.pkg rsvg} is required to write a PNG",
        "i" = "Write an {.file .svg} instead, or install rsvg."
      ))
    }
    rsvg::rsvg_png(charToRaw(svg), file, width = width)
  } else {
    writeLines(svg, file)
  }
  cli::cli_alert_success("Wrote {.path {file}}")
  invisible(svg)
}

#' Locate the built V8 bundle, dev-tree fallback included.
#' @noRd
.debug_shapes_js_file <- function() {
  js_file <- system.file("js/svg-generator.js", package = "tabviz")
  if (js_file == "" || !file.exists(js_file)) {
    js_file <- file.path(
      system.file(package = "tabviz"), "..", "..", "inst", "js", "svg-generator.js"
    )
    if (!file.exists(js_file)) {
      cli_abort(c(
        "SVG generator JavaScript file not found",
        "i" = "Run {.code npm run build} in the {.file srcjs} directory"
      ))
    }
  }
  js_file
}
