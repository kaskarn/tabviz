# Gallery Example 12: The Full Monty
# Everything at once - maximum feature density

library(tabviz)
library(dplyr)

full_monty <- tibble(
  study = c(
    "ALPHA-01", "ALPHA-02",
    "BETA-01", "BETA-02", "BETA-03",
    "GAMMA-01", "GAMMA-02"
  ),
  program = c(rep("program_a", 2), rep("program_b", 3), rep("program_c", 2)),
  phase = c("Phase_II", "Phase_II", "Phase_III", "Phase_III", "Phase_III", "Phase_II", "Phase_III"),
  # Three effects
  primary_hr = c(0.68, 0.72, 0.65, 0.71, 0.74, 0.78, 0.69),
  primary_lo = c(0.52, 0.56, 0.50, 0.55, 0.58, 0.62, 0.53),
  primary_hi = c(0.89, 0.93, 0.85, 0.92, 0.95, 0.98, 0.90),
  secondary_hr = c(0.72, 0.76, 0.69, 0.75, 0.78, 0.82, 0.73),
  secondary_lo = c(0.56, 0.60, 0.53, 0.59, 0.62, 0.66, 0.57),
  secondary_hi = c(0.93, 0.96, 0.90, 0.95, 0.98, 1.02, 0.94),
  safety_hr = c(0.85, 0.88, 0.82, 0.86, 0.89, 0.92, 0.84),
  safety_lo = c(0.68, 0.72, 0.65, 0.69, 0.72, 0.75, 0.67),
  safety_hi = c(1.06, 1.08, 1.04, 1.07, 1.10, 1.13, 1.05),
  n = c(420, 380, 1250, 980, 1100, 560, 890),
  weight = c(8, 7, 22, 18, 20, 10, 15),
  pvalue = c(0.008, 0.015, 0.001, 0.004, 0.012, 0.042, 0.003),
  trend = list(
    c(0.85, 0.78, 0.72, 0.68), c(0.88, 0.82, 0.76, 0.72),
    c(0.82, 0.75, 0.69, 0.65), c(0.86, 0.80, 0.75, 0.71),
    c(0.88, 0.82, 0.78, 0.74), c(0.92, 0.88, 0.84, 0.78),
    c(0.84, 0.78, 0.73, 0.69)
  ),
  badge = c("Lead", NA, "Pivotal", NA, NA, NA, "Fast Track")
)

# Custom theme
monty_theme <- web_theme_dark() |>
  set_colors(primary = "#f59e0b", interval_positive = "#22c55e", interval_negative = "#ef4444") |>
  set_spacing(row_height = 38) |>
  set_axis(gridlines = TRUE, gridline_style = "dotted")

forest_plot(
  full_monty,
  point = "primary_hr", lower = "primary_lo", upper = "primary_hi",
  label = "study", group = c("program", "phase"),
  weight = "weight",  # Explicit weight column for marker sizing
  columns = list(
    col_n("n"),
    col_bar("weight"),
    col_group("Results",
      col_interval("HR (95% CI)"),
      col_pvalue("pvalue", "P")
    ),
    col_sparkline("trend", "Trend")
  ),
  effects = list(
    web_effect("primary_hr", "primary_lo", "primary_hi", label = "Primary", color = "#22c55e"),
    web_effect("secondary_hr", "secondary_lo", "secondary_hi", label = "Secondary", color = "#3b82f6"),
    web_effect("safety_hr", "safety_lo", "safety_hi", label = "Safety", color = "#f59e0b")
  ),
  annotations = list(
    forest_refline(0.75, label = "Target", style = "dashed", color = "#a855f7")
  ),
  row_badge = "badge",
  theme = monty_theme,
  scale = "log", null_value = 1,
  axis_range = c(0.4, 1.2),
  axis_label = "Hazard Ratio",
  title = "The Full Monty",
  subtitle = "Nested groups + 3 effects + sparklines + weights + annotations + custom theme",
  caption = "Every major feature combined in one visualization",
  footnote = "Green=Primary, Blue=Secondary, Orange=Safety. Purple line=Target."
)
