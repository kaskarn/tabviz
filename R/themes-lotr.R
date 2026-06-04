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
    shell_mode = "raised",
    shell_texture = "dotted",
    type_base_size = 14,
    type_scale_ratio = 1.25,
    type_weights = list(regular = 400, medium = 500, semibold = 700, bold = 800),
    font_body = "'EB Garamond', Georgia, 'Times New Roman', serif",
    font_display = "'Cinzel', 'EB Garamond', Georgia, serif",
    font_mono = "'JetBrains Mono', 'Fira Code', monospace",
    web_fonts = list(
      web_font("EB Garamond", "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"),
      web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&display=swap"),
      web_font("JetBrains Mono", "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap")
    ),
    curves = list(neutral = "log", brand = "log"),
    name = "dwarven"
  )
}

#' Elvish theme - ethereal, flowing, illuminated manuscript.
#'
#' Flush shell (no architecture); ruled texture (manuscript page lines);
#' exp curve on neutral (lighter highs — the radiant page); decorative
#' hue (#B8C2D6, mithril-grey) routed through neutrals. Cormorant
#' Garamond body + Cinzel display. Type scale 1.333 for the poetic rhythm.
#' @return A [WebTheme].
#' @export
web_theme_elvish <- function() {
  a <- derive_preset_anchors("#1F3A5F", "#F0CB8A",
                             neutral_hue_from = "#B8C2D6",
                             paper_C = 0.010, ink_C = 0.012)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    shell_texture = "ruled",
    type_base_size = 14,
    type_scale_ratio = 1.333,
    font_body = "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    font_display = "'Cinzel', 'Cormorant Garamond', Georgia, serif",
    web_fonts = list(
      web_font("Cormorant Garamond", "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap"),
      web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&display=swap")
    ),
    curves = list(neutral = "exp", brand = "ease"),
    name = "elvish"
  )
}

#' Hobbit theme - warm hearth, paper, comfort.
#'
#' Flush shell; grain texture (paper-and-wool); decorative hue (#6B8E3D)
#' routed through neutrals at high paperC/inkC makes the paper noticeably
#' cream. IM Fell English (Caslon-feel) body. Type scale 1.333 for
#' storytelling rhythm.
#' @return A [WebTheme].
#' @export
web_theme_hobbit <- function() {
  a <- derive_preset_anchors("#A6633E", "#7A4527",
                             neutral_hue_from = "#6B8E3D",
                             paper_C = 0.020, ink_C = 0.022)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    shell_texture = "grain",
    type_base_size = 14,
    type_scale_ratio = 1.333,
    font_body = "'IM Fell English', Georgia, 'Times New Roman', serif",
    font_display = "'IM Fell English SC', Georgia, serif",
    web_fonts = list(
      web_font("IM Fell English", "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap"),
      web_font("IM Fell English SC", "https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&display=swap")
    ),
    curves = list(neutral = "smooth", brand = "ease"),
    name = "hobbit"
  )
}
