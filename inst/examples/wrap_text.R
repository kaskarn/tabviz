# Wrap text demo: long descriptions wrap into multi-line cells when
# col_text(wrap = TRUE) or wrap = N (extra lines beyond the first).

library(tabviz)
library(dplyr)

wrap_data <- tibble(
  trial = c("ADVANCE", "CARDINAL", "ELEVATE", "FRONTIER"),
  description = c(
    "Multinational randomized double-blind trial of intervention vs standard care across 47 sites.",
    "Phase III pivotal study evaluating long-term cardiovascular outcomes in high-risk subjects.",
    "Pragmatic open-label trial conducted in primary care.",
    "Adaptive design platform trial with multiple arms enrolled sequentially over five years."
  ),
  notes = c(
    "Primary endpoint met.\nSubgroup heterogeneity observed.",
    "Reduced events.",
    "Equivalent benefit; lower adherence than ADVANCE.",
    "Two arms futile; one continued."
  ),
  hr = c(0.74, 0.78, 0.71, 0.82),
  lower = c(0.62, 0.66, 0.60, 0.71),
  upper = c(0.88, 0.92, 0.84, 0.95)
)

forest_plot(
  wrap_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "trial",
  columns = list(
    col_text("description", "Description", width = 280, wrap = TRUE),
    col_text("notes", "Notes", width = 180, wrap = 2),
    col_interval("hr", "lower", "upper", header = "HR (95% CI)")
  ),
  scale = "log", null_value = 1,
  axis_label = "Hazard Ratio",
  title = "Wrap demo",
  subtitle = "wrap = TRUE allows up to 2 lines; wrap = 2 allows up to 3 lines"
)
