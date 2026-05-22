# Drift gate: R `col_*` function defaults match `R/schema-defaults.R`
# (which is generated from the TS column schema). If this test fails,
# either (a) someone changed a default in the schema without
# regenerating, or (b) someone hand-edited the R function default
# without updating the schema.
#
# Fix path: edit `srcjs/src/schema/columns/<type>.ts`, then
# `cd srcjs && bun run scripts/regenerate-schema.ts`, then update the
# R function's default-arg literal to match.

library(testthat)

# Pull the R-side argument default for a function by name. Returns the
# default *expression* (unevaluated). For literal defaults this matches
# the schema value directly; for `NULL` defaults (no default) we return
# NULL.
fn_default <- function(fn, arg) {
  fmls <- formals(fn)
  if (!arg %in% names(fmls)) return(NULL)
  d <- fmls[[arg]]
  # NULL default in formals appears as a symbol or NULL; coerce empty
  # `quote()` (no default) to NA so we can distinguish.
  if (missing(d) || identical(d, quote(expr = ))) return(NA)
  eval(d)
}

test_that("col_percent defaults track schema", {
  s <- tabviz:::schema_defaults$percent
  expect_equal(fn_default(col_percent, "decimals"), s$decimals)
  expect_equal(fn_default(col_percent, "multiply"), s$multiply)
  expect_equal(fn_default(col_percent, "symbol"),   s$symbol)
})

test_that("col_numeric defaults track schema", {
  s <- tabviz:::schema_defaults$numeric
  expect_equal(fn_default(col_numeric, "decimals"),     s$decimals)
  expect_equal(fn_default(col_numeric, "thousands_sep"), s$thousands_sep)
  expect_equal(fn_default(col_numeric, "abbreviate"),    s$abbreviate)
})
