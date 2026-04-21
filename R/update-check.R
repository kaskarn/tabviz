# Once-per-day nudge when a newer minor version of tabviz is available.
#
# Called lazily from `tabviz()` — never from `.onLoad()` — so package load,
# R CMD check, CRAN checks, and non-interactive scripts pay nothing.
#
# Cache location: tools::R_user_dir("tabviz", "cache") / update_check.rds
# (base-R equivalent of rappdirs::user_cache_dir; no extra dependency).
#
# Opt-out:
#   * options(tabviz.check_updates = FALSE)
#   * Sys.setenv(TABVIZ_NO_UPDATE_CHECK = "1")

#' @keywords internal
#' @noRd
check_for_update <- function() {
  # Gate aggressively: only interactive users with opt-in, never in
  # CI/testthat/R CMD check/devtools::check/pkgdown builds.
  if (!interactive()) return(invisible(NULL))
  if (isTRUE(getOption("tabviz.check_updates") == FALSE)) return(invisible(NULL))
  if (nzchar(Sys.getenv("TABVIZ_NO_UPDATE_CHECK"))) return(invisible(NULL))
  if (nzchar(Sys.getenv("R_CHECK_RUNNING_EXAMPLES_"))) return(invisible(NULL))
  if (identical(Sys.getenv("CI"), "true")) return(invisible(NULL))
  if (identical(Sys.getenv("NOT_CRAN"), "true") && identical(Sys.getenv("TESTTHAT"), "true")) {
    return(invisible(NULL))
  }

  cache_dir <- tryCatch(tools::R_user_dir("tabviz", "cache"), error = function(e) NULL)
  if (is.null(cache_dir)) return(invisible(NULL))
  dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
  stamp_file <- file.path(cache_dir, "update_check.rds")

  now <- Sys.time()
  one_day <- 24 * 60 * 60
  prev <- if (file.exists(stamp_file)) {
    tryCatch(readRDS(stamp_file), error = function(e) NULL)
  } else NULL

  # If we successfully checked in the past 24h, reuse the cached result
  # (including cached NULLs so a flaky network doesn't hammer remotes).
  fresh <- !is.null(prev) && inherits(prev$when, "POSIXct") &&
    difftime(now, prev$when, units = "secs") < one_day

  latest <- if (fresh) {
    prev$latest
  } else {
    v <- tryCatch(fetch_latest_tabviz_version(), error = function(e) NULL)
    tryCatch(saveRDS(list(when = now, latest = v), stamp_file), error = function(e) NULL)
    v
  }

  if (is.null(latest) || !nzchar(latest)) return(invisible(NULL))

  installed <- tryCatch(utils::packageVersion("tabviz"), error = function(e) NULL)
  if (is.null(installed)) return(invisible(NULL))

  if (is_newer_minor(latest, installed)) {
    cli::cli_inform(c(
      "i" = "A newer version of {.pkg tabviz} is available: {.val {latest}} (installed: {.val {as.character(installed)}}).",
      " " = "Install: {.code remotes::install_github(\"kaskarn/tabviz\")}.",
      " " = "Silence: {.code options(tabviz.check_updates = FALSE)}."
    ), class = "tabviz_update_available")
  }
  invisible(NULL)
}

# Strictly-newer comparison at the major.minor level. A remote patch bump
# does not trigger the message; only a minor (or major) bump does.
is_newer_minor <- function(remote, local) {
  r <- tryCatch(unclass(numeric_version(as.character(remote)))[[1]], error = function(e) NULL)
  l <- tryCatch(unclass(numeric_version(as.character(local)))[[1]], error = function(e) NULL)
  if (is.null(r) || is.null(l) || length(r) < 2 || length(l) < 2) return(FALSE)
  if (r[1] != l[1]) return(r[1] > l[1])
  r[2] > l[2]
}

# CRAN first, then GitHub raw DESCRIPTION. Tight timeout so a flaky network
# never stalls the user's session. Returns NULL on any failure.
fetch_latest_tabviz_version <- function() {
  old_timeout <- options(timeout = 3)
  on.exit(options(old_timeout), add = TRUE)

  v <- tryCatch(
    {
      ap <- utils::available.packages(
        repos = "https://cloud.r-project.org",
        fields = "Version",
        quiet = TRUE
      )
      if ("tabviz" %in% rownames(ap)) {
        as.character(ap["tabviz", "Version"])
      } else NULL
    },
    error = function(e) NULL,
    warning = function(w) NULL
  )
  if (!is.null(v) && nzchar(v)) return(v)

  tryCatch(
    {
      url <- "https://raw.githubusercontent.com/kaskarn/tabviz/main/DESCRIPTION"
      con <- url(url)
      on.exit(close(con), add = TRUE)
      txt <- readLines(con, warn = FALSE)
      line <- grep("^Version:\\s*", txt, value = TRUE)
      if (length(line)) sub("^Version:\\s*", "", line[[1]]) else NULL
    },
    error = function(e) NULL,
    warning = function(w) NULL
  )
}
