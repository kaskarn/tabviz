# Built-in preset constructors — journals + dark mode.
#
# Each preset is a thin wrapper around web_theme() with the inputs that
# define the theme's identity. All cascade semantics live in the TS
# resolver (srcjs/src/lib/theme-resolve.ts); these constructors just
# pin the brand, accent, decorative (when set), mode, fonts, and density.

#' Cochrane theme — package default.
#'
#' Cochrane heritage teal as brand; warm coral accent. Inter sans-serif.
#' General-purpose; reads well in systematic-review tables.
#'
#' @return A [WebTheme].
#' @export
web_theme_cochrane <- function() {
  web_theme(
    brand = "#0099CC",
    accent = "#C8553D",
    font_body = "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif",
    name = "cochrane"
  )
}

#' Lancet theme — two-color editorial (navy + gold).
#'
#' Lancet navy as brand identity; refined old-gold as decorative second
#' color (carries chrome texture / row-group L1 band). Georgia serif.
#'
#' @return A [WebTheme].
#' @export
web_theme_lancet <- function() {
  web_theme(
    brand = "#00407A",
    decorative = "#A6792A",
    accent = "#A6792A",
    font_body = "Georgia, 'Times New Roman', serif",
    font_display = "Georgia, 'Times New Roman', serif",
    name = "lancet"
  )
}

#' JAMA theme — black-and-white print-ready.
#'
#' Pure black brand; brand_mono categorical for distinct grayscale series.
#' Ultra-compact density. Arial typography.
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

#' NEJM theme — crimson brand on cream.
#' @return A [WebTheme].
#' @export
web_theme_nejm <- function() {
  web_theme(
    brand = "#BD2F2F",
    accent = "#1B5377",
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
