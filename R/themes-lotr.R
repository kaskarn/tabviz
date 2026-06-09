# LOTR-editorial preset constructors.
#
# V4 (2026-06-04): anchors vocabulary. The storytelling showpieces lean
# hard into substrate features (shell mode, surface texture, curves) +
# tinted-paper feel via paperC/inkC or `neutral_hue_from`.

#' Dwarven theme - forge, stone, dark gold.
#'
#' DARK polarity (the deep mountain forge); raised shell (carved
#' monolith); dotted texture (chiseled stone); log curves (the rich
#' dark gradient of cave-fire shadow). Cinzel display (carved capitals);
#' EB Garamond body (formal script).
#' @return A [WebTheme].
#' @export
web_theme_dwarven <- function() {
  a <- derive_preset_anchors("#7A4E22", "#C0B000",
                             paper_C = 0.012, ink_C = 0.014)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    polarity = "dark",
    categorical = "okabe_ito",
    # C65: storybook breathing room.
    density_factor = 1.05,
    shell_mode = "raised",
    shell_texture = "dotted",
    # C66: torchlit-hall depth — low figure depth.
    effects = list(elevation = "low"),
    type_base_size = 14,
    type_scale_ratio = 1.25,
    type_weights = list(regular = 400, medium = 500, semibold = 700, bold = 800),
    fonts_body = "'EB Garamond', Georgia, serif",
    fonts_display = "'Cinzel', 'EB Garamond', Georgia, serif",
    fonts_mono = "'JetBrains Mono', monospace",
    web_fonts = list(
      web_font("EB Garamond", FONT_URLS$eb_garamond_full),
      web_font("Cinzel", FONT_URLS$cinzel),
      web_font("JetBrains Mono", FONT_URLS$jetbrains_mono_thin)
    ),
    curves = list(neutral = "log", brand = "log"),
    name = "dwarven"
  )
}