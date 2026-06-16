# Showcase / rgc_v4-lab-port preset constructors — each leans hard into one
# substrate axis: synthwave/aurora (Phase D effects), brutalist (geometry),
# ledger (color), terminal (mono aliasing). The 27->9 cull retired the
# atelier/executive editorial pair. Categorized in
# R/themes.R::package_themes() under design / expressive (there is no
# `showcase` category — it was renamed in the coherence pass).

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
  .theme_from_preset("synthwave")
}

#' Brutalist theme - radius-zero, thick rules, no effects.
#'
#' The substrate smoke test for the Phase D GEOMETRY axis. Achromatic
#' neutrals, ink-and-paper contrast, exposed grid texture, no
#' softening. Heavy weights, compact density, no glow/gradient.
#' @return A [WebTheme].
#' @export
web_theme_brutalist <- function() {
  .theme_from_preset("brutalist")
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
  .theme_from_preset("ledger")
}

#' Terminal theme - phosphor CRT (rgc_v4 lab port).
#'
#' A single green hue carries the whole surface via `monochrome = TRUE`;
#' amber accent doubles as the rubrication channel. Ruled texture reads as
#' scanlines; subtle glow reads as phosphor bleed.
#' @return A [WebTheme].
#' @export
web_theme_terminal <- function() {
  .theme_from_preset("terminal")
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
  .theme_from_preset("aurora")
}

#' Blueprint theme - architectural drafting sheet (rgc_v4 lab port).
#'
#' LIGHT cyanotype: pale-blue paper with navy ink lines (the architect's
#' table, not the dark negative), amber rubrication accent for callouts, grid
#' texture as the drafting sheet, Archivo drafting-label sans, radius 0.
#' @return A [WebTheme].
#' @export
web_theme_blueprint <- function() {
  .theme_from_preset("blueprint")
}
