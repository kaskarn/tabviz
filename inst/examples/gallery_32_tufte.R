# Gallery Example 32: Tufte
# Sparse data-ink-only chrome — barely-visible dividers, no alt-row banding,
# Crimson Pro serif. The "least chrome" point in the entire roster.

library(tabviz)

tufte_data <- data.frame(
  region    = c("Northeast", "Midwest", "South", "West", "Mountain"),
  pop_2020  = c(57.6, 68.9, 125.5, 78.6, 24.2),
  density   = c(345, 95, 117, 51, 13),
  growth    = c(0.4, 1.6, 6.6, 4.8, 8.2),
  median_inc= c(75463, 65571, 60224, 78437, 67000)
)

tabviz(
  tufte_data,
  label = "region",
  label_header = "Region",
  theme = web_theme_tufte(),
  columns = list(
    col_numeric("pop_2020", header = "Pop (M)", decimals = 1),
    col_numeric("density", header = "Density/mi²", decimals = 0, thousands_sep = ","),
    col_bar("growth", header = "Growth %"),
    col_currency("median_inc", header = "Median income",
                 symbol = "$", decimals = 0, abbreviate = TRUE)
  ),
  title = "US Census 2020 — demographic summary",
  caption = "Theme: Tufte. Data-ink-only chrome; serif typography; subtle rules."
)
