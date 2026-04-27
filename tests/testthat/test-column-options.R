# Tests for new column options (Track 3):
#   - text/label max_chars
#   - bar/progress/heatmap scale
#   - stars domain + max_stars cap

test_that("col_text accepts max_chars and serializes to options$text$maxChars", {
  col <- col_text("name", max_chars = 12)
  expect_equal(col@options$text$maxChars, 12)
})

test_that("col_text without max_chars emits no text options", {
  col <- col_text("name")
  expect_null(col@options$text)
})

test_that("col_text validates max_chars >= 1", {
  expect_error(col_text("name", max_chars = 0), ">=")
  expect_error(col_text("name", max_chars = -3), ">=")
})

test_that("col_label accepts max_chars", {
  col <- col_label("study", max_chars = 20)
  expect_equal(col@options$text$maxChars, 20)
})

test_that("col_bar accepts scale and serializes to options$bar$scale", {
  col_lin <- col_bar("w")
  col_log <- col_bar("w", scale = "log")
  col_sqrt <- col_bar("w", scale = "sqrt")
  expect_equal(col_lin@options$bar$scale, "linear")
  expect_equal(col_log@options$bar$scale, "log")
  expect_equal(col_sqrt@options$bar$scale, "sqrt")
})

test_that("col_bar rejects unknown scale values", {
  expect_error(col_bar("w", scale = "power"))
})

test_that("col_progress accepts scale", {
  col <- col_progress("pct", scale = "sqrt")
  expect_equal(col@options$progress$scale, "sqrt")
})

test_that("col_heatmap accepts scale", {
  col <- col_heatmap("val", scale = "log")
  expect_equal(col@options$heatmap$scale, "log")
})

test_that("col_stars (alias over col_pictogram) caps max_stars at 20", {
  expect_error(col_stars("rating", max_stars = 25), "<=")
  expect_error(col_stars("rating", max_stars = 0), ">=")
  col <- col_stars("rating", max_stars = 20)
  expect_equal(col@type, "pictogram")
  expect_equal(col@options$pictogram$maxGlyphs, 20)
  expect_equal(col@options$pictogram$glyph, "star")
})

test_that("col_stars accepts min_value/max_value and serializes as numeric vector", {
  col <- col_stars("score", max_stars = 5, min_value = 0, max_value = 100)
  expect_equal(col@options$pictogram$domain, c(0, 100))
})

test_that("col_stars(domain=) is deprecated and forwards to min_value/max_value", {
  expect_warning(
    col <- col_stars("score", max_stars = 5, domain = c(0, 100)),
    "deprecated"
  )
  expect_equal(col@options$pictogram$domain, c(0, 100))
})

test_that("col_stars rejects malformed min_value/max_value", {
  expect_error(col_stars("score", max_stars = 5, min_value = 100, max_value = 0))
  expect_error(col_stars("score", min_value = 5))         # only one provided
  expect_error(col_stars("score", max_value = 5))         # only one provided
})

test_that("col_stars without remap has null domain", {
  col <- col_stars("rating")
  expect_null(col@options$pictogram$domain)
})

test_that("col_stars `size` defaults to 'base' and serializes", {
  col_b <- col_stars("rating")
  expect_equal(col_b@options$pictogram$size, "base")
  col_lg <- col_stars("rating", size = "lg")
  expect_equal(col_lg@options$pictogram$size, "lg")
})

test_that("new column options round-trip through web_spec", {
  data <- data.frame(
    label = c("A", "B", "C"),
    name = c("alpha test", "beta test", "gamma"),
    rating = c(20, 50, 80),
    w = c(1, 10, 100)
  )
  spec <- web_spec(
    data = data,
    label = "label",
    columns = list(
      col_text("name", max_chars = 8),
      col_stars("rating", max_stars = 5, min_value = 0, max_value = 100),
      col_bar("w", scale = "log")
    )
  )
  # Label column is auto-prepended; user columns follow.
  expect_equal(spec@columns[[2]]@options$text$maxChars, 8)
  expect_equal(spec@columns[[3]]@options$pictogram$domain, c(0, 100))
  expect_equal(spec@columns[[4]]@options$bar$scale, "log")
})

test_that("web_col(formatter=) replaces values and forces type to text", {
  data <- data.frame(label = c("a", "b"), val = c(1.234, 5.678))
  fmt <- function(x) sprintf("%.0f%%", x * 100)
  spec <- web_spec(
    data = data, label = "label",
    columns = list(web_col("val", formatter = fmt))
  )
  # The user column lands at index 2 (label auto-prepended at 1)
  expect_equal(spec@columns[[2]]@type, "text")
  payload <- tabviz:::serialize_spec(spec)
  vals <- vapply(payload$data$rows, function(r) r$metadata$val, character(1))
  expect_equal(vals, c("123%", "568%"))
})

test_that("formatter that returns wrong-length vector errors clearly", {
  data <- data.frame(label = c("a", "b"), val = c(1, 2))
  bad <- function(x) "single"
  spec <- web_spec(
    data = data, label = "label",
    columns = list(web_col("val", formatter = bad))
  )
  expect_error(tabviz:::serialize_spec(spec), "expected 2")
})

test_that("web_col(tooltip=) populates per-cell tooltip in cellStyles", {
  data <- data.frame(
    label = c("a", "b"),
    val = c("x", "y"),
    note = c("First detail", "Second detail")
  )
  spec <- web_spec(
    data = data, label = "label",
    columns = list(web_col("val", tooltip = "note"))
  )
  payload <- tabviz:::serialize_spec(spec)
  expect_equal(payload$data$rows[[1]]$cellStyles$val$tooltip, "First detail")
  expect_equal(payload$data$rows[[2]]$cellStyles$val$tooltip, "Second detail")
})
