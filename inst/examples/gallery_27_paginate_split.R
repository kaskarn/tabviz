# Gallery Example 27: Pagination across split_by
#
# `paginate` cascades into every subview when combined with `split_by`. The
# default `break_on = "split"` ensures each subview owns its own page set
# (its own row-count budget); inside a subview, group integrity holds. PDF
# export emits one combined PDF per split leaf — e.g. `save_plot(sf,
# "out/region.pdf")` writes `out/North.pdf`, `out/South.pdf`, ... each
# containing that region's pages.

library(tabviz)

set.seed(404)
regions <- c("North America", "Europe", "Asia-Pacific", "Latin America")
sites_per_region <- 18
n <- length(regions) * sites_per_region

split_data <- data.frame(
  site = unlist(lapply(seq_along(regions), function(i) {
    sprintf("%s site %02d", substr(regions[i], 1, 4), seq_len(sites_per_region))
  })),
  region = rep(regions, each = sites_per_region),
  arm    = rep(c("Treatment", "Placebo"), length.out = n),
  n      = sample(c(80, 120, 240, 400), n, replace = TRUE),
  rr     = round(rnorm(n, 0.85, 0.14), 2)
)
split_data$lower <- pmax(0.30, round(split_data$rr - 0.18, 2))
split_data$upper <- round(split_data$rr + 0.18, 2)

tabviz(
  split_data,
  label = "site",
  label_header = "Site",
  group = "arm",
  split_by = "region",
  columns = list(
    col_n("n"),
    viz_forest(point = "rr", lower = "lower", upper = "upper",
               header = "Risk ratio (95% CI)",
               scale = "log", null_value = 1,
               axis_label = "Risk ratio"),
    col_interval("rr", "lower", "upper", header = "RR")
  ),
  theme = web_theme_cochrane(),
  title = "Multi-region efficacy",
  subtitle = "Each region paginates independently at 10 rows per page",
  caption = "Use the sidebar to walk between regions; the page controls appear below each subview.",
  paginate = paginate_spec(rows = 10)
)
