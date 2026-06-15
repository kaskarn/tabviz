# OKLCH color manipulation utilities.
#
# All blending happens in OKLCH (perceptually uniform) and clips back to sRGB
# before returning. OKLCH can describe colors outside sRGB; without the clip,
# extreme inputs produce hex with channel values > 255 or < 0, which farver
# rounds into nonsense. The clip preserves L and H and reduces C until the
# result is representable in sRGB.
#
# This is the only file in the package that references `farver::`. Resolution
# code, swatch derivation, etc. should call these wrappers.

# Decode hex to a 1x3 OKLCH matrix (L in [0,1], C, H in degrees).
to_oklch <- function(hex) {
  rgb <- farver::decode_colour(hex)
  farver::convert_colour(rgb, from = "rgb", to = "oklch")
}

#' Construct an OKLCH triple.
#'
#' Authoring helper for [web_theme()] anchor arguments. Returns a named
#' list `list(L=, C=, H=)` that [web_theme()] accepts in place of a hex
#' string. L in `[0, 1]`, C in `[0, ~0.4]`, H in `[0, 360)`.
#'
#' @param L Lightness, in `[0, 1]`.
#' @param C Chroma, in `[0, 0.5]` (gamut depends on hue/lightness).
#' @param H Hue, in degrees in `[0, 360)`.
#' @return A list with elements `L`, `C`, `H`.
#' @export
oklch <- function(L, C, H) {
  checkmate::assert_number(L, lower = 0, upper = 1)
  checkmate::assert_number(C, lower = 0, upper = 0.5)
  checkmate::assert_number(H, lower = 0, upper = 360)
  list(L = L, C = C, H = H %% 360)
}

#' Convert a hex string to an OKLCH triple (`list(L=, C=, H=)`).
#'
#' Thin R wrapper over the same farver path used elsewhere in the package
#' for OKLCH conversions. Useful when an author has a hex they want to
#' express as an anchor.
#'
#' @param hex A 3-, 6-, or 8-digit hex color string.
#' @return A list with elements `L`, `C`, `H`.
#' @export
hex_to_oklch <- function(hex) {
  checkmate::assert_string(hex, pattern = hex_pattern)
  lch <- to_oklch(hex)
  list(L = unname(lch[1, 1]),
       C = unname(lch[1, 2]),
       H = unname(lch[1, 3]) %% 360)
}

# Internal — coerce an anchor argument from `web_theme()`. Accepts hex
# strings, lists from `oklch()`, or NULL. Returns list(L, C, H) or NULL.
coerce_anchor <- function(x, arg_name) {
  if (is.null(x)) return(NULL)
  if (is.character(x) && length(x) == 1L) return(hex_to_oklch(x))
  if (is.list(x) && all(c("L", "C", "H") %in% names(x))) {
    checkmate::assert_number(x$L, lower = 0, upper = 1, .var.name = paste0(arg_name, "$L"))
    checkmate::assert_number(x$C, lower = 0, upper = 0.5, .var.name = paste0(arg_name, "$C"))
    checkmate::assert_number(x$H, lower = 0, upper = 360, .var.name = paste0(arg_name, "$H"))
    return(list(L = x$L, C = x$C, H = x$H %% 360))
  }
  cli::cli_abort(
    "{.arg {arg_name}} must be a hex string or an {.fn oklch} triple, got {.cls {class(x)}}."
  )
}

# Encode a 1x3 OKLCH matrix back to hex, reducing chroma if out-of-gamut.
# Bisects on C (preserving L and H) until the resulting sRGB triplet sits
# within [0, 255]. The bisection terminates in <= 40 iterations.
from_oklch <- function(lch) {
  rgb <- farver::convert_colour(lch, from = "oklch", to = "rgb")
  if (any(rgb < 0) || any(rgb > 255)) {
    lo <- 0
    hi <- lch[1, 2]
    for (i in seq_len(OKLCH_GAMUT_BISECT_ITERS)) {
      mid <- (lo + hi) / 2
      probe <- lch
      probe[1, 2] <- mid
      probe_rgb <- farver::convert_colour(probe, from = "oklch", to = "rgb")
      if (any(probe_rgb < 0) || any(probe_rgb > 255)) hi <- mid else lo <- mid
    }
    lch[1, 2] <- lo
    rgb <- farver::convert_colour(lch, from = "oklch", to = "rgb")
  }
  rgb[] <- pmin(pmax(rgb, 0), 255)
  farver::encode_colour(rgb)
}

# Increase OKLCH lightness by `by` (0..1). Negative `by` darkens.
oklch_lighten <- function(hex, by) {
  checkmate::assert_string(hex)
  checkmate::assert_number(by, lower = -1, upper = 1)
  lch <- to_oklch(hex)
  lch[1, 1] <- max(0, min(1, lch[1, 1] + by))
  from_oklch(lch)
}

# Decrease OKLCH lightness by `by` (0..1).
oklch_darken <- function(hex, by) {
  checkmate::assert_number(by, lower = 0, upper = 1)
  oklch_lighten(hex, -by)
}

# Mix two colors in OKLCH at proportion `t`. t=0 returns `a`, t=1 returns `b`.
# Hue interpolates along the shortest path around the wheel.
#
# Achromatic-endpoint guard: when one (or both) endpoints have near-zero
# chroma their hue is mathematically defined but practically meaningless,
# and shortest-path interpolation walks through unintended hue regions
# mid-path. Two failing cases this guard fixes:
#
#   (a) cream (#FDFCFB, hue ~50°) mixed with deep navy (#002D54, hue
#       ~260°) at 0.4 lands at hue ~135° (green) instead of the
#       expected desaturated mid-blue.
#   (b) Chained low-chroma mix: surface.base (chroma ~0.005) mixed with
#       a 4-8% identity-tinted surface.muted (chroma ~0.005-0.010) at 0.5
#       — both endpoints are below threshold, both have noise hues,
#       shortest-path interp lands at unrelated hues. Concrete repro:
#       primary #2f3f93 (indigo, hue ~280°) → red-hued banding (~340°).
#
# Rule: when EITHER endpoint is below the chroma threshold, lock the
# output hue to whichever endpoint carries more chroma. That's the
# "intent" hue — the direction the cascade is trying to nudge the
# result toward. Both-low → still pick the larger; the result chroma
# is also low so the visible hue is faint, but at least it's faint
# along the right direction rather than wandering randomly.
CHROMA_ACHROMATIC <- 0.02

# Max chroma-bisection iterations in `from_oklch` gamut clipping. The C halving
# converges on the [0,255] sRGB boundary well within this; the cap is a
# guaranteed terminator.
OKLCH_GAMUT_BISECT_ITERS <- 40L

# Lightness search granularity in `ensure_contrast` — step the L channel by this
# toward the contrasting end until the WCAG target is met (<=50 steps over [0,1]).
CONTRAST_SEARCH_STEP <- 0.02

oklch_mix <- function(a, b, t) {
  checkmate::assert_string(a)
  checkmate::assert_string(b)
  checkmate::assert_number(t, lower = 0, upper = 1)
  la <- to_oklch(a)
  lb <- to_oklch(b)
  ca <- la[1, 2]; cb <- lb[1, 2]
  ha <- la[1, 3]; hb <- lb[1, 3]

  if (ca < CHROMA_ACHROMATIC || cb < CHROMA_ACHROMATIC) {
    # Either (or both) endpoint(s) achromatic. Lock to the endpoint with
    # the larger chroma — the more "meaningful" hue direction.
    h_out <- if (cb > ca) hb else ha
  } else {
    # Both meaningfully chromatic; shortest-path interp.
    if (abs(hb - ha) > 180) {
      if (hb > ha) ha <- ha + 360 else hb <- hb + 360
    }
    h_out <- (ha + t * (hb - ha)) %% 360
  }

  out <- la
  out[1, 1] <- la[1, 1] + t * (lb[1, 1] - la[1, 1])
  out[1, 2] <- ca + t * (cb - ca)
  out[1, 3] <- h_out
  from_oklch(out)
}

# Adjust OKLCH chroma by `by`. Positive saturates, negative desaturates.
oklch_chroma <- function(hex, by) {
  checkmate::assert_string(hex)
  checkmate::assert_number(by, lower = -1, upper = 1)
  lch <- to_oklch(hex)
  lch[1, 2] <- max(0, lch[1, 2] + by)
  from_oklch(lch)
}

# WCAG 2.1 contrast ratio between two hex colors.
contrast_ratio <- function(fg, bg) {
  checkmate::assert_string(fg)
  checkmate::assert_string(bg)
  rel_lum <- function(hex) {
    rgb01 <- farver::decode_colour(hex)[1, ] / 255
    lin <- ifelse(rgb01 <= 0.03928, rgb01 / 12.92, ((rgb01 + 0.055) / 1.055)^2.4)
    0.2126 * lin[1] + 0.7152 * lin[2] + 0.0722 * lin[3]
  }
  l1 <- rel_lum(fg)
  l2 <- rel_lum(bg)
  (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
}

# Walk `fg`'s OKLCH lightness toward black or white (depending on whether `bg`
# is light or dark) until contrast against `bg` meets `target`. Default 4.5
# matches WCAG AA for body text. Returns the original `fg` if already
# compliant; returns extreme black/white if no L value can satisfy the target.
ensure_contrast <- function(fg, bg, target = 4.5) {
  checkmate::assert_string(fg)
  checkmate::assert_string(bg)
  checkmate::assert_number(target, lower = 1, upper = 21)
  if (contrast_ratio(fg, bg) >= target) return(fg)
  bg_l <- to_oklch(bg)[1, 1]
  lch <- to_oklch(fg)
  direction <- if (bg_l > 0.5) -1 else 1
  step <- CONTRAST_SEARCH_STEP
  while (step <= 1) {
    candidate <- lch
    candidate[1, 1] <- max(0, min(1, lch[1, 1] + direction * step))
    candidate_hex <- from_oklch(candidate)
    if (contrast_ratio(candidate_hex, bg) >= target) return(candidate_hex)
    step <- step + CONTRAST_SEARCH_STEP
  }
  candidate <- lch
  candidate[1, 1] <- if (direction < 0) 0 else 1
  from_oklch(candidate)
}
