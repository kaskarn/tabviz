# Tests for R-side conditions (schema-sprint Phase 5b).
#
# Covers:
#   - condition() validation + shape
#   - cond() validation + tagged-union shape
#   - formula-rule evaluation against a data frame
#   - function-rule evaluation
#   - tabviz(conditions = ...) integration: banks.conditions on the wire
#   - cond("name") in col_text style args round-trips as the wire
#     tagged-union under column.styleMapping

library(testthat)

test_that("condition() accepts a formula rule and stores it un-evaluated", {
  c <- condition("sig", ~ p < 0.05, label = "Significant")
  expect_s3_class(c, "tabviz_condition")
  expect_equal(c$name, "sig")
  expect_equal(c$label, "Significant")
  expect_true(inherits(c$rule, "formula"))
})

test_that("condition() defaults label to name", {
  c <- condition("sig", ~ p < 0.05)
  expect_equal(c$label, "sig")
})

test_that("condition() rejects non-formula non-function rules", {
  expect_error(condition("sig", 42), "formula")
  expect_error(condition("sig", "p < 0.05"), "formula")
})

test_that("cond() returns the tagged-union value", {
  v <- cond("sig")
  expect_s3_class(v, "tabviz_cond_ref")
  expect_equal(v$kind, "condition")
  expect_equal(v$name, "sig")
})

test_that("evaluate_condition() materializes a formula rule to a boolean vector", {
  d <- data.frame(p = c(0.001, 0.02, 0.06, 0.3))
  out <- tabviz:::evaluate_condition(condition("sig", ~ p < 0.05), d)
  expect_equal(out$id, "sig")
  expect_equal(out$kind, "boolean")
  expect_equal(out$values, c(TRUE, TRUE, FALSE, FALSE))
  expect_true("ruleText" %in% names(out))
})

test_that("evaluate_condition() materializes a function rule per row", {
  d <- data.frame(p = c(0.001, 0.02, 0.06))
  fn <- function(row, all_rows) as.numeric(row$p) < 0.05
  out <- tabviz:::evaluate_condition(condition("sig", fn), d)
  expect_equal(out$values, c(TRUE, TRUE, FALSE))
})

test_that("evaluate_condition() coerces NA results to FALSE", {
  d <- data.frame(p = c(0.001, NA_real_, 0.06))
  out <- tabviz:::evaluate_condition(condition("sig", ~ p < 0.05), d)
  expect_equal(out$values, c(TRUE, FALSE, FALSE))
})

test_that("tabviz(conditions = ...) writes banks.conditions to the wire", {
  d <- data.frame(study = c("A", "B", "C"), p = c(0.001, 0.5, 0.04))
  spec <- tabviz(
    data = d,
    label = "study",
    conditions = list(condition("sig", ~ p < 0.05)),
    .spec_only = TRUE
  )
  expect_length(spec@conditions, 1L)
  expect_equal(spec@conditions[[1]]$id, "sig")
  expect_equal(spec@conditions[[1]]$values, c(TRUE, FALSE, TRUE))

  # Serialized shape: banks.conditions[] on the wire
  wire <- tabviz:::serialize_spec(spec)
  expect_false(is.null(wire$banks))
  expect_length(wire$banks$conditions, 1L)
  expect_equal(wire$banks$conditions[[1]]$id, "sig")
  expect_equal(wire$banks$conditions[[1]]$values, c(TRUE, FALSE, TRUE))
})

test_that("no conditions → no banks field on the wire (back-compat)", {
  d <- data.frame(study = c("A"), p = c(0.01))
  spec <- tabviz(data = d, label = "study", .spec_only = TRUE)
  wire <- tabviz:::serialize_spec(spec)
  expect_null(wire$banks)
})

test_that("cond() in col_text(bold = ...) serializes as the tagged union", {
  d <- data.frame(study = c("A", "B"), p = c(0.01, 0.5))
  spec <- tabviz(
    data = d,
    label = "study",
    conditions = list(condition("sig", ~ p < 0.05)),
    columns = list(col_text("study", bold = cond("sig"))),
    .spec_only = TRUE
  )
  wire <- tabviz:::serialize_spec(spec)
  col <- wire$columns[[1]]
  expect_false(is.null(col$styleMapping))
  expect_equal(col$styleMapping$bold$kind, "condition")
  expect_equal(col$styleMapping$bold$name, "sig")
})
