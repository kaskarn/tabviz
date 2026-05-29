# R↔TS theme-builder round-trip tests.
#
# Originally a parity test (R-resolved vs TS-resolved). As of the
# Sprint 1 cascade collapse the R-side cascade was deleted and
# `resolve_theme()` delegates to TS via V8 — both paths now produce
# the same blob by construction. These tests are kept as an
# *integration* check: each preset's R authoring API survives the
# round-trip through V8 + `deserialize_resolved_theme()`. Drift
# detector for: (a) the v8-bridge wire shape, (b) the
# webtheme_to_resolve_draft serializer, (c) the deserialize_resolved_theme
# reconstructor, (d) preset constructors that override T2/T3 fields.
#
# Cascade semantics themselves are tested where they live —
# `srcjs/src/lib/theme-resolve.test.ts`.
#
# Hex tolerance (`.hex_close`) is retained for now because farver-based
# tests elsewhere occasionally produce sub-perceptual channel drift; it
# is effectively a no-op for this file post-collapse (both sides
# produce identical hex) but harmless and useful documentation.

# Snake_case → camelCase builder symbol.
.to_camel <- function(s) {
  parts <- strsplit(s, "_", fixed = TRUE)[[1]]
  capitalized <- paste0(toupper(substring(parts, 1, 1)), substring(parts, 2))
  paste0("theme", paste(capitalized, collapse = ""))
}

# Per-channel hex tolerance (0-255). The JS-side `hexClose()` helper
# (`srcjs/src/lib/theme-resolve.test.ts`) used 25; theme parity needs
# 50 because the most saturated palettes (Lancet's #ED0000-derived
# series strokeEmphasis, Bauhaus red, etc.) compound `oklch_chroma` +
# bisection-clipping drift right at the gamut boundary, producing
# 25-50 channel deltas. Still sub-perceptual; the parity test's job is
# to catch *unintentional* changes from the baseline, not enforce
# byte-equality at the OKLab numerical-precision limit.
.hex_close <- function(a, b, tol = 50) {
  if (identical(a, b)) return(TRUE)
  if (is.null(a) || is.null(b)) return(FALSE)
  if (!is.character(a) || !is.character(b)) return(FALSE)
  if (nchar(a) != nchar(b)) return(FALSE)
  if (substr(a, 1, 1) != "#" || substr(b, 1, 1) != "#") return(FALSE)
  ac <- substring(a, c(2, 4, 6), c(3, 5, 7))
  bc <- substring(b, c(2, 4, 6), c(3, 5, 7))
  all(abs(strtoi(ac, 16L) - strtoi(bc, 16L)) <= tol)
}

# Recursive comparator: byte-exact on structural fields, hex-close on
# anything that looks like a #RRGGBB hex string.
.compare_resolved <- function(r, ts, path = "") {
  # One side is a *named* list and the other isn't — that's a real
  # structural divergence worth flagging.
  r_is_named <- is.list(r) && !is.null(names(r)) && length(names(r)) > 0L
  t_is_named <- is.list(ts) && !is.null(names(ts)) && length(names(ts)) > 0L
  if (r_is_named && t_is_named) {
    testthat::expect_setequal(names(r), names(ts))
    for (k in intersect(names(r), names(ts))) {
      .compare_resolved(r[[k]], ts[[k]], paste0(path, "/", k))
    }
    return(invisible())
  }
  if (r_is_named != t_is_named) {
    testthat::fail(paste0(
      "structural mismatch at ", path,
      ": R is ", if (r_is_named) "named list" else class(r)[1L],
      ", TS is ", if (t_is_named) "named list" else class(ts)[1L]
    ))
    return(invisible())
  }
  # Hex-pair-style fields: tolerate OKLab precision drift per channel.
  if (is.character(r) && is.character(ts) && length(r) == 1L && length(ts) == 1L &&
      nchar(r) %in% c(4L, 7L, 9L) && substr(r, 1, 1) == "#") {
    testthat::expect_true(
      .hex_close(r, ts), info = paste0("hex drift at ", path, ": R=", r, ", TS=", ts)
    )
    return(invisible())
  }
  # Unnamed vectors (e.g. neutral ramp, seriesAnchors) — element-wise.
  if (is.list(r) && is.list(ts) && length(r) == length(ts)) {
    for (i in seq_along(r)) {
      .compare_resolved(r[[i]], ts[[i]], paste0(path, "[", i, "]"))
    }
    return(invisible())
  }
  # Vectors (R) vs lists (TS, with simplifyVector = FALSE): coerce to
  # comparable shape. Both sides should equal element-wise.
  if ((is.atomic(r) && is.list(ts)) || (is.list(r) && is.atomic(ts))) {
    r_norm <- if (is.atomic(r)) as.list(r) else r
    t_norm <- if (is.atomic(ts)) as.list(ts) else ts
    if (length(r_norm) == length(t_norm)) {
      for (i in seq_along(r_norm)) {
        .compare_resolved(r_norm[[i]], t_norm[[i]], paste0(path, "[", i, "]"))
      }
      return(invisible())
    }
  }
  testthat::expect_equal(r, ts)
}

THEMES <- c(
  "cochrane", "lancet", "jama", "nejm", "nature", "bmj", "dark",
  "bauhaus", "swiss", "tufte", "newsprint",
  "solarized", "solarized_dark", "tonal", "tonal_dark",
  "dwarven", "elvish", "hobbit"
)

for (name in THEMES) {
  local({
    nm <- name
    test_that(sprintf("%s: R↔TS wire shape parity (within OKLab tolerance)", nm), {
      r_theme   <- do.call(paste0("web_theme_", nm), list())
      r_wire    <- tabviz:::serialize_theme(r_theme)
      ts_wire_json <- tabviz_v8()$call("callBuilder", .to_camel(nm), "{}")
      ts_wire   <- jsonlite::fromJSON(ts_wire_json, simplifyVector = FALSE)
      # Strip fields where the R↔TS wire shape diverges by design
      # (not drift — these aren't load-bearing for the renderer):
      #
      #   * webFonts: R-side empty list vs TS-side empty array; same
      #     semantics, different JSON encoding.
      #   * layout.banding: R duplicates row.banding into layout.banding
      #     as a wire legacy; TS only populates row.banding (the
      #     canonical source). Both sides have row.banding so the
      #     renderer behavior is identical.
      #   * series: chroma-boosted slot-bundle derivations
      #     (fillEmphasis / strokeEmphasis / accent.muted etc.) compound
      #     OKLab precision gaps + the achromatic-endpoint guard into
      #     visibly-different-but-sub-perceptual outputs on
      #     near-grayscale palettes. The JS-side byte-exact snapshot
      #     test in `srcjs/src/lib/theme-resolve.test.ts` is the parity
      #     oracle for these; here we focus on the parts that *don't*
      #     trip the chroma+bisection compounding (chrome, content,
      #     dividers, typography, spacing, clusters).
      r_wire$webFonts  <- NULL; ts_wire$webFonts <- NULL
      r_wire$layout$banding  <- NULL; ts_wire$layout$banding <- NULL
      r_wire$series  <- NULL; ts_wire$series <- NULL
      .compare_resolved(r_wire, ts_wire, paste0("/", nm))
    })
  })
}
