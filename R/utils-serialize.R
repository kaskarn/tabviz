# Serialization utilities for converting S7 objects to JSON-ready lists

#' Serialize a WebSpec to a JSON-ready list
#'
#' @param spec A WebSpec object
#' @param include_forest Whether to include forest plot data in serialization
#' @return A nested list suitable for jsonlite::toJSON
#' @keywords internal
serialize_spec <- function(spec, include_forest = TRUE) {
  theme <- spec@theme %||% web_theme_nejm()
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli_abort("{.arg theme} must be a {.cls WebTheme} object.")
  }

  list(
    # Wire-format version. Validated JS-side by `$spec/validateSpecVersion`.
    # Bump alongside `WIRE_FORMAT_VERSION` in `R/wire-version.R` and
    # `srcjs/src/spec/index.ts::CURRENT_VERSION` (sync point — see
    # docs/dev/frontend-split-spec.md §2.5 G6 and §3.4 versioning policy).
    version = WIRE_FORMAT_VERSION,
    data = serialize_data(spec, include_forest),
    columns = lapply(spec@columns, serialize_column),
    # `labelColumn` carries the row-label column as a named wire slot
    # (separate from `columns`). The renderer prepends it to the column
    # list when present, giving the "primary column" treatment a clear
    # named hook instead of relying on `columns[0]?.id === "label"`.
    labelColumn = if (is.null(spec@label_column)) NULL else serialize_column(spec@label_column),
    extraColumns = lapply(spec@extra_columns, serialize_column),
    availableFields = serialize_available_fields(spec),
    theme = serialize_theme(theme),
    interaction = serialize_interaction(spec@interaction, theme),
    initialState = serialize_initial_state(spec@initial_state),
    labels = serialize_labels(spec@labels),
    notes = serialize_notes(spec@notes),
    watermark = if (is.na(spec@watermark)) NULL else spec@watermark,
    watermarkColor = if (is.na(spec@watermark_color)) NULL else spec@watermark_color,
    watermarkOpacity = if (is.na(spec@watermark_opacity)) NULL else spec@watermark_opacity,
    paginate = serialize_paginate(spec),
    layout = list(
      plotWidth = "auto"
    ),
    # Optional save-time / interactive aspect-ratio target. Wire as `null`
    # for the natural (unset) case so the TS side can branch on presence.
    targetAspect = if (is.na(spec@target_aspect)) NULL else as.numeric(spec@target_aspect),
    # Anchor rule for ratio-only target-dim resolution (Phase 7C).
    targetAspectAnchor = spec@target_aspect_anchor,
    originalCall = if (is.na(spec@original_call)) NULL else spec@original_call,
    # Cross-cutting widget state (Phase 5+). Conditions are the only
    # bank kind currently populated from R; footnotes / axes / legends
    # come from schema-side contributeBanks behaviors (TS-side).
    banks = if (length(spec@conditions) > 0L) list(conditions = spec@conditions) else NULL
  )
}

#' Serialize a PaginateSpec + computed breakpoints
#'
#' Returns NULL when no paginate spec is attached. Otherwise emits the spec
#' fields (camelCased) plus a `pages` array of 0-based row index ranges so
#' the Svelte viewer can slice `displayRows` directly without re-deriving.
#' @keywords internal
serialize_paginate <- function(spec) {
  ps <- spec@paginate
  if (is.null(ps) || !S7_inherits(ps, PaginateSpec)) return(NULL)

  breaks <- compute_page_breaks(spec, ps)
  pages <- if (is.null(breaks) || breaks$n_pages == 0L) {
    list()
  } else {
    Map(function(s, e) list(startIdx = as.integer(s) - 1L, endIdx = as.integer(e) - 1L),
        breaks$page_starts, breaks$page_ends)
  }

  # page_label is rendered to a stable wire value. Functions degrade to the
  # default ("x_of_y") for the frontend; R-side PDF render can still honor
  # the function form by reading the spec object directly.
  page_label_wire <- ps@page_label
  if (is.function(page_label_wire)) page_label_wire <- "x_of_y"
  if (isTRUE(page_label_wire)) page_label_wire <- "x_of_y"
  if (isFALSE(page_label_wire)) page_label_wire <- FALSE

  list(
    rows = ps@rows,
    breakOn = ps@break_on,
    keepGroups = ps@keep_groups,
    orphanMin = ps@orphan_min,
    repeatHeader = ps@repeat_header,
    repeatLegend = ps@repeat_legend,
    repeatTitle = ps@repeat_title,
    footnotesOn = ps@footnotes_on,
    pageLabel = page_label_wire,
    pages = pages,
    nPages = length(pages)
  )
}

#' Infer a field category for a data column
#'
#' Returns one of: "numeric", "integer", "string", "logical", "date",
#' "array-numeric", "other". Used by the frontend column picker to filter
#' which data columns are compatible with which visual types.
#'
#' @param x A column vector from the data frame
#' @return A single character: the inferred category
#' @keywords internal
infer_field_category <- function(x) {
  if (is.list(x) && !is.data.frame(x)) {
    # List-column: check whether all non-NULL entries are numeric vectors
    non_null <- Filter(function(v) !is.null(v) && length(v) > 0, x)
    if (length(non_null) > 0 && all(vapply(non_null, is.numeric, logical(1)))) {
      return("array-numeric")
    }
    return("other")
  }
  if (inherits(x, "Date") || inherits(x, "POSIXct") || inherits(x, "POSIXlt")) {
    return("date")
  }
  if (is.logical(x)) return("logical")
  if (is.integer(x)) return("integer")
  if (is.numeric(x)) return("numeric")
  if (is.character(x) || is.factor(x)) return("string")
  "other"
}

#' Serialize the available-fields manifest
#'
#' @param spec A WebSpec object
#' @return A list of `{field, label, category}` entries, one per data column
#'   (minus any excluded via `available_exclude`).
#' @keywords internal
serialize_available_fields <- function(spec) {
  df <- spec@data
  excluded <- spec@available_exclude
  fields <- setdiff(names(df), excluded)

  lapply(fields, function(nm) {
    col <- df[[nm]]
    lbl <- attr(col, "label")
    if (is.null(lbl) || !nzchar(lbl)) lbl <- nm
    list(
      field = nm,
      label = as.character(lbl),
      category = infer_field_category(col)
    )
  })
}

#' Serialize WebSpec data
#' @keywords internal
serialize_data <- function(spec, include_forest = TRUE) {
  df <- spec@data
  n <- nrow(df)

  # Pre-format date columns: detect columns with date options and format Date/POSIXct values
  date_columns <- list()
  for (col in spec@columns) {
    if (S7_inherits(col, ColumnSpec) && !is.null(col@options$date)) {
      date_fmt <- col@options$date$format %||% "%Y-%m-%d"
      field <- col@field
      if (field %in% names(df) && (inherits(df[[field]], "Date") || inherits(df[[field]], "POSIXct"))) {
        df[[field]] <- format(df[[field]], date_fmt)
      }
    } else if (S7_inherits(col, ColumnGroup)) {
      for (child in col@columns) {
        if (S7_inherits(child, ColumnSpec) && !is.null(child@options$date)) {
          date_fmt <- child@options$date$format %||% "%Y-%m-%d"
          field <- child@field
          if (field %in% names(df) && (inherits(df[[field]], "Date") || inherits(df[[field]], "POSIXct"))) {
            df[[field]] <- format(df[[field]], date_fmt)
          }
        }
      }
    }
  }

  # Apply custom formatters: columns with a `formatter` function have their
  # values replaced with the function's output (as character vector). The
  # serialized column type is forced to "text" in web_col(), so the frontend
  # renders the formatted string verbatim.
  apply_formatter <- function(col) {
    if (!S7_inherits(col, ColumnSpec)) return(invisible())
    fn <- col@formatter
    if (is.null(fn)) return(invisible())
    field <- col@field
    if (!(field %in% names(df))) return(invisible())
    out <- fn(df[[field]])
    if (length(out) != nrow(df)) {
      cli_abort(c(
        "{.arg formatter} for column {.val {field}} returned {length(out)} value(s); expected {nrow(df)}.",
        "i" = "A formatter must return one element per data row."
      ))
    }
    df[[field]] <<- as.character(out)
  }
  for (col in spec@columns) {
    if (S7_inherits(col, ColumnGroup)) {
      for (child in col@columns) apply_formatter(child)
    } else {
      apply_formatter(col)
    }
  }

  # Resolve the "label" field for `row.label`. As of 0.34.2 the row-label
  # column lives on `spec@label_column`; legacy wires kept it as the first
  # entry of `spec@columns`. Honor the dedicated slot first, then fall back
  # to the leftmost ColumnSpec in `columns`.
  primary_field <- NA_character_
  if (!is.null(spec@label_column) && S7_inherits(spec@label_column, ColumnSpec)) {
    primary_field <- spec@label_column@field
  }
  if (is.na(primary_field)) {
    for (col in spec@columns) {
      if (S7_inherits(col, ColumnSpec)) {
        primary_field <- col@field
        break
      }
      if (S7_inherits(col, ColumnGroup) && length(col@columns) > 0) {
        for (child in col@columns) {
          if (S7_inherits(child, ColumnSpec)) {
            primary_field <- child@field
            break
          }
        }
        if (!is.na(primary_field)) break
      }
    }
  }

  # Pre-extract column vectors so per-row iteration is positional rather
  # than relying on `df[i, , drop = FALSE]` — R's row-extraction allocates
  # a fresh data.frame per row.
  col_vectors <- as.list(df)
  col_names <- names(df)

  # Pre-compile per-column style recipes ONCE (Phase 4.1). build_cell_styles
  # used to walk S7 column props per row × per column; on the bench S7's @
  # accessor was 32% of total serialize time. Recipes resolve all props once.
  cell_style_recipes <- compile_cell_style_recipes(spec@columns)
  row_style_recipe <- compile_row_style_recipe(spec)
  marker_style_recipe <- compile_marker_style_recipe(spec)
  # Details/disclosure panel content, pre-extracted per the positional pattern.
  details_vec <- if (!is.na(spec@details_col) && spec@details_col %in% col_names)
    as.character(col_vectors[[spec@details_col]]) else NULL
  # Some columns are list-columns whose per-row value is a single-element
  # list. We need to unwrap those when building metadata, so flag them once.
  is_list_col <- vapply(col_vectors, function(v) is.list(v), logical(1))

  # Get values from one row via positional access into the cached column
  # vectors. Returns a named list with the same shape as `as.list(df[i, ])`
  # but ~5-10x faster because it skips the data.frame row-extraction.
  get_row_list <- function(i) {
    out <- vector("list", length(col_vectors))
    names(out) <- col_names
    for (k in seq_along(col_vectors)) {
      v <- col_vectors[[k]]
      if (is_list_col[k]) {
        cell <- v[[i]]
        # Replicate the old "unwrap single-element list" semantics for
        # list-columns whose per-row value is itself a length-1 list.
        if (is.list(cell) && length(cell) == 1 && !is.data.frame(cell)) {
          cell <- cell[[1]]
        }
        out[[k]] <- cell
      } else {
        out[[k]] <- v[[i]]
      }
    }
    out
  }

  # Build rows - data now lives entirely in metadata
  rows <- lapply(seq_len(n), function(i) {
    row <- get_row_list(i)

    # Get label from the primary (leftmost) column, falling back to row number
    label <- if (!is.na(primary_field) && primary_field %in% names(row)) {
      as.character(row[[primary_field]])
    } else {
      as.character(i)
    }

    # Get group ID - use composite ID for hierarchical groups
    group_id <- if (!is.na(spec@group_col)) {
      if (length(spec@group_cols) > 1) {
        # Hierarchical grouping - build composite ID from all parent levels
        # e.g., "program_a__Phase_II" for row with program=program_a, phase=Phase_II
        parts <- vapply(spec@group_cols, function(col) {
          as.character(row[[col]])
        }, character(1))
        paste(parts, collapse = "__")
      } else {
        # Simple grouping - just use the group column value
        as.character(row[[spec@group_col]])
      }
    } else {
      NULL
    }

    # Metadata IS the row list; list-column unwrapping happened in
    # get_row_list. Trailing single-element-list unwrap kept for any
    # remaining anomalous cell shapes (defensive).
    metadata <- row

    # Row + marker style from pre-resolved column-name recipes (Phase 4.1).
    # Avoids 16 S7 @ accesses per row × N rows by resolving spec props once.
    style        <- extract_row_style_fast(row, row_style_recipe)
    marker_style <- extract_marker_style_fast(row, marker_style_recipe)

    # Build per-cell styles from pre-compiled recipes (Phase 4.1).
    # Pre-resolving each column's S7 style props once outside the row
    # loop avoided ~30% of total serialize_split_table() time on the 1k-
    # row / 10-subset bench.
    cell_styles <- build_cell_styles_fast(row, cell_style_recipes)

    # Omit `groupId` entirely when there's no grouping — htmlwidgets'
    # `toJSON` serializes a NULL list element as `{}` (empty object)
    # rather than JSON `null`, and the TS `applySortWithinGroups`
    # buckets rows by `row.groupId ?? "__root__"`, treating each `{}`
    # as a distinct Map key (object identity). That puts every row in
    # its own bucket of one, so toggling header sort produces no
    # visible row reorder. Dropping the field yields a true `undefined`
    # JS-side, which coalesces to `"__root__"` and pools all rows.
    result <- list(
      id = paste0("row_", i),
      label = label,
      metadata = metadata
    )
    if (!is.null(group_id)) {
      result$groupId <- group_id
    }

    # Only include style if any style properties are set
    if (!is.null(style)) {
      result$style <- style
    }

    # Only include markerStyle if any marker style properties are set
    if (!is.null(marker_style)) {
      result$markerStyle <- marker_style
    }

    # Only include cellStyles if any cell styles are set
    if (length(cell_styles) > 0) {
      result$cellStyles <- cell_styles
    }

    # Details/disclosure panel content (markdown), when non-empty for this row.
    if (!is.null(details_vec)) {
      dval <- details_vec[i]
      if (!is.na(dval) && nzchar(trimws(dval))) result$details <- dval
    }

    result
  })

  # Build groups with computed depth
  group_depths <- compute_group_depths(spec@groups)
  groups <- lapply(spec@groups, function(g) {
    list(
      id = g@id,
      label = g@label,
      collapsed = g@collapsed,
      parentId = if (is.na(g@parent_id)) NULL else g@parent_id,
      depth = group_depths[[g@id]] %||% 0
    )
  })

  # Build group summaries
  summaries <- lapply(spec@summaries, function(s) {
    list(
      groupId = s@group_id,
      point = s@point,
      lower = s@lower,
      upper = s@upper,
      metadata = s@metadata
    )
  })

  # Build overall summary
  overall <- if (!is.null(spec@overall_summary)) {
    s <- spec@overall_summary
    list(
      point = s@point,
      lower = s@lower,
      upper = s@upper,
      metadata = s@metadata
    )
  } else {
    NULL
  }

  list(
    rows = rows,
    groups = groups,
    summaries = summaries,
    overall = overall,
    groupCol = if (is.na(spec@group_col)) NULL else spec@group_col,
    weightCol = if (is.na(spec@weight_col)) NULL else spec@weight_col
  )
}

#' Serialize a ColumnSpec or ColumnGroup
#' @keywords internal
serialize_column <- function(col) {

  # Handle ColumnGroup
  if (S7_inherits(col, ColumnGroup)) {
    return(list(
      id = col@id,
      header = col@header,
      isGroup = TRUE,
      columns = lapply(col@columns, serialize_column)
    ))
  }

  # Handle regular ColumnSpec
  # Width can be: NA (NULL), numeric, or "auto"
  width_val <- if (is.na(col@width[1])) {
    NULL
  } else if (identical(col@width, "auto")) {
    "auto"
  } else {
    as.numeric(col@width)
  }

  result <- list(
    id = col@id,
    header = col@header,
    field = col@field,
    type = col@type,
    width = width_val,
    align = col@align,
    # Normalise wrap to a numeric on the wire so the frontend doesn't
    # need to handle TRUE/FALSE/integer separately. FALSE -> 0,
    # TRUE -> 1, integer passes through. Frontend reads max-extra-lines.
    wrap = if (is.logical(col@wrap)) as.integer(col@wrap) else as.integer(col@wrap),
    sortable = col@sortable,
    # Numeric flex = explicit weight; logical = aspect-participation flag.
    flex = if (is.numeric(col@flex)) as.numeric(col@flex) else isTRUE(col@flex),
    isGroup = FALSE
  )

  # Only include headerAlign when explicitly set (NA = follow default).
  if (!is.na(col@header_align)) {
    result$headerAlign <- col@header_align
  }

  # Only serialize showHeader when explicitly set (TRUE/FALSE); NA = auto, omitted.
  if (isTRUE(col@show_header) || isFALSE(col@show_header)) {
    result$showHeader <- as.logical(col@show_header)
  }

  # Include options if present
  if (length(col@options) > 0) {
    result$options <- col@options
  }

  # Build styleMapping from style_* properties
  # Helper to check if a style value is set (not NULL, not NA)
  has_style <- function(x) {
    !is.null(x) && length(x) > 0 && !is.na(x[1])
  }

  # Condition references survive resolve_column_style as
  # `tabviz_cond_ref` S3 lists; strip the class for jsonlite so the
  # value serializes as a plain `{kind, name}` object on the wire.
  unwrap_cond <- function(x) {
    if (inherits(x, "tabviz_cond_ref")) unclass(x) else x
  }

  style_mapping <- list()
  if (has_style(col@style_bold)) style_mapping$bold <- unwrap_cond(col@style_bold)
  if (has_style(col@style_italic)) style_mapping$italic <- unwrap_cond(col@style_italic)
  if (has_style(col@style_color)) style_mapping$color <- unwrap_cond(col@style_color)
  if (has_style(col@style_bg)) style_mapping$bg <- unwrap_cond(col@style_bg)
  if (has_style(col@style_badge)) style_mapping$badge <- unwrap_cond(col@style_badge)
  if (has_style(col@style_icon)) style_mapping$icon <- unwrap_cond(col@style_icon)
  # Semantic styling
  if (has_style(col@style_emphasis)) style_mapping$emphasis <- unwrap_cond(col@style_emphasis)
  if (has_style(col@style_muted)) style_mapping$muted <- unwrap_cond(col@style_muted)
  if (has_style(col@style_accent)) style_mapping$accent <- unwrap_cond(col@style_accent)

  if (length(style_mapping) > 0) {
    result$styleMapping <- style_mapping
  }

  result
}

#' Serialize a banding string into the `{mode, level}` shape used by the frontend
#'
#' `level` is `NULL` when no explicit depth was requested (bare `"group"`).
#' @keywords internal
serialize_banding <- function(x) {
  parsed <- parse_banding(x)
  list(
    mode = parsed$mode,
    level = if (is.na(parsed$level)) NULL else parsed$level
  )
}

# v1 serialize_theme + its helpers (serialize_semantic_bundle,
# serialize_semantics, default_swatches, resolve_swatches) deleted in PR 9b.
# v2 serialize_theme lives in R/utils-serialize-resolved.R.

#' Serialize a Semantics object into the per-token bundle map
#' @keywords internal

#' Serialize InteractionSpec
# Detects a 2-level categorized themes list. Returns TRUE if every top-level
# value is itself a non-empty list whose values are all WebTheme objects.
is_categorized_themes <- function(x) {
  if (!is.list(x) || length(x) == 0L) return(FALSE)
  all(vapply(x, function(category) {
    is.list(category) && length(category) > 0L &&
      all(vapply(category, function(t) inherits(t, "tabviz::WebTheme"), logical(1)))
  }, logical(1)))
}

#' Serialize annotation/note rows to the wire (NULL when none).
#' @keywords internal
serialize_notes <- function(notes) {
  if (is.null(notes) || length(notes) == 0) return(NULL)
  lapply(notes, function(n) list(after = n$after, content = n$content))
}

#' Serialize the authored initial-state bundle.
#'
#' Mirrors the shape `validate_initial_state()` returns. NULL passthrough
#' (no initial state set) keeps the JSON payload free of an empty key.
#' @keywords internal
serialize_initial_state <- function(initial_state) {
  if (is.null(initial_state)) return(NULL)
  out <- list()
  if (!is.null(initial_state$sort)) {
    out$sort <- list(
      column = initial_state$sort$column,
      direction = initial_state$sort$direction
    )
  }
  if (!is.null(initial_state$filters)) {
    # JSON-friendly list of {field, operator, value} triples.
    out$filters <- lapply(initial_state$filters, function(f) {
      list(field = f$field, operator = f$operator, value = f$value)
    })
  }
  if (!is.null(initial_state$hidden_columns)) {
    # Force a JSON array even for length-1 vectors via toJSON's auto_unbox=TRUE.
    out$hiddenColumns <- I(unlist(initial_state$hidden_columns))
  }
  if (!is.null(initial_state$expanded_rows)) {
    out$expandedRows <- I(unlist(initial_state$expanded_rows))
  }
  if (length(out) == 0) NULL else out
}

#' @keywords internal
serialize_interaction <- function(interaction, active_theme = NULL) {
  if (is.null(interaction)) {
    interaction <- web_interaction()
  }

  # Handle enable_themes serialization. The shape decides the in-widget
  # switcher's UI:
  # * NULL                                  → switcher disabled
  # * "default"                             → flat list of all package presets
  # * named list of WebTheme (1-level)      → flat list (no tabs)
  # * named list of named lists of WebTheme → categorized (tabs)
  #
  # Finalization (resolve "default" → package_themes(), apply named-list
  # display-name overrides, prepend the active theme as "Current") happens
  # HERE, at wire time — never in the stored spec. Eagerly finalizing into
  # `interaction@enable_themes` embedded ~27 resolved WebTheme S7 objects in
  # every WebSpec, which made `serialize(spec)` weigh ~560 MB (S7 instances
  # drag their full class-closure graph into R serialization) — knitr cache,
  # saveRDS, targets, and parallel workers all paid it. The wire output is
  # byte-identical either way.
  enable_themes <- interaction@enable_themes
  if (!is.null(active_theme) && !is.null(enable_themes)) {
    enable_themes <- finalize_enable_themes(enable_themes, active_theme)
  }
  serialize_themes_arg <- function(x) {
    # Accept either a flat named list of WebTheme OR a 2-level
    # categorized list. Detect at runtime so package_themes() (now
    # categorized) and user-supplied flat lists both work transparently.
    if (is_categorized_themes(x)) {
      lapply(x, function(cat) lapply(cat, function(t) serialize_theme(t)))
    } else {
      lapply(x, function(t) serialize_theme(t))
    }
  }
  if (is.null(enable_themes)) {
    themes_config <- NULL
  } else if (identical(enable_themes, "default")) {
    themes_config <- serialize_themes_arg(package_themes())
  } else if (is.list(enable_themes)) {
    themes_config <- serialize_themes_arg(enable_themes)
  } else {
    themes_config <- serialize_themes_arg(package_themes())
  }

  list(
    showFilters = interaction@show_filters,
    showLegend = interaction@show_legend,
    enableSort = interaction@enable_sort,
    enableCollapse = interaction@enable_collapse,
    enableSelect = interaction@enable_select,
    enableHover = interaction@enable_hover,
    enableResize = interaction@enable_resize,
    enableExport = interaction@enable_export,
    enableThemeEdit = interaction@enable_theme_edit,
    enableFilters = interaction@enable_filters || interaction@show_filters,
    enableReorderRows = interaction@enable_reorder_rows,
    enableReorderColumns = interaction@enable_reorder_columns,
    enableEdit = interaction@enable_edit,
    showGroupCounts = interaction@show_group_counts,
    tooltipFields = interaction@tooltip_fields,
    enableThemes = themes_config
  )
}

#' Serialize PlotLabels
#' @keywords internal
serialize_labels <- function(labels) {
  if (is.null(labels)) {
    return(NULL)
  }

  list(
    title = if (is.na(labels@title)) NULL else labels@title,
    subtitle = if (is.na(labels@subtitle)) NULL else labels@subtitle,
    caption = if (is.na(labels@caption)) NULL else labels@caption,
    footnote = if (is.na(labels@footnote)) NULL else labels@footnote,
    tag = if (is.na(labels@tag)) NULL else labels@tag
  )
}

#' Compute depths for all groups based on parent hierarchy
#' @keywords internal
compute_group_depths <- function(groups) {
  if (length(groups) == 0) return(list())

  # Build parent lookup
  parent_map <- list()
  for (g in groups) {
    if (!is.na(g@parent_id)) {
      parent_map[[g@id]] <- g@parent_id
    }
  }

  # Compute depth for each group
  depths <- list()
  for (g in groups) {
    depth <- 0
    current <- g@id
    while (!is.null(parent_map[[current]])) {
      depth <- depth + 1
      current <- parent_map[[current]]
      # Prevent infinite loops
      if (depth > 100) break
    }
    depths[[g@id]] <- depth
  }

  depths
}

# Pre-resolve the spec's row-style and marker-style column names ONCE.
# extract_row_style was accessing 12 S7 props per row, extract_marker_style
# 4 — at 1000 rows that's 16k S7 @ accesses per spec. Pre-resolving caches
# all the spec@row_*_col / spec@marker_*_col names in a plain list the
# row loop reads with cheap [[ access. Returns a list with named slots
# keyed by the same names used in the per-row style outputs.
compile_row_style_recipe <- function(spec) {
  list(
    type      = spec@row_type_col,
    bold      = spec@row_bold_col,
    italic    = spec@row_italic_col,
    color     = spec@row_color_col,
    bg        = spec@row_bg_col,
    indent    = spec@row_indent_col,
    icon      = spec@row_icon_col,
    badge     = spec@row_badge_col,
    emphasis  = spec@row_emphasis_col,
    muted     = spec@row_muted_col,
    accent    = spec@row_accent_col,
    fill      = spec@row_fill_col
  )
}

compile_marker_style_recipe <- function(spec) {
  list(
    color   = spec@marker_color_col,
    shape   = spec@marker_shape_col,
    opacity = spec@marker_opacity_col,
    size    = spec@marker_size_col
  )
}

# Type map for the row-style keys, used by the fast extractor below.
.ROW_STYLE_TYPES <- list(
  type     = "character", bold      = "logical",   italic   = "logical",
  color    = "character", bg        = "character", indent   = "numeric",
  icon     = "character", badge     = "character",
  emphasis = "logical",   muted     = "logical",   accent   = "logical",
  fill     = "logical"
)
.MARKER_STYLE_TYPES <- list(
  color   = "character", shape = "character",
  opacity = "numeric",   size  = "numeric"
)

# Single per-row extractor, reused by both row and marker style passes.
# Reads from `row` (a named list) using pre-resolved column names in `recipe`.
.apply_style_recipe <- function(row, recipe, types) {
  out <- list()
  row_names <- names(row)
  for (key in names(recipe)) {
    col_name <- recipe[[key]]
    if (is.null(col_name) || length(col_name) == 0L) next
    if (is.na(col_name) || !(col_name %in% row_names)) next
    val <- row[[col_name]]
    if (length(val) == 0L) next
    if (length(val) == 1L && is.na(val)) next
    out[[key]] <- switch(types[[key]],
      logical   = as.logical(val),
      numeric   = as.numeric(val),
      as.character(val)
    )
  }
  if (length(out) == 0L) NULL else out
}

extract_row_style_fast <- function(row, recipe) {
  .apply_style_recipe(row, recipe, .ROW_STYLE_TYPES)
}
extract_marker_style_fast <- function(row, recipe) {
  .apply_style_recipe(row, recipe, .MARKER_STYLE_TYPES)
}

#' Extract row style from explicit column mappings
#'
#' Legacy wrapper retained for direct callers; the hot path in
#' `serialize_data()` uses `compile_row_style_recipe()` + the faster
#' `extract_row_style_fast()`.
#'
#' @param row A single row of data
#' @param spec The WebSpec containing row_*_col mappings
#' @return A list of style properties or NULL if none set
#' @keywords internal
extract_row_style <- function(row, spec) {
  style <- list()

  # Helper to get value from explicit column mapping. Defensive against
  # zero-length and list-column NULL entries — when `row` is built from a
  # pre-extracted column vector (post Phase 4.1) rather than a data.frame
  # row, a list-column with a NULL or empty entry would otherwise pass
  # through `is.na()` and trip "argument is of length zero".
  get_style_val <- function(col_name, type = "character") {
    if (is.na(col_name) || !col_name %in% names(row)) return(NULL)
    val <- row[[col_name]]
    if (length(val) == 0L) return(NULL)
    if (length(val) == 1L && is.na(val)) return(NULL)
    switch(type,
      logical = as.logical(val),
      numeric = as.numeric(val),
      as.character(val)
    )
  }

  # Check explicit column mappings

  val <- get_style_val(spec@row_type_col, "character")
  if (!is.null(val)) style$type <- val

  val <- get_style_val(spec@row_bold_col, "logical")
  if (!is.null(val)) style$bold <- val

  val <- get_style_val(spec@row_italic_col, "logical")
  if (!is.null(val)) style$italic <- val

  val <- get_style_val(spec@row_color_col, "character")
  if (!is.null(val)) style$color <- val

  val <- get_style_val(spec@row_bg_col, "character")
  if (!is.null(val)) style$bg <- val

  val <- get_style_val(spec@row_indent_col, "numeric")
  if (!is.null(val)) style$indent <- val

  val <- get_style_val(spec@row_icon_col, "character")
  if (!is.null(val)) style$icon <- val

  val <- get_style_val(spec@row_badge_col, "character")
  if (!is.null(val)) style$badge <- val

  # Semantic styling (T/F columns) — six tokens.
  val <- get_style_val(spec@row_emphasis_col, "logical")
  if (!is.null(val)) style$emphasis <- val

  val <- get_style_val(spec@row_muted_col, "logical")
  if (!is.null(val)) style$muted <- val

  val <- get_style_val(spec@row_accent_col, "logical")
  if (!is.null(val)) style$accent <- val

  val <- get_style_val(spec@row_fill_col, "logical")
  if (!is.null(val)) style$fill <- val

  # Return NULL if no style properties set
  if (length(style) == 0) {
    return(NULL)
  }

  style
}

#' Extract marker style from explicit column mappings
#'
#' @param row A single row of data
#' @param spec The WebSpec containing marker_*_col mappings
#' @return A list of marker style properties or NULL if none set
#' @keywords internal
extract_marker_style <- function(row, spec) {
  style <- list()

  # Helper to get value from explicit column mapping
  get_style_val <- function(col_name, type = "character") {
    if (is.na(col_name) || !col_name %in% names(row)) return(NULL)
    val <- row[[col_name]]
    if (is.na(val)) return(NULL)
    switch(type,
      numeric = as.numeric(val),
      as.character(val)
    )
  }

  # Check explicit column mappings
  val <- get_style_val(spec@marker_color_col, "character")
  if (!is.null(val)) style$color <- val

  val <- get_style_val(spec@marker_shape_col, "character")
  if (!is.null(val)) style$shape <- val

  val <- get_style_val(spec@marker_opacity_col, "numeric")
  if (!is.null(val)) style$opacity <- val

  val <- get_style_val(spec@marker_size_col, "numeric")
  if (!is.null(val)) style$size <- val

  # Return NULL if no marker style properties set
  if (length(style) == 0) {
    return(NULL)
  }

  style
}

# Per-column "style recipe": resolved S7 properties + intended types,
# computed once per columns tree before the row loop. The inner
# `build_cell_styles_fast()` consumes recipes without touching S7 props,
# so per-row work is O(cols × set-style-fields) lookups instead of O(cols
# × 10 S7 @ accesses). On the 1k-row / 10-subset bench, S7 @ was 32% of
# total serialize_split_table() time and build_cell_styles dominated
# at 36% — pre-resolving recipes cuts both.
compile_cell_style_recipes <- function(columns) {
  recipes <- list()
  for (col in columns) {
    if (S7_inherits(col, ColumnGroup)) {
      # Flatten group children into the same recipe list — output map is
      # keyed by field, group-vs-leaf distinction doesn't matter here.
      recipes <- c(recipes, compile_cell_style_recipes(col@columns))
      next
    }
    if (!S7_inherits(col, ColumnSpec)) next
    # Pull every relevant S7 prop ONCE.
    recipes[[length(recipes) + 1L]] <- list(
      field        = col@field,
      bold_col     = col@style_bold,
      italic_col   = col@style_italic,
      color_col    = col@style_color,
      bg_col       = col@style_bg,
      badge_col    = col@style_badge,
      icon_col     = col@style_icon,
      emphasis_col = col@style_emphasis,
      muted_col    = col@style_muted,
      accent_col   = col@style_accent,
      tooltip_col  = col@style_tooltip
    )
  }
  recipes
}

#' Apply pre-compiled cell-style recipes to one row.
#' @keywords internal
build_cell_styles_fast <- function(row, recipes) {
  cell_styles <- list()
  row_names <- names(row)
  get_val <- function(col_name, type) {
    if (is.null(col_name) || length(col_name) == 0L) return(NULL)
    # Condition references (from `cond("name")`) are resolved at
    # render time via banks.conditions — they have no row-local
    # column to read here. Skip; the wire-side styleMapping carries
    # the cond ref directly (schema-sprint Phase 5).
    if (inherits(col_name, "tabviz_cond_ref")) return(NULL)
    if (!is.character(col_name)) return(NULL)
    if (is.na(col_name[1L]) || !(col_name %in% row_names)) return(NULL)
    val <- row[[col_name]]
    if (length(val) == 0L) return(NULL)
    if (length(val) == 1L && is.na(val)) return(NULL)
    switch(type,
      logical   = as.logical(val),
      numeric   = as.numeric(val),
      as.character(val)
    )
  }
  for (r in recipes) {
    cs <- list()
    val <- get_val(r$bold_col,     "logical");   if (!is.null(val)) cs$bold     <- val
    val <- get_val(r$italic_col,   "logical");   if (!is.null(val)) cs$italic   <- val
    val <- get_val(r$color_col,    "character"); if (!is.null(val)) cs$color    <- val
    val <- get_val(r$bg_col,       "character"); if (!is.null(val)) cs$bg       <- val
    val <- get_val(r$badge_col,    "character"); if (!is.null(val)) cs$badge    <- val
    val <- get_val(r$icon_col,     "character"); if (!is.null(val)) cs$icon     <- val
    val <- get_val(r$emphasis_col, "logical");   if (!is.null(val)) cs$emphasis <- val
    val <- get_val(r$muted_col,    "logical");   if (!is.null(val)) cs$muted    <- val
    val <- get_val(r$accent_col,   "logical");   if (!is.null(val)) cs$accent   <- val
    val <- get_val(r$tooltip_col,  "character"); if (!is.null(val)) cs$tooltip  <- val
    if (length(cs) > 0L) cell_styles[[r$field]] <- cs
  }
  cell_styles
}

#' Build per-cell styles from column styleMapping (legacy wrapper).
#'
#' Kept for any direct external callers and tests; the hot path inside
#' `serialize_data()` now uses `compile_cell_style_recipes()` once + the
#' faster `build_cell_styles_fast()` per row.
#' @keywords internal
build_cell_styles <- function(row, columns) {
  build_cell_styles_fast(row, compile_cell_style_recipes(columns))
}

#' Serialize annotation objects
#'
#' Converts ReferenceLine, CustomAnnotation, or RiskOfBias objects to JSON-ready lists.
#'
#' @param ann An annotation object
#' @return A list suitable for JSON serialization, or NULL for unknown types
#' @keywords internal
serialize_annotation <- function(ann) {
  # ReferenceLine
  if (S7_inherits(ann, ReferenceLine)) {
    return(list(
      type = "reference_line",
      id = paste0("refline_", ann@x),
      x = ann@x,
      label = if (is.na(ann@label)) NULL else ann@label,
      style = ann@style,
      color = if (is.na(ann@color)) NULL else ann@color,
      width = ann@width,
      opacity = ann@opacity
    ))
  }

  # CustomAnnotation
  if (S7_inherits(ann, CustomAnnotation)) {
    return(list(
      type = "custom",
      id = paste0("ann_", ann@study_id),
      rowId = ann@study_id,
      shape = ann@shape,
      position = ann@position,
      color = ann@color,
      size = ann@size
    ))
  }

  # Unknown annotation type - warn and return NULL
  cli_warn("Unknown annotation type, skipping: {class(ann)[[1]]}")
  NULL
}

# ============================================================================
# SplitForest serialization
# ============================================================================

#' Serialize a SplitForest to a JSON-ready list
#'
#' Converts a SplitForest object containing multiple WebSpec objects into
#' a format suitable for the split forest htmlwidget.
#'
#' @param split_table A SplitForest object
#' @param include_forest Whether to include forest plot data in each spec
#' @return A nested list suitable for jsonlite::toJSON
#' @keywords internal
serialize_split_table <- function(split_table, include_forest = TRUE) {
  # Hoist blocks that are identical across every subset spec
  # (columns/theme/interaction/watermark/...) into a single `base` block.
  # `create_subset_spec()` inherits these from the base spec by construction,
  # so emitting them once -- instead of N times -- cuts both R serialize
  # time and JSON payload size. Each subview entry then carries only what
  # actually differs: data (with its filtered groups/summaries) and labels
  # (subview-specific combined title).
  if (length(split_table@specs) == 0L) {
    cli_abort("SplitForest has no specs to serialize.")
  }
  first_key <- names(split_table@specs)[[1]]
  base_spec <- split_table@specs[[first_key]]

  theme <- base_spec@theme %||% web_theme_nejm()
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli_abort("{.arg theme} must be a {.cls WebTheme} object.")
  }

  base_block <- list(
    columns         = lapply(base_spec@columns, serialize_column),
    extraColumns    = lapply(base_spec@extra_columns, serialize_column),
    availableFields = serialize_available_fields(base_spec),
    theme           = serialize_theme(theme),
    interaction     = serialize_interaction(base_spec@interaction, theme),
    initialState    = serialize_initial_state(base_spec@initial_state),
    watermark        = if (is.na(base_spec@watermark)) NULL else base_spec@watermark,
    watermarkColor   = if (is.na(base_spec@watermark_color)) NULL else base_spec@watermark_color,
    watermarkOpacity = if (is.na(base_spec@watermark_opacity)) NULL else base_spec@watermark_opacity,
    layout           = list(plotWidth = "auto"),
    originalCall     = if (is.na(base_spec@original_call)) NULL else base_spec@original_call
  )

  serialized_specs <- list()
  for (key in names(split_table@specs)) {
    spec <- split_table@specs[[key]]
    serialized_specs[[key]] <- list(
      data     = serialize_data(spec, include_forest),
      labels   = serialize_labels(spec@labels),
      paginate = serialize_paginate(spec)
    )
  }

  list(
    # Wire-format version. See WIRE_FORMAT_VERSION definition in R/wire-version.R.
    version = WIRE_FORMAT_VERSION,
    type = "split_table",
    base = base_block,
    splitVars = I(split_table@split_vars),  # Force array serialization even for length-1
    navTree = serialize_nav_tree(split_table@split_tree),
    specs = serialized_specs,
    sharedAxis = split_table@shared_axis,
    sharedColumnWidths = split_table@shared_column_widths,
    axisRange = if (any(is.na(split_table@axis_range))) {
      NULL
    } else {
      list(min = split_table@axis_range[1], max = split_table@axis_range[2])
    }
  )
}

#' Serialize navigation tree for JSON
#'
#' Recursively converts the R list structure to JSON-compatible format.
#'
#' @param tree The navigation tree (list of nodes)
#' @return List structure ready for JSON serialization
#' @keywords internal
serialize_nav_tree <- function(tree) {
  if (is.null(tree) || length(tree) == 0) return(NULL)

  lapply(tree, function(node) {
    list(
      label = node$label,
      key = node$key,
      children = if (!is.null(node$children) && length(node$children) > 0) {
        serialize_nav_tree(node$children)
      } else {
        NULL
      }
    )
  })
}
