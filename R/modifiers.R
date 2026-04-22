# Fluent API for modifying WebSpec objects and forest proxies
#
# Every verb dispatches on input type:
#   - WebSpec    -> mutate spec and return spec
#   - htmlwidget -> extract spec, mutate, re-wrap via tabviz(spec)
#   - tabviz_proxy -> send a sendCustomMessage() to the running widget
#
# ----------------------------------------------------------------------------
# Internal helpers
# ----------------------------------------------------------------------------

#' @noRd
extract_spec <- function(x, arg_name = "x") {
  if (inherits(x, "htmlwidget")) {
    spec <- attr(x, "webspec")
    if (is.null(spec)) {
      cli_abort("{.arg {arg_name}} is an htmlwidget without an attached WebSpec")
    }
    return(spec)
  }
  if (S7_inherits(x, WebSpec)) return(x)
  cli_abort("{.arg {arg_name}} must be a WebSpec, htmlwidget, or tabviz_proxy")
}

#' @noRd
repack <- function(x, spec) {
  if (inherits(x, "htmlwidget")) {
    return(tabviz(spec))
  }
  spec
}

# Apply `transform(spec)` to WebSpec/htmlwidget inputs, or dispatch
# to a proxy method for tabviz_proxy inputs. `transform` receives the
# WebSpec and returns a modified WebSpec. `proxy_method` / `proxy_args`
# are used only for proxy dispatch.
#' @noRd
apply_spec_or_proxy <- function(x, transform, proxy_method, proxy_args,
                                arg_name = "x") {
  if (inherits(x, "tabviz_proxy")) {
    return(invoke_proxy_method(x, proxy_method, proxy_args))
  }
  spec <- extract_spec(x, arg_name = arg_name)
  repack(x, transform(spec))
}

# Find a column by id or field in a WebSpec's @columns list (searches inside
# ColumnGroup). Returns list(parent_idx, child_idx_or_NA) or NULL.
#' @noRd
find_column_path <- function(columns, key) {
  for (i in seq_along(columns)) {
    col <- columns[[i]]
    if (S7_inherits(col, ColumnGroup)) {
      for (j in seq_along(col@columns)) {
        cc <- col@columns[[j]]
        if (identical(cc@id, key) || identical(cc@field, key)) {
          return(list(i = i, j = j))
        }
      }
    } else if (S7_inherits(col, ColumnSpec)) {
      if (identical(col@id, key) || identical(col@field, key)) {
        return(list(i = i, j = NA_integer_))
      }
    }
  }
  NULL
}

# Locate a column by id/field and apply a mutator to it; returns a new
# WebSpec. Errors if not found.
#' @noRd
update_column_in_spec <- function(spec, key, mutator) {
  path <- find_column_path(spec@columns, key)
  if (is.null(path)) {
    cli_abort("Column {.val {key}} not found in spec columns")
  }
  cols <- spec@columns
  if (is.na(path$j)) {
    cols[[path$i]] <- mutator(cols[[path$i]])
  } else {
    grp <- cols[[path$i]]
    gcols <- grp@columns
    gcols[[path$j]] <- mutator(gcols[[path$j]])
    grp@columns <- gcols
    cols[[path$i]] <- grp
  }
  spec@columns <- cols
  spec
}

# ----------------------------------------------------------------------------
# Row-level styling
# ----------------------------------------------------------------------------

#' Set row-level styling on a WebSpec
#'
#' Provides a fluent API for setting row-level styling based on column values.
#' Style values are read from the specified columns at render time.
#'
#' @param x A WebSpec object or an htmlwidget created by tabviz()
#' @param bold Column name containing logical values for row-level bold
#' @param italic Column name containing logical values for row-level italic
#' @param color Column name containing CSS color strings for row text color
#' @param bg Column name containing CSS color strings for row background color
#' @param badge Column name containing text for badges on the label column
#' @param icon Column name containing emoji/unicode for icons on the label column
#' @param indent Column name containing numeric values for row indentation
#' @param type Column name containing row type ("data", "header", "summary", "spacer")
#' @param weight Column name for marker weight/size scaling (numeric values, typically 0-100)
#' @param emphasis Column name containing logical values for emphasis styling (uses theme primary color)
#' @param muted Column name containing logical values for muted styling (uses theme muted color)
#' @param accent Column name containing logical values for accent styling (uses theme accent color)
#'
#' @return The modified WebSpec object (or widget)
#'
#' @examples
#' \dontrun{
#' forest_data |>
#'   web_spec(hr, lower, upper) |>
#'   set_row_style(bold = "is_primary", badge = "significance") |>
#'   forest_plot()
#' }
#'
#' @export
set_row_style <- function(
    x,
    bold = NULL,
    italic = NULL,
    color = NULL,
    bg = NULL,
    badge = NULL,
    icon = NULL,
    indent = NULL,
    type = NULL,
    weight = NULL,
    emphasis = NULL,
    muted = NULL,
    accent = NULL) {
  spec <- extract_spec(x)
  if (!is.null(bold)) spec@row_bold_col <- bold
  if (!is.null(italic)) spec@row_italic_col <- italic
  if (!is.null(color)) spec@row_color_col <- color
  if (!is.null(bg)) spec@row_bg_col <- bg
  if (!is.null(badge)) spec@row_badge_col <- badge
  if (!is.null(icon)) spec@row_icon_col <- icon
  if (!is.null(indent)) spec@row_indent_col <- indent
  if (!is.null(type)) spec@row_type_col <- type
  if (!is.null(weight)) spec@weight_col <- weight
  if (!is.null(emphasis)) spec@row_emphasis_col <- emphasis
  if (!is.null(muted)) spec@row_muted_col <- muted
  if (!is.null(accent)) spec@row_accent_col <- accent
  repack(x, spec)
}

#' Set column-level styling on a WebSpec
#'
#' Provides a fluent API for setting per-cell styling on specific columns.
#' The styling is based on values from other columns in the data.
#'
#' @param x A WebSpec object or an htmlwidget created by tabviz()
#' @param column The field name of the column to style
#' @param bold Column name containing logical values for cell-level bold
#' @param italic Column name containing logical values for cell-level italic
#' @param color Column name containing CSS color strings for cell text color
#' @param bg Column name containing CSS color strings for cell background color
#' @param badge Column name containing text for per-cell badges
#' @param icon Column name containing emoji/unicode for per-cell icons
#'
#' @return The modified WebSpec object (or widget)
#'
#' @examples
#' \dontrun{
#' forest_data |>
#'   web_spec(hr, lower, upper) |>
#'   set_column_style("study", badge = "significance", bold = "is_primary") |>
#'   forest_plot()
#' }
#'
#' @export
set_column_style <- function(
    x,
    column,
    bold = NULL,
    italic = NULL,
    color = NULL,
    bg = NULL,
    badge = NULL,
    icon = NULL) {
  spec <- extract_spec(x)
  mutator <- function(col) {
    if (!is.null(bold)) col@style_bold <- bold
    if (!is.null(italic)) col@style_italic <- italic
    if (!is.null(color)) col@style_color <- color
    if (!is.null(bg)) col@style_bg <- bg
    if (!is.null(badge)) col@style_badge <- badge
    if (!is.null(icon)) col@style_icon <- icon
    col
  }
  spec <- tryCatch(
    update_column_in_spec(spec, column, mutator),
    error = function(e) {
      cli_warn("Column {.val {column}} not found in spec columns")
      spec
    }
  )
  repack(x, spec)
}

#' Set marker styling on a WebSpec
#'
#' Provides a fluent API for setting marker styling (color, shape, opacity, size)
#' based on column values. These styles apply to the primary effect's markers.
#' For multi-effect plots, additional effects use their `effect_forest()` properties.
#'
#' @param x A WebSpec object or an htmlwidget created by tabviz()
#' @param color Column name containing CSS color strings for marker fill color
#' @param shape Column name containing shape values ("square", "circle", "diamond", "triangle")
#' @param opacity Column name containing numeric values (0-1) for marker opacity
#' @param size Column name containing numeric weight-like values driving
#'   marker size. Normalized by the renderer; pass raw weights, not a
#'   pre-normalized multiplier.
#'
#' @return The modified WebSpec object (or widget)
#'
#' @examples
#' \dontrun{
#' forest_data |>
#'   web_spec(hr, lower, upper) |>
#'   set_marker_style(color = "significance_color", shape = "study_type") |>
#'   forest_plot()
#' }
#'
#' @export
set_marker_style <- function(
    x,
    color = NULL,
    shape = NULL,
    opacity = NULL,
    size = NULL) {
  spec <- extract_spec(x)
  if (!is.null(color)) spec@marker_color_col <- color
  if (!is.null(shape)) spec@marker_shape_col <- shape
  if (!is.null(opacity)) spec@marker_opacity_col <- opacity
  if (!is.null(size)) spec@marker_size_col <- size
  repack(x, spec)
}

#' Set theme on a WebSpec, htmlwidget, or forest proxy
#'
#' Provides a fluent API for setting or changing the theme. Accepts either a
#' theme name (string) or a WebTheme object. On a proxy, sends a message so
#' the running widget swaps its theme without a full re-render.
#'
#' @param x A WebSpec object, htmlwidget, or tabviz_proxy
#' @param theme Either a WebTheme object or a string matching a built-in theme name:
#'   "default", "minimal", "dark", "jama", "lancet", "modern", "presentation",
#'   "cochrane", or "nature"
#'
#' @return The modified WebSpec, htmlwidget, or proxy (invisibly)
#'
#' @examples
#' \dontrun{
#' forest_data |>
#'   tabviz(label = "study", columns = list(viz_forest("hr", "lo", "hi"))) |>
#'   set_theme("jama")
#' }
#'
#' @export
set_theme <- function(x, theme) {
  theme_map <- list(
    default = web_theme_default,
    minimal = web_theme_minimal,
    dark = web_theme_dark,
    jama = web_theme_jama,
    lancet = web_theme_lancet,
    modern = web_theme_modern,
    presentation = web_theme_presentation,
    cochrane = web_theme_cochrane,
    nature = web_theme_nature
  )

  resolved <- if (is.character(theme) && length(theme) == 1) {
    if (!theme %in% names(theme_map)) {
      valid_names <- paste(names(theme_map), collapse = ", ")
      cli_abort("Unknown theme name: {.val {theme}}. Valid names: {valid_names}")
    }
    theme_map[[theme]]()
  } else if (S7_inherits(theme, WebTheme)) {
    theme
  } else {
    cli_abort("{.arg theme} must be a theme name string or a WebTheme object")
  }

  if (inherits(x, "tabviz_proxy")) {
    theme_payload <- if (is.character(theme) && length(theme) == 1) {
      list(name = theme)
    } else {
      list(theme = serialize_theme(resolved))
    }
    return(invoke_proxy_method(x, "setTheme", theme_payload))
  }

  spec <- extract_spec(x)
  spec@theme <- resolved
  repack(x, spec)
}

#' Curate which themes appear in the interactive theme switcher
#'
#' Fluent sibling to the `enable_themes` argument of [`web_interaction()`].
#' Rewrites `spec@interaction@enable_themes` on a WebSpec or htmlwidget so the
#' switcher menu shows only the requested themes. The spec's active theme is
#' always included automatically, so the user can always revert.
#'
#' @param x A `WebSpec` or htmlwidget created by [`tabviz()`].
#' @param themes One of:
#'   - `NULL`: hide the switcher entirely.
#'   - `"default"`: show all [`package_themes()`].
#'   - A list of `WebTheme` objects: show exactly those. Named list entries
#'     override each theme's displayed name
#'     (e.g. `list(Classical = web_theme_jama(), Modern = web_theme_modern())`).
#'
#' @return The modified WebSpec or htmlwidget.
#'
#' @examples
#' \dontrun{
#' tabviz(data, label = "study") |>
#'   set_theme("jama") |>
#'   selectable_themes(list(
#'     Classical = web_theme_jama(),
#'     Modern = web_theme_modern()
#'   ))
#' }
#' @export
selectable_themes <- function(x, themes) {
  if (inherits(x, "tabviz_proxy")) {
    cli_abort("{.fn selectable_themes} is not available on a live proxy yet.")
  }
  spec <- extract_spec(x)
  if (is.null(spec@interaction)) {
    spec@interaction <- web_interaction()
  }
  spec@interaction@enable_themes <- finalize_enable_themes(themes, spec@theme)
  repack(x, spec)
}

#' Set zoom and container constraints
#'
#' Provides a fluent API for controlling zoom level and container size constraints.
#' Static inputs rewrite the widget payload directly. On a proxy, sends a
#' setZoom message.
#'
#' @param x An htmlwidget created by `tabviz()` or a `tabviz_proxy`
#' @param zoom Zoom level (0.5 to 2.0, default 1.0)
#' @param auto_fit When TRUE (default), shrink content to fit container if too large.
#'   Never enlarges content. When FALSE, render at zoom level with scrollbars if needed.
#' @param max_width Maximum container width in pixels (NULL for none)
#' @param max_height Maximum container height in pixels (NULL for none)
#' @param show_controls Show zoom controls on hover
#'
#' @return The modified htmlwidget or proxy (invisibly)
#'
#' @examples
#' \dontrun{
#' tabviz(data, label = "study") |> set_zoom(zoom = 0.8)
#' }
#'
#' @export
set_zoom <- function(
    x,
    zoom = 1.0,
    auto_fit = TRUE,
    max_width = NULL,
    max_height = NULL,
    show_controls = TRUE) {
  checkmate::assert_number(zoom, lower = 0.5, upper = 2.0)
  checkmate::assert_flag(auto_fit)
  if (!is.null(max_width)) checkmate::assert_number(max_width, lower = 100)
  if (!is.null(max_height)) checkmate::assert_number(max_height, lower = 100)
  checkmate::assert_flag(show_controls)

  if (inherits(x, "tabviz_proxy")) {
    return(invoke_proxy_method(x, "setZoom", list(
      zoom = zoom,
      autoFit = auto_fit,
      maxWidth = max_width,
      maxHeight = max_height,
      showZoomControls = show_controls
    )))
  }

  if (!inherits(x, "htmlwidget")) {
    cli_abort("{.fn set_zoom} only works on htmlwidgets from {.fn tabviz} or on a tabviz_proxy")
  }

  x$x$zoom <- zoom
  x$x$autoFit <- auto_fit
  x$x$maxWidth <- max_width
  x$x$maxHeight <- max_height
  x$x$showZoomControls <- show_controls
  x
}

# ----------------------------------------------------------------------------
# Column verbs
# ----------------------------------------------------------------------------

#' Add a column to the spec or running widget
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param col A ColumnSpec (e.g. from `col_text()`, `col_numeric()`, ...)
#' @param after Field or id of an existing column to insert after. `NULL`
#'   (default) appends to the end. Use `"__start__"` to prepend.
#'
#' @return The modified input
#' @export
add_column <- function(x, col, after = NULL) {
  if (!S7_inherits(col, ColumnSpec)) {
    cli_abort("{.arg col} must be a ColumnSpec (e.g. from {.fn col_text})")
  }
  if (!is.null(after)) {
    checkmate::assert_string(after)
  }

  transform <- function(spec) {
    cols <- spec@columns
    if (is.null(after)) {
      cols <- c(cols, list(col))
    } else if (identical(after, "__start__")) {
      cols <- c(list(col), cols)
    } else {
      path <- find_column_path(cols, after)
      if (is.null(path)) {
        cli_abort("Column {.val {after}} not found in spec columns")
      }
      # Insert after the top-level position of the match (ignore grouping
      # for insertion simplicity; groups remain intact).
      cols <- append(cols, list(col), after = path$i)
    }
    spec@columns <- cols
    spec
  }

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "addColumn",
    proxy_args = list(
      column = serialize_column(col),
      afterId = after %||% NA_character_
    )
  )
}

#' Remove a column from the spec or running widget
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param field Field or id of the column to remove
#'
#' @return The modified input
#' @export
remove_column <- function(x, field) {
  checkmate::assert_string(field)

  transform <- function(spec) {
    path <- find_column_path(spec@columns, field)
    if (is.null(path)) {
      cli_abort("Column {.val {field}} not found in spec columns")
    }
    cols <- spec@columns
    if (is.na(path$j)) {
      cols[[path$i]] <- NULL
    } else {
      grp <- cols[[path$i]]
      gcols <- grp@columns
      gcols[[path$j]] <- NULL
      grp@columns <- gcols
      cols[[path$i]] <- grp
    }
    spec@columns <- cols
    spec
  }

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "hideColumn",
    proxy_args = list(id = field)
  )
}

#' Move a column to a new position
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param field Field or id of the column to move
#' @param to Integer index (1-based) or field name of another column to
#'   position relative to. Integer moves the column to that index.
#'
#' @return The modified input
#' @export
move_column <- function(x, field, to) {
  checkmate::assert_string(field)
  if (!(checkmate::test_integerish(to, len = 1) || checkmate::test_string(to))) {
    cli_abort("{.arg to} must be an integer index or a field name string")
  }

  transform <- function(spec) {
    cols <- spec@columns
    path <- find_column_path(cols, field)
    if (is.null(path)) {
      cli_abort("Column {.val {field}} not found in spec columns")
    }
    # Only support top-level moves in static path; within-group moves are
    # handled by the frontend via moveColumn with the store's scope logic.
    if (!is.na(path$j)) {
      cli_abort("Cannot move {.val {field}} statically: it lives inside a column group")
    }
    target_idx <- if (is.character(to)) {
      tp <- find_column_path(cols, to)
      if (is.null(tp)) cli_abort("Column {.val {to}} not found in spec columns")
      tp$i
    } else {
      as.integer(to)
    }
    target_idx <- max(1L, min(length(cols), target_idx))
    col <- cols[[path$i]]
    cols[[path$i]] <- NULL
    cols <- append(cols, list(col), after = target_idx - 1L)
    spec@columns <- cols
    spec
  }

  # Frontend store's moveColumnItem takes a 0-based newIndex; convert.
  proxy_new_index <- if (is.character(to)) NA_integer_ else as.integer(to) - 1L

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "moveColumn",
    proxy_args = list(
      itemId = field,
      newIndex = proxy_new_index,
      before = if (is.character(to)) to else NA_character_
    )
  )
}

#' Resize a column
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param field Field or id of the column
#' @param width Width in pixels (>= 40)
#'
#' @return The modified input
#' @export
resize_column <- function(x, field, width) {
  checkmate::assert_string(field)
  checkmate::assert_number(width, lower = 40)

  transform <- function(spec) {
    update_column_in_spec(spec, field, function(col) {
      col@width <- width
      col
    })
  }

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "setColumnWidth",
    proxy_args = list(columnId = field, width = width)
  )
}

#' Update a column's properties
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param field Field or id of the column
#' @param ... Named properties to update. Top-level properties (`header`,
#'   `align`, `header_align`, `wrap`, `sortable`, `width`) are written
#'   directly. Any other name is merged into the column's `options` list
#'   (at the top level; sub-keyed options like `options$numeric$decimals`
#'   can be passed as a named list: `options = list(numeric = list(decimals = 3))`).
#'
#' @return The modified input
#' @export
update_column <- function(x, field, ...) {
  checkmate::assert_string(field)
  changes <- list(...)
  if (length(changes) == 0) {
    cli_warn("No changes passed to {.fn update_column}")
  }

  top_props <- c("header", "align", "header_align", "wrap", "sortable", "width")

  apply_col <- function(col) {
    for (nm in names(changes)) {
      val <- changes[[nm]]
      if (nm %in% top_props) {
        S7::prop(col, nm) <- val
      } else if (nm == "options") {
        if (!is.list(val)) cli_abort("`options` must be a list")
        col@options <- utils::modifyList(col@options, val)
      } else {
        # Unknown name: write into options as a top-level key.
        col@options[[nm]] <- val
      }
    }
    col
  }

  transform <- function(spec) {
    update_column_in_spec(spec, field, apply_col)
  }

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "updateColumn",
    proxy_args = list(
      id = field,
      changes = changes
    )
  )
}

# ----------------------------------------------------------------------------
# Row / data verbs
# ----------------------------------------------------------------------------

#' Sort rows by a column
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param by Field or id of the column to sort by
#' @param direction One of "asc", "desc", or "none" (clears sort)
#'
#' @return The modified input
#' @export
sort_rows <- function(x, by, direction = c("asc", "desc", "none")) {
  direction <- match.arg(direction)
  checkmate::assert_string(by)

  transform <- function(spec) {
    if (direction == "none") return(spec)
    data <- spec@data
    if (!by %in% names(data)) {
      cli_abort("Column {.val {by}} not found in data")
    }
    ord <- order(data[[by]], decreasing = (direction == "desc"))
    spec@data <- data[ord, , drop = FALSE]
    spec
  }

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "sortBy",
    proxy_args = list(column = by, direction = direction)
  )
}

#' Filter rows
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param field Field to filter on
#' @param operator One of "eq", "neq", "gt", "lt", "contains"
#' @param value Filter value
#'
#' @return The modified input
#' @export
filter_rows <- function(
    x, field,
    operator = c("eq", "neq", "gt", "lt", "contains"),
    value) {
  operator <- match.arg(operator)
  checkmate::assert_string(field)

  transform <- function(spec) {
    data <- spec@data
    if (!field %in% names(data)) {
      cli_abort("Column {.val {field}} not found in data")
    }
    col <- data[[field]]
    keep <- switch(operator,
      eq = col == value,
      neq = col != value,
      gt = col > value,
      lt = col < value,
      contains = grepl(value, as.character(col), fixed = TRUE)
    )
    keep[is.na(keep)] <- FALSE
    spec@data <- data[keep, , drop = FALSE]
    spec
  }

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "applyFilter",
    proxy_args = list(filter = list(
      field = field, operator = operator, value = value
    ))
  )
}

#' Clear all row filters
#'
#' For static inputs this is a no-op (there is no stored filter state);
#' for a proxy it clears the running widget's filters.
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @return The modified input
#' @export
clear_filters <- function(x) {
  if (inherits(x, "tabviz_proxy")) {
    return(invoke_proxy_method(x, "clearFilter", list()))
  }
  spec <- extract_spec(x)
  repack(x, spec)
}

#' Select rows
#'
#' Replaces the current row selection with the given ids (proxy only).
#' Static inputs warn (no persisted selection state).
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param row_ids Character vector of row ids to select
#'
#' @return The input (invisibly for proxies)
#' @export
select_rows <- function(x, row_ids) {
  row_ids <- as.character(row_ids)
  if (inherits(x, "tabviz_proxy")) {
    return(invoke_proxy_method(x, "selectRows", list(rowIds = as.list(row_ids))))
  }
  cli_warn("Row selection is a runtime concept; ignored for static inputs")
  x
}

#' Move a row to a new position
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param row_id Row id (the value in the label/id column)
#' @param to Integer index (1-based) or row id of another row to position relative to
#'
#' @return The modified input
#' @export
move_row <- function(x, row_id, to) {
  checkmate::assert_string(row_id)

  transform <- function(spec) {
    data <- spec@data
    # Use the leftmost visible ColumnSpec's field as the id column if
    # available; otherwise fall back to rownames.
    id_field <- NULL
    for (col in spec@columns) {
      if (S7_inherits(col, ColumnSpec)) { id_field <- col@field; break }
      if (S7_inherits(col, ColumnGroup) && length(col@columns) > 0) {
        id_field <- col@columns[[1]]@field; break
      }
    }
    if (is.null(id_field) || !id_field %in% names(data)) {
      cli_abort("Could not locate a row-id column for static move_row")
    }
    ids <- as.character(data[[id_field]])
    src <- match(row_id, ids)
    if (is.na(src)) cli_abort("Row {.val {row_id}} not found in data")
    dst <- if (is.character(to)) {
      m <- match(to, ids)
      if (is.na(m)) cli_abort("Row {.val {to}} not found in data")
      m
    } else {
      as.integer(to)
    }
    dst <- max(1L, min(nrow(data), dst))
    ord <- seq_len(nrow(data))
    ord <- ord[ord != src]
    ord <- append(ord, src, after = dst - 1L)
    spec@data <- data[ord, , drop = FALSE]
    spec
  }

  proxy_new_index <- if (is.character(to)) NA_integer_ else as.integer(to) - 1L

  apply_spec_or_proxy(
    x, transform,
    proxy_method = "moveRow",
    proxy_args = list(
      rowId = row_id,
      newIndex = proxy_new_index,
      before = if (is.character(to)) to else NA_character_
    )
  )
}

#' Replace the data frame
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param data A data.frame with the same column names as the existing one
#'
#' @return The modified input
#' @export
update_data <- function(x, data) {
  data <- as.data.frame(data)

  if (inherits(x, "tabviz_proxy")) {
    # For proxy: rebuild a full WebSpec from the attached webspec (if any)
    # and send the serialized payload. Users on a proxy typically have the
    # original spec, so accept either a data.frame or a WebSpec here.
    if (S7_inherits(data, WebSpec)) {
      payload <- serialize_spec(data, include_forest = TRUE)
    } else {
      # Minimal path: require caller to pass a WebSpec for proxy updates.
      cli_abort(c(
        "Proxy {.fn update_data} requires a WebSpec, not a raw data.frame.",
        i = "Build a fresh spec with {.fn tabviz} (or {.fn web_spec}) and pass it here."
      ))
    }
    return(invoke_proxy_method(x, "updateData", list(spec = payload)))
  }

  spec <- extract_spec(x)
  spec@data <- data
  repack(x, spec)
}

#' Toggle a group's collapsed state
#'
#' @param x A WebSpec, htmlwidget, or tabviz_proxy
#' @param group_id The group id to toggle
#' @param collapsed TRUE to collapse, FALSE to expand, NULL to toggle
#'
#' @return The modified input
#' @export
toggle_group <- function(x, group_id, collapsed = NULL) {
  checkmate::assert_string(group_id)

  if (inherits(x, "tabviz_proxy")) {
    return(invoke_proxy_method(x, "toggleGroup", list(
      groupId = group_id,
      collapsed = collapsed
    )))
  }

  spec <- extract_spec(x)
  if (length(spec@groups) == 0) {
    cli_warn("Spec has no groups; {.fn toggle_group} has no effect on static input")
    return(repack(x, spec))
  }
  groups <- spec@groups
  for (i in seq_along(groups)) {
    if (identical(groups[[i]]@id, group_id)) {
      new_val <- if (is.null(collapsed)) !groups[[i]]@collapsed else isTRUE(collapsed)
      groups[[i]]@collapsed <- new_val
    }
  }
  spec@groups <- groups
  repack(x, spec)
}

# ----------------------------------------------------------------------------
# Cell-edit verbs (proxy-only)
# ----------------------------------------------------------------------------

#' Set a single cell value on the running widget
#'
#' @param x A tabviz_proxy
#' @param row_id Row id (value in the id column)
#' @param field Data field name of the cell
#' @param value New value
#'
#' @return The proxy (invisibly)
#' @export
set_cell <- function(x, row_id, field, value) {
  checkmate::assert_string(row_id)
  checkmate::assert_string(field)
  if (!inherits(x, "tabviz_proxy")) {
    cli_warn("{.fn set_cell} is a runtime verb; ignored for static inputs")
    return(x)
  }
  invoke_proxy_method(x, "setCell", list(
    rowId = row_id, field = field, value = value
  ))
}

#' Set a row's label on the running widget
#'
#' @param x A tabviz_proxy
#' @param row_id Row id
#' @param label New label text
#'
#' @return The proxy (invisibly)
#' @export
set_row_label <- function(x, row_id, label) {
  checkmate::assert_string(row_id)
  checkmate::assert_string(label)
  if (!inherits(x, "tabviz_proxy")) {
    cli_warn("{.fn set_row_label} is a runtime verb; ignored for static inputs")
    return(x)
  }
  invoke_proxy_method(x, "setRowLabel", list(rowId = row_id, label = label))
}

#' Clear all in-widget cell and label edits
#'
#' @param x A tabviz_proxy
#' @return The proxy (invisibly)
#' @export
clear_edits <- function(x) {
  if (!inherits(x, "tabviz_proxy")) {
    cli_warn("{.fn clear_edits} is a runtime verb; ignored for static inputs")
    return(x)
  }
  invoke_proxy_method(x, "clearEdits", list())
}
