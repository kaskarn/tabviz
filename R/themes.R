# Journal preset constructors + the canonical dark mode + the package
# preset registry.
#
# V4 (2026-06-04): anchors vocabulary. Each preset declares a brand hex
# plus optional accent / polarity / paper-ink derivations and passes
# them through `derive_preset_anchors()` (mirrors TS `defineInputs` in
# srcjs/src/lib/theme/theme-presets-inputs.ts). The helper returns
# paper / ink / brand / accent OKLCH triples ready to forward to
# [web_theme()]. The preset's full Stage 2/3 personality (typography,
# shell mode, surface texture, density factor, per-ramp curves) layers
# on top via the rest of the `web_theme()` args.

# Paper / ink L defaults sourced from R/theme-defaults.R (the R-side
# default-value registry). Mirrors DEFAULT_PAPER_L / DEFAULT_INK_L in
# theme-presets-inputs.ts.
PRESET_PAPER_L <- THEME_DEFAULTS$paper_L
PRESET_INK_L   <- THEME_DEFAULTS$ink_L

# Derive the four V4 anchors from v3-style hex seeds. Mirrors the TS
# `deriveAnchors` in theme-presets-inputs.ts so R and TS presets emit
# identical anchor triples for the same seeds.
#
#   brand_hex        Required brand hex (drives the brand ramp + identity).
#   accent_hex       Optional accent hex. NULL = accent mirrors brand.
#   neutral_hue_from One of "brand" (default — paper/ink take brand hue),
#                    a hex string (paper/ink take that hex's hue — for
#                    editorial themes routing a secondary hue through
#                    neutrals), or `NA_character_` for achromatic
#                    (paper/ink H = 0).
#   paper_C, ink_C   Chroma intensity baked into paper/ink. Higher = warmer
#                    or more visibly tinted paper. Default 0.005/0.010
#                    (clinical clean).
#   paper_L, ink_L   Override paper/ink L. Default 0.987/0.180.
#
# Returns list(paper=, ink=, brand=, accent=) of oklch triples ready to
# forward to [web_theme()].
derive_preset_anchors <- function(brand_hex,
                                  accent_hex = NULL,
                                  neutral_hue_from = "brand",
                                  paper_C = 0.005,
                                  ink_C = 0.010,
                                  paper_L = PRESET_PAPER_L,
                                  ink_L = PRESET_INK_L) {
  brand_t  <- hex_to_oklch(brand_hex)
  accent_t <- if (!is.null(accent_hex)) hex_to_oklch(accent_hex) else NULL

  neutral_H <- if (length(neutral_hue_from) == 1L && is.na(neutral_hue_from)) {
    0
  } else if (identical(neutral_hue_from, "brand")) {
    brand_t$H
  } else {
    hex_to_oklch(neutral_hue_from)$H
  }

  list(
    paper  = list(L = paper_L, C = paper_C, H = neutral_H),
    ink    = list(L = ink_L,   C = ink_C,   H = neutral_H),
    brand  = brand_t,
    accent = accent_t
  )
}
#' NEJM theme - crimson brand + slate accent, classic medical serif.
#' @return A [WebTheme].
#' @export
web_theme_nejm <- function() {
  a <- derive_preset_anchors("#BD2F2F", "#1B5377")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    border_preset = "frame",
    type_scale_ratio = 1.25,
    fonts_body = "'Lora', Georgia, serif",
    fonts_display = "'Lora', Georgia, serif",
    web_fonts = list(
      web_font("Lora", FONT_URLS$lora)
    ),
    curves = list(brand = "smooth", neutral = "ease"),
    # House style (area C): clinical significance affordances — p-value
    # columns mark significance with stars and a pill; badges outlined.
    # Mirrors the TS preset (parity-gated). Option keys are wire camelCase.
    column_defaults = list(
      pvalue = list(stars = TRUE, significantStyle = "pill"),
      badge = list(outline = TRUE)
    ),
    name = "nejm"
  )
}
#' Available theme presets, organized by category.
#'
#' @return A nested list: category -> list of resolved [WebTheme] objects.
#' @export
package_themes <- function() {
  # The 9 committed identities (27→9 cull, locked 2026-06-09). Each owns a
  # distinct expressive axis (the rgc_v4 model); grouped here by register.
  list(
    clinical = list(
      nejm      = web_theme_nejm()       # restraint / the default
    ),
    editorial = list(
      newsprint = web_theme_newsprint(), # TEXTURE — warm grain serif
      dwarven   = web_theme_dwarven()    # FANTASY — Cinzel display serif
    ),
    design = list(
      ledger    = web_theme_ledger(),    # COLOR — teal + oxblood
      brutalist = web_theme_brutalist()  # GEOMETRY — sharp, thick rules
    ),
    expressive = list(
      aurora    = web_theme_aurora(),    # EFFECTS — glass + glow
      terminal  = web_theme_terminal(),  # ALIASING — mono phosphor
      blueprint = web_theme_blueprint(), # DRAFT / GRID — cyanotype
      synthwave = web_theme_synthwave()  # NEON
    )
  )
}

#' Flat name-to-theme map across all preset categories.
#'
#' @return A named list of [WebTheme] objects.
#' @export
theme_registry <- function() {
  cats <- package_themes()
  flat <- list()
  for (cat in cats) {
    for (nm in names(cat)) flat[[nm]] <- cat[[nm]]
  }
  flat
}
