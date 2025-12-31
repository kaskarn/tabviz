# webforest

[![R-CMD-check](https://github.com/kaskarn/webforest/actions/workflows/R-CMD-check.yaml/badge.svg)](https://github.com/kaskarn/webforest/actions/workflows/R-CMD-check.yaml)

Interactive, web-native forest plots for R. Built with Svelte 5 and D3.js.

<a href="https://kaskarn.github.io/webforest/gallery.html">
  <img src="docs/images/hero-dark-theme.png" alt="webforest dark theme example" width="100%">
</a>

<p align="center"><em>Click image to view interactive examples</em></p>

## Installation

```r
# install.packages("pak")
pak::pak("kaskarn/webforest")
```

## Usage

```r
library(webforest)

data <- data.frame(
  study = c("CheckMate 067", "KEYNOTE-006", "CheckMate 238"),
  tumor = c("Melanoma", "Melanoma", "Melanoma"),
  hr = c(0.55, 0.63, 0.65),
  lower = c(0.45, 0.52, 0.51),
  upper = c(0.67, 0.76, 0.83),
  pvalue = c(0.001, 0.001, 0.001)
)

forest_plot(data,
  point = "hr", lower = "lower", upper = "upper",
  label = "study", group = "tumor",
  columns = list(
    col_interval("HR (95% CI)"),
    col_pvalue("pvalue", "P")
  ),
  theme = web_theme_dark(),
  scale = "log", null_value = 1,
  title = "Immune Checkpoint Inhibitor Trials"
)
```

## Features

- **Publication themes** — JAMA, Lancet, modern, presentation, dark, minimal
- **Flexible columns** — numeric, interval, bar charts, p-values, sparklines
- **Hierarchical groups** — collapsible sections with nested subgroups
- **Interactive** — hover highlights, row selection, tooltips
- **Customizable** — fluent API for theme modification

```r
# Customize any preset theme
web_theme_jama() |>
  set_colors(primary = "#0066cc") |>
  set_axis(gridlines = TRUE, range_min = 0.5, range_max = 2.0)
```

## Documentation

- [Package guide](https://kaskarn.github.io/webforest/)
- [Examples gallery](https://kaskarn.github.io/webforest/gallery.html)
- [Function reference](https://kaskarn.github.io/webforest/reference.html)

## License

MIT
