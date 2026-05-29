# LOTR-flavored theme presets — three editorial two-color themes
# (dwarven / elvish / hobbit) showcasing the decorative second-color
# surface. Each loads its signature Google Fonts so the typography
# actually arrives instead of falling back to Georgia.

#' Dwarven theme — bronze brand, warm gold decorative, tint header band.
#' EB Garamond body; UnifrakturMaguntia display.
#' @return A [WebTheme].
#' @export
web_theme_dwarven <- function() {
  web_theme(
    brand = "#7A4E22",
    decorative = "#D4A955",
    accent = "#C0B000",
    neutral_tint = "brand",
    neutral_tint_strength = 0.18,
    header_style = "tint",
    font_body = "'EB Garamond', Georgia, serif",
    font_display = "'UnifrakturMaguntia', 'EB Garamond', Georgia, serif",
    web_fonts = list(
      web_font("EB Garamond", "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;700&display=swap"),
      web_font("UnifrakturMaguntia", "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap")
    ),
    name = "dwarven"
  )
}

#' Elvish theme — starlit navy brand, mithril silver decorative.
#' Cormorant Garamond body; Cinzel display.
#' @return A [WebTheme].
#' @export
web_theme_elvish <- function() {
  web_theme(
    brand = "#1F3A5F",
    decorative = "#B8C2D6",
    accent = "#F0CB8A",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.08,
    font_body = "'Cormorant Garamond', Georgia, serif",
    font_display = "'Cinzel', 'Cormorant Garamond', Georgia, serif",
    web_fonts = list(
      web_font("Cormorant Garamond", "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap"),
      web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap")
    ),
    name = "elvish"
  )
}

#' Hobbit theme — warm earthen brand, foliage-green decorative,
#' tint header band. IM Fell English body + display.
#' @return A [WebTheme].
#' @export
web_theme_hobbit <- function() {
  web_theme(
    brand = "#A6633E",
    decorative = "#6B8E3D",
    accent = "#7A4527",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.20,
    header_style = "tint",
    font_body = "'IM Fell English', Georgia, serif",
    font_display = "'IM Fell English SC', 'IM Fell English', Georgia, serif",
    web_fonts = list(
      web_font("IM Fell English", "https://fonts.googleapis.com/css2?family=IM+Fell+English&display=swap"),
      web_font("IM Fell English SC", "https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&display=swap")
    ),
    name = "hobbit"
  )
}
