test_that("col_ring defaults: 0..1 range, percent label, no thresholds", {
  col <- col_ring("frac")
  expect_equal(col@type, "ring")
  expect_equal(col@options$ring$minValue, 0)
  expect_equal(col@options$ring$maxValue, 1)
  expect_equal(col@options$ring$labelFormat, "percent")
  expect_equal(col@options$ring$showLabel, TRUE)
  expect_null(col@options$ring$thresholds)
  expect_null(col@options$ring$color)
})

test_that("col_ring single color serializes (wrapped in I() for jsonlite)", {
  col <- col_ring("v", color = "#d4a955")
  expect_equal(unclass(col@options$ring$color), "#d4a955")
})

test_that("col_ring threshold + matching colors serialize", {
  col <- col_ring("v",
                  color = c("#22c55e", "#f59e0b", "#ef4444"),
                  thresholds = c(0.33, 0.66))
  expect_equal(unclass(col@options$ring$thresholds), c(0.33, 0.66))
  expect_equal(unclass(col@options$ring$color),
               c("#22c55e", "#f59e0b", "#ef4444"))
})

test_that("col_ring rejects mismatched color and thresholds lengths", {
  expect_error(
    col_ring("v", color = c("#a", "#b"), thresholds = c(0.5, 0.8)),
    "color.*length"
  )
})

test_that("col_ring requires explicit color when 3+ thresholds", {
  expect_error(
    col_ring("v", thresholds = c(0.2, 0.5, 0.8)),
    "explicit.*color"
  )
  # With explicit color it works.
  col <- col_ring("v",
                  color = c("#a", "#b", "#c", "#d"),
                  thresholds = c(0.2, 0.5, 0.8))
  expect_length(col@options$ring$color, 4)
})

test_that("col_ring 1 and 2 thresholds work without explicit color (auto-defaults)", {
  col1 <- col_ring("v", thresholds = 0.5)
  expect_null(col1@options$ring$color)
  col2 <- col_ring("v", thresholds = c(0.33, 0.66))
  expect_null(col2@options$ring$color)
})

test_that("col_ring rejects max_value < min_value", {
  expect_error(col_ring("v", min_value = 100, max_value = 0))
})

test_that("col_ring label_format choices validated", {
  for (lf in c("percent", "decimal", "integer")) {
    col <- col_ring("v", label_format = lf)
    expect_equal(col@options$ring$labelFormat, lf)
  }
  expect_error(col_ring("v", label_format = "scientific"))
})

test_that("col_ring size defaults and validates", {
  expect_equal(col_ring("v")@options$ring$size, "base")
  expect_equal(col_ring("v", size = "lg")@options$ring$size, "lg")
  expect_error(col_ring("v", size = "xl"))
})

test_that("col_ring round-trips through web_spec", {
  data <- data.frame(label = c("A", "B"), risk = c(0.2, 0.8))
  spec <- web_spec(
    data = data, label = "label",
    columns = list(col_ring("risk", thresholds = c(0.33, 0.66)))
  )
  expect_equal(spec@columns[[2]]@type, "ring")
  expect_equal(unclass(spec@columns[[2]]@options$ring$thresholds), c(0.33, 0.66))
})
