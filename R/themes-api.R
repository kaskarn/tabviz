# User-facing theme API: web_theme() constructor + set_*() modifiers.
#
# Locked design 2026-05-28. R is the thin authoring surface; the TS
# adapter (srcjs/src/lib/theme-adapter.ts::buildTheme) is canonical for
# cascade semantics. It takes authoring inputs and emits
# the resolved theme shape the renderer consumes.

# Internal: serialize a ThemeInputs S7 object to the JSON shape that the
# TS adapter expects. NA fields become NULL (omitted from JSON).
theme_inputs_to_json <- function(inputs) {
  stopifnot(inherits(inputs, "tabviz::ThemeInputs"))
  na_to_null <- function(v) if (length(v) == 1L && is.na(v)) NULL else v

  status <- list(
    positive = na_to_null(inputs@status_positive),
    negative = na_to_null(inputs@status_negative),
    warning  = na_to_null(inputs@status_warning),
    info     = na_to_null(inputs@status_info)
  )
  status <- status[!vapply(status, is.null, logical(1))]

  fonts <- list(
    body    = na_to_null(inputs@font_body),
    display = na_to_null(inputs@font_display),
    mono    = na_to_null(inputs@font_mono)
  )
  fonts <- fonts[!vapply(fonts, is.null, logical(1))]

  neutral_tint_out <- if (inputs@neutral_tint %in%
                          c("untinted", "brand", "accent", "decorative")) {
    inputs@neutral_tint
  } else {
    list(hex = inputs@neutral_tint)
  }

  out <- list(
    brand                 = inputs@brand,
    accent                = na_to_null(inputs@accent),
    decorative            = na_to_null(inputs@decorative),
    mode                  = inputs@mode,
    neutral_tint          = neutral_tint_out,
    neutral_tint_strength = inputs@neutral_tint_strength,
    categorical           = inputs@categorical,
    sequential            = inputs@sequential,
    diverging             = inputs@diverging,
    status                = if (length(status) > 0L) status else NULL,
    fonts                 = if (length(fonts)  > 0L) fonts  else NULL,
    density               = inputs@density
  )
  out[!vapply(out, is.null, logical(1))]
}

# Internal: build a resolved WebTheme from a ThemeInputs via the TS adapter.
resolve_from_inputs <- function(inputs, name = "custom") {
  inputs_json <- theme_inputs_to_json(inputs)
  blob <- ts_call("buildTheme", inputs_json)
  blob$name <- name
  theme <- deserialize_resolved_theme(blob)
  theme@inputs <- inputs
  theme@name <- name
  theme
}

#' Build a theme from inputs.
#'
#' The user-authoring surface. Pass a brand seed; everything else
#' derives. Optional `accent` (engagement), `decorative` (second color
#' for editorial two-color themes), `mode`, `categorical` (data scheme),
#' fonts, and `density`.
#'
#' @param brand Required hex brand seed.
#' @param accent Engagement seed (hover/selected/callouts). Default: mirrors brand.
#' @param decorative Optional second color (alt-row tint, divider hue,
#'   row-group L1 band). Default: NULL.
#' @param mode `"light"` or `"dark"`. Default `"light"`.
#' @param neutral_tint `"untinted"`, `"brand"`, `"accent"`, `"decorative"`,
#'   or a hex string. Default `"untinted"`.
#' @param neutral_tint_strength Numeric in `[0, 1]`. Default `0.04` (subtle
#'   hint). Push toward `~1.0` for editorial paper colors (literary cream,
#'   sepia, newsprint). Ignored when `neutral_tint = "untinted"`.
#' @param categorical Named data scheme reference (Okabe-Ito default).
#' @param sequential Named sequential scheme reference.
#' @param diverging Named diverging scheme reference.
#' @param status_positive,status_negative,status_warning,status_info
#'   Optional status color overrides.
#' @param font_body,font_display,font_mono Font stacks. font_display NA
#'   mirrors font_body.
#' @param density `"compact"`, `"comfortable"`, or `"spacious"`.
#' @param web_fonts Optional list of [web_font()] declarations to embed.
#' @param name Theme name (string).
#' @return A fully-resolved [WebTheme].
#' @export
web_theme <- function(
    brand = "#0099CC",
    accent = NULL,
    decorative = NULL,
    mode = "light",
    neutral_tint = "untinted",
    neutral_tint_strength = 0.04,
    categorical = "okabe_ito",
    sequential = "viridis",
    diverging = "rdbu",
    status_positive = NULL,
    status_negative = NULL,
    status_warning = NULL,
    status_info = NULL,
    font_body = NULL,
    font_display = NULL,
    font_mono = NULL,
    density = "comfortable",
    web_fonts = NULL,
    name = "custom") {
  checkmate::assert_string(brand)
  checkmate::assert_string(accent, null.ok = TRUE)
  checkmate::assert_string(decorative, null.ok = TRUE)
  checkmate::assert_choice(mode, c("light", "dark"))
  checkmate::assert_string(neutral_tint)
  checkmate::assert_number(neutral_tint_strength, lower = 0, upper = 1)
  checkmate::assert_string(categorical)
  checkmate::assert_choice(density, c("compact", "comfortable", "spacious"))
  checkmate::assert_string(name)

  inputs <- ThemeInputs(
    brand = brand,
    accent = if (is.null(accent)) NA_character_ else accent,
    decorative = if (is.null(decorative)) NA_character_ else decorative,
    mode = mode,
    neutral_tint = neutral_tint,
    neutral_tint_strength = neutral_tint_strength,
    categorical = categorical,
    sequential = sequential,
    diverging = diverging,
    status_positive = status_positive %||% "#3F7D3F",
    status_negative = status_negative %||% "#B33A3A",
    status_warning  = status_warning  %||% "#C68A2E",
    status_info     = status_info     %||% "#1F77B4",
    font_body       = font_body       %||% "system-ui, -apple-system, sans-serif",
    font_display    = if (is.null(font_display)) NA_character_ else font_display,
    font_mono       = if (is.null(font_mono))    NA_character_ else font_mono,
    density = density
  )
  theme <- resolve_from_inputs(inputs, name = name)
  if (!is.null(web_fonts)) theme@web_fonts <- web_fonts
  theme
}

# Local null-coalesce (avoids relying on rlang for this small helper).
`%||%` <- function(x, y) if (is.null(x)) y else x


#' Set the brand seed on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param brand New brand hex.
#' @return The re-resolved [WebTheme].
#' @export
set_brand <- function(theme, brand) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(brand)
  inputs <- theme@inputs
  inputs@brand <- brand
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the accent seed on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param accent New accent hex.
#' @return The re-resolved [WebTheme].
#' @export
set_accent <- function(theme, accent) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(accent)
  inputs <- theme@inputs
  inputs@accent <- accent
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the decorative seed (two-color editorial) on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param decorative New decorative hex (or NA to clear).
#' @return The re-resolved [WebTheme].
#' @export
set_decorative <- function(theme, decorative) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(decorative, na.ok = TRUE)
  inputs <- theme@inputs
  inputs@decorative <- decorative
  resolve_from_inputs(inputs, name = theme@name)
}

#' Switch light/dark mode and re-resolve.
#' @param theme A [WebTheme].
#' @param mode `"light"` or `"dark"`.
#' @return The re-resolved [WebTheme].
#' @export
set_mode <- function(theme, mode) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(mode, c("light", "dark"))
  inputs <- theme@inputs
  inputs@mode <- mode
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the categorical data scheme and re-resolve.
#' @param theme A [WebTheme].
#' @param scheme Named scheme (`"okabe_ito"`, `"tableau10"`, `"set1"`,
#'   `"set2"`, `"dark2"`, `"paired"`, `"wong"`, `"brand_mono"`).
#' @return The re-resolved [WebTheme].
#' @export
set_categorical <- function(theme, scheme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(scheme)
  inputs <- theme@inputs
  inputs@categorical <- scheme
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the neutral tint strength and re-resolve.
#'
#' Span `0.04` (subtle clinical-journal hint) to `~1.0` (paper takes the
#' tint hex as its essential color — editorial cream, sepia, newsprint).
#'
#' @param theme A [WebTheme].
#' @param strength Numeric in `[0, 1]`.
#' @return The re-resolved [WebTheme].
#' @export
set_neutral_tint_strength <- function(theme, strength) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_number(strength, lower = 0, upper = 1)
  inputs <- theme@inputs
  inputs@neutral_tint_strength <- strength
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the density preset and re-resolve.
#' @param theme A [WebTheme].
#' @param density `"compact"`, `"comfortable"`, or `"spacious"`.
#' @return The re-resolved [WebTheme].
#' @export
set_density <- function(theme, density) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(density, c("compact", "comfortable", "spacious"))
  inputs <- theme@inputs
  inputs@density <- density
  resolve_from_inputs(inputs, name = theme@name)
}

#' Export a theme's resolved CSS variable block.
#'
#' Returns a `:root { ... }` CSS string with `--tv-*` custom properties.
#' Useful when matching a surrounding page's chrome to a tabviz palette.
#'
#' @param theme A [WebTheme].
#' @return A character string of CSS.
#' @export
tabviz_theme_css <- function(theme) {
  if (inherits(theme, "tabviz::WebSpec")) theme <- theme@theme
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme} or {.cls WebSpec}.")
  }
  wire <- serialize_theme(theme)
  ts_call("getThemeCSS", wire)
}
