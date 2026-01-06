# Serialization utilities for converting S7 objects to JSON-ready lists

#' Serialize a WebSpec to a JSON-ready list
#'
#' @param spec A WebSpec object
#' @param include_forest Whether to include forest plot data (TRUE for forest_plot, FALSE for webtable)
#' @return A nested list suitable for jsonlite::toJSON
#' @keywords internal
serialize_spec <- function(spec, include_forest = TRUE) {
  theme <- spec@theme %||% web_theme_default()

  list(
    data = serialize_data(spec, include_forest),
    columns = lapply(spec@columns, serialize_column),
    annotations = lapply(spec@annotations, serialize_annotation),
    theme = serialize_theme(theme),
    interaction = serialize_interaction(spec@interaction),
    labels = serialize_labels(spec@labels),
    layout = list(
      plotPosition = theme@layout@plot_position,
      tableWidth = theme@layout@table_width,
      plotWidth = theme@layout@plot_width
    )
  )
}

#' Serialize WebSpec data
#' @keywords internal
serialize_data <- function(spec, include_forest = TRUE) {
  df <- spec@data
  n <- nrow(df)

  # Build rows
  rows <- lapply(seq_len(n), function(i) {
    row <- df[i, , drop = FALSE]

    # Get label
    label <- if (!is.na(spec@label_col)) {
      as.character(row[[spec@label_col]])
    } else {
      # No label column - use row number
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

    # Build metadata from all columns
    metadata <- as.list(row)
    names(metadata) <- names(row)

    # Extract row style from explicit column mappings
    style <- extract_row_style(row, spec)

    # Extract marker style from explicit column mappings
    marker_style <- extract_marker_style(row, spec)

    # Build per-cell styles from column styleMapping
    cell_styles <- build_cell_styles(row, spec@columns)

    result <- list(
      id = paste0("row_", i),
      label = label,
      point = row[[spec@point_col]],
      lower = row[[spec@lower_col]],
      upper = row[[spec@upper_col]],
      groupId = group_id,
      metadata = metadata
    )

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

  # Serialize effects
  effects <- lapply(spec@effects, function(e) {
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

  list(
    rows = rows,
    groups = groups,
    summaries = summaries,
    overall = overall,
    pointCol = spec@point_col,
    lowerCol = spec@lower_col,
    upperCol = spec@upper_col,
    labelCol = if (is.na(spec@label_col)) NULL else spec@label_col,
    labelHeader = spec@label_header,
    groupCol = if (is.na(spec@group_col)) NULL else spec@group_col,
    weightCol = if (is.na(spec@weight_col)) NULL else spec@weight_col,
    scale = spec@scale,
    nullValue = spec@null_value,
    axisLabel = spec@axis_label,
    effects = effects,
    includeForest = include_forest
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
      position = col@position,
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
    headerAlign = if (is.na(col@header_align)) NULL else col@header_align,
    wrap = col@wrap,
    position = col@position,
    sortable = col@sortable,
    isGroup = FALSE
  )

  # Include options if present
  if (length(col@options) > 0) {
    result$options <- col@options
  }

  # Build styleMapping from style_* properties
  style_mapping <- list()
  if (!is.na(col@style_bold)) style_mapping$bold <- col@style_bold
  if (!is.na(col@style_italic)) style_mapping$italic <- col@style_italic
  if (!is.na(col@style_color)) style_mapping$color <- col@style_color
  if (!is.na(col@style_bg)) style_mapping$bg <- col@style_bg
  if (!is.na(col@style_badge)) style_mapping$badge <- col@style_badge
  if (!is.na(col@style_icon)) style_mapping$icon <- col@style_icon

  if (length(style_mapping) > 0) {
    result$styleMapping <- style_mapping
  }

  result
}

#' Serialize WebTheme
#' @keywords internal
serialize_theme <- function(theme) {
  if (is.null(theme)) {
    theme <- web_theme_default()
  }

  list(
    name = theme@name,
    colors = list(
      background = theme@colors@background,
      foreground = theme@colors@foreground,
      primary = theme@colors@primary,
      secondary = theme@colors@secondary,
      accent = theme@colors@accent,
      muted = theme@colors@muted,
      border = theme@colors@border,
      interval = theme@colors@interval,
      intervalPositive = theme@colors@interval_positive,
      intervalNegative = theme@colors@interval_negative,
      intervalNeutral = theme@colors@interval_neutral,
      intervalLine = theme@colors@interval_line,
      summaryFill = theme@colors@summary_fill,
      summaryBorder = theme@colors@summary_border
    ),
    typography = list(
      fontFamily = theme@typography@font_family,
      fontSizeSm = theme@typography@font_size_sm,
      fontSizeBase = theme@typography@font_size_base,
      fontSizeLg = theme@typography@font_size_lg,
      fontWeightNormal = theme@typography@font_weight_normal,
      fontWeightMedium = theme@typography@font_weight_medium,
      fontWeightBold = theme@typography@font_weight_bold,
      lineHeight = theme@typography@line_height
    ),
    spacing = list(
      rowHeight = theme@spacing@row_height,
      headerHeight = theme@spacing@header_height,
      columnGap = theme@spacing@column_gap,
      sectionGap = theme@spacing@section_gap,
      padding = theme@spacing@padding,
      cellPaddingX = theme@layout@cell_padding_x,
      cellPaddingY = theme@layout@cell_padding_y,
      axisGap = theme@spacing@axis_gap,
      groupPadding = theme@spacing@group_padding
    ),
    shapes = list(
      pointSize = theme@shapes@point_size,
      summaryHeight = theme@shapes@summary_height,
      lineWidth = theme@shapes@line_width,
      borderRadius = theme@shapes@border_radius
    ),
    axis = list(
      rangeMin = if (is.na(theme@axis@range_min)) NULL else theme@axis@range_min,
      rangeMax = if (is.na(theme@axis@range_max)) NULL else theme@axis@range_max,
      tickCount = if (is.na(theme@axis@tick_count)) NULL else theme@axis@tick_count,
      tickValues = theme@axis@tick_values,
      gridlines = theme@axis@gridlines,
      gridlineStyle = theme@axis@gridline_style
    ),
    layout = list(
      plotPosition = theme@layout@plot_position,
      tableWidth = theme@layout@table_width,
      plotWidth = theme@layout@plot_width,
      rowBorder = theme@layout@row_border,
      rowBorderStyle = theme@layout@row_border_style,
      containerBorder = theme@layout@container_border,
      containerBorderRadius = theme@layout@container_border_radius
    )
  )
}

#' Serialize InteractionSpec
#' @keywords internal
serialize_interaction <- function(interaction) {
  if (is.null(interaction)) {
    interaction <- web_interaction()
  }

  # Handle enable_themes serialization
  enable_themes <- interaction@enable_themes
  if (is.null(enable_themes)) {
    # NULL means disable theme selection
    themes_config <- NULL
  } else if (identical(enable_themes, "default")) {
    # "default" means use all package themes
    themes_config <- lapply(package_themes(), function(t) serialize_theme(t))
  } else if (is.list(enable_themes)) {
    # Custom list of themes
    themes_config <- lapply(enable_themes, function(t) serialize_theme(t))
  } else {
    # Fallback to package themes
    themes_config <- lapply(package_themes(), function(t) serialize_theme(t))
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
    footnote = if (is.na(labels@footnote)) NULL else labels@footnote
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

#' Extract row style from explicit column mappings
#'
#' @param row A single row of data
#' @param spec The WebSpec containing row_*_col mappings
#' @return A list of style properties or NULL if none set
#' @keywords internal
extract_row_style <- function(row, spec) {
  style <- list()

  # Helper to get value from explicit column mapping
  get_style_val <- function(col_name, type = "character") {
    if (is.na(col_name) || !col_name %in% names(row)) return(NULL)
    val <- row[[col_name]]
    if (is.na(val)) return(NULL)
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

#' Build per-cell styles from column styleMapping
#' @keywords internal
build_cell_styles <- function(row, columns) {
  cell_styles <- list()

  for (col in columns) {
    # Skip ColumnGroups - process their children instead
    if (S7_inherits(col, ColumnGroup)) {
      nested_styles <- build_cell_styles(row, col@columns)
      for (field in names(nested_styles)) {
        cell_styles[[field]] <- nested_styles[[field]]
      }
      next
    }

    # Skip non-ColumnSpec objects
    if (!S7_inherits(col, ColumnSpec)) next

    field <- col@field
    cs <- list()

    # Helper to safely get value from column
    get_val <- function(col_name, type = "character") {
      if (is.na(col_name) || !col_name %in% names(row)) return(NULL)
      val <- row[[col_name]]
      if (is.na(val)) return(NULL)
      switch(type,
        logical = as.logical(val),
        as.character(val)
      )
    }

    # Check each style mapping
    val <- get_val(col@style_bold, "logical")
    if (!is.null(val)) cs$bold <- val

    val <- get_val(col@style_italic, "logical")
    if (!is.null(val)) cs$italic <- val

    val <- get_val(col@style_color, "character")
    if (!is.null(val)) cs$color <- val

    val <- get_val(col@style_bg, "character")
    if (!is.null(val)) cs$bg <- val

    val <- get_val(col@style_badge, "character")
    if (!is.null(val)) cs$badge <- val

    val <- get_val(col@style_icon, "character")
    if (!is.null(val)) cs$icon <- val

    if (length(cs) > 0) {
      cell_styles[[field]] <- cs
    }
  }

  cell_styles
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
#' @param split_forest A SplitForest object
#' @param include_forest Whether to include forest plot data in each spec
#' @return A nested list suitable for jsonlite::toJSON
#' @keywords internal
serialize_split_forest <- function(split_forest, include_forest = TRUE) {
  # Serialize each spec
  serialized_specs <- list()
  for (key in names(split_forest@specs)) {
    spec <- split_forest@specs[[key]]
    serialized_specs[[key]] <- serialize_spec(spec, include_forest = include_forest)
  }

  list(
    type = "split_forest",
    splitVars = I(split_forest@split_vars),  # Force array serialization even for length-1
    navTree = serialize_nav_tree(split_forest@split_tree),
    specs = serialized_specs,
    sharedAxis = split_forest@shared_axis,
    axisRange = if (any(is.na(split_forest@axis_range))) {
      NULL
    } else {
      list(min = split_forest@axis_range[1], max = split_forest@axis_range[2])
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
