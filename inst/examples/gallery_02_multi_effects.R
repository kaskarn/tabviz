# Gallery Example 2: Multiple Effects Per Row
# Five different analysis methods shown simultaneously

library(tabviz)
library(dplyr)

multi_effect_data <- tibble(
  study = c("PIONEER", "SUMMIT", "HORIZON", "APEX", "ZENITH"),
  n = c(2450, 1890, 3200, 1680, 2100),
  # Primary (ITT)
  itt_or = c(0.72, 0.78, 0.65, 0.81, 0.69),
  itt_lo = c(0.58, 0.64, 0.52, 0.66, 0.55),
  itt_hi = c(0.89, 0.95, 0.81, 0.99, 0.87),
  # Multiple Imputation
  mi_or = c(0.74, 0.80, 0.67, 0.83, 0.71),
  mi_lo = c(0.60, 0.66, 0.54, 0.68, 0.57),
  mi_hi = c(0.91, 0.97, 0.83, 1.01, 0.88),
  # Complete Case
  cc_or = c(0.70, 0.75, 0.63, 0.79, 0.67),
  cc_lo = c(0.55, 0.60, 0.49, 0.63, 0.52),
  cc_hi = c(0.89, 0.94, 0.81, 0.99, 0.86),
  # Per-Protocol
  pp_or = c(0.68, 0.73, 0.61, 0.77, 0.65),
  pp_lo = c(0.53, 0.58, 0.47, 0.61, 0.50),
  pp_hi = c(0.87, 0.92, 0.79, 0.97, 0.84),
  # Tipping Point
  tip_or = c(0.78, 0.84, 0.71, 0.87, 0.75),
  tip_lo = c(0.63, 0.69, 0.57, 0.71, 0.60),
  tip_hi = c(0.97, 1.02, 0.88, 1.07, 0.94)
)

forest_plot(
  multi_effect_data,
  point = "itt_or", lower = "itt_lo", upper = "itt_hi",
  label = "study",
  columns = list(
    col_n("n"),
    col_interval("Primary OR")
  ),
  effects = list(
    web_effect("itt_or", "itt_lo", "itt_hi", label = "ITT (Primary)", color = "#2563eb"),
    web_effect("mi_or", "mi_lo", "mi_hi", label = "Multiple Imputation", color = "#7c3aed"),
    web_effect("cc_or", "cc_lo", "cc_hi", label = "Complete Case", color = "#059669"),
    web_effect("pp_or", "pp_lo", "pp_hi", label = "Per-Protocol", color = "#d97706"),
    web_effect("tip_or", "tip_lo", "tip_hi", label = "Tipping Point", color = "#dc2626")
  ),
  theme = web_theme_modern() |> set_spacing(row_height = 40),
  scale = "log", null_value = 1,
  axis_label = "Odds Ratio (95% CI)",
  title = "Multiple Effects Per Row",
  subtitle = "5 sensitivity analyses displayed simultaneously",
  footnote = "Blue=ITT, Purple=MI, Green=CC, Orange=PP, Red=Tipping"
)
