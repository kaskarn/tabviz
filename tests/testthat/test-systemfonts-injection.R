# Phase 2.5: R-side systemfonts width injection for V8 SVG export.
#
# `.inject_systemfonts_widths()` measures auto-width columns with
# `systemfonts::shape_string` and stamps pixel-exact widths into the spec
# before `serialize_spec()` runs. V8's `measureAutoColumns` then honors
# the numeric width pin and skips its own (estimator-based) measurement.

skip_if_no_systemfonts <- function() {
  if (!requireNamespace("systemfonts", quietly = TRUE)) {
    skip("systemfonts not installed")
  }
}

test_that("inject_systemfonts_widths stamps numeric widths on auto columns", {
  skip_if_no_systemfonts()
  df <- data.frame(
    study  = c("Alpha", "Boston General Hospital", "C"),
    n      = c(100L, 200L, 50L),
    hr     = c(0.5, 0.7, 1.1),
    stringsAsFactors = FALSE
  )
  spec <- tabviz(
    df, label = "study",
    columns = list(col_n("n"), col_numeric("hr", decimals = 2)),
    .spec_only = TRUE
  )
  res <- tabviz:::.inject_systemfonts_widths(spec)

  # Both body columns and the label column get numeric widths.
  for (c in res@columns) {
    expect_true(is.numeric(c@width) && !is.na(c@width),
                info = sprintf("column %s should have numeric width", c@field))
    expect_gte(c@width, 40)
    expect_lte(c@width, 480)
  }
  expect_true(is.numeric(res@label_column@width))
  # Wider study labels yield a wider label column than the n column.
  expect_gt(res@label_column@width, res@columns[[1]]@width)
})

test_that("inject_systemfonts_widths preserves explicit numeric widths", {
  skip_if_no_systemfonts()
  df <- data.frame(study = c("A", "B"), n = c(1L, 2L), stringsAsFactors = FALSE)
  spec <- tabviz(
    df, label = "study",
    columns = list(col_n("n", width = 137)),
    .spec_only = TRUE
  )
  res <- tabviz:::.inject_systemfonts_widths(spec)
  n_col <- Filter(function(c) c@field == "n", res@columns)[[1]]
  expect_identical(n_col@width, 137)
})

test_that("inject_systemfonts_widths skips viz/forest column types", {
  skip_if_no_systemfonts()
  df <- data.frame(
    study = "S", hr = 1.0, lower = 0.8, upper = 1.2,
    stringsAsFactors = FALSE
  )
  spec <- tabviz(
    df, label = "study",
    columns = list(viz_forest(point = "hr", lower = "lower", upper = "upper")),
    .spec_only = TRUE
  )
  res <- tabviz:::.inject_systemfonts_widths(spec)
  # Forest column keeps its constructor-derived width (numeric, set by viz_forest)
  # rather than being overwritten with a systemfonts-measured value.
  forest <- Filter(function(c) c@type == "forest", res@columns)[[1]]
  pre_forest <- Filter(function(c) c@type == "forest", spec@columns)[[1]]
  expect_identical(forest@width, pre_forest@width)
})

test_that("inject_systemfonts_widths is a no-op without systemfonts (defensive)", {
  # Even if systemfonts IS installed in the test env, the helper should
  # short-circuit cleanly on specs with no theme. Catches the early-return
  # path so future refactors don't accidentally crash on theme-less specs.
  spec <- tabviz(
    data.frame(s = "A", n = 1L), label = "s",
    columns = list(col_n("n")),
    .spec_only = TRUE
  )
  spec@theme <- NULL
  res <- tabviz:::.inject_systemfonts_widths(spec)
  # No theme -> no font info -> nothing measured -> auto column stays "auto".
  expect_identical(res@columns[[1]]@width, spec@columns[[1]]@width)
})
