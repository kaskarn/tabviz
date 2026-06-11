# Numeric text role — v4 surface (rewritten in W4 when the v3 blob
# `text` cluster was deleted, 2026-06-11).
#
# The old version pinned the S7 `@text@numeric` slot, including a
# post-construction MUTATION path (`base@text@numeric <- TextRole(...)`)
# that never reached the wire — serialize_theme rebuilds the blob from
# inputs, so the mutation was a silent no-op everywhere except the S7
# object itself. The REAL authoring surface is the `fonts$numeric`
# input; the real consumers read `--tv-text-numeric-*` tokens.

test_that("numeric role defaults to the body family + tabular figures", {
  v <- theme_css_vars(web_theme())
  expect_identical(v[["--tv-text-numeric-family"]], v[["--tv-text-body-family"]])
  expect_identical(unname(v[["--tv-text-numeric-figures"]]), "tnum")
})

test_that("the fonts$numeric input drives the numeric family token", {
  th <- web_theme(fonts_numeric = "JetBrains Mono")
  v <- theme_css_vars(th)
  expect_identical(unname(v[["--tv-text-numeric-family"]]), "JetBrains Mono")
  # Body stays put — the numeric input doesn't bleed into other roles.
  expect_false(identical(v[["--tv-text-body-family"]], "JetBrains Mono"))
})

test_that("the blob no longer carries the v3 text cluster", {
  wire <- tabviz:::serialize_theme(web_theme())
  expect_null(wire$text)
})
