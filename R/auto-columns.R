# Auto-columns — the zero-config first run (roadmap area I, 2026-06-11).
#
# `tabviz(df)` with no `columns` infers sensible col_* choices from the
# data so the first table is genuinely good, not empty. Heuristics are
# deliberately CONSERVATIVE (the versatility-H2 intent): obvious wins
# only; anything ambiguous falls back to text/numeric. Explicit
# `columns` always wins — inference never overrides an author.

# Title Case a snake/dot/camel field name: "event_rate" -> "Event Rate".
.auto_header <- function(name) {
  s <- gsub("[_.]+", " ", name)
  s <- gsub("(?<=[a-z0-9])(?=[A-Z])", " ", s, perl = TRUE)
  s <- tolower(s)
  gsub("\\b([a-z])", "\\U\\1", s, perl = TRUE)
}

# Infer one ColumnSpec for a data column. `label_field` is skipped by the
# caller (it becomes the label column).
.infer_column <- function(values, name) {
  header <- .auto_header(name)
  nm <- tolower(name)
  if (inherits(values, "Date") || inherits(values, "POSIXt")) {
    return(col_date(name, header))
  }
  if (is.numeric(values)) {
    finite <- values[is.finite(values)]
    # p-values: name says so AND the values agree.
    if (grepl("^p$|^p[._ ]?val(ue)?s?$", nm) &&
        length(finite) > 0L && all(finite >= 0 & finite <= 1)) {
      return(col_pvalue(name, header = "P-value"))
    }
    # Proportions: 0..1 values with a telling name -> percent.
    if (length(finite) > 0L && all(finite >= 0 & finite <= 1) &&
        grepl("rate|pct|percent|prop|share|frac", nm)) {
      return(col_percent(name, header))
    }
    # Counts: integral values with a count-ish name -> no decimals.
    if (length(finite) > 0L && all(finite == round(finite)) &&
        grepl("^n$|^n[._]|count|total|events", nm)) {
      return(col_numeric(name, header, decimals = 0))
    }
    return(col_numeric(name, header))
  }
  # character / factor / logical / everything else: text.
  col_text(name, header)
}

#' @noRd
infer_columns <- function(data, exclude = character(0)) {
  fields <- setdiff(names(data), exclude)
  # Internal/bookkeeping fields never become columns: dunder-wrapped
  # names (__row_number__) and dot-prefixed names (.hidden).
  fields <- fields[!grepl("^__.*__$|^\\.", fields)]
  cols <- lapply(fields, function(f) .infer_column(data[[f]], f))
  cli::cli_inform(
    c("i" = "No {.arg columns} given: inferred {length(cols)} column{?s} from the data ({.fn col_text}/{.fn col_numeric}/{.fn col_percent}/{.fn col_pvalue}/{.fn col_date} by type and name).",
      " " = "Pass {.arg columns} to take control."),
    .frequency = "once", .frequency_id = "tabviz_auto_columns"
  )
  cols
}
