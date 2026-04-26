# Gallery Example 18: Marker cascade — multi-effect forest
# Demonstrates the "augment" behavior: when a viz column has 2+ effects with
# their own per-effect colors, row_accent does NOT replace the fill (which
# would lose effect identity). Instead, it adds an outline in the accent
# color around each marker in the matching row — preserving the per-effect
# color encoding while still flagging the row as special.

library(tabviz)
library(dplyr)

multi_data <- tibble(
  study     = c("Site-1", "Site-2", "Site-3", "Site-4", "Site-5"),
  # Primary outcome (ITT)
  itt_hr    = c(0.55, 0.72, 0.88, 0.95, 0.68),
  itt_lo    = c(0.42, 0.58, 0.72, 0.79, 0.53),
  itt_hi    = c(0.72, 0.90, 1.08, 1.15, 0.88),
  # Secondary outcome (per-protocol)
  pp_hr     = c(0.60, 0.75, 0.85, 0.92, 0.70),
  pp_lo     = c(0.48, 0.62, 0.70, 0.77, 0.55),
  pp_hi     = c(0.76, 0.92, 1.03, 1.10, 0.91),
  # Safety
  saf_hr    = c(1.05, 0.98, 1.02, 1.08, 0.95),
  saf_lo    = c(0.92, 0.87, 0.91, 0.95, 0.84),
  saf_hi    = c(1.20, 1.11, 1.14, 1.22, 1.07),
  is_key    = c(TRUE,  FALSE, FALSE, FALSE, TRUE)
)

tabviz(
  multi_data,
  label = "study",
  # Two rows are flagged. With 3 effects per row, the accent does NOT
  # override the per-effect fill colors — it adds an outline.
  row_accent = "is_key",
  columns = list(
    viz_forest(
      effects = list(
        effect_forest("itt_hr", "itt_lo", "itt_hi", label = "ITT",          color = "#2563eb"),
        effect_forest("pp_hr",  "pp_lo",  "pp_hi",  label = "Per-Protocol", color = "#16a34a"),
        effect_forest("saf_hr", "saf_lo", "saf_hi", label = "Safety",       color = "#f59e0b")
      ),
      scale = "log", null_value = 1,
      axis_label = "Hazard Ratio (multi-effect)",
      axis_range = c(0.4, 1.3)
    )
  ),
  theme    = web_theme_cochrane(),
  title    = "Semantic cascade on a multi-effect forest",
  subtitle = "Accented rows get an outline (fill preserved to keep effect identity)",
  caption  = "Blue = ITT, green = Per-Protocol, orange = Safety. Outlined markers: row is flagged via row_accent."
)
