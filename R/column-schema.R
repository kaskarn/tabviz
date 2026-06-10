# Column-schema introspection — the queryable column contract.
#
# tabviz's column types and their options live in the TS SCHEMA_REGISTRY (the
# single source of truth). These wrappers surface that contract to R authors
# and LLM drivers via the V8 bridge, so "what column types exist?" and "what
# does col_pvalue accept, and which options can a theme default?" are
# answerable functions instead of doc-spelunking. Companions to
# set_column_default(): list_column_types() tells you the types, column_schema()
# tells you which of a type's options are theme-defaultable (kind != "core").

#' List every column type tabviz can render
#'
#' Introspects the engine's column-schema registry and returns one row per
#' concrete (instantiable) column type. Abstract structural schemas are
#' excluded. A discovery companion to [column_schema()] and
#' [set_column_default()].
#'
#' @return A data frame with columns `type` (the string `col_*()` emits),
#'   `label`, `options` (effective option count, own + inherited),
#'   `themeable` (how many of those a theme's `column_defaults` may set), and
#'   `inherits` (comma-separated parent schema keys).
#' @examples
#' \dontrun{
#' list_column_types()
#' }
#' @seealso [column_schema()], [set_column_default()]
#' @export
list_column_types <- function() {
  rows <- ts_call("listColumnTypes", list())
  if (length(rows) == 0L) {
    return(data.frame(
      type = character(0), label = character(0), options = integer(0),
      themeable = integer(0), inherits = character(0), stringsAsFactors = FALSE
    ))
  }
  scalar <- function(field, mode) vapply(rows, function(r) {
    v <- r[[field]]
    if (is.null(v)) (if (mode == "character") NA_character_ else NA_integer_) else v
  }, if (mode == "character") character(1) else integer(1))
  data.frame(
    type      = scalar("type", "character"),
    label     = scalar("label", "character"),
    options   = scalar("options", "integer"),
    themeable = scalar("themeable", "integer"),
    inherits  = vapply(rows, function(r) paste(unlist(r$inherits), collapse = ", "), character(1)),
    stringsAsFactors = FALSE
  )
}

#' Describe a column type's option contract
#'
#' Returns the full set of options a column type accepts — resolved across the
#' schema inheritance chain — with each option's `kind`, default, valid
#' choices, and whether a theme may default it. This is the machine-readable
#' contract behind `col_<type>()`: use it to discover option names/values, or
#' to see exactly which options a theme's `column_defaults` (via
#' [set_column_default()]) is allowed to touch (`themeable == TRUE`, i.e.
#' `kind` is `"styling"` or `"editor"`; `"core"` options change what the data
#' means and are never theme-defaultable).
#'
#' @param type A column type string, e.g. `"pvalue"`, `"numeric"`, `"bar"`.
#'   One of [list_column_types()]`$type`.
#' @return A data frame with one row per option: `option`, `kind`
#'   (`core`/`styling`/`editor`), `themeable` (logical), `control`, `default`,
#'   `choices` (comma-separated valid values, or `NA`), `hint`, and
#'   `inherited_from` (the schema in the chain that declares it).
#' @examples
#' \dontrun{
#' column_schema("pvalue")
#' # just the theme-defaultable ones:
#' subset(column_schema("pvalue"), themeable)
#' }
#' @seealso [list_column_types()], [set_column_default()]
#' @export
column_schema <- function(type) {
  checkmate::assert_string(type, min.chars = 1L)
  rows <- ts_call("columnSchema", list(type = type))
  collapse <- function(x) {
    if (is.null(x) || length(x) == 0L) return(NA_character_)
    # paste (not format) — format() left-pads character vectors to a common
    # width, leaking trailing whitespace into the choices string.
    paste(x, collapse = ", ")
  }
  chr <- function(field) vapply(rows, function(r) {
    v <- r[[field]]; if (is.null(v)) NA_character_ else as.character(v)
  }, character(1))
  data.frame(
    option         = chr("option"),
    kind           = chr("kind"),
    themeable      = vapply(rows, function(r) isTRUE(r$themeable), logical(1)),
    control        = chr("control"),
    default        = vapply(rows, function(r) collapse(r$default), character(1)),
    choices        = vapply(rows, function(r) collapse(r$choices), character(1)),
    hint           = chr("hint"),
    inherited_from = chr("inheritedFrom"),
    stringsAsFactors = FALSE
  )
}
