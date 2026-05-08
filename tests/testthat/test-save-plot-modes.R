# Tests for the aspect-ratio-first save_plot dimension contract.
# Three modes: Natural, Display-scaled, Aspect-changed.

skip_if_no_v8 <- function() {
  skip_if_not_installed("V8")
}

# Helper: parse SVG root width/height attributes from the rendered file.
parse_svg_dims <- function(file) {
  svg <- paste(readLines(file), collapse = "")
  root <- regmatches(svg, regexpr("<svg[^>]*>", svg))
  w <- as.numeric(sub('.*width="([0-9.]+)".*', "\\1", root))
  h <- as.numeric(sub('.*height="([0-9.]+)".*', "\\1", root))
  list(w = w, h = h, aspect = w / h)
}

# Fixture spec used across modes. Default uses the full 14-row glp1_trials.
make_fixture <- function() {
  data(glp1_trials)
  tabviz(
    glp1_trials,
    label = "study",
    columns = list(
      col_n("n"),
      viz_forest(point = "hr", lower = "lower", upper = "upper",
                 scale = "log", null_value = 1)
    ),
    .spec_only = TRUE
  )
}

# Small fixture for ratio-targeting tests. The Phase 7A lever ladder
# floors `rowHeight` at `MIN_ROW_HEIGHT` for legibility (1.4 × body_font_size
# + 4); on a 14-row spec, target ratios of 2+ saturate the floor and the
# achieved aspect lands well short of target. Tests that check strict
# aspect targeting need a fixture where the floor does not saturate.
make_small_fixture <- function() {
  small <- data.frame(
    study = sprintf("S%02d", 1:5),
    hr    = c(0.85, 0.92, 1.08, 0.71, 1.20),
    lower = c(0.62, 0.74, 0.85, 0.55, 0.92),
    upper = c(1.16, 1.14, 1.36, 0.92, 1.57),
    n     = c(120, 240, 480, 96, 360)
  )
  tabviz(
    small,
    label = "study",
    columns = list(
      col_n("n"),
      viz_forest(point = "hr", lower = "lower", upper = "upper")
    ),
    .spec_only = TRUE
  )
}

test_that("Mode 1 (no args) renders at natural dimensions", {
  skip_if_no_v8()
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  expect_silent(suppressMessages(save_plot(spec, tmp)))

  d <- parse_svg_dims(tmp)
  expect_equal(d$w, natural$width, tolerance = 0.5)
  expect_equal(d$h, natural$height, tolerance = 0.5)
})

test_that("Mode 2: width-only scales display, preserves natural aspect", {
  skip_if_no_v8()
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, width = 1200))

  d <- parse_svg_dims(tmp)
  expect_equal(d$w, 1200, tolerance = 0.5)
  expect_equal(d$aspect, natural$aspect, tolerance = 0.01)
})

test_that("Mode 2: height-only scales display, preserves natural aspect", {
  skip_if_no_v8()
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, height = 400))

  d <- parse_svg_dims(tmp)
  expect_equal(d$h, 400, tolerance = 0.5)
  expect_equal(d$aspect, natural$aspect, tolerance = 0.01)
})

test_that("Mode 3: ratio alone targets natural-width / ratio (small fixture)", {
  skip_if_no_v8()
  spec <- make_small_fixture()

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 2))

  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("Mode 3 with extreme ratio: legibility floor gives approximate aspect", {
  skip_if_no_v8()
  # Phase 7A: extreme aspect targets on dense specs floor `rowHeight` at
  # `MIN_ROW_HEIGHT` for legibility. Achieved aspect lands short of target
  # but content stays readable. (Phase 7B will surface this via a
  # diagnostic; Phase 7C's `anchor = "auto"` lets the user opt into the
  # other resolution — grow width instead of shrinking rows.)
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 2))

  d <- parse_svg_dims(tmp)
  # Achieved is between natural and target — the ladder moved toward 2
  # but the floor saturated. Aspect should be > natural.
  expect_gt(d$aspect, natural$aspect)
  # ... but not all the way to 2 (otherwise the floor wouldn't have saturated).
  expect_lt(d$aspect, 2)
})

test_that("Mode 3: width + height triggers relayout to target aspect", {
  skip_if_no_v8()
  spec <- make_small_fixture()

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, width = 1200, height = 400))

  d <- parse_svg_dims(tmp)
  expect_equal(d$w, 1200, tolerance = 1)
  expect_equal(d$h, 400, tolerance = 1)
})

test_that("Over-specified dimensions error", {
  skip_if_no_v8()
  spec <- make_fixture()
  expect_error(
    save_plot(spec, tempfile(fileext = ".svg"),
              width = 800, height = 400, ratio = 2),
    "Over-specified"
  )
})

test_that("scale on SVG / PDF warns (vector formats — scale is PNG-only)", {
  skip_if_no_v8()
  spec <- make_fixture()

  tmp_svg <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp_svg), add = TRUE)
  expect_warning(
    suppressMessages(save_plot(spec, tmp_svg, scale = 4)),
    "ignored"
  )
})

test_that("set_aspect_ratio() pins target on the spec", {
  skip_if_no_v8()
  spec <- make_fixture()
  spec2 <- set_aspect_ratio(spec, 2)
  expect_equal(spec2@target_aspect, 2)

  spec3 <- set_aspect_ratio(spec2, NULL)
  expect_true(is.na(spec3@target_aspect))
})

test_that("save_plot honors spec's target_aspect when ratio not passed", {
  skip_if_no_v8()
  spec <- make_small_fixture() |> set_aspect_ratio(2)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp))

  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("Call-site ratio overrides spec target_aspect", {
  skip_if_no_v8()
  spec <- make_small_fixture() |> set_aspect_ratio(2)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 3))

  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 3, tolerance = 0.05)
})

test_that("flex = FALSE disables flex absorption (cap = 1)", {
  skip_if_no_v8()
  spec <- make_small_fixture()

  tmp_default <- tempfile(fileext = ".svg")
  tmp_noflex <- tempfile(fileext = ".svg")
  on.exit(unlink(c(tmp_default, tmp_noflex)), add = TRUE)

  suppressMessages(save_plot(spec, tmp_default, ratio = 2))
  suppressMessages(save_plot(spec, tmp_noflex, ratio = 2, flex = FALSE))

  d_default <- parse_svg_dims(tmp_default)
  d_noflex <- parse_svg_dims(tmp_noflex)

  # Both reach the target aspect. The cap only changes WHERE the width
  # delta lands (flex columns vs. non-flex auto-width); for ratio = 2 on
  # this fixture, both layouts produce a ratio-2 SVG.
  expect_equal(d_default$aspect, 2, tolerance = 0.05)
  expect_equal(d_noflex$aspect, 2, tolerance = 0.05)
})

test_that("anchor = 'height' grows width to hit a wider ratio (Phase 7C)", {
  skip_if_no_v8()
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 2, anchor = "height"))

  d <- parse_svg_dims(tmp)
  # Output width should grow past natural; height stays at natural.
  expect_gt(d$w, natural$width)
  expect_equal(d$h, natural$height, tolerance = 1)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("anchor = 'auto' picks 'height' for wider-than-natural ratios", {
  skip_if_no_v8()
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)
  expect_lt(natural$aspect, 2)  # natural ~1.09; ratio=2 is wider

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 2, anchor = "auto"))

  d <- parse_svg_dims(tmp)
  # Auto = "height" here -> width grows, height stays at natural.
  expect_gt(d$w, natural$width)
  expect_equal(d$h, natural$height, tolerance = 1)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("anchor = 'auto' picks 'width' for taller-than-natural ratios", {
  skip_if_no_v8()
  spec <- make_fixture()
  natural <- tabviz_natural_dimensions(spec)
  expect_gt(natural$aspect, 0.5)  # natural ~1.09; ratio=0.5 is taller

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 0.5, anchor = "auto"))

  d <- parse_svg_dims(tmp)
  # Auto = "width" here -> width stays at natural, height grows. The
  # chrome doesn't scale fully (font-derived heights are pinned), so the
  # achieved aspect undershoots target by some single-digit %. Phase 7B's
  # diagnostic surfaces this; here we just check directionality.
  expect_equal(d$w, natural$width, tolerance = 1)
  expect_gt(d$h, natural$height)
  expect_lt(d$aspect, natural$aspect)         # moved toward target
  expect_equal(d$aspect, 0.5, tolerance = 0.1)  # within 10 %
})

test_that("set_aspect_ratio() round-trips the anchor field", {
  skip_if_no_v8()
  spec <- make_fixture()

  spec_auto <- set_aspect_ratio(spec, 2, anchor = "auto")
  expect_equal(spec_auto@target_aspect_anchor, "auto")

  spec_h <- set_aspect_ratio(spec, 2, anchor = "height")
  expect_equal(spec_h@target_aspect_anchor, "height")

  # Default (no anchor arg) preserves "width".
  spec_w <- set_aspect_ratio(spec, 2)
  expect_equal(spec_w@target_aspect_anchor, "width")

  # save_plot honors the spec field when call-site anchor is unset.
  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec_auto, tmp))
  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("Column constructors expose flex defaults via ColumnSpec", {
  expect_false(col_text("x")@flex)
  expect_false(col_n("n")@flex)
  expect_false(col_interval("p", "l", "u")@flex)

  expect_true(viz_forest(point = "p", lower = "l", upper = "u")@flex)

  # Per-call override wins.
  expect_false(viz_forest(point = "p", lower = "l", upper = "u", flex = FALSE)@flex)
  expect_true(col_text("x", flex = TRUE)@flex)
})
