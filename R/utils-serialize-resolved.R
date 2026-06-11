# Serialization for the v2 theme system.
#
# serialize_theme(theme_v2) emits a self-contained JSON-ready list with
# the new tier 2 / tier 3 nested shape. PR 8 wires the frontend to consume
# this directly. PR 6 only defines the wire shape and tests it; tabviz()
# dispatch and frontend reader land in PR 8.

#' Serialize a v2 theme to a JSON-ready list.
#'
#' Emits the full tier 2 / tier 3 resolved shape under camelCase field
#' names. NA fields convert to JSON `null` (= "inherit / no override").
#' The output is self-contained: no v1 fallback fields.
#'
#' @param theme A [WebTheme] (resolved or unresolved; resolved is
#'   re-applied at emit time so callers don't need to remember).
#' @return A nested list suitable for `jsonlite::toJSON`.
#' @keywords internal
serialize_theme <- function(theme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }

  # Canonical resolved-theme wire shape comes from the TS adapter — derived from
  # the inputs that authored this theme. R-side axis/layout/borders/
  # web_fonts can have been modified after construction; overlay them.
  inputs_json <- theme_inputs_to_json(theme@inputs)
  # role_overrides ride the options bag so the TS adapter stamps them on
  # the built blob (wire key `roleOverrides`) and the v4 resolve reflects
  # them (settings-overhaul P0 — pins are part of the portable artifact).
  opts <- list(name = theme@name)
  if (length(theme@role_overrides) > 0L) opts$roleOverrides <- theme@role_overrides
  if (length(theme@pins) > 0L) opts$pins <- theme@pins
  if (length(theme@components) > 0L) opts$components <- theme@components
  blob <- ts_call("buildTheme", inputs_json, options = opts)
  blob$name <- theme@name

  # `variants` fully retired (W3 + W4): headerStyle + firstColumnStyle
  # are theme INPUTS now; density resolves from inputs.density.

  if (length(theme@web_fonts) > 0L) {
    blob$webFonts <- lapply(theme@web_fonts, function(wf) list(family = wf$family, url = wf$url))
  }

  # Overlay R-side mutable axis/layout/borders so user edits to these
  # survive (they're not part of the inputs cascade).
  axis_block <- list(
    rangeMin       = if (is.na(theme@axis@range_min))  NULL else theme@axis@range_min,
    rangeMax       = if (is.na(theme@axis@range_max))  NULL else theme@axis@range_max,
    tickCount      = if (is.na(theme@axis@tick_count)) NULL else theme@axis@tick_count,
    tickValues     = if (is.null(theme@axis@tick_values)) NULL else I(theme@axis@tick_values),
    gridlines      = theme@axis@gridlines,
    gridlineStyle  = theme@axis@gridline_style,
    ciClipFactor   = theme@axis@ci_clip_factor,
    includeNull    = theme@axis@include_null,
    symmetric      = theme@axis@symmetric,
    nullTick       = theme@axis@null_tick,
    markerMargin   = theme@axis@marker_margin
  )
  layout_block <- list(
    plotWidth             = theme@layout@plot_width,
    containerBorder       = theme@layout@container_border,
    containerBorderRadius = theme@layout@container_border_radius,
    banding               = serialize_banding(theme@row@banding)
  )

  # Borders are emitted as a flat sibling of axis/layout; layout × type
  # model (see ThemeBorders + BorderSpec in R/classes-theme.R).
  serialize_border_spec <- function(b) {
    list(
      thickness = b@thickness,
      style     = b@style,
      color     = if (is.na(b@color)) "#000000" else b@color
    )
  }
  borders_block <- list(
    layout = theme@borders@layout,
    major  = serialize_border_spec(theme@borders@major),
    minor  = serialize_border_spec(theme@borders@minor),
    table  = serialize_border_spec(theme@borders@table)
  )

  blob$axis    <- axis_block
  blob$layout  <- layout_block
  blob$borders <- borders_block

  # Overlay R-side spacing edits (round-2 cross-runtime review P2):
  # set_spacing() writes theme@spacing slots, but they were NEVER
  # serialized — so a per-figure spacing edit silently reverted to the
  # density-derived default in EVERY runtime (export, static, widget).
  # Only non-NA slots override; NA = "inherit the density preset". Wire
  # keys are camelCase (WebTheme surface), consumed by applySpacingPins.
  spacing_map <- list(
    rowHeight          = theme@spacing@row_height,
    headerHeight       = theme@spacing@header_height,
    padding            = theme@spacing@padding,
    containerPadding   = theme@spacing@container_padding,
    axisGap            = theme@spacing@axis_gap,
    columnGroupPadding = theme@spacing@column_group_padding,
    rowGroupPadding    = theme@spacing@row_group_padding,
    cellPaddingX       = theme@spacing@cell_padding_x,
    footerGap          = theme@spacing@footer_gap,
    titleSubtitleGap   = theme@spacing@title_subtitle_gap,
    headerGap          = theme@spacing@header_gap,
    bottomMargin       = theme@spacing@bottom_margin,
    indentPerLevel     = theme@spacing@indent_per_level
  )
  spacing_set <- spacing_map[!vapply(spacing_map, is.na, logical(1))]
  if (length(spacing_set) > 0L) {
    if (is.null(blob$spacing)) blob$spacing <- list()
    blob$spacing[names(spacing_set)] <- spacing_set
  }

  blob
}
