# Theme V8-bridge deserialization helpers.
#
# `deserialize_resolved_theme()` — resolved JSON list → WebTheme S7.
# The inverse of `serialize_theme()` (R/utils-serialize-resolved.R). Used by
# `resolve_from_inputs()` (R/themes-api.R) to reconstruct the S7 surface after
# the TS cascade (`ts_call("buildTheme", inputs_json)`) returns the resolved
# tiers, so `theme@row@base@bg` access stays intact R-side.

# NULL/missing -> NA character scalar.
.coerce_chr <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NA_character_)
  if (is.na(x)) return(NA_character_)
  as.character(x)
}

# NULL/missing -> NA numeric scalar.
.coerce_num <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NA_real_)
  if (is.na(x)) return(NA_real_)
  as.numeric(x)
}

# NULL/missing -> NA logical scalar.
.coerce_lgl <- function(x) {
  if (is.null(x) || length(x) == 0L) return(NA)
  if (is.na(x)) return(NA)
  as.logical(x)
}

deserialize_text_role <- function(x) {
  if (is.null(x)) return(TextRole())
  TextRole(
    family  = .coerce_chr(x$family),
    size    = .coerce_chr(x$size),
    weight  = .coerce_num(x$weight),
    figures = .coerce_chr(x$figures),
    fg      = .coerce_chr(x$fg),
    italic  = .coerce_lgl(x$italic)
  )
}

deserialize_slot_role <- function(x) {
  if (is.null(x)) return(SlotRole())
  # Accept both new (fillDim/...) and legacy (fillMuted/...) wire shapes
  # for one minor version after the Sprint 1 PR 2 rename.
  SlotRole(
    fill       = .coerce_chr(x$fill),
    stroke     = .coerce_chr(x$stroke),
    fill_dim   = .coerce_chr(x$fillDim   %||% x$fillMuted),
    stroke_dim = .coerce_chr(x$strokeDim %||% x$strokeMuted),
    fill_hot   = .coerce_chr(x$fillHot   %||% x$fillEmphasis),
    stroke_hot = .coerce_chr(x$strokeHot %||% x$strokeEmphasis),
    text_fg    = .coerce_chr(x$textFg),
    shape      = .coerce_chr(x$shape)
  )
}
# Deprecated alias.
deserialize_slot_bundle <- deserialize_slot_role

deserialize_row_state <- function(x) {
  if (is.null(x)) return(RowState())
  RowState(bg = .coerce_chr(x$bg), fg = .coerce_chr(x$fg))
}

deserialize_row_semantic <- function(x) {
  if (is.null(x)) return(RowSemantic())
  RowSemantic(
    bg            = .coerce_chr(x$bg),
    fg            = .coerce_chr(x$fg),
    border        = .coerce_chr(x$border),
    marker_fill   = .coerce_chr(x$markerFill),
    marker_stroke = .coerce_chr(x$markerStroke),
    font_weight   = .coerce_num(x$fontWeight),
    font_style    = .coerce_chr(x$fontStyle)
  )
}

deserialize_header_variant <- function(x) {
  if (is.null(x)) return(HeaderVariant())
  HeaderVariant(
    bg   = .coerce_chr(x$bg),
    fg   = .coerce_chr(x$fg),
    rule = .coerce_chr(x$rule)
  )
}

deserialize_first_column_variant <- function(x) {
  if (is.null(x)) return(FirstColumnVariant())
  FirstColumnVariant(
    bg     = .coerce_chr(x$bg),
    fg     = .coerce_chr(x$fg),
    rule   = .coerce_chr(x$rule),
    weight = .coerce_num(x$weight)
  )
}

deserialize_row_group_tier <- function(x) {
  if (is.null(x)) return(RowGroupTier())
  RowGroupTier(
    bg            = .coerce_chr(x$bg),
    fg            = .coerce_chr(x$fg),
    rule          = .coerce_chr(x$rule),
    text          = deserialize_text_role(x$text),
    border_bottom = if (is.null(x$borderBottom)) FALSE else as.logical(x$borderBottom)
  )
}

# Inverse of serialize_banding: {mode, level} -> "none" | "row" | "group"
# | "group-<n>". Accepts the wire shape (list with mode+level) or the
# string shape (in case TS ever returns the string directly).
.coerce_banding <- function(x) {
  if (is.null(x)) return("group")
  if (is.character(x) && length(x) == 1L) return(x)
  if (is.list(x) && !is.null(x$mode)) {
    mode <- as.character(x$mode)
    level <- x$level
    if (is.null(level) || length(level) == 0L || is.na(level)) return(mode)
    return(paste0(mode, "-", as.integer(level)))
  }
  "group"
}

deserialize_border_spec <- function(x) {
  if (is.null(x)) return(BorderSpec())
  BorderSpec(
    thickness = if (is.null(x$thickness)) 1 else as.numeric(x$thickness),
    style     = if (is.null(x$style))     "single" else as.character(x$style),
    color     = .coerce_chr(x$color)
  )
}

#' Deserialize a resolved theme JSON list (from TS `buildTheme` via V8)
#' back into an S7 WebTheme.
#'
#' Inverse of `serialize_theme()`. Used by `resolve_from_inputs()` after the V8
#' delegation. Field names: camelCase on the wire (TS), snake_case in S7
#' (R). JSON `null` maps to the appropriate NA scalar per property type.
#'
#' @param x A nested list produced by `ts_call("buildTheme", inputs_json)`.
#' @return A fully-resolved `WebTheme`.
#' @noRd
deserialize_resolved_theme <- function(x) {
  # Resolver returns a resolved-theme blob (renderer reads resolved paths). The new
  # ThemeInputs S7 holds authoring inputs only; we stub it here. Callers (web_theme,
  # set_*) set theme@inputs to the actual ThemeInputs after deserialize.
  inputs <- ThemeInputs()
  # Tier-2 role pins (wire `roleOverrides`) — preserved verbatim so the
  # artifact round-trips R -> TS -> R without dropping spine rebinds.
  role_overrides <- x$roleOverrides %||% list()
  pins <- x$pins %||% list()
  components <- x[["components"]] %||% list()

  # ---- Tier 2: chrome roles ----
  # V4: surface/content/divider chrome dropped from the R S7 class.
  # Callers read those values via `theme_css_vars(theme)`.
  a <- x$accent %||% list()
  accent <- AccentRoles(
    default     = .coerce_chr(a$default),
    muted       = .coerce_chr(a$muted),
    tint_subtle = .coerce_chr(a$tintSubtle),
    tint_medium = .coerce_chr(a$tintMedium)
  )
  st <- x$status %||% list()
  status <- StatusColors(
    positive = .coerce_chr(st$positive),
    negative = .coerce_chr(st$negative),
    warning  = .coerce_chr(st$warning),
    info     = .coerce_chr(st$info)
  )
  # ---- Tier 2: data series ----
  series_raw <- x$series %||% list()
  series <- lapply(series_raw, deserialize_slot_role)

  # ---- Tier 2: spacing ----
  sp <- x$spacing %||% list()
  spacing <- SpacingTokens(
    row_height           = .coerce_num(sp$rowHeight),
    header_height        = .coerce_num(sp$headerHeight),
    padding              = .coerce_num(sp$padding),
    container_padding    = .coerce_num(sp$containerPadding),
    axis_gap             = .coerce_num(sp$axisGap),
    column_group_padding = .coerce_num(sp$columnGroupPadding),
    row_group_padding    = .coerce_num(sp$rowGroupPadding),
    cell_padding_x       = .coerce_num(sp$cellPaddingX),
    footer_gap           = .coerce_num(sp$footerGap),
    title_subtitle_gap   = .coerce_num(sp$titleSubtitleGap),
    header_gap           = .coerce_num(sp$headerGap),
    bottom_margin        = .coerce_num(sp$bottomMargin),
    indent_per_level     = .coerce_num(sp$indentPerLevel)
  )

  # ---- Tier 3 clusters ----
  h <- x$header %||% list()
  header <- HeaderCluster(
    light = deserialize_header_variant(h$light),
    tint  = deserialize_header_variant(h$tint),
    bold  = deserialize_header_variant(h$bold),
    text  = deserialize_text_role(h$text)
  )
  rg <- x$rowGroup %||% list()
  row_group <- RowGroupCluster(
    L1 = deserialize_row_group_tier(rg$L1),
    L2 = deserialize_row_group_tier(rg$L2),
    L3 = deserialize_row_group_tier(rg$L3),
    indent_per_level = .coerce_num(rg$indentPerLevel)
  )

  r <- x$row %||% list()
  row <- RowCluster(
    base                = deserialize_row_state(r$base),
    alt                 = deserialize_row_state(r$alt),
    hover               = deserialize_row_state(r$hover),
    selected            = deserialize_row_state(r$selected),
    emphasis            = deserialize_row_semantic(r$emphasis),
    muted               = deserialize_row_semantic(r$muted),
    accent              = deserialize_row_semantic(r$accent),
    bold                = deserialize_row_semantic(r$bold),
    fill                = deserialize_row_semantic(r$fill),
    banding             = .coerce_banding(r$banding),
    selected_edge_width = if (is.null(r$selectedEdgeWidth)) 2 else as.numeric(r$selectedEdgeWidth),
    border_width        = if (is.null(r$borderWidth)) 1 else as.numeric(r$borderWidth)
  )

  fc <- x$firstColumn %||% list()
  # Accept legacy `plain` key on input for one minor version after the
  # Sprint 1 PR 3 rename.
  first_column <- FirstColumnCluster(
    default = deserialize_first_column_variant(fc$default %||% fc$plain),
    bold    = deserialize_first_column_variant(fc$bold)
  )

  p <- x$plot %||% list()
  plot <- PlotScaffold(
    bg               = .coerce_chr(p$bg),
    axis_line        = .coerce_chr(p$axisLine),
    tick_mark        = .coerce_chr(p$tickMark),
    gridline         = .coerce_chr(p$gridline),
    reference        = .coerce_chr(p$reference),
    axis_label       = deserialize_text_role(p$axisLabel),
    tick_label       = deserialize_text_role(p$tickLabel),
    tick_mark_length = if (is.null(p$tickMarkLength)) 4   else as.numeric(p$tickMarkLength),
    line_width       = if (is.null(p$lineWidth))      1.5 else as.numeric(p$lineWidth),
    point_size       = if (is.null(p$pointSize))      6   else as.numeric(p$pointSize)
  )

  # ---- Config blocks (axis, layout, borders) ----
  ax <- x$axis %||% list()
  axis <- AxisConfig(
    range_min      = .coerce_num(ax$rangeMin),
    range_max      = .coerce_num(ax$rangeMax),
    tick_count     = .coerce_num(ax$tickCount),
    tick_values    = if (is.null(ax$tickValues)) NULL else as.numeric(unlist(ax$tickValues)),
    gridlines      = if (is.null(ax$gridlines)) FALSE else as.logical(ax$gridlines),
    gridline_style = if (is.null(ax$gridlineStyle)) "dotted" else as.character(ax$gridlineStyle),
    ci_clip_factor = if (is.null(ax$ciClipFactor)) 2.0 else as.numeric(ax$ciClipFactor),
    include_null   = if (is.null(ax$includeNull)) TRUE else as.logical(ax$includeNull),
    symmetric      = if (is.null(ax$symmetric)) NULL else ax$symmetric,
    null_tick      = if (is.null(ax$nullTick)) TRUE else as.logical(ax$nullTick),
    marker_margin  = if (is.null(ax$markerMargin)) TRUE else as.logical(ax$markerMargin)
  )

  ly <- x$layout %||% list()
  layout <- Layout(
    plot_width              = if (is.null(ly$plotWidth)) "auto" else ly$plotWidth,
    container_border        = if (is.null(ly$containerBorder)) FALSE else as.logical(ly$containerBorder),
    container_border_radius = if (is.null(ly$containerBorderRadius)) 8 else as.numeric(ly$containerBorderRadius)
  )

  bd <- x$borders %||% list()
  borders <- ThemeBorders(
    layout = if (is.null(bd$layout)) "horizontal" else as.character(bd$layout),
    major  = deserialize_border_spec(bd$major),
    minor  = deserialize_border_spec(bd$minor),
    table  = deserialize_border_spec(bd$table)
  )

  # ---- web_fonts pass-through ----
  wf_raw <- x$webFonts %||% list()
  web_fonts <- if (length(wf_raw) == 0L) {
    list()
  } else {
    lapply(wf_raw, function(e) list(family = as.character(e$family), url = as.character(e$url)))
  }

  WebTheme(
    name            = if (is.null(x$name)) "custom" else as.character(x$name),
    web_fonts       = web_fonts,
    inputs          = inputs,
    role_overrides  = role_overrides,
    pins            = pins,
    components      = components,
    accent          = accent,
    status          = status,
    series          = series,
    spacing         = spacing,
    header          = header,
    row_group       = row_group,
    row             = row,
    first_column    = first_column,
    plot            = plot,
    axis            = axis,
    layout          = layout,
    borders         = borders
  )
}

# Local null-coalesce.
`%||%` <- function(x, y) if (is.null(x)) y else x

