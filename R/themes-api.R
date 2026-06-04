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

  fonts <- list(
    body    = na_to_null(inputs@font_body),
    display = na_to_null(inputs@font_display),
    mono    = na_to_null(inputs@font_mono)
  )
  fonts <- fonts[!vapply(fonts, is.null, logical(1))]

  # Stage 2 typography Tier 1 — pack only non-NA values to keep the wire
  # compact. The TS resolver fills defaults (14 / 1.2 / 400-700).
  type_weights <- list(
    regular  = na_to_null(inputs@type_weight_regular),
    medium   = na_to_null(inputs@type_weight_medium),
    semibold = na_to_null(inputs@type_weight_semibold),
    bold     = na_to_null(inputs@type_weight_bold)
  )
  type_weights <- type_weights[!vapply(type_weights, is.null, logical(1))]

  curves <- list(
    neutral = na_to_null(inputs@curve_neutral),
    brand   = na_to_null(inputs@curve_brand),
    accent  = na_to_null(inputs@curve_accent)
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
  effects_out <- drop_null(list(
    glow_intensity           = na_to_null(inputs@effects_glow_intensity),
    glow_anchor              = na_to_null(inputs@effects_glow_anchor),
    gradient_shell_intensity = na_to_null(inputs@effects_gradient_shell_intensity),
    gradient_shell_angle     = na_to_null(inputs@effects_gradient_shell_angle),
    elevation                = na_to_null(inputs@effects_elevation)
  ))

  out <- list(
    anchors               = anchors,
    polarity              = inputs@polarity,
    mode                  = "standard",
    categorical           = inputs@categorical,
    sequential            = inputs@sequential,
    diverging             = inputs@diverging,
    status                = if (length(status) > 0L) status else NULL,
    fonts                 = if (length(fonts)  > 0L) fonts  else NULL,
    density               = inputs@density,
    densityFactor         = if (inputs@density_factor != 1) inputs@density_factor else NULL,
    shell_mode            = na_to_null(inputs@shell_mode),
    shell_texture         = na_to_null(inputs@shell_texture),
    type_base_size        = na_to_null(inputs@type_base_size),
    type_scale_ratio      = na_to_null(inputs@type_scale_ratio),
    type_weights          = if (length(type_weights) > 0L) type_weights else NULL,
    curves                = if (length(curves) > 0L) curves else NULL,
    geometry              = if (length(geometry_out) > 0L) geometry_out else NULL,
    effects               = if (length(effects_out)  > 0L) effects_out  else NULL
  )
  out[!vapply(out, is.null, logical(1))]
}

# Internal: build a resolved WebTheme from a ThemeInputs via the TS adapter.
resolve_from_inputs <- function(inputs, name = "custom") {
  inputs_json <- theme_inputs_to_json(inputs)
  blob <- ts_call("buildTheme", inputs_json)
  blob$name <- name
  theme <- deserialize_resolved_theme(blob)
  theme@inputs <- inputs
  theme@name <- name
  theme
}

# Default anchors for the clinical baseline (cyan brand). Drive the
# `web_theme()` defaults below + the `ThemeInputs` slot defaults — pick
# one source of truth here.
DEFAULT_PAPER_ANCHOR <- list(L = 0.987, C = 0.005, H = 235)
DEFAULT_INK_ANCHOR   <- list(L = 0.180, C = 0.010, H = 235)
DEFAULT_BRAND_HEX    <- "#0099CC"

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
#' @param paper Light-end neutral anchor (hex or [oklch()] triple). Defines
#'   surface, paper_alt, paper_raised. Default: near-white at brand hue.
#' @param ink Dark-end neutral anchor. Defines text, text-muted, text-subtle.
#' @param brand Identity hue. Drives brand_solid, brand_text, header_bg.
#' @param accent Optional engagement hue (hover/selected/callouts). NULL
#'   mirrors brand at resolution.
#' @param polarity `"light"` or `"dark"`. Polarity reflection inverts every
#'   anchor's L around the midpoint. Default `"light"`.
#' @param categorical Named data scheme reference (Okabe-Ito default).
#' @param sequential Named sequential scheme reference.
#' @param diverging Named diverging scheme reference.
#' @param status_positive,status_negative,status_warning,status_info
#'   Optional status anchor overrides (hex or [oklch()]). NULL defers to
#'   the TS resolver's defaults.
#' @param font_body,font_display,font_mono Font stacks. font_display NULL
#'   mirrors font_body.
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
#'   `elevation` (`"none"` / `"soft"` / `"raised"` / `"float"`). NULL =
#'   no effects (the safe editorial baseline). HC mode drops all effects.
#' @param header_style Header chrome treatment: `"light"`, `"tint"`, or
#'   `"bold"`. Default `"light"`.
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
    categorical = "okabe_ito",
    sequential = "viridis",
    diverging = "rdbu",
    status_positive = NULL,
    status_negative = NULL,
    status_warning = NULL,
    status_info = NULL,
    font_body = NULL,
    font_display = NULL,
    font_mono = NULL,
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
    header_style = "light",
    first_column_style = "default",
    web_fonts = NULL,
    name = "custom") {
  checkmate::assert_choice(polarity, c("light", "dark"))
  checkmate::assert_string(categorical)
  checkmate::assert_choice(density, c("compact", "comfortable", "spacious"))
  checkmate::assert_number(density_factor, lower = 0.5, upper = 2)
  checkmate::assert_choice(header_style, c("light", "tint", "bold"))
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
    categorical = categorical,
    sequential = sequential,
    diverging = diverging,
    status_positive_L = sp$L, status_positive_C = sp$C, status_positive_H = sp$H,
    status_negative_L = sn$L, status_negative_C = sn$C, status_negative_H = sn$H,
    status_warning_L  = sw$L, status_warning_C  = sw$C, status_warning_H  = sw$H,
    status_info_L     = si$L, status_info_C     = si$C, status_info_H     = si$H,
    font_body       = font_body       %||% "system-ui, -apple-system, sans-serif",
    font_display    = if (is.null(font_display)) NA_character_ else font_display,
    font_mono       = if (is.null(font_mono))    NA_character_ else font_mono,
    density = density,
    density_factor = density_factor,
    shell_mode    = shell_mode    %||% NA_character_,
    shell_texture = shell_texture %||% NA_character_,
    type_base_size   = type_base_size   %||% NA_real_,
    type_scale_ratio = type_scale_ratio %||% NA_real_,
    type_weight_regular  = type_weights$regular  %||% NA_real_,
    type_weight_medium   = type_weights$medium   %||% NA_real_,
    type_weight_semibold = type_weights$semibold %||% NA_real_,
    type_weight_bold     = type_weights$bold     %||% NA_real_,
    curve_neutral = curves$neutral %||% NA_character_,
    curve_brand   = curves$brand   %||% NA_character_,
    curve_accent  = curves$accent  %||% NA_character_,
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
    effects_elevation              = effects$elevation              %||% NA_character_
  )
  theme <- resolve_from_inputs(inputs, name = name)
  theme@header_style <- header_style
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
  resolve_from_inputs(inputs, name = theme@name)
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
  resolve_from_inputs(inputs, name = theme@name)
}

#' Deprecated alias for [set_polarity()]. The R API previously named the
#' light/dark switch `mode`; v4 reserves `mode` for the accessibility axis.
#' @param theme A [WebTheme].
#' @param mode `"light"` or `"dark"`.
#' @return The re-resolved [WebTheme].
#' @keywords internal
#' @export
set_mode <- function(theme, mode) {
  set_polarity(theme, mode)
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
  checkmate::assert_string(scheme)
  inputs <- theme@inputs
  inputs@categorical <- scheme
  resolve_from_inputs(inputs, name = theme@name)
}

#' Set the density preset (and optionally the continuous factor) and re-resolve.
#' @param theme A [WebTheme].
#' @param density `"compact"`, `"comfortable"`, or `"spacious"` (or `NULL` to
#'   keep the current preset and adjust only `factor`).
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
  resolve_from_inputs(inputs, name = theme@name)
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
  checkmate::assert_choice(header_style, c("light", "tint", "bold"))
  theme@header_style <- header_style
  theme
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
  inputs <- apply_named_props(theme@inputs, list(...))
  resolve_from_inputs(inputs, name = theme@name)
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
    return(resolve_from_inputs(theme@inputs, name = theme@name))
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
