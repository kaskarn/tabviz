# Docs-drift gate (column-ontology review, 2026-06-11).
#
# docs/guide/columns.qmd carries a CURATED quick-reference table of col_*
# helpers and their key arguments. Curation is deliberate (it documents
# the R authoring surface, including sugar args that never reach the
# wire) — but curated tables rot: the D2 deletions found two stale rows
# (show_bar, whisker_type) advertising deleted knobs. This gate parses
# the table and asserts every documented helper exists and every
# documented argument is in its formals. It does NOT demand completeness
# — only honesty.

test_that("columns.qmd quick-reference table matches the live R surface", {
  qmd <- file.path(testthat::test_path(), "..", "..", "docs", "guide", "columns.qmd")
  skip_if_not(file.exists(qmd), "docs/guide/columns.qmd not found")
  lines <- readLines(qmd, warn = FALSE)

  # Table rows look like: | `col_text(field)` | ... | `max_chars`, `wrap` |
  rows <- grep("^\\|\\s*`col_[a-z_]+\\(", lines, value = TRUE)
  expect_gt(length(rows), 10) # the table exists and was found

  problems <- character(0)
  for (row in rows) {
    cells <- strsplit(row, "\\|")[[1]]
    cells <- trimws(cells[nzchar(trimws(cells))])
    helper <- sub("^`(col_[a-z_]+)\\(.*$", "\\1", cells[[1]])
    if (!exists(helper, envir = asNamespace("tabviz"), inherits = FALSE)) {
      problems <- c(problems, sprintf("%s: helper does not exist", helper))
      next
    }
    fmls <- names(formals(get(helper, envir = asNamespace("tabviz"))))
    # Last cell: backticked key-option names.
    args <- regmatches(cells[[length(cells)]],
                       gregexpr("`([a-z_0-9]+)`", cells[[length(cells)]]))[[1]]
    args <- gsub("`", "", args)
    for (a in args) {
      if (!a %in% fmls) {
        problems <- c(problems,
          sprintf("%s: documented arg `%s` is not in formals()", helper, a))
      }
    }
  }
  expect_identical(problems, character(0))
})
