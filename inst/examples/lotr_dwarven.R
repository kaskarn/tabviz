# LOTR Easter Egg — Dwarven theme demo (pre-release; may move to blog post)
#
# Erebor under the Lonely Mountain. Vein yields, Halls of Records, Q3
# tonnage by shaft. The point of this example: show how much of the
# theme's identity falls out of the cascade — pictogram fills, badge
# colors, bar tints, and group-bar tones are all driven by the theme,
# not by hex literals at the call site.

library(tabviz)

dwarven_data <- data.frame(
  shaft        = c("Front Hall", "Hall of Thrór", "Black Lode", "King's Vein",
                   "Mithril Seam", "Eastern Drift", "Deep Foundry", "Drum Chamber"),
  depth_m      = c(40, 280, 540, 720, 980, 1240, 1620, 2100),
  q3_tonnage   = c(142, 318, 412, 88, 24, 488, 612, 0),
  gold_carts   = c(3, 7, 6, 9, 4, 5, 2, 0),
  songs        = c(4, 5, 4, 5, 4, 3, 2, 0),
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
    # Bar with no `color` → picks up theme primary (hammered bronze).
    col_bar("q3_tonnage", header = "Q3 tonnage"),
    # Pictograms with no `color` → picks up theme secondary (warm gold).
    # The whole "gold ledger of the king" feel comes from the theme,
    # not from hardcoded hexes.
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
    # Threshold-driven badge: c(2, 5) → 3 stops → status palette
    # (positive / warning / negative). Risk semantics expressed as data,
    # color comes from the theme's status colors.
    col_badge("balrog_risk", header = "Balrog risk",
              shape = "circle",
              thresholds = c(2, 5)),
    # Categorical badge using semantic VARIANTS instead of hardcoded
    # hexes. Each label maps to a status token; the theme's status colors
    # provide the actual palette.
    col_badge("status",
              variants = c("singing"   = "success",
                           "yielding"  = "info",
                           "watch"     = "warning",
                           "hazardous" = "error",
                           "abandon"   = "muted"))
  ),
  scale = "log",
  null_value = 1,
  axis_label = "Yield ratio (Q3 vs Q2)",
  title = "Erebor — Vein Yields, Hall of Records",
  subtitle = "Iron-clad ledger of every shaft beneath the Lonely Mountain. By order of Thorin son of Thráin.",
  theme = web_theme_dwarven()
)
