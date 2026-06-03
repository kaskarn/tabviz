# Stage 2 §2 shell/paper R modifier.

#' Set the shell/paper mode on a theme.
#'
#' The shell/paper two-surface model controls how the widget's outer
#' chrome relates to the inner data card. Four modes:
#'
#' * `flush` (default) — shell + paper share fill; no visible separation.
#' * `raised` — shell is a card; paper sits on it with a slight elevation.
#' * `float` — shell transparent; paper floats with its own drop shadow.
#' * `transparent` — shell transparent; no shadow (minimal chrome).
#'
#' Drives 10 Tier-3 tokens via the TS resolver (`--tv-shell-*` and
#' `--tv-paper-*`).
#'
#' @param theme A [WebTheme].
#' @param mode One of `"flush"`, `"raised"`, `"float"`, `"transparent"`.
#' @return The re-resolved [WebTheme].
#' @export
set_shell_mode <- function(theme, mode) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  checkmate::assert_choice(mode, c("flush", "raised", "float", "transparent"))
  inputs <- theme@inputs
  inputs@shell_mode <- mode
  resolve_from_inputs(inputs, name = theme@name)
}
