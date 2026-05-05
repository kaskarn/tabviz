# Static image export for forest plots using V8 JavaScript engine

#' Save a forest plot as a static image
#'
#' Exports a forest plot to a static file format (SVG, PDF, or PNG).
#' Uses a shared JavaScript SVG generator via the V8 package for consistent
#' output between R and web exports.
#'
#' For SplitForest objects, this function dispatches to `save_split_table()`
#' to export all sub-plots to a directory structure. To save just one
#' subview to a single file, pass `which = "<key>"` or an integer index.
#'
#' @param x A WebSpec object, forest_plot() htmlwidget output, or SplitForest
#' @param file Output file path (or directory for SplitForest). Extension determines format:
#'   - `.svg` - Scalable Vector Graphics
#'   - `.pdf` - PDF document (requires rsvg package)
#'   - `.png` - PNG image (requires rsvg package)
#' @param width Plot width in pixels (default: 800)
#' @param height Plot height in pixels. If NULL (default), auto-calculated
#'   based on content
#' @param scale Scaling factor for PNG output (default: 2 for retina quality)
#' @param which For SplitForest only. `NULL` (default) dumps every subview
#'   to the directory derived from `file`. A string picks one subview by
#'   key (e.g. `"Male__Young"`); an integer picks the i-th subview by the
#'   order specs were created. With `which` set, `file` is treated as a
#'   single-file path and its extension determines format.
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
#'
#' # Save a SplitForest to a directory
#' split_result <- data |>
#'   tabviz(label = "study", columns = list(
#'     viz_forest(point = "estimate", lower = "lower", upper = "upper")
#'   )) |>
#'   split_table(by = c("sex", "age_group"))
#'
#' save_plot(split_result, "output/plots")
#' # Creates: output/plots/Male/Male_Young.svg, etc.
#' }
#'
#' @export
save_plot <- function(x, file, width = 800, height = NULL, scale = 2, which = NULL, ...) {
  # Validate inputs
  if (missing(file) || is.null(file)) {
    cli_abort("{.arg file} is required")
  }

  # Dispatch to save_split_table() if x is a SplitForest
  if (S7_inherits(x, SplitForest)) {
    # `which` selects a single subview, demoting save to the WebSpec branch.
    if (!is.null(which)) {
      keys <- names(x@specs)
      picked_key <- if (is.character(which)) {
        if (!which %in% keys) {
          cli_abort(c(
            "{.arg which} = {.val {which}} is not a subview key.",
            "i" = "Available keys: {.val {keys}}"
          ))
        }
        which
      } else if (is.numeric(which)) {
        idx <- as.integer(which)
        if (idx < 1L || idx > length(keys)) {
          cli_abort("{.arg which} = {idx} is out of range (1..{length(keys)}).")
        }
        keys[[idx]]
      } else {
        cli_abort("{.arg which} must be a string key or integer index.")
      }
      return(save_plot(x@specs[[picked_key]], file = file,
                       width = width, height = height, scale = scale, ...))
    }

    # Determine format and path from file argument
    ext <- tolower(tools::file_ext(file))
    if (ext %in% c("svg", "pdf", "png")) {
      # file has extension - use parent directory and extract format
      path <- dirname(file)
      format <- ext
    } else {
      # file is a directory path - use as-is with default format
      path <- file
      format <- "svg"
    }
    return(save_split_table(x, path = path, format = format,
                             width = width, height = height, scale = scale, ...))
  }

  # Check for V8 package
  if (!requireNamespace("V8", quietly = TRUE)) {
    cli_abort(c(
      "Package {.pkg V8} is required for {.fn save_plot}",
      "i" = "Install it with: {.code install.packages(\"V8\")}"
    ))
  }

  # Extract WebSpec from input
  spec <- extract_webspec(x)

  # Validate spec
  if (is.null(spec)) {
    cli_abort(c(
      "{.arg x} must be a WebSpec object or forest_plot() output",
      "i" = "Create a spec with {.fn web_spec} or plot with {.fn forest_plot}"
    ))
  }

  # Determine format from extension
  ext <- tolower(tools::file_ext(file))

  if (!ext %in% c("svg", "pdf", "png")) {
    cli_abort(c(
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

  # Embed web fonts (Google Fonts URLs from theme@web_fonts) so the export
  # carries its own glyphs. V8 can't fetch fonts; this is the R-side step
  # that closes the gap for SVG, PNG, and PDF exports. Failure degrades
  # gracefully to system font fallback (matches pre-embed behavior).
  web_fonts <- tryCatch(spec@theme@web_fonts, error = function(e) list())
  if (length(web_fonts) > 0L) {
    svg_string <- tryCatch(
      embed_web_fonts(svg_string, web_fonts),
      error = function(e) {
        cli::cli_warn(c(
          "Could not embed web fonts; SVG will use system fallback.",
          "i" = conditionMessage(e)
        ))
        svg_string
      }
    )
  }

  # Ensure output directory exists
  output_dir <- dirname(file)
  if (!dir.exists(output_dir) && output_dir != ".") {
    dir.create(output_dir, recursive = TRUE)
  }

  # Output based on format
  if (ext == "svg") {
    # Write SVG directly
    writeLines(svg_string, file)
  } else if (ext %in% c("pdf", "png")) {
    # Convert SVG to raster/PDF using rsvg
    if (!requireNamespace("rsvg", quietly = TRUE)) {
      cli_abort(c(
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
  js_file <- system.file("js/svg-generator.js", package = "tabviz")

  if (js_file == "" || !file.exists(js_file)) {
    # Fallback for development
    js_file <- file.path(
      system.file(package = "tabviz"),
      "..", "..", "inst", "js", "svg-generator.js"
    )
    if (!file.exists(js_file)) {
      cli_abort(c(
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
  if (S7_inherits(x, WebSpec)) {
    return(x)
  }

  # htmlwidget from forest_plot()
  if (inherits(x, "htmlwidget")) {
    # Check for attached spec
    spec <- attr(x, "webspec")
    if (!is.null(spec) && S7_inherits(spec, WebSpec)) {
      return(spec)
    }

    # Try to extract from widget data
    # The x$x contains the serialized payload
    if (!is.null(x$x)) {
      cli_warn(c(
        "Cannot extract WebSpec from htmlwidget",
        "i" = "Pass the WebSpec object directly to {.fn save_plot}"
      ))
    }
    return(NULL)
  }

  NULL
}

# ============================================================================
# SplitForest export
# ============================================================================

#' Save a split forest plot collection to a directory
#'
#' Exports all plots in a SplitForest to a directory structure that mirrors
#' the split hierarchy. Each sub-plot is saved as a separate file.
#'
#' @param x A SplitForest object or forest_plot() output with split_by
#' @param path Output directory path. Directory will be created if it doesn't exist.
#' @param format Output format: "svg" (default), "pdf", or "png"
#' @param width Plot width in pixels (default: 800)
#' @param height Plot height in pixels. If NULL (default), auto-calculated
#' @param scale Scaling factor for PNG output (default: 2 for retina quality)
#' @param ... Additional arguments (currently unused)
#'
#' @return Invisibly returns a character vector of exported file paths
#'
#' @examples
#' \dontrun{
#' # Create a split forest
#' split_result <- data |>
#'   tabviz(label = "study", columns = list(
#'     viz_forest(point = "or", lower = "lower", upper = "upper")
#'   )) |>
#'   split_table(by = c("sex", "age_group"))
#'
#' # Export to directory
#' save_split_table(split_result, "output/plots")
#'
#' # Creates:
#' # output/plots/Male/Male_Young.svg
#' # output/plots/Male/Male_Old.svg
#' # output/plots/Female/Female_Young.svg
#' # output/plots/Female/Female_Old.svg
#' }
#'
#' @export
save_split_table <- function(x, path, format = c("svg", "pdf", "png"),
                               width = 800, height = NULL, scale = 2, ...) {
  # Match format argument
  format <- match.arg(format)

  # Extract SplitForest from input
  split_table <- extract_splitforest(x)

  if (is.null(split_table)) {
    cli_abort(c(
      "{.arg x} must be a SplitForest object or forest_plot() output with split_by",
      "i" = "Create with {.fn split_table} or use {.code split_by} in {.fn forest_plot}"
    ))
  }

  # Create output directory if needed
  if (!dir.exists(path)) {
    dir.create(path, recursive = TRUE)
  }

  # Track exported files
  exported_files <- character()
  # Track paths already used so different keys that sanitize to the same
  # filename don't silently overwrite each other (e.g. "a/b" and "a-b"
  # both become "a-b.svg"). Collisions get a short hash suffix and warn.
  seen_paths <- character()
  collisions <- character()

 # Export each spec
  for (key in names(split_table@specs)) {
    spec <- split_table@specs[[key]]

    # Build file path from key (hierarchical)
    # e.g., "Male__Young" -> "Male/Male_Young.svg"
    parts <- strsplit(key, "__", fixed = TRUE)[[1]]

    # Sanitize each part for use in filenames/directories
    safe_parts <- vapply(parts, sanitize_filename, character(1))

    if (length(safe_parts) > 1) {
      # Create subdirectory for parent levels
      subdir <- file.path(path, paste(safe_parts[-length(safe_parts)], collapse = .Platform$file.sep))
      if (!dir.exists(subdir)) {
        dir.create(subdir, recursive = TRUE)
      }
      filename <- paste0(paste(safe_parts, collapse = "_"), ".", format)
      file_path <- file.path(subdir, filename)
    } else {
      filename <- paste0(safe_parts, ".", format)
      file_path <- file.path(path, filename)
    }

    if (file_path %in% seen_paths) {
      hash <- substr(rlang::hash(key), 1, 6)
      collisions <- c(collisions, key)
      file_path <- sub(paste0("\\.", format, "$"),
                       paste0("_", hash, ".", format), file_path)
    }
    seen_paths <- c(seen_paths, file_path)

    # Export individual spec
    save_plot(spec, file_path, width = width, height = height, scale = scale)
    exported_files <- c(exported_files, file_path)
  }

  if (length(collisions) > 0) {
    cli::cli_warn(c(
      "Filename collisions resolved with short hash suffixes",
      "i" = "Affected key{?s}: {.val {collisions}}",
      "i" = "Rename split values to avoid characters that sanitize identically (e.g. {.val /} and {.val -} both become {.val -})."
    ))
  }

  cli::cli_alert_success("Exported {length(exported_files)} plot{?s} to {.path {path}}")

  invisible(exported_files)
}

#' Extract SplitForest from various input types
#'
#' @param x Input object (SplitForest or htmlwidget)
#' @return SplitForest object or NULL
#' @noRd
extract_splitforest <- function(x) {
  # Direct SplitForest (check S7 class)
  if (S7_inherits(x, SplitForest)) {
    return(x)
  }

  # htmlwidget from forest_plot() with split_by
  if (inherits(x, "htmlwidget")) {
    # Check for attached splitforest
    sf <- attr(x, "splitforest")
    if (!is.null(sf) && S7_inherits(sf, SplitForest)) {
      return(sf)
    }
    return(NULL)
  }

  NULL
}

#' Sanitize a string for use as a filename
#'
#' Replaces characters that are problematic in filenames across platforms.
#'
#' @param x Character string to sanitize
#' @return Sanitized string safe for use as filename
#' @noRd
sanitize_filename <- function(x) {
  # Replace problematic characters with safe alternatives
  # These are invalid on Windows: \ / : * ? " < > |
  # Also handle other problematic chars like newlines, tabs
  x <- gsub("[/\\\\*?\"<>|]", "-", x)
  x <- gsub(":", " -", x)  # Colon to " -" for readability (e.g., "Risk: High" -> "Risk - High")
  x <- gsub("[\r\n\t]", " ", x)

  # Collapse multiple spaces/dashes to single
  x <- gsub("-+", "-", x)
  x <- gsub(" +", " ", x)

  # Trim leading/trailing whitespace and dashes
  x <- gsub("^[- ]+|[- ]+$", "", x)

  # If empty after sanitization, use placeholder
  if (nchar(x) == 0) {
    x <- "unnamed"
  }

  x
}
