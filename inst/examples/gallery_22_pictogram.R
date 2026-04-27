# Gallery Example 22: Pictograms
# Repeated-glyph columns for counts and ratings.
# Demonstrates: count mode (no cap), rating mode (cap + ghost slots),
# per-row glyph mapping, value labels, and theme-aware default colors.

library(tabviz)

pictogram_data <- data.frame(
  unit       = c("Witch-king", "Khamûl", "Ulairë Attea", "Ulairë Cantea",
                 "Ulairë Lemenya", "Ulairë Enquea", "Ulairë Otsea",
                 "Ulairë Toldea", "Ulairë Nelya"),
  team_score = c(9.0, 9.0, 9.0, 8.1, 8.1, 8.1, 8.1, 8.1, 8.1),
  perf       = c(5, 5, 5, 4, 4, 3, 3, 2, 1),
  threat     = c("high", "high", "high", "med", "med", "med", "med", "low", "low"),
  songs_sung = c(4, 5, 4, 5, 5, 3, 3, 0, 5),
  hr         = c(0.72, 0.85, 0.91, 0.65, 1.05, 0.88, 0.95, 1.15, 0.78),
  lower      = c(0.55, 0.70, 0.75, 0.50, 0.88, 0.72, 0.80, 0.95, 0.62),
  upper      = c(0.95, 1.03, 1.10, 0.85, 1.25, 1.07, 1.15, 1.40, 0.98)
)

forest_plot(
  pictogram_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "unit",
  columns = list(
    # COUNT mode: stick figures, integer count + decimal label
    col_pictogram("team_score", header = "Team standing",
                  glyph = "person",
                  value_label = "trailing", label_format = "decimal",
                  label_decimals = 1),

    # RATING mode: 5 skulls, value of them filled, rest ghosted
    col_pictogram("perf", header = "Perf",
                  glyph = "skull", max_glyphs = 5),

    # RATING mode with theme-aware defaults (color = NULL → accent)
    col_pictogram("songs_sung", header = "Songs sung",
                  glyph = "dot", max_glyphs = 5),

    # Per-row glyph swap (categorical) — leaf for low, flame for high
    col_pictogram("perf", header = "Threat",
                  id = "pictogram_threat",
                  glyph = c("low" = "leaf", "med" = "droplet", "high" = "flame"),
                  glyph_field = "threat",
                  max_glyphs = 5)
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard ratio",
  title = "Pictogram column showcase",
  subtitle = "Count mode, rating mode, per-row glyph mapping, theme-aware defaults"
)
