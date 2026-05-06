# Gallery Example 18: Viz Columns (Bar, Boxplot, Violin)
# Demonstrates viz_bar(), viz_boxplot(), and viz_violin() columns

library(tabviz)

set.seed(42)
n_groups <- 6
viz_data <- data.frame(
  group = paste("Group", LETTERS[1:n_groups]),
  baseline = round(rnorm(n_groups, 50, 15), 1),
  followup = round(rnorm(n_groups, 65, 12), 1),
  n = sample(30:100, n_groups),
  stringsAsFactors = FALSE
)

# Generate array data for boxplots and violins
viz_data$treatment <- lapply(1:n_groups, function(i) {
  round(rnorm(30, mean = 60 + i * 3, sd = 10), 1)
})
viz_data$control <- lapply(1:n_groups, function(i) {
  round(rnorm(30, mean = 50 + i * 2, sd = 12), 1)
})

spec <- web_spec(
  data = viz_data,
  label = "group",
  label_header = "Group",
  title = "Visualization Columns",
  subtitle = "viz_bar(), viz_boxplot(), and viz_violin() side by side",
  columns = list(
    col_n("n"),
    viz_bar(
      effect_bar("baseline", label = "Baseline", color = "#94a3b8"),
      effect_bar("followup", label = "Follow-up", color = "#3b82f6"),
      header = "Scores",
      width = 180,
      axis_label = "Score"
    ),
    viz_boxplot(
      effect_boxplot(data = "treatment", label = "Treatment", color = "#3b82f6"),
      effect_boxplot(data = "control", label = "Control", color = "#f59e0b"),
      header = "Distributions",
      width = 200,
      axis_label = "Value",
      show_outliers = TRUE
    ),
    viz_violin(
      effect_violin(data = "treatment", label = "Treatment", color = "#3b82f6"),
      effect_violin(data = "control", label = "Control", color = "#f59e0b"),
      header = "KDE",
      width = 180,
      show_median = TRUE,
      show_quartiles = TRUE,
      axis_label = "Value"
    )
  ),
  interaction = web_interaction(
    enable_sort = FALSE,
    enable_themes = NULL
  )
)

forest_plot(spec)
