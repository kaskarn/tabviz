# Tests for the theme S7 classes (post-Sprint-1 PR J).
#
# The user-authoring surface is ThemeInputs. All other S7
# classes (Surfaces, Content, Dividers, …) are internal data shapes for
# the resolved WebTheme.

test_that("ThemeInputs constructs with defaults", {
  inp <- ThemeInputs()
  expect_true(inherits(inp, "tabviz::ThemeInputs"))
  expect_equal(inp@brand, "#0099CC")
  expect_true(is.na(inp@accent))
  expect_true(is.na(inp@decorative))
  expect_equal(inp@mode, "light")
  expect_equal(inp@neutral_tint, "untinted")
  expect_equal(inp@categorical, "okabe_ito")
  expect_equal(inp@density, "comfortable")
})

test_that("ThemeInputs accepts explicit values", {
  inp <- ThemeInputs(
    brand = "#003DA5",
    accent = "#A6792A",
    decorative = "#A6792A",
    mode = "light",
    neutral_tint = "brand",
    categorical = "tableau10",
    density = "compact"
  )
  expect_equal(inp@brand, "#003DA5")
  expect_equal(inp@decorative, "#A6792A")
  expect_equal(inp@neutral_tint, "brand")
  expect_equal(inp@categorical, "tableau10")
  expect_equal(inp@density, "compact")
})

test_that("ThemeInputs rejects bad hex", {
  expect_error(ThemeInputs(brand = "blue"), "brand must be a hex")
  expect_error(ThemeInputs(accent = "notahex"), "accent must be a hex")
  expect_error(ThemeInputs(decorative = "rgb(0,0,0)"), "decorative must be a hex")
})

test_that("ThemeInputs accepts NA for optional fields", {
  inp <- ThemeInputs(brand = "#000000", accent = NA_character_)
  expect_true(is.na(inp@accent))
})

test_that("ThemeInputs neutral_tint accepts enum or hex", {
  expect_error(ThemeInputs(neutral_tint = "rainbow"), "neutral_tint must be")
  inp <- ThemeInputs(neutral_tint = "#888888")
  expect_equal(inp@neutral_tint, "#888888")
  inp2 <- ThemeInputs(neutral_tint = "brand")
  expect_equal(inp2@neutral_tint, "brand")
})

test_that("ThemeInputs rejects bad mode and density", {
  expect_error(ThemeInputs(mode = "auto"), "mode must be")
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
