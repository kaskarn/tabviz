# Locks the I()-wrapped LENGTH-1 array invariant on the wire.
#
# The widget serializer runs `jsonlite::toJSON(serialize_spec(spec),
# auto_unbox = TRUE)`. auto_unbox collapses a length-1 vector to a JSON SCALAR
# — but several wire fields MUST be arrays on the TS side (`tooltipFields`
# drives `fields.includes()`; `hiddenColumns` / `expandedRows` / `splitVars`
# are iterated). The serializer defends each with `I(...)`. Remove an `I()`,
# or add a new array field without one, and the wire silently degrades to a
# scalar with NO existing test to catch it. This is that test (R serialize
# review, 2026-06-15 — the I() sites were correct but unguarded).

to_wire <- function(x) {
  json <- jsonlite::toJSON(x, auto_unbox = TRUE, null = "null", na = "null")
  # simplifyVector = FALSE so a JSON array parses to an R list and a scalar
  # parses to an atomic — that distinction IS the assertion.
  jsonlite::fromJSON(json, simplifyVector = FALSE)
}

test_that("length-1 spec array fields survive auto_unbox as JSON arrays", {
  df <- data.frame(study = c("A", "B"), n = c(1, 2), stringsAsFactors = FALSE)
  spec <- tabviz(
    df, label = "study",
    columns = list(col_text("study"), col_numeric("n")),
    .spec_only = TRUE
  )
  # Length-1 values for every I()-guarded single-spec field.
  spec@initial_state <- list(hidden_columns = "n", expanded_rows = "row-A")
  spec@interaction@tooltip_fields <- "study"

  parsed <- to_wire(serialize_spec(spec))

  expect_type(parsed$initialState$hiddenColumns, "list")
  expect_length(parsed$initialState$hiddenColumns, 1)
  expect_identical(parsed$initialState$hiddenColumns[[1]], "n")

  expect_type(parsed$initialState$expandedRows, "list")
  expect_length(parsed$initialState$expandedRows, 1)

  expect_type(parsed$interaction$tooltipFields, "list")
  expect_length(parsed$interaction$tooltipFields, 1)
  expect_identical(parsed$interaction$tooltipFields[[1]], "study")
})

test_that("split_table splitVars stays a JSON array for a single split var", {
  df <- data.frame(
    grp = c("X", "X", "Y"), study = c("A", "B", "C"),
    hr = c(0.8, 1.1, 0.7), lo = c(0.6, 0.9, 0.5), hi = c(1.0, 1.3, 0.9),
    stringsAsFactors = FALSE
  )
  st <- split_table(
    tabviz(df, label = "study", columns = list(viz_forest("hr", "lo", "hi")),
           .spec_only = TRUE),
    by = "grp"  # SINGLE split var — the auto_unbox hazard
  )
  parsed <- to_wire(serialize_split_table(st))
  expect_type(parsed$splitVars, "list")
  expect_length(parsed$splitVars, 1)
  expect_identical(parsed$splitVars[[1]], "grp")
})
