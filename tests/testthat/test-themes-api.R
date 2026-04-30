test_that("web_theme builds from inputs", {
  t <- web_theme(
    name = "navy",
    inputs = list(
      primary = "#1F3A5F",
      accent = "#B08938",
      series_anchors = c("#1F3A5F", "#B08938", "#6B8E7F")
    ),
    variants = list(density = "comfortable", header_style = "bold")
  )
  expect_true(inherits(t, "tabviz::WebTheme"))
  expect_equal(t@name, "navy")
  expect_equal(toupper(t@inputs@primary), "#1F3A5F")
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
  expect_equal(toupper(t@inputs@primary), "#00407A")
  expect_equal(t@variants@density, "compact")
})

test_that("web_theme(inputs=...) propagates input changes through derived chrome", {
  # Two-tier: changing primary AND secondary should cascade into header.bold.bg
  # (primary_deep) AND column_group.bold.bg (secondary_deep), even though the
  # base theme had those fields already resolved to its own primary_deep.
  # .validate=FALSE because the synthetic R/G primary/secondary fail the
  # bold-band contrast invariant — this test is about cascade propagation.
  t <- web_theme(
    base_theme = web_theme_cochrane(),
    inputs = list(primary = "#FF0000", secondary = "#00FF00"),
    .validate = FALSE
  )
  expect_equal(toupper(t@inputs@primary),   "#FF0000")
  expect_equal(toupper(t@inputs@secondary), "#00FF00")
  # header.bold.bg derives from primary_deep — must reflect new primary, not
  # base's resolved primary_deep.
  expect_equal(t@header@bold@bg, t@inputs@primary_deep)
  # column_group.bold.bg derives from secondary_deep — must reflect new
  # secondary, not the base's resolved value.
  expect_equal(t@column_group@bold@bg, t@inputs@secondary_deep)
  expect_false(identical(t@header@bold@bg, t@column_group@bold@bg))
})

test_that("web_theme rejects unknown property names", {
  expect_error(
    web_theme(inputs = list(zonk = "#000")),
    "Unknown property"
  )
})

test_that("set_inputs updates Tier 1 fields and re-resolves", {
  t <- web_theme_cochrane()
  t2 <- set_inputs(t, primary = "#FF0000", accent = "#00FF00")
  expect_equal(toupper(t2@inputs@primary), "#FF0000")
  expect_equal(toupper(t2@inputs@accent), "#00FF00")
  # primary_deep is the darkened-primary mirror (not a literal copy).
  expect_match(t2@inputs@primary_deep, "^#[0-9A-Fa-f]{6}$")
  expect_false(identical(toupper(t2@inputs@primary_deep), "#FF0000"))
  # Series rebuilt.
  expect_match(t2@series[[1]]@fill, "^#")
})

test_that("set_inputs preserves explicit overrides through re-resolution", {
  t <- web_theme_cochrane()
  t@row@hover@bg <- "#123456"  # explicit Tier 3 override
  t2 <- set_inputs(t, primary = "#FF0000")
  expect_equal(toupper(t2@row@hover@bg), "#123456")  # survives
})

test_that("set_variants flips density and header_style", {
  t <- web_theme_cochrane()
  t2 <- set_variants(t, density = "spacious", header_style = "bold")
  expect_equal(t2@variants@density, "spacious")
  expect_equal(t2@variants@header_style, "bold")
  expect_gt(t2@spacing@row_height, t@spacing@row_height)  # density-driven
})

test_that("set_variants validates option set", {
  t <- web_theme_cochrane()
  expect_error(set_variants(t, density = "ginormous"))
  expect_error(set_variants(t, header_style = "outlined"))
  expect_error(set_variants(t, first_column_style = "italic"))
})

test_that("set_theme_field walks character paths", {
  t <- web_theme_cochrane()
  t2 <- set_theme_field(t, c("row_group", "L1", "bg"), "#EEEEEE")
  expect_equal(toupper(t2@row_group@L1@bg), "#EEEEEE")
})

test_that("set_theme_field accepts integer index for series list", {
  t <- web_theme_cochrane()
  t2 <- set_theme_field(t, list("series", 2L, "fill"), "#FF00FF")
  expect_equal(toupper(t2@series[[2]]@fill), "#FF00FF")
})

test_that("set_theme_field updates Tier 1 input fields", {
  t <- web_theme_cochrane()
  t2 <- set_theme_field(t, c("inputs", "primary"), "#FF0000")
  expect_equal(toupper(t2@inputs@primary), "#FF0000")
  # And the Tier 2/3 cascade rebuilds.
  expect_match(t2@series[[1]]@fill, "^#")
})

test_that("set_theme_field rejects empty path", {
  expect_error(set_theme_field(web_theme_cochrane(), character(), "x"),
               "at least one element")
})

test_that("set_spacing overrides one token, density preset fills rest", {
  t <- web_theme_cochrane()
  t2 <- set_spacing(t, row_height = 99)
  expect_equal(t2@spacing@row_height, 99)
  expect_equal(t2@spacing@header_height, t@spacing@header_height)
})

test_that("modifiers reject non-theme inputs", {
  expect_error(set_inputs(list(),    primary = "#000"),       "WebTheme")
  expect_error(set_variants(list(),  density = "compact"),  "WebTheme")
  expect_error(set_theme_field(list(), c("inputs", "primary"), "#000"), "WebTheme")
  expect_error(set_spacing(list(),   row_height = 24),      "WebTheme")
})

test_that("v2 modifiers chain via piping", {
  t <- web_theme_cochrane() |>
    set_inputs(primary = "#1F3A5F") |>
    set_variants(density = "spacious") |>
    set_spacing(row_height = 28)
  expect_equal(toupper(t@inputs@primary), "#1F3A5F")
  expect_equal(t@variants@density, "spacious")
  expect_equal(t@spacing@row_height, 28)
})
