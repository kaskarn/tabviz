# Tests for web_font() helper and WebTheme$web_fonts validator.

test_that("web_font() returns a 2-entry list with family + url", {
  wf <- web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel")
  expect_equal(wf$family, "Cinzel")
  expect_match(wf$url, "^https://")
})

test_that("web_font() rejects non-https URLs", {
  expect_error(web_font("X", "http://example.com/font"))
  expect_error(web_font("X", "ftp://example.com/font"))
  expect_error(web_font("X", "/local/font.css"))
})

test_that("web_font() rejects empty family or url", {
  expect_error(web_font("", "https://x"))
  expect_error(web_font("X", ""))
})

test_that("WebTheme accepts a valid web_fonts list", {
  th <- web_theme(
    web_fonts = list(
      web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel")
    )
  )
  expect_length(th@web_fonts, 1)
  expect_equal(th@web_fonts[[1]]$family, "Cinzel")
})

test_that("WebTheme validator rejects malformed web_fonts entries", {
  # Missing url
  expect_error(
    WebTheme(web_fonts = list(list(family = "X"))),
    "web_fonts"
  )
  # http (not https) url
  expect_error(
    WebTheme(web_fonts = list(list(family = "X", url = "http://x"))),
    "web_fonts"
  )
  # Wrong type for family
  expect_error(
    WebTheme(web_fonts = list(list(family = 1, url = "https://x"))),
    "web_fonts"
  )
})

test_that("Default WebTheme has empty web_fonts (no fonts to load)", {
  th <- WebTheme()
  expect_length(th@web_fonts, 0)
})

test_that("serialize_theme passes web_fonts to JSON spec as webFonts", {
  th <- web_theme(
    web_fonts = list(
      web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel")
    )
  )
  serialized <- tabviz:::serialize_theme(th)
  expect_named(serialized$webFonts[[1]], c("family", "url"))
  expect_equal(serialized$webFonts[[1]]$family, "Cinzel")
})

test_that("serialize_theme with no web_fonts returns empty list", {
  th <- web_theme()
  serialized <- tabviz:::serialize_theme(th)
  expect_length(serialized$webFonts, 0)
})
