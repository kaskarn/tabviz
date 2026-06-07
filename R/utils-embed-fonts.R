# Embed web fonts into an SVG export.
#
# V8 has no DOM and no network, so the SVG generator emits font-family by
# name only — when the file is rendered by rsvg (for PNG/PDF) or imported
# into PowerPoint, fontconfig falls back to system-ui because Google Fonts
# aren't installed locally. This helper closes the gap on the R side: it
# fetches each declared web_font, base64-encodes the woff2 binaries, and
# splices `@font-face` rules into the SVG's <style> block so the export
# carries its own glyphs.
#
# Failure modes degrade gracefully: any error returns the SVG unchanged,
# matching today's "system fallback" behavior.

# Session-local cache so repeated save_plot() calls in one R session don't
# re-fetch the same Google Fonts CSS / binaries.
.font_embed_cache <- new.env(parent = emptyenv())

# Desktop user-agent. Without this, Google Fonts returns truetype URLs in
# the CSS instead of the smaller woff2 we want for embedding.
.font_embed_ua <- paste0(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) ",
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
)

#' Embed web fonts into an SVG string
#'
#' @param svg Character scalar — the SVG document.
#' @param web_fonts List of `list(family = ..., url = ...)` entries from
#'   `WebTheme@web_fonts`.
#' @return The SVG string with `@font-face` rules spliced into its `<style>`
#'   block. On any failure, returns `svg` unchanged.
#' @noRd
embed_web_fonts <- function(svg, web_fonts) {
  if (!is.character(svg) || length(svg) == 0L || !nzchar(svg)) return(svg)
  if (length(web_fonts) == 0L) return(svg)
  if (!requireNamespace("curl", quietly = TRUE)) return(svg)

  rules <- character(0)
  for (wf in web_fonts) {
    family <- wf[["family"]]
    url <- wf[["url"]]
    if (!is.character(family) || !nzchar(family)) next
    if (!is.character(url) || !nzchar(url)) next
    block <- tryCatch(
      build_font_face_block(family, url),
      error = function(e) {
        cli::cli_warn(c(
          "Could not embed web font {.val {family}}; SVG will use system fallback.",
          "i" = conditionMessage(e)
        ))
        ""
      }
    )
    if (nzchar(block)) rules <- c(rules, block)
  }
  if (length(rules) == 0L) return(svg)

  splice_font_face_into_svg(svg, paste(rules, collapse = "\n"))
}

# Resolve one (family, css_url) into a string of `@font-face { ... }` blocks.
# Caches the resulting string by `css_url`.
build_font_face_block <- function(family, css_url) {
  if (exists(css_url, envir = .font_embed_cache, inherits = FALSE)) {
    return(get(css_url, envir = .font_embed_cache))
  }

  css_text <- fetch_text(css_url)
  faces <- parse_google_font_css(css_text)
  if (length(faces) == 0L) {
    return("")
  }

  out <- character(length(faces))
  for (i in seq_along(faces)) {
    face <- faces[[i]]
    woff_url <- face$src
    if (!is.character(woff_url) || !nzchar(woff_url)) next
    woff_b64 <- fetch_woff2_base64(woff_url)
    fam_attr <- face$family
    if (is.null(fam_attr) || !nzchar(fam_attr)) fam_attr <- family
    out[i] <- sprintf(
      '@font-face { font-family: "%s"; font-style: %s; font-weight: %s;%s src: url(data:font/woff2;base64,%s) format("woff2"); }',
      gsub('"', "", fam_attr),
      face$style %||% "normal",
      face$weight %||% "400",
      if (!is.null(face$unicode_range) && nzchar(face$unicode_range)) {
        sprintf(" unicode-range: %s;", face$unicode_range)
      } else {
        ""
      },
      woff_b64
    )
  }
  out <- out[nzchar(out)]
  rules <- paste(out, collapse = "\n")
  assign(css_url, rules, envir = .font_embed_cache)
  rules
}

# Parse the Google Fonts CSS payload into one record per @font-face block.
parse_google_font_css <- function(css) {
  if (!is.character(css) || length(css) == 0L || !nzchar(css)) return(list())
  blocks <- regmatches(css, gregexpr("@font-face\\s*\\{[^}]*\\}", css, perl = TRUE))[[1]]
  if (length(blocks) == 0L) return(list())
  lapply(blocks, function(b) {
    list(
      family = extract_css_field(b, "font-family"),
      style = extract_css_field(b, "font-style"),
      weight = extract_css_field(b, "font-weight"),
      unicode_range = extract_css_field(b, "unicode-range"),
      src = extract_woff2_url(b)
    )
  })
}

extract_css_field <- function(block, name) {
  pattern <- sprintf("%s\\s*:\\s*([^;]+);", name)
  m <- regmatches(block, regexec(pattern, block))[[1]]
  if (length(m) < 2L) return(NULL)
  val <- trimws(m[2])
  # strip surrounding quotes from font-family if present
  gsub("^['\"]|['\"]$", "", val)
}

extract_woff2_url <- function(block) {
  m <- regmatches(block, regexec("url\\(([^)]+)\\)\\s*format\\(['\"]?woff2['\"]?\\)", block))[[1]]
  if (length(m) < 2L) return(NULL)
  trimws(gsub("^['\"]|['\"]$", "", m[2]))
}

fetch_text <- function(url) {
  h <- curl::new_handle(useragent = .font_embed_ua)
  resp <- curl::curl_fetch_memory(url, handle = h)
  if (resp$status_code >= 400L) {
    stop(sprintf("HTTP %d fetching %s", resp$status_code, url))
  }
  rawToChar(resp$content)
}

fetch_woff2_base64 <- function(url) {
  cache_key <- paste0("__woff2:", url)
  if (exists(cache_key, envir = .font_embed_cache, inherits = FALSE)) {
    return(get(cache_key, envir = .font_embed_cache))
  }
  h <- curl::new_handle(useragent = .font_embed_ua)
  resp <- curl::curl_fetch_memory(url, handle = h)
  if (resp$status_code >= 400L) {
    stop(sprintf("HTTP %d fetching %s", resp$status_code, url))
  }
  b64 <- jsonlite::base64_enc(resp$content)
  # base64_enc returns a single string; ensure no embedded newlines that
  # would break the data: URL.
  b64 <- gsub("[\r\n\\s]", "", b64)
  assign(cache_key, b64, envir = .font_embed_cache)
  b64
}

# Inject @font-face rules into the SVG's first <style> element. If no
# <style> exists, insert one right after the opening <svg ...> tag.
splice_font_face_into_svg <- function(svg, font_face_rules) {
  end_tag <- regexpr("</style>", svg, fixed = TRUE)
  if (end_tag > 0L) {
    before <- substr(svg, 1L, end_tag - 1L)
    after <- substr(svg, end_tag, nchar(svg))
    return(paste0(before, "\n", font_face_rules, "\n", after))
  }
  open_match <- regexpr("<svg\\b[^>]*>", svg, perl = TRUE)
  if (open_match > 0L) {
    end_pos <- open_match + attr(open_match, "match.length") - 1L
    before <- substr(svg, 1L, end_pos)
    after <- substr(svg, end_pos + 1L, nchar(svg))
    return(paste0(before, "\n<style>\n", font_face_rules, "\n</style>", after))
  }
  svg
}

`%||%` <- function(a, b) if (is.null(a) || (is.character(a) && !nzchar(a))) b else a

# ── rsvg-side font registration (Phase 0, spec-first plan) ──────────────────
#
# The base64 @font-face splice above only helps an SVG opened in a BROWSER.
# librsvg (the PDF/PNG path) ignores data-URL fonts and resolves families
# through fontconfig — so journal presets silently exported in their
# fallback faces (verified: NEJM's PDF embedded Georgia, not Lora — the
# R3 publication review's headline bug). This half closes the gap for the
# static path: fetch the TTF variants (Google Fonts serves truetype URLs
# when no browser user-agent is sent), drop them in a session font dir,
# and point fontconfig at it via a generated fonts.conf that INCLUDES the
# system config. PANGOCAIRO_BACKEND=fontconfig is required on macOS where
# pango otherwise uses CoreText and never consults fontconfig.
#
# The env vars are set for the remainder of the session (not restored):
# librsvg initializes fontconfig once per process, so flapping the config
# between calls would be order-dependent. Graceful degradation throughout —
# any failure warns once and proceeds with today's fallback behavior.

.rsvg_font_state <- new.env(parent = emptyenv())

#' Register a theme's web fonts with fontconfig for rsvg rendering
#'
#' FIRST-INIT CONSTRAINT: fontconfig reads `FONTCONFIG_FILE` exactly once,
#' at pango's first initialization in the process. Registration therefore
#' only takes effect if it happens BEFORE the session's first rsvg render.
#' If some earlier rsvg call already initialized fontconfig (e.g. a PNG
#' export of a non-web-font theme), the env-var swap below is silently
#' ignored and the PDF embeds the platform fallback face. Tests of this
#' mechanism must run in a fresh process (see test-embed-fonts.R); a
#' robust any-time registration would need fontconfig's app-font API,
#' which librsvg does not expose.
#'
#' @param web_fonts List of `list(family = ..., url = ...)` entries.
#' @return Invisibly, TRUE if registration is active, FALSE otherwise.
#' @noRd
register_web_fonts_for_rsvg <- function(web_fonts) {
  if (length(web_fonts) == 0L) return(invisible(FALSE))
  if (!requireNamespace("curl", quietly = TRUE)) return(invisible(FALSE))

  ok <- tryCatch({
    font_dir <- .rsvg_font_dir()
    fetched_any <- FALSE
    for (wf in web_fonts) {
      family <- wf[["family"]]
      url <- wf[["url"]]
      if (!is.character(family) || !nzchar(family)) next
      if (!is.character(url) || !nzchar(url)) next
      fetched_any <- .fetch_ttf_variants(family, url, font_dir) || fetched_any
    }
    if (fetched_any || length(list.files(font_dir, pattern = "[.]ttf$")) > 0L) {
      .activate_rsvg_fontconfig(font_dir)
      TRUE
    } else {
      FALSE
    }
  }, error = function(e) {
    if (!isTRUE(.rsvg_font_state$warned)) {
      .rsvg_font_state$warned <- TRUE
      cli::cli_warn(c(
        "Could not register web fonts for PDF/PNG rendering; output will use system fallback faces.",
        "i" = conditionMessage(e)
      ))
    }
    FALSE
  })
  invisible(ok)
}

.rsvg_font_dir <- function() {
  dir <- .rsvg_font_state$dir
  if (is.null(dir)) {
    dir <- file.path(tempdir(), "tabviz-fonts")
    dir.create(dir, showWarnings = FALSE, recursive = TRUE)
    .rsvg_font_state$dir <- dir
  }
  dir
}

# Fetch every TTF variant a Google Fonts CSS2 URL declares. Sending NO
# user agent makes the API return truetype URLs (the same trick the woff2
# fetcher uses in reverse). Cached per css url per session.
.fetch_ttf_variants <- function(family, css_url, font_dir) {
  key <- paste0("ttf::", css_url)
  if (isTRUE(.rsvg_font_state[[key]])) return(TRUE)
  h <- curl::new_handle(useragent = "")
  css <- rawToChar(curl::curl_fetch_memory(css_url, handle = h)$content)
  urls <- unique(regmatches(css, gregexpr("https://[^)]+[.]ttf", css))[[1]])
  if (length(urls) == 0L) return(FALSE)
  slug <- gsub("[^A-Za-z0-9]", "_", family)
  for (i in seq_along(urls)) {
    dest <- file.path(font_dir, sprintf("%s_%02d.ttf", slug, i))
    if (!file.exists(dest)) curl::curl_download(urls[[i]], dest, quiet = TRUE)
  }
  .rsvg_font_state[[key]] <- TRUE
  TRUE
}

# Generate the session fonts.conf (system include + our dir + cache dir)
# and point fontconfig + pango at it. Idempotent.
.activate_rsvg_fontconfig <- function(font_dir) {
  if (isTRUE(.rsvg_font_state$active)) return(invisible(TRUE))
  sysconf <- c(
    Sys.getenv("TABVIZ_SYSTEM_FONTCONFIG", ""),
    "/opt/homebrew/etc/fonts/fonts.conf",
    "/usr/local/etc/fonts/fonts.conf",
    "/etc/fonts/fonts.conf"
  )
  sysconf <- sysconf[nzchar(sysconf) & file.exists(sysconf)]
  include <- if (length(sysconf) > 0L) {
    sprintf('<include ignore_missing="yes">%s</include>', sysconf[[1]])
  } else {
    ""
  }
  cache_dir <- file.path(tempdir(), "tabviz-fc-cache")
  dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)
  conf <- file.path(tempdir(), "tabviz-fonts.conf")
  writeLines(sprintf(
    '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>%s<dir>%s</dir><cachedir>%s</cachedir></fontconfig>',
    include, font_dir, cache_dir
  ), conf)
  Sys.setenv(FONTCONFIG_FILE = conf, PANGOCAIRO_BACKEND = "fontconfig")
  .rsvg_font_state$active <- TRUE
  invisible(TRUE)
}
