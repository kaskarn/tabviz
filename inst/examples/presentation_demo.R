# Example: Presentation-ready forest plot
# Demonstrates: presentation theme, large fonts, bold colors, column positioning

library(tabviz)
library(dplyr)

# Create sample clinical trial data
set.seed(123)
trial_data <- tibble(
  study = c(
    "APOLLO 2020", "BEACON 2019", "CASCADE 2021",
    "DELTA 2018", "ECHO 2022", "FRONTIER 2021"
  ),
  or = c(0.72, 0.85, 0.65, 0.91, 0.78, 0.69),
  lower = c(0.58, 0.71, 0.48, 0.75, 0.62, 0.52),
  upper = c(0.89, 1.02, 0.88, 1.10, 0.98, 0.92),
  n = c(1250, 890, 2100, 650, 1500, 1800),
  events = c(89, 112, 156, 78, 95, 142),
  pvalue = c(0.002, 0.078, 0.005, 0.32, 0.031, 0.011)
)

# Create presentation-ready forest plot
# Sample sizes on left, results on right
forest_plot(
  trial_data,
  point = "or",
  lower = "lower",
  upper = "upper",
  label = "study",
  columns = list(
    col_numeric("n", "N"),
    col_numeric("events", "Events"),
    col_interval("OR (95% CI)"),
    col_pvalue("pvalue", "P")
  ),
  theme = web_theme_presentation(),
  scale = "log",
  null_value = 1,
  axis_label = "Odds Ratio (95% CI)",
  title = "Treatment Effect Across Trials",
  subtitle = "Pooled analysis of randomized controlled trials",
  caption = "OR < 1 favors treatment",
  footnote = "Random effects meta-analysis"
)
