# Design-movement-themed preset constructors.
#
# Each theme here is a *movement* (Bauhaus, Swiss/International Style,
# Tufte sparseness, newsprint broadsheet, Solarized color theory, Material
# tonal palettes) — not a trademark. The palettes interpret the movement
# without copying any specific publication / company / app.
#
# Cascade considerations: a few of these themes pin secondary explicitly
# (Bauhaus red+blue, Tufte black+cream) so chrome texture picks up the
# secondary tier. The two-tier identity is the right tool for that —
# see vignettes/theming.Rmd and the 2026-04-29 cascade rework notes.

#' Bauhaus theme (design)
#'
#' Bauhaus interpretation: primary red as identity, primary blue as the
#' secondary structural axis (column-group bands, row-group bars, chrome
#' texture), primary yellow as accent for layered emphasis (hover,
#' selected, semantic accent rows). Jost as the standard Futura-substitute
#' on Google Fonts (Futura itself being copyright-restricted).
#'
#' Loads `Jost` from Google Fonts via the WebTheme `web_fonts` slot.
#'
#' @return A [WebTheme].
#' @export
web_theme_bauhaus <- function() {
  resolve_theme(WebTheme(
    name = "bauhaus",
    web_fonts = list(
      web_font(
        "Jost",
        "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;700&display=swap"
      )
    ),
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#F4F4F4", "#4A4A4A", "#111111"),
      # Two-tier identity — red primary, blue secondary. Chrome (banding,
      # dividers, gridlines, column-group bold band) picks up blue via
      # secondary_deep. The bauhaus signature: red headlines, blue structure.
      primary        = "#D32023",
      secondary      = "#2057A8",
      # Engagement: primary yellow — sits in hover/selected/accent rows.
      # Yellow against dark content text reads bright; the chrome cascade
      # mixes it 8% into surface.base for the hover bg, so contrast stays
      # comfortable against dark text.
      accent         = "#FFCB05",
      # Series anchors mix the three primaries with neutrals for distinct,
      # readable multi-effect series.
      series_anchors = c("#D32023", "#2057A8", "#FFCB05", "#111111", "#7A7A7A"),
      font_body    = "'Jost', 'Futura', 'Helvetica Neue', sans-serif",
      font_display = "'Jost', 'Futura', 'Helvetica Neue', sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Generous geometric whitespace — Bauhaus typography rests on white space.
    spacing = SpacingTokens(padding = 10, cell_padding_x = 12)
  ))
}

#' Swiss / International Style theme (design)
#'
#' Mono-with-accent: near-black primary, mid-gray secondary, Swiss red as
#' the single chromatic note. Comfortable density with subtle dividers and
#' no alt-row banding — grid rigor through restraint. Helvetica system
#' stack; no `web_fonts` needed.
#'
#' Distinct from JAMA: JAMA is mono + ultra-compact + black-rule identity;
#' Swiss is mono-with-accent + comfortable + dividerless restraint.
#'
#' @return A [WebTheme].
#' @export
web_theme_swiss <- function() {
  resolve_theme(WebTheme(
    name = "swiss",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#FAFAFA", "#666666", "#111111"),
      primary        = "#111111",
      secondary      = "#7A7A7A",
      accent         = "#E2001A",
      series_anchors = c("#111111", "#666666", "#A0A0A0", "#E2001A", "#7A7A7A"),
      font_body = "'Helvetica Neue', Helvetica, Arial, sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Grid rigor: no alt-row banding (broadsheet/poster aesthetic).
    row = RowCluster(banding = "none")
  ))
}

#' Tufte theme (design)
#'
#' Sparse data-ink-only chrome: near-black primary, warm cream secondary,
#' Tufte tan accent. Crimson Pro serif as default body+display (Google
#' Fonts OFL; the canonical ET Book is available on Edward Tufte's GitHub
#' but the licensing for redistribution is ambiguous — substitute ET Book
#' via `font_body` if you have the family locally).
#'
#' "Least chrome" point in the entire roster — subtle dividers barely
#' visible, strong dividers absent, no alt-row banding.
#'
#' Loads `Crimson Pro` from Google Fonts via the WebTheme `web_fonts` slot.
#'
#' @return A [WebTheme].
#' @export
web_theme_tufte <- function() {
  resolve_theme(WebTheme(
    name = "tufte",
    web_fonts = list(
      web_font(
        "Crimson Pro",
        "https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&display=swap"
      )
    ),
    inputs = ThemeInputs(
      # Slightly cooler cream than the surface to give chrome texture
      # somewhere to land. The chrome cascade mixes secondary_deep 4%
      # into surface.muted; with cream-on-cream we want enough separation
      # that the mix produces a visible (but subtle) muted surface.
      neutral = c("#FBF9F2", "#FBF9F2", "#F2EDDF", "#807060", "#1F1F1F"),
      primary        = "#1F1F1F",
      secondary      = "#A89A82",
      accent         = "#C09B7C",
      series_anchors = c("#1F1F1F", "#A89A82", "#5A6B7A", "#7A5D4A", "#C09B7C"),
      font_body    = "'Crimson Pro', Georgia, 'Times New Roman', serif",
      font_display = "'Crimson Pro', Georgia, 'Times New Roman', serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Sparse chrome: collapse strong dividers into subtle (barely visible).
    # The renderer reads divider.strong for axis lines / ticks /
    # reference lines — keeping it faint is the Tufte signal.
    divider = Dividers(subtle = "#E3DBC8", strong = "#C9BFA8"),
    # No alt-row banding (data-ink-only).
    row = RowCluster(banding = "none")
  ))
}

#' Newsprint theme (design)
#'
#' Broadsheet newspaper aesthetic: high-contrast black ink on off-white
#' newsprint stock, with a single newspaper-red headline accent. Roboto
#' Serif Condensed body for newspaper-column density; regular Roboto Serif
#' for display headlines.
#'
#' Fills the "newspaper" register the other publication themes don't:
#' JAMA is clinical-mono, Lancet is journal-navy, Swiss is gridded-restraint
#' — none of them feel like the front page of a broadsheet.
#'
#' Loads `Roboto Serif` (regular + condensed) from Google Fonts via the
#' WebTheme `web_fonts` slot.
#'
#' @return A [WebTheme].
#' @export
web_theme_newsprint <- function() {
  resolve_theme(WebTheme(
    name = "newsprint",
    web_fonts = list(
      web_font(
        "Roboto Serif",
        paste0(
          "https://fonts.googleapis.com/css2?",
          "family=Roboto+Serif:wght@400;500;700",
          "&family=Roboto+Serif:opsz,wdth,wght@8..144,75,400;8..144,75,700",
          "&display=swap"
        )
      )
    ),
    inputs = ThemeInputs(
      neutral = c("#FBFAF7", "#FBFAF7", "#EFEDE6", "#5A5550", "#1A1A1A"),
      primary        = "#1A1A1A",
      # Secondary = pure black — high-contrast structural rules pick this up
      # via the chrome cascade (subtle dividers, gridlines stay mostly
      # neutral; strong dividers and bold-mode bands read as solid black).
      secondary      = "#000000",
      accent         = "#B81A1A",
      series_anchors = c("#1A1A1A", "#8B5A2B", "#3E5C76", "#4A6B3F", "#7A6B5D"),
      font_body    = "'Roboto Serif', Georgia, 'Times New Roman', serif",
      font_display = "'Roboto Serif', Georgia, 'Times New Roman', serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Broadsheet doesn't band rows — newspaper columns rely on rules + leading.
    row = RowCluster(banding = "none")
  ))
}

#' Solarized light theme (design)
#'
#' Ethan Schoonover's Solarized palette in light variant. base3 cream
#' surfaces, base02 slate text, yellow primary, magenta accent. Pairs with
#' [web_theme_solarized_dark()] via the `light_dark_pair` field.
#'
#' @return A [WebTheme].
#' @export
web_theme_solarized <- function() {
  resolve_theme(WebTheme(
    name = "solarized",
    light_dark_pair = "solarized_dark",
    inputs = ThemeInputs(
      # base3, base2, base1 — Solarized's "light background tones".
      neutral = c("#FDF6E3", "#FDF6E3", "#EEE8D5", "#657B83", "#586E75"),
      primary        = "#B58900",  # yellow
      secondary      = "#CB4B16",  # orange
      accent         = "#D33682",  # magenta
      series_anchors = c("#B58900", "#CB4B16", "#268BD2", "#859900", "#6C71C4"),
      font_body = "system-ui, -apple-system, 'Segoe UI', sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable")
  ))
}

#' Solarized dark theme (design)
#'
#' Solarized in dark variant. base03 deep teal surfaces, base0 slate text,
#' yellow primary, magenta accent — same accents as light variant, swapped
#' canvas. Pairs with [web_theme_solarized()] via the `light_dark_pair` field.
#'
#' @return A [WebTheme].
#' @export
web_theme_solarized_dark <- function() {
  resolve_theme(WebTheme(
    name = "solarized_dark",
    light_dark_pair = "solarized",
    inputs = ThemeInputs(
      # base03, base02 — Solarized's "dark background tones"; base0 / base1
      # for content; base01 (gray) for muted.
      neutral = c("#002B36", "#002B36", "#073642", "#586E75", "#93A1A1"),
      primary        = "#B58900",
      # Pin primary_deep — auto-derive of #B58900 on a deep-teal canvas
      # falls into a low-contrast band against light text. Solarized's
      # base02 (#073642) as the deep companion preserves the canonical
      # dark-mode bold-band band color.
      primary_deep = "#073642",
      secondary      = "#CB4B16",
      accent         = "#D33682",
      series_anchors = c("#B58900", "#CB4B16", "#268BD2", "#859900", "#6C71C4"),
      font_body = "system-ui, -apple-system, 'Segoe UI', sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Light content.inverse so bold-mode header band text reads against
    # the deep-teal primary_deep.
    content = Content(inverse = "#FDF6E3"),
    # Title fg defaults to primary_deep — that's base02 here, which is
    # almost the canvas color, making titles invisible. Pin to base1
    # (light slate) the same way Dwarven/Elvish pin title fg for their
    # dark canvases.
    text = TextRoles(
      title    = TextRole(fg = "#93A1A1"),
      subtitle = TextRole(fg = "#839496")
    ),
    divider = Dividers(subtle = "#073642", strong = "#586E75")
  ))
}

#' Tonal theme (design)
#'
#' Tonal-palette-from-seed theme inspired by Material You-style dynamic
#' color: a single seed (primary) generates all surfaces via the existing
#' OKLCH chrome cascade. Demonstrates the cascade's tonal-palette
#' generation behavior — no custom logic needed; the resolver already
#' does it.
#'
#' Pairs with [web_theme_tonal_dark()] via the `light_dark_pair` field.
#'
#' @return A [WebTheme].
#' @export
web_theme_tonal <- function() {
  resolve_theme(WebTheme(
    name = "tonal",
    light_dark_pair = "tonal_dark",
    inputs = ThemeInputs(
      neutral = c("#FFFFFF", "#FFFFFF", "#F5F2F8", "#5F5868", "#1C1B1F"),
      primary        = "#6750A4",  # tonal seed — Material You-style purple
      accent         = "#7D5260",  # rose accent, sibling chromatic
      series_anchors = c("#6750A4", "#7D5260", "#625B71", "#79747E", "#B69DF8"),
      font_body = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable")
  ))
}

#' Tonal dark theme (design)
#'
#' Dark counterpart to [web_theme_tonal()]. Same seed (primary +
#' accent); dark canvas tinted toward primary at low chroma. Pairs with
#' [web_theme_tonal()] via the `light_dark_pair` field.
#'
#' @return A [WebTheme].
#' @export
web_theme_tonal_dark <- function() {
  resolve_theme(WebTheme(
    name = "tonal_dark",
    light_dark_pair = "tonal",
    inputs = ThemeInputs(
      # Material You-style dark surfaces: tinted toward primary at low
      # chroma. n[5] = light text against deep purple-tinted canvas.
      neutral = c("#1C1B1F", "#1C1B1F", "#2B2930", "#938F99", "#E6E1E5"),
      primary        = "#D0BCFF",  # primary at higher tone (40 → 80) for dark
      primary_deep = "#4F378B",
      accent         = "#EFB8C8",
      series_anchors = c("#D0BCFF", "#EFB8C8", "#CCC2DC", "#B69DF8", "#79747E"),
      font_body = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    content = Content(inverse = "#E6E1E5"),
    divider = Dividers(subtle = "#36343B", strong = "#49454F")
  ))
}
