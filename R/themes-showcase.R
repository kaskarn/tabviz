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
      elevation = "raised",
      # 2c-i: neon underline beneath the title (lab synthwave).
      title_style = "underline"
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
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    # C39a: vermilion rubrication ink — chromatic identity over the
    # achromatic neutrals (lab parity). Seeds the accent ramp.
    ink2 = "#D42320",
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
    effects = list(
      glow_intensity = "none",
      gradient_shell_intensity = "none",
      elevation = "none",
      # 2c-i: solid-ink header band + rubrication title bar (lab brutalist).
      header_style = "fill",
      title_style = "bar"
    ),
    name = "brutalist"
  )
}

#' Atelier theme - artist's studio: warm parchment, ink, ruled lines.
#'
#' Compact density x 0.92 + decorative hue (#A88B5C) routed through the
#' neutrals at high paperC/inkC give the warm parchment paper feel.
#' Italianno display for the calligraphic flourish; EB Garamond body
#' for the inked text. Subtle warm glow on the rust accent + soft
#' paper-shadow elevation give the page-on-desk feel without breaking
#' the editorial restraint.
#' @return A [WebTheme].
#' @export
web_theme_atelier <- function() {
  a <- derive_preset_anchors("#392A1E", "#8B3A3A",
                             neutral_hue_from = "#A88B5C",
                             paper_C = 0.024, ink_C = 0.024)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "okabe_ito",
    density = "compact",
    density_factor = 0.92,
    shell_texture = "ruled",
    type_base_size = 13.5,
    type_scale_ratio = 1.333,
    fonts_body = "'EB Garamond', Georgia, serif",
    fonts_display = "'Italianno', 'EB Garamond', cursive, serif",
    web_fonts = list(
      web_font("EB Garamond", FONT_URLS$eb_garamond),
      web_font("Italianno", FONT_URLS$italianno)
    ),
    curves = list(neutral = "log"),
    effects = list(
      glow_intensity = "subtle",
      glow_anchor = "accent",
      elevation = "soft"
    ),
    name = "atelier"
  )
}

#' Executive theme - slate + soft gold, raised shell, serif display.
#'
#' Material card meets boardroom: Inter body, Cormorant Garamond
#' display (the "executive summary" serif-title-on-sans-body feel).
#' Type scale 1.333 + smooth brand curve for the crisp rhythm. Float
#' elevation lifts the card off the page; subtle gradient on the shell
#' gives the premium material-card sheen without becoming decorative.
#' @return A [WebTheme].
#' @export
web_theme_executive <- function() {
  a <- derive_preset_anchors("#1E3A5F", "#C9A961")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    categorical = "wong",
    # C65: premium card — md-leaning radius + airy density.
    geometry = list(radius = list(sm = 3, md = 8, lg = 12, pill = 999)),
    density_factor = 1.08,
    shell_mode = "raised",
    type_base_size = 14,
    type_scale_ratio = 1.333,
    type_weights = list(regular = 400, medium = 500, semibold = 600, bold = 700),
    fonts_body = "'Mulish', -apple-system, system-ui, sans-serif",
    fonts_display = "'Fraunces', Georgia, serif",
    web_fonts = list(
      web_font("Mulish", FONT_URLS$mulish),
      web_font("Fraunces", FONT_URLS$fraunces)
    ),
    curves = list(neutral = "ease", brand = "smooth"),
    effects = list(
      gradient_shell_intensity = "subtle",
      gradient_shell_angle = 145,
      elevation = "float"
    ),
    name = "executive"
  )
}

#' Ledger theme - accountant's ruled book (rgc_v4 lab port).
#'
#' Teal-ink brand (H200), oxblood rubrication ink2 (H28), warm cream
#' paper. Chip + stripe caption (the two deliberately source different
#' anchors: oxblood chip on brand-gradient strip). Hairline interval
#' rules; ruled shell texture.
#' @return A [WebTheme].
#' @export
web_theme_ledger <- function() {
  a <- derive_preset_anchors("#006266",
                             neutral_hue_from = "#DECBB1",
                             paper_C = 0.012, ink_C = 0.014)
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    ink2 = "#862721",
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
#' amber ink2 is the rubrication channel. Ruled texture reads as
#' scanlines; subtle glow reads as phosphor bleed.
#' @return A [WebTheme].
#' @export
web_theme_terminal <- function() {
  a <- derive_preset_anchors("#20C45F")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    ink2 = "#DAA500",
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
    name = "terminal"
  )
}

#' Aurora theme - borealis glass (rgc_v4 lab port).
#'
#' Magenta-violet brand (H305), cyan ink2 (H200), dark float card with
#' glow + gradient shell. The full glass stack (backdrop blobs, sheen,
#' bevel) lands with the glass substrate; these pins carry the chromatic
#' identity.
#' @return A [WebTheme].
#' @export
web_theme_aurora <- function() {
  a <- derive_preset_anchors("#B15DFC")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand,
    ink2 = "#17D0D8",
    polarity = "dark",
    categorical = "wong",
    shell_mode = "float",
    geometry = list(radius = list(sm = 4, md = 11, lg = 16, pill = 999)),
    fonts_body = "'Outfit', -apple-system, system-ui, sans-serif",
    fonts_display = "'Outfit', -apple-system, system-ui, sans-serif",
    web_fonts = list(
      web_font("Outfit", FONT_URLS$outfit)
    ),
    effects = list(
      glow_intensity = "subtle",
      glow_anchor = "accent",
      gradient_shell_intensity = "subtle",
      elevation = "float",
      caption_style = "chip"
    ),
    curves = list(neutral = "smooth"),
    name = "aurora"
  )
}
