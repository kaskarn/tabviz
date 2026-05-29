# Built-in preset constructors — journals + dark mode.
#
# Each preset is a thin wrapper around web_theme(). Identity rides on
# four axes:
#   1. brand / accent / decorative seeds (color)
#   2. neutral_tint + tint_strength (chrome cast: hint vs cream)
#   3. header_style (light / tint / bold)
#   4. font_body / font_display (typography)
#
# Tint strengths are tuned so journal themes (clinical) read as "off-
# white paper with a hint of brand" rather than "branded paper": values
# in 0.03-0.06 are subtle, 0.10-0.15 are editorial, 0.18+ is strong.

#' Cochrane theme — heritage teal on subtly-tinted paper.
#'
#' Cochrane teal as brand; warm coral accent. Inter sans-serif.
#' General-purpose; reads well in systematic-review tables.
#'
#' @return A [WebTheme].
#' @export
web_theme_cochrane <- function() {
  web_theme(
    brand = "#0099CC",
    accent = "#C8553D",
    neutral_tint = "brand",
    neutral_tint_strength = 0.04,
    font_body = "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif",
    name = "cochrane"
  )
}

#' Lancet theme — two-color editorial (navy + gold) with cream paper.
#' @return A [WebTheme].
#' @export
web_theme_lancet <- function() {
  web_theme(
    brand = "#00407A",
    decorative = "#A6792A",
    accent = "#A6792A",
    neutral_tint = "decorative",
    neutral_tint_strength = 0.12,
    header_style = "tint",
    font_body = "Georgia, 'Times New Roman', serif",
    font_display = "Georgia, 'Times New Roman', serif",
    name = "lancet"
  )
}

#' JAMA theme — black-and-white print-ready.
#'
#' Pure black brand; brand_mono categorical for distinct grayscale series.
#' Ultra-compact density. Arial typography. Untinted paper — JAMA's
#' identity is the absence of color.
#'
#' @return A [WebTheme].
#' @export
web_theme_jama <- function() {
  web_theme(
    brand = "#000000",
    accent = "#000000",
    categorical = "brand_mono",
    density = "compact",
    font_body = "Arial, Helvetica, sans-serif",
    name = "jama"
  )
}

#' NEJM theme — crimson with subtle warm paper and tint headers.
#' @return A [WebTheme].
#' @export
web_theme_nejm <- function() {
  web_theme(
    brand = "#BD2F2F",
    accent = "#1B5377",
    neutral_tint = "brand",
    neutral_tint_strength = 0.04,
    header_style = "tint",
    font_body = "Georgia, 'Times New Roman', serif",
    font_display = "Georgia, 'Times New Roman', serif",
    name = "nejm"
  )
}

#' Nature theme — teal-deep with amber accent.
#' @return A [WebTheme].
#' @export
web_theme_nature <- function() {
  web_theme(
    brand = "#005A6C",
    accent = "#E8A427",
    neutral_tint = "brand",
    neutral_tint_strength = 0.04,
    name = "nature"
  )
}

#' BMJ theme — clean blue with vermillion accent.
#' @return A [WebTheme].
#' @export
web_theme_bmj <- function() {
  web_theme(
    brand = "#2A6EBB",
    accent = "#E33B3B",
    neutral_tint = "brand",
    neutral_tint_strength = 0.04,
    name = "bmj"
  )
}

#' Dark theme — Catppuccin-inspired dark mode default.
#' @return A [WebTheme].
#' @export
web_theme_dark <- function() {
  web_theme(
    brand = "#89B4FA",
    accent = "#F38BA8",
    mode = "dark",
    neutral_tint = "brand",
    neutral_tint_strength = 0.06,
    name = "dark"
  )
}


#' Available theme presets, organized by category.
#'
#' @return A nested list: category -> list of resolved [WebTheme] objects.
#' @export
package_themes <- function() {
  list(
    journals = list(
      cochrane  = web_theme_cochrane(),
      lancet    = web_theme_lancet(),
      jama      = web_theme_jama(),
      nejm      = web_theme_nejm(),
      nature    = web_theme_nature(),
      bmj       = web_theme_bmj(),
      dark      = web_theme_dark()
    ),
    design = list(
      bauhaus         = web_theme_bauhaus(),
      swiss           = web_theme_swiss(),
      tufte           = web_theme_tufte(),
      newsprint       = web_theme_newsprint(),
      solarized       = web_theme_solarized(),
      solarized_dark  = web_theme_solarized_dark(),
      tonal           = web_theme_tonal(),
      tonal_dark      = web_theme_tonal_dark()
    ),
    lotr = list(
      dwarven = web_theme_dwarven(),
      elvish  = web_theme_elvish(),
      hobbit  = web_theme_hobbit()
    )
  )
}

#' Flat name-to-theme map across all preset categories.
#'
#' @return A named list of [WebTheme] objects.
#' @export
theme_registry <- function() {
  registry <- package_themes()
  unlist(registry, recursive = FALSE)
}
