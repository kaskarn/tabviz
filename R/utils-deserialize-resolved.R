# Theme V8-bridge helpers.
#
# Two symmetric directions:
#   * webtheme_to_resolve_draft() — WebTheme S7 → ResolveDraft list
#     (the input shape TS resolveTheme expects). Inputs + variants +
#     sibling config blocks (axis/layout/borders) + per-cluster
#     overrides extracted from any non-NA T2/T3 fields the author
#     pinned at construction time.
#   * deserialize_resolved_theme() — resolved JSON list → WebTheme S7
#     (the inverse of `serialize_theme()` in utils-serialize-resolved.R).
#     Used to reconstruct the S7 surface after TS returns the cascade.
#
# Together they let resolve_theme() delegate the full cascade to TS
# while keeping `theme@row@base@bg` access intact R-side.

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

#' Deserialize a resolved theme JSON list (from TS resolveTheme via V8)
#' back into an S7 WebTheme.
#'
#' Inverse of `serialize_theme()`. Used by `resolve_theme()` after the V8
#' delegation. Field names: camelCase on the wire (TS), snake_case in S7
#' (R). JSON `null` maps to the appropriate NA scalar per property type.
#'
#' @param x A nested list produced by `ts_call("resolveTheme", draft)`.
#' @return A fully-resolved `WebTheme`.
#' @noRd
deserialize_resolved_theme <- function(x) {
  # ---- Tier 1: inputs ----
  inp <- x$inputs %||% list()
  inputs <- ThemeInputs(
    neutral         = .coerce_chr_vec(inp$neutral),
    primary         = .coerce_chr(inp$primary),
    primary_deep    = .coerce_chr(inp$primaryDeep),
    secondary       = .coerce_chr(inp$secondary),
    secondary_deep  = .coerce_chr(inp$secondaryDeep),
    accent          = .coerce_chr(inp$accent),
    accent_deep     = .coerce_chr(inp$accentDeep),
    status_positive = .coerce_chr(inp$statusPositive),
    status_negative = .coerce_chr(inp$statusNegative),
    status_warning  = .coerce_chr(inp$statusWarning),
    status_info     = .coerce_chr(inp$statusInfo),
    series_anchors  = .coerce_chr_vec(inp$seriesAnchors),
    font_body       = .coerce_chr(inp$fontBody),
    font_display    = .coerce_chr(inp$fontDisplay),
    font_mono       = .coerce_chr(inp$fontMono),
    slot_style      = if (is.null(inp$slotStyle)) "fill_with_darker_stroke" else as.character(inp$slotStyle)
  )

  # ---- Variants ----
  v <- x$variants %||% list()
  variants <- ThemeVariants(
    density            = if (is.null(v$density))          "comfortable" else as.character(v$density),
    header_style       = if (is.null(v$headerStyle))      "light"       else as.character(v$headerStyle),
    first_column_style = if (is.null(v$firstColumnStyle)) "default"     else as.character(v$firstColumnStyle)
  )

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
    banding             = .coerce_banding(r$banding),
    selected_edge_width = if (is.null(r$selectedEdgeWidth)) 2 else as.numeric(r$selectedEdgeWidth),
    border_width        = if (is.null(r$borderWidth)) 1 else as.numeric(r$borderWidth)
  )

  # Sprint 1 PR 5: paint tokens live at theme.tokens.row.*. Legacy
  # wire blobs may still carry them at theme.row.{token}; fall back
  # for one minor version so older snapshots keep deserializing.
  tk <- x$tokens %||% list()
  tk_row <- tk$row %||% list()
  tokens <- ThemeTokens(
    row = RowTokens(
      emphasis = deserialize_row_semantic(tk_row$emphasis %||% r$emphasis),
      muted    = deserialize_row_semantic(tk_row$muted    %||% r$muted),
      accent   = deserialize_row_semantic(tk_row$accent   %||% r$accent),
      bold     = deserialize_row_semantic(tk_row$bold     %||% r$bold),
      fill     = deserialize_row_semantic(tk_row$fill     %||% r$fill)
    )
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
    variants        = variants,
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
    tokens          = tokens,
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


# ---------------------------------------------------------------------
# WebTheme S7 → ResolveDraft list (TS-side input shape).
# ---------------------------------------------------------------------
#
# We extract only fields the user pinned (non-NA). The TS cascade fills
# everything else via fillNull. That keeps the wire small and lets TS
# own all derivation.

# Drop NULL entries from a list — overrides.* in TS use Partial<X> so
# missing keys are correct, but jsonlite would emit `null` for explicit
# NULL values, which fillNull treats as "use derived." Same outcome,
# but cleaner wire. We drop them to keep the JSON compact.
.compact <- function(lst) lst[!vapply(lst, is.null, logical(1))]

# If a value is NA, return NULL (so it's dropped by .compact); otherwise
# return the value coerced to the expected JSON type.
.opt_chr <- function(v) if (length(v) != 1L || is.na(v)) NULL else as.character(v)
.opt_num <- function(v) if (length(v) != 1L || is.na(v)) NULL else as.numeric(v)
.opt_lgl <- function(v) if (length(v) != 1L || is.na(v)) NULL else as.logical(v)

# Whole-list helpers per cluster. Each builds a Partial<X> with only
# the fields the user pinned.

.draft_inputs <- function(inp) {
  out <- list(
    primary         = as.character(inp@primary),  # always required
    primaryDeep     = .opt_chr(inp@primary_deep),
    secondary       = .opt_chr(inp@secondary),
    secondaryDeep   = .opt_chr(inp@secondary_deep),
    accent          = as.character(inp@accent),
    accentDeep      = .opt_chr(inp@accent_deep),
    statusPositive  = .opt_chr(inp@status_positive),
    statusNegative  = .opt_chr(inp@status_negative),
    statusWarning   = .opt_chr(inp@status_warning),
    statusInfo      = .opt_chr(inp@status_info),
    fontBody        = .opt_chr(inp@font_body),
    fontDisplay     = .opt_chr(inp@font_display),
    fontMono        = .opt_chr(inp@font_mono),
    slotStyle       = .opt_chr(inp@slot_style)
  )
  # Required arrays: always send (TS fillNull won't write into them if
  # present). I() so jsonlite emits a JSON array, not unboxed scalar.
  out$neutral       <- I(as.character(inp@neutral))
  out$seriesAnchors <- I(as.character(inp@series_anchors))
  .compact(out)
}

.draft_variants <- function(v) {
  .compact(list(
    density          = .opt_chr(v@density),
    headerStyle      = .opt_chr(v@header_style),
    firstColumnStyle = .opt_chr(v@first_column_style)
  ))
}

.draft_axis <- function(ax) {
  out <- list(
    rangeMin      = .opt_num(ax@range_min),
    rangeMax      = .opt_num(ax@range_max),
    tickCount     = .opt_num(ax@tick_count),
    tickValues    = if (is.null(ax@tick_values)) NULL else I(as.numeric(ax@tick_values)),
    gridlines     = .opt_lgl(ax@gridlines),
    gridlineStyle = .opt_chr(ax@gridline_style),
    ciClipFactor  = .opt_num(ax@ci_clip_factor),
    includeNull   = .opt_lgl(ax@include_null),
    symmetric     = ax@symmetric,           # any
    nullTick      = .opt_lgl(ax@null_tick),
    markerMargin  = .opt_lgl(ax@marker_margin)
  )
  .compact(out)
}

.draft_layout <- function(ly) {
  out <- list(
    plotWidth             = ly@plot_width,           # "auto" | numeric
    containerBorder       = .opt_lgl(ly@container_border),
    containerBorderRadius = .opt_num(ly@container_border_radius)
  )
  .compact(out)
}

.draft_border_spec <- function(b) {
  .compact(list(
    thickness = .opt_num(b@thickness),
    style     = .opt_chr(b@style),
    color     = .opt_chr(b@color)
  ))
}

.draft_borders <- function(bd) {
  out <- list(
    layout = .opt_chr(bd@layout),
    major  = .draft_border_spec(bd@major),
    minor  = .draft_border_spec(bd@minor),
    table  = .draft_border_spec(bd@table)
  )
  out$major <- if (length(out$major) > 0) out$major else NULL
  out$minor <- if (length(out$minor) > 0) out$minor else NULL
  out$table <- if (length(out$table) > 0) out$table else NULL
  .compact(out)
}

# Override extractors: each returns a Partial<X> with only non-NA fields.

.ov_surface <- function(s) .compact(list(
  base = .opt_chr(s@base), muted = .opt_chr(s@muted), raised = .opt_chr(s@raised)
))
.ov_content <- function(c) .compact(list(
  primary = .opt_chr(c@primary), secondary = .opt_chr(c@secondary),
  muted = .opt_chr(c@muted), inverse = .opt_chr(c@inverse)
))
.ov_divider <- function(d) .compact(list(
  subtle = .opt_chr(d@subtle), strong = .opt_chr(d@strong)
))
.ov_accent <- function(a) .compact(list(
  default = .opt_chr(a@default), muted = .opt_chr(a@muted),
  tintSubtle = .opt_chr(a@tint_subtle), tintMedium = .opt_chr(a@tint_medium)
))
.ov_status <- function(st) .compact(list(
  positive = .opt_chr(st@positive), negative = .opt_chr(st@negative),
  warning = .opt_chr(st@warning), info = .opt_chr(st@info)
))
.ov_semantic <- function(sm) .compact(list(fill = .opt_chr(sm@fill)))

.ov_text_role <- function(tr) .compact(list(
  family = .opt_chr(tr@family), size = .opt_chr(tr@size),
  weight = .opt_num(tr@weight), figures = .opt_chr(tr@figures),
  fg = .opt_chr(tr@fg), italic = .opt_lgl(tr@italic)
))

.ov_text_roles <- function(t) {
  out <- list(
    title    = .ov_text_role(t@title),
    subtitle = .ov_text_role(t@subtitle),
    body     = .ov_text_role(t@body),
    cell     = .ov_text_role(t@cell),
    label    = .ov_text_role(t@label),
    tick     = .ov_text_role(t@tick),
    footnote = .ov_text_role(t@footnote),
    caption  = .ov_text_role(t@caption),
    numeric  = .ov_text_role(t@numeric)
  )
  # Drop empty role objects.
  out <- out[vapply(out, function(x) length(x) > 0, logical(1))]
  out
}

.ov_spacing <- function(sp) .compact(list(
  rowHeight = .opt_num(sp@row_height),
  headerHeight = .opt_num(sp@header_height),
  padding = .opt_num(sp@padding),
  containerPadding = .opt_num(sp@container_padding),
  axisGap = .opt_num(sp@axis_gap),
  columnGroupPadding = .opt_num(sp@column_group_padding),
  rowGroupPadding = .opt_num(sp@row_group_padding),
  cellPaddingX = .opt_num(sp@cell_padding_x),
  footerGap = .opt_num(sp@footer_gap),
  titleSubtitleGap = .opt_num(sp@title_subtitle_gap),
  headerGap = .opt_num(sp@header_gap),
  bottomMargin = .opt_num(sp@bottom_margin),
  indentPerLevel = .opt_num(sp@indent_per_level)
))

.ov_annotation <- function(an) {
  out <- list(
    title    = .ov_text_role(an@title),
    subtitle = .ov_text_role(an@subtitle),
    caption  = .ov_text_role(an@caption),
    footnote = .ov_text_role(an@footnote)
  )
  out[vapply(out, function(x) length(x) > 0, logical(1))]
}

.ov_header_variant <- function(hv) .compact(list(
  bg = .opt_chr(hv@bg), fg = .opt_chr(hv@fg), rule = .opt_chr(hv@rule)
))

.ov_header_cluster <- function(h) {
  out <- list(
    light = .ov_header_variant(h@light),
    tint  = .ov_header_variant(h@tint),
    bold  = .ov_header_variant(h@bold),
    text  = .ov_text_role(h@text)
  )
  out[vapply(out, function(x) length(x) > 0, logical(1))]
}

.ov_row_group_tier <- function(t) {
  out <- list(
    bg = .opt_chr(t@bg), fg = .opt_chr(t@fg), rule = .opt_chr(t@rule),
    text = .ov_text_role(t@text),
    borderBottom = .opt_lgl(t@border_bottom)
  )
  out[vapply(out, function(x) length(x) > 0, logical(1))]
}

.ov_row_group <- function(rg) {
  out <- list(
    L1 = .ov_row_group_tier(rg@L1),
    L2 = .ov_row_group_tier(rg@L2),
    L3 = .ov_row_group_tier(rg@L3),
    indentPerLevel = .opt_num(rg@indent_per_level)
  )
  out <- out[vapply(out, function(x) length(x) > 0, logical(1))]
  out
}

.ov_row_state <- function(rs) .compact(list(
  bg = .opt_chr(rs@bg), fg = .opt_chr(rs@fg)
))

.ov_row_semantic <- function(rs) .compact(list(
  bg = .opt_chr(rs@bg), fg = .opt_chr(rs@fg), border = .opt_chr(rs@border),
  markerFill = .opt_chr(rs@marker_fill), markerStroke = .opt_chr(rs@marker_stroke),
  fontWeight = .opt_num(rs@font_weight), fontStyle = .opt_chr(rs@font_style)
))

.ov_row <- function(r) {
  out <- list(
    base = .ov_row_state(r@base),
    alt = .ov_row_state(r@alt),
    hover = .ov_row_state(r@hover),
    selected = .ov_row_state(r@selected),
    banding = if (identical(r@banding, "group")) NULL else r@banding,
    selectedEdgeWidth = if (identical(r@selected_edge_width, 2)) NULL else r@selected_edge_width,
    borderWidth = if (identical(r@border_width, 1)) NULL else r@border_width
  )
  out <- out[vapply(out, function(x) length(x) > 0, logical(1))]
  out
}

.ov_tokens <- function(tk) {
  # tk: ThemeTokens
  row_out <- list(
    emphasis = .ov_row_semantic(tk@row@emphasis),
    muted    = .ov_row_semantic(tk@row@muted),
    accent   = .ov_row_semantic(tk@row@accent),
    bold     = .ov_row_semantic(tk@row@bold),
    fill     = .ov_row_semantic(tk@row@fill)
  )
  row_out <- row_out[vapply(row_out, function(x) length(x) > 0, logical(1))]
  if (length(row_out) == 0) return(NULL)
  list(row = row_out)
}

.ov_cell <- function(c) {
  out <- list(
    bg = .opt_chr(c@bg), fg = .opt_chr(c@fg), border = .opt_chr(c@border),
    text = .ov_text_role(c@text)
  )
  out[vapply(out, function(x) length(x) > 0, logical(1))]
}

.ov_first_column_variant <- function(v) .compact(list(
  bg = .opt_chr(v@bg), fg = .opt_chr(v@fg),
  rule = .opt_chr(v@rule), weight = .opt_num(v@weight)
))

.ov_first_column <- function(fc) {
  out <- list(
    default = .ov_first_column_variant(fc@default),
    bold    = .ov_first_column_variant(fc@bold)
  )
  out[vapply(out, function(x) length(x) > 0, logical(1))]
}

.ov_plot <- function(p) {
  out <- list(
    bg = .opt_chr(p@bg),
    axisLine = .opt_chr(p@axis_line),
    tickMark = .opt_chr(p@tick_mark),
    gridline = .opt_chr(p@gridline),
    reference = .opt_chr(p@reference),
    axisLabel = .ov_text_role(p@axis_label),
    tickLabel = .ov_text_role(p@tick_label),
    tickMarkLength = if (identical(p@tick_mark_length, 4))   NULL else p@tick_mark_length,
    lineWidth      = if (identical(p@line_width, 1.5))       NULL else p@line_width,
    pointSize      = if (identical(p@point_size, 6))         NULL else p@point_size
  )
  out[vapply(out, function(x) length(x) > 0, logical(1))]
}

.ov_series <- function(series_list) {
  if (length(series_list) == 0L) return(NULL)
  # Each entry is a SlotRole; ship Partial<SlotRoleV2> with only
  # non-NA fields.
  lapply(series_list, function(s) {
    .compact(list(
      fill       = .opt_chr(s@fill),
      stroke     = .opt_chr(s@stroke),
      fillDim    = .opt_chr(s@fill_dim),
      strokeDim  = .opt_chr(s@stroke_dim),
      fillHot    = .opt_chr(s@fill_hot),
      strokeHot  = .opt_chr(s@stroke_hot),
      textFg     = .opt_chr(s@text_fg),
      shape      = .opt_chr(s@shape)
    ))
  })
}

#' Convert a WebTheme S7 object into a ResolveDraft list (TS-side input).
#'
#' Extracts only user-pinned (non-NA) fields. The TS cascade fills
#' everything else via fillNull.
#'
#' @param theme A [WebTheme].
#' @return A nested list ready to pass as `args` to
#'   `ts_call("resolveTheme", args)`.
#' @noRd
webtheme_to_resolve_draft <- function(theme) {
  overrides <- list(
    surface    = .ov_surface(theme@surface),
    content    = .ov_content(theme@content),
    divider    = .ov_divider(theme@divider),
    accent     = .ov_accent(theme@accent),
    status     = .ov_status(theme@status),
    semantic   = .ov_semantic(theme@semantic),
    series     = .ov_series(theme@series),
    text       = .ov_text_roles(theme@text),
    spacing    = .ov_spacing(theme@spacing),
    annotation = .ov_annotation(theme@annotation),
    header     = .ov_header_cluster(theme@header),
    columnGroup = .ov_header_cluster(theme@column_group),
    rowGroup   = .ov_row_group(theme@row_group),
    row        = .ov_row(theme@row),
    tokens     = .ov_tokens(theme@tokens),
    cell       = .ov_cell(theme@cell),
    firstColumn = .ov_first_column(theme@first_column),
    plot       = .ov_plot(theme@plot),
    marks      = NULL  # presets don't override marks recipes
  )
  overrides <- overrides[vapply(overrides, function(x) length(x) > 0, logical(1))]

  webfonts <- if (length(theme@web_fonts) == 0L) NULL else theme@web_fonts

  draft <- list(
    name           = as.character(theme@name),
    inputs         = .draft_inputs(theme@inputs),
    variants       = .draft_variants(theme@variants),
    webFonts       = webfonts,
    lightDarkPair  = .opt_chr(theme@light_dark_pair),
    axis           = .draft_axis(theme@axis),
    layout         = .draft_layout(theme@layout),
    borders        = .draft_borders(theme@borders),
    overrides      = if (length(overrides) > 0) overrides else NULL
  )
  .compact(draft)
}
