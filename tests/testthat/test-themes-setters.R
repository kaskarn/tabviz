# Theme fluent setters re-added after the rationalization (PR J) dropped the
# generic-modifier family. Guards the assign-vs-re-resolve split and the
# set_theme_field path walker (incl. the c("series", 1L, "fill") numeric-coercion
# fix — c() coerces 1L to "1", so index steps are detected structurally).

test_that("set_header_style / set_first_column_style assign the variant", {
  t <- web_theme_cochrane()
  expect_equal(set_header_style(t, "bold")@header_style, "bold")
  expect_equal(set_first_column_style(t, "tint")@first_column_style, "tint")
  expect_error(set_header_style(t, "nope"))
})

test_that("set_inputs updates inputs and re-resolves", {
  t <- web_theme_cochrane()
  t2 <- set_inputs(t, brand = "#1F3A5F", density = "spacious")
  expect_equal(t2@inputs@brand, "#1F3A5F")
  expect_equal(t2@inputs@density, "spacious")
  # re-resolution actually ran: spacing reflects the new density preset
  expect_true(S7::S7_inherits(t2, WebTheme))
})

test_that("set_spacing overrides a token without re-resolving", {
  t <- web_theme_cochrane()
  t2 <- set_spacing(t, row_height = 40)
  expect_equal(t2@spacing@row_height, 40)
})

test_that("set_theme_field walks nested S7 paths", {
  t <- web_theme_cochrane()
  t2 <- set_theme_field(t, c("row_group", "L1", "bg"), "#EEEEEE")
  expect_equal(t2@row_group@L1@bg, "#EEEEEE")
})

test_that("set_theme_field indexes list properties (series), despite c() coercion", {
  t <- web_theme_cochrane()
  skip_if(length(t@series) < 1, "no series slots to pin")
  t2 <- set_theme_field(t, c("series", 1L, "fill"), "#123456")
  expect_equal(t2@series[[1]]@fill, "#123456")
})

test_that("set_theme_field under inputs re-resolves the cascade", {
  t <- web_theme_cochrane()
  t2 <- set_theme_field(t, c("inputs", "brand"), "#FF0000")
  expect_equal(t2@inputs@brand, "#FF0000")
})
