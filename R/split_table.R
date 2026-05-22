#' Split a forest plot by variable values
#'
#' Creates a collection of separate forest plots, one for each unique value
#' (or combination of values) in the splitting column(s). This is useful for
#' comparing results across subgroups, regions, or other categorical variables.
#'
#' @param x A WebSpec object or data frame. If a data frame, additional arguments
#'   must be provided to specify point/interval columns.
#' @param by Column name(s) for splitting. Can be:
#'   - Single string: Creates one plot per unique value, e.g., `"sex"`
#'   - Character vector: Creates plots for each combination, with hierarchical
#'     navigation, e.
#'   - `c("region", "age_group")` creates Region > Age Group hierarchy
#' @param shared_axis Whether to use the same axis range across all plots.
#'   Default is `FALSE` (each plot auto-scales to its data). Note that even
#'   with `FALSE`, sub-plots often land on near-identical tick sets because
#'   the auto-fit always includes the null value (`include_null = TRUE`) and
#'   pads by `ci_clip_factor`, then snaps to nice round ticks -- so for the
#'   typical forest-plot case (effects clustered around a common null), the
#'   independently-computed axes naturally agree. Set `shared_axis = TRUE`
#'   only when you need a guaranteed single shared range across every plot.
#' @param shared_column_widths Whether every sub-plot uses identical
#'   per-column widths. Default `FALSE` (each plot sizes to its own content).
#'   Set `TRUE` to make stacked screenshots (PowerPoint, slides) line up —
#'   widths are computed once from the combined data and stamped on every
#'   sub-plot's columns.
#' @param ... Additional arguments passed to `web_spec()` if `x` is a data frame.
#'
#' @return A SplitForest object containing multiple WebSpec objects
#'
#' @importFrom lifecycle deprecate_warn
#' @examples
#' \dontrun{
#' # Split by a single variable
#' data |>
#'   tabviz(label = "study", columns = list(
#'     viz_forest(point = "or", lower = "lower", upper = "upper")
#'   )) |>
#'   split_table(by = "region")
#'
#' # Split by multiple variables (hierarchical navigation)
#' data |>
#'   tabviz(label = "study", columns = list(
#'     viz_forest(point = "or", lower = "lower", upper = "upper")
#'   )) |>
#'   split_table(by = c("sex", "age_group"))
#'
#' # With shared axis for easier comparison
#' data |>
#'   tabviz(label = "study", columns = list(
#'     viz_forest(point = "or", lower = "lower", upper = "upper")
#'   )) |>
#'   split_table(by = "treatment_arm", shared_axis = TRUE)
#' }
#'
#' @export
split_table <- function(x, by, shared_axis = FALSE, shared_column_widths = FALSE, ...) {

  # Handle input type
  if (S7_inherits(x, WebSpec)) {
    base_spec <- x
  } else if (inherits(x, "htmlwidget")) {
    # Extract WebSpec from widget (tabviz() attaches it as attribute)
    base_spec <- attr(x, "webspec")
    if (is.null(base_spec) || !S7_inherits(base_spec, WebSpec)) {
      cli_abort("{.arg x} widget does not have a valid WebSpec attached")
    }
  } else if (is.data.frame(x)) {
    base_spec <- web_spec(x, ...)
  } else {
    cli_abort("{.arg x} must be a WebSpec, htmlwidget, or data frame")
  }

  # Validate split columns exist
  data <- base_spec@data
  by <- as.character(by)
  missing_cols <- setdiff(by, names(data))
  if (length(missing_cols) > 0) {
    cli_abort("Split column{?s} not found in data: {.val {missing_cols}}")
  }

  # Build unique combinations of split values
  split_combos <- unique(data[, by, drop = FALSE])
  split_combos <- split_combos[complete.cases(split_combos), , drop = FALSE]

  if (nrow(split_combos) == 0) {
    cli_abort("No valid split combinations found (all values may be NA)")
  }

  # Order by split columns for consistent navigation
  split_combos <- split_combos[do.call(order, as.list(split_combos)), , drop = FALSE]

  # Create WebSpec for each combination
  specs <- list()

  for (i in seq_len(nrow(split_combos))) {
    combo <- split_combos[i, , drop = FALSE]

    # Build filter mask
    mask <- rep(TRUE, nrow(data))
    for (col in by) {
      mask <- mask & (data[[col]] == combo[[col]])
    }

    # Subset data
    subset_data <- data[mask, , drop = FALSE]
    if (nrow(subset_data) == 0) next

    # Build key and label for this split
    values <- vapply(by, function(col) as.character(combo[[col]]), character(1))
    key <- paste(values, collapse = "__")
    label <- paste(values, collapse = " / ")

    # Create spec for this subset (inherit settings from base)
    subset_spec <- create_subset_spec(base_spec, subset_data, label)
    specs[[key]] <- subset_spec
  }

  if (length(specs) == 0) {
    cli_abort("No valid subsets created from split")
  }

  # Find the first forest column to get scale and column names
  forest_col <- NULL
  for (col in base_spec@columns) {
    if (inherits(col, "tabviz::ColumnSpec") && col@type == "forest") {
      forest_col <- col
      break
    }
  }

  # Determine effective shared_axis: column-level overrides split-level
  effective_shared_axis <- shared_axis
  if (!is.null(forest_col) && !is.null(forest_col@options$forest$sharedAxis)) {
    effective_shared_axis <- forest_col@options$forest$sharedAxis
  }

  # Compute shared axis range if requested
  # Respect user-set axis values from base spec
  base_axis <- base_spec@theme@axis
  has_explicit_min <- !is.null(base_axis@range_min) && !is.na(base_axis@range_min)
  has_explicit_max <- !is.null(base_axis@range_max) && !is.na(base_axis@range_max)
  has_explicit_ticks <- !is.null(base_axis@tick_values) && length(base_axis@tick_values) > 0

  # Compute shared products by delegating to the TS authoring builders via
  # the V8 bridge. Keeps the union-data computation in one place (TS) per
  # the TS-first vision: R produces what a JS author would produce, no
  # privileged R-side computation. See `srcjs/src/lib/split-shared.ts` for
  # the algorithms (ported line-by-line from the prior in-R logic).
  axis_range <- c(NA_real_, NA_real_)
  if (effective_shared_axis) {
    if (!has_explicit_min || !has_explicit_max) {
      # jsonlite serializes named lists as JSON objects; the TS function expects
# `subsets` to be an array. Drop names via `unname()` before lapply.
ts_input <- list(subsets = lapply(unname(specs), .subset_payload_for_shared))
      ts_result <- ts_call("computeSharedAxis", ts_input)
      data_range <- c(ts_result$rangeMin, ts_result$rangeMax)
      axis_range <- c(
        if (has_explicit_min) base_axis@range_min else data_range[1],
        if (has_explicit_max) base_axis@range_max else data_range[2]
      )
    } else {
      axis_range <- c(base_axis@range_min, base_axis@range_max)
    }

    # Apply to each spec's theme axis config
    for (key in names(specs)) {
      specs[[key]]@theme@axis@range_min <- axis_range[1]
      specs[[key]]@theme@axis@range_max <- axis_range[2]
      # Also propagate explicit tick values if set
      if (has_explicit_ticks) {
        specs[[key]]@theme@axis@tick_values <- base_axis@tick_values
      }
    }
  }

  # Shared column widths: stamp a single width onto every "auto" column so
  # subsets line up visually when stacked. Computation lives in TS too.
  if (shared_column_widths) {
    # jsonlite serializes named lists as JSON objects; the TS function expects
# `subsets` to be an array. Drop names via `unname()` before lapply.
ts_input <- list(subsets = lapply(unname(specs), .subset_payload_for_shared))
    ts_result <- ts_call("computeSharedWidths", ts_input)
    widths <- ts_result$widths %||% list()

    for (col_idx in seq_along(base_spec@columns)) {
      col <- base_spec@columns[[col_idx]]
      w <- widths[[col@id]]
      if (is.null(w) || !is.numeric(w)) next
      for (s_key in names(specs)) {
        specs[[s_key]]@columns[[col_idx]]@width <- as.integer(w)
      }
    }
  }

  # Build navigation tree
  split_tree <- build_split_tree(by, split_combos)

  SplitForest(
    specs = specs,
    split_vars = by,
    split_tree = split_tree,
    shared_axis = shared_axis,
    shared_column_widths = shared_column_widths,
    axis_range = axis_range
  )
}

#' Create a subset WebSpec from a base spec
#'
#' Internal function to create a new WebSpec with subset data while
#' inheriting configuration from the base spec.
#'
# Build the minimal payload `srcjs/src/lib/split-shared.ts` expects from each
# subset. Data is sent **column-major** (one vector per field via
# `as.list(data.frame)`), matching R's native representation — building
# per-row metadata objects via `lapply(seq_len(nrow), df[i, ])` made the
# 50k-row case run for 22 seconds where the column-major shape runs in
# hundreds of ms. The TS consumer iterates positionally; row-major and
# column-major produce identical answers.
.subset_payload_for_shared <- function(spec) {
  df <- spec@data
  col_payload <- lapply(spec@columns, function(c) {
    list(
      id      = c@id,
      type    = c@type,
      field   = if (length(c@field) > 0 && !is.na(c@field)) c@field else NULL,
      header  = if (length(c@header) > 0 && !is.na(c@header)) c@header else NULL,
      width   = if (identical(c@width, "auto")) "auto" else c@width,
      options = c@options
    )
  })
  list(
    # Column-major: `{[fieldName]: vector}`. `as.list(df)` is O(#cols)
    # in R, irrespective of row count — fast even at 50k rows.
    data = list(columns = as.list(df)),
    columns = col_payload,
    theme = list(axis = list(
      ciClipFactor = if (!is.null(spec@theme@axis@ci_clip_factor)) spec@theme@axis@ci_clip_factor else 3.0
    ))
  )
}

#' Create a subset WebSpec for one split combination
#'
#' Filters the data, adjusts groups, and creates a new WebSpec with
#' the filtered data while preserving the original spec configuration.
#'
#' @param base_spec The original WebSpec
#' @param subset_data The filtered data.frame
#' @param label Title for this subset plot
#'
#' @return A new WebSpec object
#' @keywords internal
create_subset_spec <- function(base_spec, subset_data, label) {
  # Concatenate base title with subset label if base title exists
  base_title <- if (!is.null(base_spec@labels) && !is.na(base_spec@labels@title)) {
    base_spec@labels@title
  } else {
    NULL
  }
  combined_title <- if (!is.null(base_title) && nzchar(base_title)) {
    paste0(base_title, " \u2014 ", label)  # em-dash separator
  } else {
    label
  }

  # Create new labels with combined title
  new_labels <- PlotLabels(
    title = combined_title,
    subtitle = if (!is.null(base_spec@labels) && !is.na(base_spec@labels@subtitle)) {
      base_spec@labels@subtitle
    } else {
      NA_character_
    },
    caption = if (!is.null(base_spec@labels) && !is.na(base_spec@labels@caption)) {
      base_spec@labels@caption
    } else {
      NA_character_
    },
    footnote = if (!is.null(base_spec@labels) && !is.na(base_spec@labels@footnote)) {
      base_spec@labels@footnote
    } else {
      NA_character_
    }
  )

  # Need to filter groups to only those present in subset
  # Get unique group IDs from subset data
  subset_group_ids <- character(0)
  if (!is.na(base_spec@group_col) && base_spec@group_col %in% names(subset_data)) {
    if (length(base_spec@group_cols) > 1) {
      # Hierarchical grouping - build composite IDs
      subset_group_ids <- apply(subset_data[, base_spec@group_cols, drop = FALSE], 1,
                                 function(row) paste(row, collapse = "__"))
    } else {
      subset_group_ids <- as.character(subset_data[[base_spec@group_col]])
    }
    subset_group_ids <- unique(subset_group_ids)
  }

  # Filter groups to only those in subset (and their parents)
  filtered_groups <- list()
  if (length(base_spec@groups) > 0 && length(subset_group_ids) > 0) {
    # First pass: identify all needed groups (including parents)
    needed_ids <- subset_group_ids
    for (g in base_spec@groups) {
      if (g@id %in% subset_group_ids && !is.na(g@parent_id)) {
        needed_ids <- c(needed_ids, g@parent_id)
      }
    }
    needed_ids <- unique(needed_ids)

    # Include parents of parents recursively
    repeat {
      added <- FALSE
      for (g in base_spec@groups) {
        if (g@id %in% needed_ids && !is.na(g@parent_id) && !g@parent_id %in% needed_ids) {
          needed_ids <- c(needed_ids, g@parent_id)
          added <- TRUE
        }
      }
      if (!added) break
    }

    # Second pass: filter groups
    for (g in base_spec@groups) {
      if (g@id %in% needed_ids) {
        filtered_groups <- c(filtered_groups, list(g))
      }
    }
  }

  # Filter summaries to only those for groups in subset
  filtered_summaries <- list()
  if (length(base_spec@summaries) > 0 && length(subset_group_ids) > 0) {
    for (s in base_spec@summaries) {
      if (s@group_id %in% subset_group_ids) {
        filtered_summaries <- c(filtered_summaries, list(s))
      }
    }
  }

  WebSpec(
    data = subset_data,
    group_col = base_spec@group_col,
    group_cols = base_spec@group_cols,
    columns = base_spec@columns,
    groups = filtered_groups,
    summaries = filtered_summaries,
    # overall_summary is not set - uses default (missing)
    theme = base_spec@theme,
    interaction = base_spec@interaction,
    labels = new_labels,
    watermark = base_spec@watermark,
    row_bold_col = base_spec@row_bold_col,
    row_italic_col = base_spec@row_italic_col,
    row_color_col = base_spec@row_color_col,
    row_bg_col = base_spec@row_bg_col,
    row_badge_col = base_spec@row_badge_col,
    row_icon_col = base_spec@row_icon_col,
    row_indent_col = base_spec@row_indent_col,
    row_type_col = base_spec@row_type_col,
    row_emphasis_col = base_spec@row_emphasis_col,
    row_muted_col = base_spec@row_muted_col,
    row_accent_col = base_spec@row_accent_col,
    weight_col = base_spec@weight_col,
    # Carry the base spec's captured original call into every sub-spec so the
    # "View source" panel can show the user's actual `tabviz()` line rather
    # than the `tabviz(...)` placeholder.
    original_call = base_spec@original_call,
    # Pagination cascades to every subview. With `break_on = "split"` (the
    # default), each subview is the page-break boundary by definition; the
    # row-count budget then applies independently within each subview.
    paginate = base_spec@paginate
  )
}

#' Build hierarchical navigation tree from split values
#'
#' Creates a nested list structure for sidebar navigation.
#'
#' @param split_vars Character vector of column names
#' @param split_combos Data frame of unique value combinations
#'
#' @return Nested list with label, key, and children for each node
#' @keywords internal
build_split_tree <- function(split_vars, split_combos) {
  if (length(split_vars) == 1) {
    # Simple flat list
    unique_vals <- unique(as.character(split_combos[[split_vars]]))
    return(lapply(unique_vals, function(v) {
      list(label = v, key = v, children = NULL)
    }))
  }

  # Hierarchical tree for multiple split vars
  build_tree_level(split_vars, split_combos, 1, character(0))
}

#' Recursive helper for building tree levels
#' @keywords internal
build_tree_level <- function(split_vars, split_combos, level, parent_path) {
  if (level > length(split_vars)) return(NULL)

  var <- split_vars[level]

  # Filter to rows matching parent path
  mask <- rep(TRUE, nrow(split_combos))
  if (length(parent_path) > 0) {
    for (i in seq_along(parent_path)) {
      mask <- mask & (as.character(split_combos[[split_vars[i]]]) == parent_path[i])
    }
  }
  filtered <- split_combos[mask, , drop = FALSE]

  # Get unique values at this level
  unique_at_level <- unique(as.character(filtered[[var]]))

  lapply(unique_at_level, function(val) {
    new_path <- c(parent_path, val)
    key <- paste(new_path, collapse = "__")
    children <- build_tree_level(split_vars, split_combos, level + 1, new_path)
    list(
      label = val,
      key = key,
      children = if (length(children) > 0) children else NULL
    )
  })
}

#' Round domain to nice round numbers
#'
#' Matches the JavaScript niceDomain() function for consistency between
#' R-side and JS-side axis calculations.
#'
#' @param domain Numeric vector of length 2: c(min, max)
#' @param is_log Whether this is for a log scale
#'
#' @return A new domain with nice round bounds
#' @keywords internal
nice_domain <- function(domain, is_log) {
  if (is_log) {
    nice_log_domain(domain)
  } else {
    nice_linear_domain(domain)
  }
}

#' Nice values for log scale (matches JS NICE_LOG_VALUES)
#' @keywords internal
NICE_LOG_VALUES <- c(
  0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5,
  0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7,
  8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, 750, 1000
)

#' Extended Wilkinson Q sequence for "nice" tick values
#' @keywords internal
NICE_Q <- c(1, 5, 2, 2.5, 4, 3)

#' Compute nice bounds for log scale
#' @keywords internal
nice_log_domain <- function(domain) {
  # Handle edge cases
  if (domain[1] <= 0 || domain[2] <= 0) {
    return(c(0.1, 10))  # Fallback for invalid log domain
  }
  if (domain[1] >= domain[2]) {
    return(domain)
  }

  # Find nice min (largest nice value <= domain min)
  nice_min <- NICE_LOG_VALUES[1]
  for (val in NICE_LOG_VALUES) {
    if (val <= domain[1]) {
      nice_min <- val
    } else {
      break
    }
  }

  # Handle values smaller than our nice list
  if (domain[1] < NICE_LOG_VALUES[1]) {
    magnitude <- 10^floor(log10(domain[1]))
    nice_min <- magnitude
  }

  # Find nice max (smallest nice value >= domain max)
  nice_max <- NICE_LOG_VALUES[length(NICE_LOG_VALUES)]
  for (i in rev(seq_along(NICE_LOG_VALUES))) {
    if (NICE_LOG_VALUES[i] >= domain[2]) {
      nice_max <- NICE_LOG_VALUES[i]
    } else {
      break
    }
  }

  # Handle values larger than our nice list
  if (domain[2] > NICE_LOG_VALUES[length(NICE_LOG_VALUES)]) {
    magnitude <- 10^ceiling(log10(domain[2]))
    nice_max <- magnitude
  }

  c(nice_min, nice_max)
}

#' Compute nice bounds for linear scale using Extended Wilkinson approach
#' @keywords internal
nice_linear_domain <- function(domain) {
  span <- domain[2] - domain[1]

  # Handle edge cases
  if (span == 0) {
    return(domain)
  }
  if (span < 0) {
    return(c(domain[2], domain[1]))  # Swap if inverted
  }

  # Find a nice step size using Q sequence
  magnitude <- 10^floor(log10(span))
  best_step <- magnitude
  best_score <- Inf

  # Try each Q value at current and adjacent magnitudes
  for (q in NICE_Q) {
    for (scale in c(0.1, 1, 10)) {
      step <- q * magnitude * scale
      if (step <= 0) next

      candidate_min <- floor(domain[1] / step) * step
      candidate_max <- ceiling(domain[2] / step) * step
      candidate_span <- candidate_max - candidate_min

      # Score: prefer steps that don't expand the domain too much
      expansion <- candidate_span / span - 1
      if (expansion >= 0 && expansion < best_score) {
        best_score <- expansion
        best_step <- step
      }
    }
  }

  nice_min <- floor(domain[1] / best_step) * best_step
  nice_max <- ceiling(domain[2] / best_step) * best_step

  # Round to fix floating point precision issues
  c(round(nice_min * 1e10) / 1e10, round(nice_max * 1e10) / 1e10)
}
