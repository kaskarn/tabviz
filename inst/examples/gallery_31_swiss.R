# Gallery Example 31: Swiss / International Style
# Mono-with-accent: near-black + mid-gray + a single Swiss red note.
# Grid rigor through restraint — no alt-row banding, subtle dividers only,
# Helvetica system stack. Distinct from JAMA: comfortable density,
# dividerless rather than ultra-compact + black-rule.

library(tabviz)

swiss_data <- data.frame(
  study    = c("Trial A", "Trial B", "Trial C", "Trial D", "Trial E", "Pooled"),
  n        = c(840, 1200, 615, 980, 1450, 5085),
  hr       = c(0.78, 0.82, 0.71, 0.85, 0.79, 0.80),
  lower    = c(0.65, 0.71, 0.55, 0.74, 0.68, 0.74),
  upper    = c(0.93, 0.95, 0.92, 0.98, 0.92, 0.86),
  weight   = c(0.18, 0.22, 0.14, 0.20, 0.26, NA)
)

forest_plot(
  swiss_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "study",
  columns = list(
    col_numeric("n", "N", decimals = 0, thousands_sep = ","),
    col_interval("hr", "lower", "upper", header = "HR (95% CI)")
  ),
  theme = web_theme_swiss(),
  scale = "log", null_value = 1,
  axis_label = "Hazard ratio",
  title = "Meta-analysis — typographic grid",
  footnote = "Theme: Swiss. Pooled estimate at the bottom."
)
