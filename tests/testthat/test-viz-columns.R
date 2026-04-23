# Tests for viz column types: viz_bar, viz_boxplot, viz_violin

test_that("viz_bar creates ColumnSpec with type viz_bar", {
  col <- viz_bar(effect_bar("value"))
  expect_equal(col@type, "viz_bar")
  expect_false(col@sortable)
  expect_equal(length(col@options$vizBar$effects), 1)
  expect_equal(col@options$vizBar$effects[[1]]$value, "value")
})

test_that("viz_bar supports multiple effects", {
  col <- viz_bar(
    effect_bar("baseline", label = "Baseline", color = "#3b82f6"),
    effect_bar("followup", label = "Follow-up", color = "#22c55e"),
    header = "Scores",
    width = 180
  )
  expect_equal(length(col@options$vizBar$effects), 2)
  expect_equal(col@options$vizBar$effects[[1]]$label, "Baseline")
  expect_equal(col@options$vizBar$effects[[2]]$color, "#22c55e")
})

test_that("viz_bar validates effects", {
  expect_error(viz_bar(), "at least one")
  expect_error(viz_bar("not_an_effect"), "effect_bar")
})

test_that("viz_boxplot creates ColumnSpec with type viz_boxplot", {
  col <- viz_boxplot(effect_boxplot(data = "values"))
  expect_equal(col@type, "viz_boxplot")
  expect_false(col@sortable)
  expect_equal(col@options$vizBoxplot$effects[[1]]$data, "values")
})

test_that("viz_boxplot with pre-computed stats", {
  col <- viz_boxplot(effect_boxplot(
    min = "min_val", q1 = "q1_val", median = "med_val",
    q3 = "q3_val", max = "max_val"
  ))
  expect_equal(col@options$vizBoxplot$effects[[1]]$min, "min_val")
  expect_equal(col@options$vizBoxplot$effects[[1]]$median, "med_val")
})

test_that("viz_boxplot validates effects", {
  expect_error(viz_boxplot(), "at least one")
  expect_error(viz_boxplot("not_an_effect"), "effect_boxplot")
})

test_that("viz_violin creates ColumnSpec with type viz_violin", {
  col <- viz_violin(effect_violin(data = "values"))
  expect_equal(col@type, "viz_violin")
  expect_false(col@sortable)
  expect_equal(col@options$vizViolin$effects[[1]]$data, "values")
})

test_that("viz_violin supports multiple effects", {
  col <- viz_violin(
    effect_violin(data = "treatment", label = "Tx", color = "#3b82f6"),
    effect_violin(data = "control", label = "Ctrl", color = "#f59e0b"),
    show_median = TRUE,
    show_quartiles = TRUE
  )
  expect_equal(length(col@options$vizViolin$effects), 2)
  expect_true(col@options$vizViolin$showMedian)
  expect_true(col@options$vizViolin$showQuartiles)
})

test_that("viz_violin validates effects", {
  expect_error(viz_violin(), "at least one")
  expect_error(viz_violin("not_an_effect"), "effect_violin")
})

test_that("effect_bar creates VizBarEffect", {
  e <- effect_bar("value", label = "Test", color = "#ff0000", opacity = 0.8)
  expect_true(inherits(e, "tabviz::VizBarEffect"))
  expect_equal(e@value, "value")
  expect_equal(e@label, "Test")
  expect_equal(e@color, "#ff0000")
  expect_equal(e@opacity, 0.8)
})

test_that("effect_boxplot creates VizBoxplotEffect", {
  e <- effect_boxplot(data = "values", label = "Test", color = "#ff0000")
  expect_true(inherits(e, "tabviz::VizBoxplotEffect"))
  expect_equal(e@data, "values")
  expect_equal(e@label, "Test")
})

test_that("effect_violin creates VizViolinEffect", {
  e <- effect_violin(data = "values", label = "Test", opacity = 0.3)
  expect_true(inherits(e, "tabviz::VizViolinEffect"))
  expect_equal(e@data, "values")
  expect_equal(e@opacity, 0.3)
})

test_that("effect_violin(fill_opacity=) is deprecated and forwards to opacity", {
  expect_warning(
    e <- effect_violin(data = "values", fill_opacity = 0.4),
    "deprecated"
  )
  expect_equal(e@opacity, 0.4)
})

test_that("effect_boxplot(fill_opacity=) is deprecated and forwards to opacity", {
  expect_warning(
    e <- effect_boxplot(data = "values", fill_opacity = 0.6),
    "deprecated"
  )
  expect_equal(e@opacity, 0.6)
})

test_that("viz_violin / viz_boxplot effects serialize as `opacity` in JSON", {
  e_v <- effect_violin(data = "v", opacity = 0.4)
  e_b <- effect_boxplot(data = "b", opacity = 0.6)
  data <- data.frame(label = "x", v = I(list(1:5)), b = I(list(1:5)))
  spec <- web_spec(data = data, label = "label",
                   columns = list(viz_violin(e_v), viz_boxplot(e_b)))
  payload <- tabviz:::serialize_spec(spec)
  vio_eff <- payload$columns[[2]]$options$vizViolin$effects[[1]]
  box_eff <- payload$columns[[3]]$options$vizBoxplot$effects[[1]]
  expect_equal(vio_eff$opacity, 0.4)
  expect_equal(box_eff$opacity, 0.6)
  expect_null(vio_eff$fillOpacity)
  expect_null(box_eff$fillOpacity)
})

test_that("viz_bar / viz_boxplot / viz_violin accept annotations and serialize them", {
  data <- data.frame(label = c("a","b"), x = c(10, 20), y = I(list(1:5, 1:5)))
  spec <- web_spec(
    data = data, label = "label",
    columns = list(
      viz_bar(effect_bar("x"), annotations = list(refline(15, label = "mid"))),
      viz_boxplot(effect_boxplot(data = "y"), annotations = list(refline(3))),
      viz_violin(effect_violin(data = "y"), annotations = list(refline(3)))
    )
  )
  payload <- tabviz:::serialize_spec(spec)
  bar_anns <- payload$columns[[2]]$options$vizBar$annotations
  box_anns <- payload$columns[[3]]$options$vizBoxplot$annotations
  vio_anns <- payload$columns[[4]]$options$vizViolin$annotations
  expect_length(bar_anns, 1)
  expect_equal(bar_anns[[1]]$type, "reference_line")
  expect_equal(bar_anns[[1]]$x, 15)
  expect_equal(bar_anns[[1]]$label, "mid")
  expect_equal(box_anns[[1]]$x, 3)
  expect_equal(vio_anns[[1]]$x, 3)
})

test_that("viz_bar(null_value=) prepends a synthetic refline to annotations", {
  data <- data.frame(label = c("a","b"), x = c(10, 20))
  spec <- web_spec(
    data = data, label = "label",
    columns = list(viz_bar(effect_bar("x"), null_value = 0))
  )
  payload <- tabviz:::serialize_spec(spec)
  anns <- payload$columns[[2]]$options$vizBar$annotations
  expect_length(anns, 1)
  expect_equal(anns[[1]]$type, "reference_line")
  expect_equal(anns[[1]]$x, 0)
  expect_equal(anns[[1]]$style, "dashed")
})

test_that("null_value + annotations stack: null refline first, then user annotations", {
  data <- data.frame(label = c("a","b"), x = c(10, 20))
  spec <- web_spec(
    data = data, label = "label",
    columns = list(viz_bar(effect_bar("x"), null_value = 0,
                           annotations = list(refline(25, label = "target"))))
  )
  payload <- tabviz:::serialize_spec(spec)
  anns <- payload$columns[[2]]$options$vizBar$annotations
  expect_length(anns, 2)
  expect_equal(anns[[1]]$x, 0)        # synthetic null line first
  expect_equal(anns[[2]]$x, 25)       # user refline second
  expect_equal(anns[[2]]$label, "target")
})

test_that("viz_*() rejects non-annotation objects in annotations list", {
  data <- data.frame(label = "a", x = 1)
  expect_error(
    viz_bar(effect_bar("x"), annotations = list("not an annotation")),
    "annotation"
  )
})

# ---------------------------------------------------------------------------
# Marker styling cascade: row semantic class reaches viz cells
# ---------------------------------------------------------------------------

test_that("row_accent/emphasis/muted formula resolves to per-row style booleans", {
  data <- data.frame(
    label = letters[1:4],
    pval  = c(0.001, 0.04, 0.2, 0.5),
    hr    = c(0.5, 0.7, 1.0, 1.2),
    lo    = c(0.4, 0.5, 0.8, 1.0),
    hi    = c(0.6, 0.9, 1.3, 1.5)
  )
  spec <- web_spec(
    data = data, label = "label",
    row_accent = ~ pval < 0.05,
    columns = list(viz_forest(point = "hr", lower = "lo", upper = "hi"))
  )
  p <- tabviz:::serialize_spec(spec)

  # Rows 1 and 2 have pval < 0.05 → style.accent should be TRUE
  expect_true(isTRUE(p$data$rows[[1]]$style$accent))
  expect_true(isTRUE(p$data$rows[[2]]$style$accent))
  # Rows 3 and 4 do not → accent should be absent or FALSE
  expect_true(is.null(p$data$rows[[3]]$style$accent) ||
              isFALSE(p$data$rows[[3]]$style$accent))
  expect_true(is.null(p$data$rows[[4]]$style$accent) ||
              isFALSE(p$data$rows[[4]]$style$accent))
})

test_that("marker_color formula with NA passes through (Layer 4 fall-through)", {
  data <- data.frame(
    label = letters[1:3],
    pval  = c(0.002, 0.04, 0.5),
    hr    = c(0.5, 0.7, 1.0),
    lo    = c(0.4, 0.5, 0.8),
    hi    = c(0.6, 0.9, 1.3)
  )
  spec <- web_spec(
    data = data, label = "label",
    marker_color = ~ ifelse(pval < 0.005, "darkred", NA),
    columns = list(viz_forest(point = "hr", lower = "lo", upper = "hi"))
  )
  p <- tabviz:::serialize_spec(spec)

  # Row 1 (pval=0.002 < 0.005) → markerStyle.color = "darkred"
  expect_equal(p$data$rows[[1]]$markerStyle$color, "darkred")
  # Rows 2, 3 → NA from formula → markerStyle.color absent (fall-through)
  expect_null(p$data$rows[[2]]$markerStyle$color)
  expect_null(p$data$rows[[3]]$markerStyle$color)
})

test_that("row_accent and marker_color formulas coexist in spec (layered)", {
  data <- data.frame(
    label = letters[1:3],
    pval  = c(0.002, 0.04, 0.5),
    hr    = c(0.5, 0.7, 1.0),
    lo    = c(0.4, 0.5, 0.8),
    hi    = c(0.6, 0.9, 1.3)
  )
  spec <- web_spec(
    data = data, label = "label",
    row_accent   = ~ pval < 0.05,
    marker_color = ~ ifelse(pval < 0.005, "darkred", NA),
    columns = list(viz_forest(point = "hr", lower = "lo", upper = "hi"))
  )
  p <- tabviz:::serialize_spec(spec)

  # Row 1: both style.accent=TRUE AND markerStyle.color="darkred" (L4 wins at render)
  expect_true(isTRUE(p$data$rows[[1]]$style$accent))
  expect_equal(p$data$rows[[1]]$markerStyle$color, "darkred")
  # Row 2: accent=TRUE only (L4 is NA, passes through to L3)
  expect_true(isTRUE(p$data$rows[[2]]$style$accent))
  expect_null(p$data$rows[[2]]$markerStyle$color)
  # Row 3: neither set
  expect_true(is.null(p$data$rows[[3]]$style$accent) ||
              isFALSE(p$data$rows[[3]]$style$accent))
  expect_null(p$data$rows[[3]]$markerStyle$color)
})

test_that("semantic cascade works on non-forest viz columns too", {
  data <- data.frame(
    label = letters[1:3],
    pval  = c(0.002, 0.04, 0.5),
    val   = c(10, 20, 30)
  )
  spec <- web_spec(
    data = data, label = "label",
    row_muted = ~ pval > 0.2,
    columns = list(viz_bar(effect_bar("val")))
  )
  p <- tabviz:::serialize_spec(spec)
  # Row 3 (pval=0.5 > 0.2) → style.muted TRUE; the JS side uses this to
  # replace fill (single-effect bar) with theme.colors.muted.
  expect_true(isTRUE(p$data$rows[[3]]$style$muted))
  expect_true(is.null(p$data$rows[[1]]$style$muted) ||
              isFALSE(p$data$rows[[1]]$style$muted))
})

test_that("viz columns integrate with web_spec", {
  data <- data.frame(
    label = c("A", "B", "C"),
    val1 = c(10, 20, 30),
    val2 = c(15, 25, 35)
  )
  data$arr <- list(c(1, 2, 3), c(4, 5, 6), c(7, 8, 9))

  spec <- web_spec(
    data = data,
    label = "label",
    columns = list(
      viz_bar(effect_bar("val1"), effect_bar("val2")),
      viz_boxplot(effect_boxplot(data = "arr")),
      viz_violin(effect_violin(data = "arr"))
    )
  )

  expect_true(inherits(spec, "tabviz::WebSpec"))
  # Label column is auto-prepended, so length is user_columns + 1
  expect_equal(length(spec@columns), 4)
})
