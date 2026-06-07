# V4 substrate inspection helpers (Stage 1 §40 step 9).
#
# Each helper wraps a TS function via the V8 bridge. They expose the
# manifest, the resolved cssVars map, and per-token resolution traces
# at the R user surface so authors can ask "what does this token resolve
# to?" and "what role/ramp is this bound to?" interactively.
#
# Internal naming: the file lives at `R/v4-inspect.R` for discoverability;
# the helpers carry user-facing names (`list_component_tokens`,
# `inspect_token`, `theme_css_vars`) per the design doc §40 step 9.

#' List V4 component tokens declared in the manifest.
#'
#' Returns one row per declared `--tv-*` cssVar from the substrate
#' manifest (`srcjs/src/lib/theme/component-tokens.ts`). Optionally
#' includes the resolved value for each token under the supplied theme.
#'
#' @param theme Optional [WebTheme] to enrich each entry with its
#'   resolved value. When `NULL` (default), the resolved column is
#'   omitted.
#' @return A data frame with columns `css_var`, `kind`, `description`,
#'   `source_tier`, `source_label`, and (when `theme` is supplied)
#'   `resolved`.
#' @export
list_component_tokens <- function(theme = NULL) {
  if (!is.null(theme) && !inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme} or NULL.")
  }
  ctx <- tabviz_v8()
  tokens_json <- if (is.null(theme)) {
    # No resolved theme — pass null to listComponentTokens(resolved?).
    ctx$call("callBuilder", "listComponentTokens", "null")
  } else {
    # Need a v4 ResolvedTheme to enrich each entry's `resolved` field.
    inputs_json <- jsonlite::toJSON(theme_inputs_to_json(theme@inputs),
                                    auto_unbox = TRUE, null = "null", na = "null")
    resolved_json <- ctx$call("callBuilder", "resolveFromInputs", as.character(inputs_json))
    ctx$call("callBuilder", "listComponentTokens", resolved_json)
  }
  raw <- jsonlite::fromJSON(tokens_json, simplifyVector = FALSE,
                            simplifyDataFrame = FALSE, simplifyMatrix = FALSE)
  if (length(raw) == 0L) {
    return(data.frame(css_var = character(), kind = character(),
                      description = character(), source_tier = character(),
                      source_label = character(), stringsAsFactors = FALSE))
  }
  fields <- list(
    css_var      = vapply(raw, function(x) x$cssVar %||% NA_character_, character(1)),
    kind         = vapply(raw, function(x) x$kind   %||% NA_character_, character(1)),
    description  = vapply(raw, function(x) x$description %||% NA_character_, character(1)),
    source_tier  = vapply(raw, function(x) x$sourceTier  %||% NA_character_, character(1)),
    source_label = vapply(raw, function(x) x$sourceLabel %||% NA_character_, character(1))
  )
  if (!is.null(theme)) {
    fields$resolved <- vapply(raw, function(x) x$resolved %||% NA_character_, character(1))
  }
  do.call(data.frame, c(fields, stringsAsFactors = FALSE))
}

#' Return the V4 cssVars map for a given theme.
#'
#' Builds the wire from `theme.authoringInputs` (the same ThemeInputs
#' carried on R-side `WebTheme`), runs the substrate resolver, and
#' returns the resulting `--tv-*` -> value map.
#'
#' @param theme A [WebTheme].
#' @return A named character vector of cssVar values (hex / px /
#'   "transparent" / etc.).
#' @export
theme_css_vars <- function(theme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs_json <- jsonlite::toJSON(theme_inputs_to_json(theme@inputs),
                                  auto_unbox = TRUE, null = "null", na = "null")
  # Options bag carries name + role_overrides so pinned roles resolve in
  # the inspected cssVars exactly as they paint (settings-overhaul P0).
  opts <- list(name = theme@name)
  if (length(theme@role_overrides) > 0L) opts$roleOverrides <- theme@role_overrides
  opts_json <- jsonlite::toJSON(opts, auto_unbox = TRUE, null = "null", na = "null")
  ctx <- tabviz_v8()
  webtheme_json <- ctx$call("callBuilder", "buildTheme", as.character(inputs_json),
                            as.character(opts_json))
  out_json <- ctx$call("callBuilder", "getCssVars", webtheme_json)
  raw <- jsonlite::fromJSON(out_json, simplifyVector = FALSE)
  out <- vapply(raw, function(x) if (is.null(x)) NA_character_ else as.character(x),
                character(1))
  names(out) <- names(raw)
  out
}

#' Inspect a single V4 token's resolution.
#'
#' Returns the per-step trace of how `css_var` resolves under `theme`:
#' which role binding fired, which ramp+grade was hit, mode/polarity
#' transforms applied, and the final value.
#'
#' @param theme A [WebTheme].
#' @param css_var The token name (e.g. `"--tv-row-base-bg"`).
#' @return A list with `$cssVar`, `$value`, `$trace` (a list of steps).
#' @export
inspect_token <- function(theme, css_var) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(css_var)
  inputs_json <- jsonlite::toJSON(theme_inputs_to_json(theme@inputs),
                                  auto_unbox = TRUE, null = "null", na = "null")
  ctx <- tabviz_v8()
  resolved_json <- ctx$call("callBuilder", "resolveFromInputs", as.character(inputs_json))
  result_json <- ctx$call("callBuilder", "inspectToken", resolved_json,
                          jsonlite::toJSON(css_var, auto_unbox = TRUE))
  jsonlite::fromJSON(result_json, simplifyVector = TRUE,
                     simplifyDataFrame = FALSE, simplifyMatrix = FALSE)
}

#' Contrast report for the V4 substrate.
#'
#' Returns a data frame of foreground/background pairs that matter for
#' typography legibility, with their absolute APCA-Lc contrast values.
#' Lower magnitudes (under ~45) flag tokens that may be hard to read.
#'
#' @param theme A [WebTheme].
#' @return A data frame with columns `pair`, `fg`, `bg`, `apca_lc`.
#' @export
contrast_report <- function(theme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs_json <- jsonlite::toJSON(theme_inputs_to_json(theme@inputs),
                                  auto_unbox = TRUE, null = "null", na = "null")
  ctx <- tabviz_v8()
  resolved_json <- ctx$call("callBuilder", "resolveFromInputs", as.character(inputs_json))
  out_json <- ctx$call("callBuilder", "contrastReport", resolved_json)
  raw <- jsonlite::fromJSON(out_json, simplifyVector = FALSE)
  data.frame(
    pair    = vapply(raw, function(x) x$label %||% NA_character_, character(1)),
    fg      = vapply(raw, function(x) x$fg    %||% NA_character_, character(1)),
    bg      = vapply(raw, function(x) x$bg    %||% NA_character_, character(1)),
    apca_lc = vapply(raw, function(x) x$apcaLc %||% NA_real_,      numeric(1)),
    stringsAsFactors = FALSE
  )
}

#' Diff the cssVars of two themes.
#'
#' Compares the V4 cssVars maps and returns a data frame of tokens that
#' differ, with both values side-by-side. Useful when a `set_*()`
#' modifier appears to do too much or too little — `diff_themes(before,
#' after)` shows exactly which tokens moved.
#'
#' @param theme_a,theme_b Two [WebTheme] objects.
#' @return A data frame with columns `css_var`, `a`, `b`.
#' @export
diff_themes <- function(theme_a, theme_b) {
  if (!inherits(theme_a, "tabviz::WebTheme") || !inherits(theme_b, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme_a} and {.arg theme_b} must both be {.cls WebTheme} objects.")
  }
  cva <- theme_css_vars(theme_a)
  cvb <- theme_css_vars(theme_b)
  keys <- union(names(cva), names(cvb))
  changed <- vapply(keys, function(k) !identical(cva[[k]], cvb[[k]]), logical(1))
  keys <- keys[changed]
  if (length(keys) == 0L) {
    return(data.frame(css_var = character(), a = character(), b = character(),
                      stringsAsFactors = FALSE))
  }
  data.frame(
    css_var = keys,
    a = vapply(keys, function(k) cva[[k]] %||% NA_character_, character(1)),
    b = vapply(keys, function(k) cvb[[k]] %||% NA_character_, character(1)),
    stringsAsFactors = FALSE
  )
}
