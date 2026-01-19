# Example: Interactive features demo
# Demonstrates: Group headers, tooltips on hover, click to select, collapse/expand
# TIP: Hover over intervals for tooltips, click rows to select, click group headers to collapse

library(tabviz)
library(dplyr)

# Clinical trial meta-analysis with treatment classes
meta_data <- tibble(
  study = c(
    # SGLT2 Inhibitors
    "EMPA-REG OUTCOME", "CANVAS Program", "DECLARE-TIMI 58", "CREDENCE",
    # GLP-1 Receptor Agonists
    "LEADER", "SUSTAIN-6", "REWIND", "PIONEER 6",
    # DPP-4 Inhibitors
    "SAVOR-TIMI 53", "EXAMINE", "TECOS", "CARMELINA"
  ),
  drug_class = c(
    rep("SGLT2 Inhibitors", 4),
    rep("GLP-1 Receptor Agonists", 4),
    rep("DPP-4 Inhibitors", 4)
  ),
  hr = c(
    0.86, 0.86, 0.93, 0.80,  # SGLT2i
    0.87, 0.74, 0.88, 0.79,  # GLP-1 RA
    1.00, 0.96, 0.98, 1.02   # DPP-4i
  ),
  lower = c(
    0.74, 0.75, 0.84, 0.67,
    0.78, 0.58, 0.79, 0.57,
    0.89, 0.80, 0.89, 0.89
  ),
  upper = c(
    0.99, 0.97, 1.03, 0.95,
    0.97, 0.95, 0.99, 1.11,
    1.12, 1.15, 1.08, 1.17
  ),
  n = c(
    7020, 10142, 17160, 4401,
    9340, 3297, 9901, 3183,
    16492, 5380, 14671, 6979
  ),
  events = c(
    490, 585, 756, 245,
    608, 108, 594, 137,
    1222, 305, 839, 434
  ),
  year = c(
    2015, 2017, 2019, 2019,
    2016, 2016, 2019, 2019,
    2013, 2013, 2015, 2018
  )
)

# Create interactive forest plot
forest_plot(
  meta_data,
  point = "hr",
  lower = "lower",
  upper = "upper",
  label = "study",
  label_header = "Trial",
  group = "drug_class",
  columns = list(
    col_numeric("year", "Year"),
    col_numeric("n", "N"),
    col_numeric("events", "Events"),
    col_interval("HR (95% CI)"),
    col_bar("n", "Sample Size")
  ),
  theme = web_theme_modern(),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard Ratio for MACE (95% CI)",
  title = "Cardiovascular Outcomes Trials: Diabetes Medications",
  subtitle = "Major Adverse Cardiovascular Events (MACE)",
  caption = "Click group headers to collapse. Click rows to select. Hover for details.",
  footnote = "HR < 1 favors treatment"
)
