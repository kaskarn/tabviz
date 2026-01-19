# Gallery Example 16: Split Forest Plots
# Demonstrates splitting forest plots by categorical variables
# for subgroup analysis with sidebar navigation

library(tabviz)

# Use the effect_sizes stress test dataset
# This dataset has multiple grouping variables and widely varying CIs
data(effect_sizes)

# Example 1: Split by a single variable - creates flat navigation
single_split <- effect_sizes |>
  forest_plot(
    point = "hr", lower = "lower", upper = "upper",
    label = "study",
    columns = list(
      col_numeric("n", header = "N"),
      col_interval("HR (95% CI)")
    ),
    split_by = "region",
    scale = "log", null_value = 1,
    axis_label = "Hazard Ratio (95% CI)",
    title = "Treatment Effect by Region",
    subtitle = "Single variable split creates flat navigation"
  )

# Example 2: Split by multiple variables - creates hierarchical navigation
# Note how each subgroup may have different axis ranges due to varying CI widths
hierarchical_split <- effect_sizes |>
  web_spec(
    label = "study",
    columns = list(
      col_text("phase", header = "Phase"),
      col_numeric("n", header = "N"),
      col_forest(
        point = "hr", lower = "lower", upper = "upper",
        scale = "log", null_value = 1,
        axis_label = "Hazard Ratio (95% CI)"
      ),
      col_interval("HR (95% CI)")
    )
  ) |>
  split_table(by = c("outcome", "treatment")) |>
  forest_plot(
    title = "Subgroup Analysis",
    subtitle = "Hierarchical split: Outcome > Treatment"
  )

# Example 3: Shared axis for easier comparison across subgroups
# When shared_axis = TRUE, all subgroups use the same axis range
# This is especially useful when CI widths vary greatly between subgroups
shared_axis_split <- effect_sizes |>
  web_spec(
    label = "study",
    columns = list(
      col_forest(
        point = "hr", lower = "lower", upper = "upper",
        scale = "log", null_value = 1,
        axis_label = "Hazard Ratio"
      )
    )
  ) |>
  split_table(by = "outcome", shared_axis = TRUE) |>
  forest_plot(
    title = "Shared Axis Comparison",
    subtitle = "shared_axis = TRUE ensures consistent scale",
    caption = "All outcome groups share the same axis range for visual comparison"
  )

# Example 4: Split by treatment with region shown in table
# Demonstrates combining split_by with grouping in the table view
treatment_split <- effect_sizes |>
  web_spec(
    label = "study",
    columns = list(
      col_text("region", header = "Region"),
      col_text("phase", header = "Phase"),
      col_forest(
        point = "hr", lower = "lower", upper = "upper",
        scale = "log", null_value = 1,
        axis_label = "Hazard Ratio (95% CI)"
      ),
      col_interval("HR (95% CI)")
    )
  ) |>
  split_table(by = "treatment") |>
  forest_plot(
    title = "Effect by Treatment Arm",
    subtitle = "Split by treatment, grouped by region in table"
  )

# Return the hierarchical split as the main example
hierarchical_split
