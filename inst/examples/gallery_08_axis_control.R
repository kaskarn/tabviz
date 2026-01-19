# Gallery Example 8: Axis Control and CI Clipping
# Demonstrates axis range handling with widely varying confidence intervals

library(tabviz)
library(dplyr)

# Use the effect_sizes stress test dataset
data(effect_sizes)

# Example 1: Default axis behavior with extreme CIs
# The axis algorithm automatically handles studies with very wide CIs
# by clipping them and showing arrows to indicate truncation
default_axis <- effect_sizes |>
  forest_plot(
    point = "hr", lower = "lower", upper = "upper",
    label = "study",
    columns = list(
      col_numeric("n", header = "N"),
      col_interval("HR (95% CI)")
    ),
    scale = "log", null_value = 1,
    axis_label = "Hazard Ratio (log scale)",
    title = "Default Axis Handling",
    subtitle = "Automatic range with CI clipping",
    caption = "Note: Arrows indicate CIs extending beyond axis limits"
  )

# Example 2: Custom axis range with explicit limits
# Forces a narrower range, causing more CIs to be clipped
narrow_range <- effect_sizes |>
  filter(outcome == "Primary") |>
  forest_plot(
    point = "hr", lower = "lower", upper = "upper",
    label = "study",
    columns = list(col_interval("HR (95% CI)")),
    scale = "log", null_value = 1,
    axis_range = c(0.5, 1.5),
    axis_ticks = c(0.5, 0.75, 1, 1.25, 1.5),
    axis_label = "Hazard Ratio",
    title = "Custom Axis Range",
    subtitle = "axis_range = c(0.5, 1.5)",
    caption = "Tighter range for high-precision primary outcome studies"
  )

# Example 3: Gridlines and custom ticks
with_gridlines <- effect_sizes |>
  forest_plot(
    point = "hr", lower = "lower", upper = "upper",
    label = "study",
    columns = list(
      col_text("outcome", header = "Outcome"),
      col_interval("HR (95% CI)")
    ),
    scale = "log", null_value = 1,
    axis_ticks = c(0.1, 0.25, 0.5, 1, 2, 4),
    theme = web_theme_modern() |>
      set_axis(gridlines = TRUE, gridline_style = "dotted"),
    axis_label = "Hazard Ratio (log scale)",
    title = "With Gridlines",
    subtitle = "Custom ticks on log scale with dotted gridlines"
  )

# Example 4: Controlling CI clipping threshold
# ci_clip_factor controls how far CIs can extend before being clipped
# Lower values = more aggressive clipping
aggressive_clip <- effect_sizes |>
  forest_plot(
    point = "hr", lower = "lower", upper = "upper",
    label = "study",
    columns = list(col_interval("HR (95% CI)")),
    scale = "log", null_value = 1,
    theme = web_theme_modern() |>
      set_axis(ci_clip_factor = 1.0),  # More aggressive clipping
    axis_label = "Hazard Ratio",
    title = "Aggressive CI Clipping",
    subtitle = "ci_clip_factor = 1.0 (default is 2.0)",
    caption = "More CIs are clipped with lower ci_clip_factor"
  )

# Return the default example
default_axis
