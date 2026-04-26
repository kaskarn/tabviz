test_that("oklch_lighten increases L", {
  base <- "#5a6270"
  base_l <- to_oklch(base)[1, 1]
  lighter_l <- to_oklch(oklch_lighten(base, 0.2))[1, 1]
  expect_gt(lighter_l, base_l)
})

test_that("oklch_lighten clamps at L = 1", {
  out <- oklch_lighten("#ffffff", 0.5)
  expect_equal(toupper(out), "#FFFFFF")
})

test_that("oklch_darken decreases L", {
  base <- "#a8aeb8"
  base_l <- to_oklch(base)[1, 1]
  darker_l <- to_oklch(oklch_darken(base, 0.2))[1, 1]
  expect_lt(darker_l, base_l)
})

test_that("oklch_darken clamps at L = 0", {
  out <- oklch_darken("#000000", 0.5)
  expect_equal(toupper(out), "#000000")
})

test_that("oklch_mix endpoints round-trip", {
  expect_equal(toupper(oklch_mix("#FF0000", "#00FF00", 0)), "#FF0000")
  expect_equal(toupper(oklch_mix("#FF0000", "#00FF00", 1)), "#00FF00")
})

test_that("oklch_mix midpoint of black and white is grey", {
  mid <- oklch_mix("#FFFFFF", "#000000", 0.5)
  rgb <- farver::decode_colour(mid)[1, ]
  expect_lt(abs(rgb[1] - rgb[2]), 3)
  expect_lt(abs(rgb[2] - rgb[3]), 3)
})

test_that("oklch_chroma reduces saturation toward zero", {
  red_c <- to_oklch("#FF0000")[1, 2]
  desat_c <- to_oklch(oklch_chroma("#FF0000", -red_c))[1, 2]
  expect_lt(desat_c, 0.01)
})

test_that("oklch_chroma increases saturation up to gamut limit", {
  base <- "#7C3F4F"
  base_c <- to_oklch(base)[1, 2]
  more_c <- to_oklch(oklch_chroma(base, 0.05))[1, 2]
  expect_gte(more_c, base_c)
})

test_that("contrast_ratio matches known WCAG values", {
  expect_equal(contrast_ratio("#000000", "#FFFFFF"), 21, tolerance = 1e-6)
  expect_equal(contrast_ratio("#FFFFFF", "#FFFFFF"), 1, tolerance = 1e-6)
  expect_gt(contrast_ratio("#595959", "#FFFFFF"), 4.5)
  expect_lt(contrast_ratio("#999999", "#FFFFFF"), 4.5)
})

test_that("contrast_ratio is symmetric", {
  expect_equal(
    contrast_ratio("#1F3A5F", "#F7F8FA"),
    contrast_ratio("#F7F8FA", "#1F3A5F")
  )
})

test_that("ensure_contrast meets target on light background", {
  out <- ensure_contrast("#888888", "#FFFFFF", target = 4.5)
  expect_gte(contrast_ratio(out, "#FFFFFF"), 4.5)
})

test_that("ensure_contrast meets target on dark background", {
  out <- ensure_contrast("#666666", "#000000", target = 4.5)
  expect_gte(contrast_ratio(out, "#000000"), 4.5)
})

test_that("ensure_contrast is no-op when already compliant", {
  expect_equal(
    toupper(ensure_contrast("#000000", "#FFFFFF", target = 4.5)),
    "#000000"
  )
})

test_that("all helpers produce 6-char hex strings", {
  outputs <- c(
    oklch_lighten("#1F3A5F", 0.2),
    oklch_darken("#1F3A5F", 0.2),
    oklch_mix("#1F3A5F", "#B08938", 0.5),
    oklch_chroma("#1F3A5F", 0.05),
    ensure_contrast("#888888", "#FFFFFF")
  )
  expect_true(all(grepl("^#[0-9A-Fa-f]{6}$", outputs)))
})

test_that("gamut clipping handles extreme chroma without NaN", {
  out <- oklch_chroma("#FF0000", 0.5)
  expect_match(out, "^#[0-9A-Fa-f]{6}$")
  rgb <- farver::decode_colour(out)[1, ]
  expect_true(all(rgb >= 0 & rgb <= 255))
})

test_that("hue interpolation takes shortest path", {
  # Red ~29 deg, magenta ~328 deg. Short path crosses 360/0; long path
  # crosses 180. Verify the result is NOT on the long path.
  out <- oklch_mix("#FF0000", "#FF00FF", 0.5)
  out_h <- to_oklch(out)[1, 3]
  expect_false(out_h > 90 && out_h < 270)
})
