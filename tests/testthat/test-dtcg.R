# DTCG interop + suggest_theme (theme-rework Wave 4).

test_that("suggest_theme derives a resolvable, light-paper theme from a brand hex", {
  th <- suggest_theme("#0066cc")
  expect_s7_class(th, tabviz::WebTheme)
  expect_gt(th@inputs@anchors_paper_L, 0.9)   # near-white paper
  expect_lt(th@inputs@anchors_ink_L, 0.4)     # dark ink
  # resolves + paints legibly
  cv <- theme_css_vars(th)
  expect_true(!is.null(cv[["--tv-text"]]) && !is.null(cv[["--tv-surface-bg"]]))
  expect_error(suggest_theme("not-a-color"), "valid hex")
})

test_that("theme_to_dtcg / theme_from_dtcg round-trip is lossless (Wave 4)", {
  th <- web_theme(name = "rt", brand = "#7aa2f7", accent = "#bb9af7") |>
    set_polarity("dark") |>
    set_role("text-muted", "brand", 8)
  doc <- theme_to_dtcg(th)
  expect_true(all(c("reference", "semantic", "component") %in% names(doc$tabviz)))
  # semantic roles alias into reference, not baked hex
  expect_match(doc$tabviz$semantic$surface$`$value`, "^\\{tabviz\\.reference\\.")
  back <- theme_from_dtcg(doc)
  expect_identical(theme_css_vars(back)[["--tv-surface-bg"]],
                   theme_css_vars(th)[["--tv-surface-bg"]])
  expect_identical(back@role_overrides[["text-muted"]]$ramp, "brand")
})

test_that("theme_to_dtcg writes a file; theme_from_dtcg reads it back", {
  th <- web_theme_nejm()
  f <- withr::local_tempfile(fileext = ".json")
  theme_to_dtcg(th, file = f)
  expect_true(file.exists(f))
  back <- theme_from_dtcg(f)
  expect_s7_class(back, tabviz::WebTheme)
})

test_that("theme_from_dtcg rejects a foreign DTCG file (no tabviz provenance)", {
  foreign <- list(tabviz = list(reference = list(), semantic = list(), component = list()),
                  `$extensions` = list())
  expect_error(theme_from_dtcg(foreign), "provenance|tabviz")
})
