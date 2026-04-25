# Column and interaction S7 classes for tabviz

#' ColumnSpec: Specification for a table column
#'
#' @param id Unique identifier for the column
#' @param header Display header text
#' @param field Data field name to display
#' @param type Column type: "text", "numeric", "interval", "bar", "pvalue", "sparkline", "forest", "custom"
#' @param width Column width in pixels (NA for auto)
#' @param align Text alignment for body cells: "left", "center", "right"
#' @param header_align Text alignment for header. `NA` (default) follows
#'   `align`. Otherwise: "left", "center", or "right".
#' @param show_header Whether to show the header cell. `NA` (default) follows
#'   the "auto" rule: shown if `header` is a non-empty string. `TRUE` or `FALSE`
#'   override.
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
#' @param style_tooltip Column name whose values become the per-cell hover tooltip
#' @param formatter Optional R function applied to the column's values at
#'   serialize time. When set, the output is rendered as text and overrides
#'   the type's built-in formatting.
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
    show_header = new_property(class_logical, default = NA),  # NA = auto (show iff header non-empty)
    # Multi-line wrap. Encodes *extra lines beyond the first*: FALSE/0 = no
    # wrap (single line + ellipsis); TRUE/1 = up to 2 lines; n = up to
    # n+1 lines, then clip. class_any so logical and integer both fit;
    # validator below normalises and rejects malformed values.
    wrap = new_property(class_any, default = FALSE),
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
    style_accent = new_property(class_any, default = NULL),
    # Per-cell tooltip (column name whose values are the hover title)
    style_tooltip = new_property(class_any, default = NULL),
    # Optional R-side formatter function applied at serialize time.
    # When set, the column's data values are replaced by the function's output
    # and the serialized column type is forced to "text".
    formatter = new_property(class_any, default = NULL)
  ),
  validator = function(self) {
    valid_types <- c("text", "numeric", "interval", "bar", "pvalue", "sparkline",
                     "icon", "badge", "stars", "img", "reference", "range", "forest",
                     "heatmap", "progress",
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

    # Validate `wrap`: logical(1) OR a non-negative integer-ish scalar.
    # Encodes extra lines beyond the first.
    w <- self@wrap
    if (!(is.logical(w) && length(w) == 1L && !is.na(w)) &&
        !(is.numeric(w) && length(w) == 1L && !is.na(w) && w >= 0 && w == as.integer(w))) {
      return("wrap must be TRUE/FALSE or a non-negative integer (extra lines beyond the first).")
    }

    # Reject ids that look like frontend sentinels (`__root__`, `__start__`,
    # etc). The store uses those values as scope keys / anchors; a column
    # id that matches would collide with the internal semantics and break
    # reorder / insert flows in surprising ways.
    if (is_reserved_id(self@id)) {
      return(paste0("id '", self@id, "' is reserved (internal frontend scope marker)"))
    }

    NULL
  }
)

#' Internal: compute the default id for a column given its type and field.
#'
#' Rule: `<type>_<field>`. Two columns with different types on the same
#' field get different default ids ("numeric_n" vs "bar_n") — no dedup
#' needed. Two columns with the same (type, field) pair produce the same
#' default and the dedup/error path handles the collision.
#'
#' Special cases:
#'  - Synthetic fields produced by viz helpers (`"_forest_<point>"`) are
#'    stripped of the `_<type>_` prefix so the id doesn't double-prefix
#'    (`viz_forest(point="hr")` → id `"forest_hr"`, not
#'    `"forest__forest_hr"`).
#'  - Empty / NA / zero-length fields fall back to just the type name
#'    (`viz_forest(effects=list(...))` with no single point field → id
#'    `"forest"`; a second one triggers the collision path).
#' @noRd
default_column_id <- function(type, field) {
  if (is.null(field) || length(field) == 0 || is.na(field) || !nzchar(field)) {
    return(type)
  }
  # Strip `_<type>_` prefix from synthetic viz fields.
  synthetic_prefix <- paste0("_", type, "_")
  if (startsWith(field, synthetic_prefix)) {
    field <- substr(field, nchar(synthetic_prefix) + 1L, nchar(field))
  }
  paste0(type, "_", field)
}

#' Internal: is this id reserved for frontend sentinels?
#'
#' The frontend's store reserves a small set of literal strings as scope /
#' anchor markers (e.g. `__root__` as the top-level scope key in
#' `columnOrderOverrides.byGroup`, `__start__` as the insert-at-front
#' anchor for `insertColumn`). A user column with either id would collide
#' with the internal semantics. Keep the list explicit rather than
#' regex-broad — tabviz itself uses `__row_number__` and similar for
#' internal label columns.
#' @noRd
RESERVED_COLUMN_IDS <- c("__root__", "__start__")

is_reserved_id <- function(id) {
  is.character(id) && length(id) == 1 && !is.na(id) &&
    id %in% RESERVED_COLUMN_IDS
}

#' Create a column specification
#'
#' @param field Data field name to display
#' @param header Display header (defaults to field name)
#' @param type Column type
#' @param id Optional unique id for the column. Defaults to
#'   `<type>_<field>` (e.g. `"numeric_n"`) so two columns of different
#'   types on the same field never collide. Pass an explicit id to
#'   disambiguate same-type columns on the same field, or to give a
#'   column a stable human-readable id for use in modifier calls.
#' @param width Column width in pixels, or "auto" for content-based width
#' @param align Text alignment for body cells
#' @param header_align Text alignment for the header cell: "left", "center",
#'   or "right". `NULL` (default) falls back to `align` — so, for example, a
#'   numeric column whose body is right-aligned gets a right-aligned header
#'   automatically. Pass an explicit value to override that fallback.
#' @param show_header Whether to show the header cell. `NULL` / `NA` (default)
#'   uses the auto rule (shown when `header` is non-empty). `TRUE` / `FALSE`
#'   force the header on or off.
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
#' @param tooltip Column name whose values become the per-cell hover tooltip.
#'   `NULL` (default) falls back to the cell's displayed value.
#' @param formatter Optional R function `function(x) ...` applied to the
#'   column's values before serialization. When set, the output is serialized
#'   as text and the frontend renders it verbatim — bypasses any built-in
#'   numeric/interval/… formatter. `NULL` (default) uses the type's built-in
#'   formatting.
#'
#' @return A ColumnSpec object
#' @export
web_col <- function(
    field,
    header = NULL,
    type = c("text", "numeric", "interval", "bar", "pvalue", "sparkline",
             "icon", "badge", "stars", "img", "reference", "range", "forest",
             "heatmap", "progress",
             "viz_bar", "viz_boxplot", "viz_violin", "custom"),
    id = NULL,
    width = NULL,
    align = NULL,
    header_align = NULL,
    show_header = NULL,
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
    accent = NULL,
    tooltip = NULL,
    formatter = NULL) {
  type <- match.arg(type)

  # Default header to field name
  header <- header %||% field

  # Default alignment is left
  if (is.null(align)) {
    align <- "left"
  }

  # Handle width: NULL -> "auto", "auto" -> "auto", numeric -> numeric
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

  # When a custom formatter is set, the column renders pre-formatted text
  if (!is.null(formatter)) {
    if (!is.function(formatter)) {
      cli_abort("{.arg formatter} must be a function, not {.cls {class(formatter)}}.")
    }
    type <- "text"
  }

  # Resolve the column id. Explicit `id = ...` from the caller wins. If
  # absent, default to `<type>_<field>` so columns of different types on the
  # same field ("numeric_n" vs "bar_n") don't collide by default. Synthetic
  # fields (viz_forest uses "_forest_<point>") are stripped so the id
  # doesn't double-prefix.
  resolved_id <- if (!is.null(id)) {
    checkmate::assert_string(id)
    id
  } else {
    default_column_id(type, field)
  }

  ColumnSpec(
    id = resolved_id,
    header = header,
    field = field,
    type = type,
    width = width_val,
    align = align,
    header_align = if (is.null(header_align)) NA_character_ else as.character(header_align),
    show_header = if (is.null(show_header)) NA else as.logical(show_header),
    wrap = wrap,
    sortable = sortable,
    options = options,
    formatter = formatter,
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
    style_accent = accent,
    style_tooltip = tooltip
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
#' @param max_chars Maximum characters to show before truncating with trailing
#'   ellipsis. NULL (default) = no truncation.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
col_text <- function(field, header = NULL, width = NULL, max_chars = NULL,
                     na_text = NULL, ...) {
  checkmate::assert_integerish(max_chars, lower = 1, len = 1, null.ok = TRUE)
  opts <- if (is.null(max_chars)) list() else list(text = list(maxChars = max_chars))
  web_col(field, header, type = "text", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Row-identifier (label) column
#'
#' Convenience wrapper over [col_text()] for defining the leftmost row-identifier
#' column explicitly in a `columns` list. Behaves identically to `col_text()`;
#' the leftmost visible column in a table is the "primary" column (sticky-left,
#' row-drag surface, row tooltips), regardless of which helper created it.
#'
#' @param field Field name containing the row label / identifier
#' @param header Column header (defaults to a prettified field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param max_chars Maximum characters to show before truncating with trailing
#'   ellipsis. NULL (default) = no truncation.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to [web_col()]
#'
#' @return A ColumnSpec object
#' @export
col_label <- function(field, header = NULL, width = NULL, max_chars = NULL,
                      na_text = NULL, ...) {
  checkmate::assert_integerish(max_chars, lower = 1, len = 1, null.ok = TRUE)
  if (is.null(header)) {
    header <- gsub("_", " ", field)
    header <- gsub("([a-z])([A-Z])", "\\1 \\2", header)
    header <- tools::toTitleCase(header)
  }
  opts <- if (is.null(max_chars)) list() else list(text = list(maxChars = max_chars))
  web_col(field, header, type = "text", width = width, options = opts,
          na_text = na_text, ...)
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
#' @param na_text Text to display for NA/missing values (default NULL = blank)
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
                        na_text = NULL, ...) {
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
  web_col(field, header, type = "numeric", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Sample size / count
#'
#' Display integer counts with thousands separator for readability.
#'
#' @param field Field name (required)
#' @param header Column header (default "N")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 0 for integers). Cannot be used with `digits`.
#' @param digits Number of significant figures. Cannot be used with `decimals`.
#' @param thousands_sep Thousands separator (default "," for integer columns)
#' @param abbreviate Logical. When TRUE, values >= 1000 are shortened with at most
#'   1 decimal place (e.g., 1100 -> "1.1K", 12345 -> "12.3K"). Default FALSE.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
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
col_n <- function(field, header = "N", width = NULL, decimals = 0,
                  digits = NULL, thousands_sep = ",", abbreviate = FALSE,
                  na_text = NULL, ...) {
  if (missing(field)) {
    lifecycle::deprecate_warn(
      "0.9.0",
      I("Calling col_n() without `field`"),
      details = "Pass the column name explicitly, e.g. col_n(\"n\"). The implicit default will be removed."
    )
    field <- "n"
  }
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
  web_col(field, header, type = "numeric", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Interval display (e.g., "1.2 (0.9, 1.5)")
#'
#' Display point estimates with confidence intervals as formatted text.
#' The `point`, `lower`, and `upper` arguments specify which data columns
#' contain the values to display.
#'
#' @param point Field name for the point estimate column (required)
#' @param lower Field name for the lower bound column (required)
#' @param upper Field name for the upper bound column (required)
#' @param header Column header (default "95% CI")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param decimals Number of decimal places (default 2). Cannot be used with `digits`.
#' @param digits Number of significant figures. Cannot be used with `decimals`.
#' @param thousands_sep Thousands separator for the formatted numbers
#'   (e.g. `","` or `" "`) or `FALSE` to disable. Default `FALSE`.
#' @param abbreviate Logical. When `TRUE`, values >= 1000 are shortened
#'   (e.g. `"1.2K"`, `"3.4M"`). Default `FALSE`.
#' @param separator Separator between point and CI (default " ")
#' @param imprecise_threshold When upper/lower ratio exceeds this threshold,
#'   the interval is considered imprecise and displayed as "--" instead.
#'   Default is NULL (no threshold).
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param sep `r lifecycle::badge("deprecated")` Use `separator` instead.
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
#' col_interval("hr", "lower", "upper", "HR (95% CI)", decimals = 3, separator = ", ")
#'
#' # Significant figures across orders of magnitude
#' col_interval("rr", "rr_lo", "rr_hi", digits = 3)
#'
#' # Hide imprecise estimates (CI ratio > 10)
#' col_interval("hr", "lower", "upper", imprecise_threshold = 10)
col_interval <- function(point = NULL, lower = NULL, upper = NULL,
                         header = "95% CI", width = NULL, decimals = 2,
                         digits = NULL, thousands_sep = FALSE,
                         abbreviate = FALSE,
                         separator = " ", imprecise_threshold = NULL,
                         na_text = NULL,
                         ..., sep = lifecycle::deprecated()) {
  if (lifecycle::is_present(sep)) {
    lifecycle::deprecate_warn("0.9.0", "col_interval(sep)", "col_interval(separator)")
    separator <- sep
  }
  if (is.null(point) || is.null(lower) || is.null(upper)) {
    lifecycle::deprecate_warn(
      "0.9.0",
      I("Calling col_interval() without `point`/`lower`/`upper`"),
      details = "Pass the column names explicitly, e.g. col_interval(\"hr\", \"lower\", \"upper\"). The implicit auto-detect from a sibling viz_forest() column will be removed."
    )
  }
  opts <- list(
    interval = list(
      decimals = if (is.null(digits)) decimals else NULL,
      digits = digits,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate,
      separator = separator,
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
  web_col(synthetic_field, header, type = "interval", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: P-value
#'
#' Display p-values with optional significance stars and smart formatting.
#' Very small values are displayed in scientific notation
#' (e.g., 1.2e-5) for improved readability.
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
#' @param na_text Text to display for NA/missing values (default NULL = blank)
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
    field,
    header = "P-value",
    width = NULL,
    stars = FALSE,
    thresholds = c(0.05, 0.01, 0.001),
    format = c("auto", "scientific", "decimal"),
    digits = 2,
    exp_threshold = 0.001,
    abbrev_threshold = NULL,
    na_text = NULL,
    ...) {
  if (missing(field)) {
    lifecycle::deprecate_warn(
      "0.9.0",
      I("Calling col_pvalue() without `field`"),
      details = "Pass the column name explicitly, e.g. col_pvalue(\"pvalue\"). The implicit default will be removed."
    )
    field <- "pvalue"
  }
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
  web_col(field, header, type = "pvalue", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Bar/weight column
#'
#' @param field Field name (required)
#' @param header Column header. Defaults to `NULL`, which resolves to the
#'   field's label (or field name) at render time. Pass `""` or set
#'   `show_header = FALSE` via `...` to hide the header.
#' @param width Column width in pixels (NULL for auto-sizing)
#' @param max_value Maximum value for the bar (NULL = auto-compute from data)
#' @param show_label Show numeric label next to bar (default TRUE)
#' @param color Bar fill color (NULL = theme primary color)
#' @param scale Scale type: "linear" (default), "log", or "sqrt". Controls how
#'   values map to bar length.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
col_bar <- function(
    field,
    header = NULL,
    width = NULL,
    max_value = NULL,
    show_label = TRUE,
    color = NULL,
    scale = c("linear", "log", "sqrt"),
    na_text = NULL,
    ...) {
  if (missing(field)) {
    lifecycle::deprecate_warn(
      "0.9.0",
      I("Calling col_bar() without `field`"),
      details = "Pass the column name explicitly, e.g. col_bar(\"weight\"). The implicit default will be removed."
    )
    field <- "weight"
  }
  scale <- match.arg(scale)
  opts <- list(
    bar = list(
      maxValue = max_value,
      showLabel = show_label,
      color = color,
      scale = scale
    )
  )
  web_col(field, header, type = "bar", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Sparkline chart
#'
#' @param field Field name containing numeric vector for sparkline
#' @param header Column header (default "Trend")
#' @param width Column width in pixels (NULL for auto-sizing)
#' @param type Chart type: "line", "bar", or "area"
#' @param height Chart height in pixels (default 20)
#' @param color Chart color (NULL = theme primary color)
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
col_sparkline <- function(
    field,
    header = "Trend",
    width = NULL,
    type = c("line", "bar", "area"),
    height = 20,
    color = NULL,
    na_text = NULL,
    ...) {
  if (missing(field)) {
    lifecycle::deprecate_warn(
      "0.9.0",
      I("Calling col_sparkline() without `field`"),
      details = "Pass the column name explicitly, e.g. col_sparkline(\"trend\"). The implicit default will be removed."
    )
    field <- "trend"
  }
  type <- match.arg(type)
  opts <- list(
    sparkline = list(
      type = type,
      height = height,
      color = color
    )
  )
  web_col(field, header, type = "sparkline", width = width, options = opts,
          na_text = na_text, ...)
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
#' @param na_text Text to display for NA/missing values (default NULL = blank)
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
    na_text = NULL,
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
  web_col(field, header, type = "numeric", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Events column
#'
#' Display event counts in "events/n" format for clinical trial data.
#' Large numbers are formatted with thousands separators for readability.
#'
#' @param events Field name containing the event count
#' @param n Field name containing the total sample size
#' @param header Column header (default "Events")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param separator Separator between events and n (default "/")
#' @param show_pct Show percentage in parentheses (default FALSE)
#' @param thousands_sep Thousands separator (default ",")
#' @param abbreviate Logical. When TRUE, values >= 1000 are shortened with at most
#'   1 decimal place (e.g., "1.1K/12K" instead of "1,100/12,000"). Default FALSE.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#' @param events_field `r lifecycle::badge("deprecated")` Use `events`.
#' @param n_field `r lifecycle::badge("deprecated")` Use `n`.
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
    events,
    n,
    header = "Events",
    width = NULL,
    separator = "/",
    show_pct = FALSE,
    thousands_sep = ",",
    abbreviate = FALSE,
    na_text = NULL,
    ...,
    events_field = lifecycle::deprecated(),
    n_field = lifecycle::deprecated()) {
  if (lifecycle::is_present(events_field)) {
    lifecycle::deprecate_warn("0.9.0", "col_events(events_field)", "col_events(events)")
    if (missing(events)) events <- events_field
  }
  if (lifecycle::is_present(n_field)) {
    lifecycle::deprecate_warn("0.9.0", "col_events(n_field)", "col_events(n)")
    if (missing(n)) n <- n_field
  }
  opts <- list(
    events = list(
      eventsField = events,
      nField = n,
      separator = separator,
      showPct = show_pct,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate
    )
  )
  if (!is.null(na_text)) opts$naText <- na_text
  # Use a synthetic field that signals this is an events column
  synthetic_field <- paste0("_events_", events, "_", n)
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
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling
#'   (`bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent`) and
#'   alignment. Body cells default to `align = "center"` (override with
#'   `align = "left"` / `"right"`); header alignment follows the body unless
#'   `header_align` is set explicitly.
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
    na_text = NULL,
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
          options = opts, na_text = na_text, ...)
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
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling
#'   (`bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent`) and
#'   alignment. Body cells default to `align = "center"` (override with
#'   `align = "left"` / `"right"`); header alignment follows the body unless
#'   `header_align` is set explicitly.
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
    na_text = NULL,
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
          options = opts, na_text = na_text, ...)
}

#' Column helper: Star rating
#'
#' Display star ratings using Unicode stars (filled and empty).
#'
#' @param field Field name containing numeric rating (1-5 or custom range)
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param max_stars Maximum number of stars (default 5, max 20)
#' @param color CSS color for filled stars (default "#f59e0b", amber)
#' @param empty_color CSS color for empty stars (default "#d1d5db", gray)
#' @param half_stars Allow half-star increments (default FALSE)
#' @param min_value,max_value Numeric scalars defining the input range to remap
#'   into `[0, max_stars]`. For example, `min_value = 0, max_value = 100` with
#'   `max_stars = 5` maps a value of 75 to 3.75 stars. Pass both or neither;
#'   default `NULL` assumes the input is already in `[0, max_stars]`.
#' @param size Star size: `"sm"`, `"base"` (default), or `"lg"`. Matches the
#'   `size` argument on `col_icon()` and `col_badge()`.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling
#'   (`bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent`) and
#'   alignment. Body cells default to `align = "center"` (override with
#'   `align = "left"` / `"right"`); header alignment follows the body unless
#'   `header_align` is set explicitly.
#' @param domain `r lifecycle::badge("deprecated")` Use
#'   `min_value` / `max_value` instead.
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
#' # Remap an arbitrary input range to stars
#' col_stars("score_0_100", min_value = 0, max_value = 100)
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
    min_value = NULL,
    max_value = NULL,
    size = c("base", "sm", "lg"),
    na_text = NULL,
    ...,
    domain = lifecycle::deprecated()) {
  size <- match.arg(size)
  checkmate::assert_integerish(max_stars, lower = 1, upper = 20, len = 1)
  if (lifecycle::is_present(domain)) {
    lifecycle::deprecate_warn(
      "0.9.0",
      "col_stars(domain)",
      details = "Use `min_value` and `max_value` instead."
    )
    if (is.null(min_value) && is.null(max_value)) {
      checkmate::assert_numeric(domain, len = 2, any.missing = FALSE,
                                sorted = TRUE)
      min_value <- domain[1]
      max_value <- domain[2]
    }
  }
  if (xor(is.null(min_value), is.null(max_value))) {
    cli_abort("Pass both {.arg min_value} and {.arg max_value}, or neither.")
  }
  if (!is.null(min_value)) {
    checkmate::assert_number(min_value)
    checkmate::assert_number(max_value, lower = min_value)
  }
  domain_vec <- if (is.null(min_value)) NULL else c(min_value, max_value)
  opts <- list(
    stars = list(
      maxStars = max_stars,
      color = color,
      emptyColor = empty_color,
      halfStars = half_stars,
      domain = domain_vec,
      size = size
    )
  )
  web_col(field, header, type = "stars", width = width, align = "center",
          options = opts, na_text = na_text, ...)
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
#' @param fallback Fallback text or icon if image fails to load (default "[img]")
#' @param shape Image shape: "square", "circle", or "rounded" (default "square")
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling
#'   (`bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent`) and
#'   alignment. Body cells default to `align = "center"` (override with
#'   `align = "left"` / `"right"`); header alignment follows the body unless
#'   `header_align` is set explicitly.
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
    fallback = "[img]",
    shape = c("square", "circle", "rounded"),
    na_text = NULL,
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
          options = opts, na_text = na_text, ...)
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
#' @param show_icon Show external link icon when `href_field` is provided
#'   (default TRUE)
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param icon `r lifecycle::badge("deprecated")` Use `show_icon` instead.
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
#' col_reference("source", href_field = "url", show_icon = FALSE)
#'
#' # With per-cell styling
#' col_reference("citation", emphasis = "is_key")
col_reference <- function(
    field,
    header = "Reference",
    width = NULL,
    href_field = NULL,
    max_chars = 30,
    show_icon = TRUE,
    na_text = NULL,
    ...,
    icon = lifecycle::deprecated()) {
  if (lifecycle::is_present(icon)) {
    lifecycle::deprecate_warn("0.9.0", "col_reference(icon)", "col_reference(show_icon)")
    show_icon <- icon
  }
  opts <- list(
    reference = list(
      hrefField = href_field,
      maxChars = max_chars,
      showIcon = show_icon
    )
  )
  web_col(field, header, type = "reference", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Range display
#'
#' Display min-max ranges like "18-65" or "2.5 - 10.0".
#'
#' @param low Field name containing the lower bound of each range
#' @param high Field name containing the upper bound of each range
#' @param header Column header (default "Range")
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param separator Separator between low and high (default " - ")
#' @param decimals Number of decimal places (default NULL for auto-detection).
#'   Cannot be used with `digits`.
#' @param digits Number of significant figures. Cannot be used with `decimals`.
#' @param thousands_sep Thousands separator for the formatted numbers
#'   (e.g. `","` or `" "`) or `FALSE` to disable. Default `FALSE`.
#' @param abbreviate Logical. When `TRUE`, values >= 1000 are shortened
#'   (e.g. `"1.2K - 3.4M"`). Default `FALSE`.
#' @param show_bar Show visual bar representation (default FALSE)
#' @param na_text Text to display when either bound is NA (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling
#'   (`bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent`) and
#'   alignment. Body cells default to `align = "right"` (override with
#'   `align = "left"` / `"center"`); header alignment follows the body unless
#'   `header_align` is set explicitly.
#' @param min_field `r lifecycle::badge("deprecated")` Use `low`.
#' @param max_field `r lifecycle::badge("deprecated")` Use `high`.
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Simple range: "18 - 65"
#' col_range("age_min", "age_max", "Age Range")
#'
#' # Custom separator: "18-65"
#' col_range("low", "high", separator = "-")
#'
#' # With decimals: "1.5 - 3.2"
#' col_range("ci_lower", "ci_upper", decimals = 1)
#'
#' # Significant figures: span orders of magnitude
#' col_range("low_price", "high_price", digits = 3)
#'
#' # Abbreviate large values: "1.2K - 3.4M"
#' col_range("low_n", "high_n", abbreviate = TRUE)
#'
#' # With per-cell styling
#' col_range("age_min", "age_max", emphasis = "is_key")
col_range <- function(
    low,
    high,
    header = "Range",
    width = NULL,
    separator = " - ",
    decimals = NULL,
    digits = NULL,
    thousands_sep = FALSE,
    abbreviate = FALSE,
    show_bar = FALSE,
    na_text = NULL,
    ...,
    min_field = lifecycle::deprecated(),
    max_field = lifecycle::deprecated()) {
  if (lifecycle::is_present(min_field)) {
    lifecycle::deprecate_warn("0.9.0", "col_range(min_field)", "col_range(low)")
    if (missing(low)) low <- min_field
  }
  if (lifecycle::is_present(max_field)) {
    lifecycle::deprecate_warn("0.9.0", "col_range(max_field)", "col_range(high)")
    if (missing(high)) high <- max_field
  }
  opts <- list(
    range = list(
      minField = low,
      maxField = high,
      separator = separator,
      decimals = if (is.null(digits)) decimals else NULL,
      digits = digits,
      thousandsSep = thousands_sep,
      abbreviate = abbreviate,
      showBar = show_bar
    )
  )
  if (!is.null(na_text)) opts$naText <- na_text
  # Use a synthetic field that signals this is a range column
  synthetic_field <- paste0("_range_", low, "_", high)
  web_col(synthetic_field, header, type = "range", width = width,
          align = "right", options = opts, ...)
}

# ============================================================================
# Heatmap, Progress, Currency, and Date Column Helpers
# ============================================================================

#' Column helper: Heatmap (color intensity)
#'
#' Display a number with interpolated background color based on value.
#' Useful for showing magnitude via color intensity.
#'
#' @param field Field name containing numeric values
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param palette Character vector of 2+ hex colors for interpolation
#'   (default: light blue to dark blue)
#' @param min_value Minimum value for color scale (NULL = auto from data)
#' @param max_value Maximum value for color scale (NULL = auto from data)
#' @param decimals Number of decimal places (default 2)
#' @param show_value Show the numeric value over the color (default TRUE)
#' @param scale Scale type: "linear" (default), "log", or "sqrt". Controls how
#'   values map to palette position.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default blue gradient
#' col_heatmap("correlation")
#'
#' # Custom red-yellow-green palette
#' col_heatmap("score", palette = c("#d73027", "#fee08b", "#1a9850"))
#'
#' # Fixed range
#' col_heatmap("pct", min_value = 0, max_value = 100)
#'
#' # Hide numeric value (color only)
#' col_heatmap("value", show_value = FALSE)
col_heatmap <- function(field, header = NULL, width = NULL,
                        palette = c("#f7fbff", "#08306b"),
                        min_value = NULL, max_value = NULL,
                        decimals = 2, show_value = TRUE,
                        scale = c("linear", "log", "sqrt"),
                        na_text = NULL, ...) {
  scale <- match.arg(scale)
  checkmate::assert_character(palette, min.len = 2)
  checkmate::assert_number(min_value, null.ok = TRUE)
  checkmate::assert_number(max_value, null.ok = TRUE)
  checkmate::assert_number(decimals, lower = 0, upper = 10)
  checkmate::assert_flag(show_value)
  opts <- list(
    heatmap = list(palette = palette, minValue = min_value,
                   maxValue = max_value, decimals = decimals,
                   showValue = show_value, scale = scale)
  )
  web_col(field, header, type = "heatmap", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Progress bar
#'
#' Display a progress bar filled proportionally to the value.
#'
#' @param field Field name containing numeric values (0 to max_value)
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param max_value Maximum value for the progress bar (default 100)
#' @param color Bar fill color (NULL = theme primary color)
#' @param show_label Show percentage label (default TRUE)
#' @param scale Scale type: "linear" (default), "log", or "sqrt". Controls how
#'   values map to bar fill.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default 0-100 progress
#' col_progress("completion")
#'
#' # Custom max and color
#' col_progress("score", max_value = 10, color = "#22c55e")
#'
#' # No label
#' col_progress("pct", show_label = FALSE)
col_progress <- function(field, header = NULL, width = NULL,
                         max_value = 100, color = NULL,
                         show_label = TRUE,
                         scale = c("linear", "log", "sqrt"),
                         na_text = NULL, ...) {
  scale <- match.arg(scale)
  checkmate::assert_number(max_value, lower = 0)
  checkmate::assert_string(color, null.ok = TRUE)
  checkmate::assert_flag(show_label)
  opts <- list(
    progress = list(maxValue = max_value, color = color,
                    showLabel = show_label, scale = scale)
  )
  web_col(field, header, type = "progress", width = width, options = opts,
          na_text = na_text, ...)
}

#' Column helper: Currency formatting
#'
#' Display numeric values with currency symbol. This is a convenience wrapper
#' around `col_numeric()` that adds prefix/suffix formatting.
#'
#' @param field Field name containing numeric values
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param symbol Currency symbol (default "$")
#' @param decimals Number of decimal places (default 2). Cannot be used with `digits`.
#' @param digits Number of significant figures. Cannot be used with `decimals`.
#' @param thousands_sep Thousands separator. Either a string (e.g. `","`,
#'   `" "`, `"."`) or `FALSE` to disable. Default `","`. The legacy `TRUE`
#'   value is still accepted and treated as `","`.
#' @param abbreviate Logical. When TRUE, values >= 1000 are shortened with at
#'   most 1 decimal place (e.g., "$1.2M", "$5.3K"). Default FALSE.
#' @param position Symbol position: "prefix" (default, e.g., "$100") or "suffix" (e.g., "100EUR")
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling
#'   (`bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent`) and
#'   alignment. Body cells default to `align = "right"` (override with
#'   `align = "left"` / `"center"`); header alignment follows the body unless
#'   `header_align` is set explicitly.
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default USD
#' col_currency("price")
#'
#' # European thousands separator (period)
#' col_currency("amount", symbol = "€", thousands_sep = ".", position = "suffix")
#'
#' # Abbreviate large amounts: 1,234,567 -> "$1.2M"
#' col_currency("revenue", abbreviate = TRUE)
#'
#' # Euro suffix
#' col_currency("amount", symbol = "\u20ac", position = "suffix")
#'
#' # No thousands separator
#' col_currency("cost", thousands_sep = FALSE)
col_currency <- function(field, header = NULL, width = NULL,
                         symbol = "$", decimals = 2, digits = NULL,
                         thousands_sep = ",", abbreviate = FALSE,
                         position = c("prefix", "suffix"),
                         na_text = NULL, ...) {
  position <- match.arg(position)
  checkmate::assert_string(symbol)
  checkmate::assert_number(decimals, lower = 0, upper = 10)
  if (!is.null(digits)) {
    checkmate::assert_number(digits, lower = 1, upper = 22)
  }
  if (isTRUE(thousands_sep)) {
    thousands_sep <- ","
  } else if (!isFALSE(thousands_sep)) {
    checkmate::assert_string(thousands_sep)
  }
  checkmate::assert_flag(abbreviate)
  opts <- list(
    numeric = list(decimals = if (is.null(digits)) decimals else NULL,
                   digits = digits,
                   thousandsSep = thousands_sep,
                   abbreviate = abbreviate,
                   prefix = if (position == "prefix") symbol else NULL,
                   suffix = if (position == "suffix") symbol else NULL)
  )
  if (!is.null(na_text)) opts$naText <- na_text
  web_col(field, header, type = "numeric", width = width, align = "right",
          options = opts, ...)
}

#' Column helper: Date formatting
#'
#' Display dates with custom formatting. Dates are formatted on the R side
#' during serialization, then displayed as text.
#'
#' @param field Field name containing Date or POSIXct values
#' @param header Column header (default NULL, uses field name)
#' @param width Column width in pixels (NULL for auto-sizing based on content)
#' @param format Date format string (default "%Y-%m-%d"). See [strftime()] for codes.
#' @param na_text Text to display for NA/missing values (default NULL = blank)
#' @param ... Additional arguments passed to `web_col()`, including cell styling:
#'   `bold`, `italic`, `color`, `bg`, `emphasis`, `muted`, `accent` (column names)
#'
#' @return A ColumnSpec object
#' @export
#' @examples
#' # Default ISO format
#' col_date("date")
#'
#' # US format
#' col_date("date", format = "%m/%d/%Y")
#'
#' # Abbreviated month
#' col_date("enrollment_date", format = "%b %d, %Y")
col_date <- function(field, header = NULL, width = NULL,
                     format = "%Y-%m-%d", na_text = NULL, ...) {
  checkmate::assert_string(format)
  opts <- list(date = list(format = format))
  web_col(field, header, type = "text", width = width, options = opts,
          na_text = na_text, ...)
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
#' a single effect, or a list of `effect_forest()` objects for multiple effects.
#'
#' @param header Column header label. Defaults to `NULL`, which resolves to
#'   the single-effect field's label (or the point-column name). Multi-effect
#'   forests fall back to blank.
#' @param show_header Whether to render the header cell above the plot.
#'   Defaults to `TRUE`. Set to `FALSE` to hide the header (useful when the
#'   axis label already carries the meaning).
#' @param header_align Header text alignment (`"left"`, `"center"`, `"right"`).
#'   Defaults to `"center"` for forest columns — pair nicely with the axis
#'   labels centered below the plot region.
#' @param width Column width in pixels (NULL for auto-sizing based on available space)
#' @param point Column name for point estimate. Use for single-effect plots.
#' @param lower Column name for lower bound. Use for single-effect plots.
#' @param upper Column name for upper bound. Use for single-effect plots.
#' @param effects List of `effect_forest()` objects for multi-effect display
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
#'     effect_forest("itt_or", "itt_lo", "itt_hi", label = "ITT", color = "#2563eb"),
#'     effect_forest("pp_or", "pp_lo", "pp_hi", label = "Per-Protocol", color = "#16a34a")
#'   ),
#'   scale = "log",
#'   null_value = 1,
#'   axis_label = "Odds Ratio (95% CI)"
#' )
viz_forest <- function(
    header = NULL,
    show_header = TRUE,
    header_align = "center",
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
  checkmate::assert_flag(show_header)
  checkmate::assert_choice(header_align, c("left", "center", "right"), null.ok = TRUE)

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
      "i" = "or {.arg effects} = list(effect_forest(...), ...) for multiple effects."
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

  # Default header to the effect label; never the raw point column name,
  # since "hr" / "or" / "rr" are internal identifiers, not presentable labels.
  # When no meaningful fallback exists, leave the header empty and force
  # show_header off so the column doesn't reserve a blank header strip.
  forest_fallback <- if (has_effects) {
    if (length(effects) > 1) {
      ""
    } else {
      lbl <- effects[[1]]@label
      if (!is.na(lbl) && nzchar(lbl)) lbl else ""
    }
  } else {
    ""
  }
  resolved_header <- if (is.null(header)) forest_fallback else as.character(header)
  # If the fallback produced an empty header (user didn't name the column and
  # no effect label was available), suppress the header — an empty cell with
  # show_header = TRUE would just reserve an unused strip above the axis.
  if (is.null(header) && !nzchar(resolved_header)) {
    show_header <- FALSE
  }

  web_col(
    synthetic_field,
    header = resolved_header,
    show_header = show_header,
    header_align = header_align,
    type = "forest",
    width = width,
    sortable = FALSE,  # Forest columns are not sortable by default
    options = opts,
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
  ),
  validator = function(self) {
    if (is_reserved_id(self@id)) {
      return(paste0("id '", self@id, "' is reserved (internal frontend scope marker)"))
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
#' @param show_filters (Deprecated) Alias for `enable_filters`
#' @param show_legend Show legend
#' @param enable_sort Enable column sorting
#' @param enable_collapse Enable group collapsing
#' @param enable_select Enable row selection
#' @param enable_hover Enable hover effects
#' @param enable_resize Enable column resizing
#' @param enable_export Enable download/export button
#' @param enable_filters Enable per-column filter popovers in column headers
#' @param enable_reorder_rows Enable drag-and-drop reordering of rows (within a group)
#'   and row-groups (among siblings sharing a parent). Session-only; WYSIWYG export
#'   reflects the reorder automatically.
#' @param enable_reorder_columns Enable drag-and-drop reordering of columns (within a
#'   column group) and column-groups (among top-level siblings).
#' @param enable_edit Enable double-click inline editing for text/numeric/label cells,
#'   and a popover editor for forest-cell numerics (estimate / lower / upper).
#' @param show_group_counts Show the row count in parentheses next to each row-group
#'   header label (e.g. "Main Trials (12)"). Default `FALSE`.
#' @param tooltip_fields Character vector of column names to show in hover tooltip (NULL = no tooltip)
#' @param enable_themes Control the interactive theme-switcher menu. Accepts:
#'   - `"default"`: show all [`package_themes()`].
#'   - `NULL`: hide the theme switcher entirely.
#'   - A list of `WebTheme` objects: show exactly those themes. Named list
#'     entries override each theme's display name
#'     (e.g. `list(Classical = web_theme_jama())`). The spec's active `theme`
#'     is always auto-included so users can revert.
#'
#'   Defaults to `getOption("tabviz.enable_themes", "default")`, so a
#'   session-wide curated list can be set once via
#'   `options(tabviz.enable_themes = list(...))`. See also
#'   [`selectable_themes()`] for a fluent modifier.
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
    enable_filters = new_property(class_logical, default = TRUE),
    enable_reorder_rows = new_property(class_logical, default = TRUE),
    enable_reorder_columns = new_property(class_logical, default = TRUE),
    enable_edit = new_property(class_logical, default = TRUE),
    show_group_counts = new_property(class_logical, default = FALSE),
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

# Normalize `enable_themes` for the runtime: resolve "default", apply
# list-name overrides (named entries rewrite @name so the switcher shows
# that label), and guarantee the active theme is present so the user can
# always revert. Returns NULL (hide switcher) or a list of WebTheme.
#' @noRd
finalize_enable_themes <- function(value, theme) {
  if (is.null(value)) return(NULL)
  if (identical(value, "default")) value <- package_themes()
  if (!is.list(value) || length(value) == 0) return(NULL)

  nms <- names(value)
  if (!is.null(nms)) {
    for (i in seq_along(value)) {
      if (nzchar(nms[[i]])) value[[i]]@name <- nms[[i]]
    }
  }

  active <- theme@name
  if (!any(vapply(value, function(t) identical(t@name, active), logical(1)))) {
    value <- c(list(theme), value)
  }
  value
}

#' Create interaction specification
#'
#' Two prefixes appear in this spec by design:
#' - **`show_*`** controls whether a piece of UI chrome is rendered at all
#'   (e.g. `show_legend`, `show_group_counts`). Toggles visibility of static
#'   elements; nothing the user does at runtime brings them back.
#' - **`enable_*`** controls whether a user *capability* is available
#'   (sorting, filtering, resizing, editing, reordering, exporting, the theme
#'   menu). The associated UI is rendered when the capability is on, hidden
#'   when off.
#'
#' Use this distinction when adding new arguments: render-or-not is `show_`,
#' can-the-user-do-it is `enable_`.
#'
#' @param show_filters `r lifecycle::badge("deprecated")` Use `enable_filters` instead.
#' @param show_legend Show legend
#' @param enable_sort Enable column sorting
#' @param enable_collapse Enable group collapsing
#' @param enable_select Enable row selection
#' @param enable_hover Enable hover effects
#' @param enable_resize Enable column resizing
#' @param enable_export Enable download/export button
#' @param enable_filters Enable per-column filter popovers in column headers.
#' @param enable_reorder_rows Enable drag-and-drop reordering of rows (within a group)
#'   and row-groups (among siblings). Session-only; exported SVG/PNG reflects reorders.
#' @param enable_reorder_columns Enable drag-and-drop reordering of columns (within a
#'   column group) and column-groups (among top-level siblings).
#' @param enable_edit Enable double-click inline editing for text/numeric/label cells
#'   plus a popover editor for forest-cell numerics.
#' @param show_group_counts Show `(n)` after each row-group label. Default `FALSE`.
#' @param tooltip_fields Character vector of column names to show in hover tooltip (NULL = no tooltip)
#' @param enable_themes Control theme selection menu:
#'   - `"default"` (default): Enable theme menu with all `package_themes()`
#'   - `NULL`: Disable theme selection entirely (hide menu icon)
#'   - A list of WebTheme objects: Enable theme menu with only the specified themes
#'
#' @return An InteractionSpec object
#' @export
web_interaction <- function(
    show_legend = TRUE,
    enable_sort = TRUE,
    enable_collapse = TRUE,
    enable_select = TRUE,
    enable_hover = TRUE,
    enable_resize = TRUE,
    enable_export = TRUE,
    enable_filters = TRUE,
    enable_reorder_rows = TRUE,
    enable_reorder_columns = TRUE,
    enable_edit = TRUE,
    show_group_counts = FALSE,
    tooltip_fields = NULL,
    enable_themes = getOption("tabviz.enable_themes", "default"),
    show_filters = lifecycle::deprecated()) {
  if (lifecycle::is_present(show_filters)) {
    lifecycle::deprecate_warn("0.9.0", "web_interaction(show_filters)", "web_interaction(enable_filters)")
    if (isTRUE(show_filters)) enable_filters <- TRUE
  } else {
    show_filters <- FALSE
  }
  InteractionSpec(
    show_filters = show_filters,
    show_legend = show_legend,
    enable_sort = enable_sort,
    enable_collapse = enable_collapse,
    enable_select = enable_select,
    enable_hover = enable_hover,
    enable_resize = enable_resize,
    enable_export = enable_export,
    enable_filters = enable_filters,
    enable_reorder_rows = enable_reorder_rows,
    enable_reorder_columns = enable_reorder_columns,
    enable_edit = enable_edit,
    show_group_counts = show_group_counts,
    tooltip_fields = tooltip_fields,
    enable_themes = enable_themes
  )
}

#' @rdname web_interaction
#' @export
web_interaction_minimal <- function() {
  web_interaction(
    show_legend = TRUE,
    enable_sort = FALSE,
    enable_collapse = FALSE,
    enable_select = FALSE,
    enable_hover = TRUE,
    enable_resize = FALSE,
    enable_export = FALSE,
    enable_filters = FALSE,
    enable_reorder_rows = FALSE,
    enable_reorder_columns = FALSE,
    enable_edit = FALSE
  )
}

#' @rdname web_interaction
#' @export
web_interaction_publication <- function() {
  web_interaction(
    show_legend = FALSE,
    enable_sort = FALSE,
    enable_collapse = FALSE,
    enable_select = FALSE,
    enable_hover = FALSE,
    enable_resize = FALSE,
    enable_export = FALSE,
    enable_filters = FALSE,
    enable_reorder_rows = FALSE,
    enable_reorder_columns = FALSE,
    enable_edit = FALSE
  )
}

#' Choose a sensible default `InteractionSpec` based on the theme
#'
#' Every shipped theme — dashboard or publication — defaults to
#' `web_interaction_full()` so users get a consistent, interactive widget
#' out of the box. Users who want the quiet, print-ready preset can pass
#' `interaction = web_interaction_publication()` (or `web_interaction_minimal()`)
#' explicitly.
#'
#' @param theme A `WebTheme` object (unused; retained for API stability).
#' @return An `InteractionSpec` with full interactivity.
#' @keywords internal
#' @export
default_interaction_for_theme <- function(theme) {
  web_interaction_full()
}

#' @rdname web_interaction
#' @export
web_interaction_full <- function() {
  # All interactivity on — drag rows/columns, sort, filter, edit cells, WYSIWYG export.
  web_interaction(
    show_legend = TRUE,
    enable_sort = TRUE,
    enable_collapse = TRUE,
    enable_select = TRUE,
    enable_hover = TRUE,
    enable_resize = TRUE,
    enable_export = TRUE,
    enable_filters = TRUE,
    enable_reorder_rows = TRUE,
    enable_reorder_columns = TRUE,
    enable_edit = TRUE
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
#' Defines a single bar effect for `viz_bar()` columns.
#' Used to display multiple bars per row (grouped bars).
#'
#' @param value Column name containing the bar value
#' @param label Display label (defaults to value column name)
#' @param color Color for this bar (optional)
#' @param opacity Bar opacity from 0 to 1 (optional)
#'
#' @return A VizBarEffect object
#' @export
effect_bar <- function(value, label = NULL, color = NULL, opacity = NULL) {
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
#' @param opacity Fill opacity (0-1)
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
    opacity = new_property(class_numeric, default = 0.7)
  ),
  validator = function(self) {
    # Must have either data OR all five summary stats
    has_data <- !is.na(self@data)
    has_stats <- !is.na(self@min) && !is.na(self@q1) && !is.na(self@median) &&
                 !is.na(self@q3) && !is.na(self@max)

    if (!has_data && !has_stats) {
      return("Must provide either 'data' column or all five summary stats (min, q1, median, q3, max)")
    }

    if (self@opacity < 0 || self@opacity > 1) {
      return("opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a boxplot effect specification
#'
#' Defines a boxplot effect for `viz_boxplot()` columns. Use either `data`
#' for raw array data (quartiles computed automatically), or provide
#' pre-computed summary statistics.
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
#' @param opacity Fill opacity from 0 to 1 (default 0.7). Matches the
#'   `opacity` argument on `effect_forest()` / `effect_bar()`.
#' @param fill_opacity `r lifecycle::badge("deprecated")` Use `opacity`.
#'
#' @return A VizBoxplotEffect object
#' @export
effect_boxplot <- function(
    data = NULL,
    min = NULL, q1 = NULL, median = NULL, q3 = NULL, max = NULL,
    outliers = NULL,
    label = NULL,
    color = NULL,
    opacity = 0.7,
    fill_opacity = lifecycle::deprecated()) {
  if (lifecycle::is_present(fill_opacity)) {
    lifecycle::deprecate_warn(
      "0.9.0", "effect_boxplot(fill_opacity)", "effect_boxplot(opacity)"
    )
    opacity <- fill_opacity
  }
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
    opacity = opacity
  )
}

#' VizViolinEffect: Specification for a violin effect
#'
#' @param data Column name containing array data (required)
#' @param label Display label for this effect
#' @param color Fill color for the violin
#' @param opacity Fill opacity (0-1)
#'
#' @export
VizViolinEffect <- new_class(
  "VizViolinEffect",
  properties = list(
    data = class_character,
    label = new_property(class_character, default = NA_character_),
    color = new_property(class_character, default = NA_character_),
    opacity = new_property(class_numeric, default = 0.5)
  ),
  validator = function(self) {
    if (self@opacity < 0 || self@opacity > 1) {
      return("opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a violin effect specification
#'
#' Defines a violin effect for `viz_violin()` columns. Requires array data
#' column for KDE computation.
#'
#' @param data Column name containing array data (required)
#' @param label Display label (optional)
#' @param color Fill color for the violin (optional)
#' @param opacity Fill opacity from 0 to 1 (default 0.5). Matches the
#'   `opacity` argument on `effect_forest()` / `effect_bar()`.
#' @param fill_opacity `r lifecycle::badge("deprecated")` Use `opacity`.
#'
#' @return A VizViolinEffect object
#' @export
effect_violin <- function(data, label = NULL, color = NULL, opacity = 0.5,
                          fill_opacity = lifecycle::deprecated()) {
  if (lifecycle::is_present(fill_opacity)) {
    lifecycle::deprecate_warn(
      "0.9.0", "effect_violin(fill_opacity)", "effect_violin(opacity)"
    )
    opacity <- fill_opacity
  }
  VizViolinEffect(
    data = data,
    label = label %||% NA_character_,
    color = color %||% NA_character_,
    opacity = opacity
  )
}

# ============================================================================
# Viz Column Helper Functions
# ============================================================================

#' Validate and serialize annotations for viz_* columns
#'
#' Common helper used by `viz_bar()`, `viz_boxplot()`, `viz_violin()` (and
#' could replace `viz_forest()`'s inline logic). Handles three things:
#' 1. Validates that `annotations` is a list of `ReferenceLine` /
#'    `CustomAnnotation` objects.
#' 2. If `null_value` is non-NULL, prepends a synthetic `refline(null_value)`
#'    to the annotations list (theme-default style).
#' 3. Serializes via `serialize_annotation()`.
#'
#' Returns NULL if there are no annotations to ship (so JSON omits the field).
#'
#' @keywords internal
prepare_viz_annotations <- function(annotations, null_value = NULL) {
  if (!is.null(null_value)) {
    checkmate::assert_number(null_value, finite = TRUE)
  }
  if (is.null(annotations)) annotations <- list()
  if (!is.list(annotations)) {
    cli_abort("{.arg annotations} must be a list of annotation objects (e.g. {.fn refline}).")
  }

  # Validate types
  for (i in seq_along(annotations)) {
    a <- annotations[[i]]
    if (!(S7_inherits(a, ReferenceLine) || S7_inherits(a, CustomAnnotation))) {
      cli_abort(c(
        "All elements of {.arg annotations} must be {.fn refline} or {.fn forest_annotation} objects.",
        "i" = "Element {i} is {.cls {class(a)[[1]]}}"
      ))
    }
  }

  # null_value: prepend a synthetic refline using theme-default style.
  # We pass NA color so the renderer falls back to its theme default.
  if (!is.null(null_value)) {
    null_refline <- ReferenceLine(
      x = null_value,
      label = NA_character_,
      style = "dashed",
      color = NA_character_,
      width = 1,
      opacity = 0.6
    )
    annotations <- c(list(null_refline), annotations)
  }

  if (length(annotations) == 0) return(NULL)
  lapply(annotations, serialize_annotation)
}

#' Visualization column: Bar chart
#'
#' Renders horizontal bar charts with support for multiple effects (grouped bars).
#' Each row displays one or more bars based on data values.
#'
#' @param ... One or more `effect_bar()` objects defining the bars to display.
#'   Additional `web_col()` styling arguments may follow as named arguments —
#'   see "Passthrough arguments" below.
#' @param header Column header label. Defaults to `NULL`, which resolves to
#'   the primary effect's label (or the first effect's field name).
#' @param show_header Whether to render the header cell above the chart.
#'   Defaults to `TRUE`. Set to `FALSE` to hide the header.
#' @param header_align Header text alignment (`"left"`, `"center"`, `"right"`).
#'   Defaults to `"center"` to match the other `viz_*()` columns.
#' @param width Column width in pixels (default `NULL` = auto)
#' @param scale Scale type: "linear" (default) or "log"
#' @param axis_range Numeric vector of length 2 specifying axis range c(min, max).
#'   If NULL (default), range is computed automatically from data.
#' @param axis_ticks Numeric vector of explicit tick positions. If NULL (default),
#'   ticks are computed automatically.
#' @param axis_gridlines Show gridlines at tick positions (default FALSE)
#' @param axis_label Label for the x-axis (default "Value")
#' @param show_axis Show the x-axis (default TRUE)
#' @param null_value Optional numeric reference value. When non-NULL, a dashed
#'   reference line is drawn at this x position — useful for marking a baseline,
#'   target, or threshold. Implemented as a synthetic [refline()] prepended to
#'   `annotations`.
#' @param annotations Optional list of annotation objects (currently
#'   [refline()] is supported on bar columns; [forest_annotation()] is
#'   forest-specific and ignored here).
#'
#' @details
#' # Passthrough arguments
#' Named styling arguments passed via `...` (after the `effect_bar()` items)
#' are forwarded to [web_col()]: `bold`, `italic`, `color`, `bg`, `badge`,
#' `icon`, `emphasis`, `muted`, `accent`. Cell-level args ignored by viz
#' columns: `na_text` (rows with no valid data are silently skipped, not
#' filled with text), `tooltip` (no per-cell tooltip yet), `formatter`
#' (would conflict with graphical rendering).
#'
#' # Forest-only features (not available here)
#' These exist on [viz_forest()] only:
#' - `shared_axis` (split-table axis sharing)
#' - per-row `marker_shape` and `marker_size` (forest marker glyph only)
#'
#' Sorting is forced off (`sortable = FALSE`) for all viz columns —
#' sort-by-graphic has no defined order.
#'
#' @return A ColumnSpec object with type = "viz_bar"
#' @export
#'
#' @examples
#' # Single bar per row
#' viz_bar(effect_bar("value"))
#'
#' # Multiple bars per row (grouped)
#' viz_bar(
#'   effect_bar("baseline", label = "Baseline", color = "#3b82f6"),
#'   effect_bar("followup", label = "Follow-up", color = "#22c55e")
#' )
viz_bar <- function(
    ...,
    header = NULL,
    show_header = TRUE,
    header_align = "center",
    width = NULL,
    scale = c("linear", "log"),
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    axis_label = "Value",
    show_axis = TRUE,
    null_value = NULL,
    annotations = NULL) {

  checkmate::assert_flag(show_header)
  checkmate::assert_choice(header_align, c("left", "center", "right"), null.ok = TRUE)
  scale <- match.arg(scale)

  # Separate positional effect_bar() items from named styling args forwarded via `...`
  all_args <- list(...)
  arg_names <- names(all_args) %||% rep("", length(all_args))
  is_named <- nzchar(arg_names)
  effects <- all_args[!is_named]
  passthrough <- all_args[is_named]

  # Validate effects
  if (length(effects) == 0) {
    cli_abort("viz_bar requires at least one effect_bar()")
  }

  for (i in seq_along(effects)) {
    if (!S7_inherits(effects[[i]], VizBarEffect)) {
      cli_abort(c(
        "All positional arguments to viz_bar must be {.fn effect_bar} objects",
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

  serialized_annotations <- prepare_viz_annotations(annotations, null_value)

  opts <- list(
    vizBar = list(
      type = "bar",
      effects = serialized_effects,
      scale = scale,
      axisRange = axis_range,
      axisTicks = axis_ticks,
      axisGridlines = axis_gridlines,
      axisLabel = axis_label,
      showAxis = show_axis,
      annotations = serialized_annotations
    )
  )

  # Synthetic field name
  synthetic_field <- paste0("_viz_bar_", effects[[1]]@value)

  first_label <- effects[[1]]@label
  viz_fallback <- if (!is.na(first_label) && nzchar(first_label)) first_label else effects[[1]]@value
  resolved_header <- if (is.null(header)) viz_fallback else as.character(header)

  do.call(web_col, c(
    list(
      synthetic_field,
      header = resolved_header,
      show_header = show_header,
      header_align = header_align,
      type = "viz_bar",
      width = width,
      sortable = FALSE,
      options = opts
    ),
    passthrough
  ))
}

#' Visualization column: Box plot
#'
#' Renders box-and-whisker plots. Supports either raw array data (quartiles
#' computed automatically) or pre-computed summary statistics.
#'
#' @param ... One or more `effect_boxplot()` objects defining the boxplots.
#'   Additional `web_col()` styling arguments may follow as named arguments —
#'   see "Passthrough arguments" below.
#' @param header Column header label. Defaults to `NULL`, which resolves to
#'   the primary effect's label (or data field name).
#' @param show_header Whether to render the header cell above the chart.
#'   Defaults to `TRUE`. Set to `FALSE` to hide the header.
#' @param header_align Header text alignment (`"left"`, `"center"`, `"right"`).
#'   Defaults to `"center"` — box plots are symmetric around their median,
#'   so a centered label reads most naturally above the axis.
#' @param width Column width in pixels (default `NULL` = auto)
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
#' @param null_value Optional numeric reference value. When non-NULL, a dashed
#'   reference line is drawn at this x position. Implemented as a synthetic
#'   [refline()] prepended to `annotations`.
#' @param annotations Optional list of annotation objects (currently
#'   [refline()] is supported on boxplot columns; [forest_annotation()] is
#'   forest-specific and ignored here).
#'
#' @details
#' # Passthrough arguments
#' Named styling arguments passed via `...` (after the `effect_boxplot()` items)
#' are forwarded to [web_col()]: `bold`, `italic`, `color`, `bg`, `badge`,
#' `icon`, `emphasis`, `muted`, `accent`. Cell-level args ignored by viz
#' columns: `na_text`, `tooltip`, `formatter` (see [viz_bar()] for details).
#'
#' # Forest-only features (not available here)
#' These exist on [viz_forest()] only:
#' - `shared_axis` (split-table axis sharing)
#' - per-row `marker_shape` and `marker_size` (forest marker glyph only)
#'
#' Sorting is forced off (`sortable = FALSE`).
#'
#' @return A ColumnSpec object with type = "viz_boxplot"
#' @export
#'
#' @examples
#' # Boxplot from array data (quartiles computed automatically)
#' viz_boxplot(effect_boxplot(data = "values"))
#'
#' # Boxplot from pre-computed statistics
#' viz_boxplot(effect_boxplot(
#'   min = "min_val", q1 = "q1_val", median = "median_val",
#'   q3 = "q3_val", max = "max_val"
#' ))
#'
#' # Multiple boxplots per row
#' viz_boxplot(
#'   effect_boxplot(data = "group_a", label = "Group A", color = "#3b82f6"),
#'   effect_boxplot(data = "group_b", label = "Group B", color = "#22c55e")
#' )
viz_boxplot <- function(
    ...,
    header = NULL,
    show_header = TRUE,
    header_align = "center",
    width = NULL,
    scale = c("linear", "log"),
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    show_outliers = TRUE,
    whisker_type = c("iqr", "minmax"),
    axis_label = "Value",
    show_axis = TRUE,
    null_value = NULL,
    annotations = NULL) {

  checkmate::assert_flag(show_header)
  checkmate::assert_choice(header_align, c("left", "center", "right"), null.ok = TRUE)
  scale <- match.arg(scale)
  whisker_type <- match.arg(whisker_type)

  # Separate positional effect_boxplot() items from named styling args via `...`
  all_args <- list(...)
  arg_names <- names(all_args) %||% rep("", length(all_args))
  is_named <- nzchar(arg_names)
  effects <- all_args[!is_named]
  passthrough <- all_args[is_named]

  # Validate effects
  if (length(effects) == 0) {
    cli_abort("viz_boxplot requires at least one effect_boxplot()")
  }

  for (i in seq_along(effects)) {
    if (!S7_inherits(effects[[i]], VizBoxplotEffect)) {
      cli_abort(c(
        "All positional arguments to viz_boxplot must be {.fn effect_boxplot} objects",
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
      opacity = e@opacity
    )
  })

  serialized_annotations <- prepare_viz_annotations(annotations, null_value)

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
      showAxis = show_axis,
      annotations = serialized_annotations
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

  first_label <- first_effect@label
  viz_fallback <- if (!is.na(first_label) && nzchar(first_label)) first_label else first_field
  resolved_header <- if (is.null(header)) viz_fallback else as.character(header)

  do.call(web_col, c(
    list(
      synthetic_field,
      header = resolved_header,
      show_header = show_header,
      header_align = header_align,
      type = "viz_boxplot",
      width = width,
      sortable = FALSE,
      options = opts
    ),
    passthrough
  ))
}

#' Visualization column: Violin plot
#'
#' Renders violin plots (kernel density estimation). Requires raw array data
#' for each row.
#'
#' @param ... One or more `effect_violin()` objects defining the violins.
#'   Additional `web_col()` styling arguments may follow as named arguments —
#'   see "Passthrough arguments" below.
#' @param header Column header label. Defaults to `NULL`, which resolves to
#'   the primary effect's label (or data field name).
#' @param show_header Whether to render the header cell above the chart.
#'   Defaults to `TRUE`. Set to `FALSE` to hide the header.
#' @param header_align Header text alignment (`"left"`, `"center"`, `"right"`).
#'   Defaults to `"center"` — violins are symmetric around their median,
#'   so a centered label reads most naturally above the axis.
#' @param width Column width in pixels (default `NULL` = auto)
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
#' @param null_value Optional numeric reference value. When non-NULL, a dashed
#'   reference line is drawn at this x position. Implemented as a synthetic
#'   [refline()] prepended to `annotations`.
#' @param annotations Optional list of annotation objects (currently
#'   [refline()] is supported on violin columns; [forest_annotation()] is
#'   forest-specific and ignored here).
#'
#' @details
#' # Passthrough arguments
#' Named styling arguments passed via `...` (after the `effect_violin()` items)
#' are forwarded to [web_col()]: `bold`, `italic`, `color`, `bg`, `badge`,
#' `icon`, `emphasis`, `muted`, `accent`. Cell-level args ignored by viz
#' columns: `na_text`, `tooltip`, `formatter` (see [viz_bar()] for details).
#'
#' # Forest-only features (not available here)
#' These exist on [viz_forest()] only:
#' - `shared_axis` (split-table axis sharing)
#' - per-row `marker_shape` and `marker_size` (forest marker glyph only)
#'
#' Sorting is forced off (`sortable = FALSE`).
#'
#' @return A ColumnSpec object with type = "viz_violin"
#' @export
#'
#' @examples
#' # Single violin per row
#' viz_violin(effect_violin(data = "values"))
#'
#' # Multiple violins per row
#' viz_violin(
#'   effect_violin(data = "treatment", label = "Treatment", color = "#3b82f6"),
#'   effect_violin(data = "control", label = "Control", color = "#22c55e"),
#'   show_median = TRUE,
#'   show_quartiles = TRUE
#' )
viz_violin <- function(
    ...,
    header = NULL,
    show_header = TRUE,
    header_align = "center",
    width = NULL,
    scale = c("linear", "log"),
    axis_range = NULL,
    axis_ticks = NULL,
    axis_gridlines = FALSE,
    bandwidth = NULL,
    show_median = TRUE,
    show_quartiles = FALSE,
    axis_label = "Value",
    show_axis = TRUE,
    null_value = NULL,
    annotations = NULL) {

  checkmate::assert_flag(show_header)
  checkmate::assert_choice(header_align, c("left", "center", "right"), null.ok = TRUE)
  scale <- match.arg(scale)

  # Separate positional effect_violin() items from named styling args via `...`
  all_args <- list(...)
  arg_names <- names(all_args) %||% rep("", length(all_args))
  is_named <- nzchar(arg_names)
  effects <- all_args[!is_named]
  passthrough <- all_args[is_named]

  # Validate effects
  if (length(effects) == 0) {
    cli_abort("viz_violin requires at least one effect_violin()")
  }

  for (i in seq_along(effects)) {
    if (!S7_inherits(effects[[i]], VizViolinEffect)) {
      cli_abort(c(
        "All positional arguments to viz_violin must be {.fn effect_violin} objects",
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
      opacity = e@opacity
    )
  })

  serialized_annotations <- prepare_viz_annotations(annotations, null_value)

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
      showAxis = show_axis,
      annotations = serialized_annotations
    )
  )

  # Synthetic field name
  synthetic_field <- paste0("_viz_violin_", effects[[1]]@data)

  first_label <- effects[[1]]@label
  viz_fallback <- if (!is.na(first_label) && nzchar(first_label)) first_label else effects[[1]]@data
  resolved_header <- if (is.null(header)) viz_fallback else as.character(header)

  do.call(web_col, c(
    list(
      synthetic_field,
      header = resolved_header,
      show_header = show_header,
      header_align = header_align,
      type = "viz_violin",
      width = width,
      sortable = FALSE,
      options = opts
    ),
    passthrough
  ))
}
