# Plot-label slot modifiers (set_title / set_subtitle / set_caption /
# set_footnote / set_tag) on the SPEC path. The proxy path rides the
# widget-side `setLabel` dispatch (added with the Labels tab,
# settings-redesign Phase 2 — it was silently missing before).

test_that("label-slot modifiers write spec@labels", {
  spec <- web_spec(
    data.frame(study = c("A", "B"), n = c(1, 2)),
    label = "study"
  )
  spec <- set_title(spec, "T")
  spec <- set_subtitle(spec, "S")
  spec <- set_caption(spec, "C")
  spec <- set_footnote(spec, "F")
  spec <- set_tag(spec, "TABLE 2")
  expect_identical(spec@labels@title, "T")
  expect_identical(spec@labels@subtitle, "S")
  expect_identical(spec@labels@caption, "C")
  expect_identical(spec@labels@footnote, "F")
  expect_identical(spec@labels@tag, "TABLE 2")
  # NULL clears back to NA.
  spec <- set_tag(spec, NULL)
  expect_true(is.na(spec@labels@tag))
})
