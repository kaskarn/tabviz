# Example: Fluent proxy API in Shiny
# Demonstrates `tabviz_proxy()` + verb dispatch — every button below mutates the
# live widget without re-rendering it. Same verbs (`add_column`, `sort_rows`,
# `set_theme`, ...) work on static WebSpec and htmlwidget objects too; on a
# proxy they send a custom message to the browser.

library(shiny)
library(tabviz)

trial_data <- data.frame(
  study  = c("EMPA-REG", "CANVAS", "DECLARE", "CREDENCE", "LEADER", "SUSTAIN-6"),
  hr     = c(0.86, 0.86, 0.93, 0.80, 0.87, 0.74),
  lower  = c(0.74, 0.75, 0.84, 0.67, 0.78, 0.58),
  upper  = c(0.99, 0.97, 1.03, 0.95, 0.97, 0.95),
  n      = c(7020, 10142, 17160, 4401, 9340, 3297),
  year   = c(2015, 2017, 2019, 2019, 2016, 2016)
)

ui <- fluidPage(
  titlePanel("Fluent Proxy Demo"),
  fluidRow(
    column(
      3,
      h4("Columns"),
      actionButton("add_col",    "Add 'year' column"),
      actionButton("remove_col", "Remove 'year' column"),
      actionButton("resize_hr",  "Resize HR to 140px"),
      actionButton("rename_hr",  "Rename HR → 'Hazard'"),
      br(), br(),
      h4("Rows"),
      actionButton("sort_desc",  "Sort HR desc"),
      actionButton("sort_asc",   "Sort HR asc"),
      actionButton("filter_hr",  "Filter HR < 0.9"),
      actionButton("clear_flt",  "Clear filter"),
      br(), br(),
      h4("Styling"),
      actionButton("theme_jama",   "Theme: JAMA"),
      actionButton("theme_lancet", "Theme: Lancet"),
      actionButton("zoom_small",   "Zoom 0.8"),
      actionButton("zoom_reset",   "Zoom 1.0")
    ),
    column(9, tabvizOutput("plot", height = "500px"))
  )
)

server <- function(input, output, session) {
  output$plot <- renderTabviz({
    tabviz(
      trial_data,
      label = "study",
      columns = list(
        col_numeric("hr", "HR", decimals = 2),
        col_numeric("n",  "N"),
        viz_forest(point = "hr", lower = "lower", upper = "upper",
                   header = "HR (95% CI)")
      ),
      null_value = 1,
      scale = "log"
    )
  })

  proxy <- tabviz_proxy("plot")

  observeEvent(input$add_col,    add_column(proxy, col_numeric("year", "Year"), after = "n"))
  observeEvent(input$remove_col, remove_column(proxy, "year"))
  observeEvent(input$resize_hr,  resize_column(proxy, "hr", width = 140))
  observeEvent(input$rename_hr,  update_column(proxy, "hr", header = "Hazard"))

  observeEvent(input$sort_desc, sort_rows(proxy, "hr", direction = "desc"))
  observeEvent(input$sort_asc,  sort_rows(proxy, "hr", direction = "asc"))
  observeEvent(input$filter_hr, filter_rows(proxy, "hr", operator = "lt", value = 0.9))
  observeEvent(input$clear_flt, clear_filters(proxy))

  observeEvent(input$theme_jama,   set_theme(proxy, "jama"))
  observeEvent(input$theme_lancet, set_theme(proxy, "lancet"))
  observeEvent(input$zoom_small,   set_zoom(proxy, zoom = 0.8))
  observeEvent(input$zoom_reset,   set_zoom(proxy, zoom = 1.0))
}

# shinyApp(ui, server)
