# Gallery Example 1: Nested Hierarchical Groups
# Three levels of nesting: Region > Country > Site

library(tabviz)
library(dplyr)

nested_data <- tibble(
  site = c(
    "Boston General", "Mass Eye & Ear", "Johns Hopkins", "Cleveland Clinic",
    "UCL Hospital", "Imperial College", "Charite Berlin", "LMU Munich",
    "Tokyo University", "Osaka Medical", "Peking Union", "Shanghai Ruijin"
  ),
  region = c(
    rep("americas", 4),
    rep("europe", 4),
    rep("asia_pacific", 4)
  ),
  country = c(
    "usa", "usa", "usa", "usa",
    "uk", "uk", "germany", "germany",
    "japan", "japan", "china", "china"
  ),
  hr = c(0.72, 0.68, 0.75, 0.71, 0.78, 0.82, 0.69, 0.74, 0.65, 0.70, 0.67, 0.72),
  lower = c(0.58, 0.52, 0.61, 0.56, 0.64, 0.68, 0.54, 0.59, 0.50, 0.55, 0.52, 0.57),
  upper = c(0.89, 0.89, 0.92, 0.90, 0.95, 0.99, 0.88, 0.93, 0.85, 0.89, 0.86, 0.91),
  n = c(245, 189, 312, 278, 156, 134, 298, 267, 445, 389, 512, 478)
)

forest_plot(
  nested_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "site",
  group = c("region", "country"),  # Hierarchical: region > country
  columns = list(
    col_n("n"),
    col_interval("HR (95% CI)")
  ),
  theme = web_theme_modern(),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio",
  title = "Nested Hierarchical Groups",
  subtitle = "Region > Country > Site (3 levels)",
  caption = "Click any group header to collapse that branch and all children"
)
