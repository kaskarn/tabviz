# Gallery Example 36: Tonal (light)
# Material You-style tonal-palette-from-seed: a single seed (primary
# purple) generates surfaces via the OKLCH chrome cascade. Demonstrates
# the cascade's tonal-palette generation — no custom logic, the resolver
# already does it. Pairs with web_theme_aurora().

library(tabviz)

tonal_data <- data.frame(
  feature   = c("Authentication", "Search", "Notifications",
                "Real-time sync", "Mobile app", "Dark mode"),
  shipped   = c(TRUE, TRUE, TRUE, TRUE, FALSE, FALSE),
  priority  = c("p0", "p0", "p1", "p1", "p2", "p2"),
  effort_pts= c(8, 21, 5, 34, 55, 13),
  owner_team= c("Platform", "Search", "Notif", "Platform", "Mobile", "Design")
)

tabviz(
  tonal_data,
  label = "feature",
  label_header = "Feature",
  theme = web_theme_ledger(),
  columns = list(
    col_text("owner_team", header = "Owner"),
    col_text("priority", header = "Pri"),
    col_numeric("effort_pts", header = "Pts", decimals = 0),
    col_icon("shipped", header = "Shipped")
  ),
  title = "Roadmap status — purple tonal palette from a single seed",
  caption = "Theme: Tonal — Material You-style dynamic color."
)
