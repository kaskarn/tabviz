# Example: Hierarchical column headers with col_group()
# Demonstrates: multi-level column headers, grouped statistics

library(tabviz)
library(dplyr)

# Create data with multiple related outcome columns
set.seed(321)
outcomes_data <- tibble(
  study = c(
    "PARADIGM-HF 2014",
    "DAPA-HF 2019",
    "EMPEROR-Reduced 2020",
    "GALACTIC-HF 2020",
    "VICTORIA 2020"
  ),
  # Primary endpoint (cardiovascular death or HF hospitalization)
  primary_hr = c(0.80, 0.74, 0.75, 0.92, 0.90),
  primary_lower = c(0.73, 0.65, 0.65, 0.86, 0.82),
  primary_upper = c(0.87, 0.85, 0.86, 0.99, 0.98),
  primary_p = c(0.001, 0.001, 0.001, 0.025, 0.019),
  # CV death component
  cvdeath_hr = c(0.80, 0.82, 0.92, 0.96, 0.93),
  cvdeath_lower = c(0.71, 0.69, 0.75, 0.85, 0.81),
  cvdeath_upper = c(0.89, 0.98, 1.12, 1.08, 1.06),
  cvdeath_p = c(0.001, 0.029, 0.382, 0.494, 0.281),
  # HF hospitalization component
  hfhosp_hr = c(0.79, 0.70, 0.69, 0.92, 0.90),
  hfhosp_lower = c(0.71, 0.59, 0.59, 0.84, 0.81),
  hfhosp_upper = c(0.89, 0.83, 0.81, 1.01, 1.00),
  hfhosp_p = c(0.001, 0.001, 0.001, 0.070, 0.048),
  # Sample size
  n = c(8442, 4744, 3730, 8256, 5050)
)

# Create forest plot with grouped column headers
# Using col_group() to create hierarchical headers
forest_plot(
  outcomes_data,
  point = "primary_hr",
  lower = "primary_lower",
  upper = "primary_upper",
  label = "study",
  columns = list(
    col_numeric("n", "N"),
    # Group: Primary Endpoint
    col_group(
      "Primary Endpoint",
      col_interval("HR (95% CI)"),
      col_pvalue("primary_p", "P")
    ),
    # Group: Components (nested columns)
    col_group(
      "CV Death",
      col_numeric("cvdeath_hr", "HR"),
      col_pvalue("cvdeath_p", "P")
    ),
    col_group(
      "HF Hosp",
      col_numeric("hfhosp_hr", "HR"),
      col_pvalue("hfhosp_p", "P")
    )
  ),
  theme = web_theme_modern(),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard Ratio (95% CI)",
  title = "Heart Failure Trials: Primary and Component Endpoints",
  subtitle = "Comparing ARNI, SGLT2i, and novel agents",
  caption = "Primary endpoint: CV death or HF hospitalization",
  footnote = "All trials enrolled patients with reduced ejection fraction"
)
