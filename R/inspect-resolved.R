# Inspect-resolved: introspect a leaf in a resolved theme.
#
# `inspect_resolved(theme, "header.bold.bg")` returns the resolved hex
# value alongside the cascade path + derivation rule that produced it. For
# debugging themes (custom or preset) and for surfacing cascade tooltips
# in the widget's Theme tab (Phase B).
#
# Implementation: a hand-authored registry maps each well-known leaf path
# to its resolver recipe. Adding a leaf requires updating both the
# resolver (R/utils-theme-resolve.R) AND this registry -- they describe
# the same contract from two angles. The cost of duplication is low
# (~25 leaves) and the recipe-as-data shape is also what the JS Theme
# tab needs for inline cascade tooltips.

# RESOLVED_LEAVES: address -> recipe.
#
# Each entry is a list:
#   * cascade: ordered character vector naming the upstream T1 inputs (or
#     T2 leaves when the recipe mixes T2 tokens) that influence this
#     value. Read top-down: the leaf reads cascade[1] first; cascade[1]
#     reads cascade[2] when NA; etc.
#   * derivation: one-line plain-text recipe for tooltip display. Use
#     `inputs$x` for T1, `t2$x` for T2 leaves, and OKLCH formulas
#     (oklch_darken, oklch_mix) where applicable.
#   * value_getter: function(theme) -> hex; encapsulates the property
#     access path (since S7 uses @ not $$).
#
# Adding a leaf: copy an existing entry, update cascade + derivation +
# value_getter. Keep entries grouped by component cluster for readability.
RESOLVED_LEAVES <- list(
  # -- Header (light / tint / bold) ----------------------------------
  "header.light.bg" = list(
    cascade    = c("surface$base"),
    derivation = "surface.base (publication default -- bare surface)",
    value_getter = function(t) t@header@light@bg
  ),
  "header.light.fg" = list(
    cascade    = c("content$primary"),
    derivation = "content.primary",
    value_getter = function(t) t@header@light@fg
  ),
  "header.light.rule" = list(
    cascade    = c("divider$strong"),
    derivation = "divider.strong",
    value_getter = function(t) t@header@light@rule
  ),
  "header.tint.bg" = list(
    cascade    = c("inputs$primary_deep", "surface$base"),
    derivation = "12% oklch_mix(surface.base, primary_deep)",
    value_getter = function(t) t@header@tint@bg
  ),
  "header.tint.fg" = list(
    cascade    = c("content$primary"),
    derivation = "content.primary",
    value_getter = function(t) t@header@tint@fg
  ),
  "header.bold.bg" = list(
    cascade    = c("inputs$primary_deep", "inputs$primary"),
    derivation = "inputs$primary_deep (auto: oklch_darken(primary, 0.15))",
    value_getter = function(t) t@header@bold@bg
  ),
  "header.bold.fg" = list(
    cascade    = c("content$inverse"),
    derivation = "content.inverse",
    value_getter = function(t) t@header@bold@fg
  ),
  "header.bold.rule" = list(
    cascade    = c("content$inverse", "inputs$primary_deep"),
    derivation = "40% oklch_mix(content.inverse, primary_deep)",
    value_getter = function(t) t@header@bold@rule
  ),

  # -- Column group (light / tint / bold) ----------------------------
  "column_group.bold.bg" = list(
    cascade    = c("inputs$secondary_deep", "inputs$primary_deep"),
    derivation = "inputs$secondary_deep (mirrors primary_deep when secondary NA)",
    value_getter = function(t) t@column_group@bold@bg
  ),
  "column_group.bold.fg" = list(
    cascade    = c("content$inverse"),
    derivation = "content.inverse",
    value_getter = function(t) t@column_group@bold@fg
  ),
  "column_group.bold.rule" = list(
    cascade    = c("content$inverse", "inputs$secondary_deep"),
    derivation = "40% oklch_mix(content.inverse, secondary_deep)",
    value_getter = function(t) t@column_group@bold@rule
  ),
  "column_group.tint.bg" = list(
    cascade    = c("inputs$secondary_deep", "surface$base"),
    derivation = "12% oklch_mix(surface.base, secondary_deep)",
    value_getter = function(t) t@column_group@tint@bg
  ),

  # -- Row group ----------------------------------------------------
  "row_group.L1.bg" = list(
    cascade    = c("inputs$secondary_deep", "surface$base", "variants$header_style"),
    derivation = "16% mix (header_style=light) or 24% mix (tint/bold) of secondary_deep into surface.base",
    value_getter = function(t) t@row_group@L1@bg
  ),

  # -- Surface (chrome) ---------------------------------------------
  "surface.base" = list(
    cascade    = c("inputs$neutral[2]"),
    derivation = "neutral[2] (lightest end of neutral ramp)",
    value_getter = function(t) t@surface@base
  ),
  "surface.muted" = list(
    cascade    = c("inputs$neutral[3]", "inputs$secondary_deep"),
    derivation = "4% oklch_mix(neutral[3], secondary_deep) -- chrome texture",
    value_getter = function(t) t@surface@muted
  ),

  # -- Dividers -----------------------------------------------------
  "divider.subtle" = list(
    cascade    = c("inputs$neutral[3]", "inputs$neutral[4]", "inputs$secondary_deep"),
    derivation = "10% oklch_mix(divider_neutral, secondary_deep)",
    value_getter = function(t) t@divider@subtle
  ),
  "divider.strong" = list(
    cascade    = c("inputs$neutral[4]", "inputs$secondary_deep"),
    derivation = "5% oklch_mix(neutral[4], secondary_deep)",
    value_getter = function(t) t@divider@strong
  ),

  # -- Accent -------------------------------------------------------
  "accent.default" = list(
    cascade    = c("inputs$accent"),
    derivation = "inputs$accent (orthogonal to identity)",
    value_getter = function(t) t@accent@default
  ),
  "accent.muted" = list(
    cascade    = c("inputs$accent", "surface$base"),
    derivation = "88% oklch_mix(accent, surface.base) -- hover/selected tint",
    value_getter = function(t) t@accent@muted
  ),
  "accent.tint_subtle" = list(
    cascade    = c("inputs$accent", "surface$base"),
    derivation = "90% oklch_mix(accent, surface.base)",
    value_getter = function(t) t@accent@tint_subtle
  ),
  "accent.tint_medium" = list(
    cascade    = c("inputs$accent", "surface$base"),
    derivation = "75% oklch_mix(accent, surface.base)",
    value_getter = function(t) t@accent@tint_medium
  ),
  "semantic.fill" = list(
    cascade    = c("inputs$accent", "inputs$neutral[1]"),
    derivation = "80% oklch_mix(accent, neutral[1]) -- soft row-fill tint",
    value_getter = function(t) t@semantic@fill
  ),

  # -- Content ------------------------------------------------------
  "content.primary" = list(
    cascade    = c("inputs$neutral[5]"),
    derivation = "neutral[5] (darkest end of neutral ramp)",
    value_getter = function(t) t@content@primary
  ),
  "content.inverse" = list(
    cascade    = c("inputs$neutral[1]"),
    derivation = "neutral[1] (lightest end of neutral ramp)",
    value_getter = function(t) t@content@inverse
  ),

  # -- Text roles ---------------------------------------------------
  "text.title.fg" = list(
    cascade    = c("inputs$primary_deep"),
    derivation = "inputs$primary_deep -- identity hero",
    value_getter = function(t) t@text@title@fg
  ),
  "text.tick.fg" = list(
    cascade    = c("content$muted", "inputs$secondary_deep"),
    derivation = "10% oklch_mix(content.muted, secondary_deep)",
    value_getter = function(t) t@text@tick@fg
  ),

  # -- Plot scaffold ------------------------------------------------
  "plot.axis_line" = list(
    cascade    = c("divider$strong"),
    derivation = "divider.strong",
    value_getter = function(t) t@plot@axis_line
  ),
  "plot.gridline" = list(
    cascade    = c("divider$subtle"),
    derivation = "divider.subtle",
    value_getter = function(t) t@plot@gridline
  )
)

#' Inspect a single resolved leaf in a theme.
#'
#' Returns the resolved hex value alongside the cascade path and
#' derivation rule that produced it. Useful for debugging themes
#' (custom or preset) -- answers "why is this hex this value?" by
#' showing the upstream T1 inputs and the derivation formula.
#'
#' Only well-known leaves are introspected (see internal
#' `RESOLVED_LEAVES` registry -- covers headers, column/row groups,
#' surface, dividers, accent ramp, content, text roles, plot
#' scaffold). Unknown paths abort with a list of supported leaves.
#'
#' @param theme A resolved [WebTheme].
#' @param path Character -- the leaf address as a dotted string,
#'   e.g. `"header.bold.bg"`, `"divider.strong"`, `"accent.muted"`.
#' @return A list with:
#'   * `path`: the address you queried
#'   * `value`: the resolved hex
#'   * `cascade`: ordered character vector of upstream sources
#'   * `derivation`: plain-text recipe describing how `value` is computed
#' @export
#' @examples
#' \dontrun{
#' t <- web_theme_cochrane()
#' inspect_resolved(t, "header.bold.bg")
#' inspect_resolved(t, "divider.strong")
#' }
inspect_resolved <- function(theme, path) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(path, min.chars = 1L)

  entry <- RESOLVED_LEAVES[[path]]
  if (is.null(entry)) {
    known <- sort(names(RESOLVED_LEAVES))
    cli::cli_abort(c(
      "Unknown leaf path: {.field {path}}.",
      "i" = "Supported leaves: {.field {known}}",
      "i" = "Add it to `RESOLVED_LEAVES` in R/inspect-resolved.R if you need new paths."
    ))
  }

  list(
    path       = path,
    value      = entry$value_getter(theme),
    cascade    = entry$cascade,
    derivation = entry$derivation
  )
}
