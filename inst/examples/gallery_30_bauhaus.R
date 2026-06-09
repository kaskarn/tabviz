# Gallery Example 30: Bauhaus
# Red identity, blue structural axis, yellow accent. The two-tier cascade
# pays off here: secondary=blue tints chrome (column-group bands, alt-row
# banding, gridlines) while primary=red owns title + leaf-header identity.

library(tabviz)

bauhaus_data <- data.frame(
  metric   = c("Conversion rate",   "Avg session",     "Bounce rate",
               "Pages/session",     "New users %",     "Revenue/user"),
  baseline = c(0.038, 142, 0.62, 3.4, 0.41, 12.50),
  treatment= c(0.052, 168, 0.54, 4.1, 0.48, 16.20),
  lift     = c(0.37,  0.18, -0.13, 0.21, 0.17, 0.30),
  p_value  = c(0.001, 0.012, 0.034, 0.008, 0.045, 0.002),
  lower    = c(0.20,  0.08, -0.22, 0.10, 0.02, 0.15),
  upper    = c(0.54,  0.28, -0.04, 0.32, 0.32, 0.45)
)

tabviz(
  bauhaus_data,
  label = "metric",
  label_header = "Metric",
  theme = web_theme_brutalist(),
  columns = list(
    col_numeric("baseline", header = "Baseline", decimals = 2),
    col_numeric("treatment", header = "Treatment", decimals = 2),
    col_interval("lift", "lower", "upper", header = "Lift (95% CI)"),
    col_pvalue("p_value", header = "p"),
    viz_forest(
      point = "lift", lower = "lower", upper = "upper",
      axis_label = "Lift vs baseline",
      null_value = 0
    )
  ),
  title = "A/B test summary — geometric typography meets dense data",
  caption = "Theme: Bauhaus — red primary + blue structural axis + yellow accent."
)
