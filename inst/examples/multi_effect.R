# Example: Multiple stacked effects per row
# Demonstrates: web_effect() for displaying multiple related estimates on same axis

library(tabviz)
library(dplyr)

# Create data with multiple effect estimates per study
# Common in trials reporting both odds ratio and hazard ratio,
# or comparing different analysis methods
set.seed(654)
multi_effect_data <- tibble(
  study = c(
    "ARISTOTLE 2011",
    "RE-LY 2009",
    "ROCKET-AF 2011",
    "ENGAGE AF 2013",
    "ATLAS ACS 2012"
  ),
  # Intention-to-treat analysis
  itt_or = c(0.79, 0.91, 0.88, 0.87, 0.84),
  itt_lower = c(0.66, 0.74, 0.75, 0.73, 0.72),
  itt_upper = c(0.95, 1.11, 1.03, 1.04, 0.97),
  # Per-protocol analysis
  pp_or = c(0.75, 0.85, 0.82, 0.81, 0.78),
  pp_lower = c(0.62, 0.68, 0.69, 0.67, 0.66),
  pp_upper = c(0.91, 1.06, 0.98, 0.98, 0.92),
  # As-treated analysis
  at_or = c(0.72, 0.88, 0.85, 0.84, 0.80),
  at_lower = c(0.59, 0.71, 0.71, 0.69, 0.67),
  at_upper = c(0.88, 1.09, 1.02, 1.02, 0.95),
  # Sample sizes
  n_itt = c(18201, 18113, 14264, 21105, 15526),
  n_pp = c(16850, 16920, 13280, 19650, 14420)
)

# Create forest plot with multiple effects per row
# Each row shows ITT, Per-Protocol, and As-Treated analyses
forest_plot(
  multi_effect_data,
  point = "itt_or",
  lower = "itt_lower",
  upper = "itt_upper",
  label = "study",
  columns = list(
    col_numeric("n_itt", "N (ITT)"),
    col_numeric("n_pp", "N (PP)"),
    col_interval("ITT OR")
  ),
  # Define multiple effects to display stacked on same axis
  effects = list(
    web_effect("itt_or", "itt_lower", "itt_upper",
               label = "Intention-to-Treat",
               color = "#2563eb"),
    web_effect("pp_or", "pp_lower", "pp_upper",
               label = "Per-Protocol",
               color = "#16a34a"),
    web_effect("at_or", "at_lower", "at_upper",
               label = "As-Treated",
               color = "#dc2626")
  ),
  theme = web_theme_modern(),
  scale = "log",
  null_value = 1,
  axis_label = "Odds Ratio (95% CI)",
  title = "Sensitivity Analyses: DOAC Trials",
  subtitle = "Comparing ITT, Per-Protocol, and As-Treated populations",
  caption = "Three analysis methods shown per study",
  footnote = "Blue = ITT, Green = Per-Protocol, Red = As-Treated"
)
