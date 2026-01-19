# Tests for example files
# This file serves two purposes:
# 1. Unit tests: Verify all examples produce valid htmlwidgets
# 2. Visual testing: Regenerate HTML files for manual inspection
#
# To regenerate all examples for visual inspection, run:
#   tabviz::regenerate_examples()
#
# Or from the package root:
#   R -e "tabviz::regenerate_examples()"

# Helper: Get all example file paths
get_example_files <- function() {

  example_dir <- system.file("examples", package = "tabviz")
  if (example_dir == "") {
    # Fallback for development
    example_dir <- "inst/examples"
  }

  list.files(example_dir, pattern = "[.]R$", full.names = TRUE)
}

# Helper: Run an example file and return the widget
run_example <- function(example_path) {
  env <- new.env(parent = globalenv())
  result <- source(example_path, local = env)
  result$value
}

# Helper: Regenerate all examples to output directory
# Call this interactively to create HTML files for visual inspection
regenerate_examples <- function(output_dir = "examples_output", open_browser = FALSE) {
  if (!requireNamespace("htmlwidgets", quietly = TRUE)) {
    stop("htmlwidgets package required for regenerating examples")
  }

  # Create output directory
  if (!dir.exists(output_dir)) {
    dir.create(output_dir, recursive = TRUE)
  }


  examples <- get_example_files()
  results <- list()

  for (ex in examples) {
    name <- tools::file_path_sans_ext(basename(ex))
    outfile <- file.path(output_dir, paste0(name, ".html"))

    tryCatch({
      widget <- run_example(ex)

      if (inherits(widget, "htmlwidget")) {
        htmlwidgets::saveWidget(widget, outfile, selfcontained = FALSE)
        results[[name]] <- list(status = "success", file = outfile)
        message("Generated: ", outfile)
      } else {
        results[[name]] <- list(status = "skipped", reason = "No widget returned")
        message("Skipped: ", name, " (no widget)")
      }
    }, error = function(e) {
      results[[name]] <- list(status = "error", error = conditionMessage(e))
      message("Error in ", name, ": ", conditionMessage(e))
    })
  }

  # Optionally open first example in browser

  if (open_browser && length(results) > 0) {
    first_success <- Filter(function(x) x$status == "success", results)
    if (length(first_success) > 0) {
      browseURL(first_success[[1]]$file)
    }
  }

  invisible(results)
}

# Unit tests for each example
test_that("column_groups example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("column_groups", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("dark_theme example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("dark_theme", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("interactive_demo example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("interactive_demo", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("iris_regression example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("iris_regression", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("jama_style example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("jama_style", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("lancet_style example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("lancet_style", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("mtcars_meta example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("mtcars_meta", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("multi_effect example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("multi_effect", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("nested_groups example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("nested_groups", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("presentation_demo example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("presentation_demo", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("row_styling example produces valid widget", {
  examples <- get_example_files()
  ex <- examples[grepl("row_styling", examples)]
  skip_if(length(ex) == 0, "Example file not found")

  widget <- run_example(ex[1])
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

# Meta-test: all examples should produce valid widgets
test_that("all examples produce valid widgets", {
  examples <- get_example_files()
  skip_if(length(examples) == 0, "No example files found")

  for (ex in examples) {
    name <- tools::file_path_sans_ext(basename(ex))
    widget <- run_example(ex)
    expect_true(
      inherits(widget, "htmlwidget"),
      label = paste("Example", name, "produces htmlwidget")
    )
  }
})
