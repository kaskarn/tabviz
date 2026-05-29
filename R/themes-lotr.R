# LOTR-flavored theme presets — three editorial two-color themes
# (dwarven / elvish / hobbit) showcasing the decorative second-color
# surface.

#' Dwarven theme — hammered bronze brand, warm gold decorative.
#' @return A [WebTheme].
#' @export
web_theme_dwarven <- function() {
  web_theme(
    brand = "#7A4E22",
    decorative = "#D4A955",
    accent = "#C0B000",
    neutral_tint = "brand",
    neutral_tint_strength = 0.30,
    font_body = "'EB Garamond', Georgia, serif",
    font_display = "'UnifrakturMaguntia', 'EB Garamond', Georgia, serif",
    name = "dwarven"
  )
}

#' Elvish theme — starlit navy brand, mithril silver decorative.
#' @return A [WebTheme].
#' @export
web_theme_elvish <- function() {
  web_theme(
    brand = "#1F3A5F",
    decorative = "#B8C2D6",
    accent = "#F0CB8A",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.18,
    font_body = "'Cormorant Garamond', Georgia, serif",
    font_display = "'Cinzel', 'Cormorant Garamond', Georgia, serif",
    name = "elvish"
  )
}

#' Hobbit theme — warm earthen brand, foliage-green decorative.
#' @return A [WebTheme].
#' @export
web_theme_hobbit <- function() {
  web_theme(
    brand = "#A6633E",
    decorative = "#6B8E3D",
    accent = "#7A4527",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.35,
    font_body = "'IM Fell English', Georgia, serif",
    font_display = "'IM Fell English SC', Georgia, serif",
    name = "hobbit"
  )
}
