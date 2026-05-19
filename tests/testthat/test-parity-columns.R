# R↔TS column-builder parity tests.
#
# For each col_* / viz_* helper, exercise R-side and TS-side with the same
# inputs and assert key wire fields match. Drift-detector: any change to
# the TS authoring layer that desyncs from R (or vice versa) fails here.
#
# Now that V8 is a hard Import (DESCRIPTION) and col_text delegates fully
# via `R/v8-bridge.R::ts_call`, the col_text rows are tautologically true
# (same code path) but still pinned so a future refactor that breaks the
# delegation surfaces the gap immediately. Helpers that don't yet
# delegate (the other col_*) get real drift detection.

# Compare key shape fields. Ignores R-only S7 properties (`style_*`,
# `formatter`) and the boolean `isGroup` discriminator (R uses ColumnGroup
# class; TS uses an `isGroup` flag).
compare_shape <- function(r_col, ts_shape) {
  testthat::expect_equal(r_col@id,     ts_shape$id,     label = paste0("id (", r_col@id, ")"))
  testthat::expect_equal(r_col@field,  ts_shape$field,  label = paste0("field (", r_col@field, ")"))
  testthat::expect_equal(r_col@header, ts_shape$header, label = paste0("header (", r_col@header, ")"))
  testthat::expect_equal(r_col@type,   ts_shape$type,   label = paste0("type (", r_col@type, ")"))
}

test_that("col_text: minimal field-only call", {
  shape <- ts_call("colText", list(field = "study"))
  r_col <- col_text("study")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$type, "text")
  testthat::expect_length(shape$options, 0)
})

test_that("col_text: max_chars threads through to options.text.maxChars", {
  shape <- ts_call("colText", list(field = "study", maxChars = 30))
  r_col <- col_text("study", max_chars = 30)
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$text$maxChars, 30)
  testthat::expect_equal(r_col@options$text$maxChars, 30)
})

test_that("col_text: explicit header survives both paths", {
  shape <- ts_call("colText", list(field = "x", header = "Custom Header"))
  r_col <- col_text("x", header = "Custom Header")
  compare_shape(r_col, shape)
})

test_that("colNumeric: default decimals=2", {
  shape <- ts_call("colNumeric", list(field = "estimate"))
  r_col <- col_numeric("estimate")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$numeric$decimals, 2)
  testthat::expect_equal(r_col@options$numeric$decimals, 2)
})

test_that("colNumeric: digits arg routes correctly", {
  shape <- ts_call("colNumeric", list(field = "v", digits = 3))
  r_col <- col_numeric("v", digits = 3)
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$numeric$digits, 3)
})

test_that("colN: default header N + thousands_sep ','", {
  shape <- ts_call("colN", list(field = "n_total"))
  r_col <- col_n("n_total")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$header, "N")
  testthat::expect_equal(shape$options$numeric$thousandsSep, ",")
})

test_that("colInterval: point/lower/upper packed into options.interval", {
  shape <- ts_call("colInterval", list(point = "hr", lower = "lcl", upper = "ucl"))
  r_col <- col_interval("hr", "lcl", "ucl")
  testthat::expect_equal(r_col@field,  shape$field)
  testthat::expect_equal(r_col@type,   shape$type)
  testthat::expect_equal(shape$options$interval$point, "hr")
  testthat::expect_equal(shape$options$interval$lower, "lcl")
  testthat::expect_equal(shape$options$interval$upper, "ucl")
})

test_that("colPvalue: default header 'P-value'", {
  shape <- ts_call("colPvalue", list(field = "p"))
  r_col <- col_pvalue("p")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$header, "P-value")
})

test_that("colBar: scale=linear default", {
  shape <- ts_call("colBar", list(field = "score"))
  r_col <- col_bar("score")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$bar$scale, "linear")
})

test_that("colSparkline: type=line, height=20 defaults", {
  shape <- ts_call("colSparkline", list(field = "trend"))
  r_col <- col_sparkline("trend")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$sparkline$type, "line")
  testthat::expect_equal(shape$options$sparkline$height, 20)
})

test_that("colStars: produces pictogram-typed column (matches R col_stars)", {
  shape <- ts_call("colStars", list(field = "rating"))
  r_col <- col_stars("rating")
  compare_shape(r_col, shape)
  # R col_stars is a thin wrapper over col_pictogram(glyph = "star"); TS
  # colStars produces the same wire shape for parity.
  testthat::expect_equal(shape$type, "pictogram")
  testthat::expect_equal(shape$options$pictogram$glyph, "star")
  testthat::expect_equal(shape$options$pictogram$maxGlyphs, 5)
})

test_that("colBadge: shape=pill default", {
  shape <- ts_call("colBadge", list(field = "status"))
  r_col <- col_badge("status")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$badge$shape, "pill")
})

test_that("V8 bundle exposes callBuilder + the SVG export functions", {
  ctx <- tabviz_v8()
  testthat::expect_true(ctx$eval("typeof callBuilder") == "function")
  testthat::expect_true(ctx$eval("typeof generateSVG") == "function")
  testthat::expect_true(ctx$eval("typeof computeNaturalDimensions") == "function")
})

test_that("ts_call surfaces builder errors back to R", {
  testthat::expect_error(
    ts_call("colNoSuchBuilder", list(field = "x")),
    "no such builder"
  )
})
