# Tests for NSE (Non-Standard Evaluation) styling expressions

library(webforest)

# =============================================================================
# Row-level NSE styling tests
# =============================================================================

test_that("row_bold accepts formula expression", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study", row_bold = ~ pval < 0.05)

  # Check that a computed column was created
  expect_true(grepl("^.wf_computed_row_bold_", spec@row_bold_col))
  expect_true(spec@row_bold_col %in% names(spec@data))

  # Check the computed values
  expect_equal(spec@data[[spec@row_bold_col]], c(TRUE, FALSE, FALSE))
})

test_that("row_emphasis accepts formula expression", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study", row_emphasis = ~ pval < 0.05)

  expect_true(grepl("^.wf_computed_row_emphasis_", spec@row_emphasis_col))
  expect_equal(spec@data[[spec@row_emphasis_col]], c(TRUE, FALSE, FALSE))
})

test_that("row_color accepts formula returning color strings", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    significant = c(TRUE, FALSE, FALSE)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   row_color = ~ ifelse(significant, "green", "gray"))

  expect_true(grepl("^.wf_computed_row_color_", spec@row_color_col))
  expect_equal(spec@data[[spec@row_color_col]], c("green", "gray", "gray"))
})

test_that("row styling still accepts column names (backwards compatibility)", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    is_sig = c(TRUE, FALSE, FALSE)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study", row_bold = "is_sig")

  # Column name is preserved, not computed
  expect_equal(spec@row_bold_col, "is_sig")
})

test_that("row styling formula can reference multiple columns", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3),
    effect_size = c(0.3, 0.1, 0.05)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   row_emphasis = ~ pval < 0.05 & effect_size > 0.2)

  expect_equal(spec@data[[spec@row_emphasis_col]], c(TRUE, FALSE, FALSE))
})

test_that("invalid formula in row styling produces error", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10)
  )

  expect_error(
    web_spec(df, point = "hr", lower = "lower", upper = "upper",
             label = "study", row_bold = ~ nonexistent_column < 0.05),
    "nonexistent_column"
  )
})

test_that("row styling validates missing column name", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10)
  )

  expect_error(
    web_spec(df, point = "hr", lower = "lower", upper = "upper",
             label = "study", row_bold = "nonexistent"),
    "nonexistent"
  )
})

# =============================================================================
# Cell-level NSE styling tests
# =============================================================================

test_that("cell-level bold accepts formula with .x", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   columns = list(
                     col_pvalue("pval", bold = ~ .x < 0.05)
                   ))

  col1 <- spec@columns[[1]]
  expect_true(grepl("^.wf_computed_pval_bold_", col1@style_bold))
  expect_true(col1@style_bold %in% names(spec@data))
  expect_equal(spec@data[[col1@style_bold]], c(TRUE, FALSE, FALSE))
})

test_that("cell-level color accepts formula with .x", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   columns = list(
                     col_pvalue("pval", color = ~ ifelse(.x < 0.05, "green", "gray"))
                   ))

  col1 <- spec@columns[[1]]
  expect_true(grepl("^.wf_computed_pval_color_", col1@style_color))
  expect_equal(spec@data[[col1@style_color]], c("green", "gray", "gray"))
})

test_that("cell-level formula can reference other columns via data", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3),
    is_key = c(TRUE, FALSE, FALSE)
  )

  # Using another column in the formula (not .x)
  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   columns = list(
                     col_pvalue("pval", emphasis = ~ is_key)
                   ))

  col1 <- spec@columns[[1]]
  expect_equal(spec@data[[col1@style_emphasis]], c(TRUE, FALSE, FALSE))
})

test_that("cell-level styling still accepts column names (backwards compatibility)", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3),
    is_bold = c(TRUE, FALSE, FALSE)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   columns = list(
                     col_pvalue("pval", bold = "is_bold")
                   ))

  col1 <- spec@columns[[1]]
  # Column name is preserved, not computed
  expect_equal(col1@style_bold, "is_bold")
})

test_that("cell-level formula validates missing field", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  # Using .x on a column that doesn't exist in data
  # (The col_text references "missing_field" which doesn't exist)
  expect_error(
    web_spec(df, point = "hr", lower = "lower", upper = "upper",
             label = "study",
             columns = list(
               col_text("missing_field", bold = ~ .x > 0)
             )),
    "missing_field"
  )
})

test_that("multiple column styles can use formulas independently", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   columns = list(
                     col_pvalue("pval",
                       bold = ~ .x < 0.05,
                       color = ~ ifelse(.x < 0.1, "blue", "black"),
                       emphasis = ~ .x <= 0.01  # Note: <= not <, since 0.01 == 0.01
                     )
                   ))

  col1 <- spec@columns[[1]]

  # All three style columns should be created
  expect_true(grepl("^.wf_computed_", col1@style_bold))
  expect_true(grepl("^.wf_computed_", col1@style_color))
  expect_true(grepl("^.wf_computed_", col1@style_emphasis))

  # Check values
  expect_equal(spec@data[[col1@style_bold]], c(TRUE, FALSE, FALSE))
  expect_equal(spec@data[[col1@style_color]], c("blue", "black", "black"))
  expect_equal(spec@data[[col1@style_emphasis]], c(TRUE, FALSE, FALSE))
})

# =============================================================================
# Combined row and cell NSE tests
# =============================================================================

test_that("row and cell level NSE can be used together", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   row_emphasis = ~ hr < 0.8,
                   columns = list(
                     col_pvalue("pval", bold = ~ .x < 0.05)
                   ))

  # Row-level
  expect_equal(spec@data[[spec@row_emphasis_col]], c(TRUE, FALSE, FALSE))

  # Cell-level
  col1 <- spec@columns[[1]]
  expect_equal(spec@data[[col1@style_bold]], c(TRUE, FALSE, FALSE))
})

# =============================================================================
# Column groups with NSE
# =============================================================================

test_that("NSE works for columns inside ColumnGroups", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, 0.1, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study",
                   columns = list(
                     col_group("Results",
                       col_pvalue("pval", bold = ~ .x < 0.05)
                     )
                   ))

  # Access the column inside the group
  group1 <- spec@columns[[1]]
  expect_true(inherits(group1, "webforest::ColumnGroup"))

  col1 <- group1@columns[[1]]
  expect_true(grepl("^.wf_computed_", col1@style_bold))
  expect_equal(spec@data[[col1@style_bold]], c(TRUE, FALSE, FALSE))
})

# =============================================================================
# Edge cases
# =============================================================================

test_that("NULL styling values are handled correctly", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10)
  )

  # No styling specified
  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study")

  expect_true(is.na(spec@row_bold_col))
  expect_true(is.na(spec@row_emphasis_col))
})

test_that("formula returning length-1 value is recycled", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10)
  )

  # Formula returns a single value (all rows should be bold)
  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study", row_bold = ~ TRUE)

  expect_equal(spec@data[[spec@row_bold_col]], c(TRUE, TRUE, TRUE))
})

test_that("formula with NA values works correctly", {
  df <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.72, 0.85, 0.91),
    lower = c(0.55, 0.70, 0.75),
    upper = c(0.95, 1.03, 1.10),
    pval = c(0.01, NA, 0.3)
  )

  spec <- web_spec(df, point = "hr", lower = "lower", upper = "upper",
                   label = "study", row_bold = ~ pval < 0.05)

  # NA comparison produces NA
  expect_equal(spec@data[[spec@row_bold_col]], c(TRUE, NA, FALSE))
})
