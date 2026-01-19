# Example: Lancet journal style forest plot
# Demonstrates: Lancet theme, serif fonts, blue palette, left/right columns

library(tabviz)
library(dplyr)

# Create sample hazard ratio data for survival analysis
set.seed(456)
survival_data <- tibble(
  subgroup = c(
    "Overall", "Age < 65", "Age >= 65",
    "Male", "Female",
    "Stage I-II", "Stage III-IV",
    "ECOG 0-1", "ECOG 2+"
  ),
  hr = c(0.73, 0.68, 0.81, 0.75, 0.70, 0.65, 0.82, 0.71, 0.88),
  lower = c(0.62, 0.52, 0.65, 0.60, 0.54, 0.48, 0.66, 0.56, 0.68),
  upper = c(0.86, 0.89, 1.01, 0.94, 0.91, 0.88, 1.02, 0.90, 1.14),
  n_treatment = c(450, 220, 230, 280, 170, 180, 270, 320, 130),
  n_control = c(448, 218, 230, 275, 173, 182, 266, 318, 130),
  events_treatment = c(156, 68, 88, 95, 61, 52, 104, 98, 58),
  events_control = c(198, 92, 106, 118, 80, 72, 126, 128, 70)
) |>
  mutate(
    # Format events as "treatment/control"
    events = paste0(events_treatment, "/", events_control),
    n_total = paste0(n_treatment, "/", n_control)
  )

# Create Lancet-style forest plot
# Study info on left, effect estimates on right
forest_plot(
  survival_data,
  point = "hr",
  lower = "lower",
  upper = "upper",
  label = "subgroup",
  columns = list(
    col_text("n_total", "N (Tx/Ctrl)"),
    col_text("events", "Events"),
    col_interval("HR (95% CI)")
  ),
  theme = web_theme_lancet(),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard Ratio (95% CI)",
  title = "Subgroup Analysis: Overall Survival",
  subtitle = "Treatment vs Control in Phase III Trial",
  caption = "HR < 1 favors treatment arm",
  footnote = "Stratified Cox proportional hazards model"
)
