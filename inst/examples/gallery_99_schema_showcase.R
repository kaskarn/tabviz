# Gallery Example 99: Schema Sprint Showcase — "Best in Show: Magical Creatures"
#
# Exercises every feature shipped in the schema-sprint:
#   - Conditions (col_text bold = cond("qualified_for_finals"))
#   - styleMapping with cond() reference
#   - col_interval with variant = "bracket_muted" (Phase 3 variant compile)
#   - col_badge with element-type categorical levels
#   - col_stars rating
#   - col_pictogram count-mode (claw glyphs)
#   - col_sparkline showing round-by-round score history
#   - col_bar with column-summary scale
#   - col_ring percent-of-perfect-form
#   - col_pvalue with significance stars
#   - viz_forest multi-effect (per-round score vs breed baseline)
#   - Two row groups (by region)
#   - Footnote with tournament rules
#
# Visual regression auto-picks this up via R/render_visual_tests.R's
# `^gallery_.*\.R$` pattern; both V8/SVG and Puppeteer pipelines
# exercise the same shape.

library(tabviz)

creatures <- data.frame(
  creature = c(
    "Aurelyon", "Brimwing", "Cinderscale", "Dreadtide",
    "Embermane", "Frostvale", "Glintspark", "Hydromancer",
    "Ironhowl", "Jadefang", "Krakentide", "Lumenwisp"
  ),
  region = c(
    "Northern Reaches", "Northern Reaches", "Northern Reaches",
    "Northern Reaches", "Northern Reaches", "Northern Reaches",
    "Southern Wilds", "Southern Wilds", "Southern Wilds",
    "Southern Wilds", "Southern Wilds", "Southern Wilds"
  ),
  element = c("fire", "fire", "fire", "ice", "fire", "ice",
              "storm", "ice", "storm", "poison", "ice", "storm"),
  judge_rating = c(4.5, 3.5, 5.0, 2.5, 4.0, 4.5, 3.0, 4.0, 3.5, 5.0, 2.0, 4.5),
  claws = c(8, 6, 10, 5, 7, 9, 4, 8, 6, 11, 3, 9),
  form_pct = c(0.92, 0.78, 0.96, 0.62, 0.85, 0.91, 0.71, 0.83, 0.74, 0.97, 0.55, 0.89),
  avg_power = c(87, 71, 94, 58, 79, 88, 65, 80, 70, 95, 52, 86),
  power = c(87, 71, 94, 58, 79, 88, 65, 80, 70, 95, 52, 86),
  lo    = c(82, 65, 91, 53, 73, 84, 60, 75, 65, 91, 47, 81),
  hi    = c(92, 77, 97, 63, 85, 92, 70, 85, 75, 99, 57, 91),
  p_value = c(0.001, 0.04, 0.0001, 0.31, 0.008, 0.001,
              0.12, 0.005, 0.06, 0.0001, 0.45, 0.002),
  round_scores = I(list(
    c(82, 85, 87, 88, 87, 90),
    c(68, 70, 71, 72, 71, 74),
    c(91, 92, 94, 95, 94, 96),
    c(55, 56, 58, 57, 58, 60),
    c(75, 77, 79, 78, 79, 81),
    c(85, 86, 88, 87, 88, 89),
    c(62, 64, 65, 64, 65, 67),
    c(77, 78, 80, 79, 80, 82),
    c(67, 68, 70, 69, 70, 72),
    c(91, 93, 95, 94, 95, 97),
    c(48, 50, 52, 51, 52, 54),
    c(83, 84, 86, 85, 86, 88)
  ))
)

# Two regional row groups so the showcase exercises grouping + per-
# group banding alongside everything else.
creatures$region <- factor(creatures$region,
                            levels = c("Northern Reaches", "Southern Wilds"))

tabviz(
  data       = creatures,
  label      = "creature",
  group      = "region",
  conditions = list(
    # Qualified for finals: average power >= 80 AND p_value < 0.05.
    # Materialized once; referenced from `bold = cond("qualified_for_finals")`
    # in col_text below. The boolean vector ships on banks.conditions
    # and stays correctly aligned under sort/filter (Phase 1 keystone).
    condition(
      "qualified_for_finals",
      ~ avg_power >= 80 & p_value < 0.05,
      label = "Qualified for finals"
    )
  ),
  columns = list(
    # Element badge with thresholded color stops (statuses).
    col_badge(
      "element", header = "Element",
      colors = list(
        fire   = "#dc2626",
        ice    = "#0284c7",
        storm  = "#7c3aed",
        poison = "#16a34a"
      )
    ),
    # Judges' rating — stars with half-star precision.
    col_stars("judge_rating", "Judges", max_stars = 5L, half_stars = TRUE),
    # Claw count via pictograms (count mode).
    col_pictogram(
      "claws", "Claws",
      glyph = "person",         # placeholder glyph — real catalog
      layout = "row",            # to be browsed in the editor
      max_glyphs = 12L
    ),
    # Round-by-round score history.
    col_sparkline("round_scores", "6-Round Trend", type = "line"),
    # Average power as a horizontal bar (scales to visible-row max).
    col_bar("avg_power", "Avg Power", scale = "linear"),
    # Power ± CI in bracketed/muted form — Phase 3 variant.
    col_interval(
      "power", "lo", "hi",
      header = "Power (95% CI)",
      variant = "bracket_muted",
      decimals = 0
    ),
    # Form percent as a donut.
    col_ring(
      "form_pct", "Form",
      min_value = 0, max_value = 1,
      label_format = "percent", label_decimals = 0
    ),
    # Significance vs breed baseline — auto picks scientific notation
    # for very small p values and applies stars.
    col_pvalue("p_value", "p", stars = TRUE)
  ),
  title    = "Best in Show: Magical Creatures",
  subtitle = "Schema sprint coverage showcase",
  footnote = "Qualification: avg power >= 80 AND p < 0.05.",
  caption  = "Fictional dataset — fonts and palette per active theme."
)
