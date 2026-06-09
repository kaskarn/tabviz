# Gallery Example 34: Solarized (light)
# Ethan Schoonover's Solarized palette in light variant — base3 cream
# surfaces, base02 slate text, yellow primary, magenta accent.
# Pairs with web_theme_aurora() via the light_dark_pair field.

library(tabviz)

solarized_data <- data.frame(
  language  = c("Rust", "Go", "TypeScript", "Python", "C++", "Java"),
  stars_k   = c(94, 121, 99, 213, 110, 88),
  contribs  = c(5200, 4100, 6900, 14200, 3800, 4500),
  releases  = c(28, 18, 52, 31, 8, 12),
  health    = c("excellent", "excellent", "excellent", "good", "good", "fair")
)

tabviz(
  solarized_data,
  label = "language",
  label_header = "Language",
  theme = web_theme_ledger(),
  columns = list(
    col_numeric("stars_k", header = "★ (k)", decimals = 0),
    col_numeric("contribs", header = "Contributors", decimals = 0, thousands_sep = ","),
    col_numeric("releases", header = "Releases/yr", decimals = 0),
    col_badge("health", header = "Health")
  ),
  title = "Open-source language ecosystems",
  caption = "Theme: Solarized — Ethan Schoonover's palette, light variant."
)
