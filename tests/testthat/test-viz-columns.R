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
  e <- effect_violin(data = "values", label = "Test", fill_opacity = 0.3)
  expect_true(inherits(e, "tabviz::VizViolinEffect"))
  expect_equal(e@data, "values")
  expect_equal(e@fill_opacity, 0.3)
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
