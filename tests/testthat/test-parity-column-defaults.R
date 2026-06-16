# R↔TS COLUMN-DEFAULT parity gate.
#
# test-parity-columns.R calls `ts_call("colX", literal_args)` vs
# `col_x(literal_args)` — but `col_x` DELEGATES to that same TS builder, so it
# only exercises the V8 plumbing, never R-default-vs-TS-default. That blind spot
# is exactly how three column default-drift bugs hid (2026-06-14):
# pictogram/stars `labelDecimals` (R 1 vs TS 0), img `fallback`, heatmap
# `palette`.
#
# This gate calls BOTH sides with MINIMAL args (field only) so each uses its OWN
# defaults, then compares the full (NULL-normalized) options tree. A future
# default added on one side but not the other fails here.

# Drop NULL leaves recursively so "absent" (TS omits) == "explicit NULL" (R) —
# the comparison is about keys/values actually present on the wire.
drop_nulls <- function(x) {
  if (!is.list(x)) return(x)
  x <- Filter(Negate(is.null), x)
  lapply(x, drop_nulls)
}

# Per-type option keys whose R/TS default divergence is a KNOWN product decision,
# not a bug to fix here. Keep this list SHRINKING — currently EMPTY: D27
# (heatmap `palette`) was RESOLVED 2026-06-16 by dropping R's baked blue so both
# sides omit the palette and the renderer derives a theme ramp (theme-first).
EXEMPT <- list()

# Pure-option column helpers. The field-carrying types (forest/interval/range/
# viz*) entangle data fields with options — out of scope for a clean options
# diff, same exclusion as the TS option-type-parity gate.
default_cases <- list(
  list(type = "pictogram", r = function() col_pictogram("f"), ts = "colPictogram"),
  list(type = "stars",     r = function() col_stars("f"),     ts = "colStars"),
  list(type = "badge",     r = function() col_badge("f"),     ts = "colBadge"),
  list(type = "bar",       r = function() col_bar("f"),       ts = "colBar"),
  list(type = "sparkline", r = function() col_sparkline("f"), ts = "colSparkline"),
  list(type = "icon",      r = function() col_icon("f"),      ts = "colIcon"),
  list(type = "ring",      r = function() col_ring("f"),      ts = "colRing"),
  list(type = "heatmap",   r = function() col_heatmap("f"),   ts = "colHeatmap"),
  list(type = "pvalue",    r = function() col_pvalue("f"),    ts = "colPvalue"),
  list(type = "img",       r = function() col_img("f"),       ts = "colImg"),
  list(type = "numeric",   r = function() col_numeric("f"),   ts = "colNumeric"),
  list(type = "percent",   r = function() col_percent("f"),   ts = "colPercent")
)

for (case in default_cases) {
  local({
    cs <- case
    test_that(paste0("R<->TS default parity: ", cs$type), {
      r_opts  <- drop_nulls(cs$r()@options)
      ts_opts <- drop_nulls(ts_call(cs$ts, list(field = "f"))$options)
      ex <- EXEMPT[[cs$type]]
      if (!is.null(ex)) for (k in ex) {
        if (!is.null(r_opts[[cs$type]]))  r_opts[[cs$type]][[k]]  <- NULL
        if (!is.null(ts_opts[[cs$type]])) ts_opts[[cs$type]][[k]] <- NULL
      }
      testthat::expect_equal(r_opts, ts_opts, label = paste0(cs$type, " options"))
    })
  })
}
