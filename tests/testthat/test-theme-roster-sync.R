# Roster sync — R↔TS theme registries must list the same themes.
#
# `package_themes()` flattens to the set of R-side theme constructors;
# the bundled JS exposes a `themeX` builder for each via `callBuilder`.
# Either side adding or dropping a theme without the other fails here.
#
# Pair this with `test-theme-css.R` (R↔TS resolved-output comparison: the
# R wrapper and the TS engine, run via V8, must emit identical theme CSS) for
# full R↔TS theme drift detection.

EXPECTED_THEME_NAMES <- c(
  "cochrane", "lancet", "jama", "nejm", "nature", "bmj", "dark",
  "bauhaus", "swiss", "tufte", "newsprint",
  "solarized", "solarized_dark", "tonal", "tonal_dark",
  "dwarven", "elvish", "hobbit",
  "synthwave", "brutalist", "atelier", "executive",
  "ledger", "terminal", "aurora", "blueprint", "sunprint"
)

# snake_case → camelCase builder symbol.
.theme_builder_name <- function(theme_name) {
  parts <- strsplit(theme_name, "_", fixed = TRUE)[[1]]
  capitalized <- paste0(toupper(substring(parts, 1, 1)), substring(parts, 2))
  paste0("theme", paste(capitalized, collapse = ""))
}

test_that("package_themes() roster matches the expected list", {
  flat <- unlist(lapply(package_themes(), names), use.names = FALSE)
  testthat::expect_setequal(flat, EXPECTED_THEME_NAMES)
})

test_that("each R theme has a TS builder reachable via V8 callBuilder", {
  ctx <- tabviz_v8()
  for (name in EXPECTED_THEME_NAMES) {
    builder <- .theme_builder_name(name)
    # callBuilder throws "no such builder" if the symbol isn't exported
    # from the TS authoring barrel. Use a tryCatch to convert that into a
    # clean assertion message.
    err <- NULL
    result <- tryCatch(
      ctx$call("callBuilder", builder, "{}"),
      error = function(e) { err <<- conditionMessage(e); NULL }
    )
    testthat::expect_null(
      err,
      info = sprintf("TS builder `%s` should exist for R theme `web_theme_%s`",
                     builder, name)
    )
  }
})

test_that("each R web_theme_X() constructor is exported", {
  for (name in EXPECTED_THEME_NAMES) {
    fn_name <- paste0("web_theme_", name)
    testthat::expect_true(
      exists(fn_name, envir = asNamespace("tabviz"), mode = "function"),
      info = sprintf("R-side `%s()` should exist", fn_name)
    )
  }
})
