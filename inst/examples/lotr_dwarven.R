# LOTR Easter Egg — Dwarven theme demo (pre-release; may move to blog post)
#
# Erebor under the Lonely Mountain. Vein yields, Halls of Records, Q3
# tonnage by shaft. Beards lengthen, axes dull, the King requests no
# further inquiry into the Drum Chamber.

library(tabviz)

dwarven_data <- data.frame(
  shaft        = c("Front Hall", "Hall of Thrór", "Black Lode", "King's Vein",
                   "Mithril Seam", "Eastern Drift", "Deep Foundry", "Drum Chamber"),
  depth_m      = c(40, 280, 540, 720, 980, 1240, 1620, 2100),
  q3_tonnage   = c(142, 318, 412, 88, 24, 488, 612, 0),
  gold_carts   = c(3, 7, 6, 9, 4, 5, 2, 0),    # carts of gold pulled this Q
  songs        = c(4, 5, 4, 5, 4, 3, 2, 0),    # crew morale, mug rating
  axes_dulled  = c(12, 18, 15, 11, 22, 28, 35, 99),
  balrog_risk  = c(0L, 0L, 1L, 1L, 2L, 3L, 4L, 9L),
  status       = c("singing", "yielding", "yielding", "yielding",
                   "watch", "watch", "hazardous", "abandon"),
  yield_ratio  = c(1.18, 1.42, 1.31, 0.92, 0.78, 1.65, 1.84, 0.04),
  yield_lo     = c(0.95, 1.20, 1.10, 0.74, 0.55, 1.32, 1.42, 0.01),
  yield_hi     = c(1.42, 1.65, 1.55, 1.12, 1.10, 2.05, 2.40, 0.18)
)

forest_plot(
  dwarven_data,
  point = "yield_ratio", lower = "yield_lo", upper = "yield_hi",
  label = "shaft",
  columns = list(
    col_numeric("depth_m", header = "Depth (m)", decimals = 0),
    col_bar("q3_tonnage", header = "Q3 tonnage"),
    col_pictogram("gold_carts", header = "Gold carts",
                  glyph = "gem",
                  value_label = FALSE),
    col_pictogram("songs", header = "Songs / shift",
                  glyph = "ale_mug", max_glyphs = 5),
    col_pictogram("axes_dulled", header = "Axes dulled",
                  glyph = "pickaxe",
                  value_label = "trailing",
                  label_format = "integer",
                  max_glyphs = 5,
                  min_value = 0, max_value = 100),
    col_badge("balrog_risk", header = "Balrog risk",
              shape = "circle",
              thresholds = c(2, 5)),
    col_badge("status",
              colors = c("singing"   = "#7A9B3F",
                         "yielding"  = "#5C7AA0",
                         "watch"     = "#D4A955",
                         "hazardous" = "#C84638",
                         "abandon"   = "#5A4232"))
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Yield ratio (Q3 vs Q2)",
  title = "Erebor — Vein Yields, Hall of Records",
  subtitle = "Iron-clad ledger of every shaft beneath the Lonely Mountain. By order of Thorin son of Thráin.",
  theme = web_theme_dwarven()
)
