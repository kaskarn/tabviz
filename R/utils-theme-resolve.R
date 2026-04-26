# Theme resolution pipeline.
#
# resolve_theme(theme) takes a WebTheme with NA-default Tier 2 / Tier 3
# fields and returns a WebTheme with all those fields populated from the
# Tier 1 inputs and chosen variants. Only NA fields are written, so
# user-set overrides survive re-resolution. The function is idempotent.
#
# Hard rule: chrome derivation reads only chrome inputs (neutrals,
# brand_deep, accent, accent_deep). Data derivation reads only data inputs
# (series_anchors, summary_anchor, status_*) plus surface.base for muted
# blends. The two cascades meet only at WebTheme reassembly.

# Density presets: each entry maps every SpacingTokens field to a numeric.
DENSITY_PRESETS <- list(
  compact = list(
    row_height = 20, header_height = 26, padding = 8, container_padding = 0,
    axis_gap = 8, column_group_padding = 6, row_group_padding = 0,
    cell_padding_x = 8, footer_gap = 6, title_subtitle_gap = 10,
    bottom_margin = 12, indent_per_level = 14
  ),
  comfortable = list(
    row_height = 24, header_height = 32, padding = 12, container_padding = 0,
    axis_gap = 12, column_group_padding = 8, row_group_padding = 0,
    cell_padding_x = 10, footer_gap = 8, title_subtitle_gap = 13,
    bottom_margin = 16, indent_per_level = 16
  ),
  spacious = list(
    row_height = 30, header_height = 40, padding = 16, container_padding = 0,
    axis_gap = 16, column_group_padding = 12, row_group_padding = 0,
    cell_padding_x = 14, footer_gap = 12, title_subtitle_gap = 18,
    bottom_margin = 22, indent_per_level = 20
  )
)


# Generic helper: fill NA-valued properties of an S7 object from a named
# list of defaults. `is.na` works for character, numeric, and logical NA.
fill_na <- function(obj, defaults) {
  for (p in names(defaults)) {
    current <- S7::prop(obj, p)
    if (length(current) == 1L && is.na(current)) {
      S7::prop(obj, p) <- defaults[[p]]
    }
  }
  obj
}


# Mirror Tier 1 NA fields to their primary inputs.
resolve_inputs_mirrors <- function(inputs) {
  if (is.na(inputs@brand_deep))    inputs@brand_deep    <- inputs@brand
  if (is.na(inputs@accent_deep))   inputs@accent_deep   <- inputs@accent
  if (is.na(inputs@summary_anchor)) inputs@summary_anchor <- inputs@brand
  if (is.na(inputs@font_display))  inputs@font_display  <- inputs@font_body
  if (is.na(inputs@status_info))   inputs@status_info   <- inputs@accent
  inputs
}


# resolve_chrome: ThemeInputs -> list of T2 chrome objects.
# Reads only chrome inputs (neutrals + accent). Does NOT read series_anchors.
resolve_chrome <- function(inputs) {
  n <- inputs@neutral

  surface <- Surfaces(
    base   = n[2],
    muted  = n[3],
    raised = n[1]
  )

  content <- Content(
    primary   = n[5],
    secondary = n[4],
    muted     = oklch_lighten(n[4], 0.10),
    inverse   = n[1]
  )

  divider <- Dividers(
    subtle = n[3],
    strong = n[4]
  )

  accent <- AccentRoles(
    default     = inputs@accent,
    muted       = oklch_mix(inputs@accent, surface@base, 0.88),
    tint_subtle = oklch_mix(inputs@accent, surface@base, 0.90),
    tint_medium = oklch_mix(inputs@accent, surface@base, 0.75)
  )

  list(surface = surface, content = content, divider = divider, accent = accent)
}


# resolve_data: per-anchor SlotBundle derivation.
# Reads series_anchors + summary_anchor + status_*. Reads surface_base for
# muted blends but does not write to any chrome token.
derive_slot_bundle <- function(anchor, surface_base, content_primary) {
  fill_muted <- oklch_mix(anchor, surface_base, 0.65)
  SlotBundle(
    fill            = anchor,
    stroke          = oklch_darken(anchor, 0.10),
    fill_muted      = fill_muted,
    stroke_muted    = oklch_darken(fill_muted, 0.10),
    fill_emphasis   = oklch_chroma(oklch_darken(anchor, 0.05), 0.04),
    stroke_emphasis = oklch_darken(anchor, 0.20),
    text_fg         = content_primary
  )
}

# Fill NA fields of an existing SlotBundle from a freshly-derived one,
# preserving any explicit user override.
fill_slot_bundle <- function(existing, derived) {
  for (p in S7::prop_names(existing)) {
    if (is.na(S7::prop(existing, p))) {
      S7::prop(existing, p) <- S7::prop(derived, p)
    }
  }
  existing
}

resolve_data <- function(inputs, surface_base, content_primary, existing_series, existing_summary) {
  anchors <- inputs@series_anchors
  series <- vector("list", length(anchors))
  for (i in seq_along(anchors)) {
    derived <- derive_slot_bundle(anchors[i], surface_base, content_primary)
    existing <- if (i <= length(existing_series)) existing_series[[i]] else SlotBundle()
    series[[i]] <- fill_slot_bundle(existing, derived)
  }

  summary <- fill_slot_bundle(
    existing_summary,
    derive_slot_bundle(inputs@summary_anchor, surface_base, content_primary)
  )

  status <- StatusColors(
    positive = inputs@status_positive,
    negative = inputs@status_negative,
    warning  = inputs@status_warning,
    info     = inputs@status_info
  )

  list(series = series, summary = summary, status = status)
}


# resolve_text: TextRoles bundles from Tier 1 fonts + Tier 2 content.
resolve_text <- function(inputs, content) {
  body <- inputs@font_body
  display <- inputs@font_display

  fill_text <- function(role, defaults) {
    for (p in names(defaults)) {
      current <- S7::prop(role, p)
      if (length(current) == 1L && is.na(current)) {
        S7::prop(role, p) <- defaults[[p]]
      }
    }
    role
  }

  TextRoles(
    title    = TextRole(family = display, size = "1.25rem",   weight = 600, figures = "proportional", fg = content@primary,   italic = FALSE),
    subtitle = TextRole(family = body,    size = "1rem",      weight = 400, figures = "proportional", fg = content@secondary, italic = FALSE),
    body     = TextRole(family = body,    size = "0.875rem",  weight = 400, figures = "tabular",      fg = content@primary,   italic = FALSE),
    cell     = TextRole(family = body,    size = "0.875rem",  weight = 400, figures = "tabular",      fg = content@primary,   italic = FALSE),
    label    = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "tabular",      fg = content@secondary, italic = FALSE),
    tick     = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "tabular",      fg = content@muted,     italic = FALSE),
    footnote = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "proportional", fg = content@muted,     italic = FALSE),
    caption  = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "proportional", fg = content@secondary, italic = TRUE)
  )
}


# resolve_spacing: density preset + per-token override.
resolve_spacing <- function(variants, existing) {
  preset <- DENSITY_PRESETS[[variants@density]]
  fill_na(existing, preset)
}


# Compose a TextRole, preferring `over`'s non-NA fields and falling back to
# `under`. Used to inherit role typography while letting clusters override.
compose_text <- function(over, under) {
  for (p in S7::prop_names(over)) {
    cur <- S7::prop(over, p)
    if (length(cur) == 1L && is.na(cur)) {
      S7::prop(over, p) <- S7::prop(under, p)
    }
  }
  over
}

# Override TextRole fields from a named list (skipping NULL/missing).
override_text <- function(role, ...) {
  args <- list(...)
  for (p in names(args)) {
    if (!is.null(args[[p]])) S7::prop(role, p) <- args[[p]]
  }
  role
}


# resolve_components: fill all Tier 3 clusters from Tier 2.
resolve_components <- function(theme) {
  surface <- theme@surface
  content <- theme@content
  divider <- theme@divider
  accent  <- theme@accent
  text    <- theme@text
  inputs  <- theme@inputs

  # -- Annotation: cascade from text roles. --
  ann <- theme@annotation
  ann@title    <- compose_text(ann@title,    text@title)
  ann@subtitle <- compose_text(ann@subtitle, text@subtitle)
  ann@caption  <- compose_text(ann@caption,  text@caption)
  ann@footnote <- compose_text(ann@footnote, text@footnote)
  theme@annotation <- ann

  # -- Header: light + bold variants. --
  hdr <- theme@header
  hdr@light <- fill_na(hdr@light, list(
    bg   = surface@muted,
    fg   = content@primary,
    rule = divider@strong
  ))
  hdr@bold <- fill_na(hdr@bold, list(
    bg   = inputs@brand_deep,
    fg   = content@inverse,
    rule = inputs@brand_deep
  ))
  hdr@text <- compose_text(
    hdr@text,
    override_text(text@body, weight = 600)
  )
  theme@header <- hdr

  # Column-group header tracks the same variants as the leaf header.
  cg <- theme@column_group
  cg@light <- fill_na(cg@light, list(
    bg   = surface@muted,
    fg   = content@primary,
    rule = divider@strong
  ))
  cg@bold <- fill_na(cg@bold, list(
    bg   = inputs@brand_deep,
    fg   = content@inverse,
    rule = inputs@brand_deep
  ))
  cg@text <- compose_text(
    cg@text,
    override_text(text@body, weight = 500)
  )
  theme@column_group <- cg

  # -- Row groups: L1 strongest, L3 lightest. --
  rg <- theme@row_group
  rg@L1 <- fill_na(rg@L1, list(
    bg   = accent@tint_subtle,
    fg   = content@primary,
    rule = divider@strong
  ))
  rg@L1@text <- compose_text(rg@L1@text, override_text(text@body, weight = 600))

  rg@L2 <- fill_na(rg@L2, list(
    fg   = content@secondary,
    rule = divider@subtle
  ))
  rg@L2@text <- compose_text(rg@L2@text, override_text(text@body, weight = 500))

  rg@L3 <- fill_na(rg@L3, list(
    fg = content@secondary
  ))
  rg@L3@text <- compose_text(rg@L3@text, text@body)

  if (is.na(rg@indent_per_level)) {
    rg@indent_per_level <- theme@spacing@indent_per_level
  }
  theme@row_group <- rg

  # -- Rows: states + semantic bundles. --
  rc <- theme@row
  rc@base     <- fill_na(rc@base,     list(bg = surface@base,  fg = content@primary))
  rc@alt      <- fill_na(rc@alt,      list(bg = surface@muted, fg = content@primary))
  rc@hover    <- fill_na(rc@hover,    list(bg = accent@muted,  fg = content@primary))
  rc@selected <- fill_na(rc@selected, list(bg = accent@muted,  fg = content@primary))

  rc@emphasis <- fill_na(rc@emphasis, list(
    fg = content@primary, marker_fill = content@primary, font_weight = 600
  ))
  rc@muted <- fill_na(rc@muted, list(
    fg = content@muted, marker_fill = content@muted
  ))
  rc@accent <- fill_na(rc@accent, list(
    fg = accent@default, marker_fill = accent@default
  ))
  theme@row <- rc

  # -- Cells. --
  cell <- theme@cell
  cell <- fill_na(cell, list(
    fg     = content@primary,
    border = divider@subtle
  ))
  cell@text <- compose_text(cell@text, text@cell)
  theme@cell <- cell

  # -- First column: plain inherits cell defaults; bold emphasizes. --
  fc <- theme@first_column
  fc@plain <- fill_na(fc@plain, list())  # all NA; inherits at render time
  fc@bold  <- fill_na(fc@bold, list(
    bg     = surface@muted,
    fg     = content@primary,
    rule   = divider@subtle,
    weight = 600
  ))
  theme@first_column <- fc

  # -- Plot scaffolding. --
  ps <- theme@plot
  ps <- fill_na(ps, list(
    axis_line = divider@strong,
    tick_mark = divider@strong,
    gridline  = divider@subtle,
    reference = divider@strong
  ))
  ps@axis_label <- compose_text(ps@axis_label, text@label)
  ps@tick_label <- compose_text(ps@tick_label, text@tick)
  theme@plot <- ps

  theme
}


#' Resolve a theme: fill all NA-default Tier 2 / Tier 3 fields.
#'
#' Idempotent and deterministic. Only writes into NA-valued fields, so
#' user-set overrides survive re-resolution. Runs all derivations in OKLCH
#' (perceptually uniform) and clips to sRGB at every step.
#'
#' Resolution order: mirror Tier 1 NAs, derive Tier 2 chrome (surface,
#' content, divider, accent), derive Tier 2 data (series slot bundles,
#' summary, status), derive text roles, derive spacing from density preset,
#' fill Tier 3 component clusters from the resolved Tier 2 tokens.
#'
#' @param theme A [WebTheme] object.
#' @return A [WebTheme] object with NA fields populated.
#' @export
resolve_theme <- function(theme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }

  # Step 1: Tier 1 mirrors.
  theme@inputs <- resolve_inputs_mirrors(theme@inputs)

  # Step 2: spacing from density.
  theme@spacing <- resolve_spacing(theme@variants, theme@spacing)

  # Step 3: chrome cascade.
  chrome <- resolve_chrome(theme@inputs)
  theme@surface <- fill_na(theme@surface, list(
    base = chrome$surface@base, muted = chrome$surface@muted, raised = chrome$surface@raised
  ))
  theme@content <- fill_na(theme@content, list(
    primary = chrome$content@primary, secondary = chrome$content@secondary,
    muted = chrome$content@muted, inverse = chrome$content@inverse
  ))
  theme@divider <- fill_na(theme@divider, list(
    subtle = chrome$divider@subtle, strong = chrome$divider@strong
  ))
  theme@accent <- fill_na(theme@accent, list(
    default = chrome$accent@default, muted = chrome$accent@muted,
    tint_subtle = chrome$accent@tint_subtle, tint_medium = chrome$accent@tint_medium
  ))

  # Step 4: data cascade. Reads surface.base from already-resolved chrome.
  data <- resolve_data(
    theme@inputs,
    surface_base = theme@surface@base,
    content_primary = theme@content@primary,
    existing_series = theme@series,
    existing_summary = theme@summary
  )
  theme@series  <- data$series
  theme@summary <- data$summary
  theme@status  <- fill_na(theme@status, list(
    positive = data$status@positive, negative = data$status@negative,
    warning  = data$status@warning,  info     = data$status@info
  ))

  # Step 5: text roles.
  derived_text <- resolve_text(theme@inputs, theme@content)
  for (p in S7::prop_names(theme@text)) {
    S7::prop(theme@text, p) <- compose_text(
      S7::prop(theme@text, p),
      S7::prop(derived_text, p)
    )
  }

  # Step 6: component clusters.
  theme <- resolve_components(theme)

  theme
}
