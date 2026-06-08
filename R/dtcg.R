# DTCG interop + brand bootstrap — theme-rework Wave 4 (the contract wave).
#
# Thin R wrappers over the TS adapter (lib/theme/dtcg-adapter.ts +
# suggest-theme.ts) via the V8 bridge. The TS side is the single source of
# the DTCG projection + the brand-derivation math; R adds idiomatic file
# I/O + S7 wrapping.

#' Suggest a theme from a single brand color.
#'
#' The brand-bootstrap flagship: derive a complete, contrast-safe theme from
#' one hex color. Paper / ink / accent are derived from the brand hue and the
#' cascade's own min-contrast guarantees keep the result legible — no manual
#' tuning. Ideal for "make me a theme from our brand color" (incl. LLM
#' callers).
#'
#' @param brand Brand color as a hex string (e.g. `"#0066cc"`).
#' @param polarity `"light"` (default) or `"dark"`.
#' @param accent Accent strategy: `"complementary"` (default), `"analogous"`,
#'   or `"mono"`.
#' @param name Theme name to stamp (default `"suggested"`).
#' @return A resolved [WebTheme].
#' @examples
#' \dontrun{
#' suggest_theme("#0066cc")
#' suggest_theme("#7a1f3d", polarity = "dark", accent = "analogous")
#' }
#' @seealso [theme_to_dtcg()], [web_theme()]
#' @export
suggest_theme <- function(brand, polarity = "light",
                          accent = "complementary", name = "suggested") {
  checkmate::assert_string(brand)
  checkmate::assert_choice(polarity, c("light", "dark"))
  checkmate::assert_choice(accent, c("complementary", "analogous", "mono"))
  checkmate::assert_string(name, min.chars = 1)
  inputs_wire <- ts_call("suggestTheme", brand,
                         options = list(polarity = polarity, accent = accent, name = name))
  inputs <- theme_inputs_from_wire(inputs_wire)
  resolve_from_inputs(inputs, name = name)
}

#' Export a theme as a DTCG (Design Tokens Community Group) document.
#'
#' Projects the theme into the interchange format Figma / Tokens Studio /
#' Style Dictionary speak: reference primitives (anchors + 11-step ramps),
#' semantic roles as aliases, and the component-token layer as resolved
#' values. The authoritative tabviz inputs ride `$extensions` so
#' [theme_from_dtcg()] round-trips losslessly.
#'
#' @param theme A [WebTheme].
#' @param file Optional path to write the DTCG JSON to. When `NULL`
#'   (default) the document is returned as a nested list.
#' @return Invisibly the path (when `file` is given) or the DTCG document
#'   as a list.
#' @seealso [theme_from_dtcg()], [theme_to_wire()]
#' @export
theme_to_dtcg <- function(theme, file = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  bag <- list(
    inputs = theme_inputs_to_json(theme@inputs),
    name = theme@name
  )
  if (length(theme@role_overrides) > 0L) bag$roleOverrides <- theme@role_overrides
  if (length(theme@pins) > 0L) bag$pins <- theme@pins
  doc <- ts_call("dtcgFromTheme", bag)
  if (is.null(file)) return(doc)
  checkmate::assert_string(file, min.chars = 1)
  jsonlite::write_json(doc, file, auto_unbox = TRUE, pretty = TRUE,
                       null = "null", digits = NA)
  cli::cli_alert_success("DTCG tokens written to {.path {file}}")
  invisible(file)
}

#' Import a theme from a DTCG document.
#'
#' Reverses [theme_to_dtcg()]. Accepts a path to a `.json` file, a DTCG
#' document as a list, or a JSON string. Only DTCG files exported BY tabviz
#' round-trip (they carry the authoritative inputs in `$extensions`); a
#' foreign token file would need a manual mapping.
#'
#' @param x A path, a parsed DTCG list, or a JSON string.
#' @return A [WebTheme].
#' @seealso [theme_to_dtcg()]
#' @export
theme_from_dtcg <- function(x) {
  doc <- if (is.list(x)) {
    x
  } else if (is.character(x) && length(x) == 1L) {
    if (file.exists(x)) {
      jsonlite::fromJSON(x, simplifyVector = FALSE, simplifyDataFrame = FALSE)
    } else if (grepl("^\\s*\\{", x)) {
      jsonlite::fromJSON(x, simplifyVector = FALSE, simplifyDataFrame = FALSE)
    } else {
      cli::cli_abort("{.arg x} is not an existing file path or a JSON string.")
    }
  } else {
    cli::cli_abort("{.arg x} must be a path, a DTCG list, or a JSON string.")
  }
  wire <- ts_call("fromDtcg", doc)
  theme_from_wire(wire)
}
