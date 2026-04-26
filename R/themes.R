# Preset constructors for the v2 theme system.
#
# Each returns a fully resolved WebTheme. Pattern: ThemeInputs() carries the
# customer-facing palette + fonts + density. Tier 3 overrides only where the
# journal/brand chrome can't be derived from inputs alone.
#
# Round-2 polish trimmed the preset roster from nine to four. The remaining
# four cover the design space we actually care about: a clean general-purpose
# default (Cochrane), two journal-publication identities (Lancet, JAMA), and
# a single dark-mode option (Dark). Removed presets had migration paths laid
# out in NEWS.md.

#' Cochrane theme (v2)
#'
#' The package default. Cochrane teal on warm white, Arial, compact density,
#' tuned for systematic-review tables that need to fit dense data legibly.
#'
#' @return A [WebTheme].
#' @export
web_theme_cochrane <- function() {
  resolve_theme(WebTheme(
    name = "cochrane",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#F5F5F5", "#555555", "#2C2C2C"),
      brand        = "#0099CC",
      brand_deep   = "#006699",
      accent       = "#006699",
      series_anchors = c("#0C4DA2", "#DD5129", "#1A8A4F", "#6D4E92", "#E89A47"),
      font_body = "Arial, Helvetica, sans-serif"
    ),
    variants = ThemeVariants(density = "compact"),
    spacing = SpacingTokens(
      row_height = 20, header_height = 26, padding = 6, cell_padding_x = 6
    ),
    plot = PlotScaffold(point_size = 4, line_width = 1, tick_mark_length = 3)
  ))
}

#' Lancet theme (v2)
#'
#' Lancet navy primary, gold accent, serif typography on a warm cream surface.
#'
#' @return A [WebTheme].
#' @export
web_theme_lancet <- function() {
  resolve_theme(WebTheme(
    name = "lancet",
    inputs = ThemeInputs(
      neutral = c("#FDFCFB", "#FDFCFB", "#F8F7F5", "#3D5A80", "#1E3A5F"),
      brand        = "#00407A",
      brand_deep   = "#002D54",
      accent       = "#B8860B",
      series_anchors = c("#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F"),
      font_body    = "Georgia, 'Times New Roman', serif",
      font_display = "Georgia, 'Times New Roman', serif"
    ),
    variants = ThemeVariants(density = "comfortable")
  ))
}

#' JAMA theme (v2)
#'
#' All-black-and-white, ultra-compact density, Arial typography. Print-ready
#' for medical-journal submissions.
#'
#' @return A [WebTheme].
#' @export
web_theme_jama <- function() {
  resolve_theme(WebTheme(
    name = "jama",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#F9FAFB", "#555555", "#000000"),
      brand   = "#000000",
      accent  = "#000000",
      series_anchors = c("#1A1A1A", "#4A4A4A", "#7A7A7A", "#9A9A9A", "#BABABA"),
      font_body = "Arial, Helvetica, sans-serif"
    ),
    variants = ThemeVariants(density = "compact"),
    divider = Dividers(subtle = "#000000", strong = "#000000"),
    spacing = SpacingTokens(
      row_height = 18, header_height = 24, padding = 6, cell_padding_x = 8
    )
  ))
}

#' Dark theme (v2)
#'
#' Catppuccin Mocha-inspired dark palette with pastel marker colors.
#'
#' @return A [WebTheme].
#' @export
web_theme_dark <- function() {
  resolve_theme(WebTheme(
    name = "dark",
    inputs = ThemeInputs(
      neutral = c("#1E1E2E", "#1E1E2E", "#232334", "#6C7086", "#CDD6F4"),
      brand        = "#89B4FA",
      brand_deep   = "#74C7EC",
      accent       = "#F5C2E7",
      series_anchors = c("#89B4FA", "#A6E3A1", "#FAB387", "#F38BA8", "#CBA6F7")
    ),
    variants = ThemeVariants(density = "comfortable"),
    divider = Dividers(subtle = "#313244", strong = "#45475A")
  ))
}


#' All v2 preset themes
#'
#' Returns a named list of all v2 theme presets. The default category surface
#' for the in-widget switcher when `enable_themes = "default"`.
#'
#' @return Named list of [WebTheme] objects.
#' @export
package_themes <- function() {
  list(
    cochrane = web_theme_cochrane(),
    lancet   = web_theme_lancet(),
    jama     = web_theme_jama(),
    dark     = web_theme_dark()
  )
}
