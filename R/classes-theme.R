# 3-tier theming system for tabviz.
#
# Defines a strict 3-tier cascade: ThemeInputs (T1) -> semantic roles (T2)
# -> component clusters (T3). T2/T3 are derived from T1 via the TS adapter
# (`srcjs/src/lib/theme-adapter.ts::buildTheme`). Chrome and data tokens
# are parallel hierarchies that share only Tier 1.

# Hex regex shared across color validators.
hex_pattern <- "^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"

# Validator factory: each named slot must be NA-or-hex.
make_color_validator <- function(slots) {
  function(self) {
    invalid <- character()
    for (s in slots) {
      v <- S7::prop(self, s)
      if (!is.na(v) && !grepl(hex_pattern, v)) {
        invalid <- c(invalid, paste0(s, " = '", v, "'"))
      }
    }
    if (length(invalid) > 0L) {
      return(paste("Invalid hex:", paste(invalid, collapse = ", ")))
    }
    NULL
  }
}


# -- Tier 1: customer-facing inputs ---------------------------------------

#' ThemeInputs: customer-facing theme authoring surface.
#'
#' The entire user authoring surface (locked design 2026-05-28). Every
#' other token derives from these via the TS adapter
#' (`srcjs/src/lib/theme-adapter.ts::buildTheme`), which calls the
#' resolver in `srcjs/src/lib/theme-resolve.ts`.
#'
#' @field brand          Required brand seed hex; drives the brand ramp + identity.
#' @field accent         Engagement seed hex (hover/selected/callouts). NA mirrors brand.
#' @field decorative     Optional second color for two-color editorial themes.
#'                       Drives structural bg tints (alt-row, dividers,
#'                       row-group L1 band). NA = not set.
#' @field mode           "light" or "dark". Inverts neutral ramp direction.
#' @field neutral_tint   "untinted" | "brand" | "accent" | "decorative" | hex.
#'                       Optional tint blend into low-chroma ramp ends.
#' @field neutral_tint_strength  Numeric in `[0, 1]`. Default `0.04` (subtle
#'                       clinical hint). `~1.0` makes the tint hex effectively
#'                       the paper color (editorial-strong).
#' @field categorical    Named data scheme reference (Okabe-Ito default).
#' @field sequential     Named sequential scheme (viridis default).
#' @field diverging      Named diverging scheme (rdbu default).
#' @field status_positive Status positive seed. NA -> default.
#' @field status_negative Status negative seed. NA -> default.
#' @field status_warning  Status warning seed. NA -> default.
#' @field status_info     Status info seed. NA -> default.
#' @field font_body      Font stack for body/cell/label text.
#' @field font_display   Font stack for title/subtitle. NA mirrors font_body.
#' @field font_mono      Font stack for monospace/code. Optional.
#' @field density        "compact", "comfortable", or "spacious".
#'
#' @usage NULL
#' @export
ThemeInputs <- new_class(
  "ThemeInputs",
  properties = list(
    brand           = new_property(class_character, default = "#0099CC"),
    accent          = new_property(class_character, default = NA_character_),
    decorative      = new_property(class_character, default = NA_character_),
    mode            = new_property(class_character, default = "light"),
    neutral_tint    = new_property(class_character, default = "untinted"),
    neutral_tint_strength = new_property(class_numeric, default = 0.04),

    categorical     = new_property(class_character, default = "okabe_ito"),
    sequential      = new_property(class_character, default = "viridis"),
    diverging       = new_property(class_character, default = "rdbu"),

    status_positive = new_property(class_character, default = "#3F7D3F"),
    status_negative = new_property(class_character, default = "#B33A3A"),
    status_warning  = new_property(class_character, default = "#C68A2E"),
    status_info     = new_property(class_character, default = "#1F77B4"),

    font_body       = new_property(class_character,
                                    default = "system-ui, -apple-system, sans-serif"),
    font_display    = new_property(class_character, default = NA_character_),
    font_mono       = new_property(class_character, default = NA_character_),

    density         = new_property(class_character, default = "comfortable")
  ),
  validator = function(self) {
    if (!grepl(hex_pattern, self@brand)) {
      return(paste0("brand must be a hex color, got '", self@brand, "'"))
    }
    for (p in c("accent", "decorative", "status_positive", "status_negative",
                "status_warning", "status_info")) {
      v <- S7::prop(self, p)
      if (!is.na(v) && !grepl(hex_pattern, v)) {
        return(paste0(p, " must be a hex color or NA, got '", v, "'"))
      }
    }
    nt <- self@neutral_tint
    if (!nt %in% c("untinted", "brand", "accent", "decorative") &&
        !grepl(hex_pattern, nt)) {
      return(paste0(
        "neutral_tint must be 'untinted', 'brand', 'accent', 'decorative', ",
        "or a hex color, got '", nt, "'"
      ))
    }
    if (!self@mode %in% c("light", "dark")) {
      return("mode must be 'light' or 'dark'")
    }
    if (!self@density %in% c("compact", "comfortable", "spacious")) {
      return("density must be 'compact', 'comfortable', or 'spacious'")
    }
    s <- self@neutral_tint_strength
    if (length(s) != 1L || is.na(s) || s < 0 || s > 1) {
      return("neutral_tint_strength must be a number in [0, 1]")
    }
    NULL
  }
)


# -- Tier 2: chrome semantic roles ---------------------------------------

#' Surfaces (Tier 2): table surface tones.
#' @usage NULL
#' @export
Surfaces <- new_class(
  "Surfaces",
  properties = list(
    base   = new_property(class_character, default = NA_character_),
    muted  = new_property(class_character, default = NA_character_),
    raised = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("base", "muted", "raised"))
)

#' Content (Tier 2): text/foreground role tokens.
#' @usage NULL
#' @export
Content <- new_class(
  "Content",
  properties = list(
    primary   = new_property(class_character, default = NA_character_),
    secondary = new_property(class_character, default = NA_character_),
    muted     = new_property(class_character, default = NA_character_),
    inverse   = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("primary", "secondary", "muted", "inverse"))
)

#' Dividers (Tier 2): rule and gridline tones.
#'
#' `subtle` powers cell hairlines and gridlines. `strong` powers header
#' rules, group rules, and the forest-plot axis line / tick / reference
#' lines on light surfaces. Rules sitting on dark bold-mode bands
#' (`header.bold`, `column_group.bold`) are derived per-cluster at resolve
#' time as `mix(content.inverse, <cluster-bg>, 0.4)` so each contrasts
#' against its own band -- there is no global "strong-on-dark" token.
#'
#' @usage NULL
#' @export
Dividers <- new_class(
  "Dividers",
  properties = list(
    subtle = new_property(class_character, default = NA_character_),
    strong = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("subtle", "strong"))
)

#' AccentRoles (Tier 2): chrome accent + tint ramp.
#' @usage NULL
#' @export
AccentRoles <- new_class(
  "AccentRoles",
  properties = list(
    default     = new_property(class_character, default = NA_character_),
    muted       = new_property(class_character, default = NA_character_),
    tint_subtle = new_property(class_character, default = NA_character_),
    tint_medium = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(
    c("default", "muted", "tint_subtle", "tint_medium")
  )
)

#' StatusColors (Tier 2): semantic status passthrough.
#' @usage NULL
#' @export
StatusColors <- new_class(
  "StatusColors",
  properties = list(
    positive = new_property(class_character, default = NA_character_),
    negative = new_property(class_character, default = NA_character_),
    warning  = new_property(class_character, default = NA_character_),
    info     = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("positive", "negative", "warning", "info"))
)

#' Semantics (Tier 2): named token colors for the painter UI.
#'
#' The painter applies one of five RowSemantic bundles to a row or cell.
#' One of those bundles (`row.fill`) needs a color whose identity isn't
#' captured by accent / identity / status. `Semantics` carries that named
#' slot -- defaults to a derivation from `accent` at resolve time (engagement
#' axis); authors override the slot to pin a specific token color.
#'
#' @usage NULL
#' @export
Semantics <- new_class(
  "Semantics",
  properties = list(
    fill      = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("fill"))
)


# -- Tier 2: data slot bundle --------------------------------------------

#' SlotRole: 7-field per-slot role bundle for series and summary.
#'
#' Resolution fills NA fields from the slot's anchor via OKLCH:
#'   fill      <- anchor
#'   stroke    <- darken(anchor)
#'   fill_dim  <- mix(anchor, surface.base)       (de-emphasized state)
#'   stroke_dim<- darken(fill_dim)
#'   fill_hot  <- darken(anchor) + chroma boost   (interactive highlight)
#'   stroke_hot<- darken(anchor) further
#'   text_fg   <- contrast-checked against typical row bg
#'
#' Renamed from `SlotBundle` (Sprint 1 PR 2). The fields previously
#' called `fill_muted` / `stroke_muted` / `fill_emphasis` /
#' `stroke_emphasis` are now `fill_dim` / `stroke_dim` / `fill_hot` /
#' `stroke_hot` — `muted` and `emphasis` each carried multiple
#' meanings across the theme system; `dim`/`hot` reserves them for the
#' chrome roles and paint tokens.
#'
#' @usage NULL
#' @export
SlotRole <- new_class(
  "SlotRole",
  properties = list(
    fill       = new_property(class_character, default = NA_character_),
    stroke     = new_property(class_character, default = NA_character_),
    fill_dim   = new_property(class_character, default = NA_character_),
    stroke_dim = new_property(class_character, default = NA_character_),
    fill_hot   = new_property(class_character, default = NA_character_),
    stroke_hot = new_property(class_character, default = NA_character_),
    text_fg    = new_property(class_character, default = NA_character_),
    # Marker shape for forest points + similar viz marks. NA -> renderer
    # picks a default from a 4-shape rotation (circle / square / diamond
    # / triangle). Authors who want a fixed shape per slot pin one of
    # those four values.
    shape      = new_property(class_character, default = NA_character_)
  ),
  validator = function(self) {
    color_err <- make_color_validator(
      c("fill", "stroke", "fill_dim", "stroke_dim",
        "fill_hot", "stroke_hot", "text_fg")
    )(self)
    if (!is.null(color_err)) return(color_err)
    valid_shapes <- c("square", "circle", "diamond", "triangle")
    if (!is.na(self@shape) && !self@shape %in% valid_shapes) {
      return(paste0("shape must be one of: ",
                    paste(valid_shapes, collapse = ", "),
                    " (or NA)"))
    }
    NULL
  }
)

#' SlotBundle (deprecated alias for SlotRole)
#'
#' Renamed to [SlotRole] in Sprint 1 PR 2. Kept as an alias for one
#' minor version so existing user code that constructs `SlotBundle(...)`
#' keeps working.
#'
#' @usage NULL
#' @export
SlotBundle <- SlotRole


# -- Tier 2: typography roles --------------------------------------------

#' TextRole: one typographic role bundle.
#'
#' figures: "tabular" or "proportional" (CSS font-feature-settings 'tnum').
#' Defaults all-NA so resolution can fill from inputs + content.
#'
#' @usage NULL
#' @export
TextRole <- new_class(
  "TextRole",
  properties = list(
    family  = new_property(class_character, default = NA_character_),
    size    = new_property(class_character, default = NA_character_),
    weight  = new_property(class_numeric,   default = NA_real_),
    figures = new_property(class_character, default = NA_character_),
    fg      = new_property(class_character, default = NA_character_),
    italic  = new_property(class_logical,   default = NA)
  ),
  validator = function(self) {
    if (!is.na(self@figures) && !self@figures %in% c("tabular", "proportional")) {
      return("figures must be 'tabular' or 'proportional'")
    }
    if (!is.na(self@fg) && !grepl(hex_pattern, self@fg)) {
      return(paste("Invalid hex for fg:", self@fg))
    }
    NULL
  }
)

#' TextRoles: collection of named TextRole bundles.
#' @usage NULL
#' @export
TextRoles <- new_class(
  "TextRoles",
  properties = list(
    title    = new_property(TextRole, default = TextRole()),
    subtitle = new_property(TextRole, default = TextRole()),
    body     = new_property(TextRole, default = TextRole()),
    cell     = new_property(TextRole, default = TextRole()),
    label    = new_property(TextRole, default = TextRole()),
    tick     = new_property(TextRole, default = TextRole()),
    footnote = new_property(TextRole, default = TextRole()),
    caption  = new_property(TextRole, default = TextRole()),
    # Phase 12: optional numeric-flavored role. NA-default; resolver
    # fills it from `body` so the wire always carries a complete TextRole.
    # Renderers consult it via `pickTextRole(col, theme)` for
    # numeric-category columns (numeric / percent / currency / pvalue /
    # interval / events / badge).
    numeric  = new_property(TextRole, default = TextRole())
  )
)


# -- Tier 2: spacing (density-derived numerics) -------------------------

#' SpacingTokens: density-derived numeric layout tokens.
#'
#' All NA defaults are filled at resolve time from the active density preset.
#' Setting any field explicitly overrides the preset for that field only.
#'
#' @usage NULL
#' @export
SpacingTokens <- new_class(
  "SpacingTokens",
  properties = list(
    row_height           = new_property(class_numeric, default = NA_real_),
    header_height        = new_property(class_numeric, default = NA_real_),
    padding              = new_property(class_numeric, default = NA_real_),
    container_padding    = new_property(class_numeric, default = NA_real_),
    axis_gap             = new_property(class_numeric, default = NA_real_),
    column_group_padding = new_property(class_numeric, default = NA_real_),
    row_group_padding    = new_property(class_numeric, default = NA_real_),
    cell_padding_x       = new_property(class_numeric, default = NA_real_),
    footer_gap           = new_property(class_numeric, default = NA_real_),
    title_subtitle_gap   = new_property(class_numeric, default = NA_real_),
    header_gap           = new_property(class_numeric, default = NA_real_),
    bottom_margin        = new_property(class_numeric, default = NA_real_),
    indent_per_level     = new_property(class_numeric, default = NA_real_)
  )
)


# -- Tier 3: annotation cluster -----------------------------------------

#' AnnotationCluster: title/subtitle/caption/footnote bindings.
#'
#' Each is a TextRole bundle that defaults to mirroring `theme@text@*`.
#'
#' @usage NULL
#' @export
AnnotationCluster <- new_class(
  "AnnotationCluster",
  properties = list(
    title    = new_property(TextRole, default = TextRole()),
    subtitle = new_property(TextRole, default = TextRole()),
    caption  = new_property(TextRole, default = TextRole()),
    footnote = new_property(TextRole, default = TextRole())
  )
)


# -- Tier 3: header cluster (variant token) -----------------------------

#' HeaderVariant: one variant of the header cluster (light or bold).
#' @usage NULL
#' @export
HeaderVariant <- new_class(
  "HeaderVariant",
  properties = list(
    bg   = new_property(class_character, default = NA_character_),
    fg   = new_property(class_character, default = NA_character_),
    rule = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("bg", "fg", "rule"))
)

#' HeaderCluster: column-header bindings with light/tint/bold variants.
#'
#' Active variant is selected by `theme@variants@header_style`.
#'
#' @usage NULL
#' @export
HeaderCluster <- new_class(
  "HeaderCluster",
  properties = list(
    light = new_property(HeaderVariant, default = HeaderVariant()),
    tint  = new_property(HeaderVariant, default = HeaderVariant()),
    bold  = new_property(HeaderVariant, default = HeaderVariant()),
    text  = new_property(TextRole,      default = TextRole())
  )
)

#' ColumnGroupCluster: column-group header bindings.
#'
#' Tracks the same variant as the leaf header.
#'
#' @usage NULL
#' @export
ColumnGroupCluster <- new_class(
  "ColumnGroupCluster",
  properties = list(
    light = new_property(HeaderVariant, default = HeaderVariant()),
    tint  = new_property(HeaderVariant, default = HeaderVariant()),
    bold  = new_property(HeaderVariant, default = HeaderVariant()),
    text  = new_property(TextRole,      default = TextRole())
  )
)


# -- Tier 3: row group cluster -----------------------------------------

#' RowGroupTier: bindings for one row-group nesting level.
#' @usage NULL
#' @export
RowGroupTier <- new_class(
  "RowGroupTier",
  properties = list(
    bg            = new_property(class_character, default = NA_character_),
    fg            = new_property(class_character, default = NA_character_),
    rule          = new_property(class_character, default = NA_character_),
    text          = new_property(TextRole,        default = TextRole()),
    border_bottom = new_property(class_logical,   default = FALSE)
  ),
  validator = make_color_validator(c("bg", "fg", "rule"))
)

#' RowGroupCluster: nested row-group hierarchy (L1/L2/L3 + indent).
#' @usage NULL
#' @export
RowGroupCluster <- new_class(
  "RowGroupCluster",
  properties = list(
    L1 = new_property(RowGroupTier, default = RowGroupTier()),
    L2 = new_property(RowGroupTier, default = RowGroupTier()),
    L3 = new_property(RowGroupTier, default = RowGroupTier()),
    indent_per_level = new_property(class_numeric, default = NA_real_)
  )
)


# -- Tier 3: row + cell clusters --------------------------------------

#' RowState: bg + fg pair for a row state (default/alt/hover/selected).
#' @usage NULL
#' @export
RowState <- new_class(
  "RowState",
  properties = list(
    bg = new_property(class_character, default = NA_character_),
    fg = new_property(class_character, default = NA_character_)
  ),
  validator = make_color_validator(c("bg", "fg"))
)

#' RowSemantic: bg + fg + marker_fill + font for emphasis/muted/accent rows.
#'
#' Richer than RowState because semantic rows can override marker fill and
#' font weight/style on top of bg/fg.
#'
#' @usage NULL
#' @export
RowSemantic <- new_class(
  "RowSemantic",
  properties = list(
    bg            = new_property(class_character, default = NA_character_),
    fg            = new_property(class_character, default = NA_character_),
    border        = new_property(class_character, default = NA_character_),
    marker_fill   = new_property(class_character, default = NA_character_),
    # Stroke companion to marker_fill -- drives forest-plot whiskers and
    # the per-marker outline. Lets accent-flagged rows replace the
    # default series stroke (typically series[0].stroke = navy in mono
    # themes) with a properly-paired tone (e.g. accent_deep) so an
    # accent-tinted marker doesn't sit on a structurally-colored line.
    marker_stroke = new_property(class_character, default = NA_character_),
    font_weight   = new_property(class_numeric,   default = NA_real_),
    font_style    = new_property(class_character, default = NA_character_)
  ),
  validator = function(self) {
    invalid <- character()
    for (p in c("bg", "fg", "border", "marker_fill", "marker_stroke")) {
      v <- S7::prop(self, p)
      if (!is.na(v) && !grepl(hex_pattern, v)) {
        invalid <- c(invalid, paste0(p, " = '", v, "'"))
      }
    }
    if (length(invalid) > 0L) {
      return(paste("Invalid hex:", paste(invalid, collapse = ", ")))
    }
    fs <- self@font_style
    if (!is.na(fs) && !fs %in% c("normal", "italic")) {
      return("font_style must be 'normal', 'italic', or NA")
    }
    NULL
  }
)

#' RowCluster: row-level bindings.
#'
#' Banding mode lives here ("none", "row", "group", "group-N"); selected-edge
#' width controls the accent bar on selected rows.
#'
#' Semantic-token bundles (emphasis/muted/accent/bold/fill) are
#' RowSemantic visual presets. The painter UI applies one of them to a row
#' or cell at a time; data columns (`row_emphasis_col`, `row_bold_col`, ...)
#' do the same per-row from the data. Each bundle is a flat list of visual
#' overrides -- bg / fg / border / marker_fill / font_weight / font_style --
#' that the renderer paints when the row's flag fires.
#'
#' @usage NULL
#' @export
RowCluster <- new_class(
  "RowCluster",
  properties = list(
    base      = new_property(RowState,    default = RowState()),
    alt       = new_property(RowState,    default = RowState()),
    hover     = new_property(RowState,    default = RowState()),
    selected  = new_property(RowState,    default = RowState()),
    # Semantic visual presets (RowSemantic bundles). The painter and any
    # data-column flags pick whichever bundle is active per row or cell.
    emphasis  = new_property(RowSemantic, default = RowSemantic()),
    muted     = new_property(RowSemantic, default = RowSemantic()),
    accent    = new_property(RowSemantic, default = RowSemantic()),
    bold      = new_property(RowSemantic, default = RowSemantic()),
    fill      = new_property(RowSemantic, default = RowSemantic()),
    banding             = new_property(class_character, default = "group"),
    selected_edge_width = new_property(class_numeric,   default = 2),
    border_width        = new_property(class_numeric,   default = 1)
  ),
  validator = function(self) {
    err <- tryCatch(
      { parse_banding(self@banding); NULL },
      error = function(e) conditionMessage(e)
    )
    if (!is.null(err)) return(err)
    NULL
  }
)

#' CellCluster: cell-level bindings.
#' @usage NULL
#' @export
CellCluster <- new_class(
  "CellCluster",
  properties = list(
    bg     = new_property(class_character, default = NA_character_),
    fg     = new_property(class_character, default = NA_character_),
    border = new_property(class_character, default = NA_character_),
    text   = new_property(TextRole,        default = TextRole())
  ),
  validator = make_color_validator(c("bg", "fg", "border"))
)


# -- Tier 3: first-column cluster (variant token) ---------------------

#' FirstColumnVariant: one variant of the first-column cluster.
#' @usage NULL
#' @export
FirstColumnVariant <- new_class(
  "FirstColumnVariant",
  properties = list(
    bg     = new_property(class_character, default = NA_character_),
    fg     = new_property(class_character, default = NA_character_),
    rule   = new_property(class_character, default = NA_character_),
    weight = new_property(class_numeric,   default = NA_real_)
  ),
  validator = make_color_validator(c("bg", "fg", "rule"))
)

#' FirstColumnCluster: first-column bindings, default/bold variants.
#'
#' Excel-style emphasized first column when first_column_style = "bold".
#' The default-variant property is named `default` (matching the
#' `first_column_style` variant id). Renamed from `plain` in Sprint 1
#' PR 3 — the previous mismatch (param "default", property `plain`)
#' was a known footgun.
#'
#' @usage NULL
#' @export
FirstColumnCluster <- new_class(
  "FirstColumnCluster",
  properties = list(
    default = new_property(FirstColumnVariant, default = FirstColumnVariant()),
    bold    = new_property(FirstColumnVariant, default = FirstColumnVariant())
  )
)


# -- Tier 3: plot scaffolding -----------------------------------------

#' PlotScaffold: plot chrome (axis/tick/gridline/reference) bindings.
#'
#' `bg` NA = transparent (lets the table surface show through).
#'
#' @usage NULL
#' @export
PlotScaffold <- new_class(
  "PlotScaffold",
  properties = list(
    bg               = new_property(class_character, default = NA_character_),
    axis_line        = new_property(class_character, default = NA_character_),
    tick_mark        = new_property(class_character, default = NA_character_),
    gridline         = new_property(class_character, default = NA_character_),
    reference        = new_property(class_character, default = NA_character_),
    axis_label       = new_property(TextRole,         default = TextRole()),
    tick_label       = new_property(TextRole,         default = TextRole()),
    tick_mark_length = new_property(class_numeric,    default = 4),
    line_width       = new_property(class_numeric,    default = 1.5),
    point_size       = new_property(class_numeric,    default = 6)
  ),
  validator = make_color_validator(
    c("bg", "axis_line", "tick_mark", "gridline", "reference")
  )
)


# -- Tier 3: marks recipes -------------------------------------------

#' MarkRecipe: how one mark type consumes slot-bundle fields.
#'
#' Each property names a slot-role key ("fill", "stroke", "fill_dim", ...)
#' so the renderer can look up the actual hex when drawing each visual element.
#' v1 wires forest + summary; bar/box/violin/lollipop default to passthrough.
#'
#' @usage NULL
#' @export
MarkRecipe <- new_class(
  "MarkRecipe",
  properties = list(
    body    = new_property(class_character, default = "fill"),
    outline = new_property(class_character, default = "stroke"),
    line    = new_property(class_character, default = "stroke")
  )
)

#' MarksRecipes: per-mark-type recipes wiring slot bundles to elements.
#' @usage NULL
#' @export
MarksRecipes <- new_class(
  "MarksRecipes",
  properties = list(
    forest   = new_property(MarkRecipe, default = MarkRecipe()),
    summary  = new_property(MarkRecipe, default = MarkRecipe()),
    bar      = new_property(MarkRecipe, default = MarkRecipe()),
    box      = new_property(MarkRecipe, default = MarkRecipe()),
    violin   = new_property(MarkRecipe, default = MarkRecipe()),
    lollipop = new_property(MarkRecipe, default = MarkRecipe())
  )
)


# -- Config classes (axis + layout) --------------------------------
#
# Config (not part of the tier cascade) but lives on the theme for
# convenience. Axis controls the forest plot's x-axis range/ticks/grid;
# Layout carries plot-width and container-border settings.

#' AxisConfig: forest plot x-axis configuration.
#' @usage NULL
#' @export
AxisConfig <- new_class(
  "AxisConfig",
  properties = list(
    range_min      = new_property(class_numeric, default = NA_real_),
    range_max      = new_property(class_numeric, default = NA_real_),
    tick_count     = new_property(class_numeric, default = NA_real_),
    tick_values    = new_property(class_any,     default = NULL),
    gridlines      = new_property(class_logical, default = FALSE),
    gridline_style = new_property(class_character, default = "dotted"),
    ci_clip_factor = new_property(class_numeric, default = 2.0),
    include_null   = new_property(class_logical, default = TRUE),
    symmetric      = new_property(class_any,     default = NULL),
    null_tick      = new_property(class_logical, default = TRUE),
    marker_margin  = new_property(class_logical, default = TRUE)
  ),
  validator = function(self) {
    if (!self@gridline_style %in% c("solid", "dashed", "dotted")) {
      return("gridline_style must be 'solid', 'dashed', or 'dotted'")
    }
    NULL
  }
)

#' Layout: plot width + container border config.
#' @usage NULL
#' @export
Layout <- new_class(
  "Layout",
  properties = list(
    plot_width              = new_property(class_any,     default = "auto"),
    container_border        = new_property(class_logical, default = FALSE),
    container_border_radius = new_property(class_numeric, default = 8)
  )
)

#' BorderSpec: one named border type (thickness + style + color).
#'
#' `style = "double"` paints two parallel hairlines separated by a
#' `thickness`-sized gap. `single` paints one stroke at `thickness` px.
#' @usage NULL
#' @export
BorderSpec <- new_class(
  "BorderSpec",
  properties = list(
    thickness = new_property(class_numeric,   default = 1),
    style     = new_property(class_character, default = "single"),
    color     = new_property(class_character, default = NA_character_)
  ),
  validator = function(self) {
    if (!self@style %in% c("single", "double")) {
      return("style must be 'single' or 'double'")
    }
    NULL
  }
)

#' ThemeBorders: layout × type border model.
#'
#' `layout` controls *where* dividers appear; the three named types
#' (`major` / `minor` / `table`) control *how* they look. See the TS
#' shape `ThemeBorders` in `srcjs/src/types/theme-resolved.ts` for the
#' wire-side mirror.
#' @usage NULL
#' @export
ThemeBorders <- new_class(
  "ThemeBorders",
  properties = list(
    layout = new_property(class_character, default = "horizontal"),
    major  = new_property(BorderSpec, default = BorderSpec()),
    minor  = new_property(BorderSpec, default = BorderSpec()),
    # Table edge defaults OFF (thickness = 0) — users typically don't
    # want a frame around the chart container; the inner borders carry
    # structure. Theme authors opt in by pinning a positive thickness.
    table  = new_property(BorderSpec, default = BorderSpec(thickness = 0))
  ),
  validator = function(self) {
    if (!self@layout %in% c("horizontal", "vertical", "grid", "none")) {
      return("layout must be 'horizontal', 'vertical', 'grid', or 'none'")
    }
    NULL
  }
)


# -- Top-level WebTheme --------------------------------------------

#' WebTheme: 3-tier theme specification (v2).
#'
#' Holds Tier 1 inputs, per-table variants, all derived Tier 2 roles, and
#' Tier 3 component bindings. Tier 2/3 fields default to NA-filled empty
#' classes; the TS cascade (`buildTheme`, invoked via `resolve_from_inputs()`)
#' populates them from inputs.
#'
#' @usage NULL
#' @export
WebTheme <- new_class(
  "WebTheme",
  properties = list(
    name     = new_property(class_character, default = "default"),
    # Optional: webfonts to inject into the host document on widget mount.
    # Each entry: list(family = "Cinzel", url = "https://fonts.googleapis.com/css2?...").
    # The frontend appends a <link rel=stylesheet> per URL (deduped across
    # widgets on the same page). Theme authors are still responsible for
    # naming the family in `text$body$family` / `text$title$family`.
    # Note: rsvg/PNG export does not fetch webfonts -- the system stack
    # falls back. For high-fidelity export, install the font locally.
    web_fonts = new_property(class_list, default = list()),
    # Optional: name of the sibling theme that flips this theme's
    # light/dark mode. `NA_character_` means the theme stands alone.
    # Populated by paired presets (e.g. solarized ↔ solarized_dark).
    # Wire-only convention this round — the in-widget switcher's
    # `prefers-color-scheme` auto-mode is deferred to a follow-up.
    light_dark_pair = new_property(class_character, default = NA_character_),
    # Variants — structural per-theme choices that live alongside the
    # cascade. The TS adapter defaults headerStyle="light",
    # firstColumnStyle="default"; presets override at construction time
    # so theme identity can ride on more than just colors.
    header_style       = new_property(class_character, default = "light"),
    first_column_style = new_property(class_character, default = "default"),
    inputs   = new_property(ThemeInputs,    default = ThemeInputs()),

    # Tier 2 (derived; NA until the TS cascade runs)
    surface = new_property(Surfaces,      default = Surfaces()),
    content = new_property(Content,       default = Content()),
    divider = new_property(Dividers,      default = Dividers()),
    accent  = new_property(AccentRoles,   default = AccentRoles()),
    status   = new_property(StatusColors, default = StatusColors()),
    semantic = new_property(Semantics,    default = Semantics()),
    series  = new_property(class_list,    default = list()),
    text    = new_property(TextRoles,     default = TextRoles()),
    spacing = new_property(SpacingTokens, default = SpacingTokens()),

    # Tier 3 (component bindings)
    annotation   = new_property(AnnotationCluster, default = AnnotationCluster()),
    header       = new_property(HeaderCluster,     default = HeaderCluster()),
    column_group = new_property(ColumnGroupCluster, default = ColumnGroupCluster()),
    row_group    = new_property(RowGroupCluster,   default = RowGroupCluster()),
    row          = new_property(RowCluster,        default = RowCluster()),
    cell         = new_property(CellCluster,       default = CellCluster()),
    first_column = new_property(FirstColumnCluster, default = FirstColumnCluster()),
    plot         = new_property(PlotScaffold,      default = PlotScaffold()),
    marks        = new_property(MarksRecipes,      default = MarksRecipes()),
    axis         = new_property(AxisConfig,        default = AxisConfig()),
    layout       = new_property(Layout,            default = Layout()),
    borders      = new_property(ThemeBorders,      default = ThemeBorders())
  ),
  validator = function(self) {
    if (length(self@series) > 0L) {
      ok <- vapply(
        self@series,
        function(x) inherits(x, "tabviz::SlotRole") || S7::S7_inherits(x, SlotRole),
        logical(1)
      )
      if (!all(ok)) return("series must be a list of SlotRole objects")
    }
    if (length(self@web_fonts) > 0L) {
      bad <- which(!vapply(self@web_fonts, function(x) {
        is.list(x) &&
          all(c("family", "url") %in% names(x)) &&
          is.character(x$family) && length(x$family) == 1L && nzchar(x$family) &&
          is.character(x$url)    && length(x$url)    == 1L && nzchar(x$url) &&
          startsWith(x$url, "https://")
      }, logical(1)))
      if (length(bad) > 0L) {
        return(paste0(
          "web_fonts entries must each be a list with `family` (string) and ",
          "`url` (https:// string). Use web_font() to construct entries. ",
          "Bad entry index: ", paste(bad, collapse = ", ")
        ))
      }
    }
    NULL
  }
)

#' Construct a webfont entry for a WebTheme
#'
#' Companion helper for the `web_fonts` slot on [web_theme()]. Returns a
#' list suitable for inclusion in the theme's `web_fonts = list(...)`
#' argument. The frontend appends one `<link rel="stylesheet">` per
#' entry to `document.head` on widget mount (deduped by URL across
#' multiple widgets on a page).
#'
#' Theme authors are still responsible for referencing the loaded family
#' in `font_body` / `font_display` (etc.). `web_font()` only declares the
#' load -- it doesn't change the theme's font stacks.
#'
#' Note: PNG/SVG export through `rsvg` does not fetch webfonts. The
#' system fallback stack will be used. For high-fidelity offline export,
#' install the font locally on the rendering machine.
#'
#' @param family Display family name (e.g. `"Cinzel"`). Used for
#'   documentation and is the same string that goes into the theme's
#'   font stack.
#' @param url The full stylesheet URL to load. Must start with
#'   `"https://"` (Google Fonts, BunnyFonts, jsDelivr, etc.).
#' @return A list with two named entries (`family`, `url`).
#' @export
#' @examples
#' web_font("Cinzel", "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap")
web_font <- function(family, url) {
  checkmate::assert_string(family, min.chars = 1L)
  checkmate::assert_string(url, min.chars = 1L, pattern = "^https://")
  list(family = family, url = url)
}
