# Theme palette swatches: opt-in 8-color list shown in the settings
# panel's "Theme" color tab. Defaults to NA; serializer derives a
# sensible palette from existing named colors when unset.

test_that("ColorPalette() builds without swatches (default NA)", {
  p <- ColorPalette()
  expect_true(length(p@swatches) == 1 && is.na(p@swatches))
})

test_that("ColorPalette accepts an explicit length-8 hex vector", {
  hex8 <- c("#111111", "#222222", "#333333", "#444444",
            "#555555", "#666666", "#777777", "#888888")
  p <- ColorPalette(swatches = hex8)
  expect_equal(p@swatches, hex8)
})

test_that("ColorPalette rejects a wrong-length swatches vector", {
  expect_error(
    ColorPalette(swatches = c("#000000", "#111111")),
    regexp = "length 8"
  )
})

test_that("ColorPalette rejects invalid hex in swatches", {
  bad <- c("#000000", "#111111", "#222222", "#333333",
           "not-a-hex", "#555555", "#666666", "#777777")
  expect_error(ColorPalette(swatches = bad), regexp = "swatches")
})

test_that("serializer derives 8-slot palette when unset", {
  theme <- web_theme_default()
  payload <- serialize_theme(theme)
  expect_length(payload$colors$swatches, 8)
  expect_true(all(grepl("^#", payload$colors$swatches)))
})

test_that("serializer emits explicit swatches when set", {
  hex8 <- c("#111111", "#222222", "#333333", "#444444",
            "#555555", "#666666", "#777777", "#888888")
  theme <- web_theme_default()
  theme@colors@swatches <- hex8
  payload <- serialize_theme(theme)
  expect_equal(payload$colors$swatches, hex8)
})

test_that("default_swatches mixes accents and surfaces from the palette", {
  p <- ColorPalette(
    primary = "#aa0000", accent = "#bb0000", secondary = "#cc0000",
    muted = "#dd0000", foreground = "#ee0000", border = "#ff0000",
    background = "#000011", row_bg = "#000022"
  )
  sw <- default_swatches(p)
  expect_equal(sw[1], "#aa0000")
  expect_equal(sw[2], "#bb0000")
  expect_equal(sw[7], "#000011")
  expect_equal(sw[8], "#000022")
})
