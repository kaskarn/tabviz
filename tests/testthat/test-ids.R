# Column ID integrity — dedup + reserved-sentinel guards.
#
# Backs up the v0.20.2 column-id audit. Every ColumnSpec / ColumnGroup id
# inside a spec must be globally unique within that spec (one namespace
# across leaves + groups + extra_columns), and a small set of strings are
# reserved for the frontend store's scope markers.

library(testthat)

# ---------------------------------------------------------------------
# Sentinel validation
# ---------------------------------------------------------------------

test_that("ColumnSpec rejects reserved ids", {
  expect_error(
    ColumnSpec(id = "__root__", header = "X", field = "x"),
    "reserved"
  )
  expect_error(
    ColumnSpec(id = "__start__", header = "X", field = "x"),
    "reserved"
  )
})

test_that("ColumnSpec allows internal-looking ids that aren't the specific sentinels", {
  # tabviz uses `__row_number__` internally for label columns when the user
  # doesn't provide a label field — must not be rejected.
  expect_silent(
    ColumnSpec(id = "__row_number__", header = "X", field = "x")
  )
  expect_silent(
    ColumnSpec(id = "__custom__", header = "X", field = "x")
  )
})

test_that("ColumnGroup rejects reserved ids", {
  expect_error(
    ColumnGroup(id = "__root__", header = "G", columns = list()),
    "reserved"
  )
})

# ---------------------------------------------------------------------
# Tree-walk dedup
# ---------------------------------------------------------------------

test_that("dedup renames duplicate leaf ids at top level", {
  spec <- tabviz(
    data.frame(n = 1:3, study = c("A", "B", "C")),
    label = "study",
    columns = list(
      col_numeric("n", "N"),
      col_bar("n", "Sample size")
    ),
    .spec_only = TRUE
  )
  ids <- vapply(spec@columns, function(c) c@id, character(1))
  expect_true("n" %in% ids)
  expect_true("n_2" %in% ids)
  # No more than one unrenamed `n` — dedup collapsed the collision.
  expect_equal(sum(ids == "n"), 1L)
})

test_that("dedup renames leaf ids nested inside column groups", {
  spec <- tabviz(
    data.frame(
      study = c("A", "B"),
      drug = c("X", "Y"),
      n = c(10L, 20L)
    ),
    label = "study",
    columns = list(
      col_group("Top",
        col_text("drug"),
        col_numeric("n")
      ),
      col_text("drug"),
      col_numeric("n")
    ),
    .spec_only = TRUE
  )

  # Collect ids from the whole tree
  collect <- function(col) {
    if (S7_inherits(col, ColumnGroup)) {
      c(col@id, unlist(lapply(col@columns, collect)))
    } else {
      col@id
    }
  }
  ids <- unlist(lapply(spec@columns, collect))
  # Every id is unique
  expect_equal(length(ids), length(unique(ids)))
  # The second drug / n got suffixed
  expect_true(any(grepl("^drug_\\d", ids)))
  expect_true(any(grepl("^n_\\d", ids)))
})

test_that("dedup handles repeated group headers", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), x = c(1, 2), y = c(3, 4)),
    label = "study",
    columns = list(
      col_group("Estimates", col_numeric("x")),
      col_group("Estimates", col_numeric("y"))
    ),
    .spec_only = TRUE
  )
  group_ids <- vapply(spec@columns[sapply(spec@columns, S7_inherits, ColumnGroup)],
                      function(g) g@id, character(1))
  expect_equal(length(unique(group_ids)), length(group_ids))
})

test_that("dedup keeps `extra_columns` in the same namespace as visible columns", {
  # Same field used visible + extra → the extra one gets `_2`.
  spec <- tabviz(
    data.frame(study = c("A", "B"), n = c(1, 2)),
    label = "study",
    columns = list(col_numeric("n")),
    extra_columns = list(col_bar("n")),
    .spec_only = TRUE
  )
  vis_ids   <- vapply(spec@columns, function(c) c@id, character(1))
  extra_ids <- vapply(spec@extra_columns, function(c) c@id, character(1))
  all_ids   <- c(vis_ids, extra_ids)
  expect_equal(length(unique(all_ids)), length(all_ids))
})

test_that("dedup is stable: first occurrence keeps the base id", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), n = c(1, 2)),
    label = "study",
    columns = list(
      col_numeric("n", "First"),
      col_numeric("n", "Second"),
      col_numeric("n", "Third")
    ),
    .spec_only = TRUE
  )
  headers_by_id <- setNames(
    vapply(spec@columns, function(c) c@header, character(1)),
    vapply(spec@columns, function(c) c@id, character(1))
  )
  # First occurrence keeps "n"
  expect_equal(headers_by_id[["n"]], "First")
  expect_equal(headers_by_id[["n_2"]], "Second")
  expect_equal(headers_by_id[["n_3"]], "Third")
})
