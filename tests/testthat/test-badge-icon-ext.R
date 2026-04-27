# Tests for col_badge shape/outline/thresholds extensions and
# col_icon size = "xl" variant (Phase 4).

test_that("col_badge default shape is pill", {
  col <- col_badge("status")
  expect_equal(col@options$badge$shape, "pill")
  expect_equal(col@options$badge$outline, FALSE)
})

test_that("col_badge accepts circle and square shapes", {
  for (s in c("pill", "circle", "square")) {
    col <- col_badge("status", shape = s)
    expect_equal(col@options$badge$shape, s)
  }
  expect_error(col_badge("status", shape = "diamond"))
})

test_that("col_badge outline serializes", {
  col <- col_badge("status", outline = TRUE)
  expect_true(col@options$badge$outline)
})

test_that("col_badge thresholds + colors round-trip", {
  col <- col_badge("risk",
                   thresholds = c(1, 3, 5),
                   colors = c("#22c55e", "#f59e0b", "#ef4444", "#7e22ce"))
  expect_equal(unclass(col@options$badge$thresholds), c(1, 3, 5))
  expect_equal(unclass(col@options$badge$colors),
               c("#22c55e", "#f59e0b", "#ef4444", "#7e22ce"))
})

test_that("col_badge thresholds without colors works for 1 or 2 breakpoints", {
  col1 <- col_badge("risk", thresholds = 5, shape = "circle")
  expect_equal(col1@options$badge$shape, "circle")
  expect_null(col1@options$badge$colors)

  col2 <- col_badge("risk", thresholds = c(2, 5))
  expect_null(col2@options$badge$colors)
})

test_that("col_badge thresholds with 3+ breakpoints requires colors", {
  expect_error(
    col_badge("risk", thresholds = c(1, 3, 5, 7)),
    "explicit"
  )
})

test_that("col_badge thresholds and variants are mutually exclusive", {
  expect_error(
    col_badge("status",
              thresholds = 5,
              variants = c("low" = "success", "high" = "error")),
    "mutually exclusive"
  )
})

test_that("col_badge mismatched colors+thresholds length errors", {
  expect_error(
    col_badge("risk",
              thresholds = c(2, 5),
              colors = c("#a", "#b")),  # need 3
    "length"
  )
})

test_that("col_badge mapping path (named colors) still works alongside variants", {
  # categorical mapping path — unchanged behavior
  col <- col_badge("status",
                   colors = c("draft" = "#888", "published" = "#0a0"))
  # named map → list serialization
  expect_type(col@options$badge$colors, "list")
  expect_equal(col@options$badge$colors$draft, "#888")
})

test_that("col_icon accepts xl size", {
  col <- col_icon("emoji", size = "xl")
  expect_equal(col@options$icon$size, "xl")
})

test_that("col_icon rejects unknown sizes", {
  expect_error(col_icon("emoji", size = "huge"))
})
