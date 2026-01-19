# Example: Regression coefficients forest plot using iris
# Demonstrates: grouped effects, modern theme, titles/captions

library(tabviz)
library(dplyr)
library(broom)

# Fit linear models per Species, extract coefficients
coef_data <- iris |>
  group_by(Species) |>
  group_modify(~ {
    model <- lm(Sepal.Length ~ Sepal.Width + Petal.Length + Petal.Width, data = .x)
    tidy(model, conf.int = TRUE) |>
      filter(term != "(Intercept)")
  }) |>
  ungroup() |>
  mutate(
    # Clean up term names
    term = case_when(
      term == "Sepal.Width" ~ "Sepal Width",
      term == "Petal.Length" ~ "Petal Length",
      term == "Petal.Width" ~ "Petal Width",
      TRUE ~ term
    ),
    pvalue = p.value
  )

# Create forest plot with modern theme
forest_plot(
  coef_data,
  point = "estimate",
  lower = "conf.low",
  upper = "conf.high",
  label = "term",
  group = "Species",
  columns = list(
    col_interval("95% CI"),
    col_pvalue("pvalue", "P-value")
  ),
  theme = web_theme_modern(),
  null_value = 0,
  axis_label = "Regression Coefficient (95% CI)",
  title = "Predictors of Sepal Length",
  subtitle = "Linear regression coefficients by species",
  caption = "Data: Fisher's Iris dataset"
)
