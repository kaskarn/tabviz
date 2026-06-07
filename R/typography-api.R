# Stage 2 typography modifiers — R wrappers over the TS typography
# cascade in srcjs/src/lib/theme/typography.ts.
#
# These mirror the existing color modifiers (set_brand / set_accent /
# set_mode / set_density / ...): each updates one or more typography
# inputs on the underlying ThemeInputs and re-resolves the WebTheme via
# the V8 bridge.

#' Set the font stacks on a theme and re-resolve.
#'
#' Each argument is a CSS font-family stack string, e.g.
#' `"Inter, system-ui, sans-serif"`. NULL leaves the slot unchanged.
#' The `display` slot defaults to body when unset; the `mono` slot
#' defaults to `ui-monospace, monospace`.
#'
#' @param theme A [WebTheme].
#' @param body,display,mono Optional font-family stacks.
#' @return The re-resolved [WebTheme].
#' @export
set_fonts <- function(theme, body = NULL, display = NULL, mono = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(body, null.ok = TRUE)
  checkmate::assert_string(display, null.ok = TRUE)
  checkmate::assert_string(mono, null.ok = TRUE)
  inputs <- theme@inputs
  if (!is.null(body))    inputs@fonts_body    <- body
  if (!is.null(display)) inputs@fonts_display <- display
  if (!is.null(mono))    inputs@fonts_mono    <- mono
  resolve_from_inputs(inputs, name = theme@name, role_overrides = theme@role_overrides)
}

#' Set the typography modular size scale on a theme.
#'
#' The size scale anchors at `base` px and scales each step by `ratio`.
#' Default base 14 px; default ratio 1.2 (Major Third minus a hair).
#' Push `ratio` toward 1.333 for a more pronounced editorial rhythm.
#'
#' @param theme A [WebTheme].
#' @param base Anchor size in px (e.g. `14`, `16`). NULL leaves unchanged.
#' @param ratio Exponential ratio between scale steps (e.g. `1.2`, `1.333`).
#'   NULL leaves unchanged.
#' @return The re-resolved [WebTheme].
#' @export
set_type_scale <- function(theme, base = NULL, ratio = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_number(base, lower = 8, upper = 32, null.ok = TRUE)
  checkmate::assert_number(ratio, lower = 1.05, upper = 1.6, null.ok = TRUE)
  inputs <- theme@inputs
  if (!is.null(base))  inputs@type_base_size   <- base
  if (!is.null(ratio)) inputs@type_scale_ratio <- ratio
  resolve_from_inputs(inputs, name = theme@name, role_overrides = theme@role_overrides)
}

#' Set the typography weight axis on a theme.
#'
#' Each named weight (regular/medium/semibold/bold) anchors how the
#' type-role table maps logical weights to CSS font-weight values.
#' Defaults are 400/500/600/700. NULL leaves a weight unchanged.
#'
#' @param theme A [WebTheme].
#' @param regular,medium,semibold,bold Optional numeric weights.
#' @return The re-resolved [WebTheme].
#' @export
set_type_weights <- function(theme, regular = NULL, medium = NULL,
                             semibold = NULL, bold = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_number(regular,  lower = 100, upper = 900, null.ok = TRUE)
  checkmate::assert_number(medium,   lower = 100, upper = 900, null.ok = TRUE)
  checkmate::assert_number(semibold, lower = 100, upper = 900, null.ok = TRUE)
  checkmate::assert_number(bold,     lower = 100, upper = 900, null.ok = TRUE)
  inputs <- theme@inputs
  if (!is.null(regular))  inputs@type_weights_regular  <- regular
  if (!is.null(medium))   inputs@type_weights_medium   <- medium
  if (!is.null(semibold)) inputs@type_weights_semibold <- semibold
  if (!is.null(bold))     inputs@type_weights_bold     <- bold
  resolve_from_inputs(inputs, name = theme@name, role_overrides = theme@role_overrides)
}
