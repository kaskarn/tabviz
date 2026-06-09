# tabviz_theme_css() — emits the resolved-theme `--tv-*` CSS custom property
# block via the V8-bundled `getThemeCSS()`.
#
# The R wrapper delegates to TS via V8 (see R/themes-api.R), so this file
# acts as a smoke + format regression test: that the bundle exposes the
# function, that every shipped preset round-trips through the bridge, and
# that the output retains its load-bearing tokens. If R later grows a
# parallel CSS-emit path, expand this into a byte-equality parity test.

THEMES <- c(  # the 9 committed identities (27→9 cull, 2026-06-09)
  "nejm", "ledger", "brutalist", "aurora", "terminal",
  "newsprint", "blueprint", "synthwave", "dwarven"
)

# A handful of `--tv-*` tokens the runtime always emits — sanity-checks the
# bundle is producing the full block, not a stub. Names migrated to v4
# manifest vocabulary after the Svelte/CSS sweep (Coh.70) collapsed the
# v3 aliases into their v4 manifest equivalents.
REQUIRED_TOKENS <- c(
  "--tv-surface-bg:", "--tv-text:", "--tv-accent:", "--tv-border:",
  "--tv-row-base-bg:", "--tv-header-bg:",
  "--tv-text-body-family:", "--tv-spacing-row-height:",
  "--tv-spacing-cell-padding-x:",
  "--tv-status-positive:", "--tv-status-negative:",
  "--tv-plot-axis-line:"
)

for (name in THEMES) {
  local({
    nm <- name
    test_that(sprintf("tabviz_theme_css(): %s preset round-trips through V8", nm), {
      theme <- do.call(paste0("web_theme_", nm), list())
      css <- tabviz_theme_css(theme)

      expect_type(css, "character")
      expect_length(css, 1)
      expect_gt(nchar(css), 200)

      missing_tokens <- REQUIRED_TOKENS[!vapply(
        REQUIRED_TOKENS,
        function(tok) grepl(tok, css, fixed = TRUE),
        logical(1)
      )]
      expect_true(
        length(missing_tokens) == 0,
        label = sprintf("Missing tokens in %s: %s",
                        nm, paste(missing_tokens, collapse = ", "))
      )
    })
  })
}

test_that("tabviz_theme_css(): accepts a WebSpec (extracts its theme)", {
  spec <- tabviz(
    data = data.frame(
      label = c("A", "B"),
      point = c(0.5, 0.7),
      lower = c(0.3, 0.5),
      upper = c(0.7, 0.9)
    ),
    theme = web_theme_nejm(),
    .spec_only = TRUE
  )
  expect_s7_class(spec, WebSpec)
  css <- tabviz_theme_css(spec)
  expect_type(css, "character")
  expect_match(css, "--tv-surface-bg:", fixed = TRUE)
})

test_that("tabviz_theme_css(): rejects non-theme, non-spec arguments", {
  expect_error(tabviz_theme_css(list(foo = 1)), class = "rlang_error")
  expect_error(tabviz_theme_css("not a theme"), class = "rlang_error")
  expect_error(tabviz_theme_css(NULL), class = "rlang_error")
})

test_that("tabviz_theme_css(): identical theme inputs produce identical output", {
  # The TS-side `buildThemeCSS` is cached by theme reference identity. Two
  # independent constructions of the same preset don't share identity but
  # MUST produce byte-identical output (deterministic emit).
  css1 <- tabviz_theme_css(web_theme_nejm())
  css2 <- tabviz_theme_css(web_theme_nejm())
  expect_identical(css1, css2)
})
