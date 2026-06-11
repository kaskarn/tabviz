# Borders — token contract (rewritten at the W4 finale, 2026-06-11,
# when `theme.borders` left the blob). The cluster is DERIVABLE:
# border_preset rides inputs; lib/theme/borders.ts::resolveBorders is
# the one derivation feeding both the --tv-*border* tokens and the SVG
# export. These tests pin the R-visible contract: the tokens.

test_that("default borders: horizontal hairline-family tokens", {
  v <- theme_css_vars(web_theme())
  expect_identical(unname(v[["--tv-border-row-style"]]), "solid")
  expect_identical(unname(v[["--tv-row-border-width"]]), "1px")
  expect_identical(unname(v[["--tv-border-minor-color"]]), unname(v[["--tv-cell-border"]]))
  expect_identical(unname(v[["--tv-border-major-color"]]), unname(v[["--tv-border"]]))
})

test_that("the blob no longer carries the borders cluster", {
  wire <- tabviz:::serialize_theme(web_theme())
  expect_null(wire$borders)
  expect_null(wire$variants)
})
