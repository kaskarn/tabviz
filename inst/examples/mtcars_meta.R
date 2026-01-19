# Example: Meta-analysis style forest plot using mtcars
# Demonstrates: weight bars, p-values, theme presets, titles/captions, column positioning

library(tabviz)
library(dplyr)

# Transform mtcars into a meta-analysis style dataset
# Each car is a "study" with effect size and confidence interval
set.seed(42)
meta_data <- mtcars |>
  tibble::rownames_to_column("study") |>
  mutate(
    # Create effect sizes from scaled mpg
    effect = scale(mpg)[, 1],
    se = 0.15 + runif(n()) * 0.25,
    lower = effect - 1.96 * se,
    upper = effect + 1.96 * se,
    # Compute weights (inverse variance)
    weight = 1 / se^2,
    # Compute p-values
    pvalue = 2 * pnorm(-abs(effect / se)),
    # Group by cylinder count
    group = paste0(cyl, " Cylinder")
  ) |>
  select(study, effect, lower, upper, weight, pvalue, group, hp, wt)

# Create forest plot with JAMA theme
# Note: columns on left, statistics on right
forest_plot(
  meta_data,
  point = "effect",
  lower = "lower",
  upper = "upper",
  label = "study",
  group = "group",
  weight = "weight",  # Scale marker sizes by inverse-variance weight
  columns = list(
    col_numeric("hp", "HP"),
    col_numeric("wt", "Wt"),
    col_bar("weight", "Weight"),
    col_pvalue("pvalue", "P")
  ),
  theme = web_theme_jama(),
  axis_label = "Standardized Effect (95% CI)",
  title = "Meta-analysis of Fuel Efficiency",
  subtitle = "Effect sizes grouped by cylinder count",
  caption = "Source: mtcars dataset (R)",
  footnote = "* Weights computed as inverse variance"
)
