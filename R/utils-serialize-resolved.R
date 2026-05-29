# Serialization for the v2 theme system.
#
# serialize_theme(theme_v2) emits a self-contained JSON-ready list with
# the new tier 2 / tier 3 nested shape. PR 8 wires the frontend to consume
# this directly. PR 6 only defines the wire shape and tests it; tabviz()
# dispatch and frontend reader land in PR 8.

# NA -> NULL conversion. Logical NA, character NA, numeric NA all map to NULL.
na_to_null <- function(v) {
  if (is.null(v) || length(v) == 0L) return(NULL)
  if (length(v) == 1L && is.na(v)) return(NULL)
  v
}


serialize_text_role <- function(role) {
  list(
    family  = na_to_null(role@family),
    size    = na_to_null(role@size),
    weight  = na_to_null(role@weight),
    figures = na_to_null(role@figures),
    fg      = na_to_null(role@fg),
    italic  = na_to_null(role@italic)
  )
}

serialize_slot_role <- function(b) {
  list(
    fill       = na_to_null(b@fill),
    stroke     = na_to_null(b@stroke),
    fillDim    = na_to_null(b@fill_dim),
    strokeDim  = na_to_null(b@stroke_dim),
    fillHot    = na_to_null(b@fill_hot),
    strokeHot  = na_to_null(b@stroke_hot),
    textFg     = na_to_null(b@text_fg),
    shape      = na_to_null(b@shape)
  )
}
# Deprecated alias — Sprint 1 PR 2 rename.
serialize_slot_bundle <- serialize_slot_role

serialize_row_state <- function(s) {
  list(
    bg = na_to_null(s@bg),
    fg = na_to_null(s@fg)
  )
}

serialize_row_semantic <- function(s) {
  list(
    bg           = na_to_null(s@bg),
    fg           = na_to_null(s@fg),
    border       = na_to_null(s@border),
    markerFill   = na_to_null(s@marker_fill),
    markerStroke = na_to_null(s@marker_stroke),
    fontWeight   = na_to_null(s@font_weight),
    fontStyle    = na_to_null(s@font_style)
  )
}

serialize_header_variant <- function(v) {
  list(
    bg   = na_to_null(v@bg),
    fg   = na_to_null(v@fg),
    rule = na_to_null(v@rule)
  )
}

serialize_first_column_variant <- function(v) {
  list(
    bg     = na_to_null(v@bg),
    fg     = na_to_null(v@fg),
    rule   = na_to_null(v@rule),
    weight = na_to_null(v@weight)
  )
}

serialize_row_group_tier <- function(t) {
  list(
    bg           = na_to_null(t@bg),
    fg           = na_to_null(t@fg),
    rule         = na_to_null(t@rule),
    text         = serialize_text_role(t@text),
    borderBottom = t@border_bottom
  )
}

serialize_mark_recipe <- function(r) {
  list(
    body    = r@body,
    outline = r@outline,
    line    = r@line
  )
}


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
  blob <- ts_call("buildTheme", inputs_json)
  blob$name <- theme@name
  if (!is.na(theme@light_dark_pair)) blob$lightDarkPair <- theme@light_dark_pair

  # Variants — adapter defaults are "light"/"default"; presets author
  # different choices at construction time and we surface them here so
  # the renderer reads the per-preset variant.
  if (is.null(blob$variants)) blob$variants <- list()
  blob$variants$headerStyle <- theme@header_style
  blob$variants$firstColumnStyle <- theme@first_column_style

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

  blob
}
