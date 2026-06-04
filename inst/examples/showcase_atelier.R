# Stage 4 showcase — Atelier theme.
#
# A painter's studio inventory: pigment costs by source. Warm parchment
# (decorative-tinted neutrals at 0.12 strength), ruled-paper texture
# (sketchbook lines), compact density (the writer's working table),
# EB Garamond body with Italianno display (the calligraphic flourish).

library(tabviz)

pigments <- data.frame(
  pigment      = c("Ultramarine (lapis)", "Vermilion",  "Indian Yellow",
                   "Burnt Sienna",        "Lead White", "Bone Black",
                   "Verdigris",           "Madder Rose"),
  origin       = c("Afghanistan",   "Spain",       "India",
                   "Tuscany",       "Holland",     "Venice",
                   "Cyprus",        "Provence"),
  price_florin = c(48.0, 12.5, 9.0, 1.4, 0.9, 0.6, 3.2, 5.8),
  permanence   = c("excellent",  "good",   "fugitive",
                   "excellent",  "good",   "excellent",
                   "moderate",   "fugitive"),
  use_grade    = c("master",  "fresco",  "glaze",
                   "ground",  "ground",  "outline",
                   "highlight", "glaze"),
  cost_index   = c(1.32, 1.05, 0.92, 0.61, 0.45, 0.40, 0.78, 0.88),
  cost_lo      = c(1.18, 0.94, 0.78, 0.55, 0.39, 0.32, 0.68, 0.74),
  cost_hi      = c(1.52, 1.18, 1.06, 0.68, 0.51, 0.48, 0.90, 1.04),
  row_accent   = c(TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  row_muted    = c(FALSE, FALSE, TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE)
)

forest_plot(
  pigments,
  point = "cost_index", lower = "cost_lo", upper = "cost_hi",
  label = "pigment",
  row_accent = "row_accent",
  row_muted  = "row_muted",
  columns = list(
    col_text("origin", header = "origin"),
    col_numeric("price_florin", header = "price (florin)", decimals = 1),
    col_text("permanence", header = "permanence"),
    col_text("use_grade", header = "use grade")
  ),
  axis_label = "Cost index (vs. studio baseline 1.0)",
  title = "Studio Inventory, Anno Domini 1623",
  subtitle = "From the workshop ledger of Maestro Bellini -- atelier theme showcase",
  theme = web_theme_atelier()
)
