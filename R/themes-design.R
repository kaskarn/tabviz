# Design-movement preset constructors (Bauhaus, Swiss, Tufte, Newsprint,
# Solarized + dark, Tonal + dark). Thin wrappers around web_theme().

#' Bauhaus theme — red brand, blue structural decorative, yellow accent.
#' @return A [WebTheme].
#' @export
web_theme_bauhaus <- function() {
  web_theme(
    brand = "#D32023",
    decorative = "#2057A8",
    accent = "#FFCB05",
    categorical = "tableau10",
    name = "bauhaus"
  )
}

#' Swiss theme — red brand on neutral grid; black accent.
#' @return A [WebTheme].
#' @export
web_theme_swiss <- function() {
  web_theme(
    brand = "#E30613",
    accent = "#000000",
    categorical = "tableau10",
    name = "swiss"
  )
}

#' Tufte theme — minimal greys; compact density.
#' @return A [WebTheme].
#' @export
web_theme_tufte <- function() {
  web_theme(
    brand = "#222222",
    accent = "#888888",
    categorical = "greys",
    density = "compact",
    name = "tufte"
  )
}

#' Newsprint theme — warm decorative tint; serif body.
#' @return A [WebTheme].
#' @export
web_theme_newsprint <- function() {
  web_theme(
    brand = "#2C2C2C",
    decorative = "#B17D5F",
    accent = "#5C8A3F",
    neutral_tint = "decorative",
    font_body = "Georgia, 'Times New Roman', serif",
    neutral_tint_strength = 0.28,
    name = "newsprint"
  )
}

#' Solarized theme (light).
#' @return A [WebTheme].
#' @export
web_theme_solarized <- function() {
  web_theme(
    brand = "#268BD2",
    accent = "#CB4B16",
    neutral_tint = "brand",
    categorical = "tableau10",
    neutral_tint_strength = 0.30,
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
    categorical = "tableau10",
    neutral_tint_strength = 0.20,
    name = "solarized_dark"
  )
}

#' Tonal theme (light) — M3-inspired tonal palette.
#' @return A [WebTheme].
#' @export
web_theme_tonal <- function() {
  web_theme(
    brand = "#6750A4",
    accent = "#7D5260",
    categorical = "tableau10",
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
    categorical = "tableau10",
    name = "tonal_dark"
  )
}
