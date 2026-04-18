# Example: New column options (Track 3)
# Demonstrates: text truncation, log/sqrt scales on bar/progress/heatmap,
# stars with arbitrary domain remap.

library(tabviz)

showcase_data <- data.frame(
  study = c("Trial A", "Trial B", "Trial C", "Trial D", "Trial E"),
  notes = c(
    "A very long descriptive note that should get truncated",
    "Short note",
    "Another quite long row annotation here",
    "Tiny",
    "Medium-length note"
  ),
  hr = c(0.72, 0.85, 0.91, 0.65, 1.05),
  lower = c(0.55, 0.70, 0.75, 0.50, 0.88),
  upper = c(0.95, 1.03, 1.10, 0.85, 1.25),
  rare_events = c(1, 10, 100, 1000, 10000),
  score100 = c(92, 75, 50, 20, 5),
  completion = c(2, 25, 50, 75, 98),
  correlation = c(0.001, 0.01, 0.1, 0.5, 0.99)
)

forest_plot(
  showcase_data,
  point = "hr",
  lower = "lower",
  upper = "upper",
  label = "study",
  columns = list(
    col_text("notes", "Notes", max_chars = 18),
    col_bar("rare_events", "Events (log)", scale = "log"),
    col_progress("completion", "Progress (sqrt)", scale = "sqrt"),
    col_heatmap("correlation", "Corr (log)", scale = "log",
                min_value = 0.001, max_value = 1),
    col_stars("score100", "Quality",
              max_stars = 8, domain = c(0, 100))
  ),
  scale = "log",
  null_value = 1,
  axis_label = "HR (95% CI)",
  title = "New column options showcase",
  subtitle = "Truncation, non-linear scales, stars domain remap"
)
