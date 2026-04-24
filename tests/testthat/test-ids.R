# Column ID integrity — default scheme, sentinel guards, collision errors.
#
# v0.21 changed the default auto-id from `<field>` to `<type>_<field>` so two
# columns of different types on the same field never collide by default, and
# a remaining collision (same type + same field) is an explicit author error
# that `id = ...` resolves.

library(testthat)

# ---------------------------------------------------------------------
# Default id scheme: <type>_<field>
# ---------------------------------------------------------------------

test_that("col_text default id is `text_<field>`", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), drug = c("x", "y")),
    label = "study",
    columns = list(col_text("drug")),
    .spec_only = TRUE
  )
  # Index 1 is the internal label column (id = "label").
  expect_equal(spec@columns[[2]]@id, "text_drug")
})

test_that("col_numeric / col_bar on same field get distinct ids", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), n = c(10, 20)),
    label = "study",
    columns = list(col_numeric("n"), col_bar("n")),
    .spec_only = TRUE
  )
  ids <- vapply(spec@columns, function(c) c@id, character(1))
  expect_true("numeric_n" %in% ids)
  expect_true("bar_n" %in% ids)
})

test_that("label column keeps its special id `label`", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), x = c(1, 2)),
    label = "study",
    columns = list(col_numeric("x")),
    .spec_only = TRUE
  )
  expect_equal(spec@columns[[1]]@id, "label")
})

test_that("viz_forest default id strips the synthetic `_forest_` prefix", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), hr = c(0.8, 1.1), lo = c(0.5, 0.9), hi = c(1.2, 1.4)),
    label = "study",
    columns = list(viz_forest(point = "hr", lower = "lo", upper = "hi")),
    .spec_only = TRUE
  )
  forest_ids <- vapply(spec@columns, function(c) c@id, character(1))
  expect_true("forest_hr" %in% forest_ids)
})

# ---------------------------------------------------------------------
# Explicit id= override
# ---------------------------------------------------------------------

test_that("explicit id= wins over the default scheme", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), n = c(1, 2)),
    label = "study",
    columns = list(col_numeric("n", id = "custom_n")),
    .spec_only = TRUE
  )
  ids <- vapply(spec@columns, function(c) c@id, character(1))
  expect_true("custom_n" %in% ids)
  expect_false("numeric_n" %in% ids)
})

# ---------------------------------------------------------------------
# Collision errors
# ---------------------------------------------------------------------

test_that("two same-type same-field columns error at construction", {
  expect_error(
    tabviz(
      data.frame(study = c("A", "B"), n = c(1, 2)),
      label = "study",
      columns = list(col_numeric("n"), col_numeric("n")),
      .spec_only = TRUE
    ),
    "Duplicate column id"
  )
})

test_that("explicit id= resolves an otherwise-colliding pair", {
  spec <- tabviz(
    data.frame(study = c("A", "B"), n = c(1, 2)),
    label = "study",
    columns = list(col_numeric("n"), col_numeric("n", id = "numeric_n_alt")),
    .spec_only = TRUE
  )
  ids <- vapply(spec@columns, function(c) c@id, character(1))
  expect_true(all(c("numeric_n", "numeric_n_alt") %in% ids))
})

test_that("duplicate group headers error without explicit disambiguation", {
  expect_error(
    tabviz(
      data.frame(study = c("A", "B"), x = c(1, 2), y = c(3, 4)),
      label = "study",
      columns = list(
        col_group("Estimates", col_numeric("x")),
        col_group("Estimates", col_numeric("y"))
      ),
      .spec_only = TRUE
    ),
    "Duplicate column id"
  )
})

test_that("extra_columns share the id namespace with visible columns", {
  expect_error(
    tabviz(
      data.frame(study = c("A", "B"), n = c(1, 2)),
      label = "study",
      columns = list(col_numeric("n")),
      extra_columns = list(col_numeric("n")),  # same id `numeric_n`
      .spec_only = TRUE
    ),
    "Duplicate column id"
  )
})

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
  expect_silent(ColumnSpec(id = "__row_number__", header = "X", field = "x"))
  expect_silent(ColumnSpec(id = "__custom__", header = "X", field = "x"))
})

test_that("ColumnGroup rejects reserved ids", {
  expect_error(
    ColumnGroup(id = "__root__", header = "G", columns = list()),
    "reserved"
  )
})

# ---------------------------------------------------------------------
# default_column_id helper
# ---------------------------------------------------------------------

test_that("default_column_id concatenates type and field", {
  expect_equal(tabviz:::default_column_id("text", "drug"), "text_drug")
  expect_equal(tabviz:::default_column_id("numeric", "n_patients"), "numeric_n_patients")
})

test_that("default_column_id strips synthetic `_<type>_` prefix", {
  expect_equal(tabviz:::default_column_id("forest", "_forest_hr"), "forest_hr")
  expect_equal(tabviz:::default_column_id("interval", "_interval_hr"), "interval_hr")
})

test_that("default_column_id falls back to type when field is empty", {
  expect_equal(tabviz:::default_column_id("forest", ""), "forest")
  expect_equal(tabviz:::default_column_id("forest", NA_character_), "forest")
  expect_equal(tabviz:::default_column_id("forest", NULL), "forest")
})
