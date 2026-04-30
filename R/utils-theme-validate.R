# Construction-time theme validation.
#
# Runs at the end of resolve_theme() — after every Tier 2 / Tier 3 leaf is
# populated — and verifies the contrast invariants required for legibility
# of bold-band header rows, accent semantic fills, etc. Failures abort with
# cli::cli_abort and a structured message naming the broken invariant +
# the path the override touched.
#
# This is a defensive check against malformed user overrides
# (set_theme_field, hand-constructed WebTheme()), not a typing system —
# the resolver's defaults always satisfy the invariants. Validation runs
# at construction so users see the error at the source of the bad
# override, not later during render where the cause is opaque.
#
# Per the cascade manifesto (see vignettes/theming.Rmd): contrast
# invariants protect the contract that every theme — preset or hand-rolled
# — meets a basic legibility floor. Skipping validation is not supported.

# Contrast threshold for chrome bold-band text (header.bold,
# column_group.bold). Header text is bold (weight=600) and lives in chrome
# bands rather than dense reading flow, so WCAG AA Large (3.0) is the
# applicable bar — strict enough to catch obviously-broken themes
# (#5C85C8 + #CDD6F4 = 2.57 from a too-light auto-derived primary_deep)
# while accepting deliberate editorial palettes where warm-on-warm
# treatments sit above 3.0 but below the body-text 4.5.
#
# Body text (cell text on surface.base) gets the stricter 4.5 bar, which
# is the WCAG AA Normal threshold appropriate for dense reading flow.
WCAG_AA_LARGE  <- 3.0
WCAG_AA_NORMAL <- 4.5

# Single contrast invariant. `name` is what the validator reports if it
# fails; `fg`/`bg` are hex strings; `min_ratio` is the per-invariant
# threshold (chrome bands use the laxer Large bar; body text uses the
# stricter Normal bar); `path` lists the cascade leaves the user could
# override to fix the violation.
make_invariant <- function(name, fg, bg, path, min_ratio) {
  list(name = name, fg = fg, bg = bg, path = path, min_ratio = min_ratio)
}

# Validate every contrast invariant on a resolved theme. Returns NULL on
# success; aborts with a structured cli message on failure.
validate_resolved_theme <- function(theme) {
  invariants <- list(
    make_invariant(
      "header bold band: header.bold.fg must read on header.bold.bg",
      fg = theme@header@bold@fg,
      bg = theme@header@bold@bg,
      path = c("header.bold.fg", "header.bold.bg",
               "content.inverse", "inputs$primary_deep"),
      min_ratio = WCAG_AA_LARGE
    ),
    make_invariant(
      "column-group bold band: column_group.bold.fg must read on column_group.bold.bg",
      fg = theme@column_group@bold@fg,
      bg = theme@column_group@bold@bg,
      path = c("column_group.bold.fg", "column_group.bold.bg",
               "content.inverse", "inputs$secondary_deep"),
      min_ratio = WCAG_AA_LARGE
    ),
    make_invariant(
      "header tint band: header.tint.fg must read on header.tint.bg",
      fg = theme@header@tint@fg,
      bg = theme@header@tint@bg,
      path = c("header.tint.fg", "header.tint.bg",
               "content.primary", "inputs$primary_deep"),
      min_ratio = WCAG_AA_LARGE
    ),
    make_invariant(
      "leaf header light band: header.light.fg must read on surface.base",
      fg = theme@header@light@fg,
      bg = theme@surface@base,
      path = c("header.light.fg", "content.primary", "surface.base"),
      min_ratio = WCAG_AA_NORMAL
    ),
    make_invariant(
      "default cell text: content.primary must read on surface.base",
      fg = theme@content@primary,
      bg = theme@surface@base,
      path = c("content.primary", "surface.base"),
      min_ratio = WCAG_AA_NORMAL
    )
  )

  failures <- list()
  for (inv in invariants) {
    # Skip if either side is NA — resolution should have filled them, but
    # if they're somehow NA we don't want to mask that with a bad-hex
    # error; the upstream NA fill should fix it.
    if (is.na(inv$fg) || is.na(inv$bg)) next
    cr <- contrast_ratio(inv$fg, inv$bg)
    if (cr < inv$min_ratio) {
      failures[[length(failures) + 1]] <- list(
        name      = inv$name,
        ratio     = cr,
        min_ratio = inv$min_ratio,
        fg        = inv$fg,
        bg        = inv$bg,
        path      = inv$path
      )
    }
  }

  if (length(failures) > 0L) {
    msgs <- character()
    for (f in failures) {
      ratio_str <- sprintf("%.2f", f$ratio)
      msgs <- c(
        msgs,
        sprintf(
          "%s\n  fg=%s on bg=%s -> contrast=%s (need >=%.1f)\n  cascade: %s",
          f$name, f$fg, f$bg, ratio_str, f$min_ratio,
          paste(f$path, collapse = " <- ")
        )
      )
    }
    cli::cli_abort(c(
      "Theme failed {length(failures)} contrast invariant{?s}.",
      "i" = "Each violation lists the cascade path you can override to fix it.",
      stats::setNames(msgs, rep_len("x", length(msgs)))
    ))
  }

  invisible(NULL)
}
