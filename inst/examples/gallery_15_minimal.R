# Gallery Example 15: Minimal Print
# Maximum density, pure black and white, designed for journal figure panels.

library(tabviz)
library(dplyr)

minimal_data <- tibble(
  trial = c("ADVANCE", "CARDINAL", "ELEVATE", "FRONTIER", "GENESIS", "HORIZON"),
  n = c(1680, 1520, 1890, 2100, 980, 1450),
  events = c(168, 152, 189, 210, 98, 145),
  hr = c(0.74, 0.78, 0.71, 0.82, 0.69, 0.76),
  lower = c(0.62, 0.66, 0.60, 0.71, 0.55, 0.64),
  upper = c(0.88, 0.92, 0.84, 0.95, 0.87, 0.90),
  weight = c(17.2, 16.8, 19.5, 21.2, 10.1, 15.2)
)

forest_plot(
  minimal_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "trial",
  weight = "weight",  # Scale marker sizes by study weight
  columns = list(
    col_numeric("n", "N"),
    col_numeric("events", "Events"),
    col_bar("weight"),
    col_interval("HR (95% CI)")
  ),
  theme = web_theme_minimal(),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio",
  title = "Forest Plot",
  footnote = "Random-effects model. Weights from inverse variance."
)
