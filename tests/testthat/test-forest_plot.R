# Tests for forest_plot() function

test_that("forest_plot returns htmlwidget from data.frame", {
  data <- data.frame(
    study = c("A", "B", "C"),
    point = c(1.2, 0.8, 1.5),
    lower = c(0.9, 0.5, 1.1),
    upper = c(1.6, 1.2, 2.0)
  )

  widget <- forest_plot(
    data,
    point = "point",
    lower = "lower",
    upper = "upper",
    label = "study"
  )

  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("forest_plot accepts WebSpec object", {
  data <- data.frame(
    study = c("A", "B", "C"),
    point = c(1.2, 0.8, 1.5),
    lower = c(0.9, 0.5, 1.1),
    upper = c(1.6, 1.2, 2.0)
  )

  spec <- web_spec(
    data,
    label = "study",
    columns = list(
      col_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  widget <- forest_plot(spec)

  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})

test_that("forest_plot accepts columns", {
  data <- data.frame(
    study = c("A", "B", "C"),
    point = c(1.2, 0.8, 1.5),
    lower = c(0.9, 0.5, 1.1),
    upper = c(1.6, 1.2, 2.0),
    n = c(100, 150, 75)
  )

  widget <- forest_plot(
    data,
    point = "point",
    lower = "lower",
    upper = "upper",
    label = "study",
    columns = list(col_n())
  )

  expect_s3_class(widget, "htmlwidget")
})

test_that("forest_plot accepts log scale", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1.5, 0.7),
    lower = c(1.2, 0.5),
    upper = c(1.9, 1.0)
  )

  widget <- forest_plot(
    data,
    point = "point",
    lower = "lower",
    upper = "upper",
    scale = "log"
  )

  expect_s3_class(widget, "htmlwidget")
})

test_that("forest_plot accepts theme", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1.2, 0.8),
    lower = c(0.9, 0.5),
    upper = c(1.6, 1.2)
  )

  widget <- forest_plot(
    data,
    point = "point",
    lower = "lower",
    upper = "upper",
    theme = web_theme_dark()
  )

  expect_s3_class(widget, "htmlwidget")
})

test_that("webtable returns htmlwidget", {
  data <- data.frame(
    study = c("A", "B", "C"),
    value = c(1.2, 0.8, 1.5)
  )

  spec <- web_spec(
    data,
    label = "study",
    columns = list(
      col_numeric("value")
    )
  )

  widget <- webtable(spec)

  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "tabviz")
})
