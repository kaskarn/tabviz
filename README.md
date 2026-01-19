# tabviz

[![R-CMD-check](https://github.com/kaskarn/tabviz/actions/workflows/R-CMD-check.yaml/badge.svg)](https://github.com/kaskarn/tabviz/actions/workflows/R-CMD-check.yaml)
[![Lifecycle: experimental](https://img.shields.io/badge/lifecycle-experimental-orange.svg)](https://lifecycle.r-lib.org/articles/stages.html#experimental)

**Interactive tables with embedded visualizations for R.** Build forest plots, dashboards, and rich data displays with 16+ column types. Built with Svelte 5 and D3.js for speed and flexibility.

[![tabviz example](docs/images/hero-row-readme.png)](https://kaskarn.github.io/tabviz/gallery.html)

*Click image to view interactive gallery*

## Why tabviz?

- **Simple interface**: `forest_plot` function able to generate complex interactive plots with succinct parameters/arguments.
- **Granular customization**: Multiple mechanisms provide precise control over rendering at the cell, row, and column levels.
- **Themable**: Full theming system, with support for detailed custom theming. Varied preset themes available, including based on JAMA, Lancet, Cochrane, Nature.
- **Rich column types**: Native support for rendering badges, star ratings, sparklines, images, p-values, and more.
- **No JavaScript required**: R interface provides total control over the output.
- **Versatile API**: Use standard argument passing or a pipe-friendly workflow with set_* modifiers.
- **Portable graphics**: Export as interactive HTML or high-quality static images (SVG/PDF/PNG).
- **Web-native**: Web-ready widgets with shiny support.

## Installation

```r
# install.packages("pak")
pak::pak("kaskarn/tabviz")
```

## Quick Start

```r
library(tabviz)
data(glp1_trials)                                    # included example dataset

forest_plot(
  glp1_trials,
  point = "hr", lower = "lower", upper = "upper",    # effect size columns
  label = "study",                                   # row labels
  group = "group",                                   # collapsible sections
  columns = list(                                    # additional data columns
    col_group("Study Info",                          # grouped header
      col_text("drug", "Drug"),
      col_n("n"),
      position = "left"
    ),
    col_group("Results",
      col_events("events", "n", "Events"),           # "42/156" format
      col_interval("HR (95% CI)"),                   # "0.82 (0.72, 0.94)"
      col_pvalue("pvalue", "P"),                     # smart formatting
      position = "right"
    )
  ),
  annotations = list(                                # reference lines
    forest_refline(0.85, label = "Pooled HR", style = "dashed", color = "#00407a")
  ),
  row_type = "row_type", row_bold = "row_bold",      # row styling from data
  theme = web_theme_nature(),                        # publication theme
  scale = "log", null_value = 1,                     # log scale, null at 1
  axis_range = c(0.4, 1.5),                          # explicit axis bounds
  axis_ticks = c(0.5, 0.75, 1.0, 1.25),              # custom tick marks
  axis_gridlines = TRUE,
  axis_label = "Hazard Ratio (95% CI)",
  title = "GLP-1 Agonist Cardiovascular Outcomes",
  subtitle = "Major adverse cardiovascular events (MACE)",
  width_mode = "fill"                                # scale to container width
)
```

## Features

### Column Types

Display any data with the right visualization:

| Column | Purpose | Example |
|--------|---------|---------|
| `col_text()` | Plain text | Study names, categories |
| `col_numeric()` | Formatted numbers | Sample sizes with thousands separators |
| `col_interval()` | Point (CI) format | "0.72 (0.58, 0.89)" |
| `col_bar()` | Horizontal bars | Weights, percentages |
| `col_pvalue()` | Smart p-values | "1.2×10⁻⁵" with optional stars |
| `col_sparkline()` | Mini charts | Trends, distributions |
| `col_badge()` | Status badges | Published, Draft, In Review |
| `col_stars()` | Star ratings | Quality scores ★★★☆☆ |
| `col_icon()` | Icons/emoji | Status indicators ✓/✗ |
| `col_img()` | Inline images | Logos, avatars |
| `col_reference()` | Truncated links | DOIs, citations |
| `col_range()` | Min-max ranges | Age ranges "18 – 65" |
| `col_group()` | Grouped headers | Organize related columns |

### Themes

Nine built-in themes with full customization:

```r
forest_plot(data, ..., theme = web_theme_lancet())

# Customize any theme
web_theme_jama() |>
  set_colors(primary = "#0066cc") |>
  set_axis(gridlines = TRUE) |>
  set_spacing(row_height = 28)
```

| Theme | Style |
|-------|-------|
| `web_theme_default()` | Clean, modern default |
| `web_theme_jama()` | JAMA (B&W, compact) |
| `web_theme_lancet()` | Lancet (blue, serif) |
| `web_theme_cochrane()` | Cochrane (compact, professional) |
| `web_theme_nature()` | Nature (clean, modern) |
| `web_theme_modern()` | Contemporary UI |
| `web_theme_presentation()` | Large fonts for slides |
| `web_theme_dark()` | Dark mode |
| `web_theme_minimal()` | Minimal B&W |

### Row & Marker Styling

Full control over row appearance and marker shapes:

```r
forest_plot(data, ...,
  # Row styling
  row_type = "type",        # "header", "data", "summary", "spacer"
  row_bold = "is_primary",  # Bold important rows
  row_badge = "status",     # Add badges
  row_indent = "level",     # Hierarchical indentation

  # Marker styling
  marker_color = "sig_color",   # Color by significance
  marker_shape = "study_type",  # Shape by study design
  marker_size = "precision"     # Size by weight
)
```

### Split Forest Plots

Navigate between subgroups with an interactive sidebar:

```r
forest_plot(data, ...,
  split_by = c("region", "country"),  # Hierarchical navigation
  shared_axis = TRUE                   # Consistent scale across all
)
```

### Export

```r
# Save as static image
save_plot(plot, "forest.svg")
save_plot(plot, "forest.pdf", width = 8, height = 6)
save_plot(plot, "forest.png", scale = 2)

# Interactive widget has built-in download button
```

## Shiny Support

```r
library(shiny)

ui <- fluidPage(
  forestOutput("plot")
)

server <- function(input, output) {
  output$plot <- renderForest({
    forest_plot(data, ...)
  })
}
```

## Documentation

- **[Quick Start Guide](https://kaskarn.github.io/tabviz/guide/quick-start.html)** — Get up and running in 5 minutes
- **[Interactive Gallery](https://kaskarn.github.io/tabviz/gallery.html)** — 20+ examples with code
- **[Cookbook](https://kaskarn.github.io/tabviz/cookbook.html)** — Common patterns and recipes
- **[Function Reference](https://kaskarn.github.io/tabviz/reference.html)** — Full API documentation

## License

MIT
