expect_s7 <- function(x, class_name) {
  testthat::expect_true(inherits(x, paste0("tabviz::", class_name)))
}

# The 9 committed identities (27→9 cull, 2026-06-09).
ALL_PRESET_FNS <- list(
  web_theme_nejm, web_theme_ledger, web_theme_brutalist,
  web_theme_aurora, web_theme_terminal, web_theme_newsprint,
  web_theme_blueprint, web_theme_synthwave, web_theme_dwarven
)

test_that("every preset constructs a valid WebTheme", {
  for (fn in ALL_PRESET_FNS) {
    t <- fn()
    expect_s7(t, "WebTheme")
    expect_s7(t@inputs, "ThemeInputs")
    expect_true(is.finite(t@inputs@anchors_brand_L))
    expect_true(is.finite(t@inputs@anchors_brand_C))
    expect_true(is.finite(t@inputs@anchors_brand_H))
    cv <- theme_css_vars(t)
    expect_match(unname(cv["--tv-surface-bg"]), "^#[0-9A-Fa-f]{6}$")
    expect_match(unname(cv["--tv-text"]), "^#[0-9A-Fa-f]{6}$")
  }
})

test_that("preset names match their constructor names", {
  expect_equal(web_theme_nejm()@name, "nejm")
  expect_equal(web_theme_ledger()@name, "ledger")
  expect_equal(web_theme_blueprint()@name, "blueprint")
})

test_that("a two-color preset has a distinct accent anchor", {
  # V4: decorative is dropped; a two-color theme's 2nd hue folds into the
  # accent anchor. Ledger (teal brand + oxblood accent) must keep them apart.
  t <- web_theme_ledger()
  expect_true(is.finite(t@inputs@anchors_accent_L))
  expect_false(isTRUE(all.equal(t@inputs@anchors_accent_H,
                                 t@inputs@anchors_brand_H)))
})

test_that("NEJM preset's neutral anchors carry the brand hue", {
  # V4: brand-hued neutrals (the default `neutral_hue_from = "brand"`
  # derivation in derive_preset_anchors).
  t <- web_theme_nejm()
  expect_equal(t@inputs@anchors_paper_H, t@inputs@anchors_brand_H)
  expect_equal(t@inputs@anchors_ink_H,   t@inputs@anchors_brand_H)
})

test_that("dark-polarity survivors carry polarity = dark", {
  expect_equal(web_theme_aurora()@inputs@polarity, "dark")
  expect_equal(web_theme_terminal()@inputs@polarity, "dark")
  expect_equal(web_theme_synthwave()@inputs@polarity, "dark")
})

test_that("Terminal preset is monochrome (single-hue surface)", {
  expect_true(isTRUE(web_theme_terminal()@inputs@monochrome))
})

test_that("package_themes() registry exposes all categories", {
  # 27→9 cull (2026-06-09): 9 committed identities across 4 registers.
  reg <- package_themes()
  expect_setequal(names(reg), c("clinical", "editorial", "design", "expressive"))
  expect_length(reg$clinical, 1L)    # nejm
  expect_length(reg$editorial, 2L)   # newsprint, dwarven
  expect_length(reg$design, 2L)      # ledger, brutalist
  expect_length(reg$expressive, 4L)  # aurora, terminal, blueprint, synthwave
})

test_that("theme_registry returns flat name-to-theme map", {
  s <- theme_registry()
  expect_length(s, 9L)
})
