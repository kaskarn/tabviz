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
    # Row banding colors
    row_bg = new_property(class_character, default = "#ffffff"),      # Even row background
    alt_bg = new_property(class_character, default = "#f8fafc"),      # Odd row background (stripe)
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
    line_height = new_property(class_numeric, default = 1.5),
    header_font_scale = new_property(class_numeric, default = 1.05)
  )
)

#' Spacing: Layout spacing values
#'
#' @usage NULL
#' @export
Spacing <- new_class(
  "Spacing",
  properties = list(
    row_height = new_property(class_numeric, default = 24),
    header_height = new_property(class_numeric, default = 32),
    section_gap = new_property(class_numeric, default = 16),
    padding = new_property(class_numeric, default = 12),
    container_padding = new_property(class_numeric, default = 0),
    axis_gap = new_property(class_numeric, default = 12),
    group_padding = new_property(class_numeric, default = 8),
    cell_padding_x = new_property(class_numeric, default = 10),
    cell_padding_y = new_property(class_numeric, default = 4)
  )
)

#' Shapes: Shape rendering settings
#'
#' @description
#' Configures marker shapes and sizes for forest plots.
#'
#' The `marker_colors` and `marker_shapes` properties define the default
#' appearance for multi-effect plots. When effects don't specify their own
#' color or shape, they use these defaults in order (effect 1 uses index 1, etc.).
#'
#' @usage NULL
#' @export
Shapes <- new_class(
  "Shapes",
  properties = list(
    point_size = new_property(class_numeric, default = 6),
    summary_height = new_property(class_numeric, default = 10),
    line_width = new_property(class_numeric, default = 1.5),
    border_radius = new_property(class_numeric, default = 2),
    # Multi-effect marker defaults (colors cycle from theme.colors.interval)
    marker_colors = new_property(class_any, default = NULL),  # NULL = use theme.colors.interval
    marker_shapes = new_property(
      class_any,
      default = c("square", "circle", "diamond", "triangle")
    )
  ),
  validator = function(self) {
    valid_shapes <- c("square", "circle", "diamond", "triangle")
    if (!is.null(self@marker_shapes)) {
      invalid <- setdiff(self@marker_shapes, valid_shapes)
      if (length(invalid) > 0) {
        return(paste("marker_shapes contains invalid values:", paste(invalid, collapse = ", "),
                     "- must be one of:", paste(valid_shapes, collapse = ", ")))
      }
    }
    NULL
  }
)

#' AxisConfig: Axis rendering configuration
#'
#' Controls how the x-axis range and ticks are calculated.
#'
#' @section Auto-Scaling Algorithm:
#' When `range_min`/`range_max` are NA (auto), the axis range is calculated as:
#' 1. Collect all point estimates (not CI bounds)
#' 2. Extend range to include null value (if `include_null = TRUE`)
#' 3. Extend range to include CIs within `ci_clip_factor` of the estimate range
#' 4. Optionally make symmetric around null (if `symmetric = TRUE`)
#' 5. Apply nice rounding for clean tick values
#'
#' CIs extending beyond ci_clip_factor \enc{×}{x} estimate_range are clipped
#' with arrow indicators rather than expanding the axis.
#'
#' @param range_min Minimum value for axis (NA = auto from data)
#' @param range_max Maximum value for axis (NA = auto from data)
#' @param tick_count Target number of ticks (NA = auto)
#' @param tick_values Explicit tick positions (overrides tick_count)
#' @param gridlines Show gridlines on the plot
#' @param gridline_style Style of gridlines: "solid", "dashed", or "dotted"
#' @param ci_clip_factor CIs extending beyond this multiple of the estimate range
#'   are clipped with arrows (default: 2.0). For example, 2.0 means CIs that extend
#'   more than 2x the estimate range will be truncated. Use `Inf` to never clip.
#' @param include_null Always include the null value in the axis range (default: TRUE)
#' @param symmetric Make axis symmetric around null value. Must be explicitly set
#'   to TRUE to enable; default (NULL/FALSE) does not apply symmetry.
#' @param null_tick Always show a tick at the null value (default: TRUE)
#' @param marker_margin Add half-marker-width padding at edges so markers don't clip (default: TRUE)
#'
#' @export
AxisConfig <- new_class(
  "AxisConfig",
  properties = list(
    # Explicit overrides (when set, bypass auto-calculation)
    range_min = new_property(class_numeric, default = NA_real_),
    range_max = new_property(class_numeric, default = NA_real_),
    tick_count = new_property(class_numeric, default = NA_real_),
    tick_values = new_property(class_any, default = NULL),
    gridlines = new_property(class_logical, default = FALSE),
    gridline_style = new_property(class_character, default = "dotted"),
    # Auto-scaling parameters
    ci_clip_factor = new_property(class_numeric, default = 2.0),
    include_null = new_property(class_logical, default = TRUE),
    symmetric = new_property(class_any, default = NULL),  # NULL/FALSE = off, TRUE = on
    null_tick = new_property(class_logical, default = TRUE),
    marker_margin = new_property(class_logical, default = TRUE)
  ),
  validator = function(self) {
    valid_styles <- c("solid", "dashed", "dotted")
    if (!self@gridline_style %in% valid_styles) {
      return(paste("gridline_style must be one of:", paste(valid_styles, collapse = ", ")))
    }
    if (!is.na(self@ci_clip_factor) && self@ci_clip_factor < 0) {
      return("ci_clip_factor must be non-negative")
    }
    if (!is.null(self@symmetric) && !is.logical(self@symmetric)) {
      return("symmetric must be TRUE, FALSE, or NULL")
    }
    NULL
  }
)

#' LayoutConfig: Layout and visual configuration
#'
#' @param plot_position Position of forest plot: "left" or "right" (default: "right")
#' @param table_width Width of table area: "auto" or numeric pixels (default: "auto")
#' @param plot_width Width of plot area: "auto" or numeric pixels (default: "auto")
#' @param row_border Show horizontal borders between rows (default: TRUE)
#' @param row_border_style Style of row borders: "solid", "dashed", or "dotted" (default: "solid")
#' @param container_border Show border around the plot container (default: FALSE)
#' @param container_border_radius Corner radius for container in pixels (default: 8)
#' @param banding Enable alternating row background colors (default: TRUE)
#'
#' @details
#' Note: `cell_padding_x` and `cell_padding_y` have been moved to the [Spacing] class.
#' Use [set_spacing()] to modify cell padding.
#'
#' @export
LayoutConfig <- new_class(
  "LayoutConfig",
  properties = list(
    plot_position = new_property(class_character, default = "right"),
    table_width = new_property(class_any, default = "auto"),
    plot_width = new_property(class_any, default = "auto"),
    row_border = new_property(class_logical, default = TRUE),
    row_border_style = new_property(class_character, default = "solid"),
    container_border = new_property(class_logical, default = FALSE),
    container_border_radius = new_property(class_numeric, default = 8),
    banding = new_property(class_logical, default = TRUE)
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

#' GroupHeaderStyles: Hierarchical styling for nested row groups
#'
#' Configures h1/h2/h3-style visual hierarchy for nested row group headers.
#' Level 1 is the outermost group (largest, boldest), with progressively
#' lighter styling for deeper nesting levels.
#'
#' @section Computed Colors:
#' When background colors are NULL (default), they are computed from the theme's
#' primary color with decreasing opacity:
#' - Level 1: 15% opacity
#' - Level 2: 10% opacity
#' - Level 3+: 6% opacity
#'
#' @usage NULL
#' @export
GroupHeaderStyles <- new_class(
  "GroupHeaderStyles",
  properties = list(
    # Level 1 (top-level groups) - subtle prominence, close to base font
    level1_font_size = new_property(class_character, default = "0.9375rem"),
    level1_font_weight = new_property(class_numeric, default = 600),
    level1_italic = new_property(class_logical, default = FALSE),
    level1_background = new_property(class_any, default = NULL),  # NULL = computed
    level1_border_bottom = new_property(class_logical, default = FALSE),

    # Level 2 - same as base font, medium weight
    level2_font_size = new_property(class_character, default = "0.875rem"),
    level2_font_weight = new_property(class_numeric, default = 500),
    level2_italic = new_property(class_logical, default = FALSE),
    level2_background = new_property(class_any, default = NULL),  # NULL = computed
    level2_border_bottom = new_property(class_logical, default = FALSE),

    # Level 3+ - same as base font, normal weight
    level3_font_size = new_property(class_character, default = "0.875rem"),
    level3_font_weight = new_property(class_numeric, default = 400),
    level3_italic = new_property(class_logical, default = FALSE),
    level3_background = new_property(class_any, default = NULL),  # NULL = computed
    level3_border_bottom = new_property(class_logical, default = FALSE),

    # Indentation per level (px)
    indent_per_level = new_property(class_numeric, default = 16)
  )
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
#' @param group_headers GroupHeaderStyles object for nested row group hierarchy
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
    layout = new_property(LayoutConfig, default = LayoutConfig()),
    group_headers = new_property(GroupHeaderStyles, default = GroupHeaderStyles())
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
#' Academic publication-ready theme with pure black and white styling.
#' Uses serif typography (Georgia) and sharp corners for a classic,
#' authoritative look suitable for journal submissions.
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
      accent = "#000000",
      muted = "#666666",
      border = "#000000",             # Strong black borders
      row_bg = "#ffffff",
      alt_bg = "#fafafa",             # Subtle grey stripe
      interval = "#000000",           # Pure black markers
      interval_line = "#000000",
      interval_positive = "#000000",
      interval_negative = "#000000",
      interval_neutral = "#666666",
      summary_fill = "#000000",
      summary_border = "#000000"
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
      row_height = 22,
      header_height = 28,
      section_gap = 12,
      padding = 10
    ),
    shapes = Shapes(
      point_size = 5,
      summary_height = 8,
      line_width = 1,
      border_radius = 0               # Sharp corners
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,
      container_border_radius = 0     # No rounded corners
    ),
    # Academic, understated hierarchy
    group_headers = GroupHeaderStyles(
      level1_font_size = "0.9375rem",
      level1_font_weight = 700,       # Use theme's bold
      level1_italic = FALSE,
      level2_font_size = "0.875rem",
      level2_font_weight = 500,
      level2_italic = FALSE,
      level3_font_size = "0.875rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 14           # Slightly tighter indent
    )
  )
}

#' Create a dark theme
#'
#' Sophisticated dark mode theme inspired by Catppuccin Mocha palette.
#' Features muted, comfortable colors with reduced contrast for extended
#' viewing. Blue-tinted accents and soft pastel markers.
#'
#' @return A WebTheme object with dark mode colors
#' @export
web_theme_dark <- function() {
  WebTheme(
    name = "dark",
    colors = ColorPalette(
      background = "#1e1e2e",         # Catppuccin base
      foreground = "#cdd6f4",         # Catppuccin text
      primary = "#89b4fa",            # Catppuccin blue
      secondary = "#a6adc8",          # Catppuccin subtext0
      accent = "#f5c2e7",             # Catppuccin pink
      muted = "#6c7086",              # Catppuccin overlay0
      border = "#313244",             # Catppuccin surface0
      row_bg = "#1e1e2e",             # Match background
      alt_bg = "#232334",             # Slightly lighter stripe
      interval = "#89b4fa",           # Catppuccin blue
      interval_line = "#9399b2",      # Catppuccin overlay2
      interval_positive = "#a6e3a1",  # Catppuccin green
      interval_negative = "#f38ba8",  # Catppuccin red
      interval_neutral = "#6c7086",
      summary_fill = "#89b4fa",
      summary_border = "#74c7ec"      # Catppuccin sapphire
    ),
    typography = Typography(
      font_family = "system-ui, -apple-system, sans-serif",
      font_size_sm = "0.75rem",
      font_size_base = "0.875rem",
      font_size_lg = "1rem",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 600,
      line_height = 1.5
    ),
    spacing = Spacing(
      row_height = 26,                # Comfortable for dark mode
      header_height = 32,
      section_gap = 16,
      padding = 12
    ),
    shapes = Shapes(
      point_size = 6,
      summary_height = 10,
      line_width = 1.5,
      border_radius = 4               # Soft rounded corners
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,
      container_border_radius = 8
    ),
    # Comfortable dark mode hierarchy
    group_headers = GroupHeaderStyles(
      level1_font_size = "0.9375rem",
      level1_font_weight = 600,
      level1_italic = FALSE,
      level2_font_size = "0.875rem",
      level2_font_weight = 500,
      level2_italic = FALSE,
      level3_font_size = "0.875rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 18           # Generous indent for comfort
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
#' @param group_headers Named list of group header style overrides
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
    group_headers = NULL,
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

  # Merge group header overrides
  if (!is.null(group_headers)) {
    current <- result@group_headers
    for (prop in names(group_headers)) {
      if (prop %in% S7::prop_names(current)) {
        S7::prop(current, prop) <- group_headers[[prop]]
      }
    }
    result@group_headers <- current
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
#' @section Cascading Defaults:
#' Several colors cascade when not explicitly set, making custom themes easier
#' to create:
#'
#' - **Background colors:** `background` → `row_bg` → `alt_bg`
#' - **Marker colors:** `primary` → `interval` → `summary_fill`
#'
#' For example, setting `primary = "#ff0000"` will automatically use red for
#' markers and summary diamonds unless you override `interval` or `summary_fill`.
#' Setting `background = "#1e1e2e"` for a dark theme will automatically set
#' row backgrounds to match.
#'
#' @param theme A WebTheme object
#' @param background Background color (default: "#ffffff")
#' @param foreground Primary text color (default: "#333333")
#' @param primary Primary accent color for markers and highlights (default: "#0891b2").
#'   Cascades to `interval` and `summary_fill` if not specified.
#' @param secondary Secondary text/UI color (default: "#64748b")
#' @param accent Accent color for emphasis (default: "#8b5cf6")
#' @param muted Muted/disabled text color (default: "#94a3b8")
#' @param border Border color for containers and dividers (default: "#e2e8f0")
#' @param row_bg Even row background color for banding. If not specified and
#'   `background` is set, inherits from `background`.
#' @param alt_bg Odd row background color for banding/striping. If not specified
#'   and `background` or `row_bg` is set, inherits from `row_bg` (disabling
#'   visible banding). Set explicitly to enable striped rows on custom themes.
#' @param interval Default marker/interval color (default: "#0891b2"). If not
#'   specified and `primary` is set, inherits from `primary`. Cascades to
#'   `summary_fill` if not specified.
#' @param interval_positive Deprecated. Color for favorable effects.
#' @param interval_negative Deprecated. Color for unfavorable effects.
#' @param interval_neutral Color for neutral effects (default: "#64748b")
#' @param interval_line Confidence interval line color (default: "#475569")
#' @param summary_fill Summary diamond fill color (default: "#0891b2"). If not
#'   specified and `interval` or `primary` is set, inherits from `interval`.
#' @param summary_border Summary diamond border color (default: "#0e7490")
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_jama() |>
#'   set_colors(primary = "#0066cc", border = "#999999")
set_colors <- function(
    theme,
    background = NULL,
    foreground = NULL,
    primary = NULL,
    secondary = NULL,
    accent = NULL,
    muted = NULL,
    border = NULL,
    row_bg = NULL,
    alt_bg = NULL,
    interval = NULL,
    interval_positive = NULL,
    interval_negative = NULL,
    interval_neutral = NULL,
    interval_line = NULL,
    summary_fill = NULL,
    summary_border = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))
  current <- theme@colors

  if (!is.null(background)) current@background <- background
  if (!is.null(foreground)) current@foreground <- foreground
  if (!is.null(primary)) current@primary <- primary
  if (!is.null(secondary)) current@secondary <- secondary
  if (!is.null(accent)) current@accent <- accent
  if (!is.null(muted)) current@muted <- muted
  if (!is.null(border)) current@border <- border

  # Cascade row background colors:

  # If background changed but row_bg not specified, derive row_bg from background
  if (!is.null(background) && is.null(row_bg)) {
    current@row_bg <- background
  } else if (!is.null(row_bg)) {
    current@row_bg <- row_bg
  }

  # If row_bg changed (explicitly or derived) but alt_bg not specified, derive alt_bg from row_bg
  if ((!is.null(background) || !is.null(row_bg)) && is.null(alt_bg)) {
    current@alt_bg <- current@row_bg
  } else if (!is.null(alt_bg)) {
    current@alt_bg <- alt_bg
  }

  # Cascade marker colors:

  # If primary changed but interval not specified, derive interval from primary
  if (!is.null(primary) && is.null(interval)) {
    current@interval <- primary
  } else if (!is.null(interval)) {
    current@interval <- interval
  }

  # If interval changed (explicitly or derived) but summary_fill not specified, derive from interval
  if ((!is.null(primary) || !is.null(interval)) && is.null(summary_fill)) {
    current@summary_fill <- current@interval
  } else if (!is.null(summary_fill)) {
    current@summary_fill <- summary_fill
  }

  if (!is.null(interval_positive)) current@interval_positive <- interval_positive
  if (!is.null(interval_negative)) current@interval_negative <- interval_negative
  if (!is.null(interval_neutral)) current@interval_neutral <- interval_neutral
  if (!is.null(interval_line)) current@interval_line <- interval_line
  if (!is.null(summary_border)) current@summary_border <- summary_border

  theme@colors <- current
  theme
}

#' Modify theme typography
#'
#' Pipe-friendly function to modify typography settings.
#'
#' @param theme A WebTheme object
#' @param font_family CSS font-family string (default: "system-ui, -apple-system, sans-serif")
#' @param font_size_sm Small text size, e.g., "0.75rem" or "9pt"
#' @param font_size_base Base text size (default: "0.875rem")
#' @param font_size_lg Large text size (default: "1rem")
#' @param font_weight_normal Normal font weight (default: 400)
#' @param font_weight_medium Medium font weight (default: 500)
#' @param font_weight_bold Bold font weight (default: 600)
#' @param line_height Line height multiplier (default: 1.5)
#' @param header_font_scale Scale factor for header cell font size relative to base (default: 1.05)
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_typography(font_family = "Arial", font_size_base = "12pt")
set_typography <- function(
    theme,
    font_family = NULL,
    font_size_sm = NULL,
    font_size_base = NULL,
    font_size_lg = NULL,
    font_weight_normal = NULL,
    font_weight_medium = NULL,
    font_weight_bold = NULL,
    line_height = NULL,
    header_font_scale = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))
  current <- theme@typography

  if (!is.null(font_family)) current@font_family <- font_family
  if (!is.null(font_size_sm)) current@font_size_sm <- font_size_sm
  if (!is.null(font_size_base)) current@font_size_base <- font_size_base
  if (!is.null(font_size_lg)) current@font_size_lg <- font_size_lg
  if (!is.null(font_weight_normal)) current@font_weight_normal <- font_weight_normal
  if (!is.null(font_weight_medium)) current@font_weight_medium <- font_weight_medium
  if (!is.null(font_weight_bold)) current@font_weight_bold <- font_weight_bold
  if (!is.null(line_height)) current@line_height <- line_height
  if (!is.null(header_font_scale)) current@header_font_scale <- header_font_scale

  theme@typography <- current
  theme
}

#' Modify theme spacing
#'
#' Pipe-friendly function to modify spacing values.
#'
#' @param theme A WebTheme object
#' @param row_height Height of data rows in pixels (default: 24)
#' @param header_height Height of header row in pixels (default: 32)
#' @param section_gap Gap between sections in pixels (default: 16)
#' @param padding Padding around the forest plot SVG in pixels (default: 12)
#' @param container_padding Left/right padding for the outer container in pixels (default: 0)
#' @param axis_gap Gap between table content and x-axis in pixels (default: 12)
#' @param group_padding Left/right padding for column group headers in pixels (default: 8)
#' @param cell_padding_x Horizontal cell padding in pixels (default: 10)
#' @param cell_padding_y Vertical cell padding in pixels (default: 4)
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_spacing(row_height = 32, cell_padding_x = 12, cell_padding_y = 6)
set_spacing <- function(
    theme,
    row_height = NULL,
    header_height = NULL,
    section_gap = NULL,
    padding = NULL,
    container_padding = NULL,
    axis_gap = NULL,
    group_padding = NULL,
    cell_padding_x = NULL,
    cell_padding_y = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))
  current <- theme@spacing

  if (!is.null(row_height)) current@row_height <- row_height
  if (!is.null(header_height)) current@header_height <- header_height
  if (!is.null(section_gap)) current@section_gap <- section_gap
  if (!is.null(padding)) current@padding <- padding
  if (!is.null(container_padding)) current@container_padding <- container_padding
  if (!is.null(axis_gap)) current@axis_gap <- axis_gap
  if (!is.null(group_padding)) current@group_padding <- group_padding
  if (!is.null(cell_padding_x)) current@cell_padding_x <- cell_padding_x
  if (!is.null(cell_padding_y)) current@cell_padding_y <- cell_padding_y

  theme@spacing <- current
  theme
}

#' Modify theme shapes
#'
#' Pipe-friendly function to modify shape settings.
#'
#' @param theme A WebTheme object
#' @param point_size Marker point radius in pixels (default: 6)
#' @param summary_height Summary diamond height in pixels (default: 10)
#' @param line_width Confidence interval line width in pixels (default: 1.5)
#' @param border_radius Border radius for containers in pixels (default: 2)
#' @param marker_colors Character vector of colors for multi-effect plots.
#'   Effects without explicit colors use these in order. NULL uses theme interval color.
#' @param marker_shapes Character vector of shapes for multi-effect plots:
#'   "square", "circle", "diamond", "triangle" (default: all four in order)
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_shapes(point_size = 8, line_width = 2)
set_shapes <- function(
    theme,
    point_size = NULL,
    summary_height = NULL,
    line_width = NULL,
    border_radius = NULL,
    marker_colors = NULL,
    marker_shapes = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))
  current <- theme@shapes

  if (!is.null(point_size)) current@point_size <- point_size
  if (!is.null(summary_height)) current@summary_height <- summary_height
  if (!is.null(line_width)) current@line_width <- line_width
  if (!is.null(border_radius)) current@border_radius <- border_radius
  if (!is.null(marker_colors)) {
    checkmate::assert_character(marker_colors, min.len = 1)
    current@marker_colors <- marker_colors
  }
  if (!is.null(marker_shapes)) {
    valid_shapes <- c("square", "circle", "diamond", "triangle")
    checkmate::assert_subset(marker_shapes, valid_shapes)
    current@marker_shapes <- marker_shapes
  }

  theme@shapes <- current
  theme
}

#' Set marker colors for multi-effect plots
#'
#' Convenience function to set theme marker colors for multi-effect forest plots.
#' Effects without an explicit color will use these colors in order.
#'
#' @param theme A WebTheme object
#' @param colors Character vector of colors for effects (e.g., c("#2563eb", "#dc2626"))
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_marker_colors(c("#0891b2", "#dc2626", "#16a34a"))
set_marker_colors <- function(theme, colors) {
  stopifnot(S7_inherits(theme, WebTheme))
  checkmate::assert_character(colors, min.len = 1)
  theme@shapes@marker_colors <- colors
  theme
}

#' Set marker shapes for multi-effect plots
#'
#' Convenience function to set theme marker shapes for multi-effect forest plots.
#' Effects without an explicit shape will use these shapes in order.
#'
#' @param theme A WebTheme object
#' @param shapes Character vector of shapes: "square", "circle", "diamond", "triangle"
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_marker_shapes(c("square", "circle", "diamond"))
set_marker_shapes <- function(theme, shapes) {
  stopifnot(S7_inherits(theme, WebTheme))
  valid_shapes <- c("square", "circle", "diamond", "triangle")
  checkmate::assert_subset(shapes, valid_shapes)
  theme@shapes@marker_shapes <- shapes
  theme
}

#' Modify theme axis configuration
#'
#' Pipe-friendly function to modify axis settings.
#'
#' @param theme A WebTheme object
#' @param range_min Minimum axis value. NA for auto-calculation from data.
#' @param range_max Maximum axis value. NA for auto-calculation from data.
#' @param tick_count Target number of axis ticks. NA for auto-calculation.
#' @param tick_values Explicit tick positions as numeric vector. Overrides tick_count.
#' @param gridlines Show vertical gridlines on plot (default: FALSE)
#' @param gridline_style Gridline style: "solid", "dashed", or "dotted" (default: "dotted")
#' @param ci_clip_factor CIs extending beyond this multiple of the estimate range are
#'   clipped with arrows (default: 2.0). For example, 2.0 means CIs that extend more
#'   than 2x the estimate range will be truncated. Use `Inf` to never clip.
#' @param include_null Always include null value in axis range (default: TRUE)
#' @param symmetric Make axis symmetric around null value. Set to TRUE to enable;
#'   default (NULL/FALSE) does not apply symmetry.
#' @param null_tick Always show a tick at the null value (default: TRUE)
#' @param marker_margin Add half-marker-width padding at edges to prevent clipping (default: TRUE)
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_axis(gridlines = TRUE, range_min = 0.5, range_max = 2.0)
#'
#' # Allow wider CIs before clipping with arrows
#' web_theme_default() |>
#'   set_axis(ci_clip_factor = 3.0)
#'
#' # Never clip CIs (expand axis to fit all)
#' web_theme_default() |>
#'   set_axis(ci_clip_factor = Inf)
set_axis <- function(
    theme,
    range_min = NULL,
    range_max = NULL,
    tick_count = NULL,
    tick_values = NULL,
    gridlines = NULL,
    gridline_style = NULL,
    ci_clip_factor = NULL,
    include_null = NULL,
    symmetric = NULL,
    null_tick = NULL,
    marker_margin = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))

current <- theme@axis

  if (!is.null(range_min)) current@range_min <- range_min
  if (!is.null(range_max)) current@range_max <- range_max
  if (!is.null(tick_count)) current@tick_count <- tick_count
  if (!is.null(tick_values)) current@tick_values <- tick_values
  if (!is.null(gridlines)) current@gridlines <- gridlines
  if (!is.null(gridline_style)) {
    valid_styles <- c("solid", "dashed", "dotted")
    if (!gridline_style %in% valid_styles) {
      cli_abort("gridline_style must be one of: {.val {valid_styles}}")
    }
    current@gridline_style <- gridline_style
  }
  if (!is.null(ci_clip_factor)) {
    if (ci_clip_factor < 0) {
      cli_abort("ci_clip_factor must be non-negative")
    }
    current@ci_clip_factor <- ci_clip_factor
  }
  if (!is.null(include_null)) current@include_null <- include_null
  if (!is.null(symmetric)) current@symmetric <- symmetric
  if (!is.null(null_tick)) current@null_tick <- null_tick
  if (!is.null(marker_margin)) current@marker_margin <- marker_margin

  theme@axis <- current
  theme
}

#' Modify theme layout configuration
#'
#' Pipe-friendly function to modify layout settings.
#'
#' @param theme A WebTheme object
#' @param plot_position Position of forest plot: "left" or "right" (default: "right")
#' @param table_width Width of table area: "auto" or numeric pixels (default: "auto")
#' @param plot_width Width of plot area: "auto" or numeric pixels (default: "auto")
#' @param cell_padding_x Deprecated. Use [set_spacing()] instead.
#' @param cell_padding_y Deprecated. Use [set_spacing()] instead.
#' @param row_border Show horizontal borders between rows (default: TRUE)
#' @param row_border_style Row border style: "solid", "dashed", or "dotted" (default: "solid")
#' @param container_border Show border around the entire plot container (default: FALSE)
#' @param container_border_radius Corner radius for container in pixels (default: 8).
#'   Only visible when `container_border = TRUE`.
#' @param banding Enable alternating row background colors (default: TRUE).
#'   Uses `row_bg` and `alt_bg` from theme colors.
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' # Move plot to left side
#' web_theme_default() |>
#'   set_layout(plot_position = "left")
#'
#' # Add a border around the container
#' web_theme_default() |>
#'   set_layout(container_border = TRUE, container_border_radius = 4)
#'
#' # Disable row banding
#' web_theme_default() |>
#'   set_layout(banding = FALSE)
set_layout <- function(
    theme,
    plot_position = NULL,
    table_width = NULL,
    plot_width = NULL,
    cell_padding_x = NULL,
    cell_padding_y = NULL,
    row_border = NULL,
    row_border_style = NULL,
    container_border = NULL,
    container_border_radius = NULL,
    banding = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))
  current <- theme@layout

  if (!is.null(plot_position)) {
    if (!plot_position %in% c("left", "right")) {
      cli_abort("plot_position must be 'left' or 'right'")
    }
    current@plot_position <- plot_position
  }
  if (!is.null(table_width)) current@table_width <- table_width
  if (!is.null(plot_width)) current@plot_width <- plot_width

  # Deprecated: forward to spacing

  if (!is.null(cell_padding_x)) {
    cli_warn("cell_padding_x in set_layout() is deprecated. Use set_spacing(cell_padding_x = ...) instead.")
    theme@spacing@cell_padding_x <- cell_padding_x
  }
  if (!is.null(cell_padding_y)) {
    cli_warn("cell_padding_y in set_layout() is deprecated. Use set_spacing(cell_padding_y = ...) instead.")
    theme@spacing@cell_padding_y <- cell_padding_y
  }

  if (!is.null(row_border)) current@row_border <- row_border
  if (!is.null(row_border_style)) {
    valid_styles <- c("solid", "dashed", "dotted")
    if (!row_border_style %in% valid_styles) {
      cli_abort("row_border_style must be one of: {.val {valid_styles}}")
    }
    current@row_border_style <- row_border_style
  }
  if (!is.null(container_border)) current@container_border <- container_border
  if (!is.null(container_border_radius)) current@container_border_radius <- container_border_radius
  if (!is.null(banding)) current@banding <- banding

  theme@layout <- current
  theme
}

#' Modify theme group header styles
#'
#' Pipe-friendly function to modify hierarchical styling for nested row groups.
#' Nested groups are styled with h1/h2/h3-like visual hierarchy.
#'
#' @param theme A WebTheme object
#' @param level1_font_size Font size for top-level groups (default: "1rem")
#' @param level1_font_weight Font weight for top-level groups (default: 700)
#' @param level1_italic Use italic text for level 1 headers (default: FALSE)
#' @param level1_background Background color for level 1. NULL = computed from primary at 15% opacity.
#' @param level1_border_bottom Show bottom border on level 1 headers (default: FALSE)
#' @param level2_font_size Font size for second-level groups (default: "0.9375rem")
#' @param level2_font_weight Font weight for second-level groups (default: 500)
#' @param level2_italic Use italic text for level 2 headers (default: TRUE)
#' @param level2_background Background color for level 2. NULL = computed from primary at 10% opacity.
#' @param level2_border_bottom Show bottom border on level 2 headers (default: FALSE)
#' @param level3_font_size Font size for third-level and deeper groups (default: "0.875rem")
#' @param level3_font_weight Font weight for third-level groups (default: 400)
#' @param level3_italic Use italic text for level 3+ headers (default: FALSE)
#' @param level3_background Background color for level 3+. NULL = computed from primary at 6% opacity.
#' @param level3_border_bottom Show bottom border on level 3+ headers (default: FALSE)
#' @param indent_per_level Indentation per nesting level in pixels (default: 16)
#'
#' @return Modified WebTheme object
#' @export
#' @examples
#' web_theme_default() |>
#'   set_group_headers(
#'     level1_font_weight = 800,
#'     level2_italic = FALSE,
#'     level1_background = "#f0f9ff",
#'     indent_per_level = 24
#'   )
set_group_headers <- function(
    theme,
    level1_font_size = NULL,
    level1_font_weight = NULL,
    level1_italic = NULL,
    level1_background = NULL,
    level1_border_bottom = NULL,
    level2_font_size = NULL,
    level2_font_weight = NULL,
    level2_italic = NULL,
    level2_background = NULL,
    level2_border_bottom = NULL,
    level3_font_size = NULL,
    level3_font_weight = NULL,
    level3_italic = NULL,
    level3_background = NULL,
    level3_border_bottom = NULL,
    indent_per_level = NULL
) {
  stopifnot(S7_inherits(theme, WebTheme))
  current <- theme@group_headers

  if (!is.null(level1_font_size)) current@level1_font_size <- level1_font_size
  if (!is.null(level1_font_weight)) current@level1_font_weight <- level1_font_weight
  if (!is.null(level1_italic)) current@level1_italic <- level1_italic
  if (!is.null(level1_background)) current@level1_background <- level1_background
  if (!is.null(level1_border_bottom)) current@level1_border_bottom <- level1_border_bottom
  if (!is.null(level2_font_size)) current@level2_font_size <- level2_font_size
  if (!is.null(level2_font_weight)) current@level2_font_weight <- level2_font_weight
  if (!is.null(level2_italic)) current@level2_italic <- level2_italic
  if (!is.null(level2_background)) current@level2_background <- level2_background
  if (!is.null(level2_border_bottom)) current@level2_border_bottom <- level2_border_bottom
  if (!is.null(level3_font_size)) current@level3_font_size <- level3_font_size
  if (!is.null(level3_font_weight)) current@level3_font_weight <- level3_font_weight
  if (!is.null(level3_italic)) current@level3_italic <- level3_italic
  if (!is.null(level3_background)) current@level3_background <- level3_background
  if (!is.null(level3_border_bottom)) current@level3_border_bottom <- level3_border_bottom
  if (!is.null(indent_per_level)) current@indent_per_level <- indent_per_level

  theme@group_headers <- current
  theme
}

# ============================================================================
# Publication-quality theme presets
# ============================================================================

#' JAMA-style theme for medical journal publications
#'
#' Dense, black & white layout optimized for print and medical journals.
#' Follows JAMA (Journal of the American Medical Association) style guidelines
#' with maximum data density, thick borders, and compact rows. Uses point-based
#' font sizes for print consistency.
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
      muted = "#555555",
      border = "#000000",             # Pure black borders
      row_bg = "#ffffff",
      alt_bg = "#f9fafb",             # Very subtle grey
      interval = "#000000",           # Pure black markers
      interval_line = "#000000",
      interval_positive = "#000000",
      interval_negative = "#000000",
      interval_neutral = "#555555",
      summary_fill = "#000000",
      summary_border = "#000000"
    ),
    typography = Typography(
      font_family = "Arial, Helvetica, sans-serif",
      font_size_sm = "8pt",           # Smaller for density
      font_size_base = "9pt",         # Compact base
      font_size_lg = "10pt",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.2               # Tight line height
    ),
    spacing = Spacing(
      row_height = 18,                # Very compact rows
      header_height = 24,
      section_gap = 8,
      padding = 6,
      cell_padding_x = 8,             # Tighter cell padding
      cell_padding_y = 2
    ),
    shapes = Shapes(
      point_size = 4,                 # Small markers
      summary_height = 7,
      line_width = 1.25,              # Slightly thicker for visibility
      border_radius = 0
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,
      container_border_radius = 0     # Sharp corners
    ),
    # Compact hierarchy matching dense layout
    group_headers = GroupHeaderStyles(
      level1_font_size = "9.5pt",      # Slightly larger than 9pt base
      level1_font_weight = 700,
      level1_italic = FALSE,
      level2_font_size = "9pt",        # Match base
      level2_font_weight = 500,
      level2_italic = FALSE,
      level3_font_size = "9pt",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 12           # Tight indent for density
    )
  )
}

#' Lancet-style theme for medical journals
#'
#' Elegant academic theme with Lancet navy blue and warm gold accents.
#' Features refined serif typography with generous spacing.
#'
#' @return A WebTheme object
#' @export
web_theme_lancet <- function() {
  WebTheme(
    name = "lancet",
    colors = ColorPalette(
      background = "#fdfcfb",       # Warm off-white
      foreground = "#1e3a5f",       # Deep navy
      primary = "#00407a",          # Lancet blue
      secondary = "#3d5a80",        # Slate blue
      accent = "#b8860b",           # Dark goldenrod
      muted = "#6b7c93",
      border = "#d4dce6",
      row_bg = "#fdfcfb",           # Match background
      alt_bg = "#f8f7f5",           # Warm subtle stripe
      interval = "#00407a",
      interval_line = "#1e3a5f",
      interval_positive = "#00407a",
      interval_negative = "#9d2933", # Deep crimson
      interval_neutral = "#3d5a80",
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
      line_height = 1.5             # More generous line height
    ),
    spacing = Spacing(
      row_height = 24,
      header_height = 30,
      section_gap = 14,
      padding = 12,
      cell_padding_x = 12,          # More breathing room
      cell_padding_y = 4
    ),
    shapes = Shapes(
      point_size = 5,
      summary_height = 9,
      line_width = 1.25,
      border_radius = 0             # Sharp corners for academic feel
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,
      container_border_radius = 0   # No rounded corners
    ),
    # Refined serif hierarchy with generous spacing
    group_headers = GroupHeaderStyles(
      level1_font_size = "0.9375rem",
      level1_font_weight = 700,
      level1_italic = FALSE,
      level2_font_size = "0.875rem",
      level2_font_weight = 500,
      level2_italic = TRUE,           # Subtle italic for elegance
      level3_font_size = "0.875rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 18           # Generous indent
    )
  )
}

#' Modern theme for reports and dashboards
#'
#' Bold, contemporary design with vibrant colors and generous spacing.
#' Uses Inter font family (system fallback) with zinc color palette.
#' Features larger elements, prominent rounded corners, and vivid
#' color contrast suitable for digital reports and dashboards.
#'
#' @return A WebTheme object
#' @export
web_theme_modern <- function() {
  WebTheme(
    name = "modern",
    colors = ColorPalette(
      background = "#fafafa",
      foreground = "#18181b",
      primary = "#3b82f6",             # Blue-500 - more vibrant
      secondary = "#52525b",
      accent = "#8b5cf6",              # Violet-500
      muted = "#a1a1aa",
      border = "#d4d4d8",              # Slightly more visible
      row_bg = "#fafafa",              # Match background
      alt_bg = "#f5f5f5",              # Subtle zinc stripe
      interval = "#3b82f6",
      interval_line = "#27272a",       # Darker for contrast
      interval_positive = "#22c55e",   # Green-500
      interval_negative = "#ef4444",   # Red-500
      interval_neutral = "#71717a",
      summary_fill = "#3b82f6",
      summary_border = "#2563eb"       # Blue-600
    ),
    typography = Typography(
      font_family = "Inter, system-ui, -apple-system, sans-serif",
      font_size_sm = "0.8125rem",      # Slightly larger
      font_size_base = "0.9375rem",    # 15px
      font_size_lg = "1.0625rem",      # 17px
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 600,
      line_height = 1.5
    ),
    spacing = Spacing(
      row_height = 30,                 # Spacious rows
      header_height = 36,
      section_gap = 20,
      padding = 14,
      cell_padding_x = 12,
      cell_padding_y = 5
    ),
    shapes = Shapes(
      point_size = 8,                  # Larger markers
      summary_height = 12,
      line_width = 1.75,
      border_radius = 8                # More rounded
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,
      container_border_radius = 12     # Prominent rounded corners
    ),
    # Bold contemporary hierarchy with larger sizes
    group_headers = GroupHeaderStyles(
      level1_font_size = "1rem",        # More pronounced for modern feel
      level1_font_weight = 600,
      level1_italic = FALSE,
      level2_font_size = "0.9375rem",
      level2_font_weight = 500,
      level2_italic = FALSE,
      level3_font_size = "0.9375rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 20           # Generous modern spacing
    )
  )
}

#' Presentation theme for slides and posters
#'
#' Large fonts, bold colors, and high contrast.
#' Optimized for visibility at distance with thick lines and oversized markers.
#'
#' @return A WebTheme object
#' @export
web_theme_presentation <- function() {
  WebTheme(
    name = "presentation",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#0f172a",
      primary = "#0369a1",           # Deeper sky blue
      secondary = "#334155",         # Darker slate
      accent = "#ea580c",            # Orange-600 for emphasis
      muted = "#64748b",
      border = "#94a3b8",            # More visible borders
      row_bg = "#ffffff",
      alt_bg = "#f8fafc",            # Subtle slate stripe
      interval = "#0369a1",
      interval_line = "#0f172a",     # Very dark for visibility
      interval_positive = "#047857", # Emerald-700
      interval_negative = "#be123c", # Rose-700
      interval_neutral = "#334155",
      summary_fill = "#0369a1",
      summary_border = "#0c4a6e"     # Darker outline
    ),
    typography = Typography(
      font_family = "'Source Sans Pro', 'Segoe UI', Roboto, sans-serif",
      font_size_sm = "1rem",         # Larger small text
      font_size_base = "1.125rem",   # Larger base
      font_size_lg = "1.25rem",      # Larger headings
      font_weight_normal = 400,
      font_weight_medium = 600,
      font_weight_bold = 700,
      line_height = 1.4
    ),
    spacing = Spacing(
      row_height = 36,           # Tall rows for readability
      header_height = 44,
      section_gap = 24,
      padding = 18,
      cell_padding_x = 14,       # More cell padding
      cell_padding_y = 5
    ),
    shapes = Shapes(
      point_size = 12,           # Oversized markers
      summary_height = 16,       # Larger diamonds
      line_width = 2.5,          # Thick lines
      border_radius = 4
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      container_border = FALSE,
      container_border_radius = 6
    ),
    # Large, bold hierarchy for visibility at distance
    group_headers = GroupHeaderStyles(
      level1_font_size = "1.1875rem",   # Large for presentations
      level1_font_weight = 700,
      level1_italic = FALSE,
      level2_font_size = "1.125rem",
      level2_font_weight = 600,
      level2_italic = FALSE,
      level3_font_size = "1.125rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 24           # Wide indent for clarity
    )
  )
}

#' Cochrane systematic review theme
#'
#' Theme designed for Cochrane systematic reviews and meta-analyses.
#' Uses Cochrane teal (#0099CC), Arial font, compact spacing optimized
#' for data density. Clean, utilitarian design with no decorative elements.
#'
#' @return A WebTheme object
#' @export
web_theme_cochrane <- function() {
  WebTheme(
    name = "cochrane",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#2c2c2c",
      primary = "#0099cc",             # Cochrane teal
      secondary = "#555555",
      accent = "#006699",              # Darker teal for accents
      muted = "#888888",
      border = "#b3b3b3",
      row_bg = "#ffffff",
      alt_bg = "#f5f5f5",              # Light grey stripe
      interval = "#0099cc",
      interval_line = "#2c2c2c",
      interval_positive = "#0099cc",
      interval_negative = "#cc3333",
      interval_neutral = "#555555",
      summary_fill = "#0099cc",
      summary_border = "#006699"
    ),
    typography = Typography(
      font_family = "Arial, Helvetica, sans-serif",
      font_size_sm = "0.6875rem",      # 11px - very compact
      font_size_base = "0.75rem",      # 12px
      font_size_lg = "0.8125rem",      # 13px
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.25
    ),
    spacing = Spacing(
      row_height = 20,                 # Compact
      header_height = 26,
      section_gap = 8,
      padding = 6,
      cell_padding_x = 6,
      cell_padding_y = 2
    ),
    shapes = Shapes(
      point_size = 4,                  # Small markers
      summary_height = 7,
      line_width = 1,
      border_radius = 0
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,        # No outer border (Cochrane style)
      container_border_radius = 0
    ),
    # Very compact hierarchy matching dense data layout
    group_headers = GroupHeaderStyles(
      level1_font_size = "0.8125rem",   # Match font_size_lg (13px)
      level1_font_weight = 700,
      level1_italic = FALSE,
      level2_font_size = "0.75rem",     # Match base (12px)
      level2_font_weight = 500,
      level2_italic = FALSE,
      level3_font_size = "0.75rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 10           # Very tight indent
    )
  )
}

#' Nature journal theme
#'
#' Theme following Nature family journal styling guidelines.
#' Uses Nature blue (#1976D2), Helvetica Neue font with tight letter-spacing,
#' and precise, refined aesthetic. Balanced between academic rigor and
#' modern digital readability.
#'
#' @return A WebTheme object
#' @export
web_theme_nature <- function() {
  WebTheme(
    name = "nature",
    colors = ColorPalette(
      background = "#ffffff",
      foreground = "#1a1a1a",          # Slightly darker for precision
      primary = "#1976d2",             # Nature blue
      secondary = "#424242",
      accent = "#c62828",              # Refined red
      muted = "#616161",
      border = "#bdbdbd",              # Slightly stronger border
      row_bg = "#ffffff",
      alt_bg = "#fafafa",              # Subtle grey stripe
      interval = "#1976d2",
      interval_line = "#1a1a1a",
      interval_positive = "#1976d2",
      interval_negative = "#c62828",
      interval_neutral = "#616161",
      summary_fill = "#1976d2",
      summary_border = "#0d47a1"       # Darker blue border
    ),
    typography = Typography(
      font_family = "'Helvetica Neue', Helvetica, Arial, sans-serif",
      font_size_sm = "0.75rem",
      font_size_base = "0.8125rem",    # Slightly smaller base
      font_size_lg = "0.9375rem",
      font_weight_normal = 400,
      font_weight_medium = 500,
      font_weight_bold = 700,
      line_height = 1.35               # Tighter line height
    ),
    spacing = Spacing(
      row_height = 22,                 # Compact
      header_height = 28,
      section_gap = 12,
      padding = 10,
      cell_padding_x = 10,
      cell_padding_y = 4
    ),
    shapes = Shapes(
      point_size = 5,
      summary_height = 8,
      line_width = 1.25,
      border_radius = 1                # Almost sharp corners
    ),
    layout = LayoutConfig(
      row_border = TRUE,
      row_border_style = "solid",
      container_border = FALSE,
      container_border_radius = 2      # Minimal rounding
    ),
    axis = AxisConfig(
      gridlines = FALSE,               # Clean axis
      null_tick = TRUE
    ),
    # Refined, precise hierarchy matching Nature's clean aesthetic
    group_headers = GroupHeaderStyles(
      level1_font_size = "0.875rem",    # Slightly above base (13px)
      level1_font_weight = 700,
      level1_italic = FALSE,
      level2_font_size = "0.8125rem",   # Match base
      level2_font_weight = 500,
      level2_italic = FALSE,
      level3_font_size = "0.8125rem",
      level3_font_weight = 400,
      level3_italic = FALSE,
      indent_per_level = 14           # Clean, precise indent
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
