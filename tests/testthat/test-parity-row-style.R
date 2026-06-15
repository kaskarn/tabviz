# R<->TS parity for the row_* / marker_* style mapping (the authoring surface
# added 2026-06-15). R resolves each NSE expr to a column NAME and EXTRACTS
# per-row styles into Row.style / Row.markerStyle at serialize time
# (.apply_style_recipe); TS tabviz({ rowBold, markerColor, ... }) extracts the
# same at construction. This runs BOTH on identical data and asserts the
# per-row style objects match exactly — the precious-parity guardrail for the
# new authoring args (CLAUDE.md: authoring-surface changes need parity tests).

# Build the same WebSpec via the TS tabviz() through V8 (callBuilder dispatches
# to the authoring barrel). `data` is row-major plain objects, like the JS API.
ts_tabviz <- function(df, ...) {
  rows_json <- lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
  ts_call("tabviz", c(
    list(
      data    = rows_json,
      label   = "study",
      columns = list(list(field = "study", type = "text", header = "Study", options = list()))
    ),
    list(...)
  ))
}

test_that("row + marker style mapping: R serialize_data == TS tabviz (V8 parity)", {
  skip_if_not_installed("V8")
  df <- data.frame(
    study  = c("A", "B", "C"),
    sig    = c(TRUE, FALSE, TRUE),
    status = c("up", "down", "up"),
    fillc  = c(TRUE, FALSE, FALSE),
    indc   = c(0L, 1L, 2L),
    typec  = c("data", "summary", "data"),
    mcol   = c("#f00", "#00f", "#0f0"),
    msize  = c(8, 4, 6),
    mop    = c(0.9, 0.5, 0.7),
    mshape = c("circle", "square", "diamond"),
    stringsAsFactors = FALSE
  )

  rspec <- tabviz(
    df, label = "study",
    row_bold = ~sig, row_color = ~status, row_emphasis = ~sig,
    row_fill = ~fillc, row_indent = ~indc, row_type = ~typec,
    marker_color = ~mcol, marker_size = ~msize, marker_opacity = ~mop, marker_shape = ~mshape,
    .spec_only = TRUE
  )
  rd <- serialize_data(rspec)

  ts <- ts_tabviz(
    df,
    rowBold = "sig", rowColor = "status", rowEmphasis = "sig",
    rowFill = "fillc", rowIndent = "indc", rowType = "typec",
    markerColor = "mcol", markerSize = "msize", markerOpacity = "mop", markerShape = "mshape"
  )

  # mapequal: same keys + values, order-independent (JSON object key order is
  # not semantically meaningful and R's recipe order ≠ the TS insertion order).
  for (i in seq_len(nrow(df))) {
    expect_mapequal(ts$data$rows[[i]]$style,       rd$rows[[i]]$style)
    expect_mapequal(ts$data$rows[[i]]$markerStyle, rd$rows[[i]]$markerStyle)
  }
})

test_that("no style mappings → neither side attaches a style/markerStyle", {
  skip_if_not_installed("V8")
  df <- data.frame(study = c("A", "B"), stringsAsFactors = FALSE)
  rd <- serialize_data(tabviz(df, label = "study", .spec_only = TRUE))
  ts <- ts_tabviz(df)
  for (i in seq_len(nrow(df))) {
    expect_null(ts$data$rows[[i]]$style)
    expect_null(rd$rows[[i]]$style)
    expect_null(ts$data$rows[[i]]$markerStyle)
    expect_null(rd$rows[[i]]$markerStyle)
  }
})
