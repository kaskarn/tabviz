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
#' @examples
#' \dontrun{
#' # Split by a single variable
#' data |>
#'   web_spec(point = "or", lower = "lower", upper = "upper") |>
#'   split_forest(by = "region")
#'
#' # Split by multiple variables (hierarchical navigation)
#' data |>
#'   web_spec(point = "or", lower = "lower", upper = "upper") |>
#'   split_forest(by = c("sex", "age_group"))
#'
#' # With shared axis for easier comparison
#' data |>
#'   web_spec(point = "or", lower = "lower", upper = "upper") |>
#'   split_forest(by = "treatment_arm", shared_axis = TRUE)
#' }
#'
#' @export
split_forest <- function(x, by, shared_axis = FALSE, ...) {
  # Handle input type

  if (S7_inherits(x, WebSpec)) {
    base_spec <- x
  } else if (is.data.frame(x)) {
    base_spec <- web_spec(x, ...)
  } else {
    cli_abort("{.arg x} must be a WebSpec object or data frame")
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

  # Compute shared axis range if requested
  axis_range <- c(NA_real_, NA_real_)
  if (shared_axis) {
    all_lower <- unlist(lapply(specs, function(s) s@data[[s@lower_col]]))
    all_upper <- unlist(lapply(specs, function(s) s@data[[s@upper_col]]))
    all_point <- unlist(lapply(specs, function(s) s@data[[s@point_col]]))

    axis_range <- c(
      min(c(all_lower, all_point), na.rm = TRUE),
      max(c(all_upper, all_point), na.rm = TRUE)
    )

    # Apply to each spec's theme axis config
    for (key in names(specs)) {
      specs[[key]]@theme@axis@range_min <- axis_range[1]
      specs[[key]]@theme@axis@range_max <- axis_range[2]
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
    point_col = base_spec@point_col,
    lower_col = base_spec@lower_col,
    upper_col = base_spec@upper_col,
    label_col = base_spec@label_col,
    label_header = base_spec@label_header,
    group_col = base_spec@group_col,
    group_cols = base_spec@group_cols,
    columns = base_spec@columns,
    groups = filtered_groups,
    summaries = filtered_summaries,
    # overall_summary is not set - uses default (missing)
    scale = base_spec@scale,
    null_value = base_spec@null_value,
    axis_label = base_spec@axis_label,
    effects = base_spec@effects,
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
