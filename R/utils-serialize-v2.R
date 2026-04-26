# Serialization for the v2 theme system.
#
# serialize_theme_v2(theme_v2) emits a self-contained JSON-ready list with
# the new tier 2 / tier 3 nested shape. PR 8 wires the frontend to consume
# this directly. PR 6 only defines the wire shape and tests it; tabviz()
# dispatch and frontend reader land in PR 8.

# NA -> NULL conversion. Logical NA, character NA, numeric NA all map to NULL.
na_to_null <- function(v) {
  if (is.null(v) || length(v) == 0L) return(NULL)
  if (length(v) == 1L && is.na(v)) return(NULL)
  v
}


serialize_text_role_v2 <- function(role) {
  list(
    family  = na_to_null(role@family),
    size    = na_to_null(role@size),
    weight  = na_to_null(role@weight),
    figures = na_to_null(role@figures),
    fg      = na_to_null(role@fg),
    italic  = na_to_null(role@italic)
  )
}

serialize_slot_bundle <- function(b) {
  list(
    fill           = na_to_null(b@fill),
    stroke         = na_to_null(b@stroke),
    fillMuted      = na_to_null(b@fill_muted),
    strokeMuted    = na_to_null(b@stroke_muted),
    fillEmphasis   = na_to_null(b@fill_emphasis),
    strokeEmphasis = na_to_null(b@stroke_emphasis),
    textFg         = na_to_null(b@text_fg)
  )
}

serialize_row_state <- function(s) {
  list(
    bg = na_to_null(s@bg),
    fg = na_to_null(s@fg)
  )
}

serialize_row_semantic <- function(s) {
  list(
    bg         = na_to_null(s@bg),
    fg         = na_to_null(s@fg),
    border     = na_to_null(s@border),
    markerFill = na_to_null(s@marker_fill),
    fontWeight = na_to_null(s@font_weight),
    fontStyle  = na_to_null(s@font_style)
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
    text         = serialize_text_role_v2(t@text),
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
#' @param theme A [WebTheme2] (resolved or unresolved; resolved is
#'   re-applied at emit time so callers don't need to remember).
#' @return A nested list suitable for `jsonlite::toJSON`.
#' @keywords internal
serialize_theme_v2 <- function(theme) {
  if (!inherits(theme, "tabviz::WebTheme2")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme2}.")
  }
  theme <- resolve_theme(theme)

  list(
    schemaVersion = 2L,
    name = theme@name,

    variants = list(
      density          = theme@variants@density,
      headerStyle      = theme@variants@header_style,
      firstColumnStyle = theme@variants@first_column_style
    ),

    surface = list(
      base   = theme@surface@base,
      muted  = theme@surface@muted,
      raised = theme@surface@raised
    ),
    content = list(
      primary   = theme@content@primary,
      secondary = theme@content@secondary,
      muted     = theme@content@muted,
      inverse   = theme@content@inverse
    ),
    divider = list(
      subtle = theme@divider@subtle,
      strong = theme@divider@strong
    ),
    accent = list(
      default     = theme@accent@default,
      muted       = theme@accent@muted,
      tintSubtle  = theme@accent@tint_subtle,
      tintMedium  = theme@accent@tint_medium
    ),
    status = list(
      positive = theme@status@positive,
      negative = theme@status@negative,
      warning  = theme@status@warning,
      info     = theme@status@info
    ),

    series  = lapply(theme@series, serialize_slot_bundle),
    summary = serialize_slot_bundle(theme@summary),

    text = list(
      title    = serialize_text_role_v2(theme@text@title),
      subtitle = serialize_text_role_v2(theme@text@subtitle),
      body     = serialize_text_role_v2(theme@text@body),
      cell     = serialize_text_role_v2(theme@text@cell),
      label    = serialize_text_role_v2(theme@text@label),
      tick     = serialize_text_role_v2(theme@text@tick),
      footnote = serialize_text_role_v2(theme@text@footnote),
      caption  = serialize_text_role_v2(theme@text@caption)
    ),

    spacing = list(
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
      bottomMargin       = theme@spacing@bottom_margin,
      indentPerLevel     = theme@spacing@indent_per_level
    ),

    annotation = list(
      title    = serialize_text_role_v2(theme@annotation@title),
      subtitle = serialize_text_role_v2(theme@annotation@subtitle),
      caption  = serialize_text_role_v2(theme@annotation@caption),
      footnote = serialize_text_role_v2(theme@annotation@footnote)
    ),

    header = list(
      light = serialize_header_variant(theme@header@light),
      bold  = serialize_header_variant(theme@header@bold),
      text  = serialize_text_role_v2(theme@header@text)
    ),
    columnGroup = list(
      light = serialize_header_variant(theme@column_group@light),
      bold  = serialize_header_variant(theme@column_group@bold),
      text  = serialize_text_role_v2(theme@column_group@text)
    ),
    rowGroup = list(
      L1             = serialize_row_group_tier(theme@row_group@L1),
      L2             = serialize_row_group_tier(theme@row_group@L2),
      L3             = serialize_row_group_tier(theme@row_group@L3),
      indentPerLevel = theme@row_group@indent_per_level
    ),

    row = list(
      base     = serialize_row_state(theme@row@base),
      alt      = serialize_row_state(theme@row@alt),
      hover    = serialize_row_state(theme@row@hover),
      selected = serialize_row_state(theme@row@selected),
      emphasis = serialize_row_semantic(theme@row@emphasis),
      muted    = serialize_row_semantic(theme@row@muted),
      accent   = serialize_row_semantic(theme@row@accent),
      banding  = serialize_banding(theme@row@banding),
      selectedEdgeWidth = theme@row@selected_edge_width,
      borderWidth       = theme@row@border_width
    ),
    cell = list(
      bg     = na_to_null(theme@cell@bg),
      fg     = na_to_null(theme@cell@fg),
      border = na_to_null(theme@cell@border),
      text   = serialize_text_role_v2(theme@cell@text)
    ),
    firstColumn = list(
      plain = serialize_first_column_variant(theme@first_column@plain),
      bold  = serialize_first_column_variant(theme@first_column@bold)
    ),

    plot = list(
      bg              = na_to_null(theme@plot@bg),
      axisLine        = theme@plot@axis_line,
      tickMark        = theme@plot@tick_mark,
      gridline        = theme@plot@gridline,
      reference       = theme@plot@reference,
      axisLabel       = serialize_text_role_v2(theme@plot@axis_label),
      tickLabel       = serialize_text_role_v2(theme@plot@tick_label),
      tickMarkLength  = theme@plot@tick_mark_length,
      lineWidth       = theme@plot@line_width,
      pointSize       = theme@plot@point_size
    ),

    marks = list(
      forest   = serialize_mark_recipe(theme@marks@forest),
      summary  = serialize_mark_recipe(theme@marks@summary),
      bar      = serialize_mark_recipe(theme@marks@bar),
      box      = serialize_mark_recipe(theme@marks@box),
      violin   = serialize_mark_recipe(theme@marks@violin),
      lollipop = serialize_mark_recipe(theme@marks@lollipop)
    )
  )
}
