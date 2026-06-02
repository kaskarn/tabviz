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

# Character vector (for neutral, series_anchors). NULL -> character(0).
.coerce_chr_vec <- function(x) {
  if (is.null(x) || length(x) == 0L) return(character(0))
  as.character(unlist(x))
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

deserialize_mark_recipe <- function(x) {
  if (is.null(x)) return(MarkRecipe())
  MarkRecipe(
    body    = if (is.null(x$body))    "fill"   else as.character(x$body),
    outline = if (is.null(x$outline)) "stroke" else as.character(x$outline),
    line    = if (is.null(x$line))    "stroke" else as.character(x$line)
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

  # ---- Tier 2: chrome roles ----
  s <- x$surface %||% list()
  surface <- Surfaces(
    base = .coerce_chr(s$base), muted = .coerce_chr(s$muted), raised = .coerce_chr(s$raised)
  )
  c <- x$content %||% list()
  content <- Content(
    primary   = .coerce_chr(c$primary),
    secondary = .coerce_chr(c$secondary),
    muted     = .coerce_chr(c$muted),
    inverse   = .coerce_chr(c$inverse)
  )
  d <- x$divider %||% list()
  divider <- Dividers(subtle = .coerce_chr(d$subtle), strong = .coerce_chr(d$strong))
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
  sm <- x$semantic %||% list()
  semantic <- Semantics(fill = .coerce_chr(sm$fill))

  # ---- Tier 2: data series ----
  series_raw <- x$series %||% list()
  series <- lapply(series_raw, deserialize_slot_role)

  # ---- Tier 2: text roles ----
  t <- x$text %||% list()
  text <- TextRoles(
    title    = deserialize_text_role(t$title),
    subtitle = deserialize_text_role(t$subtitle),
    body     = deserialize_text_role(t$body),
    cell     = deserialize_text_role(t$cell),
    label    = deserialize_text_role(t$label),
    tick     = deserialize_text_role(t$tick),
    footnote = deserialize_text_role(t$footnote),
    caption  = deserialize_text_role(t$caption),
    numeric  = deserialize_text_role(t$numeric)
  )

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
  an <- x$annotation %||% list()
  annotation <- AnnotationCluster(
    title    = deserialize_text_role(an$title),
    subtitle = deserialize_text_role(an$subtitle),
    caption  = deserialize_text_role(an$caption),
    footnote = deserialize_text_role(an$footnote)
  )

  h <- x$header %||% list()
  header <- HeaderCluster(
    light = deserialize_header_variant(h$light),
    tint  = deserialize_header_variant(h$tint),
    bold  = deserialize_header_variant(h$bold),
    text  = deserialize_text_role(h$text)
  )
  cg <- x$columnGroup %||% list()
  column_group <- ColumnGroupCluster(
    light = deserialize_header_variant(cg$light),
    tint  = deserialize_header_variant(cg$tint),
    bold  = deserialize_header_variant(cg$bold),
    text  = deserialize_text_role(cg$text)
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

  ce <- x$cell %||% list()
  cell <- CellCluster(
    bg     = .coerce_chr(ce$bg),
    fg     = .coerce_chr(ce$fg),
    border = .coerce_chr(ce$border),
    text   = deserialize_text_role(ce$text)
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

  m <- x$marks %||% list()
  marks <- MarksRecipes(
    forest   = deserialize_mark_recipe(m$forest),
    summary  = deserialize_mark_recipe(m$summary),
    bar      = deserialize_mark_recipe(m$bar),
    box      = deserialize_mark_recipe(m$box),
    violin   = deserialize_mark_recipe(m$violin),
    lollipop = deserialize_mark_recipe(m$lollipop)
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
    light_dark_pair = .coerce_chr(x$lightDarkPair),
    inputs          = inputs,
    surface         = surface,
    content         = content,
    divider         = divider,
    accent          = accent,
    status          = status,
    semantic        = semantic,
    series          = series,
    text            = text,
    spacing         = spacing,
    annotation      = annotation,
    header          = header,
    column_group    = column_group,
    row_group       = row_group,
    row             = row,
    cell            = cell,
    first_column    = first_column,
    plot            = plot,
    marks           = marks,
    axis            = axis,
    layout          = layout,
    borders         = borders
  )
}

# Local null-coalesce.
`%||%` <- function(x, y) if (is.null(x)) y else x

