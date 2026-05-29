# Theme resolution entry point.
#
# As of the Sprint 1 R↔TS cascade collapse, all derivation logic lives in
# `srcjs/src/lib/theme-resolve.ts::resolveTheme`. R authors a WebTheme,
# extracts the user-pinned inputs + variants + overrides via
# `webtheme_to_resolve_draft()`, calls the TS resolver over the V8 bridge,
# and reconstructs the S7 surface via `deserialize_resolved_theme()`. The
# R-side cascade helpers (`resolve_inputs_mirrors`, `resolve_chrome`,
# `resolve_data`, `resolve_text`, `resolve_components`, `derive_slot_bundle`,
# etc.) and the contrast validator (`validate_resolved_theme`) were
# deleted with the collapse — TS owns those invariants now and runs
# validation inside `resolveTheme(draft, { validate })`.
#
# Why collapse: the cascade is pure computation with a perfect TS twin
# that the browser/V8 export pipeline already ran. Maintaining two
# implementations + parity tests was the largest piece of R-side
# duplication in the package. Single source of truth for cascade
# semantics now lives in one place.
#
# What stays R-side: WebTheme S7 class (authoring ergonomics + validators
# in `R/classes-theme.R`), the V8-bridge helpers in
# `R/utils-deserialize-resolved.R`, and `DENSITY_PRESETS` below as a
# reference value for tests that probe density semantics without
# round-tripping.


# Density presets — reference values for tests. The live values live in
# the TS resolver (`srcjs/src/lib/theme-resolve.ts::DENSITY_PRESETS`).
# Kept in sync by hand; if the TS values change, mirror here.
DENSITY_PRESETS <- list(
  compact = list(
    row_height = 20, header_height = 26, padding = 8, container_padding = 0,
    axis_gap = 8, column_group_padding = 6, row_group_padding = 0,
    cell_padding_x = 8, footer_gap = 6, title_subtitle_gap = 10,
    header_gap = 8, bottom_margin = 12, indent_per_level = 14
  ),
  comfortable = list(
    row_height = 24, header_height = 32, padding = 12, container_padding = 0,
    axis_gap = 12, column_group_padding = 8, row_group_padding = 0,
    cell_padding_x = 10, footer_gap = 8, title_subtitle_gap = 13,
    header_gap = 12, bottom_margin = 16, indent_per_level = 16
  ),
  spacious = list(
    row_height = 30, header_height = 40, padding = 16, container_padding = 0,
    axis_gap = 16, column_group_padding = 12, row_group_padding = 0,
    cell_padding_x = 14, footer_gap = 12, title_subtitle_gap = 18,
    header_gap = 16, bottom_margin = 22, indent_per_level = 20
  )
)


#' Resolve a theme: fill all NA-default Tier 2 / Tier 3 fields.
#'
#' Delegates to the TS resolver via V8. R extracts the user-pinned
#' inputs + variants + overrides, ships them across the bridge, and
#' reconstructs the S7 surface from the resolved JSON so
#' `theme@row@base@bg` access keeps working R-side. Single source of
#' truth for cascade semantics lives in
#' `srcjs/src/lib/theme-resolve.ts::resolveTheme`.
#'
#' Idempotent and deterministic. Only writes into NA-valued fields, so
#' user-set overrides survive re-resolution. Runs all derivations in
#' OKLCH (perceptually uniform) and clips to sRGB at every step.
#'
#' @param theme A [WebTheme] object.
#' @param .validate Whether to run construction-time contrast validation
#'   on the resolved theme. Default `TRUE`. Set to `FALSE` only for tests
#'   that intentionally use synthetic high-saturation colors to verify
#'   cascade mechanics — production callers should leave validation on
#'   so broken overrides surface at construction rather than at render.
#' @return A [WebTheme] object with NA fields populated.
#' @export
resolve_theme <- function(theme, .validate = TRUE) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  draft <- webtheme_to_resolve_draft(theme)
  resolved <- ts_call(
    "resolveTheme",
    draft,
    options = list(validate = isTRUE(.validate))
  )
  deserialize_resolved_theme(resolved)
}
