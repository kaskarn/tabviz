# Design-movement preset constructors. Stage 4 reimagining
# (2026-06-04): each preset showcases distinctive substrate features
# (shell mode, surface texture, type scale, curves, density factor)
# per the v4 cascade. Web fonts load per-preset so typography reads
# as the movement intends.

#' Bauhaus theme - geometric primary colors with raised + grid texture.
#'
#' Archivo Black display, bold type scale (1.333), smooth curves
#' across all three ramps for the bold modular Bauhaus rhythm.
#' @return A [WebTheme].
#' @export
web_theme_bauhaus <- function() {
  web_theme(
    brand = "#D32023",
    decorative = "#2057A8",
    accent = "#FFCB05",
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
#' Grid texture showcases the underlying grid system.
#' @return A [WebTheme].
#' @export
web_theme_swiss <- function() {
  web_theme(
    brand = "#E30613",
    accent = "#000000",
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
#' @return A [WebTheme].
#' @export
web_theme_tufte <- function() {
  web_theme(
    brand = "#222222",
    accent = "#888888",
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
#' Decorative-tinted neutrals at 0.08 strength give the warm paper
#' feel; grain texture adds the paper grain. Log curve on brand for
#' deep newspaper-ink contrast.
#' @return A [WebTheme].
#' @export
web_theme_newsprint <- function() {
  web_theme(
    brand = "#2C2C2C",
    decorative = "#B17D5F",
    accent = "#5C8A3F",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.08,
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
#' Brand-tinted neutrals at 0.06 give the trademark warm yellow paper.
#' Smooth curves on neutrals for the gentle yellow gradient.
#' @return A [WebTheme].
#' @export
web_theme_solarized <- function() {
  web_theme(
    brand = "#268BD2",
    accent = "#CB4B16",
    neutral_tint = "brand",
    neutral_tint_strength = 0.06,
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
  web_theme(
    brand = "#268BD2",
    accent = "#CB4B16",
    mode = "dark",
    neutral_tint = "brand",
    neutral_tint_strength = 0.06,
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
  web_theme(
    brand = "#6750A4",
    accent = "#7D5260",
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
  web_theme(
    brand = "#D0BCFF",
    accent = "#EFB8C8",
    mode = "dark",
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
#' at 0.08 give the magenta drift. Exp curves on brand+accent for
#' saturated neon mids.
#' @return A [WebTheme].
#' @export
web_theme_synthwave <- function() {
  web_theme(
    brand = "#FF00C8",
    decorative = "#00E5FF",
    accent = "#FAFF00",
    mode = "dark",
    neutral_tint = "brand",
    neutral_tint_strength = 0.08,
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
    name = "synthwave"
  )
}

#' Atelier theme - artist's studio: warm parchment, ink, ruled lines.
#'
#' Compact density x 0.92 + decorative-tinted neutrals at 0.12 give
#' the warm parchment paper feel. Italianno display for the
#' calligraphic flourish; EB Garamond body for the inked text.
#' @return A [WebTheme].
#' @export
web_theme_atelier <- function() {
  web_theme(
    brand = "#2D2A26",
    decorative = "#A88B5C",
    accent = "#8B3A3A",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.12,
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
  web_theme(
    brand = "#1E3A5F",
    accent = "#C9A961",
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
