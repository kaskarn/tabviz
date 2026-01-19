# Example: Nested groups with visual banding
# Demonstrates: web_group() with parent hierarchy, depth-based indentation and banding

library(tabviz)
library(dplyr)

# Create hierarchical data with nested geographic regions
set.seed(789)
regional_data <- tibble(
  study = c(
    # North America
    "USA - Northeast", "USA - Southeast", "USA - Midwest", "USA - West",
    "Canada - Ontario", "Canada - Quebec",
    # Europe
    "UK - England", "UK - Scotland",
    "Germany - North", "Germany - South",
    "France - Paris", "France - Lyon",
    # Asia
    "Japan - Tokyo", "Japan - Osaka",
    "China - Beijing", "China - Shanghai"
  ),
  region = c(
    rep("north_america", 6),
    rep("europe", 6),
    rep("asia", 4)
  ),
  country = c(
    rep("usa", 4), rep("canada", 2),
    rep("uk", 2), rep("germany", 2), rep("france", 2),
    rep("japan", 2), rep("china", 2)
  ),
  or = runif(16, 0.6, 1.4),
  n = sample(500:2000, 16)
) |>
  mutate(
    se = 0.1 + runif(n()) * 0.15,
    lower = or * exp(-1.96 * se),
    upper = or * exp(1.96 * se)
  )

# Define nested group hierarchy
groups <- list(
  # Top level - continents
  web_group("north_america", "North America"),
  web_group("europe", "Europe"),
  web_group("asia", "Asia-Pacific"),
  # Second level - countries (nested under continents)
  web_group("usa", "United States", parent = "north_america"),
  web_group("canada", "Canada", parent = "north_america"),
  web_group("uk", "United Kingdom", parent = "europe"),
  web_group("germany", "Germany", parent = "europe"),
  web_group("france", "France", parent = "europe"),
  web_group("japan", "Japan", parent = "asia"),
  web_group("china", "China", parent = "asia")
)

# Create forest plot with nested groups
# Note: rows will be indented and banded based on group depth
forest_plot(
  regional_data,
  point = "or",
  lower = "lower",
  upper = "upper",
  label = "study",
  group = "country",  # Group by country (will show nested structure)
  columns = list(
    col_numeric("n", "N"),
    col_interval("OR (95% CI)")
  ),
  theme = web_theme_modern(),
  scale = "log",
  null_value = 1,
  axis_label = "Odds Ratio (95% CI)",
  title = "Global Treatment Effect by Region",
  subtitle = "Hierarchical geographic analysis",
  caption = "Rows indented and shaded by nesting depth"
)
