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
#'   Default is `FALSE` (each plot auto-scales to its data).
#' @param ... Additional arguments passed to `web_spec()` if `x` is a data frame.
#'
#' @return A SplitForest object containing multiple WebSpec objects
#'
#' @importFrom lifecycle deprecate_warn
#' @examples
#' \dontrun{
#' # Split by a single variable
#' data |>
#'   web_spec(point = "or", lower = "lower", upper = "upper") |>
#'   split_table(by = "region")
#'
#' # Split by multiple variables (hierarchical navigation)
#' data |>
#'   web_spec(point = "or", lower = "lower", upper = "upper") |>
#'   split_table(by = c("sex", "age_group"))
#'
#' # With shared axis for easier comparison
#' data |>
#'   web_spec(point = "or", lower = "lower", upper = "upper") |>
#'   split_table(by = "treatment_arm", shared_axis = TRUE)
#' }
#'
#' @export
split_table <- function(x, by, shared_axis = FALSE, ...) {

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

  axis_range <- c(NA_real_, NA_real_)
  if (effective_shared_axis) {
    # Only calculate from data if user didn't set explicit values
    if (!has_explicit_min || !has_explicit_max) {

      # Collect effect values from forest column and effects list
      all_lower <- c()
      all_upper <- c()
      all_point <- c()

      # Get values from forest column's point/lower/upper if defined
      if (!is.null(forest_col) && !is.null(forest_col@options$forest)) {
        fc_opts <- forest_col@options$forest

        # Single effect mode: point/lower/upper columns
        if (!is.null(fc_opts$point)) {
          for (s in specs) {
            all_point <- c(all_point, s@data[[fc_opts$point]])
          }
        }
        if (!is.null(fc_opts$lower)) {
          for (s in specs) {
            all_lower <- c(all_lower, s@data[[fc_opts$lower]])
          }
        }
        if (!is.null(fc_opts$upper)) {
          for (s in specs) {
            all_upper <- c(all_upper, s@data[[fc_opts$upper]])
          }
        }

        # Multi-effect mode: effects list in forest column options
        if (!is.null(fc_opts$effects) && is.list(fc_opts$effects)) {
          for (effect in fc_opts$effects) {
            for (s in specs) {
              if (!is.null(effect$pointCol) && effect$pointCol %in% names(s@data)) {
                all_point <- c(all_point, s@data[[effect$pointCol]])
              }
              if (!is.null(effect$lowerCol) && effect$lowerCol %in% names(s@data)) {
                all_lower <- c(all_lower, s@data[[effect$lowerCol]])
              }
              if (!is.null(effect$upperCol) && effect$upperCol %in% names(s@data)) {
                all_upper <- c(all_upper, s@data[[effect$upperCol]])
              }
            }
          }
        }
      }

      # Get clip factor and scale from forest column or theme
      ci_clip_factor <- base_axis@ci_clip_factor %||% 3.0
      is_log <- if (!is.null(forest_col) && !is.null(forest_col@options$forest$scale)) {
        forest_col@options$forest$scale == "log"
      } else {
        FALSE
      }
      null_value <- if (!is.null(forest_col) && !is.null(forest_col@options$forest$nullValue)) {
        forest_col@options$forest$nullValue
      } else if (is_log) {
        1
      } else {
        0
      }

      # Filter out non-positive values for log scale (they can't be displayed)
      if (is_log) {
        all_point <- all_point[!is.na(all_point) & all_point > 0]
        all_lower <- all_lower[!is.na(all_lower) & all_lower > 0]
        all_upper <- all_upper[!is.na(all_upper) & all_upper > 0]
      }

      # Compute raw estimate range (point estimates + null value)
      raw_min_est <- min(c(all_point, null_value), na.rm = TRUE)
      raw_max_est <- max(c(all_point, null_value), na.rm = TRUE)

      # Handle zero-span case: create reasonable spread
      # For log scale: multiplicative spread (divide/multiply by 2)
      # For linear scale: additive spread (max of 1 or 10% of value)
      if (raw_max_est - raw_min_est == 0) {
        if (is_log) {
          # Multiplicative: keeps values positive for log scale
          raw_min_est <- raw_min_est / 2
          raw_max_est <- raw_max_est * 2
        } else {
          spread <- max(1, abs(raw_min_est) * 0.1)
          raw_min_est <- raw_min_est - spread
          raw_max_est <- raw_max_est + spread
        }
      }

      # Snap estimate range to nice numbers BEFORE calculating clip boundaries
      # This ensures clip boundaries align with the nice-rounded axis limits
      nice_range <- nice_domain(c(raw_min_est, raw_max_est), is_log)
      min_est <- nice_range[1]
      max_est <- nice_range[2]

      # Compute clip boundaries based on scale type
      # For log scale: ci_clip_factor is a direct ratio multiplier
      # For linear scale: ci_clip_factor is a span multiplier
      if (is_log) {
        lower_clip_bound <- min_est / ci_clip_factor
        upper_clip_bound <- max_est * ci_clip_factor
      } else {
        span <- max_est - min_est
        lower_clip_bound <- min_est - span * ci_clip_factor
        upper_clip_bound <- max_est + span * ci_clip_factor
      }

      # Check if any CIs are clipped
      has_clipped_lower <- any(!is.na(all_lower) & all_lower < lower_clip_bound)
      has_clipped_upper <- any(!is.na(all_upper) & all_upper > upper_clip_bound)

      # Include CI bounds that are within clip boundaries
      valid_lower <- all_lower[!is.na(all_lower) & all_lower >= lower_clip_bound]
      valid_upper <- all_upper[!is.na(all_upper) & all_upper <= upper_clip_bound]

      # Extend axis to clip boundary if any CIs are clipped (for arrow visibility)
      data_range <- c(
        min(c(valid_lower, min_est, if (has_clipped_lower) lower_clip_bound), na.rm = TRUE),
        max(c(valid_upper, max_est, if (has_clipped_upper) upper_clip_bound), na.rm = TRUE)
      )

      # Final snap to nice numbers (matches JS axis-utils.ts line 272)
      data_range <- nice_domain(data_range, is_log)

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

  # Build navigation tree
  split_tree <- build_split_tree(by, split_combos)

  SplitForest(
    specs = specs,
    split_vars = by,
    split_tree = split_tree,
    shared_axis = shared_axis,
    axis_range = axis_range
  )
}

#' Create a subset WebSpec from a base spec
#'
#' Internal function to create a new WebSpec with subset data while
#' inheriting configuration from the base spec.
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
    label_col = base_spec@label_col,
    label_header = base_spec@label_header,
    group_col = base_spec@group_col,
    group_cols = base_spec@group_cols,
    columns = base_spec@columns,
    groups = filtered_groups,
    summaries = filtered_summaries,
    # overall_summary is not set - uses default (missing)
    theme = base_spec@theme,
    interaction = base_spec@interaction,
    labels = new_labels,
    annotations = base_spec@annotations,
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
    weight_col = base_spec@weight_col
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

#' @rdname split_table
#' @usage NULL
#' @export
split_forest <- function(...) {
 lifecycle::deprecate_warn("0.4.0", "split_forest()", "split_table()")
 split_table(...)
}
