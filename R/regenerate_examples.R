#' Regenerate Example HTML Files
#'
#' Runs all example files in inst/examples and saves HTML output for visual
#' inspection. Useful for testing changes to the package.
#'
#' @param output_dir Directory to save HTML files. Default is "examples_output".
#' @param open_browser If TRUE, opens the first generated file in the browser.
#' @return Invisibly returns a list of results for each example.
#'
#' @export
#' @examples
#' \dontrun{
#' regenerate_examples()
#' regenerate_examples(open_browser = TRUE)
#' }
regenerate_examples <- function(output_dir = "examples_output", open_browser = FALSE) {
  if (!requireNamespace("htmlwidgets", quietly = TRUE)) {
    cli_abort("htmlwidgets package required for regenerating examples")
  }

  # Get example files
 example_dir <- system.file("examples", package = "tabviz")
  if (example_dir == "") {
    # Fallback for development
    example_dir <- "inst/examples"
  }

  examples <- list.files(example_dir, pattern = "[.]R$", full.names = TRUE)

  if (length(examples) == 0) {
    cli_warn("No example files found")
    return(invisible(list()))
  }

  # Create output directory
  if (!dir.exists(output_dir)) {
    dir.create(output_dir, recursive = TRUE)
  }

  cli::cli_h1("Regenerating Examples")
  cli::cli_alert_info("Output directory: {.path {output_dir}}")

  results <- list()

  for (ex in examples) {
    name <- tools::file_path_sans_ext(basename(ex))
    outfile <- file.path(output_dir, paste0(name, ".html"))

    tryCatch({
      # Run example in clean environment
      env <- new.env(parent = globalenv())
      result <- source(ex, local = env)

      if (inherits(result$value, "htmlwidget")) {
        htmlwidgets::saveWidget(result$value, outfile, selfcontained = FALSE)
        results[[name]] <- list(status = "success", file = outfile)
        cli::cli_alert_success("{.file {name}}")
      } else {
        results[[name]] <- list(status = "skipped", reason = "No widget returned")
        cli::cli_alert_warning("{.file {name}} - skipped (no widget)")
      }
    }, error = function(e) {
      results[[name]] <- list(status = "error", error = conditionMessage(e))
      cli::cli_alert_danger("{.file {name}} - {conditionMessage(e)}")
    })
  }

  # Summary
  n_success <- sum(vapply(results, function(x) x$status == "success", logical(1)))
  n_total <- length(results)
  cli::cli_alert_info("Generated {n_success}/{n_total} examples")

  # Optionally open first example in browser
  if (open_browser && n_success > 0) {
    first_success <- Filter(function(x) x$status == "success", results)
    if (length(first_success) > 0) {
      utils::browseURL(first_success[[1]]$file)
    }
  }

  invisible(results)
}
