#' @keywords internal
"_PACKAGE"

## usethis namespace: start
#' @import S7
#' @importFrom htmlwidgets createWidget shinyWidgetOutput shinyRenderWidget
#' @importFrom jsonlite toJSON
# rlang is used only via qualified rlang:: calls (eval_tidy/f_rhs/f_env/…); the
# `%||%` import was REMOVED — it's now a single local def in conditions.R (with
# extra empty-string/length-0 coalescing the rlang one lacks), and abort/warn/
# inform/is_scalar_* were never used bare. Re-add an @importFrom only if a bare
# rlang symbol is reintroduced.
#' @importFrom cli cli_abort cli_warn cli_inform
#' @importFrom checkmate assert_flag assert_number assert_string assert_choice assert_subset assert_character
## usethis namespace: end
NULL
