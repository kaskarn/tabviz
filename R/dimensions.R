# Public natural-dimensions API.
#
# `tabviz_natural_dimensions(spec)` returns the spec's natural width / height /
# aspect ratio without rendering an SVG. The V8 bundle exposes a
# `computeNaturalDimensions` global that runs the same `computeLayout()` the
# renderer uses but skips SVG emission.
#
# Useful for:
#   - Quarto / RMarkdown chunk sizing (`fig.height = fig.width / dims$aspect`)
#   - Aspect-changing layout math (Mode 3 on `save_plot()`)
#   - Test assertions that pin the natural shape of a fixture spec

#' Natural dimensions of a tabviz spec
#'
#' Compute the spec's natural width, height, and aspect ratio without
#' rendering an SVG. The natural width is the sum of column widths plus the
#' theme's chrome (padding, dividers); the natural height is row count times
#' the theme's row height plus header / axis / footer chrome. The aspect
#' ratio is `width / height`.
#'
#' This is the dimension `save_plot()` would render at when called with no
#' `width`, `height`, or `ratio` arguments. Authors who want to size a
#' figure chunk to match a tabviz can pre-compute the natural aspect and
#' set `fig.height` accordingly.
#'
#' @param x A `WebSpec` object (e.g. from `tabviz(..., .spec_only = TRUE)`)
#'   or an htmlwidget produced by `tabviz()` / `forest_plot()`.
#'
#' @return A named list with three numeric scalars: `width`, `height`,
#'   `aspect` (= `width / height`). All in logical pixels.
#'
#' @examples
#' \dontrun{
#' spec <- tabviz(meta_data, label = "study",
#'                columns = list(viz_forest("hr", "lower", "upper")),
#'                .spec_only = TRUE)
#' dims <- tabviz_natural_dimensions(spec)
#' dims$width    # e.g. 800
#' dims$aspect   # e.g. 1.04
#'
#' # Sizing a Quarto chunk:
#' #| fig-width: 8
#' #| fig-height: !expr 8 / dims$aspect
#' }
#'
#' @export
tabviz_natural_dimensions <- function(x) {
  spec <- extract_webspec(x)
  if (is.null(spec)) {
    cli::cli_abort(
      "{.arg x} must be a {.cls WebSpec} or an htmlwidget produced by tabviz()."
    )
  }

  if (!requireNamespace("V8", quietly = TRUE)) {
    cli::cli_abort(c(
      "Package {.pkg V8} is required for {.fn tabviz_natural_dimensions}",
      "i" = "Install it with: {.code install.packages(\"V8\")}"
    ))
  }

  spec_json <- jsonlite::toJSON(
    serialize_spec(spec),
    auto_unbox = TRUE,
    null = "null",
    na = "null"
  )

  ctx <- V8::v8()
  ctx$source(svg_generator_js_path())
  result_json <- ctx$call("computeNaturalDimensions", spec_json)
  result <- jsonlite::fromJSON(result_json)

  list(
    width  = as.numeric(result$width),
    height = as.numeric(result$height),
    aspect = as.numeric(result$aspect)
  )
}

# Locate the bundled svg-generator.js. Mirrors the logic in
# `generate_svg_v8()` (R/save_plot.R) — keep these in sync.
#' @noRd
svg_generator_js_path <- function() {
  js_file <- system.file("js/svg-generator.js", package = "tabviz")
  if (js_file == "" || !file.exists(js_file)) {
    js_file <- file.path(
      system.file(package = "tabviz"),
      "..", "..", "inst", "js", "svg-generator.js"
    )
    if (!file.exists(js_file)) {
      cli::cli_abort(c(
        "SVG generator JavaScript file not found",
        "i" = "Run {.code npm run build} in the {.file srcjs} directory"
      ))
    }
  }
  js_file
}
