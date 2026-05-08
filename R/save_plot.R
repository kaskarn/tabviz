# Static image export -- aspect-ratio-first dimension contract.
#
# `save_plot()` operates in one of three modes:
#
#   - **Mode 1 (Natural)**: no `width` / `height` / `ratio`. Render at the
#     spec's natural dimensions. Cheap; no relayout.
#   - **Mode 2 (Display-scaled)**: exactly one of `width` / `height`. Render
#     at natural, then stamp the requested dim on the SVG root and compute
#     the other from natural aspect (the SVG's `viewBox` keeps content
#     coordinates intact, so renderers display-scale uniformly). Pure SVG
#     scaling; no layout recompute.
#   - **Mode 3 (Aspect-changed)**: both `width` and `height`, or `ratio`,
#     trigger a layout recompute via the lever ladder. Flex-eligible
#     columns absorb width changes (capped via `flex`); row heights scale
#     for the height delta. Never SVG-stretched -- always recalculated.
#
# For paginated PDFs each page is a separate spec slice, so the aspect
# contract applies per-page.

#' Save a forest plot as a static image
#'
#' Exports a forest plot to SVG, PDF, or PNG. The output's *shape* is
#' derived from the spec's natural dimensions; `width`, `height`, and
#' `ratio` are display / aspect levers, not size forcers.
#'
#' # Sizing modes
#'
#' \describe{
#'   \item{**Natural**}{No `width` / `height` / `ratio`. Renders at the
#'     spec's natural dimensions (column widths plus theme chrome, row
#'     count times row height plus header/axis/footer chrome).}
#'   \item{**Display-scaled**}{Exactly one of `width` / `height`. Renders
#'     at natural; the SVG root is stamped with the requested dim while
#'     `viewBox` keeps content coordinates intact. The other dim is
#'     derived from natural aspect. PNG raster size honours `scale`.}
#'   \item{**Aspect-changed**}{Both `width` and `height`, or `ratio`,
#'     trigger a relayout: flex-eligible columns (those with
#'     `flex = TRUE`, the default for `viz_*` / forest columns) absorb
#'     width changes -- capped to `[1/flex, flex]` of natural -- and row
#'     heights scale to absorb the height delta. The output is rendered
#'     at the new layout, not SVG-stretched.}
#' }
#'
#' For SplitForest objects, dispatches to `save_split_table()` to export
#' all sub-plots to a directory. To save just one subview, pass `which`.
#'
#' @param x A WebSpec object, forest_plot() htmlwidget output, or SplitForest
#' @param file Output file path (or directory for SplitForest). Extension
#'   determines format: `.svg`, `.pdf`, or `.png`.
#' @param width Display width in pixels. `NULL` (default) preserves natural.
#'   With `height` or `ratio`, triggers relayout (Mode 3).
#' @param height Display height in pixels. `NULL` (default) preserves
#'   natural. With `width` or `ratio`, triggers relayout (Mode 3).
#' @param ratio Target aspect ratio (`width / height`). `NULL` (default)
#'   preserves natural. Mutually exclusive with passing both `width` and
#'   `height`. When set with one of `width` / `height`, the other is
#'   computed from the ratio. When set alone, target width = natural width
#'   and target height = natural width / ratio. Falls back to the spec's
#'   `target_aspect` (set via `set_aspect_ratio()`) if call-site `ratio`
#'   is `NULL`.
#' @param flex Flex-column cap for the lever-ladder. `TRUE` (default)
#'   uses cap = 2 (each flex column may grow / shrink within `[0.5x, 2x]`
#'   of natural). `FALSE` disables flex absorption -- every column is
#'   pinned at natural width regardless of its column-level `flex`. A
#'   numeric `N >= 1` sets a custom cap (`flex = 1.5` is conservative;
#'   `flex = Inf` removes the cap entirely).
#' @param scale Raster fidelity multiplier for PNG output (default 2 for
#'   retina). Ignored -- and warned about -- for vector outputs (SVG, PDF),
#'   which are resolution-independent.
#' @param which For SplitForest only. `NULL` (default) dumps every subview
#'   to the directory derived from `file`. A string picks one subview by
#'   key (e.g. `"Male__Young"`); an integer picks the i-th subview by the
#'   order specs were created. With `which` set, `file` is treated as a
#'   single-file path and its extension determines format.
#' @param paginate Pagination spec (see `paginate_spec()`). Multi-page PDFs
#'   only; warned-and-flattened for SVG / PNG.
#' @param ... Reserved for future use.
#'
#' @return Invisibly returns the file path
#'
#' @examples
#' \dontrun{
#' spec <- web_spec(
#'   data.frame(
#'     study = c("A", "B", "C"),
#'     hr = c(1.2, 0.8, 1.5),
#'     lower = c(0.9, 0.5, 1.1),
#'     upper = c(1.6, 1.2, 2.0)
#'   ),
#'   point = "hr", lower = "lower", upper = "upper", label = "study"
#' )
#'
#' save_plot(spec, "out.svg")                          # Natural
#' save_plot(spec, "out.svg", width = 1200)            # Display-scaled
#' save_plot(spec, "out.svg", ratio = 2)               # 2:1 wide
#' save_plot(spec, "out.svg", width = 1200, height = 600)  # explicit aspect
#' save_plot(spec, "out.svg", width = 1200, flex = FALSE)  # no flex absorption
#' save_plot(spec, "out.png", width = 1200, scale = 2)     # 2400 px PNG
#' }
#'
#' @export
save_plot <- function(x, file,
                      width = NULL, height = NULL, ratio = NULL,
                      anchor = NULL, auto_wrap = FALSE,
                      flex = TRUE, scale = 2,
                      which = NULL, paginate = NULL, ...) {
  if (missing(file) || is.null(file)) {
    cli_abort("{.arg file} is required")
  }

  # Dispatch to save_split_table() if x is a SplitForest
  if (S7_inherits(x, SplitForest)) {
    if (!is.null(which)) {
      keys <- names(x@specs)
      picked_key <- if (is.character(which)) {
        if (!which %in% keys) {
          cli_abort(c(
            "{.arg which} = {.val {which}} is not a subview key.",
            "i" = "Available keys: {.val {keys}}"
          ))
        }
        which
      } else if (is.numeric(which)) {
        idx <- as.integer(which)
        if (idx < 1L || idx > length(keys)) {
          cli_abort("{.arg which} = {idx} is out of range (1..{length(keys)}).")
        }
        keys[[idx]]
      } else {
        cli_abort("{.arg which} must be a string key or integer index.")
      }
      return(save_plot(x@specs[[picked_key]], file = file,
                       width = width, height = height, ratio = ratio,
                       anchor = anchor, auto_wrap = auto_wrap,
                       flex = flex, scale = scale,
                       paginate = paginate, ...))
    }

    ext <- tolower(tools::file_ext(file))
    if (ext %in% c("svg", "pdf", "png")) {
      path <- dirname(file)
      format <- ext
    } else {
      path <- file
      format <- "svg"
    }
    return(save_split_table(x, path = path, format = format,
                             width = width, height = height, ratio = ratio,
                             anchor = anchor,
                             flex = flex, scale = scale,
                             paginate = paginate, ...))
  }

  if (!requireNamespace("V8", quietly = TRUE)) {
    cli_abort(c(
      "Package {.pkg V8} is required for {.fn save_plot}",
      "i" = "Install it with: {.code install.packages(\"V8\")}"
    ))
  }

  spec <- extract_webspec(x)
  if (is.null(spec)) {
    cli_abort(c(
      "{.arg x} must be a WebSpec object or forest_plot() output",
      "i" = "Create a spec with {.fn web_spec} or plot with {.fn forest_plot}"
    ))
  }

  ext <- tolower(tools::file_ext(file))
  if (!ext %in% c("svg", "pdf", "png")) {
    cli_abort(c(
      "Unsupported file format: {.file .{ext}}",
      "i" = "Supported formats: .svg, .pdf, .png"
    ))
  }

  # `scale` is a raster-fidelity multiplier (PNG-only). PDF / SVG are
  # vector formats -- flag the misuse rather than silently dropping it.
  if (ext %in% c("svg", "pdf") && !missing(scale) && !identical(scale, 2)) {
    cli::cli_warn(c(
      "{.arg scale} is ignored for vector output ({.file .{ext}}).",
      "i" = "{.arg scale} only affects raster (PNG) fidelity.",
      "i" = "For higher-quality vector output, increase {.arg width} instead."
    ))
  }

  # Resolve flex cap (TRUE = 2, FALSE = 1, numeric = N).
  flex_cap <- resolve_flex_cap(flex)

  # Resolve aspect-ratio fallback: spec's `target_aspect` field acts as a
  # default when call-site `ratio` is NULL (set via `set_aspect_ratio()`).
  ratio_resolved <- resolve_target_aspect(ratio, spec)

  # Anchor precedence: explicit call-site arg > spec field > "width" default.
  anchor_resolved <- resolve_target_aspect_anchor(anchor, spec)

  checkmate::assert_flag(auto_wrap)

  # Mode + target dim resolution. Errors on over-spec.
  dim_plan <- resolve_dimension_plan(width, height, ratio_resolved,
                                     anchor_resolved)

  # Resolve paginate precedence: call-site arg overrides spec-level @paginate.
  paginate_resolved <- if (missing(paginate)) {
    spec@paginate
  } else {
    as_paginate_spec(paginate)
  }

  # Multi-page PDF: render one SVG per logical page, convert each to PDF,
  # and merge into a single .pdf with qpdf. Falls back to a numbered series
  # if qpdf is unavailable. Each page is a separate spec slice; the aspect
  # contract applies per-page.
  if (ext == "pdf" && !is.null(paginate_resolved)) {
    breaks <- compute_page_breaks(spec, paginate_resolved)
    if (!is.null(breaks) && breaks$n_pages > 1L) {
      return(invisible(render_paginated_pdf(
        spec = spec,
        paginate = paginate_resolved,
        breaks = breaks,
        file = file,
        dim_plan = dim_plan,
        flex_cap = flex_cap
      )))
    }
    spec@paginate <- NULL
  }

  if (ext %in% c("png", "svg") && !is.null(paginate_resolved)) {
    cli::cli_warn(c(
      "{.arg paginate} ignored: {.file .{ext}} is a single-image format.",
      "i" = "Saved the full table as one image. Use {.code paginate = NULL} to silence, or save to {.file .pdf} for paginated output."
    ))
    spec@paginate <- NULL
  }

  spec_json <- jsonlite::toJSON(
    serialize_spec(spec),
    auto_unbox = TRUE,
    null = "null",
    na = "null"
  )

  # Render. Mode 3 passes target dims to V8 for relayout; Modes 1 / 2 pass
  # nothing (V8 emits at natural).
  v8_options <- v8_options_for_mode(dim_plan, flex_cap)
  if (auto_wrap && dim_plan$mode == "aspect_changed") {
    v8_options$autoWrap <- TRUE
  }
  v8_result <- generate_svg_v8(spec_json, v8_options, return_metadata = TRUE)
  svg_string <- v8_result$svg
  # Phase 7D: surface auto-wrap bumps so authors can pin them next time.
  if (length(v8_result$auto_wrap_bumps) > 0L) {
    bump_lines <- vapply(v8_result$auto_wrap_bumps, function(b) {
      sprintf("%s -> wrap = %d", b$id, as.integer(b$wrap))
    }, character(1))
    cli::cli_inform(c(
      "i" = "Auto-wrap bumped {length(bump_lines)} column{?s}:",
      stats::setNames(bump_lines, rep("*", length(bump_lines)))
    ))
  }

  # Mode 2: post-process the SVG root so it display-scales to the
  # requested width or height. Content coordinates stay at natural via
  # the (untouched) viewBox.
  if (dim_plan$mode == "display_scaled") {
    svg_string <- apply_display_scaling(svg_string, dim_plan)
  }

  # Phase 7B: surface aspect targets that the lever ladder couldn't reach
  # (typically the legibility floor saturating, or flex-cap saturation
  # without anchor="auto" room to grow). One-shot warn per render; no-op
  # within tolerance.
  if (dim_plan$mode == "aspect_changed") {
    diagnose_achieved_aspect(svg_string, dim_plan, spec)
  }

  # Embed web fonts (Google Fonts URLs from theme@web_fonts) so the export
  # carries its own glyphs.
  web_fonts <- tryCatch(spec@theme@web_fonts, error = function(e) list())
  if (length(web_fonts) > 0L) {
    svg_string <- tryCatch(
      embed_web_fonts(svg_string, web_fonts),
      error = function(e) {
        cli::cli_warn(c(
          "Could not embed web fonts; SVG will use system fallback.",
          "i" = conditionMessage(e)
        ))
        svg_string
      }
    )
  }

  output_dir <- dirname(file)
  if (!dir.exists(output_dir) && output_dir != ".") {
    dir.create(output_dir, recursive = TRUE)
  }

  if (ext == "svg") {
    writeLines(svg_string, file)
  } else if (ext %in% c("pdf", "png")) {
    if (!requireNamespace("rsvg", quietly = TRUE)) {
      cli_abort(c(
        "Package {.pkg rsvg} is required for {.file .{ext}} output",
        "i" = "Install it with: {.code install.packages(\"rsvg\")}"
      ))
    }

    temp_svg <- tempfile(fileext = ".svg")
    on.exit(unlink(temp_svg), add = TRUE)
    writeLines(svg_string, temp_svg)

    if (ext == "pdf") {
      rsvg::rsvg_pdf(temp_svg, file)
    } else {
      # PNG: rsvg honours the SVG root's intrinsic width/height (which we
      # set in display_scaled mode) and aspect via viewBox. `scale`
      # multiplies the raster pixel count.
      svg_dims <- parse_svg_root_dims(svg_string)
      rsvg::rsvg_png(temp_svg, file, width = round(svg_dims$width * scale))
    }
  }

  cli::cli_alert_success("Saved plot to {.file {file}}")

  invisible(file)
}

# ---- Mode resolution helpers ------------------------------------------------

# `flex` arg semantics: TRUE -> 2 (default cap), FALSE -> 1 (no flex),
# numeric N >= 1 -> N. Values < 1 are user error (would invert the cap).
#' @noRd
resolve_flex_cap <- function(flex) {
  if (isTRUE(flex)) return(2)
  if (isFALSE(flex)) return(1)
  checkmate::assert_number(flex, lower = 1, finite = FALSE,
                           .var.name = "flex")
  flex
}

# Spec's @target_aspect is the fluent / interactive default; call-site
# `ratio` overrides. Returns NULL when neither is set.
#' @noRd
resolve_target_aspect <- function(ratio, spec) {
  if (!is.null(ratio)) {
    checkmate::assert_number(ratio, lower = 1e-3, finite = TRUE,
                             .var.name = "ratio")
    return(as.numeric(ratio))
  }
  spec_target <- tryCatch(spec@target_aspect, error = function(e) NA_real_)
  if (!is.na(spec_target) && is.numeric(spec_target) && spec_target > 0) {
    return(as.numeric(spec_target))
  }
  NULL
}

# Anchor for ratio-only target-dim resolution (Phase 7C). Precedence:
# call-site `anchor` > spec's `@target_aspect_anchor` > "width" default.
# `anchor = NULL` (default save_plot signature) defers to spec / default.
#' @noRd
resolve_target_aspect_anchor <- function(anchor, spec) {
  if (!is.null(anchor)) {
    return(match.arg(anchor, c("width", "height", "auto")))
  }
  spec_anchor <- tryCatch(spec@target_aspect_anchor, error = function(e) "width")
  if (is.character(spec_anchor) && length(spec_anchor) == 1L &&
      spec_anchor %in% c("width", "height", "auto")) {
    return(spec_anchor)
  }
  "width"
}

# Resolve mode + target dimensions from (width, height, ratio). Errors
# when over-specified. Target dims are computed lazily -- only Mode 3
# needs them, and only after natural dims are known. `anchor` is carried
# through to `resolve_target_dims_with_natural()` (only consulted when
# `ratio` is the sole trigger).
#' @noRd
resolve_dimension_plan <- function(width, height, ratio, anchor = "width") {
  has_w <- !is.null(width)
  has_h <- !is.null(height)
  has_r <- !is.null(ratio)

  if (has_w) checkmate::assert_number(width, lower = 1)
  if (has_h) checkmate::assert_number(height, lower = 1)

  if (has_w && has_h && has_r) {
    cli_abort(c(
      "Over-specified dimensions",
      "i" = "Cannot pass {.arg width}, {.arg height}, and {.arg ratio} together -- pick at most two.",
      "i" = "(`ratio` is `width / height`, so any two determine the third.)"
    ))
  }

  if (!has_w && !has_h && !has_r) {
    return(list(mode = "natural"))
  }

  # Mode 3: aspect-changed.
  if ((has_w && has_h) || has_r) {
    return(list(
      mode = "aspect_changed",
      width = width, height = height, ratio = ratio,
      anchor = anchor
    ))
  }

  # Mode 2: display-scaled (exactly one of width / height).
  list(
    mode = "display_scaled",
    width = width, height = height
  )
}

# ---- V8 options assembly ----------------------------------------------------

# Mode 1 / 2 send no width/height to V8 (renderer emits at natural).
# Mode 3 needs both target dims; if only one + ratio is set, we'll resolve
# the missing dim from natural aspect after the V8 natural-dims call.
#' @noRd
v8_options_for_mode <- function(dim_plan, flex_cap) {
  if (dim_plan$mode != "aspect_changed") {
    return(list())
  }

  # Defer target-dim resolution until natural dims are known.
  natural <- NULL  # populated below if needed

  has_w <- !is.null(dim_plan$width)
  has_h <- !is.null(dim_plan$height)
  has_r <- !is.null(dim_plan$ratio)

  if (has_w && has_h) {
    target_w <- dim_plan$width
    target_h <- dim_plan$height
  } else {
    # Need natural dims to resolve. Caller supplies the spec via dim_plan
    # in Phase 4.5+; for now, the V8 helper computes natural and we
    # resolve there. To keep this function pure and side-effect-free,
    # callers that need ratio-only / one-dim-plus-ratio should call
    # `resolve_target_dims_with_natural()` after natural is known.
    return(list(
      .phase3_pending = TRUE,
      width = dim_plan$width,
      height = dim_plan$height,
      ratio = dim_plan$ratio,
      anchor = dim_plan$anchor %||% "width",
      flexCap = flex_cap
    ))
  }

  list(
    targetWidth = target_w,
    targetHeight = target_h,
    flexCap = flex_cap
  )
}

# Given natural dims and a dim_plan with at least one of (width, height,
# ratio), compute (target_w, target_h). For Mode 3.
#' @noRd
resolve_target_dims_with_natural <- function(dim_plan, natural) {
  has_w <- !is.null(dim_plan$width)
  has_h <- !is.null(dim_plan$height)
  has_r <- !is.null(dim_plan$ratio)

  if (has_w && has_h) {
    return(list(width = dim_plan$width, height = dim_plan$height))
  }
  if (has_w && has_r) {
    return(list(width = dim_plan$width,
                height = dim_plan$width / dim_plan$ratio))
  }
  if (has_h && has_r) {
    return(list(width = dim_plan$height * dim_plan$ratio,
                height = dim_plan$height))
  }
  if (has_r) {
    # ratio alone: anchor decides which natural dim is preserved.
    anchor <- dim_plan$anchor %||% "width"
    if (anchor == "auto") {
      # Wider-than-natural ratio anchors height (output grows wider);
      # taller-than-natural anchors width (output grows taller). The
      # readability-first rule.
      anchor <- if (dim_plan$ratio >= natural$aspect) "height" else "width"
    }
    if (anchor == "height") {
      return(list(width = natural$height * dim_plan$ratio,
                  height = natural$height))
    }
    # anchor == "width" (default, v0.30 behaviour).
    return(list(width = natural$width,
                height = natural$width / dim_plan$ratio))
  }
  # Should not reach here -- Mode 3 requires at least one trigger.
  list(width = natural$width, height = natural$height)
}

# ---- SVG root dimension helpers (post-process for Mode 2) -------------------

# Parse the SVG root tag's width / height attributes. Renderer always
# emits both, so a missing match is treated as a renderer bug.
#' @noRd
parse_svg_root_dims <- function(svg_string) {
  root <- regmatches(svg_string, regexpr("<svg[^>]*>", svg_string))
  if (length(root) == 0L) {
    cli::cli_abort("Could not locate <svg> root in renderer output.")
  }
  w <- regmatches(root, regexpr('width="[0-9.]+"', root))
  h <- regmatches(root, regexpr('height="[0-9.]+"', root))
  if (length(w) == 0L || length(h) == 0L) {
    cli::cli_abort("SVG root is missing width / height attributes.")
  }
  width <- as.numeric(sub('width="([0-9.]+)"', "\\1", w))
  height <- as.numeric(sub('height="([0-9.]+)"', "\\1", h))
  list(width = width, height = height, aspect = width / height)
}

# Replace the SVG root's width / height attributes (preserving the rest
# of the tag, including the viewBox so coordinates stay at natural).
#' @noRd
set_svg_root_dims <- function(svg_string, width, height) {
  # The renderer emits the root as a multi-line tag; the regex matches
  # the whole tag and we surgically replace just the width/height attrs.
  root_match <- regexpr("<svg[^>]*>", svg_string)
  if (root_match[1] < 1L) {
    cli::cli_abort("Could not locate <svg> root in renderer output.")
  }
  root <- regmatches(svg_string, root_match)
  new_root <- root
  new_root <- sub('width="[0-9.]+"',
                  sprintf('width="%g"', width), new_root)
  new_root <- sub('height="[0-9.]+"',
                  sprintf('height="%g"', height), new_root)
  regmatches(svg_string, root_match) <- new_root
  svg_string
}

# Phase 7B: emit a one-shot warning when the achieved aspect deviates
# from target by more than `ASPECT_TOLERANCE`. Computes target dims from
# the dim_plan + spec's natural dimensions (so call-site knows what was
# asked) and compares to the rendered SVG's actual root width/height.
#
# Common saturation cases:
#   - Wide ratio with anchor="width" hitting the rowHeight floor.
#   - Tall ratio under-delivered chrome scale (font-derived chrome
#     doesn't scale; addressed by anchor="auto" + Phase 7D auto-wrap).
#   - Mode-3 width+height where neither the flex cap nor the floor
#     allow the layout to reach both target dims simultaneously.
#
# Suggests the appropriate remedy in the warning body based on the
# observed direction of the miss.
#' @noRd
ASPECT_TOLERANCE <- 0.05  # 5 % relative aspect mismatch
#' @noRd
diagnose_achieved_aspect <- function(svg_string, dim_plan, spec) {
  achieved <- tryCatch(parse_svg_root_dims(svg_string),
                       error = function(e) NULL)
  if (is.null(achieved)) return(invisible(NULL))

  natural <- tabviz_natural_dimensions(spec)
  target <- resolve_target_dims_with_natural(dim_plan, natural)
  target_aspect <- target$width / target$height

  rel_err <- abs(achieved$aspect - target_aspect) / target_aspect
  if (!is.finite(rel_err) || rel_err <= ASPECT_TOLERANCE) {
    return(invisible(NULL))
  }

  # Emit a single cli_warn. The "How to apply:" hints are direction-aware.
  hint_lines <- character()
  if (achieved$aspect < target_aspect) {
    # Achieved is taller than target = layout couldn't shrink height
    # enough OR couldn't grow width enough.
    if (!is.null(dim_plan$ratio) && (dim_plan$anchor %||% "width") != "auto") {
      hint_lines <- c(hint_lines,
        "i" = "Try {.code anchor = \"auto\"} to grow width instead of shrinking row height.")
    } else {
      hint_lines <- c(hint_lines,
        "i" = "Row-height legibility floor saturated. Reduce row count, increase {.arg height}, or relax {.arg flex}.")
    }
  } else {
    # Achieved is wider than target = layout couldn't grow width enough
    # or shrink height enough (rarer: usually means flex cap clamped a
    # non-flex column too aggressively).
    hint_lines <- c(hint_lines,
      "i" = "Try a wider {.arg flex} cap (default 2) or pin a non-flex column's {.code width} explicitly.")
  }

  cli::cli_warn(c(
    "Aspect target not fully reached.",
    "i" = sprintf("Asked %.3f:1; rendered %.0f x %.0f (achieved %.3f:1).",
                  target_aspect, achieved$width, achieved$height,
                  achieved$aspect),
    hint_lines
  ))
  invisible(NULL)
}

# Mode 2: post-process the rendered (natural) SVG so its root width /
# height match the requested dim while preserving viewBox.
#' @noRd
apply_display_scaling <- function(svg_string, dim_plan) {
  natural <- parse_svg_root_dims(svg_string)
  if (!is.null(dim_plan$width)) {
    new_w <- as.numeric(dim_plan$width)
    new_h <- new_w / natural$aspect
  } else {
    new_h <- as.numeric(dim_plan$height)
    new_w <- new_h * natural$aspect
  }
  set_svg_root_dims(svg_string, new_w, new_h)
}

# ---- V8 invocation ----------------------------------------------------------

#' Generate SVG using V8 JavaScript engine
#'
#' @param spec_json JSON string of WebSpec
#' @param options List of export options (width, height, targetWidth, etc.)
#' @param return_metadata If TRUE, return a list with `svg` plus the
#'   side-channel metadata stashed by the renderer (e.g. Phase 7D's
#'   `lastAutoWrapResult`). Default FALSE preserves the legacy
#'   string-return interface.
#' @return SVG string, or a list when `return_metadata = TRUE`.
#' @noRd
generate_svg_v8 <- function(spec_json, options = list(),
                            return_metadata = FALSE) {
  js_file <- system.file("js/svg-generator.js", package = "tabviz")

  if (js_file == "" || !file.exists(js_file)) {
    js_file <- file.path(
      system.file(package = "tabviz"),
      "..", "..", "inst", "js", "svg-generator.js"
    )
    if (!file.exists(js_file)) {
      cli_abort(c(
        "SVG generator JavaScript file not found",
        "i" = "Run {.code npm run build} in the {.file srcjs} directory"
      ))
    }
  }

  # Phase 3 deferred path: caller passed a `.phase3_pending` placeholder
  # because target dims couldn't be resolved without natural. Resolve now
  # by calling the natural-dims V8 entry first, then re-issuing options.
  if (isTRUE(options$.phase3_pending)) {
    ctx <- V8::v8()
    ctx$source(js_file)
    natural_json <- ctx$call("computeNaturalDimensions", spec_json)
    natural <- jsonlite::fromJSON(natural_json)
    target <- resolve_target_dims_with_natural(
      list(width = options$width, height = options$height,
           ratio = options$ratio, anchor = options$anchor),
      natural
    )
    options_json <- jsonlite::toJSON(
      list(targetWidth = target$width,
           targetHeight = target$height,
           flexCap = options$flexCap,
           autoWrap = isTRUE(options$autoWrap)),
      auto_unbox = TRUE
    )
    svg <- ctx$call("generateSVG", spec_json, V8::JS(options_json))
    if (return_metadata) {
      return(list(svg = svg, auto_wrap_bumps = read_auto_wrap_bumps(ctx)))
    }
    return(svg)
  }

  ctx <- V8::v8()
  ctx$source(js_file)
  options_json <- jsonlite::toJSON(options, auto_unbox = TRUE)
  svg <- ctx$call("generateSVG", spec_json, V8::JS(options_json))
  if (return_metadata) {
    return(list(svg = svg, auto_wrap_bumps = read_auto_wrap_bumps(ctx)))
  }
  svg
}

# Read Phase 7D's `lastAutoWrapResult` global from a V8 context. Returns
# an empty list when the renderer didn't run an auto-wrap loop (or the
# global is missing). Result shape: list(list(id=..., wrap=...), ...).
#' @noRd
read_auto_wrap_bumps <- function(ctx) {
  raw <- tryCatch(ctx$get("lastAutoWrapResult"), error = function(e) NULL)
  if (is.null(raw)) return(list())
  # V8's `get` returns a data.frame or list-of-lists depending on shape.
  # Normalize to list(list(id=..., wrap=...)) for consistent handling.
  if (is.data.frame(raw) && nrow(raw) > 0L) {
    return(lapply(seq_len(nrow(raw)), function(i) {
      list(id = as.character(raw$id[i]), wrap = as.integer(raw$wrap[i]))
    }))
  }
  if (is.list(raw) && length(raw) > 0L && !is.null(raw[[1]]$id)) {
    return(lapply(raw, function(b) {
      list(id = as.character(b$id), wrap = as.integer(b$wrap))
    }))
  }
  list()
}

#' Extract WebSpec from various input types
#'
#' @param x Input object (WebSpec, htmlwidget, or list)
#' @return WebSpec object or NULL
#' @noRd
extract_webspec <- function(x) {
  if (S7_inherits(x, WebSpec)) {
    return(x)
  }

  if (inherits(x, "htmlwidget")) {
    spec <- attr(x, "webspec")
    if (!is.null(spec) && S7_inherits(spec, WebSpec)) {
      return(spec)
    }
    if (!is.null(x$x)) {
      cli_warn(c(
        "Cannot extract WebSpec from htmlwidget",
        "i" = "Pass the WebSpec object directly to {.fn save_plot}"
      ))
    }
    return(NULL)
  }

  NULL
}

# ============================================================================
# SplitForest export
# ============================================================================

#' Save a split forest plot collection to a directory
#'
#' Exports all plots in a SplitForest to a directory structure that mirrors
#' the split hierarchy. Each sub-plot is saved as a separate file. Each
#' subview's aspect contract is independent -- `width` / `height` / `ratio`
#' / `flex` apply per-subview.
#'
#' @param x A SplitForest object or forest_plot() output with split_by
#' @param path Output directory path. Created if it doesn't exist.
#' @param format Output format: "svg" (default), "pdf", or "png"
#' @param width,height,ratio,flex,scale See `save_plot()`.
#' @param paginate See `save_plot()`. Per-subview pagination on PDF.
#' @param ... Reserved for future use.
#'
#' @return Invisibly returns a character vector of exported file paths
#'
#' @examples
#' \dontrun{
#' split_result <- data |>
#'   tabviz(label = "study", columns = list(
#'     viz_forest(point = "or", lower = "lower", upper = "upper")
#'   )) |>
#'   split_table(by = c("sex", "age_group"))
#'
#' save_split_table(split_result, "output/plots")
#' }
#'
#' @export
save_split_table <- function(x, path, format = c("svg", "pdf", "png"),
                              width = NULL, height = NULL, ratio = NULL,
                              anchor = NULL,
                              flex = TRUE, scale = 2,
                              paginate = NULL, ...) {
  format <- match.arg(format)

  split_table <- extract_splitforest(x)
  if (is.null(split_table)) {
    cli_abort(c(
      "{.arg x} must be a SplitForest object or forest_plot() output with split_by",
      "i" = "Create with {.fn split_table} or use {.code split_by} in {.fn forest_plot}"
    ))
  }

  if (!dir.exists(path)) {
    dir.create(path, recursive = TRUE)
  }

  exported_files <- character()
  seen_paths <- character()
  collisions <- character()

  for (key in names(split_table@specs)) {
    spec <- split_table@specs[[key]]

    parts <- strsplit(key, "__", fixed = TRUE)[[1]]
    safe_parts <- vapply(parts, sanitize_filename, character(1))

    if (length(safe_parts) > 1) {
      subdir <- file.path(path, paste(safe_parts[-length(safe_parts)],
                                       collapse = .Platform$file.sep))
      if (!dir.exists(subdir)) {
        dir.create(subdir, recursive = TRUE)
      }
      filename <- paste0(paste(safe_parts, collapse = "_"), ".", format)
      file_path <- file.path(subdir, filename)
    } else {
      filename <- paste0(safe_parts, ".", format)
      file_path <- file.path(path, filename)
    }

    if (file_path %in% seen_paths) {
      hash <- substr(rlang::hash(key), 1, 6)
      collisions <- c(collisions, key)
      file_path <- sub(paste0("\\.", format, "$"),
                       paste0("_", hash, ".", format), file_path)
    }
    seen_paths <- c(seen_paths, file_path)

    save_plot(spec, file_path,
              width = width, height = height, ratio = ratio,
              anchor = anchor,
              flex = flex, scale = scale,
              paginate = paginate)
    exported_files <- c(exported_files, file_path)
  }

  if (length(collisions) > 0) {
    cli::cli_warn(c(
      "Filename collisions resolved with short hash suffixes",
      "i" = "Affected key{?s}: {.val {collisions}}",
      "i" = "Rename split values to avoid characters that sanitize identically (e.g. {.val /} and {.val -} both become {.val -})."
    ))
  }

  cli::cli_alert_success("Exported {length(exported_files)} plot{?s} to {.path {path}}")

  invisible(exported_files)
}

#' Extract SplitForest from various input types
#'
#' @param x Input object (SplitForest or htmlwidget)
#' @return SplitForest object or NULL
#' @noRd
extract_splitforest <- function(x) {
  if (S7_inherits(x, SplitForest)) {
    return(x)
  }

  if (inherits(x, "htmlwidget")) {
    sf <- attr(x, "splitforest")
    if (!is.null(sf) && S7_inherits(sf, SplitForest)) {
      return(sf)
    }
    return(NULL)
  }

  NULL
}

#' Sanitize a string for use as a filename
#' @noRd
sanitize_filename <- function(x) {
  x <- gsub("[/\\\\*?\"<>|]", "-", x)
  x <- gsub(":", " -", x)
  x <- gsub("[\r\n\t]", " ", x)
  x <- gsub("-+", "-", x)
  x <- gsub(" +", " ", x)
  x <- gsub("^[- ]+|[- ]+$", "", x)

  if (nchar(x) == 0) {
    x <- "unnamed"
  }
  x
}
