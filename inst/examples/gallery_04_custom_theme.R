# Gallery Example 4: Custom Theme Building
# Building a branded theme from scratch with the fluent API

library(tabviz)
library(dplyr)

# Build a "Terminal" theme via the v2 inputs API.
terminal_theme <- web_theme(
  name = "terminal",
  inputs = list(
    neutral = c("#0C0C0C", "#0C0C0C", "#1A1A1A", "#005500", "#00FF00"),
    brand = "#00FF00",
    accent = "#00FF00",
    series_anchors = c("#00FF00", "#00CC00", "#008800", "#005500", "#003300"),
    font_body = "'Courier New', monospace"
  )
) |>
  set_spacing(row_height = 28, header_height = 32) |>
  set_theme_field(c("plot", "gridline"), "#003300") |>
  set_theme_field(c("plot", "point_size"), 6) |>
  set_theme_field(c("plot", "line_width"), 1.5) |>
  set_theme_field(c("axis", "gridlines"), TRUE)

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
    col_interval("latency_ms", "lower", "upper", header = "Latency ms (95% CI)")
  ),
  theme = terminal_theme,
  null_value = 20,
  axis_label = "Response Latency (ms)",
  title = "Custom Theme: Terminal",
  subtitle = "Built with web_theme(inputs=, variants=) + set_spacing()",
  caption = "Monospace font, green-on-black, zero border radius"
)
