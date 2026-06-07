# Tests for the web-font embedding pipeline used by save_plot().
# Network fetches are bypassed by pre-populating the session cache.

test_that("parse_google_font_css extracts family/weight/style/src", {
  css <- '@font-face { font-family: "Cinzel"; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/cinzel/v23/abc.woff2) format("woff2"); unicode-range: U+0000-00FF; }'
  parsed <- tabviz:::parse_google_font_css(css)
  expect_length(parsed, 1)
  expect_equal(parsed[[1]]$family, "Cinzel")
  expect_equal(parsed[[1]]$weight, "400")
  expect_equal(parsed[[1]]$style, "normal")
  expect_equal(parsed[[1]]$unicode_range, "U+0000-00FF")
  expect_equal(parsed[[1]]$src, "https://fonts.gstatic.com/s/cinzel/v23/abc.woff2")
})

test_that("parse_google_font_css handles multi-block CSS", {
  css <- paste(
    '@font-face { font-family: "Cinzel"; font-style: normal; font-weight: 400; src: url(a.woff2) format("woff2"); }',
    '@font-face { font-family: "Cinzel"; font-style: normal; font-weight: 700; src: url(b.woff2) format("woff2"); }',
    sep = "\n"
  )
  parsed <- tabviz:::parse_google_font_css(css)
  expect_length(parsed, 2)
  expect_equal(parsed[[1]]$weight, "400")
  expect_equal(parsed[[2]]$weight, "700")
})

test_that("splice_font_face_into_svg inserts before existing </style>", {
  svg <- '<svg xmlns="http://www.w3.org/2000/svg"><style>text { fill: red; }</style><rect/></svg>'
  result <- tabviz:::splice_font_face_into_svg(svg, "@font-face { font-family: \"X\"; }")
  expect_match(result, "@font-face", fixed = TRUE)
  # The injected rule must come before the closing </style>, not after it.
  insert_pos <- regexpr("@font-face", result, fixed = TRUE)
  close_pos <- regexpr("</style>", result, fixed = TRUE)
  expect_true(insert_pos < close_pos)
  # And it must come AFTER the existing rule (text { fill: red; }) so we
  # don't overwrite it.
  red_pos <- regexpr("fill: red", result, fixed = TRUE)
  expect_true(red_pos < insert_pos)
})

test_that("splice_font_face_into_svg creates a <style> block when none exists", {
  svg <- '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
  result <- tabviz:::splice_font_face_into_svg(svg, "@font-face { font-family: \"X\"; }")
  expect_match(result, "<style>", fixed = TRUE)
  expect_match(result, "@font-face", fixed = TRUE)
})

test_that("embed_web_fonts uses cache and produces data: URIs", {
  # Pre-populate the cache so the function never touches the network.
  fake_url <- "https://fonts.googleapis.com/test.css"
  fake_rule <- '@font-face { font-family: "TestFont"; font-style: normal; font-weight: 400; src: url(data:font/woff2;base64,AAAA) format("woff2"); }'
  assign(fake_url, fake_rule, envir = tabviz:::.font_embed_cache)
  on.exit(rm(list = fake_url, envir = tabviz:::.font_embed_cache), add = TRUE)

  svg <- '<svg xmlns="http://www.w3.org/2000/svg"><style>text { fill: red; }</style><rect/></svg>'
  out <- tabviz:::embed_web_fonts(svg, list(list(family = "TestFont", url = fake_url)))

  expect_match(out, "@font-face", fixed = TRUE)
  expect_match(out, "data:font/woff2;base64", fixed = TRUE)
  expect_match(out, "TestFont", fixed = TRUE)
})

test_that("embed_web_fonts is a no-op when web_fonts is empty", {
  svg <- '<svg><style>x</style></svg>'
  expect_identical(tabviz:::embed_web_fonts(svg, list()), svg)
})

test_that("embed_web_fonts returns SVG unchanged on entry malformed", {
  expect_identical(tabviz:::embed_web_fonts("", list(list(family = "X", url = "u"))), "")
})

# ── rsvg fontconfig registration (R3 publication fix) ───────────────────────

test_that("PDF export embeds the theme's declared web font, not the fallback", {
  skip_on_cran()
  skip_if_offline()
  skip_if_not_installed("rsvg")
  skip_if_not_installed("curl")
  skip_if_not_installed("callr")

  # The export MUST run in a fresh R process: fontconfig reads
  # FONTCONFIG_FILE once, at pango's first initialization. In a test
  # suite, earlier rsvg-using tests have already initialized fontconfig,
  # so the session-font registration save_plot performs is invisible —
  # the PDF silently embeds the platform fallback (DejaVu on Linux) and
  # this test fails ONLY when run after other tests (passed locally,
  # failed in R CMD check on CI). A fresh process is also the supported
  # production path; see the first-init note in utils-embed-fonts.R.
  base_fonts <- callr::r(function() {
    df <- data.frame(study = c("Alpha", "Beta"),
                     hr = c(0.72, 0.85), lo = c(0.6, 0.7), hi = c(0.9, 1.02))
    w <- tabviz::tabviz(df, label = "study",
                        columns = list(tabviz::col_interval("hr", "lo", "hi")),
                        theme = tabviz::web_theme_nejm())
    f <- tempfile(fileext = ".pdf")
    suppressWarnings(tabviz::save_plot(w, f))
    txt <- suppressWarnings(readLines(f, warn = FALSE))
    grep("BaseFont", txt, value = TRUE, useBytes = TRUE)
  })

  # NEJM declares Lora. Before the fix, librsvg ignored the base64
  # @font-face splice and the PDF silently embedded Georgia (the CSS
  # fallback) — the R3 publication review's headline bug.
  # iconv-sanitize the info string: BaseFont lines come from raw PDF bytes
  # and an invalid multibyte sequence inside testthat's failure formatting
  # produced a hard `nchar()` error on CI instead of a clean failure.
  expect_true(any(grepl("Lora", base_fonts, useBytes = TRUE)),
              info = paste("BaseFont lines:",
                           paste(iconv(base_fonts, to = "UTF-8", sub = "?"),
                                 collapse = " | ")))
})
