test_that("tabviz_natural_dimensions returns width / height / aspect for a WebSpec", {
  skip_if_not_installed("V8")

  data(glp1_trials)
  spec <- tabviz(
    glp1_trials,
    label = "study",
    columns = list(
      col_text("drug", "Drug"),
      col_n("n"),
      viz_forest(point = "hr", lower = "lower", upper = "upper",
                 scale = "log", null_value = 1),
      col_interval("hr", "lower", "upper", header = "HR (95% CI)")
    ),
    theme = web_theme_nejm(),
    .spec_only = TRUE
  )

  d <- tabviz_natural_dimensions(spec)

  expect_named(d, c("width", "height", "aspect"))
  expect_type(d$width,  "double")
  expect_type(d$height, "double")
  expect_type(d$aspect, "double")
  expect_gt(d$width,  0)
  expect_gt(d$height, 0)
  expect_equal(d$aspect, d$width / d$height, tolerance = 1e-9)
})

test_that("tabviz_natural_dimensions accepts an htmlwidget", {
  skip_if_not_installed("V8")

  data(glp1_trials)
  w <- tabviz(
    glp1_trials,
    label = "study",
    columns = list(
      col_n("n"),
      viz_forest(point = "hr", lower = "lower", upper = "upper")
    )
  )

  d <- tabviz_natural_dimensions(w)
  expect_named(d, c("width", "height", "aspect"))
  expect_gt(d$aspect, 0)
})

test_that("tabviz_natural_dimensions errors on non-spec input", {
  expect_error(
    tabviz_natural_dimensions(list(a = 1)),
    "WebSpec"
  )
  expect_error(
    tabviz_natural_dimensions(NULL),
    "WebSpec"
  )
})

test_that("natural height scales with row count (more rows -> taller)", {
  skip_if_not_installed("V8")

  small <- data.frame(
    s = sprintf("S%02d", 1:5),
    hr = 0.8, lower = 0.6, upper = 1.0
  )
  big <- data.frame(
    s = sprintf("S%02d", 1:50),
    hr = 0.8, lower = 0.6, upper = 1.0
  )

  spec_small <- tabviz(small, label = "s",
    columns = list(viz_forest(point = "hr", lower = "lower", upper = "upper")),
    .spec_only = TRUE)
  spec_big <- tabviz(big, label = "s",
    columns = list(viz_forest(point = "hr", lower = "lower", upper = "upper")),
    .spec_only = TRUE)

  d_small <- tabviz_natural_dimensions(spec_small)
  d_big   <- tabviz_natural_dimensions(spec_big)

  expect_gt(d_big$height, d_small$height)
  expect_equal(d_big$width, d_small$width)
})
