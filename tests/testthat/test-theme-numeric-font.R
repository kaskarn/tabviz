# Phase 12: optional numeric text role.
#
# Mirror of `theme-resolve.test.ts` "numeric text role" describe block.
# Locks the R resolver behavior (defaults + override survival) and the
# wire shape emitted by `serialize_theme()`.

test_that("numeric text role defaults to body family + tabular figures", {
  th <- web_theme()
  expect_equal(th@text@numeric@family, th@text@body@family)
  expect_equal(th@text@numeric@figures, "tabular")
})

test_that("explicit numeric override survives resolution", {
  base <- web_theme()
  base@text@numeric <- TextRole(family = "JetBrains Mono", figures = "tabular")
  th <- base
  expect_equal(th@text@numeric@family, "JetBrains Mono")
  # Body stays put — the numeric override doesn't bleed into other roles.
  expect_false(identical(th@text@body@family, "JetBrains Mono"))
})

test_that("serialize_theme emits text.numeric on the wire", {
  th <- web_theme()
  wire <- tabviz:::serialize_theme(th)
  expect_true(!is.null(wire$text$numeric))
  expect_setequal(
    names(wire$text$numeric),
    c("family", "size", "weight", "figures", "fg", "italic")
  )
})
