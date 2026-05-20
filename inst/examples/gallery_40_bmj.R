# Gallery Example 40: BMJ
# BMJ Group — cooler-than-Cochrane teal primary, warm-gray secondary,
# orange accent, modern sans-serif typography throughout. Distinct from
# Cochrane: cooler/deeper teal, warm-gray (not mirroring), and an orange
# complement instead of coral.

library(tabviz)

bmj_data <- data.frame(
  intervention = c("Statin monotherapy",
                   "Statin + ezetimibe",
                   "PCSK9 inhibitor",
                   "Bempedoic acid",
                   "Inclisiran",
                   "Pooled estimate"),
  ldl_drop_pct = c(0.32, 0.46, 0.59, 0.21, 0.51, 0.42),
  cvd_hr       = c(0.78, 0.71, 0.69, 0.83, 0.74, 0.74),
  lower        = c(0.71, 0.62, 0.58, 0.71, 0.62, 0.69),
  upper        = c(0.86, 0.81, 0.82, 0.97, 0.88, 0.79),
  cost_yr      = c(450, 720, 6800, 4400, 5100, NA)
)

forest_plot(
  bmj_data,
  point = "cvd_hr", lower = "lower", upper = "upper",
  label = "intervention",
  columns = list(
    col_percent("ldl_drop_pct", header = "LDL drop"),
    col_interval("cvd_hr", "lower", "upper", header = "MACE HR (95% CI)"),
    col_currency("cost_yr", header = "Annual cost", symbol = "$",
                 decimals = 0, abbreviate = TRUE)
  ),
  theme = web_theme_bmj(),
  scale = "log", null_value = 1,
  axis_label = "Hazard ratio (95% CI)",
  title = "Comparative effectiveness of lipid-lowering therapies",
  caption = "Theme: BMJ. Modern editorial typography; teal + orange palette."
)
