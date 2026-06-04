# Stage 4 showcase — Executive theme.
#
# A board-level KPI table. Raised shell (the executive card metaphor);
# Inter body for crispness, Cormorant Garamond display for the
# serif-title-on-sans-body executive-summary feel; type scale 1.333
# for the crisp modular rhythm.

library(tabviz)

divisions <- data.frame(
  division   = c("Asia-Pacific",     "EMEA",              "Americas",
                 "Strategic Markets","Financial Services","Innovation Labs",
                 "Operations",       "Corporate"),
  segment    = c("Growth",     "Mature",     "Mature",
                 "Growth",     "Mature",     "Investment",
                 "Operations", "Operations"),
  revenue_m  = c(284.5, 612.8, 789.2, 156.0, 445.3, 89.4, 412.7, 0),
  yoy        = c(1.18, 1.04, 1.07, 1.32, 0.98, 1.41, 1.02, NA),
  yoy_lo     = c(1.12, 0.98, 1.02, 1.20, 0.94, 1.22, 0.98, NA),
  yoy_hi     = c(1.26, 1.10, 1.13, 1.45, 1.03, 1.62, 1.07, NA),
  margin_pct = c(28.2, 32.4, 30.1, 18.9, 41.2, -4.2, 12.4, NA),
  status     = c("on-target", "on-target", "on-target",
                 "exceed",    "on-target", "investment",
                 "watch",     ""),
  row_accent = c(FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE),
  row_muted  = c(FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE)
)

forest_plot(
  divisions,
  point = "yoy", lower = "yoy_lo", upper = "yoy_hi",
  label = "division",
  row_accent = "row_accent",
  row_muted  = "row_muted",
  columns = list(
    col_text("segment", header = "segment"),
    col_numeric("revenue_m", header = "revenue ($M)", decimals = 1),
    col_numeric("margin_pct", header = "margin %", decimals = 1),
    col_badge("status",
              variants = c(`on-target` = "default",
                           `exceed`    = "success",
                           `watch`     = "warning",
                           `investment` = "info"),
              outline = TRUE)
  ),
  null_value = 1,
  axis_label = "YoY growth multiplier",
  title = "Q3 Performance by Division",
  subtitle = "Board summary -- 2026-Q3 -- stage 4 executive theme showcase",
  theme = web_theme_executive()
)
