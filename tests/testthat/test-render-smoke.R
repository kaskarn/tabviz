# Smoke test: every v2 preset renders to PNG without errors via the
# v2->v1 shim. Doesn't pixel-compare; just exercises the full pipeline
# (tabviz -> serialize_spec -> save_plot -> SVG -> rsvg PNG) so any
# regression in the dispatch path or shim shows up in CI.

skip_if_not_installed <- function() {
  testthat::skip_if_not_installed("V8")
  testthat::skip_if_not_installed("rsvg")
}

test_that("each v2 preset renders to PNG via the dispatch path", {
  skip_if_not_installed()

  df <- data.frame(
    Site = c("A", "B", "C"),
    est = c(0.7, 1.0, 0.85),
    lo = c(0.5, 0.8, 0.6),
    hi = c(0.9, 1.2, 1.1)
  )

  tmpdir <- tempfile("v2-render-")
  dir.create(tmpdir)
  on.exit(unlink(tmpdir, recursive = TRUE), add = TRUE)

  presets <- c("cochrane", "lancet", "jama", "dark")

  for (preset in presets) {
    ctor <- get(paste0("web_theme_", preset))
    spec <- tabviz(
      df, label = "Site",
      columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
      theme = ctor(),
      .spec_only = TRUE
    )
    outfile <- file.path(tmpdir, paste0(preset, ".png"))
    save_plot(spec, outfile, width = 500, scale = 1)

    expect_true(file.exists(outfile), info = preset)
    expect_gt(file.size(outfile), 1000L)  # not an empty file
  }
})

test_that("V3 fallback path in readVar is dead — every render hits only v4 cssVars", {
  # Cutover gate (T2.1 in v4-coherence-audit). consumer-bridge.ts's
  # `readVar(cssVars, var, v3_fallback)` is supposed to be a transitional
  # shim — the v4 path (cssVars) wins, the v3 fallback only fires if a
  # manifest entry is missing or a theme was built without
  # `authoringInputs`. This test toggles a dev-throw inside readVar and
  # renders a representative spec; any v3 fallback hit fails the test.
  # Holds the cutover state in place: nobody can re-introduce v3
  # dependence without CI catching it.
  skip_if_not_installed()
  ctx <- tabviz_v8()
  ctx$call("callBuilder", "setReadVarDevThrow", "true")
  on.exit(ctx$call("callBuilder", "setReadVarDevThrow", "false"), add = TRUE)

  df <- data.frame(
    Site = c("A", "B", "C"),
    est = c(0.7, 1.0, 0.85),
    lo = c(0.5, 0.8, 0.6),
    hi = c(0.9, 1.2, 1.1)
  )
  tmpdir <- tempfile("v3-deadcode-")
  dir.create(tmpdir)
  on.exit(unlink(tmpdir, recursive = TRUE), add = TRUE)

  for (preset in c("cochrane", "dark", "synthwave", "executive")) {
    ctor <- get(paste0("web_theme_", preset))
    spec <- tabviz(
      df, label = "Site",
      columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
      theme = ctor(),
      .spec_only = TRUE
    )
    outfile <- file.path(tmpdir, paste0(preset, ".png"))
    expect_no_error(save_plot(spec, outfile, width = 500, scale = 1))
    expect_true(file.exists(outfile), info = preset)
  }
})

test_that("tabviz preserves theme bold header bg through wire", {
  skip_if_not_installed()
  df <- data.frame(Site = "A", est = 0.5, lo = 0.3, hi = 0.7)

  for (header_style in c("light", "bold")) {
    spec <- tabviz(
      df, label = "Site",
      columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
      theme = web_theme(brand = "#000080"),
      .spec_only = TRUE
    )
    out <- serialize_spec(spec)
    active_hdr <- if (header_style == "bold") out$theme$header$bold else out$theme$header$light
    if (header_style == "bold") {
      expect_match(active_hdr$bg, "^#[0-9A-Fa-f]{6}$")
    } else {
      expect_match(active_hdr$bg, "^#")
    }
  }
})

test_that("static knit output renders via save_plot, not a blank widget (round-2 Quarto blocker)", {
  withr::local_dir(withr::local_tempdir())
  spec <- forest_plot(
    data.frame(study = c("A", "B", "C"), est = c(.7, .8, .9),
               lo = c(.5, .6, .7), hi = c(.9, 1, 1.1)),
    point = "est", lower = "lo", upper = "hi", label = "study",
    theme = web_theme_nejm()
  )
  # PNG (non-LaTeX target) and PDF (LaTeX target) must both produce a real,
  # non-trivial image file — the bug shipped a blank figure via webshot.
  png <- tabviz:::.render_static_image(spec, ext = "png")
  expect_true(file.exists(png))
  expect_gt(file.info(png)$size, 2000)
  pdf <- tabviz:::.render_static_image(spec, ext = "pdf")
  expect_true(file.exists(pdf))
  expect_gt(file.info(pdf)$size, 2000)
})
