# Gallery Example 13: JAMA Style
# Dense, minimal, black and white. Interaction p-values for subgroups.

library(tabviz)
library(dplyr)

jama_data <- tibble(
  subgroup = c(
    "Overall",
    "",
    "Age",
    "  <65 years", "  >=65 years",
    "",
    "Sex",
    "  Male", "  Female",
    "",
    "Baseline risk",
    "  Low", "  Intermediate", "  High"
  ),
  hr = c(0.76, NA, NA, 0.72, 0.82, NA, NA, 0.74, 0.79, NA, NA, 0.85, 0.75, 0.68),
  lower = c(0.68, NA, NA, 0.62, 0.70, NA, NA, 0.64, 0.67, NA, NA, 0.72, 0.63, 0.54),
  upper = c(0.85, NA, NA, 0.84, 0.96, NA, NA, 0.86, 0.93, NA, NA, 1.00, 0.89, 0.86),
  n = c(8500, NA, NA, 4200, 4300, NA, NA, 5200, 3300, NA, NA, 2800, 3400, 2300),
  p_int = c(NA, NA, NA, NA, 0.18, NA, NA, NA, 0.42, NA, NA, NA, NA, 0.03),
  rtype = c("summary", "spacer", "header", "data", "data", "spacer", "header", "data", "data", "spacer", "header", "data", "data", "data"),
  rbold = c(TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
  rindent = c(0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1)
)

forest_plot(
  jama_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "subgroup",
  columns = list(
    col_numeric("n", "No."),
    col_interval("HR (95% CI)"),
    col_pvalue("p_int", "P Interaction")
  ),
  row_type = "rtype", row_bold = "rbold", row_indent = "rindent",
  theme = web_theme_jama(),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio (95% CI)",
  title = "Figure 2. Subgroup Analyses",
  footnote = "HR indicates hazard ratio. P values are for interaction."
)
