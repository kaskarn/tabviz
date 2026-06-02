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
    density               = inputs@density,
    densityFactor         = if (inputs@density_factor != 1) inputs@density_factor else NULL
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
#' @param density_factor Continuous multiplier on the density preset's spacing,
#'   in `[0.5, 2]` (1 = preset unchanged) — a fine dial on top of the named
#'   profile (e.g. `0.9` for a touch tighter).
#' @param header_style Header chrome treatment: `"light"`, `"tint"`, or
#'   `"bold"`. Default `"light"`.
#' @param first_column_style First (label) column treatment: `"default"`,
#'   `"tint"`, or `"bold"`. Default `"default"`.
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
    density_factor = 1,
    header_style = "light",
    first_column_style = "default",
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
  checkmate::assert_number(density_factor, lower = 0.5, upper = 2)
  checkmate::assert_choice(header_style, c("light", "tint", "bold"))
  checkmate::assert_choice(first_column_style, c("default", "tint", "bold"))
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
    density = density,
    density_factor = density_factor
  )
  theme <- resolve_from_inputs(inputs, name = name)
  theme@header_style <- header_style
  theme@first_column_style <- first_column_style
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

#' Set the density preset (and optionally the continuous factor) and re-resolve.
#' @param theme A [WebTheme].
#' @param density `"compact"`, `"comfortable"`, or `"spacious"` (or `NULL` to
#'   keep the current preset and adjust only `factor`).
#' @param factor Optional continuous multiplier on the preset's spacing, in
#'   `[0.5, 2]` (1 = preset unchanged). `NULL` keeps the current factor.
#' @return The re-resolved [WebTheme].
#' @export
set_density <- function(theme, density = NULL, factor = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs <- theme@inputs
  if (!is.null(density)) {
    checkmate::assert_choice(density, c("compact", "comfortable", "spacious"))
    inputs@density <- density
  }
  if (!is.null(factor)) {
    checkmate::assert_number(factor, lower = 0.5, upper = 2)
    inputs@density_factor <- factor
  }
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the header chrome variant.
#'
#' `header_style` is a post-resolution variant selector (not a Tier-1 input),
#' so this assigns it directly without re-resolving the cascade. Mirrors the
#' `header_style` argument of [web_theme()].
#'
#' @param theme A [WebTheme].
#' @param header_style `"light"`, `"tint"`, or `"bold"`.
#' @return The [WebTheme] with the header variant applied.
#' @export
set_header_style <- function(theme, header_style) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(header_style, c("light", "tint", "bold"))
  theme@header_style <- header_style
  theme
}

#' Set the first (label) column variant.
#'
#' `first_column_style` is a post-resolution variant selector (not a Tier-1
#' input), so this assigns it directly without re-resolving. Mirrors the
#' `first_column_style` argument of [web_theme()].
#'
#' @param theme A [WebTheme].
#' @param first_column_style `"default"`, `"tint"`, or `"bold"`.
#' @return The [WebTheme] with the first-column variant applied.
#' @export
set_first_column_style <- function(theme, first_column_style) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(first_column_style, c("default", "tint", "bold"))
  theme@first_column_style <- first_column_style
  theme
}

#' Set named S7 properties on an object from a `...` list. Internal helper for
#' the batch theme setters; skips NULL args so partial updates are clean.
#' @noRd
apply_named_props <- function(obj, args) {
  for (nm in names(args)) {
    if (is.null(args[[nm]])) next
    S7::prop(obj, nm) <- args[[nm]]
  }
  obj
}

#' Update Tier-1 theme inputs and re-resolve.
#'
#' Batch setter for any [ThemeInputs] field (`brand`/`primary`, `accent`,
#' `mode`, `density`, `categorical`, `status_*`, `font_*`, ...). Cascade-aware:
#' changing an input re-runs resolution, so derived tokens refresh while
#' user pins on the resolved theme are re-applied by the resolver. For a
#' single input prefer the focused setter (`set_brand()`, `set_accent()`,
#' `set_density()`, ...); use this when changing several at once.
#'
#' @param theme A [WebTheme].
#' @param ... Named arguments matching [ThemeInputs] property names.
#' @return The re-resolved [WebTheme].
#' @export
set_inputs <- function(theme, ...) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs <- apply_named_props(theme@inputs, list(...))
  resolve_from_inputs(inputs, name = theme@name)
}

#' Override density-derived spacing tokens.
#'
#' Per-token spacing overrides on top of the active density preset — set the
#' tokens you care about; the rest keep their density-preset values. `spacing`
#' is a post-resolution token block (not a Tier-1 input), so this assigns
#' directly without re-resolving the cascade.
#'
#' @param theme A [WebTheme].
#' @param ... Named numeric arguments matching [SpacingTokens] property names
#'   (`row_height`, `header_height`, `padding`, `axis_gap`, ...).
#' @return The [WebTheme] with spacing overrides applied.
#' @export
set_spacing <- function(theme, ...) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  theme@spacing <- apply_named_props(theme@spacing, list(...))
  theme
}

#' Set a single theme field by path (generic deep setter).
#'
#' Escape hatch for pinning any leaf in the resolved theme tree without a
#' dedicated setter. `path` is a character vector of property names from the
#' theme root to the leaf; integer entries index list properties (e.g.
#' `series`). Assigning under `inputs` re-resolves the cascade (the change is
#' an input); any other path is a post-resolution pin applied directly.
#'
#' @param theme A [WebTheme].
#' @param path Character (or mixed character/integer) vector from the theme
#'   root to the target leaf.
#' @param value New value for the leaf.
#' @return The [WebTheme] with the field set (re-resolved when `path` targets
#'   an input).
#' @examples
#' \dontrun{
#'   web_theme_cochrane() |> set_theme_field(c("row_group", "L1", "bg"), "#EEE")
#'   web_theme_cochrane() |> set_theme_field(c("series", 1L, "fill"), "#FF0000")
#' }
#' @export
set_theme_field <- function(theme, path, value) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  if (length(path) == 0L) {
    cli::cli_abort("{.arg path} must have at least one element.")
  }
  # A step indexes a list when it's numeric OR a numeric-looking string against
  # a bare list target. `c("series", 1L, "fill")` coerces 1L to "1", so we
  # detect index steps structurally rather than by type alone.
  is_index_step <- function(key, obj) {
    if (is.numeric(key)) return(TRUE)
    is.list(obj) && !inherits(obj, "S7_object") && grepl("^[0-9]+$", key)
  }
  set_at <- function(obj, p, v) {
    key <- p[[1]]
    if (length(p) == 1L) {
      if (is_index_step(key, obj)) {
        obj[[as.integer(key)]] <- v
        return(obj)
      }
      S7::prop(obj, key) <- v
      return(obj)
    }
    if (is_index_step(key, obj)) {
      idx <- as.integer(key)
      obj[[idx]] <- set_at(obj[[idx]], p[-1], v)
      return(obj)
    }
    S7::prop(obj, key) <- set_at(S7::prop(obj, key), p[-1], v)
    obj
  }
  theme <- set_at(theme, as.list(path), value)
  # If an input changed, re-resolve so derived tokens refresh.
  if (identical(as.character(path[[1]]), "inputs")) {
    return(resolve_from_inputs(theme@inputs, name = theme@name))
  }
  theme
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
