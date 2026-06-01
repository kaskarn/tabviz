# Phase 11: layout × type border model.
#
# Mirror of `theme-resolve.test.ts` borders describe block. Locks the R
# resolver behavior (defaults + partial overrides) and the wire shape
# emitted by `serialize_theme()` so future churn surfaces here.

test_that("borders default to horizontal layout with minor=subtle divider", {
  th <- web_theme()
  expect_equal(th@borders@layout, "horizontal")
  expect_equal(th@borders@minor@thickness, 1)
  expect_equal(th@borders@minor@style, "single")
  expect_equal(th@borders@minor@color, th@divider@subtle)
  expect_equal(th@borders@major@color, th@divider@strong)
  expect_equal(th@borders@table@color, th@divider@strong)
})

test_that("serialize_theme emits the borders wire block", {
  th <- web_theme()
  wire <- tabviz:::serialize_theme(th)
  expect_true(!is.null(wire$borders))
  expect_setequal(names(wire$borders), c("layout", "major", "minor", "table"))
  expect_setequal(names(wire$borders$major), c("thickness", "style", "color"))
  expect_equal(wire$borders$layout, "horizontal")
  expect_equal(wire$borders$minor$thickness, 1)
})

test_that("ThemeBorders validates layout against the four allowed values", {
  expect_error(ThemeBorders(layout = "diagonal"))
  expect_silent(ThemeBorders(layout = "none"))
})

test_that("BorderSpec validates style against single/double", {
  expect_error(BorderSpec(style = "dashed"))
  expect_silent(BorderSpec(style = "double"))
})
