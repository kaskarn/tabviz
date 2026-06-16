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
      # jsonlite serializes named lists as JSON objects; TS expects an
      # array, so drop names via `unname()`. Filter to only the effect
      # fields the TS consumer reads — cuts wire payload by ~10x at
      # typical fixture widths.
      axis_fields <- .fields_needed_for_axis(forest_col)
      ts_input <- list(
        subsets = lapply(unname(specs), .subset_payload_for_shared, fields = axis_fields)
      )
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
    # Filter the wire payload to only the auto-width column fields the
    # TS consumer reads.
    width_fields <- .fields_needed_for_widths(base_spec@columns)
    ts_input <- list(
      subsets = lapply(unname(specs), .subset_payload_for_shared, fields = width_fields)
    )
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
#' @noRd
# Build the minimal payload `srcjs/src/lib/split-shared.ts` expects from each
# subset. Data is sent **column-major** (one vector per field) and is
# further narrowed via `fields` to only the columns the consumer reads —
# computeSharedAxis only touches effect fields (point/lower/upper);
# computeSharedWidths only touches auto-width column fields. At a 5k-row
# 10-col fixture this cuts wire bytes ~10x and keeps the V8 round-trip
# overhead sub-perceptible. NULL `fields` ships everything (used by
# callers that prefer to filter TS-side or are scale-bounded).
.subset_payload_for_shared <- function(spec, fields = NULL) {
  df <- spec@data
  data_cols <- as.list(df)
  if (!is.null(fields)) {
    data_cols <- data_cols[intersect(names(data_cols), fields)]
  }
  col_payload <- lapply(.flatten_column_specs(spec@columns), function(c) {
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
    data = list(columns = data_cols),
    columns = col_payload,
    theme = list(axis = list(
      ciClipFactor = if (!is.null(spec@theme@axis@ci_clip_factor)) spec@theme@axis@ci_clip_factor else 3.0
    ))
  )
}

# Fields read by computeSharedAxis from each subset: the forest column's
# point/lower/upper, plus any multi-effect pointCol/lowerCol/upperCol.
.fields_needed_for_axis <- function(forest_col) {
  if (is.null(forest_col) || is.null(forest_col@options$forest)) return(character(0))
  o <- forest_col@options$forest
  fields <- c(o$point, o$lower, o$upper)
  if (!is.null(o$effects) && is.list(o$effects)) {
    for (eff in o$effects) {
      fields <- c(fields, eff$pointCol, eff$lowerCol, eff$upperCol)
    }
  }
  unique(fields[!is.null(fields) & !is.na(fields) & nzchar(fields)])
}

# Fields read by computeSharedWidths from each subset: every auto-width
# column's `field` (skipping viz/forest types, which auto-size from the
# plot rather than text content).
.fields_needed_for_widths <- function(cols) {
  skip <- c("viz_bar", "viz_boxplot", "viz_violin", "forest")
  fields <- character(0)
  for (c in .flatten_column_specs(cols)) {
    if (c@type %in% skip) next
    if (is.numeric(c@width) && !is.na(c@width)) next
    if (length(c@field) == 0 || is.na(c@field) || !nzchar(c@field)) next
    fields <- c(fields, c@field)
  }
  unique(fields)
}

# Flatten a column list: replace each ColumnGroup with its inner
# columns, recursively. The shared-axis / shared-widths payloads only
# need ColumnSpec instances; groups are presentational wrappers with no
# @type / @field / @width to forward.
.flatten_column_specs <- function(cols) {
  out <- list()
  for (c in cols) {
    if (S7_inherits(c, ColumnGroup)) {
      out <- c(out, .flatten_column_specs(c@columns))
    } else {
      out <- c(out, list(c))
    }
  }
  out
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

  # CLONE the base spec, then override ONLY the per-subset fields. Every other
  # field — label_column, the marker_* and row_* style-mapping columns,
  # row_fill_col, details_col, conditions, figure_layout, initial_state,
  # watermark_color/opacity, extra_columns, notes, target_aspect* — is inherited
  # automatically. The previous hand-enumerated copy silently DROPPED 17 fields
  # (R3 review): e.g. `set_marker_style() |> split_table()` produced unstyled
  # markers, and the canonical label_column slot fell back to columns[0]. A
  # clone can't fall out of sync when WebSpec grows a new field. The original
  # call + pagination ride along (carried by the clone). View-source / break-on
  # behavior is unchanged.
  spec <- base_spec
  spec@data <- subset_data
  spec@groups <- filtered_groups
  spec@summaries <- filtered_summaries
  spec@labels <- new_labels
  # overall_summary needs no reset: it has no setter (constructor default only),
  # so the base always carries the default sentinel the clone preserves — exactly
  # what the prior explicit omission produced.
  spec
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
