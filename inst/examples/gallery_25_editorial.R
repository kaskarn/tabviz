# Gallery Example 25: Editorial theme with declared web fonts
# Demonstrates the WebTheme `web_fonts` slot — themes can declare their
# own font dependencies and the widget injects <link rel=stylesheet>
# tags into the host document on mount.
#
# Notes on export:
#  - Browser/Shiny: webfonts load from Google Fonts, theme renders in Cinzel.
#  - rsvg/PNG export: rsvg uses fontconfig on the rendering machine and
#    will NOT fetch the webfont. The system fallback stack (Georgia, serif)
#    takes over. For high-fidelity offline export, install the font locally.

library(tabviz)

editorial_data <- data.frame(
  delegate = c("Elrond", "Gandalf", "Aragorn", "Legolas", "Gimli", "Boromir", "Frodo"),
  race     = c("Elf", "Maia", "Man", "Elf", "Dwarf", "Man", "Hobbit"),
  wisdom   = c(5, 5, 4, 3, 3, 2, 4),
  valor    = c(4, 5, 5, 5, 5, 5, 4),
  tempt    = c(0.18, 0.32, 0.12, 0.08, 0.14, 0.86, 0.64),
  hr       = c(0.78, 0.85, 0.92, 1.05, 0.95, 1.32, 0.72),
  lower    = c(0.62, 0.70, 0.78, 0.88, 0.80, 1.10, 0.55),
  upper    = c(0.98, 1.03, 1.08, 1.25, 1.12, 1.55, 0.90)
)

# Editorial theme: deep navy surface, gold accent, Cinzel display serif,
# Cormorant Garamond body. Two webfont declarations — the widget appends
# <link> tags on mount to load them from Google Fonts.
rivendell <- web_theme(
  name = "rivendell",
  inputs = list(
    primary      = "#0f1626",
    accent       = "#d4a955",
    font_body    = "'Cormorant Garamond', Georgia, serif",
    font_display = "'Cinzel', Georgia, serif"
  ),
  web_fonts = list(
    web_font("Cinzel",
             "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap"),
    web_font("Cormorant Garamond",
             "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&display=swap")
  )
)

forest_plot(
  editorial_data,
  point = "hr", lower = "lower", upper = "upper",
  label = "delegate",
  columns = list(
    col_badge("race", shape = "pill",
              colors = c("Elf" = "#f4c95d", "Maia" = "#cf8bf3",
                         "Man" = "#7ea4d8", "Dwarf" = "#a3e7c5",
                         "Hobbit" = "#e8b598")),
    col_pictogram("wisdom", header = "Wisdom",
                  glyph = "dot", max_glyphs = 5),
    col_pictogram("valor", header = "Valor",
                  glyph = "dot", max_glyphs = 5,
                  color = "#e07a5f"),
    col_ring("tempt", header = "Ring tempt",
             color = c("#d4a955", "#a855f7"), thresholds = 0.5)
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Hazard ratio",
  title = "Council of Elrond — Attendee Manifest",
  subtitle = "Editorial theme with Cinzel display + Cormorant Garamond body",
  theme = rivendell
)
