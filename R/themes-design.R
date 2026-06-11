# Design-movement preset constructors.
#
# V4 (2026-06-04): anchors vocabulary. Editorial themes (Newsprint,
# Solarized, Atelier) lean on warm-paper feel via paperC/inkC bumps and,
# in some cases, route a decorative hue through the neutrals via
# `neutral_hue_from = <hex>` — replacing the v3 neutral_tint +
# neutral_tint_strength knobs.
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
    # House style (area C): broadsheet restraint — muted ink stars,
    # badges as small print bullets. Mirrors the TS preset.
    column_defaults = list(
      pvalue = list(stars = TRUE, starsColor = "ink2"),
      badge = list(shape = "circle", size = "sm")
    ),
    name = "newsprint"
  )
}