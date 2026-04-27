# LOTR Easter Egg — Elvish theme demo (pre-release; may move to blog post)
#
# Council of Elrond, Rivendell, 25 Narquelië, T.A. 3018. Eight peoples,
# one ring. The minutes are in Sindarin. Refreshments at the second eagle.

library(tabviz)

elvish_data <- data.frame(
  delegate    = c("Elrond Half-elven", "Gandalf the Grey", "Aragorn II Elessar",
                  "Legolas Greenleaf", "Gimli son of Glóin", "Boromir of Gondor",
                  "Frodo Baggins", "Samwise Gamgee"),
  race        = c("Elf", "Maia", "Man", "Elf", "Dwarf", "Man", "Hobbit", "Hobbit"),
  wisdom      = c(5, 5, 4, 3, 3, 2, 4, 3),
  valor       = c(4, 5, 5, 5, 5, 5, 4, 5),
  tempt       = c(0.18, 0.32, 0.12, 0.08, 0.14, 0.86, 0.64, 0.22),
  words_12h   = c(1240, 890, 720, 320, 480, 1880, 380, 220),
  interrupted = c(0, 2, 1, 3, 6, 0, 1, 4),
  lembas      = c(4, 3, 6, 5, 12, 8, 9, 14),
  joins       = c("HOSTS", "YES", "YES", "YES", "YES", "YES", "BEARER", "GARDENER"),
  vote_for    = c(0.95, 1.05, 0.88, 1.10, 0.92, 1.32, 0.78, 0.85),
  vote_lo     = c(0.78, 0.85, 0.72, 0.92, 0.78, 1.10, 0.62, 0.68),
  vote_hi     = c(1.12, 1.25, 1.05, 1.30, 1.08, 1.55, 0.98, 1.05)
)

forest_plot(
  elvish_data,
  point = "vote_for", lower = "vote_lo", upper = "vote_hi",
  label = "delegate",
  columns = list(
    col_badge("race",
              colors = c("Elf" = "#D4B26E", "Maia" = "#A78BBF",
                         "Man" = "#8AB0D8", "Dwarf" = "#B86A48",
                         "Hobbit" = "#E5A89A")),
    col_pictogram("wisdom", header = "Wisdom",
                  glyph = "star", max_glyphs = 5,
                  color = "#D4B26E"),
    col_pictogram("valor", header = "Valor",
                  glyph = "sword", max_glyphs = 5,
                  color = "#D67373"),
    col_ring("tempt", header = "Ring tempt",
             color = c("#D4B26E", "#A78BBF", "#D67373"),
             thresholds = c(0.33, 0.66)),
    col_bar("words_12h", header = "Words spoken (12h)"),
    col_pictogram("interrupted", header = "Interrupted Boromir",
                  glyph = "person",
                  value_label = FALSE),
    col_pictogram("lembas", header = "Lembas eaten",
                  glyph = "leaf",
                  value_label = "trailing",
                  label_format = "integer",
                  max_glyphs = 8),
    col_badge("joins", header = "Joins fellowship",
              colors = c("HOSTS"     = "#A78BBF",
                         "YES"       = "#8AC18A",
                         "BEARER"    = "#D4B26E",
                         "GARDENER"  = "#8AC18A"))
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Council vote weight",
  title = "Rivendell — Council of Elrond, Attendee Manifest",
  subtitle = "Eight peoples. One ring. The minutes are in Sindarin. Refreshments at the second eagle.",
  theme = web_theme_elvish()
)
