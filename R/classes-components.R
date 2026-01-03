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
    valid_types <- c("text", "numeric", "interval", "bar", "pvalue", "sparkline", "custom")
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
    type = c("text", "numeric", "interval", "bar", "pvalue", "sparkline", "custom"),
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

  # Default alignment based on type
  if (is.null(align)) {
    align <- if (type %in% c("numeric", "pvalue", "bar")) "right" else "left"
  }

  # Handle width: NULL → NA, "auto" → "auto", numeric → numeric
  width_val <- if (is.null(width)) {
    NA_real_
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
#' @param width Column width in pixels (default 120)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
col_text <- function(field, header = NULL, width = 120, ...) {
  web_col(field, header, type = "text", width = width, ...)
}

#' Column helper: Numeric column
#'
#' @param field Field name
#' @param header Column header
#' @param width Column width in pixels (default 90)
#' @param decimals Number of decimal places to display (default 2, NULL for auto)
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
#' # Integer display (no decimals)
#' col_numeric("count", decimals = 0)
col_numeric <- function(field, header = NULL, width = 90, decimals = 2, ...) {
  opts <- list(
    numeric = list(
      decimals = decimals
    )
  )
  web_col(field, header, type = "numeric", width = width, options = opts, ...)
}

#' Column helper: Sample size / count
#'
#' @param field Field name (default "n")
#' @param header Column header (default "N")
#' @param width Column width in pixels (default 80)
#' @param decimals Number of decimal places (default 0 for integers)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
col_n <- function(field = "n", header = "N", width = 80, decimals = 0, ...) {
  opts <- list(
    numeric = list(
      decimals = decimals
    )
  )
  web_col(field, header, type = "numeric", width = width, options = opts, ...)
}

#' Column helper: Interval display (e.g., "1.2 (0.9, 1.5)")
#'
#' @param header Column header
#' @param width Column width in pixels (default 160)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
col_interval <- function(header = "95% CI", width = 160, ...) {
  web_col("_interval", header, type = "interval", width = width, ...)
}

#' Column helper: P-value
#'
#' @param field Field name (default "pvalue")
#' @param header Column header (default "P-value")
#' @param stars Show significance stars (default TRUE)
#' @param thresholds Numeric vector of 3 significance thresholds (default c(0.05, 0.01, 0.001))
#' @param format P-value format: "auto", "scientific", or "decimal"
#' @param width Column width in pixels (default 100)
#' @param ... Additional arguments passed to web_col
#'
#' @return A ColumnSpec object
#' @export
col_pvalue <- function(
    field = "pvalue",
    header = "P-value",
    stars = TRUE,
    thresholds = c(0.05, 0.01, 0.001),
    format = c("auto", "scientific", "decimal"),
    width = 100,
    ...) {
  format <- match.arg(format)
  opts <- list(
    pvalue = list(
      stars = stars,
      thresholds = thresholds,
      format = format
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
#' @param width Column width in pixels (default 80)
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
    width = 80,
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
#'
#' @param events_field Field name containing number of events
#' @param n_field Field name containing total sample size
#' @param header Column header (default "Events")
#' @param width Column width in pixels (default 100)
#' @param separator Separator between events and n (default "/")
#' @param show_pct Show percentage in parentheses (default FALSE)
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
col_events <- function(
    events_field,
    n_field,
    header = "Events",
    width = 100,
    separator = "/",
    show_pct = FALSE,
    ...) {
  opts <- list(
    events = list(
      eventsField = events_field,
      nField = n_field,
      separator = separator,
      showPct = show_pct
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
    tooltip_fields = new_property(class_any, default = NULL)
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
    tooltip_fields = NULL) {
  InteractionSpec(
    show_filters = show_filters,
    show_legend = show_legend,
    enable_sort = enable_sort,
    enable_collapse = enable_collapse,
    enable_select = enable_select,
    enable_hover = enable_hover,
    enable_resize = enable_resize,
    enable_export = enable_export,
    tooltip_fields = tooltip_fields
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
