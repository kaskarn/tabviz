# R↔TS parity notes

Per-helper classification of R↔TS authoring parity. Captured during the
bilingual-API work for `@tabviz/core@0.2.0` (see plan
[`encapsulated-snacking-leaf.md`](../../../.claude/plans/encapsulated-snacking-leaf.md)).

Status legend:

- **thin-wrapper** — R helper is pure arg-packing; mechanical V8-delegation
  target for Phase 2. Body has no validation beyond what `checkmate` provides,
  no NSE, no computed defaults.
- **simplified-in-place** — touched during the TS port to consolidate
  redundancy or trim dead code.
- **keep-r-logic** — non-trivial R-specific logic (NSE, S7 method dispatch,
  hierarchical group resolution); not a Phase 2 delegation target.
- **phase-2-candidate** — Phase 1 leaves R-side untouched but the helper is
  on Phase 2's punch list; the parity tests + TS mirror are in place so the
  delegation can land mechanically.

## Themes

| R helper                          | Classification        | Notes |
|-----------------------------------|-----------------------|-------|
| `R/utils-oklch.R`                 | phase-2-candidate     | TS port at `srcjs/src/lib/oklch.ts` is faithful but ~1-25 channels of drift on chroma-related derivations vs `farver` near gamut boundaries (Ottosson coefficients are slightly different from farver's, and bisection amplifies the drift). Mitigation in Phase 1: tolerance-based parity test, R remains snapshot source of truth. Phase 2 options: (a) tune TS coefficients to match `farver`, (b) regenerate JSON snapshot from TS instead of R (cleanest long-term — makes TS canonical). |
| `R/utils-theme-resolve.R`         | phase-2-candidate     | TS port at `srcjs/src/lib/theme-resolve.ts`. Same per-function structure (`resolve_inputs_mirrors`, `resolve_chrome`, `resolve_data`, `resolve_text`, `resolve_spacing`, `resolve_components`). Output passes JS-side tolerance parity against R snapshot for all 4 journal presets. **Suggested R-side streamline**: `fill_na` and `compose_text` are the same null-fallback iteration pattern (~7 lines each); could share a generic helper. Line 583's defensive `secondary_deep` re-mirror is redundant — `resolve_inputs_mirrors` should have already filled it. |
| `R/utils-theme-validate.R`        | phase-2-candidate     | TS port at `srcjs/src/lib/theme-validate.ts`. 5 contrast invariants ported verbatim. `ThemeValidationError` carries the same path + cascade info as R's `cli::cli_abort` structured message. |
| `R/themes.R` (4 journal presets)  | thin-wrapper          | Pure Tier 1 input bundles + `resolve_theme()` call. TS mirrors at `srcjs/src/lib/theme-presets-inputs.ts`. Snapshot JSON at `theme-presets-v2.json` remains R-resolved truth (journal presets). |
| `R/themes-lotr.R` (3 LOTR presets)| thin-wrapper          | Same shape as journals. TS mirrors at `theme-presets-inputs.ts`; resolved at JS module load (no R snapshot). Pre-release; may be removed before CRAN. |
| `R/themes-api.R::web_theme`       | phase-2-candidate     | TS mirror at `srcjs/src/lib/theme-api.ts::webTheme`. **Suggested R-side streamline**: the `brand` / `tertiary` legacy migration check (lines 84-100) is duplicated verbatim in `set_inputs` (lines 158-173). Pull into a single `check_legacy_inputs(args)` helper. |
| `R/themes-api.R::set_inputs`      | phase-2-candidate     | TS mirror at `theme-api.ts::setInputs`. See `web_theme` streamline. |
| `R/themes-api.R::set_variants`    | phase-2-candidate     | TS mirror at `theme-api.ts::setVariants`. |
| `R/themes-api.R::set_spacing`     | thin-wrapper          | TS mirror at `theme-api.ts::setSpacing`. |
| `R/themes-api.R::set_theme_field` | phase-2-candidate     | TS mirror at `theme-api.ts::setThemeField`. R uses recursive `set_at` walking via S7 prop accessors + integer indexing; TS uses `structuredClone` + dot-path. Same semantics, idiomatic differences. |

## OKLab precision gap (Phase 2 work item)

The most load-bearing parity gap is the color math itself. R's `farver` and
TS's hand-rolled OKLab transform produce OKLCH triples that differ by:

- L: ~5e-6
- C: ~6e-5
- H: ~0.03°

These are negligible in isolation but compound through:

1. Round-tripping (hex → oklch → modify → hex → oklch ...). Each round-trip
   loses a few bits of precision via the bisection-based gamut clamp.
2. Chroma operations near the gamut boundary. Increasing C on an already
   saturated color triggers bisection; tiny coefficient differences flip
   the clamp result by 5-25 channels.

Visual impact: imperceptible (the differences are sub-perceptual on screen).
Wire impact: snapshot comparisons fail byte-equality for chrome/series
derivations that use `oklch_chroma` or `oklch_mix` near gamut boundaries.

**Workaround in 0.2.0**: tolerance-based parity test in
`srcjs/src/lib/theme-resolve.test.ts` (per-channel delta ≤ 25). Documented
in the snapshot refresh command comment in `theme-presets.ts`.

**Phase 2 options** (in increasing impact):
- (a) Profile farver against Ottosson's reference to find the coefficient
  delta; tune TS to match. Cheapest if the delta is just a different
  cube-root or gamma-decode threshold.
- (b) Use a different OKLab impl (e.g., `culori`'s) that matches farver.
  Adds a dep; possibly slower.
- (c) Regenerate the JSON snapshot from TS instead of R. Makes TS canonical;
  R-side tests verify R serializes within tolerance of the snapshot. Cleanest
  long-term direction, since Phase 2 makes TS canonical anyway via V8
  delegation.

## R-side opportunistic simplifications spotted (not done in Phase 1)

These are flagged for the Phase 1 author to fold in opportunistically per
the plan's section E. None are blockers; all are pure code-quality wins.

1. **Dedupe legacy-input migration** (`R/themes-api.R` 84-100 + 158-173) —
   the `brand`/`tertiary` deprecation check is character-for-character
   identical between `web_theme()` and `set_inputs()`. Single helper.
2. **Unify `fill_na` + `compose_text`** (`R/utils-theme-resolve.R` 74-82 +
   333-341) — same null-fallback iteration over `S7::prop_names`. The R
   shape isn't 1:1 (one takes a list of defaults, the other takes a TextRole
   object), but they could share a generic core.
3. **Drop defensive secondary_deep re-mirror** (`R/utils-theme-resolve.R`
   line 583) — `resolve_inputs_mirrors` already guarantees `secondary_deep`
   is non-NA after the mirror chain. The local fallback inside
   `resolve_components` should be unreachable; verify with a `stopifnot`
   first, then remove.

## Column constructors

Pending — PR2 work (this notes file gets updated as that work lands).
