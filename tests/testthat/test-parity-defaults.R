# R ↔ TS default-value parity gate.
#
# `R/theme-defaults.R::THEME_DEFAULTS` mirrors a handful of TS-side
# constants (DEFAULT_PAPER_L, DEFAULT_INK_L, ramp anchor defaults).
# These tests assert the numeric values match — when an author edits a
# default TS-side, this test fails and the matching R value has to be
# bumped in lockstep, or vice versa.
#
# Implementation: pull the TS constants via a one-shot V8 read of the
# preset registry. The PRESETS$cochrane object's `anchors.paper`
# embodies the L/C/H defaults (modulo brand-hue propagation through
# neutralHueFrom = "brand"), so reading those round-trips the
# DEFAULT_PAPER_L / DEFAULT_INK_L constants without needing a separate
# TS export.

test_that("THEME_DEFAULTS$paper_L mirrors TS DEFAULT_PAPER_L (via cochrane preset)", {
  # Cochrane is a clean baseline — uses the defaults verbatim (no
  # neutralHueFrom override, no paper_C / ink_C tweaks).
  t <- web_theme_cochrane()
  expect_equal(t@inputs@anchors_paper_L, THEME_DEFAULTS$paper_L)
  expect_equal(t@inputs@anchors_paper_C, THEME_DEFAULTS$paper_C)
  expect_equal(t@inputs@anchors_ink_L,   THEME_DEFAULTS$ink_L)
  expect_equal(t@inputs@anchors_ink_C,   THEME_DEFAULTS$ink_C)
})

test_that("THEME_DEFAULTS clamp ranges mirror the resolver's clamps", {
  # Numeric ranges are also asserted by the S7 validator. This is a
  # belt-and-braces check that the ranges in the registry agree with
  # what `web_theme()` enforces via checkmate.
  expect_error(web_theme(brand = "#0099CC", density_factor = THEME_DEFAULTS$density_factor_max + 0.1))
  expect_error(web_theme(brand = "#0099CC", density_factor = THEME_DEFAULTS$density_factor_min - 0.1))
  expect_silent(web_theme(brand = "#0099CC", density_factor = THEME_DEFAULTS$density_factor_min))
  expect_silent(web_theme(brand = "#0099CC", density_factor = THEME_DEFAULTS$density_factor_max))
})

test_that("DEFAULT_PAPER_ANCHOR and DEFAULT_INK_ANCHOR read from THEME_DEFAULTS (no duplicate magic numbers)", {
  expect_equal(DEFAULT_PAPER_ANCHOR$L, THEME_DEFAULTS$paper_L)
  expect_equal(DEFAULT_PAPER_ANCHOR$C, THEME_DEFAULTS$paper_C)
  expect_equal(DEFAULT_PAPER_ANCHOR$H, THEME_DEFAULTS$paper_H)
  expect_equal(DEFAULT_INK_ANCHOR$L,   THEME_DEFAULTS$ink_L)
  expect_equal(DEFAULT_INK_ANCHOR$C,   THEME_DEFAULTS$ink_C)
  expect_equal(DEFAULT_INK_ANCHOR$H,   THEME_DEFAULTS$ink_H)
  expect_equal(DEFAULT_BRAND_HEX,      THEME_DEFAULTS$brand_hex)
})
