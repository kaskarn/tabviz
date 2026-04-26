# Gallery Example 17: Marker cascade — single-effect forest
# Demonstrates how row_accent / row_emphasis / row_muted drive the marker fill
# color on a single-effect forest plot. A single formula at the tabviz() level
# picks out rows to mark; the theme's semantic color fills the marker.

library(tabviz)
library(dplyr)

cascade_data <- tibble(
  study  = c("STUDY-A", "STUDY-B", "STUDY-C", "STUDY-D", "STUDY-E", "STUDY-F"),
  hr     = c(0.55, 0.72, 0.88, 0.95, 1.05, 1.20),
  lower  = c(0.42, 0.58, 0.72, 0.79, 0.88, 0.97),
  upper  = c(0.72, 0.90, 1.08, 1.15, 1.25, 1.49),
  pval   = c(0.0005, 0.02, 0.15, 0.42, 0.71, 0.05),
  status = c("primary", "primary", "neutral", "neutral", "exploratory", "exploratory")
)

tabviz(
  cascade_data,
  label      = "study",
  # Three semantic classes evaluated from the SAME data, applied row-wise.
  # Each maps to a theme color at render time and replaces the marker fill
  # (single-effect → fill replacement).
  row_accent    = ~ pval < 0.01,             # → theme accent color fill
  row_muted     = ~ status == "exploratory", # → theme muted color fill
  row_emphasis  = ~ pval >= 0.01 & pval < 0.05,  # → theme foreground color fill
  columns = list(
    col_numeric("pval", "P", decimals = 3),
    col_interval("hr", "lower", "upper", header = "HR (95% CI)"),
    viz_forest(
      point = "hr", lower = "lower", upper = "upper",
      scale = "log", null_value = 1,
      axis_label = "Hazard Ratio"
    )
  ),
  theme    = web_theme_cochrane(),
  title    = "Semantic cascade on a single-effect forest",
  subtitle = "row_accent / row_emphasis / row_muted replace marker fill with theme colors",
  caption  = "Purple = strong evidence (accent); dark = borderline (emphasis); gray = exploratory (muted)."
)
