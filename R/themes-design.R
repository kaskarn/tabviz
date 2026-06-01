# Design-movement preset constructors (Bauhaus, Swiss, Tufte, Newsprint,
# Solarized + dark, Tonal + dark). Thin wrappers around web_theme().
# Each loads its signature Google Font so typography reads as the
# movement intends instead of falling back to system fonts.

#' Bauhaus theme — red brand, blue structural decorative, yellow accent,
#' bold header band. Archivo (geometric sans, Bauhaus-feel).
#' @return A [WebTheme].
#' @export
web_theme_bauhaus <- function() {
  web_theme(
    brand = "#D32023",
    decorative = "#2057A8",
    accent = "#FFCB05",
    categorical = "tableau10",
    header_style = "bold",
    first_column_style = "bold",
    font_body = "'Archivo', 'Helvetica Neue', Helvetica, sans-serif",
    font_display = "'Archivo Black', Archivo, 'Helvetica Neue', sans-serif",
    web_fonts = list(
      web_font("Archivo", "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&display=swap"),
      web_font("Archivo Black", "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap")
    ),
    name = "bauhaus"
  )
}

#' Swiss theme — red brand on neutral grid; bold header band.
#' Inter (geometric sans) for body + display.
#' @return A [WebTheme].
#' @export
web_theme_swiss <- function() {
  web_theme(
    brand = "#E30613",
    accent = "#000000",
    categorical = "tableau10",
    header_style = "bold",
    font_body = "'Inter', 'Helvetica Neue', Helvetica, sans-serif",
    font_display = "'Inter', 'Helvetica Neue', Helvetica, sans-serif",
    web_fonts = list(
      web_font("Inter", "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap")
    ),
    name = "swiss"
  )
}

#' Tufte theme — minimal greys; compact density. ET Book-inspired
#' Crimson Pro serif for body.
#' @return A [WebTheme].
#' @export
web_theme_tufte <- function() {
  web_theme(
    brand = "#222222",
    accent = "#888888",
    categorical = "greys",
    density = "compact",
    font_body = "'Crimson Pro', et-book, Palatino, 'Palatino Linotype', Georgia, serif",
    font_display = "'Crimson Pro', et-book, Palatino, 'Palatino Linotype', Georgia, serif",
    web_fonts = list(
      web_font("Crimson Pro", "https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600&display=swap")
    ),
    name = "tufte"
  )
}

#' Newsprint theme — warm decorative tint; serif body; tint header band.
#' Old Standard TT for body (newsprint serif).
#' @return A [WebTheme].
#' @export
web_theme_newsprint <- function() {
  web_theme(
    brand = "#2C2C2C",
    decorative = "#B17D5F",
    accent = "#5C8A3F",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.14,
    header_style = "tint",
    font_body = "'Old Standard TT', Georgia, 'Times New Roman', serif",
    font_display = "'Playfair Display', 'Old Standard TT', Georgia, serif",
    web_fonts = list(
      web_font("Old Standard TT", "https://fonts.googleapis.com/css2?family=Old+Standard+TT:wght@400;700&display=swap"),
      web_font("Playfair Display", "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap")
    ),
    name = "newsprint"
  )
}

#' Solarized theme (light). Source Sans 3 body.
#' @return A [WebTheme].
#' @export
web_theme_solarized <- function() {
  web_theme(
    brand = "#268BD2",
    accent = "#CB4B16",
    neutral_tint = "brand",
    neutral_tint_strength = 0.12,
    categorical = "tableau10",
    font_body = "'Source Sans 3', -apple-system, system-ui, sans-serif",
    font_display = "'Source Sans 3', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Source Sans 3", "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap")
    ),
    name = "solarized"
  )
}

#' Solarized theme (dark).
#' @return A [WebTheme].
#' @export
web_theme_solarized_dark <- function() {
  web_theme(
    brand = "#268BD2",
    accent = "#CB4B16",
    mode = "dark",
    neutral_tint = "brand",
    neutral_tint_strength = 0.10,
    categorical = "tableau10",
    font_body = "'Source Sans 3', -apple-system, system-ui, sans-serif",
    font_display = "'Source Sans 3', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Source Sans 3", "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap")
    ),
    name = "solarized_dark"
  )
}

#' Tonal theme (light) — M3-inspired tonal palette. Roboto Flex.
#' @return A [WebTheme].
#' @export
web_theme_tonal <- function() {
  web_theme(
    brand = "#6750A4",
    accent = "#7D5260",
    neutral_tint = "brand",
    neutral_tint_strength = 0.05,
    categorical = "tableau10",
    font_body = "'Roboto Flex', Roboto, -apple-system, system-ui, sans-serif",
    font_display = "'Roboto Flex', Roboto, -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Roboto Flex", "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,700&display=swap")
    ),
    name = "tonal"
  )
}

#' Tonal theme (dark) — M3-inspired tonal palette.
#' @return A [WebTheme].
#' @export
web_theme_tonal_dark <- function() {
  web_theme(
    brand = "#D0BCFF",
    accent = "#EFB8C8",
    mode = "dark",
    neutral_tint = "brand",
    neutral_tint_strength = 0.07,
    categorical = "tableau10",
    font_body = "'Roboto Flex', Roboto, -apple-system, system-ui, sans-serif",
    font_display = "'Roboto Flex', Roboto, -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Roboto Flex", "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,700&display=swap")
    ),
    name = "tonal_dark"
  )
}
