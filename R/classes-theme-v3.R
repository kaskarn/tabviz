# Theme V3 R-side classes — the rationalized theme surface.
#
# Lives alongside legacy V2 classes during the rationalization arc
# (PRs A-I). PR I deletes V2 and drops the V3 suffix. See
# `~/.claude/plans/theme-rationalization.md`.
#
# PR A scope: ThemeInputsV3 S7 class only. Consumer wiring (modifiers,
# serializer, etc.) lands in PR F.

#' ThemeInputsV3: T1 customer-facing inputs for the rationalized theme.
#'
#' The entire user-authoring surface. Everything else (T0 ramps, T2
#' tokens, paint roles, clusters, data palettes) derives from these
#' inputs via the TS resolver in `srcjs/src/lib/theme-resolve-v3.ts`.
#'
#' Locked design 2026-05-28 (see
#' `~/.claude/projects/-Users-antoine-dev-r-forest/memory/project_theme_rationalization.md`).
#'
#' @field brand          Required. Brand seed hex; powers brand ramp + identity tokens.
#' @field accent         Engagement seed hex (hover/selected/callouts). NA -> mirrors brand.
#' @field decorative     Optional 2nd color for two-color editorial themes. Drives
#'                       `decorative_subtle`/`decorative_chrome` (alt-row tint, divider hue,
#'                       row-group L1 band). Does NOT drive text or marks. NA -> not set.
#' @field mode           "light" or "dark". Inverts neutral ramp direction.
#' @field neutral_tint   "untinted" | "brand" | "accent" | "decorative" | a hex string.
#'                       Blends a small fraction of a hue into low-chroma ramp ends.
#' @field categorical    Named categorical scheme reference (Okabe-Ito default; PR E wires registry).
#' @field sequential     Named sequential scheme reference (viridis default).
#' @field diverging      Named diverging scheme reference (rdbu default).
#' @field status_positive  Optional status color overrides. NA -> defaults.
#' @field status_negative
#' @field status_warning
#' @field status_info
#' @field font_body      Font stack for body/cell/label text.
#' @field font_display   Font stack for title/subtitle. NA -> mirrors font_body.
#' @field font_mono      Font stack for monospace/code. NA -> NULL on wire.
#' @field density        Density preset: "compact", "comfortable", "spacious".
#'
#' @usage NULL
#' @export
ThemeInputsV3 <- new_class(
  "ThemeInputsV3",
  properties = list(
    brand        = new_property(class_character, default = "#0099CC"),
    accent       = new_property(class_character, default = NA_character_),
    decorative   = new_property(class_character, default = NA_character_),
    mode         = new_property(class_character, default = "light"),
    neutral_tint = new_property(class_character, default = "untinted"),

    categorical  = new_property(class_character, default = "okabe_ito"),
    sequential   = new_property(class_character, default = "viridis"),
    diverging    = new_property(class_character, default = "rdbu"),

    status_positive = new_property(class_character, default = "#3F7D3F"),
    status_negative = new_property(class_character, default = "#B33A3A"),
    status_warning  = new_property(class_character, default = "#C68A2E"),
    status_info     = new_property(class_character, default = "#1F77B4"),

    font_body    = new_property(class_character,
                                 default = "system-ui, -apple-system, sans-serif"),
    font_display = new_property(class_character, default = NA_character_),
    font_mono    = new_property(class_character, default = NA_character_),

    density      = new_property(class_character, default = "comfortable")
  ),
  validator = function(self) {
    # brand is required and must be a hex.
    if (!grepl(hex_pattern, self@brand)) {
      return(paste0("brand must be a hex color, got '", self@brand, "'"))
    }
    # Optional hex fields.
    for (p in c("accent", "decorative", "status_positive", "status_negative",
                "status_warning", "status_info")) {
      v <- S7::prop(self, p)
      if (!is.na(v) && !grepl(hex_pattern, v)) {
        return(paste0(p, " must be a hex color or NA, got '", v, "'"))
      }
    }
    # neutral_tint: enum OR a hex string.
    nt <- self@neutral_tint
    if (!nt %in% c("untinted", "brand", "accent", "decorative") &&
        !grepl(hex_pattern, nt)) {
      return(paste0(
        "neutral_tint must be 'untinted', 'brand', 'accent', 'decorative', ",
        "or a hex color, got '", nt, "'"
      ))
    }
    # Enums.
    if (!self@mode %in% c("light", "dark")) {
      return("mode must be 'light' or 'dark'")
    }
    if (!self@density %in% c("compact", "comfortable", "spacious")) {
      return("density must be 'compact', 'comfortable', or 'spacious'")
    }
    NULL
  }
)

#' Convert a ThemeInputsV3 S7 object to a JSON-ready list (TS resolver shape).
#'
#' Used by `resolve_theme_v3()` (PR F) to ship inputs to the TS resolver
#' via the V8 bridge. Field names are camelCased to match `ThemeInputsV3`
#' in `srcjs/src/types/theme-v3.ts`. NA values become NULL.
#'
#' @param inputs A [ThemeInputsV3] S7 object.
#' @return A named list suitable for `jsonlite::toJSON`.
#' @noRd
theme_inputs_v3_to_json <- function(inputs) {
  stopifnot(inherits(inputs, "tabviz::ThemeInputsV3"))
  na_to_null <- function(v) if (length(v) == 1L && is.na(v)) NULL else v

  status <- list(
    positive = na_to_null(inputs@status_positive),
    negative = na_to_null(inputs@status_negative),
    warning  = na_to_null(inputs@status_warning),
    info     = na_to_null(inputs@status_info)
  )
  status <- status[!vapply(status, is.null, logical(1))]

  fonts <- list(
    body    = na_to_null(inputs@font_body),
    display = na_to_null(inputs@font_display),
    mono    = na_to_null(inputs@font_mono)
  )
  fonts <- fonts[!vapply(fonts, is.null, logical(1))]

  # neutral_tint is either an enum string or a hex; the TS shape distinguishes
  # via tagged object `{ hex: "..." }` for hex values.
  neutral_tint_out <- if (inputs@neutral_tint %in%
                          c("untinted", "brand", "accent", "decorative")) {
    inputs@neutral_tint
  } else {
    list(hex = inputs@neutral_tint)
  }

  out <- list(
    brand        = inputs@brand,
    accent       = na_to_null(inputs@accent),
    decorative   = na_to_null(inputs@decorative),
    mode         = inputs@mode,
    neutral_tint = neutral_tint_out,
    categorical  = inputs@categorical,
    sequential   = inputs@sequential,
    diverging    = inputs@diverging,
    status       = if (length(status) > 0L) status else NULL,
    fonts        = if (length(fonts)  > 0L) fonts  else NULL,
    density      = inputs@density
  )
  out[!vapply(out, is.null, logical(1))]
}
