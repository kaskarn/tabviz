# Mirror of `srcjs/src/lib/glyph-registry.ts` — the names of glyphs
# bundled with the package. The actual SVG paths live on the frontend
# side; R only needs the name list for `assert_choice` validation in
# col_pictogram() (and any future column type that adopts the registry).
#
# If you add or remove glyphs, update BOTH this file and the TS one.

#' Names of glyphs bundled with the package.
#'
#' Returns the character vector of glyph names recognized by
#' `col_pictogram(glyph = ...)`. The frontend resolves these names to
#' inline SVG paths shipped in `srcjs/src/lib/glyph-registry.ts`. Names
#' not in this list are treated as literal unicode/emoji strings.
#'
#' @return A character vector of glyph names.
#' @export
#' @examples
#' glyph_registry_names()
glyph_registry_names <- function() {
  c(
    "person", "skull", "dot", "coin", "heart", "leaf", "mountain",
    "flame", "flag", "square", "triangle", "star", "sun", "droplet",
    "hexagon"
  )
}
