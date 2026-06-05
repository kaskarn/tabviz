# Mode-canonical preset constructors. Currently just the canonical dark
# mode (blue brand on near-black paper). Categorized under `modes` in
# `package_themes()` post-coherence-pass — previously sat misleadingly
# under `journals`. Solarized_dark and tonal_dark stay paired with
# their light siblings under `design`; they're polarity variants of
# concrete designs, not standalone mode showcases.

#' Dark theme - blue brand, pink accent, float shell.
#'
#' Removes chrome so the paper appears to drift on its own elevation
#' shadow. Log curve deepens darks; ease on brand+accent keeps callouts
#' vivid.
#' @return A [WebTheme].
#' @export
web_theme_dark <- function() {
  a <- derive_preset_anchors("#89B4FA", "#F38BA8")
  web_theme(
    paper = a$paper, ink = a$ink, brand = a$brand, accent = a$accent,
    polarity = "dark",
    categorical = "okabe_ito",
    shell_mode = "float",
    # C66: dark surfaces are where effects read best — subtle brand glow.
    effects = list(glow_intensity = "subtle"),
    curves = list(neutral = "log", brand = "ease", accent = "ease"),
    name = "dark"
  )
}
