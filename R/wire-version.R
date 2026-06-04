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
WIRE_FORMAT_VERSION <- "1.2"
