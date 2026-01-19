# Gallery Example 9: Clinical Trial Program
# Nested groups + multiple effects + sparklines + badges

library(tabviz)
library(dplyr)

set.seed(2024)
trial_program <- tibble(
  site = c(
    "MGH Boston", "UCSF", "Mayo Clinic",
    "Oxford", "Charite", "Karolinska",
    "Tokyo Univ", "Singapore GH", "Melbourne"
  ),
  region = c(rep("americas", 3), rep("europe", 3), rep("asia_pacific", 3)),
  country = c("usa", "usa", "usa", "uk", "germany", "sweden", "japan", "singapore", "australia"),
  itt_hr = c(0.68, 0.72, 0.75, 0.78, 0.71, 0.82, 0.65, 0.69, 0.74),
  itt_lo = c(0.52, 0.56, 0.60, 0.62, 0.55, 0.66, 0.49, 0.53, 0.58),
  itt_hi = c(0.89, 0.93, 0.94, 0.98, 0.92, 1.02, 0.86, 0.90, 0.95),
  pp_hr = c(0.64, 0.68, 0.71, 0.74, 0.67, 0.78, 0.61, 0.65, 0.70),
  pp_lo = c(0.48, 0.52, 0.55, 0.58, 0.51, 0.62, 0.45, 0.49, 0.54),
  pp_hi = c(0.85, 0.89, 0.92, 0.94, 0.88, 0.98, 0.83, 0.86, 0.91),
  n = c(1250, 980, 1420, 890, 1100, 760, 1850, 1340, 1180),
  trend = list(
    c(0.85, 0.78, 0.72, 0.68, 0.67), c(0.88, 0.82, 0.76, 0.72, 0.71),
    c(0.90, 0.85, 0.80, 0.76, 0.75), c(0.92, 0.88, 0.84, 0.79, 0.78),
    c(0.86, 0.80, 0.75, 0.71, 0.70), c(0.94, 0.90, 0.86, 0.83, 0.82),
    c(0.82, 0.75, 0.70, 0.66, 0.65), c(0.85, 0.78, 0.73, 0.69, 0.68),
    c(0.88, 0.82, 0.78, 0.74, 0.73)
  ),
  badge = c("Lead Site", NA, NA, NA, NA, NA, "Top Recruiter", NA, NA)
)

forest_plot(
  trial_program,
  point = "itt_hr", lower = "itt_lo", upper = "itt_hi",
  label = "site", group = c("region", "country"),
  columns = list(
    col_n("n"),
    col_sparkline("trend", "HR Trend"),
    col_interval("ITT HR (95% CI)")
  ),
  effects = list(
    web_effect("itt_hr", "itt_lo", "itt_hi", label = "ITT", color = "#2563eb"),
    web_effect("pp_hr", "pp_lo", "pp_hi", label = "Per-Protocol", color = "#16a34a")
  ),
  row_badge = "badge",
  theme = web_theme_dark(),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio",
  title = "Clinical Trial Program",
  subtitle = "Nested groups + dual effects + sparklines + badges",
  caption = "Combining hierarchical structure with sensitivity analysis"
)
