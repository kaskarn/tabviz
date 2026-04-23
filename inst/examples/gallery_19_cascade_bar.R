# Gallery Example 19: Marker cascade — viz_bar (single- and multi-effect)
# Shows how the same row_accent / row_muted / row_emphasis flags apply
# uniformly to bar charts as well as forest plots.
#   Single-effect bar: fill replaced with theme color.
#   Multi-effect bar : each bar keeps its per-effect color; outline added.

library(tabviz)
library(dplyr)

bar_data <- tibble(
  product   = c("Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"),
  q1_rev    = c( 450, 780, 320, 650, 180,  90),
  q2_rev    = c( 520, 820, 340, 680, 210, 110),
  q3_rev    = c( 610, 790, 360, 710, 240, 130),
  q4_rev    = c( 700, 760, 380, 740, 280, 150),
  total_rev = c(2280,3150,1400,2780, 910, 480),
  is_top    = c(TRUE, TRUE, FALSE, TRUE, FALSE, FALSE),
  is_tail   = c(FALSE, FALSE, FALSE, FALSE, TRUE, TRUE)
)

tabviz(
  bar_data,
  label = "product",
  # Two semantic classes applied: top performers highlighted, tail muted.
  row_accent = "is_top",
  row_muted  = "is_tail",
  columns = list(
    col_currency("total_rev", "Total", decimals = 0),
    # Single-effect bar: row_accent replaces fill with accent color, row_muted replaces with muted.
    viz_bar(
      effect_bar("total_rev"),
      header = "Single bar (fill replacement)",
      width = 180
    ),
    # Multi-effect grouped bars: each quarter keeps its color, row_accent adds outline.
    viz_bar(
      effect_bar("q1_rev", label = "Q1", color = "#60a5fa"),
      effect_bar("q2_rev", label = "Q2", color = "#3b82f6"),
      effect_bar("q3_rev", label = "Q3", color = "#2563eb"),
      effect_bar("q4_rev", label = "Q4", color = "#1d4ed8"),
      header = "Quarterly (outline augment)",
      width = 240
    )
  ),
  theme    = web_theme_modern(),
  title    = "Semantic cascade on viz_bar",
  subtitle = "Single-effect: fill replacement. Multi-effect: outline augment."
)
