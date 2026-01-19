# Gallery Example 14: Lancet Style
# Serif fonts, blue palette, traditional academic presentation.

library(tabviz)
library(dplyr)

lancet_data <- tibble(
  outcome = c(
    "Primary endpoint",
    "  CV death or HF hospitalization",
    "",
    "Components",
    "  Cardiovascular death",
    "  HF hospitalization",
    "",
    "Secondary endpoints",
    "  All-cause mortality",
    "  Change in KCCQ score"
  ),
  hr = c(NA, 0.74, NA, NA, 0.82, 0.70, NA, NA, 0.88, 0.85),
  lower = c(NA, 0.66, NA, NA, 0.72, 0.61, NA, NA, 0.76, 0.74),
  upper = c(NA, 0.83, NA, NA, 0.94, 0.81, NA, NA, 1.02, 0.98),
  events = c(NA, "894/1212", NA, NA, "312/398", "582/814", NA, NA, "445/508", NA),
  rtype = c("header", "data", "spacer", "header", "data", "data", "spacer", "header", "data", "data"),
  rbold = c(TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
  rindent = c(0, 1, 0, 0, 1, 1, 0, 0, 1, 1)
)

forest_plot(
  lancet_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "outcome",
  columns = list(
    col_text("events", "Events (Tx/Ctrl)"),
    col_interval("HR (95% CI)")
  ),
  row_type = "rtype", row_bold = "rbold", row_indent = "rindent",
  theme = web_theme_lancet(),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio (95% CI)",
  title = "Figure 3: Efficacy Outcomes",
  caption = "Primary endpoint shown in bold. HR<1 favours treatment.",
  footnote = "Cox proportional hazards model stratified by region."
)
