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
