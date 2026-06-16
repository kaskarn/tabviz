# Roster sync — the R glyph registry (glyph_registry_names) and the TS
# GLYPH_REGISTRY (srcjs/src/lib/glyph-registry.ts) MUST list the same glyphs.
# CLAUDE.md + R/glyph-registry.R both claim "parity tests guard this", but the
# guard never existed — a one-sided glyph add/remove would ship silently
# (R3 review finding). Mirrors test-interaction-roster-sync.R / the theme
# roster-sync test. Source-parse (no V8 glyph accessor); skips when the srcjs
# tree isn't present (installed-only contexts).

test_that("R glyph_registry_names() matches TS GLYPH_REGISTRY keys", {
  ts_path <- testthat::test_path("..", "..", "srcjs", "src", "lib",
                                 "glyph-registry.ts")
  skip_if_not(file.exists(ts_path), "srcjs source tree not present")

  src_lines <- readLines(ts_path, warn = FALSE)
  start <- grep("export const GLYPH_REGISTRY", src_lines)
  expect_length(start, 1L)
  # First top-level `};` after the registry opener closes the object literal.
  end_candidates <- grep("^\\};", src_lines)
  end <- end_candidates[end_candidates > start][1]
  expect_true(!is.na(end))

  block <- src_lines[start:end]
  # Registry entries are 2-space-indented `key: {`; nested path/viewBox are deeper.
  key_lines <- grep("^  [A-Za-z_]+: \\{", block, value = TRUE)
  ts_glyphs <- sub("^  ([A-Za-z_]+):.*", "\\1", key_lines)

  expect_gt(length(ts_glyphs), 30L)
  expect_setequal(ts_glyphs, glyph_registry_names())
})
