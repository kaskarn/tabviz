#' Browser visual-regression harness
#'
#' Renders a small set of canonical example specs to self-contained
#' HTML files, then hands them off to the Puppeteer-based snapshot
#' script (`srcjs/tests/visual-browser/snapshot.mjs`) which produces
#' PNG screenshots and diffs against baseline images.
#'
#' Complements [render_visual_tests()] which exercises the V8/SVG
#' export path. The two harnesses cover different runtime paths
#' (DOM-mounted Svelte vs. serialized SVG), and a regression in one
#' can pass undetected by the other. See
#' `srcjs/tests/visual-browser/README.md` for harness details.
#'
#' @param pattern Optional regex; when supplied, restricts the run to
#'   gallery example names matching it.
#' @param update Logical. When `TRUE`, baselines are overwritten with
#'   the current rendered output. Use this after an intentional
#'   rendering change, with a commit message explaining what changed.
#' @param verbose Logical; print per-spec status as snapshots are taken.
#'
#' @return Invisibly, the integer exit code from the snapshot script.
#'   `0` = all snapshots match. `1` = at least one diff or new fixture.
#'   `2` = harness error.
#'
#' @examples
#' \dontrun{
#' # Run all browser visual tests
#' tabviz::render_browser_visual_tests()
#'
#' # Just the gallery jamA examples
#' tabviz::render_browser_visual_tests("jama")
#'
#' # Accept the current output as the new baseline
#' tabviz::render_browser_visual_tests(update = TRUE)
#' }
#' @export
render_browser_visual_tests <- function(pattern = NULL,
                                        update = FALSE,
                                        verbose = TRUE) {
  checkmate::assert_string(pattern, null.ok = TRUE)
  checkmate::assert_flag(update)
  checkmate::assert_flag(verbose)

  pkg_root <- .find_package_root()
  examples_dir   <- file.path(pkg_root, "inst", "examples")
  visual_root    <- file.path(pkg_root, "srcjs", "tests", "visual-browser")
  fixtures_dir   <- file.path(visual_root, "fixtures")
  snapshot_script <- file.path(visual_root, "snapshot.mjs")

  if (!dir.exists(examples_dir)) {
    cli::cli_abort("Examples dir not found: {.path {examples_dir}}")
  }
  if (!file.exists(snapshot_script)) {
    cli::cli_abort("Snapshot script not found: {.path {snapshot_script}}")
  }

  if (!requireNamespace("htmlwidgets", quietly = TRUE)) {
    cli::cli_abort("Browser visual tests need {.pkg htmlwidgets} installed.")
  }

  # The set of example R files to drive the harness with. We use the
  # gallery_* examples by default — they exercise a representative
  # cross-section of cell types and theme presets.
  example_files <- list.files(examples_dir, pattern = "^gallery_.*\\.R$", full.names = TRUE)
  if (!is.null(pattern)) {
    example_files <- example_files[grepl(pattern, basename(example_files))]
  }
  if (length(example_files) == 0) {
    cli::cli_abort("No example files matched {.val {pattern}} in {.path {examples_dir}}.")
  }

  dir.create(fixtures_dir, recursive = TRUE, showWarnings = FALSE)
  .render_browser_fixtures(example_files, fixtures_dir, verbose = verbose)

  args <- character(0)
  if (update) args <- c(args, "--update")
  if (verbose) cli::cli_inform("Running browser snapshot script...")
  status <- system2(
    "node",
    c(shQuote(snapshot_script), args),
    stdout = if (verbose) "" else FALSE,
    stderr = if (verbose) "" else FALSE,
  )
  invisible(status)
}

# Source each example R file in a child environment, find the
# resulting tabviz widget, save it as a self-contained HTML file
# into fixtures_dir.
.render_browser_fixtures <- function(example_files, fixtures_dir, verbose) {
  for (f in example_files) {
    name <- tools::file_path_sans_ext(basename(f))
    out  <- file.path(fixtures_dir, paste0(name, ".html"))
    if (verbose) cli::cli_inform("Rendering fixture: {.val {name}}")

    widget <- tryCatch(
      .source_example_to_widget(f),
      error = function(err) {
        cli::cli_warn("Skipping {.val {name}}: {err$message}")
        NULL
      }
    )
    if (is.null(widget) || !inherits(widget, "htmlwidget")) {
      if (verbose) cli::cli_warn("Example {.val {name}} produced no widget; skipping.")
      next
    }
    tryCatch(
      suppressMessages(htmlwidgets::saveWidget(widget, out, selfcontained = TRUE)),
      error = function(err) {
        cli::cli_warn("Skipping {.val {name}}: saveWidget failed: {err$message}")
      }
    )
  }
}

# Source an example R file in an isolated environment, return the
# tabviz widget object it produced. Examples typically end with
# `print(spec)` or just `spec` — we wrap them so the last expression's
# value is captured.
.source_example_to_widget <- function(file) {
  expr <- parse(file = file)
  env  <- new.env(parent = globalenv())
  out  <- NULL
  for (e in expr) {
    out <- eval(e, envir = env)
  }
  out
}

# Locate the package root from inside or outside the installed
# package directory. Falls back to `here::here()`-ish discovery.
.find_package_root <- function() {
  # When the package is being developed (devtools::load_all), the
  # source tree is the working directory or its ancestor.
  candidate <- getwd()
  while (!file.exists(file.path(candidate, "DESCRIPTION"))) {
    parent <- dirname(candidate)
    if (parent == candidate) {
      cli::cli_abort("Could not find DESCRIPTION from {.path {getwd()}}.")
    }
    candidate <- parent
  }
  candidate
}
