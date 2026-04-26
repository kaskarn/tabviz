#' Parse a banding value into its normalized shape
#'
#' Accepts a single string following the banding grammar and returns a list
#' `list(mode = <"none"|"row"|"group">, level = <integer or NA_integer_>)`.
#' `level` is non-NA only for `"group-n"` inputs.
#'
#' @param x A single string. One of `"none"`, `"row"`, `"group"`, or
#'   `"group-n"` where `n` is a positive integer.
#' @param arg Argument name used in error messages (default `"banding"`).
#' @return A list with `mode` and `level`.
#' @keywords internal
#' @export
parse_banding <- function(x, arg = "banding") {
  if (is.logical(x)) {
    cli::cli_abort(c(
      "{.arg {arg}} no longer accepts logical values.",
      "i" = "Use {.val none}, {.val row}, {.val group}, or {.val group-<n>} (e.g. {.val group-2}).",
      "x" = "Got {.val {x}}."
    ))
  }
  checkmate::assert_string(x, .var.name = arg)
  if (x %in% c("none", "row", "group")) {
    return(list(mode = x, level = NA_integer_))
  }
  m <- regmatches(x, regexec("^group-(\\d+)$", x))[[1]]
  if (length(m) == 2L && nzchar(m[2])) {
    n <- suppressWarnings(as.integer(m[2]))
    if (!is.na(n) && n >= 1L) {
      return(list(mode = "group", level = n))
    }
  }
  cli::cli_abort(c(
    "{.arg {arg}} must be one of {.val none}, {.val row}, {.val group}, or {.val group-<n>} (n >= 1).",
    "x" = "Got {.val {x}}."
  ))
}
