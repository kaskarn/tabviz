# Gallery Example 11: Publication Meta-Analysis
# Row styling + annotations + axis control + weight column

library(tabviz)
library(dplyr)

meta_analysis <- tibble(
  study = c(
    "Individual Studies",
    "  Smith 2018", "  Johnson 2019", "  Williams 2020", "  Brown 2021", "  Davis 2022",
    "",
    "Pooled Estimate"
  ),
  or = c(NA, 0.72, 0.85, 0.68, 0.78, 0.65, NA, 0.74),
  lower = c(NA, 0.55, 0.68, 0.52, 0.62, 0.50, NA, 0.66),
  upper = c(NA, 0.94, 1.06, 0.89, 0.98, 0.85, NA, 0.83),
  weight = c(NA, 18.5, 22.1, 15.8, 24.2, 19.4, NA, 100),
  n = c(NA, 450, 680, 320, 890, 520, NA, 2860),
  i2 = c(NA, NA, NA, NA, NA, NA, NA, 32),
  rtype = c("header", rep("data", 5), "spacer", "summary"),
  rbold = c(TRUE, rep(FALSE, 5), FALSE, TRUE),
  rindent = c(0, 1, 1, 1, 1, 1, 0, 0)
)

forest_plot(
  meta_analysis,
  point = "or", lower = "lower", upper = "upper",
  label = "study",
  weight = "weight",  # Scale marker sizes by study weight
  columns = list(
    col_n("n"),
    col_bar("weight"),
    col_interval("OR (95% CI)")
  ),
  annotations = list(
    forest_refline(0.75, label = "Pooled", style = "solid", color = "#2563eb")
  ),
  row_type = "rtype", row_bold = "rbold", row_indent = "rindent",
  theme = web_theme_lancet(),
  scale = "log", null_value = 1,
  axis_range = c(0.4, 1.2),
  axis_ticks = c(0.5, 0.75, 1.0),
  axis_gridlines = TRUE,
  axis_label = "Odds Ratio (95% CI)",
  title = "Publication Meta-Analysis",
  subtitle = "Weight column + reference line + custom axis",
  caption = "Pooled estimate shown as reference line; I2 = 32%",
  footnote = "Random-effects model with DerSimonian-Laird estimator"
)
