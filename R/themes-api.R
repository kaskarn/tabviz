# User-facing v2 theme API: custom-theme constructor + modifiers.
#
# Users typically reach v2 via a preset (web_theme_default() etc.).
# `web_theme()` is the constructor for hand-rolled themes built
# from Tier 1 inputs. The set_* modifiers update inputs / variants /
# spacing / arbitrary-path on an existing v2 theme and re-resolve.
#
# Naming carries the `_v2` suffix during the transition. PR 10 renames
# `web_theme` -> `web_theme` and the v1 web_theme() goes away.


# Internal: copy non-NULL named args into a target object's properties.
apply_named_props <- function(target, args) {
  prop_names <- S7::prop_names(target)
  for (nm in names(args)) {
    if (is.null(args[[nm]])) next
    if (!nm %in% prop_names) {
      cli::cli_abort("Unknown property {.field {nm}} for {.cls {class(target)[1]}}")
    }
    S7::prop(target, nm) <- args[[nm]]
  }
  target
}


#' Build a custom v2 theme from Tier 1 inputs and Tier 3 overrides.
#'
#' All Tier 1 inputs are passed by name; pass them as a named list via
#' `inputs = list(brand = "...", neutral = c(...))`. Variants are similarly
#' a named list. Tier 3 overrides target individual cluster fields via
#' [set_theme_field()] after construction.
#'
#' @param name Theme name (string).
#' @param inputs Named list of [ThemeInputs] property overrides
#'   (`brand`, `accent`, `neutral`, `series_anchors`, etc.).
#' @param variants Named list of [ThemeVariants] property overrides
#'   (`density`, `header_style`, `first_column_style`).
#' @param base_theme Base theme to start from before applying overrides.
#'   Defaults to the v2 default preset.
#' @return A fully resolved [WebTheme].
#' @export
web_theme <- function(
    name = "custom",
    inputs = NULL,
    variants = NULL,
    base_theme = web_theme_default()) {
  checkmate::assert_string(name)
  checkmate::assert_list(inputs, names = "named", null.ok = TRUE)
  checkmate::assert_list(variants, names = "named", null.ok = TRUE)
  if (!inherits(base_theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg base_theme} must be a {.cls WebTheme}.")
  }

  result <- base_theme
  result@name <- name
  if (!is.null(inputs))   result@inputs   <- apply_named_props(result@inputs,   inputs)
  if (!is.null(variants)) result@variants <- apply_named_props(result@variants, variants)

  resolve_theme(result)
}


#' Update Tier 1 inputs on a v2 theme.
#'
#' Any input field on [ThemeInputs] can be set: `brand`, `brand_deep`,
#' `accent`, `accent_deep`, `status_*`, `series_anchors`, `font_*`,
#' `neutral`. Re-resolves the theme before returning.
#'
#' @param theme A [WebTheme].
#' @param ... Named arguments matching [ThemeInputs] property names.
#' @return The updated [WebTheme] (re-resolved).
#' @export
set_inputs <- function(theme, ...) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  args <- list(...)
  # If brand changes and brand_deep wasn't also set explicitly, reset
  # brand_deep so resolve re-mirrors. Same for accent and font_display.
  if ("brand"     %in% names(args) && !"brand_deep"     %in% names(args)) args$brand_deep     <- NA_character_
  if ("accent"    %in% names(args) && !"accent_deep"    %in% names(args)) args$accent_deep    <- NA_character_
  if ("font_body" %in% names(args) && !"font_display"   %in% names(args)) args$font_display   <- NA_character_
  theme@inputs <- apply_named_props(theme@inputs, args)
  # Series anchors changed -> rebuild slot bundles so every fill reflects
  # the new anchors. Explicit per-slot overrides survive (resolve only
  # writes into NA fields), but the derived fields refresh.
  if ("series_anchors" %in% names(args)) {
    n <- length(theme@inputs@series_anchors)
    fresh <- vector("list", n)
    for (i in seq_len(n)) fresh[[i]] <- SlotBundle()
    theme@series <- fresh
  }
  resolve_theme(theme)
}


#' Update per-table variants on a v2 theme.
#'
#' @param theme A [WebTheme].
#' @param density One of `"compact"`, `"comfortable"`, `"spacious"`.
#' @param header_style One of `"light"`, `"bold"`.
#' @param first_column_style One of `"default"`, `"bold"`.
#' @return The updated [WebTheme] (re-resolved).
#' @export
set_variants <- function(theme,
                         density = NULL,
                         header_style = NULL,
                         first_column_style = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  args <- list(
    density = density,
    header_style = header_style,
    first_column_style = first_column_style
  )
  theme@variants <- apply_named_props(theme@variants, args)
  # Density change wipes spacing back to NA so resolve refills from the
  # new preset. Users who want a per-token override across density flips
  # call set_spacing() afterward.
  if (!is.null(density)) theme@spacing <- SpacingTokens()
  resolve_theme(theme)
}


#' Set a single theme field by path on a v2 theme.
#'
#' The generic deep setter. `path` is a character vector specifying the
#' property chain from the theme root. The terminal property's value is
#' replaced with `value`, then the theme is re-resolved.
#'
#' Examples:
#' * `set_theme_field(theme, c("row_group", "L1", "bg"), "#EEE")`
#' * `set_theme_field(theme, c("series", 1, "fill"), "#FF0000")` with an
#'   integer at position 2 indexing into the series list
#' * `set_theme_field(theme, c("inputs", "brand"), "#1F3A5F")`
#'
#' @param theme A [WebTheme].
#' @param path Character (or mixed character/integer) vector of property
#'   names from the theme root to the leaf. Integer entries index list
#'   properties (currently only `series`).
#' @param value New value for the leaf.
#' @return The updated [WebTheme] (re-resolved).
#' @export
set_theme_field <- function(theme, path, value) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  if (length(path) == 0L) {
    cli::cli_abort("{.arg path} must have at least one element.")
  }

  # Walk the path, mutating in place via R copy-on-modify semantics.
  # We build up a chain of (parent, accessor) so we can walk back.
  set_at <- function(obj, p, v) {
    if (length(p) == 1L) {
      key <- p[[1]]
      if (is.numeric(key)) {
        # List index (e.g. series[[i]])
        if (is.list(obj)) {
          obj[[as.integer(key)]] <- v
          return(obj)
        }
        cli::cli_abort("Numeric path step but target is not a list.")
      }
      S7::prop(obj, key) <- v
      return(obj)
    }
    key <- p[[1]]
    if (is.numeric(key)) {
      idx <- as.integer(key)
      child <- obj[[idx]]
      obj[[idx]] <- set_at(child, p[-1], v)
      return(obj)
    }
    child <- S7::prop(obj, key)
    S7::prop(obj, key) <- set_at(child, p[-1], v)
    obj
  }

  theme <- set_at(theme, as.list(path), value)
  resolve_theme(theme)
}


# v2 set_spacing — kept distinct from v1 by class dispatch.
# When the v1 path retires (PR 10) we rename this to `set_spacing` and
# remove the v1 setter.
#' Override one or more density-derived spacing tokens on a v2 theme.
#'
#' Setting any token leaves the rest at their density-preset values.
#' Re-resolves the theme before returning.
#'
#' @param theme A [WebTheme].
#' @param ... Named numeric arguments matching [SpacingTokens] property
#'   names (`row_height`, `header_height`, `padding`, etc.).
#' @return The updated [WebTheme] (re-resolved).
#' @export
set_spacing <- function(theme, ...) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  args <- list(...)
  theme@spacing <- apply_named_props(theme@spacing, args)
  resolve_theme(theme)
}
