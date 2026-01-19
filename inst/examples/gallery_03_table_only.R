# Gallery Example 3: Table-Only Mode
# No forest plot - pure interactive table with rich column types

library(tabviz)
library(dplyr)

table_data <- tibble(
  metric = c("Revenue", "Gross Profit", "EBITDA", "Net Income", "Free Cash Flow",
             "Customer Count", "Churn Rate", "NPS Score", "CAC", "LTV"),
  category = c(rep("Financial", 5), rep("Operational", 5)),
  q1 = c(142, 98, 45, 28, 22, 12500, 2.8, 72, 185, 920),
  q2 = c(156, 108, 52, 32, 28, 13200, 2.5, 74, 178, 945),
  q3 = c(168, 118, 58, 38, 35, 14100, 2.3, 76, 172, 980),
  q4 = c(185, 132, 68, 45, 42, 15200, 2.1, 78, 165, 1020),
  yoy_pct = c(18.5, 22.1, 28.4, 35.2, 42.8, 21.6, -25.0, 8.3, -10.8, 10.9),
  trend = list(
    c(128, 135, 142, 156, 168, 185), c(85, 90, 98, 108, 118, 132),
    c(38, 42, 45, 52, 58, 68), c(22, 25, 28, 32, 38, 45),
    c(18, 20, 22, 28, 35, 42), c(10200, 11000, 12500, 13200, 14100, 15200),
    c(3.5, 3.2, 2.8, 2.5, 2.3, 2.1), c(68, 70, 72, 74, 76, 78),
    c(210, 198, 185, 178, 172, 165), c(850, 880, 920, 945, 980, 1020)
  )
)

webtable(
  table_data,
  label = "metric", group = "category",
  columns = list(
    col_numeric("q4", "Q4 Actual"),
    col_bar("yoy_pct", "YoY %"),
    col_sparkline("trend", "6Q Trend")
  ),
  theme = web_theme_modern(),
  title = "Table-Only Mode",
  subtitle = "No forest plot - pure data table with bars and sparklines",
  caption = "Using webtable() instead of forest_plot()"
)
