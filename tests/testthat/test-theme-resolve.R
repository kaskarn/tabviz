expect_s7 <- function(x, class_name) {
  testthat::expect_true(inherits(x, paste0("tabviz::", class_name)))
}

# Convenience: a fresh resolved default theme.
resolved_default <- function() resolve_theme(WebTheme())


test_that("resolve_theme returns a WebTheme", {
  out <- resolved_default()
  expect_s7(out, "WebTheme")
})

test_that("resolve_theme fills Tier 2 chrome from neutrals", {
  t <- resolved_default()
  expect_match(t@surface@base, "^#")
  expect_match(t@surface@muted, "^#")
  expect_match(t@surface@raised, "^#")
  expect_match(t@content@primary, "^#")
  expect_match(t@content@secondary, "^#")
  expect_match(t@content@muted, "^#")
  expect_match(t@content@inverse, "^#")
  expect_match(t@divider@subtle, "^#")
  expect_match(t@divider@strong, "^#")
})

test_that("resolve_theme fills accent + tint ramp", {
  t <- resolved_default()
  expect_match(t@accent@default, "^#")
  expect_match(t@accent@muted, "^#")
  expect_match(t@accent@tint_subtle, "^#")
  expect_match(t@accent@tint_medium, "^#")
  # tint_medium is more saturated than tint_subtle, so they shouldn't collide.
  expect_false(identical(t@accent@tint_subtle, t@accent@tint_medium))
})

test_that("resolve_theme expands series anchors into slot bundles", {
  inputs <- ThemeInputs(series_anchors = c("#1F3A5F", "#B08938"))
  t <- resolve_theme(WebTheme(inputs = inputs))
  expect_length(t@series, 2L)
  expect_s7(t@series[[1]], "SlotBundle")
  expect_equal(toupper(t@series[[1]]@fill), "#1F3A5F")
  expect_match(t@series[[1]]@stroke, "^#")
  expect_match(t@series[[1]]@fill_muted, "^#")
  expect_match(t@series[[1]]@text_fg, "^#")
})

test_that("series[1] carries the brand-derived fill (used as the pooled-effect diamond)", {
  t <- resolve_theme(WebTheme(inputs = ThemeInputs(
    brand = "#1F3A5F",
    series_anchors = c("#1F3A5F", "#888888")
  )))
  expect_equal(toupper(t@series[[1]]@fill), "#1F3A5F")
})

test_that("user-set fields survive resolution (idempotence + override)", {
  t <- WebTheme()
  t@surface@base <- "#FF00FF"
  t@series <- list(SlotBundle(fill = "#ABCDEF"))
  t@row@hover@bg <- "#123456"

  out <- resolve_theme(t)
  expect_equal(toupper(out@surface@base), "#FF00FF")
  expect_equal(toupper(out@series[[1]]@fill), "#ABCDEF")
  expect_equal(toupper(out@row@hover@bg), "#123456")

  # Re-resolving must not change anything (idempotence).
  out2 <- resolve_theme(out)
  expect_equal(toupper(out2@surface@base), "#FF00FF")
  expect_equal(toupper(out2@row@hover@bg), "#123456")
})

test_that("density preset drives spacing", {
  t_compact <- resolve_theme(WebTheme(variants = ThemeVariants(density = "compact")))
  t_comfy   <- resolve_theme(WebTheme(variants = ThemeVariants(density = "comfortable")))
  t_spacy   <- resolve_theme(WebTheme(variants = ThemeVariants(density = "spacious")))

  expect_lt(t_compact@spacing@row_height, t_comfy@spacing@row_height)
  expect_lt(t_comfy@spacing@row_height,   t_spacy@spacing@row_height)
  expect_equal(t_comfy@spacing@row_height, 24)
})

test_that("per-token spacing override preserved across density change", {
  t <- WebTheme(variants = ThemeVariants(density = "spacious"))
  t@spacing@row_height <- 99
  out <- resolve_theme(t)
  expect_equal(out@spacing@row_height, 99)
  # Other fields fall back to spacious preset.
  expect_equal(out@spacing@header_height, DENSITY_PRESETS$spacious$header_height)
})

test_that("Tier 1 NA mirrors fire", {
  inp <- ThemeInputs(brand = "#123456")
  t <- resolve_theme(WebTheme(inputs = inp))
  expect_equal(toupper(t@inputs@brand_deep), "#123456")
  expect_equal(t@inputs@font_display, t@inputs@font_body)
})

test_that("explicit brand_deep is preserved", {
  inp <- ThemeInputs(brand = "#123456", brand_deep = "#000000")
  t <- resolve_theme(WebTheme(inputs = inp))
  expect_equal(toupper(t@inputs@brand_deep), "#000000")
})

test_that("text roles get filled from font + content", {
  t <- resolved_default()
  expect_match(t@text@cell@family, "system-ui|.+")  # mirror of font_body default
  expect_equal(t@text@cell@figures, "tabular")
  expect_equal(t@text@title@figures, "proportional")
  expect_equal(t@text@caption@italic, TRUE)
  expect_match(t@text@cell@fg, "^#")
  expect_match(t@text@tick@fg, "^#")
})

test_that("header cluster carries both light and bold variants", {
  t <- resolved_default()
  expect_match(t@header@light@bg, "^#")
  expect_match(t@header@light@fg, "^#")
  expect_match(t@header@bold@bg, "^#")
  expect_match(t@header@bold@fg, "^#")
  # Bold uses brand.deep on dark; fg should be inverse (light).
  expect_equal(t@header@bold@fg, t@content@inverse)
})

test_that("row group L1 has the strongest treatment", {
  t <- resolved_default()
  expect_match(t@row_group@L1@bg, "^#")
  expect_match(t@row_group@L1@rule, "^#")
  expect_equal(t@row_group@L1@text@weight, 600)
  expect_equal(t@row_group@L1@rule, t@divider@strong)
  # L2 weight is medium (500), L3 is regular (400).
  expect_equal(t@row_group@L2@text@weight, 500)
})

test_that("row states resolve from surface and accent", {
  t <- resolved_default()
  expect_equal(t@row@base@bg, t@surface@base)
  expect_equal(t@row@alt@bg,  t@surface@muted)
  expect_equal(t@row@hover@bg, t@accent@muted)
  expect_equal(t@row@selected@bg, t@accent@muted)
})

test_that("row semantics resolve to recognizable values", {
  t <- resolved_default()
  expect_equal(t@row@emphasis@font_weight, 600)
  expect_equal(t@row@emphasis@marker_fill, t@content@primary)
  expect_equal(t@row@muted@marker_fill, t@content@muted)
  expect_equal(t@row@accent@marker_fill, t@accent@default)
})

test_that("first column bold variant is emphasized", {
  t <- resolved_default()
  expect_equal(t@first_column@bold@bg, t@surface@muted)
  expect_equal(t@first_column@bold@weight, 600)
})

test_that("plot scaffolding resolves with transparent bg by default", {
  t <- resolved_default()
  expect_true(is.na(t@plot@bg))
  expect_equal(t@plot@axis_line, t@divider@strong)
  expect_equal(t@plot@gridline, t@divider@subtle)
  expect_equal(t@plot@reference, t@divider@strong)
})

test_that("Dividers carries strong_on_dark for bold-mode header rule", {
  t <- resolved_default()
  expect_match(t@divider@strong_on_dark, "^#")
  # Bold-mode header rule reads strong_on_dark, not brand_deep (would be
  # invisible against the brand_deep header bg).
  expect_equal(t@header@bold@rule, t@divider@strong_on_dark)
  expect_false(identical(t@header@bold@rule, t@header@bold@bg))
  expect_equal(t@column_group@bold@rule, t@divider@strong_on_dark)
})

test_that("title and forest-axis labels default to brand_deep fg", {
  t <- resolved_default()
  expect_equal(t@text@title@fg, t@inputs@brand_deep)
  expect_equal(t@plot@axis_label@fg, t@inputs@brand_deep)
  expect_equal(t@plot@tick_label@fg, t@inputs@brand_deep)
})

test_that("L1 group bg is variant-aware (brand-mix under bold; tint under light)", {
  light_t <- resolve_theme(WebTheme())
  bold_t  <- resolve_theme(WebTheme(variants = ThemeVariants(header_style = "bold")))
  # Under light variant, L1 stays on accent.tint_subtle.
  expect_equal(light_t@row_group@L1@bg, light_t@accent@tint_subtle)
  # Under bold variant, L1 picks up a brand_deep tint and is no longer
  # equal to accent.tint_subtle (preserves the chrome/data wall — brand
  # only "leaks" into chrome when the user has chosen a brand-forward
  # header style).
  expect_match(bold_t@row_group@L1@bg, "^#")
  expect_false(identical(bold_t@row_group@L1@bg, bold_t@accent@tint_subtle))
})

test_that("resolve_chrome and resolve_data don't cross subsystems", {
  # Chrome derivation should not look at series_anchors.
  inp1 <- ThemeInputs(series_anchors = c("#FF0000"))
  inp2 <- ThemeInputs(series_anchors = c("#00FF00"))
  c1 <- resolve_chrome(inp1)
  c2 <- resolve_chrome(inp2)
  expect_equal(c1$surface@base,  c2$surface@base)
  expect_equal(c1$accent@default, c2$accent@default)
  expect_equal(c1$content@primary, c2$content@primary)
})

test_that("resolve_data is deterministic given the same inputs", {
  surface_base <- "#F7F8FA"
  content_primary <- "#2A2F38"
  inp <- resolve_inputs_mirrors(
    ThemeInputs(series_anchors = c("#1F3A5F"), brand = "#1F3A5F")
  )
  d1 <- resolve_data(inp, surface_base, content_primary, list())
  d2 <- resolve_data(inp, surface_base, content_primary, list())
  expect_equal(d1$series[[1]]@fill,   d2$series[[1]]@fill)
  expect_equal(d1$series[[1]]@stroke, d2$series[[1]]@stroke)
})

test_that("partial slot bundle overrides survive resolution", {
  partial <- SlotBundle(fill = "#FF00FF")  # only fill set
  t <- WebTheme(series = list(partial))
  out <- resolve_theme(t)
  expect_equal(toupper(out@series[[1]]@fill), "#FF00FF")  # preserved
  expect_match(out@series[[1]]@stroke, "^#")               # derived
  expect_match(out@series[[1]]@fill_muted, "^#")           # derived
})

test_that("resolve_theme rejects non-WebTheme input", {
  expect_error(resolve_theme(list()), "WebTheme")
  expect_error(resolve_theme("default"), "WebTheme")
})

test_that("variants flip header/first-column without mutating Tier 2", {
  t_light <- resolve_theme(WebTheme())
  t_bold  <- resolve_theme(WebTheme(
    variants = ThemeVariants(header_style = "bold", first_column_style = "bold")
  ))
  # Tier 2 chrome unchanged.
  expect_equal(t_light@surface@base, t_bold@surface@base)
  expect_equal(t_light@accent@default, t_bold@accent@default)
  # Tier 3 cluster bundles also identical (variant choice is a render-time
  # dispatch, not a Tier 3 mutation).
  expect_equal(t_light@header@light@bg, t_bold@header@light@bg)
  expect_equal(t_light@header@bold@bg,  t_bold@header@bold@bg)
})
