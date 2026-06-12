# Journal preset constructors + the canonical dark mode + the package
# preset registry.
#
# V4 (2026-06-04): anchors vocabulary. Each preset declares a brand hex
# plus optional accent / polarity / paper-ink derivations and passes
# them via the TS `defineInputs` literals (now the single source —
# srcjs/src/lib/theme/theme-presets-inputs.ts). The helper returns
# paper / ink / brand / accent OKLCH triples ready to forward to
# [web_theme()]. The preset's full Stage 2/3 personality (typography,
# shell mode, surface texture, density factor, per-ramp curves) layers
# on top via the rest of the `web_theme()` args.

# Paper / ink L defaults sourced from R/theme-defaults.R (the R-side
# default-value registry). Mirrors DEFAULT_PAPER_L / DEFAULT_INK_L in
# theme-presets-inputs.ts.
PRESET_PAPER_L <- THEME_DEFAULTS$paper_L
PRESET_INK_L   <- THEME_DEFAULTS$ink_L

# ── Preset generation (2026-06-11, propagation-readiness flag #2) ─────
# The nine preset constructors are GENERATED from the TS literals
# (srcjs/src/lib/theme/theme-presets-inputs.ts) via the inputsForPreset
# V8 helper — the hand-mirrored R bodies cost 2x per theme change and
# the two construction idioms drifted stylistically.
# theme_inputs_from_wire() round-trips all nine presets VALUE-IDENTICAL
# (fixpoint-verified across every field, tolerance 1e-9, 2026-06-11),
# so the TS literal is now the single source of truth. Inputs are
# cached per session; resolution work dominates the one V8 fetch.
.preset_inputs_cache <- new.env(parent = emptyenv())

.theme_from_preset <- function(name) {
  inputs <- get0(name, envir = .preset_inputs_cache, inherits = FALSE)
  if (is.null(inputs)) {
    inputs <- theme_inputs_from_wire(ts_call("inputsForPreset", name))
    assign(name, inputs, envir = .preset_inputs_cache)
  }
  th <- resolve_from_inputs(inputs, name = name)
  # Web fonts are THEME-level (not inputs) and the URL table is TS-owned
  # (preset-web-fonts.ts) — fetch through the same V8 seam so npm and R
  # presets load identical fonts.
  wf <- get0(paste0(name, ".webfonts"), envir = .preset_inputs_cache, inherits = FALSE)
  if (is.null(wf)) {
    raw <- tryCatch(ts_call("presetWebFonts", name), error = function(e) list())
    wf <- lapply(raw, function(x) web_font(x[["family"]], x[["url"]]))
    assign(paste0(name, ".webfonts"), wf, envir = .preset_inputs_cache)
  }
  if (length(wf) > 0L) th@web_fonts <- wf
  th
}

#' NEJM theme - crimson brand + slate accent, classic medical serif.
#' @return A [WebTheme].
#' @export
web_theme_nejm <- function() {
  .theme_from_preset("nejm")
}
#' Available theme presets, organized by category.
#'
#' @return A nested list: category -> list of resolved [WebTheme] objects.
#' @export
package_themes <- function() {
  # The 9 committed identities (27→9 cull, locked 2026-06-09). Each owns a
  # distinct expressive axis (the rgc_v4 model); grouped here by register.
  list(
    clinical = list(
      nejm      = web_theme_nejm()       # restraint / the default
    ),
    editorial = list(
      newsprint = web_theme_newsprint(), # TEXTURE — warm grain serif
      dwarven   = web_theme_dwarven()    # FANTASY — Cinzel display serif
    ),
    design = list(
      ledger    = web_theme_ledger(),    # COLOR — teal + oxblood
      brutalist = web_theme_brutalist()  # GEOMETRY — sharp, thick rules
    ),
    expressive = list(
      aurora    = web_theme_aurora(),    # EFFECTS — glass + glow
      terminal  = web_theme_terminal(),  # ALIASING — mono phosphor
      blueprint = web_theme_blueprint(), # DRAFT / GRID — cyanotype
      synthwave = web_theme_synthwave()  # NEON
    )
  )
}

#' Flat name-to-theme map across all preset categories.
#'
#' @return A named list of [WebTheme] objects.
#' @export
theme_registry <- function() {
  cats <- package_themes()
  flat <- list()
  for (cat in cats) {
    for (nm in names(cat)) flat[[nm]] <- cat[[nm]]
  }
  flat
}
