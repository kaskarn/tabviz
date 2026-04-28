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

test_that("series[1] carries the seeded fill (used as the pooled-effect diamond)", {
  t <- resolve_theme(WebTheme(inputs = ThemeInputs(
    primary = "#1F3A5F",
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

test_that("Tier 1 NA mirrors fire (primary_deep auto-darkens, font_display falls back)", {
  inp <- ThemeInputs(primary = "#123456")
  t <- resolve_theme(WebTheme(inputs = inp))
  # primary_deep is the OKLCH-darkened primary by default — a literal mirror
  # would make "deep" a misnomer. Resolved value must be a hex but NOT
  # equal to primary (it's strictly darker).
  expect_match(t@inputs@primary_deep, "^#[0-9A-Fa-f]{6}$")
  expect_false(identical(toupper(t@inputs@primary_deep), "#123456"))
  expect_equal(t@inputs@font_display, t@inputs@font_body)
})

test_that("explicit primary_deep is preserved", {
  inp <- ThemeInputs(primary = "#123456", primary_deep = "#000000")
  t <- resolve_theme(WebTheme(inputs = inp))
  expect_equal(toupper(t@inputs@primary_deep), "#000000")
})

test_that("identity mirror chain: secondary/tertiary mirror up the chain when NA", {
  # Mono: only primary set. Both downstream tiers mirror; their _deep
  # companions follow primary_deep (not auto-darkened from the seed) so
  # pinned primary_deep propagates.
  t <- resolve_theme(WebTheme(inputs = ThemeInputs(
    primary = "#1F3A5F", primary_deep = "#0F1F38"
  )))
  expect_equal(toupper(t@inputs@secondary), "#1F3A5F")
  expect_equal(toupper(t@inputs@tertiary), "#1F3A5F")
  expect_equal(toupper(t@inputs@secondary_deep), "#0F1F38")
  expect_equal(toupper(t@inputs@tertiary_deep), "#0F1F38")
})

test_that("identity mirror chain: pinned secondary breaks mirror; tertiary follows secondary", {
  t <- resolve_theme(WebTheme(inputs = ThemeInputs(
    primary = "#FF0000", secondary = "#00FF00"
  )))
  expect_equal(toupper(t@inputs@secondary), "#00FF00")
  expect_equal(toupper(t@inputs@tertiary), "#00FF00")
  # secondary was pinned -> secondary_deep auto-darkens from secondary
  # (NOT from primary_deep, since secondary is not mirroring).
  expect_match(t@inputs@secondary_deep, "^#[0-9A-Fa-f]{6}$")
  expect_false(identical(toupper(t@inputs@secondary_deep), "#00FF00"))
  # tertiary mirrors secondary -> tertiary_deep follows secondary_deep.
  expect_equal(t@inputs@tertiary_deep, t@inputs@secondary_deep)
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
  # Bold uses primary_deep on dark; fg should be inverse (light).
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
  # row.alt.bg is half-strength of surface.muted from surface.base — keeps
  # banding clearly subtler than the header band (which uses full muted).
  # Should be distinct from BOTH base and muted, and OKLCH lightness should
  # sit between them.
  expect_match(t@row@alt@bg, "^#[0-9A-Fa-f]{6}$")
  expect_false(identical(t@row@alt@bg, t@surface@base))
  expect_false(identical(t@row@alt@bg, t@surface@muted))
  base_L  <- to_oklch(t@surface@base)[1, 1]
  alt_L   <- to_oklch(t@row@alt@bg)[1, 1]
  muted_L <- to_oklch(t@surface@muted)[1, 1]
  expect_lte(min(base_L, muted_L), alt_L)
  expect_gte(max(base_L, muted_L), alt_L)
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

test_that("bold-mode header/col-group rules contrast against their own bg (component-local)", {
  t <- resolved_default()
  # Each cluster's bold rule is a per-cluster mix(content.inverse, <its own
  # bg>, 0.4) so it contrasts against THAT band, not a global token.
  expect_match(t@header@bold@rule, "^#")
  expect_match(t@column_group@bold@rule, "^#")
  expect_false(identical(t@header@bold@rule, t@header@bold@bg))
  # In a mono theme, header.bold.bg == column_group.bold.bg (both =
  # primary_deep, since secondary mirrors primary). So the rules also match.
  expect_equal(t@header@bold@rule, t@column_group@bold@rule)
  # Verify the formula directly.
  expect_equal(
    t@header@bold@rule,
    oklch_mix(t@content@inverse, t@inputs@primary_deep, 0.40)
  )
  expect_equal(
    t@column_group@bold@rule,
    oklch_mix(t@content@inverse, t@inputs@secondary_deep, 0.40)
  )
})

test_that("title defaults to primary_deep; axis labels lean tertiary", {
  t <- resolved_default()
  # Title carries primary identity — keeps the tone the table opens with.
  expect_equal(t@text@title@fg, t@inputs@primary_deep)
  # Axis + tick labels are scaffolding text — should recede, but pick
  # up a faint (10%) tertiary lean so they coordinate with axis lines
  # and gridlines (also tertiary-tinted via the divider chain). Mirror
  # chain collapses this to the same hue as today's content.muted in
  # mono themes where tertiary mirrors primary.
  expected_axis_fg <- oklch_mix(t@content@muted, t@inputs@tertiary_deep, 0.10)
  expect_equal(t@plot@axis_label@fg, expected_axis_fg)
  expect_equal(t@plot@tick_label@fg, expected_axis_fg)
})

test_that("typography hierarchy maps onto identity tiers (mirror-aware)", {
  t <- resolved_default()
  # Subtitle and label lean secondary; caption / tick / footnote lean
  # tertiary. Body and cell stay strictly neutral (legibility floor).
  expect_equal(t@text@subtitle@fg, oklch_mix(t@content@secondary, t@inputs@secondary_deep, 0.30))
  expect_equal(t@text@label@fg,    oklch_mix(t@content@secondary, t@inputs@secondary_deep, 0.20))
  expect_equal(t@text@caption@fg,  oklch_mix(t@content@secondary, t@inputs@tertiary_deep,  0.30))
  expect_equal(t@text@tick@fg,     oklch_mix(t@content@muted,     t@inputs@tertiary_deep,  0.10))
  expect_equal(t@text@footnote@fg, oklch_mix(t@content@muted,     t@inputs@tertiary_deep,  0.20))
  # Body / cell stay neutral.
  expect_equal(t@text@body@fg, t@content@primary)
  expect_equal(t@text@cell@fg, t@content@primary)
})

test_that("L1 group bg is secondary-derived (16% mix) in both variants", {
  light_t <- resolve_theme(WebTheme())
  bold_t  <- resolve_theme(WebTheme(variants = ThemeVariants(header_style = "bold")))
  expected <- oklch_mix(light_t@surface@base, light_t@inputs@secondary_deep, 0.16)
  expect_equal(light_t@row_group@L1@bg, expected)
  expect_equal(bold_t@row_group@L1@bg, expected)
  # Structural groupings — column and row — both live on secondary so they
  # coordinate as a family. Routing through identity (rather than accent)
  # keeps the group bar in a different color family from hover/selected
  # (which use accent.muted), so multiple highlighted rows don't merge
  # into the bar.
  expect_false(identical(light_t@row_group@L1@bg, light_t@accent@tint_subtle))
  expect_false(identical(bold_t@row_group@L1@bg, bold_t@accent@tint_subtle))
})

test_that("two-color theme: L1 row-group bg tracks secondary, not primary", {
  t <- resolve_theme(WebTheme(inputs = ThemeInputs(
    primary = "#FF0000", secondary = "#00FF00"
  )))
  # column-group bold and row-group L1 should both derive from
  # secondary_deep (green), not primary_deep (red).
  expect_equal(t@column_group@bold@bg, t@inputs@secondary_deep)
  expected_l1 <- oklch_mix(t@surface@base, t@inputs@secondary_deep, 0.16)
  expect_equal(t@row_group@L1@bg, expected_l1)
})

test_that("resolve_chrome and resolve_data don't cross subsystems", {
  # Chrome derivation should not look at series_anchors. resolve_chrome
  # assumes resolve_inputs_mirrors() has run, so feed it mirrored inputs.
  inp1 <- resolve_inputs_mirrors(ThemeInputs(series_anchors = c("#FF0000")))
  inp2 <- resolve_inputs_mirrors(ThemeInputs(series_anchors = c("#00FF00")))
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
    ThemeInputs(series_anchors = c("#1F3A5F"), primary = "#1F3A5F")
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
