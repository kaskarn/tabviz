# Tests for the outbound observability surface:
#   tabviz_state() / tabviz_state_envelope() helpers
#   initial_sort / initial_filters / initial_hidden_columns plumbing
#   serialize_initial_state() shape

# A fake `input` that mimics Shiny's $-indexed list. Just a plain named list.
fake_input <- function(...) list(...)

# ----------------------------------------------------------------------------
# tabviz_state() / tabviz_state_envelope()
# ----------------------------------------------------------------------------

test_that("tabviz_state_envelope returns NULL for unset inputs", {
  out <- tabviz_state_envelope(fake_input(), "tbl")
  expect_named(out, tabviz:::TABVIZ_STATE_FIELDS)
  expect_true(all(vapply(out, is.null, logical(1))))
})

test_that("tabviz_state_envelope keeps the envelope intact", {
  inp <- fake_input(
    tbl_sort = list(value = list(column = "x", direction = "asc"),
                    source = "user", ts = 1700000000000)
  )
  out <- tabviz_state_envelope(inp, "tbl")
  expect_equal(out$sort$source, "user")
  expect_equal(out$sort$value$column, "x")
})

test_that("tabviz_state strips the envelope and returns raw values", {
  inp <- fake_input(
    tbl_sort = list(
      value = list(column = "x", direction = "desc"),
      source = "proxy", ts = 1700000000000
    ),
    tbl_selected = list(value = c("r1", "r2"), source = "user", ts = 1)
  )
  state <- tabviz_state(inp, "tbl")
  expect_equal(state$sort, list(column = "x", direction = "desc"))
  expect_equal(state$selected, c("r1", "r2"))
  # Unset dimensions remain NULL.
  expect_null(state$filters)
})

test_that("tabviz_state covers every documented dimension", {
  inp <- fake_input()
  state <- tabviz_state(inp, "tbl")
  expected <- c(
    "sort", "filters", "row_styles", "cell_styles", "paint_tool",
    "selected", "hover", "collapsed_groups", "hidden_columns",
    "column_order", "column_widths", "cell_edits", "label_edits", "zoom",
    "axis_zooms", "banding", "plot_width",
    "visible_rows"
  )
  expect_setequal(names(state), expected)
})

test_that("tabviz_state_envelope rejects non-string id", {
  expect_error(tabviz_state_envelope(fake_input(), 123), "id")
})

# ----------------------------------------------------------------------------
# Initial-state validation at the tabviz() boundary
# ----------------------------------------------------------------------------

mini_data <- data.frame(
  study = c("A", "B", "C"),
  est = c(0.5, 1.2, 0.9),
  lo = c(0.3, 0.9, 0.7),
  hi = c(0.7, 1.5, 1.1),
  stringsAsFactors = FALSE
)

test_that("initial_sort accepts a valid spec and lands on @initial_state", {
  spec <- tabviz(
    data = mini_data, label = "study",
    initial_sort = list(column = "est", direction = "desc"),
    .spec_only = TRUE
  )
  expect_equal(spec@initial_state$sort,
               list(column = "est", direction = "desc"))
})

test_that("initial_sort rejects an invalid direction", {
  expect_error(
    tabviz(
      data = mini_data, label = "study",
      initial_sort = list(column = "est", direction = "sideways"),
      .spec_only = TRUE
    ),
    "direction"
  )
})

test_that("initial_sort rejects a missing column field", {
  expect_error(
    tabviz(
      data = mini_data, label = "study",
      initial_sort = list(direction = "asc"),
      .spec_only = TRUE
    ),
    "column"
  )
})

test_that("initial_filters lands as a list of {field, operator, value}", {
  spec <- tabviz(
    data = mini_data, label = "study",
    initial_filters = list(study = list(operator = "eq", value = "A")),
    .spec_only = TRUE
  )
  expect_length(spec@initial_state$filters, 1L)
  f <- spec@initial_state$filters[[1]]
  expect_equal(f$field, "study")
  expect_equal(f$operator, "eq")
  expect_equal(f$value, "A")
})

test_that("initial_filters rejects an invalid operator", {
  expect_error(
    tabviz(
      data = mini_data, label = "study",
      initial_filters = list(study = list(operator = "starts_with", value = "A")),
      .spec_only = TRUE
    ),
    "operator"
  )
})

test_that("initial_hidden_columns is normalized to a list of strings", {
  spec <- tabviz(
    data = mini_data, label = "study",
    initial_hidden_columns = c("hi"),
    .spec_only = TRUE
  )
  expect_equal(spec@initial_state$hidden_columns, list("hi"))
})

test_that("no initial_* args ⇒ initial_state is NULL", {
  spec <- tabviz(data = mini_data, label = "study", .spec_only = TRUE)
  expect_null(spec@initial_state)
})

# ----------------------------------------------------------------------------
# Serialization round-trip
# ----------------------------------------------------------------------------

test_that("serialize_initial_state produces the JSON-side keys", {
  out <- tabviz:::serialize_initial_state(list(
    sort = list(column = "x", direction = "asc"),
    filters = list(list(field = "f", operator = "eq", value = "v")),
    hidden_columns = list("c1", "c2")
  ))
  expect_named(out, c("sort", "filters", "hiddenColumns"))
  expect_equal(out$sort$direction, "asc")
  expect_equal(out$filters[[1]]$field, "f")
  expect_equal(as.character(out$hiddenColumns), c("c1", "c2"))
})

test_that("serialize_initial_state passes NULL through as NULL", {
  expect_null(tabviz:::serialize_initial_state(NULL))
})

test_that("serialized spec carries an initialState top-level key", {
  spec <- tabviz(
    data = mini_data, label = "study",
    initial_sort = list(column = "est", direction = "desc"),
    .spec_only = TRUE
  )
  payload <- tabviz:::serialize_spec(spec)
  expect_true("initialState" %in% names(payload))
  expect_equal(payload$initialState$sort$direction, "desc")
})

test_that("serialized spec omits initialState when nothing was set", {
  spec <- tabviz(data = mini_data, label = "study", .spec_only = TRUE)
  payload <- tabviz:::serialize_spec(spec)
  # The slot is present in the list (named) but its value is NULL.
  expect_null(payload$initialState)
})
