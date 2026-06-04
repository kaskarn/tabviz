# R-side default-value registry for ThemeInputs.
#
# Single source of truth for every numeric / string default that R code
# would otherwise duplicate across `classes-theme.R`'s slot defaults,
# `themes.R`'s preset helper, and `themes-api.R`'s `web_theme()`
# fallbacks. Lives in its own file so a future audit can find every
# default in one place.
#
# TS has equivalent constants in `srcjs/src/lib/theme/theme-presets-
# inputs.ts` (paper_L / ink_L) and `srcjs/src/lib/theme/resolve-theme.ts`
# (DEFAULT_RADIUS / DEFAULT_BORDER_WIDTH / DEFAULT_STATUS_ANCHORS). Per
# the package vision TS is authoritative; this R registry mirrors and
# `tests/testthat/test-parity-defaults.R` is the drift gate.

THEME_DEFAULTS <- list(
  # Tier-1 anchors — clinical baseline (cyan brand, near-white paper,
  # ink-dark text). Mirrors theme-presets-inputs.ts DEFAULT_PAPER_L /
  # DEFAULT_INK_L + the paper_C / ink_C inline defaults inside
  # `deriveAnchors`.
  paper_L = 0.987,
  paper_C = 0.005,
  paper_H = 235,
  ink_L   = 0.180,
  ink_C   = 0.010,
  ink_H   = 235,

  # Default brand seed when web_theme() is called with no `brand` arg.
  # R-only fallback; TS's `defineInputs` always takes a `seeds.brand`.
  brand_hex = "#0099CC",
  brand_L = 0.665,
  brand_C = 0.130,
  brand_H = 235,

  # Default font stacks. Mirrors theme-adapter.ts::DEFAULT_FONT_BODY.
  font_body_default = "system-ui, -apple-system, sans-serif",

  # densityFactor clamp. Mirrors resolve-theme.ts and theme-adapter.ts
  # density-factor bounds.
  density_factor_min = 0.5,
  density_factor_max = 2,

  # type_base_size + type_scale_ratio bounds.
  type_base_size_min  = 8,
  type_base_size_max  = 32,
  type_scale_ratio_min = 1.05,
  type_scale_ratio_max = 1.6,

  # type weights bounds (numeric weight values).
  type_weight_min = 100,
  type_weight_max = 900,

  # Phase D geometry numeric ranges.
  geometry_min = 0,
  geometry_max = 999,

  # Phase D gradient angle range.
  gradient_angle_min = 0,
  gradient_angle_max = 360
)
