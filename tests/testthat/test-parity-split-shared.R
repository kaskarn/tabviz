# Shared-product (axis range, column widths) parity tests.
#
# After Phase 3, `split_table()`'s shared-axis / shared-widths math no
# longer lives natively in R — it delegates to `srcjs/src/lib/split-shared.ts`
# via the v8 bridge. These tests verify the delegated path behaves as
# expected for the cases the renderer cares about:
#
#   * Shared axis range covers the union of subsets' effect data.
#   * Shared axis range is stable (same input -> same output).
#   * Shared widths produce a width per auto-width text/numeric column.
#   * Shared widths skip columns with explicit numeric width.
#   * Both modes leave per-subset specs internally consistent.

make_split_fixture <- function() {
  df <- data.frame(
    study  = c("Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"),
    n      = c(100L, 200L, 50L, 1000L, 350L, 8500L),
    hr     = c(0.5, 0.65, 0.85, 1.05, 1.25, 1.55),
    lower  = c(0.40, 0.55, 0.70, 0.90, 1.10, 1.30),
    upper  = c(0.62, 0.78, 1.00, 1.20, 1.42, 1.83),
    region = c("US", "US", "EU", "EU", "Asia", "Asia"),
    stringsAsFactors = FALSE
  )
  spec <- tabviz(
    df,
    label = "study",
    columns = list(
      col_n("n"),
      col_numeric("hr", decimals = 2),
      viz_forest(point = "hr", lower = "lower", upper = "upper")
    ),
    .spec_only = TRUE
  )
  split_table(spec, by = "region", shared_axis = TRUE, shared_column_widths = TRUE)
}

test_that("shared_axis: every subset gets the same axis range", {
  sf <- make_split_fixture()
  ranges <- lapply(sf@specs, function(s) c(s@theme@axis@range_min, s@theme@axis@range_max))
  expect_true(length(unique(lapply(ranges, function(r) round(r, 6)))) == 1)
})

test_that("shared_axis: range covers union of CIs", {
  sf <- make_split_fixture()
  rng <- c(sf@specs[[1]]@theme@axis@range_min, sf@specs[[1]]@theme@axis@range_max)
  # The widest CI in the fixture is [0.40, 1.83].
  expect_lte(rng[1], 0.40)
  expect_gte(rng[2], 1.83)
})

test_that("shared_axis: deterministic — identical inputs produce identical outputs", {
  sf1 <- make_split_fixture()
  sf2 <- make_split_fixture()
  r1 <- c(sf1@specs[[1]]@theme@axis@range_min, sf1@specs[[1]]@theme@axis@range_max)
  r2 <- c(sf2@specs[[1]]@theme@axis@range_min, sf2@specs[[1]]@theme@axis@range_max)
  expect_identical(r1, r2)
})

test_that("shared_column_widths: every subset gets the same numeric width per auto column", {
  sf <- make_split_fixture()
  # 'n' and 'hr' have width = "auto"; 'study' (label column) and the
  # forest column are explicitly handled (label col on its own slot,
  # forest is a viz column that auto-sizes from plot geometry — skipped
  # by computeSharedWidths).
  widths_by_subset <- lapply(sf@specs, function(s) {
    setNames(
      vapply(s@columns, function(c) as.character(c@width %||% NA_character_), character(1)),
      vapply(s@columns, function(c) c@id, character(1))
    )
  })
  # All subsets agree, column-by-column.
  for (i in 2:length(widths_by_subset)) {
    expect_identical(widths_by_subset[[1]], widths_by_subset[[i]])
  }
  # Auto columns ('n', 'hr') now have numeric widths.
  s1 <- sf@specs[[1]]
  for (c in s1@columns) {
    if (c@id %in% c("n", "hr")) {
      expect_true(is.numeric(c@width) && !is.na(c@width),
                  info = sprintf("column %s should have numeric width", c@id))
      expect_gte(c@width, 40)
      expect_lte(c@width, 480)
    }
  }
})

test_that("shared_column_widths: skips columns with explicit numeric width", {
  df <- data.frame(
    study = c("A", "B", "C", "D"),
    hr    = c(0.5, 0.7, 1.1, 1.5),
    region = c("US", "US", "EU", "EU"),
    stringsAsFactors = FALSE
  )
  spec <- tabviz(
    df,
    label = "study",
    columns = list(col_numeric("hr", width = 123)),
    .spec_only = TRUE
  )
  sf <- split_table(spec, by = "region", shared_column_widths = TRUE)
  # The explicit-width column stays at 123 across subsets.
  for (s in sf@specs) {
    hr_col <- Filter(function(c) c@field == "hr", s@columns)[[1]]
    expect_identical(hr_col@width, 123)
  }
})

test_that("shared modes off: subsets carry their own (un-stamped) axis/widths", {
  df <- data.frame(
    study = c("A", "B", "C", "D"),
    hr    = c(0.5, 1.5, 0.7, 1.1),
    lower = c(0.4, 1.3, 0.55, 0.9),
    upper = c(0.6, 1.8, 0.85, 1.3),
    region = c("US", "US", "EU", "EU"),
    stringsAsFactors = FALSE
  )
  spec <- tabviz(
    df, label = "study",
    columns = list(viz_forest(point = "hr", lower = "lower", upper = "upper")),
    .spec_only = TRUE
  )
  sf <- split_table(spec, by = "region", shared_axis = FALSE, shared_column_widths = FALSE)
  # axis@range_min/max remain NA on each subset (no stamping happened).
  for (s in sf@specs) {
    expect_true(is.na(s@theme@axis@range_min))
    expect_true(is.na(s@theme@axis@range_max))
  }
})
