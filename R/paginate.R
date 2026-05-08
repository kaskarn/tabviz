# Pagination support for tabviz
#
# The `PaginateSpec` S7 class is defined in `classes-core.R` (so `WebSpec` can
# reference it via `new_union`); this file holds the constructors, format
# presets, shortcut coercion, and the breakpoint algorithm. See plan in
# `~/.claude/plans/let-s-formulate-a-plan-tranquil-jellyfish.md` for context.

#' Configure pagination for a tabviz
#'
#' Attach a `PaginateSpec` to a [tabviz()] (via `paginate = ...`) to break a
#' long table into multiple pages. The HTML viewer renders one page at a time
#' with prev/next controls; PDF export emits one PDF page per logical page.
#' Single-image formats (PNG, SVG) warn and flatten by default — pass an
#' explicit spec to [save_plot()] to override per-render.
#'
#' Breakpoints are computed once on the R side from the data and group
#' structure, so the viewer and the PDF export agree on where each page
#' starts and ends.
#'
#' @param rows Maximum data rows per page (positive integer). Default 30,
#'   tuned for US letter portrait at typical font sizes.
#' @param break_on When forced page breaks should occur. One of:
#'   - `"split"` (default): every `split_by` subview starts on a new page.
#'   - `"group"`: every group starts on a new page (group integrity always
#'     respected when `keep_groups = TRUE`).
#'   - `"none"`: no forced breaks; rows pack continuously.
#' @param keep_groups If `TRUE` (default), never break in the middle of a
#'   group. If a group plus the current page would exceed `rows`, the group
#'   moves to the next page.
#' @param orphan_min Minimum rows on a trailing page. If the last page has
#'   fewer rows than this, rows are pulled back from the prior page. Default
#'   3; set 0 to disable.
#' @param repeat_header,repeat_legend,repeat_title Whether the column header,
#'   forest legend, and plot title repeat on every page in PDF export.
#'   Default `TRUE` for all three. Ignored by the HTML viewer (which always
#'   shows these once at the top of the viewport).
#' @param footnotes_on Where footnotes/source notes appear: `"last"`
#'   (default — only on the final page) or `"every"` (every page).
#' @param page_label How the "Page X of Y" indicator is rendered. One of:
#'   `TRUE` (default style), `FALSE` (hide), `"x"` (just `1`, `2`, ...),
#'   `"x_of_y"` (default — `1 of 5`), or a function `function(page, total)`
#'   that returns a character string.
#' @param oversized_group_policy What to do when a single group has more rows
#'   than `rows`: `"overflow"` (default — emit on its own page, possibly
#'   taller than budget; `cli::cli_inform()` lists the offenders),
#'   `"warn"` (same plus `cli::cli_warn()`), `"error"` (abort).
#'
#' @return A `PaginateSpec` S7 object.
#'
#' @examples
#' # Default 30 rows per page
#' paginate_spec()
#'
#' # Smaller pages with strict orphan control
#' paginate_spec(rows = 20, orphan_min = 5)
#'
#' # No forced break per split_by subview, no group integrity
#' paginate_spec(break_on = "none", keep_groups = FALSE)
#'
#' @seealso [paginate_letter()], [paginate_a4()], [paginate_slide()],
#'   [paginate()] for the fluent modifier.
#' @export
paginate_spec <- function(rows = 30L,
                          break_on = c("split", "group", "none"),
                          keep_groups = TRUE,
                          orphan_min = 3L,
                          repeat_header = TRUE,
                          repeat_legend = TRUE,
                          repeat_title = TRUE,
                          footnotes_on = c("last", "every"),
                          page_label = "x_of_y",
                          oversized_group_policy = c("overflow", "warn", "error")) {
  break_on <- match.arg(break_on)
  footnotes_on <- match.arg(footnotes_on)
  oversized_group_policy <- match.arg(oversized_group_policy)

  checkmate::assert_count(rows, positive = TRUE)
  checkmate::assert_flag(keep_groups)
  checkmate::assert_count(orphan_min)
  checkmate::assert_flag(repeat_header)
  checkmate::assert_flag(repeat_legend)
  checkmate::assert_flag(repeat_title)

  if (orphan_min >= rows) {
    cli::cli_abort(
      "{.arg orphan_min} ({orphan_min}) must be less than {.arg rows} ({rows})."
    )
  }

  if (!is_valid_page_label(page_label)) {
    cli::cli_abort(c(
      "{.arg page_label} must be one of: {.code TRUE}, {.code FALSE}, {.val x}, {.val x_of_y}, or a function.",
      "i" = "Got {.cls {class(page_label)}}."
    ))
  }

  PaginateSpec(
    rows = as.integer(rows),
    break_on = break_on,
    keep_groups = keep_groups,
    orphan_min = as.integer(orphan_min),
    repeat_header = repeat_header,
    repeat_legend = repeat_legend,
    repeat_title = repeat_title,
    footnotes_on = footnotes_on,
    page_label = page_label,
    oversized_group_policy = oversized_group_policy
  )
}

# TRUE if `x` is one of the allowed page_label shapes.
#' @noRd
is_valid_page_label <- function(x) {
  if (isTRUE(x) || isFALSE(x)) return(TRUE)
  if (is.function(x)) return(TRUE)
  if (is.character(x) && length(x) == 1L && x %in% c("x", "x_of_y")) return(TRUE)
  FALSE
}

#' Page-size presets for [paginate_spec()]
#'
#' Convenience constructors that pick a sensible `rows` value for common page
#' formats. All other arguments are forwarded to [paginate_spec()].
#'
#' Row counts are tuned for a typical font size at the package's default
#' theme. Adjust `rows` directly if you have a denser or sparser layout.
#'
#' @param orient Page orientation: `"portrait"` (default) or `"landscape"`.
#'   `paginate_slide()` is always 16:9 landscape.
#' @param ... Forwarded to [paginate_spec()].
#'
#' @return A `PaginateSpec` S7 object.
#'
#' @examples
#' paginate_letter()
#' paginate_a4(orient = "landscape")
#' paginate_slide()
#'
#' @export
paginate_letter <- function(orient = c("portrait", "landscape"), ...) {
  orient <- match.arg(orient)
  rows <- if (orient == "portrait") 30L else 18L
  paginate_spec(rows = rows, ...)
}

#' @rdname paginate_letter
#' @export
paginate_a4 <- function(orient = c("portrait", "landscape"), ...) {
  orient <- match.arg(orient)
  rows <- if (orient == "portrait") 32L else 20L
  paginate_spec(rows = rows, ...)
}

#' @rdname paginate_letter
#' @export
paginate_slide <- function(...) {
  paginate_spec(rows = 16L, ...)
}

# Coerce shortcut forms (NULL / TRUE / FALSE / integer / PaginateSpec) into a
# canonical `PaginateSpec` (or NULL). Used at the `tabviz()` and `save_plot()`
# entry points so users can write `paginate = TRUE` or `paginate = 50` without
# touching the spec constructor.
#' @noRd
as_paginate_spec <- function(x, arg = "paginate") {
  if (is.null(x)) return(NULL)
  if (S7_inherits(x, PaginateSpec)) return(x)
  if (isTRUE(x)) return(paginate_spec())
  if (isFALSE(x)) return(NULL)
  if (is.numeric(x) && length(x) == 1L && !is.na(x) && x > 0) {
    return(paginate_spec(rows = as.integer(x)))
  }
  cli::cli_abort(c(
    "{.arg {arg}} must be {.code NULL}, {.code TRUE}, {.code FALSE}, a positive integer, or a {.cls PaginateSpec}.",
    "i" = "Use {.fn paginate_spec} or one of {.fn paginate_letter} / {.fn paginate_a4} / {.fn paginate_slide}."
  ))
}

# ----------------------------------------------------------------------------
# Breakpoint computation
# ----------------------------------------------------------------------------

# Compute page break indices for a WebSpec under a given paginate spec.
# Returns NULL when no pagination should occur; otherwise a list with
# 1-based inclusive `page_starts` and `page_ends` over rows of `spec@data`,
# plus `n_pages`.
#
# The algorithm walks contiguous group runs. Within the row-count budget:
#   - oversized single groups overflow onto their own page (one-shot)
#   - `keep_groups = TRUE` pushes a group to a fresh page rather than splitting
#   - rows beyond a group budget split naturally
#   - `orphan_min` pulls rows back from the prior page if the trailing page
#     would be too small
#
# This runs at serialize time and the result is stored on the wire so the
# Svelte viewer slices `displayRows` using the same breakpoints the PDF
# export will consume.
#' @noRd
compute_page_breaks <- function(spec, paginate = NULL) {
  if (is.null(paginate)) paginate <- spec@paginate
  if (is.null(paginate) || !S7_inherits(paginate, PaginateSpec)) return(NULL)

  n <- nrow(spec@data)
  if (n == 0L) return(list(page_starts = integer(0), page_ends = integer(0), n_pages = 0L))

  # Build per-row group ID vector matching the composite-key scheme used by
  # serialize_data() (so frontend/PDF page boundaries align with what the
  # widget actually renders for grouped data).
  group_ids <- if (!is.na(spec@group_col) && spec@group_col %in% names(spec@data)) {
    if (length(spec@group_cols) > 1L &&
        all(spec@group_cols %in% names(spec@data))) {
      parts <- vapply(spec@group_cols, function(col) {
        as.character(spec@data[[col]])
      }, character(n))
      if (is.matrix(parts)) {
        apply(parts, 1, paste, collapse = "__")
      } else {
        # Single row corner case
        paste(parts, collapse = "__")
      }
    } else {
      as.character(spec@data[[spec@group_col]])
    }
  } else {
    rep(NA_character_, n)
  }

  runs <- compute_group_runs(group_ids)

  rows_per_page <- paginate@rows
  keep_groups <- paginate@keep_groups
  orphan_min <- paginate@orphan_min

  page_starts <- integer(0)
  page_ends <- integer(0)
  oversized <- character(0)

  cur_start <- 1L
  cur_count <- 0L

  close_page <- function(end) {
    page_starts[length(page_starts) + 1L] <<- cur_start
    page_ends[length(page_ends) + 1L] <<- end
    cur_start <<- end + 1L
    cur_count <<- 0L
  }

  for (run in runs) {
    run_size <- run$end - run$start + 1L
    has_group <- !is.na(run$id)

    # Oversized group: emit on its own page (overflow). Without keep_groups,
    # we fall through to the normal walk so it splits across pages.
    if (keep_groups && has_group && run_size > rows_per_page) {
      oversized[length(oversized) + 1L] <- run$id
      if (cur_count > 0L) close_page(run$start - 1L)
      close_page(run$end)
      next
    }

    # Group integrity: if this group won't fit on the current page, push to
    # a fresh page first.
    if (keep_groups && has_group && cur_count > 0L &&
        cur_count + run_size > rows_per_page) {
      close_page(run$start - 1L)
    }

    # Walk through the run, splitting where pages fill.
    remaining_start <- run$start
    while (remaining_start <= run$end) {
      available <- rows_per_page - cur_count
      take <- min(run$end - remaining_start + 1L, available)
      cur_count <- cur_count + take
      end_idx <- remaining_start + take - 1L
      remaining_start <- end_idx + 1L
      if (remaining_start <= run$end) {
        # Run not exhausted -> page must be full -> close.
        close_page(end_idx)
      }
      # Else: run exhausted; next outer iteration will drive the close (or
      # the trailing close at end-of-data).
    }
  }

  # Close trailing partial page.
  if (cur_count > 0L) close_page(n)

  # Orphan control: pull rows from the prior page if the trailing page is
  # too thin. Only meaningful with >= 2 pages.
  if (orphan_min > 0L && length(page_ends) >= 2L) {
    last_idx <- length(page_ends)
    last_size <- page_ends[last_idx] - page_starts[last_idx] + 1L
    if (last_size < orphan_min) {
      shortfall <- orphan_min - last_size
      prior_size <- page_ends[last_idx - 1L] - page_starts[last_idx - 1L] + 1L
      if (prior_size > shortfall) {
        page_ends[last_idx - 1L] <- page_ends[last_idx - 1L] - shortfall
        page_starts[last_idx] <- page_ends[last_idx - 1L] + 1L
      }
    }
  }

  oversized <- unique(oversized)
  if (length(oversized) > 0L) {
    msg <- c(
      "i" = sprintf(
        "Group(s) larger than {.field rows} (= %d) will overflow their page: %s",
        rows_per_page,
        paste(oversized, collapse = ", ")
      )
    )
    policy <- paginate@oversized_group_policy
    if (policy == "warn") {
      cli::cli_warn(msg)
    } else if (policy == "error") {
      cli::cli_abort(msg)
    } else {
      cli::cli_inform(msg)
    }
  }

  list(
    page_starts = page_starts,
    page_ends = page_ends,
    n_pages = length(page_starts)
  )
}

# ----------------------------------------------------------------------------
# Per-page spec slicing & multi-page PDF render
# ----------------------------------------------------------------------------

# Return a clone of `spec` whose @data covers only rows page_start..page_end
# (1-based, inclusive). @paginate is cleared on the clone so the SVG/V8
# renderer treats the slice as a self-contained single-page spec. Group
# summaries whose group has no rows in the slice are dropped to avoid
# orphan summary rows on a page that doesn't show the group's data.
#' @noRd
slice_spec_for_page <- function(spec, page_start, page_end) {
  out <- spec
  data <- spec@data
  out@data <- data[seq.int(page_start, page_end), , drop = FALSE]
  out@paginate <- NULL

  # Filter group summaries to groups with data on this page.
  if (length(spec@summaries) > 0L && !is.na(spec@group_col)) {
    page_group_ids <- unique(as.character(out@data[[spec@group_col]]))
    out@summaries <- Filter(
      function(s) any(s@group_id %in% page_group_ids),
      spec@summaries
    )
  }

  out
}

# Render a paginated WebSpec to a multi-page PDF. Generates one SVG per
# logical page (via V8), converts each to a single-page PDF (via rsvg),
# then merges into `file` with qpdf::pdf_combine. Falls back to writing a
# numbered series (`file_p01.pdf`, ...) when qpdf is not installed so
# users on locked-down environments still get usable output.
#
# Reuses one V8 context across all pages — context creation is ~200 ms,
# so per-page reuse matters for >5-page documents.
#' @noRd
render_paginated_pdf <- function(spec, paginate, breaks, file,
                                 dim_plan = list(mode = "natural"),
                                 flex_cap = 2) {
  if (!requireNamespace("V8", quietly = TRUE)) {
    cli::cli_abort(c(
      "Package {.pkg V8} is required for {.fn save_plot}",
      "i" = "Install it with: {.code install.packages(\"V8\")}"
    ))
  }
  if (!requireNamespace("rsvg", quietly = TRUE)) {
    cli::cli_abort(c(
      "Package {.pkg rsvg} is required for PDF output",
      "i" = "Install it with: {.code install.packages(\"rsvg\")}"
    ))
  }
  has_qpdf <- requireNamespace("qpdf", quietly = TRUE)

  # Set up reusable V8 context.
  js_file <- system.file("js/svg-generator.js", package = "tabviz")
  if (js_file == "" || !file.exists(js_file)) {
    js_file <- file.path(system.file(package = "tabviz"),
                         "..", "..", "inst", "js", "svg-generator.js")
    if (!file.exists(js_file)) {
      cli::cli_abort(c(
        "SVG generator JavaScript file not found",
        "i" = "Run {.code npm run build} in the {.file srcjs} directory"
      ))
    }
  }
  ctx <- V8::v8()
  ctx$source(js_file)

  # Per-page aspect contract: Mode 1 emits at natural; Mode 2 post-processes
  # the SVG root; Mode 3 sends target dims to V8. For the deferred Mode-3
  # path (ratio-only or width+ratio etc.) we resolve target dims on the
  # first page using its natural dims and then reuse for the remaining
  # pages — page-to-page natural dims vary slightly but the user is
  # expressing a *target* aspect, not a per-page absolute, so reusing the
  # first page's resolution keeps pages visually consistent.
  options_list <- v8_options_for_mode(dim_plan, flex_cap)

  web_fonts <- tryCatch(spec@theme@web_fonts, error = function(e) list())

  # Output dir for the final file (or per-page numbered series).
  output_dir <- dirname(file)
  if (!dir.exists(output_dir) && output_dir != ".") {
    dir.create(output_dir, recursive = TRUE)
  }

  page_pdfs <- character(breaks$n_pages)
  tmp_root <- tempfile("tabviz_paginate_")
  dir.create(tmp_root)
  on.exit(unlink(tmp_root, recursive = TRUE), add = TRUE)

  for (i in seq_len(breaks$n_pages)) {
    page_spec <- slice_spec_for_page(spec, breaks$page_starts[i], breaks$page_ends[i])
    spec_json <- jsonlite::toJSON(
      serialize_spec(page_spec),
      auto_unbox = TRUE,
      null = "null",
      na = "null"
    )

    # Resolve deferred Mode-3 options on first page using its natural dims.
    if (isTRUE(options_list$.phase3_pending)) {
      natural_json <- ctx$call("computeNaturalDimensions", spec_json)
      natural <- jsonlite::fromJSON(natural_json)
      target <- resolve_target_dims_with_natural(
        list(width = options_list$width, height = options_list$height,
             ratio = options_list$ratio),
        natural
      )
      options_list <- list(
        targetWidth = target$width,
        targetHeight = target$height,
        flexCap = options_list$flexCap
      )
    }
    options_json <- jsonlite::toJSON(options_list, auto_unbox = TRUE)
    svg_string <- ctx$call("generateSVG", spec_json, V8::JS(options_json))

    # Mode 2: post-process the SVG root for display scaling per-page.
    if (identical(dim_plan$mode, "display_scaled")) {
      svg_string <- apply_display_scaling(svg_string, dim_plan)
    }

    if (length(web_fonts) > 0L) {
      svg_string <- tryCatch(
        embed_web_fonts(svg_string, web_fonts),
        error = function(e) {
          cli::cli_warn(c(
            "Could not embed web fonts on page {i}; SVG will use system fallback.",
            "i" = conditionMessage(e)
          ))
          svg_string
        }
      )
    }

    page_svg <- file.path(tmp_root, sprintf("page_%03d.svg", i))
    page_pdf <- file.path(tmp_root, sprintf("page_%03d.pdf", i))
    writeLines(svg_string, page_svg)
    rsvg::rsvg_pdf(page_svg, page_pdf)
    page_pdfs[i] <- page_pdf
  }

  if (has_qpdf) {
    qpdf::pdf_combine(page_pdfs, output = file)
    cli::cli_alert_success("Saved paginated plot to {.file {file}} ({breaks$n_pages} page{?s}).")
    return(file)
  }

  # qpdf missing: emit a numbered series alongside the requested file path.
  base <- tools::file_path_sans_ext(file)
  n_digits <- max(2L, nchar(as.character(breaks$n_pages)))
  out_paths <- vapply(
    seq_len(breaks$n_pages),
    function(i) sprintf("%s_p%0*d.pdf", base, n_digits, i),
    character(1)
  )
  for (i in seq_along(page_pdfs)) {
    file.copy(page_pdfs[i], out_paths[i], overwrite = TRUE)
  }
  cli::cli_warn(c(
    "Package {.pkg qpdf} is not installed; emitted {breaks$n_pages} numbered files instead of a single multi-page PDF.",
    "i" = "Install it with: {.code install.packages(\"qpdf\")}"
  ))
  out_paths
}

# Find contiguous runs of identical values in `x`. Returns a list of
# list(start, end, id) entries (1-based inclusive).
#' @noRd
compute_group_runs <- function(x) {
  n <- length(x)
  if (n == 0L) return(list())

  # rle() handles NA equality the way we want (NA == NA for run grouping):
  # use a sentinel to encode NAs distinctly from any real ID.
  sentinel <- "__tabviz_NA__"
  x_chr <- ifelse(is.na(x), sentinel, as.character(x))
  r <- rle(x_chr)
  ends <- cumsum(r$lengths)
  starts <- c(1L, utils::head(ends, -1L) + 1L)
  ids <- ifelse(r$values == sentinel, NA_character_, r$values)
  Map(function(s, e, id) list(start = as.integer(s), end = as.integer(e), id = id),
      starts, ends, ids)
}
