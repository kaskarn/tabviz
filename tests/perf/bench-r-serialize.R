# R-side serialization bench. Measures per-stage init time for the
# tabviz pipeline at the user's stated workload (1k rows total / 10
# subsets) plus a single-spec baseline. Companion to the TS-side
# `srcjs/tests/perf/` (algorithmic, Bun) and `srcjs/tests/browser/`
# (real-Chrome via Puppeteer) bench harnesses.
#
# Run from the repo root:
#   Rscript tests/perf/bench-r-serialize.R
#
# To diff before/after a refactor:
#   1. Rscript tests/perf/bench-r-serialize.R > /tmp/bench-before.txt
#   2. (make changes; devtools::install(quick = TRUE))
#   3. Rscript tests/perf/bench-r-serialize.R > /tmp/bench-after.txt
#   4. diff /tmp/bench-before.txt /tmp/bench-after.txt
#
# Stages timed: split_table() (incl. ts_call V8 round-trip), serialize_
# split_table(), jsonlite::toJSON of the payload, forest_plot_split()
# factory (htmlwidgets::createWidget), plus single-spec forest_plot()
# with and without pagination.
#
# Reference numbers (Apple Silicon, R 4.5.2, late 2026 — for *change-
# direction* tracking only; absolute numbers are machine-specific):
#   * Single 1k-row forest_plot():       ~290 ms (post Phase 4.1)
#   * 1k / 10 subsets, both shared:     ~1100 ms R-side total
#   * 1k / 10 subsets, shared_axis:     ~780 ms R-side total
#
# Known floors:
#   * V8 round-trip overhead for ts_call shared computation adds
#     ~300-350 ms when both shared_axis AND shared_column_widths are set.
#     Caused by JSON serialize/parse across the bridge. See
#     R/split_table.R::.subset_payload_for_shared.

suppressPackageStartupMessages(library(tabviz))

make_df <- function(n_rows, n_groups) {
  set.seed(42)
  hr <- round(runif(n_rows, 0.3, 1.8), 3)
  data.frame(
    study  = sprintf("Study-%04d", seq_len(n_rows)),
    n      = sample(50:5000, n_rows, replace = TRUE),
    events = sample(5:200, n_rows, replace = TRUE),
    hr     = hr,
    lower  = pmax(0.05, hr - 0.2),
    upper  = hr + 0.2,
    pvalue = runif(n_rows, 0, 0.5),
    region = sample(sprintf("R%02d", seq_len(n_groups)), n_rows, replace = TRUE),
    cohort = sample(c("A", "B", "C"), n_rows, replace = TRUE),
    stringsAsFactors = FALSE
  )
}

build_spec <- function(df, paginate = NULL) {
  args <- list(
    data = df, label = "study",
    columns = list(
      col_n("n"),
      col_n("events"),
      col_numeric("hr", decimals = 2),
      col_pvalue("pvalue"),
      col_text("cohort"),
      viz_forest(point = "hr", lower = "lower", upper = "upper")
    ),
    .spec_only = TRUE
  )
  if (!is.null(paginate)) args$paginate <- paginate
  do.call(tabviz, args)
}

bench <- function(label, thunk) {
  thunk(); thunk()
  ts <- vapply(seq_len(3), function(.) {
    t <- system.time(thunk(), gcFirst = FALSE)
    unname(t["elapsed"])
  }, numeric(1))
  cat(sprintf("  %-46s median %7.1f ms (min %.1f, max %.1f)\n",
              label, median(ts) * 1000, min(ts) * 1000, max(ts) * 1000))
}

modes <- list(
  list(label = "no pagination",  paginate = NULL),
  list(label = "with paginate(rows=20)", paginate = paginate_spec(rows = 20))
)

for (m in modes) {
  cat(sprintf("\n# 10 subsets x 100 rows (1000 total) -- %s\n", m$label))
  df <- make_df(1000, 10)
  spec <- build_spec(df, m$paginate)

  bench("split_table(shared_axis=TRUE)",
        function() split_table(spec, by = "region", shared_axis = TRUE))
  bench("split_table(both shared)",
        function() split_table(spec, by = "region",
                               shared_axis = TRUE, shared_column_widths = TRUE))

  sf <- split_table(spec, by = "region", shared_axis = TRUE)
  bench("serialize_split_table()",
        function() tabviz:::serialize_split_table(sf, include_forest = TRUE))

  payload <- tabviz:::serialize_split_table(sf, include_forest = TRUE)
  bench("toJSON(payload)",
        function() jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", na = "null"))

  bench("forest_plot_split() factory",
        function() tabviz:::forest_plot_split(sf))
}

# Single non-split baseline for comparison
cat("\n# 1000 rows single-spec (no split) -- baseline\n")
df <- make_df(1000, 1)
spec <- build_spec(df)
bench("tabviz() + forest_plot()  no paginate",
      function() tabviz:::forest_plot(spec))
spec_p <- build_spec(df, paginate_spec(rows = 20))
bench("tabviz() + forest_plot()  paginate=20",
      function() tabviz:::forest_plot(spec_p))
