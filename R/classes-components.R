# Column and interaction S7 classes for webforest

#' ColumnSpec: Specification for a table column
#'
#' @param id Unique identifier for the column
#' @param header Display header text
#' @param field Data field name to display
#' @param type Column type: "text", "numeric", "interval", "bar", "pvalue", "sparkline", "custom"
#' @param width Column width in pixels (NA for auto)
#' @param align Text alignment for body cells: "left", "center", "right"
#' @param header_align Text alignment for header: "left", "center", "right" (NA to inherit from align)
#' @param wrap Enable text wrapping (default FALSE). When TRUE, long text wraps instead of being truncated.
#' @param position Column position relative to plot: "left" or "right"
#' @param sortable Whether the column is sortable
#' @param options Named list of type-specific options
#' @param style_bold Column name containing logical values for per-cell bold styling
#' @param style_italic Column name containing logical values for per-cell italic styling
#' @param style_color Column name containing CSS color strings for per-cell text color
#' @param style_bg Column name containing CSS color strings for per-cell background color
#' @param style_badge Column name containing text for per-cell badges
#' @param style_icon Column name containing emoji/unicode for per-cell icons
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
    header_align = new_property(class_character, default = NA_character_),
    wrap = new_property(class_logical, default = FALSE),  # Enable text wrapping
    position = new_property(class_character, default = "left"),
    sortable = new_property(class_logical, default = TRUE),
    options = new_property(class_list, default = list()),
    # Per-cell style mappings: column names containing style values
    style_bold = new_property(class_character, default = NA_character_),
    style_italic = new_property(class_character, default = NA_character_),
    style_color = new_property(class_character, default = NA_character_),
    style_bg = new_property(class_character, default = NA_character_),
    style_badge = new_property(class_character, default = NA_character_),
    style_icon = new_property(class_character, default = NA_character_)
  ),
  validator = function(self) {
    valid_types <- c("text", "numeric", "interval", "bar", "pvalue", "sparkline",
                     "icon", "badge", "stars", "img", "reference", "range", "custom")
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

    valid_positions <- c("left", "right")
    if (!self@position %in% valid_positions) {
      return(paste("position must be one of:", paste(valid_positions, collapse = ", ")))
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
#' @param header_align Text alignment for header (NULL to inherit from align)
#' @param wrap Enable text wrapping (default FALSE). When TRUE, long text wraps
#'   instead of being truncated with ellipsis.
#' @param position Column position: "left" or "right" of the forest plot
#' @param sortable Whether sortable
#' @param options Named list of type-specific options
#' @param na_text Text to display for NA/missing values (default "" for empty)
#' @param bold Column name containing logical values for per-cell bold styling
#' @param italic Column name containing logical values for per-cell italic styling
#' @param color Column name containing CSS color strings for per-cell text color
#' @param bg Column name containing CSS color strings for per-cell background color
#' @param badge Column name containing text for per-cell badges
#' @param icon Column name containing emoji/unicode for per-cell icons
#'
#' @return A ColumnSpec object
#' @export
web_col <- function(
    field,
    header = NULL,
    type = c("text", "numeric", "interval", "bar", "pvalue", "sparkline",
             "icon", "badge", "stars", "img", "reference", "range", "custom"),
    width = NULL,
    align = NULL,
    header_align = NULL,
    wrap = FALSE,
    position = c("left", "right"),
    sortable = TRUE,
    options = list(),
    na_text = NULL,
    bold = NULL,
    italic = NULL,
    color = NULL,
    bg = NULL,
    badge = NULL,
    icon = NULL) {
  type <- match.arg(type)
  position <- match.arg(position)

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
    header_align = header_align %||% NA_character_,
    wrap = wrap,
    position = position,
    sortable = sortable,
    options = options,
    style_bold = bold %||% NA_character_,
    style_italic = italic %||% NA_character_,
    style_color = color %||% NA_character_,
    style_bg = bg %||% NA_character_,
    style_badge = badge %||% NA_character_,
    style_icon = icon %||% NA_character_
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
#' @param ... Additional arguments passed to web_col
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
#' @param decimals Number of decimal places to display (default 2, NULL for auto)
#' @param digits Number of significant figures (takes precedence over decimals if set)
#' @param thousands_sep Thousands separator (default FALSE for decimal columns,
#'   use "," or other string to enable)
#' @param abbreviate Abbreviate large numbers (default FALSE). When TRUE or a number,
#'   values >= 1000 are shortened (e.g., 1100 -> "1.1K", 2500000 -> "2.5M").
#'   If a number, specifies significant figures for abbreviated values (default 2).
#' @param ... Additional arguments passed to web_col
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
  opts <- list(
    numeric = list(
      decimals = decimals,
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
#' @param decimals Number of decimal places (default 0 for integers)
#' @param digits Number of significant figures (takes precedence over decimals if set)
#' @param thousands_sep Thousands separator (default "," for integer columns)
#' @param abbreviate Abbreviate large numbers (default FALSE). When TRUE or a number,
#'   values >= 1000 are shortened (e.g., 1100 -> "1.1K", 2500000 -> "2.5M").
#' @param ... Additional arguments passed to web_col
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
#' # Abbreviate large sample sizes: 12,345 -> "12K"
#' col_n("n", abbreviate = TRUE)
col_n <- function(field = "n", header = "N", width = NULL, decimals = 0,
                  digits = NULL, thousands_sep = ",", abbreviate = FALSE, ...) {
  opts <- list(
    numeric = list(
      decimals = decimals,
      digits = digits,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate
    )
  )
  web_col(field, header, type = "numeric", width = width, options = opts, ...)
}

#' Column helper: Interval display (e.g., "1.2 (0.9, 1.5)")
#'
#' Display point estimates with confidence intervals. By default, uses the
#' point/lower/upper columns defined at the plot level, but these can be
#' overridden with the `point`, `lower`, and `upper` arguments.
#'
#' @param header Column header (default "95% CI")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 2)
#' @param sep Separator between point and CI (default " ")
#' @param point Optional field name to override the point estimate column
#' @param lower Optional field name to override the lower bound column
#' @param upper Optional field name to override the upper bound column
#' @param imprecise_threshold When upper/lower ratio exceeds this threshold,
#'   the interval is considered imprecise and displayed as "—" instead.
#'   The forest plot marker is also hidden. Default is NULL (no threshold).
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default formatting
#' col_interval()
#'
#' # Custom decimals and separator
#' col_interval("HR (95% CI)", decimals = 3, sep = ", ")
#'
#' # Override interval fields (show different effect than plot)
#' col_interval("Per-Protocol", point = "pp_hr", lower = "pp_lower", upper = "pp_upper")
#'
#' # Hide imprecise estimates (CI ratio > 10)
#' col_interval(imprecise_threshold = 10)
col_interval <- function(header = "95% CI", width = NULL, decimals = 2, sep = " ",
                         point = NULL, lower = NULL, upper = NULL,
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
  web_col("_interval", header, type = "interval", width = width, options = opts, ...)
}

#' Column helper: P-value
#'
#' Display p-values with optional significance stars and smart formatting.
#' Very small values are displayed using Unicode superscript notation
#' (e.g., 1.2×10⁻⁵) for improved readability.
#'
#' @param field Field name (default "pvalue")
#' @param header Column header (default "P-value")
#' @param stars Show significance stars (default FALSE)
#' @param thresholds Numeric vector of 3 significance thresholds (default c(0.05, 0.01, 0.001))
#' @param format P-value format: "auto", "scientific", or "decimal"
#' @param digits Number of significant figures to display (default 2)
#' @param exp_threshold Values below this use exponential notation (default 0.001)
#' @param abbrev_threshold Values below this display as "<threshold" (default NULL = off).
#'   For example, `abbrev_threshold = 0.0001` displays values below 0.0001 as "<0.0001".
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param ... Additional arguments passed to web_col
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
    stars = FALSE,
    thresholds = c(0.05, 0.01, 0.001),
    format = c("auto", "scientific", "decimal"),
    digits = 2,
    exp_threshold = 0.001,
    abbrev_threshold = NULL,
    width = NULL,
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
#' @param max_value Maximum value for the bar (NULL = auto-compute from data)
#' @param show_label Show numeric label next to bar (default TRUE)
#' @param color Bar fill color (NULL = theme primary color)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
col_bar <- function(
    field = "weight",
    header = "Weight",
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
  web_col(field, header, type = "bar", options = opts, ...)
}

#' Column helper: Sparkline chart
#'
#' @param field Field name containing numeric vector for sparkline
#' @param header Column header (default "Trend")
#' @param type Chart type: "line", "bar", or "area"
#' @param height Chart height in pixels (default 20)
#' @param color Chart color (NULL = theme primary color)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
col_sparkline <- function(
    field = "trend",
    header = "Trend",
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
  web_col(field, header, type = "sparkline", options = opts, ...)
}

#' Column helper: Percentage column
#'
#' Display numeric values as percentages with optional % symbol.
#'
#' @param field Field name
#' @param header Column header (default field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 1)
#' @param multiply Whether to multiply by 100 (default FALSE, assumes data already 0-100)
#' @param symbol Show % symbol (default TRUE)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Data with percentages as 0-100
#' col_percent("accuracy", "Accuracy")
#'
#' # Data with proportions (0-1), need multiplication
#' col_percent("rate", "Rate", multiply = TRUE)
#'
#' # No % symbol
#' col_percent("pct", symbol = FALSE)
col_percent <- function(
    field,
    header = NULL,
    width = NULL,
    decimals = 1,
    multiply = FALSE,
    symbol = TRUE,
    ...) {
  opts <- list(
    percent = list(
      decimals = decimals,
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
#' @param abbreviate Abbreviate large numbers (default FALSE). When TRUE or a number,
#'   values >= 1000 are shortened (e.g., "1.1K/12K" instead of "1,100/12,000").
#' @param ... Additional arguments passed to web_col
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

# Deprecated alias
#' @rdname col_bar
#' @param show_bar Show as bar chart (default TRUE)
#' @export
col_weight <- function(field = "weight", header = "Weight", show_bar = TRUE, ...) {
  if (show_bar) {
    col_bar(field, header, ...)
  } else {
    col_numeric(field, header, ...)
  }
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
#'   (e.g., `c("yes" = "✓", "no" = "✗")`)
#' @param size Icon size: "sm", "base", or "lg" (default "base")
#' @param color Optional CSS color for the icon (default NULL, uses theme)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple emoji column (values are emoji)
#' col_icon("status_icon")
#'
#' # Map values to icons
#' col_icon("result", mapping = c("pass" = "✓", "fail" = "✗", "pending" = "○"))
#'
#' # With color
#' col_icon("status", color = "#16a34a")
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
#' @param ... Additional arguments passed to web_col
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
#' Display star ratings using Unicode stars (★ filled, ☆ empty).
#'
#' @param field Field name containing numeric rating (1-5 or custom range)
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param max_stars Maximum number of stars (default 5)
#' @param color CSS color for filled stars (default "#f59e0b", amber)
#' @param empty_color CSS color for empty stars (default "#d1d5db", gray)
#' @param half_stars Allow half-star increments (default FALSE)
#' @param ... Additional arguments passed to web_col
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
#' @param ... Additional arguments passed to web_col
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
#' @param ... Additional arguments passed to web_col
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
#' @param ... Additional arguments passed to web_col
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
# Column Groups (hierarchical headers)
# ============================================================================

#' ColumnGroup: A group of columns with a shared header
#'
#' Used for creating hierarchical column headers.
#'
#' @param id Unique identifier for the group
#' @param header Display header text for the group
#' @param columns List of ColumnSpec objects in this group
#' @param position Column position: "left" or "right" of the forest plot
#'
#' @export
ColumnGroup <- new_class(
  "ColumnGroup",
  properties = list(
    id = class_character,
    header = class_character,
    columns = new_property(class_list, default = list()),
    position = new_property(class_character, default = "left")
  ),
  validator = function(self) {
    valid_positions <- c("left", "right")
    if (!self@position %in% valid_positions) {
      return(paste("position must be one of:", paste(valid_positions, collapse = ", ")))
    }
    NULL
  }
)

#' Create a column group
#'
#' Groups multiple columns under a shared header for hierarchical display.
#'
#' @param header Display header for the group
#' @param ... Column specifications (ColumnSpec objects)
#' @param position Column position: "left" or "right" of the forest plot
#'
#' @return A ColumnGroup object
#' @export
col_group <- function(header, ..., position = c("left", "right")) {
  position <- match.arg(position)
  columns <- list(...)

  # Validate all children are ColumnSpec
  for (i in seq_along(columns)) {
    if (!S7_inherits(columns[[i]], ColumnSpec)) {
      cli_abort("All arguments to col_group must be ColumnSpec objects (use col_* helpers)")
    }
    # Inherit position from group
    columns[[i]]@position <- position
  }

  ColumnGroup(
    id = paste0("group_", gsub("[^a-zA-Z0-9]", "_", tolower(header))),
    header = header,
    columns = columns,
    position = position
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
  )
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
