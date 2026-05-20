# Gallery Example 33: Newsprint
# Broadsheet aesthetic — high-contrast black ink on off-white stock, with
# a single newspaper-red headline accent. Roboto Serif body; no alt-row
# banding (broadsheet doesn't band rows).

library(tabviz)

election_data <- data.frame(
  candidate = c("Anderson", "Patel", "Rodriguez", "Chen", "Smith"),
  party     = c("Democrat", "Republican", "Independent", "Green", "Libertarian"),
  votes     = c(2847293L, 2512847L, 412580L, 89205L, 38117L),
  share     = c(0.483, 0.426, 0.070, 0.015, 0.006),
  vs_2020   = c(0.018, -0.012, 0.022, 0.003, -0.001)
)

tabviz(
  election_data,
  label = "candidate",
  label_header = "Candidate",
  theme = web_theme_newsprint(),
  columns = list(
    col_text("party", header = "Party"),
    col_numeric("votes", header = "Votes", decimals = 0, thousands_sep = ","),
    col_bar("share", header = "Share"),
    col_numeric("vs_2020", header = "Δ vs 2020", decimals = 3)
  ),
  title = "STATE GENERAL ELECTION — UNOFFICIAL RESULTS",
  subtitle = "Reporting 97% of precincts",
  caption = "Theme: Newsprint. Broadsheet typography; red-headline accent."
)
