# Gallery Example 10: Executive Dashboard
# Table-only + bars + sparklines + row styling

library(tabviz)
library(dplyr)

exec_dashboard <- tibble(
  department = c(
    "COMPANY TOTAL", "",
    "Engineering", "  Platform", "  Infrastructure", "  Mobile",
    "",
    "Product", "  Design", "  Research",
    "",
    "Sales", "  Enterprise", "  SMB"
  ),
  headcount = c(1250, NA, 480, 180, 150, 150, NA, 220, 85, 135, NA, 550, 320, 230),
  revenue_m = c(185, NA, NA, NA, NA, NA, NA, NA, NA, NA, NA, 185, 142, 43),
  growth = c(24, NA, 32, 45, 28, 18, NA, 28, 35, 22, NA, 18, 22, 12),
  satisfaction = c(78, NA, 82, 85, 80, 81, NA, 76, 79, 74, NA, 75, 77, 72),
  trend = list(
    c(1050, 1100, 1150, 1180, 1220, 1250), NULL,
    c(380, 400, 420, 440, 460, 480), c(140, 150, 160, 170, 175, 180),
    c(120, 130, 140, 145, 148, 150), c(120, 120, 125, 130, 140, 150), NULL,
    c(180, 190, 200, 208, 215, 220), c(65, 70, 75, 80, 82, 85),
    c(115, 120, 125, 128, 132, 135), NULL,
    c(490, 505, 520, 532, 542, 550), c(280, 290, 300, 308, 315, 320),
    c(210, 215, 220, 224, 227, 230)
  ),
  rtype = c("summary", "spacer", "header", rep("data", 3), "spacer",
            "header", "data", "data", "spacer", "header", "data", "data"),
  rbold = c(TRUE, FALSE, TRUE, rep(FALSE, 3), FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
  rindent = c(0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1),
  rcolor = c("#16a34a", NA, "#2563eb", NA, NA, NA, NA, "#2563eb", NA, NA, NA, "#2563eb", NA, NA)
)

webtable(
  exec_dashboard,
  label = "department",
  columns = list(
    col_numeric("headcount", "HC"),
    col_numeric("revenue_m", "Rev $M"),
    col_bar("growth", "Growth %"),
    col_numeric("satisfaction", "eNPS"),
    col_sparkline("trend", "6M Trend")
  ),
  row_type = "rtype", row_bold = "rbold", row_indent = "rindent", row_color = "rcolor",
  theme = web_theme_modern(),
  title = "Executive Dashboard",
  subtitle = "Table-only with hierarchical org structure",
  caption = "Combining webtable() with row styling for org charts"
)
