# Tests for infer_field_category() and availableFields serialization

test_that("infer_field_category classifies common column types", {
  expect_equal(infer_field_category(c(1.5, 2.3)), "numeric")
  expect_equal(infer_field_category(1:5), "integer")
  expect_equal(infer_field_category(c("a", "b")), "string")
  expect_equal(infer_field_category(factor(c("a", "b"))), "string")
  expect_equal(infer_field_category(c(TRUE, FALSE)), "logical")
  expect_equal(infer_field_category(as.Date("2024-01-01")), "date")
  expect_equal(infer_field_category(as.POSIXct("2024-01-01")), "date")
})

test_that("infer_field_category detects array-numeric list columns", {
  arr_col <- list(c(1, 2, 3), c(4, 5), numeric(0))
  expect_equal(infer_field_category(arr_col), "array-numeric")

  mixed <- list(c(1, 2), c("a", "b"))
  expect_equal(infer_field_category(mixed), "other")
})

test_that("serialized payload exposes availableFields", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5),
    n = c(100L, 200L),
    flag = c(TRUE, FALSE)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )

  payload <- serialize_spec(spec)
  expect_true("availableFields" %in% names(payload))

  fields <- payload$availableFields
  names(fields) <- vapply(fields, `[[`, character(1), "field")

  expect_equal(fields$study$category, "string")
  expect_equal(fields$point$category, "numeric")
  expect_equal(fields$n$category, "integer")
  expect_equal(fields$flag$category, "logical")
})

test_that("available_exclude filters out listed fields", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5),
    ssn = c("x", "y")
  )

  spec <- web_spec(
    data = data,
    label = "study",
    available_exclude = "ssn",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )

  payload <- serialize_spec(spec)
  surfaced <- vapply(payload$availableFields, `[[`, character(1), "field")
  expect_false("ssn" %in% surfaced)
  expect_true(all(c("study", "point", "lower", "upper") %in% surfaced))
})

test_that("extra_columns round-trip through extraColumns in payload", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5),
    n = c(100L, 200L)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper")),
    extra_columns = list(col_numeric("n", header = "Sample size"))
  )

  expect_length(spec@extra_columns, 1)

  payload <- serialize_spec(spec)
  expect_length(payload$extraColumns, 1)
  expect_equal(payload$extraColumns[[1]]$field, "n")
  expect_equal(payload$extraColumns[[1]]$header, "Sample size")
})
