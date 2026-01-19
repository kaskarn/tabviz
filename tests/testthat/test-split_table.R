# Tests for split_table functionality

test_that("split_table creates valid SplitForest from WebSpec", {
  # Create test data
  test_data <- data.frame(
    study = paste0("Study_", 1:6),
    effect = c(0.5, 0.8, 1.2, 0.9, 1.1, 0.7),
    lower = c(0.3, 0.5, 0.9, 0.6, 0.8, 0.4),
    upper = c(0.8, 1.1, 1.5, 1.2, 1.4, 1.0),
    group = c("A", "A", "A", "B", "B", "B")
  )

  # Create WebSpec
  spec <- web_spec(
    test_data,
    point = "effect",
    lower = "lower",
    upper = "upper",
    label = "study"
  )

  # Split by group
  result <- split_table(spec, by = "group")

  expect_s4_class(result, "SplitForest")
  expect_equal(length(result@specs), 2)
  expect_true(all(c("A", "B") %in% names(result@specs)))
})

test_that("split_table validates missing columns", {
  test_data <- data.frame(
    study = c("A", "B"),
    effect = c(0.5, 0.8),
    lower = c(0.3, 0.5),
    upper = c(0.8, 1.1)
  )

  spec <- web_spec(
    test_data,
    point = "effect",
    lower = "lower",
    upper = "upper",
    label = "study"
  )

  expect_error(
    split_table(spec, by = "nonexistent"),
    "Split column"
  )
})

test_that("split_table works with data.frame input", {
  test_data <- data.frame(
    study = paste0("Study_", 1:4),
    effect = c(0.5, 0.8, 1.2, 0.9),
    lower = c(0.3, 0.5, 0.9, 0.6),
    upper = c(0.8, 1.1, 1.5, 1.2),
    group = c("A", "A", "B", "B")
  )

  result <- split_table(
    test_data,
    by = "group",
    point = "effect",
    lower = "lower",
    upper = "upper",
    label = "study"
  )

  expect_s4_class(result, "SplitForest")
  expect_equal(length(result@specs), 2)
})

test_that("split_table with shared_axis flag", {
  test_data <- data.frame(
    study = paste0("Study_", 1:4),
    effect = c(0.5, 0.8, 1.2, 0.9),
    lower = c(0.3, 0.5, 0.9, 0.6),
    upper = c(0.8, 1.1, 1.5, 1.2),
    group = c("A", "A", "B", "B")
  )

  spec <- web_spec(
    test_data,
    point = "effect",
    lower = "lower",
    upper = "upper",
    label = "study"
  )

  result <- split_table(spec, by = "group", shared_axis = TRUE)

  expect_s4_class(result, "SplitForest")
  expect_true(result@shared_axis)
})

test_that("split_table handles multiple split columns", {
  test_data <- data.frame(
    study = paste0("Study_", 1:8),
    effect = runif(8, 0.5, 1.5),
    lower = runif(8, 0.3, 0.7),
    upper = runif(8, 1.3, 2.0),
    region = rep(c("North", "South"), each = 4),
    sex = rep(c("M", "F", "M", "F"), 2)
  )

  spec <- web_spec(
    test_data,
    point = "effect",
    lower = "lower",
    upper = "upper",
    label = "study"
  )

  result <- split_table(spec, by = c("region", "sex"))

  expect_s4_class(result, "SplitForest")
  # Should have one spec per unique combination
  expect_equal(length(result@specs), 4)
})
