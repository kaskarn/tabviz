# Zero-config first run (roadmap area I, 2026-06-11): tabviz(df) with no
# columns infers col_* choices. Conservative heuristics, locked here;
# explicit columns always win.

.spec <- function(df, ...) suppressMessages(tabviz(df, ..., .spec_only = TRUE))
.buckets <- function(s) vapply(s@columns, function(c) {
  b <- names(c@options)
  if (length(b) > 0L && nzchar(b[1])) b[1] else c@type
}, "")

test_that("tabviz(df) infers columns instead of rendering empty", {
  df <- data.frame(study = c("A", "B"), n_events = c(10L, 20L),
                   event_rate = c(0.4, 0.6), p_value = c(0.03, 0.2),
                   visit = as.Date(c("2024-01-01", "2024-02-01")))
  s <- .spec(df, label = "study")
  expect_length(s@columns, 4)
  expect_identical(.buckets(s), c("numeric", "percent", "pvalue", "date"))
})

test_that("headers Title Case the field names", {
  s <- .spec(data.frame(x = "a", event_rate = 0.5), label = "x")
  expect_identical(s@columns[[1]]@header, "Event Rate")
})

test_that("count-named integral columns get zero decimals", {
  s <- .spec(data.frame(x = "a", n = 3L), label = "x")
  expect_identical(s@columns[[1]]@options$numeric$decimals, 0L)
})

test_that("p-name without p-range values stays numeric", {
  s <- .spec(data.frame(x = "a", p_value = 12.5), label = "x")
  expect_identical(.buckets(s), "numeric")
})

test_that("characters/factors/logicals fall back to text", {
  s <- .spec(data.frame(x = "a", arm = factor("ctrl"), ok = TRUE), label = "x")
  expect_identical(.buckets(s), c("text", "text"))
})

test_that("explicit columns are never overridden", {
  s <- .spec(data.frame(x = "a", n = 1L), label = "x",
             columns = list(col_text("n", "As Text")))
  expect_length(s@columns, 1)
  expect_identical(.buckets(s), "text")
})

test_that("group fields are excluded from inference", {
  s <- .spec(data.frame(x = "a", g = "G1", v = 1), label = "x", group = "g")
  expect_identical(vapply(s@columns, function(c) c@field, ""), "v")
})
