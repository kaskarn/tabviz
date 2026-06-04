# Showcase preset constructors. Stage 4 (2026-06-04): each preset is a
# bold demonstration of one substrate axis — synthwave + brutalist lean
# hard into the Phase D effects + geometry stacks; atelier + executive
# carry the editorial/typography axis.
#
# Categorized under `showcase` in R/themes.R::package_themes(). Lives in
# its own file (post-coherence-pass) so file location matches the
# package_themes() taxonomy.

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
    fonts_body = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fonts_display = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fonts_mono = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    web_fonts = list(
      web_font("JetBrains Mono", FONT_URLS$jetbrains_mono)
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
    fonts_body = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    fonts_display = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    web_fonts = list(
      web_font("Inter", FONT_URLS$inter_heavy)
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
#' for the inked text. Subtle warm glow on the rust accent + soft
#' paper-shadow elevation give the page-on-desk feel without breaking
#' the editorial restraint.
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
    fonts_body = "'EB Garamond', Georgia, serif",
    fonts_display = "'Italianno', 'EB Garamond', cursive, serif",
    web_fonts = list(
      web_font("EB Garamond", FONT_URLS$eb_garamond),
      web_font("Italianno", FONT_URLS$italianno)
    ),
    curves = list(neutral = "log"),
    effects = list(
      glow_intensity = "subtle",
      glow_anchor = "accent",
      elevation = "soft"
    ),
    name = "atelier"
  )
}

#' Executive theme - slate + soft gold, raised shell, serif display.
#'
#' Material card meets boardroom: Inter body, Cormorant Garamond
#' display (the "executive summary" serif-title-on-sans-body feel).
#' Type scale 1.333 + smooth brand curve for the crisp rhythm. Float
#' elevation lifts the card off the page; subtle gradient on the shell
#' gives the premium material-card sheen without becoming decorative.
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
    fonts_body = "'Inter', -apple-system, system-ui, sans-serif",
    fonts_display = "'Cormorant Garamond', Georgia, serif",
    web_fonts = list(
      web_font("Inter", FONT_URLS$inter),
      web_font("Cormorant Garamond", FONT_URLS$cormorant)
    ),
    curves = list(neutral = "ease", brand = "smooth"),
    effects = list(
      gradient_shell_intensity = "subtle",
      gradient_shell_angle = 145,
      elevation = "float"
    ),
    name = "executive"
  )
}
