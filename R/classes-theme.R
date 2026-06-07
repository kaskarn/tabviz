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

# Validate one OKLCH triple (L/C/H slots). Required = both NA-illegal and
# numeric-required; otherwise NA is allowed as "anchor not set" sentinel.
# Returns NULL on success, an error string on failure.
validate_oklch_triple <- function(self, prefix, required = TRUE) {
  L <- S7::prop(self, paste0(prefix, "_L"))
  C <- S7::prop(self, paste0(prefix, "_C"))
  H <- S7::prop(self, paste0(prefix, "_H"))
  all_na <- is.na(L) && is.na(C) && is.na(H)
  if (all_na) {
    if (required) {
      return(paste0(prefix, " anchor is required (L/C/H may not all be NA)"))
    }
    return(NULL)
  }
  if (is.na(L) || L < 0 || L > 1) {
    return(paste0(prefix, "_L must be a number in [0, 1], got ", L))
  }
  if (is.na(C) || C < 0 || C > 0.5) {
    return(paste0(prefix, "_C must be a number in [0, 0.5], got ", C))
  }
  if (is.na(H) || H < 0 || H >= 360) {
    return(paste0(prefix, "_H must be a number in [0, 360), got ", H))
  }
  NULL
}

#' ThemeInputs: customer-facing theme authoring surface (V4 anchors).
#'
#' The entire user authoring surface. V4 vocabulary (Stage 1 §22): identity
#' is four named OKLCH anchors (paper / ink / brand / optional accent)
#' rather than a brand hex + neutral_tint knobs. Polarity reflection acts
#' on each anchor's L; muted is a grade position on the relevant ramp.
#' Status anchors carry the same OKLCH-triple shape for coherence.
#'
#' S7 doesn't compose well with nested objects, so each triple is unrolled
#' into three flat numeric slots (`anchors_paper_L`, `anchors_paper_C`,
#' `anchors_paper_H`, ...). [theme_inputs_to_json()] re-nests them on the
#' wire so the TS resolver sees the canonical `anchors: { paper: {L,C,H},
#' ... }` shape.
#'
#' @field anchors_paper_L,anchors_paper_C,anchors_paper_H Light-end neutral
#'   anchor. Defines surface, paper_alt, paper_raised.
#' @field anchors_ink_L,anchors_ink_C,anchors_ink_H Dark-end neutral anchor.
#'   Defines text, text-muted, text-subtle.
#' @field anchors_brand_L,anchors_brand_C,anchors_brand_H Identity hue.
#'   Drives brand_solid, brand_text, header_bg.
#' @field anchors_ink2_L,anchors_ink2_C,anchors_ink2_H Optional
#'   secondary/rubrication ink anchor (B7); seeds the accent ramp with
#'   precedence over accent when set.
#' @field anchors_accent_L,anchors_accent_C,anchors_accent_H Optional
#'   engagement hue (hover/selected/callouts). All-NA = defaults to brand.
#' @field polarity `"light"` or `"dark"`. The L-reflection axis.
#' @field categorical Named data scheme reference (Okabe-Ito default).
#' @field sequential Named sequential scheme (viridis default).
#' @field diverging Named diverging scheme (rdbu default).
#' @field status_positive_L,status_positive_C,status_positive_H Status positive
#'   anchor. All-NA = TS resolver default.
#' @field status_negative_L,status_negative_C,status_negative_H Status negative.
#' @field status_warning_L,status_warning_C,status_warning_H Status warning.
#' @field status_info_L,status_info_C,status_info_H Status info.
#' @field fonts_body Font stack for body/cell/label text.
#' @field fonts_display Font stack for title/subtitle. NA mirrors fonts_body.
#' @field fonts_mono Font stack for monospace/code. Optional.
#' @field density `"compact"`, `"comfortable"`, or `"spacious"`.
#'
#' @usage NULL
#' @export
ThemeInputs <- new_class(
  "ThemeInputs",
  properties = list(
    # Tier 1 anchors — four OKLCH triples. Defaults are the clinical
    # baseline (cyan brand, off-white paper, ink-dark text); accent NA
    # mirrors brand at resolution. L in [0,1], C in [0, 0.5], H in [0,360).
    anchors_paper_L  = new_property(class_numeric, default = THEME_DEFAULTS$paper_L),
    anchors_paper_C  = new_property(class_numeric, default = THEME_DEFAULTS$paper_C),
    anchors_paper_H  = new_property(class_numeric, default = THEME_DEFAULTS$paper_H),
    anchors_ink_L    = new_property(class_numeric, default = THEME_DEFAULTS$ink_L),
    anchors_ink_C    = new_property(class_numeric, default = THEME_DEFAULTS$ink_C),
    anchors_ink_H    = new_property(class_numeric, default = THEME_DEFAULTS$ink_H),
    anchors_brand_L  = new_property(class_numeric, default = THEME_DEFAULTS$brand_L),
    anchors_brand_C  = new_property(class_numeric, default = THEME_DEFAULTS$brand_C),
    anchors_brand_H  = new_property(class_numeric, default = THEME_DEFAULTS$brand_H),
    anchors_accent_L = new_property(class_numeric, default = NA_real_),
    anchors_accent_C = new_property(class_numeric, default = NA_real_),
    anchors_accent_H = new_property(class_numeric, default = NA_real_),
    # Secondary / rubrication ink (B7). Optional; when set the TS resolver
    # seeds the accent ramp from it (precedence ink2 > accent > brand).
    anchors_ink2_L   = new_property(class_numeric, default = NA_real_),
    anchors_ink2_C   = new_property(class_numeric, default = NA_real_),
    anchors_ink2_H   = new_property(class_numeric, default = NA_real_),

    polarity        = new_property(class_character, default = "light"),
    # B8 (wire-audit 2b, D3): neutral ramp rides the brand hue (phosphor /
    # sepia / cyanotype single-hue themes). Wire + TS field: monochrome.
    monochrome      = new_property(class_logical, default = FALSE),
    # Accessibility axis — orthogonal to polarity. Standard (default),
    # high-contrast, reduced-transparency. The TS resolver branches on
    # this in 7+ places (HC bumps borders, drops effects, reroutes role
    # bindings; RT swaps gradients to solid).
    mode            = new_property(class_character, default = "standard"),

    categorical     = new_property(class_character, default = "okabe_ito"),
    sequential      = new_property(class_character, default = "viridis"),
    diverging       = new_property(class_character, default = "rdbu"),

    # Status anchors — OklchTriples; all-NA = TS resolver default.
    status_positive_L = new_property(class_numeric, default = NA_real_),
    status_positive_C = new_property(class_numeric, default = NA_real_),
    status_positive_H = new_property(class_numeric, default = NA_real_),
    status_negative_L = new_property(class_numeric, default = NA_real_),
    status_negative_C = new_property(class_numeric, default = NA_real_),
    status_negative_H = new_property(class_numeric, default = NA_real_),
    status_warning_L  = new_property(class_numeric, default = NA_real_),
    status_warning_C  = new_property(class_numeric, default = NA_real_),
    status_warning_H  = new_property(class_numeric, default = NA_real_),
    status_info_L     = new_property(class_numeric, default = NA_real_),
    status_info_C     = new_property(class_numeric, default = NA_real_),
    status_info_H     = new_property(class_numeric, default = NA_real_),

    fonts_body       = new_property(class_character,
                                    default = "system-ui, -apple-system, sans-serif"),
    fonts_display    = new_property(class_character, default = NA_character_),
    fonts_mono       = new_property(class_character, default = NA_character_),

    density         = new_property(class_character, default = "comfortable"),
    # Continuous multiplier on the density preset's spacing (fine dial atop the
    # named profile). 1 = profile unchanged. Clamped [0.5, 2] at resolution.
    density_factor  = new_property(class_numeric, default = 1),

    # Stage 2 §2 shell/paper two-surface model. One of "flush" / "raised" /
    # "float" / "transparent". NA defaults to "flush" at resolution.
    shell_mode      = new_property(class_character, default = NA_character_),
    # Stage 2 §3 surface texture. One of "none" / "ruled" / "grid" / "dotted" /
    # "grain". NA defaults to "none".
    shell_texture   = new_property(class_character, default = NA_character_),
    # Series mark fill/stroke pairing convention (studio C wiring). One of
    # "fill_with_darker_stroke" / "flat_fill" / "outlined". NA defaults to
    # "fill_with_darker_stroke" at resolution.
    slot_style      = new_property(class_character, default = NA_character_),
    # Border treatment as a Tier-1 structural enum (settings-overhaul P0).
    # The TS resolver expands it into the full T3 borders cluster (the
    # header_style precedent). One of "none" / "hairline" / "ruled" /
    # "frame" / "boxed". NA keeps the default cluster (= "hairline").
    border_preset   = new_property(class_character, default = NA_character_),

    # Stage 1 §25 / Q-P4.3 — per-ramp curve shape. Each of "linear" / "ease" /
    # "smooth" / "log" / "exp". NA defaults: neutral=ease, brand=linear,
    # accent=linear (see DEFAULT_RAMP_CURVES in lib/theme/curves.ts).
    curves_neutral  = new_property(class_character, default = NA_character_),
    curves_brand    = new_property(class_character, default = NA_character_),
    curves_accent   = new_property(class_character, default = NA_character_),

    # Stage 2 typography Tier 1 (theme-cascade-stage-2-design.md §1b).
    # Base size + ratio drive the 7-step size scale (label/foot/body/head/
    # subtitle/title/display). NA defaults to 14 / 1.2 at resolution.
    type_base_size   = new_property(class_numeric,   default = NA_real_),
    type_scale_ratio = new_property(class_numeric,   default = NA_real_),
    # Weight axis — each type role binds to one of these named weights.
    # NA defaults to 400/500/600/700 at resolution.
    type_weights_regular  = new_property(class_numeric, default = NA_real_),
    type_weights_medium   = new_property(class_numeric, default = NA_real_),
    type_weights_semibold = new_property(class_numeric, default = NA_real_),
    type_weights_bold     = new_property(class_numeric, default = NA_real_),

    # Phase D — GEOMETRY axis. Numeric scale tokens that drive corner
    # softness + line weight. Optional; all NA → TS resolver defaults
    # (2/6/10/999 px radius, 0.5/1/1.5/2.5 px border-width).
    geometry_radius_sm   = new_property(class_numeric, default = NA_real_),
    geometry_radius_md   = new_property(class_numeric, default = NA_real_),
    geometry_radius_lg   = new_property(class_numeric, default = NA_real_),
    geometry_radius_pill = new_property(class_numeric, default = NA_real_),
    geometry_border_width_hair    = new_property(class_numeric, default = NA_real_),
    geometry_border_width_thin    = new_property(class_numeric, default = NA_real_),
    geometry_border_width_regular = new_property(class_numeric, default = NA_real_),
    geometry_border_width_thick   = new_property(class_numeric, default = NA_real_),

    # Phase D — EFFECTS axis. Optional visual dramatisation knobs. Mode-
    # aware (HC drops every effect; RT keeps glow, flattens gradient).
    effects_glow_intensity         = new_property(class_character, default = NA_character_),
    effects_glow_anchor            = new_property(class_character, default = NA_character_),
    effects_gradient_shell_intensity = new_property(class_character, default = NA_character_),
    effects_gradient_shell_angle   = new_property(class_numeric,   default = NA_real_),
    effects_elevation              = new_property(class_character, default = NA_character_),
    # B17 (wire-audit 1c): caption treatment above the paper —
    # "chip" renders labels.caption as a boxed stamp; "stripe" shows
    # the brand-gradient seam.
    effects_caption_style          = new_property(class_character, default = NA_character_),
    # B12 (wire-audit 2c-i): header/title chrome as Tier-1 inputs (lab
    # vocabulary). Overrides the v3 variants picker until the wire bump.
    effects_glass                  = new_property(class_character, default = NA_character_),
    # header_style is a TOP-LEVEL structural variant input (relocated out
    # of effects per the R2 decision); slot follows the wire key 1:1.
    header_style                   = new_property(class_character, default = NA_character_),
    effects_title_style            = new_property(class_character, default = NA_character_),
    # D12 (wire-audit 1f): viz-mark identity — theme defaults for plot
    # marks (cascade: row markerStyle > effect shape > these > rotation).
    marks_point_shape              = new_property(class_character, default = NA_character_),
    marks_interval_weight          = new_property(class_character, default = NA_character_),

    # Phase 5 / Stage 1 §33 — per-row-kind theme-default heightRatios. Layer
    # 3 of the row-kind height cascade (see srcjs/src/lib/layout/
    # row-kind-heights.ts). NA = TS layout falls back to the row-kind
    # intrinsic ratio (layer 2). Authors typically pin one or two — e.g.
    # group_header = 1.3 for editorial layouts with weightier dividers.
    row_kinds_data_height_ratio         = new_property(class_numeric, default = NA_real_),
    row_kinds_group_header_height_ratio = new_property(class_numeric, default = NA_real_),
    row_kinds_spacer_height_ratio       = new_property(class_numeric, default = NA_real_),
    row_kinds_summary_height_ratio      = new_property(class_numeric, default = NA_real_),
    row_kinds_header_height_ratio       = new_property(class_numeric, default = NA_real_),
    row_kinds_panel_height_ratio        = new_property(class_numeric, default = NA_real_)
  ),
  validator = function(self) {
    for (anchor in c("anchors_paper", "anchors_ink", "anchors_brand")) {
      err <- validate_oklch_triple(self, anchor, required = TRUE)
      if (!is.null(err)) return(err)
    }
    for (anchor in c("anchors_accent", "anchors_ink2",
                     "status_positive", "status_negative",
                     "status_warning",  "status_info")) {
      err <- validate_oklch_triple(self, anchor, required = FALSE)
      if (!is.null(err)) return(err)
    }
    if (length(self@density_factor) != 1 || is.na(self@density_factor) ||
        self@density_factor < 0.5 || self@density_factor > 2) {
      return("density_factor must be a single number in [0.5, 2]")
    }
    if (!self@polarity %in% c("light", "dark")) {
      return("polarity must be 'light' or 'dark'")
    }
    if (!self@mode %in% c("standard", "high-contrast", "reduced-transparency")) {
      return("mode must be 'standard', 'high-contrast', or 'reduced-transparency'")
    }
    if (!self@density %in% c("compact", "comfortable", "spacious")) {
      return("density must be 'compact', 'comfortable', or 'spacious'")
    }
    # Phase D — geometry numeric ranges (px).
    for (slot in c("geometry_radius_sm", "geometry_radius_md",
                   "geometry_radius_lg", "geometry_radius_pill",
                   "geometry_border_width_hair", "geometry_border_width_thin",
                   "geometry_border_width_regular", "geometry_border_width_thick")) {
      v <- S7::prop(self, slot)
      if (!is.na(v) && (v < 0 || v > 999)) {
        return(paste0(slot, " must be in [0, 999], got ", v))
      }
    }
    # Phase D — effects enum validation.
    gi <- self@effects_glow_intensity
    if (!is.na(gi) && !gi %in% c("none", "subtle", "neon")) {
      return("effects_glow_intensity must be 'none', 'subtle', or 'neon'")
    }
    ga <- self@effects_glow_anchor
    if (!is.na(ga) && !ga %in% c("brand", "accent")) {
      return("effects_glow_anchor must be 'brand' or 'accent'")
    }
    gsi <- self@effects_gradient_shell_intensity
    if (!is.na(gsi) && !gsi %in% c("none", "subtle", "vivid")) {
      return("effects_gradient_shell_intensity must be 'none', 'subtle', or 'vivid'")
    }
    gsa <- self@effects_gradient_shell_angle
    if (!is.na(gsa) && (gsa < 0 || gsa > 360)) {
      return("effects_gradient_shell_angle must be in [0, 360]")
    }
    el <- self@effects_elevation
    if (!is.na(el) && !el %in% c("none", "low", "medium", "high")) {
      return("effects_elevation must be 'none', 'low', 'medium', or 'high'")
    }
    cs <- self@effects_caption_style
    if (!is.na(cs) && !cs %in% c("none", "chip", "stripe", "both")) {
      return("effects_caption_style must be 'none', 'chip', 'stripe', or 'both'")
    }
    gl <- self@effects_glass
    if (!is.na(gl) && !gl %in% c("none", "frosted", "aurora")) {
      return("effects_glass must be 'none', 'frosted', or 'aurora'")
    }
    hs <- self@header_style
    if (!is.na(hs) && !hs %in% c("light", "tint", "bold")) {
      return("header_style must be 'light', 'tint', or 'bold'")
    }
    ss <- self@slot_style
    if (!is.na(ss) && !ss %in% c("fill_with_darker_stroke", "flat_fill", "outlined")) {
      return("slot_style must be 'fill_with_darker_stroke', 'flat_fill', or 'outlined'")
    }
    bp <- self@border_preset
    if (!is.na(bp) && !bp %in% c("none", "hairline", "ruled", "frame", "boxed")) {
      return("border_preset must be 'none', 'hairline', 'ruled', 'frame', or 'boxed'")
    }
    ts2 <- self@effects_title_style
    if (!is.na(ts2) && !ts2 %in% c("normal", "bar", "underline")) {
      return("effects_title_style must be 'normal', 'bar', or 'underline'")
    }
    ps <- self@marks_point_shape
    if (!is.na(ps) && !ps %in% c("circle", "square", "diamond", "triangle")) {
      return("marks_point_shape must be 'circle', 'square', 'diamond', or 'triangle'")
    }
    iw <- self@marks_interval_weight
    if (!is.na(iw) && !iw %in% c("hair", "regular", "thick")) {
      return("marks_interval_weight must be 'hair', 'regular', or 'thick'")
    }
    # row_kinds — each heightRatio must be a positive finite number when set.
    for (slot in c("row_kinds_data_height_ratio",
                   "row_kinds_group_header_height_ratio",
                   "row_kinds_spacer_height_ratio",
                   "row_kinds_summary_height_ratio",
                   "row_kinds_header_height_ratio",
                   "row_kinds_panel_height_ratio")) {
      v <- S7::prop(self, slot)
      if (!is.na(v) && (v <= 0 || v > 10)) {
        return(paste0(slot, " must be a positive number in (0, 10], got ", v))
      }
    }
    NULL
  }
)


# -- Tier 2: chrome semantic roles ---------------------------------------

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
    title    = new_property(TextRole, default = quote(TextRole())),
    subtitle = new_property(TextRole, default = quote(TextRole())),
    body     = new_property(TextRole, default = quote(TextRole())),
    cell     = new_property(TextRole, default = quote(TextRole())),
    label    = new_property(TextRole, default = quote(TextRole())),
    tick     = new_property(TextRole, default = quote(TextRole())),
    footnote = new_property(TextRole, default = quote(TextRole())),
    caption  = new_property(TextRole, default = quote(TextRole())),
    # Phase 12: optional numeric-flavored role. NA-default; resolver
    # fills it from `body` so the wire always carries a complete TextRole.
    # Renderers consult it via `pickTextRole(col, theme)` for
    # numeric-category columns (numeric / percent / currency / pvalue /
    # interval / events / badge).
    numeric  = new_property(TextRole, default = quote(TextRole()))
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
    title    = new_property(TextRole, default = quote(TextRole())),
    subtitle = new_property(TextRole, default = quote(TextRole())),
    caption  = new_property(TextRole, default = quote(TextRole())),
    footnote = new_property(TextRole, default = quote(TextRole()))
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
    light = new_property(HeaderVariant, default = quote(HeaderVariant())),
    tint  = new_property(HeaderVariant, default = quote(HeaderVariant())),
    bold  = new_property(HeaderVariant, default = quote(HeaderVariant())),
    text  = new_property(TextRole,      default = quote(TextRole()))
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
    light = new_property(HeaderVariant, default = quote(HeaderVariant())),
    tint  = new_property(HeaderVariant, default = quote(HeaderVariant())),
    bold  = new_property(HeaderVariant, default = quote(HeaderVariant())),
    text  = new_property(TextRole,      default = quote(TextRole()))
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
    text          = new_property(TextRole,        default = quote(TextRole())),
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
    L1 = new_property(RowGroupTier, default = quote(RowGroupTier())),
    L2 = new_property(RowGroupTier, default = quote(RowGroupTier())),
    L3 = new_property(RowGroupTier, default = quote(RowGroupTier())),
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
    base      = new_property(RowState,    default = quote(RowState())),
    alt       = new_property(RowState,    default = quote(RowState())),
    hover     = new_property(RowState,    default = quote(RowState())),
    selected  = new_property(RowState,    default = quote(RowState())),
    # Semantic visual presets (RowSemantic bundles). The painter and any
    # data-column flags pick whichever bundle is active per row or cell.
    emphasis  = new_property(RowSemantic, default = quote(RowSemantic())),
    muted     = new_property(RowSemantic, default = quote(RowSemantic())),
    accent    = new_property(RowSemantic, default = quote(RowSemantic())),
    bold      = new_property(RowSemantic, default = quote(RowSemantic())),
    fill      = new_property(RowSemantic, default = quote(RowSemantic())),
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
    text   = new_property(TextRole,        default = quote(TextRole()))
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
    default = new_property(FirstColumnVariant, default = quote(FirstColumnVariant())),
    bold    = new_property(FirstColumnVariant, default = quote(FirstColumnVariant()))
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
    axis_label       = new_property(TextRole,         default = quote(TextRole())),
    tick_label       = new_property(TextRole,         default = quote(TextRole())),
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
    forest   = new_property(MarkRecipe, default = quote(MarkRecipe())),
    summary  = new_property(MarkRecipe, default = quote(MarkRecipe())),
    bar      = new_property(MarkRecipe, default = quote(MarkRecipe())),
    box      = new_property(MarkRecipe, default = quote(MarkRecipe())),
    violin   = new_property(MarkRecipe, default = quote(MarkRecipe())),
    lollipop = new_property(MarkRecipe, default = quote(MarkRecipe()))
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
    major  = new_property(BorderSpec, default = quote(BorderSpec())),
    minor  = new_property(BorderSpec, default = quote(BorderSpec())),
    # Table edge defaults OFF (thickness = 0) — users typically don't
    # want a frame around the chart container; the inner borders carry
    # structure. Theme authors opt in by pinning a positive thickness.
    table  = new_property(BorderSpec, default = quote(BorderSpec(thickness = 0)))
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
    inputs   = new_property(ThemeInputs,    default = quote(ThemeInputs())),
    # Tier-2 role pins ({ramp, grade} per role) — the studio spine's
    # drag-to-rebind state. Part of the portable theme artifact
    # (settings-overhaul P0): rides the wire as `roleOverrides`, feeds the
    # TS v4 resolve, and round-trips through R. Named list keyed by role,
    # each entry list(ramp = <chr>, grade = <int 1..11>). Empty = defaults.
    role_overrides = new_property(class_list, default = list()),

    # Tier 2 (derived; NA until the TS cascade runs)
    # Note: surface/content/divider chrome slots were dropped in the
    # V3→V4 cutover. Callers read those values via `theme_css_vars(theme)`
    # — `--tv-surface-bg`, `--tv-text`, `--tv-border`, `--tv-cell-border`, etc.
    accent  = new_property(AccentRoles,   default = quote(AccentRoles())),
    status   = new_property(StatusColors, default = quote(StatusColors())),
    semantic = new_property(Semantics,    default = quote(Semantics())),
    series  = new_property(class_list,    default = list()),
    text    = new_property(TextRoles,     default = quote(TextRoles())),
    spacing = new_property(SpacingTokens, default = quote(SpacingTokens())),

    # Tier 3 (component bindings)
    annotation   = new_property(AnnotationCluster, default = quote(AnnotationCluster())),
    header       = new_property(HeaderCluster,     default = quote(HeaderCluster())),
    column_group = new_property(ColumnGroupCluster, default = quote(ColumnGroupCluster())),
    row_group    = new_property(RowGroupCluster,   default = quote(RowGroupCluster())),
    row          = new_property(RowCluster,        default = quote(RowCluster())),
    cell         = new_property(CellCluster,       default = quote(CellCluster())),
    first_column = new_property(FirstColumnCluster, default = quote(FirstColumnCluster())),
    plot         = new_property(PlotScaffold,      default = quote(PlotScaffold())),
    marks        = new_property(MarksRecipes,      default = quote(MarksRecipes())),
    axis         = new_property(AxisConfig,        default = quote(AxisConfig())),
    layout       = new_property(Layout,            default = quote(Layout())),
    borders      = new_property(ThemeBorders,      default = quote(ThemeBorders()))
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
#' in `fonts_body` / `fonts_display` (etc.). `web_font()` only declares the
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
