# Theme fluent setters re-added after the rationalization (PR J) dropped the
# generic-modifier family. Guards the assign-vs-re-resolve split and the
# set_theme_field path walker (incl. the c("series", 1L, "fill") numeric-coercion
# fix — c() coerces 1L to "1", so index steps are detected structurally).

test_that("set_header_style / set_first_column_style assign the variant", {
  t <- web_theme_nejm()
  expect_equal(set_header_style(t, "bold")@inputs@header_style, "bold")
  expect_equal(set_first_column_style(t, "bold")@inputs@first_column_style, "bold")
  expect_error(set_header_style(t, "nope"))
})

test_that("set_inputs updates inputs and re-resolves", {
  # V4: brand is an OKLCH triple (unrolled into three flat slots), so
  # set_inputs takes the slot names directly. set_brand(theme, "#hex") is
  # the user-facing shortcut.
  t <- web_theme_nejm()
  t2 <- set_inputs(t,
                   anchors_brand_L = 0.40,
                   anchors_brand_C = 0.10,
                   anchors_brand_H = 250,
                   density = "spacious")
  expect_equal(t2@inputs@anchors_brand_L, 0.40)
  expect_equal(t2@inputs@anchors_brand_H, 250)
  expect_equal(t2@inputs@density, "spacious")
  expect_true(S7::S7_inherits(t2, WebTheme))
})

test_that("set_spacing overrides a token without re-resolving", {
  t <- web_theme_nejm()
  t2 <- set_spacing(t, row_height = 40)
  expect_equal(t2@spacing@row_height, 40)
})

test_that("set_theme_field walks nested S7 paths", {
  t <- web_theme_nejm()
  t2 <- set_theme_field(t, c("row_group", "L1", "bg"), "#EEEEEE")
  expect_equal(t2@row_group@L1@bg, "#EEEEEE")
})

test_that("set_theme_field indexes list properties (series), despite c() coercion", {
  t <- web_theme_nejm()
  skip_if(length(t@series) < 1, "no series slots to pin")
  t2 <- set_theme_field(t, c("series", 1L, "fill"), "#123456")
  expect_equal(t2@series[[1]]@fill, "#123456")
})

test_that("set_theme_field under inputs re-resolves the cascade", {
  # V4: brand anchor's L slot is the most-targeted leaf below `inputs`.
  t <- web_theme_nejm()
  t2 <- set_theme_field(t, c("inputs", "anchors_brand_L"), 0.45)
  expect_equal(t2@inputs@anchors_brand_L, 0.45)
})
