# Gallery Example 5: Sparklines & Bars
# Column visualizations for trends and magnitudes

library(tabviz)
library(dplyr)

viz_data <- tibble(
  fund = c("Growth Fund A", "Value Fund B", "Index Fund C", "Bond Fund D", "REIT Fund E"),
  return_1y = c(24.5, 12.8, 18.2, 4.5, 8.9),
  return_se = c(4.2, 2.8, 3.1, 1.2, 2.5),
  aum_b = c(45.2, 28.5, 125.8, 52.1, 18.9),
  expense = c(0.85, 0.45, 0.03, 0.15, 0.65),
  monthly_returns = list(
    c(-2, 4, 3, -1, 5, 2, 4, -3, 6, 3, 2, 5),
    c(1, 2, 1, 0, 2, 1, 1, 2, 1, 0, 1, 2),
    c(1, 3, 2, 0, 3, 1, 2, -1, 4, 2, 1, 3),
    c(0.5, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.4, 0.3),
    c(1, -1, 2, 0, 1, 2, -1, 3, 0, 1, 1, 2)
  ),
  flow_trend = list(
    c(2.1, 2.5, 3.2, 4.1, 4.8, 5.2),
    c(1.8, 1.6, 1.4, 1.2, 1.1, 0.9),
    c(8.5, 9.2, 10.1, 11.5, 12.8, 14.2),
    c(3.2, 3.4, 3.5, 3.6, 3.7, 3.8),
    c(1.2, 1.4, 1.5, 1.3, 1.6, 1.8)
  )
) |>
  mutate(lower = return_1y - 1.96 * return_se, upper = return_1y + 1.96 * return_se)

forest_plot(
  viz_data,
  point = "return_1y", lower = "lower", upper = "upper",
  label = "fund",
  columns = list(
    col_bar("aum_b", "AUM ($B)"),
    col_numeric("expense", "Expense %"),
    col_sparkline("monthly_returns", "12M Returns"),
    col_sparkline("flow_trend", "6M Flows"),
    col_interval("1Y Return % (95% CI)")
  ),
  theme = web_theme_modern(),
  null_value = 0,
  axis_label = "1-Year Return (%)",
  title = "Sparklines & Bars",
  subtitle = "col_bar() for magnitude, col_sparkline() for trends",
  caption = "Two sparkline columns showing different time series"
)
