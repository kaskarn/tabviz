# Gallery Example 7: Annotations & Reference Lines
# refline() for vertical threshold lines, forest_annotation() for per-row glyphs

library(tabviz)
library(dplyr)

annotation_data <- tibble(
  study = c("LOW-DOSE", "MID-DOSE", "HIGH-DOSE", "COMBO-A", "COMBO-B"),
  or = c(0.92, 0.75, 0.58, 0.62, 0.48),
  lower = c(0.78, 0.62, 0.45, 0.50, 0.38),
  upper = c(1.08, 0.91, 0.75, 0.77, 0.61),
  dose_mg = c(50, 100, 200, 150, 250)
)

tabviz(
  annotation_data,
  label = "study",
  columns = list(
    col_numeric("dose_mg", "Dose (mg)", width = 100),
    col_interval("or", "lower", "upper", header = "OR (95% CI)"),
    viz_forest(
      point = "or", lower = "lower", upper = "upper",
      scale = "log", null_value = 1,
      axis_label = "Odds Ratio",
      annotations = list(
        # Column-level threshold lines
        refline(0.80, label = "Clinically meaningful", style = "dashed", color = "#16a34a"),
        refline(0.50, label = "Target effect", style = "solid", color = "#dc2626"),
        # Per-row glyphs on specific studies
        forest_annotation("HIGH-DOSE", shape = "star", position = "after", color = "#f59e0b"),
        forest_annotation("COMBO-B",   shape = "star", position = "after", color = "#f59e0b")
      )
    )
  ),
  theme = web_theme_cochrane(),
  title = "Annotations & Reference Lines",
  subtitle = "refline() for thresholds; forest_annotation() flags individual rows",
  caption = "Green dashed = clinically meaningful; red solid = target; stars flag preferred regimens"
)
