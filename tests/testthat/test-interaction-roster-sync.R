# Interaction capability-flag roster sync (interactivity review pass).
#
# The flag roster lives in TWO hand-maintained sources that must agree:
#   - TS: INTERACTION_FLAG_KEYS in srcjs/src/lib/interaction-resolve.ts
#     (camelCase; drives the 4-tier resolution + theme-wire validation)
#   - R: TABVIZ_INTERACTION_FLAGS in R/classes-components.R (snake_case;
#     drives the ThemeInputs validator + untrusted theme-wire import)
# A flag added on one side but not the other is silently stripped from
# imported theme wires (or rejected at the other side's ingress). This
# doc-test reads the TS source and asserts the rosters match — the same
# pattern as test-theme-roster-sync.R.

test_that("R TABVIZ_INTERACTION_FLAGS matches TS INTERACTION_FLAG_KEYS", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "lib",
                                 "interaction-resolve.ts")
  skip_if_not(file.exists(ts_path), "srcjs source tree not present")

  src <- paste(readLines(ts_path, warn = FALSE), collapse = "\n")
  block <- regmatches(
    src,
    regexpr("INTERACTION_FLAG_KEYS = \\[[^]]*\\]", src)
  )
  expect_length(block, 1L)
  ts_flags <- regmatches(block, gregexpr('"[A-Za-z]+"', block))[[1]]
  ts_flags <- gsub('"', "", ts_flags)
  expect_gt(length(ts_flags), 10L)

  to_snake <- function(x) tolower(gsub("([A-Z])", "_\\1", x))
  expect_setequal(to_snake(ts_flags), TABVIZ_INTERACTION_FLAGS)

  # web_interaction() must accept every flag as an argument (minus the
  # deprecated show_filters alias, which is a trailing lifecycle arg).
  args <- names(formals(web_interaction))
  expect_true(all(setdiff(TABVIZ_INTERACTION_FLAGS, "show_filters") %in% args))
})

test_that("FIGURE_LAYOUT_ROW_KINDS matches the TS RowKind union minus panel", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "lib",
                                 "layout", "row-kind.ts")
  skip_if_not(file.exists(ts_path), "srcjs source tree not present")
  src <- paste(readLines(ts_path, warn = FALSE), collapse = "\n")
  union_line <- regmatches(
    src, regexpr("export type RowKind = [^;]*;", src)
  )
  kinds <- gsub('"', "", regmatches(union_line, gregexpr('"[a-z_]+"', union_line))[[1]])
  expect_setequal(setdiff(kinds, "panel"), FIGURE_LAYOUT_ROW_KINDS)
})
