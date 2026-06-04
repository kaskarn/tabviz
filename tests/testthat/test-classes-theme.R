# Tests for the theme S7 classes (post-Sprint-1 PR J).
#
# The user-authoring surface is ThemeInputs. All other S7
# classes (Surfaces, Content, Dividers, …) are internal data shapes for
# the resolved WebTheme.

test_that("ThemeInputs constructs with defaults (V4 anchors)", {
  inp <- ThemeInputs()
  expect_true(inherits(inp, "tabviz::ThemeInputs"))
  # paper/ink/brand must be set; accent NA-by-default (mirrors brand).
  expect_true(is.finite(inp@anchors_paper_L))
  expect_true(is.finite(inp@anchors_ink_L))
  expect_true(is.finite(inp@anchors_brand_L))
  expect_true(is.na(inp@anchors_accent_L))
  expect_equal(inp@polarity, "light")
  expect_equal(inp@categorical, "okabe_ito")
  expect_equal(inp@density, "comfortable")
})

test_that("ThemeInputs accepts explicit OKLCH triples", {
  inp <- ThemeInputs(
    anchors_paper_L = 0.95, anchors_paper_C = 0.02, anchors_paper_H = 220,
    anchors_ink_L   = 0.15, anchors_ink_C   = 0.02, anchors_ink_H   = 220,
    anchors_brand_L = 0.45, anchors_brand_C = 0.18, anchors_brand_H = 220,
    anchors_accent_L = 0.65, anchors_accent_C = 0.15, anchors_accent_H = 60,
    polarity = "light",
    categorical = "tableau10",
    density = "compact"
  )
  expect_equal(inp@anchors_brand_H, 220)
  expect_equal(inp@anchors_accent_H, 60)
  expect_equal(inp@categorical, "tableau10")
  expect_equal(inp@density, "compact")
})

test_that("ThemeInputs validates anchor ranges", {
  expect_error(ThemeInputs(anchors_brand_L = 2.0), "anchors_brand_L")
  expect_error(ThemeInputs(anchors_brand_C = -0.1), "anchors_brand_C")
  expect_error(ThemeInputs(anchors_brand_H = 400), "anchors_brand_H")
})

test_that("ThemeInputs accepts all-NA accent (mirrors brand at resolution)", {
  inp <- ThemeInputs(
    anchors_accent_L = NA_real_,
    anchors_accent_C = NA_real_,
    anchors_accent_H = NA_real_
  )
  expect_true(is.na(inp@anchors_accent_L))
})

test_that("ThemeInputs rejects bad polarity and density", {
  expect_error(ThemeInputs(polarity = "auto"), "polarity must be")
  expect_error(ThemeInputs(density = "tight"), "density must be")
})

test_that("WebTheme constructs and holds ThemeInputs", {
  t <- WebTheme()
  expect_true(inherits(t, "tabviz::WebTheme"))
  expect_true(inherits(t@inputs, "tabviz::ThemeInputs"))
})

test_that("SlotRole defaults all-NA and rejects bad hex", {
  sb <- SlotRole()
  for (p in S7::prop_names(sb)) {
    expect_true(is.na(S7::prop(sb, p)))
  }
  expect_error(SlotRole(fill = "blue"))
  expect_silent(SlotRole(fill = "#1F3A5F", stroke = "#14273F"))
})

test_that("TextRole validates figures and fg", {
  expect_silent(TextRole(figures = "tabular"))
  expect_silent(TextRole(figures = "proportional"))
  expect_error(TextRole(figures = "lining"))
  expect_error(TextRole(fg = "blue"))
  expect_silent(TextRole(fg = "#000000"))
})

test_that("Surfaces / Content / Dividers / AccentRoles defaults are NA", {
  s <- Surfaces()
  for (p in S7::prop_names(s)) expect_true(is.na(S7::prop(s, p)))
  c <- Content()
  for (p in S7::prop_names(c)) expect_true(is.na(S7::prop(c, p)))
  d <- Dividers()
  for (p in S7::prop_names(d)) expect_true(is.na(S7::prop(d, p)))
})

test_that("FirstColumnCluster has default and bold variants", {
  fc <- FirstColumnCluster()
  expect_true(inherits(fc@default, "tabviz::FirstColumnVariant"))
  expect_true(inherits(fc@bold, "tabviz::FirstColumnVariant"))
})

test_that("RowCluster has all states + banding", {
  rc <- RowCluster()
  expect_true(inherits(rc@base, "tabviz::RowState"))
  expect_true(inherits(rc@hover, "tabviz::RowState"))
  expect_true(inherits(rc@selected, "tabviz::RowState"))
  expect_equal(rc@banding, "group")
  expect_error(RowCluster(banding = "checkerboard"))
})

test_that("WebTheme accepts a list of SlotRole for series", {
  t <- WebTheme(series = list(
    SlotRole(fill = "#1F3A5F"),
    SlotRole(fill = "#B08938")
  ))
  expect_length(t@series, 2L)
  expect_true(inherits(t@series[[1]], "tabviz::SlotRole"))
})
