# Spacing-token roster sync (D42 — the per-token Spacing tab).
#
# The spacing-token roster lives in hand-maintained sources that must agree:
#   - TS: SPACING_TOKEN_KEYS in srcjs/src/lib/theme/spacing-tokens.ts (camelCase;
#     drives the `spacing_overrides` resolver merge + theme-wire validation)
#   - R:  TABVIZ_SPACING_TOKENS in R/classes-theme.R (camelCase; drives the
#     ThemeInputs validator + untrusted theme-wire import)
#   - R:  the SpacingTokens S7 class properties (snake_case; the resolved cluster)
#   - TS: the DENSITY_PX keys (snake_case; the density presets)
# A token added on one side but not the others is silently stripped from
# imported wires or unrepresentable in the resolved cluster. This source-parse
# doc-test asserts the rosters match — same pattern as
# test-interaction-roster-sync.R.
#
# Runs in R-CMD-check's in-tree step under `library(tabviz)` where these
# internals aren't on the search path; bind via `tabviz:::`.
TABVIZ_SPACING_TOKENS <- tabviz:::TABVIZ_SPACING_TOKENS

to_snake <- function(x) tolower(gsub("([A-Z])", "_\\1", x))

test_that("R TABVIZ_SPACING_TOKENS matches TS SPACING_TOKEN_KEYS", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "lib", "theme",
                                 "spacing-tokens.ts")
  skip_if_not(file.exists(ts_path), "srcjs source tree not present")

  src <- paste(readLines(ts_path, warn = FALSE), collapse = "\n")
  block <- regmatches(
    src,
    regexpr("SPACING_TOKEN_KEYS = \\[[^]]*\\]", src)
  )
  expect_length(block, 1L)
  ts_keys <- regmatches(block, gregexpr('"[A-Za-z]+"', block))[[1]]
  ts_keys <- gsub('"', "", ts_keys)
  expect_equal(length(ts_keys), 15L)
  expect_setequal(ts_keys, TABVIZ_SPACING_TOKENS)
})

test_that("R SpacingTokens S7 properties match the roster (snake_case)", {
  props <- names(S7::props(tabviz:::SpacingTokens()))
  expect_setequal(props, to_snake(TABVIZ_SPACING_TOKENS))
})

test_that("TS DENSITY_PX keys match the roster (snake_case)", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "lib", "theme",
                                 "density-presets.ts")
  skip_if_not(file.exists(ts_path), "srcjs source tree not present")

  src <- paste(readLines(ts_path, warn = FALSE), collapse = "\n")
  # Grab the `compact: { ... }` preset body and pull its keys.
  block <- regmatches(src, regexpr("compact:\\s*\\{[^}]*\\}", src))
  expect_length(block, 1L)
  keys <- regmatches(block, gregexpr("([a-z_]+):", block))[[1]]
  keys <- setdiff(gsub(":", "", keys), "compact") # drop the preset-name key
  expect_setequal(keys, to_snake(TABVIZ_SPACING_TOKENS))
})

test_that("web_theme() accepts spacing_overrides and round-trips it", {
  th <- web_theme(brand = "#4477AA",
                  spacing_overrides = list(rowHeight = 44, footerGap = 4))
  wire <- theme_to_wire(th)
  expect_equal(wire$inputs$spacing_overrides$rowHeight, 44)
  expect_equal(wire$inputs$spacing_overrides$footerGap, 4)

  back <- theme_from_wire(wire)
  expect_equal(back@inputs@spacing_overrides$rowHeight, 44)
  expect_equal(back@inputs@spacing_overrides$footerGap, 4)
})

test_that("spacing_overrides applies through the V8 resolve (R<->TS parity)", {
  base <- web_theme(brand = "#4477AA", density = "comfortable")
  over <- web_theme(brand = "#4477AA", density = "comfortable",
                    spacing_overrides = list(rowHeight = 44, footerGap = 3))
  expect_equal(over@spacing@row_height, 44)       # override applied
  expect_equal(over@spacing@footer_gap, 3)        # override applied
  expect_equal(over@spacing@header_height,
               base@spacing@header_height)        # untouched token inherits density
})

test_that("ThemeInputs validator rejects bad spacing_overrides on construction", {
  expect_error(
    web_theme(brand = "#4477AA", spacing_overrides = list(rowHeight = 9999)),
    "in \\[8, 120\\]"
  )
  expect_error(
    web_theme(brand = "#4477AA", spacing_overrides = list(bogus = 12)),
    "unknown token"
  )
  expect_error(
    web_theme(brand = "#4477AA", spacing_overrides = list(rowHeight = Inf)),
    "finite"
  )
})

test_that("untrusted wire drops unknown tokens + non-finite + out-of-bounds", {
  wire <- theme_to_wire(web_theme(brand = "#4477AA"))
  wire$inputs$spacing_overrides <- list(
    rowHeight   = 44,      # kept
    cellPaddingX = 999,    # clamped to 40
    bogus       = 12,      # unknown -> dropped
    padding     = Inf      # non-finite -> dropped
  )
  back <- theme_from_wire(wire)
  expect_equal(back@inputs@spacing_overrides$rowHeight, 44)
  expect_equal(back@inputs@spacing_overrides$cellPaddingX, 40)
  expect_null(back@inputs@spacing_overrides$bogus)
  expect_null(back@inputs@spacing_overrides$padding)
})
