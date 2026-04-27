test_that("col_pictogram count mode: max_glyphs NULL, no domain remap", {
  col <- col_pictogram("count", glyph = "person")
  expect_equal(col@type, "pictogram")
  expect_equal(col@options$pictogram$glyph, "person")
  expect_null(col@options$pictogram$maxGlyphs)
  expect_null(col@options$pictogram$domain)
  expect_equal(col@options$pictogram$layout, "row")
})

test_that("col_pictogram rating mode requires both min_value and max_value", {
  expect_error(col_pictogram("v", glyph = "skull", max_glyphs = 5,
                             min_value = 0))
  expect_error(col_pictogram("v", glyph = "skull", max_glyphs = 5,
                             max_value = 100))
  col <- col_pictogram("v", glyph = "skull", max_glyphs = 5,
                       min_value = 0, max_value = 100)
  expect_equal(col@options$pictogram$domain, c(0, 100))
})

test_that("col_pictogram rejects min/max without max_glyphs", {
  expect_error(
    col_pictogram("v", glyph = "skull", min_value = 0, max_value = 100),
    "rating mode"
  )
})

test_that("col_pictogram glyph mapping requires glyph_field", {
  expect_error(
    col_pictogram("v", glyph = c("a" = "leaf", "b" = "flame")),
    "glyph_field"
  )
  col <- col_pictogram("v", glyph = c("a" = "leaf", "b" = "flame"),
                       glyph_field = "category")
  expect_equal(col@options$pictogram$glyph, list(a = "leaf", b = "flame"))
  expect_equal(col@options$pictogram$glyphField, "category")
})

test_that("col_pictogram value_label accepts FALSE/TRUE/leading/trailing", {
  for (val in list(FALSE, TRUE, "leading", "trailing")) {
    col <- col_pictogram("v", glyph = "person", value_label = val)
    expect_equal(col@options$pictogram$valueLabel, val)
  }
  expect_error(col_pictogram("v", glyph = "person", value_label = "middle"))
})

test_that("col_pictogram size and layout defaults serialize", {
  col <- col_pictogram("v", glyph = "coin")
  expect_equal(col@options$pictogram$size, "base")
  expect_equal(col@options$pictogram$layout, "row")
  col_lg <- col_pictogram("v", glyph = "coin", size = "lg", layout = "stack")
  expect_equal(col_lg@options$pictogram$size, "lg")
  expect_equal(col_lg@options$pictogram$layout, "stack")
})

test_that("col_pictogram passes through theme-aware defaults (NULL colors)", {
  col <- col_pictogram("v", glyph = "person")
  expect_null(col@options$pictogram$color)
  expect_null(col@options$pictogram$emptyColor)
})

test_that("col_pictogram cap on max_glyphs (1..50)", {
  expect_error(col_pictogram("v", glyph = "person", max_glyphs = 0), ">=")
  expect_error(col_pictogram("v", glyph = "person", max_glyphs = 100), "<=")
  col <- col_pictogram("v", glyph = "person", max_glyphs = 50)
  expect_equal(col@options$pictogram$maxGlyphs, 50)
})

test_that("glyph_registry_names is non-empty and contains key glyphs", {
  names_v <- glyph_registry_names()
  expect_type(names_v, "character")
  expect_gt(length(names_v), 0)
  for (g in c("person", "skull", "dot", "coin", "star")) {
    expect_true(g %in% names_v)
  }
})
