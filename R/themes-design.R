# Design-movement preset constructors.
#
# V4 (2026-06-04): anchors vocabulary. Editorial themes (Newsprint,
# Solarized, Atelier) lean on warm-paper feel via paperC/inkC bumps and,
# in some cases, route a decorative hue through the neutrals via
# `neutral_hue_from = <hex>` — replacing the v3 neutral_tint +
# neutral_tint_strength knobs.

#' Bauhaus theme - geometric primary colors with raised + grid texture.
#'
#' Archivo Black display, bold type scale (1.333), smooth curves
#' across all three ramps for the bold modular Bauhaus rhythm.
#' @return A [WebTheme].
#' @export
web_theme_bauhaus <- function() {
  a <- derive_preset_anchors("#D32023", "#FFCB05")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "tableau10",
    shell_mode = "raised",
    shell_texture = "grid",
    header_style = "bold",
    first_column_style = "bold",
    type_base_size = 15,
    type_scale_ratio = 1.333,
    type_weights = list(regular = 400, medium = 500, semibold = 700, bold = 800),
    fonts_body = "'Archivo', Inter, -apple-system, system-ui, sans-serif",
    fonts_display = "'Archivo Black', 'Archivo', sans-serif",
    web_fonts = list(
      web_font("Archivo", FONT_URLS$archivo),
      web_font("Archivo Black", FONT_URLS$archivo_black)
    ),
    curves = list(neutral = "smooth", brand = "smooth", accent = "smooth"),
    name = "bauhaus"
  )
}

#' Swiss theme - International Typographic Style: red brand + grid texture.
#'
#' Compact density + tight type (1.2 scale ratio). Inter (Helvetica-feel).
#' Grid texture showcases the underlying grid system. Achromatic neutrals.
#' @return A [WebTheme].
#' @export
web_theme_swiss <- function() {
  a <- derive_preset_anchors("#E30613", "#000000",
                             neutral_hue_from = NA_character_)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "tableau10",
    # C65: International Typographic Style — sharp corners, no exceptions.
    geometry = list(radius = list(sm = 0, md = 0, lg = 0, pill = 0)),
    density = "compact",
    shell_texture = "grid",
    header_style = "bold",
    type_scale_ratio = 1.2,
    type_weights = list(regular = 400, medium = 500, semibold = 600, bold = 700),
    fonts_body = "'Hanken Grotesk', 'Helvetica Neue', Helvetica, sans-serif",
    fonts_display = "'Hanken Grotesk', 'Helvetica Neue', Helvetica, sans-serif",
    web_fonts = list(
      web_font("Hanken Grotesk", FONT_URLS$hanken_grotesk)
    ),
    curves = list(neutral = "linear"),
    name = "swiss"
  )
}

#' Tufte theme - data-ink minimum: ruled texture, italic serif body, tight.
#'
#' Compact density x 0.9 factor for very tight rhythm; EB Garamond for
#' the editorial-quiet body. Log curve grounds the ink-on-paper feel.
#' Achromatic neutrals.
#' @return A [WebTheme].
#' @export
web_theme_tufte <- function() {
  a <- derive_preset_anchors("#222222", "#B54A46",
                             neutral_hue_from = NA_character_)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "greys",
    # 1f: data-ink discipline — hairline intervals.
    marks = list(interval_weight = "hair"),
    density = "compact",
    density_factor = 0.9,
    shell_texture = "ruled",
    type_base_size = 13,
    type_scale_ratio = 1.15,
    fonts_body = "'EB Garamond', Georgia, serif",
    fonts_display = "'EB Garamond', Georgia, serif",
    web_fonts = list(
      web_font("EB Garamond", FONT_URLS$eb_garamond)
    ),
    curves = list(neutral = "log"),
    name = "tufte"
  )
}

#' Newsprint theme - actual newspaper: grain texture, off-white paper,
#' serif body, Crimson Pro display.
#'
#' Decorative hue (#B17D5F) routed through the neutrals via
#' `neutral_hue_from` + elevated paperC/inkC give the warm paper feel.
#' Log curve on brand for deep newspaper-ink contrast.
#' @return A [WebTheme].
#' @export
web_theme_newsprint <- function() {
  a <- derive_preset_anchors("#2C2C2C", "#5C8A3F",
                             neutral_hue_from = "#B17D5F",
                             paper_C = 0.016, ink_C = 0.018)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    # C65: newspaper rows are tight — column-inches discipline.
    density_factor = 0.95,
    shell_texture = "grain",
    type_scale_ratio = 1.2,
    fonts_body = "'Frank Ruhl Libre', Georgia, serif",
    fonts_display = "'Crimson Pro', Georgia, 'Times New Roman', serif",
    web_fonts = list(
      web_font("Frank Ruhl Libre", FONT_URLS$frank_ruhl_libre),
      web_font("Crimson Pro", FONT_URLS$crimson_pro)
    ),
    curves = list(neutral = "smooth", brand = "log"),
    name = "newsprint"
  )
}

#' Solarized theme - Schoonover's editorial palette, light variant.
#'
#' Brand-tinted neutrals via elevated paperC/inkC give the trademark warm
#' yellow paper. Smooth curve on neutrals for the gentle gradient.
#' @return A [WebTheme].
#' @export
web_theme_solarized <- function() {
  a <- derive_preset_anchors("#268BD2", "#CB4B16",
                             paper_C = 0.012, ink_C = 0.014)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "tableau10",
    fonts_body = "'Public Sans', -apple-system, system-ui, sans-serif",
    fonts_mono = "'Spline Sans Mono', 'JetBrains Mono', monospace",
    web_fonts = list(
      web_font("Public Sans", FONT_URLS$public_sans),
      web_font("Spline Sans Mono", FONT_URLS$spline_sans_mono)
    ),
    curves = list(neutral = "smooth"),
    name = "solarized"
  )
}

#' Solarized Dark theme - dark polarity sibling of Solarized.
#' @return A [WebTheme].
#' @export
web_theme_solarized_dark <- function() {
  a <- derive_preset_anchors("#268BD2", "#CB4B16",
                             paper_C = 0.012, ink_C = 0.014)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    polarity = "dark",
    categorical = "tableau10",
    fonts_body = "'Public Sans', -apple-system, system-ui, sans-serif",
    fonts_mono = "'Spline Sans Mono', 'JetBrains Mono', monospace",
    web_fonts = list(
      web_font("Public Sans", FONT_URLS$public_sans),
      web_font("Spline Sans Mono", FONT_URLS$spline_sans_mono)
    ),
    curves = list(neutral = "smooth"),
    name = "solarized_dark"
  )
}

#' Tonal theme - Material You-style: raised shell, soft elevation,
#' friendly type rhythm.
#'
#' Roboto family + ease curves give the characteristic Material You feel.
#' @return A [WebTheme].
#' @export
web_theme_tonal <- function() {
  a <- derive_preset_anchors("#6750A4", "#7D5260")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "tableau10",
    # C65: Material You — generous radii.
    geometry = list(radius = list(sm = 4, md = 8, lg = 16, pill = 999)),
    shell_mode = "raised",
    type_scale_ratio = 1.25,
    fonts_body = "'Roboto', -apple-system, system-ui, sans-serif",
    fonts_display = "'Roboto Flex', 'Roboto', sans-serif",
    web_fonts = list(
      web_font("Roboto", FONT_URLS$roboto),
      web_font("Roboto Flex", FONT_URLS$roboto_flex)
    ),
    curves = list(neutral = "ease", brand = "ease", accent = "ease"),
    name = "tonal"
  )
}

#' Tonal Dark theme - dark polarity sibling of Tonal.
#' @return A [WebTheme].
#' @export
web_theme_tonal_dark <- function() {
  a <- derive_preset_anchors("#D0BCFF", "#EFB8C8")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    polarity = "dark",
    categorical = "tableau10",
    # C65: Material You — generous radii.
    geometry = list(radius = list(sm = 4, md = 8, lg = 16, pill = 999)),
    shell_mode = "raised",
    type_scale_ratio = 1.25,
    fonts_body = "'Roboto', -apple-system, system-ui, sans-serif",
    fonts_display = "'Roboto Flex', 'Roboto', sans-serif",
    web_fonts = list(
      web_font("Roboto", FONT_URLS$roboto),
      web_font("Roboto Flex", FONT_URLS$roboto_flex)
    ),
    curves = list(neutral = "ease", brand = "ease", accent = "ease"),
    name = "tonal_dark"
  )
}
