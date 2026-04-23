# Gallery Example 21: Marker cascade — 4-layer precedence + NA passthrough
# Demonstrates the full precedence stack on a single-effect forest.
#
#   Layer 4: marker_color = ~ ifelse(...)   per-row LITERAL (highest)
#   Layer 3: row_accent   = ~ ...           per-row SEMANTIC (theme color)
#   Layer 2: effect_forest(color = "#hex")  per-effect literal
#   Layer 1: theme.shapes.effectColors[i]   palette default
#
# The formula in Layer 4 returns NA for most rows, passing through to Layer 3
# where row_accent sets an accent color. Rows where Layer 4 returns a literal
# color win with that exact color.

library(tabviz)
library(dplyr)

precedence_data <- tibble(
  study = c("STUDY-01", "STUDY-02", "STUDY-03", "STUDY-04",
            "STUDY-05", "STUDY-06", "STUDY-07", "STUDY-08"),
  hr    = c(0.48, 0.62, 0.71, 0.82, 0.91, 1.02, 1.08, 1.22),
  lower = c(0.36, 0.49, 0.58, 0.68, 0.76, 0.86, 0.91, 1.03),
  upper = c(0.64, 0.79, 0.86, 0.98, 1.09, 1.21, 1.29, 1.45),
  pval  = c(0.0001, 0.0002, 0.003, 0.02,  0.08, 0.55,  0.72, 0.04)
)

tabviz(
  precedence_data,
  label = "study",
  # Layer 4 — per-row literal. Returns NA for most rows (fall-through to L3).
  marker_color = ~ ifelse(pval < 0.001, "#991b1b",   # dark red — very strong
                   ifelse(pval < 0.005, "#f87171",   # light red — strong
                          NA_character_)),            # pass through
  # Layer 3 — semantic class. Any row with pval < 0.05 not already colored
  # by Layer 4 gets the theme accent color.
  row_accent   = ~ pval < 0.05,
  columns = list(
    col_numeric("pval", "P", decimals = 4),
    col_interval("hr", "lower", "upper", header = "HR (95% CI)"),
    viz_forest(
      point = "hr", lower = "lower", upper = "upper",
      scale = "log", null_value = 1,
      axis_label = "Hazard Ratio"
    )
  ),
  theme    = web_theme_modern(),
  title    = "Marker cascade — precedence + NA passthrough",
  subtitle = "Layer 4 (literal) overrides Layer 3 (semantic); NA in Layer 4 passes through",
  caption  = paste0(
    "Dark red: p < 0.001 (Layer 4). ",
    "Light red: p < 0.005 (Layer 4). ",
    "Accent purple: p < 0.05 (Layer 3 via row_accent). ",
    "Default blue: palette (Layer 1)."
  )
)
