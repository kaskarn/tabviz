# R↔TS theme-preset parity tests.
#
# For each of the 21 named presets, build the R-side WebTheme via the
# preset constructor, serialize its inputs through theme_inputs_to_json,
# round-trip through V8 buildTheme, and assert the resolved primary +
# accent hex match what the TS preset constructor produces directly.
# If R's derive_preset_anchors() drifts from TS's deriveAnchors (or
# either side's hex-to-OKLCH conversion changes), this test surfaces
# the gap.

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

# Preset name → (R constructor, TS constructor) pairs. The 21 presets
# across journals / design / lotr / showcase.
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
  atelier        = list(r = web_theme_atelier,        ts = "themeAtelier"),
  executive      = list(r = web_theme_executive,      ts = "themeExecutive")
)

test_that("R and TS preset constructors produce the same resolved primary + accent", {
  for (name in names(PRESET_PAIRS)) {
    pair <- PRESET_PAIRS[[name]]

    r_theme    <- pair$r()
    r_inputs   <- theme_inputs_to_json(r_theme@inputs)
    r_resolved <- ts_call("buildTheme", r_inputs)
    ts_resolved <- .ts_no_arg(pair$ts)

    expect_equal(
      r_resolved$inputs$primary,
      ts_resolved$inputs$primary,
      label = paste0("primary (preset: ", name, ")")
    )
    expect_equal(
      r_resolved$inputs$accent,
      ts_resolved$inputs$accent,
      label = paste0("accent (preset: ", name, ")")
    )
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
  for (name in c("dark", "solarized_dark", "tonal_dark", "dwarven", "synthwave")) {
    inputs_json <- theme_inputs_to_json(PRESET_PAIRS[[name]]$r()@inputs)
    expect_equal(inputs_json$polarity, "dark",
                 label = paste0("polarity (preset: ", name, ")"))
  }
})
