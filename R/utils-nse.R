# NSE (Non-Standard Evaluation) utilities for style expressions
#
# This module provides tidyeval support for row and cell styling parameters.
# Users can specify styles using:
#   - Column names (character): "is_significant"
#   - Formulas: ~ p_value < 0.05
#   - For cell-level: ~ .x < 0.05 (where .x is the cell value)

#' Resolve a style expression to a column name
#'
#' Handles both column name strings and formula expressions for styling.
#' When a formula is provided, evaluates it against the data and creates
#' a computed column with the results.
#'
#' @param expr The styling expression: either a column name (character) or formula
#' @param data The data frame to evaluate against
#' @param param_name Name of the parameter (for error messages)
#' @param env Environment for formula evaluation (default: caller's environment)
#'
#' @return A list with:
#'   - `col_name`: The column name to use (either original or computed)
#'   - `data`: The (possibly modified) data frame with computed column added
#'
#' @keywords internal
#' @examples
#' \dontrun{
#' df <- data.frame(p = c(0.01, 0.1, 0.001))
#'
#' # Column name
#' resolve_style_expr("is_sig", df, "row_bold")
#'

#' # Formula
#' resolve_style_expr(~ p < 0.05, df, "row_bold")
#' }
resolve_style_expr <- function(expr, data, param_name, env = parent.frame()) {

  # Handle NULL - no styling

  if (is.null(expr)) {
    return(list(col_name = NA_character_, data = data))
  }

 # Handle NA
  if (is_na_scalar(expr)) {
    return(list(col_name = NA_character_, data = data))
  }

  # Handle character - column name reference
 if (is.character(expr)) {
    checkmate::assert_string(expr, .var.name = param_name)
    # Validate column exists
    if (!expr %in% names(data)) {
      cli::cli_abort(
        "Column {.val {expr}} specified in {.arg {param_name}} not found in data.",
        call = NULL
      )
    }
    return(list(col_name = expr, data = data))
  }

  # Handle formula - evaluate expression
  if (rlang::is_formula(expr)) {
    return(resolve_formula_expr(expr, data, param_name, env))
  }

  # Handle quosure (from enquo)
  if (rlang::is_quosure(expr)) {
    return(resolve_quosure_expr(expr, data, param_name))
  }

  # Invalid type
  cli::cli_abort(
    c(
      "{.arg {param_name}} must be a column name (character) or formula.",
      "x" = "Got {.cls {class(expr)[[1]]}}."
    ),
    call = NULL
  )
}

#' Resolve a formula expression for row styling
#'
#' Evaluates a formula (e.g., `~ p_value < 0.05`) against each row of the data
#' and creates a computed column with the logical results.
#'
#' @param formula A formula expression
#' @param data The data frame
#' @param param_name Parameter name for errors
#' @param env Evaluation environment
#'
#' @return List with col_name and modified data
#' @keywords internal
resolve_formula_expr <- function(formula, data, param_name, env = parent.frame()) {
  checkmate::assert_class(formula, "formula", .var.name = param_name)

  # Get the right-hand side of the formula
  rhs <- rlang::f_rhs(formula)

  # Create a unique column name for the computed result
  col_name <- generate_computed_col_name(param_name)

  # Evaluate the expression row-wise
  # Use rlang::eval_tidy with data as the data mask
  tryCatch({
    result <- rlang::eval_tidy(rhs, data = data, env = rlang::f_env(formula) %||% env)

    # Validate result
    validate_style_result(result, nrow(data), param_name, formula)

    # Add to data
    data[[col_name]] <- result

    list(col_name = col_name, data = data)
  }, error = function(e) {
    cli::cli_abort(
      c(
        "Error evaluating formula in {.arg {param_name}}.",
        "i" = "Formula: {.code {rlang::expr_deparse(formula)}}",
        "x" = conditionMessage(e)
      ),
      call = NULL
    )
  })
}

#' Resolve a quosure expression
#'
#' @param quo A quosure
#' @param data The data frame
#' @param param_name Parameter name for errors
#'
#' @return List with col_name and modified data
#' @keywords internal
resolve_quosure_expr <- function(quo, data, param_name) {
  checkmate::assert_class(quo, "quosure", .var.name = param_name)

  col_name <- generate_computed_col_name(param_name)

  tryCatch({
    result <- rlang::eval_tidy(quo, data = data)

    validate_style_result(result, nrow(data), param_name, quo)

    data[[col_name]] <- result

    list(col_name = col_name, data = data)
  }, error = function(e) {
    cli::cli_abort(
      c(
        "Error evaluating expression in {.arg {param_name}}.",
        "x" = conditionMessage(e)
      ),
      call = NULL
    )
  })
}

#' Resolve a cell-level style expression
#'
#' Similar to resolve_style_expr but supports `.x` pronoun for the column's
#' own values. Used for cell-level styling in web_col().
#'
#' @param expr Style expression (character or formula)
#' @param data The data frame
#' @param field The column field name (for .x binding)
#' @param param_name Parameter name for errors
#' @param env Evaluation environment
#'
#' @return List with col_name and modified data
#' @keywords internal
#'
#' @examples
#' \dontrun{
#' df <- data.frame(p = c(0.01, 0.1, 0.001))
#'
#' # .x refers to the column values
#' resolve_cell_style_expr(~ .x < 0.05, df, "p", "bold")
#' }
resolve_cell_style_expr <- function(expr, data, field, param_name, env = parent.frame()) {
  # Handle NULL/NA
  if (is.null(expr) || is_na_scalar(expr)) {
    return(list(col_name = NA_character_, data = data))
  }

  # Handle character - column name
  if (is.character(expr)) {
    checkmate::assert_string(expr, .var.name = param_name)
    if (!expr %in% names(data)) {
      cli::cli_abort(
        "Column {.val {expr}} specified in {.arg {param_name}} not found in data.",
        call = NULL
      )
    }
    return(list(col_name = expr, data = data))
  }

  # Handle formula with .x support
  if (rlang::is_formula(expr)) {
    return(resolve_cell_formula_expr(expr, data, field, param_name, env))
  }

  cli::cli_abort(
    c(
      "{.arg {param_name}} must be a column name (character) or formula.",
      "x" = "Got {.cls {class(expr)[[1]]}}."
    ),
    call = NULL
  )
}

#' Resolve a cell-level formula with .x support
#'
#' @param formula Formula expression (can use .x for column values)
#' @param data Data frame
#' @param field Column field name for .x binding
#' @param param_name Parameter name for errors
#' @param env Evaluation environment
#'
#' @return List with col_name and modified data
#' @keywords internal
resolve_cell_formula_expr <- function(formula, data, field, param_name, env = parent.frame()) {
  checkmate::assert_class(formula, "formula", .var.name = param_name)

  rhs <- rlang::f_rhs(formula)
  col_name <- generate_computed_col_name(paste0(field, "_", param_name))

  # Validate field exists
  if (!field %in% names(data)) {
    cli::cli_abort(
      "Column {.val {field}} not found in data for cell styling.",
      call = NULL
    )
  }

  tryCatch({
    # Create data list with .x bound to the column values
    # This allows formulas like ~ .x < 0.05 where .x is the cell value
    data_with_x <- c(list(.x = data[[field]]), as.list(data))

    result <- rlang::eval_tidy(
      rhs,
      data = data_with_x,
      env = rlang::f_env(formula) %||% env
    )

    validate_style_result(result, nrow(data), param_name, formula)

    data[[col_name]] <- result

    list(col_name = col_name, data = data)
  }, error = function(e) {
    cli::cli_abort(
      c(
        "Error evaluating cell formula in {.arg {param_name}}.",
        "i" = "Formula: {.code {rlang::expr_deparse(formula)}}",
        "i" = "Column: {.val {field}}",
        "x" = conditionMessage(e)
      ),
      call = NULL
    )
  })
}

#' Validate style evaluation result
#'
#' Ensures the result of a style expression is valid.
#'
#' @param result Evaluation result
#' @param expected_length Expected vector length
#' @param param_name Parameter name for errors
#' @param expr Original expression (for error message)
#'
#' @keywords internal
validate_style_result <- function(result, expected_length, param_name, expr) {
  # Check type based on parameter name
  is_semantic <- grepl("emphasis|muted|accent|bold|italic", param_name, ignore.case = TRUE)

  if (is_semantic) {
    # Semantic/boolean styles should be logical
    if (!is.logical(result) && !is.numeric(result)) {
      cli::cli_abort(
        c(
          "Expression in {.arg {param_name}} must evaluate to logical values.",
          "i" = "Got {.cls {class(result)[[1]]}}.",
          "i" = "Expression: {.code {rlang::expr_deparse(expr)}}"
        ),
        call = NULL
      )
    }
    # Coerce numeric to logical
    if (is.numeric(result)) {
      result <- as.logical(result)
    }
  }

  # Check length
  if (length(result) != expected_length && length(result) != 1) {
    cli::cli_abort(
      c(
        "Expression in {.arg {param_name}} must return {expected_length} values (one per row).",
        "x" = "Got {length(result)} values.",
        "i" = "Expression: {.code {rlang::expr_deparse(expr)}}"
      ),
      call = NULL
    )
  }

  # Recycle length-1 result
  if (length(result) == 1) {
    result <- rep(result, expected_length)
  }

  invisible(result)
}

#' Generate a unique column name for computed style
#'
#' @param param_name Base parameter name
#' @return Unique column name string
#' @keywords internal
generate_computed_col_name <- function(param_name) {
  paste0(".wf_computed_", param_name, "_", format(Sys.time(), "%H%M%S%OS3"))
}

#' Check if value is a scalar NA
#'
#' @param x Value to check
#' @return Logical
#' @keywords internal
is_na_scalar <- function(x) {
  is.atomic(x) && length(x) == 1 && is.na(x)
}

#' Resolve multiple style expressions
#'
#' Convenience function to resolve multiple row styling parameters at once.
#' Modifies the data frame in place and returns column names.
#'
#' @param data Data frame
#' @param ... Named style expressions (e.g., row_bold = ~ p < 0.05)
#' @param .env Evaluation environment
#'
#' @return List with:
#'   - `data`: Modified data frame
#'   - Named elements for each resolved column name
#'
#' @keywords internal
#' @examples
#' \dontrun{
#' df <- data.frame(p = c(0.01, 0.1), is_key = c(TRUE, FALSE))
#'
#' result <- resolve_style_exprs(
#'   df,
#'   row_bold = ~ p < 0.05,
#'   row_emphasis = "is_key"
#' )
#' # result$data has new computed column
#' # result$row_bold is the column name
#' # result$row_emphasis is "is_key"
#' }
resolve_style_exprs <- function(data, ..., .env = parent.frame()) {
  checkmate::assert_data_frame(data, min.rows = 1, .var.name = "data")

  exprs <- list(...)
  result <- list(data = data)

  for (name in names(exprs)) {
    resolved <- resolve_style_expr(
      expr = exprs[[name]],
      data = result$data,
      param_name = name,
      env = .env
    )
    result$data <- resolved$data
    result[[name]] <- resolved$col_name
  }

  result
}

#' Resolve cell style expressions for a column
#'
#' Resolves multiple cell-level style expressions for web_col().
#'
#' @param data Data frame
#' @param field Column field name (for .x binding)
#' @param ... Named style expressions
#' @param .env Evaluation environment
#'
#' @return List with data and resolved column names
#' @keywords internal
resolve_cell_style_exprs <- function(data, field, ..., .env = parent.frame()) {
  checkmate::assert_data_frame(data, min.rows = 1, .var.name = "data")
  checkmate::assert_string(field, .var.name = "field")

  exprs <- list(...)
  result <- list(data = data)

  for (name in names(exprs)) {
    resolved <- resolve_cell_style_expr(
      expr = exprs[[name]],
      data = result$data,
      field = field,
      param_name = name,
      env = .env
    )
    result$data <- resolved$data
    result[[name]] <- resolved$col_name
  }

  result
}

#' Resolve column style expressions for a ColumnSpec
#'
#' Resolves any formula expressions in a column's style properties.
#' For cell-level styling, the `.x` pronoun refers to the column's own values.
#'
#' @param col A ColumnSpec object
#' @param data The data frame
#' @param env Evaluation environment
#'
#' @return A list with:
#'   - `col`: The modified ColumnSpec with resolved column names
#'   - `data`: The (possibly modified) data frame with computed columns
#'
#' @keywords internal
resolve_column_style <- function(col, data, env = parent.frame()) {
  # Use S7_inherits for S7 classes (checkmate doesn't support S7)
  if (!S7_inherits(col, ColumnSpec)) {
    cli::cli_abort("{.arg col} must be a ColumnSpec object.", call = NULL)
  }
  checkmate::assert_data_frame(data, .var.name = "data")

  # Get the field this column displays (for .x binding)
  field <- col@field

  # Resolve each style property
  # We accumulate computed columns in result_data
  result_data <- data

  # Helper to resolve one property (uses result_data from enclosing scope)
  resolve_one <- function(expr, param_name) {
    if (is.null(expr) || is_na_scalar(expr)) {
      return(list(col_name = NA_character_, data = result_data))
    }

    if (is.character(expr)) {
      # Validate column exists
      checkmate::assert_string(expr, .var.name = param_name)
      if (!expr %in% names(result_data)) {
        cli::cli_abort(
          "Column {.val {expr}} specified in {.arg {param_name}} not found in data.",
          call = NULL
        )
      }
      return(list(col_name = expr, data = result_data))
    }

    if (rlang::is_formula(expr)) {
      # Use cell-level resolution with .x support
      return(resolve_cell_formula_expr(expr, result_data, field, param_name, env))
    }

    cli::cli_abort(
      c(
        "{.arg {param_name}} must be a column name (character) or formula.",
        "x" = "Got {.cls {class(expr)[[1]]}}."
      ),
      call = NULL
    )
  }

  # style_bold
  res <- resolve_one(col@style_bold, "bold")
  result_data <- res$data
  col@style_bold <- res$col_name

  # style_italic
  res <- resolve_one(col@style_italic, "italic")
  result_data <- res$data
  col@style_italic <- res$col_name

  # style_color
  res <- resolve_one(col@style_color, "color")
  result_data <- res$data
  col@style_color <- res$col_name

  # style_bg
  res <- resolve_one(col@style_bg, "bg")
  result_data <- res$data
  col@style_bg <- res$col_name

  # style_badge
  res <- resolve_one(col@style_badge, "badge")
  result_data <- res$data
  col@style_badge <- res$col_name

  # style_icon
  res <- resolve_one(col@style_icon, "icon")
  result_data <- res$data
  col@style_icon <- res$col_name

  # style_emphasis
  res <- resolve_one(col@style_emphasis, "emphasis")
  result_data <- res$data
  col@style_emphasis <- res$col_name

  # style_muted
  res <- resolve_one(col@style_muted, "muted")
  result_data <- res$data
  col@style_muted <- res$col_name

  # style_accent
  res <- resolve_one(col@style_accent, "accent")
  result_data <- res$data
  col@style_accent <- res$col_name

  list(col = col, data = result_data)
}

#' Resolve styles for all columns
#'
#' Iterates through all columns (including those in ColumnGroups) and resolves
#' any formula expressions in their style properties.
#'
#' @param columns List of ColumnSpec or ColumnGroup objects
#' @param data The data frame
#' @param env Evaluation environment
#'
#' @return A list with:
#'   - `columns`: The modified column list with resolved style column names
#'   - `data`: The (possibly modified) data frame with computed columns
#'
#' @keywords internal
resolve_all_column_styles <- function(columns, data, env = parent.frame()) {
  checkmate::assert_list(columns, .var.name = "columns")
  checkmate::assert_data_frame(data, .var.name = "data")

  result_data <- data
  result_columns <- list()

  for (i in seq_along(columns)) {
    col <- columns[[i]]

    if (S7_inherits(col, ColumnSpec)) {
      # Resolve styles for this column
      res <- resolve_column_style(col, result_data, env)
      result_data <- res$data
      result_columns[[i]] <- res$col
    } else if (S7_inherits(col, ColumnGroup)) {
      # Resolve styles for columns within the group
      group_cols <- col@columns
      resolved_group_cols <- list()

      for (j in seq_along(group_cols)) {
        res <- resolve_column_style(group_cols[[j]], result_data, env)
        result_data <- res$data
        resolved_group_cols[[j]] <- res$col
      }

      col@columns <- resolved_group_cols
      result_columns[[i]] <- col
    } else {
      # Pass through unknown types
      result_columns[[i]] <- col
    }
  }

  list(columns = result_columns, data = result_data)
}

#' Resolve all row-level style expressions
#'
#' Convenience function used by web_spec() to resolve all row styling
#' parameters at once. Supports both column names and formulas.
#'
#' @param data Data frame
#' @param row_bold Bold styling expression
#' @param row_italic Italic styling expression
#' @param row_color Text color expression
#' @param row_bg Background color expression
#' @param row_badge Badge expression
#' @param row_icon Icon expression
#' @param row_indent Indent expression
#' @param row_type Row type expression
#' @param row_emphasis Emphasis styling expression
#' @param row_muted Muted styling expression
#' @param row_accent Accent styling expression
#' @param marker_color Marker color expression
#' @param marker_shape Marker shape expression
#' @param marker_opacity Marker opacity expression
#' @param marker_size Marker size expression
#' @param weight Deprecated weight expression
#'
#' @return List with:
#'   - `data`: Modified data frame (with computed columns if formulas used)
#'   - Named elements for each resolved column name (NA_character_ if NULL)
#'
#' @keywords internal
resolve_row_style_exprs <- function(
    data,
    row_bold = NULL,
    row_italic = NULL,
    row_color = NULL,
    row_bg = NULL,
    row_badge = NULL,
    row_icon = NULL,
    row_indent = NULL,
    row_type = NULL,
    row_emphasis = NULL,
    row_muted = NULL,
    row_accent = NULL,
    marker_color = NULL,
    marker_shape = NULL,
    marker_opacity = NULL,
    marker_size = NULL,
    weight = NULL
) {
  checkmate::assert_data_frame(data, min.rows = 0, .var.name = "data")

  # Handle empty data frame
  if (nrow(data) == 0) {
    return(list(
      data = data,
      row_bold = NA_character_,
      row_italic = NA_character_,
      row_color = NA_character_,
      row_bg = NA_character_,
      row_badge = NA_character_,
      row_icon = NA_character_,
      row_indent = NA_character_,
      row_type = NA_character_,
      row_emphasis = NA_character_,
      row_muted = NA_character_,
      row_accent = NA_character_,
      marker_color = NA_character_,
      marker_shape = NA_character_,
      marker_opacity = NA_character_,
      marker_size = NA_character_,
      weight = NA_character_
    ))
  }

  result <- list(data = data)
  env <- parent.frame()

  # Helper to resolve and store
  resolve_one <- function(expr, param_name) {
    resolved <- resolve_style_expr(expr, result$data, param_name, env)
    result$data <<- resolved$data
    resolved$col_name
  }

  # Resolve each styling parameter
  result$row_bold <- resolve_one(row_bold, "row_bold")
  result$row_italic <- resolve_one(row_italic, "row_italic")
  result$row_color <- resolve_one(row_color, "row_color")
  result$row_bg <- resolve_one(row_bg, "row_bg")
  result$row_badge <- resolve_one(row_badge, "row_badge")
  result$row_icon <- resolve_one(row_icon, "row_icon")
  result$row_indent <- resolve_one(row_indent, "row_indent")
  result$row_type <- resolve_one(row_type, "row_type")
  result$row_emphasis <- resolve_one(row_emphasis, "row_emphasis")
  result$row_muted <- resolve_one(row_muted, "row_muted")
  result$row_accent <- resolve_one(row_accent, "row_accent")
  result$marker_color <- resolve_one(marker_color, "marker_color")
  result$marker_shape <- resolve_one(marker_shape, "marker_shape")
  result$marker_opacity <- resolve_one(marker_opacity, "marker_opacity")
  result$marker_size <- resolve_one(marker_size, "marker_size")
  result$weight <- resolve_one(weight, "weight")

  result
}
