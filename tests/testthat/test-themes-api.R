test_that("web_theme builds from inputs", {
  t <- web_theme(
    name = "navy",
    inputs = list(
      brand = "#1F3A5F",
      accent = "#B08938",
      series_anchors = c("#1F3A5F", "#B08938", "#6B8E7F")
    ),
    variants = list(density = "comfortable", header_style = "bold")
  )
  expect_true(inherits(t, "tabviz::WebTheme"))
  expect_equal(t@name, "navy")
  expect_equal(toupper(t@inputs@brand), "#1F3A5F")
  expect_equal(t@variants@header_style, "bold")
  expect_length(t@series, 3L)
  # Resolved.
  expect_match(t@surface@base, "^#")
  expect_match(t@series[[1]]@stroke, "^#")
})

test_that("web_theme inherits from base_theme", {
  t <- web_theme(
    name = "lancet-italic-tweak",
    base_theme = web_theme_lancet(),
    variants = list(density = "compact")
  )
  expect_equal(toupper(t@inputs@brand), "#00407A")
  expect_equal(t@variants@density, "compact")
})

test_that("web_theme rejects unknown property names", {
  expect_error(
    web_theme(inputs = list(zonk = "#000")),
    "Unknown property"
  )
})

test_that("set_inputs updates Tier 1 fields and re-resolves", {
  t <- web_theme_default()
  t2 <- set_inputs(t, brand = "#FF0000", accent = "#00FF00")
  expect_equal(toupper(t2@inputs@brand), "#FF0000")
  expect_equal(toupper(t2@inputs@accent), "#00FF00")
  # Brand_deep is the darkened-brand mirror (not a literal copy).
  expect_match(t2@inputs@brand_deep, "^#[0-9A-Fa-f]{6}$")
  expect_false(identical(toupper(t2@inputs@brand_deep), "#FF0000"))
  # Series rebuilt.
  expect_match(t2@series[[1]]@fill, "^#")
})

test_that("set_inputs preserves explicit overrides through re-resolution", {
  t <- web_theme_default()
  t@row@hover@bg <- "#123456"  # explicit Tier 3 override
  t2 <- set_inputs(t, brand = "#FF0000")
  expect_equal(toupper(t2@row@hover@bg), "#123456")  # survives
})

test_that("set_variants flips density and header_style", {
  t <- web_theme_default()
  t2 <- set_variants(t, density = "spacious", header_style = "bold")
  expect_equal(t2@variants@density, "spacious")
  expect_equal(t2@variants@header_style, "bold")
  expect_gt(t2@spacing@row_height, t@spacing@row_height)  # density-driven
})

test_that("set_variants validates option set", {
  t <- web_theme_default()
  expect_error(set_variants(t, density = "ginormous"))
  expect_error(set_variants(t, header_style = "outlined"))
  expect_error(set_variants(t, first_column_style = "italic"))
})

test_that("set_theme_field walks character paths", {
  t <- web_theme_default()
  t2 <- set_theme_field(t, c("row_group", "L1", "bg"), "#EEEEEE")
  expect_equal(toupper(t2@row_group@L1@bg), "#EEEEEE")
})

test_that("set_theme_field accepts integer index for series list", {
  t <- web_theme_default()
  t2 <- set_theme_field(t, list("series", 2L, "fill"), "#FF00FF")
  expect_equal(toupper(t2@series[[2]]@fill), "#FF00FF")
})

test_that("set_theme_field updates Tier 1 input fields", {
  t <- web_theme_default()
  t2 <- set_theme_field(t, c("inputs", "brand"), "#FF0000")
  expect_equal(toupper(t2@inputs@brand), "#FF0000")
  # And the Tier 2/3 cascade rebuilds.
  expect_match(t2@series[[1]]@fill, "^#")
})

test_that("set_theme_field rejects empty path", {
  expect_error(set_theme_field(web_theme_default(), character(), "x"),
               "at least one element")
})

test_that("set_spacing overrides one token, density preset fills rest", {
  t <- web_theme_default()
  t2 <- set_spacing(t, row_height = 99)
  expect_equal(t2@spacing@row_height, 99)
  expect_equal(t2@spacing@header_height, t@spacing@header_height)
})

test_that("modifiers reject non-theme inputs", {
  expect_error(set_inputs(list(),    brand = "#000"),       "WebTheme")
  expect_error(set_variants(list(),  density = "compact"),  "WebTheme")
  expect_error(set_theme_field(list(), c("inputs", "brand"), "#000"), "WebTheme")
  expect_error(set_spacing(list(),   row_height = 24),      "WebTheme")
})

test_that("v2 modifiers chain via piping", {
  t <- web_theme_default() |>
    set_inputs(brand = "#1F3A5F") |>
    set_variants(density = "spacious") |>
    set_spacing(row_height = 28)
  expect_equal(toupper(t@inputs@brand), "#1F3A5F")
  expect_equal(t@variants@density, "spacious")
  expect_equal(t@spacing@row_height, 28)
})
