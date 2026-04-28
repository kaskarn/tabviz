# Preset constructors for the v2 theme system.
#
# Each returns a fully resolved WebTheme. Pattern: ThemeInputs() carries the
# customer-facing palette + fonts + density. Tier 3 overrides only where the
# journal identity chrome can't be derived from inputs alone.
#
# Round-2 polish trimmed the preset roster to four. The remaining four cover
# the design space we actually care about: a clean general-purpose default
# (Cochrane), two journal-publication identities (Lancet, JAMA), and a single
# dark-mode option. All presets here are mono-identity (primary set, secondary
# and tertiary mirror primary via the resolver's mirror chain). The orthogonal
# accent axis is exercised independently. Two/three-color editorial themes
# can ship as separate presets (see themes-lotr.R for examples).

#' Cochrane theme (v2)
#'
#' The package default. Cochrane heritage teal as primary identity, warm
#' coral as the independent accent. Inter sans-serif, comfortable density,
#' clean slate neutrals. Tuned as a general-purpose theme: dense
#' systematic-review tables read well, and exploratory tables feel inviting.
#'
#' @return A [WebTheme].
#' @export
web_theme_cochrane <- function() {
  resolve_theme(WebTheme(
    name = "cochrane",
    inputs = ThemeInputs(
      # Slate-cool neutrals; the alt-row partner picks up a faint teal tint
      # via the tertiary-tinted surface.muted derivation (mirrors primary
      # in this mono-identity preset).
      neutral = c("#FFFFFF", "#FFFFFF", "#F2F4F7", "#5B6470", "#1F2937"),
      # Cochrane heritage teal as primary identity. primary_deep auto-derives
      # to a darker, richer teal (15% OKLCH-darken). Secondary and tertiary
      # mirror primary (mono identity).
      primary = "#0099CC",
      # Warm coral as the independent accent — a deliberate counterpoint to
      # the cool primary. Reserved for layered emphasis (hover/selected,
      # row.accent callouts, status.info fallback). Identity and engagement
      # are orthogonal; keeping them visually distinct exercises the wall.
      accent  = "#C8553D",
      # Qualitative palette: teal, coral, forest, violet, amber — five
      # well-spaced hues for multi-effect plots.
      series_anchors = c("#0099CC", "#C8553D", "#5C8A3F", "#7E5A99", "#D49A3A"),
      font_body = "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable")
  ))
}

#' Lancet theme (v2)
#'
#' Lancet navy on warm cream, refined old-gold accent, Georgia serif. The
#' deep-navy companion is explicitly pinned (rather than auto-derived) to
#' lock the journal identity. Comfortable density for journal-page reading.
#'
#' @return A [WebTheme].
#' @export
web_theme_lancet <- function() {
  resolve_theme(WebTheme(
    name = "lancet",
    inputs = ThemeInputs(
      # Warm cream surface tones; n[3] is the alt-row partner / header bg.
      neutral = c("#FDFCFB", "#FDFCFB", "#F8F7F5", "#3D5A80", "#1E3A5F"),
      primary      = "#00407A",
      primary_deep = "#002D54",
      # Refined old-gold (replaces the slightly muddy "darkgoldenrod"
      # #B8860B). Lands on hover, selection, L1 group bar.
      accent       = "#A6792A",
      # Lancet's canonical multi-effect palette.
      series_anchors = c("#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F"),
      font_body    = "Georgia, 'Times New Roman', serif",
      font_display = "Georgia, 'Times New Roman', serif"
    ),
    variants = ThemeVariants(density = "comfortable")
  ))
}

#' JAMA theme (v2)
#'
#' All-black-and-white, ultra-compact density, Arial typography. Strong
#' black dividers throughout — the visual identity IS the rule structure.
#' Print-ready for medical-journal submissions.
#'
#' @return A [WebTheme].
#' @export
web_theme_jama <- function() {
  resolve_theme(WebTheme(
    name = "jama",
    inputs = ThemeInputs(
      # Pure white canvas; surface.muted picks up barely any tertiary tint
      # because primary = black (the 3% mix is invisible).
      neutral = c("#FFFFFF", "#FFFFFF", "#F9FAFB", "#555555", "#000000"),
      primary      = "#000000",
      # Explicit: oklch_darken of black is still black, but pinning makes
      # the "no fade to derivation" intent obvious.
      primary_deep = "#000000",
      accent       = "#000000",
      # Five-step grayscale series — distinctive without color.
      series_anchors = c("#1A1A1A", "#4A4A4A", "#7A7A7A", "#9A9A9A", "#BABABA"),
      font_body = "Arial, Helvetica, sans-serif"
    ),
    variants = ThemeVariants(density = "compact"),
    # Black dividers, both subtle and strong — JAMA's iconic look.
    divider = Dividers(subtle = "#000000", strong = "#000000"),
    # JAMA squashes spacing further than the compact preset's defaults.
    spacing = SpacingTokens(
      row_height = 18, header_height = 24, padding = 6, cell_padding_x = 8
    )
  ))
}

#' Dark theme (v2)
#'
#' Catppuccin Mocha-inspired dark canvas with a pastel marker palette and
#' system-font typography. The identity cascade adapts for dark mode: an
#' explicit `content.inverse` override keeps bold-mode header text light
#' (otherwise the resolver's default = `n[1]` = the dark canvas, giving
#' invisible dark-on-dark text).
#'
#' @return A [WebTheme].
#' @export
web_theme_dark <- function() {
  resolve_theme(WebTheme(
    name = "dark",
    inputs = ThemeInputs(
      neutral = c("#1E1E2E", "#1E1E2E", "#232334", "#6C7086", "#CDD6F4"),
      primary = "#89B4FA",
      # accent_deep auto-derives via 15% OKLCH-darken; bright pastel pink
      # darkens to a slightly more saturated version. primary_deep similarly
      # auto-darkens — the resulting tone reads as "deeper blue" against
      # the dark canvas.
      accent  = "#F5C2E7",
      # Catppuccin-Mocha-inspired qualitative palette: blue / green /
      # peach / pink / lavender.
      series_anchors = c("#89B4FA", "#A6E3A1", "#FAB387", "#F38BA8", "#CBA6F7"),
      font_body = "system-ui, -apple-system, 'Segoe UI', sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Dark-mode inverse override: bold-mode header text needs to be LIGHT,
    # not dark. The resolver default (= n[1] = the dark canvas) would give
    # dark-on-dark text in the bold header band.
    content = Content(inverse = "#CDD6F4"),
    # Dim dividers tuned to the Catppuccin surface palette.
    divider = Dividers(subtle = "#313244", strong = "#45475A")
  ))
}


#' All v2 preset themes
#'
#' Returns a 2-level named list of v2 theme presets, organized into
#' categories. The first level is the category (renders as a tab in the
#' in-widget theme switcher when `enable_themes = "default"`); the
#' second level is the theme name within the category.
#'
#' Categories:
#' * `journals` — clinical / publication identities (Cochrane, Lancet,
#'   JAMA, Dark).
#' * `lotr` — easter-egg editorial themes (Dwarven, Elvish, Hobbit).
#'   These are pre-release demos and may be removed before CRAN
#'   submission; the source will be republished on the package blog.
#'
#' @return A 2-level named list of [WebTheme] objects.
#' @export
package_themes <- function() {
  list(
    journals = list(
      cochrane = web_theme_cochrane(),
      lancet   = web_theme_lancet(),
      jama     = web_theme_jama(),
      dark     = web_theme_dark()
    ),
    lotr = list(
      dwarven = web_theme_dwarven(),
      elvish  = web_theme_elvish(),
      hobbit  = web_theme_hobbit()
    )
  )
}
