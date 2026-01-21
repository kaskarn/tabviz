# Column and interaction S7 classes for tabviz

#' ColumnSpec: Specification for a table column
#'
#' @param id Unique identifier for the column
#' @param header Display header text
#' @param field Data field name to display
#' @param type Column type: "text", "numeric", "interval", "bar", "pvalue", "sparkline", "forest", "custom"
#' @param width Column width in pixels (NA for auto)
#' @param align Text alignment for body cells: "left", "center", "right"
#' @param header_align Text alignment for header: "left" (default), "center", "right"
#' @param wrap Enable text wrapping (default FALSE). When TRUE, long text wraps instead of being truncated.
#' @param sortable Whether the column is sortable
#' @param options Named list of type-specific options
#' @param style_bold Column name containing logical values for per-cell bold styling
#' @param style_italic Column name containing logical values for per-cell italic styling
#' @param style_color Column name containing CSS color strings for per-cell text color
#' @param style_bg Column name containing CSS color strings for per-cell background color
#' @param style_badge Column name containing text for per-cell badges
#' @param style_icon Column name containing emoji/unicode for per-cell icons
#' @param style_emphasis Column name containing logical values for per-cell emphasis (bold + foreground)
#' @param style_muted Column name containing logical values for per-cell muted styling
#' @param style_accent Column name containing logical values for per-cell accent styling
#'
#' @export
ColumnSpec <- new_class(
  "ColumnSpec",
  properties = list(
    id = class_character,
    header = class_character,
    field = class_character,
    type = new_property(class_character, default = "text"),
    width = new_property(class_any, default = NA_real_),  # numeric or "auto"
    align = new_property(class_character, default = "left"),
    header_align = new_property(class_character, default = "left"),
    wrap = new_property(class_logical, default = FALSE),  # Enable text wrapping
    sortable = new_property(class_logical, default = TRUE),
    options = new_property(class_list, default = list()),
    # Per-cell style mappings: column names (character) or formulas (~)
    # Formulas are resolved in web_spec() when data is available
    style_bold = new_property(class_any, default = NULL),
    style_italic = new_property(class_any, default = NULL),
    style_color = new_property(class_any, default = NULL),
    style_bg = new_property(class_any, default = NULL),
    style_badge = new_property(class_any, default = NULL),
    style_icon = new_property(class_any, default = NULL),
    # Semantic styling (same as row-level)
    style_emphasis = new_property(class_any, default = NULL),
    style_muted = new_property(class_any, default = NULL),
    style_accent = new_property(class_any, default = NULL)
  ),
  validator = function(self) {
    valid_types <- c("text", "numeric", "interval", "bar", "pvalue", "sparkline",
                     "icon", "badge", "stars", "img", "reference", "range", "forest",
                     "viz_bar", "viz_boxplot", "viz_violin", "custom")
    if (!self@type %in% valid_types) {
      return(paste("type must be one of:", paste(valid_types, collapse = ", ")))
    }

    # Validate width: must be NA, numeric, or "auto"
    if (!is.na(self@width) && !is.numeric(self@width) && !identical(self@width, "auto")) {
      return("width must be numeric or \"auto\"")
    }

    valid_aligns <- c("left", "center", "right")
    if (!self@align %in% valid_aligns) {
      return(paste("align must be one of:", paste(valid_aligns, collapse = ", ")))
    }

    # Validate header_align if provided (not NA)
    if (!is.na(self@header_align) && !self@header_align %in% valid_aligns) {
      return(paste("header_align must be one of:", paste(valid_aligns, collapse = ", ")))
    }

    NULL
  }
)

#' Create a column specification
#'
#' @param field Data field name to display
#' @param header Display header (defaults to field name)
#' @param type Column type
#' @param width Column width in pixels, or "auto" for content-based width
#' @param align Text alignment for body cells
#' @param header_align Text alignment for header (default: "left")
#' @param wrap Enable text wrapping (default FALSE). When TRUE, long text wraps
#'   instead of being truncated with ellipsis.
#' @param sortable Whether sortable
#' @param options Named list of type-specific options
#' @param na_text Text to display for NA/missing values (default "" for empty)
#' @param bold Column name containing logical values for per-cell bold styling
#' @param italic Column name containing logical values for per-cell italic styling
#' @param color Column name containing CSS color strings for per-cell text color
#' @param bg Column name containing CSS color strings for per-cell background color
#' @param badge Column name containing text for per-cell badges
#' @param icon Column name containing emoji/unicode for per-cell icons
#' @param emphasis Column name containing logical values for emphasis styling (bold + foreground)
#' @param muted Column name containing logical values for muted styling
#' @param accent Column name containing logical values for accent styling
#'
#' @return A ColumnSpec object
#' @export
web_col <- function(
    field,
    header = NULL,
    type = c("text", "numeric", "interval", "bar", "pvalue", "sparkline",
             "icon", "badge", "stars", "img", "reference", "range", "forest",
             "viz_bar", "viz_boxplot", "viz_violin", "custom"),
    width = NULL,
    align = NULL,
    header_align = NULL,
    wrap = FALSE,
    sortable = TRUE,
    options = list(),
    na_text = NULL,
    bold = NULL,
    italic = NULL,
    color = NULL,
    bg = NULL,
    badge = NULL,
    icon = NULL,
    emphasis = NULL,
    muted = NULL,
    accent = NULL) {
  type <- match.arg(type)

  # Default header to field name
  header <- header %||% field

  # Default alignment is left
  if (is.null(align)) {
    align <- "left"
  }

  # Handle width: NULL → "auto", "auto" → "auto", numeric → numeric
  width_val <- if (is.null(width)) {
    "auto"
  } else if (identical(width, "auto")) {
    "auto"
  } else {
    as.numeric(width)
  }

  # Add na_text to options if specified
  if (!is.null(na_text)) {
    options$naText <- na_text
  }

  ColumnSpec(
    id = field,
    header = header,
    field = field,
    type = type,
    width = width_val,
    align = align,
    header_align = header_align %||% "left",
    wrap = wrap,
    sortable = sortable,
    options = options,
    # Style properties: can be column name (character) or formula (~)
    # Resolved in web_spec() when data is available
    style_bold = bold,
    style_italic = italic,
    style_color = color,
    style_bg = bg,
    style_badge = badge,
    style_icon = icon,
    style_emphasis = emphasis,
    style_muted = muted,
    style_accent = accent
  )
}

# ============================================================================
# Column helper functions
# ============================================================================

#' Column helper: Text column
#'
#' @param field Field name
#' @param header Column header
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
col_text <- function(field, header = NULL, width = NULL, ...) {
  web_col(field, header, type = "text", width = width, ...)
}

#' Column helper: Numeric column
#'
#' @param field Field name
#' @param header Column header
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places to display (default 2). Cannot be used with `digits`.
#' @param digits Number of significant figures. Cannot be used with `decimals`.
#' @param thousands_sep Thousands separator (default FALSE for decimal columns,
#'   use "," or other string to enable)
#' @param abbreviate Logical. When TRUE, values >= 1000 are shortened with at most
#'   1 decimal place (e.g., 1100 -> "1.1K", 2500000 -> "2.5M", 11111111 -> "11.1M").
#'   Values >= 1 trillion will cause an error. Default FALSE.
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default 2 decimal places
#' col_numeric("estimate")
#'
#' # Show 3 decimal places
#' col_numeric("pct", decimals = 3)
#'
#' # Integer display (no decimals) with thousands separator
#' col_numeric("count", decimals = 0, thousands_sep = ",")
#'
#' # Significant figures instead of decimals
#' col_numeric("value", digits = 3)
#'
#' # Abbreviate large numbers: 1,234,567 -> "1.2M"
#' col_numeric("population", abbreviate = TRUE)
col_numeric <- function(field, header = NULL, width = NULL, decimals = 2,
                        digits = NULL, thousands_sep = FALSE, abbreviate = FALSE,
                        ...) {
  # Validate mutual exclusivity of decimals and digits
  if (!is.null(digits) && decimals != 2) {
    cli_abort("Cannot specify both {.arg decimals} and {.arg digits}. Use one or the other.")
  }

  opts <- list(
    numeric = list(
      decimals = if (is.null(digits)) decimals else NULL,
      digits = digits,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate
    )
  )
  web_col(field, header, type = "numeric", width = width, options = opts, ...)
}

#' Column helper: Sample size / count
#'
#' Display integer counts with thousands separator for readability.
#'
#' @param field Field name (default "n")
#' @param header Column header (default "N")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 0 for integers). Cannot be used with `digits`.
#' @param digits Number of significant figures. Cannot be used with `decimals`.
#' @param thousands_sep Thousands separator (default "," for integer columns)
#' @param abbreviate Logical. When TRUE, values >= 1000 are shortened with at most
#'   1 decimal place (e.g., 1100 -> "1.1K", 12345 -> "12.3K"). Default FALSE.
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default: shows "12,345" for large numbers
#' col_n("n")
#'
#' # Disable thousands separator
#' col_n("n", thousands_sep = FALSE)
#'
#' # Abbreviate large sample sizes: 12,345 -> "12.3K"
#' col_n("n", abbreviate = TRUE)
col_n <- function(field = "n", header = "N", width = NULL, decimals = 0,
                  digits = NULL, thousands_sep = ",", abbreviate = FALSE, ...) {
  # Validate mutual exclusivity of decimals and digits
  if (!is.null(digits) && decimals != 0) {
    cli_abort("Cannot specify both {.arg decimals} and {.arg digits}. Use one or the other.")
  }

  opts <- list(
    numeric = list(
      decimals = if (is.null(digits)) decimals else NULL,
      digits = digits,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate
    )
  )
  web_col(field, header, type = "numeric", width = width, options = opts, ...)
}

#' Column helper: Interval display (e.g., "1.2 (0.9, 1.5)")
#'
#' Display point estimates with confidence intervals as formatted text.
#' The `point`, `lower`, and `upper` arguments specify which data columns
#' contain the values to display.
#'
#' @param point Field name for the point estimate column (NULL to auto-detect from forest)
#' @param lower Field name for the lower bound column (NULL to auto-detect from forest)
#' @param upper Field name for the upper bound column (NULL to auto-detect from forest)
#' @param header Column header (default "95% CI")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 2)
#' @param sep Separator between point and CI (default " ")
#' @param imprecise_threshold When upper/lower ratio exceeds this threshold,
#'   the interval is considered imprecise and displayed as "—" instead.
#'   Default is NULL (no threshold).
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Specify the data columns for point and interval bounds
#' col_interval("hr", "lower", "upper")
#'
#' # With custom header
#' col_interval("hr", "lower", "upper", "HR (95% CI)")
#'
#' # Custom decimals and separator
#' col_interval("hr", "lower", "upper", "HR (95% CI)", decimals = 3, sep = ", ")
#'
#' # Just customize header (auto-detect columns from forest plot)
#' col_interval(header = "95% CI")
#'
#' # Hide imprecise estimates (CI ratio > 10)
#' col_interval("hr", "lower", "upper", imprecise_threshold = 10)
col_interval <- function(point = NULL, lower = NULL, upper = NULL,
                         header = "95% CI", width = NULL, decimals = 2, sep = " ",
                         imprecise_threshold = NULL, ...) {
  opts <- list(
    interval = list(
      decimals = decimals,
      sep = sep,
      point = point,
      lower = lower,
      upper = upper,
      impreciseThreshold = imprecise_threshold
    )
  )
  # Create unique synthetic field name when overrides are specified
  # This allows multiple col_interval columns with different field sources
  if (!is.null(point)) {
    synthetic_field <- paste0("_interval_", point)
  } else {
    synthetic_field <- "_interval"
  }
  web_col(synthetic_field, header, type = "interval", width = width, options = opts, ...)
}

#' Column helper: P-value
#'
#' Display p-values with optional significance stars and smart formatting.
#' Very small values are displayed using Unicode superscript notation
#' (e.g., 1.2\enc{×}{x}10\enc{⁻⁵}{^-5}) for improved readability.
#'
#' @param field Field name (default "pvalue")
#' @param header Column header (default "P-value")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param stars Show significance stars (default FALSE)
#' @param thresholds Numeric vector of 3 significance thresholds (default c(0.05, 0.01, 0.001))
#' @param format P-value format: "auto", "scientific", or "decimal"
#' @param digits Number of significant figures to display (default 2)
#' @param exp_threshold Values below this use exponential notation (default 0.001)
#' @param abbrev_threshold Values below this display as "<threshold" (default NULL = off).
#'   For example, `abbrev_threshold = 0.0001` displays values below 0.0001 as "<0.0001".
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#'
#' @examples
#' # Default: 2 significant figures, exponential below 0.001
#' col_pvalue("pval")
#'
#' # Show 3 significant figures
#' col_pvalue("pval", digits = 3)
#'
#' # Use exponential notation below 0.01
#' col_pvalue("pval", exp_threshold = 0.01)
#'
#' # With significance stars
#' col_pvalue("pval", stars = TRUE)
#'
#' # Abbreviate very small values
#' col_pvalue("pval", abbrev_threshold = 0.0001)
col_pvalue <- function(
    field = "pvalue",
    header = "P-value",
    width = NULL,
    stars = FALSE,
    thresholds = c(0.05, 0.01, 0.001),
    format = c("auto", "scientific", "decimal"),
    digits = 2,
    exp_threshold = 0.001,
    abbrev_threshold = NULL,
    ...) {
  format <- match.arg(format)
  opts <- list(
    pvalue = list(
      stars = stars,
      thresholds = thresholds,
      format = format,
      digits = digits,
      expThreshold = exp_threshold,
      abbrevThreshold = abbrev_threshold
    )
  )
  web_col(field, header, type = "pvalue", width = width, options = opts, ...)
}

#' Column helper: Bar/weight column
#'
#' @param field Field name (default "weight")
#' @param header Column header (default "Weight")
#' @param width Column width in pixels (NULL for auto-sizing)
#' @param max_value Maximum value for the bar (NULL = auto-compute from data)
#' @param show_label Show numeric label next to bar (default TRUE)
#' @param color Bar fill color (NULL = theme primary color)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
col_bar <- function(
    field = "weight",
    header = "Weight",
    width = NULL,
    max_value = NULL,
    show_label = TRUE,
    color = NULL,
    ...) {
  opts <- list(
    bar = list(
      maxValue = max_value,
      showLabel = show_label,
      color = color
    )
  )
  web_col(field, header, type = "bar", width = width, options = opts, ...)
}

#' Column helper: Sparkline chart
#'
#' @param field Field name containing numeric vector for sparkline
#' @param header Column header (default "Trend")
#' @param width Column width in pixels (NULL for auto-sizing)
#' @param type Chart type: "line", "bar", or "area"
#' @param height Chart height in pixels (default 20)
#' @param color Chart color (NULL = theme primary color)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
col_sparkline <- function(
    field = "trend",
    header = "Trend",
    width = NULL,
    type = c("line", "bar", "area"),
    height = 20,
    color = NULL,
    ...) {
  type <- match.arg(type)
  opts <- list(
    sparkline = list(
      type = type,
      height = height,
      color = color
    )
  )
  web_col(field, header, type = "sparkline", width = width, options = opts, ...)
}

#' Column helper: Percentage column
#'
#' Display numeric values as percentages with optional % symbol.
#' By default, expects proportions (0-1 scale) and multiplies by 100.
#'
#' @param field Field name
#' @param header Column header (default field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 1). Cannot be used with `digits`.
#' @param digits Number of significant figures (takes precedence over decimals if set).
#'   Cannot be used with `decimals`.
#' @param multiply Whether to multiply by 100 (default TRUE, expects proportions 0-1).
#'   Set to FALSE if data is already on 0-100 scale.
#' @param symbol Show % symbol (default TRUE)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Data with proportions (0-1), default behavior
#' col_percent("rate", "Rate")  # 0.05 -> "5.0%"
#'
#' # Data already as percentages (0-100)
#' col_percent("accuracy", "Accuracy", multiply = FALSE)
#'
#' # No % symbol
#' col_percent("pct", symbol = FALSE)
#'
#' # Using significant figures
#' col_percent("rate", digits = 2)
col_percent <- function(
    field,
    header = NULL,
    width = NULL,
    decimals = 1,
    digits = NULL,
    multiply = TRUE,
    symbol = TRUE,
    ...) {
  # Validate mutual exclusivity of decimals and digits
  if (!is.null(digits) && decimals != 1) {
    cli_abort("Cannot specify both {.arg decimals} and {.arg digits}. Use one or the other.")
  }

  opts <- list(
    percent = list(
      decimals = if (is.null(digits)) decimals else NULL,
      digits = digits,
      multiply = multiply,
      symbol = symbol
    )
  )
  web_col(field, header, type = "numeric", width = width, options = opts, ...)
}

#' Column helper: Events column
#'
#' Display event counts in "events/n" format for clinical trial data.
#' Large numbers are formatted with thousands separators for readability.
#'
#' @param events_field Field name containing number of events
#' @param n_field Field name containing total sample size
#' @param header Column header (default "Events")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param separator Separator between events and n (default "/")
#' @param show_pct Show percentage in parentheses (default FALSE)
#' @param thousands_sep Thousands separator (default ",")
#' @param abbreviate Logical. When TRUE, values >= 1000 are shortened with at most
#'   1 decimal place (e.g., "1.1K/12K" instead of "1,100/12,000"). Default FALSE.
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple events/n display: "45/120"
#' col_events("events", "n")
#'
#' # With percentage: "45/120 (37.5%)"
#' col_events("events", "n", show_pct = TRUE)
#'
#' # Different separator: "45 of 120"
#' col_events("events", "n", separator = " of ")
#'
#' # Abbreviate large numbers: "1.1K/12K"
#' col_events("events", "n", abbreviate = TRUE)
col_events <- function(
    events_field,
    n_field,
    header = "Events",
    width = NULL,
    separator = "/",
    show_pct = FALSE,
    thousands_sep = ",",
    abbreviate = FALSE,
    ...) {
  opts <- list(
    events = list(
      eventsField = events_field,
      nField = n_field,
      separator = separator,
      showPct = show_pct,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate
    )
  )
  # Use a synthetic field that signals this is an events column
  synthetic_field <- paste0("_events_", events_field, "_", n_field)
  web_col(synthetic_field, header, type = "custom", width = width, options = opts, ...)
}

# ============================================================================
# New Column Helpers
# ============================================================================

#' Column helper: Icon/emoji display
#'
#' Display icons or emoji based on data values. Values can be mapped to
#' specific icons using the `mapping` parameter.
#'
#' @param field Field name containing the values to display
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param mapping Named character vector mapping values to icons/emoji
#'   (e.g., `c("yes" = "Y", "no" = "N")` or use actual emoji/unicode)
#' @param size Icon size: "sm", "base", or "lg" (default "base")
#' @param color Optional CSS color for the icon (default NULL, uses theme)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple emoji column (values are emoji)
#' col_icon("status_icon")
#'
#' # Map values to icons
#' col_icon("result", mapping = c("pass" = "Y", "fail" = "N", "pending" = "?"))
#'
#' # With color
#' col_icon("status", color = "#16a34a")
#'
#' # With per-cell styling
#' col_icon("status", emphasis = "is_important")
col_icon <- function(
    field,
    header = NULL,
    width = NULL,
    mapping = NULL,
    size = c("base", "sm", "lg"),
    color = NULL,
    ...) {
  size <- match.arg(size)
  opts <- list(
    icon = list(
      mapping = as.list(mapping),
      size = size,
      color = color
    )
  )
  web_col(field, header, type = "icon", width = width, align = "center",
          options = opts, ...)
}

#' Column helper: Status badges
#'
#' Display colored status badges (pills) based on data values.
#'
#' @param field Field name containing the badge text
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param variants Named character vector mapping values to semantic variants:
#'   "default", "success", "warning", "error", "info", "muted"
#'   (e.g., `c("published" = "success", "draft" = "warning")`)
#' @param colors Named character vector mapping values to custom hex colors,
#'   which override variants (e.g., `c("special" = "#ff5500")`)
#' @param size Badge size: "sm" or "base" (default "base")
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple badge (shows value as badge text)
#' col_badge("status")
#'
#' # With semantic variants
#' col_badge("status", variants = c(
#'   "published" = "success",
#'   "draft" = "warning",
#'   "rejected" = "error"
#' ))
#'
#' # With custom colors
#' col_badge("priority", colors = c(
#'   "high" = "#dc2626",
#'   "medium" = "#f59e0b",
#'   "low" = "#22c55e"
#' ))
#'
#' # With per-cell styling
#' col_badge("status", emphasis = "is_key")
col_badge <- function(
    field,
    header = NULL,
    width = NULL,
    variants = NULL,
    colors = NULL,
    size = c("base", "sm"),
    ...) {
  size <- match.arg(size)
  opts <- list(
    badge = list(
      variants = as.list(variants),
      colors = as.list(colors),
      size = size
    )
  )
  web_col(field, header, type = "badge", width = width, align = "center",
          options = opts, ...)
}

#' Column helper: Star rating
#'
#' Display star ratings using Unicode stars (\enc{★}{*} filled, \enc{☆}{o} empty).
#'
#' @param field Field name containing numeric rating (1-5 or custom range)
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param max_stars Maximum number of stars (default 5)
#' @param color CSS color for filled stars (default "#f59e0b", amber)
#' @param empty_color CSS color for empty stars (default "#d1d5db", gray)
#' @param half_stars Allow half-star increments (default FALSE)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default 5-star rating
#' col_stars("rating")
#'
#' # Custom colors
#' col_stars("quality", color = "#ef4444", empty_color = "#fee2e2")
#'
#' # Half-star increments
#' col_stars("score", half_stars = TRUE)
#'
#' # With per-cell styling
#' col_stars("rating", emphasis = "is_featured")
col_stars <- function(
    field,
    header = NULL,
    width = NULL,
    max_stars = 5,
    color = "#f59e0b",
    empty_color = "#d1d5db",
    half_stars = FALSE,
    ...) {
  opts <- list(
    stars = list(
      maxStars = max_stars,
      color = color,
      emptyColor = empty_color,
      halfStars = half_stars
    )
  )
  web_col(field, header, type = "stars", width = width, align = "center",
          options = opts, ...)
}

#' Column helper: Image display
#'
#' Display inline images from URLs.
#'
#' @param field Field name containing image URLs
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param height Image height in pixels (default NULL, uses row height - 4)
#' @param max_width Maximum image width (default NULL, uses column width)
#' @param fallback Fallback text or icon if image fails to load (default "📷")
#' @param shape Image shape: "square", "circle", or "rounded" (default "square")
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple image column
#' col_img("logo_url", "Logo")
#'
#' # Circular avatars
#' col_img("avatar_url", "Avatar", shape = "circle", width = 40)
#'
#' # With fallback
#' col_img("thumbnail", fallback = "No image")
#'
#' # With per-cell styling
#' col_img("logo_url", emphasis = "is_featured")
col_img <- function(
    field,
    header = NULL,
    width = NULL,
    height = NULL,
    max_width = NULL,
    fallback = "\U0001F4F7",
    shape = c("square", "circle", "rounded"),
    ...) {
  shape <- match.arg(shape)
  opts <- list(
    img = list(
      height = height,
      maxWidth = max_width,
      fallback = fallback,
      shape = shape
    )
  )
  web_col(field, header, type = "img", width = width, align = "center",
          options = opts, ...)
}

#' Column helper: Reference/citation display
#'
#' Display truncated text with optional link and full text in tooltip.
#'
#' @param field Field name containing the reference text
#' @param header Column header (default "Reference")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param href_field Optional field name containing URLs for linking
#' @param max_chars Maximum characters to display before truncating (default 30)
#' @param icon Show external link icon when href_field is provided (default TRUE)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple truncated text
#' col_reference("citation")
#'
#' # With clickable links
#' col_reference("title", href_field = "doi_url", max_chars = 40)
#'
#' # Without link icon
#' col_reference("source", href_field = "url", icon = FALSE)
#'
#' # With per-cell styling
#' col_reference("citation", emphasis = "is_key")
col_reference <- function(
    field,
    header = "Reference",
    width = NULL,
    href_field = NULL,
    max_chars = 30,
    icon = TRUE,
    ...) {
  opts <- list(
    reference = list(
      hrefField = href_field,
      maxChars = max_chars,
      showIcon = icon
    )
  )
  web_col(field, header, type = "reference", width = width, options = opts, ...)
}

#' Column helper: Range display
#'
#' Display min-max ranges like "18-65" or "2.5 - 10.0".
#'
#' @param min_field Field name containing minimum values
#' @param max_field Field name containing maximum values
#' @param header Column header (default "Range")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param separator Separator between min and max (default " - ")
#' @param decimals Number of decimal places (default NULL for auto-detection)
#' @param show_bar Show visual bar representation (default FALSE)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple range: "18 - 65"
#' col_range("age_min", "age_max", "Age Range")
#'
#' # Custom separator: "18–65"
#' col_range("min", "max", separator = "–")
#'
#' # With decimals: "1.5 - 3.2"
#' col_range("ci_lower", "ci_upper", decimals = 1)
#'
#' # With per-cell styling
#' col_range("age_min", "age_max", emphasis = "is_key")
col_range <- function(
    min_field,
    max_field,
    header = "Range",
    width = NULL,
    separator = " - ",
    decimals = NULL,
    show_bar = FALSE,
    ...) {
  opts <- list(
    range = list(
      minField = min_field,
      maxField = max_field,
      separator = separator,
      decimals = decimals,
      showBar = show_bar
    )
  )
  # Use a synthetic field that signals this is a range column
  synthetic_field <- paste0("_range_", min_field, "_", max_field)
  web_col(synthetic_field, header, type = "range", width = width,
          align = "right", options = opts, ...)
}

# ============================================================================
# Forest Plot Column
# ============================================================================

#' Visualization column: Forest plot
#'
#' Renders a forest plot (point estimates with confidence intervals) as a
#' table column. This allows explicit positioning of the forest plot within
#' the column layout and supports multiple forest columns per table.
#'
#' Each `viz_forest()` fully owns its effect definitions - no global effects
#' list is needed. Use either inline column references (point/lower/upper) for
#' a single effect, or a list of `web_effect()` objects for multiple effects.
#'
#' @param header Column header (default NULL, typically no header for plot)
#' @param width Column width in pixels (NULL for auto-sizing based on available space)
#' @param point Column name for point estimate. Use for single-effect plots.
#' @param lower Column name for lower bound. Use for single-effect plots.
#' @param upper Column name for upper bound. Use for single-effect plots.
#' @param effects List of `web_effect()` objects for multi-effect display
#'   (multiple markers overlaid in same column). Cannot be used with point/lower/upper.
#' @param scale Scale type: "linear" (default) or "log"
#' @param null_value Reference line value. Default is 0 for linear scale, 1 for log scale.
#' @param axis_label Label for the x-axis (default "Effect")
#' @param axis_range Numeric vector of length 2 specifying fixed axis limits c(min, max).
#'   If NULL (default), axis range is computed automatically from data.
#' @param axis_ticks Numeric vector specifying tick mark positions. If NULL (default),
#'   ticks are computed automatically.
#' @param axis_gridlines Logical; if TRUE, display vertical gridlines at tick positions
#'   (default FALSE).
#' @param show_axis Show the x-axis (default TRUE)
#' @param annotations List of annotation objects (e.g., `forest_refline()`) for this column.
#' @param shared_axis When used in a split forest, whether this column should use a shared
#'   axis range across all splits. `NULL` (default) inherits from split-level setting,
#'   `TRUE`/`FALSE` overrides.
#' @param ... Additional arguments passed to `web_col()` (e.g., `sortable`)
#'
#' @return A ColumnSpec object with type = "forest"
#' @export
#'
#' @examples
#' # Single forest column with inline effect definition
#' viz_forest(point = "estimate", lower = "ci_lower", upper = "ci_upper")
#'
#' # Log scale with custom null line
#' viz_forest(point = "hr", lower = "hr_lo", upper = "hr_hi",
#'            scale = "log", null_value = 1, axis_label = "Hazard Ratio")
#'
#' # Multiple effects overlaid in one column
#' viz_forest(
#'   effects = list(
#'     web_effect("itt_or", "itt_lo", "itt_hi", label = "ITT", color = "#2563eb"),
#'     web_effect("pp_or", "pp_lo", "pp_hi", label = "Per-Protocol", color = "#16a34a")
#'   ),
#'   scale = "log",
#'   null_value = 1,
#'   axis_label = "Odds Ratio (95% CI)"
#' )
viz_forest <- function(
    header = NULL,
    width = NULL,
    point = NULL,
    lower = NULL,
    upper = NULL,
    effects = NULL,
    scale = c("linear", "log"),
    null_value = NULL,
    axis_label = "Effect",
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    show_axis = TRUE,
    annotations = NULL,
    shared_axis = NULL,
    ...) {

  scale <- match.arg(scale)

  # Validate: must have either (point, lower, upper) OR effects list, not both

  has_inline <- !is.null(point) && !is.null(lower) && !is.null(upper)
  has_effects <- !is.null(effects) && length(effects) > 0

  if (has_inline && has_effects) {
    cli_abort(c(
      "Cannot specify both inline columns and effects list",
      "i" = "Use {.arg point}/{.arg lower}/{.arg upper} for a single effect,",
      "i" = "or {.arg effects} for multiple overlaid effects (not both)."
    ))
  }

  if (!has_inline && !has_effects) {
    cli_abort(c(
      "Forest column requires effect specification",
      "i" = "Provide either {.arg point}/{.arg lower}/{.arg upper} columns,",
      "i" = "or {.arg effects} = list(web_effect(...), ...) for multiple effects."
    ))
  }

  # Validate effects list contains EffectSpec objects
  if (has_effects) {
    for (i in seq_along(effects)) {
      if (!S7_inherits(effects[[i]], EffectSpec)) {
        cli_abort(c(
          "{.arg effects} must be a list of {.fn web_effect} objects",
          "i" = "Element {i} is not an EffectSpec"
        ))
      }
    }
  }

  # Default null_value based on scale
  if (is.null(null_value)) {
    null_value <- if (scale == "log") 1 else 0
  }

  # Serialize effects inline in the forest options
  serialized_effects <- NULL
  if (has_effects) {
    serialized_effects <- lapply(effects, function(e) {
      list(
        id = e@id,
        pointCol = e@point_col,
        lowerCol = e@lower_col,
        upperCol = e@upper_col,
        label = if (is.na(e@label)) NULL else e@label,
        color = if (is.na(e@color)) NULL else e@color,
        shape = if (is.na(e@shape)) NULL else e@shape,
        opacity = if (is.na(e@opacity)) NULL else e@opacity
      )
    })
  }

  # Serialize annotations if provided
  serialized_annotations <- NULL
  if (!is.null(annotations) && length(annotations) > 0) {
    serialized_annotations <- lapply(annotations, serialize_annotation)
  }

  # Build forest options, only including width when explicitly set
  # (NULL width would become JSON null, which JavaScript's ?? operator won't replace)
  forest_opts <- list(
    point = point,
    lower = lower,
    upper = upper,
    effects = serialized_effects,
    scale = scale,
    nullValue = null_value,
    axisLabel = axis_label,
    axisRange = axis_range,
    axisTicks = axis_ticks,
    axisGridlines = axis_gridlines,
    showAxis = show_axis,
    annotations = serialized_annotations,
    sharedAxis = shared_axis
  )
  if (!is.null(width)) {
    forest_opts$width <- as.numeric(width)
  }

  opts <- list(forest = forest_opts)

  # Use a synthetic field for the forest column
  synthetic_field <- if (has_effects) {
    # Use first effect's point column for field name
    paste0("_forest_", effects[[1]]@point_col)
  } else {
    paste0("_forest_", point)
  }

  # Default header to empty string (forest plots typically don't have text headers)
  resolved_header <- if (is.null(header)) "" else header

  web_col(
    synthetic_field,
    header = resolved_header,
    type = "forest",
    width = width,
    sortable = FALSE,  # Forest columns are not sortable by default
    options = opts,
    ...
  )
}

#' Column helper: Forest plot column (deprecated)
#'
#' @description
#' `r lifecycle::badge("deprecated")`
#'
#' `col_forest()` was renamed to [viz_forest()] to better reflect its role as a
#' focal visualization column with its own axis/scale (as opposed to `col_*`
#' functions which render inline cell content).
#'
#' @inheritParams viz_forest
#' @export
#' @keywords internal
col_forest <- function(
    header = NULL,
    width = NULL,
    point = NULL,
    lower = NULL,
    upper = NULL,
    effects = NULL,
    scale = c("linear", "log"),
    null_value = NULL,
    axis_label = "Effect",
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    show_axis = TRUE,
    annotations = NULL,
    shared_axis = NULL,
    ...) {
  lifecycle::deprecate_warn(
    "0.2.0",
    "col_forest()",
    "viz_forest()",
    id = "col_forest"
  )
  viz_forest(
    header = header,
    width = width,
    point = point,
    lower = lower,
    upper = upper,
    effects = effects,
    scale = scale,
    null_value = null_value,
    axis_label = axis_label,
    axis_range = axis_range,
    axis_ticks = axis_ticks,
    axis_gridlines = axis_gridlines,
    show_axis = show_axis,
    annotations = annotations,
    shared_axis = shared_axis,
    ...
  )
}

# ============================================================================
# Column Groups (hierarchical headers)
# ============================================================================

#' ColumnGroup: A group of columns with a shared header
#'
#' Used for creating hierarchical column headers.
#'
#' @param id Unique identifier for the group
#' @param header Display header text for the group
#' @param columns List of ColumnSpec objects in this group
#'
#' @export
ColumnGroup <- new_class(
  "ColumnGroup",
  properties = list(
    id = class_character,
    header = class_character,
    columns = new_property(class_list, default = list())
  )
)

#' Create a column group
#'
#' Groups multiple columns under a shared header for hierarchical display.
#'
#' @param header Display header for the group
#' @param ... Column specifications (ColumnSpec objects)
#'
#' @return A ColumnGroup object
#' @export
col_group <- function(header, ...) {
  columns <- list(...)

  # Validate all children are ColumnSpec
  for (i in seq_along(columns)) {
    if (!S7_inherits(columns[[i]], ColumnSpec)) {
      cli_abort("All arguments to col_group must be ColumnSpec objects (use col_* helpers)")
    }
  }

  ColumnGroup(
    id = paste0("group_", gsub("[^a-zA-Z0-9]", "_", tolower(header))),
    header = header,
    columns = columns
  )
}

# ============================================================================
# Interaction specification
# ============================================================================

#' InteractionSpec: Interaction settings
#'
#' @param show_filters Show filter panel
#' @param show_legend Show legend
#' @param enable_sort Enable column sorting
#' @param enable_collapse Enable group collapsing
#' @param enable_select Enable row selection
#' @param enable_hover Enable hover effects
#' @param enable_resize Enable column resizing
#' @param enable_export Enable download/export button
#' @param tooltip_fields Character vector of column names to show in hover tooltip (NULL = no tooltip)
#' @param enable_themes Control theme selection menu:
#'   - `"default"` (default): Enable theme menu with all `package_themes()`
#'   - `NULL`: Disable theme selection entirely
#'   - A list of WebTheme objects: Enable with specified themes only
#'
#' @export
InteractionSpec <- new_class(
  "InteractionSpec",
  properties = list(
    show_filters = new_property(class_logical, default = FALSE),
    show_legend = new_property(class_logical, default = TRUE),
    enable_sort = new_property(class_logical, default = TRUE),
    enable_collapse = new_property(class_logical, default = TRUE),
    enable_select = new_property(class_logical, default = TRUE),
    enable_hover = new_property(class_logical, default = TRUE),
    enable_resize = new_property(class_logical, default = TRUE),
    enable_export = new_property(class_logical, default = TRUE),
    tooltip_fields = new_property(class_any, default = NULL),
    enable_themes = new_property(class_any, default = "default")  # NULL, "default", or list of themes
  ),
  validator = function(self) {
    val <- self@enable_themes
    # Valid values: NULL, "default", or a list of WebTheme objects
    if (is.null(val)) return(NULL)
    if (is.character(val) && length(val) == 1 && val == "default") return(NULL)
    if (is.list(val)) {
      # Check that all elements are WebTheme objects
      invalid_idx <- which(!vapply(val, function(x) S7::S7_inherits(x, WebTheme), logical(1)))
      if (length(invalid_idx) > 0) {
        return(paste("enable_themes list must contain only WebTheme objects, invalid at indices:",
                     paste(invalid_idx, collapse = ", ")))
      }
      return(NULL)
    }
    return("enable_themes must be NULL, 'default', or a list of WebTheme objects")
  }
)

#' Create interaction specification
#'
#' @param show_filters Show filter panel
#' @param show_legend Show legend
#' @param enable_sort Enable column sorting
#' @param enable_collapse Enable group collapsing
#' @param enable_select Enable row selection
#' @param enable_hover Enable hover effects
#' @param enable_resize Enable column resizing
#' @param enable_export Enable download/export button
#' @param tooltip_fields Character vector of column names to show in hover tooltip (NULL = no tooltip)
#' @param enable_themes Control theme selection menu:
#'   - `"default"` (default): Enable theme menu with all `package_themes()`
#'   - `NULL`: Disable theme selection entirely (hide menu icon)
#'   - A list of WebTheme objects: Enable theme menu with only the specified themes
#'
#' @return An InteractionSpec object
#' @export
web_interaction <- function(
    show_filters = FALSE,
    show_legend = TRUE,
    enable_sort = TRUE,
    enable_collapse = TRUE,
    enable_select = TRUE,
    enable_hover = TRUE,
    enable_resize = TRUE,
    enable_export = TRUE,
    tooltip_fields = NULL,
    enable_themes = "default") {
  InteractionSpec(
    show_filters = show_filters,
    show_legend = show_legend,
    enable_sort = enable_sort,
    enable_collapse = enable_collapse,
    enable_select = enable_select,
    enable_hover = enable_hover,
    enable_resize = enable_resize,
    enable_export = enable_export,
    tooltip_fields = tooltip_fields,
    enable_themes = enable_themes
  )
}

#' @rdname web_interaction
#' @export
web_interaction_minimal <- function() {
  web_interaction(
    show_filters = FALSE,
    show_legend = TRUE,
    enable_sort = FALSE,
    enable_collapse = FALSE,
    enable_select = FALSE,
    enable_hover = TRUE,
    enable_resize = FALSE,
    enable_export = FALSE
  )
}

#' @rdname web_interaction
#' @export
web_interaction_publication <- function() {
  web_interaction(
    show_filters = FALSE,
    show_legend = FALSE,
    enable_sort = FALSE,
    enable_collapse = FALSE,
    enable_select = FALSE,
    enable_hover = FALSE,
    enable_resize = FALSE,
    enable_export = FALSE
  )
}

# ============================================================================
# Viz Column Effect Classes
# ============================================================================

#' VizBarEffect: Specification for a bar effect in viz_bar
#'
#' @param value Column name containing the bar value
#' @param label Display label for this effect in legends
#' @param color Optional color for this bar
#' @param opacity Optional opacity (0-1)
#'
#' @export
VizBarEffect <- new_class(
  "VizBarEffect",
  properties = list(
    value = class_character,
    label = new_property(class_character, default = NA_character_),
    color = new_property(class_character, default = NA_character_),
    opacity = new_property(class_numeric, default = NA_real_)
  ),
  validator = function(self) {
    if (!is.na(self@opacity) && (self@opacity < 0 || self@opacity > 1)) {
      return("opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a bar effect specification
#'
#' Defines a single bar effect for viz_bar columns.
#'
#' @param value Column name containing the bar value
#' @param label Display label (defaults to value column name)
#' @param color Color for this bar (optional)
#' @param opacity Bar opacity from 0 to 1 (optional)
#'
#' @return A VizBarEffect object
#' @export
viz_bar_effect <- function(value, label = NULL, color = NULL, opacity = NULL) {
  VizBarEffect(
    value = value,
    label = label %||% value,
    color = color %||% NA_character_,
    opacity = opacity %||% NA_real_
  )
}

#' VizBoxplotEffect: Specification for a boxplot effect
#'
#' Supports two modes:
#' - Array data: provide `data` column containing numeric arrays
#' - Pre-computed: provide `min`, `q1`, `median`, `q3`, `max` columns
#'
#' @param data Column name containing array data (raw values)
#' @param min Column name for pre-computed minimum
#' @param q1 Column name for pre-computed Q1 (25th percentile)
#' @param median Column name for pre-computed median
#' @param q3 Column name for pre-computed Q3 (75th percentile)
#' @param max Column name for pre-computed maximum
#' @param outliers Column name for outlier array (optional)
#' @param label Display label for this effect
#' @param color Fill color for the box
#' @param fill_opacity Fill opacity (0-1)
#'
#' @export
VizBoxplotEffect <- new_class(
  "VizBoxplotEffect",
  properties = list(
    data = new_property(class_character, default = NA_character_),
    min = new_property(class_character, default = NA_character_),
    q1 = new_property(class_character, default = NA_character_),
    median = new_property(class_character, default = NA_character_),
    q3 = new_property(class_character, default = NA_character_),
    max = new_property(class_character, default = NA_character_),
    outliers = new_property(class_character, default = NA_character_),
    label = new_property(class_character, default = NA_character_),
    color = new_property(class_character, default = NA_character_),
    fill_opacity = new_property(class_numeric, default = 0.7)
  ),
  validator = function(self) {
    # Must have either data OR all five summary stats
    has_data <- !is.na(self@data)
    has_stats <- !is.na(self@min) && !is.na(self@q1) && !is.na(self@median) &&
                 !is.na(self@q3) && !is.na(self@max)

    if (!has_data && !has_stats) {
      return("Must provide either 'data' column or all five summary stats (min, q1, median, q3, max)")
    }

    if (self@fill_opacity < 0 || self@fill_opacity > 1) {
      return("fill_opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a boxplot effect specification
#'
#' Defines a boxplot effect. Use either `data` for raw array data (quartiles
#' computed automatically), or provide pre-computed summary statistics.
#'
#' @param data Column name containing array data (raw values)
#' @param min Column name for pre-computed minimum
#' @param q1 Column name for pre-computed Q1 (25th percentile)
#' @param median Column name for pre-computed median
#' @param q3 Column name for pre-computed Q3 (75th percentile)
#' @param max Column name for pre-computed maximum
#' @param outliers Column name for outlier array (optional)
#' @param label Display label (optional)
#' @param color Fill color for the box (optional)
#' @param fill_opacity Fill opacity from 0 to 1 (default 0.7)
#'
#' @return A VizBoxplotEffect object
#' @export
viz_boxplot_effect <- function(
    data = NULL,
    min = NULL, q1 = NULL, median = NULL, q3 = NULL, max = NULL,
    outliers = NULL,
    label = NULL,
    color = NULL,
    fill_opacity = 0.7) {
  VizBoxplotEffect(
    data = data %||% NA_character_,
    min = min %||% NA_character_,
    q1 = q1 %||% NA_character_,
    median = median %||% NA_character_,
    q3 = q3 %||% NA_character_,
    max = max %||% NA_character_,
    outliers = outliers %||% NA_character_,
    label = label %||% NA_character_,
    color = color %||% NA_character_,
    fill_opacity = fill_opacity
  )
}

#' VizViolinEffect: Specification for a violin effect
#'
#' @param data Column name containing array data (required)
#' @param label Display label for this effect
#' @param color Fill color for the violin
#' @param fill_opacity Fill opacity (0-1)
#'
#' @export
VizViolinEffect <- new_class(
  "VizViolinEffect",
  properties = list(
    data = class_character,
    label = new_property(class_character, default = NA_character_),
    color = new_property(class_character, default = NA_character_),
    fill_opacity = new_property(class_numeric, default = 0.5)
  ),
  validator = function(self) {
    if (self@fill_opacity < 0 || self@fill_opacity > 1) {
      return("fill_opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a violin effect specification
#'
#' Defines a violin effect. Requires array data column for KDE computation.
#'
#' @param data Column name containing array data (required)
#' @param label Display label (optional)
#' @param color Fill color for the violin (optional)
#' @param fill_opacity Fill opacity from 0 to 1 (default 0.5)
#'
#' @return A VizViolinEffect object
#' @export
viz_violin_effect <- function(data, label = NULL, color = NULL, fill_opacity = 0.5) {
  VizViolinEffect(
    data = data,
    label = label %||% NA_character_,
    color = color %||% NA_character_,
    fill_opacity = fill_opacity
  )
}

# ============================================================================
# Viz Column Helper Functions
# ============================================================================

#' Visualization column: Bar chart
#'
#' Renders horizontal bar charts with support for multiple effects (grouped bars).
#' Each row displays one or more bars based on data values.
#'
#' @param ... One or more `viz_bar_effect()` objects defining the bars to display
#' @param header Column header (default "")
#' @param width Column width in pixels (default 150)
#' @param scale Scale type: "linear" (default) or "log"
#' @param axis_range Numeric vector of length 2 specifying axis range c(min, max).
#'   If NULL (default), range is computed automatically from data.
#' @param axis_ticks Numeric vector of explicit tick positions. If NULL (default),
#'   ticks are computed automatically.
#' @param axis_gridlines Show gridlines at tick positions (default FALSE)
#' @param axis_label Label for the x-axis (default "Value")
#' @param show_axis Show the x-axis (default TRUE)
#'
#' @return A ColumnSpec object with type = "viz_bar"
#' @export
#'
#' @examples
#' # Single bar per row
#' viz_bar(viz_bar_effect("value"))
#'
#' # Multiple bars per row (grouped)
#' viz_bar(
#'   viz_bar_effect("baseline", label = "Baseline", color = "#3b82f6"),
#'   viz_bar_effect("followup", label = "Follow-up", color = "#22c55e")
#' )
viz_bar <- function(
    ...,
    header = "",
    width = 150,
    scale = c("linear", "log"),
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    axis_label = "Value",
    show_axis = TRUE) {

  scale <- match.arg(scale)
  effects <- list(...)

  # Validate effects
  if (length(effects) == 0) {
    cli_abort("viz_bar requires at least one viz_bar_effect()")
  }

  for (i in seq_along(effects)) {
    if (!S7_inherits(effects[[i]], VizBarEffect)) {
      cli_abort(c(
        "All arguments to viz_bar must be {.fn viz_bar_effect} objects",
        "i" = "Argument {i} is not a VizBarEffect"
      ))
    }
  }

  # Serialize effects
  serialized_effects <- lapply(effects, function(e) {
    list(
      value = e@value,
      label = if (is.na(e@label)) NULL else e@label,
      color = if (is.na(e@color)) NULL else e@color,
      opacity = if (is.na(e@opacity)) NULL else e@opacity
    )
  })

  opts <- list(
    vizBar = list(
      type = "bar",
      effects = serialized_effects,
      scale = scale,
      axisRange = axis_range,
      axisTicks = axis_ticks,
      axisGridlines = axis_gridlines,
      axisLabel = axis_label,
      showAxis = show_axis
    )
  )

  # Synthetic field name
  synthetic_field <- paste0("_viz_bar_", effects[[1]]@value)

  web_col(
    synthetic_field,
    header = header,
    type = "viz_bar",
    width = width,
    sortable = FALSE,
    options = opts
  )
}

#' Visualization column: Box plot
#'
#' Renders box-and-whisker plots. Supports either raw array data (quartiles
#' computed automatically) or pre-computed summary statistics.
#'
#' @param ... One or more `viz_boxplot_effect()` objects defining the boxplots
#' @param header Column header (default "")
#' @param width Column width in pixels (default 150)
#' @param scale Scale type: "linear" (default) or "log"
#' @param axis_range Numeric vector of length 2 specifying axis range c(min, max).
#'   If NULL (default), range is computed automatically from data.
#' @param axis_ticks Numeric vector of explicit tick positions. If NULL (default),
#'   ticks are computed automatically.
#' @param axis_gridlines Show gridlines at tick positions (default FALSE)
#' @param show_outliers Show outlier points beyond whiskers (default TRUE)
#' @param whisker_type Whisker calculation: "iqr" (1.5*IQR, default) or "minmax"
#' @param axis_label Label for the x-axis (default "Value")
#' @param show_axis Show the x-axis (default TRUE)
#'
#' @return A ColumnSpec object with type = "viz_boxplot"
#' @export
#'
#' @examples
#' # Boxplot from array data (quartiles computed automatically)
#' viz_boxplot(viz_boxplot_effect(data = "values"))
#'
#' # Boxplot from pre-computed statistics
#' viz_boxplot(viz_boxplot_effect(
#'   min = "min_val", q1 = "q1_val", median = "median_val",
#'   q3 = "q3_val", max = "max_val"
#' ))
#'
#' # Multiple boxplots per row
#' viz_boxplot(
#'   viz_boxplot_effect(data = "group_a", label = "Group A", color = "#3b82f6"),
#'   viz_boxplot_effect(data = "group_b", label = "Group B", color = "#22c55e")
#' )
viz_boxplot <- function(
    ...,
    header = "",
    width = 150,
    scale = c("linear", "log"),
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    show_outliers = TRUE,
    whisker_type = c("iqr", "minmax"),
    axis_label = "Value",
    show_axis = TRUE) {

  scale <- match.arg(scale)
  whisker_type <- match.arg(whisker_type)
  effects <- list(...)

  # Validate effects
  if (length(effects) == 0) {
    cli_abort("viz_boxplot requires at least one viz_boxplot_effect()")
  }

  for (i in seq_along(effects)) {
    if (!S7_inherits(effects[[i]], VizBoxplotEffect)) {
      cli_abort(c(
        "All arguments to viz_boxplot must be {.fn viz_boxplot_effect} objects",
        "i" = "Argument {i} is not a VizBoxplotEffect"
      ))
    }
  }

  # Serialize effects
  serialized_effects <- lapply(effects, function(e) {
    list(
      data = if (is.na(e@data)) NULL else e@data,
      min = if (is.na(e@min)) NULL else e@min,
      q1 = if (is.na(e@q1)) NULL else e@q1,
      median = if (is.na(e@median)) NULL else e@median,
      q3 = if (is.na(e@q3)) NULL else e@q3,
      max = if (is.na(e@max)) NULL else e@max,
      outliers = if (is.na(e@outliers)) NULL else e@outliers,
      label = if (is.na(e@label)) NULL else e@label,
      color = if (is.na(e@color)) NULL else e@color,
      fillOpacity = e@fill_opacity
    )
  })

  opts <- list(
    vizBoxplot = list(
      type = "boxplot",
      effects = serialized_effects,
      scale = scale,
      axisRange = axis_range,
      axisTicks = axis_ticks,
      axisGridlines = axis_gridlines,
      showOutliers = show_outliers,
      whiskerType = whisker_type,
      axisLabel = axis_label,
      showAxis = show_axis
    )
  )

  # Synthetic field name
  first_effect <- effects[[1]]
  first_field <- if (!is.na(first_effect@data)) {
    first_effect@data
  } else {
    first_effect@median
  }
  synthetic_field <- paste0("_viz_boxplot_", first_field)

  web_col(
    synthetic_field,
    header = header,
    type = "viz_boxplot",
    width = width,
    sortable = FALSE,
    options = opts
  )
}

#' Visualization column: Violin plot
#'
#' Renders violin plots (kernel density estimation). Requires raw array data
#' for each row.
#'
#' @param ... One or more `viz_violin_effect()` objects defining the violins
#' @param header Column header (default "")
#' @param width Column width in pixels (default 150)
#' @param scale Scale type: "linear" (default) or "log"
#' @param axis_range Numeric vector of length 2 specifying axis range c(min, max).
#'   If NULL (default), range is computed automatically from data.
#' @param axis_ticks Numeric vector of explicit tick positions. If NULL (default),
#'   ticks are computed automatically.
#' @param axis_gridlines Show gridlines at tick positions (default FALSE)
#' @param bandwidth KDE bandwidth. NULL (default) uses Silverman's rule of thumb.
#' @param show_median Show median indicator line (default TRUE)
#' @param show_quartiles Show Q1/Q3 indicator lines (default FALSE)
#' @param axis_label Label for the x-axis (default "Value")
#' @param show_axis Show the x-axis (default TRUE)
#'
#' @return A ColumnSpec object with type = "viz_violin"
#' @export
#'
#' @examples
#' # Single violin per row
#' viz_violin(viz_violin_effect(data = "values"))
#'
#' # Multiple violins per row
#' viz_violin(
#'   viz_violin_effect(data = "treatment", label = "Treatment", color = "#3b82f6"),
#'   viz_violin_effect(data = "control", label = "Control", color = "#22c55e"),
#'   show_median = TRUE,
#'   show_quartiles = TRUE
#' )
viz_violin <- function(
    ...,
    header = "",
    width = 150,
    scale = c("linear", "log"),
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    bandwidth = NULL,
    show_median = TRUE,
    show_quartiles = FALSE,
    axis_label = "Value",
    show_axis = TRUE) {

  scale <- match.arg(scale)
  effects <- list(...)

  # Validate effects
  if (length(effects) == 0) {
    cli_abort("viz_violin requires at least one viz_violin_effect()")
  }

  for (i in seq_along(effects)) {
    if (!S7_inherits(effects[[i]], VizViolinEffect)) {
      cli_abort(c(
        "All arguments to viz_violin must be {.fn viz_violin_effect} objects",
        "i" = "Argument {i} is not a VizViolinEffect"
      ))
    }
  }

  # Serialize effects
  serialized_effects <- lapply(effects, function(e) {
    list(
      data = e@data,
      label = if (is.na(e@label)) NULL else e@label,
      color = if (is.na(e@color)) NULL else e@color,
      fillOpacity = e@fill_opacity
    )
  })

  opts <- list(
    vizViolin = list(
      type = "violin",
      effects = serialized_effects,
      scale = scale,
      axisRange = axis_range,
      axisTicks = axis_ticks,
      axisGridlines = axis_gridlines,
      bandwidth = bandwidth,
      showMedian = show_median,
      showQuartiles = show_quartiles,
      axisLabel = axis_label,
      showAxis = show_axis
    )
  )

  # Synthetic field name
  synthetic_field <- paste0("_viz_violin_", effects[[1]]@data)

  web_col(
    synthetic_field,
    header = header,
    type = "viz_violin",
    width = width,
    sortable = FALSE,
    options = opts
  )
}
