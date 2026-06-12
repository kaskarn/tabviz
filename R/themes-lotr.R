# LOTR-editorial preset constructors.
#
# V4 (2026-06-04): anchors vocabulary. The storytelling showpieces lean
# hard into substrate features (shell mode, surface texture, curves) +
# tinted-paper feel via paperC/inkC or `neutral_hue_from`.

#' Dwarven theme - forge, stone, dark gold.
#'
#' DARK polarity (the deep mountain forge); raised shell (carved
#' monolith); dotted texture (chiseled stone); log curves (the rich
#' dark gradient of cave-fire shadow). Cinzel display (carved capitals);
#' EB Garamond body (formal script).
#' @return A [WebTheme].
#' @export
web_theme_dwarven <- function() {
  .theme_from_preset("dwarven")
}
