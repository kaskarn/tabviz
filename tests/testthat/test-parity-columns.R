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

test_that("colInterval: D30 bounds primitives round-trip (R == TS) + default-absent", {
  args <- list(point = "hr", lower = "lcl", upper = "ucl",
               variant = "bracket_muted", boundsSeparator = "/",
               boundsLayout = "column", boundsMuted = FALSE)
  shape <- ts_call("colInterval", args)
  r_col <- col_interval("hr", "lcl", "ucl", variant = "bracket_muted",
                        bounds_separator = "/", bounds_layout = "column",
                        bounds_muted = FALSE)
  # R packs the same primitive overrides TS does
  testthat::expect_equal(r_col@options$interval$boundsSeparator,
                         shape$options$interval$boundsSeparator)
  testthat::expect_equal(r_col@options$interval$boundsSeparator, "/")
  testthat::expect_equal(r_col@options$interval$boundsLayout, "column")
  testthat::expect_false(r_col@options$interval$boundsMuted)
  # Unset primitives are ABSENT on both sides (defer to the variant — no drift)
  plain <- col_interval("hr", "lcl", "ucl")
  testthat::expect_null(plain@options$interval$boundsSeparator)
  testthat::expect_null(plain@options$interval$boundsLayout)
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

test_that("colPercent: defaults map through", {
  shape <- ts_call("colPercent", list(field = "rate"))
  r_col <- col_percent("rate")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$percent$decimals, 1)
  testthat::expect_equal(shape$options$percent$multiply, TRUE)
  testthat::expect_equal(shape$options$percent$symbol, TRUE)
})

test_that("colCurrency: symbol prefix + abbreviate", {
  shape <- ts_call("colCurrency", list(field = "cost", symbol = "$", abbreviate = TRUE))
  r_col <- col_currency("cost", abbreviate = TRUE)
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$numeric$prefix, "$")
  testthat::expect_equal(shape$options$numeric$abbreviate, TRUE)
})

test_that("colRange: synthetic field + low/high", {
  shape <- ts_call("colRange", list(low = "lo", high = "hi"))
  r_col <- col_range(low = "lo", high = "hi")
  testthat::expect_equal(r_col@field, shape$field)
  testthat::expect_equal(r_col@type, shape$type)
  testthat::expect_equal(shape$field, "_range_lo_hi")
  testthat::expect_equal(shape$options$range$minField, "lo")
  testthat::expect_equal(shape$options$range$maxField, "hi")
})

test_that("colEvents: synthetic field + events/n", {
  shape <- ts_call("colEvents", list(events = "e", n = "n"))
  r_col <- col_events(events = "e", n = "n")
  testthat::expect_equal(r_col@field, shape$field)
  testthat::expect_equal(r_col@type, shape$type)
  testthat::expect_equal(shape$field, "_events_e_n")
})

test_that("colHeatmap: palette + decimals", {
  shape <- ts_call("colHeatmap", list(field = "h", palette = list("#fff", "#000")))
  r_col <- col_heatmap("h")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$heatmap$decimals, 2)
})

test_that("colProgress: defaults", {
  shape <- ts_call("colProgress", list(field = "p"))
  r_col <- col_progress("p")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$progress$maxValue, 100)
})

test_that("colImg: defaults", {
  shape <- ts_call("colImg", list(field = "logo"))
  r_col <- col_img("logo")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$img$shape, "square")
})

test_that("colReference: default header", {
  shape <- ts_call("colReference", list(field = "url"))
  r_col <- col_reference("url")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$header, "Reference")
})

test_that("colPictogram: glyph default + count mode", {
  shape <- ts_call("colPictogram", list(field = "count", glyph = "person"))
  r_col <- col_pictogram("count", glyph = "person")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$pictogram$glyph, "person")
})

test_that("colRing: min/max defaults + percent label", {
  shape <- ts_call("colRing", list(field = "pct"))
  r_col <- col_ring("pct")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$ring$minValue, 0)
  testthat::expect_equal(shape$options$ring$maxValue, 1)
  testthat::expect_equal(shape$options$ring$labelFormat, "percent")
})

test_that("colIcon: center alignment default", {
  shape <- ts_call("colIcon", list(field = "status"))
  r_col <- col_icon("status")
  testthat::expect_equal(r_col@field, shape$field)
  testthat::expect_equal(r_col@type, shape$type)
  testthat::expect_equal(shape$options$icon$size, "base")
})

test_that("colLabel: prettifies snake_case header", {
  shape <- ts_call("colLabel", list(field = "patient_id"))
  r_col <- col_label("patient_id")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$header, "Patient Id")
})

test_that("colDate: format option threads through options.date.format", {
  shape <- ts_call("colDate", list(field = "dob", format = "%b %d, %Y"))
  r_col <- col_date("dob", format = "%b %d, %Y")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$type, "text")
  testthat::expect_equal(shape$options$date$format, "%b %d, %Y")
})

test_that("vizForest: single-effect synthetic field + sortable=FALSE", {
  shape <- ts_call("vizForest", list(point = "hr", lower = "lcl", upper = "ucl"))
  r_col <- viz_forest(point = "hr", lower = "lcl", upper = "ucl")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$field, "_forest_hr")
  testthat::expect_equal(shape$id, "forest_hr")
  testthat::expect_equal(shape$sortable, FALSE)
  testthat::expect_equal(shape$options$forest$point, "hr")
  testthat::expect_equal(shape$options$forest$nullValue, 0)
})

test_that("vizForest: log scale defaults nullValue=1", {
  shape <- ts_call("vizForest", list(point = "hr", lower = "lcl", upper = "ucl", scale = "log"))
  r_col <- viz_forest(point = "hr", lower = "lcl", upper = "ucl", scale = "log")
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$options$forest$nullValue, 1)
})

test_that("vizBar: synthetic field + header fallback to effect label", {
  shape <- ts_call("vizBar", list(
    effects = list(list(value = "score", label = "Score"))
  ))
  r_col <- viz_bar(effect_bar("score", label = "Score"))
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$field, "_viz_bar_score")
  testthat::expect_equal(shape$header, "Score")
  testthat::expect_equal(shape$sortable, FALSE)
})

test_that("vizBoxplot: synthetic field uses data field when present", {
  shape <- ts_call("vizBoxplot", list(
    effects = list(list(data = "vals"))
  ))
  r_col <- viz_boxplot(effect_boxplot(data = "vals"))
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$field, "_viz_boxplot_vals")
})

test_that("vizViolin: synthetic field uses data field", {
  shape <- ts_call("vizViolin", list(
    effects = list(list(data = "v"))
  ))
  r_col <- viz_violin(effect_violin(data = "v"))
  compare_shape(r_col, shape)
  testthat::expect_equal(shape$field, "_viz_violin_v")
})

test_that("vizBar: null_value prepends a synthetic refline annotation", {
  shape <- ts_call("vizBar", list(
    effects = list(list(value = "x")),
    nullValue = 0
  ))
  r_col <- viz_bar(effect_bar("x"), null_value = 0)
  testthat::expect_equal(length(shape$options$vizBar$annotations), 1)
  testthat::expect_equal(shape$options$vizBar$annotations[[1]]$x, 0)
  testthat::expect_equal(length(r_col@options$vizBar$annotations), 1)
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
