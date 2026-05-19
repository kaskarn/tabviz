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

## OKLab precision gap — RESOLVED via canonization (post-0.2.0)

R's `farver` and TS's hand-rolled OKLab transform produce OKLCH triples
that differ by ~5e-6 L / ~6e-5 C / ~0.03° H. These compound through
gamut-bisection clamping into 1-25 channels of drift on chroma-related
derivations near saturation boundaries.

**Resolution (option C from the original phase-2 list)**: TS is now
canonical for `srcjs/src/lib/theme-presets-v2.json`. The snapshot is
regenerated from the TS cascade resolver via
`scripts/regenerate-theme-presets.ts`, and the parity test in
`theme-resolve.test.ts` is now byte-exact drift detection (snapshot vs
resolver output, same source).

Why this works:
- The npm runtime path is fully TS-resolved → TS-snapshotted → consistent.
- The R-rendered widget path is fully R-resolved → R-serialized → wire
  → JS renders the resolved values verbatim (no snapshot lookup).
- The JS-side theme switcher uses the TS-canonical snapshot. R-rendered
  widgets switch from "R-cochrane" (initial wire) to "TS-lancet"
  (snapshot) when the user clicks lancet — the difference is
  sub-perceptual (<25 channels per pixel), within OKLab precision.

Each runtime is now canonical in its own context; the divergence between
them no longer matters because no consumer compares them side-by-side
at byte level.

To refresh the snapshot after any change to `oklch.ts`,
`theme-resolve.ts`, `theme-validate.ts`, or `theme-presets-inputs.ts`
that affects resolved output:

```sh
cd srcjs && bun run scripts/regenerate-theme-presets.ts
```

Drift detection runs in CI via `theme-resolve.test.ts` — accidental
output changes fail the build until the snapshot is regenerated
intentionally.

## R-side opportunistic simplifications — DONE (post-0.2.0)

All 3 simplifications flagged during the TS port landed in the same
post-0.2.0 round as the OKLab canonization. R tests still green; visual
tests still 45/45.

1. ✅ **Deduped legacy-input migration** — extracted `check_legacy_inputs(args, arg_hint)`
   helper in `R/themes-api.R`. Both `web_theme()` and `set_inputs()` now
   call it with their respective context-tailored migration hint. Saved
   ~18 lines.
2. ✅ **Unified `fill_na` + `compose_text`** — `fill_na(obj, source)` in
   `R/utils-theme-resolve.R` now dispatches on `inherits(source, "S7_object")`:
   list sources iterate `names(source)`, S7 sources iterate
   `S7::prop_names(obj)`. `compose_text(over, under)` is kept as a thin
   alias so callsite readability is preserved.
3. ✅ **Dropped defensive `secondary_deep` re-mirror** — line 583 of the
   old resolver had a fallback `is.na(secondary_deep) ? primary_deep : secondary_deep`
   guard. Since `resolve_components` runs after `resolve_inputs_mirrors`,
   the guard was unreachable. Replaced with direct `theme@inputs@secondary_deep`
   access; full R test suite verifies no regression. Note: `resolve_text`
   keeps its similar-looking defensive guard intentionally — it supports
   test paths that call the function directly with raw inputs, bypassing
   the resolve_theme pipeline.

## Column constructors

Pending — PR2 work (this notes file gets updated as that work lands).
