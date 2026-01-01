# Example: Row-level styling with row_* parameters
# Demonstrates: headers, summaries, bold/italic, colors, indentation, icons, badges

library(webforest)
library(dplyr)

# Create a structured meta-analysis table with row-level styling
# Style columns are referenced by name in web_spec/forest_plot
styled_data <- tibble(
  study = c(
    "Cardiovascular Outcomes",
    "  EMPA-REG 2015",
    "  CANVAS 2017",
    "  DECLARE 2019",
    "  Subtotal",
    "",
    "Renal Outcomes",
    "  CREDENCE 2019",
    "  DAPA-CKD 2020",
    "  Subtotal",
    "",
    "Overall"
  ),
  hr = c(NA, 0.86, 0.86, 0.93, 0.88, NA, NA, 0.70, 0.61, 0.66, NA, 0.78),
  lower = c(NA, 0.74, 0.75, 0.84, 0.82, NA, NA, 0.59, 0.51, 0.57, NA, 0.73),
  upper = c(NA, 0.99, 0.97, 1.03, 0.95, NA, NA, 0.82, 0.72, 0.76, NA, 0.84),
  n = c(NA, 7020, 10142, 17160, 34322, NA, NA, 4401, 4304, 8705, NA, 43027),

  # Row styling columns (regular columns, referenced by name)
  row_type = c(
    "header", "data", "data", "data", "summary", "spacer",
    "header", "data", "data", "summary", "spacer",
    "summary"
  ),
  row_bold = c(
    TRUE, FALSE, FALSE, FALSE, TRUE, FALSE,
    TRUE, FALSE, FALSE, TRUE, FALSE,
    TRUE
  ),
  row_indent = c(
    0, 1, 1, 1, 1, 0,
    0, 1, 1, 1, 0,
    0
  ),
  row_color = c(
    "#0369a1", NA, NA, NA, "#0369a1", NA,
    "#0369a1", NA, NA, "#0369a1", NA,
    "#166534"
  ),
  row_badge = c(
    NA, NA, NA, NA, "n=3", NA,
    NA, NA, NA, "n=2", NA,
    "n=5"
  )
)

# Create forest plot with row styling
forest_plot(
  styled_data,
  point = "hr",
  lower = "lower",
  upper = "upper",
  label = "study",
  columns = list(
    col_numeric("n", "N", position = "right"),
    col_interval("HR (95% CI)", position = "right")
  ),
  # Row styling: reference columns by name
  row_type = "row_type",
  row_bold = "row_bold",
  row_indent = "row_indent",
  row_color = "row_color",
  row_badge = "row_badge",
  theme = web_theme_modern(),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard Ratio (95% CI)",
  title = "SGLT2 Inhibitors Meta-Analysis",
  subtitle = "Cardiovascular and renal outcomes",
  caption = "Data from landmark SGLT2 inhibitor trials",
  footnote = "Headers in blue, overall summary in green"
)
