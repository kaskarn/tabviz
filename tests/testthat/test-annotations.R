# Tests for annotations and interaction specs

test_that("refline creates valid ReferenceLine", {
  rl <- refline(1)
  expect_true(inherits(rl, "tabviz::ReferenceLine"))
  expect_equal(rl@x, 1)
  expect_equal(rl@style, "dashed")
  expect_equal(rl@width, 1)
  expect_equal(rl@opacity, 0.6)
})

test_that("refline accepts custom parameters", {
  rl <- refline(0.5, label = "Threshold", style = "solid",
                color = "#ff0000", width = 2, opacity = 0.8)
  expect_equal(rl@label, "Threshold")
  expect_equal(rl@style, "solid")
  expect_equal(rl@color, "#ff0000")
  expect_equal(rl@width, 2)
  expect_equal(rl@opacity, 0.8)
})

test_that("refline validates style choices", {
  expect_error(refline(1, style = "invalid"), "arg.*should be one of")
})

test_that("ReferenceLine validates properties", {
  expect_error(ReferenceLine(x = 1, style = "wavy"))
  expect_error(ReferenceLine(x = 1, width = -1))
  expect_error(ReferenceLine(x = 1, opacity = 1.5))
})

test_that("forest_annotation creates valid CustomAnnotation", {
  ann <- forest_annotation("row_1")
  expect_true(inherits(ann, "tabviz::CustomAnnotation"))
  expect_equal(ann@study_id, "row_1")
  expect_equal(ann@shape, "circle")
  expect_equal(ann@position, "after")
  expect_equal(ann@color, "#8b5cf6")
  expect_equal(ann@size, 1.0)
})

test_that("forest_annotation accepts custom parameters", {
  ann <- forest_annotation("row_1", shape = "star", position = "overlay",
                           color = "#ff0000", size = 2.0)
  expect_equal(ann@shape, "star")
  expect_equal(ann@position, "overlay")
  expect_equal(ann@color, "#ff0000")
  expect_equal(ann@size, 2.0)
})

test_that("forest_annotation validates shape and position", {
  expect_error(forest_annotation("row_1", shape = "invalid"), "arg.*should be one of")
  expect_error(forest_annotation("row_1", position = "invalid"), "arg.*should be one of")
})

test_that("web_interaction creates default InteractionSpec", {
  inter <- web_interaction()
  expect_true(inherits(inter, "tabviz::InteractionSpec"))
  expect_false(inter@show_filters)
  expect_true(inter@show_legend)
  expect_true(inter@enable_sort)
  expect_true(inter@enable_collapse)
  expect_true(inter@enable_select)
  expect_true(inter@enable_hover)
  expect_true(inter@enable_resize)
  expect_true(inter@enable_export)
  expect_null(inter@tooltip_fields)
  expect_equal(inter@enable_themes, "default")
})

test_that("web_interaction accepts custom params", {
  inter <- web_interaction(
    enable_filters = TRUE,
    show_legend = FALSE,
    enable_sort = FALSE,
    enable_export = FALSE,
    tooltip_fields = c("study", "n")
  )
  expect_true(inter@enable_filters)
  expect_false(inter@show_legend)
  expect_false(inter@enable_sort)
  expect_false(inter@enable_export)
  expect_equal(inter@tooltip_fields, c("study", "n"))
})

test_that("web_interaction(show_filters=) is deprecated and forwards to enable_filters", {
  expect_warning(
    inter <- web_interaction(show_filters = TRUE, enable_filters = FALSE),
    "deprecated"
  )
  expect_true(inter@enable_filters)
})

test_that("web_interaction_minimal returns minimal interaction", {
  inter <- web_interaction_minimal()
  expect_false(inter@enable_sort)
  expect_false(inter@enable_collapse)
  expect_false(inter@enable_select)
  expect_false(inter@enable_resize)
  expect_false(inter@enable_export)
  expect_true(inter@enable_hover)
})

test_that("web_interaction_publication returns publication interaction", {
  inter <- web_interaction_publication()
  expect_false(inter@show_filters)
  expect_false(inter@show_legend)
  expect_false(inter@enable_sort)
  expect_false(inter@enable_collapse)
  expect_false(inter@enable_select)
  expect_false(inter@enable_hover)
  expect_false(inter@enable_resize)
  expect_false(inter@enable_export)
})

# Error handling tests

test_that("web_spec handles empty data frame", {
  data <- data.frame(label = character(0), value = numeric(0))
  # Empty data should still create a valid spec
  spec <- web_spec(
    data = data,
    label = "label",
    columns = list(col_text("value"))
  )
  expect_equal(nrow(spec@data), 0)
})

test_that("web_spec errors on missing forest column references", {
  data <- data.frame(
    label = c("A", "B"),
    point = c(1, 2)
  )

  expect_error(
    web_spec(
      data = data,
      label = "label",
      columns = list(
        viz_forest(point = "point", lower = "nonexistent", upper = "also_missing")
      )
    ),
    "nonexistent|not found"
  )
})
