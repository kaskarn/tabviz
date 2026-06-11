# NAMESPACE integrity (2026-06-11). A roxygen block edit once dropped
# export(tabviz) — orphan continuation lines after @export corrupted the
# directive — and NOTHING caught it: devtools::load_all() exports
# everything, so tests passed while the INSTALLED package lost its main
# entry point (masked further by a stale install during docs renders).
# This gate reads the NAMESPACE FILE, not the loaded namespace.
# Regenerate with devtools::document() after touching roxygen blocks.

test_that("core entry points are exported in the NAMESPACE file", {
  # Source-tree gate: under R CMD check the tests run from the INSTALLED
  # package and the repo files aren't there — the gate's job is local +
  # CI-from-source runs.
  skip_if_not(file.exists(test_path("..", "..", "NAMESPACE")),
              "source tree not present (installed-package check)")
  ns <- readLines(test_path("..", "..", "NAMESPACE"))
  core <- c(
    "tabviz", "web_spec", "col_text", "col_numeric", "col_pvalue",
    "viz_forest", "web_theme_nejm", "save_plot", "tabviz_proxy",
    "split_table", "set_component", "set_pin", "set_role"
  )
  missing <- core[!paste0("export(", core, ")") %in% ns]
  expect_identical(missing, character(0),
    info = paste("missing exports:", paste(missing, collapse = ", ")))
})

test_that("every R/ source file is in the DESCRIPTION Collate field", {
  skip_if_not(file.exists(test_path("..", "..", "DESCRIPTION")),
              "source tree not present (installed-package check)")
  desc <- read.dcf(test_path("..", "..", "DESCRIPTION"))
  collate <- desc[1, "Collate"]
  listed <- regmatches(collate, gregexpr("'[^']+'", collate))[[1]]
  listed <- gsub("'", "", listed)
  actual <- list.files(test_path("..", "..", "R"), pattern = "\\.R$")
  missing <- setdiff(actual, listed)
  expect_identical(missing, character(0),
    info = paste("missing from Collate:", paste(missing, collapse = ", ")))
})
