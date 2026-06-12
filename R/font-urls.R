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

# The per-preset URL registry moved to TS (2026-06-11):
# srcjs/src/lib/theme/preset-web-fonts.ts is the single source — R's
# generated preset constructors fetch it via the presetWebFonts V8 seam.
# `gf()` above remains for authors building custom `web_font()` entries.
