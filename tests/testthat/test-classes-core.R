# Tests for core S7 classes

test_that("WebSpec validates forest column data exists", {
  data <- data.frame(
    label = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5)
    # missing upper
  )

  expect_error(
    web_spec(
      data = data,
      label = "label",
      columns = list(
        col_forest(point = "point", lower = "lower", upper = "upper")
      )
    ),
    "upper"
  )
})

test_that("col_forest validates scale value", {
  expect_error(
    col_forest(point = "point", lower = "lower", upper = "upper", scale = "invalid"),
    "arg.*should be one of"
  )
})

test_that("WebSpec creates valid object with defaults", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1.0, 2.0),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      col_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  expect_true(inherits(spec, "tabviz::WebSpec"))
  expect_equal(nrow(spec@data), 2)
  # Forest column should be in the columns list
  expect_true(any(vapply(spec@columns, function(c) c@type == "forest", logical(1))))
})

test_that("col_forest accepts log scale with positive null_value", {
  forest_col <- col_forest(
    point = "point",
    lower = "lower",
    upper = "upper",
    scale = "log",
    null_value = 1
  )

  expect_equal(forest_col@options$forest$scale, "log")
  expect_equal(forest_col@options$forest$nullValue, 1)
})

test_that("GroupSpec creates valid object", {
  group <- GroupSpec(
    id = "group1",
    label = "Subgroup A",
    collapsed = FALSE
  )

  expect_true(inherits(group, "tabviz::GroupSpec"))
  expect_equal(group@id, "group1")
  expect_equal(group@label, "Subgroup A")
  expect_false(group@collapsed)
})

test_that("GroupSummary creates valid object", {
  summary <- GroupSummary(
    group_id = "group1",
    point = 1.5,
    lower = 1.2,
    upper = 1.8
  )

  expect_true(inherits(summary, "tabviz::GroupSummary"))
  expect_equal(summary@group_id, "group1")
  expect_equal(summary@point, 1.5)
})

# Theme preset tests
test_that("web_theme_jama creates valid theme", {
  theme <- web_theme_jama()
  expect_true(inherits(theme, "tabviz::WebTheme"))
  expect_equal(theme@name, "jama")
  expect_equal(theme@colors@foreground, "#000000")
  expect_equal(theme@shapes@border_radius, 0)
})

test_that("web_theme_lancet creates valid theme", {
  theme <- web_theme_lancet()
  expect_true(inherits(theme, "tabviz::WebTheme"))
  expect_equal(theme@name, "lancet")
  expect_equal(theme@colors@primary, "#00407a")
})

test_that("web_theme_modern creates valid theme", {
  theme <- web_theme_modern()
  expect_true(inherits(theme, "tabviz::WebTheme"))
  expect_equal(theme@name, "modern")
  expect_equal(theme@spacing@row_height, 30)
})

test_that("web_theme_presentation creates valid theme", {
  theme <- web_theme_presentation()
  expect_true(inherits(theme, "tabviz::WebTheme"))
  expect_equal(theme@name, "presentation")
  expect_equal(theme@spacing@row_height, 36)
  expect_equal(theme@shapes@point_size, 12)
})

# Column helper tests
test_that("col_bar creates column with options", {
  col <- col_bar("weight", max_value = 100, show_label = FALSE)
  expect_equal(col@type, "bar")
  expect_equal(col@options$bar$maxValue, 100)
  expect_false(col@options$bar$showLabel)
})

test_that("col_pvalue creates column with options", {
  col <- col_pvalue("p", stars = FALSE, format = "scientific")
  expect_equal(col@type, "pvalue")
  expect_false(col@options$pvalue$stars)
  expect_equal(col@options$pvalue$format, "scientific")
})

test_that("col_sparkline creates column with options", {
  col <- col_sparkline("trend", type = "area", height = 30)
  expect_equal(col@type, "sparkline")
  expect_equal(col@options$sparkline$type, "area")
  expect_equal(col@options$sparkline$height, 30)
})

# New v0.1.0 feature tests

test_that("web_theme_cochrane creates valid theme", {
  theme <- web_theme_cochrane()
  expect_true(inherits(theme, "tabviz::WebTheme"))
  expect_equal(theme@name, "cochrane")
  expect_equal(theme@colors@primary, "#0099cc")
  expect_equal(theme@shapes@border_radius, 0)
  expect_false(theme@layout@container_border)
})

test_that("web_theme_nature creates valid theme", {
  theme <- web_theme_nature()
  expect_true(inherits(theme, "tabviz::WebTheme"))
  expect_equal(theme@name, "nature")
  expect_equal(theme@colors@primary, "#1976d2")
  expect_equal(theme@shapes@border_radius, 1)
  expect_false(theme@layout@container_border)
})

test_that("col_numeric supports decimals parameter", {
  col <- col_numeric("value", decimals = 3)
  expect_equal(col@type, "numeric")
  expect_equal(col@options$numeric$decimals, 3)
})

test_that("col_n defaults to 0 decimals", {
  col <- col_n("n")
  expect_equal(col@type, "numeric")
  expect_equal(col@options$numeric$decimals, 0)
})

test_that("col_percent creates column with percent options", {
  col <- col_percent("pct", decimals = 2, multiply = TRUE, symbol = FALSE)
  expect_equal(col@type, "numeric")
  expect_equal(col@options$percent$decimals, 2)
  expect_true(col@options$percent$multiply)
  expect_false(col@options$percent$symbol)
})

test_that("col_events creates column with events options", {
  col <- col_events("events", "n", separator = " / ", show_pct = TRUE)
  expect_equal(col@type, "custom")
  expect_equal(col@options$events$eventsField, "events")
  expect_equal(col@options$events$nField, "n")
  expect_equal(col@options$events$separator, " / ")
  expect_true(col@options$events$showPct)
})

test_that("web_col supports na_text parameter", {
  col <- web_col("value", type = "numeric", na_text = "N/A")
  expect_equal(col@options$naText, "N/A")
})

# Dataset tests

test_that("glp1_trials dataset loads correctly", {
  data(glp1_trials, package = "tabviz")
  expect_true(is.data.frame(glp1_trials))
  expect_true(nrow(glp1_trials) > 0)
  expect_true(all(c("study", "hr", "lower", "upper") %in% names(glp1_trials)))
})

test_that("airline_delays dataset loads correctly", {
  data(airline_delays, package = "tabviz")
  expect_true(is.data.frame(airline_delays))
  expect_true(nrow(airline_delays) > 0)
  expect_true(all(c("carrier", "delay_vs_avg", "delay_lower", "delay_upper") %in% names(airline_delays)))
})

test_that("nba_efficiency dataset loads correctly", {
  data(nba_efficiency, package = "tabviz")
  expect_true(is.data.frame(nba_efficiency))
  expect_true(nrow(nba_efficiency) > 0)
  expect_true(all(c("player", "per", "per_lower", "per_upper") %in% names(nba_efficiency)))
})

test_that("climate_temps dataset loads correctly", {
  data(climate_temps, package = "tabviz")
  expect_true(is.data.frame(climate_temps))
  expect_true(nrow(climate_temps) > 0)
  expect_true(all(c("region", "anomaly", "lower", "upper") %in% names(climate_temps)))
})
