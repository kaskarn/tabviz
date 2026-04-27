# Gallery Example 23: Ring (donut) gauges
# Demonstrates: single-color rings, threshold-based color shifts,
# integer / percent / decimal label formats, theme-aware defaults.

library(tabviz)

ring_data <- data.frame(
  delegate = c("Elrond", "Gandalf", "Aragorn", "Legolas",
               "Gimli", "Boromir", "Frodo"),
  temptation = c(0.18, 0.32, 0.12, 0.08, 0.14, 0.86, 0.64),
  wisdom_pct = c(95, 92, 78, 60, 55, 40, 80),
  hr = c(0.95, 0.88, 1.02, 1.08, 1.05, 1.32, 0.72),
  lower = c(0.78, 0.72, 0.85, 0.90, 0.88, 1.10, 0.55),
  upper = c(1.12, 1.05, 1.20, 1.28, 1.25, 1.55, 0.90)
)

forest_plot(
  ring_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "delegate",
  columns = list(
    # Single color, percent label (theme accent on a fraction)
    col_ring("temptation", header = "Temptation"),

    # Two-color threshold: gold below 0.5, danger purple above
    col_ring("temptation", header = "Risk shift",
             id = "ring_temptation_shift",
             color = c("#d4a955", "#a855f7"), thresholds = 0.5),

    # Three-color status: positive / warning / negative auto-defaults
    col_ring("temptation", header = "Status",
             id = "ring_temptation_status",
             thresholds = c(0.33, 0.66)),

    # Integer label, custom range, lg size
    col_ring("wisdom_pct", header = "Wisdom",
             min_value = 0, max_value = 100,
             label_format = "integer", size = "lg")
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard ratio",
  title = "Ring column showcase",
  subtitle = "Single color, threshold scale, status auto-default, integer label"
)
