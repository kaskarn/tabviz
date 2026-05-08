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

# Fixture spec used across modes.
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

test_that("Mode 3: ratio alone targets natural-width / ratio", {
  skip_if_no_v8()
  spec <- make_fixture()

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 2))

  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("Mode 3: width + height triggers relayout to target aspect", {
  skip_if_no_v8()
  spec <- make_fixture()

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
  spec <- make_fixture() |> set_aspect_ratio(2)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp))

  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 2, tolerance = 0.05)
})

test_that("Call-site ratio overrides spec target_aspect", {
  skip_if_no_v8()
  spec <- make_fixture() |> set_aspect_ratio(2)

  tmp <- tempfile(fileext = ".svg")
  on.exit(unlink(tmp), add = TRUE)
  suppressMessages(save_plot(spec, tmp, ratio = 3))

  d <- parse_svg_dims(tmp)
  expect_equal(d$aspect, 3, tolerance = 0.05)
})

test_that("flex = FALSE disables flex absorption (cap = 1)", {
  skip_if_no_v8()
  spec <- make_fixture()

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

test_that("Column constructors expose flex defaults via ColumnSpec", {
  expect_false(col_text("x")@flex)
  expect_false(col_n("n")@flex)
  expect_false(col_interval("p", "l", "u")@flex)

  expect_true(viz_forest(point = "p", lower = "l", upper = "u")@flex)

  # Per-call override wins.
  expect_false(viz_forest(point = "p", lower = "l", upper = "u", flex = FALSE)@flex)
  expect_true(col_text("x", flex = TRUE)@flex)
})
