# Theme resolution pipeline.
#
# resolve_theme(theme) takes a WebTheme with NA-default Tier 2 / Tier 3
# fields and returns a WebTheme with all those fields populated from the
# Tier 1 inputs and chosen variants. Only NA fields are written, so
# user-set overrides survive re-resolution. The function is idempotent.
#
# T1 input axes:
#   * Identity (2-tier mirror chain): primary / secondary, each with a
#     _deep companion. NA secondary mirrors primary; each _deep
#     auto-derives via oklch_darken(seed, 0.15) when NA, except
#     secondary_deep which mirrors primary_deep when secondary is NA.
#   * Engagement (orthogonal): accent / accent_deep. Reserved for layered
#     emphasis (hover, selected, semantic row callouts, selection edge,
#     status.info fallback). Does not enter the identity mirror chain.
#
# T2 ownership:
#   * Chrome texture (surface.muted, divider.subtle, divider.strong, and
#     row.alt banding via surface.muted) reads from secondary_deep — which,
#     via the mirror chain, falls back to primary_deep when secondary is
#     unset. Mono themes get primary-tinted texture for free; two-color
#     editorial themes get coordinated chrome under the secondary axis.
#   * Identity chrome (header.bold band, container border) reads from
#     primary_deep.
#   * Engagement (accent.*, semantic.fill, status.info fallback, glyph col
#     defaults consumed by the frontend) reads from accent / inputs.
#
# T3 cluster bindings:
#   * header.bold.bg = primary_deep; header.bold.rule = mix(content.inverse,
#     primary_deep, 0.4) (component-local).
#   * column_group.bold.bg = secondary_deep; column_group.bold.rule =
#     mix(content.inverse, secondary_deep, 0.4) (component-local).
#   * row_group.L1/L2/L3.bg all secondary_deep-derived (hierarchy from
#     weight + indent, no per-level ramp). Structural groupings — column
#     and row — live consistently on secondary so they read as a coordinated
#     family in two-color themes; in mono themes secondary mirrors primary
#     so visuals are unchanged.
#
# Hard rule: chrome derivation reads only chrome inputs (neutrals, identity
# tiers via secondary_deep, accent for accent.*). Data derivation reads only
# data inputs (series_anchors, status_*) plus surface.base for muted
# blends. The two cascades meet only at WebTheme reassembly. The
# pooled-effect "summary" mark reads from series[[1]] — there is no
# separate summary slot.
#
# Tertiary was removed 2026-04-29 — its sole job (chrome texture) collapsed
# onto secondary. See vignettes/theming.Rmd decision log.

# Density presets: each entry maps every SpacingTokens field to a numeric.
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


# Mirror Tier 1 NA fields through the identity chain and to engagement.
#
# Identity rule: NA secondary mirrors primary. When secondary mirrors, its
# _deep companion also mirrors primary_deep — so a pinned primary_deep
# propagates through the chain in mono themes instead of being silently
# re-darkened from the seed. When secondary is pinned (non-NA), its _deep
# auto-derives via oklch_darken(secondary, 0.15) unless explicitly set.
#
# Engagement: accent_deep auto-derives from accent; status.info falls back
# to accent; font_display falls back to font_body.
resolve_inputs_mirrors <- function(inputs) {
  # Capture secondary's mirroring state BEFORE filling. We need to know
  # whether secondary was originally NA (mirroring) so its _deep companion
  # can follow primary_deep (vs. auto-darken from a freshly-mirrored seed).
  secondary_was_na <- is.na(inputs@secondary)

  # Primary chain.
  if (is.na(inputs@primary_deep)) inputs@primary_deep <- oklch_darken(inputs@primary, 0.15)

  # Secondary chain.
  if (secondary_was_na) {
    inputs@secondary <- inputs@primary
    if (is.na(inputs@secondary_deep)) inputs@secondary_deep <- inputs@primary_deep
  } else if (is.na(inputs@secondary_deep)) {
    inputs@secondary_deep <- oklch_darken(inputs@secondary, 0.15)
  }

  if (is.na(inputs@accent_deep))   inputs@accent_deep   <- oklch_darken(inputs@accent, 0.15)
  if (is.na(inputs@font_display))  inputs@font_display  <- inputs@font_body
  if (is.na(inputs@status_info))   inputs@status_info   <- inputs@accent
  inputs
}


# resolve_chrome: ThemeInputs -> list of T2 chrome objects.
# Reads identity tiers (via secondary_deep for chrome texture) + accent.
# Does NOT read series_anchors. Assumes resolve_inputs_mirrors() has
# already run, so every identity tier and its _deep companion is set.
resolve_chrome <- function(inputs) {
  n <- inputs@neutral

  # Chrome texture (surface.muted, divider tints, alt-row banding) reads
  # from secondary_deep. Via the mirror chain, this falls back to
  # primary_deep when secondary is unset — mono themes pick up
  # primary-tinted chrome; two-color editorial themes get coordinated
  # texture under the same secondary axis that owns col-group bg,
  # row-group bg, and glyph col defaults. One axis, one structural role.
  chrome_tint <- inputs@secondary_deep

  # surface.muted is a 4% chrome_tint mix into n[3] — hue-locked by
  # oklch_mix so it reads as identity-tinted, not just intensity-shifted.
  # Alt-row banding derives at half-strength from this (~2% effective).
  surface <- Surfaces(
    base   = n[2],
    muted  = oklch_mix(n[3], chrome_tint, 0.04),
    raised = n[1]
  )

  content <- Content(
    primary   = n[5],
    secondary = n[4],
    muted     = oklch_lighten(n[4], 0.10),
    inverse   = n[1]
  )

  # Both divider tones carry chrome_tint at different strengths.
  # subtle (~10%): cell hairlines and gridlines — needs to read against
  # BOTH surface.base (n[2]) and surface.muted (n[3]); pulled ~30% toward
  # n[4] for the neutral baseline, then nudged toward chrome_tint.
  # strong (~5%): header rules, group rules, axis line, tick marks,
  # reference line — kept close to neutral so structural rules don't read
  # as accidental tints, but a faint hue keeps them coordinated with the
  # subtle divider rather than feeling overlaid.
  # Rules sitting on dark bold-mode bands are derived per-cluster at T3
  # (header.bold.rule, column_group.bold.rule) — there is no global
  # "strong-on-dark" token.
  divider_neutral <- oklch_mix(n[3], n[4], 0.30)
  divider <- Dividers(
    subtle = oklch_mix(divider_neutral, chrome_tint, 0.10),
    strong = oklch_mix(n[4], chrome_tint, 0.05)
  )

  accent <- AccentRoles(
    default     = inputs@accent,
    muted       = oklch_mix(inputs@accent, surface@base, 0.88),
    tint_subtle = oklch_mix(inputs@accent, surface@base, 0.90),
    tint_medium = oklch_mix(inputs@accent, surface@base, 0.75)
  )

  # Semantic-token color slot. The painter applies a RowSemantic bundle
  # to a row/cell; row.fill needs a color identity that's not captured by
  # accent / identity / status. Defaults to a pastel "filled-in" tone
  # derived from accent (engagement axis) — a soft, legible row tint
  # signaling "this row matters" without dominating. Users override via
  # theme@semantic@fill.
  semantic <- Semantics(
    fill = oklch_mix(inputs@accent, n[1], 0.80)
  )

  list(surface = surface, content = content, divider = divider,
       accent = accent, semantic = semantic)
}


# resolve_data: per-anchor SlotBundle derivation.
# Reads series_anchors + status_*. Reads surface_base for muted blends
# but does not write to any chrome token.
#
# slot_style centralizes the fill/stroke pairing convention that was
# previously hardcoded into this function. Default
# "fill_with_darker_stroke" preserves prior behavior exactly. Two
# alternatives are available:
#   "flat_fill" — stroke matches fill (no contrast pair). Reads as a
#     single tone; useful on dense plots where outlines visually crowd
#     small marks.
#   "outlined" — fill leans toward surface; stroke carries the anchor.
#     Outline-only marks for editorial themes that want skeletal data
#     against a textured surface.
derive_slot_bundle <- function(anchor, surface_base, content_primary,
                                slot_style = "fill_with_darker_stroke") {
  fill_muted <- oklch_mix(anchor, surface_base, 0.65)

  if (identical(slot_style, "flat_fill")) {
    SlotBundle(
      fill            = anchor,
      stroke          = anchor,
      fill_muted      = fill_muted,
      stroke_muted    = fill_muted,
      fill_emphasis   = oklch_chroma(oklch_darken(anchor, 0.05), 0.04),
      stroke_emphasis = oklch_chroma(oklch_darken(anchor, 0.05), 0.04),
      text_fg         = content_primary
    )
  } else if (identical(slot_style, "outlined")) {
    # 85% surface + 15% anchor: fill is barely tinted; the anchor identity
    # lives in the stroke.
    outline_fill       <- oklch_mix(anchor, surface_base, 0.15)
    outline_fill_muted <- oklch_mix(anchor, surface_base, 0.08)
    SlotBundle(
      fill            = outline_fill,
      stroke          = anchor,
      fill_muted      = outline_fill_muted,
      stroke_muted    = oklch_darken(fill_muted, 0.10),
      fill_emphasis   = oklch_mix(anchor, surface_base, 0.30),
      stroke_emphasis = oklch_darken(anchor, 0.20),
      text_fg         = content_primary
    )
  } else {
    # Default: "fill_with_darker_stroke" — current convention preserved.
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

resolve_data <- function(inputs, surface_base, content_primary, existing_series) {
  anchors <- inputs@series_anchors
  slot_style <- inputs@slot_style
  series <- vector("list", length(anchors))
  for (i in seq_along(anchors)) {
    derived <- derive_slot_bundle(anchors[i], surface_base, content_primary, slot_style)
    existing <- if (i <= length(existing_series)) existing_series[[i]] else SlotBundle()
    series[[i]] <- fill_slot_bundle(existing, derived)
  }

  status <- StatusColors(
    positive = inputs@status_positive,
    negative = inputs@status_negative,
    warning  = inputs@status_warning,
    info     = inputs@status_info
  )

  list(series = series, status = status)
}


# resolve_text: TextRoles bundles from Tier 1 fonts + Tier 2 content.
#
# Typography hierarchy maps onto the two-axis identity contract:
#   * title     = primary_deep         — identity hero
#   * subtitle  = secondary lean (30%) — structural typography
#   * body/cell = content.primary      — neutral (legibility floor)
#   * label     = secondary lean (20%) — short structural text
#   * caption   = secondary lean (30%) — quiet editorial chrome
#   * tick      = secondary lean (10%) — scaffolding, dense grids
#   * footnote  = secondary lean (20%) — quietest end of the layout
#
# Caption/tick/footnote previously leaned toward tertiary; tertiary was
# removed 2026-04-29 and chrome typography now leans toward secondary.
# In mono themes secondary mirrors primary so every mix resolves to the
# same hue at the same percentage as plain content.muted /
# content.secondary — visually identical. Two-color editorial themes get
# coordinated chrome typography under the same axis that owns chrome
# texture — single structural axis, one tinting source.
resolve_text <- function(inputs, content) {
  body <- inputs@font_body
  display <- inputs@font_display
  # Tolerate NA tier_deep for callers that bypass resolve_inputs_mirrors.
  primary_deep   <- if (is.na(inputs@primary_deep))   inputs@primary   else inputs@primary_deep
  secondary_deep <- if (is.na(inputs@secondary_deep)) primary_deep     else inputs@secondary_deep

  subtitle_fg <- oklch_mix(content@secondary, secondary_deep, 0.30)
  label_fg    <- oklch_mix(content@secondary, secondary_deep, 0.20)
  caption_fg  <- oklch_mix(content@secondary, secondary_deep, 0.30)
  tick_fg     <- oklch_mix(content@muted,     secondary_deep, 0.10)
  footnote_fg <- oklch_mix(content@muted,     secondary_deep, 0.20)

  TextRoles(
    # Title fg defaults to primary_deep — large, prominent text is the
    # highest-leverage place for the deep primary identity color to land.
    # Override theme@text@title@fg for a different tone.
    title    = TextRole(family = display, size = "1.25rem",   weight = 600, figures = "proportional", fg = primary_deep,    italic = FALSE),
    subtitle = TextRole(family = body,    size = "1rem",      weight = 400, figures = "proportional", fg = subtitle_fg,     italic = FALSE),
    body     = TextRole(family = body,    size = "0.875rem",  weight = 400, figures = "tabular",      fg = content@primary, italic = FALSE),
    cell     = TextRole(family = body,    size = "0.875rem",  weight = 400, figures = "tabular",      fg = content@primary, italic = FALSE),
    label    = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "tabular",      fg = label_fg,        italic = FALSE),
    tick     = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "tabular",      fg = tick_fg,         italic = FALSE),
    footnote = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "proportional", fg = footnote_fg,     italic = FALSE),
    caption  = TextRole(family = body,    size = "0.75rem",   weight = 400, figures = "proportional", fg = caption_fg,      italic = TRUE)
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
  # Light-mode header bg matches the row body (surface.base), not
  # surface.muted: the bold-text + strong rule below already signal "this
  # is the header band" without a separate bg. Less visual noise; the
  # banded data rows still read clearly as alternates beneath. Authors
  # who want a tinted header can flip header_style = "bold" for the
  # primary_deep band, or pin header.light.bg explicitly.
  hdr <- theme@header
  hdr@light <- fill_na(hdr@light, list(
    bg   = surface@base,
    fg   = content@primary,
    rule = divider@strong
  ))
  # Tint variant: a light primary-deep tint (12%) into surface.base, dark
  # text. Middle ground between light (bare surface) and bold (full
  # primary_deep band). Editorial section/article headers want this when
  # full bold reads as too aggressive; group-heading bg gets a stronger
  # variant under tint as well (see Phase A.5 groupHeading subtle/strong).
  hdr@tint <- fill_na(hdr@tint, list(
    bg   = oklch_mix(surface@base, inputs@primary_deep, 0.12),
    fg   = content@primary,
    rule = divider@strong
  ))
  hdr@bold <- fill_na(hdr@bold, list(
    bg   = inputs@primary_deep,
    fg   = content@inverse,
    # Rule on a primary_deep header band must contrast AGAINST the band,
    # not blend into it. Computed per-cluster as a 40% mix of
    # content.inverse toward the band's own bg — light enough to read,
    # tinted enough to feel intentional rather than overlaid.
    rule = oklch_mix(content@inverse, inputs@primary_deep, 0.40)
  ))
  hdr@text <- compose_text(
    hdr@text,
    override_text(text@body, weight = 600)
  )
  theme@header <- hdr

  # Column-group header tracks the same variants as the leaf header.
  cg <- theme@column_group
  cg@light <- fill_na(cg@light, list(
    bg   = surface@base,
    fg   = content@primary,
    rule = divider@strong
  ))
  # Column-group tint variant: 12% mix of secondary_deep into surface.base.
  # Mirrors the leaf header's tint pattern but reads through secondary so
  # two-color themes get coordinated section/article header split for free.
  # In mono themes secondary_deep mirrors primary_deep so the visual
  # output collapses to the same hue as the leaf header tint.
  cg@tint <- fill_na(cg@tint, list(
    bg   = oklch_mix(surface@base, inputs@secondary_deep, 0.12),
    fg   = content@primary,
    rule = divider@strong
  ))
  cg@bold <- fill_na(cg@bold, list(
    # Column-group bold band reads from secondary_deep (mirrors
    # primary_deep in mono themes, so no visual delta). In two-color
    # themes this gives a free section/article header split: leaf headers
    # in primary, group headers in secondary.
    bg   = inputs@secondary_deep,
    fg   = content@inverse,
    # Per-cluster bold rule contrasts against THIS band's bg (secondary_deep),
    # not the leaf header's. See header.bold.rule for derivation rationale.
    rule = oklch_mix(content@inverse, inputs@secondary_deep, 0.40)
  ))
  cg@text <- compose_text(
    cg@text,
    override_text(text@body, weight = 500)
  )
  theme@column_group <- cg

  # -- Row groups: subtle/strong variant pair driven by header_style. --
  # L1.bg is secondary-derived: a mix of secondary_deep into surface.base.
  # Strength tracks header_style so the row-group band's visual weight
  # coordinates with the leaf header's:
  #   header_style "light" → 16% mix (subtle)  — quiet group dividers
  #     under bare-surface headers.
  #   header_style "tint"  → 24% mix (strong)  — group bands match the
  #     editorial section-header weight.
  #   header_style "bold"  → 24% mix (strong)  — group bands cohere with
  #     the bold-band leaf header without competing with it.
  # Single rule from a single T1 input. No per-theme overrides needed.
  # Structural groupings — column and row — both live on secondary so they
  # read as a coordinated family in two-color themes. Routing through an
  # identity tier (rather than accent.tint_subtle) keeps the group bar in
  # a different color family from hover/selected fills (which are
  # accent.muted), so multiple highlighted rows don't merge into the bar.
  # All three nesting levels (L1/L2/L3) share this bg — hierarchy is
  # carried by text weight + indent, not per-level tint.
  rg <- theme@row_group
  l1_strength <- if (theme@variants@header_style == "light") 0.16 else 0.24
  l1_default_bg <- oklch_mix(surface@base, inputs@secondary_deep, l1_strength)
  rg@L1 <- fill_na(rg@L1, list(
    bg   = l1_default_bg,
    fg   = content@primary,
    rule = divider@strong
  ))
  rg@L1@text <- compose_text(rg@L1@text, override_text(text@body, weight = 600))

  # L2 and L3 default to the same bg as L1: visual demarcation between
  # nesting levels comes from text weight + indent, not from a separate
  # tint per level. Reduces noise across deeply nested groups; authors
  # who want per-level tints override row_group.L2.bg / .L3.bg directly.
  rg@L2 <- fill_na(rg@L2, list(
    bg   = rg@L1@bg,
    fg   = content@secondary,
    rule = divider@subtle
  ))
  rg@L2@text <- compose_text(rg@L2@text, override_text(text@body, weight = 500))

  rg@L3 <- fill_na(rg@L3, list(
    bg = rg@L1@bg,
    fg = content@secondary
  ))
  rg@L3@text <- compose_text(rg@L3@text, text@body)

  if (is.na(rg@indent_per_level)) {
    rg@indent_per_level <- theme@spacing@indent_per_level
  }
  theme@row_group <- rg

  # -- Rows: states + semantic bundles. --
  # row.alt.bg defaults to a HALF-strength mix of surface.muted into
  # surface.base. surface.muted is reserved for chrome surfaces (header
  # band, first-column-bold, etc.) where the primary identity should read
  # clearly. The alt-row banding only needs to demarcate row pairs and
  # should be the subtler of the two — sharing surface.muted made the
  # header and banding visually identical, especially on warm-neutral
  # palettes where the primary tint is barely perceptible.
  rc <- theme@row
  rc@base <- fill_na(rc@base, list(bg = surface@base, fg = content@primary))
  rc@alt  <- fill_na(rc@alt, list(
    bg = oklch_mix(surface@base, surface@muted, 0.5),
    fg = content@primary
  ))
  rc@hover    <- fill_na(rc@hover,    list(bg = accent@muted,  fg = content@primary))
  rc@selected <- fill_na(rc@selected, list(bg = accent@muted,  fg = content@primary))

  # marker_stroke companions: when an accent/emphasis/muted row replaces
  # the marker fill, the whisker (CI line, marker outline) should track
  # too — otherwise the result is a recolored dot on a structurally-
  # colored line. Each token pairs its fill with an appropriate stroke:
  #   * emphasis → content.primary (already dark; reuse for stroke)
  #   * muted    → oklch_darken(content.muted, 0.10)
  #   * accent   → inputs@accent_deep (the dedicated dark companion)
  rc@emphasis <- fill_na(rc@emphasis, list(
    fg = content@primary, marker_fill = content@primary,
    marker_stroke = content@primary, font_weight = 600
  ))
  rc@muted <- fill_na(rc@muted, list(
    fg = content@muted, marker_fill = content@muted,
    marker_stroke = oklch_darken(content@muted, 0.10)
  ))
  # accent token = bold + accent color. Weight=600 added so accent rows
  # read as a coordinated "bold + colored" treatment, not just colored
  # text at the regular weight. marker_stroke = accent_deep pairs the
  # marker with a darkened companion just like series anchors do.
  rc@accent <- fill_na(rc@accent, list(
    fg = accent@default, marker_fill = accent@default,
    marker_stroke = inputs@accent_deep, font_weight = 600
  ))
  # bold token = pure weight bump, no color override. Useful when a row
  # should call attention to itself without recoloring.
  rc@bold <- fill_na(rc@bold, list(
    font_weight = 600
  ))
  # fill token = bold + a pastel filled-in row tint derived from accent.
  # fg stays at the row's default content color since the bg is pale
  # enough to remain legible.
  rc@fill <- fill_na(rc@fill, list(
    bg = theme@semantic@fill,
    font_weight = 600
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
  # Axis + tick label fg get a faint secondary lean (10% mix into
  # content.muted) so they coordinate with the rest of the plot
  # scaffolding (axis line, tick marks, gridlines all already
  # secondary-tinted via the divider chain). Mirror chain handles mono
  # themes — secondary_deep mirrors primary_deep so the mix collapses to
  # the same hue as plain content.muted.
  # Pre-fill BEFORE compose_text so this value blocks the text-role
  # default (which would otherwise inherit the role's content color)
  # while other NA fields still flow through from the role.
  secondary_deep <- if (is.na(theme@inputs@secondary_deep)) theme@inputs@primary_deep else theme@inputs@secondary_deep
  axis_tick_label_fg <- oklch_mix(content@muted, secondary_deep, 0.10)
  if (is.na(ps@axis_label@fg)) ps@axis_label@fg <- axis_tick_label_fg
  if (is.na(ps@tick_label@fg)) ps@tick_label@fg <- axis_tick_label_fg
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
#' fill Tier 3 component clusters from the resolved Tier 2 tokens, then
#' run construction-time contrast validation (internal
#' `validate_resolved_theme()` — see `R/utils-theme-validate.R`).
#'
#' @param theme A [WebTheme] object.
#' @param .validate Whether to run construction-time contrast validation
#'   on the resolved theme. Default `TRUE`. Set to `FALSE` only for tests
#'   that intentionally use synthetic high-saturation colors to verify
#'   cascade mechanics — production callers should leave validation on so
#'   broken overrides surface at construction rather than at render.
#' @return A [WebTheme] object with NA fields populated.
#' @export
resolve_theme <- function(theme, .validate = TRUE) {
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
    subtle = chrome$divider@subtle,
    strong = chrome$divider@strong
  ))
  theme@accent <- fill_na(theme@accent, list(
    default = chrome$accent@default, muted = chrome$accent@muted,
    tint_subtle = chrome$accent@tint_subtle, tint_medium = chrome$accent@tint_medium
  ))
  theme@semantic <- fill_na(theme@semantic, list(
    fill = chrome$semantic@fill
  ))

  # Step 4: data cascade. Reads surface.base from already-resolved chrome.
  data <- resolve_data(
    theme@inputs,
    surface_base = theme@surface@base,
    content_primary = theme@content@primary,
    existing_series = theme@series
  )
  theme@series  <- data$series
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

  # Step 7: validate contrast invariants on the fully resolved theme.
  # Aborts at construction (vs at render) so users see the error at the
  # source of the bad override. See R/utils-theme-validate.R for the
  # invariant list and rationale. Tests can opt out via .validate=FALSE
  # when synthesizing intentionally-broken-but-mechanically-correct
  # cascades.
  if (isTRUE(.validate)) validate_resolved_theme(theme)

  theme
}
