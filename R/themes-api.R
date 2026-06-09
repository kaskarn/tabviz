# User-facing theme API: web_theme() constructor + set_*() modifiers.
#
# Locked design 2026-05-28. R is the thin authoring surface; the TS
# adapter (srcjs/src/lib/theme-adapter.ts::buildTheme) is canonical for
# cascade semantics. It takes authoring inputs and emits
# the resolved theme shape the renderer consumes.

# Internal — read a flat L/C/H trio off `inputs` and emit a nested
# `list(L=, C=, H=)`. Returns NULL when all three slots are NA (anchor
# unset). `required = TRUE` skips the all-NA check (the cascade anchors
# paper/ink/brand must always emit).
triple_to_json <- function(inputs, prefix, required = FALSE) {
  L <- S7::prop(inputs, paste0(prefix, "_L"))
  C <- S7::prop(inputs, paste0(prefix, "_C"))
  H <- S7::prop(inputs, paste0(prefix, "_H"))
  if (!required && is.na(L) && is.na(C) && is.na(H)) return(NULL)
  list(L = L, C = C, H = H)
}

# Internal: serialize a ThemeInputs S7 object to the JSON shape that the
# TS adapter expects. NA fields become NULL (omitted from JSON). V4
# vocabulary: emits `anchors: { paper, ink, brand, accent? }` and
# `status: { positive?, negative?, warning?, info? }` as nested OKLCH
# triples; no `brand`/`accent`/`decorative`/`neutral_tint*` flat fields.
theme_inputs_to_json <- function(inputs) {
  stopifnot(inherits(inputs, "tabviz::ThemeInputs"))
  na_to_null <- function(v) if (length(v) == 1L && is.na(v)) NULL else v

  anchors <- list(
    paper = triple_to_json(inputs, "anchors_paper", required = TRUE),
    ink   = triple_to_json(inputs, "anchors_ink",   required = TRUE),
    brand = triple_to_json(inputs, "anchors_brand", required = TRUE),
    accent = triple_to_json(inputs, "anchors_accent")
  )
  anchors <- anchors[!vapply(anchors, is.null, logical(1))]

  status <- list(
    positive = triple_to_json(inputs, "status_positive"),
    negative = triple_to_json(inputs, "status_negative"),
    warning  = triple_to_json(inputs, "status_warning"),
    info     = triple_to_json(inputs, "status_info")
  )
  status <- status[!vapply(status, is.null, logical(1))]

  # Drop the system-ui default for fonts_body — the TS resolver supplies
  # the same fallback when fonts.body is missing (resolveTypographyInputs
  # in srcjs/src/lib/theme/typography.ts). Wire stays symmetric.
  fonts_body <- na_to_null(inputs@fonts_body)
  if (identical(fonts_body, "system-ui, -apple-system, sans-serif")) fonts_body <- NULL
  fonts <- list(
    body    = fonts_body,
    display = na_to_null(inputs@fonts_display),
    mono    = na_to_null(inputs@fonts_mono),
    numeric = na_to_null(inputs@fonts_numeric)
  )
  fonts <- fonts[!vapply(fonts, is.null, logical(1))]

  # Stage 2 typography Tier 1 — pack only non-NA values to keep the wire
  # compact. The TS resolver fills defaults (14 / 1.2 / 400-700).
  type_weights <- list(
    regular  = na_to_null(inputs@type_weights_regular),
    medium   = na_to_null(inputs@type_weights_medium),
    semibold = na_to_null(inputs@type_weights_semibold),
    bold     = na_to_null(inputs@type_weights_bold)
  )
  type_weights <- type_weights[!vapply(type_weights, is.null, logical(1))]

  curves <- list(
    neutral = na_to_null(inputs@curves_neutral),
    brand   = na_to_null(inputs@curves_brand),
    accent  = na_to_null(inputs@curves_accent)
  )
  curves <- curves[!vapply(curves, is.null, logical(1))]

  # Phase D — geometry: re-nest the flat S7 slots into nested radius +
  # border_width objects on the wire. Omit absent leaves so the TS
  # resolver applies its defaults.
  drop_null <- function(x) x[!vapply(x, is.null, logical(1))]
  geom_radius <- drop_null(list(
    sm   = na_to_null(inputs@geometry_radius_sm),
    md   = na_to_null(inputs@geometry_radius_md),
    lg   = na_to_null(inputs@geometry_radius_lg),
    pill = na_to_null(inputs@geometry_radius_pill)
  ))
  geom_bw <- drop_null(list(
    hair    = na_to_null(inputs@geometry_border_width_hair),
    thin    = na_to_null(inputs@geometry_border_width_thin),
    regular = na_to_null(inputs@geometry_border_width_regular),
    thick   = na_to_null(inputs@geometry_border_width_thick)
  ))
  geometry_out <- drop_null(list(
    radius       = if (length(geom_radius) > 0L) geom_radius else NULL,
    border_width = if (length(geom_bw) > 0L) geom_bw else NULL
  ))

  # Phase D — effects.
  # Key order is parity-load-bearing (C49): all.equal on named lists is
  # order-sensitive, so this canonical order must match the TS preset
  # literals: glass first, then glow/gradient/elevation, then chrome.
  effects_out <- drop_null(list(
    glass                    = na_to_null(inputs@effects_glass),
    glow_intensity           = na_to_null(inputs@effects_glow_intensity),
    glow_anchor              = na_to_null(inputs@effects_glow_anchor),
    gradient_shell_intensity = na_to_null(inputs@effects_gradient_shell_intensity),
    gradient_shell_angle     = na_to_null(inputs@effects_gradient_shell_angle),
    elevation                = na_to_null(inputs@effects_elevation),
    caption_style            = na_to_null(inputs@effects_caption_style),
    title_style              = na_to_null(inputs@effects_title_style)
  ))

  monochrome_out <- if (isTRUE(inputs@monochrome)) TRUE else NULL

  # Tier-2 type-role rebinds (Wave 3). The slot already holds the wire
  # shape `list(<role> = list(family=, size=, weight=))`; emit verbatim
  # (omit when empty so unedited themes carry nothing).
  type_roles_out <- if (length(inputs@type_roles) > 0L) inputs@type_roles else NULL

  marks_out <- drop_null(list(
    point_shape     = na_to_null(inputs@marks_point_shape),
    interval_weight = na_to_null(inputs@marks_interval_weight)
  ))

  # Phase 5 / Stage 1 §33 — row_kinds. Re-nest flat slots into
  # row_kinds: { data: { heightRatio }, group_header: ..., ... } on the
  # wire. Omit kinds whose heightRatio is NA so the TS layout falls back
  # to its intrinsic ratio.
  row_kinds_entry <- function(slot) {
    v <- na_to_null(S7::prop(inputs, slot))
    if (is.null(v)) return(NULL)
    list(heightRatio = v)
  }
  row_kinds_out <- drop_null(list(
    data         = row_kinds_entry("row_kinds_data_height_ratio"),
    group_header = row_kinds_entry("row_kinds_group_header_height_ratio"),
    spacer       = row_kinds_entry("row_kinds_spacer_height_ratio"),
    summary      = row_kinds_entry("row_kinds_summary_height_ratio"),
    header       = row_kinds_entry("row_kinds_header_height_ratio"),
    panel        = row_kinds_entry("row_kinds_panel_height_ratio")
  ))

  # Drop fields whose value matches the TS resolver default so the wire
  # carries only what the author/preset explicitly set. R's S7 slots
  # always have a default value (validators need one), but emitting them
  # would diverge from TS presets that simply omit unset fields.
  default_or_null <- function(v, default) {
    if (length(v) == 1L && !is.na(v) && identical(v, default)) NULL else v
  }

  out <- list(
    anchors               = anchors,
    polarity              = default_or_null(inputs@polarity, "light"),
    mode                  = default_or_null(inputs@mode, "standard"),
    categorical           = inputs@categorical,
    sequential            = default_or_null(inputs@sequential, "viridis"),
    diverging             = default_or_null(inputs@diverging, "rdbu"),
    status                = if (length(status) > 0L) status else NULL,
    fonts                 = if (length(fonts)  > 0L) fonts  else NULL,
    density               = default_or_null(inputs@density, "comfortable"),
    density_factor        = if (inputs@density_factor != 1) inputs@density_factor else NULL,
    shell_mode            = na_to_null(inputs@shell_mode),
    shell_texture         = na_to_null(inputs@shell_texture),
    slot_style            = na_to_null(inputs@slot_style),
    border_preset         = na_to_null(inputs@border_preset),
    header_style          = na_to_null(inputs@header_style),
    type_base_size        = na_to_null(inputs@type_base_size),
    type_scale_ratio      = na_to_null(inputs@type_scale_ratio),
    type_weights          = if (length(type_weights) > 0L) type_weights else NULL,
    type_roles            = type_roles_out,
    curves                = if (length(curves) > 0L) curves else NULL,
    geometry              = if (length(geometry_out) > 0L) geometry_out else NULL,
    effects               = if (length(effects_out)  > 0L) effects_out  else NULL,
    marks                 = if (length(marks_out)    > 0L) marks_out    else NULL,
    monochrome            = monochrome_out,
    row_kinds             = if (length(row_kinds_out) > 0L) row_kinds_out else NULL
  )
  out[!vapply(out, is.null, logical(1))]
}

# Internal: build a resolved WebTheme from a ThemeInputs via the TS adapter.
# `role_overrides` (settings-overhaul P0): named list of Tier-2 role pins
# (role -> list(ramp, grade)) passed through to buildTheme's options bag so
# the v4 resolve reflects spine rebinds; stored back on the S7 theme so the
# artifact round-trips.
resolve_from_inputs <- function(inputs, name = "custom", role_overrides = list(),
                                pins = list()) {
  inputs_json <- theme_inputs_to_json(inputs)
  opts <- list(name = name)
  if (length(role_overrides) > 0L) opts$roleOverrides <- role_overrides
  if (length(pins) > 0L) opts$pins <- pins
  blob <- ts_call("buildTheme", inputs_json, options = opts)
  blob$name <- name
  theme <- deserialize_resolved_theme(blob)
  theme@inputs <- inputs
  theme@role_overrides <- role_overrides
  theme@pins <- pins
  theme@name <- name
  theme
}

# Internal: re-resolve `theme` with (optionally) modified inputs /
# role_overrides / pins, carrying every unspecified artifact channel
# forward unchanged. THE one re-resolution idiom for the ~20 set_*()
# modifiers (quality review: each site hand-threaded all four arguments;
# one forgotten `pins =` is a silent artifact wipe — the exact bug class
# the final review caught on the TS side).
re_resolve <- function(theme, inputs = theme@inputs,
                       role_overrides = theme@role_overrides,
                       pins = theme@pins) {
  resolve_from_inputs(inputs, name = theme@name,
                      role_overrides = role_overrides, pins = pins)
}

# Internal: cached bindable-role roster, fetched once from the TS bundle.
.tabviz_role_roster <- new.env(parent = emptyenv())
.bindable_roles <- function() {
  if (is.null(.tabviz_role_roster$roles)) {
    .tabviz_role_roster$roles <- as.character(ts_call("listBindableRoles", list()))
  }
  .tabviz_role_roster$roles
}

# Default anchors for the clinical baseline (cyan brand). Sourced from
# R/theme-defaults.R::THEME_DEFAULTS.
DEFAULT_PAPER_ANCHOR <- list(L = THEME_DEFAULTS$paper_L,
                             C = THEME_DEFAULTS$paper_C,
                             H = THEME_DEFAULTS$paper_H)
DEFAULT_INK_ANCHOR   <- list(L = THEME_DEFAULTS$ink_L,
                             C = THEME_DEFAULTS$ink_C,
                             H = THEME_DEFAULTS$ink_H)
DEFAULT_BRAND_HEX    <- THEME_DEFAULTS$brand_hex

# Internal — pack a list(L,C,H) (or NULL) into a 3-element vector of slot
# values suitable for `S7::prop(inputs, ...) <- ...`. NULL → c(NA, NA, NA).
anchor_slots <- function(triple) {
  if (is.null(triple)) return(list(L = NA_real_, C = NA_real_, H = NA_real_))
  list(L = triple$L, C = triple$C, H = triple$H)
}

# Internal — push a coerced anchor into the three slots on `inputs`. Uses
# `S7::props<-` so all three updates apply before the validator runs; per-
# property assignment would fail on a partial all-NA write (mid-update L
# is NA while C/H are still real numbers).
set_anchor_on_inputs <- function(inputs, prefix, triple) {
  updates <- list()
  updates[[paste0(prefix, "_L")]] <- triple$L
  updates[[paste0(prefix, "_C")]] <- triple$C
  updates[[paste0(prefix, "_H")]] <- triple$H
  S7::props(inputs) <- updates
  inputs
}

#' Build a theme from V4 anchors.
#'
#' The user-authoring surface. V4 vocabulary: identity is four named OKLCH
#' anchors — `paper`, `ink`, `brand`, optional `accent`. Each accepts a
#' hex string OR an [oklch()] triple. Polarity reflection acts on each
#' anchor's L. `accent` defaults to `brand` when unset. Status anchors
#' (`status_*`) take the same hex-or-[oklch()] form.
#'
#' @examples
#' # The usual on-ramp: start from a preset, swap the brand (C56).
#' th <- set_brand(web_theme_cochrane(), "#006266")
#'
#' # Rubrication (significance stars, caption chips) follows `accent` by
#' # default; pin --tv-ink2 to make it differ from the interaction hue:
#' th <- set_pin(web_theme_cochrane(), "--tv-ink2", "#D42320")
#'
#' # Monochrome (B8): one toggle for phosphor/sepia/cyanotype themes.
#' th <- web_theme(brand = "#20C45F", polarity = "dark", monochrome = TRUE)
#'
#' # Atomic status palette (D4):
#' th <- set_status_palette(th, list(negative = "#D42320"))
#' @param paper Light-end neutral anchor (hex or [oklch()] triple). Defines
#'   surface, paper_alt, paper_raised. Default: near-white at brand hue.
#' @param ink Dark-end neutral anchor. Defines text, text-muted, text-subtle.
#' @param brand Identity hue. Drives brand_solid, brand_text, header_bg.
#' @param accent Optional engagement hue (hover/selected/callouts). NULL
#'   mirrors brand at resolution.
#' @param polarity `"light"` or `"dark"`. Polarity reflection inverts every
#'   anchor's L around the midpoint. Default `"light"`.
#' @param monochrome When `TRUE` the neutral ramp rides the brand hue with
#'   chroma shaped from brand C (B8) — phosphor / sepia / cyanotype
#'   single-hue themes in one toggle. Default `FALSE`.
#' @param mode Accessibility axis (orthogonal to polarity). One of
#'   `"standard"` / `"high-contrast"` / `"reduced-transparency"`. HC bumps
#'   border-widths +1px and drops every Phase D effect; RT keeps glow but
#'   swaps gradients to a flat surface fill. Default `"standard"`.
#' @param categorical Named data scheme reference (Okabe-Ito default).
#' @param sequential Named sequential scheme reference.
#' @param diverging Named diverging scheme reference.
#' @param status_positive,status_negative,status_warning,status_info
#'   Optional status anchor overrides (hex or [oklch()]). NULL defers to
#'   the TS resolver's defaults.
#' @param fonts_body,fonts_display,fonts_mono Font stacks. fonts_display NULL
#'   mirrors fonts_body.
#' @param fonts_numeric Dedicated figure font for number columns. NULL falls
#'   back to fonts_body (numbers follow the body font, never the mono).
#' @param density `"compact"`, `"comfortable"`, or `"spacious"`.
#' @param density_factor Continuous multiplier on the density preset's spacing,
#'   in `[0.5, 2]` (1 = preset unchanged) — a fine dial on top of the named
#'   profile (e.g. `0.9` for a touch tighter).
#' @param shell_mode Stage 2 shell/paper two-surface model. One of
#'   `"flush"` / `"raised"` / `"float"` / `"transparent"`. NULL defaults to
#'   `"flush"` at resolution.
#' @param shell_texture Stage 2 surface texture. One of `"none"` /
#'   `"ruled"` / `"grid"` / `"dotted"` / `"grain"`. NULL defaults to `"none"`.
#' @param type_base_size Stage 2 typography Tier 1 — anchor of the modular
#'   size scale (px). NULL defaults to 14.
#' @param type_scale_ratio Stage 2 typography Tier 1 — exponential ratio
#'   between scale steps. NULL defaults to 1.2.
#' @param type_weights Stage 2 typography Tier 1 — named numeric list with
#'   any of `regular`, `medium`, `semibold`, `bold`. NULL defaults to
#'   400/500/600/700.
#' @param curves Stage 1 §25 per-ramp curve shape — named list with any of
#'   `neutral`, `brand`, `accent` keyed to `"linear"` / `"ease"` / `"smooth"`
#'   / `"log"` / `"exp"`. NULL defaults: neutral=ease, brand=linear,
#'   accent=linear.
#' @param geometry Phase D GEOMETRY axis — named list with optional `radius`
#'   (named list of `sm`/`md`/`lg`/`pill` numeric px) and `border_width`
#'   (named list of `hair`/`thin`/`regular`/`thick` numeric px). Drives
#'   corner softness + line weight across the widget. NULL = TS defaults
#'   (2/6/10/999 px radius, 0.5/1/1.5/2.5 px border-width).
#' @param effects Phase D EFFECTS axis — named list with optional
#'   `glow_intensity` (`"none"` / `"subtle"` / `"neon"`), `glow_anchor`
#'   (`"brand"` / `"accent"`), `gradient_shell_intensity` (`"none"` /
#'   `"subtle"` / `"vivid"`), `gradient_shell_angle` (degrees 0-360),
#'   `elevation` (`"none"` / `"low"` / `"medium"` / `"high"`). NULL =
#'   no effects (the safe editorial baseline). HC mode drops all effects.
#' @param marks Viz-mark identity (D12): named list with `point_shape`
#'   (`"circle"`/`"square"`/`"diamond"`/`"triangle"`) and/or
#'   `interval_weight` (`"hair"`/`"regular"`/`"thick"`). Theme-level
#'   defaults; per-row and per-effect styling still win.
#' @param row_kinds Per-row-kind theme-default `heightRatio` map. Named
#'   list whose keys are row-kind names (`data`, `group_header`, `spacer`,
#'   `summary`, `header`, `panel`) and whose values are themselves
#'   named lists with `heightRatio` (numeric, multiplies the base row
#'   height). Layer 3 of the row-kind height cascade (Stage 1 §33);
#'   constructor `row_heights=` and user pins layer above this. NULL =
#'   row-kind intrinsics apply.
#' @param header_style Header chrome treatment (a structural variant
#'   input): `"light"`, `"tint"`, or
#'   `"bold"`. Default `"light"`.
#' @param border_preset Border treatment (a Tier-1 structural enum): one of
#'   `"none"`, `"hairline"`, `"ruled"`, `"frame"`, or `"boxed"`. `"frame"` is
#'   the clean journal look (top+bottom table frame). Default resolver cluster
#'   (≈ hairline) when unset.
#' @param first_column_style First (label) column treatment: `"default"`,
#'   `"tint"`, or `"bold"`. Default `"default"`.
#' @param web_fonts Optional list of [web_font()] declarations to embed.
#' @param name Theme name (string).
#' @return A fully-resolved [WebTheme].
#' @export
web_theme <- function(
    paper = NULL,
    ink = NULL,
    brand = DEFAULT_BRAND_HEX,
    accent = NULL,
    polarity = "light",
    monochrome = FALSE,
    mode = "standard",
    categorical = "okabe_ito",
    sequential = "viridis",
    diverging = "rdbu",
    status_positive = NULL,
    status_negative = NULL,
    status_warning = NULL,
    status_info = NULL,
    fonts_body = NULL,
    fonts_display = NULL,
    fonts_mono = NULL,
    fonts_numeric = NULL,
    density = "comfortable",
    density_factor = 1,
    shell_mode = NULL,
    shell_texture = NULL,
    type_base_size = NULL,
    type_scale_ratio = NULL,
    type_weights = NULL,
    curves = NULL,
    geometry = NULL,
    effects = NULL,
    marks = NULL,
    row_kinds = NULL,
    header_style = NULL,
    border_preset = NULL,
    first_column_style = "default",
    web_fonts = NULL,
    name = "custom") {
  checkmate::assert_choice(polarity, c("light", "dark"))
  checkmate::assert_flag(monochrome)
  checkmate::assert_choice(mode, c("standard", "high-contrast", "reduced-transparency"))
  checkmate::assert_string(categorical)
  checkmate::assert_choice(density, c("compact", "comfortable", "spacious"))
  checkmate::assert_number(density_factor, lower = 0.5, upper = 2)
  checkmate::assert_choice(header_style, c("light", "tint", "bold"), null.ok = TRUE)
  checkmate::assert_choice(first_column_style, c("default", "tint", "bold"))
  checkmate::assert_string(name)
  checkmate::assert_choice(shell_mode, c("flush", "raised", "float", "transparent"), null.ok = TRUE)
  checkmate::assert_choice(shell_texture, c("none", "ruled", "grid", "dotted", "grain"), null.ok = TRUE)
  checkmate::assert_number(type_base_size, lower = 8, upper = 32, null.ok = TRUE)
  checkmate::assert_number(type_scale_ratio, lower = 1.05, upper = 1.6, null.ok = TRUE)
  checkmate::assert_list(type_weights, null.ok = TRUE)
  checkmate::assert_list(curves, null.ok = TRUE)
  checkmate::assert_list(geometry, null.ok = TRUE)
  checkmate::assert_list(effects, null.ok = TRUE)
  checkmate::assert_list(marks, null.ok = TRUE)
  checkmate::assert_list(row_kinds, null.ok = TRUE)

  paper_t  <- coerce_anchor(paper, "paper")  %||% DEFAULT_PAPER_ANCHOR
  ink_t    <- coerce_anchor(ink,   "ink")    %||% DEFAULT_INK_ANCHOR
  brand_t  <- coerce_anchor(brand, "brand")
  if (is.null(brand_t)) {
    cli::cli_abort("{.arg brand} is required.")
  }
  accent_t <- coerce_anchor(accent, "accent")
  status_p <- coerce_anchor(status_positive, "status_positive")
  status_n <- coerce_anchor(status_negative, "status_negative")
  status_w <- coerce_anchor(status_warning,  "status_warning")
  status_i <- coerce_anchor(status_info,     "status_info")

  ap <- anchor_slots(paper_t);  ai <- anchor_slots(ink_t)
  ab <- anchor_slots(brand_t);  aa <- anchor_slots(accent_t)
  sp <- anchor_slots(status_p); sn <- anchor_slots(status_n)
  sw <- anchor_slots(status_w); si <- anchor_slots(status_i)

  inputs <- ThemeInputs(
    anchors_paper_L = ap$L, anchors_paper_C = ap$C, anchors_paper_H = ap$H,
    anchors_ink_L   = ai$L, anchors_ink_C   = ai$C, anchors_ink_H   = ai$H,
    anchors_brand_L = ab$L, anchors_brand_C = ab$C, anchors_brand_H = ab$H,
    anchors_accent_L = aa$L, anchors_accent_C = aa$C, anchors_accent_H = aa$H,
    polarity = polarity,
    monochrome = monochrome,
    mode = mode,
    categorical = categorical,
    sequential = sequential,
    diverging = diverging,
    status_positive_L = sp$L, status_positive_C = sp$C, status_positive_H = sp$H,
    status_negative_L = sn$L, status_negative_C = sn$C, status_negative_H = sn$H,
    status_warning_L  = sw$L, status_warning_C  = sw$C, status_warning_H  = sw$H,
    status_info_L     = si$L, status_info_C     = si$C, status_info_H     = si$H,
    fonts_body       = fonts_body       %||% "system-ui, -apple-system, sans-serif",
    fonts_display    = if (is.null(fonts_display)) NA_character_ else fonts_display,
    fonts_mono       = if (is.null(fonts_mono))    NA_character_ else fonts_mono,
    fonts_numeric    = if (is.null(fonts_numeric)) NA_character_ else fonts_numeric,
    density = density,
    density_factor = density_factor,
    shell_mode    = shell_mode    %||% NA_character_,
    header_style       = header_style %||% NA_character_,
    border_preset = border_preset %||% NA_character_,
    shell_texture = shell_texture %||% NA_character_,
    type_base_size   = type_base_size   %||% NA_real_,
    type_scale_ratio = type_scale_ratio %||% NA_real_,
    type_weights_regular  = type_weights$regular  %||% NA_real_,
    type_weights_medium   = type_weights$medium   %||% NA_real_,
    type_weights_semibold = type_weights$semibold %||% NA_real_,
    type_weights_bold     = type_weights$bold     %||% NA_real_,
    curves_neutral = curves$neutral %||% NA_character_,
    curves_brand   = curves$brand   %||% NA_character_,
    curves_accent  = curves$accent  %||% NA_character_,
    # Phase D — geometry + effects (all optional; NA = TS resolver default).
    geometry_radius_sm    = geometry$radius$sm     %||% NA_real_,
    geometry_radius_md    = geometry$radius$md     %||% NA_real_,
    geometry_radius_lg    = geometry$radius$lg     %||% NA_real_,
    geometry_radius_pill  = geometry$radius$pill   %||% NA_real_,
    geometry_border_width_hair    = geometry$border_width$hair    %||% NA_real_,
    geometry_border_width_thin    = geometry$border_width$thin    %||% NA_real_,
    geometry_border_width_regular = geometry$border_width$regular %||% NA_real_,
    geometry_border_width_thick   = geometry$border_width$thick   %||% NA_real_,
    effects_glow_intensity         = effects$glow_intensity         %||% NA_character_,
    effects_glow_anchor            = effects$glow_anchor            %||% NA_character_,
    effects_gradient_shell_intensity = effects$gradient_shell_intensity %||% NA_character_,
    effects_gradient_shell_angle   = effects$gradient_shell_angle   %||% NA_real_,
    effects_elevation              = effects$elevation              %||% NA_character_,
    effects_caption_style          = effects$caption_style          %||% NA_character_,
    effects_glass                  = effects$glass                  %||% NA_character_,

    effects_title_style            = effects$title_style            %||% NA_character_,
    marks_point_shape              = marks$point_shape              %||% NA_character_,
    marks_interval_weight          = marks$interval_weight          %||% NA_character_,
    # row_kinds — extract heightRatio per kind from the nested named list.
    row_kinds_data_height_ratio         = row_kinds$data$heightRatio         %||% NA_real_,
    row_kinds_group_header_height_ratio = row_kinds$group_header$heightRatio %||% NA_real_,
    row_kinds_spacer_height_ratio       = row_kinds$spacer$heightRatio       %||% NA_real_,
    row_kinds_summary_height_ratio      = row_kinds$summary$heightRatio      %||% NA_real_,
    row_kinds_header_height_ratio       = row_kinds$header$heightRatio       %||% NA_real_,
    row_kinds_panel_height_ratio        = row_kinds$panel$heightRatio        %||% NA_real_
  )
  theme <- resolve_from_inputs(inputs, name = name)
  theme@header_style <- header_style %||% "light"
  theme@first_column_style <- first_column_style
  if (!is.null(web_fonts)) theme@web_fonts <- web_fonts
  theme
}

# Local null-coalesce (avoids relying on rlang for this small helper).
`%||%` <- function(x, y) if (is.null(x)) y else x


# Internal — re-resolve `theme` after coercing an anchor argument and
# pinning it under `prefix`. Anchor arg may be hex, oklch() triple, or
# (for accent / status) NULL to clear.
set_anchor_and_resolve <- function(theme, prefix, value, arg_name,
                                   clearable = FALSE) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs <- theme@inputs
  triple <- if (clearable && is.null(value)) NULL else coerce_anchor(value, arg_name)
  if (!clearable && is.null(triple)) {
    cli::cli_abort("{.arg {arg_name}} must be a hex string or {.fn oklch} triple.")
  }
  slots <- anchor_slots(triple)
  inputs <- set_anchor_on_inputs(inputs, prefix, slots)
  re_resolve(theme, inputs)
}

#' Set the paper anchor on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param paper Hex string or [oklch()] triple.
#' @return The re-resolved [WebTheme].
#' @export
set_paper <- function(theme, paper) {
  set_anchor_and_resolve(theme, "anchors_paper", paper, "paper")
}

#' Set the ink anchor on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param ink Hex string or [oklch()] triple.
#' @return The re-resolved [WebTheme].
#' @export
set_ink <- function(theme, ink) {
  set_anchor_and_resolve(theme, "anchors_ink", ink, "ink")
}

#' Set the brand anchor on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param brand Hex string or [oklch()] triple.
#' @return The re-resolved [WebTheme].
#' @export
set_brand <- function(theme, brand) {
  set_anchor_and_resolve(theme, "anchors_brand", brand, "brand")
}

#' Set the accent anchor on a theme and re-resolve.
#' @param theme A [WebTheme].
#' @param accent Hex string, [oklch()] triple, or `NULL` to clear (accent
#'   then mirrors brand at resolution).
#' @return The re-resolved [WebTheme].
#' @export
set_accent <- function(theme, accent) {
  set_anchor_and_resolve(theme, "anchors_accent", accent, "accent",
                         clearable = TRUE)
}

#' Tint supporting anchors toward the brand hue and re-resolve.
#'
#' C17 (wire-audit 4d): nudges the HUE of paper / ink / accent
#' toward `brand`'s hue without touching lightness — "everything tinted
#' from one brand color" in one move. A refinement tool: the usual
#' on-ramp is still picking a preset and calling [set_brand()].
#'
#' @param theme A [WebTheme].
#' @param strength `"subtle"` (30% of the angular distance), `"medium"`
#'   (60%, default), or `"vivid"` (100% — full hue alignment).
#' @return The re-resolved [WebTheme].
#' @export
tint_from_brand <- function(theme, strength = c("medium", "subtle", "vivid")) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  strength <- match.arg(strength)
  t <- switch(strength, subtle = 0.3, medium = 0.6, vivid = 1.0)
  inputs <- theme@inputs
  brand_h <- inputs@anchors_brand_H
  toward <- function(h) {
    d <- ((brand_h - h + 540) %% 360) - 180
    ((h + d * t) %% 360 + 360) %% 360
  }
  inputs@anchors_paper_H <- toward(inputs@anchors_paper_H)
  inputs@anchors_ink_H   <- toward(inputs@anchors_ink_H)
  if (!is.na(inputs@anchors_accent_H)) {
    inputs@anchors_accent_H <- toward(inputs@anchors_accent_H)
  }
  re_resolve(theme, inputs)
}

#' Toggle monochrome (neutral ramp rides the brand hue) and re-resolve.
#'
#' B8: one switch for phosphor / sepia / cyanotype single-hue themes —
#' the neutral ramp takes the brand hue with chroma shaped from brand C.
#' @param theme A [WebTheme].
#' @param monochrome `TRUE` / `FALSE`.
#' @return The re-resolved [WebTheme].
#' @export
set_monochrome <- function(theme, monochrome = TRUE) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_flag(monochrome)
  inputs <- theme@inputs
  inputs@monochrome <- monochrome
  re_resolve(theme, inputs)
}

#' Set the theme polarity (light/dark) and re-resolve.
#'
#' Polarity is the L-reflection axis: reflecting flips paper↔ink lightness
#' around the midpoint. The orthogonal accessibility axis (mode = standard
#' / high-contrast / reduced-transparency) is plumbed separately.
#'
#' @param theme A [WebTheme].
#' @param polarity `"light"` or `"dark"`.
#' @return The re-resolved [WebTheme].
#' @export
set_polarity <- function(theme, polarity) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(polarity, c("light", "dark"))
  inputs <- theme@inputs
  inputs@polarity <- polarity
  re_resolve(theme, inputs)
}

#' Set the accessibility mode (HC / RT) and re-resolve.
#'
#' Accessibility is the axis orthogonal to polarity. High-contrast (HC)
#' bumps border-widths +1px, drops every Phase D effect, and reroutes a
#' few role bindings to higher-contrast grades. Reduced-transparency (RT)
#' keeps glow but swaps gradients to a flat surface fill.
#'
#' @param theme A [WebTheme].
#' @param mode `"standard"`, `"high-contrast"`, or `"reduced-transparency"`.
#' @return The re-resolved [WebTheme].
#' @export
set_mode <- function(theme, mode) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(mode, c("standard", "high-contrast", "reduced-transparency"))
  inputs <- theme@inputs
  inputs@mode <- mode
  re_resolve(theme, inputs)
}

#' Set the categorical data scheme and re-resolve.
#' @param theme A [WebTheme].
#' @param scheme Named scheme (`"okabe_ito"`, `"tableau10"`, `"set1"`,
#'   `"set2"`, `"dark2"`, `"paired"`, `"wong"`, `"brand_mono"`).
#' @return The re-resolved [WebTheme].
#' @export
set_categorical <- function(theme, scheme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  # Roster mirrors srcjs/src/lib/data-schemes.ts::CATEGORICAL_SCHEMES
  # (+ brand_mono special). assert_choice, not assert_string: typos used
  # to sail through silently — and until R2 the scheme was dead wire
  # anyway, so neither the typo NOR the valid name did anything.
  checkmate::assert_choice(scheme, c("okabe_ito", "neon", "ink_vermilion", "tableau10", "set1", "set2", "dark2", "paired", "wong", "brand_mono"))
  inputs <- theme@inputs
  inputs@categorical <- scheme
  re_resolve(theme, inputs)
}

#' Set the density preset (and optionally the continuous factor) and re-resolve.
#' @param theme A [WebTheme].
#' @param density `"compact"`, `"comfortable"`, or `"spacious"` (or `NULL` to
#'   keep the current preset and adjust only `factor`).
#'
#'   Note for readers comparing against the rgc_v4 design-lab screenshots
#'   (D8/D13): the lab's middle setting is named `cozy` and its loosest is
#'   `comfortable` — tabviz `comfortable` = lab `cozy` (middle), tabviz
#'   `spacious` = lab `comfortable` (loosest). Same three positions,
#'   shifted names.
#' @param factor Optional continuous multiplier on the preset's spacing, in
#'   `[0.5, 2]` (1 = preset unchanged). `NULL` keeps the current factor.
#' @return The re-resolved [WebTheme].
#' @export
set_density <- function(theme, density = NULL, factor = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs <- theme@inputs
  if (!is.null(density)) {
    checkmate::assert_choice(density, c("compact", "comfortable", "spacious"))
    inputs@density <- density
  }
  if (!is.null(factor)) {
    checkmate::assert_number(factor, lower = 0.5, upper = 2)
    inputs@density_factor <- factor
  }
  re_resolve(theme, inputs)
}

#' Set the sequential data scheme and re-resolve.
#' @param theme A [WebTheme].
#' @param scheme Named sequential scheme reference.
#' @return The re-resolved [WebTheme].
#' @export
set_sequential <- function(theme, scheme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  # Roster mirrors srcjs/src/lib/data-schemes.ts::SEQUENTIAL_SCHEMES.
  checkmate::assert_choice(scheme, c("viridis", "magma", "plasma", "blues", "greens", "greys", "oranges", "reds"))
  inputs <- theme@inputs
  inputs@sequential <- scheme
  re_resolve(theme, inputs)
}

#' Set the diverging data scheme and re-resolve.
#' @param theme A [WebTheme].
#' @param scheme Named diverging scheme reference.
#' @return The re-resolved [WebTheme].
#' @export
set_diverging <- function(theme, scheme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  # Roster mirrors srcjs/src/lib/data-schemes.ts::DIVERGING_SCHEMES.
  checkmate::assert_choice(scheme, c("rdbu", "piyg", "spectral", "brbg"))
  inputs <- theme@inputs
  inputs@diverging <- scheme
  re_resolve(theme, inputs)
}

#' Set per-ramp curve shapes and re-resolve.
#'
#' Per Stage 1 §25. Reshapes the L progression across the 11 ramp grades.
#'
#' @param theme A [WebTheme].
#' @param neutral,brand,accent One of `"linear"` / `"ease"` / `"smooth"`
#'   / `"log"` / `"exp"`, `NA` to clear (TS resolver falls back to its
#'   default: neutral=ease, brand=linear, accent=linear), or `NULL` to
#'   leave unchanged.
#' @return The re-resolved [WebTheme].
#' @export
set_curves <- function(theme, neutral = NULL, brand = NULL, accent = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  valid <- c("linear", "ease", "smooth", "log", "exp")
  na_or_choice <- function(v, arg) {
    if (is.null(v)) return(NULL)
    if (length(v) == 1L && is.na(v)) return(NA_character_)
    checkmate::assert_choice(v, valid, .var.name = arg)
    v
  }
  neutral <- na_or_choice(neutral, "neutral")
  brand   <- na_or_choice(brand,   "brand")
  accent  <- na_or_choice(accent,  "accent")
  inputs <- theme@inputs
  if (!is.null(neutral)) inputs@curves_neutral <- neutral
  if (!is.null(brand))   inputs@curves_brand   <- brand
  if (!is.null(accent))  inputs@curves_accent  <- accent
  re_resolve(theme, inputs)
}

#' Set Phase D GEOMETRY axis (radius + border-width scales) and re-resolve.
#'
#' Each of `radius` and `border_width` is a named numeric list. Missing
#' keys keep their current values; unspecified args leave everything
#' unchanged. Defaults at resolution: radius `{sm=2, md=6, lg=10, pill=999}`,
#' border_width `{hair=0.5, thin=1, regular=1.5, thick=2.5}`.
#'
#' @param theme A [WebTheme].
#' @param radius Named numeric list with any of `sm`/`md`/`lg`/`pill` (px).
#' @param border_width Named numeric list with any of `hair`/`thin`/`regular`/`thick` (px).
#' @return The re-resolved [WebTheme].
#' @export
set_geometry <- function(theme, radius = NULL, border_width = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_list(radius, types = "numeric", null.ok = TRUE)
  checkmate::assert_list(border_width, types = "numeric", null.ok = TRUE)
  inputs <- theme@inputs
  if (!is.null(radius)) {
    if (!is.null(radius$sm))   inputs@geometry_radius_sm   <- radius$sm
    if (!is.null(radius$md))   inputs@geometry_radius_md   <- radius$md
    if (!is.null(radius$lg))   inputs@geometry_radius_lg   <- radius$lg
    if (!is.null(radius$pill)) inputs@geometry_radius_pill <- radius$pill
  }
  if (!is.null(border_width)) {
    if (!is.null(border_width$hair))    inputs@geometry_border_width_hair    <- border_width$hair
    if (!is.null(border_width$thin))    inputs@geometry_border_width_thin    <- border_width$thin
    if (!is.null(border_width$regular)) inputs@geometry_border_width_regular <- border_width$regular
    if (!is.null(border_width$thick))   inputs@geometry_border_width_thick   <- border_width$thick
  }
  re_resolve(theme, inputs)
}

#' Set Phase D EFFECTS axis (glow + gradient + elevation) and re-resolve.
#'
#' Each arg accepts an enum string / numeric value, `NA` to clear back
#' to the TS resolver's default (typically `"none"` / `0`), or `NULL`
#' to leave the slot unchanged.
#'
#' @param theme A [WebTheme].
#' @param glow_intensity `"none"` / `"subtle"` / `"neon"`.
#' @param glow_anchor `"brand"` / `"accent"`.
#' @param gradient_shell_intensity `"none"` / `"subtle"` / `"vivid"`.
#' @param gradient_shell_angle Numeric in `[0, 360]` (degrees).
#' @param elevation Figure-wide depth: `"none"` / `"low"` / `"medium"` /
#'   `"high"`. Lands on the shell band under `shell_mode = "raised"`, on
#'   the paper otherwise.
#' @param glass `"none"` / `"frosted"` / `"aurora"` — glass material
#'   (B16): frosted translucent pane with bevel + sheen; aurora adds the
#'   borealis backdrop blobs. Browser-additive; SVG export renders the
#'   opaque shell.
#'   variant picker when set.
#' @param title_style `"normal"` / `"bar"` / `"underline"` — title
#'   treatment: rubrication bar ahead of the title, or brand-gradient
#'   underline beneath it.
#' @param caption_style `"none"` / `"chip"` / `"stripe"` — caption
#'   treatment above the paper (B17). `"chip"` renders the spec's
#'   `caption` label as a boxed TABLE-N stamp; `"stripe"` shows the
#'   brand-gradient seam.
#' @return The re-resolved [WebTheme].
#' @export
set_effects <- function(theme,
                        glow_intensity = NULL,
                        glow_anchor = NULL,
                        gradient_shell_intensity = NULL,
                        gradient_shell_angle = NULL,
                        elevation = NULL,
                        caption_style = NULL,
                        glass = NULL,
                        title_style = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  na_or_choice <- function(v, choices, arg) {
    if (is.null(v)) return(NULL)
    if (length(v) == 1L && is.na(v)) return(NA_character_)
    checkmate::assert_choice(v, choices, .var.name = arg)
    v
  }
  na_or_number <- function(v, lo, hi, arg) {
    if (is.null(v)) return(NULL)
    if (length(v) == 1L && is.na(v)) return(NA_real_)
    checkmate::assert_number(v, lower = lo, upper = hi, .var.name = arg)
    v
  }
  glow_intensity           <- na_or_choice(glow_intensity, c("none", "subtle", "neon"), "glow_intensity")
  glow_anchor              <- na_or_choice(glow_anchor, c("brand", "accent"), "glow_anchor")
  gradient_shell_intensity <- na_or_choice(gradient_shell_intensity, c("none", "subtle", "vivid"), "gradient_shell_intensity")
  gradient_shell_angle     <- na_or_number(gradient_shell_angle, 0, 360, "gradient_shell_angle")
  # Magnitude vocabulary (R2 decision): no words shared with shell_mode.
  elevation                <- na_or_choice(elevation, c("none", "low", "medium", "high"), "elevation")
  caption_style            <- na_or_choice(caption_style, c("none", "chip", "stripe", "both"), "caption_style")
  glass                    <- na_or_choice(glass, c("none", "frosted", "aurora"), "glass")
  title_style              <- na_or_choice(title_style, c("normal", "bar", "underline"), "title_style")
  inputs <- theme@inputs
  if (!is.null(glow_intensity))           inputs@effects_glow_intensity           <- glow_intensity
  if (!is.null(glow_anchor))              inputs@effects_glow_anchor              <- glow_anchor
  if (!is.null(gradient_shell_intensity)) inputs@effects_gradient_shell_intensity <- gradient_shell_intensity
  if (!is.null(gradient_shell_angle))     inputs@effects_gradient_shell_angle     <- gradient_shell_angle
  if (!is.null(elevation))                inputs@effects_elevation                <- elevation
  if (!is.null(caption_style))            inputs@effects_caption_style            <- caption_style
  if (!is.null(glass))                    inputs@effects_glass                    <- glass
  if (!is.null(title_style))              inputs@effects_title_style              <- title_style
  re_resolve(theme, inputs)
}

#' Set the full status palette atomically and re-resolve.
#'
#' D4 (wire-audit): the convenience verb for clobbering all four status
#' anchors in one call — unset slots CLEAR back to the curated default
#' (unlike [set_status()], which leaves unnamed slots untouched for
#' partial updates).
#'
#' @param theme A [WebTheme].
#' @param palette Named list with any of `positive` / `negative` /
#'   `warning` / `info` as hex strings or [oklch()] triples. Slots absent
#'   from the list are cleared to the TS resolver's curated defaults.
#' @return The re-resolved [WebTheme].
#' @seealso [set_status()] for partial per-slot updates.
#' @export
set_status_palette <- function(theme, palette = list()) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_list(palette)
  unknown <- setdiff(names(palette), c("positive", "negative", "warning", "info"))
  if (length(unknown) > 0) {
    cli::cli_abort("Unknown status slot{?s} in {.arg palette}: {.val {unknown}}")
  }
  args <- list(theme = theme)
  for (slot in c("positive", "negative", "warning", "info")) {
    # Named slot -> set; absent -> NA clears to the curated default.
    args[[slot]] <- if (!is.null(palette[[slot]])) palette[[slot]] else NA
  }
  do.call(set_status, args)
}

#' Set status anchor overrides (positive / negative / warning / info) and re-resolve.
#'
#' @seealso [set_status_palette()] for an atomic whole-palette clobber.
#'
#' Each arg accepts a hex string, an [oklch()] triple, `NA` (clear the
#' override; TS resolver falls back to its curated default), or `NULL`
#' (leave the slot unchanged — the default — so partial updates touch
#' only the args you pass).
#'
#' @param theme A [WebTheme].
#' @param positive,negative,warning,info Hex / [oklch()] / `NA` to clear
#'   / `NULL` to leave unchanged.
#' @return The re-resolved [WebTheme].
#' @export
set_status <- function(theme,
                       positive = NULL, negative = NULL,
                       warning = NULL, info = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  inputs <- theme@inputs
  for (pair in list(
    list(name = "positive", value = positive),
    list(name = "negative", value = negative),
    list(name = "warning",  value = warning),
    list(name = "info",     value = info)
  )) {
    if (is.null(pair$value)) next
    prefix <- paste0("status_", pair$name)
    # NA clears the override back to TS-resolver default (all three
    # L/C/H slots NA = anchor unset).
    if (length(pair$value) == 1L && is.na(pair$value)) {
      inputs <- set_anchor_on_inputs(inputs, prefix, anchor_slots(NULL))
      next
    }
    triple <- coerce_anchor(pair$value, prefix)
    inputs <- set_anchor_on_inputs(inputs, prefix, anchor_slots(triple))
  }
  re_resolve(theme, inputs)
}

#' Set per-row-kind theme-default heightRatios and re-resolve.
#'
#' Layer 3 of the row-kind height cascade (Stage 1 §33). Each arg is
#' the multiplier on the base row height for that row kind; NULL leaves
#' a kind unchanged. Constructor `row_heights=` and interactive user
#' pins layer above this, so a theme that pins `group_header = 1.3`
#' still respects per-spec overrides.
#'
#' @param theme A [WebTheme].
#' @param data,group_header,spacer,summary,header,panel Numeric
#'   `heightRatio` multipliers (typically ~0.5 to 3), or `NULL`.
#' @return The re-resolved [WebTheme].
#' @export
set_row_kinds <- function(theme,
                          data = NULL, group_header = NULL, spacer = NULL,
                          summary = NULL, header = NULL, panel = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  for (arg in list(data = data, group_header = group_header, spacer = spacer,
                   summary = summary, header = header, panel = panel)) {
    if (!is.null(arg)) checkmate::assert_number(arg, lower = 0, upper = 10)
  }
  inputs <- theme@inputs
  if (!is.null(data))         inputs@row_kinds_data_height_ratio         <- data
  if (!is.null(group_header)) inputs@row_kinds_group_header_height_ratio <- group_header
  if (!is.null(spacer))       inputs@row_kinds_spacer_height_ratio       <- spacer
  if (!is.null(summary))      inputs@row_kinds_summary_height_ratio      <- summary
  if (!is.null(header))       inputs@row_kinds_header_height_ratio       <- header
  if (!is.null(panel))        inputs@row_kinds_panel_height_ratio        <- panel
  re_resolve(theme, inputs)
}

#' Set the header chrome variant.
#'
#' `header_style` is a post-resolution variant selector (not a Tier-1 input),
#' so this assigns it directly without re-resolving the cascade. Mirrors the
#' `header_style` argument of [web_theme()].
#'
#' @param theme A [WebTheme].
#' @param header_style `"light"`, `"tint"`, or `"bold"`.
#' @return The [WebTheme] with the header variant applied.
#' @export
set_header_style <- function(theme, header_style) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  # ONE vocabulary, ONE surface (R2 decision): header_style is a
  # structural variant INPUT — this re-resolves like every input setter.
  # The old effects.header_style {normal,tint,fill} twin is gone.
  checkmate::assert_choice(header_style, c("light", "tint", "bold"))
  inputs <- theme@inputs
  inputs@header_style <- header_style
  theme <- re_resolve(theme, inputs)
  theme@header_style <- header_style
  theme
}

#' Set the border treatment preset.
#'
#' `border_preset` is a Tier-1 structural enum (settings-overhaul P0) that
#' the resolver expands into the full border cluster — the [set_header_style()]
#' precedent. For per-edge fine-tuning use [set_borders()] (raw cluster pins).
#'
#' @param theme A [WebTheme].
#' @param border_preset One of `"none"`, `"hairline"`, `"ruled"`, `"frame"`,
#'   `"boxed"`. `"hairline"` is the named form of the default treatment.
#' @return The [WebTheme] re-resolved with the preset applied.
#' @export
set_border_preset <- function(theme, border_preset) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(border_preset,
                           c("none", "hairline", "ruled", "frame", "boxed"))
  inputs <- theme@inputs
  inputs@border_preset <- border_preset
  re_resolve(theme, inputs)
}

#' Pin a Tier-2 role to a ramp grade.
#'
#' The R twin of the studio spine\'s drag-to-rebind: binds a cascade role
#' (e.g. `"row-alt-bg"`, `"text-muted"`) to a step on one of the three
#' ramps. Pins ride the theme as part of the portable artifact (the wire\'s
#' `roleOverrides`), survive every other `set_*()` re-resolve, and are what
#' the studio\'s "Copy R code" emits for rebinds.
#'
#' @param theme A [WebTheme].
#' @param role Role name. Discover valid roles with [list_roles()] (the
#'   companion roster: role, default ramp/grade, example token).
#' @param ramp One of `"neutral"`, `"brand"`, `"accent"`.
#' @param grade Integer ramp step in `1:11`.
#' @return The [WebTheme] re-resolved with the role pinned.
#' @examples
#' \dontrun{
#' web_theme_cochrane() |>
#'   set_role("text-muted", "brand", 8) |>
#'   set_role("row-alt-bg", "neutral", 2)
#' }
#' @seealso [clear_role()]
#' @export
set_role <- function(theme, role, ramp, grade) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(role, min.chars = 1)
  # Validate against the LIVE TS roster (flow review F3): an unknown or
  # off-ramp role used to silently no-op in the resolver while persisting
  # on the artifact and emitting in snippets/exports. Mirrors set_pin's
  # manifest gate; the roster comes from the bundle so it can't drift.
  roles <- .bindable_roles()
  if (!role %in% roles) {
    # Redirect non-color scale roles (Wave 3) to their focused setters
    # rather than a bare "unknown role" — list_roles() shows them but
    # set_role() is the COLOR channel (ramp+grade).
    if (role %in% .TYPE_ROLE_NAMES) {
      cli::cli_abort(c(
        "{.val {role}} is a TYPE role, not a color role.",
        "i" = "Rebind it with {.fn set_type_role} (family / size / weight)."
      ))
    }
    if (role %in% c("corners", "rules")) {
      cli::cli_abort(c(
        "{.val {role}} is a GEOMETRY role, not a color role.",
        "i" = "Set it with {.fn set_corners} / {.fn set_rules}, or {.fn web_theme}(geometry=)."
      ))
    }
    if (role == "density") {
      cli::cli_abort(c(
        "{.val density} is a spacing role, not a color role.",
        "i" = "Set it with {.fn set_density} (or {.fn web_theme}(density=))."
      ))
    }
    cli::cli_abort(c(
      "Unknown bindable role {.val {role}}.",
      "i" = "Color roles: {.val {roles}}. See {.fn list_roles} for all domains."
    ))
  }
  checkmate::assert_choice(ramp, c("neutral", "brand", "accent"))
  checkmate::assert_int(grade, lower = 1, upper = 11)
  overrides <- theme@role_overrides
  overrides[[role]] <- list(ramp = ramp, grade = as.integer(grade))
  re_resolve(theme, role_overrides = overrides)
}

# The 9 type-role names (Wave 3) — mirrors typography.ts::DEFAULT_TYPE_ROLES.
# Guarded against drift by test-parity (the roster's type rows come from TS).
.TYPE_ROLE_NAMES <- c(
  "title", "subtitle", "body", "numeric", "label",
  "caption", "footnote", "cell", "tick"
)

#' Rebind a Tier-2 TYPE role (theme-rework Wave 3).
#'
#' The type-domain twin of [set_role()]: rebinds one of the nine type roles
#' (`title`, `subtitle`, `body`, `numeric`, `label`, `caption`, `footnote`,
#' `cell`, `tick`) by overriding any subset of its `{family, size, weight}`
#' recipe. Unset arguments keep the role's default. Cascade-safe — it rides
#' the theme inputs (`type_roles`) and re-resolves. Discover roles with
#' [list_roles()] (the `domain == "type"` rows).
#'
#' @param theme A [WebTheme].
#' @param role A type role name.
#' @param family Font slot: `"display"`, `"body"`, or `"mono"`.
#' @param size Size step: one of `"label"`, `"foot"`, `"body"`, `"head"`,
#'   `"subtitle"`, `"title"`, `"display"`.
#' @param weight Weight name: `"regular"`, `"medium"`, `"semibold"`, `"bold"`.
#' @return The [WebTheme] re-resolved with the type role rebound.
#' @examples
#' \dontrun{
#' web_theme_nejm() |>
#'   set_type_role("footnote", size = "label") |>
#'   set_type_role("title", family = "display", weight = "bold")
#' }
#' @seealso [set_role()], [list_roles()]
#' @export
set_type_role <- function(theme, role, family = NULL, size = NULL, weight = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(role, .TYPE_ROLE_NAMES)
  checkmate::assert_choice(family, c("display", "body", "mono"), null.ok = TRUE)
  checkmate::assert_choice(size,
    c("label", "foot", "body", "head", "subtitle", "title", "display"), null.ok = TRUE)
  checkmate::assert_choice(weight,
    c("regular", "medium", "semibold", "bold"), null.ok = TRUE)
  if (is.null(family) && is.null(size) && is.null(weight)) {
    cli::cli_abort("Provide at least one of {.arg family}, {.arg size}, {.arg weight}.")
  }
  rec <- list(family = family, size = size, weight = weight)
  rec <- rec[!vapply(rec, is.null, logical(1))]
  inputs <- theme@inputs
  tr <- inputs@type_roles
  tr[[role]] <- modifyList(tr[[role]] %||% list(), rec)
  inputs@type_roles <- tr
  re_resolve(theme, inputs)
}

# Internal: cached geometry SLOT tables, fetched once from the TS bundle so
# the corner/rule slot values have ONE source (scale-roles.ts). Parity-
# guarded in test-theme-wire.R.
.tabviz_geom_slots <- new.env(parent = emptyenv())
.geometry_slot_tables <- function() {
  if (is.null(.tabviz_geom_slots$tables)) {
    .tabviz_geom_slots$tables <- ts_call("geometrySlotTables", list())
  }
  .tabviz_geom_slots$tables
}

#' Set the corner-radius SLOT (theme-rework Wave 3 geometry role).
#'
#' A named coarse rebind of the radius scale — `"sharp"` (square),
#' `"soft"` (the default editorial radius), or `"round"` (pill-ish). Expands
#' to the four radius stops (`sm`/`md`/`lg`/`pill`) on `theme@inputs`. For
#' fine-grained control, set `web_theme(geometry = ...)` directly.
#'
#' @param theme A [WebTheme].
#' @param slot `"sharp"`, `"soft"`, or `"round"`.
#' @return The [WebTheme] re-resolved with the corner slot applied.
#' @seealso [set_rules()], [list_roles()]
#' @export
set_corners <- function(theme, slot) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(slot, c("sharp", "soft", "round"))
  r <- .geometry_slot_tables()$corners[[slot]]
  inputs <- theme@inputs
  inputs@geometry_radius_sm   <- as.numeric(r$sm)
  inputs@geometry_radius_md   <- as.numeric(r$md)
  inputs@geometry_radius_lg   <- as.numeric(r$lg)
  inputs@geometry_radius_pill <- as.numeric(r$pill)
  re_resolve(theme, inputs)
}

#' Set the rule-weight SLOT (theme-rework Wave 3 geometry role).
#'
#' A named coarse rebind of the border-width scale — `"fine"`, `"normal"`
#' (the default), or `"strong"`. Expands to the four width stops
#' (`hair`/`thin`/`regular`/`thick`) on `theme@inputs`. For fine-grained
#' control, set `web_theme(geometry = ...)` directly.
#'
#' @param theme A [WebTheme].
#' @param slot `"fine"`, `"normal"`, or `"strong"`.
#' @return The [WebTheme] re-resolved with the rule slot applied.
#' @seealso [set_corners()], [list_roles()]
#' @export
set_rules <- function(theme, slot) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(slot, c("fine", "normal", "strong"))
  w <- .geometry_slot_tables()$rules[[slot]]
  inputs <- theme@inputs
  inputs@geometry_border_width_hair    <- as.numeric(w$hair)
  inputs@geometry_border_width_thin    <- as.numeric(w$thin)
  inputs@geometry_border_width_regular <- as.numeric(w$regular)
  inputs@geometry_border_width_thick   <- as.numeric(w$thick)
  re_resolve(theme, inputs)
}

#' Pin a component token to a direct value.
#'
#' The R twin of the studio's token-pin channel (settings-overhaul P3):
#' writes a manifest cssVar directly, overriding whatever the cascade
#' derives. Total control — the value is applied after resolution and
#' before contrast validation, and rides the portable theme artifact
#' (the wire's `pins`). Use [list_component_tokens()] to discover names.
#'
#' @param theme A [WebTheme].
#' @param css_var Manifest token name (e.g. `"--tv-text-footnote-size"`;
#'   the `--tv-` prefix may be omitted).
#' @param value CSS value string (e.g. `"0.7rem"`, `"#1a2b3c"`).
#' @return The [WebTheme] re-resolved with the token pinned.
#' @examples
#' \dontrun{
#' web_theme_nejm() |>
#'   set_pin("--tv-text-footnote-size", "0.7rem") |>
#'   set_pin("text-title-weight", "700")
#' }
#' @seealso [clear_pin()], [set_role()]
#' @export
set_pin <- function(theme, css_var, value) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(css_var, min.chars = 1)
  checkmate::assert_string(value, min.chars = 1, max.chars = 512)
  # Value grammar gate (round-2 robustness P0): structural characters in
  # a pin value can break out of CSS declarations / SVG attributes in the
  # EXPORTED artifact (a shared theme JSON or analysis script plants the
  # payload; everyone the figure is sent to is the victim). No single CSS
  # declaration value legitimately contains these; double quotes are
  # banned because they break out of double-quoted SVG attributes — use
  # single quotes for font lists.
  if (grepl('[<>{};"]|[[:cntrl:]]', value)) {
    cli::cli_abort(c(
      "Invalid {.arg value} for pin {.val {css_var}}.",
      "x" = "Pin values may not contain angle brackets, braces, semicolons, double quotes, or control characters.",
      "i" = "For font lists, use single quotes: {.code 'Inter', sans-serif}."
    ))
  }
  if (!startsWith(css_var, "--tv-")) css_var <- paste0("--tv-", css_var)
  known <- list_component_tokens()$css_var
  if (!css_var %in% known) {
    cli::cli_abort(c(
      "{.val {css_var}} is not in the component-token manifest.",
      "i" = "Use {.fn list_component_tokens} to discover token names."
    ))
  }
  # Pins-are-last-resort guidance (theme-rework Wave 1). A pin bypasses the
  # cascade: it won't reflect polarity/high-contrast and rides the exported
  # artifact as a hardcoded value. Prefer set_role() (rebind a Tier-2 role)
  # where a derived value will do. Throttled to once per session so pipe
  # chains of several set_pin() calls don't spam.
  cli::cli_warn(
    c(
      "{.fn set_pin} writes {.val {css_var}} as a hardcoded value, bypassing the cascade.",
      "i" = "Pinned tokens won't respond to polarity/high-contrast and ride the exported theme.",
      "i" = "Where a derived value will do, prefer {.fn set_role} (see {.fn list_roles})."
    ),
    .frequency = "once",
    .frequency_id = "tabviz_set_pin_last_resort"
  )
  pins <- theme@pins
  pins[[css_var]] <- value
  re_resolve(theme, pins = pins)
}

#' Release a token pin back to its derived value.
#'
#' @param theme A [WebTheme].
#' @param css_var Token previously pinned via [set_pin()].
#' @return The [WebTheme] re-resolved with the pin removed.
#' @export
clear_pin <- function(theme, css_var) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(css_var, min.chars = 1)
  if (!startsWith(css_var, "--tv-")) css_var <- paste0("--tv-", css_var)
  pins <- theme@pins
  pins[[css_var]] <- NULL
  re_resolve(theme, pins = pins)
}

#' Release a pinned role back to its cascade default.
#'
#' @param theme A [WebTheme].
#' @param role Role name previously pinned via [set_role()].
#' @return The [WebTheme] re-resolved with the pin removed.
#' @export
clear_role <- function(theme, role) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_string(role, min.chars = 1)
  overrides <- theme@role_overrides
  overrides[[role]] <- NULL
  re_resolve(theme, role_overrides = overrides)
}

#' Set the first (label) column variant.
#'
#' `first_column_style` is a post-resolution variant selector (not a Tier-1
#' input), so this assigns it directly without re-resolving. Mirrors the
#' `first_column_style` argument of [web_theme()].
#'
#' @param theme A [WebTheme].
#' @param first_column_style `"default"`, `"tint"`, or `"bold"`.
#' @return The [WebTheme] with the first-column variant applied.
#' @export
set_first_column_style <- function(theme, first_column_style) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(first_column_style, c("default", "tint", "bold"))
  theme@first_column_style <- first_column_style
  theme
}

#' Set named S7 properties on an object from a `...` list. Internal helper for
#' the batch theme setters; skips NULL args so partial updates are clean.
#' @noRd
apply_named_props <- function(obj, args) {
  for (nm in names(args)) {
    if (is.null(args[[nm]])) next
    S7::prop(obj, nm) <- args[[nm]]
  }
  obj
}

#' Update Tier-1 theme inputs and re-resolve.
#'
#' Batch setter for any [ThemeInputs] field (`brand`/`primary`, `accent`,
#' `mode`, `density`, `categorical`, `status_*`, `font_*`, ...). Cascade-aware:
#' changing an input re-runs resolution, so derived tokens refresh while
#' user pins on the resolved theme are re-applied by the resolver. For a
#' single input prefer the focused setter (`set_brand()`, `set_accent()`,
#' `set_density()`, ...); use this when changing several at once.
#'
#' @param theme A [WebTheme].
#' @param ... Named arguments matching [ThemeInputs] property names.
#' @return The re-resolved [WebTheme].
#' @export
set_inputs <- function(theme, ...) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  args <- list(...)
  inputs <- theme@inputs
  # Anchor sugar (wire-audit 6c): accept the web_theme() anchor names
  # (paper / ink / brand / accent) as hex or oklch() and expand to
  # the flat L/C/H slots — set_inputs("brand" = "#X") previously errored
  # with "Can't find property @brand" (caught by the docs render).
  for (anchor in c("paper", "ink", "brand", "accent")) {
    if (!is.null(args[[anchor]])) {
      slots <- anchor_slots(coerce_anchor(args[[anchor]], anchor))
      prefix <- paste0("anchors_", anchor)
      inputs <- set_anchor_on_inputs(inputs, prefix, slots)
      args[[anchor]] <- NULL
    }
  }
  if (length(args) > 0) inputs <- apply_named_props(inputs, args)
  re_resolve(theme, inputs)
}

#' Override density-derived spacing tokens.
#'
#' Per-token spacing overrides on top of the active density preset — set the
#' tokens you care about; the rest keep their density-preset values. `spacing`
#' is a post-resolution token block (not a Tier-1 input), so this assigns
#' directly without re-resolving the cascade.
#'
#' @param theme A [WebTheme].
#' @param ... Named numeric arguments matching [SpacingTokens] property names
#'   (`row_height`, `header_height`, `padding`, `axis_gap`, ...).
#' @return The [WebTheme] with spacing overrides applied.
#' @export
set_spacing <- function(theme, ...) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  theme@spacing <- apply_named_props(theme@spacing, list(...))
  theme
}

#' Set a single theme field by path (generic deep setter).
#'
#' Escape hatch for pinning any leaf in the resolved theme tree without a
#' dedicated setter. `path` is a character vector of property names from the
#' theme root to the leaf; integer entries index list properties (e.g.
#' `series`). Assigning under `inputs` re-resolves the cascade (the change is
#' an input); any other path is a post-resolution pin applied directly.
#'
#' @param theme A [WebTheme].
#' @param path Character (or mixed character/integer) vector from the theme
#'   root to the target leaf.
#' @param value New value for the leaf.
#' @return The [WebTheme] with the field set (re-resolved when `path` targets
#'   an input).
#' @examples
#' \dontrun{
#'   web_theme_cochrane() |> set_theme_field(c("row_group", "L1", "bg"), "#EEE")
#'   web_theme_cochrane() |> set_theme_field(c("series", 1L, "fill"), "#FF0000")
#' }
#' @export
set_theme_field <- function(theme, path, value) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  if (length(path) == 0L) {
    cli::cli_abort("{.arg path} must have at least one element.")
  }
  # A step indexes a list when it's numeric OR a numeric-looking string against
  # a bare list target. `c("series", 1L, "fill")` coerces 1L to "1", so we
  # detect index steps structurally rather than by type alone.
  is_index_step <- function(key, obj) {
    if (is.numeric(key)) return(TRUE)
    is.list(obj) && !inherits(obj, "S7_object") && grepl("^[0-9]+$", key)
  }
  set_at <- function(obj, p, v) {
    key <- p[[1]]
    if (length(p) == 1L) {
      if (is_index_step(key, obj)) {
        obj[[as.integer(key)]] <- v
        return(obj)
      }
      S7::prop(obj, key) <- v
      return(obj)
    }
    if (is_index_step(key, obj)) {
      idx <- as.integer(key)
      obj[[idx]] <- set_at(obj[[idx]], p[-1], v)
      return(obj)
    }
    S7::prop(obj, key) <- set_at(S7::prop(obj, key), p[-1], v)
    obj
  }
  theme <- set_at(theme, as.list(path), value)
  # If an input changed, re-resolve so derived tokens refresh.
  if (identical(as.character(path[[1]]), "inputs")) {
    return(re_resolve(theme))
  }
  theme
}

#' Export a theme's resolved CSS variable block.
#'
#' Returns a `:root { ... }` CSS string with `--tv-*` custom properties.
#' Useful when matching a surrounding page's chrome to a tabviz palette.
#'
#' @param theme A [WebTheme].
#' @return A character string of CSS.
#' @export
tabviz_theme_css <- function(theme) {
  if (inherits(theme, "tabviz::WebSpec")) theme <- theme@theme
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme} or {.cls WebSpec}.")
  }
  wire <- serialize_theme(theme)
  ts_call("getThemeCSS", wire)
}
