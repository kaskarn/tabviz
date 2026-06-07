# Theme-wire import: the inverse of theme_inputs_to_json().
#
# The canonical portable theme artifact is the WIRE ENVELOPE
# `{ $schema, name, inputs, roleOverrides }` (settings-overhaul P0) — what
# the studio's Copy JSON / Download / studio_done emit, and what both
# surfaces' exports share. This module re-hydrates it into the R authoring
# surface: nested wire `inputs` -> flat ThemeInputs S7 slots, plus
# `roleOverrides` -> the role_overrides list.
#
# Tolerant by design: unknown wire keys are ignored (newer studio, older
# R), absent keys leave the S7 defaults in place (= TS resolver defaults).

# ── Role-override named-alias projection (theme-rework Wave 0) ───────────
# The portable wire serializes role bindings as stable NAME aliases
# ("neutral.5") rather than positional {ramp,grade} coordinates — DTCG-
# shaped + re-index-migratable. The R authoring surface keeps coordinate
# lists internally (set_role(role, ramp, grade)); these translate at the
# wire boundary. Readers accept BOTH forms (one-way migration: old files
# keep importing). Mirrors srcjs/src/lib/theme/alias.ts.
.ROLE_RAMPS <- c("neutral", "brand", "accent")

# WRITER: named role-override list -> {role: "ramp.grade"} for the wire.
.role_overrides_to_aliases <- function(ro) {
  if (length(ro) == 0L) return(stats::setNames(list(), character(0)))
  lapply(ro, function(b) paste0(b$ramp, ".", b$grade))
}

# Parse one wire entry (alias string OR {ramp,grade} list) -> coordinate
# list, or NULL if malformed.
.normalize_binding <- function(entry) {
  if (is.character(entry) && length(entry) == 1L) {
    dot <- regexpr("\\.[^.]*$", entry)
    if (dot < 2L) return(NULL)
    ramp <- substr(entry, 1L, dot - 1L)
    grade <- suppressWarnings(as.integer(substr(entry, dot + 1L, nchar(entry))))
    if (!ramp %in% .ROLE_RAMPS || is.na(grade) || grade < 1L || grade > 11L) return(NULL)
    return(list(ramp = ramp, grade = grade))
  }
  if (is.list(entry) && !is.null(entry$ramp) && !is.null(entry$grade)) {
    return(list(ramp = as.character(entry$ramp), grade = as.integer(entry$grade)))
  }
  NULL
}

# READER: a roleOverrides map in EITHER form -> coordinate list (drops
# malformed entries).
.normalize_role_overrides <- function(raw) {
  if (length(raw) == 0L) return(stats::setNames(list(), character(0)))
  out <- list()
  for (role in names(raw)) {
    b <- .normalize_binding(raw[[role]])
    if (!is.null(b)) out[[role]] <- b
  }
  out
}

# Internal — write a nested L/C/H triple into the flat slots for `prefix`.
.wire_triple_to_slots <- function(values, x, prefix) {
  t <- x
  if (is.null(t)) return(values)
  values[[paste0(prefix, "_L")]] <- as.numeric(t[["L"]] %||% NA_real_)
  values[[paste0(prefix, "_C")]] <- as.numeric(t[["C"]] %||% NA_real_)
  values[[paste0(prefix, "_H")]] <- as.numeric(t[["H"]] %||% NA_real_)
  values
}

# Internal — scalar wire field -> slot value, keeping the slot's NA type.
.wire_chr <- function(x) if (is.null(x)) NA_character_ else as.character(x)
.wire_num <- function(x) if (is.null(x)) NA_real_ else as.numeric(x)

#' Re-hydrate ThemeInputs from the wire `inputs` object
#'
#' Inverse of the internal `theme_inputs_to_json()`. Accepts the nested
#' wire shape (`anchors: {paper: {L,C,H}, ...}`, `fonts: {...}`,
#' `geometry: {radius: {...}, border_width: {...}}`, ...) as produced by
#' the studio export / `studio_done`, and packs it into the flat
#' [ThemeInputs] S7 slots.
#'
#' @param wire_inputs A named list — the `inputs` member of a theme wire
#'   envelope (already parsed from JSON, `simplifyVector = FALSE`).
#' @return A [ThemeInputs] object.
#' @keywords internal
theme_inputs_from_wire <- function(wire_inputs) {
  # EXACT [[ ]] access only — `$` partial matching is a live trap here:
  # a wire with `density_factor` but no `density` made w$density return
  # the factor (0.97), which then failed the density enum validator
  # (caught by the ledger preset in the fixpoint gate).
  w <- wire_inputs %||% list()
  v <- list()

  # Anchors (paper/ink/brand required on the wire; accent optional).
  a <- w[["anchors"]] %||% list()
  v <- .wire_triple_to_slots(v, a[["paper"]],  "anchors_paper")
  v <- .wire_triple_to_slots(v, a[["ink"]],    "anchors_ink")
  v <- .wire_triple_to_slots(v, a[["brand"]],  "anchors_brand")
  v <- .wire_triple_to_slots(v, a[["accent"]], "anchors_accent")

  # Status anchors.
  st <- w[["status"]] %||% list()
  v <- .wire_triple_to_slots(v, st[["positive"]], "status_positive")
  v <- .wire_triple_to_slots(v, st[["negative"]], "status_negative")
  v <- .wire_triple_to_slots(v, st[["warning"]],  "status_warning")
  v <- .wire_triple_to_slots(v, st[["info"]],     "status_info")

  # Scalars with S7 defaults: only set when present on the wire so the
  # constructor defaults (= TS resolver defaults) hold otherwise.
  if (!is.null(w[["polarity"]]))    v$polarity    <- as.character(w[["polarity"]])
  if (!is.null(w[["mode"]]))        v$mode        <- as.character(w[["mode"]])
  if (!is.null(w[["categorical"]])) v$categorical <- as.character(w[["categorical"]])
  if (!is.null(w[["sequential"]]))  v$sequential  <- as.character(w[["sequential"]])
  if (!is.null(w[["diverging"]]))   v$diverging   <- as.character(w[["diverging"]])
  if (!is.null(w[["density"]]))     v$density     <- as.character(w[["density"]])
  if (!is.null(w[["density_factor"]])) v$density_factor <- as.numeric(w[["density_factor"]])
  if (isTRUE(w[["monochrome"]]))    v$monochrome  <- TRUE

  # NA-defaulted scalars.
  v$shell_mode    <- .wire_chr(w[["shell_mode"]])
  v$shell_texture <- .wire_chr(w[["shell_texture"]])
  v$slot_style    <- .wire_chr(w[["slot_style"]])
  v$border_preset <- .wire_chr(w[["border_preset"]])
  v$header_style  <- .wire_chr(w[["header_style"]])
  v$type_base_size   <- .wire_num(w[["type_base_size"]])
  v$type_scale_ratio <- .wire_num(w[["type_scale_ratio"]])

  # Fonts.
  f <- w[["fonts"]] %||% list()
  v$fonts_body    <- .wire_chr(f[["body"]])
  v$fonts_display <- .wire_chr(f[["display"]])
  v$fonts_mono    <- .wire_chr(f[["mono"]])

  # Type weights.
  tw <- w[["type_weights"]] %||% list()
  v$type_weights_regular  <- .wire_num(tw[["regular"]])
  v$type_weights_medium   <- .wire_num(tw[["medium"]])
  v$type_weights_semibold <- .wire_num(tw[["semibold"]])
  v$type_weights_bold     <- .wire_num(tw[["bold"]])

  # Curves.
  cv <- w[["curves"]] %||% list()
  v$curves_neutral <- .wire_chr(cv[["neutral"]])
  v$curves_brand   <- .wire_chr(cv[["brand"]])
  v$curves_accent  <- .wire_chr(cv[["accent"]])

  # Geometry.
  g <- w[["geometry"]] %||% list()
  gr <- g[["radius"]] %||% list()
  v$geometry_radius_sm   <- .wire_num(gr[["sm"]])
  v$geometry_radius_md   <- .wire_num(gr[["md"]])
  v$geometry_radius_lg   <- .wire_num(gr[["lg"]])
  v$geometry_radius_pill <- .wire_num(gr[["pill"]])
  gb <- g[["border_width"]] %||% list()
  v$geometry_border_width_hair    <- .wire_num(gb[["hair"]])
  v$geometry_border_width_thin    <- .wire_num(gb[["thin"]])
  v$geometry_border_width_regular <- .wire_num(gb[["regular"]])
  v$geometry_border_width_thick   <- .wire_num(gb[["thick"]])

  # Effects.
  fx <- w[["effects"]] %||% list()
  v$effects_glass                    <- .wire_chr(fx[["glass"]])
  v$effects_glow_intensity           <- .wire_chr(fx[["glow_intensity"]])
  v$effects_glow_anchor              <- .wire_chr(fx[["glow_anchor"]])
  v$effects_gradient_shell_intensity <- .wire_chr(fx[["gradient_shell_intensity"]])
  v$effects_gradient_shell_angle     <- .wire_num(fx[["gradient_shell_angle"]])
  v$effects_elevation                <- .wire_chr(fx[["elevation"]])
  v$effects_caption_style            <- .wire_chr(fx[["caption_style"]])
  v$effects_title_style              <- .wire_chr(fx[["title_style"]])

  # Marks.
  mk <- w[["marks"]] %||% list()
  v$marks_point_shape     <- .wire_chr(mk[["point_shape"]])
  v$marks_interval_weight <- .wire_chr(mk[["interval_weight"]])

  # Row kinds.
  rk <- w[["row_kinds"]] %||% list()
  rk_ratio <- function(kind) {
    e <- rk[[kind]]
    if (is.null(e)) NA_real_ else .wire_num(e$heightRatio)
  }
  v$row_kinds_data_height_ratio         <- rk_ratio("data")
  v$row_kinds_group_header_height_ratio <- rk_ratio("group_header")
  v$row_kinds_spacer_height_ratio       <- rk_ratio("spacer")
  v$row_kinds_summary_height_ratio      <- rk_ratio("summary")
  v$row_kinds_header_height_ratio       <- rk_ratio("header")
  v$row_kinds_panel_height_ratio        <- rk_ratio("panel")

  do.call(ThemeInputs, v)
}

#' Re-hydrate a WebTheme from a theme wire envelope
#'
#' Accepts the canonical portable artifact
#' `{ $schema, name, inputs, roleOverrides }` (the shape every studio
#' export emits) and resolves it into a full [WebTheme] via the TS cascade.
#'
#' @param wire A named list (parsed JSON envelope) or a JSON string.
#' @return A [WebTheme].
#' @export
theme_from_wire <- function(wire) {
  if (is.character(wire) && length(wire) == 1L) {
    wire <- jsonlite::fromJSON(wire, simplifyVector = FALSE,
                               simplifyDataFrame = FALSE)
  }
  checkmate::assert_list(wire)
  if (!is.null(wire[["$schema"]]) &&
      !identical(wire[["$schema"]], "tabviz-theme/v4")) {
    cli::cli_warn("Unknown theme wire schema {.val {wire[['$schema']]}}; attempting import anyway.")
  }
  inputs <- theme_inputs_from_wire(wire[["inputs"]])
  name <- wire[["name"]] %||% "imported"
  # Accept name-alias OR legacy coordinate form (Wave 0 migration).
  overrides <- .normalize_role_overrides(wire[["roleOverrides"]])
  pins <- wire[["pins"]] %||% list()
  # Pin value grammar gate (round-2 robustness P0): a wire envelope is
  # UNTRUSTED input — a colleague-shared file with a hostile pin value
  # must abort here, not ride into exported SVG attributes. Same rule as
  # set_pin() / the TS importers.
  for (nm in names(pins)) {
    v <- pins[[nm]]
    if (!is.character(v) || length(v) != 1L || nchar(v) > 512L ||
        grepl('[<>{};"]|[[:cntrl:]]', v)) {
      cli::cli_abort(c(
        "Invalid pin value for {.val {nm}} in theme wire.",
        "x" = "Pin values may not contain angle brackets, braces, semicolons, double quotes, or control characters."
      ))
    }
  }
  # Pins-are-last-resort lint (theme-rework Wave 1): an imported envelope
  # that pins tokens arrives with cascade-bypassing values. Surface it so a
  # polarity-unresponsive theme doesn't load silently.
  if (length(pins) > 0L) {
    cli::cli_warn(c(
      "Imported theme {.val {name}} pins {length(pins)} token{?s} directly.",
      "i" = "Pinned tokens bypass the cascade and may not respond to polarity/high-contrast."
    ))
  }
  resolve_from_inputs(inputs, name = name, role_overrides = overrides, pins = pins)
}
