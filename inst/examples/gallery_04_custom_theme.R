# Gallery Example 4: Custom Theme Building
# Build a branded theme from inputs via web_theme().

library(tabviz)
library(dplyr)

# Terminal theme: bright green brand on dark background.
terminal_theme <- web_theme(
  brand = "#00FF00",
  accent = "#00FF00",
  polarity = "dark",
  density = "comfortable",
  fonts_body = "'Courier New', monospace",
  name = "terminal"
)

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
  subtitle = "Built with web_theme(brand = ..., polarity = 'dark')",
  caption = "Monospace font; brand-mono palette via mode toggle"
)
