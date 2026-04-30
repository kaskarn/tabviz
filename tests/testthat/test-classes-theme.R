expect_s7_class <- function(object, class) {
  testthat::expect_true(inherits(object, paste0("tabviz::", class)))
}

test_that("ThemeInputs constructs with sensible defaults", {
  inp <- ThemeInputs()
  expect_length(inp@neutral, 5L)
  expect_match(inp@primary, "^#")
  expect_true(is.na(inp@primary_deep))
  expect_true(is.na(inp@secondary))
  expect_true(is.na(inp@secondary_deep))
  expect_gt(length(inp@series_anchors), 0L)
})

test_that("ThemeInputs rejects bad neutral length", {
  expect_error(ThemeInputs(neutral = c("#fff", "#000")))
})

test_that("ThemeInputs rejects bad hex", {
  expect_error(ThemeInputs(primary = "not-hex"))
  expect_error(ThemeInputs(secondary = "not-hex"))
  expect_error(ThemeInputs(series_anchors = c("#fff", "rgb(0,0,0)")))
})

test_that("ThemeVariants validates options", {
  v <- ThemeVariants()
  expect_equal(v@density, "comfortable")
  expect_equal(v@header_style, "light")
  expect_equal(v@first_column_style, "default")
  expect_error(ThemeVariants(density = "ginormous"))
  expect_error(ThemeVariants(header_style = "outlined"))
  expect_error(ThemeVariants(first_column_style = "italic"))
})

test_that("Surfaces / Content / Dividers / AccentRoles default all-NA", {
  for (cls in list(Surfaces(), Content(), Dividers(), AccentRoles())) {
    for (p in S7::prop_names(cls)) {
      expect_true(is.na(S7::prop(cls, p)),
                  info = paste(class(cls)[1], p))
    }
  }
})

test_that("StatusColors defaults all-NA and validates hex", {
  s <- StatusColors()
  for (p in c("positive", "negative", "warning", "info")) {
    expect_true(is.na(S7::prop(s, p)))
  }
  expect_error(StatusColors(positive = "green"))
})

test_that("SlotBundle defaults all-NA and rejects bad hex", {
  sb <- SlotBundle()
  for (p in S7::prop_names(sb)) {
    expect_true(is.na(S7::prop(sb, p)))
  }
  expect_error(SlotBundle(fill = "blue"))
  expect_silent(SlotBundle(fill = "#1F3A5F", stroke = "#14273F"))
})

test_that("TextRole validates figures and fg", {
  expect_silent(TextRole(figures = "tabular"))
  expect_silent(TextRole(figures = "proportional"))
  expect_error(TextRole(figures = "lining"))
  expect_error(TextRole(fg = "blue"))
  expect_silent(TextRole(fg = "#000000"))
})

test_that("TextRoles holds 8 named bundles", {
  tr <- TextRoles()
  expect_setequal(
    S7::prop_names(tr),
    c("title", "subtitle", "body", "cell", "label", "tick", "footnote", "caption")
  )
  for (p in S7::prop_names(tr)) {
    expect_s7_class(S7::prop(tr, p), "TextRole")
  }
})

test_that("SpacingTokens has 12 NA-default fields", {
  st <- SpacingTokens()
  for (p in S7::prop_names(st)) {
    expect_true(is.na(S7::prop(st, p)), info = p)
  }
})

test_that("HeaderCluster and ColumnGroupCluster carry both variants", {
  h <- HeaderCluster()
  expect_s7_class(h@light, "HeaderVariant")
  expect_s7_class(h@bold,  "HeaderVariant")
  expect_s7_class(h@text,  "TextRole")
  cg <- ColumnGroupCluster()
  expect_s7_class(cg@light, "HeaderVariant")
  expect_s7_class(cg@bold,  "HeaderVariant")
})

test_that("RowGroupCluster has L1/L2/L3 tiers", {
  rg <- RowGroupCluster()
  expect_s7_class(rg@L1, "RowGroupTier")
  expect_s7_class(rg@L2, "RowGroupTier")
  expect_s7_class(rg@L3, "RowGroupTier")
  expect_true(is.na(rg@indent_per_level))
})

test_that("RowCluster carries states + semantic bundles + banding", {
  rc <- RowCluster()
  expect_s7_class(rc@base,     "RowState")
  expect_s7_class(rc@hover,    "RowState")
  expect_s7_class(rc@selected, "RowState")
  expect_s7_class(rc@emphasis, "RowSemantic")
  expect_s7_class(rc@muted,    "RowSemantic")
  expect_s7_class(rc@accent,   "RowSemantic")
  expect_equal(rc@banding, "group")
  expect_error(RowCluster(banding = "checkerboard"))
})

test_that("RowSemantic validates marker_fill and font_style", {
  expect_silent(RowSemantic(font_style = "italic"))
  expect_silent(RowSemantic(font_style = "normal"))
  expect_error(RowSemantic(font_style = "oblique"))
  expect_error(RowSemantic(marker_fill = "rebeccapurple"))
})

test_that("FirstColumnCluster has plain/bold variants", {
  fc <- FirstColumnCluster()
  expect_s7_class(fc@plain, "FirstColumnVariant")
  expect_s7_class(fc@bold,  "FirstColumnVariant")
})

test_that("PlotScaffold defaults transparent bg + sensible numerics", {
  ps <- PlotScaffold()
  expect_true(is.na(ps@bg))
  expect_equal(ps@tick_mark_length, 4)
  expect_equal(ps@line_width, 1.5)
  expect_equal(ps@point_size, 6)
})

test_that("MarksRecipes defaults forest+summary+bar+box+violin+lollipop", {
  mr <- MarksRecipes()
  expect_setequal(
    S7::prop_names(mr),
    c("forest", "summary", "bar", "box", "violin", "lollipop")
  )
  expect_equal(mr@forest@body, "fill")
  expect_equal(mr@forest@outline, "stroke")
  expect_equal(mr@forest@line, "stroke")
})

test_that("WebTheme constructs end-to-end with defaults", {
  t <- WebTheme()
  expect_equal(t@name, "default")
  expect_s7_class(t@inputs, "ThemeInputs")
  expect_s7_class(t@variants, "ThemeVariants")
  expect_s7_class(t@surface, "Surfaces")
  expect_s7_class(t@content, "Content")
  expect_s7_class(t@row, "RowCluster")
  expect_s7_class(t@first_column, "FirstColumnCluster")
  expect_s7_class(t@marks, "MarksRecipes")
  expect_type(t@series, "list")
  expect_length(t@series, 0L)
})

test_that("WebTheme accepts a list of SlotBundle for series", {
  t <- WebTheme(series = list(
    SlotBundle(fill = "#1F3A5F"),
    SlotBundle(fill = "#B08938")
  ))
  expect_length(t@series, 2L)
  expect_s7_class(t@series[[1]], "SlotBundle")
})

test_that("WebTheme rejects non-SlotBundle entries in series", {
  expect_error(WebTheme(series = list(SlotBundle(), "not a bundle")))
})
