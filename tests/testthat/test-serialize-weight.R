# Serialization-weight regression gate.
#
# A default tabviz() spec once serialize()d to ~583 MB (and took ~4s):
# finalize_enable_themes() eagerly embedded every package preset as a
# resolved S7 WebTheme in `interaction@enable_themes`, and S7 instances
# drag their full class-closure graph into R serialization (~21 MB per
# theme × 27). Anything that R-serializes specs paid it: knitr cache
# (the CI docs build spent 8-17 MINUTES per page under --cache-refresh),
# saveRDS, targets pipelines, parallel workers.
#
# Finalization now happens at wire time (serialize_interaction); the spec
# stores the raw "default" sentinel / user list. This gate pins the fix.
# The remaining weight (~21 MB) is the single active WebTheme's S7 class
# graph — if THAT gets fixed too, ratchet the budget down.

test_that("a default spec R-serializes under the weight budget", {
  df <- data.frame(study = c("A", "B"), est = c(1, 2),
                   lo = c(0.5, 1.5), hi = c(1.5, 2.5))
  spec <- web_spec(df, label = "study",
    columns = list(col_interval("est", "lo", "hi", header = "CI")))

  raw <- serialize(spec, NULL)
  mb <- length(raw) / 1e6
  # 60 MB leaves headroom over the current ~21 MB (one resolved WebTheme's
  # S7 class graph) while catching any return of the per-preset embedding
  # (which lands at 500+ MB immediately).
  expect_lt(mb, 60)

  # The raw enable_themes value must survive construction unfinalized —
  # a resolved list of WebThemes here is the regression signature.
  et <- spec@interaction@enable_themes
  finalized_webthemes <- is.list(et) &&
    any(vapply(et, function(x) S7::S7_inherits(x, tabviz:::WebTheme), logical(1)))
  expect_false(finalized_webthemes)
})

test_that("the wire still carries the finalized theme roster", {
  df <- data.frame(study = c("A", "B"), est = c(1, 2),
                   lo = c(0.5, 1.5), hi = c(1.5, 2.5))
  spec <- web_spec(df, label = "study",
    columns = list(col_interval("est", "lo", "hi", header = "CI")))

  wire <- tabviz:::serialize_interaction(spec@interaction, spec@theme)
  expect_false(is.null(wire$enableThemes))
  expect_gt(length(wire$enableThemes), 0)
})
