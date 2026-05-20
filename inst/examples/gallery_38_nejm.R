# Gallery Example 38: NEJM
# New England Journal of Medicine — deep navy primary, muted crimson
# accent, Source Serif Pro typography. Distinct sibling to Lancet (which
# uses old-gold accent + Georgia); NEJM is darker navy + crimson + serif.

library(tabviz)

nejm_data <- data.frame(
  trial        = c("PIONEER-3", "ARISTOTLE-II", "REVEAL-CAD",
                   "DIAMOND-AF", "VANGUARD", "Pooled"),
  n            = c(2840, 4120, 3580, 2210, 5400, 18150),
  hr           = c(0.72, 0.84, 0.79, 0.68, 0.82, 0.78),
  lower        = c(0.61, 0.74, 0.67, 0.55, 0.71, 0.73),
  upper        = c(0.85, 0.95, 0.93, 0.84, 0.94, 0.84),
  events_drug  = c(124, 189, 142, 88, 215, 758),
  events_pbo   = c(168, 215, 178, 128, 254, 943),
  p_value      = c(0.0003, 0.0091, 0.0048, 0.0004, 0.0067, 1.2e-8)
)

forest_plot(
  nejm_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "trial",
  columns = list(
    col_n("n", "No."),
    col_events("events_drug", "n", header = "Events / N (treatment)"),
    col_interval("hr", "lower", "upper", header = "HR (95% CI)"),
    col_pvalue("p_value", header = "P value")
  ),
  theme = web_theme_nejm(),
  scale = "log", null_value = 1,
  axis_label = "Hazard ratio (95% CI)",
  title = "Pooled efficacy across CV outcome trials",
  footnote = "Theme: NEJM. Hazard ratios <1 favor the treatment arm."
)
