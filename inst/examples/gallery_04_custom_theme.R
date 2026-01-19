# Gallery Example 4: Custom Theme Building
# Building a branded theme from scratch with the fluent API

library(tabviz)
library(dplyr)

# Build a "Terminal" theme step by step
terminal_theme <- web_theme_default() |>
  set_colors(
    background = "#0c0c0c",
    foreground = "#00ff00",
    primary = "#00ff00",
    secondary = "#008800",
    muted = "#005500",
    border = "#003300",
    interval_positive = "#00ff00",
    interval_negative = "#ff0000",
    interval_line = "#00cc00",
    summary_fill = "#00ff00",
    summary_border = "#00aa00"
  ) |>
  set_typography(
    font_family = "'Courier New', monospace",
    font_size_base = "0.85rem"
  ) |>
  set_spacing(row_height = 28, header_height = 32) |>
  set_shapes(point_size = 6, line_width = 1.5, border_radius = 0) |>
  set_axis(gridlines = TRUE, gridline_style = "dotted")

theme_demo_data <- tibble(
  process = c("AUTH_SERVICE", "API_GATEWAY", "DB_PRIMARY", "CACHE_LAYER", "MSG_QUEUE"),
  latency_ms = c(12, 45, 8, 3, 28),
  latency_se = c(2, 8, 1.5, 0.5, 5),
  uptime = c(99.99, 99.95, 99.999, 99.99, 99.97),
  rps = c(12500, 8900, 45000, 125000, 3200)
) |>
  mutate(lower = latency_ms - 1.96 * latency_se, upper = latency_ms + 1.96 * latency_se)

forest_plot(
  theme_demo_data,
  point = "latency_ms", lower = "lower", upper = "upper",
  label = "process",
  columns = list(
    col_numeric("uptime", "Uptime %"),
    col_numeric("rps", "RPS"),
    col_interval("Latency ms (95% CI)")
  ),
  theme = terminal_theme,
  null_value = 20,
  axis_label = "Response Latency (ms)",
  title = "Custom Theme: Terminal",
  subtitle = "Built with set_colors(), set_typography(), set_spacing(), set_shapes()",
  caption = "Monospace font, green-on-black, zero border radius"
)
