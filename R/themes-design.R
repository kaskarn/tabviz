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
    font_body = "'Archivo', 'Inter', 'Helvetica Neue', Helvetica, sans-serif",
    font_display = "'Archivo Black', 'Archivo', 'Helvetica Neue', sans-serif",
    web_fonts = list(
      web_font("Archivo", "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800&display=swap"),
      web_font("Archivo Black", "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap")
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
    density = "compact",
    shell_texture = "grid",
    header_style = "bold",
    type_scale_ratio = 1.2,
    type_weights = list(regular = 400, medium = 500, semibold = 600, bold = 700),
    font_body = "'Inter', 'Helvetica Neue', Helvetica, sans-serif",
    font_display = "'Inter', 'Helvetica Neue', Helvetica, sans-serif",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap")
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
  a <- derive_preset_anchors("#222222", "#888888",
                             neutral_hue_from = NA_character_)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "greys",
    density = "compact",
    density_factor = 0.9,
    shell_texture = "ruled",
    type_base_size = 13,
    type_scale_ratio = 1.15,
    font_body = "'EB Garamond', Georgia, 'Times New Roman', serif",
    font_display = "'EB Garamond', Georgia, 'Times New Roman', serif",
    web_fonts = list(
      web_font("EB Garamond", "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap")
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
    shell_texture = "grain",
    type_scale_ratio = 1.2,
    font_body = "Georgia, 'Times New Roman', serif",
    font_display = "'Crimson Pro', Georgia, 'Times New Roman', serif",
    web_fonts = list(
      web_font("Crimson Pro", "https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&display=swap")
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
    font_body = "'Inter', -apple-system, system-ui, sans-serif",
    font_mono = "'JetBrains Mono', 'Fira Code', monospace",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"),
      web_font("JetBrains Mono", "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap")
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
    font_body = "'Inter', -apple-system, system-ui, sans-serif",
    font_mono = "'JetBrains Mono', 'Fira Code', monospace",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"),
      web_font("JetBrains Mono", "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap")
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
    shell_mode = "raised",
    type_scale_ratio = 1.25,
    font_body = "'Roboto', -apple-system, system-ui, sans-serif",
    font_display = "'Roboto Flex', 'Roboto', sans-serif",
    web_fonts = list(
      web_font("Roboto", "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"),
      web_font("Roboto Flex", "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,700&display=swap")
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
    shell_mode = "raised",
    type_scale_ratio = 1.25,
    font_body = "'Roboto', -apple-system, system-ui, sans-serif",
    font_display = "'Roboto Flex', 'Roboto', sans-serif",
    web_fonts = list(
      web_font("Roboto", "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"),
      web_font("Roboto Flex", "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,700&display=swap")
    ),
    curves = list(neutral = "ease", brand = "ease", accent = "ease"),
    name = "tonal_dark"
  )
}

# ─────────────────────────────────────────────────────────────────────
# Stage 4 additions: bold showcase themes
# ─────────────────────────────────────────────────────────────────────

#' Synthwave theme - neon-on-deep-space showcase.
#'
#' Dark polarity + float shell + grid texture (the perspective-rail
#' retro look). Monospace body (terminal vibe). Brand-tinted neutrals
#' via elevated paperC/inkC give the magenta drift. Exp curves on
#' brand+accent for saturated neon mids. Phase D: neon glow on the
#' accent anchor + vivid brand-to-accent gradient shell + raised
#' elevation — the full effects stack.
#' @return A [WebTheme].
#' @export
web_theme_synthwave <- function() {
  a <- derive_preset_anchors("#FF00C8", "#FAFF00",
                             paper_C = 0.016, ink_C = 0.020)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    polarity = "dark",
    categorical = "tableau10",
    shell_mode = "float",
    shell_texture = "grid",
    type_base_size = 13,
    type_scale_ratio = 1.2,
    type_weights = list(regular = 400, medium = 500, semibold = 600, bold = 700),
    font_body = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    font_display = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    font_mono = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    web_fonts = list(
      web_font("JetBrains Mono", "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap")
    ),
    curves = list(neutral = "smooth", brand = "exp", accent = "exp"),
    effects = list(
      glow_intensity = "neon",
      glow_anchor = "accent",
      gradient_shell_intensity = "vivid",
      gradient_shell_angle = 110,
      elevation = "raised"
    ),
    name = "synthwave"
  )
}

#' Brutalist theme - radius-zero, thick rules, no effects.
#'
#' The substrate smoke test for the Phase D GEOMETRY axis. Achromatic
#' neutrals, ink-and-paper contrast, exposed grid texture, no
#' softening. Heavy weights, compact density, no glow/gradient.
#' @return A [WebTheme].
#' @export
web_theme_brutalist <- function() {
  a <- derive_preset_anchors("#000000", "#000000",
                             neutral_hue_from = NA_character_)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "greys",
    density = "compact",
    shell_texture = "grid",
    type_base_size = 14,
    type_scale_ratio = 1.25,
    type_weights = list(regular = 500, medium = 700, semibold = 800, bold = 900),
    font_body = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    font_display = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap")
    ),
    curves = list(neutral = "linear"),
    geometry = list(
      radius       = list(sm = 0, md = 0, lg = 0, pill = 0),
      border_width = list(hair = 1, thin = 1.5, regular = 2, thick = 3)
    ),
    effects = list(
      glow_intensity = "none",
      gradient_shell_intensity = "none",
      elevation = "none"
    ),
    name = "brutalist"
  )
}

#' Atelier theme - artist's studio: warm parchment, ink, ruled lines.
#'
#' Compact density x 0.92 + decorative hue (#A88B5C) routed through the
#' neutrals at high paperC/inkC give the warm parchment paper feel.
#' Italianno display for the calligraphic flourish; EB Garamond body
#' for the inked text.
#' @return A [WebTheme].
#' @export
web_theme_atelier <- function() {
  a <- derive_preset_anchors("#2D2A26", "#8B3A3A",
                             neutral_hue_from = "#A88B5C",
                             paper_C = 0.024, ink_C = 0.024)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    density = "compact",
    density_factor = 0.92,
    shell_texture = "ruled",
    type_base_size = 13.5,
    type_scale_ratio = 1.333,
    font_body = "'EB Garamond', Georgia, 'Times New Roman', serif",
    font_display = "'Italianno', 'EB Garamond', Georgia, cursive, serif",
    web_fonts = list(
      web_font("EB Garamond", "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap"),
      web_font("Italianno", "https://fonts.googleapis.com/css2?family=Italianno&display=swap")
    ),
    curves = list(neutral = "log"),
    name = "atelier"
  )
}

#' Executive theme - slate + soft gold, raised shell, serif display.
#'
#' Material card meets boardroom: Inter body, Cormorant Garamond
#' display (the "executive summary" serif-title-on-sans-body feel).
#' Type scale 1.333 + smooth brand curve for the crisp rhythm.
#' @return A [WebTheme].
#' @export
web_theme_executive <- function() {
  a <- derive_preset_anchors("#1E3A5F", "#C9A961")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "wong",
    shell_mode = "raised",
    type_base_size = 14,
    type_scale_ratio = 1.333,
    type_weights = list(regular = 400, medium = 500, semibold = 600, bold = 700),
    font_body = "'Inter', -apple-system, system-ui, sans-serif",
    font_display = "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"),
      web_font("Cormorant Garamond", "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap")
    ),
    curves = list(neutral = "ease", brand = "smooth"),
    name = "executive"
  )
}
