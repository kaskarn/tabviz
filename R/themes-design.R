# Design-movement preset constructors.
#
# V4 (2026-06-04): anchors vocabulary. Editorial themes (Newsprint,
# Solarized, Atelier) lean on warm-paper feel via paperC/inkC bumps and,
# in some cases, route a decorative hue through the neutrals via
# `neutral_hue_from = <hex>` — replacing the v3 neutral_tint +
# neutral_tint_strength knobs.
#' Newsprint theme - actual newspaper: grain texture, off-white paper,
#' serif body, Crimson Pro display.
#'
#' Decorative hue (#B17D5F) routed through the neutrals via
#' `neutral_hue_from` + elevated paperC/inkC give the warm paper feel.
#' Log curve on brand for deep newspaper-ink contrast.
#' @return A [WebTheme].
#' @export
web_theme_newsprint <- function() {
  .theme_from_preset("newsprint")
}
