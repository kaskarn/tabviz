# D12 (decided 2026-06-11): the default-paginate threshold — scale
# posture, roadmap area L. NULL past 200 rows auto-paginates (200/page,
# break on group); paginate = FALSE is the opt-out; explicit specs and
# small tables are untouched.

.mk <- function(n, ...) {
  df <- data.frame(x = as.character(seq_len(n)), v = seq_len(n))
  suppressMessages(tabviz(df, ...,
    columns = list(col_text("x", "X"), col_numeric("v", "V")),
    .spec_only = TRUE))
}

test_that("NULL past the threshold auto-paginates at 200/group", {
  s <- .mk(201)
  expect_false(is.null(s@paginate))
  expect_identical(s@paginate@rows, 200L)
  expect_identical(s@paginate@break_on, "group")
})

test_that("at or under the threshold stays unpaginated", {
  expect_null(.mk(200)@paginate)
  expect_null(.mk(50)@paginate)
})

test_that("paginate = FALSE opts out past the threshold", {
  expect_null(.mk(500, paginate = FALSE)@paginate)
})

test_that("explicit specs are never overridden", {
  s <- .mk(500, paginate = paginate_spec(rows = 40L))
  expect_identical(s@paginate@rows, 40L)
  s2 <- .mk(500, paginate = 75)
  expect_identical(s2@paginate@rows, 75L)
})
