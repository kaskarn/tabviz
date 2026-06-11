# Wire-format version constant (R side).
#
# This is the canonical version emitted on every WebSpec / SplitForestPayload
# the R serializer produces. The JS side validates it via
# `srcjs/src/spec/index.ts::validateSpecVersion`.
#
# SYNC POINT (docs/dev/frontend-split-spec.md §2.5 G6):
#   This constant MUST stay in sync with `CURRENT_VERSION` in
#   `srcjs/src/spec/index.ts`. The unit test in
#   `tests/testthat/test-wire-version.R` enforces this — it reads the TS
#   file and asserts the version strings match.
#
# Versioning policy (full statement in spec §3.4):
#   - Pre-release: evolve freely; policy informal until external consumers ship
#   - Steady-state major bumps:  breaking; require migration handler JS-side
#   - Steady-state minor bumps:  strictly additive; older readers ignore unknown
#   - Steady-state patch bumps:  documentation/internal; no wire change
#
# Bump procedure (steady-state):
#   1. Update WIRE_FORMAT_VERSION below.
#   2. Update `CURRENT_VERSION` in srcjs/src/spec/index.ts to match.
#   3. For major bumps: update `SUPPORTED_MAJORS` JS-side; add migration handler;
#      replace srcjs/src/spec/v1.0.json with srcjs/src/spec/vN.0.json.
#   4. For minor bumps: ensure additive-only — older readers must keep working.
#   5. Run `devtools::test()` (test-wire-version asserts sync) and visual tests.

# v1.2 (2026-06-04): additive Phase D substrate extensions — `geometry`
# (radius + border-width scales) and `effects` (glow + gradient-shell +
# elevation) optional input blocks. Mode-aware (HC drops effects; RT
# flattens gradient). Additive at the inputs layer; presets opt in.
#
# v1.4 (2026-06-10): additive interactivity-UX arc P0/P1 —
# `spec.figureLayout` figure-state block (column width pins, column
# reorder, row-kind height pins), `interaction.enableAxisZoom`, and the
# `row_kind_heights` Shiny event field.
#
# v1.5 (2026-06-11): additive component-model Stage 1 (W6) — the optional
# `components` block (component -> state -> channel -> role/slot value)
# on the theme: rides the resolved-theme blob in `spec.theme` and the
# portable theme envelope beside `roleOverrides`/`pins`. See
# docs/dev/component-model.md.
#
# v1.6 (2026-06-11): W3 — `theme.variants.headerStyle` REMOVED from the
# resolved-theme blob (pre-release clean break). The `header_style`
# input (inputs block) is the one vocabulary; activeHeaderStyle reads
# it directly. variants now carries only firstColumnStyle (+ density).
#
# v1.7 (2026-06-11): W4 arc 1 — six dead fields REMOVED from the
# resolved-theme blob: marks, cell, annotation, semantic, columnGroup,
# lightDarkPair (zero readers; docs/dev/w4-v3-blob-slimming.md records
# the verdicts). Pre-release clean break.
#
# v1.8 (2026-06-11): W4 arc 2 complete — the v3 `text` cluster REMOVED
# from the resolved-theme blob (consumers read --tv-text-{role}-{prop}
# manifest tokens; surviving clusters keep their embedded TextRole
# fields). D18 executed: title-fg binds to role `text`. Bridge rows for
# title-fg / numeric-figures / header trio all retired.
#
# v1.9 (2026-06-11): W4 — `theme.variants` and `theme.firstColumn`
# REMOVED from the blob. first_column_style is a Tier-1 INPUT (rides
# inputs); the four --tv-first-col-* tokens resolve via the new
# first-col resolver group. Dead "tint" first-column enum dropped.
WIRE_FORMAT_VERSION <- "1.9"
