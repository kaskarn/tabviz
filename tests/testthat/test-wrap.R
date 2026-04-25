# Wrap schema (v0.22): col_text(wrap = ...) accepts FALSE/TRUE or
# non-negative integer (extra lines beyond the first).

test_that("col_text accepts wrap = TRUE", {
  col <- col_text("x", wrap = TRUE)
  expect_true(is.logical(col@wrap))
  expect_true(col@wrap)
})

test_that("col_text accepts wrap = FALSE (default)", {
  col <- col_text("x")
  # default may be FALSE or 0L; both encode "no wrap"
  expect_true(isFALSE(col@wrap) || identical(col@wrap, 0L))
})

test_that("col_text accepts wrap = integer", {
  col <- col_text("x", wrap = 2L)
  expect_equal(col@wrap, 2L)

  col3 <- col_text("x", wrap = 3)
  expect_equal(as.numeric(col3@wrap), 3)
})

test_that("col_text rejects negative wrap", {
  expect_error(col_text("x", wrap = -1), regexp = "wrap")
})

test_that("col_text rejects non-numeric, non-logical wrap", {
  expect_error(col_text("x", wrap = "yes"), regexp = "wrap")
})

test_that("serialized wrap is integer on the wire", {
  col_true  <- col_text("x", wrap = TRUE)
  col_false <- col_text("y", wrap = FALSE)
  col_two   <- col_text("z", wrap = 2L)

  s_true  <- serialize_column(col_true)
  s_false <- serialize_column(col_false)
  s_two   <- serialize_column(col_two)

  expect_true(is.integer(s_true$wrap))
  expect_equal(s_true$wrap, 1L)
  expect_equal(s_false$wrap, 0L)
  expect_equal(s_two$wrap, 2L)
})
