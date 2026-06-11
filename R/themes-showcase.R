# Showcase preset constructors. Stage 4 (2026-06-04): each preset is a
# bold demonstration of one substrate axis — synthwave + brutalist lean
# hard into the Phase D effects + geometry stacks; atelier + executive
# carry the editorial/typography axis.
#
# Categorized under `showcase` in R/themes.R::package_themes(). Lives in
# its own file (post-coherence-pass) so file location matches the
# package_themes() taxonomy.

#' Synthwave theme - neon-on-deep-space showcase.
#'
#' Dark polarity + float shell + grid texture (the perspective-rail
#' retro look). Monospace body (terminal vibe). Brand-tinted neutrals
#' via elevated paperC/inkC give the magenta drift. Exp curves on
#' brand+accent for saturated neon mids. Phase D: neon glow on the
#' accent anchor + vivid brand-to-accent gradient shell + raised
#' elevation — the full effects stack.
#' @return A [WebTheme].
#' @export
web_theme_synthwave <- function() {
  a <- derive_preset_anchors("#FF00C8", "#FAFF00",
                             paper_C = 0.016, ink_C = 0.020)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    # B5/D6: neon semantic palette — status is identity for synthwave.
    status_positive = "#00FF9C",
    status_negative = "#FF2D55",
    status_warning  = "#FFD60A",
    status_info     = "#00E5FF",
    polarity = "dark",
    # 1f/C66: neon series — tableau-corporate colors inside a neon frame
    # were the palette-level identity collapse.
    categorical = "neon",
    marks = list(point_shape = "diamond"),
    # C65: float-card radius is part of the neon identity (lab: 9).
    geometry = list(radius = list(sm = 4, md = 9, lg = 14, pill = 999)),
    shell_mode = "float",
    shell_texture = "grid",
    type_base_size = 13,
    type_scale_ratio = 1.2,
    type_weights = list(regular = 400, medium = 500, semibold = 600, bold = 700),
    fonts_body = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fonts_display = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    fonts_mono = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    web_fonts = list(
      web_font("JetBrains Mono", FONT_URLS$jetbrains_mono)
    ),
    curves = list(neutral = "smooth", brand = "exp", accent = "exp"),
    effects = list(
      glow_intensity = "neon",
      glow_anchor = "accent",
      gradient_shell_intensity = "vivid",
      gradient_shell_angle = 110,
      elevation = "medium",
      # 2c-i: neon underline beneath the title (lab synthwave).
      title_style = "underline"
    ),
    # House style (area C): neon arcade — glyph columns oversized,
    # significance as a lit pill. Mirrors the TS preset.
    column_defaults = list(
      stars = list(size = "lg"),
      ring = list(size = "lg"),
      pictogram = list(size = "lg"),
      pvalue = list(significantStyle = "pill")
    ),
    name = "synthwave"
  )
}

#' Brutalist theme - radius-zero, thick rules, no effects.
#'
#' The substrate smoke test for the Phase D GEOMETRY axis. Achromatic
#' neutrals, ink-and-paper contrast, exposed grid texture, no
#' softening. Heavy weights, compact density, no glow/gradient.
#' @return A [WebTheme].
#' @export
web_theme_brutalist <- function() {
  a <- derive_preset_anchors("#000000", "#000000",
                             neutral_hue_from = NA_character_)
  web_theme(
    # C39a: vermilion engagement hue (merged from the former ink2 anchor,
    # which won the accent-ramp seed; the old accent #000 was black-on-
    # black, never visible). Chromatic identity over achromatic neutrals.
    paper = a$paper, ink = a$ink, brand = a$brand, accent = "#D42320",
    # B5/D6: ink-discipline semantics; vermilion owns the alarm channel.
    status_positive = "#2E7D32",
    status_negative = "#D42320",
    status_warning  = "#C77700",
    status_info     = "#37474F",
    categorical = "ink_vermilion",
    # 1f: hard-edged marks — square points, thick CI caps.
    marks = list(point_shape = "square", interval_weight = "thick"),
    density = "compact",
    # C65: brutalist wants DENSE — compact preset tightened further.
    density_factor = 0.88,
    shell_texture = "grid",
    type_base_size = 14,
    type_scale_ratio = 1.25,
    type_weights = list(regular = 500, medium = 700, semibold = 800, bold = 900),
    fonts_body = "'Archivo Black', 'Arial Black', 'Helvetica Neue', sans-serif",
    fonts_display = "'Darker Grotesque', 'Archivo Black', sans-serif",
    web_fonts = list(
      web_font("Archivo Black", FONT_URLS$archivo_black),
      web_font("Darker Grotesque", FONT_URLS$darker_grotesque)
    ),
    curves = list(neutral = "linear"),
    geometry = list(
      radius       = list(sm = 0, md = 0, lg = 0, pill = 0),
      border_width = list(hair = 1, thin = 1.5, regular = 2, thick = 3)
    ),
    # 2c-i: solid-ink header band (structural variant) + rubrication
    # title bar (lab brutalist).
    header_style = "bold",
    effects = list(
      glow_intensity = "none",
      gradient_shell_intensity = "none",
      elevation = "none",
      title_style = "bar"
    ),
    # House style (area C): stark — square badges, display-weight
    # numerals. Mirrors the TS preset.
    column_defaults = list(
      badge = list(shape = "square"),
      numeric = list(fontClass = "display")
    ),
    name = "brutalist"
  )
}
#' Ledger theme - accountant's ruled book (rgc_v4 lab port).
#'
#' Teal-ink brand (H200), oxblood rubrication accent (H28), warm cream
#' paper. Chip + stripe caption (the two deliberately source different
#' anchors: oxblood chip on brand-gradient strip). Hairline interval
#' rules; ruled shell texture.
#' @return A [WebTheme].
#' @export
web_theme_ledger <- function() {
  a <- derive_preset_anchors("#006266",
                             neutral_hue_from = "#DECBB1",
                             # Saturated cream/parchment — Ledger owns COLOR,
                             # so its paper earns chroma (distinctness 2026-06-09).
                             paper_C = 0.028, ink_C = 0.014)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    accent = "#862721",
    categorical = "dark2",
    density_factor = 0.97,
    shell_mode = "raised",
    shell_texture = "ruled",
    marks = list(interval_weight = "hair"),
    geometry = list(radius = list(sm = 1, md = 3, lg = 5, pill = 999)),
    fonts_body = "'Spectral', Georgia, serif",
    fonts_display = "'Spectral', Georgia, serif",
    fonts_mono = "'Spline Sans Mono', monospace",
    web_fonts = list(
      web_font("Spectral", FONT_URLS$spectral),
      web_font("Spline Sans Mono", FONT_URLS$spline_sans_mono)
    ),
    curves = list(neutral = "ease"),
    effects = list(caption_style = "both"),
    name = "ledger"
  )
}

#' Terminal theme - phosphor CRT (rgc_v4 lab port).
#'
#' A single green hue carries the whole surface via `monochrome = TRUE`;
#' amber accent doubles as the rubrication channel. Ruled texture reads as
#' scanlines; subtle glow reads as phosphor bleed.
#' @return A [WebTheme].
#' @export
web_theme_terminal <- function() {
  a <- derive_preset_anchors("#20C45F")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    accent = "#DAA500",
    polarity = "dark",
    monochrome = TRUE,
    categorical = "greens",
    density = "compact",
    shell_texture = "ruled",
    geometry = list(radius = list(sm = 0, md = 0, lg = 0, pill = 0)),
    fonts_body = "'Space Mono', 'Courier New', monospace",
    fonts_display = "'Space Mono', 'Courier New', monospace",
    fonts_mono = "'Space Mono', 'Courier New', monospace",
    web_fonts = list(
      web_font("Space Mono", FONT_URLS$space_mono)
    ),
    type_base_size = 13,
    effects = list(glow_intensity = "subtle", glow_anchor = "brand"),
    curves = list(neutral = "exp"),
    # House style (area C): printout register — mono numerals, square
    # outlined badges. Mirrors the TS preset.
    column_defaults = list(
      numeric = list(fontClass = "mono"),
      interval = list(fontClass = "mono"),
      badge = list(shape = "square", outline = TRUE)
    ),
    name = "terminal"
  )
}

#' Aurora theme - borealis glass (rgc_v4 lab port).
#'
#' Magenta-violet brand (H305), cyan accent (H200), dark float card with
#' glow + gradient shell. The full glass stack (backdrop blobs, sheen,
#' bevel) lands with the glass substrate; these pins carry the chromatic
#' identity.
#' @return A [WebTheme].
#' @export
web_theme_aurora <- function() {
  a <- derive_preset_anchors("#B15DFC")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    accent = "#17D0D8",
    polarity = "dark",
    categorical = "wong",
    # raised (not float): the glass pane needs the recipe-driven band
    # padding to be visible around the paper.
    shell_mode = "raised",
    geometry = list(radius = list(sm = 4, md = 11, lg = 16, pill = 999)),
    fonts_body = "'Outfit', -apple-system, system-ui, sans-serif",
    fonts_display = "'Outfit', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Outfit", FONT_URLS$outfit)
    ),
    effects = list(
      glass = "aurora",
      glow_intensity = "subtle",
      glow_anchor = "accent",
      gradient_shell_intensity = "subtle",
      elevation = "high",
      caption_style = "chip"
    ),
    curves = list(neutral = "smooth"),
    name = "aurora"
  )
}

#' Blueprint theme - architectural drafting sheet (rgc_v4 lab port).
#'
#' LIGHT cyanotype: pale-blue paper with navy ink lines (the architect's
#' table, not the dark negative), amber rubrication accent for callouts, grid
#' texture as the drafting sheet, Archivo drafting-label sans, radius 0.
#' @return A [WebTheme].
#' @export
web_theme_blueprint <- function() {
  a <- derive_preset_anchors("#007D9F",
                             paper_C = 0.045, ink_C = 0.03)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    accent = "#E69C3A",
    categorical = "paired",
    density = "compact",
    shell_texture = "grid",
    geometry = list(radius = list(sm = 0, md = 0, lg = 0, pill = 0)),
    marks = list(point_shape = "triangle"),
    # Architectural DRAFT, not a code terminal: a geometric sans for drafting
    # labels (Archivo), NOT the all-mono of Terminal (distinctness 2026-06-09).
    fonts_body = "'Archivo', 'Helvetica Neue', system-ui, sans-serif",
    fonts_display = "'Archivo', 'Helvetica Neue', system-ui, sans-serif",
    fonts_mono = "'IBM Plex Mono', 'Courier New', monospace",
    web_fonts = list(
      web_font("Archivo", FONT_URLS$archivo),
      web_font("IBM Plex Mono", FONT_URLS$ibm_plex_mono)
    ),
    type_base_size = 13,
    effects = list(title_style = "underline"),
    curves = list(neutral = "smooth"),
    name = "blueprint"
  )
}