# Example: Dark theme forest plot
# Demonstrates: Dark theme styling, row badges, custom colors

library(tabviz)
library(dplyr)

# Oncology trial data with quality indicators
oncology_data <- tibble(
  study = c(
    "CheckMate 067", "KEYNOTE-006", "CheckMate 238",
    "KEYNOTE-054", "CheckMate 915", "KEYNOTE-716",
    "IMpassion130", "KEYNOTE-522", "CheckMate 816"
  ),
  tumor = c(
    rep("Melanoma", 6),
    rep("Triple-Negative Breast", 2),
    "NSCLC"
  ),
  hr = c(0.55, 0.63, 0.65, 0.57, 0.77, 0.65, 0.84, 0.63, 0.63),
  lower = c(0.45, 0.52, 0.51, 0.43, 0.63, 0.52, 0.69, 0.48, 0.43),
  upper = c(0.67, 0.76, 0.83, 0.74, 0.94, 0.81, 1.02, 0.82, 0.91),
  n = c(945, 834, 906, 1019, 1034, 976, 902, 1174, 358),
  median_fu = c(60.0, 57.7, 51.1, 42.3, 32.1, 27.4, 18.0, 39.1, 29.5),
  quality = c("High", "High", "High", "High", "Moderate", "High", "High", "High", "High"),
  pvalue = c(0.001, 0.001, 0.001, 0.001, 0.034, 0.001, 0.057, 0.001, 0.005),
  row_bold = c(TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  row_badge = c("Primary", NA, NA, NA, NA, NA, NA, NA, NA)
)

# Create dark theme forest plot
forest_plot(
  oncology_data,
  point = "hr",
  lower = "lower",
  upper = "upper",
  label = "study",
  label_header = "Trial",
  group = "tumor",
  columns = list(
    col_numeric("n", "N"),
    col_numeric("median_fu", "Follow-up (mo)"),
    col_text("quality", "Quality"),
    col_interval("HR (95% CI)"),
    col_pvalue("pvalue", "P")
  ),
  row_bold = "row_bold",
  row_badge = "row_badge",
  theme = web_theme_dark(),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard Ratio (95% CI)",
  title = "Immune Checkpoint Inhibitor Trials",
  subtitle = "Overall Survival or Disease-Free Survival",
  caption = "Sources: Published trial results",
  footnote = "HR < 1 favors immunotherapy"
)
