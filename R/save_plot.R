# Static image export for forest plots using V8 JavaScript engine

#' Save a forest plot as a static image
#'
#' Exports a forest plot to a static file format (SVG, PDF, or PNG).
#' Uses a shared JavaScript SVG generator via the V8 package for consistent
#' output between R and web exports.
#'
#' @param x A WebSpec object or forest_plot() htmlwidget output
#' @param file Output file path. Extension determines format:
#'   - `.svg` - Scalable Vector Graphics
#'   - `.pdf` - PDF document (requires rsvg package)
#'   - `.png` - PNG image (requires rsvg package)
#' @param width Plot width in pixels (default: 800)
#' @param height Plot height in pixels. If NULL (default), auto-calculated
#'   based on content
#' @param scale Scaling factor for PNG output (default: 2 for retina quality)
#' @param ... Additional arguments (currently unused)
#'
#' @return Invisibly returns the file path
#'
#' @examples
#' \dontrun{
#' # Create a forest plot spec
#' spec <- web_spec(
#'   data.frame(
#'     study = c("Study A", "Study B", "Study C"),
#'     estimate = c(1.2, 0.8, 1.5),
#'     lower = c(0.9, 0.5, 1.1),
#'     upper = c(1.6, 1.2, 2.0)
#'   ),
#'   point = "estimate",
#'   lower = "lower",
#'   upper = "upper",
#'   label = "study"
#' )
#'
#' # Save as SVG
#' save_plot(spec, "forest.svg")
#'
#' # Save as PNG with custom dimensions
#' save_plot(spec, "forest.png", width = 1200)
#'
#' # Save from htmlwidget output
#' p <- forest_plot(spec)
#' save_plot(p, "forest.svg")
#' }
#'
#' @export
save_plot <- function(x, file, width = 800, height = NULL, scale = 2, ...) {
  # Validate inputs
  if (missing(file) || is.null(file)) {
    cli::cli_abort("{.arg file} is required")
  }

  # Check for V8 package
  if (!requireNamespace("V8", quietly = TRUE)) {
    cli::cli_abort(c(
      "Package {.pkg V8} is required for {.fn save_plot}",
      "i" = "Install it with: {.code install.packages(\"V8\")}"
    ))
  }

  # Extract WebSpec from input
  spec <- extract_webspec(x)

  # Validate spec
  if (is.null(spec)) {
    cli::cli_abort(c(
      "{.arg x} must be a WebSpec object or forest_plot() output",
      "i" = "Create a spec with {.fn web_spec} or plot with {.fn forest_plot}"
    ))
  }

  # Determine format from extension
  ext <- tolower(tools::file_ext(file))

  if (!ext %in% c("svg", "pdf", "png")) {
    cli::cli_abort(c(
      "Unsupported file format: {.file .{ext}}",
      "i" = "Supported formats: .svg, .pdf, .png"
    ))
  }

  # Serialize spec to JSON
  spec_json <- jsonlite::toJSON(
    serialize_spec(spec),
    auto_unbox = TRUE,
    null = "null",
    na = "null"
  )

  # Build options
  options_list <- list()
  if (!is.null(width)) options_list$width <- width
  if (!is.null(height)) options_list$height <- height

  # Generate SVG using V8
  svg_string <- generate_svg_v8(spec_json, options_list)

  # Output based on format
  if (ext == "svg") {
    # Write SVG directly
    writeLines(svg_string, file)
  } else if (ext %in% c("pdf", "png")) {
    # Convert SVG to raster/PDF using rsvg
    if (!requireNamespace("rsvg", quietly = TRUE)) {
      cli::cli_abort(c(
        "Package {.pkg rsvg} is required for {.file .{ext}} output",
        "i" = "Install it with: {.code install.packages(\"rsvg\")}"
      ))
    }

    # Write temporary SVG
    temp_svg <- tempfile(fileext = ".svg")
    on.exit(unlink(temp_svg), add = TRUE)
    writeLines(svg_string, temp_svg)

    if (ext == "pdf") {
      rsvg::rsvg_pdf(temp_svg, file)
    } else {
      # PNG with scaling - let rsvg auto-detect height from SVG if not specified
      if (is.null(height)) {
        rsvg::rsvg_png(temp_svg, file, width = width * scale)
      } else {
        rsvg::rsvg_png(temp_svg, file, width = width * scale, height = height * scale)
      }
    }
  }

  cli::cli_alert_success("Saved plot to {.file {file}}")

  invisible(file)
}

#' Generate SVG using V8 JavaScript engine
#'
#' @param spec_json JSON string of WebSpec
#' @param options List of export options (width, height)
#' @return SVG string
#' @noRd
generate_svg_v8 <- function(spec_json, options = list()) {
  # Get path to bundled JS
  js_file <- system.file("js/svg-generator.js", package = "webforest")

  if (js_file == "" || !file.exists(js_file)) {
    # Fallback for development
    js_file <- file.path(
      system.file(package = "webforest"),
      "..", "..", "inst", "js", "svg-generator.js"
    )
    if (!file.exists(js_file)) {
      cli::cli_abort(c(
        "SVG generator JavaScript file not found",
        "i" = "Run {.code npm run build} in the {.file srcjs} directory"
      ))
    }
  }

  # Create V8 context
  ctx <- V8::v8()

  # Load the SVG generator
  ctx$source(js_file)

  # Convert options to JSON
  options_json <- jsonlite::toJSON(options, auto_unbox = TRUE)

  # Call generateSVG
  svg_string <- ctx$call("generateSVG", spec_json, V8::JS(options_json))

  svg_string
}

#' Extract WebSpec from various input types
#'
#' @param x Input object (WebSpec, htmlwidget, or list)
#' @return WebSpec object or NULL
#' @noRd
extract_webspec <- function(x) {
  # Direct WebSpec (check S7 class)
  if (S7::S7_inherits(x, WebSpec)) {
    return(x)
  }

  # htmlwidget from forest_plot()
  if (inherits(x, "htmlwidget")) {
    # Check for attached spec
    spec <- attr(x, "webspec")
    if (!is.null(spec) && S7::S7_inherits(spec, WebSpec)) {
      return(spec)
    }

    # Try to extract from widget data
    # The x$x contains the serialized payload
    if (!is.null(x$x)) {
      cli::cli_warn(c(
        "Cannot extract WebSpec from htmlwidget",
        "i" = "Pass the WebSpec object directly to {.fn save_plot}"
      ))
    }
    return(NULL)
  }

  NULL
}
