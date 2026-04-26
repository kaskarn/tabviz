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

# Encode a 1x3 OKLCH matrix back to hex, reducing chroma if out-of-gamut.
# Bisects on C (preserving L and H) until the resulting sRGB triplet sits
# within [0, 255]. The bisection terminates in <= 40 iterations.
from_oklch <- function(lch) {
  rgb <- farver::convert_colour(lch, from = "oklch", to = "rgb")
  if (any(rgb < 0) || any(rgb > 255)) {
    lo <- 0
    hi <- lch[1, 2]
    for (i in seq_len(40)) {
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
# Achromatic-endpoint guard: when one endpoint has near-zero chroma
# (whites, blacks, near-greys) its hue is mathematically defined but
# practically meaningless — interpolating against a saturated endpoint
# walks through unintended hues mid-path. Concrete example: cream
# (#FDFCFB, hue ~50°) mixed with deep navy (#002D54, hue ~260°) at 0.4
# lands at hue ~135° (green) via shortest-path interpolation, even
# though the visual expectation is a desaturated mid-blue. Fix: when
# either endpoint is achromatic, lock to the OTHER endpoint's hue and
# only interpolate L and C.
CHROMA_ACHROMATIC <- 0.02

oklch_mix <- function(a, b, t) {
  checkmate::assert_string(a)
  checkmate::assert_string(b)
  checkmate::assert_number(t, lower = 0, upper = 1)
  la <- to_oklch(a)
  lb <- to_oklch(b)
  ca <- la[1, 2]; cb <- lb[1, 2]
  ha <- la[1, 3]; hb <- lb[1, 3]

  if (ca < CHROMA_ACHROMATIC && cb >= CHROMA_ACHROMATIC) {
    h_out <- hb
  } else if (cb < CHROMA_ACHROMATIC && ca >= CHROMA_ACHROMATIC) {
    h_out <- ha
  } else {
    # Both chromatic (or both achromatic — degenerate but harmless): take
    # the shortest path around the wheel.
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
  step <- 0.02
  while (step <= 1) {
    candidate <- lch
    candidate[1, 1] <- max(0, min(1, lch[1, 1] + direction * step))
    candidate_hex <- from_oklch(candidate)
    if (contrast_ratio(candidate_hex, bg) >= target) return(candidate_hex)
    step <- step + 0.02
  }
  candidate <- lch
  candidate[1, 1] <- if (direction < 0) 0 else 1
  from_oklch(candidate)
}
