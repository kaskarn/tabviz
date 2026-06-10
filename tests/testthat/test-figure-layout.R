# Figure-layout state block (interactivity-UX arc P1; wire 1.4).
#
# `spec@figure_layout` carries interactive layout pins (column widths /
# column order / row-kind height pins) onto the wire as `figureLayout`.
# The canonical flow is a Shiny round-trip: input$<id>_column_widths +
# input$<id>_row_kind_heights → set_figure_layout() → re-render. The
# serializer is liberal (Shiny inputs arrive as named lists of length-1
# numerics) and drops malformed entries instead of erroring.

test_that("set_figure_layout attaches the block to a spec", {
  df <- data.frame(study = c("A", "B"), hr = c(1.1, 0.9))
  spec <- tabviz(df, label = "study", .spec_only = TRUE) |>
    set_figure_layout(
      column_widths = list(hr = 120),
      row_kind_heights = list(data = 36, spacer = 12)
    )
  expect_equal(spec@figure_layout$column_widths$hr, 120)
  expect_equal(spec@figure_layout$row_kind_heights$data, 36)
})

test_that("set_figure_layout with no arguments clears the block", {
  df <- data.frame(study = "A", hr = 1)
  spec <- tabviz(df, label = "study", .spec_only = TRUE) |>
    set_figure_layout(column_widths = list(hr = 100)) |>
    set_figure_layout()
  expect_null(spec@figure_layout)
})

test_that("figureLayout serializes to camelCase wire shape", {
  df <- data.frame(study = c("A", "B"), hr = c(1.1, 0.9))
  spec <- tabviz(df, label = "study", .spec_only = TRUE) |>
    set_figure_layout(
      column_widths = list(hr = 120.4),
      row_kind_heights = list(data = 36),
      column_order = list(top_level = c("hr", "label"))
    )
  wire <- serialize_spec(spec)
  expect_equal(wire$figureLayout$columnWidths$hr, 120.4)
  expect_equal(wire$figureLayout$rowKindHeights$data, 36)
  expect_equal(unlist(wire$figureLayout$columnOrder$topLevel), c("hr", "label"))
})

test_that("absent block serializes to NULL", {
  df <- data.frame(study = "A", hr = 1)
  wire <- serialize_spec(tabviz(df, label = "study", .spec_only = TRUE))
  expect_null(wire$figureLayout)
})

test_that("serialize_figure_layout drops malformed entries", {
  out <- serialize_figure_layout(list(
    column_widths = list(a = 100, bad = "wide", nope = -3, inf = Inf),
    row_kind_heights = list(data = NA_real_),
    column_order = list(top_level = character(0))
  ))
  expect_equal(names(out), "columnWidths")
  expect_equal(out$columnWidths, list(a = 100))

  expect_null(serialize_figure_layout(NULL))
  expect_null(serialize_figure_layout(list()))
  expect_null(serialize_figure_layout("not a list"))
})

test_that("serialize_figure_layout accepts Shiny-shaped camelCase input too", {
  # A round-tripped input$<id>_state bundle may carry camelCase keys.
  out <- serialize_figure_layout(list(
    columnWidths = list(a = 80),
    rowKindHeights = list(spacer = 10)
  ))
  expect_equal(out$columnWidths$a, 80)
  expect_equal(out$rowKindHeights$spacer, 10)
})
