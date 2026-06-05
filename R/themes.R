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

#' Cochrane theme - cyan brand, orange accent.
#'
#' Vanilla baseline. Ease curve on neutrals for smooth gradation.
#' @return A [WebTheme].
#' @export
web_theme_cochrane <- function() {
  a <- derive_preset_anchors("#0099CC", "#C8553D")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    fonts_body = "'Source Sans 3', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Source Sans 3", FONT_URLS$source_sans_3)
    ),
    curves = list(neutral = "ease"),
    name = "cochrane"
  )
}

#' Lancet theme - navy + gold editorial gravitas.
#'
#' Raised shell evokes the cover feel; serif typography with elevated
#' scale ratio gives long-form journal rhythm.
#' @return A [WebTheme].
#' @export
web_theme_lancet <- function() {
  a <- derive_preset_anchors("#00407A", "#A6792A")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    shell_mode = "raised",
    type_scale_ratio = 1.25,
    fonts_body = "'Source Serif 4', Georgia, serif",
    fonts_display = "'Source Serif 4', Georgia, serif",
    web_fonts = list(
      web_font("Source Serif 4", FONT_URLS$source_serif_4)
    ),
    curves = list(neutral = "smooth"),
    name = "lancet"
  )
}

#' JAMA theme - black ink, mono palette, compact density.
#'
#' Tight type scale (1.15) + smaller base size (13) for the dense
#' scientific-table look. Achromatic neutrals.
#' @return A [WebTheme].
#' @export
web_theme_jama <- function() {
  a <- derive_preset_anchors("#0F171F", "#0F171F",
                             neutral_hue_from = NA_character_)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "brand_mono",
    density = "compact",
    type_base_size = 13,
    type_scale_ratio = 1.15,
    fonts_body = "'Spline Sans', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Spline Sans", FONT_URLS$spline_sans)
    ),
    name = "jama"
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
    type_scale_ratio = 1.25,
    fonts_body = "'Lora', Georgia, serif",
    fonts_display = "'Lora', Georgia, serif",
    web_fonts = list(
      web_font("Lora", FONT_URLS$lora)
    ),
    curves = list(brand = "smooth", neutral = "ease"),
    name = "nejm"
  )
}

#' Nature theme - teal brand + amber accent, raised shell + ruled texture.
#'
#' Subtle brand-tinted neutrals via paperC/inkC bumps give the page a soft
#' teal cast (the glossy-spread metaphor).
#' @return A [WebTheme].
#' @export
web_theme_nature <- function() {
  a <- derive_preset_anchors("#005A6C", "#E8A427",
                             paper_C = 0.008, ink_C = 0.012)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    shell_mode = "raised",
    shell_texture = "ruled",
    type_scale_ratio = 1.25,
    curves = list(brand = "smooth"),
    name = "nature"
  )
}

#' BMJ theme - clean clinical blue + red accent.
#' @return A [WebTheme].
#' @export
web_theme_bmj <- function() {
  a <- derive_preset_anchors("#2A6EBB", "#E33B3B")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    fonts_body = "'IBM Plex Sans', -apple-system, system-ui, sans-serif",
    fonts_display = "'IBM Plex Serif', Georgia, serif",
    web_fonts = list(
      web_font("IBM Plex Sans", FONT_URLS$ibm_plex_sans),
      web_font("IBM Plex Serif", FONT_URLS$ibm_plex_serif)
    ),
    curves = list(neutral = "ease"),
    name = "bmj"
  )
}

#' Available theme presets, organized by category.
#'
#' @return A nested list: category -> list of resolved [WebTheme] objects.
#' @export
package_themes <- function() {
  list(
    journals = list(
      cochrane  = web_theme_cochrane(),
      lancet    = web_theme_lancet(),
      jama      = web_theme_jama(),
      nejm      = web_theme_nejm(),
      nature    = web_theme_nature(),
      bmj       = web_theme_bmj()
    ),
    modes = list(
      dark      = web_theme_dark()
    ),
    design = list(
      bauhaus         = web_theme_bauhaus(),
      swiss           = web_theme_swiss(),
      tufte           = web_theme_tufte(),
      newsprint       = web_theme_newsprint(),
      solarized       = web_theme_solarized(),
      solarized_dark  = web_theme_solarized_dark(),
      tonal           = web_theme_tonal(),
      tonal_dark      = web_theme_tonal_dark()
    ),
    lotr = list(
      dwarven = web_theme_dwarven(),
      elvish  = web_theme_elvish(),
      hobbit  = web_theme_hobbit()
    ),
    showcase = list(
      synthwave = web_theme_synthwave(),
      brutalist = web_theme_brutalist(),
      atelier   = web_theme_atelier(),
      executive = web_theme_executive(),
      ledger    = web_theme_ledger(),
      terminal  = web_theme_terminal(),
      aurora    = web_theme_aurora(),
      blueprint = web_theme_blueprint(),
      sunprint  = web_theme_sunprint()
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
