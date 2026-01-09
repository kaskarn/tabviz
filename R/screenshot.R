# Screenshot HTML widget files for visual debugging

#' Screenshot an HTML widget file
#'
#' Takes a screenshot of an HTML file containing a webforest widget using
#' Puppeteer (headless Chrome). Useful for visual debugging and inspection.
#'
#' @param html_file Path to HTML file to screenshot
#' @param output_file Path for PNG output. If NULL, replaces .html with .png
#' @param width Viewport width in pixels (default 1200)
#' @param height Viewport height in pixels (default 800)
#' @param scale Device scale factor for retina output (default 2)
#'
#' @return Invisibly returns the output file path
#'
#' @details
#' Requires Node.js and the srcjs/scripts/screenshot.js script.
#' Run `npm install` in the srcjs directory first to install Puppeteer.
#'
#' @examples
#' \dontrun{
#' # Screenshot a single HTML file
#' screenshot_html("examples_output/basic.html")
#'
#' # Screenshot with custom dimensions
#' screenshot_html("examples_output/gallery_12.html", width = 1600)
#'
#' # Screenshot all examples
#' html_files <- list.files("examples_output", "\\.html$", full.names = TRUE)
#' for (f in html_files) screenshot_html(f)
#' }
#'
#' @export
screenshot_html <- function(html_file, output_file = NULL, width = 1200,
                            height = 800, scale = 2) {
  # Validate input file exists
 if (!file.exists(html_file)) {
    cli_abort("HTML file not found: {.file {html_file}}")
  }

  # Default output path
  if (is.null(output_file)) {
    output_file <- sub("\\.html$", ".png", html_file, ignore.case = TRUE)
  }

  # Find the screenshot script
  # First check srcjs (for development)
  script_path <- "srcjs/scripts/screenshot.js"
  if (!file.exists(script_path)) {
    # Check inst/scripts (for installed package)
    script_path <- system.file("scripts/screenshot.js", package = "webforest")
  }

  if (!file.exists(script_path) || script_path == "") {
    cli_abort(c(
      "Screenshot script not found",
      "i" = "Run {.code npm install} in the {.file srcjs} directory"
    ))
  }

  # Build command arguments
  args <- c(
    script_path,
    normalizePath(html_file),
    normalizePath(output_file, mustWork = FALSE),
    paste0("--width=", width),
    paste0("--height=", height),
    paste0("--scale=", scale)
  )

  # Run the screenshot script
  result <- processx::run(
    command = "node",
    args = args,
    error_on_status = FALSE,
    echo_cmd = FALSE,
    spinner = TRUE
  )

  if (result$status != 0) {
    # Escape curly braces in error message to prevent cli interpolation
    err_msg <- gsub("\\{", "{{", trimws(result$stderr))
    err_msg <- gsub("\\}", "}}", err_msg)
    cli_abort(c(
      "Screenshot failed",
      "x" = err_msg,
      "i" = "Make sure Puppeteer is installed: {.code npm install} in srcjs/"
    ))
  }

  cli::cli_alert_success("Screenshot saved to {.file {output_file}}")
  invisible(output_file)
}

#' Screenshot all HTML example files
#'
#' Takes screenshots of all HTML files in a directory.
#'
#' @param input_dir Directory containing HTML files (default: "examples_output")
#' @param output_dir Directory for PNG output (default: same as input)
#' @param pattern File pattern to match (default: "\\.html$")
#' @param ... Additional arguments passed to screenshot_html
#'
#' @return Invisibly returns vector of output file paths
#'
#' @examples
#' \dontrun{
#' screenshot_all_examples()
#' screenshot_all_examples(width = 1600)
#' }
#'
#' @export
screenshot_all_examples <- function(input_dir = "examples_output",
                                    output_dir = input_dir,
                                    pattern = "\\.html$", ...) {
  html_files <- list.files(input_dir, pattern = pattern, full.names = TRUE)

  if (length(html_files) == 0) {
    cli_warn("No HTML files found in {.path {input_dir}}")
    return(invisible(character(0)))
  }

  cli::cli_h1("Screenshotting {length(html_files)} HTML files")

  output_files <- character(length(html_files))

  for (i in seq_along(html_files)) {
    html_file <- html_files[i]
    name <- tools::file_path_sans_ext(basename(html_file))
    output_file <- file.path(output_dir, paste0(name, ".png"))

    tryCatch({
      screenshot_html(html_file, output_file, ...)
      output_files[i] <- output_file
    }, error = function(e) {
      cli::cli_alert_danger("{.file {name}}: {conditionMessage(e)}")
      output_files[i] <- NA_character_
    })
  }

  n_success <- sum(!is.na(output_files))
  cli::cli_alert_info("Screenshotted {n_success}/{length(html_files)} files")

  invisible(output_files)
}
