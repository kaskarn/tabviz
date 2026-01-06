# Theme S7 classes for webforest
# Generic theming system for web-native visualizations

#' ColorPalette: Colors for visualizations
#'
#' @usage NULL
#' @export
ColorPalette <- new_class(
  "ColorPalette",
  properties = list(
    background = new_property(class_character, default = "#ffffff"),
    foreground = new_property(class_character, default = "#333333"),
    primary = new_property(class_character, default = "#0891b2"),     # Cyan-600: fresh, professional
    secondary = new_property(class_character, default = "#64748b"),
    accent = new_property(class_character, default = "#8b5cf6"),
    muted = new_property(class_character, default = "#94a3b8"),
    border = new_property(class_character, default = "#e2e8f0"),
    # Interval visualization colors
    interval = new_property(class_character, default = "#0891b2"),  # Default marker color
    interval_line = new_property(class_character, default = "#475569"),
    # Deprecated: kept for backwards compatibility but unused by default
    interval_positive = new_property(class_character, default = "#0891b2"),
    interval_negative = new_property(class_character, default = "#dc2626"),
    interval_neutral = new_property(class_character, default = "#64748b"),
    # Summary/aggregate colors
    summary_fill = new_property(class_character, default = "#0891b2"),
    summary_border = new_property(class_character, default = "#0e7490")
  )
)

#' Typography: Font settings
#'
#' @usage NULL
#' @export
Typography <- new_class(
  "Typography",
  properties = list(
    font_family = new_property(
      class_character,
      default = "system-ui, -apple-system, sans-serif"
    ),
    font_size_sm = new_property(class_character, default = "0.75rem"),
    font_size_base = new_property(class_character, default = "0.875rem"),
    font_size_lg = new_property(class_character, default = "1rem"),
    font_weight_normal = new_property(class_numeric, default = 400),
    font_weight_medium = new_property(class_numeric, default = 500),
    font_weight_bold = new_property(class_numeric, default = 600),
    line_height = new_property(class_numeric, default = 1.5)
  )
)

#' Spacing: Layout spacing values
#'
#' @usage NULL
#' @export
Spacing <- new_class(
  "Spacing",
  properties = list(
    row_height = new_property(class_numeric, default = 28),
    header_height = new_property(class_numeric, default = 36),
    column_gap = new_property(class_numeric, default = 8),
    section_gap = new_property(class_numeric, default = 16),
    padding = new_property(class_numeric, default = 12),
    axis_gap = new_property(class_numeric, default = 12),
    group_padding = new_property(class_numeric, default = 8)
  )
)

#' Shapes: Shape rendering settings
#'
#' @usage NULL
#' @export
Shapes <- new_class(
  "Shapes",
  properties = list(
    point_size = new_property(class_numeric, default = 6),
    summary_height = new_property(class_numeric, default = 10),
    line_width = new_property(class_numeric, default = 1.5),
    border_radius = new_property(class_numeric, default = 2)  # Cleaner, more professional
  )
)

#' AxisConfig: Axis rendering configuration
#'
#' @param range_min Minimum value for axis (NA = auto from data)
#' @param range_max Maximum value for axis (NA = auto from data)
#' @param tick_count Target number of ticks (NA = auto)
#' @param tick_values Explicit tick positions (overrides tick_count)
#' @param gridlines Show gridlines on the plot
#' @param gridline_style Style of gridlines: "solid", "dashed", or "dotted"
#'
#' @export
AxisConfig <- new_class(
  "AxisConfig",
  properties = list(
    range_min = new_property(class_numeric, default = NA_real_),
    range_max = new_property(class_numeric, default = NA_real_),
    tick_count = new_property(class_numeric, default = NA_real_),
    tick_values = new_property(class_any, default = NULL),
    gridlines = new_property(class_logical, default = FALSE),
    gridline_style = new_property(class_character, default = "dotted")
  ),
  validator = function(self) {
    valid_styles <- c("solid", "dashed", "dotted")
    if (!self@gridline_style %in% valid_styles) {
      return(paste("gridline_style must be one of:", paste(valid_styles, collapse = ", ")))
    }
    NULL
  }
)

#' LayoutConfig: Layout and visual configuration
#'
#' @param plot_position Position of forest plot: "left" or "right"
#' @param table_width Width of table area ("auto" or numeric pixels)
#' @param plot_width Width of plot area ("auto" or numeric pixels)
#' @param cell_padding_x Horizontal cell padding in pixels
#' @param cell_padding_y Vertical cell padding in pixels
#' @param row_border Show row borders
#' @param row_border_style Style of row borders: "solid", "dashed", or "dotted"
#' @param container_border Show container border
#' @param container_border_radius Container border radius in pixels
#'
#' @export
LayoutConfig <- new_class(
  "LayoutConfig",
  properties = list(
    plot_position = new_property(class_character, default = "right"),
    table_width = new_property(class_any, default = "auto"),
    plot_width = new_property(class_any, default = "auto"),
    cell_padding_x = new_property(class_numeric, default = 10),
    cell_padding_y = new_property(class_numeric, default = 4),
    row_border = new_property(class_logical, default = TRUE),
    row_border_style = new_property(class_character, default = "solid"),
    container_border = new_property(class_logical, default = TRUE),
    container_border_radius = new_property(class_numeric, default = 8)
  ),
  validator = function(self) {
    if (!self@plot_position %in% c("left", "right")) {
      return("plot_position must be 'left' or 'right'")
    }
    valid_styles <- c("solid", "dashed", "dotted")
    if (!self@row_border_style %in% valid_styles) {
      return(paste("row_border_style must be one of:", paste(valid_styles, collapse = ", ")))
    }
    NULL
  }
)

#' WebTheme: Complete theme specification
#'
#' @param name Theme name
#' @param colors ColorPalette object
#' @param typography Typography object
#' @param spacing Spacing object
#' @param shapes Shapes object
#' @param axis AxisConfig object
#' @param layout LayoutConfig object
#'
#' @usage NULL
#' @export
WebTheme <- new_class(
  "WebTheme",
  properties = list(
    name = new_property(class_character, default = "default"),
    colors = new_property(ColorPalette, default = ColorPalette()),
    typography = new_property(Typography, default = Typography()),
    spacing = new_property(Spacing, default = Spacing()),
    shapes = new_property(Shapes, default = Shapes()),
    axis = new_property(AxisConfig, default = AxisConfig()),
    layout = new_property(LayoutConfig, default = LayoutConfig())
  )
)

#' Create a default theme
#'
#' @return A WebTheme object with default settings
#' @export
web_theme_default <- function() {
  WebTheme(name = "default")
}

#' Create a minimal/clean theme
#'
#' Optimized for publication and print
#'
#' @return A WebTheme object
#' @export
web_theme_minimal <- function() {
  WebTheme(
    name = "minimal",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#000000",
      primary = "#000000",
      secondary = "#333333",
      muted = "#666666",
      border = "#cccccc",
      interval = "#333333",
      interval_line = "#000000",
      interval_positive = "#333333",
      interval_negative = "#333333",
      interval_neutral = "#666666",
      summary_fill = "#000000",
      summary_border = "#000000"
    ),
    typography = Typography(
      font_family = "'Times New Roman', Times, serif"
    )
  )
}

#' Create a dark theme
#'
#' @return A WebTheme object with dark mode colors
#' @export
web_theme_dark <- function() {
  WebTheme(
    name = "dark",
    colors = ColorPalette(
      background = "#1e1e2e",
      foreground = "#cdd6f4",
      primary = "#89b4fa",
      secondary = "#a6adc8",
      accent = "#cba6f7",
      muted = "#6c7086",
      border = "#45475a",
      interval = "#89b4fa",
      interval_line = "#bac2de",
      interval_positive = "#a6e3a1",
      interval_negative = "#f38ba8",
      interval_neutral = "#6c7086",
      summary_fill = "#89b4fa",
      summary_border = "#74c7ec"
    )
  )
}

#' Create a custom theme
#'
#' @param name Theme name
#' @param colors Named list of color overrides
#' @param typography Named list of typography overrides
#' @param spacing Named list of spacing overrides
#' @param shapes Named list of shape overrides
#' @param axis Named list of axis config overrides
#' @param layout Named list of layout config overrides
#' @param base_theme Base theme to extend (default: web_theme_default())
#'
#' @return A WebTheme object
#' @export
web_theme <- function(
    name = "custom",
    colors = NULL,
    typography = NULL,
    spacing = NULL,
    shapes = NULL,
    axis = NULL,
    layout = NULL,
    base_theme = web_theme_default()) {
  # Start with base theme
  result <- base_theme
  result@name <- name

  # Merge color overrides
  if (!is.null(colors)) {
    current <- result@colors
    for (prop in names(colors)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- colors[[prop]]
      }
    }
    result@colors <- current
  }

  # Merge typography overrides
  if (!is.null(typography)) {
    current <- result@typography
    for (prop in names(typography)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- typography[[prop]]
      }
    }
    result@typography <- current
  }

  # Merge spacing overrides
  if (!is.null(spacing)) {
    current <- result@spacing
    for (prop in names(spacing)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- spacing[[prop]]
      }
    }
    result@spacing <- current
  }

  # Merge shape overrides
  if (!is.null(shapes)) {
    current <- result@shapes
    for (prop in names(shapes)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- shapes[[prop]]
      }
    }
    result@shapes <- current
  }

  # Merge axis overrides
  if (!is.null(axis)) {
    current <- result@axis
    for (prop in names(axis)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- axis[[prop]]
      }
    }
    result@axis <- current
  }

  # Merge layout overrides
  if (!is.null(layout)) {
    current <- result@layout
    for (prop in names(layout)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- layout[[prop]]
      }
    }
    result@layout <- current
  }

  result
}

# ============================================================================
# Fluent theme modifier functions
# ============================================================================

#' Modify theme colors
#'
#' Pipe-friendly function to modify specific color properties of a theme.
#'
#' @param theme A WebTheme object
#' @param ... Named color values to override (e.g., primary = "#ff0000")
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_jama() |>
#'   set_colors(primary = "#0066cc", border = "#999999")
set_colors <- function(theme, ...) {
  stopifnot(S7_inherits(theme, WebTheme))
  args <- list(...)
  current <- theme@colors
  for (prop in names(args)) {
    if (prop %in% S7::prop_names(current)) {
      S7::prop(current, prop) <- args[[prop]]
    } else {
      cli_warn("Unknown color property: {.field {prop}}")
    }
  }
  theme@colors <- current
  theme
}

#' Modify theme typography
#'
#' Pipe-friendly function to modify typography settings.
#'
#' @param theme A WebTheme object
#' @param ... Named typography values to override
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_typography(font_family = "Arial", font_size_base = "12pt")
set_typography <- function(theme, ...) {
  stopifnot(S7_inherits(theme, WebTheme))
  args <- list(...)
  current <- theme@typography
  for (prop in names(args)) {
    if (prop %in% S7::prop_names(current)) {
      S7::prop(current, prop) <- args[[prop]]
    } else {
      cli_warn("Unknown typography property: {.field {prop}}")
    }
  }
  theme@typography <- current
  theme
}

#' Modify theme spacing
#'
#' Pipe-friendly function to modify spacing values.
#'
#' @param theme A WebTheme object
#' @param ... Named spacing values to override. Available properties:
#'   - `row_height`: Height of data rows in pixels
#'   - `header_height`: Height of header row in pixels
#'   - `column_gap`: Gap between table and forest plot in pixels
#'   - `section_gap`: Gap between sections in pixels
#'   - `padding`: Overall padding in pixels
#'   - `axis_gap`: Gap between table content and x-axis (default 12px)
#'   - `group_padding`: Left/right padding for column group headers (default 8px)
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_spacing(row_height = 32, axis_gap = 16, group_padding = 12)
set_spacing <- function(theme, ...) {
  stopifnot(S7_inherits(theme, WebTheme))
  args <- list(...)
  current <- theme@spacing
  for (prop in names(args)) {
    if (prop %in% S7::prop_names(current)) {
      S7::prop(current, prop) <- args[[prop]]
    } else {
      cli_warn("Unknown spacing property: {.field {prop}}")
    }
  }
  theme@spacing <- current
  theme
}

#' Modify theme shapes
#'
#' Pipe-friendly function to modify shape settings.
#'
#' @param theme A WebTheme object
#' @param ... Named shape values to override
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_shapes(point_size = 8, line_width = 2)
set_shapes <- function(theme, ...) {
  stopifnot(S7_inherits(theme, WebTheme))
  args <- list(...)
  current <- theme@shapes
  for (prop in names(args)) {
    if (prop %in% S7::prop_names(current)) {
      S7::prop(current, prop) <- args[[prop]]
    } else {
      cli_warn("Unknown shapes property: {.field {prop}}")
    }
  }
  theme@shapes <- current
  theme
}

#' Modify theme axis configuration
#'
#' Pipe-friendly function to modify axis settings.
#'
#' @param theme A WebTheme object
#' @param ... Named axis config values to override
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_axis(gridlines = TRUE, range_min = 0.5, range_max = 2.0)
set_axis <- function(theme, ...) {
  stopifnot(S7_inherits(theme, WebTheme))
  args <- list(...)
  current <- theme@axis
  for (prop in names(args)) {
    if (prop %in% S7::prop_names(current)) {
      S7::prop(current, prop) <- args[[prop]]
    } else {
      cli_warn("Unknown axis property: {.field {prop}}")
    }
  }
  theme@axis <- current
  theme
}

#' Modify theme layout configuration
#'
#' Pipe-friendly function to modify layout settings.
#'
#' @param theme A WebTheme object
#' @param ... Named layout config values to override
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_layout(plot_position = "left", cell_padding_x = 12)
set_layout <- function(theme, ...) {
  stopifnot(S7_inherits(theme, WebTheme))
  args <- list(...)
  current <- theme@layout
  for (prop in names(args)) {
    if (prop %in% S7::prop_names(current)) {
      S7::prop(current, prop) <- args[[prop]]
    } else {
      cli_warn("Unknown layout property: {.field {prop}}")
    }
  }
  theme@layout <- current
  theme
}

# ============================================================================
# Publication-quality theme presets
# ============================================================================

#' JAMA-style theme for medical journal publications
#'
#' Black & white, dense layout, optimized for print.
#' Follows JAMA (Journal of the American Medical Association) style guidelines.
#'
#' @return A WebTheme object
#' @export
web_theme_jama <- function() {
  WebTheme(
    name = "jama",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#000000",
      primary = "#000000",
      secondary = "#333333",
      accent = "#000000",
      muted = "#666666",
      border = "#000000",
      interval = "#000000",
      interval_line = "#000000",
      interval_positive = "#000000",
      interval_negative = "#000000",
      interval_neutral = "#000000",
      summary_fill = "#000000",
      summary_border = "#000000"
    ),
    typography = Typography(
      font_family = "Arial, Helvetica, sans-serif",
      font_size_sm = "9pt",
      font_size_base = "10pt",
      font_size_lg = "11pt",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.3

    ),
    spacing = Spacing(
      row_height = 20,
      header_height = 26,
      column_gap = 6,
      section_gap = 12,
      padding = 8
    ),
    shapes = Shapes(
      point_size = 5,
      summary_height = 8,
      line_width = 1,
      border_radius = 0
    )
  )
}

#' Lancet-style theme for medical journals
#'
#' Lancet blue palette with serif typography.
#'
#' @return A WebTheme object
#' @export
web_theme_lancet <- function() {
  WebTheme(
    name = "lancet",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#00407a",
      primary = "#00407a",
      secondary = "#446e9b",
      accent = "#c4161c",
      muted = "#7a99ac",
      border = "#ccd6dd",
      interval = "#00407a",
      interval_line = "#00407a",
      interval_positive = "#00407a",
      interval_negative = "#c4161c",
      interval_neutral = "#446e9b",
      summary_fill = "#00407a",
      summary_border = "#002d54"
    ),
    typography = Typography(
      font_family = "Georgia, 'Times New Roman', serif",
      font_size_sm = "0.75rem",
      font_size_base = "0.875rem",
      font_size_lg = "1rem",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.4
    ),
    spacing = Spacing(
      row_height = 24,
      header_height = 32,
      column_gap = 8,
      section_gap = 14,
      padding = 10
    ),
    shapes = Shapes(
      point_size = 5,
      summary_height = 9,
      line_width = 1.25,
      border_radius = 0
    )
  )
}

#' Modern theme for reports and dashboards
#'
#' Clean, contemporary design with generous spacing.
#' Uses Inter font family (system fallback) and zinc color palette.
#'
#' @return A WebTheme object
#' @export
web_theme_modern <- function() {
  WebTheme(
    name = "modern",
    colors = ColorPalette(
      background = "#fafafa",
      foreground = "#18181b",
      primary = "#2563eb",
      secondary = "#52525b",
      accent = "#7c3aed",
      muted = "#a1a1aa",
      border = "#e4e4e7",
      interval = "#2563eb",
      interval_line = "#3f3f46",
      interval_positive = "#16a34a",
      interval_negative = "#dc2626",
      interval_neutral = "#71717a",
      summary_fill = "#2563eb",
      summary_border = "#1d4ed8"
    ),
    typography = Typography(
      font_family = "Inter, system-ui, -apple-system, sans-serif",
      font_size_sm = "0.75rem",
      font_size_base = "0.875rem",
      font_size_lg = "1rem",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 600,
      line_height = 1.5
    ),
    spacing = Spacing(
      row_height = 32,
      header_height = 40,
      column_gap = 10,
      section_gap = 20,
      padding = 14
    ),
    shapes = Shapes(
      point_size = 7,
      summary_height = 11,
      line_width = 1.5,
      border_radius = 6
    )
  )
}

#' Presentation theme for slides and posters
#'
#' Large fonts, bold colors, and high contrast.
#' Optimized for visibility at distance.
#'
#' @return A WebTheme object
#' @export
web_theme_presentation <- function() {
  WebTheme(
    name = "presentation",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#0f172a",
      primary = "#0284c7",
      secondary = "#475569",
      accent = "#f59e0b",
      muted = "#94a3b8",
      border = "#cbd5e1",
      interval = "#0284c7",
      interval_line = "#1e293b",
      interval_positive = "#059669",
      interval_negative = "#e11d48",
      interval_neutral = "#475569",
      summary_fill = "#0284c7",
      summary_border = "#0369a1"
    ),
    typography = Typography(
      font_family = "'Source Sans Pro', 'Segoe UI', Roboto, sans-serif",
      font_size_sm = "0.875rem",
      font_size_base = "1rem",
      font_size_lg = "1.125rem",
      font_weight_normal = 400,
      font_weight_medium = 600,
      font_weight_bold = 700,
      line_height = 1.4
    ),
    spacing = Spacing(
      row_height = 40,
      header_height = 48,
      column_gap = 12,
      section_gap = 24,
      padding = 16
    ),
    shapes = Shapes(
      point_size = 10,
      summary_height = 14,
      line_width = 2,
      border_radius = 4
    )
  )
}

#' Cochrane systematic review theme
#'
#' Theme designed for Cochrane systematic reviews.
#' Uses Cochrane blue (#0099CC), Arial font, compact spacing, and no border radius.
#'
#' @return A WebTheme object
#' @export
web_theme_cochrane <- function() {
  WebTheme(
    name = "cochrane",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#333333",
      primary = "#0099cc",
      secondary = "#666666",
      accent = "#0066cc",
      muted = "#999999",
      border = "#cccccc",
      interval = "#0099cc",
      interval_line = "#333333",
      interval_positive = "#0099cc",
      interval_negative = "#cc3333",
      interval_neutral = "#666666",
      summary_fill = "#0099cc",
      summary_border = "#007799"
    ),
    typography = Typography(
      font_family = "Arial, Helvetica, sans-serif",
      font_size_sm = "0.7rem",
      font_size_base = "0.8rem",
      font_size_lg = "0.9rem",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.3
    ),
    spacing = Spacing(
      row_height = 22,
      header_height = 28,
      column_gap = 6,
      section_gap = 10,
      padding = 8
    ),
    shapes = Shapes(
      point_size = 5,
      summary_height = 8,
      line_width = 1,
      border_radius = 0
    ),
    layout = LayoutConfig(
      container_border = FALSE,
      container_border_radius = 0
    )
  )
}

#' Nature journal theme
#'
#' Theme following Nature family journal styling.
#' Uses Nature blue (#1976D2), Helvetica Neue font, and modern clean aesthetic.
#'
#' @return A WebTheme object
#' @export
web_theme_nature <- function() {
  WebTheme(
    name = "nature",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#212121",
      primary = "#1976d2",
      secondary = "#424242",
      accent = "#d32f2f",
      muted = "#757575",
      border = "#e0e0e0",
      interval = "#1976d2",
      interval_line = "#212121",
      interval_positive = "#1976d2",
      interval_negative = "#d32f2f",
      interval_neutral = "#616161",
      summary_fill = "#1976d2",
      summary_border = "#1565c0"
    ),
    typography = Typography(
      font_family = "'Helvetica Neue', Helvetica, Arial, sans-serif",
      font_size_sm = "0.75rem",
      font_size_base = "0.875rem",
      font_size_lg = "1rem",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.4
    ),
    spacing = Spacing(
      row_height = 26,
      header_height = 34,
      column_gap = 8,
      section_gap = 14,
      padding = 10
    ),
    shapes = Shapes(
      point_size = 6,
      summary_height = 9,
      line_width = 1.25,
      border_radius = 2
    ),
    layout = LayoutConfig(
      container_border = TRUE,
      container_border_radius = 2
    )
  )
}

# ============================================================================
# Deprecated aliases for backwards compatibility
# ============================================================================

#' @rdname web_theme_default
#' @export
forest_theme_default <- function() {

  .Deprecated("web_theme_default")
  web_theme_default()
}

#' @rdname web_theme_minimal
#' @export
forest_theme_publication <- function() {
  .Deprecated("web_theme_minimal")
  web_theme_minimal()
}

#' @rdname web_theme_dark
#' @export
forest_theme_dark <- function() {
  .Deprecated("web_theme_dark")
  web_theme_dark()
}

# ============================================================================
# Theme Collections
# ============================================================================

#' Get all package themes
#'
#' Returns a named list of all themes distributed with the package.
#' This is the default value for `enable_themes` in `web_interaction()`.
#'
#' @return A named list of WebTheme objects
#' @export
#' @examples
#' # Get all available themes
#' themes <- package_themes()
#' names(themes)
#'
#' # Use specific themes in interaction
#' web_interaction(enable_themes = package_themes()[c("default", "modern")])
package_themes <- function() {
  list(
    default = web_theme_default(),
    minimal = web_theme_minimal(),
    dark = web_theme_dark(),
    jama = web_theme_jama(),
    lancet = web_theme_lancet(),
    modern = web_theme_modern(),
    presentation = web_theme_presentation(),
    cochrane = web_theme_cochrane(),
    nature = web_theme_nature()
  )
}
