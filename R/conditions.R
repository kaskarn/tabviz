# Conditions — named, pre-computed row predicates.
#
# Schema-sprint Phase 5: surfaces the `banks.conditions[]` wire entry
# from R. Authors define a condition by name + rule (formula or
# function); `tabviz()` evaluates the rule against the data at spec
# construction time and ships a materialized boolean vector to the
# widget. Renderers read the vector via `ctx.banks.conditions[name]`
# and apply per-row style overrides through `cond("name")` references
# in `bold` / `italic` / `emphasis` / `muted` / `accent` / `fill`.
#
# Conditions are STATIC within a spec lifetime (Shiny data updates
# require spec rebuild) — by design. Sort + filter never re-evaluate;
# the boolean vector keys against the canonical row index (Phase 1
# keystone), so reorderings can't misalign values.

#' Define a named row predicate
#'
#' Conditions are pre-computed boolean vectors evaluated against the
#' table data once at spec construction. Other columns can reference
#' them by name via [cond()] in style arguments (e.g.
#' `bold = cond("significant")`), so a single rule drives styling
#' across multiple cells / columns without copy-paste.
#'
#' @param name A short identifier used to refer to the condition.
#'   Conventional snake_case ("significant", "is_high_risk").
#' @param rule A formula or function that produces a logical vector of
#'   length `nrow(data)`. Formulas evaluate against the data frame
#'   (e.g. `~ p_value < 0.05`); functions receive a row's metadata
#'   list and the full rows list.
#' @param label Human-readable label for editor / legend display.
#'   Defaults to `name`.
#' @param category Optional grouping hint for the editor.
#'
#' @return A `tabviz_condition` object — a list with class attribute,
#'   carrying `name`, `rule`, `label`, `category`. The rule is
#'   *un-evaluated* at this point; `tabviz()` materializes it against
#'   the data.
#'
#' @export
#' @examples
#' \dontrun{
#' tabviz(
#'   data        = meta,
#'   conditions  = list(
#'     condition("significant", ~ p_value < 0.05)
#'   ),
#'   columns     = list(
#'     col_text("study", bold = cond("significant"))
#'   )
#' )
#' }
condition <- function(name, rule, label = NULL, category = NULL) {
  checkmate::assert_string(name, min.chars = 1L)
  if (!inherits(rule, "formula") && !is.function(rule)) {
    cli::cli_abort(
      "{.arg rule} must be a formula (e.g. {.code ~ p < 0.05}) or a function."
    )
  }
  checkmate::assert_string(label, null.ok = TRUE)
  checkmate::assert_string(category, null.ok = TRUE)
  structure(
    list(name = name, rule = rule, label = label %||% name, category = category),
    class = "tabviz_condition"
  )
}

#' Reference a named condition in a styleMapping argument
#'
#' Returns a tagged-union value the wire-format and renderers
#' recognize as a condition reference. Use it in style arguments of
#' [col_text()], [col_numeric()], and friends:
#'
#'   `col_text("study", bold = cond("significant"))`
#'
#' The condition itself must be defined alongside via
#' [condition()] in `tabviz(conditions = ...)`.
#'
#' @param name The condition's name.
#' @return A list `list(kind = "condition", name = name)` with
#'   class `tabviz_cond_ref` (so downstream code can short-circuit
#'   on `inherits(x, "tabviz_cond_ref")` if needed).
#'
#' @export
#' @examples
#' cond("significant")
cond <- function(name) {
  checkmate::assert_string(name, min.chars = 1L)
  structure(
    list(kind = "condition", name = name),
    class = "tabviz_cond_ref"
  )
}

#' Evaluate a single tabviz_condition against a data frame
#'
#' Returns the materialized ConditionEntry list shape:
#'   list(id = name, label = ..., kind = "boolean", values = c(T,F,...),
#'        ruleText = "..." [if formula], category = ... [if set])
#'
#' Used by `tabviz()`'s spec-build path. Pure: input data unchanged.
#'
#' @param cond A `tabviz_condition` from [condition()].
#' @param data The data frame the rule is evaluated against.
#' @return A list with the wire-shape ConditionEntry fields.
#' @keywords internal
#' @noRd
evaluate_condition <- function(cond, data) {
  if (!inherits(cond, "tabviz_condition")) {
    cli::cli_abort("{.arg cond} must be a {.cls tabviz_condition}.")
  }
  rule <- cond$rule
  n <- nrow(data)

  values <- if (inherits(rule, "formula")) {
    # Reuse the existing formula evaluator. We don't need the
    # computed-column round-trip — just the boolean vector.
    rhs <- rlang::f_rhs(rule)
    raw <- tryCatch(
      rlang::eval_tidy(
        rhs,
        data = data,
        env = rlang::f_env(rule) %||% parent.frame()
      ),
      error = function(e) {
        cli::cli_abort(
          c(
            "Error evaluating condition {.val {cond$name}}.",
            "i" = "Rule: {.code {rlang::expr_deparse(rule)}}",
            "x" = conditionMessage(e)
          ),
          call = NULL
        )
      }
    )
    if (length(raw) == 1L) raw <- rep_len(raw, n)
    as.logical(raw)
  } else {
    # Function rule: (row_metadata, rows_list) -> logical scalar
    vapply(seq_len(n), function(i) {
      row_meta <- as.list(data[i, , drop = FALSE])
      as.logical(rule(row_meta, data))[1L]
    }, logical(1L))
  }

  if (length(values) != n) {
    cli::cli_abort(
      "Condition {.val {cond$name}} returned {length(values)} values; expected {n}."
    )
  }
  if (anyNA(values)) values[is.na(values)] <- FALSE

  out <- list(
    id     = cond$name,
    label  = cond$label,
    kind   = "boolean",
    values = unname(values)
  )
  if (!is.null(cond$category)) out$category <- cond$category
  # Preserve the formula text for round-trip / display, mirroring TS
  # `condition()`'s `ruleText` field.
  if (inherits(rule, "formula")) {
    out$ruleText <- rlang::expr_deparse(rlang::f_rhs(rule))
  }
  out
}

#' Evaluate a list of `tabviz_condition`s against a data frame
#'
#' Pure batch helper used by `tabviz()` at spec construction. Returns
#' the materialized list of ConditionEntry-shaped lists.
#'
#' @param conditions A list of `tabviz_condition` objects (or `NULL`).
#' @param data The data frame.
#' @return A list of ConditionEntry lists. `NULL` if `conditions` is
#'   `NULL`; empty list if `conditions` is an empty list.
#' @keywords internal
#' @noRd
evaluate_conditions <- function(conditions, data) {
  if (is.null(conditions)) return(NULL)
  if (!is.list(conditions)) {
    cli::cli_abort("{.arg conditions} must be a list of {.fn condition} entries.")
  }
  lapply(conditions, evaluate_condition, data = data)
}

# Local null-coalesce — same shape as elsewhere in the package.
`%||%` <- function(x, y) if (is.null(x)) y else x
