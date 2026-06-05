# Google Fonts URL registry for tabviz presets.
#
# `web_font()` declarations were duplicated 5–7x for the most common
# families (Inter, EB Garamond, Cinzel, Cormorant Garamond, JetBrains
# Mono, Roboto). Even when the URL is byte-identical, having it in 7
# files means 7 places to update when changing the requested weight
# set. This registry pins each family's canonical URL once.
#
# Presets that want a non-standard weight set (e.g. Brutalist needs
# 500;700;800;900 for the heavy stack) can still inline a custom URL,
# or call `gf(family, weights)` to build one with the standard
# `&display=swap` tail.

#' Google Fonts URL builder for tabviz presets.
#'
#' Takes a family name + optional axis spec and returns the
#' `https://fonts.googleapis.com/css2?...&display=swap` URL the
#' presets pass to [web_font()]. Replaces spaces with `+` in the
#' family name; appends `&display=swap` unconditionally.
#'
#' @param family Family name as authored by Google (e.g. `"Inter"`,
#'   `"EB Garamond"`).
#' @param spec Optional axis spec (e.g. `"wght@400;500;600;700"` or
#'   `"ital,wght@0,400;0,500;0,600;1,400"`). NULL = no axis spec; the
#'   browser receives all default axes.
#' @return The full Google Fonts CSS2 URL.
#' @keywords internal
gf <- function(family, spec = NULL) {
  family_q <- gsub(" ", "+", family, fixed = TRUE)
  if (is.null(spec)) {
    paste0("https://fonts.googleapis.com/css2?family=", family_q, "&display=swap")
  } else {
    paste0("https://fonts.googleapis.com/css2?family=", family_q, ":", spec,
           "&display=swap")
  }
}

# Canonical URLs for the families used by 2+ presets. Each entry is the
# "standard" weight set we want across presets that share the font; a
# preset can still inline a custom URL when its weight set differs
# (Brutalist for Inter, Dwarven for EB Garamond with italics).
FONT_URLS <- list(
  inter          = gf("Inter",             "wght@400;500;600;700"),
  inter_heavy    = gf("Inter",             "wght@500;700;800;900"),
  eb_garamond    = gf("EB Garamond",       "ital,wght@0,400;0,500;0,600;1,400"),
  eb_garamond_full = gf("EB Garamond",     "ital,wght@0,400;0,500;0,600;0,700;1,400"),
  cinzel         = gf("Cinzel",            "wght@400;500;600;700"),
  cormorant      = gf("Cormorant Garamond", "wght@400;500;600;700"),
  cormorant_ital = gf("Cormorant Garamond", "ital,wght@0,400;0,500;0,600;1,400"),
  jetbrains_mono = gf("JetBrains Mono",    "wght@400;500;600;700"),
  jetbrains_mono_thin = gf("JetBrains Mono", "wght@400;500;600"),
  roboto         = gf("Roboto",            "wght@400;500;600;700"),
  roboto_flex    = gf("Roboto Flex",
                      "opsz,wght@8..144,400;8..144,500;8..144,700"),
  crimson_pro    = gf("Crimson Pro",       "wght@400;500;600;700"),
  archivo        = gf("Archivo",           "wght@400;500;700;800"),
  archivo_black  = gf("Archivo Black"),
  italianno      = gf("Italianno"),
  im_fell_english    = gf("IM Fell English",    "ital@0;1"),
  im_fell_english_sc = gf("IM Fell English SC"),
  # wire-audit Pass 1d de-slop pack (C64): one intentional family per
  # preset that previously defaulted to Inter / Arial / Georgia.
  source_sans_3    = gf("Source Sans 3",    "wght@400;500;600;700"),
  source_serif_4   = gf("Source Serif 4",   "opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700"),
  spline_sans      = gf("Spline Sans",      "wght@400;500;600;700"),
  spline_sans_mono = gf("Spline Sans Mono", "wght@400;500;600;700"),
  lora             = gf("Lora",             "ital,wght@0,400;0,500;0,600;1,400"),
  ibm_plex_sans    = gf("IBM Plex Sans",    "wght@400;500;600;700"),
  ibm_plex_serif   = gf("IBM Plex Serif",   "wght@400;500;600;700"),
  hanken_grotesk   = gf("Hanken Grotesk",   "wght@400;500;600;700"),
  frank_ruhl_libre = gf("Frank Ruhl Libre", "wght@400;500;700"),
  public_sans      = gf("Public Sans",      "wght@400;500;600;700"),
  mulish           = gf("Mulish",           "wght@400;500;600;700"),
  fraunces         = gf("Fraunces",         "opsz,wght@9..144,400;9..144,600;9..144,700"),
  darker_grotesque = gf("Darker Grotesque", "wght@700;800;900"),
  # wire-audit 2b presets (ledger / terminal / aurora)
  spectral         = gf("Spectral",         "ital,wght@0,400;0,500;0,600;1,400"),
  space_mono       = gf("Space Mono",       "ital,wght@0,400;0,700;1,400"),
  outfit           = gf("Outfit",           "wght@400;500;600;700")
)
