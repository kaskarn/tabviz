# Example: JAMA journal style
# Demonstrates: JAMA theme, minimal styling, professional appearance

library(tabviz)
library(dplyr)

# Intervention study data
intervention_data <- tibble(
  subgroup = c(
    "All Patients",
    "Age <65 years",
    "Age >=65 years",
    "Male",
    "Female",
    "BMI <30",
    "BMI >=30",
    "Diabetes",
    "No Diabetes",
    "Prior MI",
    "No Prior MI"
  ),
  rr = c(0.82, 0.78, 0.88, 0.80, 0.85, 0.84, 0.79, 0.76, 0.86, 0.74, 0.89),
  lower = c(0.74, 0.66, 0.76, 0.70, 0.72, 0.72, 0.66, 0.62, 0.76, 0.60, 0.78),
  upper = c(0.91, 0.92, 1.02, 0.91, 1.00, 0.98, 0.95, 0.93, 0.97, 0.91, 1.02),
  n_int = c(5000, 2400, 2600, 3200, 1800, 2800, 2200, 1500, 3500, 1200, 3800),
  n_ctrl = c(5000, 2380, 2620, 3180, 1820, 2750, 2250, 1480, 3520, 1190, 3810),
  p_int = c(0.001, 0.005, 0.089, 0.001, 0.048, 0.025, 0.012, 0.008, 0.003, 0.004, 0.098),
  row_type = c("summary", rep("data", 10)),
  row_bold = c(TRUE, rep(FALSE, 10))
)

# Create JAMA-style forest plot
forest_plot(
  intervention_data,
  point = "rr",
  lower = "lower",
  upper = "upper",
  label = "subgroup",
  label_header = "Subgroup",
  columns = list(
    col_numeric("n_int", "Intervention (n)"),
    col_numeric("n_ctrl", "Control (n)"),
    col_interval("RR (95% CI)"),
    col_pvalue("p_int", "P Value")
  ),
  row_type = "row_type",
  row_bold = "row_bold",
  theme = web_theme_jama(),
  scale = "log",
  null_value = 1,
  axis_label = "Relative Risk (95% CI)",
  title = "Primary Outcome by Prespecified Subgroups",
  subtitle = "Composite of Death, MI, or Stroke at 1 Year",
  footnote = "RR indicates relative risk; CI, confidence interval"
)
