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
      paste0("Row ", i)
    }

    # Get group ID
    group_id <- if (!is.na(spec@group_col)) {
      as.character(row[[spec@group_col]])
    } else {
      NULL
    }

    # Build metadata from all columns (excluding .row_* columns)
    row_style_cols <- grepl("^\\.row_", names(row))
    metadata <- as.list(row[, !row_style_cols, drop = FALSE])
    names(metadata) <- names(row)[!row_style_cols]

    # Extract .row_* columns into style object
    style <- extract_row_style(row)

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
      color = if (is.na(e@color)) NULL else e@color
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
  result <- list(
    id = col@id,
    header = col@header,
    field = col@field,
    type = col@type,
    width = if (is.na(col@width)) NULL else col@width,
    align = col@align,
    position = col@position,
    sortable = col@sortable,
    isGroup = FALSE
  )

  # Include options if present
  if (length(col@options) > 0) {
    result$options <- col@options
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
      cellPaddingY = theme@layout@cell_padding_y
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

  list(
    showFilters = interaction@show_filters,
    showLegend = interaction@show_legend,
    enableSort = interaction@enable_sort,
    enableCollapse = interaction@enable_collapse,
    enableSelect = interaction@enable_select,
    enableHover = interaction@enable_hover,
    enableResize = interaction@enable_resize
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

#' Extract row style from .row_* columns
#' @keywords internal
extract_row_style <- function(row) {
  style <- list()

  # .row_type: "data", "header", "summary", "spacer"
  if (".row_type" %in% names(row) && !is.na(row[[".row_type"]])) {
    style$type <- as.character(row[[".row_type"]])
  }

  # .row_bold: logical
  if (".row_bold" %in% names(row) && !is.na(row[[".row_bold"]])) {
    style$bold <- as.logical(row[[".row_bold"]])
  }

  # .row_italic: logical
  if (".row_italic" %in% names(row) && !is.na(row[[".row_italic"]])) {
    style$italic <- as.logical(row[[".row_italic"]])
  }

  # .row_color: character (CSS color)
  if (".row_color" %in% names(row) && !is.na(row[[".row_color"]])) {
    style$color <- as.character(row[[".row_color"]])
  }

  # .row_bg: character (CSS background color)
  if (".row_bg" %in% names(row) && !is.na(row[[".row_bg"]])) {
    style$bg <- as.character(row[[".row_bg"]])
  }

  # .row_indent: numeric (indentation level)
  if (".row_indent" %in% names(row) && !is.na(row[[".row_indent"]])) {
    style$indent <- as.numeric(row[[".row_indent"]])
  }

  # .row_icon: character (emoji or icon)
  if (".row_icon" %in% names(row) && !is.na(row[[".row_icon"]])) {
    style$icon <- as.character(row[[".row_icon"]])
  }

  # .row_badge: character (badge text)
  if (".row_badge" %in% names(row) && !is.na(row[[".row_badge"]])) {
    style$badge <- as.character(row[[".row_badge"]])
  }

  # Return NULL if no style properties set
  if (length(style) == 0) {
    return(NULL)
  }

  style
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
      color = if (is.na(ann@color)) NULL else ann@color
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

  # RiskOfBias
  if (S7_inherits(ann, RiskOfBias)) {
    return(list(
      type = "risk_of_bias",
      id = "rob",
      domains = ann@domains,
      assessments = lapply(ann@assessments, function(a) {
        list(
          studyId = a@study_id,
          ratings = a@assessments
        )
      })
    ))
  }

  # Unknown annotation type - warn and return NULL
  cli_warn("Unknown annotation type, skipping: {class(ann)[[1]]}")
  NULL
}
