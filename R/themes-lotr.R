# LOTR-flavored theme presets — easter-egg additions for the pre-CRAN
# release. Three themes (dwarven, elvish, hobbit) showcase the
# editorial-register direction of the column system: bespoke pictogram
# glyphs, themed donuts, threshold-driven badges.
#
# These themes declare their own `web_fonts` so the runtime will inject
# the necessary <link> tags from Google Fonts on widget mount. PNG/SVG
# export through rsvg falls back to the system stack since fontconfig
# doesn't fetch web fonts at render time — install the family locally
# for high-fidelity offline export.
#
# Drop note: these are likely to be removed before CRAN submission and
# republished as standalone source on the package blog. Refrain from
# building load-bearing user examples on top of them.


#' Dwarven theme — Erebor under the Lonely Mountain
#'
#' Deep cavern surface with a two-tier identity: hammered-bronze primary
#' for headlines, warm-gold secondary for structural groupings (column
#' bands, row bars, glyph fills, plus chrome texture — banding, hairlines,
#' gridlines all gold-tinted). Forge-ember accent reserved for layered
#' emphasis (hover, selected, semantic accent rows). Runic-inspired
#' typography. Pairs well with [col_pictogram()] using `glyph = "pickaxe"`,
#' `"anvil"`, `"gem"`, `"ale_mug"`, or `"rune"`.
#'
#' Loads `UnifrakturMaguntia` (display) and `EB Garamond` (body) from
#' Google Fonts via the WebTheme `web_fonts` slot.
#'
#' @return A [WebTheme].
#' @export
web_theme_dwarven <- function() {
  resolve_theme(WebTheme(
    name = "dwarven",
    web_fonts = list(
      web_font(
        "UnifrakturMaguntia",
        "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap"
      ),
      web_font(
        "EB Garamond",
        "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&display=swap"
      )
    ),
    inputs = ThemeInputs(
      # Cavern palette: deep brown-black canvas, slightly lighter alt-row,
      # warm gray for muted text, cream for primary text.
      neutral = c("#1F1610", "#1F1610", "#2A1F17", "#988372", "#E8D9B5"),
      # Two-tier identity (post-2026-04-29 cascade rework):
      #   primary  = hammered bronze — title, leaf-header, container, series[0]
      #   secondary = warm gold      — column-group bands, row-group bars,
      #                                glyph-cell defaults (gemvein highlight),
      #                                AND chrome texture (banding, hairlines,
      #                                gridlines all gold-tinted under the
      #                                unified structural axis)
      primary        = "#7A4E22",   # hammered bronze
      primary_deep   = "#4A2D14",   # forge shadow
      secondary      = "#D4A955",   # warm gold (gemvein)
      # secondary_deep darker than the auto-derived #A07A35 so the cream
      # inverse text (#E8D9B5) used on the column-group bold band clears
      # the validator's WCAG AA Large floor (3.0). #8A6628 reads as a
      # deeper "burnished gold" — still warm, still gemvein-character,
      # ~3.74:1 contrast against the cream text.
      secondary_deep = "#8A6628",
      # Engagement axis: forge ember — reserved for hover, selected,
      # row.accent treatment. Distinct enough from secondary's gold that
      # accent-flagged rows pop without competing with the structural gold.
      accent         = "#E0673A",   # forge ember
      accent_deep    = "#B04A20",
      status_positive = "#8FA34A",  # gemvein green
      status_negative = "#C84638",  # forge-fire red
      status_warning  = "#E5B842",  # candle-gold (slightly warmer than secondary)
      # Series anchors: gold, silver, copper, bronze, mithril-blue.
      series_anchors = c("#D4A955", "#A8A8A0", "#B86C42", "#7A4E22", "#5C7AA0"),
      font_body    = "'EB Garamond', Georgia, 'Times New Roman', serif",
      font_display = "'UnifrakturMaguntia', 'EB Garamond', Georgia, serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Title/subtitle override: the title fg defaults to primary_deep
    # (forge shadow), which is invisible on the deep cavern canvas.
    # Pin it to a warm cream that reads against the surface.
    text = TextRoles(
      title    = TextRole(fg = "#E8D9B5"),
      subtitle = TextRole(fg = "#C9A87C")
    ),
    # Inverse text override so bold-mode header band stays readable on
    # the dark canvas.
    content = Content(inverse = "#E8D9B5"),
    divider = Dividers(subtle = "#3A2A1A", strong = "#5A4232")
  ))
}


#' Elvish theme — Lothlórien at twilight
#'
#' Deep night-sky surface with a two-tier identity: starlit-navy primary
#' for headlines, mithril-silver secondary for structural groupings (column
#' bands, row bars, glyph fills — Lothlórien's pillars and banners — plus
#' chrome texture, banding and hairlines silver-tinted to read like
#' moonlight on stone). Twilight-gold accent reserved for layered emphasis.
#' Elegant Roman serif display with a flowing Renaissance body. Pairs with
#' [col_pictogram()] glyphs `"crescent"`, `"harp"`, `"tree"`, `"bow"`,
#' `"swan"`.
#'
#' Loads `Cinzel` (display) and `Cormorant Garamond` (body) from Google
#' Fonts via the WebTheme `web_fonts` slot.
#'
#' @return A [WebTheme].
#' @export
web_theme_elvish <- function() {
  resolve_theme(WebTheme(
    name = "elvish",
    web_fonts = list(
      web_font(
        "Cinzel",
        "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap"
      ),
      web_font(
        "Cormorant Garamond",
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;700&display=swap"
      )
    ),
    inputs = ThemeInputs(
      # Night-sky palette: indigo canvas, slightly lighter alt-row,
      # cool gray-blue muted text, near-white primary text.
      neutral = c("#0E1730", "#0E1730", "#172242", "#8090A8", "#EDEFF5"),
      # Two-tier identity (post-2026-04-29 cascade rework):
      #   primary  = starlit navy   — title, leaf-header, container
      #   secondary = mithril silver — column-group bands, row-group bars,
      #                                glyph-cell defaults (Lothlórien's
      #                                pillars and banners), AND chrome
      #                                texture (silver-tinted banding reads
      #                                as moonlight on stone). The mallorn
      #                                moss tertiary was retired — chrome
      #                                folds into secondary's silver.
      primary        = "#1F3A5F",   # deep starlit navy
      primary_deep   = "#0F1F38",
      secondary      = "#B8C2D6",   # mithril silver
      secondary_deep = "#7A88A0",
      # Engagement: twilight gold — kept for hover/selected/accent rows.
      accent         = "#D4B26E",   # mithril-touched gold (twilight gleam)
      accent_deep    = "#B89148",
      status_positive = "#8AC18A",  # mallorn green
      status_negative = "#D67373",  # rosy alert (Boromir red)
      status_warning  = "#E5C375",  # candle gold
      # Series anchors: gold, silver, mallorn-green, twilight-violet, dawn-rose.
      series_anchors = c("#D4B26E", "#B8C2D6", "#8AC18A", "#A78BBF", "#E5A89A"),
      font_body    = "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
      font_display = "'Cinzel', 'Cormorant Garamond', Georgia, serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    # Title/subtitle override — primary is deep navy and invisible on the
    # night-sky canvas. Pin to a brighter mithril gold + silver-blue for
    # high contrast.
    text = TextRoles(
      title    = TextRole(fg = "#F0CB8A"),
      subtitle = TextRole(fg = "#C8D4E8")
    ),
    content = Content(inverse = "#EDEFF5"),
    divider = Dividers(subtle = "#1F2D52", strong = "#3D4F75")
  ))
}


#' Hobbit theme — Hobbiton on a clear morning
#'
#' Cream parchment surface with a two-tier identity: warm-clay primary
#' for headlines (Bag End brick), garden-green secondary for structural
#' groupings (column bands, row bars, glyph fills — Sam's vegetables
#' flanking the hearth — plus chrome texture, banding and hairlines
#' green-tinted like garden hedgerow against parchment). Autumn-rust
#' accent reserved for layered emphasis. Letterpress-era typography.
#' Pairs with [col_pictogram()] glyphs `"pipe"`, `"mushroom"`,
#' `"footprint"`, `"jar"`, `"pie"`, `"leaf"`.
#'
#' Loads two flavors of `IM Fell English` (display + body) from Google
#' Fonts via the WebTheme `web_fonts` slot.
#'
#' @return A [WebTheme].
#' @export
web_theme_hobbit <- function() {
  resolve_theme(WebTheme(
    name = "hobbit",
    web_fonts = list(
      web_font(
        "IM Fell English",
        "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap"
      ),
      web_font(
        "IM Fell English SC",
        "https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&display=swap"
      )
    ),
    inputs = ThemeInputs(
      # Parchment palette: cream canvas, slightly creamier alt-row,
      # warm-gray muted text, ink-brown primary text.
      neutral = c("#FBF3DF", "#FBF3DF", "#F2E5C5", "#8A7456", "#3A2C20"),
      # Two-tier identity (post-2026-04-29 cascade rework):
      #   primary  = warm clay       — title, leaf-header (Bag End brick)
      #   secondary = garden green    — column-group bands, row-group bars,
      #                                 glyph-cell defaults (Sam's vegetables
      #                                 flanking the hearth), AND chrome
      #                                 texture (garden-hedgerow banding
      #                                 against parchment). The wheat
      #                                 tertiary was retired — chrome folds
      #                                 into secondary's green.
      primary        = "#A6633E",   # warm clay
      primary_deep   = "#7A4527",
      secondary      = "#6B8E3D",   # garden green
      secondary_deep = "#4A6628",
      # Engagement: autumn rust — Sam's gardening apron, kept for hover/
      # selected/accent rows.
      accent         = "#D97757",   # autumn rust
      accent_deep    = "#B85A3D",
      status_positive = "#6B8E3D",  # garden-leaf green (matches secondary)
      status_negative = "#B33B2E",  # alarm-bell red (Sackville-Baggins!)
      status_warning  = "#D4A24A",  # harvest gold
      # Series anchors: rust, leaf-green, mustard, plum, terra-cotta.
      series_anchors = c("#D97757", "#6B8E3D", "#D4A24A", "#8B5E83", "#B86A48"),
      font_body    = "'IM Fell English', Georgia, 'Times New Roman', serif",
      font_display = "'IM Fell English SC', 'IM Fell English', Georgia, serif"
    ),
    variants = ThemeVariants(density = "comfortable"),
    divider = Dividers(subtle = "#E2D2A8", strong = "#A6633E")
  ))
}
