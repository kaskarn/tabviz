# Tests for save_plot functionality

test_that("save_plot creates SVG file", {
  skip_if_not_installed("V8")

  data <- data.frame(
    study = c("Study A", "Study B", "Study C"),
    point = c(1.2, 0.8, 1.5),
    lower = c(0.9, 0.5, 1.1),
    upper = c(1.6, 1.2, 2.0)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      viz_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  svg_file <- tempfile(fileext = ".svg")
  on.exit(unlink(svg_file), add = TRUE)

  save_plot(spec, svg_file)
  expect_true(file.exists(svg_file))

  content <- readLines(svg_file, n = 2)
  expect_true(any(grepl("<svg", content)))
})

test_that("save_plot creates PNG file", {
  skip_if_not_installed("V8")
  skip_if_not_installed("rsvg")

  data <- data.frame(
    study = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      viz_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  png_file <- tempfile(fileext = ".png")
  on.exit(unlink(png_file), add = TRUE)

  save_plot(spec, png_file)
  expect_true(file.exists(png_file))
  expect_gt(file.size(png_file), 0)
})

test_that("save_plot creates PDF file", {
  skip_if_not_installed("V8")
  skip_if_not_installed("rsvg")

  data <- data.frame(
    study = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      viz_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  pdf_file <- tempfile(fileext = ".pdf")
  on.exit(unlink(pdf_file), add = TRUE)

  save_plot(spec, pdf_file)
  expect_true(file.exists(pdf_file))
  expect_gt(file.size(pdf_file), 0)
})

test_that("save_plot with which= picks a single subview by key", {
  skip_if_not_installed("V8")

  data <- data.frame(
    study = paste0("Study ", 1:4),
    group = rep(c("A", "B"), each = 2),
    point = c(1.0, 2.0, 1.5, 0.8),
    lower = c(0.5, 1.5, 1.0, 0.4),
    upper = c(1.5, 2.5, 2.0, 1.2)
  )
  spec <- web_spec(
    data = data, label = "study",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )
  sf <- split_table(spec, by = "group")

  out <- tempfile(fileext = ".svg")
  on.exit(unlink(out), add = TRUE)
  save_plot(sf, out, which = "A")
  expect_true(file.exists(out))
  expect_gt(file.size(out), 0)
})

test_that("save_plot with which= integer picks the i-th subview", {
  skip_if_not_installed("V8")

  data <- data.frame(
    study = paste0("Study ", 1:4),
    group = rep(c("A", "B"), each = 2),
    point = c(1.0, 2.0, 1.5, 0.8),
    lower = c(0.5, 1.5, 1.0, 0.4),
    upper = c(1.5, 2.5, 2.0, 1.2)
  )
  spec <- web_spec(
    data = data, label = "study",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )
  sf <- split_table(spec, by = "group")

  out <- tempfile(fileext = ".svg")
  on.exit(unlink(out), add = TRUE)
  save_plot(sf, out, which = 1L)
  expect_true(file.exists(out))
})

test_that("save_plot with which= rejects unknown key", {
  skip_if_not_installed("V8")

  data <- data.frame(
    study = paste0("Study ", 1:4),
    group = rep(c("A", "B"), each = 2),
    point = c(1, 2, 1.5, 0.8),
    lower = c(0.5, 1.5, 1, 0.4),
    upper = c(1.5, 2.5, 2, 1.2)
  )
  spec <- web_spec(
    data = data, label = "study",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )
  sf <- split_table(spec, by = "group")

  expect_error(save_plot(sf, tempfile(fileext = ".svg"), which = "Z"),
               "subview key")
})

test_that("save_split_table dedupes filename collisions with hash and warns", {
  skip_if_not_installed("V8")

  # Two distinct values that sanitize to the same string: "a/b" and "a-b"
  # both become "a-b" via sanitize_filename. Without dedupe the second
  # save would silently overwrite the first.
  data <- data.frame(
    study = paste0("Study ", 1:4),
    group = c("a/b", "a/b", "a-b", "a-b"),
    point = c(1.0, 1.1, 0.9, 1.2),
    lower = c(0.8, 0.9, 0.7, 1.0),
    upper = c(1.3, 1.4, 1.1, 1.4)
  )
  spec <- web_spec(
    data = data, label = "study",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )
  sf <- split_table(spec, by = "group")

  out_dir <- file.path(tempdir(), "collide")
  on.exit(unlink(out_dir, recursive = TRUE), add = TRUE)
  expect_warning(
    save_split_table(sf, out_dir, format = "svg"),
    "collision"
  )
  files <- list.files(out_dir, pattern = "\\.svg$")
  expect_equal(length(files), 2)
  expect_true(any(grepl("_[a-f0-9]{6}\\.svg$", files)))
})

test_that("save_split_table creates files in directory", {
  skip_if_not_installed("V8")

  data <- data.frame(
    study = c("A", "B", "C", "D"),
    group = c("X", "X", "Y", "Y"),
    point = c(1.0, 2.0, 1.5, 0.8),
    lower = c(0.5, 1.5, 1.0, 0.4),
    upper = c(1.5, 2.5, 2.0, 1.2)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      viz_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  sf <- split_table(spec, by = "group")

  out_dir <- tempdir()
  save_split_table(sf, out_dir, format = "svg")

  svg_files <- list.files(out_dir, pattern = "\\.svg$", full.names = TRUE)
  expect_gt(length(svg_files), 0)

  # Clean up
  file.remove(svg_files)
})
