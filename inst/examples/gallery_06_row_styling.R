# Gallery Example 6: Row Styling
# Headers, summaries, badges, indentation, and custom colors

library(tabviz)
library(dplyr)

styled_data <- tibble(
  label = c(
    "Primary Endpoint",
    "  Composite MACE", "  CV Death", "  MI", "  Stroke",
    "",
    "Secondary Endpoints",
    "  All-cause mortality", "  HF hospitalization",
    "",
    "Overall Summary"
  ),
  hr = c(NA, 0.82, 0.88, 0.79, 0.76, NA, NA, 0.91, 0.72, NA, 0.80),
  lower = c(NA, 0.74, 0.76, 0.68, 0.62, NA, NA, 0.79, 0.61, NA, 0.73),
  upper = c(NA, 0.91, 1.02, 0.92, 0.93, NA, NA, 1.05, 0.85, NA, 0.88),
  events = c(NA, 856, 312, 298, 246, NA, NA, 445, 412, NA, 1268),
  rtype = c("header", rep("data", 4), "spacer", "header", "data", "data", "spacer", "summary"),
  rbold = c(TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE),
  rindent = c(0, 1, 2, 2, 2, 0, 0, 1, 1, 0, 0),
  rcolor = c("#2563eb", NA, NA, NA, NA, NA, "#2563eb", NA, NA, NA, "#16a34a"),
  rbadge = c(NA, "Primary", NA, NA, NA, NA, NA, NA, "Key", NA, "Pooled")
)

forest_plot(
  styled_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "label",
  columns = list(
    col_numeric("events", "Events"),
    col_interval("HR (95% CI)")
  ),
  row_type = "rtype", row_bold = "rbold", row_indent = "rindent",
  row_color = "rcolor", row_badge = "rbadge",
  theme = web_theme_modern(),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio",
  title = "Row Styling Features",
  subtitle = "row_type, row_bold, row_indent, row_color, row_badge",
  caption = "Headers in blue, summary in green, with badges and indentation"
)
