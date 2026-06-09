# Arc A2 — live Shiny smoke app for the headless driver.
library(shiny)
library(tabviz)

df <- data.frame(
  study = c("Alpha One", "Alpha Two", "Beta One", "Beta Two"),
  grp   = c("Group A", "Group A", "Group B", "Group B"),
  n     = c(240, 410, 150, 380),
  hr    = c(0.72, 0.91, 0.66, 0.83),
  lo    = c(0.58, 0.75, 0.50, 0.69),
  hi    = c(0.89, 1.06, 0.86, 0.99)
)

ui <- fluidPage(
  actionButton("go_dark", "Go dark (proxy set_theme)"),
  tabvizOutput("tv", height = "420px"),
  verbatimTextOutput("echo_edits"),
  verbatimTextOutput("echo_selected")
)

server <- function(input, output, session) {
  output$tv <- renderTabviz(
    tabviz(
      df,
      label = "study",
      group = "grp",
      columns = list(
        col_numeric("n", "N", decimals = 0),
        col_interval("hr", "lo", "hi", header = "HR (95% CI)")
      ),
      interaction = web_interaction_full(),
      theme = web_theme_nejm(),
      title = "Shiny smoke"
    )
  )

  observeEvent(input$go_dark, {
    tabviz_proxy("tv") |> set_theme("aurora")
  })

  output$echo_edits <- renderPrint({
    list(cell_edits = input$tv_cell_edits)
  })
  output$echo_selected <- renderPrint({
    list(selected = input$tv_selected)
  })
}

shinyApp(ui, server)
