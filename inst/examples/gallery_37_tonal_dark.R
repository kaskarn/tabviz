# Gallery Example 37: Tonal Dark
# Dark counterpart to web_theme_ledger() — same purple seed at a higher
# tone, dark canvas tinted toward primary at low chroma.

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
  theme = web_theme_aurora(),
  columns = list(
    col_text("owner_team", header = "Owner"),
    col_text("priority", header = "Pri"),
    col_numeric("effort_pts", header = "Pts", decimals = 0),
    col_icon("shipped", header = "Shipped")
  ),
  title = "Roadmap status — tonal dark mode",
  caption = "Theme: Tonal Dark — pairs with web_theme_ledger()."
)
