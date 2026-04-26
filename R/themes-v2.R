# 9 preset constructors for the v2 theme system.
#
# Each returns a fully resolved WebTheme2. v1 presets in classes-theme.R
# remain in place; PR 6 swaps the un-suffixed names to point at v2 and
# PR 10 deletes the v1 set.
#
# Pattern: ThemeInputs() carries the customer-facing palette + fonts +
# density. Tier 3 overrides only where the journal/brand chrome can't
# be derived from inputs alone (Lancet header bar, JAMA all-black header
# rule, etc.). Resolution runs at construction so each return value is a
# fully-populated theme.

#' Default theme (v2)
#'
#' Cyan-on-white, comfortable density, system fonts. v2 of the package
#' default; replaces [web_theme_default] in PR 10.
#'
#' @return A [WebTheme2].
#' @export
web_theme_default_v2 <- function() {
  resolve_theme(WebTheme2(
    name = "default",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#F8FAFC", "#94A3B8", "#333333"),
      brand   = "#0891B2",
      accent  = "#8B5CF6",
      series_anchors = c("#0891B2", "#16A34A", "#F59E0B", "#EF4444", "#8B5CF6"),
      font_body = "system-ui, -apple-system, sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable")
  ))
}

#' Minimal theme (v2)
#'
#' Pure black-and-white, serif typography, compact density, sharp corners.
#' Targeted at journal submissions.
#'
#' @return A [WebTheme2].
#' @export
web_theme_minimal_v2 <- function() {
  resolve_theme(WebTheme2(
    name = "minimal",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#FAFAFA", "#666666", "#000000"),
      brand   = "#000000",
      accent  = "#000000",
      series_anchors = c("#64748B", "#94A3B8", "#CBD5E1", "#475569", "#334155"),
      font_body    = "Georgia, 'Times New Roman', serif",
      font_display = "Georgia, 'Times New Roman', serif"
    ),
    variants = ThemeVariants(density = "compact"),
    # Strong black borders below every row and under headers — minimal style.
    divider = Dividers(subtle = "#000000", strong = "#000000")
  ))
}

#' Dark theme (v2)
#'
#' Catppuccin Mocha-inspired dark palette with pastel marker colors.
#'
#' @return A [WebTheme2].
#' @export
web_theme_dark_v2 <- function() {
  resolve_theme(WebTheme2(
    name = "dark",
    inputs = ThemeInputs(
      neutral = c("#1E1E2E", "#1E1E2E", "#232334", "#6C7086", "#CDD6F4"),
      brand        = "#89B4FA",
      brand_deep   = "#74C7EC",
      accent       = "#F5C2E7",
      series_anchors = c("#89B4FA", "#A6E3A1", "#FAB387", "#F38BA8", "#CBA6F7")
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Border tone between row bands keeps the dark-mode plate readable.
    divider = Dividers(subtle = "#313244", strong = "#45475A")
  ))
}

#' JAMA theme (v2)
#'
#' All-black-and-white, ultra-compact density, Arial typography.
#'
#' @return A [WebTheme2].
#' @export
web_theme_jama_v2 <- function() {
  resolve_theme(WebTheme2(
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
    # JAMA squashes the spacing further than the default "compact" preset.
    spacing = SpacingTokens(
      row_height = 18, header_height = 24, padding = 6, cell_padding_x = 8
    )
  ))
}

#' Lancet theme (v2)
#'
#' Lancet navy primary, gold accent, serif typography.
#'
#' @return A [WebTheme2].
#' @export
web_theme_lancet_v2 <- function() {
  resolve_theme(WebTheme2(
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

#' Modern theme (v2)
#'
#' Vibrant blue + violet, larger marker sizes, Inter font.
#'
#' @return A [WebTheme2].
#' @export
web_theme_modern_v2 <- function() {
  resolve_theme(WebTheme2(
    name = "modern",
    inputs = ThemeInputs(
      neutral = c("#FAFAFA", "#FAFAFA", "#F5F5F5", "#52525B", "#18181B"),
      brand        = "#3B82F6",
      brand_deep   = "#2563EB",
      accent       = "#8B5CF6",
      series_anchors = c("#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"),
      font_body = "Inter, system-ui, -apple-system, sans-serif"
    ),
    variants = ThemeVariants(density = "spacious"),
    plot = PlotScaffold(point_size = 8, line_width = 1.75)
  ))
}

#' Presentation theme (v2)
#'
#' Oversized markers, thick lines, large typography. For slides/posters.
#'
#' @return A [WebTheme2].
#' @export
web_theme_presentation_v2 <- function() {
  resolve_theme(WebTheme2(
    name = "presentation",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#F8FAFC", "#334155", "#0F172A"),
      brand        = "#0369A1",
      brand_deep   = "#0C4A6E",
      accent       = "#EA580C",
      series_anchors = c("#2563EB", "#16A34A", "#EA580C", "#DC2626", "#7C3AED"),
      font_body = "'Source Sans Pro', 'Segoe UI', Roboto, sans-serif"
    ),
    variants = ThemeVariants(density = "spacious"),
    # Overrides for presentation-scale visibility.
    spacing = SpacingTokens(row_height = 36, header_height = 44, padding = 18),
    plot = PlotScaffold(point_size = 12, line_width = 2.5, tick_mark_length = 6)
  ))
}

#' Cochrane theme (v2)
#'
#' Cochrane teal, Arial, very compact density for systematic reviews.
#'
#' @return A [WebTheme2].
#' @export
web_theme_cochrane_v2 <- function() {
  resolve_theme(WebTheme2(
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
    # Cochrane runs even tighter than the default compact preset.
    spacing = SpacingTokens(
      row_height = 20, header_height = 26, padding = 6, cell_padding_x = 6
    ),
    plot = PlotScaffold(point_size = 4, line_width = 1, tick_mark_length = 3)
  ))
}

#' Nature theme (v2)
#'
#' Nature blue, refined red accent, Helvetica Neue, balanced density.
#'
#' @return A [WebTheme2].
#' @export
web_theme_nature_v2 <- function() {
  resolve_theme(WebTheme2(
    name = "nature",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#FAFAFA", "#424242", "#1A1A1A"),
      brand        = "#1976D2",
      brand_deep   = "#0D47A1",
      accent       = "#C62828",
      series_anchors = c("#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F"),
      font_body = "'Helvetica Neue', Helvetica, Arial, sans-serif"
    ),
    variants = ThemeVariants(density = "compact"),
    spacing = SpacingTokens(row_height = 22, header_height = 28, padding = 10)
  ))
}


#' All v2 preset themes
#'
#' Returns a named list of all v2 theme presets. The v2 mirror of
#' [package_themes()].
#'
#' @return Named list of [WebTheme2] objects.
#' @export
package_themes_v2 <- function() {
  list(
    default      = web_theme_default_v2(),
    minimal      = web_theme_minimal_v2(),
    dark         = web_theme_dark_v2(),
    jama         = web_theme_jama_v2(),
    lancet       = web_theme_lancet_v2(),
    modern       = web_theme_modern_v2(),
    presentation = web_theme_presentation_v2(),
    cochrane     = web_theme_cochrane_v2(),
    nature       = web_theme_nature_v2()
  )
}
