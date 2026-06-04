# Stage 4 showcase — Synthwave theme.
#
# A nighttime-deployment server-health dashboard. Float shell removes
# all chrome so the data drifts on its own elevation shadow; grid
# texture evokes the retro perspective rail; monospace typography
# carries the terminal vibe. Magenta brand + cyan decorative + yellow
# accent — the neon palette.

library(tabviz)

servers <- data.frame(
  region    = c("US-East-1", "US-West-2", "EU-Central", "EU-West",
                "Asia-PA",   "Asia-NE",   "LATAM",      "ME-South"),
  cluster   = c("primary",   "primary",   "replica",    "replica",
                "primary",   "replica",   "edge",       "edge"),
  uptime_pct = c(99.997, 99.991, 99.983, 99.978, 99.962, 99.947, 99.871, 99.659),
  p99_ms     = c(38, 42, 47, 51, 89, 102, 145, 312),
  p99_lo     = c(34, 38, 41, 45, 78, 89, 124, 244),
  p99_hi     = c(43, 47, 54, 58, 102, 117, 168, 398),
  alerts     = c(0, 1, 0, 2, 3, 5, 12, 27),
  status     = c("nominal", "nominal", "nominal", "watch",
                 "watch",   "warn",    "warn",    "crit"),
  row_accent = c(FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE),
  row_muted  = c(FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
)

forest_plot(
  servers,
  point = "p99_ms", lower = "p99_lo", upper = "p99_hi",
  label = "region",
  row_accent = "row_accent",
  columns = list(
    col_text("cluster", header = "cluster"),
    col_numeric("uptime_pct", header = "uptime %", decimals = 3),
    col_n("alerts", header = "alerts"),
    col_badge("status",
              variants = c(nominal = "success",
                           watch   = "default",
                           warn    = "warning",
                           crit    = "negative"),
              outline = TRUE)
  ),
  axis_label = "p99 response latency (ms)",
  title = "REGION_HEALTH_AUDIT // 0314.UTC",
  subtitle = "stage_4 showcase :: synthwave theme :: float shell + grid texture + jetbrains mono",
  theme = web_theme_synthwave()
)
