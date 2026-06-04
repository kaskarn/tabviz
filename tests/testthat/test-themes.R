expect_s7 <- function(x, class_name) {
  testthat::expect_true(inherits(x, paste0("tabviz::", class_name)))
}

ALL_PRESET_FNS <- list(
  web_theme_cochrane, web_theme_lancet, web_theme_jama,
  web_theme_nejm, web_theme_nature, web_theme_bmj, web_theme_dark,
  web_theme_bauhaus, web_theme_swiss, web_theme_tufte, web_theme_newsprint,
  web_theme_solarized, web_theme_solarized_dark,
  web_theme_tonal, web_theme_tonal_dark,
  web_theme_dwarven, web_theme_elvish, web_theme_hobbit,
  web_theme_synthwave, web_theme_atelier, web_theme_executive
)

test_that("every preset constructs a valid WebTheme", {
  for (fn in ALL_PRESET_FNS) {
    t <- fn()
    expect_s7(t, "WebTheme")
    expect_s7(t@inputs, "ThemeInputs")
    expect_match(t@inputs@brand, "^#[0-9A-Fa-f]{6}$")
    expect_match(t@surface@base, "^#[0-9A-Fa-f]{6}$")
    expect_match(t@content@primary, "^#[0-9A-Fa-f]{6}$")
  }
})

test_that("preset names match their constructor names", {
  expect_equal(web_theme_cochrane()@name, "cochrane")
  expect_equal(web_theme_lancet()@name, "lancet")
  expect_equal(web_theme_dark()@name, "dark")
})

test_that("Lancet preset has a decorative second color", {
  t <- web_theme_lancet()
  expect_false(is.na(t@inputs@decorative))
  expect_match(t@inputs@decorative, "^#[0-9A-Fa-f]{6}$")
})

test_that("Cochrane preset has no decorative", {
  t <- web_theme_cochrane()
  expect_true(is.na(t@inputs@decorative))
})

test_that("Dark preset has mode = dark", {
  expect_equal(web_theme_dark()@inputs@mode, "dark")
  expect_equal(web_theme_solarized_dark()@inputs@mode, "dark")
  expect_equal(web_theme_tonal_dark()@inputs@mode, "dark")
})

test_that("JAMA preset uses brand_mono categorical", {
  expect_equal(web_theme_jama()@inputs@categorical, "brand_mono")
})

test_that("package_themes() registry exposes all categories", {
  reg <- package_themes()
  expect_setequal(names(reg), c("journals", "design", "lotr", "showcase"))
  expect_length(reg$journals, 7L)
  expect_length(reg$design, 8L)
  expect_length(reg$lotr, 3L)
  expect_length(reg$showcase, 3L)
})

test_that("theme_registry returns flat name-to-theme map", {
  s <- theme_registry()
  expect_true(length(s) >= 21L)
})
