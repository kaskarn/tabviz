# R↔TS theme-preset parity tests.
#
# For each named preset, build the R-side WebTheme via its constructor,
# serialize @inputs via theme_inputs_to_json, then compare to the raw
# TS-side PRESETS literal (via the inputsForPreset V8 helper). This
# catches divergence in the WIRE SHAPE itself (not just the brand hex
# the prior test asserted).
#
# Comparison strategy:
#   - top-level field set must match exactly (no R+X / TS+X gaps)
#   - anchors compared with tolerance 1e-3 on L/C/H (well below JND;
#     R and TS use independent hex→OKLCH converters that round-trip
#     to the same hex but drift at the 4th–5th decimal — tracked as
#     a separate alignment task)
#   - everything else compared with `expect_equal(tolerance = 0)` so
#     numeric-vs-integer doesn't false-fail but real value drift does
#   - per-preset KNOWN_DIVERGENCES allowlists the current real diffs
#     (fonts strings + a few per-preset type/effects/geometry values)
#     so this test surfaces only NEW drift. The list can only shrink.

# Per-axis tolerance for anchor comparison. R and TS use independent
# hex→OKLCH converters that round-trip to the same hex but drift below
# JND. All thresholds are well below perceptual just-noticeable
# difference (~0.005 for L and C, ~1° for H).
.ANCHOR_TOL <- list(L = 1e-3, C = 1e-3, H = 0.1)

# Per-preset known-divergent fields. The intent is to track each diff
# as its own follow-up (R preset constructor and TS PRESETS literal
# need alignment). Removing an entry should make the test still pass
# — meaning the divergence has been resolved.
.KNOWN_DIVERGENCES <- list(
  # Empty — all known divergences closed. New divergences trigger
  # test failure with a "preset 'X' has new R↔TS divergence" message.
)

# Compare two anchor triples with per-axis tolerance. For achromatic
# anchors (C ≈ 0 on either side), H is degenerate — different converters
# return arbitrary wraparound hues that render identically. Skip H in
# that case.
.ACHROMATIC_C <- 0.01

.anchors_close <- function(a, b, tol = .ANCHOR_TOL) {
  if (!identical(sort(names(a)), sort(names(b)))) return(FALSE)
  for (anchor in names(a)) {
    if (!setequal(names(a[[anchor]]), names(b[[anchor]]))) return(FALSE)
    achromatic <- a[[anchor]]$C < .ACHROMATIC_C || b[[anchor]]$C < .ACHROMATIC_C
    for (axis in c("L", "C", "H")) {
      if (axis == "H" && achromatic) next
      if (abs(a[[anchor]][[axis]] - b[[anchor]][[axis]]) > tol[[axis]]) return(FALSE)
    }
  }
  TRUE
}

# Internal — call a single-arg V8 builder with `null` (no args).
.ts_no_arg <- function(name) {
  ctx <- tabviz_v8()
  json <- ctx$call("callBuilder", name, "null")
  jsonlite::fromJSON(
    json,
    simplifyVector = TRUE,
    simplifyDataFrame = FALSE,
    simplifyMatrix = FALSE
  )
}

# Preset name → (R constructor, TS constructor).
PRESET_PAIRS <- list(
  cochrane       = list(r = web_theme_cochrane,       ts = "themeCochrane"),
  lancet         = list(r = web_theme_lancet,         ts = "themeLancet"),
  jama           = list(r = web_theme_jama,           ts = "themeJama"),
  nejm           = list(r = web_theme_nejm,           ts = "themeNejm"),
  nature         = list(r = web_theme_nature,         ts = "themeNature"),
  bmj            = list(r = web_theme_bmj,            ts = "themeBmj"),
  dark           = list(r = web_theme_dark,           ts = "themeDark"),
  bauhaus        = list(r = web_theme_bauhaus,        ts = "themeBauhaus"),
  swiss          = list(r = web_theme_swiss,          ts = "themeSwiss"),
  tufte          = list(r = web_theme_tufte,          ts = "themeTufte"),
  newsprint      = list(r = web_theme_newsprint,      ts = "themeNewsprint"),
  solarized      = list(r = web_theme_solarized,      ts = "themeSolarized"),
  solarized_dark = list(r = web_theme_solarized_dark, ts = "themeSolarizedDark"),
  tonal          = list(r = web_theme_tonal,          ts = "themeTonal"),
  tonal_dark     = list(r = web_theme_tonal_dark,     ts = "themeTonalDark"),
  dwarven        = list(r = web_theme_dwarven,        ts = "themeDwarven"),
  elvish         = list(r = web_theme_elvish,         ts = "themeElvish"),
  hobbit         = list(r = web_theme_hobbit,         ts = "themeHobbit"),
  synthwave      = list(r = web_theme_synthwave,      ts = "themeSynthwave"),
  brutalist      = list(r = web_theme_brutalist,      ts = "themeBrutalist"),
  atelier        = list(r = web_theme_atelier,        ts = "themeAtelier"),
  executive      = list(r = web_theme_executive,      ts = "themeExecutive"),
  ledger         = list(r = web_theme_ledger,         ts = "themeLedger"),
  terminal       = list(r = web_theme_terminal,       ts = "themeTerminal"),
  aurora         = list(r = web_theme_aurora,         ts = "themeAurora"),
  blueprint      = list(r = web_theme_blueprint,      ts = "themeBlueprint"),
  sunprint       = list(r = web_theme_sunprint,       ts = "themeSunprint")
)

test_that("R and TS preset constructors emit the same top-level wire fields", {
  for (name in names(PRESET_PAIRS)) {
    r  <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    ts <- ts_call("inputsForPreset", name)
    expect_setequal(names(r), names(ts))
  }
})

test_that("R and TS preset anchors match within OKLCH tolerance", {
  for (name in names(PRESET_PAIRS)) {
    r  <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    ts <- ts_call("inputsForPreset", name)
    expect_true(
      .anchors_close(r$anchors, ts$anchors),
      info = sprintf("anchors diverge beyond %g tolerance (preset: %s)",
                     .ANCHOR_TOL, name)
    )
  }
})

test_that("R and TS preset status anchors match within OKLCH tolerance", {
  for (name in names(PRESET_PAIRS)) {
    r  <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    ts <- ts_call("inputsForPreset", name)
    has_r  <- !is.null(r$status);  has_ts <- !is.null(ts$status)
    expect_equal(has_r, has_ts,
                 info = sprintf("status presence diverges (preset: %s)", name))
    if (has_r && has_ts) {
      expect_true(
        .anchors_close(r$status, ts$status),
        info = sprintf("status anchors diverge beyond tolerance (preset: %s)", name)
      )
    }
  }
})

test_that("R and TS preset non-anchor fields match (or are known-divergent)", {
  for (name in names(PRESET_PAIRS)) {
    r  <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    ts <- ts_call("inputsForPreset", name)
    known <- if (is.null(.KNOWN_DIVERGENCES[[name]])) character(0) else .KNOWN_DIVERGENCES[[name]]
    shared <- intersect(names(r), names(ts))
    # anchors AND status are OKLCH-triple objects from independent hex
    # converters — both checked separately with per-axis tolerance.
    shared <- setdiff(shared, c("anchors", "status"))
    unexpected_diffs <- character(0)
    surprising_matches <- character(0)
    for (k in shared) {
      same <- isTRUE(all.equal(r[[k]], ts[[k]], tolerance = 0))
      if (!same && !(k %in% known)) unexpected_diffs <- c(unexpected_diffs, k)
      if (same && (k %in% known))   surprising_matches <- c(surprising_matches, k)
    }
    expect_equal(unexpected_diffs, character(0),
                 info = sprintf("preset '%s' has new R↔TS divergence", name))
    expect_equal(surprising_matches, character(0),
                 info = sprintf("preset '%s' no longer diverges on %s — remove from .KNOWN_DIVERGENCES",
                                name, paste(surprising_matches, collapse = ", ")))
  }
})

test_that("R presets all serialize to the v4 anchors shape", {
  # Drift gate — every preset's serialized inputs must carry the V4
  # anchors object and NOT the v3 brand/decorative/neutral_tint fields.
  for (name in names(PRESET_PAIRS)) {
    inputs_json <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    expect_true(
      !is.null(inputs_json$anchors),
      label = paste0("anchors present (preset: ", name, ")")
    )
    expect_true(
      !is.null(inputs_json$anchors$paper) &&
        !is.null(inputs_json$anchors$ink) &&
        !is.null(inputs_json$anchors$brand),
      label = paste0("paper/ink/brand anchors emitted (preset: ", name, ")")
    )
    expect_null(inputs_json$brand,
                info = paste0("v3 brand field still emitted by ", name))
    expect_null(inputs_json$decorative,
                info = paste0("v3 decorative field still emitted by ", name))
    expect_null(inputs_json$neutral_tint,
                info = paste0("v3 neutral_tint field still emitted by ", name))
  }
})

test_that("Polarity round-trips through serialization for dark presets", {
  for (name in c("dark", "solarized_dark", "tonal_dark", "dwarven", "synthwave",
                 "terminal", "aurora", "blueprint")) {
    inputs_json <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    expect_equal(inputs_json$polarity, "dark",
                 label = paste0("polarity (preset: ", name, ")"))
  }
})

test_that("Light presets DO NOT emit polarity (default omitted symmetric R↔TS)", {
  for (name in c("cochrane", "lancet", "jama", "nature", "bmj",
                 "bauhaus", "swiss", "tufte", "newsprint", "solarized",
                 "tonal", "elvish", "hobbit", "brutalist", "atelier",
                 "executive", "ledger", "sunprint")) {
    inputs_json <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    expect_null(inputs_json$polarity,
                info = paste0("light preset '", name, "' should omit polarity"))
  }
})
