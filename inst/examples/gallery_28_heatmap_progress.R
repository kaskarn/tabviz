# Gallery Example 17: Heatmap, Progress, Currency, & Date Columns
# Dashboard-style table showcasing new column types

library(tabviz)

project_data <- data.frame(
  project = c("Alpha", "Beta", "Gamma", "Delta", "Epsilon",
              "Zeta", "Eta", "Theta"),
  status = c("On Track", "At Risk", "Complete", "On Track", "Delayed",
             "Complete", "On Track", "At Risk"),
  completion = c(72, 45, 100, 88, 33, 100, 61, 52),
  budget = c(125000, 89000, 210000, 175000, 62000, 340000, 98000, 155000),
  roi = c(1.8, 0.9, 2.4, 1.5, 0.6, 3.1, 1.2, 0.8),
  risk_score = c(0.35, 0.72, 0.05, 0.18, 0.89, 0.02, 0.41, 0.65),
  team_size = c(8, 5, 12, 10, 3, 15, 6, 7),
  start_date = as.Date(c("2025-01-15", "2025-03-01", "2024-09-01",
                          "2025-02-10", "2025-04-20", "2024-06-15",
                          "2025-01-30", "2025-03-15")),
  deadline = as.Date(c("2025-12-31", "2025-09-30", "2025-06-30",
                        "2025-11-15", "2025-08-01", "2025-03-31",
                        "2025-10-15", "2025-12-15")),
  stringsAsFactors = FALSE
)

spec <- web_spec(
  data = project_data,
  label = "project",
  label_header = "Project",
  title = "Heatmap, Progress, Currency & Date Columns",
  subtitle = "Dashboard-style table with col_heatmap(), col_progress(), col_currency(), col_date()",
  columns = list(
    col_badge("status", "Status", variants = c(
      "On Track" = "success",
      "Complete" = "info",
      "At Risk" = "warning",
      "Delayed" = "error"
    )),
    col_progress("completion", "Progress", width = 120),
    col_currency("budget", "Budget"),
    col_heatmap("roi", "ROI", palette = c("#fee2e2", "#fef9c3", "#dcfce7"),
                min_value = 0, max_value = 3.5, decimals = 1),
    col_heatmap("risk_score", "Risk",
                palette = c("#dcfce7", "#fef9c3", "#fee2e2"),
                min_value = 0, max_value = 1, decimals = 2),
    col_n("team_size", "Team"),
    col_date("start_date", "Started", format = "%b %d, %Y"),
    col_date("deadline", "Deadline", format = "%b %Y")
  ),
  interaction = web_interaction(
    enable_sort = TRUE,
    enable_themes = NULL
  )
)

forest_plot(spec)
