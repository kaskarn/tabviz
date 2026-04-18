# Tests for new column types: col_heatmap, col_progress, col_currency, col_date

test_that("col_heatmap creates valid ColumnSpec", {
  col <- col_heatmap("value")
  expect_equal(col@type, "heatmap")
  expect_equal(col@field, "value")
  expect_equal(col@options$heatmap$decimals, 2)
  expect_true(col@options$heatmap$showValue)
  expect_equal(col@options$heatmap$palette, c("#f7fbff", "#08306b"))
  expect_null(col@options$heatmap$minValue)
  expect_null(col@options$heatmap$maxValue)
})

test_that("col_heatmap accepts custom palette and range", {
  col <- col_heatmap("score",
    palette = c("#d73027", "#fee08b", "#1a9850"),
    min_value = 0, max_value = 100, decimals = 1, show_value = FALSE
  )
  expect_equal(col@options$heatmap$palette, c("#d73027", "#fee08b", "#1a9850"))
  expect_equal(col@options$heatmap$minValue, 0)
  expect_equal(col@options$heatmap$maxValue, 100)
  expect_equal(col@options$heatmap$decimals, 1)
  expect_false(col@options$heatmap$showValue)
})

test_that("col_heatmap validates arguments", {
  expect_error(col_heatmap("x", palette = "red"), "length")
  expect_error(col_heatmap("x", decimals = -1), ">=")
  expect_error(col_heatmap("x", show_value = "yes"), "flag")
})

test_that("col_progress creates valid ColumnSpec", {
  col <- col_progress("pct")
  expect_equal(col@type, "progress")
  expect_equal(col@field, "pct")
  expect_equal(col@options$progress$maxValue, 100)
  expect_null(col@options$progress$color)
  expect_true(col@options$progress$showLabel)
})

test_that("col_progress accepts custom options", {
  col <- col_progress("score", max_value = 10, color = "#22c55e", show_label = FALSE)
  expect_equal(col@options$progress$maxValue, 10)
  expect_equal(col@options$progress$color, "#22c55e")
  expect_false(col@options$progress$showLabel)
})

test_that("col_progress validates arguments", {
  expect_error(col_progress("x", max_value = -5), ">=")
  expect_error(col_progress("x", show_label = "no"), "flag")
})

test_that("col_currency creates valid ColumnSpec with numeric type", {
  col <- col_currency("price")
  expect_equal(col@type, "numeric")
  expect_equal(col@align, "right")
  expect_equal(col@options$numeric$decimals, 2)
  expect_equal(col@options$numeric$thousandsSep, ",")
  expect_equal(col@options$numeric$prefix, "$")
  expect_null(col@options$numeric$suffix)
})

test_that("col_currency supports suffix position", {
  col <- col_currency("amount", symbol = "\u20ac", position = "suffix")
  expect_null(col@options$numeric$prefix)
  expect_equal(col@options$numeric$suffix, "\u20ac")
})

test_that("col_currency validates arguments", {
  expect_error(col_currency("x", symbol = 123), "string")
  expect_error(col_currency("x", decimals = -1), ">=")
})

test_that("col_date creates valid ColumnSpec with text type", {
  col <- col_date("date")
  expect_equal(col@type, "text")
  expect_equal(col@field, "date")
  expect_equal(col@options$date$format, "%Y-%m-%d")
})

test_that("col_date accepts custom format", {
  col <- col_date("dt", format = "%b %d, %Y")
  expect_equal(col@options$date$format, "%b %d, %Y")
})

test_that("col_date validates format is string", {
  expect_error(col_date("x", format = 123), "string")
})

test_that("new column types work inside web_spec", {
  data <- data.frame(
    label = c("A", "B", "C"),
    value = c(10, 50, 90),
    price = c(100.5, 200.75, 300.25),
    dt = as.Date(c("2025-01-01", "2025-06-15", "2025-12-31")),
    score = c(0.2, 0.5, 0.8)
  )

  spec <- web_spec(
    data = data,
    label = "label",
    columns = list(
      col_heatmap("score", "Score"),
      col_progress("value", "Progress"),
      col_currency("price", "Price"),
      col_date("dt", "Date", format = "%b %Y")
    )
  )

  expect_true(inherits(spec, "tabviz::WebSpec"))
  # A primary "label" column is prepended automatically; user columns follow.
  expect_equal(length(spec@columns), 5)
  expect_equal(spec@columns[[1]]@type, "text")  # auto-prepended label
  expect_equal(spec@columns[[2]]@type, "heatmap")
  expect_equal(spec@columns[[3]]@type, "progress")
  expect_equal(spec@columns[[4]]@type, "numeric")
  expect_equal(spec@columns[[5]]@type, "text")
})

test_that("date formatting happens during serialization", {
  data <- data.frame(
    label = c("A", "B"),
    dt = as.Date(c("2025-01-15", "2025-12-31"))
  )

  spec <- web_spec(
    data = data,
    label = "label",
    columns = list(
      col_date("dt", format = "%b %d, %Y")
    )
  )

  serialized <- tabviz:::serialize_spec(spec)
  # Date values should be formatted as strings
  dt_values <- vapply(serialized$data$rows, function(r) r$metadata$dt, character(1))
  expect_equal(dt_values, c("Jan 15, 2025", "Dec 31, 2025"))
})
