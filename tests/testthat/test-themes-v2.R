expect_s7 <- function(x, class_name) {
  testthat::expect_true(inherits(x, paste0("tabviz::", class_name)))
}

preset_constructors <- list(
  default      = web_theme_default_v2,
  minimal      = web_theme_minimal_v2,
  dark         = web_theme_dark_v2,
  jama         = web_theme_jama_v2,
  lancet       = web_theme_lancet_v2,
  modern       = web_theme_modern_v2,
  presentation = web_theme_presentation_v2,
  cochrane     = web_theme_cochrane_v2,
  nature       = web_theme_nature_v2
)

for (preset_name in names(preset_constructors)) {
  local({
    pname <- preset_name
    ctor <- preset_constructors[[pname]]

    test_that(paste0("preset '", pname, "' constructs and resolves"), {
      t <- ctor()
      expect_s7(t, "WebTheme2")
      expect_equal(t@name, pname)
      # Tier 2 chrome resolved.
      expect_match(t@surface@base, "^#")
      expect_match(t@content@primary, "^#")
      expect_match(t@accent@default, "^#")
      # Series resolved.
      expect_gt(length(t@series), 0L)
      for (i in seq_along(t@series)) {
        expect_s7(t@series[[i]], "SlotBundle")
        expect_match(t@series[[i]]@fill,   "^#")
        expect_match(t@series[[i]]@stroke, "^#")
        expect_match(t@series[[i]]@fill_muted, "^#")
      }
      # Summary resolved.
      expect_match(t@summary@fill, "^#")
      # Spacing density-driven.
      expect_false(is.na(t@spacing@row_height))
      expect_false(is.na(t@spacing@header_height))
      expect_false(is.na(t@spacing@padding))
      # Component clusters resolved.
      expect_match(t@header@light@bg, "^#")
      expect_match(t@row@base@bg,     "^#")
      expect_match(t@cell@fg,         "^#")
    })
  })
}

test_that("package_themes_v2 returns all 9 presets named", {
  pkg <- package_themes_v2()
  expect_setequal(
    names(pkg),
    c("default", "minimal", "dark", "jama", "lancet",
      "modern", "presentation", "cochrane", "nature")
  )
  for (nm in names(pkg)) expect_s7(pkg[[nm]], "WebTheme2")
})

test_that("preset overrides survive resolution", {
  # JAMA explicitly sets dividers to black; resolution must not overwrite.
  jama <- web_theme_jama_v2()
  expect_equal(toupper(jama@divider@subtle), "#000000")
  expect_equal(toupper(jama@divider@strong), "#000000")
  # JAMA overrides spacing tokens (more compact than the preset).
  expect_equal(jama@spacing@row_height, 18)
  expect_equal(jama@spacing@cell_padding_x, 8)
  # Other JAMA spacing tokens fall back to the compact preset.
  expect_equal(jama@spacing@axis_gap, DENSITY_PRESETS$compact$axis_gap)
})

test_that("brand_deep mirrors brand by default", {
  d <- web_theme_default_v2()
  expect_equal(d@inputs@brand_deep, d@inputs@brand)
})

test_that("brand_deep can be set explicitly per preset", {
  # Lancet sets brand_deep = "#002D54" explicitly.
  l <- web_theme_lancet_v2()
  expect_equal(toupper(l@inputs@brand), "#00407A")
  expect_equal(toupper(l@inputs@brand_deep), "#002D54")
})

test_that("density flag sets compact / comfortable / spacious correctly", {
  expect_equal(web_theme_jama_v2()@variants@density, "compact")
  expect_equal(web_theme_default_v2()@variants@density, "comfortable")
  expect_equal(web_theme_modern_v2()@variants@density, "spacious")
})

test_that("series anchors match per-preset palette", {
  expect_length(web_theme_default_v2()@inputs@series_anchors, 5)
  expect_equal(toupper(web_theme_default_v2()@inputs@series_anchors[1]), "#0891B2")
  expect_equal(toupper(web_theme_lancet_v2()@inputs@series_anchors[1]),  "#00468B")
  expect_equal(toupper(web_theme_modern_v2()@inputs@series_anchors[1]),  "#3B82F6")
})

test_that("dark theme has dark canvas", {
  d <- web_theme_dark_v2()
  # Surface base should be the dark canvas, not a light tone.
  rgb <- farver::decode_colour(d@surface@base)[1, ]
  expect_lt(mean(rgb), 80)  # average channel under 80/255 -> clearly dark
})
