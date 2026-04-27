# Gallery Example 24: Badge shapes, outline, and threshold scale
# Demonstrates the col_badge refactor: shape (pill/circle/square),
# outline mode, and threshold-driven color for numeric values
# (the editorial "Balrog Risk" colored-disc-with-number pattern).

library(tabviz)

badge_data <- data.frame(
  shaft       = c("Front Hall", "Hall of Thrór", "Black Lode", "King's Vein",
                  "Mithril Seam", "Eastern Drift", "Deep Foundry", "Drum Chamber"),
  status      = c("singing", "yielding", "yielding", "yielding",
                  "watch", "watch", "hazardous", "abandon"),
  balrog_risk = c(0L, 0L, 1L, 1L, 2L, 3L, 4L, 9L),
  hr          = c(0.78, 0.85, 0.92, 0.95, 1.02, 1.08, 1.18, 1.45),
  lower       = c(0.62, 0.70, 0.78, 0.80, 0.88, 0.92, 1.02, 1.20),
  upper       = c(0.98, 1.03, 1.08, 1.12, 1.18, 1.27, 1.36, 1.75)
)

forest_plot(
  badge_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "shaft",
  columns = list(
    # Pill shape (default) with categorical color mapping
    col_badge("status",
              colors = c("singing" = "#dc2626",
                         "yielding" = "#06b6d4",
                         "watch" = "#f59e0b",
                         "hazardous" = "#a855f7",
                         "abandon" = "#7e22ce")),

    # Pill in outline mode (low-emphasis variant)
    col_badge("status", id = "badge_status_outline",
              header = "Status (outline)",
              outline = TRUE,
              colors = c("singing" = "#dc2626",
                         "yielding" = "#06b6d4",
                         "watch" = "#f59e0b",
                         "hazardous" = "#a855f7",
                         "abandon" = "#7e22ce")),

    # CIRCLE + threshold scale (Balrog Risk: green safe / amber watch / red danger)
    col_badge("balrog_risk", header = "Balrog risk",
              shape = "circle",
              thresholds = c(2, 5),     # 2 thresholds → status palette auto-defaults
              size = "base"),

    # SQUARE shape (compact tag-code badge)
    col_badge("balrog_risk", id = "badge_risk_sq",
              header = "Risk (sq)",
              shape = "square",
              thresholds = c(2, 5))
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard ratio",
  title = "Badge shapes, outline, and threshold scale",
  subtitle = "Pill (default) + outline · circle/square + threshold-driven status palette"
)
