# LOTR Easter Egg — Hobbit theme demo (pre-release; may move to blog post)
#
# Hobbiton — Pantry & Meal Audit, Halimath 1418 S.R. A respectable
# hobbit's larder is never half-full; it is half-empty only between
# meals (of which there are seven).
#
# Showcases the 3-tier cascade: warm-clay primary (Bag End brick),
# garden-green secondary (Sam's vegetables — column groups, row bars,
# glyph fills), wheat-stubble tertiary (chrome). Autumn-rust accent
# reserved for the household with the rare adventures.

library(tabviz)

hobbit_data <- data.frame(
  household       = c("Baggins of Bag End", "Took of Great Smials",
                      "Brandybuck of Brandy Hall", "Gamgee of Bagshot Row",
                      "Sackville-Baggins", "Cotton of Bywater",
                      "Boffin of Overhill", "Proudfoot of Westfarthing"),
  smial           = c("S.W. #1", "Tuckborough", "Buckland", "S.W. #3",
                      "Sackville", "Bywater", "Overhill", "Westfarthing"),
  pantry          = c(5, 5, 4, 4, 2, 4, 5, 4),
  pipeweed_lb     = c(3.2, 4.0, 2.6, 1.6, 0.5, 1.2, 2.8, 2.0),
  meals_per_day   = c(7.0, 7.0, 6.5, 7.0, 4.5, 6.5, 6.0, 6.5),
  second_brkfst   = c(5, 5, 5, 5, 1, 4, 4, 5),
  mushrooms       = c(8, 12, 6, 9, 0, 4, 5, 7),
  adventures      = c("YES (ONE)", "MANY", "YES (ONE)", "YES (ONE)",
                      "NONE", "NONE", "NONE", "NONE"),
  satiation       = c(1.05, 1.12, 0.98, 1.02, 0.75, 0.95, 1.08, 0.92),
  satiation_lo    = c(0.92, 1.00, 0.85, 0.88, 0.62, 0.82, 0.95, 0.78),
  satiation_hi    = c(1.18, 1.25, 1.10, 1.15, 0.88, 1.08, 1.20, 1.05),
  # The Tooks — adventurous hobbits — get the accent treatment (autumn
  # rust). The Sackville-Bagginses get muted (problematic relatives).
  row_accent      = c(FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  row_muted       = c(FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE)
)

forest_plot(
  hobbit_data,
  point = "satiation", lower = "satiation_lo", upper = "satiation_hi",
  label = "household",
  row_accent = "row_accent",
  row_muted  = "row_muted",
  columns = list(
    col_text("smial", header = "Smial"),
    # Pictograms with no `color` — pick up theme secondary (garden green).
    col_pictogram("pantry", header = "Pantry fill",
                  glyph = "jar", max_glyphs = 5),
    # Bar with no `color` — picks up theme primary (warm clay).
    col_bar("pipeweed_lb", header = "Pipe-weed (lb)"),
    col_numeric("meals_per_day", header = "Meals/day", decimals = 1),
    col_pictogram("second_brkfst", header = "2nd brkfst",
                  glyph = "pie", max_glyphs = 5),
    col_pictogram("mushrooms", header = "Mushrooms",
                  glyph = "mushroom",
                  value_label = "trailing",
                  label_format = "integer",
                  max_glyphs = 8),
    # Adventures as semantic variants — success for the usual one-time
    # hobbit jaunt; default for the unusual frequent traveller (will pop
    # via the row.accent flag); muted for the homebodies.
    col_badge("adventures",
              variants = c("YES (ONE)" = "success",
                           "MANY"      = "default",
                           "NONE"      = "muted"),
              outline = TRUE)
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Satiation index (vs. respectable baseline)",
  title = "Hobbiton — Pantry & Meal Audit, Halimath 1418",
  subtitle = "A respectable hobbit's larder is never half-full; it is half-empty only between meals (of which there are seven).",
  theme = web_theme_hobbit()
)
