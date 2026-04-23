# Gallery Example 20: Marker cascade — viz_boxplot and viz_violin
# Shows how row_accent / row_muted cascade into distribution viz columns.
# Unlike bar / forest, boxplots and violins already have a stroke as part of
# their glyph. When augmenting (or when the single-effect semantic color is
# applied), that existing stroke takes on the theme semantic color and
# thickens slightly — the row reads as "accented" without doubled outlines.

library(tabviz)
library(dplyr)

set.seed(42)
dist_data <- tibble(
  site           = c("Boston", "London", "Tokyo", "Sydney", "Toronto", "Munich"),
  enrollment     = c(245, 189, 312, 156, 198, 142),
  response_times = I(list(
    rnorm(50, 5.2, 1.1),
    rnorm(50, 4.8, 0.9),
    rnorm(50, 6.1, 1.5),
    rnorm(50, 4.5, 0.8),
    rnorm(50, 5.5, 1.2),
    rnorm(50, 5.8, 1.3)
  )),
  satisfaction   = I(list(
    c(rnorm(60, 8.0, 1.0), rnorm(20, 5, 1.5)),
    rnorm(80, 8.5, 0.7),
    c(rnorm(50, 7.0, 1.5), runif(20, 3, 9)),
    rnorm(75, 9.0, 0.5),
    c(rnorm(40, 7.5, 1.2), rnorm(30, 6, 1.8)),
    c(rnorm(55, 8.2, 0.9), rnorm(20, 6.5, 1.1))
  )),
  is_flagship  = c(TRUE, FALSE, FALSE, TRUE, FALSE, FALSE),
  is_pilot     = c(FALSE, FALSE, FALSE, FALSE, FALSE, TRUE)
)

tabviz(
  dist_data,
  label = "site",
  row_accent = "is_flagship",   # theme accent on flagship sites
  row_muted  = "is_pilot",      # muted on pilot site
  columns = list(
    col_numeric("enrollment", "N", decimals = 0),
    viz_boxplot(
      effect_boxplot(data = "response_times"),
      header = "Response time (days)",
      show_outliers = TRUE,
      width = 220
    ),
    viz_violin(
      effect_violin(data = "satisfaction"),
      header = "Satisfaction (1–10)",
      show_median = TRUE,
      show_quartiles = TRUE,
      width = 220
    )
  ),
  theme    = web_theme_modern(),
  title    = "Semantic cascade on distribution viz",
  subtitle = "Flagship sites pop in accent; pilot site is muted. Same row_* args work for box/violin.",
  caption  = "Box and violin glyphs already have strokes; the cascade re-colors them."
)
