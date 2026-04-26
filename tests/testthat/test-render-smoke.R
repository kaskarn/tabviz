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

  presets <- c("default", "minimal", "dark", "jama", "lancet",
               "modern", "presentation", "cochrane", "nature")

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

test_that("v2 dispatch through tabviz preserves variant flag", {
  skip_if_not_installed()
  df <- data.frame(Site = "A", est = 0.5, lo = 0.3, hi = 0.7)

  for (header_style in c("light", "bold")) {
    spec <- tabviz(
      df, label = "Site",
      columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
      theme = WebTheme(
        inputs = ThemeInputs(brand_deep = "#000080"),
        variants = ThemeVariants(header_style = header_style)
      ),
      .spec_only = TRUE
    )
    out <- serialize_spec(spec)
    active_hdr <- if (header_style == "bold") out$theme$header$bold else out$theme$header$light
    if (header_style == "bold") {
      expect_equal(toupper(active_hdr$bg), "#000080")
    } else {
      expect_match(active_hdr$bg, "^#")
    }
  }
})
