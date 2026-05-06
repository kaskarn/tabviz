# Gallery Example 26: Pagination — long meta-analysis
#
# When a forest plot has more rows than a printed page can hold, attach a
# `paginate_spec()` to break the table into pages. The HTML viewer renders
# one page at a time with prev/next controls (and a continuous-mode toggle
# for scrollable review); `save_plot(*.pdf)` emits a multi-page PDF via
# `qpdf::pdf_combine()`. PNG/SVG (single-image formats) flatten with a
# warning unless you pass `paginate = NULL` to silence.
#
# Defaults:
#   - `paginate_spec()` paginates at 30 rows per page
#   - group integrity is preserved (no breaks inside a cohort)
#   - `paginate_letter()` / `paginate_a4()` / `paginate_slide()` are presets

library(tabviz)

set.seed(2026)
n_studies <- 72
cohorts <- c("Phase III RCT", "Real-world evidence", "Registry")
counts  <- c(24, 30, 18)

meta <- data.frame(
  study = c(
    sprintf("Trial %02d", 1:counts[1]),
    sprintf("RWE %02d",  1:counts[2]),
    sprintf("Reg %02d",  1:counts[3])
  ),
  cohort = rep(cohorts, times = counts),
  year   = sample(2010:2024, n_studies, replace = TRUE),
  n      = sample(c(120, 240, 480, 960, 1900, 3800), n_studies, replace = TRUE),
  hr     = round(rnorm(n_studies, 0.92, 0.18), 2),
  se     = round(runif(n_studies, 0.06, 0.20), 2)
)
meta$lower <- pmax(0.20, round(meta$hr - 1.96 * meta$se, 2))
meta$upper <- round(meta$hr + 1.96 * meta$se, 2)

tabviz(
  meta,
  label = "study",
  label_header = "Study",
  group = "cohort",
  columns = list(
    col_numeric("year", "Year", decimals = 0),
    col_n("n"),
    viz_forest(point = "hr", lower = "lower", upper = "upper",
               header = "HR (95% CI)", scale = "log", null_value = 1,
               axis_label = "Hazard ratio"),
    col_interval("hr", "lower", "upper", header = "HR")
  ),
  theme = web_theme_jama(),
  title = "GLP-1 receptor agonists — pooled cardiovascular meta-analysis",
  subtitle = "72 studies across three cohorts; paginate at 30 rows per page",
  caption = "Use the prev/next controls below the plot to walk through pages, or switch to continuous mode to scroll.",
  paginate = paginate_letter()
)
